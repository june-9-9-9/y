// Reset group link (group only, admin only)
async function resetlinkCommand(sock, chatId) {
    try {
        const groupMetadata = await sock.groupMetadata(chatId);

        // Group-only restriction
        if (!groupMetadata) {
            await sock.sendMessage(chatId, { text: '❌ This command can only be used in groups!' });
            return;
        }

        // Find bot participant
        const botId = sock.user?.id || sock.authState?.creds?.me?.id;
        const botParticipant = groupMetadata.participants.find(p => p.id === botId);

        // Admin restriction
        if (!botParticipant || !['admin', 'superadmin'].includes(botParticipant.admin)) {
            await sock.sendMessage(chatId, { text: '❌ Bot must be admin to reset group link!' });
            return;
        }

        // Reset link
        const newCode = await sock.groupRevokeInvite(chatId);
        const groupLink = `https://chat.whatsapp.com/${newCode}`;

        // Send both formatted and clean link
        await sock.sendMessage(chatId, { 
            text: `✅ Group link reset!\n\n📌 New link:\n${groupLink}\n\n🔗 Clean link:\n${groupLink}`
        });

    } catch (error) {
        console.error('Error resetting group link:', error);
        await sock.sendMessage(chatId, { text: `❌ Failed to reset group link!\nError: ${error.message}` });
    }
}

// Get group link (group only, admin only)
async function linkCommand(sock, chatId) {
    try {
        const groupMetadata = await sock.groupMetadata(chatId);

        // Group-only restriction
        if (!groupMetadata) {
            await sock.sendMessage(chatId, { text: '❌ This command can only be used in groups!' });
            return;
        }

        // Find bot participant
        const botId = sock.user?.id || sock.authState?.creds?.me?.id;
        const botParticipant = groupMetadata.participants.find(p => p.id === botId);

        // Admin restriction
        if (!botParticipant || !['admin', 'superadmin'].includes(botParticipant.admin)) {
            await sock.sendMessage(chatId, { text: '❌ Bot must be admin to get group link!' });
            return;
        }

        // Get link
        const code = await sock.groupInviteCode(chatId);
        const groupLink = `https://chat.whatsapp.com/${code}`;

        // Send both formatted and clean link
        await sock.sendMessage(chatId, { 
            text: `📌 *Group Link:*\n${groupLink}\n\n🔗 Clean link:\n${groupLink}\n\n⚠️ Only admins can reset the link.`
        });

    } catch (error) {
        console.error('Error getting group link:', error);
        await sock.sendMessage(chatId, { text: `❌ Failed to get group link!\nError: ${error.message}` });
    }
}

// Export
module.exports = {
    resetlinkCommand,
    linkCommand
};
