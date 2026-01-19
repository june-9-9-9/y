async function onlineCommand(sock, chatId, message) {
    try {
        // Only works in groups
        if (!chatId.endsWith('@g.us')) {
            return await sock.sendMessage(chatId, {
                text: '❌ This command can only be used in a group chat!'
            }, { quoted: message });
        }

        // Get group metadata
        const groupMetadata = await sock.groupMetadata(chatId);
        const participants = groupMetadata.participants || [];

        // Check admin
        const sender = message.key.participant || message.key.remoteJid;
        const senderInfo = participants.find(p => p.id === sender);
        const isAdmin = senderInfo?.admin === 'admin' || senderInfo?.admin === 'superadmin';
        if (!isAdmin) {
            return await sock.sendMessage(chatId, {
                text: '❌ Only group admins can use this command!'
            }, { quoted: message });
        }

        const onlineMembers = new Set();
        let presenceHandler;

        try {
            const onlineCheckPromise = new Promise((resolve) => {
                presenceHandler = (update) => {
                    const { id, presences } = update;
                    const presence = presences?.[id]?.lastKnownPresence || update.presence;
                    if (['available', 'composing', 'recording', 'online'].includes(presence)) {
                        if (participants.some(p => p.id === id)) {
                            onlineMembers.add(id);
                        }
                    }
                };

                sock.ev.on('presence.update', presenceHandler);

                (async () => {
                    for (const participant of participants) {
                        try {
                            await sock.presenceSubscribe(participant.id);
                        } catch {}
                    }
                })();

                setTimeout(resolve, 8000); // shorter timeout
            });

            await onlineCheckPromise;
        } finally {
            if (presenceHandler) sock.ev.off('presence.update', presenceHandler);
        }

        // Results
        const totalMembers = participants.length;
        const onlineArray = Array.from(onlineMembers);
        const onlineCount = onlineArray.length;

        // Get message text to check for tag flag
        const messageText = message.message?.conversation || 
                           message.message?.extendedTextMessage?.text || 
                           message.message?.imageMessage?.caption || '';
        
        const shouldTag = messageText.includes('--tag') || 
                         messageText.includes('-t') || 
                         messageText.includes('@all');

        if (onlineCount === 0) {
            return await sock.sendMessage(chatId, {
                text: `👥 Online: 0 / ${totalMembers}\n⚠️ No online members detected (privacy may hide presence).`
            }, { quoted: message });
        }

        // Create mentions array for tagging
        const mentions = onlineArray.map(id => {
            const memberData = participants.find(p => p.id === id);
            return {
                id: id,
                name: memberData?.pushname || memberData?.name || id.split('@')[0]
            };
        });

        // Create mention strings with or without tagging
        const mentionTexts = mentions.map((member, i) => {
            return `${i + 1}. @${member.id.split('@')[0]}`;
        });

        // Prepare the result message
        let resultMessage = `👥 Online Members: ${onlineCount}/${totalMembers}\n\n`;
        
        if (shouldTag) {
            // Tag all online members in the message
            const mentionTags = mentions.map(m => `@${m.id.split('@')[0]}`).join(' ');
            resultMessage += `${mentionTags}\n\nList of online members:\n${mentionTexts.join('\n')}\n\n📢 All online members have been tagged!`;
        } else {
            // Just list them without tagging in the message body
            resultMessage += `${mentionTexts.join('\n')}\n\n💡 Use \`--tag\` or \`-t\` to tag all online members.`;
        }

        // Create mentions array for WhatsApp tagging
        const whatsappMentions = mentions.map(m => m.id);

        // Send the message with proper mentions
        await sock.sendMessage(chatId, {
            text: resultMessage,
            mentions: shouldTag ? whatsappMentions : []
        }, { quoted: message });

    } catch (error) {
        console.error("Online command error:", error);
        await sock.sendMessage(chatId, {
            text: `❌ Online check failed: ${error.message || 'Unexpected error'}`
        }, { quoted: message });
    }
}

module.exports = onlineCommand;
