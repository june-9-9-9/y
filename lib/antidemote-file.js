// ../lib/antidemote-file.js
const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'antidemote.json');

// Ensure directory exists
async function ensureDataDir() {
    try {
        await fs.access(DATA_DIR);
    } catch {
        await fs.mkdir(DATA_DIR, { recursive: true });
        await fs.writeFile(DATA_FILE, '{}');
    }
}

async function setAntidemote(chatId, status) {
    await ensureDataDir();
    try {
        const data = JSON.parse(await fs.readFile(DATA_FILE, 'utf8').catch(() => '{}'));
        data[chatId] = {
            enabled: status === 'on',
            status: status,
            updatedAt: new Date().toISOString()
        };
        await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
        return data[chatId];
    } catch (error) {
        console.error('Error in setAntidemote:', error);
        throw error;
    }
}

async function getAntidemote(chatId) {
    await ensureDataDir();
    try {
        const data = JSON.parse(await fs.readFile(DATA_FILE, 'utf8').catch(() => '{}'));
        if (data[chatId]) {
            return {
                chatId,
                ...data[chatId],
                enabled: data[chatId].enabled || data[chatId].status === 'on'
            };
        }
        return { chatId, enabled: false, status: 'off', updatedAt: null };
    } catch (error) {
        console.error('Error in getAntidemote:', error);
        return { chatId, enabled: false, status: 'off', updatedAt: null };
    }
}

async function removeAntidemote(chatId) {
    await ensureDataDir();
    try {
        const data = JSON.parse(await fs.readFile(DATA_FILE, 'utf8').catch(() => '{}'));
        delete data[chatId];
        await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error in removeAntidemote:', error);
        throw error;
    }
}

module.exports = {
    setAntidemote,
    getAntidemote,
    removeAntidemote
};
