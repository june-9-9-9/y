const { setAntilink, getAntilink, removeAntilink } = require('../lib/index');
const isAdmin = require('../lib/isAdmin');

// Link detection patterns
const linkPatterns = {
    whatsappGroup: /chat\.whatsapp\.com\/[A-Za-z0-9]{20,}/,
    whatsappChannel: /wa\.me\/channel\/[A-Za-z0-9]{20,}/,
    telegram: /t\.me\/[A-Za-z0-9_]+/,
    allLinks: /https?:\/\/[^\s]+/,
};

// Check if message contains links
function containsLink(text) {
    if (!text) return false;
    
    if (linkPatterns.whatsappGroup.test(text)) return true;
    if (linkPatterns.whatsappChannel.test(text)) return true;
    if (linkPatterns.telegram.test(text)) return true;
    if (linkPatterns.allLinks.test(text)) return true;
    
    return false;
}

// Enforcement handler
async function enforce(sock, chatId, sender, msg, action) {
    const quotedMessageId = msg.key.id;
    const quotedParticipant = msg.key.participant || sender;
    
    switch (action) {
        case 'warn':
            const mentionedJidList = [sender];
            await sock.sendMessage(chatId, { 
                text: `⚠️ Warning! @${sender.split('@')[0]}, posting links is not allowed.`, 
                mentions: mentionedJidList 
            });
            return { success: true, action: 'warned' };

        case 'delete':
            try {
                await sock.sendMessage(chatId, {
                    delete: { 
                        remoteJid: chatId, 
                        fromMe: false, 
                        id: quotedMessageId, 
                        participant: quotedParticipant 
                    }
                });
                console.log(`Message with ID ${quotedMessageId} deleted successfully.`);
                return { success: true, action: 'deleted' };
            } catch (e) {
                console.error('Delete failed:', e);
                return { success: false, error: e };
            }

        case 'kick':
            try {
                // First, delete the message
                try {
                    await sock.sendMessage(chatId, {
                        delete: { 
                            remoteJid: chatId, 
                            fromMe: false, 
                            id: quotedMessageId, 
                            participant: quotedParticipant 
                        }
                    });
                } catch (deleteError) {
                    console.warn('Failed to delete message before kicking:', deleteError);
                }
                
                // Then kick the user
                await sock.groupParticipantsUpdate(chatId, [sender], 'remove');
                console.log(`User ${sender} kicked for posting link.`);
                
                // Notify group about the kick
                await sock.sendMessage(chatId, { 
                    text: `🚫 User @${sender.split('@')[0]} has been removed for posting links.`,
                    mentions: [sender]
                });
                
                return { success: true, action: 'kicked' };
            } catch (e) {
                console.error('Kick failed:', e);
                
                // If kick fails, try to delete the message as fallback
                try {
                    await sock.sendMessage(chatId, {
                        delete: { 
                            remoteJid: chatId, 
                            fromMe: false, 
                            id: quotedMessageId, 
                            participant: quotedParticipant 
                        }
                    });
                    console.log('Deleted message as fallback after kick failed');
                } catch (deleteError) {
                    console.error('Fallback delete also failed:', deleteError);
                }
                
                return { success: false, error: e };
            }
            
        default:
            return { success: false, error: 'Invalid action' };
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

        const args = userMessage.slice(9).toLowerCase().trim().split(' ');
        const action = args[0];

        if (!action) {
            const usage = `ANTILINK SETUP\n\n🔹.antilink on\n🔹.antilink set delete | kick | warn\n🔹.antilink off\n🔹.antilink get\n🔹.antilink help`;
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
                    text: result ? '*_Antilink has been turned ON_*' : '*_Failed to turn ON Antilink_*' 
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
                        text: '*_Please specify an action: .antilink set delete | kick | warn_*' 
                    });
                    return;
                }
                const setAction = args[1];
                if (!['delete', 'kick', 'warn'].includes(setAction)) {
                    await sock.sendMessage(chatId, { text: '*_Invalid action. Choose delete, kick, or warn._*' });
                    return;
                }
                
                // Get current config to preserve allowed links if any
                const currentConfig = await getAntilink(chatId, 'on') || {};
                
                // Update action
                const updatedConfig = {
                    ...currentConfig,
                    action: setAction,
                    enabled: currentConfig.enabled || true
                };
                
                // Save to your database
                const setResult = await setAntilink(chatId, 'on', setAction);
                if (setResult) {
                    // Also save extended config if needed
                    if (currentConfig.allowedLinks) {
                        // You might need a separate function to save full config
                        console.log('Preserving allowed links:', currentConfig.allowedLinks);
                    }
                }
                
                await sock.sendMessage(chatId, { 
                    text: setResult ? `*_Antilink action set to ${setAction}_*` : '*_Failed to set Antilink action_*' 
                });
                break;
            }

            case 'get': {
                const config = await getAntilink(chatId, 'on');
                if (!config) {
                    await sock.sendMessage(chatId, { 
                        text: '*_Antilink Configuration:_*\nStatus: OFF\nAction: Not set\nAllowed Links: 0' 
                    });
                    return;
                }
                
                let statusText = `*_Antilink Configuration:_*\n`;
                statusText += `Status: ${config.enabled ? 'ON' : 'OFF'}\n`;
                statusText += `Action: ${config.action || 'Not set'}\n`;
                statusText += `Allowed Links: ${config.allowedLinks?.length || 0}\n`;
                
                if (config.allowedLinks?.length > 0) {
                    statusText += `\n*Allowed Links:*\n`;
                    statusText += config.allowedLinks.map((link, i) => `${i + 1}. ${link}`).join('\n');
                }
                
                await sock.sendMessage(chatId, { text: statusText });
                break;
            }

            case 'allow': {
                const link = args.slice(1).join(' ');
                if (!link) {
                    await sock.sendMessage(chatId, { 
                        text: '*_Please specify a link: .antilink allow [link]_*' 
                    });
                    return;
                }

                // Check if antilink is enabled
                const config = await getAntilink(chatId, 'on');
                if (!config?.enabled) {
                    await sock.sendMessage(chatId, { 
                        text: '*_Please enable antilink first: .antilink on_*' 
                    });
                    return;
                }

                // Extract domain from link
                let cleanLink;
                try {
                    const url = new URL(link.startsWith('http') ? link : `https://${link}`);
                    cleanLink = url.hostname + url.pathname;
                    if (cleanLink.endsWith('/')) cleanLink = cleanLink.slice(0, -1);
                } catch {
                    cleanLink = link.trim().toLowerCase();
                }

                // Initialize allowedLinks array if not exists
                if (!config.allowedLinks) config.allowedLinks = [];
                
                // Check if already allowed
                if (config.allowedLinks.includes(cleanLink)) {
                    await sock.sendMessage(chatId, { text: `*_Link already allowed: ${cleanLink}_*` });
                    return;
                }

                // Add to allowed links
                config.allowedLinks.push(cleanLink);
                
                // Save updated config (you'll need to update your setAntilink function to accept full config)
                // For now, we'll store in a separate key
                const allowResult = await setAntilink(chatId, 'allowed', config.allowedLinks);
                
                await sock.sendMessage(chatId, { 
                    text: allowResult ? 
                        `*_Link allowed: ${cleanLink}_*\nUsers can now post links containing this pattern.` : 
                        '*_Failed to allow link_*'
                });
                break;
            }

            case 'disallow':
            case 'remove': {
                const link = args.slice(1).join(' ');
                if (!link) {
                    await sock.sendMessage(chatId, { 
                        text: '*_Please specify a link: .antilink disallow [link]_*' 
                    });
                    return;
                }

                const config = await getAntilink(chatId, 'on');
                if (!config?.allowedLinks || config.allowedLinks.length === 0) {
                    await sock.sendMessage(chatId, { text: '*_No allowed links to remove_*' });
                    return;
                }

                // Try to find matching link
                const index = config.allowedLinks.findIndex(allowed => 
                    allowed.toLowerCase().includes(link.toLowerCase()) || 
                    link.toLowerCase().includes(allowed.toLowerCase())
                );

                if (index === -1) {
                    await sock.sendMessage(chatId, { text: `*_Link not found in allowed list: ${link}_*` });
                    return;
                }

                const removedLink = config.allowedLinks.splice(index, 1)[0];
                
                // Save updated config
                const disallowResult = await setAntilink(chatId, 'allowed', config.allowedLinks);
                
                await sock.sendMessage(chatId, { 
                    text: disallowResult ? 
                        `*_Link removed from allowed list: ${removedLink}_*` : 
                        '*_Failed to remove link_*'
                });
                break;
            }

            case 'help':
                const helpText = `🔗 *Antilink Commands*\n\n` +
                               `• .antilink on - Enable antilink\n` +
                               `• .antilink set [delete|kick|warn] - Set action mode\n` +
                               `• .antilink off - Disable antilink\n` +
                               `• .antilink allow [link] - Allow specific link\n` +
                               `• .antilink disallow [link] - Remove allowed link\n` +
                               `• .antilink get - Show current settings\n` +
                               `• .antilink help - Show this help\n\n` +
                               `*Action Modes:*\n` +
                               `• 🗑️ delete - Remove link messages\n` +
                               `• ⚠️ warn - Warn the user\n` +
                               `• 🚫 kick - Remove user from group`;
                await sock.sendMessage(chatId, { text: helpText });
                break;

            default:
                await sock.sendMessage(chatId, { text: '*_Invalid command. Use .antilink help for usage._*' });
        }
    } catch (error) {
        console.error('Error in antilink command:', error);
        await sock.sendMessage(chatId, { text: '*_Error processing antilink command_*' });
    }
}

