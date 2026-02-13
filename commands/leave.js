async function leaveGroupCommand(sock, chatId, message) {
    try {
        const isOwner = message.key.fromMe;
        if (!isOwner) {
            await sock.sendMessage(chatId, { 
                text: '❌ This command is only available for the owner!',
                quoted: message
            });
            return;
        }

        const chat = await sock.groupMetadata(chatId).catch(() => null);
        if (!chat) {
            await sock.sendMessage(chatId, { 
                text: '❌ This command only works in groups!',
                quoted: message
            });
            return;
        }

        const groupName = chat.subject || 'the group';
        
        // Send goodbye message and leave simultaneously
        await Promise.all([
            sock.sendMessage(chatId, { 
                text: `👋 Goodbye! Bot is leaving ${groupName}.`,
                quoted: message
            }),
            sock.groupLeave(chatId).catch(err => {
                // Continue execution even if leave fails initially
                console.log('Initial leave attempt:', err.message);
            })
        ]);

        // Try leaving again if first attempt failed
        try {
            await sock.groupLeave(chatId);
        } catch (leaveError) {
            console.log('Second leave attempt:', leaveError.message);
        }
        
        console.log(`✅ Bot left group: ${groupName}`);

    } catch (error) {
        console.error('Error in leaveGroupCommand:', error);
        
        // Don't send error message if we're already leaving or left
        if (!error.message.includes('not in group') && 
            !error.message.includes('Not authorized')) {
            await sock.sendMessage(chatId, { 
                text: '❌ Failed to leave group!',
                quoted: message
            }).catch(() => {});
        }
    }
}

module.exports = leaveGroupCommand;
