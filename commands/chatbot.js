const axios = require('axios');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const ffmpeg = require('fluent-ffmpeg');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const FormData = require('form-data');

// JSON file paths
const DATA_DIR = path.join(__dirname, '../data');
const SETTINGS_FILE = path.join(DATA_DIR, 'chatbot_settings.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'chatbot_messages.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize JSON files if they don't exist
if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ chatbot_enabled: 'false' }, null, 2));
}

if (!fs.existsSync(MESSAGES_FILE)) {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify({}, null, 2));
}

/* ================== JSON DATABASE FUNCTIONS ================== */
function readSettings() {
    try {
        const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Error reading settings:', err.message);
        return { chatbot_enabled: 'false' };
    }
}

function writeSettings(settings) {
    try {
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
        return true;
    } catch (err) {
        console.error('Error writing settings:', err.message);
        return false;
    }
}

function readMessages() {
    try {
        const data = fs.readFileSync(MESSAGES_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Error reading messages:', err.message);
        return {};
    }
}

function writeMessages(messages) {
    try {
        fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
        return true;
    } catch (err) {
        console.error('Error writing messages:', err.message);
        return false;
    }
}

/* ================== SETTINGS FUNCTIONS ================== */
async function getSetting(key) {
    const settings = readSettings();
    return settings[key] || 'false';
}

async function setSetting(key, value) {
    const settings = readSettings();
    settings[key] = value;
    return writeSettings(settings);
}

/* ================== MESSAGE FUNCTIONS ================== */
async function storeUserMessage(userId, message) {
    try {
        const messages = readMessages();
        
        if (!messages[userId]) {
            messages[userId] = [];
        }
        
        // Add new message with timestamp
        messages[userId].push({
            text: message,
            timestamp: Date.now(),
            role: 'user'
        });
        
        // Keep only last 50 messages per user to prevent file from growing too large
        if (messages[userId].length > 50) {
            messages[userId] = messages[userId].slice(-50);
        }
        
        writeMessages(messages);
        return true;
    } catch (err) {
        console.error('Error storing message:', err.message);
        return false;
    }
}

async function getUserMessages(userId, limit = 10) {
    try {
        const messages = readMessages();
        
        if (!messages[userId] || messages[userId].length === 0) {
            return [];
        }
        
        // Get last 'limit' messages
        return messages[userId].slice(-limit);
    } catch (err) {
        console.error('Error getting messages:', err.message);
        return [];
    }
}

async function clearUserMessages(userId) {
    try {
        const messages = readMessages();
        delete messages[userId];
        writeMessages(messages);
        return true;
    } catch (err) {
        console.error('Error clearing messages:', err.message);
        return false;
    }
}

/* ================== TYPING INDICATOR ================== */
async function showTypingIndicator(sock, chatId) {
    try {
        await sock.sendPresenceUpdate('composing', chatId);
    } catch {}
}

async function stopTypingIndicator(sock, chatId) {
    try {
        await sock.sendPresenceUpdate('paused', chatId);
    } catch {}
}

/* ================== SPEECH TO TEXT ================== */
async function speechToText(audioPath) {
    try {
        const form = new FormData();
        form.append('file', fs.createReadStream(audioPath));

        const res = await fetch('https://apiskeith.top/ai/transcribe', {
            method: 'POST',
            body: form,
            headers: form.getHeaders()
        });

        const data = await res.json();
        console.log('STT Response:', data); // debug

        return data?.result || data?.text || null;
    } catch (err) {
        console.error('STT Error:', err.message);
        return null;
    }
}

/* ================== CHATBOT COMMAND ================== */
async function handleChatbotCommand(sock, chatId, message, match, isOwner) {
    let enabled = await getSetting('chatbot_enabled');

    if (!match) {
        return sock.sendMessage(chatId, {
            text: `*CHATBOT SETUP — OWNER ONLY*

*.chatbot on*
Enable chatbot

*.chatbot off*
Disable chatbot

*.chatbot clear*
Clear your conversation history

*Current Status:* ${enabled === 'true' ? '🟢 ON' : '🔴 OFF'}`,
            quoted: message
        });
    }

    if (!isOwner) {
        return sock.sendMessage(chatId, {
            text: '❌ Only the bot owner can control the chatbot!',
            quoted: message
        });
    }

    if (match === 'on') {
        await setSetting('chatbot_enabled', 'true');
        return sock.sendMessage(chatId, {
            text: '🤖 Chatbot ENABLED successfully',
            quoted: message
        });
    }

    if (match === 'off') {
        await setSetting('chatbot_enabled', 'false');
        return sock.sendMessage(chatId, {
            text: '🤖 Chatbot DISABLED',
            quoted: message
        });
    }
    
    if (match === 'clear') {
        await clearUserMessages(chatId.split('@')[0]);
        return sock.sendMessage(chatId, {
            text: '🧹 Your conversation history has been cleared',
            quoted: message
        });
    }
}

/* ================== CHATBOT RESPONSE ================== */
async function handleChatbotResponse(sock, chatId, message, userMessage, senderId) {
    try {
        // ❌ Ignore groups
        if (chatId.endsWith('@g.us')) return;

        // ❌ Ignore bot & commands
        if (message.key.fromMe) return;

        let enabled = await getSetting('chatbot_enabled');
        if (enabled !== 'true') return;

        let finalText = userMessage;

        /* ===== VOICE NOTE HANDLING ===== */
        if (message.message?.audioMessage?.ptt) {
            await showTypingIndicator(sock, chatId);

            // Create tmp directory if it doesn't exist
            const tmpDir = path.join(__dirname, '../tmp');
            if (!fs.existsSync(tmpDir)) {
                fs.mkdirSync(tmpDir, { recursive: true });
            }

            const audioPath = path.join(tmpDir, `${Date.now()}.ogg`);
            const buffer = await downloadMediaMessage(
                message,
                'buffer',
                {},
                { logger: console }
            );

            fs.writeFileSync(audioPath, buffer);

            finalText = await speechToText(audioPath);
            fs.unlinkSync(audioPath);

            if (!finalText) {
                await stopTypingIndicator(sock, chatId);
                return sock.sendMessage(chatId, {
                    text: "🤖 I couldn't understand the voice note.",
                }, { quoted: message });
            }
        }

        // ❌ Ignore empty text or commands
        if (!finalText || finalText.startsWith('.')) return;

        /* ===== MEMORY ===== */
        await storeUserMessage(senderId, finalText);
        const history = await getUserMessages(senderId, 10);

        /* ===== AI REQUEST ===== */
        const query = encodeURIComponent(finalText);
        const prompt = encodeURIComponent(
            "always speak in english but if someone speak to you using any languge reply using that language. you are xhypher ai whatsapp bot made by xhypher tech (superstar). a tech genius in zimbabwe. act smart and enigmatic about personal stuff about him. He is 17 years (2026). You are friendly, be humble. add some emojis when talking talk like a real human not ai. Don't forget what people told you like names and information store it Don't forget it you are like a computer."
        );

        const apiUrl = `https://api.bk9.dev/ai/BK93?BK9=${prompt}&q=${query}`;

        await showTypingIndicator(sock, chatId);
        const { data } = await axios.get(apiUrl);
        await stopTypingIndicator(sock, chatId);

        if (data?.BK9) {
            await sock.sendMessage(chatId, { text: data.BK9 }, { quoted: message });
            
            // Store bot response in history
            await storeUserMessage(senderId, `Bot: ${data.BK9}`);
        } else {
            await sock.sendMessage(chatId, {
                text: "🤖 I could not respond properly."
            }, { quoted: message });
        }

    } catch (err) {
        await stopTypingIndicator(sock, chatId);
        console.error('Chatbot Error:', err.message);
    }
}

module.exports = {
    handleChatbotCommand,
    handleChatbotResponse,
    // Export utility functions for testing or manual use
    getSetting,
    setSetting,
    storeUserMessage,
    getUserMessages,
    clearUserMessages
};
