/**
 * A WhatsApp Bot
 * Autotyping / Autorecording / AutorecordTyping Commands
 * - Fake typing/recording status with fixed 15s duration
 */

const fs = require('fs');
const path = require('path');

// Paths to store configurations
const autotypingPath = path.join(__dirname, '..', 'data', 'autotyping.json');
const autorecordingPath = path.join(__dirname, '..', 'data', 'autorecording.json');
const autorecordTypingPath = path.join(__dirname, '..', 'data', 'autorecordtyping.json');

// Initialize configuration file if it doesn't exist
function initConfig(configPath) {
    if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, JSON.stringify({ enabled: false }, null, 2));
    }
    return JSON.parse(fs.readFileSync(configPath));
}

// Generic toggle command
async function toggleCommand(sock, chatId, message, configPath, featureName) {
    try {
        if (!message.key.fromMe) {
            await sock.sendMessage(chatId, { text: `❌ This command is only available for the owner!` });
            return;
        }

        const args = message.message?.conversation?.trim().split(' ').slice(1) ||
                     message.message?.extendedTextMessage?.text?.trim().split(' ').slice(1) || [];

        const config = initConfig(configPath);

        if (args.length > 0) {
            const action = args[0].toLowerCase();
            if (action === 'on' || action === 'enable') {
                config.enabled = true;
            } else if (action === 'off' || action === 'disable') {
                config.enabled = false;
            } else {
                await sock.sendMessage(chatId, { text: `❌ Invalid option! Use: .${featureName} on/off` });
                return;
            }
        } else {
            config.enabled = !config.enabled;
        }

        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

        await sock.sendMessage(chatId, {
            text: `✅ ${featureName} has been ${config.enabled ? 'enabled' : 'disabled'}!`
        });

    } catch (error) {
        console.error(`Error in ${featureName} command:`, error);
        await sock.sendMessage(chatId, { text: `❌ Error processing ${featureName} command!` });
    }
}

// Presence helpers
async function straightPresence(sock, chatId, type, configPath) {
    const config = initConfig(configPath);
    if (config.enabled) {
        try {
            await sock.presenceSubscribe(chatId);
            await sock.sendPresenceUpdate(type, chatId);

            const duration = 15000;
            await new Promise(resolve => setTimeout(resolve, duration));

            await sock.sendPresenceUpdate('paused', chatId);
            return true;
        } catch (error) {
            console.error(`❌ Error sending ${type} indicator:`, error);
            return false;
        }
    }
    return false;
}

// Commands
async function autotypingCommand(sock, chatId, message) {
    return toggleCommand(sock, chatId, message, autotypingPath, 'Auto-typing');
}
async function autorecordingCommand(sock, chatId, message) {
    return toggleCommand(sock, chatId, message, autorecordingPath, 'Auto-recording');
}
async function autorecordTypingCommand(sock, chatId, message) {
    return toggleCommand(sock, chatId, message, autorecordTypingPath, 'Auto-recordTyping');
}

// Presence functions
async function straightTypingPresence(sock, chatId) {
    return straightPresence(sock, chatId, 'composing', autotypingPath);
}
async function straightRecordingPresence(sock, chatId) {
    return straightPresence(sock, chatId, 'recording', autorecordingPath);
}
async function straightRecordTypingPresence(sock, chatId) {
    const config = initConfig(autorecordTypingPath);
    if (config.enabled) {
        try {
            await sock.presenceSubscribe(chatId);
            await sock.sendPresenceUpdate('recording', chatId);
            await sock.sendPresenceUpdate('composing', chatId);

            const duration = 15000;
            await new Promise(resolve => setTimeout(resolve, duration));

            await sock.sendPresenceUpdate('paused', chatId);
            return true;
        } catch (error) {
            console.error('❌ Error sending record+typing indicator:', error);
            return false;
        }
    }
    return false;
}

module.exports = {
    autotypingCommand,
    autorecordingCommand,
    autorecordTypingCommand,
    straightTypingPresence,
    straightRecordingPresence,
    straightRecordTypingPresence
};
