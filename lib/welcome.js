// welcomeGoodbye.js
const fs = require('fs');
const path = require('path');

// Ensure data directory exists
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Path to JSON storage
const settingsFile = path.join(dataDir, 'welcomeGoodbye.json');

// --- JSON helpers ---
function loadSettings() {
    if (!fs.existsSync(settingsFile)) return {};
    try {
        return JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    } catch {
        return {};
    }
}

function saveSettings(settings) {
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
}

// --- Welcome functions ---
async function addWelcome(groupId, enabled, message) {
    const settings = loadSettings();
    if (!settings[groupId]) settings[groupId] = {};
    settings[groupId].welcomeEnabled = enabled;
    settings[groupId].welcomeMessage = message;
    saveSettings(settings);
}

async function delWelcome(groupId) {
    const settings = loadSettings();
    if (settings[groupId]) {
        settings[groupId].welcomeEnabled = false;
        delete settings[groupId].welcomeMessage;
        saveSettings(settings);
    }
}

async function isWelcomeOn(groupId) {
    const settings = loadSettings();
    return settings[groupId]?.welcomeEnabled || false;
}

// --- Goodbye functions ---
async function addGoodbye(groupId, enabled, message) {
    const settings = loadSettings();
    if (!settings[groupId]) settings[groupId] = {};
    settings[groupId].goodbyeEnabled = enabled;
    settings[groupId].goodbyeMessage = message;
    saveSettings(settings);
}

async function delGoodBye(groupId) {
    const settings = loadSettings();
    if (settings[groupId]) {
        settings[groupId].goodbyeEnabled = false;
        delete settings[groupId].goodbyeMessage;
        saveSettings(settings);
    }
}

async function isGoodByeOn(groupId) {
    const settings = loadSettings();
    return settings[groupId]?.goodbyeEnabled || false;
}

// --- Command Handlers ---
async function handleWelcome(sock, chatId, message, match) {
    if (!match) {
        return sock.sendMessage(chatId, {
            text: `📥 *Welcome Message Setup*\n
✅ *.welcome on* — Enable welcome messages
🛠️ *.welcome set [your message]* — Set a custom welcome message
🚫 *.welcome off* — Disable welcome messages

*Available Variables:*
• {user} - Mentions the new member
• {group} - Shows group name
• {description} - Shows group description`
        }, { quoted: message });
    }

    const [command, ...args] = match.trim().split(' ');
    const customMessage = args.join(' ');

    switch (command.toLowerCase()) {
        case 'on':
            if (await isWelcomeOn(chatId)) {
                return sock.sendMessage(chatId, { text: '⚠️ Welcome messages are already enabled.' }, { quoted: message });
            }
            await addWelcome(chatId, true, 'Welcome {user} to {group}! 🎉');
            return sock.sendMessage(chatId, { text: '✅ Welcome messages enabled. Use *.welcome set [message]* to customize.' }, { quoted: message });

        case 'off':
            if (!(await isWelcomeOn(chatId))) {
                return sock.sendMessage(chatId, { text: '⚠️ Welcome messages are already disabled.' }, { quoted: message });
            }
            await delWelcome(chatId);
            return sock.sendMessage(chatId, { text: '✅ Welcome messages disabled for this group.' }, { quoted: message });

        case 'set':
            if (!customMessage) {
                return sock.sendMessage(chatId, { text: '⚠️ Provide a custom welcome message. Example: *.welcome set Welcome to the group!*' }, { quoted: message });
            }
            await addWelcome(chatId, true, customMessage);
            return sock.sendMessage(chatId, { text: '✅ Custom welcome message set successfully.' }, { quoted: message });

        default:
            return sock.sendMessage(chatId, { 
                text: `❌ Invalid command. Use:\n*.welcome on* - Enable\n*.welcome set [message]* - Set custom message\n*.welcome off* - Disable` 
            }, { quoted: message });
    }
}

async function handleGoodbye(sock, chatId, message, match) {
    if (!match) {
        return sock.sendMessage(chatId, {
            text: `📤 *Goodbye Message Setup*\n
*.goodbye on* — Enable goodbye messages
*.goodbye set [your message]* — Set a custom goodbye message
*.goodbye off* — Disable goodbye messages

*Available Variables:*
{user} - Mentions the leaving member
{group} - Shows group name`
        }, { quoted: message });
    }

    const [command, ...args] = match.trim().split(' ');
    const customMessage = args.join(' ');

    switch (command.toLowerCase()) {
        case 'on':
            if (await isGoodByeOn(chatId)) {
                return sock.sendMessage(chatId, { text: '⚠️ Goodbye messages are already enabled.' }, { quoted: message });
            }
            await addGoodbye(chatId, true, 'Goodbye {user} 👋');
            return sock.sendMessage(chatId, { text: '✅ Goodbye messages enabled. Use *.goodbye set [message]* to customize.' }, { quoted: message });

        case 'off':
            if (!(await isGoodByeOn(chatId))) {
                return sock.sendMessage(chatId, { text: '⚠️ Goodbye messages are already disabled.' }, { quoted: message });
            }
            await delGoodBye(chatId);
            return sock.sendMessage(chatId, { text: '✅ Goodbye messages disabled for this group.' }, { quoted: message });

        case 'set':
            if (!customMessage) {
                return sock.sendMessage(chatId, { text: '⚠️ Provide a custom goodbye message. Example: *.goodbye set Goodbye!*' }, { quoted: message });
            }
            await addGoodbye(chatId, true, customMessage);
            return sock.sendMessage(chatId, { text: '✅ Custom goodbye message set successfully.' }, { quoted: message });

        default:
            return sock.sendMessage(chatId, { 
                text: `❌ Invalid command. Use:\n*.goodbye on* - Enable\n*.goodbye set [message]* - Set custom message\n*.goodbye off* - Disable` 
            }, { quoted: message });
    }
}

async function getWelcome(groupId) {
    const settings = loadSettings();
    return settings[groupId]?.welcomeMessage || null;
}

async function getGoodbye(groupId) {
    const settings = loadSettings();
    return settings[groupId]?.goodbyeMessage || null;
}

module.exports = { handleWelcome, handleGoodbye, addWelcome, delWelcome, isWelcomeOn, addGoodbye, delGoodBye, isGoodByeOn, getWelcome, getGoodbye };
