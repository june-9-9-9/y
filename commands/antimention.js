const fs = require('fs');
const path = require('path');
const isAdmin = require('../lib/isAdmin');

// Data directory setup
const dataDir = path.join(__dirname, '..', 'data');
const mentionConfigPath = path.join(dataDir, 'antigroupmention.json');

// Helper function to create fake contact for quoting
function createFakeContact(message) {
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "0@s.whatsapp.net",
            fromMe: false
        },
        message: {
            contactMessage: {
                displayName: "JUNE OFFICIAL",
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:KOLOLI\nitem1.TEL;waid=${message?.key?.participant?.split('@')[0] || message?.key?.remoteJid?.split('@')[0] || '0'}:${message?.key?.participant?.split('@')[0] || message?.key?.remoteJid?.split('@')[0] || '0'}\nitem1.X-ABLabel:Phone\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

// ========== CONFIGURATION MANAGEMENT ==========

// Initialize data directory and config file
function initConfig() {
    try {
        // Create data directory if it doesn't exist
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        // Create config file if it doesn't exist
        if (!fs.existsSync(mentionConfigPath)) {
            const defaultConfig = {};
            fs.writeFileSync(mentionConfigPath, JSON.stringify(defaultConfig, null, 2));
            return defaultConfig;
        }

        // Read existing config
        const configData = fs.readFileSync(mentionConfigPath, 'utf8');
        
        // If file exists but is empty, initialize with default config
        if (!configData.trim()) {
            const defaultConfig = {};
            fs.writeFileSync(mentionConfigPath, JSON.stringify(defaultConfig, null, 2));
            return defaultConfig;
        }
        
        return JSON.parse(configData);
    } catch (error) {
        console.error('Error initializing antigroupmention config:', error);
        
        // If reading fails, create a fresh config
        const defaultConfig = {};
        fs.writeFileSync(mentionConfigPath, JSON.stringify(defaultConfig, null, 2));
        return defaultConfig;
    }
}

// Save configuration to file
function saveConfig(config) {
    try {
        // Ensure data directory exists
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        fs.writeFileSync(mentionConfigPath, JSON.stringify(config, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving antigroupmention config:', error);
        return false;
    }
}

// Get group configuration
function getGroupConfig(chatId) {
    const config = initConfig();
    return config[chatId] || { enabled: false, action: 'delete' };
}

// Set group configuration
function setGroupConfig(chatId, groupConfig) {
    const config = initConfig();
    config[chatId] = groupConfig;
    return saveConfig(config);
}

// Remove group configuration
function removeGroupConfig(chatId) {
    const config = initConfig();
    if (config[chatId]) {
        delete config[chatId];
        return saveConfig(config);
    }
    return true;
}

// Get all configured groups
function getAllConfiguredGroups() {
    const config = initConfig();
    return Object.keys(config);
}

// ========== COMMAND HANDLER ==========

async function antigroupmentionCommand(sock, chatId, message, senderId) {
    try {
        const fake = createFakeContact(message);
        const isSenderAdmin = await isAdmin(sock, chatId, senderId);

        if (!isSenderAdmin) {
            await sock.sendMessage(chatId, { text: '❌ For Group Admins Only' }, { quoted: fake });
            return;
        }

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const args = text.trim().split(' ').slice(1);
        const action = args[0]?.toLowerCase();

        const groupConfig = getGroupConfig(chatId);

        if (!action) {
            const usage = `👥 *ANTIGROUPMENTION SETUP*\n\nCommands:\n• .antigroupmention on - Enable protection\n• .antigroupmention off - Disable protection\n• .antigroupmention set delete|kick|warn - Set action\n• .antigroupmention get - Check settings\n• .antigroupmention reset - Reset to defaults\n• .antigroupmention stats - View statistics`;
            await sock.sendMessage(chatId, { text: usage }, { quoted: fake });
            return;
        }

        switch (action) {
            case 'on':
                groupConfig.enabled = true;
                setGroupConfig(chatId, groupConfig);
                await sock.sendMessage(chatId, { 
                    text: '✅ *Antigroupmention Enabled*\n\nProtection is now active. The bot will block @everyone and @all mentions from non-admin members.' 
                }, { quoted: fake });
                break;

            case 'off':
                groupConfig.enabled = false;
                setGroupConfig(chatId, groupConfig);
                await sock.sendMessage(chatId, { 
                    text: '❌ *Antigroupmention Disabled*\n\nGroup mention protection has been turned off.' 
                }, { quoted: fake });
                break;

            case 'set':
                const setAction = args[1]?.toLowerCase();
                if (!['delete', 'kick', 'warn'].includes(setAction)) {
                    await sock.sendMessage(chatId, { 
                        text: '❌ Invalid action. Choose from:\n• delete - Delete the message\n• kick - Kick the user\n• warn - Warn the user' 
                    }, { quoted: fake });
                    return;
                }
                groupConfig.action = setAction;
                groupConfig.enabled = true;
                setGroupConfig(chatId, groupConfig);
                const actionDescriptions = {
                    'delete': 'Delete offending messages',
                    'kick': 'Kick users who mention everyone',
                    'warn': 'Warn users (auto-kick after 3 warnings)'
                };
                await sock.sendMessage(chatId, { 
                    text: `✅ *Action Updated*\n\nAction set to: *${setAction}*\n${actionDescriptions[setAction]}` 
                }, { quoted: message });
                break;

            case 'get':
                const statusEmoji = groupConfig.enabled ? '✅' : '❌';
                const statusText = groupConfig.enabled ? 'ENABLED' : 'DISABLED';
                const actionText = groupConfig.action || 'delete';
                const actionDesc = {
                    'delete': 'Delete message',
                    'kick': 'Kick user',
                    'warn': 'Warn user'
                }[actionText] || actionText;
                
                const statusMessage = `🔧 *Antigroupmention Configuration*\n\n` +
                                    `📌 *Group:* ${chatId}\n` +
                                    `📊 *Status:* ${statusEmoji} ${statusText}\n` +
                                    `⚡ *Action:* ${actionText.toUpperCase()} (${actionDesc})\n` +
                                    `📁 *Config File:* data/antigroupmention.json`;
                await sock.sendMessage(chatId, { text: statusMessage }, { quoted: fake });
                break;

            case 'reset':
                const removed = removeGroupConfig(chatId);
                if (removed) {
                    await sock.sendMessage(chatId, { 
                        text: '🔄 *Configuration Reset*\n\nAll antigroupmention settings for this group have been reset to defaults.' 
                    }, { quoted: fake });
                } else {
                    await sock.sendMessage(chatId, { 
                        text: 'ℹ️ No configuration found for this group. Already using default settings.' 
                    }, { quoted: fake });
                }
                break;

            case 'stats':
            case 'status':
                const allConfigs = initConfig();
                const totalGroups = Object.keys(allConfigs).length;
                const enabledGroups = Object.values(allConfigs).filter(c => c.enabled).length;
                
                const statsMessage = `📊 *Antigroupmention Statistics*\n\n` +
                                   `📈 *Total Configured Groups:* ${totalGroups}\n` +
                                   `✅ *Active Protection:* ${enabledGroups}\n` +
                                   `❌ *Disabled:* ${totalGroups - enabledGroups}\n\n` +
                                   `*Current Group Status:* ${groupConfig.enabled ? '✅ Active' : '❌ Inactive'}`;
                await sock.sendMessage(chatId, { text: statsMessage }, { quoted: fake });
                break;

            default:
                await sock.sendMessage(chatId, { 
                    text: '❌ Invalid command. Use:\n.antigroupmention on/off/set/get/reset/stats' 
                }, { quoted: message });
        }
    } catch (error) {
        console.error('Error in antigroupmention command:', error);
        try {
            await sock.sendMessage(chatId, { 
                text: '❌ An error occurred while processing the command. Please try again.' 
            }, { quoted: createFakeContact(message) });
        } catch (sendError) {
            console.error('Failed to send error message:', sendError);
        }
    }
}

// ========== MENTION DETECTION HANDLER ==========

async function handleGroupMentionDetection(sock, chatId, message, senderId) {
    try {
        // Skip if message is from bot
        if (message.key.fromMe) return;
        
        // Only process group messages
        if (!chatId.endsWith('@g.us')) return;
        
        const groupConfig = getGroupConfig(chatId);
        if (!groupConfig.enabled) return;

        const text = message.message?.conversation || 
                    message.message?.extendedTextMessage?.text || '';

        // Check for @everyone or @all mentions
        const hasTagAll = text.includes('@everyone') || text.includes('@all');
        if (!hasTagAll) return;

        // Allow admins to use mentions
        const senderIsAdmin = await isAdmin(sock, chatId, senderId);
        if (senderIsAdmin) return;

        const quotedMessageId = message.key.id;
        const quotedParticipant = message.key.participant || senderId;

        try {
            switch (groupConfig.action) {
                case 'delete':
                    // Delete the offending message
                    await sock.sendMessage(chatId, {
                        delete: { 
                            remoteJid: chatId, 
                            fromMe: false, 
                            id: quotedMessageId, 
                            participant: quotedParticipant 
                        }
                    });
                    
                    // Send notification
                    await sock.sendMessage(chatId, {
                        text: `⚠️ @${senderId.split('@')[0]}, group mentions (@everyone/@all) are not allowed here. Your message has been deleted.`,
                        mentions: [senderId]
                    });
                    break;

                case 'kick':
                    // Delete the message first
                    await sock.sendMessage(chatId, {
                        delete: { 
                            remoteJid: chatId, 
                            fromMe: false, 
                            id: quotedMessageId, 
                            participant: quotedParticipant 
                        }
                    });
                    
                    // Kick the user
                    await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
                    
                    // Send notification
                    await sock.sendMessage(chatId, {
                        text: `🚫 @${senderId.split('@')[0]} has been kicked for using group mentions (@everyone/@all).`,
                        mentions: [senderId]
                    });
                    break;

                case 'warn':
                    // Simple warn - just send a warning message
                    await sock.sendMessage(chatId, {
                        text: `⚠️ @${senderId.split('@')[0]}, group mentions (@everyone/@all) are not allowed here. Please avoid using them.`,
                        mentions: [senderId]
                    });
                    break;

                default:
                    // Default action: delete
                    await sock.sendMessage(chatId, {
                        delete: { 
                            remoteJid: chatId, 
                            fromMe: false, 
                            id: quotedMessageId, 
                            participant: quotedParticipant 
                        }
                    });
            }
        } catch (actionError) {
            console.error('Failed to enforce antigroupmention action:', actionError);
            
            // Try to at least send a warning if other actions fail
            try {
                await sock.sendMessage(chatId, {
                    text: `⚠️ @${senderId.split('@')[0]}, please avoid using @everyone/@all mentions.`,
                    mentions: [senderId]
                });
            } catch (warningError) {
                console.error('Failed to send warning:', warningError);
            }
        }
    } catch (error) {
        console.error('Error in group mention detection:', error);
    }
}

// ========== INITIALIZATION ==========
// Auto-initialize on module load
console.log('🔧 Initializing antigroupmention protection system...');
initConfig();
console.log('✅ Antigroupmention system ready');

// ========== MODULE EXPORTS ==========
module.exports = {
    // Main functions
    antigroupmentionCommand,
    handleGroupMentionDetection,
    
    // Configuration helpers
    getGroupConfig,
    setGroupConfig,
    removeGroupConfig,
    getAllConfiguredGroups,
    
    // Utility functions
    createFakeContact,
    initConfig
};
