const fs = require('fs');
const path = require('path');
const { isSudo } = require('../lib/index');

// Paths
const DATA_DIR = path.join(__dirname, '..', 'data');
const PREFIX_FILE = path.join(DATA_DIR, 'prefix.json');

// Constants
const DEFAULT_PREFIX = '.';
const NO_PREFIX = 'none';

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize prefix file if missing
if (!fs.existsSync(PREFIX_FILE)) {
    fs.writeFileSync(PREFIX_FILE, JSON.stringify({ prefix: DEFAULT_PREFIX }, null, 2));
}

/**
 * Safely read prefix file
 * @returns {object} Parsed prefix data
 */
function readPrefixFile() {
    try {
        return JSON.parse(fs.readFileSync(PREFIX_FILE, 'utf8'));
    } catch (error) {
        console.error('Error reading prefix file:', error);
        return { prefix: DEFAULT_PREFIX };
    }
}

/**
 * Get the current prefix (empty string if prefixless)
 */
function getPrefix() {
    const data = readPrefixFile();
    return data.prefix === NO_PREFIX ? '' : (data.prefix || DEFAULT_PREFIX);
}

/**
 * Get raw prefix value from storage
 */
function getRawPrefix() {
    const data = readPrefixFile();
    return data.prefix || DEFAULT_PREFIX;
}

/**
 * Set new prefix
 * @param {string} newPrefix
 * @returns {boolean} Success status
 */
function setPrefix(newPrefix) {
    try {
        let data;
        if (newPrefix === '') {
            data = { prefix: NO_PREFIX };
        } else if (newPrefix && newPrefix.length <= 3) {
            data = { prefix: newPrefix };
        } else {
            return false;
        }
        fs.writeFileSync(PREFIX_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error setting prefix:', error);
        return false;
    }
}

/**
 * Reset prefix to default
 */
function resetPrefix() {
    try {
        fs.writeFileSync(PREFIX_FILE, JSON.stringify({ prefix: DEFAULT_PREFIX }, null, 2));
        return true;
    } catch (error) {
        console.error('Error resetting prefix:', error);
        return false;
    }
}

/**
 * Check if bot is running in prefixless mode
 */
function isPrefixless() {
    return getRawPrefix() === NO_PREFIX;
}

/**
 * Handle setprefix command
 */
async function handleSetPrefixCommand(sock, chatId, senderId, message, userMessage) {
    try {
        const args = userMessage.trim().split(/\s+/).slice(1);
        const newPrefix = args[0];

        // Authorization check
        if (!message.key?.fromMe && !(await isSudo(senderId))) {
            await sock.sendMessage(chatId, { 
                text: '❌ Only bot owner can change the prefix!'
            }, { quoted: message });
            return;
        }

        // Show current prefix if no argument
        if (!newPrefix) {
            const current = getRawPrefix();
            const displayPrefix = current === NO_PREFIX ? 'None (prefixless)' : `"${current}"`;
            const commandExample = current === NO_PREFIX ? 'setprefix' : `${current}setprefix`;

            await sock.sendMessage(chatId, { 
                text: `👑 *Current Prefix Settings*\n\n` +
                      `📌 Current prefix: *${displayPrefix}*\n\n` +
                      `*Usage:*\n` +
                      `• ${commandExample} <new_prefix|none|reset>\n\n` +
                      `*Examples:*\n` +
                      `• ${commandExample} !\n` +
                      `• ${commandExample} none (for prefixless mode)\n` +
                      `• ${commandExample} reset`
            }, { quoted: message });
            return;
        }

        // Handle reset
        if (newPrefix.toLowerCase() === 'reset') {
            if (resetPrefix()) {
                await sock.sendMessage(chatId, { 
                    text: `✅ Prefix reset to default: *"${DEFAULT_PREFIX}"*`
                }, { quoted: message });
            } else {
                await sock.sendMessage(chatId, { text: '❌ Failed to reset prefix!' }, { quoted: message });
            }
            return;
        }

        // Handle prefixless
        if (newPrefix.toLowerCase() === NO_PREFIX) {
            if (setPrefix('')) {
                await sock.sendMessage(chatId, { 
                    text: '✅ Bot set to *prefixless mode* successfully!\n\n' +
                          'Now you can use commands without any prefix.'
                }, { quoted: message });
            } else {
                await sock.sendMessage(chatId, { text: '❌ Failed to set prefixless mode!' }, { quoted: message });
            }
            return;
        }

        // Validate length
        if (newPrefix.length > 3) {
            await sock.sendMessage(chatId, { 
                text: '❌ Prefix must be 1-3 characters long!\nUse "none" for prefixless mode.'
            }, { quoted: message });
            return;
        }

        // Set new prefix
        if (setPrefix(newPrefix)) {
            await sock.sendMessage(chatId, { 
                text: `✅ Prefix successfully set to: *"${newPrefix}"*\n\n` +
                      `Now use ${newPrefix}help to see available commands.`
            }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { text: '❌ Failed to set prefix!' }, { quoted: message });
        }
    } catch (error) {
        console.error('Error in handleSetPrefixCommand:', error);
        await sock.sendMessage(chatId, { text: '❌ An error occurred while processing the command.' }, { quoted: message });
    }
}

module.exports = {
    getPrefix,
    getRawPrefix,
    setPrefix,
    resetPrefix,
    isPrefixless,
    handleSetPrefixCommand,
    DEFAULT_PREFIX,
    NO_PREFIX
};
