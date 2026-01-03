const axios = require('axios');
const { fromBuffer } = require('file-type');

/**
 * WhatsApp Status Command
 * Uploads quoted or sent media (image/video/sticker) to WhatsApp status
 */
async function tostatusCommand(sock, chatId, message) {
    try {
        // React to show command is processing
        await sock.sendMessage(chatId, { react: { text: '📱', key: message.key } });

        // Check if message has media (image/video/sticker/gif)
        const isQuoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const quotedMessage = isQuoted ? message.message.extendedTextMessage.contextInfo.quotedMessage : null;

        const mediaMessage =
            message.message?.imageMessage ||
            message.message?.videoMessage ||
            message.message?.stickerMessage ||
            quotedMessage?.imageMessage ||
            quotedMessage?.videoMessage ||
            quotedMessage?.stickerMessage;

        if (!mediaMessage) {
            return await sock.sendMessage(chatId, {
                text: '📸 Please send or quote an image/video/gif to set as status!\nExample: Send an image/video with caption .tostatus'
            }, { quoted: message });
        }

        // Detect type
        const isImage = !!mediaMessage.imageMessage;
        const isVideo = !!mediaMessage.videoMessage;
        const isSticker = !!mediaMessage.stickerMessage;
        const isGif = mediaMessage.videoMessage?.gifPlayback || false;

        let mediaType, mimeType;
        if (isImage) { mediaType = 'image'; mimeType = 'image/jpeg'; }
        else if (isVideo) { mediaType = 'video'; mimeType = 'video/mp4'; }
        else if (isSticker) { mediaType = 'sticker'; mimeType = 'image/webp'; }

        // Download buffer
        let mediaBuffer;
        try {
            if (typeof sock.downloadMediaMessage === 'function') {
                mediaBuffer = await sock.downloadMediaMessage(isQuoted ? { message: quotedMessage } : message);
            } else if (mediaMessage.download) {
                mediaBuffer = await mediaMessage.download();
            } else if (mediaMessage.url) {
                const response = await axios.get(mediaMessage.url, { responseType: 'arraybuffer' });
                mediaBuffer = Buffer.from(response.data, 'binary');
            } else if (mediaMessage.buffer) {
                mediaBuffer = mediaMessage.buffer;
            } else {
                throw new Error('No suitable download method found');
            }
        } catch (downloadError) {
            console.error("Download error:", downloadError);
            return await sock.sendMessage(chatId, {
                text: `❌ Failed to download media: ${downloadError.message}`
            }, { quoted: message });
        }

        // Detect mime type if missing
        if (!mimeType) {
            const fileType = await fromBuffer(mediaBuffer);
            if (fileType) mimeType = fileType.mime;
        }

        // Size checks
        const fileSize = mediaBuffer.length;
        if (mediaType === 'image' && fileSize > 5 * 1024 * 1024)
            return await sock.sendMessage(chatId, { text: '📁 Image too large! Max size is 5MB.' }, { quoted: message });
        if (mediaType === 'video' && fileSize > 16 * 1024 * 1024)
            return await sock.sendMessage(chatId, { text: '📁 Video too large! Max size is 16MB.' }, { quoted: message });
        if (isVideo && mediaMessage.seconds && mediaMessage.seconds > 30)
            return await sock.sendMessage(chatId, { text: '⏱️ Video too long! Max duration is 30 seconds.' }, { quoted: message });

        // Extract caption
        const caption =
            message.message?.conversation?.replace('.tostatus', '').trim() ||
            message.message?.extendedTextMessage?.text?.replace('.tostatus', '').trim() ||
            (isQuoted ? quotedMessage?.conversation || quotedMessage?.extendedTextMessage?.text?.trim() : '') ||
            '';

        // Notify user
        await sock.sendMessage(chatId, { text: `🔄 Uploading ${mediaType} to your status...` }, { quoted: message });

        // Upload to status
        try {
            if (mediaType === 'image') {
                await sock.sendMessage('status@broadcast', { image: mediaBuffer, caption });
            } else if (mediaType === 'video') {
                await sock.sendMessage('status@broadcast', { video: mediaBuffer, caption, gifPlayback: isGif });
            } else if (mediaType === 'sticker') {
                await sock.sendMessage('status@broadcast', { image: mediaBuffer, caption: 'Sticker Status 📱' });
            }

            await sock.sendMessage(chatId, {
                text: `✅ Status updated successfully!\n📊 Type: ${mediaType.toUpperCase()}\n💾 Size: ${(fileSize / 1024 / 1024).toFixed(2)}MB`
            }, { quoted: message });

        } catch (uploadError) {
            console.error("Status upload error:", uploadError);
            await sock.sendMessage(chatId, {
                text: `❌ Failed to upload status: ${uploadError.message}\n\nNote: Make sure your WhatsApp number can post status updates.`
            }, { quoted: message });
        }

    } catch (error) {
        console.error("tostatus command error:", error);
        await sock.sendMessage(chatId, { text: `🚫 Error: ${error.message}` }, { quoted: message });
    }
}

module.exports = tostatusCommand;
