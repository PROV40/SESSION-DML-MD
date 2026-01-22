const express = require('express');
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const { makeid } = require('./id');

const {
    default: Fredi,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');

const router = express.Router();
const sessionDir = path.join(__dirname, "temp");

// =====================
// UTIL
// =====================
function removeFile(dir) {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

// =====================
// ROUTE
// =====================
router.get('/', async (req, res) => {
    const id = makeid();
    const num = (req.query.number || '').replace(/[^0-9]/g, '');
    const tempDir = path.join(sessionDir, id);

    let responseSent = false;
    let cleaned = false;

    async function cleanup() {
        if (!cleaned) {
            removeFile(tempDir);
            cleaned = true;
        }
    }

    async function startPairing() {
        try {
            const { version } = await fetchLatestBaileysVersion();
            const { state, saveCreds } = await useMultiFileAuthState(tempDir);

            const sock = Fredi({
                version,
                logger: pino({ level: 'fatal' }),
                printQRInTerminal: false,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(
                        state.keys,
                        pino({ level: 'fatal' })
                    ),
                },
                browser: ["Ubuntu", "Chrome", "125"],
                markOnlineOnConnect: true
            });

            sock.ev.on('creds.update', saveCreds);

            // =====================
            // PAIRING CODE API
            // =====================
            if (!sock.authState.creds.registered) {
                await delay(2000);
                const code = await sock.requestPairingCode(num);
                if (!responseSent && !res.headersSent) {
                    res.json({ code });
                    responseSent = true;
                }
            }

            // =====================
            // CONNECTION EVENTS
            // =====================
            sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
                if (connection === 'open') {

                    // ✅ STATUS MESSAGE
                    await sock.sendMessage(sock.user.id, {
                        text: `╭────── MESSAGE ──────╮
│ Connected Successfully ✅
│ Generating Session...
╰────────────────────╯`
                    });

                    await delay(15000);

                    const credsPath = path.join(tempDir, "creds.json");
                    if (!fs.existsSync(credsPath)) {
                        await cleanup();
                        sock.ws.close();
                        return;
                    }

                    const sessionData = fs.readFileSync(credsPath);
                    const base64 = Buffer.from(sessionData).toString('base64');

                    // =====================
                    // SEND SESSION (CTA FIRST)
                    // =====================
                    let sent = false;

                    // 👉 CTA COPY
                    try {
                        await sock.sendMessage(sock.user.id, {
                            interactiveMessage: {
                                header: "🔐 DML-MD SESSION 🆔",
                                title: "Tap below to copy your session",
                                footer: "> © Powered by DML-MD",
                                buttons: [
                                    {
                                        name: "cta_copy",
                                        buttonParamsJson: JSON.stringify({
                                            display_text: "Copy Session",
                                            copy_code: base64 // ✅ ONLY SESSION
                                        })
                                    }
                                ]
                            }
                        });
                        sent = true;
                    } catch (e) {}

                    // 👉 FALLBACK (RAW SESSION ONLY)
                    if (!sent) {
                        await sock.sendMessage(sock.user.id, {
                            text: base64
                        });
                    }

                    await delay(2000);
                    sock.ws.close();
                    await cleanup();

                } else if (connection === 'close') {
                    if (lastDisconnect?.error?.output?.statusCode !== 401) {
                        await delay(8000);
                        startPairing();
                    } else {
                        await cleanup();
                    }
                }
            });

        } catch (err) {
            console.error("Pairing error:", err);
            await cleanup();
            if (!responseSent && !res.headersSent) {
                res.status(500).json({ code: "Service Error" });
            }
        }
    }

    startPairing();
});

module.exports = router;
