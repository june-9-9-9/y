const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

async function viewonceCommand(sock, chatId, message) {
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedImage = quoted?.imageMessage;
    const quotedVideo = quoted?.videoMessage;
    const quotedAudio = quoted?.audioMessage;

    // Helper: download media into buffer
    const downloadBuffer = async (msg, type) => {
        const stream = await downloadContentFromMessage(msg, type);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
        return buffer;
    };

    if (quotedImage && quotedImage.viewOnce) {
        const buffer = await downloadBuffer(quotedImage, 'image');
        await sock.sendMessage(
            chatId,
            { 
                image: buffer, 
                fileName: 'media.jpg', 
                caption: quotedImage.caption || '📸 View-once image retrieved!' 
            }, 
            { quoted: message }
        );
        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } else if (quotedVideo && quotedVideo.viewOnce) {
        const buffer = await downloadBuffer(quotedVideo, 'video');
        await sock.sendMessage(
            chatId,
            { 
                video: buffer, 
                fileName: 'media.mp4', 
                caption: quotedVideo.caption || '🎥 View-once video retrieved!' 
            }, 
            { quoted: message }
        );
        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } else if (quotedAudio && quotedAudio.viewOnce) {
        const buffer = await downloadBuffer(quotedAudio, 'audio');
        await sock.sendMessage(
            chatId,
            { 
                audio: buffer, 
                fileName: 'media.mp3', 
                mimetype: quotedAudio.mimetype || 'audio/mp4', 
                caption: '🎵 View-once audio retrieved!' 
            }, 
            { quoted: message }
        );
        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } else {
        await sock.sendMessage(chatId, { text: '❌ Please reply to a view-once image, video, or audio.' }, { quoted: message });
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
    }
}

// New vv2Command that sends results to bot's own account
async function vv2Command(sock, chatId, message) {
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedImage = quoted?.imageMessage;
    const quotedVideo = quoted?.videoMessage;
    const quotedAudio = quoted?.audioMessage;
    
    // Get bot's own user ID
    const botUserId = sock.user.id;
    
    // Helper: download media into buffer
    const downloadBuffer = async (msg, type) => {
        const stream = await downloadContentFromMessage(msg, type);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
        return buffer;
    };

    if (quotedImage && quotedImage.viewOnce) {
        const buffer = await downloadBuffer(quotedImage, 'image');
        
        // Send to bot's own account
        await sock.sendMessage(
            botUserId,
            { 
                image: buffer, 
                fileName: 'viewonce-image.jpg', 
                caption: quotedImage.caption || `📸 View-once image retrieved from ${message.pushName || 'user'}`
            }
        );
        
        // Send confirmation in the original chat
        await sock.sendMessage(chatId, { text: '✅ View-once image has been saved to my account!' }, { quoted: message });
        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } else if (quotedVideo && quotedVideo.viewOnce) {
        const buffer = await downloadBuffer(quotedVideo, 'video');
        
        // Send to bot's own account
        await sock.sendMessage(
            botUserId,
            { 
                video: buffer, 
                fileName: 'viewonce-video.mp4', 
                caption: quotedVideo.caption || `🎥 View-once video retrieved from ${message.pushName || 'user'}`
            }
        );
        
        // Send confirmation in the original chat
        await sock.sendMessage(chatId, { text: '✅ View-once video has been saved to my account!' }, { quoted: message });
        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } else if (quotedAudio && quotedAudio.viewOnce) {
        const buffer = await downloadBuffer(quotedAudio, 'audio');
        
        // Send to bot's own account
        await sock.sendMessage(
            botUserId,
            { 
                audio: buffer, 
                fileName: 'viewonce-audio.mp3', 
                mimetype: quotedAudio.mimetype || 'audio/mp4', 
                caption: `🎵 View-once audio retrieved from ${message.pushName || 'user'}`
            }
        );
        
        // Send confirmation in the original chat
        await sock.sendMessage(chatId, { text: '✅ View-once audio has been saved to my account!' }, { quoted: message });
        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } else {
        await sock.sendMessage(chatId, { text: '❌ Please reply to a view-once image, video, or audio.' }, { quoted: message });
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
    }
}

// Export both commands
module.exports = {
    viewonceCommand,
    vv2Command
};
