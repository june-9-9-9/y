const fs = require('fs');
const path = require('path');
const isAdmin = require('../lib/isAdmin');

const DATA_DIR = '../data';
const DATA_FILE = '../data/antimention.json';
let settings = [];

// Ensure data directory and file exist
function ensureDataFile() {
    const dirPath = path.join(__dirname, DATA_DIR);
    const filePath = path.join(__dirname, DATA_FILE);
    
    // Create data directory if it doesn't exist
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`✅ Created directory: ${dirPath}`);
    }
    
    // Create JSON file with empty array if it doesn't exist
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, '[]', 'utf8');
        console.log(`✅ Created file: ${filePath}`);
    }
    
    // Load settings
    try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        settings = JSON.parse(fileContent || '[]');
    } catch (error) {
        console.error('Error loading settings:', error);
        // If there's an error, create a fresh file
        settings = [];
        fs.writeFileSync(filePath, '[]', 'utf8');
    }
}

// Initialize data file on module load
ensureDataFile();

function saveSettings() {
    const filePath = path.join(__dirname, DATA_FILE);
    fs.writeFileSync(filePath, JSON.stringify(settings, null, 2));
}

function cleanJid(jid) {
    if (!jid) return jid;
    return jid.split(':')[0].replace(/\D/g, '') + '@s.whatsapp.net';
}

function hasMentions(msg) {
    if (!msg) return false;
    
    // Check for mentionedJid in any message type
    const check = (m) => m?.contextInfo?.mentionedJid?.length > 0;
    
    return check(msg.extendedTextMessage) || 
           check(msg.imageMessage) || 
           check(msg.videoMessage) || 
           check(msg.documentMessage) || 
           check(msg.audioMessage);
}

async function antimentionCommand(sock, chatId, message) {
    try {
        // Basic validation
        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '❌ Group only command' }, { quoted: message });
        }

        const sender = cleanJid(message.key.participant || sock.user.id);
        if (!await isAdmin(sock, chatId, sender)) {
            return sock.sendMessage(chatId, { text: '❌ Admins only' }, { quoted: message });
        }

        // Parse command
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const args = text.split(' ').slice(1);
        const cmd = args[0]?.toLowerCase();

        // Command router
        switch(cmd) {
            case 'on':
                return enableAntimention(sock, chatId, message, args[1]);
            case 'off':
                return disableAntimention(sock, chatId, message);
            case 'status':
                return showStatus(sock, chatId, message);
            default:
                return showHelp(sock, chatId, message);
        }
    } catch (error) {
        console.error('Antimention error:', error);
        sock.sendMessage(chatId, { text: '❌ Error: ' + error.message }, { quoted: message });
    }
}

async function enableAntimention(sock, chatId, message, mode) {
    const validModes = ['warn', 'delete', 'kick'];
    
    if (!validModes.includes(mode)) {
        return sock.sendMessage(chatId, { 
            text: `Usage: .antimention on [${validModes.join('|')}]` 
        }, { quoted: message });
    }

    const botJid = cleanJid(sock.user.id);
    const botIsAdmin = await isAdmin(sock, chatId, botJid);

    if ((mode === 'delete' || mode === 'kick') && !botIsAdmin) {
        return sock.sendMessage(chatId, { 
            text: '⚠️ Bot needs admin rights for this mode' 
        }, { quoted: message });
    }

    // Update settings
    const index = settings.findIndex(g => g.chatId === chatId);
    const newSettings = {
        chatId,
        enabled: true,
        mode,
        exemptAdmins: true,
        warnings: {}
    };

    if (index >= 0) {
        settings[index] = newSettings;
    } else {
        settings.push(newSettings);
    }
    
    saveSettings();
    
    // Send confirmation
    const modeText = {
        warn: 'Warning users',
        delete: 'Deleting messages',
        kick: 'Kicking users'
    }[mode];

    sock.sendMessage(chatId, { 
        text: `✅ Anti-Mention Enabled\nMode: ${mode} (${modeText})\nAdmins are exempted.` 
    }, { quoted: message });
}

