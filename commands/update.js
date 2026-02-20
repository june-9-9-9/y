const fs = require('fs');
const path = require('path');
const isAdmin = require('../lib/isAdmin');

// In-memory storage
const antiStatusMentionData = { settings: {}, warns: {} };

// Database file path
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'antistatusmention.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Load data
function loadData() {
    try {
        if (fs.existsSync(DB_PATH)) {
            const data = fs.readFileSync(DB_PATH, 'utf8');
            Object.assign(antiStatusMentionData, JSON.parse(data));
        }
    } catch (error) {
        console.error('\x1b[35m[AntiStatusMention] Load error:\x1b[0m', error);
    }
}

// Save data
function saveData() {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(antiStatusMentionData, null, 2));
    } catch (error) {
        console.error('\x1b[35m[AntiStatusMention] Save error:\x1b[0m', error);
    }
}

// Initialize
loadData();

// Database functions
async function getAntiStatusMentionSettings(chatId) {
    return antiStatusMentionData.settings[chatId] || {
        status: 'off',
        warn_limit: 3,
        action: 'warn'
    };
}

async function updateAntiStatusMentionSettings(chatId, updates) {
    if (!antiStatusMentionData.settings[chatId]) {
        antiStatusMentionData.settings[chatId] = {
            status: 'off',
            warn_limit: 3,
            action: 'warn'
        };
    }
    Object.assign(antiStatusMentionData.settings[chatId], updates);
    saveData();
    return antiStatusMentionData.settings[chatId];
}

async function clearAllStatusWarns(chatId) {
    if (antiStatusMentionData.warns[chatId]) {
        delete antiStatusMentionData.warns[chatId];
        saveData();
    }
    return true;
}

async function getUserStatusWarns(chatId, userId) {
    if (!antiStatusMentionData.warns[chatId]) {
        antiStatusMentionData.warns[chatId] = {};
    }
    return antiStatusMentionData.warns[chatId][userId] || 0;
}

async function addUserStatusWarn(chatId, userId) {
    if (!antiStatusMentionData.warns[chatId]) {
        antiStatusMentionData.warns[chatId] = {};
    }
    if (!antiStatusMentionData.warns[chatId][userId]) {
        antiStatusMentionData.warns[chatId][userId] = 0;
    }
    antiStatusMentionData.warns[chatId][userId]++;
    saveData();
    return antiStatusMentionData.warns[chatId][userId];
}

async function resetUserStatusWarns(chatId, userId) {
    if (antiStatusMentionData.warns[chatId] && antiStatusMentionData.warns[chatId][userId]) {
        delete antiStatusMentionData.warns[chatId][userId];
        saveData();
    }
    return true;
}

