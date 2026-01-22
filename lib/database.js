// lib/database.js
const fs = require('fs');
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, '../data/anticall.json');

// Initialize default settings
const defaultSettings = {
  status: false,
  action: 'reject', // 'reject' or 'block'
  message: "This bot doesn't accept calls.",
  lastSent: null // track last time message was sent
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

// Check if message should be sent (avoid spamming)
async function shouldSendAntiCallMessage() {
  const settings = await getAntiCallSettings();
  
  // If already sent once in this session, skip
  if (settings.lastSent) {
    return false;
  }

  // Mark as sent
  await updateAntiCallSettings({ lastSent: Date.now() });
  return true;
}

module.exports = {
  getAntiCallSettings,
  updateAntiCallSettings,
  shouldSendAntiCallMessage
};
