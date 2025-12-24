const { default: makeWASocket, useMultiFileAuthState, Browsers } = require("@whiskeysockets/baileys");
const TelegramBot = require('node-telegram-bot-api');
const pino = require('pino');
const express = require('express');

const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('Bot Active'));
app.listen(port);

const TG_TOKEN = process.env.TG_TOKEN;
const tgBot = new TelegramBot(TG_TOKEN, { polling: true });

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        // 1. IMPROVED BROWSER HEADERS: This mimics a real Chrome session better
        browser: Browsers.macOS('Desktop'), 
        syncFullHistory: false
    });

    sock.ev.on('creds.update', saveCreds);

    tgBot.onText(/\/check (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const numbers = match[1].split(',').map(n => n.trim().replace(/[^0-9]/g, ''));

        tgBot.sendMessage(chatId, `🚀 Xeon Engine v4: Checking ${numbers.length} numbers...`);

        for (const num of numbers) {
            try {
                // 2. THE CHECK: Using the Xeon custom function
                const result = await sock.xeonBanChecker(num);
                const res = JSON.parse(result);

                let status = "";
                let details = "";

                if (res.isBanned) {
                    status = "🚫 *BANNED*";
                    details = `\n⚠️ Violation: ${res.data?.violation_type || 'Spam/Third-Party'}\n🛠️ Appealable: ${res.data?.in_app_ban_appeal ? 'Yes' : 'No'}`;
                } else if (res.isNeedOfficialWa) {
                    // This often happens if the CHECKER account is low quality or the number is flagged
                    status = "🔒 *RESTRICTED*";
                    details = "\n⚠️ Warning: Needs Official WhatsApp for verification.";
                } else {
                    status = "✅ *CLEAN*";
                    details = "\n🎉 This number is safe to use.";
                }

                await tgBot.sendMessage(chatId, `📞 *Number:* +${num}\n*Status:* ${status}${details}`, { parse_mode: 'Markdown' });

            } catch (e) {
                // 3. FALLBACK: If Xeon function fails, use standard check
                try {
                    const [exists] = await sock.onWhatsApp(num);
                    if (exists) {
                        await tgBot.sendMessage(chatId, `📞 +${num}\nStatus: ✅ *CLEAN* (Standard Check)`);
                    } else {
                        await tgBot.sendMessage(chatId, `📞 +${num}\nStatus: ❌ *NOT ON WA / BANNED*`);
                    }
                } catch (err) {
                    await tgBot.sendMessage(chatId, `⚠️ +${num}: System Busy/Blocked.`);
                }
            }
            // INCREASE DELAY: 2025 security is sensitive. 4 seconds is safer for bulk.
            await new Promise(r => setTimeout(r, 4000));
        }
        tgBot.sendMessage(chatId, "🏁 Bulk check sequence finished.");
    });
}

startBot();
