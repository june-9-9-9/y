const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');
const antilinkFilePath = path.join(dataDir, 'antilinkSettings.json');

/**
 * Ensure the data directory exists
 */
function ensureDataDir() {
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
}

/**
 * Load settings safely with error handling
 */
function loadAntilinkSettings() {
    try {
        ensureDataDir();
        if (fs.existsSync(antilinkFilePath)) {
            const data = fs.readFileSync(antilinkFilePath, 'utf8');
            return JSON.parse(data);
        }
    } catch (err) {
        console.error('[Antilink] Failed to load settings:', err);
    }
    return {};
}

/**
 * Save settings safely with error handling
 */
function saveAntilinkSettings(settings) {
    try {
        ensureDataDir();
        fs.writeFileSync(antilinkFilePath, JSON.stringify(settings, null, 2), 'utf8');
    } catch (err) {
        console.error('[Antilink] Failed to save settings:', err);
    }
}

/**
 * Set a group’s antilink setting
 */
function setAntilinkSetting(groupId, type = 'off') {
    const settings = loadAntilinkSettings();
    settings[groupId] = type;
    saveAntilinkSettings(settings);
    console.log(`[Antilink] Setting updated for group ${groupId}: ${type}`);
}

/**
 * Get a group’s antilink setting
 */
function getAntilinkSetting(groupId) {
    const settings = loadAntilinkSettings();
    return settings[groupId] || 'off';
}

module.exports = {
    setAntilinkSetting,
    getAntilinkSetting
};
