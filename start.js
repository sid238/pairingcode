require('dotenv').config();
const express = require('express');
const pino = require('pino');
const fs = require('fs').promises;
const path = require('path');
const bodyParser = require('body-parser');
const { createBot } = require('./utils/index');

const app = express();
const PORT = process.env.PORT || 3000;

const MAIN_LOGGER = pino({
    timestamp: () => `,"time":"${new Date().toJSON()}"`
});
const logger = MAIN_LOGGER.child({});
logger.level = 'trace';

app.use(bodyParser.json());

app.post('/pairing-code', async (req, res) => {
    try {
        let { phoneNumber } = req.body;
        phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
        if (!phoneNumber) {
            return res.status(400).json({ status: 'Invalid phone number' });
        }
        const bot = await createBot(phoneNumber);
        if (!bot) {
            throw new Error('Bot creation failed');
        }
        setTimeout(async () => {
            try {
                const code = await bot.requestPairingCode(phoneNumber);
                const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;
                res.json({ pairingCode: formattedCode, status: 'Pairing code generated' });
            } catch (error) {
                res.status(500).json({ status: 'Error generating pairing code' });
            }
        }, 5000);
    } catch (error) {
        res.status(500).json({ status: 'Error generating pairing code' });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, './public/index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
