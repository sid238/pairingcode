const {
    makeWASocket,
    Browsers,
    useMultiFileAuthState,
    DisconnectReason
} = require('@whiskeysockets/baileys');
const fs = require('fs').promises;
const path = require('path');
const pino = require('pino');
const axios = require('axios');

async function uploadToPastebin(content) {
    try {
        const response = await axios.post('https://pastebin.com/api/api_post.php', new URLSearchParams({
            api_dev_key: 'SUJu6nJmcu1YWnVOkg9dy7eKZv3LnVys',
            api_option: 'paste',
            api_paste_code: content,
            api_paste_private: '1',
            api_paste_expire_date: 'N',
            api_paste_format: 'json'
        }).toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        if (response.data.startsWith("https://pastebin.com/")) {
            return response.data.split("/").pop();
        } else {
            console.error('Unexpected Pastebin response:', response.data);
            return null;
        }
    } catch (error) {
        console.error('Error uploading session to Pastebin:', error);
        return null;
    }
}

async function createBot(phoneNumber) {
    try {
        const sessionDir = `./sessions/${phoneNumber}`;
        await fs.mkdir(sessionDir, { recursive: true });
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        const Zyrixo = makeWASocket({
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            browser: Browsers.macOS("Safari"),
            markOnlineOnConnect: false,
            keepAliveIntervalMs: 30_000,
            auth: state
        });
        Zyrixo.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                if (statusCode === DisconnectReason.loggedOut) {
                    console.log(`Logged out, deleting session for ${phoneNumber}`);
                    await fs.rm(sessionDir, { recursive: true, force: true }).catch(() => {});
                } else {
                    await createBot(phoneNumber);
                }
            } else if (connection === 'open') {
                console.log(`Connected: ${phoneNumber}`);
                try {
                    const credsPath = `${sessionDir}/creds.json`;
                    const credsData = await fs.readFile(credsPath, 'utf8');
                    const pastebinId = await uploadToPastebin(credsData);
                    if (pastebinId) {
                        const formattedMessage = `Ethix-MD&${pastebinId}`;
                        await Zyrixo.sendMessage(`${phoneNumber}@s.whatsapp.net`, { text: formattedMessage });
                        await fs.rm(sessionDir, { recursive: true, force: true });
                        console.log(`Deleted creds.json for ${phoneNumber}`);
                    } else {
                        console.error("Failed to upload session to Pastebin.");
                    }
                } catch (error) {
                    console.error('Error handling session upload:', error);
                }
            }
        });

        Zyrixo.ev.on('creds.update', saveCreds);
        return Zyrixo;
    } catch (error) {
        console.error('Error restoring bot:', error);
    }
}

module.exports = { createBot };