/**
 * Handle Link Detection
 */
async function handleLinkDetection(sock, chatId, message, userMessage, senderId) {
    const antilinkConfig = await getAntilink(chatId, 'on');
    if (!antilinkConfig?.enabled) return;

    console.log(`Antilink Setting for ${chatId}: ${antilinkConfig.action}`);
    console.log(`Checking message for links: ${userMessage}`);

    // ✅ Skip admins
    const senderIsAdmin = await isAdmin(sock, chatId, senderId);
    if (senderIsAdmin) {
        console.log(`Sender ${senderId} is an admin. Skipping antilink enforcement.`);
        return;
    }

    // Check for links
    if (!containsLink(userMessage)) {
        console.log('No link detected.');
        return;
    }

    // Get allowed links if any
    const allowedConfig = await getAntilink(chatId, 'allowed') || [];
    const allowedLinks = Array.isArray(allowedConfig) ? allowedConfig : [];

    // Allowed link check
    if (allowedLinks.length > 0) {
        const cleanText = userMessage.toLowerCase();
        const isAllowed = allowedLinks.some(allowedLink => 
            cleanText.includes(allowedLink.toLowerCase())
        );
        if (isAllowed) {
            console.log(`Link allowed for pattern in message from ${senderId}`);
            return;
        }
    }

    const quotedMessageId = message.key.id;
    const quotedParticipant = message.key.participant || senderId;

    try {
        if (antilinkConfig.action === 'delete') {
            await sock.sendMessage(chatId, {
                delete: { remoteJid: chatId, fromMe: false, id: quotedMessageId, participant: quotedParticipant },
            });
            console.log(`Message with ID ${quotedMessageId} deleted successfully.`);
        } else if (antilinkConfig.action === 'kick') {
            await enforce(sock, chatId, senderId, message, 'kick');
        } else if (antilinkConfig.action === 'warn') {
            await enforce(sock, chatId, senderId, message, 'warn');
        }
    } catch (error) {
        console.error('Failed to enforce antilink action:', error);
    }
}

