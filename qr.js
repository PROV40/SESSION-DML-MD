const PastebinAPI = require('pastebin-js');
const pastebin = new PastebinAPI('EMWTMkQAVfJa9kM-MRUrxd5Oku1U7pgL');
const { makeid } = require('./id');
const QRCode = require('qrcode');
const express = require('express');
const path = require('path');
const fs = require('fs');
let router = express.Router();
const pino = require('pino');
const {
    default: Fredi,
    useMultiFileAuthState,
    jidNormalizedUser,
    Browsers,
    delay,
    makeInMemoryStore,
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, {
        recursive: true,
        force: true
    });
}

const { readFile } = require('node:fs/promises');

router.get('/', async (req, res) => {
    const id = makeid();
    async function FEE_XMD_QR_CODE() {
        const { version } = await fetchLatestBaileysVersion();
        const { state, saveCreds } = await useMultiFileAuthState('./temp/' + id);
        try {
            let Qr_Code_By_Fredi = Fredi({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeInMemoryStore(state.keys, pino({ level: 'silent' }).child({ level: 'silent' })),
                },
                printQRInTerminal: false,
                logger: pino({ level: 'silent' }).child({ level: 'silent' }),
                browser: ['Ubuntu', 'Chrome'],
                syncFullHistory: false,
                connectTimeoutMs: 60000,
                keepAliveIntervalMs: 30000
            });

            Qr_Code_By_Fredi.ev.on('creds.update', saveCreds);
            Qr_Code_By_Fredi.ev.on('connection.update', async (s) => {
                const { connection, lastDisconnect, qr } = s;
                if (qr) await res.end(await QRCode.toBuffer(qr));
                if (connection === 'open') {
                    await Qr_Code_By_Fredi.sendMessage(Qr_Code_By_Fredi.user.id, { text: `
╭┈┈┈┈━━━━━━┈┈┈┈◈
┋❒ Hello! 👋 You're now connected to 🄵🄴🄴-🅇🄼🄳.

┋❒ Please wait a moment while we generate your session ID. It will be sent shortly... 🙂
╰┈┈┈┈━━━━━━┈┈┈┈◈
` });
                    await delay(5000);
                    let data = fs.readFileSync(__dirname + `/temp/${id}/creds.json`);
                    await delay(8000);
                    let b64data = Buffer.from(data).toString('base64');
                    let session = await Qr_Code_By_Fredi.sendMessage(Qr_Code_By_Fredi.user.id, { text: '' + b64data });

                    let FEE_XMD_TEXT = `
🎄✨ *𝐇𝐀𝐏𝐏𝐘 𝐇𝐎𝐋𝐈𝐃𝐀𝐘𝐒 𝐅𝐑𝐎𝐌 𝐅𝐄𝐄-𝐗𝐌𝐃* ✨🎄  
╭━━━★˚☃️˚★━━━╮  
*🎁 DEVICE CONNECTED SUCCESSFULLY 🎁*  
╰━━━★˚🎅˚★━━━╯

📦 *Your Session ID is Ready!*  
🔐 Please copy and store it securely — you'll need it to deploy your *𝐅𝐄𝐄-𝐗𝐌𝐃* bot.

🎉 *𝑊𝑒 𝑊𝑖𝑠ℎ 𝑌𝑜𝑢 𝑎 𝑀𝑒𝑟𝑟𝑦 𝐶ℎ𝑟𝑖𝑠𝑡𝑚𝑎𝑠 𝑎𝑛𝑑 𝑎 𝐵𝑙𝑒𝑠𝑠𝑒𝑑 𝑁𝑒𝑤 𝑌𝑒𝑎𝑟 𝟐𝟎𝟐𝟔!* 🎊  

🌟 *Let the celebration begin with FEE-XMD power!*

┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈

📌 *Need Assistance? Reach Out Anytime:*  
• 👑 *Owner:* https://wa.me/255752593977  
• 💬 *Group Chat:* https://chat.whatsapp.com/KERPI5K0w0L9rzU00QSw40  
• 📢 *Channel:* https://whatsapp.com/channel/0029Vb6mzVF7tkj42VNPrZ3V  
• 📸 *Instagram:* https://www.instagram.com/frediezra  
• 💻 *GitHub Repo:* https://github.com/Fred1e/Fred1e

🧠 *Support FEE-XMD Project:*  
⭐ Star & 🍴 Fork the repo to stay updated with new features!

🎄 *#MerryChristmas | #HappyNewYear2026 | #FEEBot*`;

                    await Qr_Code_By_Fredi.sendMessage(Qr_Code_By_Fredi.user.id, { text: FEE_XMD_TEXT }, { quoted: session });

                    await delay(100);
                    await Qr_Code_By_Fredi.ws.close();
                    return await removeFile('./temp/' + id);
                } else if (connection === 'close' && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode != 401) {
                    await delay(5000); 
                    FEE_XMD_QR_CODE();
                }
            });
        } catch (err) {
            console.log('Service restarted due to error:', err);
            await removeFile('./temp/' + id);
            if (!res.headersSent) {
                await res.json({ code: 'Service is Currently Unavailable' });
            }
        }
    }
    return await FEE_XMD_QR_CODE();
});

module.exports = router;
