const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

// =======================
// Helpers
// =======================

// Upload to Catbox (permanent for any file)
async function uploadToCatbox(filePath) {
    const form = new FormData();
    form.append("reqtype", "fileupload");
    form.append("fileToUpload", fs.createReadStream(filePath));

    const res = await axios.post("https://catbox.moe/user/api.php", form, {
        headers: form.getHeaders(),
        timeout: 15000 // prevent hanging forever
    });

    return res.data; // permanent URL
}

// Extract buffer + extension from different media types
async function extractMedia(message) {
    const m = message.message || {};

    const handlers = {
        imageMessage: { type: 'image', ext: '.jpg' },
        videoMessage: { type: 'video', ext: '.mp4' },
        audioMessage: { type: 'audio', ext: '.mp3' },
        documentMessage: { type: 'document', ext: null },
        stickerMessage: { type: 'sticker', ext: '.webp' }
    };

    for (const key in handlers) {
        if (m[key]) {
            const { type, ext } = handlers[key];
            const stream = await downloadContentFromMessage(m[key], type);
            const chunks = [];
            for await (const chunk of stream) chunks.push(chunk);

            if (key === 'documentMessage') {
                const fileName = m.documentMessage.fileName || 'file.bin';
                return { buffer: Buffer.concat(chunks), ext: path.extname(fileName) || '.bin' };
            }

            return { buffer: Buffer.concat(chunks), ext };
        }
    }

    return null;
}

// Extract quoted media (reply case)
async function extractQuotedMedia(message) {
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted) return null;
    return extractMedia({ message: quoted });
}

// =======================
// Vision Command
// =======================
async function visionCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;

        // React to message
        await sock.sendMessage(chatId, { react: { text: '👀', key: message.key } });

        // Validate input
        if (!text) {
            return sock.sendMessage(chatId, { text: 'Quote an image and give instructions eh.' }, { quoted: message });
        }

        // Extract quoted media (only image allowed)
        const quotedMedia = await extractQuotedMedia(message);
        if (!quotedMedia) {
            return sock.sendMessage(chatId, { text: 'No image found. Reply to an image with instructions!' }, { quoted: message });
        }

        // Check if it's an image
        const validImageExts = ['.jpg', '.jpeg', '.png', '.webp'];
        if (!validImageExts.includes(quotedMedia.ext.toLowerCase())) {
            return sock.sendMessage(chatId, { text: 'That’s not a valid image format.' }, { quoted: message });
        }

        // Temp file handling
        const tempDir = path.join(__dirname, '../temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        const tempPath = path.join(tempDir, `${Date.now()}${quotedMedia.ext}`);
        fs.writeFileSync(tempPath, quotedMedia.buffer);

        try {
            // Upload image to Catbox
            const imageUrl = await uploadToCatbox(tempPath);

            await sock.sendMessage(chatId, { text: 'Analyzing the image, hold on...' }, { quoted: message });

            // Call Gemini Vision API with timeout + error handling
            const apiUrl = `https://api.bk9.dev/ai/geminiimg?url=${encodeURIComponent(imageUrl)}&q=${encodeURIComponent(text)}`;
            const response = await axios.get(apiUrl, { timeout: 20000 }).catch(err => {
                throw new Error(`API unreachable: ${err.code || err.message}`);
            });

            const data = response.data;

            if (!data || !data.BK9) {
                throw new Error('Empty response from Vision API');
            }

            // Send the analysis result
            await sock.sendMessage(chatId, { text: data.BK9 }, { quoted: message });

        } catch (apiError) {
            console.error('[Vision] API error:', apiError);
            await sock.sendMessage(chatId, { text: `❌ Could not analyze the image.\nReason: ${apiError.message}` }, { quoted: message });
        } finally {
            // Cleanup temp file
            setTimeout(() => {
                if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
            }, 2000);
        }

    } catch (error) {
        console.error('[Vision] error:', error);
        await sock.sendMessage(chatId, { text: `❌ Unexpected error:\n${error.message}` }, { quoted: message });
    }
}

module.exports = visionCommand;
