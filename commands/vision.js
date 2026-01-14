const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

// =======================
// Upload Helpers
// =======================

// Upload to Catbox (primary)
async function uploadToCatbox(filePath) {
    const form = new FormData();
    form.append("reqtype", "fileupload");
    form.append("fileToUpload", fs.createReadStream(filePath));

    const res = await axios.post("https://catbox.moe/user/api.php", form, {
        headers: form.getHeaders(),
        timeout: 30000
    });

    return res.data; // permanent URL
}

// Upload to Ugu.se (fallback)
async function uploadToUgu(filePath) {
    const form = new FormData();
    form.append("files[]", fs.createReadStream(filePath), {
        filename: path.basename(filePath)
    });

    const res = await axios.post("https://uguu.se/upload.php", form, {
        headers: {
            ...form.getHeaders(),
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 30000
    });

    if (res.data && res.data.success && res.data.files && res.data.files[0]) {
        return res.data.files[0].url;
    }
    throw new Error('Ugu upload failed');
}

// Main upload function with fallback
async function uploadImage(filePath) {
    try {
        console.log('[Upload] Trying Catbox...');
        const catboxUrl = await uploadToCatbox(filePath);
        console.log('[Upload] Catbox success:', catboxUrl);
        return catboxUrl;
    } catch (catboxError) {
        console.log('[Upload] Catbox failed, trying Ugu...:', catboxError.message);
        
        try {
            const uguUrl = await uploadToUgu(filePath);
            console.log('[Upload] Ugu success:', uguUrl);
            return uguUrl;
        } catch (uguError) {
            console.log('[Upload] Both uploaders failed');
            throw new Error(`Upload failed: Catbox - ${catboxError.message}, Ugu - ${uguError.message}`);
        }
    }
}

// =======================
// Media Extraction
// =======================

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
                { text: '𝗤𝘂𝗼𝘁𝗲 𝗮𝗻 𝗶𝗺𝗮𝗴𝗲 𝗮𝗻𝗱 𝗴𝗶𝘃𝗲 𝘀𝗼𝗺𝗲 𝗶𝗻𝘀𝘁𝗿𝘂𝗰𝘁𝗶𝗼𝗻𝘀 𝗲𝗵. 𝗜\'𝗺 𝗣𝗘𝗔𝗖𝗘 𝗔𝗶, 𝗶 𝘂𝘀𝗲 𝗕𝗮𝗿𝗱 𝘁𝗼 𝗮𝗻𝗮𝗹𝘆𝘇𝗲 𝗶𝗺𝗮𝗴𝗲𝘀.' },
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

        const tempPath = path.join(tempDir, `vision_${Date.now()}${quotedMedia.ext}`);
        fs.writeFileSync(tempPath, quotedMedia.buffer);

        let imageUrl;
        try {
            // Upload image (with fallback)
            imageUrl = await uploadImage(tempPath);
            
            // Notify user that analysis is in progress
            await sock.sendMessage(
                chatId,
                { text: '𝗔 𝗺𝗼𝗺𝗲𝗻𝘁, 𝗟𝗲𝗺𝗺𝗲 𝗮𝗻𝗮𝗹𝘆𝘇𝗲 𝘁𝗵𝗲 𝗰𝗼𝗻𝘁𝗲𝗻𝘁𝘀 𝗼𝗳 𝘁𝗵𝗲 𝗶𝗺𝗮𝗴𝗲. . .' },
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
            
            let errorMsg = '❌ Failed to analyze the image';
            if (apiError.code === 'ECONNABORTED' || apiError.message.includes('timeout')) {
                errorMsg += ' (Request timeout)';
            } else if (apiError.message.includes('Upload failed')) {
                errorMsg += ' (Failed to upload image to hosting services)';
            } else {
                errorMsg += `:\n${apiError.message}`;
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
                        console.log('[Cleanup] Temp file removed:', tempPath);
                    } catch (cleanupError) {
                        console.error('[Cleanup] Failed to remove temp file:', cleanupError.message);
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
