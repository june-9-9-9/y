const fs = require('fs');
const path = require('path');
const isAdmin = require('../lib/isAdmin');

const dataDir = path.join(__dirname, '..', 'data');
const configPath = path.join(dataDir, 'antigroupmention.json');

function createFakeContact(message) {
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "0@s.whatsapp.net",
            fromMe: false
        },
        message: {
            contactMessage: {
                displayName: "JUNE OFFICIAL",
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:KOLOLI\nitem1.TEL;waid=${message?.key?.participant?.split('@')[0] || message?.key?.remoteJid?.split('@')[0] || '0'}:${message?.key?.participant?.split('@')[0] || message?.key?.remoteJid?.split('@')[0] || '0'}\nitem1.X-ABLabel:Phone\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

function initConfig() {
    try {
        // Create data directory if it doesn't exist
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
            console.log(`📁 Created data directory: ${dataDir}`);
        }

        // Create config file if it doesn't exist
        if (!fs.existsSync(configPath)) {
            const defaultConfig = {};
            fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
            console.log(`📄 Created config file: ${configPath}`);
            return defaultConfig;
        }

        // Read existing config
        const configData = fs.readFileSync(configPath, 'utf8');
        
        // If file exists but is empty, initialize with default config
        if (!configData.trim()) {
            const defaultConfig = {};
            fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
            return defaultConfig;
        }
        
        return JSON.parse(configData);
    } catch (error) {
        console.error('Error initializing config:', error);
        
        // If reading fails, create a fresh config
        const defaultConfig = {};
        fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
        return defaultConfig;
    }
}

function saveConfig(config) {
    try {
        // Ensure data directory exists
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch (error) {
        console.error('Error saving config:', error);
        // Try to create file if it doesn't exist
        const defaultConfig = config || {};
        fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    }
}

function getGroupConfig(chatId) {
    const config = initConfig(); // This will auto-create if needed
    return config[chatId] || { enabled: false, action: 'delete' };
}

function setGroupConfig(chatId, groupConfig) {
    const config = initConfig(); // This will auto-create if needed
    config[chatId] = groupConfig;
    saveConfig(config);
}

async function antigroupmentionCommand(sock, chatId, message, senderId) {
    try {
        const fake = createFakeContact(message);
        const isSenderAdmin = await isAdmin(sock, chatId, senderId);

        if (!isSenderAdmin) {
            await sock.sendMessage(chatId, { text: '❌ For Group Admins Only' }, { quoted: fake });
            return;
        }

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const args = text.trim().split(' ').slice(1);
        const action = args[0]?.toLowerCase();

        const groupConfig = getGroupConfig(chatId);

        if (!action) {
            const usage = `👥 *ANTIGROUPMENTION SETUP*\n\n.antigroupmention on\n.antigroupmention set delete | kick | warn\n.antigroupmention off\n.antigroupmention get\n.antigroupmention reset`;
            await sock.sendMessage(chatId, { text: usage }, { quoted: fake });
            return;
        }

        switch (action) {
            case 'on':
                groupConfig.enabled = true;
                setGroupConfig(chatId, groupConfig);
                await sock.sendMessage(chatId, { text: '👥 Antigroupmention has been turned ON - Blocking group mentions...' }, { quoted: fake });
                break;

            case 'off':
                groupConfig.enabled = false;
                setGroupConfig(chatId, groupConfig);
                await sock.sendMessage(chatId, { text: '👥 Antigroupmention has been turned OFF' }, { quoted: fake });
                break;

            case 'set':
                const setAction = args[1]?.toLowerCase();
                if (!['delete', 'kick', 'warn'].includes(setAction)) {
                    await sock.sendMessage(chatId, { text: '❌ Invalid action. Choose delete, kick, or warn.' }, { quoted: fake });
                    return;
                }
                groupConfig.action = setAction;
                groupConfig.enabled = true;
                setGroupConfig(chatId, groupConfig);
                await sock.sendMessage(chatId, { text: `👥 Antigroupmention action set to ${setAction}` }, { quoted: message });
                break;

            case 'get':
                const statusText = `👥 *Antigroupmention Configuration*\nStatus: ${groupConfig.enabled ? 'ON' : 'OFF'}\nAction: ${groupConfig.action || 'delete'}\nConfig Path: data/antigroupmention.json`;
                await sock.sendMessage(chatId, { text: statusText }, { quoted: fake });
                break;

            case 'reset':
                const config = initConfig();
                if (config[chatId]) {
                    delete config[chatId];
                    saveConfig(config);
                    await sock.sendMessage(chatId, { text: '👥 Antigroupmention configuration reset to default' }, { quoted: fake });
                } else {
                    await sock.sendMessage(chatId, { text: '👥 No configuration found for this group' }, { quoted: fake });
                }
                break;

            default:
                await sock.sendMessage(chatId, { text: '❌ Invalid command. Use .antigroupmention on/off/set/get/reset' }, { quoted: message });
        }
    } catch (error) {
        console.error('Error in antigroupmention command:', error);
    }
}

async function handleGroupMentionDetection(sock, chatId, message, senderId) {
    try {
        // Initialize config on first use (will auto-create if needed)
        const groupConfig = getGroupConfig(chatId);
        if (!groupConfig.enabled) return;

        const text = message.message?.conversation || 
                    message.message?.extendedTextMessage?.text || '';

        const hasTagAll = text.includes('@everyone') || text.includes('@all');
        if (!hasTagAll) return;

        const senderIsAdmin = await isAdmin(sock, chatId, senderId);
        if (senderIsAdmin) return;

        const quotedMessageId = message.key.id;
        const quotedParticipant = message.key.participant || senderId;

        try {
            switch (groupConfig.action) {
                case 'delete':
                    await sock.sendMessage(chatId, {
                        delete: { remoteJid: chatId, fromMe: false, id: quotedMessageId, participant: quotedParticipant }
                    });
                    break;

                case 'warn':
                    const fake = createFakeContact(message);
                    await sock.sendMessage(chatId, {
                        text: `⚠️ Warning! @${senderId.split('@')[0]}, using @everyone/@all is not allowed here.`,
                        mentions: [senderId]
                    }, { quoted: fake });
                    break;

                case 'kick':
                    await sock.sendMessage(chatId, {
                        delete: { remoteJid: chatId, fromMe: false, id: quotedMessageId, participant: quotedParticipant }
                    });
                    await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
                    break;
            }
        } catch (error) {
            console.error('Failed to enforce antigroupmention action:', error);
        }
    } catch (error) {
        console.error('Error in group mention detection:', error);
    }
}

// Auto-initialize on module load
console.log('📁 Initializing antigroupmention configuration...');
initConfig();

module.exports = {
    antigroupmentionCommand,
    handleGroupMentionDetection
};
