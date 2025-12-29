const { setAntilink, getAntilink, removeAntilink } = require('../lib/index');
const isAdmin = require('../lib/isAdmin');

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
            const usage = `ANTILINK SETUP\n\n${prefix}antilink on\n${prefix}antilink set delete | kick | warn\n${prefix}antilink off\n${prefix}antilink get\n`;
            await sock.sendMessage(chatId, { text: usage });
            return;
        }

        switch (action) {
            case 'on': {
                const existingConfig = await getAntilink(chatId, 'on');
                if (existingConfig?.enabled) {
                    await sock.sendMessage(chatId, { text: 'Antilink is already ON' });
                    return;
                }
                const result = await setAntilink(chatId, 'on', 'delete');
                await sock.sendMessage(chatId, { 
                    text: result ? 'Antilink has been turned ON' : 'Failed to turn ON Antilink' 
                });
                break;
            }

            case 'off': {
                await removeAntilink(chatId, 'on');
                await sock.sendMessage(chatId, { text: 'Antilink has been turned OFF' });
                break;
            }

            case 'set': {
                if (args.length < 2) {
                    await sock.sendMessage(chatId, { 
                        text: `Please specify an action: ${prefix}antilink set delete | kick | warn` 
                    });
                    return;
                }
                const setAction = args[1];
                if (!['delete', 'kick', 'warn'].includes(setAction)) {
                    await sock.sendMessage(chatId, { text: 'Invalid action. Choose delete, kick, or warn.' });
                    return;
                }
                const setResult = await setAntilink(chatId, 'on', setAction);
                await sock.sendMessage(chatId, { 
                    text: setResult ? `Antilink action set to ${setAction}` : 'Failed to set Antilink action' 
                });
                break;
            }

            case 'get': {
                const status = await getAntilink(chatId, 'on');
                const actionConfig = await getAntilink(chatId, 'on');
                await sock.sendMessage(chatId, { 
                    text: `Antilink Configuration:\nStatus: ${status ? 'ON' : 'OFF'}\nAction: ${actionConfig ? actionConfig.action : 'Not set'}` 
                });
                break;
            }

            default:
                await sock.sendMessage(chatId, { text: `Use ${prefix}antilink for usage.` });
        }
    } catch (error) {
        console.error('Error in antilink command:', error);
        await sock.sendMessage(chatId, { text: 'Error processing antilink command' });
    }
}

/**
 * Handle Link Detection
 */
async function handleLinkDetection(sock, chatId, message, userMessage, senderId) {
    const antilinkConfig = await getAntilink(chatId, 'on');
    if (!antilinkConfig?.enabled) return;

    console.log(`[DEBUG] Antilink Setting for ${chatId}: ${antilinkConfig.action}`);
    console.log(`[DEBUG] Checking message for links: ${userMessage}`);
    console.log("[DEBUG] Full message object:", JSON.stringify(message, null, 2));

    // Skip admins
    const senderIsAdmin = await isAdmin(sock, chatId, senderId);
    if (senderIsAdmin) {
        console.log(`[DEBUG] Sender ${senderId} is an admin. Skipping antilink enforcement.`);
        return;
    }

    const linkPatterns = {
        whatsappGroup: /chat\.whatsapp\.com\/[A-Za-z0-9]{20,}/,
        whatsappChannel: /wa\.me\/channel\/[A-Za-z0-9]{20,}/,
        telegram: /t\.me\/[A-Za-z0-9_]+/,
        allLinks: /https?:\/\/[^\s]+/,
    };

    let detected = false;
    if (linkPatterns.whatsappGroup.test(userMessage)) detected = true;
    else if (linkPatterns.whatsappChannel.test(userMessage)) detected = true;
    else if (linkPatterns.telegram.test(userMessage)) detected = true;
    else if (linkPatterns.allLinks.test(userMessage)) detected = true;

    if (!detected) {
        console.log('[DEBUG] No link detected.');
        return;
    }

    const quotedMessageId = message.key.id;
    const quotedParticipant = message.key.participant || senderId;

    try {
        if (antilinkConfig.action === 'delete') {
            await sock.sendMessage(chatId, {
                delete: { remoteJid: chatId, fromMe: false, id: quotedMessageId, participant: quotedParticipant },
            });
            console.log(`[DEBUG] Message with ID ${quotedMessageId} deleted successfully.`);
        } else if (antilinkConfig.action === 'kick') {
            await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
            console.log(`[DEBUG] User ${senderId} kicked for posting link.`);
        } else if (antilinkConfig.action === 'warn') {
            const mentionedJidList = [senderId];
            await sock.sendMessage(chatId, { 
                text: `Warning! @${senderId.split('@')[0]}, posting links is not allowed.`, 
                mentions: mentionedJidList 
            });
            console.log(`[DEBUG] User ${senderId} warned for posting link.`);
        }
    } catch (error) {
        console.error('[DEBUG] Failed to enforce antilink action:', error);
    }
}

module.exports = {
    handleAntilinkCommand,
    handleLinkDetection,
};
