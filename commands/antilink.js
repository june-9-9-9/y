const fs = require('fs');
const path = require('path');

const DATA_DIR = './data';
const ANTI_LINK_FILE = path.join(DATA_DIR, 'antilink.json');

// Ensure persistence
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(ANTI_LINK_FILE)) fs.writeFileSync(ANTI_LINK_FILE, JSON.stringify({}, null, 2));

// Helpers
const loadData = () => {
    try { return JSON.parse(fs.readFileSync(ANTI_LINK_FILE, 'utf8')); }
    catch { return {}; }
};
const saveData = (data) => fs.writeFileSync(ANTI_LINK_FILE, JSON.stringify(data, null, 2));

// Link detection
function containsLink(text) {
    if (!text) return false;
    const patterns = [
        /https?:\/\/\S+/gi,
        /www\.\S+\.[a-z]{2,}/gi,
        /t\.me\/\S+/gi,
        /chat\.whatsapp\.com\/\S+/gi,
        /discord\.gg\/\S+/gi
    ];
    return patterns.some(p => p.test(text));
}

// Enforcement handler
async function enforce(sock, chatId, sender, msg, mode) {
    switch (mode) {
        case 'warn':
            return sock.sendMessage(chatId, {
                text: `⚠️ *Link Warning*\nLinks are not allowed here!`,
                mentions: [sender]
            });

        case 'delete':
            try {
                await sock.sendMessage(chatId, {
                    delete: { id: msg.key.id, remoteJid: chatId, fromMe: false }
                });
                return sock.sendMessage(chatId, { text: `🚫 Link deleted` });
            } catch (e) {
                console.error('Delete failed:', e);
            }
            break;

        case 'kick':
            try {
                // Normalize sender JID
                const target = sender.endsWith('@s.whatsapp.net')
                    ? sender
                    : `${sender.split('@')[0]}@s.whatsapp.net`;

                await sock.groupParticipantsUpdate(chatId, [target], 'remove');
                return sock.sendMessage(chatId, { text: `👢 User kicked for sharing links` });
            } catch (e) {
                console.error('Kick failed:', e);
                return sock.sendMessage(chatId, { text: `❌ Failed to kick. I need admin rights.` });
            }
    }
}

// Listener
function setupAntiLinkListener(sock) {
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg || msg.key.fromMe || !msg.key.remoteJid?.endsWith('@g.us')) return;

        const chatId = msg.key.remoteJid;
        const data = loadData();
        const group = data[chatId];
        if (!group?.enabled) return;

        const text =
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            msg.message?.imageMessage?.caption ||
            msg.message?.videoMessage?.caption || '';

        if (!containsLink(text)) return;

        // Allowed link check
        if (group.allowedLinks?.some(l => text.toLowerCase().includes(l.toLowerCase()))) return;

        // ✅ Always use participant for group messages
        const sender = msg.key.participant;
        if (!sender) return; // safety guard

        await enforce(sock, chatId, sender, msg, group.mode);
    });
}

// Command handler
async function handleAntilinkCommand(sock, chatId, userMessage, senderId, isSenderAdmin, message) {
    if (!chatId.endsWith('@g.us'))
        return sock.sendMessage(chatId, { text: '❌ Group only command' }, { quoted: message });

    if (!isSenderAdmin)
        return sock.sendMessage(chatId, { text: '❌ Admins only' }, { quoted: message });

    const args = userMessage.trim().split(/\s+/).slice(1);
    const cmd = args[0]?.toLowerCase();
    const data = loadData();

    switch (cmd) {
        case 'on': {
            const mode = args[1]?.toLowerCase();
            if (!['warn', 'delete', 'kick'].includes(mode))
                return sock.sendMessage(chatId, { text: 'Usage: .antilink on [warn|delete|kick]' }, { quoted: message });

            data[chatId] = { enabled: true, mode, allowedLinks: [] };
            saveData(data);
            setupAntiLinkListener(sock);
            return sock.sendMessage(chatId, { text: `✅ Anti-link enabled (${mode} mode)` }, { quoted: message });
        }

        case 'off':
            delete data[chatId];
            saveData(data);
            return sock.sendMessage(chatId, { text: '❌ Anti-link disabled' }, { quoted: message });

        case 'allow': {
            const link = args.slice(1).join(' ');
            if (!link) return sock.sendMessage(chatId, { text: 'Usage: .antilink allow [link]' }, { quoted: message });
            if (!data[chatId]) return sock.sendMessage(chatId, { text: '❌ Enable anti-link first' }, { quoted: message });

            const cleanLink = link.replace(/https?:\/\//, '').split('/')[0];
            if (!data[chatId].allowedLinks.includes(cleanLink)) {
                data[chatId].allowedLinks.push(cleanLink);
                saveData(data);
            }
            return sock.sendMessage(chatId, { text: `✅ Allowed: ${cleanLink}` }, { quoted: message });
        }

        case 'list':
            const links = data[chatId]?.allowedLinks || [];
            return sock.sendMessage(chatId, {
                text: links.length ? `📋 Allowed Links:\n${links.map((l, i) => `${i + 1}. ${l}`).join('\n')}` : 'No allowed links configured'
            }, { quoted: message });

        case 'status':
            const group = data[chatId];
            return sock.sendMessage(chatId, {
                text: group?.enabled
                    ? `Status: ✅ Enabled\nMode: ${group.mode}\nAllowed: ${group.allowedLinks.length} link(s)`
                    : 'Status: ❌ Disabled'
            }, { quoted: message });

        default:
            return sock.sendMessage(chatId, {
                text: `🔗 *Anti-link Commands*\n\n` +
                      `.antilink on [warn|delete|kick]\n` +
                      `.antilink off\n` +
                      `.antilink allow [link]\n` +
                      `.antilink list\n` +
                      `.antilink status`
            }, { quoted: message });
    }
}

module.exports = { handleAntilinkCommand };
