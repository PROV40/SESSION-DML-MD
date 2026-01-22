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

function removeFile(dir) {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
    const id = makeid();
    const num = (req.query.number || '').replace(/[^0-9]/g, '');
    const tempDir = path.join(sessionDir, id);
    let responseSent = false;
    let sessionCleanedUp = false;

    async function cleanUpSession() {
        if (!sessionCleanedUp) {
            try {
                removeFile(tempDir);
            } catch (e) {
                console.error("Cleanup error:", e);
            }
            sessionCleanedUp = true;
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
                markOnlineOnConnect: true,
                connectTimeoutMs: 120000,
                keepAliveIntervalMs: 30000
            });

            sock.ev.on('creds.update', saveCreds);

            // === Pairing Code ===
            if (!sock.authState.creds.registered) {
                await delay(2000);
                const code = await sock.requestPairingCode(num);
                if (!responseSent && !res.headersSent) {
                    res.json({ code });
                    responseSent = true;
                }
            }

            sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
                if (connection === 'open') {
                    console.log('✅ Connected to WhatsApp');

                    await sock.sendMessage(sock.user.id, {
                        text: `╭────── DML-MD ──────╮
│ Connected! 👋
│ Generating Session...
╰────────────────────╯`
                    });

                    await delay(15000);

                    const credsPath = path.join(tempDir, "creds.json");
                    let sessionData = null;

                    for (let i = 0; i < 10; i++) {
                        if (fs.existsSync(credsPath)) {
                            const data = fs.readFileSync(credsPath);
                            if (data.length > 50) {
                                sessionData = data;
                                break;
                            }
                        }
                        await delay(4000);
                    }

                    if (!sessionData) {
                        await sock.sendMessage(sock.user.id, {
                            text: "❌ Failed to generate session. Try again."
                        });
                        await cleanUpSession();
                        sock.ws.close();
                        return;
                    }

                    const base64 = Buffer.from(sessionData).toString('base64');

                    // 1️⃣ SEND CTA COPY (BEST UX)
                    try {
                        await sock.sendMessage(sock.user.id, {
                            viewOnceMessage: {
                                message: {
                                    interactiveMessage: {
                                        header: {
                                            title: "DML-MD SESSION"
                                        },
                                        body: {
                                            text: "Copy your session below 👇"
                                        },
                                        footer: {
                                            text: "Powered by DML"
                                        },
                                        nativeFlowMessage: {
                                            buttons: [
                                                {
                                                    name: "cta_copy",
                                                    buttonParamsJson: JSON.stringify({
                                                        display_text: "Copy Session",
                                                        copy_code: base64
                                                    })
                                                },
                                                {
                                                    name: "cta_url",
                                                    buttonParamsJson: JSON.stringify({
                                                        display_text: "Visit Bot Repo",
                                                        url: "https://github.com/MLILA17/DML-MD"
                                                    })
                                                }
                                            ]
                                        }
                                    }
                                }
                            }
                        });
                    } catch (e) {
                        console.log("⚠️ CTA message blocked by WhatsApp");
                    }

                    // ⏳ CRITICAL DELAY — allows WhatsApp to render CTA
                    await delay(3000);

                    // 2️⃣ FALLBACK (ALWAYS DELIVERED)
                    const sentSession = await sock.sendMessage(sock.user.id, {
                        text: base64
                    });

                    const infoMessage = `
✅ SESSION GENERATED SUCCESSFULLY!

⭐ GitHub: https://github.com/MLILA17
.
.
🚀 Powered by Dml
`;

                    await sock.sendMessage(
                        sock.user.id,
                        { text: infoMessage },
                        { quoted: sentSession }
                    );

                    await delay(2000);
                    sock.ws.close();
                    await cleanUpSession();

                } else if (connection === 'close') {
                    if (lastDisconnect?.error?.output?.statusCode !== 401) {
                        console.log('Reconnecting...');
                        await delay(10000);
                        startPairing();
                    } else {
                        await cleanUpSession();
                    }
                }
            });

        } catch (err) {
            console.error("❌ Pairing error:", err);
            await cleanUpSession();
            if (!responseSent && !res.headersSent) {
                res.status(500).json({ code: "Service Error" });
            }
        }
    }

    startPairing();
});

module.exports = router;
