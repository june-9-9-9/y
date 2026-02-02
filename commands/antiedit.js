const fs = require('fs');
const path = require('path');

// Store for tracking processed edits
const processedEdits = new Map();
const EDIT_COOLDOWN = 5000; // 5 seconds cooldown

// Configuration
const CONFIG_PATH = path.join(__dirname, '../data/antiedit.json');
const TEMP_MEDIA_DIR = path.join(__dirname, '../tmp/antiedit');

const DEFAULT_CONFIG = {
    enabled: false,
    mode: 'off',
    notifyGroups: true,
    notifyPM: true,
    excludeGroups: [],
    excludeUsers: [],
    maxMessages: 1000,
    cleanupInterval: 60,
    autoCleanup: true,
    captureMedia: true,
    captureText: true,
    maxStorageMB: 200
};

let cleanupInterval = null;

// Initialize system
initializeSystem();

function initializeSystem() {
    ensureTempDir();
    startCleanupInterval();
}

function ensureTempDir() {
    try {
        if (!fs.existsSync(TEMP_MEDIA_DIR)) {
            fs.mkdirSync(TEMP_MEDIA_DIR, { recursive: true });
        }
    } catch (err) {
        console.error('[ANTIEDIT] Error creating temp directory:', err);
    }
}

async function getFolderSizeInMB(folderPath) {
    try {
        const files = await fs.promises.readdir(folderPath);
        let totalSize = 0;
        for (const file of files) {
            const filePath = path.join(folderPath, file);
            try {
                const stats = await fs.promises.stat(filePath);
                if (stats.isFile()) totalSize += stats.size;
            } catch {}
        }
        return totalSize / (1024 * 1024);
    } catch {
        return 0;
    }
}

async function cleanTempFolder() {
    try {
        const config = loadConfig();
        const sizeMB = await getFolderSizeInMB(TEMP_MEDIA_DIR);
        if (sizeMB > config.maxStorageMB) {
            const files = await fs.promises.readdir(TEMP_MEDIA_DIR);
            let deletedCount = 0;
            for (const file of files) {
                const filePath = path.join(TEMP_MEDIA_DIR, file);
                try {
                    await fs.promises.unlink(filePath);
                    deletedCount++;
                } catch {}
            }
            return deletedCount;
        }
        return 0;
    } catch {
        return 0;
    }
}

function loadConfig() {
    try {
        if (!fs.existsSync(CONFIG_PATH)) {
            saveConfig(DEFAULT_CONFIG);
            return DEFAULT_CONFIG;
        }
        const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        return { ...DEFAULT_CONFIG, ...config };
    } catch (error) {
        console.error('[ANTIEDIT] Error loading config:', error);
        return DEFAULT_CONFIG;
    }
}

function saveConfig(config) {
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
        return true;
    } catch (error) {
        console.error('[ANTIEDIT] Error saving config:', error);
        return false;
    }
}

function startCleanupInterval() {
    const config = loadConfig();
    if (cleanupInterval) clearInterval(cleanupInterval);
    cleanupInterval = setInterval(() => {
        cleanTempFolder().catch(() => {});
        cleanupOldEdits();
    }, config.cleanupInterval * 60 * 1000);
}

function cleanupOldEdits() {
    const now = Date.now();
    for (const [key, data] of processedEdits.entries()) {
        if (data[0] && data[0] < (now - 60000)) {
            processedEdits.delete(key);
        }
    }
}

// Command handler
async function antieditCommand(sock, chatId, message, senderId) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const args = text.trim().split(' ').slice(1);
        const action = args[0]?.toLowerCase();

        if (!action) {
            await showStatus(sock, chatId);
            return;
        }

        await processCommand(sock, chatId, action, args.slice(1));

    } catch (error) {
        console.error('[ANTIEDIT] Command error:', error);
        await sock.sendMessage(chatId, { text: '⚠️ Error processing command' });
    }
}

async function showStatus(sock, chatId) {
    const config = loadConfig();
    const sizeMB = await getFolderSizeInMB(TEMP_MEDIA_DIR);
    const prefix = '.';

    const status = `
✨ ANTIEDIT ✨

🔌 Status: ${config.enabled ? '🟢 ON' : '🔴 OFF'}
⚙️ Mode: ${config.mode.toUpperCase()}
💾 Storage: ${sizeMB.toFixed(1)}MB / ${config.maxStorageMB}MB
📝 Edits tracked: ${processedEdits.size}

📖 Commands:
${prefix}antiedit on | off | private | chat | both
${prefix}antiedit exclude | include
${prefix}antiedit clean | stats
    `.trim();

    await sock.sendMessage(chatId, { text: status });
}

async function processCommand(sock, chatId, command, args) {
    const config = loadConfig();
    let responseText = '';

    switch (command) {
        case 'on':
            config.enabled = true;
            responseText = '✅ AntiEdit ENABLED';
            break;
        case 'off':
            config.enabled = false;
            responseText = '❌ AntiEdit DISABLED';
            break;
        case 'private':
            config.mode = 'private';
            responseText = '🔒 Mode set to PRIVATE';
            break;
        case 'chat':
            config.mode = 'chat';
            responseText = '💬 Mode set to CHAT';
            break;
        case 'both':
            config.mode = 'both';
            responseText = '🔄 Mode set to BOTH';
            break;
        case 'exclude':
            if (!config.excludeGroups.includes(chatId)) {
                config.excludeGroups.push(chatId);
                responseText = '🚫 Chat EXCLUDED';
            } else {
                responseText = '⚠️ Chat already excluded';
            }
            break;
        case 'include':
            config.excludeGroups = config.excludeGroups.filter(id => id !== chatId);
            responseText = '✅ Chat INCLUDED';
            break;
        case 'clean':
            const deletedCount = await cleanTempFolder();
            responseText = `🧹 Cleaned ${deletedCount} temporary files`;
            break;
        case 'stats':
            const sizeMB = await getFolderSizeInMB(TEMP_MEDIA_DIR);
            responseText = `📊 ANTIEDIT STATS\n` +
                          `📝 Edits: ${processedEdits.size}\n` +
                          `💾 Storage: ${sizeMB.toFixed(1)}MB\n` +
                          `🚫 Excluded chats: ${config.excludeGroups.length}\n` +
                          `🙅 Excluded users: ${config.excludeUsers.length}\n` +
                          `⚙️ Mode: ${config.mode}\n` +
                          `🔌 Status: ${config.enabled ? 'ACTIVE 🟢' : 'INACTIVE 🔴'}`;
            break;
        default:
            responseText = '❓ Invalid command. Use .antiedit for help.';
    }

    if (!responseText.startsWith('❓')) {
        saveConfig(config);
        startCleanupInterval();
    }

    await sock.sendMessage(chatId, { text: responseText });
}

module.exports = {
    antieditCommand,
    initializeSystem,
    loadConfig,
    saveConfig
};
