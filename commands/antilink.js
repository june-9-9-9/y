const { setAntilink, getAntilink, removeAntilink } = require('../lib/index');

/**
 * Helper function to check if a user is admin
 */
async function isAdmin(sock, chatId, userId) {
    try {
        const metadata = await sock.groupMetadata(chatId);
        const participant = metadata.participants.find(p => p.id === userId);
        return participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
    } catch (error) {
        console.error('Error checking admin status:', error);
        return false;
    }
}

/**
 * Handle Antilink Command
 */
async function handleAntilinkCommand(sock, chatId, userMessage, senderId, isSenderAdmin) {
    try {
        if (!isSenderAdmin) {
            await sock.sendMessage(chatId, { text: 'For Group Admins Only!' });
            return;
        }

        const prefix = '.';
        const args = userMessage.slice(9).toLowerCase().trim().split(' ');
        const action = args[0];

        if (!action) {
            const usage = `ANTILINK SETUP\n\n ${prefix}antilink on\n ${prefix}antilink set delete / kick /warn\n ${prefix}antilink off\n ${prefix}antilink get\n`;
            await sock.sendMessage(chatId, { text: usage });
            return;
        }

        switch (action) {
            case 'on': {
                const existingConfig = await getAntilink(chatId, 'on');
                if (existingConfig?.enabled) {
                    await sock.sendMessage(chatId, { text: '*_Antilink is already ON_*' });
                    return;
                }
                const result = await setAntilink(chatId, 'on', 'delete');
                await sock.sendMessage(chatId, { 
                    text: result ? '*_Antilink has been turned ON_*\nDefault action: Delete links from non-admins' : '*_Failed to turn ON Antilink_*' 
                });
                break;
            }

            case 'off': {
                await removeAntilink(chatId, 'on');
                await sock.sendMessage(chatId, { text: '*_Antilink has been turned OFF_*' });
                break;
            }

            case 'set': {
                if (args.length < 2) {
                    await sock.sendMessage(chatId, { 
                        text: `*_Please specify an action: ${prefix}antilink set delete | kick | warn_*` 
                    });
                    return;
                }
                const setAction = args[1];
                if (!['delete', 'kick', 'warn'].includes(setAction)) {
                    await sock.sendMessage(chatId, { text: '*_Invalid action. Choose delete, kick, or warn._*' });
                    return;
                }
                
                // Check if antilink is already enabled
                const existingConfig = await getAntilink(chatId, 'on');
                if (!existingConfig?.enabled) {
                    await sock.sendMessage(chatId, { 
                        text: `*_Please enable antilink first with: ${prefix}antilink on_*` 
                    });
                    return;
                }
                
                const setResult = await setAntilink(chatId, 'on', setAction);
                await sock.sendMessage(chatId, { 
                    text: setResult ? `*_Antilink action set to ${setAction} for non-admins_*` : '*_Failed to set Antilink action_*' 
                });
                break;
            }

            case 'get': {
                const config = await getAntilink(chatId, 'on');
                const status = config?.enabled ? 'ON' : 'OFF';
                const action = config?.action || 'Not set';
                await sock.sendMessage(chatId, { 
                    text: `*_Antilink Configuration:_*\n\n Status: ${status}\n Action: ${action}\n Scope: Only for non-admin members` 
                });
                break;
            }

            default:
                await sock.sendMessage(chatId, { text: `*_Use ${prefix}antilink for usage._*` });
        }
    } catch (error) {
        console.error('Error in antilink command:', error);
        await sock.sendMessage(chatId, { text: '*_Error processing antilink command_*' });
    }
}

/**
 * Handle Link Detection - Only applies to non-admins
 */
async function handleLinkDetection(sock, chatId, message, userMessage, senderId) {
    try {
        // Get antilink configuration
        const antilinkConfig = await getAntilink(chatId, 'on');
        
        // If antilink is not enabled, do nothing
        if (!antilinkConfig?.enabled) {
            console.log(`Antilink not enabled for ${chatId}`);
            return;
        }

        console.log(`Antilink Setting for ${chatId}: ${antilinkConfig.action}`);
        console.log(`Checking message for links from ${senderId}: ${userMessage}`);

        // ✅ Skip admins - only enforce for non-admins
        const senderIsAdmin = await isAdmin(sock, chatId, senderId);
        if (senderIsAdmin) {
            console.log(`Sender ${senderId} is an admin. Skipping antilink enforcement.`);
            return;
        }

        // Link detection patterns
        const linkPatterns = {
            whatsappGroup: /chat\.whatsapp\.com\/[A-Za-z0-9]{20,}/,
            whatsappChannel: /wa\.me\/channel\/[A-Za-z0-9]{20,}/,
            telegram: /t\.me\/[A-Za-z0-9_]+/,
            allLinks: /https?:\/\/[^\s]+/,
        };

        // Check if message contains any links
        let detected = false;
        for (const pattern of Object.values(linkPatterns)) {
            if (pattern.test(userMessage)) {
                detected = true;
                break;
            }
        }

        if (!detected) {
            console.log('No link detected.');
            return;
        }

        console.log(`Link detected from non-admin ${senderId}. Taking action: ${antilinkConfig.action}`);

        const quotedMessageId = message.key.id;
        const quotedParticipant = message.key.participant || senderId;

        // Take appropriate action based on configuration
        try {
            switch (antilinkConfig.action) {
                case 'delete':
                    await sock.sendMessage(chatId, {
                        delete: { 
                            remoteJid: chatId, 
                            fromMe: false, 
                            id: quotedMessageId, 
                            participant: quotedParticipant 
                        },
                    });
                    console.log(`Message with ID ${quotedMessageId} deleted successfully.`);
                    break;

                case 'kick':
                    await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
                    console.log(`User ${senderId} kicked for posting link.`);
                    break;

                case 'warn':
                    const mentionedJidList = [senderId];
                    await sock.sendMessage(chatId, { 
                        text: `⚠️ Warning! @${senderId.split('@')[0]}, posting links is not allowed.`, 
                        mentions: mentionedJidList 
                    });
                    console.log(`User ${senderId} warned for posting link.`);
                    break;

                default:
                    console.log(`Unknown action: ${antilinkConfig.action}`);
            }
        } catch (actionError) {
            console.error('Failed to enforce antilink action:', actionError);
            
            // Optional: Notify admins about failed action
            try {
                const metadata = await sock.groupMetadata(chatId);
                const admins = metadata.participants.filter(p => 
                    p.admin === 'admin' || p.admin === 'superadmin'
                );
                
                if (admins.length > 0) {
                    const adminMentions = admins.map(admin => admin.id);
                    await sock.sendMessage(chatId, {
                        text: `⚠️ Failed to enforce antilink on link from ${senderId.split('@')[0]}. Action: ${antilinkConfig.action}`,
                        mentions: adminMentions
                    });
                }
            } catch (notifyError) {
                console.error('Failed to notify admins:', notifyError);
            }
        }
    } catch (error) {
        console.error('Error in handleLinkDetection:', error);
    }
}

module.exports = {
    handleAntilinkCommand,
    handleLinkDetection,
    isAdmin // Exporting if needed elsewhere
};
