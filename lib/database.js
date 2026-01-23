// lib/database.js
const fs = require('fs');
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, '../data/anticall.json');

// Initialize default settings (no message field)
const defaultSettings = {
  status: false,
  action: 'reject' // 'reject' or 'block'
};

// Ensure settings file exists
function ensureSettingsFile() {
  const dir = path.dirname(SETTINGS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(defaultSettings, null, 2));
  }
}

// Get anti-call settings
async function getAntiCallSettings() {
  ensureSettingsFile();
  try {
    const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading anti-call settings:', error);
    return defaultSettings;
  }
}

// Update anti-call settings
async function updateAntiCallSettings(updates) {
  ensureSettingsFile();
  try {
    const currentSettings = await getAntiCallSettings();
    const newSettings = { ...currentSettings, ...updates };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(newSettings, null, 2));
    return newSettings;
  } catch (error) {
    console.error('Error updating anti-call settings:', error);
    throw error;
  }
}


//*****antisticker function

const DATA_FILE = path.join(__dirname, '../data/antisticker.json');

// Ensure file exists
function ensureFile() {
    if (!fs.existsSync(DATA_FILE)) {
        fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
        fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 2));
    }
}

// Read JSON
function readData() {
    ensureFile();
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

// Write JSON
function writeData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Set config
function setAntisticker(chatId, status, action) {
    const data = readData();
    data[chatId] = { enabled: status === 'on', action };
    writeData(data);
    return data[chatId];
}

// Get config
function getAntisticker(chatId) {
    const data = readData();
    return data[chatId] || null;
}

// Remove config
function removeAntisticker(chatId) {
    const data = readData();
    delete data[chatId];
    writeData(data);
    return true;
}


module.exports = {
    setAntisticker,
    getAntisticker,
    removeAntisticker,
  getAntiCallSettings,
  updateAntiCallSettings
};
