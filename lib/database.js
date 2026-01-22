// ../lib/database.js
const fs = require('fs');
const path = require('path');

const dbFile = path.join(__dirname, 'anticall.json');

// Default settings
const defaultSettings = {
    status: false,          // Anti-call OFF by default
    action: 'reject',       // "reject" or "block"
    message: ''             // Optional rejection message
};

// Helper: load settings
function loadSettings() {
    try {
        if (!fs.existsSync(dbFile)) {
            return { ...defaultSettings };
        }
        const data = fs.readFileSync(dbFile, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('DB load error:', err);
        return { ...defaultSettings };
    }
}

// Helper: save settings
function saveSettings(settings) {
    try {
        fs.writeFileSync(dbFile, JSON.stringify(settings, null, 2));
        return true;
    } catch (err) {
        console.error('DB save error:', err);
        return false;
    }
}

// Public API
async function getAntiCallSettings() {
    return loadSettings();
}

async function updateAntiCallSettings(updates) {
    const settings = loadSettings();
    const newSettings = { ...settings, ...updates };
    saveSettings(newSettings);
    return newSettings;
}

module.exports = {
    getAntiCallSettings,
    updateAntiCallSettings
};
