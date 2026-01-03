// antidemote.js
const fs = require('fs');
const path = require('path');

// === SETTINGS MANAGER ===
function loadSettings() {
    const settingsPath = path.join(__dirname, '../data/antidemote.json');
    if (fs.existsSync(settingsPath)) {
        try {
            return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        } catch (error) {
            console.error('Error loading antidemote settings:', error);
            return {};
        }
    }
    return {};
}

function saveSettings(settings) {
    try {
        const settingsPath = path.join(__dirname, '../data/antidemote.json');
        const dir = path.dirname(settingsPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    } catch (error) {
        console.error('Error saving antidemote settings:', error);
    }
}

// === COMMAND HANDLER ===
async function antidemoteCommand(sock, chatId, message) {
    try {
        // Send reaction
        await sock.sendMessage(chatId, {
            react: { text: '🛡️', key: message.key }
        });

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const parts = text.split(' ');
        const option = parts[1]?.toLowerCase();
        const mode = parts[2]?.toLowerCase() || "revert";

        // Check if group
        const metadata = await sock.groupMetadata(chatId);
        const participants = metadata.participants || [];
        const admins = participants.filter(p => p.admin).map(p => p.id);
        const sender = message.key?.participant || message.key?.remoteJid;
        const isAdmin = admins.includes(sender);
        
        if (!isAdmin) {
            return await sock.sendMessage(chatId, {
                text: '⚠️ Only group admins can use this command!'
            }, { quoted: message });
        }

        // Load settings
        const settings = loadSettings();
        settings.antidemote = settings.antidemote || {};

        const groupSettings = settings.antidemote[chatId];
        const isEnabled = groupSettings?.enabled || false;

        // Handle options
        if (!option || option === 'status') {
            const statusText = isEnabled 
                ? `✅ *ENABLED*\nMode: ${groupSettings.mode.toUpperCase()}`
                : '❌ *DISABLED*';
            
            return await sock.sendMessage(chatId, {
                text: `🛡️ *AntiDemote System*\n\n${statusText}\n\n📋 *Usage:*\n• .antidemote on [revert/kick]\n• .antidemote off\n• .antidemote status\n\n📝 *Modes:*\n• revert - Re-promote demoted users\n• kick - Kick demoter & re-promote`
            }, { quoted: message });
        }

        if (option === 'on') {
            if (mode !== 'revert' && mode !== 'kick') {
                return await sock.sendMessage(chatId, {
                    text: '❌ Invalid mode! Use "revert" or "kick"'
                }, { quoted: message });
            }

            settings.antidemote[chatId] = { enabled: true, mode };
            saveSettings(settings);

            return await sock.sendMessage(chatId, {
                text: `✅ AntiDemote activated!\n\n📊 *Details:*\n• Status: ACTIVE\n• Mode: ${mode.toUpperCase()}\n• Group: ${metadata.subject}`
            }, { quoted: message });
        }

        if (option === 'off') {
            if (!isEnabled) {
                return await sock.sendMessage(chatId, {
                    text: '❌ AntiDemote is already disabled!'
                }, { quoted: message });
            }

            delete settings.antidemote[chatId];
            saveSettings(settings);

            return await sock.sendMessage(chatId, {
                text: '❎ AntiDemote deactivated!'
            }, { quoted: message });
        }

        // Invalid option
        return await sock.sendMessage(chatId, {
            text: '❌ Invalid option!\n\n📋 *Usage:*\n• .antidemote on [revert/kick]\n• .antidemote off\n• .antidemote status'
        }, { quoted: message });

    } catch (error) {
        console.error("AntiDemote command error:", error);
        
        const errorMessage = error.message.includes('group metadata')
            ? 'Cannot fetch group information!'
            : error.message.includes('not admin')
            ? 'Bot needs admin permissions!'
            : `Error: ${error.message}`;
            
        return await sock.sendMessage(chatId, {
            text: `🚫 ${errorMessage}`
        }, { quoted: message });
    }
}

// === EVENT HANDLER ===
async function handleDemoteEvent(sock, event) {
    try {
        const { id, from, participants, action } = event;
        
        // Check if it's a demote action
        if (action !== 'demote') return;
        
        const chatId = from;
        const demotedUser = participants[0];
        
        // Get author from event
        const demoter = event.author || event.key?.participant || participants[1];
        if (!demoter) return;
        
        console.log(`📛 Demote detected in ${chatId}: ${demoter} demoted ${demotedUser}`);

        // Load antidemote settings
        const settings = loadSettings();
        const groupSettings = settings.antidemote?.[chatId];
        
        // Check if antidemote is enabled for this group
        if (!groupSettings?.enabled) {
            console.log('AntiDemote not enabled for this group');
            return;
        }

        // Get group metadata
        const metadata = await sock.groupMetadata(chatId);
        const groupParticipants = metadata.participants || [];
        
        // Find bot's admin status
        const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        const botParticipant = groupParticipants.find(p => p.id === botId);
        
        // Bot needs to be admin to take action
        if (!botParticipant?.admin) {
            console.log('Bot is not admin, cannot take action');
            return;
        }
        
        // Find demoter's admin status
        const demoterParticipant = groupParticipants.find(p => p.id === demoter);
        
        // Check if demoter exists in group
        if (!demoterParticipant) {
            console.log('Demoter not found in group participants');
            return;
        }

        console.log(`Processing AntiDemote with mode: ${groupSettings.mode}`);

        const mode = groupSettings.mode || 'revert';
        
        if (mode === 'revert') {
            // Re-promote the demoted user
            await sock.groupParticipantsUpdate(chatId, [demotedUser], 'promote');
            
            console.log(`Re-promoted ${demotedUser.split('@')[0]}`);
            
            // Send notification
            await sock.sendMessage(chatId, {
                text: `🛡️ *AntiDemote Triggered!*\n\n• Demoter: @${demoter.split('@')[0]}\n• User re-promoted: @${demotedUser.split('@')[0]}\n• Mode: Revert (Demotion Reversed)`,
                mentions: [demoter, demotedUser]
            });
        } 
        else if (mode === 'kick') {
            // Check if demoter is still admin (can't kick admins)
            if (demoterParticipant.admin) {
                console.log('Cannot kick an admin user');
                // Fallback to revert mode
                await sock.groupParticipantsUpdate(chatId, [demotedUser], 'promote');
                
                await sock.sendMessage(chatId, {
                    text: `🛡️ *AntiDemote Triggered!*\n\n• Demoter: @${demoter.split('@')[0]}\n• User re-promoted: @${demotedUser.split('@')[0]}\n• Note: Could not kick (User is admin)`,
                    mentions: [demoter, demotedUser]
                });
                return;
            }
            
            // Kick the user who demoted others
            await sock.groupParticipantsUpdate(chatId, [demoter], 'remove');
            
            // Re-promote the demoted user
            await sock.groupParticipantsUpdate(chatId, [demotedUser], 'promote');
            
            console.log(`Kicked ${demoter.split('@')[0]} and re-promoted ${demotedUser.split('@')[0]}`);
            
            // Send notification
            await sock.sendMessage(chatId, {
                text: `⚡ *AntiDemote Triggered!*\n\n• Demoter: @${demoter.split('@')[0]} (KICKED)\n• User re-promoted: @${demotedUser.split('@')[0]}\n• Mode: Kick (Demoter Removed)`,
                mentions: [demoter, demotedUser]
            });
        }
        
        console.log('AntiDemote action completed successfully');
        
    } catch (error) {
        console.error("AntiDemote event handler error:", error);
        
        // Log specific error details
        if (error.message.includes('not authorized')) {
            console.log('Bot lacks permission to modify group participants');
        } else if (error.message.includes('404')) {
            console.log('Group or participant not found');
        }
    }
}

// === EXPORTS ===
module.exports = {
    antidemoteCommand,
    handleDemoteEvent,
    loadSettings,  // Optional: if you need to access settings elsewhere
    saveSettings   // Optional: if you need to modify settings elsewhere
};

// === USAGE EXAMPLE (for your main bot file) ===
/*
// In your main bot file:
const { antidemoteCommand, handleDemoteEvent } = require('./antidemote.js');

// Command handler
if (command === 'antidemote') {
    return antidemoteCommand(sock, chatId, message);
}

// Event listener
sock.ev.on('group-participants.update', async (event) => {
    await handleDemoteEvent(sock, event);
});

// Optional: Check bot admin status on group join
sock.ev.on('group-participants.update', async (event) => {
    if (event.action === 'add') {
        const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        if (event.participants.includes(botId)) {
            console.log(`Bot added to group: ${event.from}`);
            // You could auto-enable antidemote here if desired
        }
    }
});
*/
