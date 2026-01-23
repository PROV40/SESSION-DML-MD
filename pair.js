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

async function waitForCreds(file, timeout = 30000) {
    const start = Date.now();
    while (!fs.existsSync(file)) {
        if (Date.now() - start > timeout) return false;
        await delay(500);
    }
    return true;
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
    let sessionSent = false; // 🔒 HARD LOCK

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
            // PAIRING CODE
            // =====================
            if (!sock.authState.creds.registered) {
                await delay(1500);
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
                    if (sessionSent) return;
                    sessionSent = true;

                    await sock.sendMessage(sock.user.id, {
                        text: `╭────── MESSAGE ─────╮
│ Connected Successfully ✅
│ Generating Session...
╰────────────────────╯`
                    });

                    const credsPath = path.join(tempDir, "creds.json");

                    // ✅ WAIT UNTIL CREDS REALLY EXIST
                    const ready = await waitForCreds(credsPath);
                    if (!ready) {
                        await sock.sendMessage(sock.user.id, {
                            text: "❌ Session generation failed. Please try again."
                        });
                        await cleanup();
                        sock.ws.close();
                        return;
                    }

                    const sessionData = fs.readFileSync(credsPath);
                    const base64 = Buffer.from(sessionData).toString('base64');

                    let sent = false;

                    // CTA FIRST
                    try {
                        await sock.sendMessage(sock.user.id, {
                            interactiveMessage: {
                                header: "🔐 DML-MD SESSION 🆔",
                                title: "Tap below to copy your session",
                                footer: "> © Powered by Dml",
                                buttons: [
                                    {
                                        name: "cta_copy",
                                        buttonParamsJson: JSON.stringify({
                                            display_text: "Copy Session",
                                            copy_code: base64
                                        })
                                    }
                                ]
                            }
                        });
                        sent = true;
                    } catch {}

                    // FALLBACK
                    if (!sent) {
                        await sock.sendMessage(sock.user.id, { text: base64 });
                    }

                    await delay(1500);
                    await cleanup();
                    sock.ws.close();
                }

                else if (connection === 'close') {
                    if (sessionSent) return;

                    if (lastDisconnect?.error?.output?.statusCode !== 401) {
                        await delay(5000);
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
