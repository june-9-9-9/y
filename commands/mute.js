const isAdmin = require('../lib/isAdmin');
const activeMuteTimers = new Map();

async function muteCommand(sock, chatId, senderId, message, durationInMinutes) {
    const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);

    if (!isBotAdmin) {
        return sock.sendMessage(chatId, { text: '⚠️ Please make the bot an admin first.' }, { quoted: message });
    }
    if (!isSenderAdmin) {
        return sock.sendMessage(chatId, { text: '🚫 Only group admins can use the mute command.' }, { quoted: message });
    }

    try {
        let groupName = "the group";
        try {
            const groupMetadata = await sock.groupMetadata(chatId);
            groupName = groupMetadata.subject || "the group";
        } catch (err) {
            console.error('[MUTE] Metadata fetch failed:', err);
        }

        // Apply mute
        await sock.groupSettingUpdate(chatId, 'announcement');
        await sock.sendMessage(chatId, { text: `🔇 ${groupName} muted${durationInMinutes ? ` for ${durationInMinutes} minutes` : ''}.` }, { quoted: message });
        await sock.sendMessage(chatId, { react: { text: '🔇', key: message.key } });

        if (durationInMinutes && durationInMinutes > 0) {
            const durationMs = durationInMinutes * 60 * 1000;

            // Clear existing timer if any
            if (activeMuteTimers.has(chatId)) {
                clearTimeout(activeMuteTimers.get(chatId));
            }

            const timer = setTimeout(async () => {
                try {
                    const { isBotAdmin: stillAdmin } = await isAdmin(sock, chatId, senderId);
                    if (!stillAdmin) {
                        return sock.sendMessage(chatId, { text: `❌ Bot is no longer admin. Please unmute ${groupName} manually.` });
                    }
                    await sock.groupSettingUpdate(chatId, 'not_announcement');
                    await sock.sendMessage(chatId, { text: `🔊 ${groupName} has been automatically unmuted.` });
                    await sock.sendMessage(chatId, { react: { text: '🔊', key: message.key } });
                } catch (err) {
                    console.error('[UNMUTE] Error:', err);
                    await sock.sendMessage(chatId, { text: `❌ Failed to unmute ${groupName}. Please unmute manually.` });
                } finally {
                    activeMuteTimers.delete(chatId);
                }
            }, durationMs);

            activeMuteTimers.set(chatId, timer);
            console.log(`[MUTE] Group: ${groupName}, Duration: ${durationInMinutes}m, By: ${senderId}`);
        }
    } catch (error) {
        console.error('[MUTE] Error:', error);
        await sock.sendMessage(chatId, { text: '❌ An error occurred while muting the group. Please try again.' }, { quoted: message });
    }
}

module.exports = muteCommand;
