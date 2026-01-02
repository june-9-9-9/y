async function resetlinkCommand(sock, chatId, message) {
    try {
        const groupMetadata = await sock.groupMetadata(chatId);
        
        // Get bot ID
        const botUser = sock.user || (sock.state?.legacy || sock.state)?.user;
        let botId;
        
        if (botUser && botUser.id) {
            const rawId = botUser.id.includes(':') ? botUser.id.split(':')[0] : botUser.id;
            botId = `${rawId}@s.whatsapp.net`;
        } else {
            const phoneNumber = sock.authState?.creds?.me?.id || sock.user?.id || '';
            botId = `${phoneNumber.split(':')[0]}@s.whatsapp.net`;
        }

        // Check if bot is admin
        const botParticipant = groupMetadata.participants.find(p => 
            p.id === botId
        );
        
        if (!botParticipant || !['admin', 'superadmin'].includes(botParticipant.admin)) {
            await sock.sendMessage(chatId, { 
                text: '❌ Bot must be admin to reset group link!' 
            });
            return;
        }

        // Revoke old link and get new one
        const newCode = await sock.groupRevokeInvite(chatId);
        
        await sock.sendMessage(chatId, { 
            text: `✅ Group link has been successfully reset!\n\n📌 New link:\nhttps://chat.whatsapp.com/${newCode}\n\n⚠️ Old link is now invalid.`
        });

    } catch (error) {
        console.error('Error resetting group link:', error);
        
        let errorMessage = 'Failed to reset group link!';
        if (error.message?.includes('not authorized')) {
            errorMessage = '❌ Bot is not authorized to reset link. Make sure bot is admin.';
        } else if (error.message?.includes('401')) {
            errorMessage = '❌ Unauthorized. Bot needs admin permissions.';
        }
        
        await sock.sendMessage(chatId, { 
            text: `${errorMessage}\nError: ${error.message || 'Unknown error'}`
        });
    }
}

// Function to get group link
async function linkCommand(sock, chatId, message) {
    try {
        const groupMetadata = await sock.groupMetadata(chatId);
        
        // Get bot ID
        const botUser = sock.user || (sock.state?.legacy || sock.state)?.user;
        let botId;
        
        if (botUser && botUser.id) {
            const rawId = botUser.id.includes(':') ? botUser.id.split(':')[0] : botUser.id;
            botId = `${rawId}@s.whatsapp.net`;
        } else {
            const phoneNumber = sock.authState?.creds?.me?.id || sock.user?.id || '';
            botId = `${phoneNumber.split(':')[0]}@s.whatsapp.net`;
        }

        // Check if bot is admin (required to get invite link)
        const botParticipant = groupMetadata.participants.find(p => 
            p.id === botId
        );
        
        if (!botParticipant || !['admin', 'superadmin'].includes(botParticipant.admin)) {
            await sock.sendMessage(chatId, { 
                text: '❌ Bot must be admin to get group link!' 
            });
            return;
        }

        // Get group invite code/link
        const code = await sock.groupInviteCode(chatId);
        
        if (!code) {
            await sock.sendMessage(chatId, { 
                text: '❌ Failed to get group link. The group might not have an invite link.' 
            });
            return;
        }

        const groupLink = `https://chat.whatsapp.com/${code}`;
        
        // Send the link
        await sock.sendMessage(chatId, { 
            text: `📌 *Group Link:*\n\n${groupLink}\n\n🔗 *Share this link to invite people to the group*\n\n⚠️ *Note:* Only admins can reset the link.`
        });

    } catch (error) {
        console.error('Error getting group link:', error);
        
        let errorMessage = 'Failed to get group link!';
        if (error.message?.includes('not authorized')) {
            errorMessage = '❌ Bot is not authorized to get group link. Make sure bot is admin.';
        } else if (error.message?.includes('401')) {
            errorMessage = '❌ Unauthorized. Bot needs admin permissions.';
        } else if (error.message?.includes('not found')) {
            errorMessage = '❌ Group not found or bot is not in the group.';
        }
        
        await sock.sendMessage(chatId, { 
            text: `${errorMessage}\nError: ${error.message || 'Unknown error'}`
        });
    }
}

// Export both functions
module.exports = {
    resetlinkCommand,
    linkCommand
};