function disableAntimention(sock, chatId, message) {
    const index = settings.findIndex(g => g.chatId === chatId);
    
    if (index >= 0) {
        settings.splice(index, 1);
        saveSettings();
        sock.sendMessage(chatId, { text: '❌ Anti-Mention disabled' }, { quoted: message });
    } else {
        sock.sendMessage(chatId, { text: 'ℹ️ Already disabled' }, { quoted: message });
    }
}

function showStatus(sock, chatId, message) {
    const group = settings.find(g => g.chatId === chatId);
    
    if (!group?.enabled) {
        return sock.sendMessage(chatId, { 
            text: '❌ Anti-Mention is off\nUse: .antimention on [mode]' 
        }, { quoted: message });
    }

    let status = `📊 Status: Enabled\nMode: ${group.mode}\n\n`;
    
    if (group.warnings && Object.keys(group.warnings).length > 0) {
        status += '⚠️ Warnings:\n';
        Object.entries(group.warnings).slice(0, 5).forEach(([jid, count]) => {
            status += `${jid.split('@')[0]}: ${count} warning${count > 1 ? 's' : ''}\n`;
        });
    } else {
        status += 'No warnings yet.';
    }

    sock.sendMessage(chatId, { text: status }, { quoted: message });
}

function showHelp(sock, chatId, message) {
    const help = `👥 Anti-Mention Commands

.antimention on [mode]
  Enable protection
  Modes: warn, delete, kick

.antimention off
  Disable protection

.antimention status
  Show current status

Example:
.antimention on delete`;

    sock.sendMessage(chatId, { text: help }, { quoted: message });
}

// Message listener (attach this once in your main file)
function setupAntimentionListener(sock) {
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg?.key.remoteJid?.endsWith('@g.us') || msg.key.fromMe) return;

        const chatId = msg.key.remoteJid;
        const group = settings.find(g => g.chatId === chatId);
        
        if (!group?.enabled || !hasMentions(msg.message)) return;

        const sender = cleanJid(msg.key.participant || msg.key.remoteJid);
        const senderNum = sender.split('@')[0];
        
        try {
            const metadata = await sock.groupMetadata(chatId);
            const participant = metadata.participants.find(p => cleanJid(p.id) === sender);
            
            // Skip admins if exempted
            if (group.exemptAdmins && (participant?.admin === 'admin' || participant?.admin === 'superadmin')) {
                return;
            }

            // Handle based on mode
            switch(group.mode) {
                case 'warn':
                    group.warnings[sender] = (group.warnings[sender] || 0) + 1;
                    saveSettings();
                    
                    sock.sendMessage(chatId, { 
                        text: `⚠️ @${senderNum} - No mentions allowed! (Warning #${group.warnings[sender]})`,
                        mentions: [sender]
                    });
                    break;
                    
                case 'delete':
                    sock.sendMessage(chatId, { 
                        text: `🚫 @${senderNum} - Message deleted`,
                        mentions: [sender]
                    });
                    
                    setTimeout(() => {
                        sock.sendMessage(chatId, { 
                            delete: msg.key
                        });
                    }, 500);
                    break;
                    
                case 'kick':
                    const botJid = cleanJid(sock.user.id);
                    const bot = metadata.participants.find(p => cleanJid(p.id) === botJid);
                    
                    if (bot?.admin === 'superadmin') {
                        sock.sendMessage(chatId, { 
                            text: `🚫 @${senderNum} - Kicked for mentioning`,
                            mentions: [sender]
                        });
                        
                        setTimeout(() => {
                            sock.groupParticipantsUpdate(chatId, [sender], 'remove');
                        }, 1000);
                    }
                    break;
            }
        } catch (error) {
            console.error('Listener error:', error);
        }
    });
}

module.exports = {
    antimentionCommand,
    setupAntimentionListener
};
