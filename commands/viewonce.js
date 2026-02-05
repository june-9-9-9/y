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

module.exports = viewonceCommand;
