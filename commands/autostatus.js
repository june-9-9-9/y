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

// Initialize config file if it doesn't exist with better defaults
function initializeConfig() {
    const defaultConfig = { 
        enabled: false, 
        reactOn: false,
        reactionEmoji: '🖤', 
        randomReactions: true,
        lastUpdated: new Date().toISOString()
    };
    
    if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
        return defaultConfig;
    }
    
    // Check if existing config has all required fields
    try {
        const existing = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const mergedConfig = { ...defaultConfig, ...existing };
        if (JSON.stringify(existing) !== JSON.stringify(mergedConfig)) {
            fs.writeFileSync(configPath, JSON.stringify(mergedConfig, null, 2));
        }
        return mergedConfig;
    } catch {
        fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
        return defaultConfig;
    }
}

// Initialize on load
initializeConfig();

// Read config safely with caching
let configCache = null;
let lastConfigRead = 0;
const CONFIG_CACHE_TTL = 2000; // 2 seconds cache

function readConfig(force = false) {
    const now = Date.now();
    
    // Return cached config if within TTL and not forced
    if (configCache && !force && (now - lastConfigRead) < CONFIG_CACHE_TTL) {
        return { ...configCache };
    }
    
    try {
        if (!fs.existsSync(configPath)) {
            return initializeConfig();
        }
        
        const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        
        // Ensure all required fields exist
        const completeConfig = {
            enabled: configData.enabled !== undefined ? configData.enabled : false,
            reactOn: configData.reactOn !== undefined ? configData.reactOn : false,
            reactionEmoji: configData.reactionEmoji || '🖤',
            randomReactions: configData.randomReactions !== undefined ? configData.randomReactions : true,
            lastUpdated: configData.lastUpdated || new Date().toISOString()
        };
        
        // Update cache
        configCache = { ...completeConfig };
        lastConfigRead = now;
        
        return completeConfig;
    } catch (error) {
        console.error('Config read error:', error.message);
        return initializeConfig();
    }
}

// Write config safely with validation
function writeConfig(newConfig) {
    try {
        // Validate config structure
        const validatedConfig = {
            enabled: !!newConfig.enabled,
            reactOn: !!newConfig.reactOn,
            reactionEmoji: newConfig.reactionEmoji || '🖤',
            randomReactions: !!newConfig.randomReactions,
            lastUpdated: new Date().toISOString()
        };
        
        // Validate emoji format
        if (validatedConfig.reactionEmoji && !/\p{Emoji}/u.test(validatedConfig.reactionEmoji)) {
            validatedConfig.reactionEmoji = '🖤';
        }
        
        fs.writeFileSync(configPath, JSON.stringify(validatedConfig, null, 2));
        
        // Update cache
        configCache = { ...validatedConfig };
        lastConfigRead = Date.now();
        
        return true;
    } catch (error) {
        console.error('Config write error:', error.message);
        return false;
    }
}

// Safe random emoji
function getRandomEmoji() {
    try {
        const emoji = randomEmojis[Math.floor(Math.random() * randomEmojis.length)];
        return emoji || '🖤';
    } catch {
        return '🖤';
    }
}

// Safe reaction emoji with caching
let emojiCache = null;
let lastEmojiCheck = 0;

function getReactionEmoji() {
    const now = Date.now();
    
    // Use cache if recent
    if (emojiCache && (now - lastEmojiCheck) < 5000) {
        return emojiCache;
    }
    
    try {
        const config = readConfig();
        let emoji;
        
        if (config.randomReactions) {
            emoji = getRandomEmoji();
        } else {
            emoji = config.reactionEmoji || '🖤';
            // Validate emoji
            if (!/\p{Emoji}/u.test(emoji)) {
                emoji = '🖤';
            }
        }
        
        // Update cache
        emojiCache = emoji;
        lastEmojiCheck = now;
        
        return emoji;
    } catch (error) {
        console.error('Emoji error:', error.message);
        return '🖤';
    }
}

// Clear cache when config changes
function clearCaches() {
    configCache = null;
    emojiCache = null;
    lastConfigRead = 0;
    lastEmojiCheck = 0;
}

