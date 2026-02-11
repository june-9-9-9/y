const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'antidemote.json');

// Ensure data directory exists
async function ensureDataDir() {
    try {
        await fs.access(DATA_DIR);
    } catch {
        await fs.mkdir(DATA_DIR, { recursive: true });
        await fs.writeFile(DATA_FILE, '{}');
    }
}

// Load all data
async function loadData() {
    await ensureDataDir();
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        return JSON.parse(data || '{}');
    } catch (error) {
        console.error('[ANTIDEMOTE] Error loading data:', error);
        return {};
    }
}

// Save all data
async function saveData(data) {
    try {
        await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('[ANTIDEMOTE] Error saving data:', error);
        throw error;
    }
}

async function setAntidemote(chatId, status) {
    const data = await loadData();
    data[chatId] = {
        enabled: status === 'on',
        status,
        updatedAt: new Date().toISOString()
    };
    
    await saveData(data);
    console.log(`[ANTIDEMOTE] Config saved for ${chatId}: ${status}`);
    return data[chatId];
}

async function getAntidemote(chatId) {
    const data = await loadData();
    
    if (data[chatId]) {
        return {
            chatId,
            ...data[chatId]
        };
    }
    
    return {
        chatId,
        enabled: false,
        status: 'off',
        updatedAt: null
    };
}

async function removeAntidemote(chatId) {
    const data = await loadData();
    if (data[chatId]) {
        delete data[chatId];
        await saveData(data);
        console.log(`[ANTIDEMOTE] Config removed for ${chatId}`);
    }
    return true;
}

module.exports = {
    setAntidemote,
    getAntidemote,
    removeAntidemote
};
