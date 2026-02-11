// botConfig.js - Configuration management module

const fs = require('fs');
const path = require('path');

// Path to config file
const configPath = path.join(__dirname, '..', 'config.json');

// Default configuration
let config = {
    botName: 'ArfahBot',
    ownerName: 'Arfah',
    ownerNumber: '',
    menuImage: null,
    antideletePrivate: false,
    prefix: '.'
};

// Load existing config if available
try {
    if (fs.existsSync(configPath)) {
        const savedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        config = { ...config, ...savedConfig };
    }
} catch (error) {
    console.error('Failed to load config:', error.message);
}

// Save config to file
function saveConfig() {
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch (error) {
        console.error('Failed to save config:', error.message);
    }
}

// Get bot name
function getBotName() {
    return config.botName;
}

// Get menu image
function getMenuImage() {
    return config.menuImage;
}

// Set menu image
function setMenuImage(imagePath) {
    config.menuImage = imagePath;
    saveConfig();
}

// Get full config
function getConfig() {
    return { ...config };
}

// Update config with partial data
function updateConfig(newConfig) {
    config = { ...config, ...newConfig };
    saveConfig();
}

module.exports = {
    getBotName,
    getMenuImage,
    setMenuImage,
    getConfig,
    updateConfig
};