async function autoStatusCommand(sock, chatId, msg, args) {
    try {
        const { isSudo } = require('../lib/index');
        const senderId = msg.key.participant || msg.key.remoteJid;
        const senderIsSudo = await isSudo(senderId);
        const isOwner = msg.key.fromMe || senderIsSudo;
        
        if (!isOwner) {
            await sock.sendMessage(chatId, { 
                text: '❌ This command can only be used by the owner!', 
                ...channelInfo 
            }, { quoted: msg });
            return;
        }

        let config = readConfig(true); // Force fresh read

        if (!args || args.length === 0) {
            const status = config.enabled ? '✅ *Enabled*' : '❌ *Disabled*';
            const reactStatus = config.reactOn ? '✅ *Enabled*' : '❌ *Disabled*';
            const currentEmoji = config.reactionEmoji || '🖤';
            const randomStatus = config.randomReactions ? '✅ *Enabled*' : '❌ *Disabled*';
            
            await sock.sendMessage(chatId, { 
                text: `⚙️ *Auto Status Settings*\n\n` +
                      `• Auto View: ${status}\n` +
                      `• Reactions: ${reactStatus}\n` +
                      `• Fixed Emoji: ${currentEmoji}\n` +
                      `• Random Mode: ${randomStatus}\n\n` +
                      `📝 *Commands:*\n` +
                      `• \`.autostatus on/off\` - Toggle auto-view\n` +
                      `• \`.autostatus react on/off\` - Toggle reactions\n` +
                      `• \`.autostatus emoji <emoji>\` - Set fixed emoji\n` +
                      `• \`.autostatus random on/off\` - Toggle random mode\n` +
                      `• \`.autostatus reset\` - Reset to defaults`,
                ...channelInfo
            }, { quoted: msg });
            return;
        }

        const command = args[0].toLowerCase();
        let success = false;
        let response = '';
        
        switch (command) {
            case 'on':
            case 'enable':
                config.enabled = true;
                success = writeConfig(config);
                response = success ? '✅ *Auto status viewing enabled!*\nBot will now automatically view status updates.' : '❌ Failed to update configuration';
                break;
                
            case 'off':
            case 'disable':
                config.enabled = false;
                success = writeConfig(config);
                response = success ? '❌ *Auto status viewing disabled!*\nBot will no longer view status updates.' : '❌ Failed to update configuration';
                break;
                
            case 'react':
                if (!args[1]) {
                    await sock.sendMessage(chatId, { 
                        text: '❌ Please specify: `.autostatus react on/off`', 
                        ...channelInfo 
                    }, { quoted: msg });
                    return;
                }
                const reactAction = args[1].toLowerCase();
                config.reactOn = reactAction === 'on' || reactAction === 'enable';
                success = writeConfig(config);
                
                if (success) {
                    const emojiMode = config.randomReactions ? 'random emojis' : config.reactionEmoji;
                    if (config.reactOn) {
                        response = `💫 *Status reactions enabled!*\nUsing: ${emojiMode}`;
                    } else {
                        response = '❌ *Status reactions disabled!';
                    }
                } else {
                    response = '❌ Failed to update configuration';
                }
                break;
                
            case 'emoji':
                if (!args[1]) {
                    await sock.sendMessage(chatId, { 
                        text: '❌ Please provide an emoji!\nExample: `.autostatus emoji 🎉`', 
                        ...channelInfo 
                    }, { quoted: msg });
                    return;
                }
                const newEmoji = args[1].trim();
                
                // More flexible emoji validation
                if (newEmoji.length > 6 || !/\p{Emoji}/u.test(newEmoji)) {
                    await sock.sendMessage(chatId, { 
                        text: '❌ Invalid emoji! Please provide a single emoji character.', 
                        ...channelInfo 
                    }, { quoted: msg });
                    return;
                }
                
                config.reactionEmoji = newEmoji;
                // Auto-disable random mode when setting a specific emoji
                config.randomReactions = false;
                success = writeConfig(config);
                response = success ? `✅ *Emoji set to:* ${newEmoji}\n✨ Random mode automatically disabled.` : '❌ Failed to update configuration';
                break;
                
            case 'random':
                if (!args[1]) {
                    await sock.sendMessage(chatId, { 
                        text: '❌ Please specify: `.autostatus random on/off`', 
                        ...channelInfo 
                    }, { quoted: msg });
                    return;
                }
                const randomAction = args[1].toLowerCase();
                config.randomReactions = randomAction === 'on' || randomAction === 'enable';
                success = writeConfig(config);
                
                if (success) {
                    if (config.randomReactions) {
                        response = '🎲 *Random reactions enabled!*\nBot will use random emojis for each reaction.';
                    } else {
                        const fixedEmoji = config.reactionEmoji || '🖤';
                        response = `🎲 *Random reactions disabled!*\nFixed emoji: ${fixedEmoji}`;
                    }
                } else {
                    response = '❌ Failed to update configuration';
                }
                break;
                
            case 'reset':
                const defaultConfig = { 
                    enabled: false, 
                    reactOn: false, 
                    reactionEmoji: '🖤', 
                    randomReactions: true 
                };
                success = writeConfig(defaultConfig);
                response = success ? '🔄 *Reset to default settings!*' : '❌ Failed to reset configuration';
                break;
                
            default:
                response = '❌ Invalid command. Use `.autostatus` without arguments to see all options.';
                break;
        }
        
        // Clear caches for fresh read next time
        if (success) {
            clearCaches();
        }
        
        await sock.sendMessage(chatId, { 
            text: response, 
            ...channelInfo 
        }, { quoted: msg });
        
    } catch (error) {
        console.error('Command error:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Error: ' + error.message, 
            ...channelInfo 
        }, { quoted: msg });
    }
}

