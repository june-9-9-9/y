const fs = require('fs');
const path = require('path');
const isAdmin = require('../lib/isAdmin');

const dataDir = path.join(__dirname, '..', 'data');
const mentionConfigPath = path.join(dataDir, 'antigroupmention.json');

function createFakeContact(message) {
    return {
        key: { participants: "0@s.whatsapp.net", remoteJid: "0@s.whatsapp.net", fromMe: false },
        message: {
            contactMessage: {
                displayName: "JUNE OFFICIAL",
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:KOLOLI\nitem1.TEL;waid=${message?.key?.participant?.split('@')[0] || message?.key?.remoteJid?.split('@')[0] || '0'}:${message?.key?.participant?.split('@')[0] || message?.key?.remoteJid?.split('@')[0] || '0'}\nitem1.X-ABLabel:Phone\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

// Config management
function initConfig() {
    try {
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        if (!fs.existsSync(mentionConfigPath)) {
            const defaultConfig = {};
            fs.writeFileSync(mentionConfigPath, JSON.stringify(defaultConfig, null, 2));
            return defaultConfig;
        }
        const configData = fs.readFileSync(mentionConfigPath, 'utf8');
        if (!configData.trim()) {
            const defaultConfig = {};
            fs.writeFileSync(mentionConfigPath, JSON.stringify(defaultConfig, null, 2));
            return defaultConfig;
        }
        return JSON.parse(configData);
    } catch {
        const defaultConfig = {};
        fs.writeFileSync(mentionConfigPath, JSON.stringify(defaultConfig, null, 2));
        return defaultConfig;
    }
}
function saveConfig(config) {
    try {
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(mentionConfigPath, JSON.stringify(config, null, 2));
        return true;
    } catch { return false; }
}
function getGroupConfig(chatId) {
    const config = initConfig();
    return config[chatId] || { enabled: false, action: 'delete' };
}
function setGroupConfig(chatId, groupConfig) {
    const config = initConfig();
    config[chatId] = groupConfig;
    return saveConfig(config);
}
function removeGroupConfig(chatId) {
    const config = initConfig();
    if (config[chatId]) { delete config[chatId]; return saveConfig(config); }
    return true;
}
function getAllConfiguredGroups() {
    return Object.keys(initConfig());
}

// Command handler
async function antigroupmentionCommand(sock, chatId, message, senderId) {
    try {
        const fake = createFakeContact(message);
        const isSenderAdmin = await isAdmin(sock, chatId, senderId);
        if (!isSenderAdmin) {
            await sock.sendMessage(chatId, { text: '❌ Admins only.' }, { quoted: fake });
            return;
        }

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const args = text.trim().split(/\s+/);
        const action = args[1]?.toLowerCase();

        const groupConfig = getGroupConfig(chatId);

        if (!action) {
            await sock.sendMessage(chatId, { 
                text: `👥 ANTIGROUPMENTION\n
.on / .off
.set delete|kick|warn
.get / .reset / .stats`
            }, { quoted: fake });
            return;
        }

        switch (action) {
            case 'on':
                groupConfig.enabled = true;
                setGroupConfig(chatId, groupConfig);
                await sock.sendMessage(chatId, { text: '✅ Enabled. Non-admin mentions blocked.' }, { quoted: fake });
                break;
            case 'off':
                groupConfig.enabled = false;
                setGroupConfig(chatId, groupConfig);
                await sock.sendMessage(chatId, { text: '❌ Disabled.' }, { quoted: fake });
                break;
            case 'set':
                const setAction = args[2]?.toLowerCase();
                if (!['delete', 'kick', 'warn'].includes(setAction)) {
                    await sock.sendMessage(chatId, { text: '❌ Use: delete | kick | warn' }, { quoted: fake });
                    return;
                }
                groupConfig.action = setAction; groupConfig.enabled = true;
                setGroupConfig(chatId, groupConfig);
                await sock.sendMessage(chatId, { text: `✅ Action: ${setAction}` }, { quoted: message });
                break;
            case 'get':
                await sock.sendMessage(chatId, { text: `🔧 Config\nStatus: ${groupConfig.enabled ? '✅ ON' : '❌ OFF'}\nAction: ${groupConfig.action}` }, { quoted: fake });
                break;
            case 'reset':
                removeGroupConfig(chatId);
                await sock.sendMessage(chatId, { text: '🔄 Reset done.' }, { quoted: fake });
                break;
            case 'stats':
            case 'status':
                const allConfigs = initConfig();
                const totalGroups = Object.keys(allConfigs).length;
                const enabledGroups = Object.values(allConfigs).filter(c => c.enabled).length;
                await sock.sendMessage(chatId, { text: `📊 Stats\nTotal: ${totalGroups}\nActive: ${enabledGroups}\nDisabled: ${totalGroups - enabledGroups}` }, { quoted: fake });
                break;
            default:
                await sock.sendMessage(chatId, { text: '❌ Invalid command.' }, { quoted: message });
        }
    } catch (error) {
        console.error('Error in antigroupmention command:', error);
        await sock.sendMessage(chatId, { text: '❌ Error occurred.' }, { quoted: createFakeContact(message) });
    }
}

// Mention detection
async function handleGroupMentionDetection(sock, chatId, message, senderId) {
    try {
        if (message.key.fromMe) return;
        if (!chatId.endsWith('@g.us')) return;
        const groupConfig = getGroupConfig(chatId);
        if (!groupConfig.enabled) return;

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        if (!(text.includes('@everyone') || text.includes('@all'))) return;

        const senderIsAdmin = await isAdmin(sock, chatId, senderId);
        if (senderIsAdmin) return;

        const quotedMessageId = message.key.id;
        const quotedParticipant = message.key.participant || senderId;

        switch (groupConfig.action) {
            case 'delete':
                await sock.sendMessage(chatId, { delete: { remoteJid: chatId, fromMe: false, id: quotedMessageId, participant: quotedParticipant } });
                await sock.sendMessage(chatId, { text: `⚠️ @${senderId.split('@')[0]} deleted.`, mentions: [senderId] });
                break;
            case 'kick':
                await sock.sendMessage(chatId, { delete: { remoteJid: chatId, fromMe: false, id: quotedMessageId, participant: quotedParticipant } });
                await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
                await sock.sendMessage(chatId, { text: `🚫 @${senderId.split('@')[0]} kicked.`, mentions: [senderId] });
                break;
            case 'warn':
                await sock.sendMessage(chatId, { text: `⚠️ @${senderId.split('@')[0]} warned.`, mentions: [senderId] });
                break;
            default:
                await sock.sendMessage(chatId, { delete: { remoteJid: chatId, fromMe: false, id: quotedMessageId, participant: quotedParticipant } });
        }
    } catch (error) { console.error('Error in detection:', error); }
}

console.log('🔧 Initializing antigroupmention...');
initConfig();
console.log('✅ Ready');

module.exports = {
    antigroupmentionCommand,
    handleGroupMentionDetection,
    getGroupConfig,
    setGroupConfig,
    removeGroupConfig,
    getAllConfiguredGroups,
    createFakeContact,
    initConfig
};
