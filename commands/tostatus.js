const fs = require("fs");
const axios = require('axios');
const path = require('path');
const { fromBuffer } = require('file-type');
const { downloadContentFromMessage, generateWAMessageContent, generateWAMessageFromContent } = require('@whiskeysockets/baileys');

async function tostatusCommand(sock, chatId, message) {
    try {
        // React to show command is processing
        await sock.sendMessage(chatId, {
            react: { text: '📱', key: message.key }
        });

        const tempDir = path.join(__dirname, "temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        // Check if message has media (image/video/gif)
        const isQuoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const quotedMessage = isQuoted ? message.message.extendedTextMessage.contextInfo.quotedMessage : null;
        
        let mediaMessage = message.message?.imageMessage || 
                          message.message?.videoMessage || 
                          message.message?.stickerMessage ||
                          (quotedMessage?.imageMessage || 
                           quotedMessage?.videoMessage || 
                           quotedMessage?.stickerMessage);

        // If no media found in current or quoted message
        if (!mediaMessage) {
            return await sock.sendMessage(chatId, { 
                text: '📸 Please send or quote an image/video/gif to set as status!\nExample: Send an image/video with caption .tostatus' 
            }, { quoted: message });
        }

        // Get media type
        const isImage = mediaMessage.imageMessage || mediaMessage.jpegThumbnail;
        const isVideo = mediaMessage.videoMessage;
        const isGif = mediaMessage.gifPlayback;
        const isSticker = mediaMessage.stickerMessage;

        // Download the media
        let mediaType, mediaBuffer, mimeType, fileExtension;

        if (isImage) {
            mediaType = 'image';
            mimeType = mediaMessage.mimetype || 'image/jpeg';
            const stream = await sock.downloadAndSaveMediaMessage(
                mediaMessage, 
                path.join(tempDir, `status_image_${Date.now()}`)
            );
            mediaBuffer = fs.readFileSync(stream);
            fileExtension = mimeType.split('/')[1] || 'jpg';
        } 
        else if (isVideo || isGif) {
            mediaType = 'video';
            mimeType = mediaMessage.mimetype || 'video/mp4';
            const stream = await sock.downloadAndSaveMediaMessage(
                mediaMessage, 
                path.join(tempDir, `status_video_${Date.now()}`)
            );
            mediaBuffer = fs.readFileSync(stream);
            fileExtension = mimeType.split('/')[1] || 'mp4';
            
            // Check video duration (WhatsApp status max is 30 seconds)
            if (mediaMessage.seconds && mediaMessage.seconds > 30) {
                return await sock.sendMessage(chatId, { 
                    text: '⏱️ Video is too long! WhatsApp status videos must be 30 seconds or less.' 
                }, { quoted: message });
            }
        }
        else if (isSticker) {
            mediaType = 'sticker';
            mimeType = mediaMessage.mimetype || 'image/webp';
            const stream = await sock.downloadAndSaveMediaMessage(
                mediaMessage, 
                path.join(tempDir, `status_sticker_${Date.now()}`)
            );
            mediaBuffer = fs.readFileSync(stream);
            fileExtension = 'webp';
        }

        // Validate file size (WhatsApp limits)
        const fileSize = mediaBuffer.length;
        const maxImageSize = 5 * 1024 * 1024; // 5MB for images
        const maxVideoSize = 16 * 1024 * 1024; // 16MB for videos
        
        if (mediaType === 'image' && fileSize > maxImageSize) {
            return await sock.sendMessage(chatId, { 
                text: '📁 Image too large! Max size for status is 5MB.' 
            }, { quoted: message });
        }
        
        if (mediaType === 'video' && fileSize > maxVideoSize) {
            return await sock.sendMessage(chatId, { 
                text: '📁 Video too large! Max size for status is 16MB.' 
            }, { quoted: message });
        }

        // Prepare for status upload
        const timestamp = Date.now();
        const fileName = `status_${timestamp}.${fileExtension}`;
        const filePath = path.join(tempDir, fileName);
        
        // Save file temporarily
        fs.writeFileSync(filePath, mediaBuffer);

        // Send status update to user
        await sock.sendMessage(chatId, { 
            text: `🔄 Uploading ${mediaType} to your status...` 
        }, { quoted: message });

        // Upload status using WhatsApp Web API
        try {
            if (mediaType === 'image') {
                await sock.sendMessage('status@broadcast', {
                    image: fs.readFileSync(filePath),
                    caption: message.message?.conversation || message.message?.extendedTextMessage?.text?.replace('.tostatus', '').trim() || ''
                }, {
                    backgroundColor: '#FFFFFF',
                    font: 1
                });
            } 
            else if (mediaType === 'video') {
                await sock.sendMessage('status@broadcast', {
                    video: fs.readFileSync(filePath),
                    caption: message.message?.conversation || message.message?.extendedTextMessage?.text?.replace('.tostatus', '').trim() || '',
                    gifPlayback: isGif || false
                });
            }
            else if (mediaType === 'sticker') {
                // Convert sticker to image for status
                await sock.sendMessage('status@broadcast', {
                    image: fs.readFileSync(filePath),
                    caption: 'Sticker Status 📱'
                });
            }

            // Success message
            await sock.sendMessage(chatId, { 
                text: `✅ Status updated successfully!\n📊 Type: ${mediaType.toUpperCase()}\n💾 Size: ${(fileSize / 1024 / 1024).toFixed(2)}MB` 
            }, { quoted: message });

        } catch (uploadError) {
            console.error("Status upload error:", uploadError);
            await sock.sendMessage(chatId, { 
                text: `❌ Failed to upload status: ${uploadError.message}` 
            }, { quoted: message });
        }

        // Cleanup
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

    } catch (error) {
        console.error("tostatus command error:", error);
        return await sock.sendMessage(chatId, { 
            text: `🚫 Error: ${error.message}` 
        }, { quoted: message });
    }
}

module.exports = tostatusCommand;
