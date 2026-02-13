const fs = require('fs');
const path = require('path');
const isAdmin = require('../lib/isAdmin'); // Add this import

// In-memory storage
const antiStatusMentionData = { settings: {}, warns: {} };

// Database file path - goes to ../data/antistatusmention.json
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
        console.error('Error loading anti-status-mention data:', error);
    }
}

// Save data
function saveData() {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(antiStatusMentionData, null, 2));
    } catch (error) {
        console.error('Error saving anti-status-mention data:', error);
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

// Main command handler
async function antistatusmentionCommand(sock, chatId, message) {
    try {
        // Send reaction
        await sock.sendMessage(chatId, {
            react: { text: '🛡️', key: message.key }
        });

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const parts = text.split(' ');
        const query = parts.slice(1).join(' ').trim();

        // Get group info and check admin status using external module
        const groupMetadata = await sock.groupMetadata(chatId).catch(() => null);
        if (!groupMetadata) {
            return await sock.sendMessage(chatId, { 
                text: "❌ Group command only!"
            }, { quoted: message });
        }

        // Check if user is admin using external module
        const userId = message.key.participant || message.key.remoteJid;
        const userIsAdmin = await isAdmin(sock, chatId, userId);
        
        if (!userIsAdmin) {
            return await sock.sendMessage(chatId, { 
                text: "❌ Admin only!"
            }, { quoted: message });
        }

        // Check if bot is admin using external module
        const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        const botIsAdmin = await isAdmin(sock, chatId, botId);
        
        if (!botIsAdmin) {
            return await sock.sendMessage(chatId, { 
                text: "❌ Need bot admin!"
            }, { quoted: message });
        }

        // Get settings
        const settings = await getAntiStatusMentionSettings(chatId);

        // No arguments = show help
        if (!query) {
            const statusMap = {
                'off': '❌ OFF',
                'warn': '⚠️ WARN', 
                'delete': '🗑️ DELETE',
                'remove': '🚫 REMOVE'
            };

            const totalWarned = antiStatusMentionData.warns[chatId] ? 
                Object.keys(antiStatusMentionData.warns[chatId]).length : 0;

            return await sock.sendMessage(chatId, { 
                text: `*Anti-Status-Mention*\n\n` +
                `Status: ${statusMap[settings.status]}\n` +
                `Limit: ${settings.warn_limit}\n` +
                `Warned: ${totalWarned}\n\n` +
                `*Commands:*\n` +
                `▸ off/warn/delete/remove\n` +
                `▸ limit 1-10\n` +
                `▸ resetwarns\n` +
                `▸ status`
            }, { quoted: message });
        }

        // Parse arguments
        const args = query.split(/\s+/);
        const subcommand = args[0]?.toLowerCase();
        const value = args[1];

        switch (subcommand) {
            case 'off':
            case 'warn':
            case 'delete':
            case 'remove':
                await updateAntiStatusMentionSettings(chatId, { 
                    status: subcommand, 
                    action: subcommand 
                });
                return await sock.sendMessage(chatId, { 
                    text: `✅ Set to: ${subcommand.toUpperCase()}`
                }, { quoted: message });

            case 'limit':
                const limit = parseInt(value);
                if (isNaN(limit) || limit < 1 || limit > 10) {
                    return await sock.sendMessage(chatId, { 
                        text: "❌ Limit 1-10 only"
                    }, { quoted: message });
                }
                await updateAntiStatusMentionSettings(chatId, { warn_limit: limit });
                return await sock.sendMessage(chatId, { 
                    text: `✅ Limit: ${limit}`
                }, { quoted: message });

            case 'resetwarns':
                await clearAllStatusWarns(chatId);
                return await sock.sendMessage(chatId, { 
                    text: "✅ Warns reset"
                }, { quoted: message });

            case 'status':
            case 'info':
                const currentSettings = await getAntiStatusMentionSettings(chatId);
                const statusMap = {
                    'off': '❌ OFF',
                    'warn': '⚠️ WARN', 
                    'delete': '🗑️ DELETE',
                    'remove': '🚫 REMOVE'
                };
                const totalWarned = antiStatusMentionData.warns[chatId] ? 
                    Object.keys(antiStatusMentionData.warns[chatId]).length : 0;
                
                return await sock.sendMessage(chatId, { 
                    text: `*Current Settings*\n\n` +
                    `Status: ${statusMap[currentSettings.status]}\n` +
                    `Limit: ${currentSettings.warn_limit}\n` +
                    `Warned: ${totalWarned}`
                }, { quoted: message });

            default:
                return await sock.sendMessage(chatId, { 
                    text: "❌ Invalid!\nUse: off/warn/delete/remove\nlimit 1-10\nresetwarns\nstatus"
                }, { quoted: message });
        }

    } catch (error) {
        console.error("AntiStatusMention error:", error);
        return await sock.sendMessage(chatId, { 
            text: `🚫 Error: ${error.message}`
        }, { quoted: message });
    }
}

// Event handler for status mentions
async function handleAntiStatusMention(sock, message) {
    try {
        const chatId = message.key.remoteJid;
        if (!chatId.endsWith('@g.us')) return; // Only groups

        const settings = await getAntiStatusMentionSettings(chatId);
        if (settings.status === 'off') return;

        // Check if message contains status mention
        const text = message.message?.conversation || 
                     message.message?.extendedTextMessage?.text || 
                     message.message?.imageMessage?.caption ||
                     '';
        
        if (!text.includes('@status')) return;

        const userId = message.key.participant || message.key.remoteJid;
        
        // Check if user is admin (exempt admins)
        const userIsAdmin = await isAdmin(sock, chatId, userId);
        if (userIsAdmin) return;

        switch (settings.status) {
            case 'warn':
                const warnCount = await addUserStatusWarn(chatId, userId);
                
                if (warnCount >= settings.warn_limit) {
                    // Take action after reaching limit
                    await resetUserStatusWarns(chatId, userId);
                    
                    if (settings.action === 'remove') {
                        await sock.groupParticipantsUpdate(chatId, [userId], 'remove');
                        await sock.sendMessage(chatId, {
                            text: `🚫 @${userId.split('@')[0]} removed for status mentions (${settings.warn_limit} warnings)`,
                            mentions: [userId]
                        });
                    } else if (settings.action === 'delete') {
                        await sock.sendMessage(chatId, {
                            delete: message.key
                        });
                        await sock.sendMessage(chatId, {
                            text: `⚠️ @${userId.split('@')[0]} reached ${settings.warn_limit} warnings for status mentions`,
                            mentions: [userId]
                        });
                    }
                } else {
                    await sock.sendMessage(chatId, {
                        delete: settings.action === 'delete' ? message.key : undefined,
                        text: `⚠️ @${userId.split('@')[0]} warned for status mention! (${warnCount}/${settings.warn_limit})`,
                        mentions: [userId]
                    });
                }
                break;

            case 'delete':
                await sock.sendMessage(chatId, {
                    delete: message.key
                });
                await sock.sendMessage(chatId, {
                    text: `🗑️ Status mention deleted from @${userId.split('@')[0]}`,
                    mentions: [userId]
                });
                break;

            case 'remove':
                await sock.groupParticipantsUpdate(chatId, [userId], 'remove');
                await sock.sendMessage(chatId, {
                    text: `🚫 @${userId.split('@')[0]} removed for status mention`,
                    mentions: [userId]
                });
                break;
        }
    } catch (error) {
        console.error("Error in handleAntiStatusMention:", error);
    }
}

// Export
module.exports = {
    antistatusmentionCommand,
    handleAntiStatusMention, // Export the handler
    getAntiStatusMentionSettings,
    updateAntiStatusMentionSettings,
    clearAllStatusWarns,
    getUserStatusWarns,
    addUserStatusWarn,
    resetUserStatusWarns
};
