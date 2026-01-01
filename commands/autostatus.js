const fs = require('fs');
const path = require('path');

const channelInfo = {
    contextInfo: {
        forwardingScore: 1,
        isForwarded: false,
        forwardedNewsletterMessageInfo: {
            newsletterJid: '',
            newsletterName: '',
            serverMessageId: -1
        }
    }
};

// Array of random emojis for reactions
const randomEmojis = ['❤️', '❄️', '💕', '🎁', '💙', '💘', '🔥', '⭐', '🎉', '🙏', '💚', '🌟', '💗', '🤍', '🖤', '❣️', '💝', '💛', '💫', '💓'];

// Path to store auto status configuration
const configPath = path.join(__dirname, '../data/autoStatus.json');

// Initialize config file if it doesn't exist
if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify({ 
        enabled: false, 
        reactOn: false,
        reactionEmoji: '🖤', 
        randomReactions: true 
    }, null, 2));
}

// Read config safely
function readConfig() {
    try {
        if (!fs.existsSync(configPath)) {
            const defaultConfig = { enabled: false, reactOn: false, reactionEmoji: '🖤', randomReactions: true };
            fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
            return defaultConfig;
        }
        return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch {
        return { enabled: false, reactOn: false, reactionEmoji: '🖤', randomReactions: true };
    }
}

// Write config safely
function writeConfig(config) {
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        return true;
    } catch {
        return false;
    }
}

// Safe random emoji
function getRandomEmoji() {
    const emoji = randomEmojis[Math.floor(Math.random() * randomEmojis.length)];
    return emoji || '🖤';
}

// Safe reaction emoji
function getReactionEmoji() {
    try {
        const config = readConfig();
        if (config.randomReactions) return getRandomEmoji();
        if (config.reactionEmoji && /\p{Emoji}/u.test(config.reactionEmoji)) return config.reactionEmoji;
        return '🖤';
    } catch {
        return '🖤';
    }
}

