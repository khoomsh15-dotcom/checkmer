const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const TelegramBot = require('node-telegram-bot-api');
const pino = require('pino');
const express = require('express');

// --- 1. EXPRESS SERVER FOR UPTIME ---
const app = express();
const port = process.env.PORT || 10000;

app.get('/', (req, res) => {
    res.send('Bot is Online! Uptime Monitor is active.');
});

app.listen(port, () => {
    console.log(`Web server running on port ${port}`);
});

// --- 2. BOT LOGIC ---
const TG_TOKEN = process.env.TG_TOKEN;
const tgBot = new TelegramBot(TG_TOKEN, { polling: true });

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true
    });

    sock.ev.on('creds.update', saveCreds);

    tgBot.onText(/\/check (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const numbers = match[1].split(',').map(n => n.trim().replace(/[^0-9]/g, ''));

        if (numbers.length === 0) return tgBot.sendMessage(chatId, "❌ No valid numbers.");

        tgBot.sendMessage(chatId, `🔍 Xeon Engine: Checking ${numbers.length} numbers...`);

        for (const num of numbers) {
            try {
                // Xeon's custom ban checker
                const result = await sock.xeonBanChecker(num);
                const res = JSON.parse(result);

                let status = "";
                if (res.isBanned) {
                    status = `🚫 *BANNED*\nViolation: ${res.data?.violation_type || 'Unknown'}`;
                } else if (res.isNeedOfficialWa) {
                    status = `🔒 *RESTRICTED* (Needs Official WA)`;
                } else {
                    status = `✅ *CLEAN*`;
                }

                await tgBot.sendMessage(chatId, `📞 +${num}\nStatus: ${status}`, { parse_mode: 'Markdown' });

            } catch (e) {
                await tgBot.sendMessage(chatId, `⚠️ +${num}: Error in Xeon Check.`);
                console.error(e);
            }
            // 2s delay to prevent rate limits
            await new Promise(r => setTimeout(r, 2000));
        }
        tgBot.sendMessage(chatId, "✅ Bulk check finished.");
    });

    console.log("Xeon Ban Checker Bot with Web Server is Live!");
}

startBot();
