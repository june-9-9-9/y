const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

// Helper: download media into buffer
async function downloadBuffer(msg, type) {
    const stream = await downloadContentFromMessage(msg, type);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    return buffer;
}

// Generic handler for view-once media
async function handleViewOnce(sock, chatId, message, targetId, saveToBot = false) {
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const mediaTypes = {
        image: quoted?.imageMessage,
        video: quoted?.videoMessage,
        audio: quoted?.audioMessage,
    };

    for (const [type, media] of Object.entries(mediaTypes)) {
        if (media && media.viewOnce) {
            const buffer = await downloadBuffer(media, type);

            const payload = {
                fileName: `viewonce-${type}.${type === 'image' ? 'jpg' : type === 'video' ? 'mp4' : 'mp3'}`,
                caption: media.caption || getDefaultCaption(type, message.pushName),
            };

            if (type === 'image') payload.image = buffer;
            if (type === 'video') payload.video = buffer;
            if (type === 'audio') {
                payload.audio = buffer;
                payload.mimetype = media.mimetype || 'audio/mp4';
            }

            // Send to target (chat or bot account)
            await sock.sendMessage(targetId, payload, saveToBot ? {} : { quoted: message });

            // Confirmation back to chat
            if (saveToBot) {
                await sock.sendMessage(chatId, { text: `✅ View-once ${type} has been saved to my account!` }, { quoted: message });
            } else {
                await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
            }
            return;
        }
    }

    // If no valid view-once media
    await sock.sendMessage(chatId, { text: '❌ Please reply to a view-once image, video, or audio.' }, { quoted: message });
    await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
}

// Default captions
function getDefaultCaption(type, userName) {
    const captions = {
        image: `📸 View-once image retrieved${userName ? ` from ${userName}` : ''}!`,
        video: `🎥 View-once video retrieved${userName ? ` from ${userName}` : ''}!`,
        audio: `🎵 View-once audio retrieved${userName ? ` from ${userName}` : ''}!`,
    };
    return captions[type];
}

// Commands
async function viewonceCommand(sock, chatId, message) {
    await handleViewOnce(sock, chatId, message, chatId, false);
}

async function vv2Command(sock, chatId, message) {
    const botUserId = sock.user.id;
    await handleViewOnce(sock, chatId, message, botUserId, true);
}

// Export
module.exports = {
    viewonceCommand,
    vv2Command,
};