// Helper functions with caching
function isAutoStatusEnabled() { 
    const config = readConfig();
    return config.enabled; 
}

function isStatusReactionEnabled() { 
    const config = readConfig();
    return config.reactOn && config.enabled; // Only react if auto-status is also enabled
}

function isRandomReactionsEnabled() { 
    const config = readConfig();
    return config.randomReactions; 
}

// Improved reaction function with better error handling
async function reactToStatus(sock, statusKey) {
    try {
        if (!isStatusReactionEnabled()) return false;
        
        const emoji = getReactionEmoji();
        if (!emoji) return false;
        
        // Add small random delay to avoid rate limits
        await new Promise(r => setTimeout(r, Math.random() * 500 + 200));
        
        await sock.relayMessage('status@broadcast', {
            reactionMessage: {
                key: { 
                    remoteJid: 'status@broadcast', 
                    id: statusKey.id, 
                    participant: statusKey.participant || statusKey.remoteJid, 
                    fromMe: false 
                },
                text: emoji
            }
        }, { 
            messageId: statusKey.id, 
            statusJidList: [statusKey.remoteJid, statusKey.participant || statusKey.remoteJid] 
        });
        
        return true;
    } catch (error) { 
        console.error('❌ Reaction error:', error.message);
        return false;
    }
}

// Main status update handler with improved logic
async function handleStatusUpdate(sock, status) {
    try {
        if (!isAutoStatusEnabled()) return;
        
        // Find status key with multiple fallbacks
        let statusKey = status.messages?.[0]?.key || 
                       status.key || 
                       status.reaction?.key ||
                       status.update?.key;
        
        if (!statusKey) return;
        
        // Ensure it's a status update
        if (statusKey.remoteJid !== 'status@broadcast') return;
        
        // Add configurable delay before action
        await new Promise(r => setTimeout(r, 1000));
        
        // Mark as read
        try {
            await sock.readMessages([statusKey]);
        } catch (readError) {
            if (readError.message?.includes('rate-overlimit')) {
                // Wait longer on rate limit
                await new Promise(r => setTimeout(r, 3000));
                await sock.readMessages([statusKey]);
            }
        }
        
        // React if enabled
        await reactToStatus(sock, statusKey);
        
    } catch (error) { 
        console.error('❌ Status update error:', error.message);
    }
}

module.exports = {
    autoStatusCommand,
    handleStatusUpdate,
    isAutoStatusEnabled,
    isStatusReactionEnabled,
    getReactionEmoji,
    isRandomReactionsEnabled,
    getRandomEmoji,
    clearCaches, // Export for manual cache clearing if needed
    readConfig, // For debugging
    writeConfig // For debugging
};
