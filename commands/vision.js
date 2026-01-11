const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

// =======================
// Vision Command
// =======================
async function visionCommand(sock, chatId, message) {
    try {
        // React to message
        await sock.sendMessage(chatId, { react: { text: '👀', key: message.key } });

        const text = message.message?.conversation || 
                    message.message?.extendedTextMessage?.text || 
                    message.message?.imageMessage?.caption ||
                    'Analyze this image';

        // Validate input
        if (!text || text.trim() === '') {
            return sock.sendMessage(
                chatId,
                { text: '𝗤𝘂𝗼𝘁𝗲 𝗮𝗻 𝗶𝗺𝗮𝗴𝗲/𝘀𝘁𝗶𝗰𝗸𝗲𝗿/𝘃𝗶𝗱𝗲𝗼 𝗮𝗻𝗱 𝗴𝗶𝘃𝗲 𝘀𝗼𝗺𝗲 𝗶𝗻𝘀𝘁𝗿𝘂𝗰𝘁𝗶𝗼𝗻𝘀 𝗲𝗵. 𝘁𝗼 𝗮𝗻𝗮𝗹𝘆𝘇𝗲 𝗺𝗲𝗱𝗶𝗮.' },
                { quoted: message }
            );
        }

        // Extract media - check both current message and quoted message
        let mediaData = null;
        
        // First check if current message has media
        if (message.message?.imageMessage || 
            message.message?.videoMessage || 
            message.message?.stickerMessage) {
            mediaData = await extractMedia(message);
        } 
        // If not, check for quoted media
        else {
            const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (quoted) {
                mediaData = await extractMedia({ message: quoted });
            }
        }

        if (!mediaData) {
            return sock.sendMessage(
                chatId,
                { text: '𝗣𝗹𝗲𝗮𝘀𝗲 𝘀𝗲𝗻𝗱 𝗼𝗿 𝗾𝘂𝗼𝘁𝗲 𝗮𝗻 𝗶𝗺𝗮𝗴𝗲/𝘀𝘁𝗶𝗰𝗸𝗲𝗿/𝘃𝗶𝗱𝗲𝗼 𝘄𝗶𝘁𝗵 𝘆𝗼𝘂𝗿 𝗶𝗻𝘀𝘁𝗿𝘂𝗰𝘁𝗶𝗼𝗻𝘀!' },
                { quoted: message }
            );
        }

        // Check if it's a supported media type
        const validMediaExts = ['.jpg', '.jpeg', '.png', '.webp', '.mp4', '.mov', '.avi', '.mkv'];
        const lowerExt = mediaData.ext.toLowerCase();
        
        if (!validMediaExts.some(ext => lowerExt.includes(ext))) {
            return sock.sendMessage(
                chatId,
                { text: '❌ 𝗨𝗻𝘀𝘂𝗽𝗽𝗼𝗿𝘁𝗲𝗱 𝗺𝗲𝗱𝗶𝗮 𝘁𝘆𝗽𝗲!\n𝗜 𝗰𝗮𝗻 𝗮𝗻𝗮𝗹𝘆𝘇𝗲: 𝗶𝗺𝗮𝗴𝗲𝘀 (𝗝𝗣𝗚, 𝗣𝗡𝗚, 𝗪𝗲𝗯𝗣), 𝘀𝘁𝗶𝗰𝗸𝗲𝗿𝘀, 𝗮𝗻𝗱 𝘃𝗶𝗱𝗲𝗼𝘀 (𝗠𝗣𝟰, 𝗠𝗢𝗩, 𝗔𝗩𝗜, 𝗠𝗞𝗩)' },
                { quoted: message }
            );
        }

        // Check video size limit (e.g., 20MB max)
        const isVideo = ['.mp4', '.mov', '.avi', '.mkv'].some(ext => lowerExt.includes(ext));
        const maxVideoSize = 20 * 1024 * 1024; // 20MB
        
        if (isVideo && mediaData.buffer.length > maxVideoSize) {
            return sock.sendMessage(
                chatId,
                { text: '❌ 𝗩𝗶𝗱𝗲𝗼 𝗶𝘀 𝘁𝗼𝗼 𝗹𝗮𝗿𝗴𝗲! 𝗣𝗹𝗲𝗮𝘀𝗲 𝘀𝗲𝗻𝗱 𝗮 𝘃𝗶𝗱𝗲𝗼 𝘀𝗺𝗮𝗹𝗹𝗲𝗿 𝘁𝗵𝗮𝗻 𝟮𝟬𝗠𝗕.' },
                { quoted: message }
            );
        }

        // Temp file handling
        const tempDir = path.join(__dirname, '../temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        const tempPath = path.join(tempDir, `vision_${Date.now()}${mediaData.ext}`);
        fs.writeFileSync(tempPath, mediaData.buffer);

        let mediaUrl;
        try {
            // Notify user that upload is in progress
            const processingMsg = isVideo ? 
                '📹 Uploading video for analysis...' : 
                mediaData.ext === '.webp' ? 
                '🖼️ Uploading sticker for analysis...' : 
                '📸 Uploading image for analysis...';
            
            await sock.sendMessage(
                chatId,
                { text: processingMsg },
                { quoted: message }
            );

            // Upload media to Catbox
            mediaUrl = await uploadToCatbox(tempPath);
            
            // Call the Gemini Vision API
            const apiUrl = `https://apiskeith.vercel.app/ai/gemini-vision?image=${encodeURIComponent(mediaUrl)}&q=${encodeURIComponent(text)}`;
            const response = await axios.get(apiUrl, { timeout: 30000 }); // 30 second timeout
            const data = response.data;
            
            // Check if response is valid
            if (!data?.status || !data?.result) {
                throw new Error('API returned an empty or invalid response');
            }
            
            // Format the response nicely
            const mediaType = isVideo ? 'Video' : (mediaData.ext === '.webp' ? 'Sticker' : 'Image');
            const resultText = `*${mediaType} Analysis Result:*\n\n${data.result}\n\n📎 *Media URL:* ${mediaUrl}`;
            
            // Send the analysis result
            await sock.sendMessage(
                chatId,
                { text: resultText },
                { quoted: message }
            );
            
        } catch (apiError) {
            console.error('[Vision] API error:', apiError?.message || apiError);
            
            let errorMsg = '❌ Failed to analyze the media:\n';
            
            if (apiError.code === 'ECONNABORTED') {
                errorMsg += 'Request timed out. The media might be too large or the API is slow.';
            } else if (apiError.response?.status === 413) {
                errorMsg += 'Media file is too large for the API to process.';
            } else if (apiError.response?.status === 415) {
                errorMsg += 'Unsupported media type for analysis.';
            } else {
                errorMsg += apiError.message || 'Unknown error occurred';
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
                    } catch (cleanupError) {
                        console.error('[Vision] Cleanup error:', cleanupError.message);
                    }
                }
            }, 2000);
        }

    } catch (error) {
        console.error('[Vision] error:', error?.message || error);
        await sock.sendMessage(
            chatId,
            { text: `❌ An error occurred while analyzing the media:\n${error.message}` },
            { quoted: message }
        );
    }
}

// =======================
// Helper Functions
// =======================

// Upload to Catbox (permanent for any file)
async function uploadToCatbox(filePath) {
    const form = new FormData();
    form.append("reqtype", "fileupload");
    form.append("fileToUpload", fs.createReadStream(filePath));

    const res = await axios.post("https://catbox.moe/user/api.php", form, {
        headers: form.getHeaders(),
        timeout: 60000 // 60 second timeout for large files
    });

    if (!res.data || typeof res.data !== 'string' || !res.data.startsWith('http')) {
        throw new Error('Invalid response from Catbox');
    }

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

module.exports = visionCommand;