// Real-time listener setup
let isListenerSetup = false;

function setupAntiLinkListener(sock) {
    sock.ev.on('messages.upsert', async ({ messages }) => {
        try {
            const msg = messages[0];
            if (!msg || msg.key.fromMe || !msg.key.remoteJid?.endsWith('@g.us')) return;

            const chatId = msg.key.remoteJid;
            const sender = msg.key.participant || msg.key.remoteJid;
            
            if (!sender) return;

            // Get antilink config
            const antilinkConfig = await getAntilink(chatId, 'on');
            if (!antilinkConfig?.enabled) return;

            // Extract message text
            const text =
                msg.message?.conversation ||
                msg.message?.extendedTextMessage?.text ||
                msg.message?.imageMessage?.caption ||
                msg.message?.videoMessage?.caption ||
                msg.message?.documentMessage?.caption || '';

            // Check for links
            if (!containsLink(text)) return;

            // Check if sender is admin
            try {
                const senderIsAdmin = await isAdmin(sock, chatId, sender);
                if (senderIsAdmin) {
                    console.log(`Sender ${sender} is an admin. Skipping antilink enforcement.`);
                    return;
                }
            } catch (error) {
                console.error('Error checking admin status:', error);
            }

            // Get allowed links
            const allowedConfig = await getAntilink(chatId, 'allowed') || [];
            const allowedLinks = Array.isArray(allowedConfig) ? allowedConfig : [];

            // Allowed link check
            if (allowedLinks.length > 0) {
                const cleanText = text.toLowerCase();
                const isAllowed = allowedLinks.some(allowedLink => 
                    cleanText.includes(allowedLink.toLowerCase())
                );
                if (isAllowed) {
                    console.log(`Link allowed for pattern in message from ${sender}`);
                    return;
                }
            }

            // Enforce the action
            const result = await enforce(sock, chatId, sender, msg, antilinkConfig.action);
            
            if (!result.success) {
                console.error(`Failed to enforce ${antilinkConfig.action} mode:`, result.error);
            }
            
        } catch (error) {
            console.error('Error in anti-link listener:', error);
        }
    });
}

function initializeAntiLink(sock) {
    if (!isListenerSetup) {
        setupAntiLinkListener(sock);
        isListenerSetup = true;
        console.log('✅ Anti-link listener initialized');
    }
}

module.exports = {
    handleAntilinkCommand,
    handleLinkDetection,
    initializeAntiLink
};
