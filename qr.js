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
╭────── DML-MD ──────╮
│ ❒ Connected! 👋 │
│ ❒ Generating Session ID... │
│ ❒ Please wait... ⏳ │
╰────────────────────╯

` });
                    await delay(5000);
                    let data = fs.readFileSync(__dirname + `/temp/${id}/creds.json`);
                    await delay(8000);
                    let b64data = Buffer.from(data).toString('base64');
                    let session = await Qr_Code_By_Fredi.sendMessage(Qr_Code_By_Fredi.user.id, { text: '' + b64data });

                    let FEE_XMD_TEXT = `
╭━━━━━━━━━━━━━━━━━━━━━━╮
│ ✅ YOUR SESSION IS SUCCESSFULLY GENERATED! ✨ │
│ 💪 Empowering Your Experience with Dml Tech │
╰━━━━━━━━━━━━━━━━━━━━━━╯

👥 **Connect & Chat with Friends**
👉 Join Free: https://whatsapp.com/channel/0029VbBf4Y52kNFkFCx2pF1H

🌟 **Support Our Work**
⭐ Give our repo a star & follow the developer:
🔗 GitHub: https://github.com/MLILA17

💭 **Need Help or Updates?**
📢 Join our official support channel:
   WhatsApp Channel

📚 **Learn & Explore with Tutorials**
🪄 Check out our YouTube channel:
   https://www.youtube.com/@DaudyMussa-h1r

🚀 **Powered by DML — Together, We Build the Future of Automation!** 🚀
`;

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
