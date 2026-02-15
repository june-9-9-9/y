const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'chatbot.sqlite');

let db;
try {
    db = new Database(DB_PATH);
    db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );
        CREATE TABLE IF NOT EXISTS user_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            message TEXT,
            timestamp INTEGER DEFAULT (strftime('%s', 'now'))
        );
    `);
} catch (e) {
    console.error('chatbot.db init error:', e.message);
}

function getSetting(key, defaultValue = null) {
    if (!db) return defaultValue;
    try {
        const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
        return row ? row.value : defaultValue;
    } catch (e) {
        return defaultValue;
    }
}

function setSetting(key, value) {
    if (!db) return;
    try {
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
    } catch (e) {}
}

function storeUserMessage(userId, message) {
    if (!db) return;
    try {
        db.prepare('INSERT INTO user_messages (user_id, message) VALUES (?, ?)').run(userId, message);
    } catch (e) {}
}

module.exports = { getSetting, setSetting, storeUserMessage };
