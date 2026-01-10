const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { UploadFileUgu } = require('../lib/uploader');

// =======================
// Helpers
// =======================

// Upload to Catbox (permanent for any file)
async function uploadToCatbox(filePath) {
    try {
        const form = new FormData();
        form.append("reqtype", "fileupload");
        form.append("fileToUpload", fs.createReadStream(filePath));

        const res = await axios.post("https://catbox.moe/user/api.php", form, {
            headers: form.getHeaders(),
            timeout: 30000
        });

        return res.data.trim(); // permanent URL
    } catch (error) {
        console.error('[Catbox] Upload failed:', error.message);
        throw error;
    }
}

// Upload to Ugu as backup
async function uploadToUgu(filePath) {
    try {
        const result = await UploadFileUgu(filePath);
        return result.url || result.link || result;
    } catch (error) {
        console.error('[Ugu] Upload failed:', error?.message || error);
        throw error;
    }
}

// Try multiple upload services with fallback
async function uploadImageWithFallback(filePath) {
    try {
        // Try Catbox first
        console.log('[Upload] Trying Catbox...');
        const catboxUrl = await uploadToCatbox(filePath);
        console.log('[Upload] Success with Catbox');
        return catboxUrl;
    } catch (catboxError) {
        console.log('[Upload] Catbox failed, trying Ugu...');
        
        try {
            // Try Ugu as backup
            const uguUrl = await uploadToUgu(filePath);
            console.log('[Upload] Success with Ugu');
            return uguUrl;
        } catch (uguError) {
            console.error('[Upload] Both services failed');
            throw new Error(`Upload failed: ${catboxError.message}`);
        }
    }
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
            return sock.sendMessage(
                chatId,
                { text: '𝗤𝘂𝗼𝘁𝗲 𝗮𝗻 𝗶𝗺𝗮𝗴𝗲 𝗮𝗻𝗱 𝗴𝗶𝘃𝗲 𝘀𝗼𝗺𝗲 𝗶𝗻𝘀𝘁𝗿𝘂𝗰𝘁𝗶𝗼𝗻𝘀 𝘂𝘀𝗲 𝗕𝗮𝗿𝗱 𝘁𝗼 𝗮𝗻𝗮𝗹𝘆𝘇𝗲 𝗶𝗺𝗮𝗴𝗲𝘀.' },
                { quoted: message }
            );
        }

        // Extract quoted media (only image allowed)
        const quotedMedia = await extractQuotedMedia(message);
        
        if (!quotedMedia) {
            return sock.sendMessage(
                chatId,
                { text: '𝗛𝘂𝗵, 𝗧𝗵𝗮𝘁\'𝘀 𝗻𝗼𝘁 𝗮𝗻 𝗶𝗺𝗮𝗴𝗲, 𝗦𝗲𝗻𝗱 𝗮𝗻 𝗶𝗺𝗮𝗴𝗲 𝘁𝗵𝗲𝗻 𝘁𝗮𝗴 𝗶𝘁 𝘄𝗶𝘁𝗵 𝘁𝗵𝗲 𝗶𝗻𝘀𝘁𝗿𝘂𝗰𝘁𝗶𝗼𝗻𝘀 !' },
                { quoted: message }
            );
        }

        // Check if it's an image (allow .jpg, .png, .jpeg, .webp)
        const validImageExts = ['.jpg', '.jpeg', '.png', '.webp'];
        if (!validImageExts.includes(quotedMedia.ext.toLowerCase())) {
            return sock.sendMessage(
                chatId,
                { text: '𝗛𝘂𝗵, 𝗧𝗵𝗮𝘁\'𝘀 𝗻𝗼𝘁 𝗮𝗻 𝗶𝗺𝗮𝗴𝗲, 𝗦𝗲𝗻𝗱 𝗮𝗻 𝗶𝗺𝗮𝗴𝗲 𝘁𝗵𝗲𝗻 𝘁𝗮𝗴 𝗶𝘁 𝘄𝗶𝘁𝗵 𝘁𝗵𝗲 𝗶𝗻𝘀𝘁𝗿𝘂𝗰𝘁𝗶𝗼𝗻𝘀 !' },
                { quoted: message }
            );
        }

        // Temp file handling
        const tempDir = path.join(__dirname, '../temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        const tempPath = path.join(tempDir, `${Date.now()}${quotedMedia.ext}`);
        fs.writeFileSync(tempPath, quotedMedia.buffer);

        let imageUrl;
        try {
            // Upload image using fallback strategy
            
            imageUrl = await uploadImageWithFallback(tempPath);
            
            // Notify user that analysis is in progress
            await sock.sendMessage(
                chatId,
                { text: '_𝗔 𝗺𝗼𝗺𝗲𝗻𝘁, 𝗟𝗲𝗺𝗺𝗲 𝗮𝗻𝗮𝗹𝘆𝘇𝗲 𝘁𝗵𝗲 𝗰𝗼𝗻𝘁𝗲𝗻𝘁𝘀 𝗼𝗳 𝘁𝗵𝗲 𝗶𝗺𝗮𝗴𝗲_' },
                { quoted: message }
            );
            
            // Call the Gemini Vision API
            const apiUrl = `https://api.bk9.dev/ai/geminiimg?url=${encodeURIComponent(imageUrl)}&q=${encodeURIComponent(text)}`;
            const response = await axios.get(apiUrl, { timeout: 60000 });
            const data = response.data;
            
            // Check if response is valid
            if (!data.BK9) {
                throw new Error('API returned an empty response');
            }
            
            // Send the analysis result
            await sock.sendMessage(
                chatId,
                { text: data.BK9 },
                { quoted: message }
            );
            
        } catch (apiError) {
            console.error('[Vision] API error:', apiError?.message || apiError);
            
            let errorMsg = `❌ Failed to analyze the image:\n`;
            
            if (apiError.message.includes('Upload failed')) {
                errorMsg += 'Could not upload image to any service. Please try again.';
            } else if (apiError.response?.status === 500) {
                errorMsg += 'Gemini API server error (500). Please try again later.';
            } else if (apiError.code === 'ECONNREFUSED') {
                errorMsg += 'Cannot connect to Gemini API. Service might be down.';
            } else if (apiError.code === 'ETIMEDOUT') {
                errorMsg += 'Request timed out. Please try again.';
            } else {
                errorMsg += apiError.message;
            }
            
            await sock.sendMessage(
                chatId,
                { text: errorMsg },
                { quoted: message }
            );
        } finally {
            // Cleanup temp file
            setTimeout(() => {
                if (fs.existsSync(tempPath)) {
                    try {
                        fs.unlinkSync(tempPath);
                    } catch (e) {
                        console.error('[Vision] Cleanup error:', e.message);
                    }
                }
            }, 2000);
        }

    } catch (error) {
        console.error('[Vision] error:', error?.message || error);
        await sock.sendMessage(
            chatId,
            { text: `❌ An error occurred while analyzing the image:\n${error.message}` },
            { quoted: message }
        );
    }
}

module.exports = visionCommand;