// Command handler
async function antistatusmentionCommand(sock, chatId, message) {
    try {
        // Check if command is used in a group
        if (!chatId.endsWith('@g.us')) {
            await sock.sendMessage(chatId, { 
                text: "❌ *Group Command Only*\n\nThis command can only be used in groups!", 
                mentions: [message.key.participant || message.key.remoteJid]
            }, { quoted: message });
            return;
        }

        await sock.sendMessage(chatId, { react: { text: '🛡️', key: message.key } });

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const parts = text.split(' ');
        const query = parts.slice(1).join(' ').trim();

        const groupMetadata = await sock.groupMetadata(chatId).catch(() => null);
        if (!groupMetadata) {
            return await sock.sendMessage(chatId, { 
                text: "❌ *Error*\n\nFailed to fetch group metadata!", 
                mentions: [message.key.participant || message.key.remoteJid]
            }, { quoted: message });
        }

        const userId = message.key.participant || message.key.remoteJid;
        const userIsAdmin = await isAdmin(sock, chatId, userId);
        if (!userIsAdmin) {
            await sock.sendMessage(chatId, { 
                text: "❌ *Admin Only*\n\nThis command is only for group admins!", 
                mentions: [userId]
            }, { quoted: message });
            return;
        }

        const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        const botIsAdmin = await isAdmin(sock, chatId, botId);
        if (!botIsAdmin) {
            await sock.sendMessage(chatId, { 
                text: "❌ *Bot Admin Required*\n\nPlease make the bot an admin first!", 
                mentions: [userId]
            }, { quoted: message });
            return;
        }

        const settings = await getAntiStatusMentionSettings(chatId);

        if (!query) {
            const statusMap = {
                'off': '❌ OFF',
                'warn': '⚠️ WARN',
                'delete': '🗑️ DELETE',
                'remove': '🚫 REMOVE'
            };
            const totalWarned = antiStatusMentionData.warns[chatId] ? Object.keys(antiStatusMentionData.warns[chatId]).length : 0;
            return await sock.sendMessage(chatId, {
                text: `*🛡️ Anti-Status-Mention Settings*\n\n` +
                      `┌ *Current Settings*\n` +
                      `│ Status: ${statusMap[settings.action]}\n` +
                      `│ Limit: ${settings.warn_limit}\n` +
                      `│ Warned: ${totalWarned}\n` +
                      `└──────────────\n\n` +
                      `*📝 Commands:*\n` +
                      `▸ *off* - Disable feature\n` +
                      `▸ *warn* - Warn users\n` +
                      `▸ *delete* - Delete only\n` +
                      `▸ *remove* - Remove users\n` +
                      `▸ *limit 1-10* - Set warn limit\n` +
                      `▸ *resetwarns* - Clear all warns\n` +
                      `▸ *status* - Show settings\n\n` +
                      `*ℹ️ Group Command Only*`,
                mentions: [userId]
            }, { quoted: message });
        }

        const args = query.split(/\s+/);
        const subcommand = args[0]?.toLowerCase();
        const value = args[1];

        switch (subcommand) {
            case 'off':
            case 'warn':
            case 'delete':
            case 'remove':
                await updateAntiStatusMentionSettings(chatId, { status: subcommand, action: subcommand });
                await sock.sendMessage(chatId, { 
                    text: `✅ *Settings Updated*\n\nAnti-status-mention has been set to: *${subcommand.toUpperCase()}*\n\n*Group:* ${groupMetadata.subject}`,
                    mentions: [userId]
                }, { quoted: message });
                break;

            case 'limit':
                const limit = parseInt(value);
                if (isNaN(limit) || limit < 1 || limit > 10) {
                    await sock.sendMessage(chatId, { 
                        text: "❌ *Invalid Limit*\n\nPlease use a number between 1 and 10 only!", 
                        mentions: [userId]
                    }, { quoted: message });
                    return;
                }
                await updateAntiStatusMentionSettings(chatId, { warn_limit: limit });
                await sock.sendMessage(chatId, { 
                    text: `✅ *Limit Updated*\n\nWarn limit has been set to: *${limit}*\n\n*Group:* ${groupMetadata.subject}`,
                    mentions: [userId]
                }, { quoted: message });
                break;

            case 'resetwarns':
                await clearAllStatusWarns(chatId);
                await sock.sendMessage(chatId, { 
                    text: `✅ *Warns Reset*\n\nAll status mention warns have been cleared for this group.\n\n*Group:* ${groupMetadata.subject}`,
                    mentions: [userId]
                }, { quoted: message });
                break;

            case 'status':
            case 'info':
                const currentSettings = await getAntiStatusMentionSettings(chatId);
                const statusMap = {
                    'off': '❌ OFF',
                    'warn': '⚠️ WARN',
                    'delete': '🗑️ DELETE',
                    'remove': '🚫 REMOVE'
                };
                const totalWarned = antiStatusMentionData.warns[chatId] ? Object.keys(antiStatusMentionData.warns[chatId]).length : 0;
                await sock.sendMessage(chatId, {
                    text: `*📊 Anti-Status-Mention Status*\n\n` +
                          `┌ *Group Information*\n` +
                          `│ Name: ${groupMetadata.subject}\n` +
                          `│ ID: ${chatId}\n` +
                          `├ *Current Settings*\n` +
                          `│ Status: ${statusMap[currentSettings.action]}\n` +
                          `│ Limit: ${currentSettings.warn_limit}\n` +
                          `│ Warned: ${totalWarned}\n` +
                          `└──────────────`,
                    mentions: [userId]
                }, { quoted: message });
                break;

            default:
                await sock.sendMessage(chatId, { 
                    text: "❌ *Invalid Command*\n\nAvailable commands:\n▸ off/warn/delete/remove\n▸ limit 1-10\n▸ resetwarns\n▸ status", 
                    mentions: [userId]
                }, { quoted: message });
                break;
        }
    } catch (error) {
        console.error("\x1b[35m[AntiStatusMention] Error:\x1b[0m", error);
        await sock.sendMessage(chatId, { 
            text: `🚫 *Error*\n\n${error.message}`,
            mentions: [message.key.participant || message.key.remoteJid]
        }, { quoted: message });
    }
}

