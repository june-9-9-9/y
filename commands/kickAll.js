const isAdmin = require('../lib/isAdmin');

async function kickAllCommand(sock, chatId, message, senderId) {
    try {
        const isGroup = chatId.endsWith('@g.us');
        if (!isGroup) {
            await sock.sendMessage(chatId, { text: '🚫 This command only works in groups.' }, { quoted: message });
            await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
            return;
        }

        // --- Fetch group metadata ---
        const metadata = await sock.groupMetadata(chatId);
        const participants = metadata.participants || [];

        // Get bot's full JID
        const botJid = sock.user.id.includes(':') 
            ? sock.user.id.split(':')[0] + '@s.whatsapp.net' 
            : sock.user.id;

        // Use helper for admin checks
        const isSenderAdmin = isAdmin(participants, senderId);
        const isBotAdmin = isAdmin(participants, botJid);

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

        // --- Build list of targets (exclude bot + sender + admins) ---
        const targets = participants
            .filter(p => p.id !== botJid && p.id !== sock.user.id && p.id !== senderId && !isAdmin(participants, p.id))
            .map(p => p.id);

        if (targets.length === 0) {
            await sock.sendMessage(chatId, { text: '⚠️ No non-admin members to kick.' }, { quoted: message });
            await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
            return;
        }

        // Send processing message
        await sock.sendMessage(chatId, { text: `🔄 Attempting to kick ${targets.length} member(s)...` }, { quoted: message });

        let kickedCount = 0;
        let failedCount = 0;

        for (const target of targets) {
            try {
                await sock.groupParticipantsUpdate(chatId, [target], 'remove');
                kickedCount++;
                await new Promise(resolve => setTimeout(resolve, 800)); // delay
            } catch (err) {
                console.error(`⚠️ Failed to kick ${target}:`, err);
                failedCount++;
            }
        }

        const resultMessage = kickedCount > 0
            ? failedCount > 0 
                ? `✅ Kicked ${kickedCount} member(s)\n❌ Failed to kick ${failedCount} member(s)`
                : `✅ Successfully kicked ${kickedCount} member(s) from the group.`
            : '⚠️ Could not kick any members.';

        await sock.sendMessage(chatId, { text: resultMessage }, { quoted: message });
        await sock.sendMessage(chatId, { react: { text: kickedCount > 0 ? '✅' : '❌', key: message.key } });

    } catch (err) {
        console.error('❌ Error in kickAllCommand:', err);
        await sock.sendMessage(chatId, { text: '❌ Failed to kick members: ' + err.message }, { quoted: message });
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
    }
}

module.exports = kickAllCommand;
