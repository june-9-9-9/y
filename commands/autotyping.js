const fs = require('fs');
const path = require('path');

// Config file path
const configFile = path.join(__dirname, '..', 'data', 'autotyping.json');

// Get config
function getConfig() {
    if (!fs.existsSync(configFile)) {
        fs.writeFileSync(configFile, JSON.stringify({ 
            enabled: false,
            recordingEnabled: false,
            recordTypingEnabled: false 
        }));
    }
    return JSON.parse(fs.readFileSync(configFile));
}

// Save config
function saveConfig(config) {
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
}

// Auto-typing command
async function autotypingCommand(sock, chatId, message) {
    const config = getConfig();
    const args = message.body?.split(' ') || [];
    
    if (args[1] === 'on') {
        config.enabled = true;
        saveConfig(config);
        await sock.sendMessage(chatId, { text: '✅ Auto-typing ON' });
    } else if (args[1] === 'off') {
        config.enabled = false;
        saveConfig(config);
        await sock.sendMessage(chatId, { text: '❌ Auto-typing OFF' });
    } else {
        const status = config.enabled ? 'ON' : 'OFF';
        await sock.sendMessage(chatId, { text: `Auto-typing: ${status}` });
    }
}

// Auto-recording command
async function autorecordingCommand(sock, chatId, message) {
    const config = getConfig();
    const args = message.body?.split(' ') || [];
    
    if (args[1] === 'on') {
        config.recordingEnabled = true;
        saveConfig(config);
        await sock.sendMessage(chatId, { text: '✅ Auto-recording ON' });
    } else if (args[1] === 'off') {
        config.recordingEnabled = false;
        saveConfig(config);
        await sock.sendMessage(chatId, { text: '❌ Auto-recording OFF' });
    } else {
        const status = config.recordingEnabled ? 'ON' : 'OFF';
        await sock.sendMessage(chatId, { text: `Auto-recording: ${status}` });
    }
}

// Auto record typing command (recording + typing)
async function autorecordTypingCommand(sock, chatId, message) {
    const config = getConfig();
    const args = message.body?.split(' ') || [];
    
    if (args[1] === 'on') {
        config.recordTypingEnabled = true;
        saveConfig(config);
        await sock.sendMessage(chatId, { text: '✅ Auto record+typing ON' });
    } else if (args[1] === 'off') {
        config.recordTypingEnabled = false;
        saveConfig(config);
        await sock.sendMessage(chatId, { text: '❌ Auto record+typing OFF' });
    } else {
        const status = config.recordTypingEnabled ? 'ON' : 'OFF';
        await sock.sendMessage(chatId, { text: `Auto record+typing: ${status}` });
    }
}

// Show typing for messages
async function handleAutotypingForMessage(sock, chatId) {
    const config = getConfig();
    
    try {
        await sock.presenceSubscribe(chatId);
        
        // Handle recording presence (when recordingEnabled OR recordTypingEnabled is true)
        if (config.recordingEnabled || config.recordTypingEnabled) {
            await sock.sendPresenceUpdate('recording', chatId);
            // Wait 15 seconds for recording
            await new Promise(r => setTimeout(r, 15000));
            await sock.sendPresenceUpdate('paused', chatId);
            
            // If only recording, stop here
            if (config.recordingEnabled && !config.recordTypingEnabled) {
                return true;
            }
        }
        
        // Handle typing presence (when enabled OR recordTypingEnabled is true)
        if (config.enabled || config.recordTypingEnabled) {
            await sock.sendPresenceUpdate('composing', chatId);
            // Wait 15 seconds for typing
            await new Promise(r => setTimeout(r, 15000));
            await sock.sendPresenceUpdate('paused', chatId);
        }
        
        return true;
    } catch (error) {
        console.log('Presence error:', error.message);
        return false;
    }
}

module.exports = {
    autotypingCommand,
    autorecordingCommand,
    autorecordTypingCommand,
    handleAutotypingForMessage
};
