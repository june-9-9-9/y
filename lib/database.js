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


//*****antisticker function******


// ../lib/database.js
const fs = require('fs');
const path = require('path');

// Place Db
const dataDir = path.join(process.cwd(), '.data');
const dbFile = path.join(dataDir, 'antisticker.json');

// Ensure .data directory and DB file exist
function ensureDb() {
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(dbFile)) {
        fs.writeFileSync(dbFile, JSON.stringify({}, null, 2));
    }
}

// Load database
function loadDb() {
    ensureDb();
    const raw = fs.readFileSync(dbFile, 'utf-8');
    return JSON.parse(raw);
}

// Save database
function saveDb(db) {
    fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
}

/**
 * Set antisticker configuration for a group
 * @param {string} chatId - WhatsApp group ID
 * @param {boolean} enabled - true/false
 * @param {string} action - 'delete' | 'kick' | 'warn'
 */
async function setAntisticker(chatId, enabled, action) {
    const db = loadDb();
    db[chatId] = { enabled, action };
    saveDb(db);
    return db[chatId];
}

/**
 * Get antisticker configuration for a group
 * @param {string} chatId - WhatsApp group ID
 */
async function getAntisticker(chatId) {
    const db = loadDb();
    return db[chatId] || null;
}

/**
 * Remove antisticker configuration for a group
 * @param {string} chatId - WhatsApp group ID
 */
async function removeAntisticker(chatId) {
    const db = loadDb();
    if (db[chatId]) {
        delete db[chatId];
        saveDb(db);
    }
    return true;
}

module.exports = {
    setAntisticker,
    getAntisticker,
    removeAntisticker,
  getAntiCallSettings,
  updateAntiCallSettings
};
