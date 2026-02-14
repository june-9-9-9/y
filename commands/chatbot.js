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
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ 
        chatbot_enabled: 'false',
        chatbot_settings: {
            groups_allowed: 'false', // Whether chatbot works in groups
            admin_only_toggle: 'true' // Only admins can toggle chatbot
        }
    }, null, 2));
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
        return { 
            chatbot_enabled: 'false',
            chatbot_settings: {
                groups_allowed: 'false',
                admin_only_toggle: 'true'
            }
        };
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

async function getChatbotSettings() {
    const settings = readSettings();
    return settings.chatbot_settings || {
        groups_allowed: 'false',
        admin_only_toggle: 'true'
    };
}

async function setSetting(key, value) {
    const settings = readSettings();
    settings[key] = value;
    return writeSettings(settings);
}

async function updateChatbotSettings(newSettings) {
    const settings = readSettings();
    settings.chatbot_settings = { ...settings.chatbot_settings, ...newSettings };
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

/* ================== CHECK ADMIN FUNCTION ================== */
async function isUserAdmin(sock, chatId, userId) {
    try {
        // For private chats, always return true (user is admin of their own chat)
        if (!chatId.endsWith('@g.us')) {
            return true;
        }
        
        // For groups, check if user is admin
        const groupMetadata = await sock.groupMetadata(chatId);
        const participant = groupMetadata.participants.find(p => p.id === userId);
        return participant?.admin === 'admin' || participant?.admin === 'superadmin';
    } catch (err) {
        console.error('Error checking admin status:', err.message);
        return false;
    }
}

/* ================== CHATBOT COMMAND ================== */
async function handleChatbotCommand(sock, chatId, message, match, isAdmin) {
    let enabled = await getSetting('chatbot_enabled');
    let chatbotSettings = await getChatbotSettings();
    const senderId = message.key.participant || message.key.remoteJid;
    const isGroup = chatId.endsWith('@g.us');
    
    // Enhanced admin check - use passed isAdmin or check again
    const userIsAdmin = isAdmin || await isUserAdmin(sock, chatId, senderId);

    if (!match) {
        let statusText = `*CHATBOT SETUP*

*Current Status:* ${enabled === 'true' ? '🟢 ON' : '🔴 OFF'}

*Available Commands:*`;

        if (userIsAdmin) {
            statusText += `

*.chatbot on* - Enable chatbot
*.chatbot off* - Disable chatbot
*.chatbot group on* - Allow chatbot in groups
*.chatbot group off* - Disable chatbot in groups
*.chatbot toggle admin* - Restrict toggle to admins only`;
        }

        statusText += `

*.chatbot clear* - Clear your conversation history

*Group Settings:* ${chatbotSettings.groups_allowed === 'true' ? '✅ Allowed' : '❌ Not allowed'}
*Admin Toggle:* ${chatbotSettings.admin_only_toggle === 'true' ? '✅ Admins only' : '✅ Everyone'}`;

        return sock.sendMessage(chatId, {
            text: statusText,
            quoted: message
        });
    }

    // Handle clear command (available to everyone)
    if (match === 'clear') {
        await clearUserMessages(senderId.split('@')[0]);
        return sock.sendMessage(chatId, {
            text: '🧹 Your conversation history has been cleared',
            quoted: message
        });
    }

    // All other commands require admin privileges
    if (!userIsAdmin) {
        return sock.sendMessage(chatId, {
            text: '❌ This command is restricted to group admins only!',
            quoted: message
        });
    }

    // Handle group settings
    if (match.startsWith('group ')) {
        const groupSetting = match.split(' ')[1];
        
        if (groupSetting === 'on') {
            await updateChatbotSettings({ groups_allowed: 'true' });
            return sock.sendMessage(chatId, {
                text: '✅ Chatbot will now respond in groups',
                quoted: message
            });
        } else if (groupSetting === 'off') {
            await updateChatbotSettings({ groups_allowed: 'false' });
            return sock.sendMessage(chatId, {
                text: '✅ Chatbot will not respond in groups',
                quoted: message
            });
        }
    }

    // Handle admin toggle setting
    if (match === 'toggle admin') {
        const newSetting = chatbotSettings.admin_only_toggle !== 'true';
        await updateChatbotSettings({ admin_only_toggle: newSetting ? 'true' : 'false' });
        return sock.sendMessage(chatId, {
            text: `✅ Chatbot toggle is now ${newSetting ? 'restricted to admins' : 'available to everyone'}`,
            quoted: message
        });
    }

    // Handle on/off commands
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
}

/* ================== CHATBOT RESPONSE ================== */
async function handleChatbotResponse(sock, chatId, message, userMessage, senderId) {
    try {
        // ❌ Ignore bot's own messages
        if (message.key.fromMe) return;

        let enabled = await getSetting('chatbot_enabled');
        if (enabled !== 'true') return;

        const isGroup = chatId.endsWith('@g.us');
        const chatbotSettings = await getChatbotSettings();

        // Handle group chat restrictions
        if (isGroup && chatbotSettings.groups_allowed !== 'true') {
            return; // Don't respond in groups if not allowed
        }

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
    updateChatbotSettings,
    getChatbotSettings,
    storeUserMessage,
    getUserMessages,
    clearUserMessages,
    isUserAdmin
};
