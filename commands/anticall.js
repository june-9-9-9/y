// Enhanced version with call handler
const { getAntiCallSettings, updateAntiCallSettings } = require('../lib/database');
const fs = require('fs');
const path = require('path');

// Superuser list (store in a separate file or database)
const SUPERUSERS_FILE = path.join(__dirname, '../data/superusers.json');

function getSuperUsers() {
    try {
        if (fs.existsSync(SUPERUSERS_FILE)) {
            const data = fs.readFileSync(SUPERUSERS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error reading superusers:', error);
    }
    return [];
}

function isSuperUser(userId) {
    const superusers = getSuperUsers();
    return superusers.includes(userId);
}

// Call handler for incoming calls
async function handleIncomingCall(sock, callData) {
    try {
        const settings = await getAntiCallSettings();
        
        if (!settings.status) return; // Anti-call is disabled
        
        const call = callData[0];
        const callerJid = call.from;
        const userId = callerJid.split('@')[0];
        
        console.log(`📞 Incoming call from ${callerJid} - Action: ${settings.action}`);
        
        // Send rejection message if set
        if (settings.message) {
            await sock.sendMessage(callerJid, { text: settings.message });
        }
        
        // Handle the call based on action
        if (settings.action === 'block') {
            try {
                // Block the user
                await sock.updateBlockStatus(callerJid, 'block');
                console.log(`🚫 Blocked caller: ${callerJid}`);
                
                // Notify superusers
                const superusers = getSuperUsers();
                for (const superuser of superusers) {
                    await sock.sendMessage(superuser + '@s.whatsapp.net', {
                        text: `🚨 *Call Blocked*\n\n` +
                              `📞 *Caller:* ${callerJid}\n` +
                              `🕐 *Time:* ${new Date().toLocaleString()}\n` +
                              `📝 *Reason:* Anti-call protection`
                    });
                }
            } catch (blockError) {
                console.error('Error blocking user:', blockError);
            }
        }
        
        // Always reject the call
        try {
            await sock.rejectCall(call.id, call.from);
            console.log(`❌ Rejected call from: ${callerJid}`);
        } catch (rejectError) {
            console.error('Error rejecting call:', rejectError);
        }
        
    } catch (error) {
        console.error('Error in call handler:', error);
    }
}

async function anticallCommand(sock, chatId, message) {
    try {
        // React immediately
        await sock.sendMessage(chatId, {
            react: { text: '📞', key: message.key }
        });
        
        // Extract user ID
        const userId = message.key.participant?.split('@')[0] || 
                      message.key.remoteJid?.split('@')[0] ||
                      "unknown";
        
        // Check superuser status
        if (!isSuperUser(userId)) {
            return await sock.sendMessage(chatId, { 
                text: "❌ You need superuser privileges to manage anti-call settings."
            }, { quoted: message });
        }
        
        // Extract text and arguments
        const text = message.message?.conversation || 
                     message.message?.extendedTextMessage?.text || "";
        const parts = text.split(' ');
        const subcommand = parts[1]?.toLowerCase();
        const value = parts.slice(2).join(' ').trim();
        
        // Get current settings
        const settings = await getAntiCallSettings();
        const prefix = "."; // Your bot prefix
        
        // Show settings if no subcommand
        if (!subcommand) {
            const status = settings.status ? '✅ ON' : '❌ OFF';
            const action = settings.action === 'block' ? 'Block caller' : 'Reject call';
            const actionEmoji = settings.action === 'block' ? '🚫' : '❌';
            
            // Get stats if available
            let statsText = '';
            try {
                const stats = getCallStats();
                if (stats) {
                    statsText = `\n*📊 Statistics:*\n` +
                               `▸ Total calls blocked: ${stats.blocked || 0}\n` +
                               `▸ Total calls rejected: ${stats.rejected || 0}\n` +
                               `▸ Last blocked: ${stats.lastBlocked || 'Never'}`;
                }
            } catch (e) { /* Ignore stats errors */ }
            
            return await sock.sendMessage(chatId, {
                text: 
                    `*📜 Anti-Call Settings*\n\n` +
                    `🔹 *Status:* ${status}\n` +
                    `🔹 *Action:* ${actionEmoji} ${action}\n` +
                    `🔹 *Message:* ${settings.message || '*No message set*'}\n` +
                    `${statsText}\n\n` +
                    `*🛠 Usage Instructions:*\n` +
                    `▸ *${prefix}anticall on/off* - Toggle anti-call\n` +
                    `▸ *${prefix}anticall message <text>* - Set rejection message\n` +
                    `▸ *${prefix}anticall action reject/block*`
            }, { quoted: message });
        }
        
        // Handle subcommands
        switch (subcommand) {
            case 'on':
            case 'off': {
                const newStatus = subcommand === 'on';
                if (settings.status === newStatus) {
                    return await sock.sendMessage(chatId, {
                        text: `⚠️ Anti-call is already ${newStatus ? 'enabled' : 'disabled'}.`
                    }, { quoted: message });
                }
                await updateAntiCallSettings({ status: newStatus });
                
                const statusText = newStatus ? 
                    "✅ Anti-call protection has been *ENABLED*.\n\nAll incoming calls will be automatically handled." :
                    "❌ Anti-call protection has been *DISABLED*.\n\nCalls will be accepted normally.";
                
                return await sock.sendMessage(chatId, {
                    text: statusText
                }, { quoted: message });
            }
            
            case 'message': {
                if (!value) {
                    return await sock.sendMessage(chatId, {
                        text: '❌ Please provide a message for anti-call rejection.\n\n' +
                              'Example: `.anticall message Sorry, this bot does not accept calls.`'
                    }, { quoted: message });
                }
                
                if (value.length > 500) {
                    return await sock.sendMessage(chatId, {
                        text: '❌ Message is too long. Maximum 500 characters.'
                    }, { quoted: message });
                }
                
                await updateAntiCallSettings({ message: value });
                return await sock.sendMessage(chatId, {
                    text: `✅ Anti-call message updated:\n\n"${value}"\n\n` +
                          `This message will be sent to anyone who tries to call the bot.`
                }, { quoted: message });
            }
            
            case 'action': {
                const action = value.toLowerCase();
                if (!['reject', 'block'].includes(action)) {
                    return await sock.sendMessage(chatId, {
                        text: 
                            '❌ Invalid action. Use "reject" or "block".\n\n' +
                            '*Reject:* Declines call but allows future calls\n' +
                            '*Block:* Declines and permanently blocks the caller\n\n' +
                            'Example: `.anticall action block`'
                    }, { quoted: message });
                }
                
                if (settings.action === action) {
                    return await sock.sendMessage(chatId, {
                        text: `⚠️ Action is already set to "${action}".`
                    }, { quoted: message });
                }
                
                await updateAntiCallSettings({ action });
                
                const actionText = action === 'block' ?
                    `🚫 Action changed to *BLOCK*.\n\n` +
                    `Now when someone calls:\n` +
                    `1. Call will be rejected\n` +
                    `2. Caller will be blocked permanently\n` +
                    `3. You will be notified of blocked calls` :
                    `✔️ Action changed to *REJECT*.\n\n` +
                    `Now when someone calls:\n` +
                    `1. Call will be rejected\n` +
                    `2. Caller can try calling again\n` +
                    `3. No blocking will occur`;
                
                return await sock.sendMessage(chatId, {
                    text: actionText
                }, { quoted: message });
            }
            
            case 'test': {
                // Test the anti-call message
                if (!settings.message) {
                    return await sock.sendMessage(chatId, {
                        text: '❌ No message set. Use `.anticall message <text>` first.'
                    }, { quoted: message });
                }
                
                return await sock.sendMessage(chatId, {
                    text: `📝 *Test Message Preview:*\n\n` +
                          `"${settings.message}"\n\n` +
                          `This is what callers will see when they try to call.`
                }, { quoted: message });
            }
            
            default:
                return await sock.sendMessage(chatId, {
                    text: 
                        '❌ Invalid command. Available options:\n\n' +
                        `▸ *${prefix}anticall* - Show settings\n` +
                        `▸ *${prefix}anticall on/off* - Enable/disable\n` +
                        `▸ *${prefix}anticall message <text>* - Set message\n` +
                        `▸ *${prefix}anticall action reject/block* - Set action\n` +
                        `▸ *${prefix}anticall test* - Preview message`
                }, { quoted: message });
        }
        
    } catch (error) {
        console.error("Anti-call command error:", error);
        
        let errorMessage = "🚫 An error occurred while updating anti-call settings.";
        
        if (error.message.includes("database") || error.message.includes("JSON")) {
            errorMessage = "💾 Database error. Please check if the data directory exists.";
        } else if (error.message.includes("permission")) {
            errorMessage = "🔒 Permission denied. You must be a superuser.";
        }
        
        return await sock.sendMessage(chatId, { 
            text: errorMessage + "\n\nContact the bot administrator if this persists."
        }, { quoted: message });
    }
}

// Export both command and call handler
module.exports = {
    anticallCommand,
    handleIncomingCall
};
