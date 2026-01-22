// ../lib/welcome.js
const { channelInfo } = require('./messageConfig');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// Path to JSON storage
const settingsFile = path.join(__dirname, 'welcome.json');

// --- JSON helpers ---
function loadSettings() {
    if (!fs.existsSync(settingsFile)) return {};
    try {
        return JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    } catch {
        return {};
    }
}

function saveSettings(settings) {
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
}

// --- Settings functions ---
async function isWelcomeOn(groupId) {
    const settings = loadSettings();
    return settings[groupId]?.welcomeEnabled || false;
}

async function getWelcome(groupId) {
    const settings = loadSettings();
    return settings[groupId]?.welcomeMessage || null;
}

async function setWelcomeOn(groupId, enabled) {
    const settings = loadSettings();
    if (!settings[groupId]) settings[groupId] = {};
    settings[groupId].welcomeEnabled = enabled;
    saveSettings(settings);
}

async function setWelcomeMessage(groupId, message) {
    const settings = loadSettings();
    if (!settings[groupId]) settings[groupId] = {};
    settings[groupId].welcomeMessage = message;
    saveSettings(settings);
}

// --- Command handler ---
async function handleWelcome(sock, chatId, message, matchText) {
    if (!matchText) {
        return sock.sendMessage(chatId, { text: '❌ Please provide a welcome message.' }, { quoted: message });
    }
    await setWelcomeMessage(chatId, matchText);
    await setWelcomeOn(chatId, true);
    await sock.sendMessage(chatId, { text: `✅ Welcome message updated.` }, { quoted: message });
}

// --- Join event handler ---
async function handleJoinEvent(sock, id, participants) {
    if (!(await isWelcomeOn(id))) return;

    const customMessage = await getWelcome(id);
    const groupMetadata = await sock.groupMetadata(id);
    const groupName = groupMetadata.subject;
    const groupDesc = groupMetadata.desc || 'No description available';
    const memberCount = groupMetadata.participants.length;

    for (const participant of participants) {
        const participantId = typeof participant === 'string' ? participant : participant.id;
        const user = participantId.split('@')[0];

        // Resolve display name
        let displayName = user;
        try {
            const contact = await sock.getBusinessProfile(participantId);
            if (contact?.name) displayName = contact.name;
            else {
                const gpUser = groupMetadata.participants.find(p => p.id === participantId);
                if (gpUser?.name) displayName = gpUser.name;
            }
        } catch {}

        // Build message
        const now = new Date();
        const timeString = now.toLocaleString('en-US', {
            month: '2-digit', day: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
        });

        const finalMessage = (customMessage
            ? customMessage
                .replace(/{user}/g, `@${displayName}`)
                .replace(/{group}/g, groupName)
                .replace(/{description}/g, groupDesc)
                .replace(/{time}/g, timeString)
                .replace(/{memberCount}/g, memberCount)
            : `╭╼━≪•NEW-MEMBER•≫━╾╮
┃WELCOME: @${displayName} 👋
┃Member count: #${memberCount}
┃TIME: ${timeString}⏰
╰━━━━━━━━━━━━━━━╯

*@${displayName}* Welcome to *${groupName}*! 🎉
*DESCRIPTION*
${groupDesc}\n`);

        // Try image welcome
        let profilePicUrl = 'https://img.pyrocdn.com/dbKUgahg.png';
        try {
            const profilePic = await sock.profilePictureUrl(participantId, 'image');
            if (profilePic) profilePicUrl = profilePic;
        } catch {}

        const apiUrl = `https://api.some-random-api.com/welcome/img/2/gaming3?type=join&textcolor=green&username=${encodeURIComponent(displayName)}&guildName=${encodeURIComponent(groupName)}&memberCount=${memberCount}&avatar=${encodeURIComponent(profilePicUrl)}`;

        try {
            const response = await fetch(apiUrl);
            if (response.ok) {
                const imageBuffer = await response.buffer();
                await sock.sendMessage(id, {
                    image: imageBuffer,
                    caption: finalMessage,
                    mentions: [participantId],
                    ...channelInfo
                });
                continue;
            }
        } catch {}

        // Fallback text
        await sock.sendMessage(id, {
            text: finalMessage,
            mentions: [participantId],
            ...channelInfo
        });
    }
}

module.exports = { handleWelcome, handleJoinEvent, isWelcomeOn, getWelcome, setWelcomeOn, setWelcomeMessage };
