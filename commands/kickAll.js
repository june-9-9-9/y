const isAdmin = require('../lib/isAdmin');

async function kickAllCommand(sock, chatId, message, senderId) {
    try {
        const isGroup = chatId.endsWith('@g.us');
        if (!isGroup) {
            await sock.sendMessage(chatId, { text: '🚫 This command only works in groups.' }, { quoted: message });
            await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
            return;
        }

        // --- Admin checks ---
        const adminStatus = await isAdmin(sock, chatId, senderId);
        const isSenderAdmin = adminStatus.isSenderAdmin;
        const isBotAdmin = adminStatus.isBotAdmin;

        if (!isBotAdmin) {
            await sock.sendMessage(chatId, { text: '🚫 I need to be an admin to kick members.' }, { quoted: message });
            await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
            return;
        }

        if (!isSenderAdmin) {
            await sock.sendMessage(chatId, { text: '🚫 Only group admins can use the .kickall command.' }, { quoted: message });
            await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
            return;
        }

        // --- Fetch group metadata ---
        const metadata = await sock.groupMetadata(chatId);
        const participants = metadata.participants || [];

        // --- Build list of targets (exclude bot + sender) ---
        const botId = sock.user.id;
        const targets = participants
            .map(p => p.id)
            .filter(id => id !== botId && id !== senderId);

        if (targets.length === 0) {
            await sock.sendMessage(chatId, { text: '⚠️ No members to kick.' }, { quoted: message });
            await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
            return;
        }

        let kickedCount = 0;
        for (const target of targets) {
            try {
                await sock.groupParticipantsUpdate(chatId, [target], 'remove');
                kickedCount++;
                await new Promise(r => setTimeout(r, 500)); // pacing
            } catch (err) {
                console.error(`⚠️ Failed to kick ${target}:`, err);
            }
        }

        if (kickedCount > 0) {
            await sock.sendMessage(chatId, { text: `✅ Kicked ${kickedCount} member(s) from the group.` }, { quoted: message });
            await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
        } else {
            await sock.sendMessage(chatId, { text: '⚠️ Could not kick any members.' }, { quoted: message });
            await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
        }

    } catch (err) {
        console.error('❌ Error in kickAllCommand:', err);
        await sock.sendMessage(chatId, { text: '❌ Failed to kick members.' }, { quoted: message });
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
    }
}

module.exports = kickAllCommand;