// Enhanced event handler with isGroupStatusMention detection
async function handleAntiStatusMention(sock, message) {
    try {
        const chatId = message.key.remoteJid;
        
        // Check if in group
        if (!chatId?.endsWith('@g.us')) return;

        const settings = await getAntiStatusMentionSettings(chatId);
        if (settings.action === 'off') return;

        // ENHANCED: Comprehensive isGroupStatusMention detection
        const isGroupStatusMention = (() => {
            // Check direct group status mention message type
            if (message.message?.groupStatusMentionMessage) {
                return true;
            }
            
            // Check in extended text message context for mentioned JIDs
            if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid) {
                const mentionedJids = message.message.extendedTextMessage.contextInfo.mentionedJid;
                if (mentionedJids && Array.isArray(mentionedJids)) {
                    for (const jid of mentionedJids) {
                        if (jid.includes('status') || jid.includes('broadcast')) {
                            return true;
                        }
                    }
                }
            }
            
            // Check for status mention in quoted message
            if (message.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
                const quoted = message.message.extendedTextMessage.contextInfo.quotedMessage;
                if (quoted?.groupStatusMentionMessage) {
                    return true;
                }
            }
            
            // Check message content for status-related patterns
            let text = message.message?.extendedTextMessage?.text || 
                      message.message?.conversation || 
                      message.message?.imageMessage?.caption || '';
            
            if (text) {
                // Check for @status mention in text
                if (text.includes('@status') || text.includes('@Status')) {
                    return true;
                }
                
                // Check for status broadcast patterns
                const statusPatterns = [
                    /@status\.whatsapp\.net/,
                    /status\s*@/i,
                    /@\s*status/i,
                    /broadcast/i,
                    /status update/i,
                    /status message/i
                ];
                
                for (const pattern of statusPatterns) {
                    if (pattern.test(text)) {
                        return true;
                    }
                }
            }
            
            return false;
        })();

        // ENHANCED: Check for forwarded messages that might contain status mentions
        const isForwarded = message.message?.extendedTextMessage?.contextInfo?.isForwarded;
        const forwardingScore = message.message?.extendedTextMessage?.contextInfo?.forwardingScore || 0;
        
        let hasStatusContent = false;
        
        if (isForwarded || forwardingScore > 0) {
            let text = message.message?.extendedTextMessage?.text || 
                      message.message?.conversation || 
                      message.message?.imageMessage?.caption || '';
            
            // Check forwarded message content for status mentions
            if (text.includes('@status') || text.includes('status update') || 
                text.includes('Status') || text.includes('STATUS')) {
                hasStatusContent = true;
            }
            
            // Check for group ID in forwarded content
            const groupIdPart = chatId.split('@')[0];
            if (text.includes(groupIdPart)) {
                hasStatusContent = true;
            }
            
            // Check if forwarded message contains status broadcast
            if (message.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
                const quoted = message.message.extendedTextMessage.contextInfo.quotedMessage;
                if (quoted?.groupStatusMentionMessage || 
                    quoted?.protocolMessage?.type === 'REVOKE' ||
                    quoted?.statusMentionMessage) {
                    hasStatusContent = true;
                }
            }
        }

        // If neither direct status mention nor forwarded status content, return
        if (!isGroupStatusMention && !hasStatusContent) {
            return;
        }

        const userId = message.key.participant || message.key.remoteJid;
        const userIsAdmin = await isAdmin(sock, chatId, userId);
        
        // Skip for admins
        if (userIsAdmin) {
            console.log(`\x1b[35m[AntiStatusMention] Admin skipped: ${userId}\x1b[0m`);
            return;
        }

        const groupMetadata = await sock.groupMetadata(chatId).catch(() => null);
        const groupName = groupMetadata ? groupMetadata.subject : 'the group';
        
        // Determine mention type for logging/display
        const mentionType = isGroupStatusMention ? 'Direct Status Mention' : 'Forwarded Status Content';

        // Handle different action modes
        switch (settings.action) {
            case 'warn':
                const warnCount = await addUserStatusWarn(chatId, userId);
                
                // Delete the offending message
                try { 
                    await sock.sendMessage(chatId, { delete: message.key }); 
                } catch (e) { 
                    console.error('Delete failed:', e); 
                }
                
                if (warnCount >= settings.warn_limit) {
                    // Reset warnings and give final warning
                    await resetUserStatusWarns(chatId, userId);
                    
                    await sock.sendMessage(chatId, {
                        text: `⚠️ *Status Mention Final Warning*\n\n` +
                              `@${userId.split('@')[0]} you have been warned for mentioning *@status*.\n\n` +
                              `┌ *Details*\n` +
                              `│ Warns: ${warnCount}/${settings.warn_limit}\n` +
                              `│ Type: ${mentionType}\n` +
                              `│ Action: Final Warning\n` +
                              `│ Group: ${groupName}\n` +
                              `└──────────────\n\n` +
                              `*📌 Note:* Next violation may result in removal!`,
                        mentions: [userId]
                    });
                } else {
                    await sock.sendMessage(chatId, {
                        text: `⚠️ *Status Mention Warning*\n\n` +
                              `@${userId.split('@')[0]} please don't mention *@status* in this group!\n\n` +
                              `┌ *Details*\n` +
                              `│ Warns: ${warnCount}/${settings.warn_limit}\n` +
                              `│ Type: ${mentionType}\n` +
                              `│ Group: ${groupName}\n` +
                              `└──────────────`,
                        mentions: [userId]
                    });
                }
                break;

            case 'delete':
                try { 
                    await sock.sendMessage(chatId, { delete: message.key });
                    await sock.sendMessage(chatId, {
                        text: `🗑️ *Message Deleted*\n\n` +
                              `@${userId.split('@')[0]} your message was deleted because it contained a status mention.\n\n` +
                              `┌ *Details*\n` +
                              `│ Type: ${mentionType}\n` +
                              `│ Group: ${groupName}\n` +
                              `└──────────────`,
                        mentions: [userId]
                    });
                } catch (e) { 
                    console.error('Delete failed:', e);
                }
                break;

            case 'remove':
                try { 
                    // Delete the message first
                    await sock.sendMessage(chatId, { delete: message.key }); 
                    
                    // Remove user from group
                    await sock.groupParticipantsUpdate(chatId, [userId], 'remove');
                    
                    // Notify group
                    await sock.sendMessage(chatId, {
                        text: `🚫 *Member Removed*\n\n` +
                              `@${userId.split('@')[0]} has been removed from the group for mentioning *@status*.\n\n` +
                              `┌ *Details*\n` +
                              `│ Type: ${mentionType}\n` +
                              `│ Group: ${groupName}\n` +
                              `└──────────────`,
                        mentions: [userId]
                    });
                } catch (e) { 
                    console.error('Remove failed:', e);
                }
                break;
                
            default:
                // Just delete without notification for unknown actions
                try {
                    await sock.sendMessage(chatId, { delete: message.key });
                } catch (e) {
                    console.error('Delete failed:', e);
                }
                break;
        }

        // Log the action
        console.log(`\x1b[35m[AntiStatusMention] Action taken:\x1b[0m`, {
            group: chatId,
            user: userId,
            action: settings.action,
            type: mentionType,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error("\x1b[35m[AntiStatusMention] Handler error:\x1b[0m", error);
    }
}

module.exports = {
    antistatusmentionCommand,
    handleAntiStatusMention
};
