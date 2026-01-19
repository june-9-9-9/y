async function onlineCommand(sock, chatId, message) {
    try {
        // Check if in a group
        if (!chatId.endsWith('@g.us')) {
            return await sock.sendMessage(chatId, {
                text: '❌ *Online Members Check*\n\nThis command can only be used in a group chat!'
            }, { quoted: message });
        }

        // Get group metadata
        const groupMetadata = sock.groupMetadata(chatId);
        const participants = groupMetadata.participants || [];

        // Get sender info and check if admin
        const sender = message.key.participant || message.key.remoteJid;
        const senderInfo = participants.find(p => p.id === sender);
        const isAdmin = senderInfo?.admin === 'admin' || senderInfo?.admin === 'superadmin';

        if (!isAdmin) {
            return await sock.sendMessage(chatId, {
                text: '❌ *Permission Denied*\n\nOnly group admins can use this command!'
            }, { quoted: message });
        }

        // Notify scanning
        const processingMsg = await sock.sendMessage(chatId, {
            text: '🔄 *Scanning Online Members*\n\nPlease wait while we check presence status...',
            quoted: message
        });

        const onlineMembers = new Set();
        let presenceHandler;

        try {
            const onlineCheckPromise = new Promise((resolve) => {
                let checks = 0;
                const maxChecks = 3;

                presenceHandler = async (json) => {
                    for (const id in json) {
                        const presence = json[id]?.lastKnownPresence;
                        if (['available', 'composing', 'recording', 'online'].includes(presence)) {
                            if (participants.some(p => p.id === id)) {
                                onlineMembers.add(id);
                            }
                        }
                    }
                    if (++checks >= maxChecks) resolve();
                };

                sock.ev.on('presence.update', presenceHandler);

                for (const participant of participants) {
                    try {
                        await sock.presenceSubscribe(participant.id);
                        await sock.sendPresenceUpdate('composing', participant.id);
                    } catch {}
                }

                setTimeout(resolve, 20000);
            });

            await onlineCheckPromise;
        } finally {
            if (presenceHandler) sock.ev.off('presence.update', presenceHandler);
        }

        // Prepare results
        const totalMembers = participants.length;
        const onlineArray = Array.from(onlineMembers);
        const onlineCount = onlineArray.length;
        const offlineCount = totalMembers - onlineCount;

        if (onlineCount === 0) {
            return await sock.sendMessage(chatId, {
                text: `👥 *Online Members Status*\n\n🟢 Online: 0\n🔴 Offline: ${totalMembers}\n\n⚠️ No online members detected. Privacy settings may hide presence.\n\n📊 Total Members: ${totalMembers}`,
                quoted: message
            });
        }

        const mentions = [];
        const onlineList = onlineArray.map((id, i) => {
            mentions.push(id);
            const memberData = participants.find(p => p.id === id);
            const name = memberData?.pushname || memberData?.name || id.split('@')[0];
            return `${i + 1}. @${id.split('@')[0]} (${name})`;
        });

        const resultMessage = `👥 *Online Members Status*\n\n📊 Statistics:\n🟢 Online: ${onlineCount}\n🔴 Offline: ${offlineCount}\n👥 Total: ${totalMembers}\n\n🔍 Online Members:\n${onlineList.join('\n')}`;

        await sock.sendMessage(chatId, { text: resultMessage, mentions }, { quoted: message });

        // Delete processing message
        try {
            if (processingMsg) {
                await sock.sendMessage(chatId, { delete: processingMsg.key });
            }
        } catch {}
    } catch (error) {
        console.error("Online command error:", error);
        await sock.sendMessage(chatId, {
            text: `❌ *Online Check Failed*\n\n${error.message || 'Unexpected error'}`
        }, { quoted: message });
    }
}

module.exports = onlineCommand;
