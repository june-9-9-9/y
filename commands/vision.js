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
            timeout: 30000 // 30 seconds timeout
        });

        if (res.data && typeof res.data === 'string' && res.data.includes('http')) {
            return res.data.trim();
        } else {
            throw new Error('Invalid response from Catbox');
        }
    } catch (error) {
        console.error('[Catbox Upload] error:', error.message);
        throw error;
    }
}

// Upload to Ugu as fallback
async function uploadToUgu(filePath) {
    try {
        const result = await UploadFileUgu(filePath);
        return result.url || result.link || result;
    } catch (error) {
        console.error('[Ugu Upload] error:', error?.message || error);
        throw error;
    }
}

// Upload to any available service with fallback
async function uploadToAnyService(filePath) {
    try {
        // Try Catbox first
        console.log('[Upload] Trying Catbox...');
        const catboxUrl = await uploadToCatbox(filePath);
        console.log('[Upload] Success with Catbox:', catboxUrl);
        return catboxUrl;
    } catch (catboxError) {
        console.log('[Upload] Catbox failed, trying Ugu...');
        
        // Try Ugu as fallback
        try {
            const uguUrl = await uploadToUgu(filePath);
            console.log('[Upload] Success with Ugu:', uguUrl);
            return uguUrl;
        } catch (uguError) {
            console.error('[Upload] Both services failed');
            throw new Error(`Upload failed. Catbox: ${catboxError.message}, Ugu: ${uguError.message}`);
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

// Call Gemini Vision API with better error handling
async function callGeminiVision(imageUrl, text) {
    try {
        console.log('[Gemini API] Calling with URL:', imageUrl);
        console.log('[Gemini API] Query:', text);
        
        const apiUrl = `https://api.bk9.dev/ai/geminiimg?url=${encodeURIComponent(imageUrl)}&q=${encodeURIComponent(text)}`;
        console.log('[Gemini API] Full URL:', apiUrl);
        
        const response = await axios.get(apiUrl, {
            timeout: 60000, // 60 seconds timeout for analysis
            headers: {
                'User-Agent': 'Mozilla/5.0 (WhatsApp-Bot)'
            }
        });
        
        console.log('[Gemini API] Response status:', response.status);
        
        if (response.data && response.data.BK9) {
            return response.data.BK9;
        } else if (response.data) {
            // Try to extract response from different possible formats
            const data = response.data;
            if (typeof data === 'string') return data;
            if (data.text) return data.text;
            if (data.response) return data.response;
            if (data.result) return data.result;
            
            return JSON.stringify(data, null, 2);
        } else {
            throw new Error('API returned empty response');
        }
    } catch (error) {
        console.error('[Gemini API] Error:', error.message);
        console.error('[Gemini API] Response:', error.response?.data);
        
        if (error.response) {
            const status = error.response.status;
            if (status === 500) {
                throw new Error('Gemini API server error (500). The service might be temporarily unavailable.');
            } else if (status === 400) {
                throw new Error('Bad request to Gemini API. The image might be too large or invalid.');
            } else if (status === 429) {
                throw new Error('Too many requests to Gemini API. Please try again later.');
            } else {
                throw new Error(`Gemini API error: ${status} - ${error.response.statusText}`);
            }
        } else if (error.code === 'ECONNREFUSED') {
            throw new Error('Cannot connect to Gemini API. Service might be down.');
        } else if (error.code === 'ETIMEDOUT') {
            throw new Error('Gemini API request timed out. Please try again.');
        } else {
            throw error;
        }
    }
}

// =======================
// Vision Command
// =======================
async function visionCommand(sock, chatId, message) {
    let tempPath = null;
    
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        
        // React to message
        await sock.sendMessage(chatId, { react: { text: '👀', key: message.key } });

        // Validate input
        if (!text) {
            return sock.sendMessage(
                chatId,
                { text: '𝗤𝘂𝗼𝘁𝗲 𝗮𝗻 𝗶𝗺𝗮𝗴𝗲 𝗮𝗻𝗱 𝗴𝗶𝘃𝗲 𝘀𝗼𝗺𝗲 𝗶𝗻𝘀𝘁𝗿𝘂𝗰𝘁𝗶𝗼𝗻𝘀 𝗲𝗵.\n 𝗔𝗶, 𝗶 𝘂𝘀𝗲 𝗕𝗮𝗿𝗱 𝘁𝗼 𝗮𝗻𝗮𝗹𝘆𝘇𝗲 𝗶𝗺𝗮𝗴𝗲𝘀.' },
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
        const validImageExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
        const fileExt = quotedMedia.ext.toLowerCase();
        if (!validImageExts.includes(fileExt)) {
            return sock.sendMessage(
                chatId,
                { text: `𝗛𝘂𝗵, 𝗧𝗵𝗮𝘁\'𝘀 𝗻𝗼𝘁 𝗮𝗻 𝗶𝗺𝗮𝗴𝗲 (${fileExt}),\n𝗦𝗲𝗻𝗱 𝗮𝗻 𝗶𝗺𝗮𝗴𝗲 (jpg, png, webp) 𝘁𝗵𝗲𝗻 𝘁𝗮𝗴 𝗶𝘁 𝘄𝗶𝘁𝗵 𝘁𝗵𝗲 𝗶𝗻𝘀𝘁𝗿𝘂𝗰𝘁𝗶𝗼𝗻𝘀 !` },
                { quoted: message }
            );
        }

        // Temp file handling
        const tempDir = path.join(__dirname, '../temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        tempPath = path.join(tempDir, `${Date.now()}${quotedMedia.ext}`);
        fs.writeFileSync(tempPath, quotedMedia.buffer);
        
        console.log('[Vision] Temp file created:', tempPath, 'Size:', quotedMedia.buffer.length, 'bytes');

        let imageUrl;
        try {
            // Upload image to any available service
            await sock.sendMessage(
                chatId,
                { text: '_📤 Uploading image to server..._' },
                { quoted: message }
            );
            
            imageUrl = await uploadToAnyService(tempPath);
            console.log('[Vision] Image uploaded:', imageUrl);
            
            // Analyze image
            await sock.sendMessage(
                chatId,
                { text: '_🔍 Analyzing image content... This may take a moment..._' },
                { quoted: message }
            );
            
            const analysis = await callGeminiVision(imageUrl, text);
            
            // Send the analysis result
            await sock.sendMessage(
                chatId,
                { 
                    text: `📝 *Analysis Result:*\n\n${analysis}\n\n_Image URL: ${imageUrl}_`,
                    contextInfo: {
                        forwardingScore: 0,
                        isForwarded: false,
                        externalAdReply: {
                            title: "🔍 Image Analysis Complete",
                            body: "Powered by Gemini Vision",
                            mediaType: 1,
                            thumbnailUrl: imageUrl,
                            sourceUrl: imageUrl
                        }
                    }
                },
                { quoted: message }
            );
            
        } catch (apiError) {
            console.error('[Vision] Processing error:', apiError);
            await sock.sendMessage(
                chatId,
                { text: `❌ *Failed to analyze image:*\n\n${apiError.message}\n\n_Please try again with a different image or check if the image URL is accessible._` },
                { quoted: message }
            );
        }

    } catch (error) {
        console.error('[Vision] General error:', error);
        await sock.sendMessage(
            chatId,
            { text: `❌ *An unexpected error occurred:*\n\n${error.message || error}\n\n_Please check the image format and try again._` },
            { quoted: message }
        );
    } finally {
        // Cleanup temp file
        if (tempPath && fs.existsSync(tempPath)) {
            setTimeout(() => {
                try {
                    fs.unlinkSync(tempPath);
                    console.log('[Vision] Temp file cleaned:', tempPath);
                } catch (cleanupError) {
                    console.error('[Vision] Cleanup error:', cleanupError.message);
                }
            }, 3000);
        }
    }
}

module.exports = visionCommand;
