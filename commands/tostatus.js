const { downloadContentFromMessage, generateWAMessageContent, generateWAMessageFromContent } = require('@whiskeysockets/baileys');
const crypto = require('crypto');
const ffmpeg = require('fluent-ffmpeg');
const { PassThrough } = require('stream');
const fetch = require('node-fetch');

// ================================================
// Sticker Conversion Functions (Keep as is)
// ================================================

async function convertStickerToImage(stickerBuffer, mimetype = 'image/webp') {
    try {
        // Simple fallback
        return stickerBuffer;
    } catch (error) {
        console.error('Sticker conversion failed:', error);
        throw new Error(`Failed to convert sticker to image: ${error.message}`);
    }
}

// ================================================
// Personal Status Command - tostatusCommand
// ================================================
async function tostatusCommand(sock, chatId, msg) {
    try {
        const messageText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        const quotedMessage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        
        // ✅ Support multiple command formats for personal status
        const commandRegex = /^[.!#/]?(tostatus|mystatus|status|tostat|upstatus)\s*/i;

        // ✅ Show help if only command is typed without quote or text
        if (!quotedMessage && (!messageText.trim() || messageText.trim().match(commandRegex))) {
            return sock.sendMessage(chatId, { text: getPersonalStatusHelpText() });
        }

        let payload = null;
        
        // ✅ Extract caption if provided after command
        let textAfterCommand = '';
        if (messageText.trim()) {
            const match = messageText.match(commandRegex);
            if (match) {
                textAfterCommand = messageText.slice(match[0].length).trim();
            }
        }

        // ✅ Handle quoted message (video, image, audio, sticker, or text)
        if (quotedMessage) {
            payload = await buildPayloadFromQuoted(quotedMessage);
            
            // ✅ Add caption from command text if provided
            if (textAfterCommand && payload) {
                if (payload.video) {
                    payload.caption = textAfterCommand;
                } else if (payload.image) {
                    payload.caption = textAfterCommand;
                }
                // ✅ Also for stickers that are converted to images
                else if (payload.convertedSticker && payload.image) {
                    payload.caption = textAfterCommand;
                }
            }
        } 
        // ✅ Handle plain text command (only text after command)
        else if (messageText.trim()) {
            if (textAfterCommand) {
                payload = { text: textAfterCommand };
            } else {
                return sock.sendMessage(chatId, { text: getPersonalStatusHelpText() },{ quoted: msg });
            }
        }

        if (!payload) {
            return sock.sendMessage(chatId, { text: getPersonalStatusHelpText() },{ quoted: msg });
        }

        // ✅ Send personal status
        await sendPersonalStatus(sock, chatId, payload);

        const mediaType = detectMediaType(quotedMessage, payload);
        let successMsg = `✅ Personal status sent successfully!`;
        
        if (payload.caption) {
            successMsg += `\nCaption: "${payload.caption}"`;
        }
        
        // Add note if sticker was converted
        if (payload.convertedSticker) {
            successMsg += `\n📝 Note: Sticker converted to image format`;
        }
        
        await sock.sendMessage(chatId, { text: successMsg },{ quoted: msg });

    } catch (error) {
        console.error('Error in personal status command:', error);
        await sock.sendMessage(chatId, { text: `❌ Failed to update status: ${error.message}` });
    }
}

/* ------------------ Helpers ------------------ */

// 📌 Updated help text for personal status
function getPersonalStatusHelpText() {
    return `
「 📱 *PERSONAL STATUS* 」─✦

*Commands:*
• .tostatus
• .mystatus
• .status
• .tostat

*Usage:*
• .status your_text_here
• Reply to video/image/sticker with .status
• Add caption after command
• Example: .status Check this out!

*Formats Supported:*
✓ Text
✓ Images
✓ Videos
✓ Audio/Voice Notes
✓ Stickers (converted to images)

─────────✦`;
}

// 📌 Build payload from quoted message (same as before)
async function buildPayloadFromQuoted(quotedMessage) {
    // ✅ Handle video message
    if (quotedMessage.videoMessage) {
        const buffer = await downloadToBuffer(quotedMessage.videoMessage, 'video');
        return { 
            video: buffer, 
            caption: quotedMessage.videoMessage.caption || '',
            gifPlayback: quotedMessage.videoMessage.gifPlayback || false,
            mimetype: quotedMessage.videoMessage.mimetype || 'video/mp4'
        };
    }
    // ✅ Handle image message
    else if (quotedMessage.imageMessage) {
        const buffer = await downloadToBuffer(quotedMessage.imageMessage, 'image');
        return { 
            image: buffer, 
            caption: quotedMessage.imageMessage.caption || '',
            mimetype: quotedMessage.imageMessage.mimetype || 'image/jpeg'
        };
    }
    // ✅ Handle audio message
    else if (quotedMessage.audioMessage) {
        const buffer = await downloadToBuffer(quotedMessage.audioMessage, 'audio');
        
        // Check if it's voice note (ptt) or regular audio
        if (quotedMessage.audioMessage.ptt) {
            const audioVn = await toVN(buffer);
            return { 
                audio: audioVn, 
                mimetype: "audio/ogg; codecs=opus", 
                ptt: true 
            };
        } else {
            return { 
                audio: buffer, 
                mimetype: quotedMessage.audioMessage.mimetype || 'audio/mpeg',
                ptt: false 
            };
        }
    }
    // ✅ Handle sticker message - CONVERT TO IMAGE
    else if (quotedMessage.stickerMessage) {
        try {
            const buffer = await downloadToBuffer(quotedMessage.stickerMessage, 'sticker');
            
            // Convert sticker to image
            const imageBuffer = await convertStickerToImage(buffer, quotedMessage.stickerMessage.mimetype);
            
            // Return as image with conversion flag
            return { 
                image: imageBuffer, 
                caption: quotedMessage.stickerMessage.caption || '',
                mimetype: 'image/png', // Converted to PNG
                convertedSticker: true, // Flag to indicate conversion
                originalMimetype: quotedMessage.stickerMessage.mimetype
            };
        } catch (conversionError) {
            console.error('Sticker conversion failed:', conversionError);
            // Fallback: send as text message with error
            return { 
                text: `⚠️ Sticker conversion failed. Original sticker: ${quotedMessage.stickerMessage.mimetype || 'unknown format'}`
            };
        }
    }
    // ✅ Handle text message
    else if (quotedMessage.conversation || quotedMessage.extendedTextMessage?.text) {
        const textContent = quotedMessage.conversation || quotedMessage.extendedTextMessage?.text || '';
        return { text: textContent };
    }
    return null;
}

// 📌 Detect media type
function detectMediaType(quotedMessage, payload = null) {
    if (!quotedMessage) return 'Text';
    if (quotedMessage.videoMessage) return 'Video';
    if (quotedMessage.imageMessage) return 'Image';
    if (quotedMessage.audioMessage) return 'Audio';
    if (quotedMessage.stickerMessage) {
        // Check if it was converted
        if (payload && payload.convertedSticker) {
            return 'Sticker (converted to Image)';
        }
        return 'Sticker';
    }
    return 'Text';
}

// 📌 Download message content to buffer
async function downloadToBuffer(message, type) {
    const stream = await downloadContentFromMessage(message, type);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
    return buffer;
}

// 📌 Send personal status (MODIFIED for personal status)
async function sendPersonalStatus(conn, jid, content) {
    const inside = await generateWAMessageContent(content, { upload: conn.waUploadToServer });
    const messageSecret = crypto.randomBytes(32);

    // For personal status, we use a different message structure
    const m = generateWAMessageFromContent(jid, {
        messageContextInfo: { messageSecret },
        // This is the key change - using statusMessage instead of groupStatusMessageV2
        statusMessage: { 
            message: { 
                ...inside, 
                messageContextInfo: { messageSecret } 
            } 
        }
    }, {});

    await conn.relayMessage(jid, m.message, { messageId: m.key.id });
    return m;
}

// 📌 Convert audio to voice note
async function toVN(inputBuffer) {
    return new Promise((resolve, reject) => {
        const inStream = new PassThrough();
        inStream.end(inputBuffer);
        const outStream = new PassThrough();
        const chunks = [];

        ffmpeg(inStream)
            .noVideo()
            .audioCodec("libopus")
            .format("ogg")
            .audioBitrate("48k")
            .audioChannels(1)
            .audioFrequency(48000)
            .on("error", reject)
            .on("end", () => resolve(Buffer.concat(chunks)))
            .pipe(outStream, { end: true });

        outStream.on("data", chunk => chunks.push(chunk));
    });
}

// Export as tostatusCommand
module.exports = tostatusCommand;
