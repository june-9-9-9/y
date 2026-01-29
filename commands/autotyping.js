/**
 * A WhatsApp Bot
 * Autotyping Command - Shows fake typing status (straight typing presence with fixed 15s duration)
 */

const fs = require('fs');
const path = require('path');

// Path to store the configuration
const configPath = path.join(__dirname, '..', 'data', 'autotyping.json');

// Initialize configuration file if it doesn't exist
function initConfig() {
    if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, JSON.stringify({ enabled: false }, null, 2));
    }
    return JSON.parse(fs.readFileSync(configPath));
}

// Toggle autotyping feature
async function autotypingCommand(sock, chatId, message) {
    try {
        // Check if sender is the owner (bot itself)
        if (!message.key.fromMe) {
            await sock.sendMessage(chatId, {
                text: '❌ This command is only available for the owner!'
            });
            return;
        }

        // Get command arguments
        const args = message.message?.conversation?.trim().split(' ').slice(1) || 
                    message.message?.extendedTextMessage?.text?.trim().split(' ').slice(1) || 
                    [];
        
        // Initialize or read config
        const config = initConfig();
        
        // Toggle based on argument or toggle current state if no argument
        if (args.length > 0) {
            const action = args[0].toLowerCase();
            if (action === 'on' || action === 'enable') {
                config.enabled = true;
            } else if (action === 'off' || action === 'disable') {
                config.enabled = false;
            } else {
                await sock.sendMessage(chatId, {
                    text: '❌ Invalid option! Use: .autotyping on/off'
                });
                return;
            }
        } else {
            // Toggle current state
            config.enabled = !config.enabled;
        }
        
        // Save updated configuration
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        
        // Send confirmation message
        await sock.sendMessage(chatId, {
            text: `✅ Auto-typing has been ${config.enabled ? 'enabled' : 'disabled'}!`
        });
        
    } catch (error) {
        console.error('Error in autotyping command:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Error processing command!'
        });
    }
}

// Function to check if autotyping is enabled
function isAutotypingEnabled() {
    try {
        const config = initConfig();
        return config.enabled;
    } catch (error) {
        console.error('Error checking autotyping status:', error);
        return false;
    }
}

// Straight typing presence with fixed 15s duration
async function straightTypingPresence(sock, chatId) {
    if (isAutotypingEnabled()) {
        try {
            // Subscribe to presence updates
            await sock.presenceSubscribe(chatId);

            // Show typing status
            await sock.sendPresenceUpdate('composing', chatId);

            // Fixed typing duration of 15 seconds
            const typingDuration = 15000;
            await new Promise(resolve => setTimeout(resolve, typingDuration));

            // End typing
            await sock.sendPresenceUpdate('paused', chatId);

            return true;
        } catch (error) {
            console.error('❌ Error sending straight typing indicator:', error);
            return false;
        }
    }
    return false; // Autotyping disabled
}

// Handle autotyping for regular messages
async function handleAutotypingForMessage(sock, chatId) {
    return await straightTypingPresence(sock, chatId);
}

// Handle autotyping for commands (before execution)
async function handleAutotypingForCommand(sock, chatId) {
    return await straightTypingPresence(sock, chatId);
}

// Show typing status after command execution
async function showTypingAfterCommand(sock, chatId) {
    return await straightTypingPresence(sock, chatId);
}

module.exports = {
    autotypingCommand,
    isAutotypingEnabled,
    straightTypingPresence,
    handleAutotypingForMessage,
    handleAutotypingForCommand,
    showTypingAfterCommand
};
                    
