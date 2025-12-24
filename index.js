const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const TelegramBot = require('node-telegram-bot-api');
const pino = require('pino');

// --- ENV CONFIG ---
const TG_TOKEN = process.env.TG_TOKEN;
const TARGET_GROUP_ID = process.env.TARGET_GROUP_ID; // Your TG chat ID

const tgBot = new TelegramBot(TG_TOKEN, { polling: true });

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    
    // 1. Initialize WhatsApp Socket
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true
    });

    sock.ev.on('creds.update', saveCreds);

    // 2. Telegram Command: /check 91xxx, 91xxx
    tgBot.onText(/\/check (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const numbers = match[1].split(',').map(n => n.trim().replace(/[^0-9]/g, ''));

        tgBot.sendMessage(chatId, `🔍 Checking ${numbers.length} numbers. Please wait...`);

        let report = `📊 *BAN CHECK REPORT*\n\n`;

        for (const num of numbers) {
            try {
                // Using the specific checker function from your snippet
                const result = await sock.xeonBanChecker(num); 
                const data = JSON.parse(result);

                if (data.isBanned) {
                    report += `❌ +${num}: *BANNED*\n`;
                } else {
                    report += `✅ +${num}: *CLEAN*\n`;
                }
            } catch (e) {
                report += `⚠️ +${num}: *ERROR/UNSUPPORTED*\n`;
            }
            // Anti-spam delay
            await new Promise(r => setTimeout(r, 2000));
        }

        tgBot.sendMessage(chatId, report, { parse_mode: 'Markdown' });
    });

    console.log("Bot is running. Waiting for commands on Telegram...");
}

startBot();
