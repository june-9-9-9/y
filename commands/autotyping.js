/**
 * A WhatsApp Bot
 * Autotyping Command - Shows fake typing status (straight typing presence with fixed 15s duration)
 * Autorecording Command - Shows fake recording status
 */

const fs = require('fs');
const path = require('path');

// Paths to store the configurations
const typingConfigPath = path.join(__dirname, '..', 'data', 'autotyping.json');
const recordingConfigPath = path.join(__dirname, '..', 'data', 'autorecording.json');

// Initialize configuration file if it doesn't exist
function initTypingConfig() {
    if (!fs.existsSync(typingConfigPath)) {
        fs.writeFileSync(typingConfigPath, JSON.stringify({ enabled: false }, null, 2));
    }
    return JSON.parse(fs.readFileSync(typingConfigPath));
}

function initRecordingConfig() {
    if (!fs.existsSync(recordingConfigPath)) {
        fs.writeFileSync(recordingConfigPath, JSON.stringify({ enabled: false }, null, 2));
    }
    return JSON.parse(fs.readFileSync(recordingConfigPath));
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
        const config = initTypingConfig();
        
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
        fs.writeFileSync(typingConfigPath, JSON.stringify(config, null, 2));
        
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

// Toggle autorecording feature
async function autorecordingCommand(sock, chatId, message) {
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
        const config = initRecordingConfig();
        
        // Toggle based on argument or toggle current state if no argument
        if (args.length > 0) {
            const action = args[0].toLowerCase();
            if (action === 'on' || action === 'enable') {
                config.enabled = true;
            } else if (action === 'off' || action === 'disable') {
                config.enabled = false;
            } else {
                await sock.sendMessage(chatId, {
                    text: '❌ Invalid option! Use: .autorecording on/off'
                });
                return;
            }
        } else {
            // Toggle current state
            config.enabled = !config.enabled;
        }
        
        // Save updated configuration
        fs.writeFileSync(recordingConfigPath, JSON.stringify(config, null, 2));
        
        // Send confirmation message
        await sock.sendMessage(chatId, {
            text: `✅ Auto-recording has been ${config.enabled ? 'enabled' : 'disabled'}!`
        });
        
    } catch (error) {
        console.error('Error in autorecording command:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Error processing command!'
        });
    }
}

// Function to check if autotyping is enabled
function isAutotypingEnabled() {
    try {
        const config = initTypingConfig();
        return config.enabled;
    } catch (error) {
        console.error('Error checking autotyping status:', error);
        return false;
    }
}

// Function to check if autorecording is enabled
function isAutorecordingEnabled() {
    try {
        const config = initRecordingConfig();
        return config.enabled;
    } catch (error) {
        console.error('Error checking autorecording status:', error);
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

// Recording presence with fixed 15s duration
async function straightRecordingPresence(sock, chatId) {
    if (isAutorecordingEnabled()) {
        try {
            // Subscribe to presence updates
            await sock.presenceSubscribe(chatId);

            // Show recording status
            await sock.sendPresenceUpdate('recording', chatId);

            // Fixed recording duration of 15 seconds
            const recordingDuration = 15000;
            await new Promise(resolve => setTimeout(resolve, recordingDuration));

            // End recording
            await sock.sendPresenceUpdate('paused', chatId);

            return true;
        } catch (error) {
            console.error('❌ Error sending straight recording indicator:', error);
            return false;
        }
    }
    return false; // Autorecording disabled
}

// Handle autotyping for regular messages
async function handleAutotypingForMessage(sock, chatId) {
    return await straightTypingPresence(sock, chatId);
}

// Handle autotyping for commands (before execution)
async function handleAutotypingForCommand(sock, chatId) {
    return await straightTypingPresence(sock, chatId);
}

// Handle autorecording for audio-related messages
async function handleAutorecordingForMessage(sock, chatId) {
    return await straightRecordingPresence(sock, chatId);
}

// Show typing status after command execution
async function showTypingAfterCommand(sock, chatId) {
    return await straightTypingPresence(sock, chatId);
}

// Show recording status for audio operations
async function showRecordingAfterAudioCommand(sock, chatId) {
    return await straightRecordingPresence(sock, chatId);
}

module.exports = {
    autotypingCommand,
    autorecordingCommand,
    isAutotypingEnabled,
    isAutorecordingEnabled,
    straightTypingPresence,
    straightRecordingPresence,
    handleAutotypingForMessage,
    handleAutotypingForCommand,
    handleAutorecordingForMessage,
    showTypingAfterCommand,
    showRecordingAfterAudioCommand
};
