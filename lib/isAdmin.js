const { normalizeJid, findParticipant } = require('./jid');

async function isAdmin(sock, chatId, senderId) {
    try {
        const groupMetadata = await sock.groupMetadata(chatId);

        const botId = normalizeJid(sock.user.id);
        const normalizedSender = normalizeJid(senderId);

        const participant = findParticipant(groupMetadata.participants, normalizedSender);
        const bot = findParticipant(groupMetadata.participants, botId);

        const isBotAdmin = bot ? (bot.admin === 'admin' || bot.admin === 'superadmin') : true;
        const isSenderAdmin = participant ? (participant.admin === 'admin' || participant.admin === 'superadmin') : false;

        return { isSenderAdmin, isBotAdmin };
    } catch (error) {
        console.error('Error in isAdmin:', error);
        return { isSenderAdmin: false, isBotAdmin: false };
    }
}

module.exports = isAdmin;
