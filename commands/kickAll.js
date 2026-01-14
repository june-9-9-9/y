const isAdmin = require('../lib/isAdmin');

async function kickAllCommand(sock, chatId, message) {
    try {
        const isOwner = message.key.fromMe;
        if (!isOwner) {
            await sock.sendMessage(chatId, { 
                text: '❌ This command is only available for the owner!',
                quoted: message
            });
            return;
        }

        // Check if it's a group chat
        if (!chatId.includes('@g.us')) {
            await sock.sendMessage(chatId, { 
                text: '❌ This command only works in groups!',
                quoted: message
            });
            return;
        }

        // Get group metadata
        const chat = await sock.groupMetadata(chatId).catch(() => null);
        if (!chat) {
            await sock.sendMessage(chatId, { 
                text: '❌ Failed to fetch group information. Make sure I am still in the group!',
                quoted: message
            });
            return;
        }

        // Check if user is group admin using isAdmin function
        const senderId = message.key.participant || message.key.remoteJid;
        const isUserAdmin = await isAdmin(sock, chatId, senderId);
        
        if (!isUserAdmin) {
            await sock.sendMessage(chatId, { 
                text: '❌ You need to be a group admin to use this command!',
                quoted: message
            });
            return;
        }

        // Check if bot is admin using isAdmin function
        const botJid = sock.user.id;
        const isBotAdmin = await isAdmin(sock, chatId, botJid);
        
        if (!isBotAdmin) {
            await sock.sendMessage(chatId, { 
                text: '❌ I need to be a group admin to kick members!',
                quoted: message
            });
            return;
        }

        // Get all participants except the bot and the command sender
        const participants = chat.participants.filter(p => {
            if (p.id.includes(sock.user.id.split(':')[0])) return false; // exclude bot
            if (p.id === senderId) return false; // exclude sender
            return true;
        });

        if (participants.length === 0) {
            await sock.sendMessage(chatId, { 
                text: '❌ No members to kick!',
                quoted: message
            });
            return;
        }

        // Warn message with all members tagged
        const warningMessage = `⚠️ *KICK ALL WARNING*\n\nAll members will be removed from this group in 3 seconds!\n\n${participants.map((p, i) => `*${i + 1}.* @${p.id.split('@')[0]}`).join('\n')}\n\n_This action cannot be undone!_`;

        await sock.sendMessage(chatId, { 
            text: warningMessage,
            mentions: participants.map(p => p.id)
        },{ quoted: message });

        // Wait 3 seconds before kicking
        await new Promise(resolve => setTimeout(resolve, 3000));

        try {
            // Remove all participants in one payload
            await sock.groupParticipantsUpdate(
                chatId,
                participants.map(p => p.id),
                'remove'
            );

            await sock.sendMessage(chatId, { 
                text: `✅ Successfully removed ${participants.length} member(s)!`
            });

            console.log(`✅ Kick All Complete: ${participants.length} kicked`);
        } catch (error) {
            console.error('❌ Failed to kick all:', error);
            
            let errorMessage = '❌ Failed to remove members!';
            if (error.message.includes('not authorized')) {
                errorMessage += '\nI may have lost admin privileges!';
            } else if (error.message.includes('403')) {
                errorMessage += '\nSome members may not be removable!';
            } else {
                errorMessage += `\nError: ${error.message}`;
            }
            
            await sock.sendMessage(chatId, { 
                text: errorMessage,
                quoted: message
            });
        }

    } catch (error) {
        console.error('Error in kickAllCommand:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ Failed to execute kickall command!\nError: ${error.message}`,
            quoted: message
        }).catch(() => {});
    }
}

module.exports = kickAllCommand;
