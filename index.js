const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const TelegramBot = require('node-telegram-bot-api');
const pino = require('pino');

// --- CONFIG ---
const TG_TOKEN = process.env.TG_TOKEN;
const tgBot = new TelegramBot(TG_TOKEN, { polling: true });

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    
    // Initialize WhatsApp Socket (Using Xeon's Customized Baileys)
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true
    });

    sock.ev.on('creds.update', saveCreds);

    // Command: /check 91xxx, 91xxx
    tgBot.onText(/\/check (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const rawInput = match[1];
        
        // Clean and split numbers
        const numbers = rawInput.split(',').map(n => n.trim().replace(/[^0-9]/g, ''));

        if (numbers.length === 0) return tgBot.sendMessage(chatId, "❌ No valid numbers found.");

        tgBot.sendMessage(chatId, `🔍 Xeon Engine: Checking ${numbers.length} numbers...`);

        for (const num of numbers) {
            try {
                // Call the custom Xeon function
                const result = await sock.xeonBanChecker(num);
                const res = JSON.parse(result);

                let status = "";
                if (res.isBanned) {
                    status = `🚫 *BANNED* (Type: ${res.data?.violation_type || 'N/A'})`;
                } else if (res.isNeedOfficialWa) {
                    status = `🔒 *RESTRICTED* (Use Official WA)`;
                } else {
                    status = `✅ *CLEAN*`;
                }

                await tgBot.sendMessage(chatId, `📞 +${num}\nStatus: ${status}`, { parse_mode: 'Markdown' });

            } catch (e) {
                await tgBot.sendMessage(chatId, `⚠️ +${num}: Error in Xeon Check.`);
            }
            
            // 2 second delay to stay safe
            await new Promise(r => setTimeout(r, 2000));
        }

        tgBot.sendMessage(chatId, "✅ Bulk check completed.");
    });

    console.log("Xeon Ban Checker Bot is Live on Telegram!");
}

startBot();
