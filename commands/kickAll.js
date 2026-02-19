async function kickAllCommand(sock, chatId, message, senderId) {
    try {
        const isGroup = chatId.endsWith('@g.us');
        if (!isGroup) {
            await sock.sendMessage(chatId, { text: '🚫 This command only works in groups.' }, { quoted: message });
            await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
            return;
        }

        // --- Fetch group metadata for admin checks ---
        const metadata = await sock.groupMetadata(chatId);
        const participants = metadata.participants || [];

        // Get bot's full JID
        const botJid = sock.user.id.includes(':') ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : sock.user.id;
        
        // Find sender and bot in participants
        const senderParticipant = participants.find(p => p.id === senderId);
        const botParticipant = participants.find(p => p.id === botJid || p.id === sock.user.id);

        // Check if sender is admin
        const isSenderAdmin = senderParticipant?.admin === 'admin' || senderParticipant?.admin === 'superadmin';
        
        // Check if bot is admin
        const isBotAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';

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

        // --- Build list of targets (exclude bot + sender + other admins) ---
        const targets = participants
            .filter(p => {
                // Keep if not bot, not sender, and not an admin
                return p.id !== botJid && 
                       p.id !== sock.user.id && 
                       p.id !== senderId && 
                       !p.admin; // Exclude other admins
            })
            .map(p => p.id);

        if (targets.length === 0) {
            await sock.sendMessage(chatId, { text: '⚠️ No non-admin members to kick.' }, { quoted: message });
            await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
            return;
        }

        // Send processing message
        await sock.sendMessage(chatId, { 
            text: `🔄 Attempting to kick ${targets.length} member(s)...` 
        }, { quoted: message });

        let kickedCount = 0;
        let failedCount = 0;

        for (const target of targets) {
            try {
                await sock.groupParticipantsUpdate(chatId, [target], 'remove');
                kickedCount++;
                
                // Add delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 800));
            } catch (err) {
                console.error(`⚠️ Failed to kick ${target}:`, err);
                failedCount++;
            }
        }

        if (kickedCount > 0) {
            const resultMessage = failedCount > 0 
                ? `✅ Kicked ${kickedCount} member(s)\n❌ Failed to kick ${failedCount} member(s)`
                : `✅ Successfully kicked ${kickedCount} member(s) from the group.`;
                
            await sock.sendMessage(chatId, { text: resultMessage }, { quoted: message });
            await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
        } else {
            await sock.sendMessage(chatId, { text: '⚠️ Could not kick any members.' }, { quoted: message });
            await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
        }

    } catch (err) {
        console.error('❌ Error in kickAllCommand:', err);
        await sock.sendMessage(chatId, { text: '❌ Failed to kick members: ' + err.message }, { quoted: message });
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
    }
}

module.exports = kickAllCommand;
