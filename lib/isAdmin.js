async function isAdmin(sock, chatId, senderId) {
    try {
        const groupMetadata = await sock.groupMetadata(chatId);

        // Normalize IDs consistently
        const normalizeId = (id) => id.replace('@lid', '@s.whatsapp.net');

        const botId = normalizeId(sock.user.id.split(':')[0] + '@s.whatsapp.net');
        const senderNormalized = normalizeId(senderId);

        // Find participant and bot in group
        const participant = groupMetadata.participants.find(p => normalizeId(p.id) === senderNormalized);
        const bot = groupMetadata.participants.find(p => normalizeId(p.id) === botId);

        // Check admin status safely
        const isSenderAdmin = participant ? ['admin', 'superadmin'].includes(participant.admin) : false;
        const isBotAdmin = bot ? ['admin', 'superadmin'].includes(bot.admin) : false;

        return { isSenderAdmin, isBotAdmin };
    } catch (error) {
        console.error(`Error in isAdmin for chat ${chatId}, sender ${senderId}:`, error);
        return { isSenderAdmin: false, isBotAdmin: false };
    }
}

module.exports = isAdmin;