async function autoStatusCommand(sock, chatId, msg, args) {
    try {
        const { isSudo } = require('../lib/index');
        const senderId = msg.key.participant || msg.key.remoteJid;
        const senderIsSudo = await isSudo(senderId);
        const isOwner = msg.key.fromMe || senderIsSudo;
        
        if (!isOwner) {
            await sock.sendMessage(chatId, { text: '❌ This command can only be used by the owner!', ...channelInfo }, { quoted: msg });
            return;
        }

        let config = readConfig();

        if (!args || args.length === 0) {
            const status = config.enabled ? '✅ Enabled' : '❌ Disabled';
            const reactStatus = config.reactOn ? '✅ Enabled' : '❌ Disabled';
            const currentEmoji = config.reactionEmoji || '🖤';
            const randomStatus = config.randomReactions ? '✅ Enabled' : '❌ Disabled';
            await sock.sendMessage(chatId, { 
                text: `*  🄹 🅄 🄽 🄴   🅇 Settings*\n\n✦ *Auto Status View:* ${status}\n↘️ *Status Reactions:* ${reactStatus}\n✦ *Reaction Emoji:* ${currentEmoji}\n✦ *Random Reactions:* ${randomStatus}\n\n🔙 *Commands:*\n✦ autostatus on/off\n✦ autostatus react on/off\n✦ autostatus emoji <emoji>\n✦ autostatus random on/off\n✦ autostatus reset`,
                ...channelInfo
            }, { quoted: msg });
            return;
        }

        const command = args[0].toLowerCase();
        
        if (command === 'on') { config.enabled = true; writeConfig(config); await sock.sendMessage(chatId, { text: '✅ Auto status enabled!', ...channelInfo }, { quoted: msg }); }
        else if (command === 'off') { config.enabled = false; writeConfig(config); await sock.sendMessage(chatId, { text: '❌ Auto status disabled!', ...channelInfo }, { quoted: msg }); }
        else if (command === 'react') {
            if (!args[1]) { await sock.sendMessage(chatId, { text: '❌ Use: .autostatus react on/off', ...channelInfo }, { quoted: msg }); return; }
            const reactCommand = args[1].toLowerCase();
            if (reactCommand === 'on') { config.reactOn = true; writeConfig(config); await sock.sendMessage(chatId, { text: `💫 Reactions enabled! Using ${config.randomReactions ? 'random emojis' : config.reactionEmoji || '🖤'}`, ...channelInfo }, { quoted: msg }); }
            else if (reactCommand === 'off') { config.reactOn = false; writeConfig(config); await sock.sendMessage(chatId, { text: '❌ Reactions disabled!', ...channelInfo }, { quoted: msg }); }
        }
        else if (command === 'emoji') {
            if (!args[1]) { await sock.sendMessage(chatId, { text: '❌ Provide an emoji!\nExample: .autostatus emoji 🎉', ...channelInfo }, { quoted: msg }); return; }
            const newEmoji = args[1].trim();
            if (newEmoji.length > 4 || !/\p{Emoji}/u.test(newEmoji)) { await sock.sendMessage(chatId, { text: '❌ Invalid emoji!', ...channelInfo }, { quoted: msg }); return; }
            config.reactionEmoji = newEmoji; writeConfig(config);
            await sock.sendMessage(chatId, { text: `✅ Emoji set to ${newEmoji}`, ...channelInfo }, { quoted: msg });
        }
        else if (command === 'random') {
            if (!args[1]) { await sock.sendMessage(chatId, { text: '❌ Use: .autostatus random on/off', ...channelInfo }, { quoted: msg }); return; }
            const randomCommand = args[1].toLowerCase();
            config.randomReactions = randomCommand === 'on'; writeConfig(config);
            await sock.sendMessage(chatId, { text: config.randomReactions ? '🎲 Random reactions enabled!' : `🎲 Random reactions disabled! Fixed emoji: ${config.reactionEmoji || '🖤'}`, ...channelInfo }, { quoted: msg });
        }
        else if (command === 'reset') {
            const defaultConfig = { enabled: false, reactOn: false, reactionEmoji: '🖤', randomReactions: true };
            writeConfig(defaultConfig);
            await sock.sendMessage(chatId, { text: '🔄 Reset to defaults!', ...channelInfo }, { quoted: msg });
        }
    } catch (error) {
        await sock.sendMessage(chatId, { text: '❌ Error: ' + error.message, ...channelInfo }, { quoted: msg });
    }
}

function isAutoStatusEnabled() { return readConfig().enabled; }
function isStatusReactionEnabled() { return readConfig().reactOn; }
function isRandomReactionsEnabled() { return readConfig().randomReactions !== false; }

async function reactToStatus(sock, statusKey) {
    try {
        if (!isStatusReactionEnabled()) return;
        const emoji = getReactionEmoji();
        if (!emoji) return;
        await sock.relayMessage('status@broadcast', {
            reactionMessage: {
                key: { remoteJid: 'status@broadcast', id: statusKey.id, participant: statusKey.participant || statusKey.remoteJid, fromMe: false },
                text: emoji
            }
        }, { messageId: statusKey.id, statusJidList: [statusKey.remoteJid, statusKey.participant || statusKey.remoteJid] });
    } catch (error) { console.error('❌ Reaction error:', error.message); }
}

async function handleStatusUpdate(sock, status) {
    try {
        if (!isAutoStatusEnabled()) return;
        await new Promise(r => setTimeout(r, 1000));
        let statusKey = status.messages?.[0]?.key || status.key || status.reaction?.key;
        if (statusKey && statusKey.remoteJid === 'status@broadcast') {
            try {
                await sock.readMessages([statusKey]);
                await reactToStatus(sock, statusKey);
            } catch (err) {
                if (err.message?.includes('rate-overlimit')) {
                    await new Promise(r => setTimeout(r, 2000));
                    await sock.readMessages([statusKey]);
                }
            }
        }
    } catch (error) { console.error('❌ Status update error:', error.message); }
}

module.exports = {
    autoStatusCommand,
    handleStatusUpdate,
    isAutoStatusEnabled,
    isStatusReactionEnabled,
    getReactionEmoji,
    isRandomReactionsEnabled,
    getRandomEmoji
};
