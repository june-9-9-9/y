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

function hasEveryoneMention(text) {
    if (!text) return false;
    
    // Patterns to detect @everyone and @all mentions
    const patterns = [
        /@everyone/i,
        /@all/i,
        /@channel/i,
        /@here/i,
        /@group/i,
        /@todos/i, // Spanish/Portuguese
        /@semua/i, // Indonesian
        /@すべて/i, // Japanese
        /@전체/i, // Korean
        /@tutti/i // Italian
    ];
    
    return patterns.some(pattern => pattern.test(text));
}

function hasMentions(msg) {
    if (!msg) return false;
    
    // Extract text from message
    let text = '';
    if (msg.conversation) {
        text = msg.conversation;
    } else if (msg.extendedTextMessage?.text) {
        text = msg.extendedTextMessage.text;
    } else if (msg.imageMessage?.caption) {
        text = msg.imageMessage.caption;
    } else if (msg.videoMessage?.caption) {
        text = msg.videoMessage.caption;
    } else if (msg.documentMessage?.caption) {
        text = msg.documentMessage.caption;
    }
    
    // Check for @everyone/@all mentions in text
    if (hasEveryoneMention(text)) {
        return true;
    }
    
    // Check for mentionedJid in any message type
    const check = (m) => {
        if (!m) return false;
        // If mentionedJid exists and has multiple mentions (more than 2), treat as mass mention
        if (m.contextInfo?.mentionedJid?.length > 2) {
            return true;
        }
        // Also check quoted message for mentions
        if (m.contextInfo?.quotedMessage) {
            const quotedText = m.contextInfo.quotedMessage.conversation || 
                              m.contextInfo.quotedMessage.extendedTextMessage?.text || '';
            if (hasEveryoneMention(quotedText)) {
                return true;
            }
        }
        return false;
    };
    
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
        const text = message.message?.conversation || 
                    message.message?.extendedTextMessage?.text || '';
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
            case 'strict':
                return toggleStrictMode(sock, chatId, message);
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
        strictMode: false, // Strict mode for mass mentions
        exemptAdmins: true,
        warnings: {},
        lastActionTime: {}
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
        text: `✅ Anti-Mention Enabled\nMode: ${mode} (${modeText})\nAdmins are exempted.\n\nDetects: @everyone, @all, mass mentions` 
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

function toggleStrictMode(sock, chatId, message) {
    const group = settings.find(g => g.chatId === chatId);
    
    if (!group) {
        return sock.sendMessage(chatId, { 
            text: '❌ Enable anti-mention first with .antimention on [mode]' 
        }, { quoted: message });
    }
    
    group.strictMode = !group.strictMode;
    saveSettings();
    
    sock.sendMessage(chatId, { 
        text: `✅ Strict mode ${group.strictMode ? 'ENABLED' : 'DISABLED'}\n${group.strictMode ? 'Will detect any mention of more than 1 person' : 'Will only detect @everyone/@all mentions'}` 
    }, { quoted: message });
}

function showStatus(sock, chatId, message) {
    const group = settings.find(g => g.chatId === chatId);
    
    if (!group?.enabled) {
        return sock.sendMessage(chatId, { 
            text: '❌ Anti-Mention is off\nUse: .antimention on [mode]' 
        }, { quoted: message });
    }

    let status = `📊 Anti-Mention Status\n`;
    status += `Status: ✅ Enabled\n`;
    status += `Mode: ${group.mode.toUpperCase()}\n`;
    status += `Strict Mode: ${group.strictMode ? '✅ ON' : '❌ OFF'}\n`;
    status += `Admins Exempted: ${group.exemptAdmins ? '✅ Yes' : '❌ No'}\n\n`;
    
    status += `🚫 Detects:\n`;
    status += `• @everyone, @all, @here, @channel\n`;
    status += `• Mass mentions (${group.strictMode ? '1+ person' : '3+ people'})\n`;
    status += `• All languages variations\n\n`;

    if (group.warnings && Object.keys(group.warnings).length > 0) {
        status += '⚠️ Warning Counts:\n';
        Object.entries(group.warnings)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .forEach(([jid, count]) => {
                status += `• ${jid.split('@')[0]}: ${count} warning${count > 1 ? 's' : ''}\n`;
            });
    } else {
        status += 'No warnings recorded.';
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

.antimention strict
  Toggle strict mode

📝 Features:
• Blocks @everyone, @all, @here, @channel
• Blocks mass mentions (3+ people)
• Strict mode: blocks any mention of 1+ person
• Supports multiple languages
• Admin exemption available

Example:
.antimention on delete
.antimention strict`;

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
        const now = Date.now();
        
        try {
            const metadata = await sock.groupMetadata(chatId);
            const participant = metadata.participants.find(p => cleanJid(p.id) === sender);
            
            // Skip admins if exempted
            if (group.exemptAdmins && (participant?.admin === 'admin' || participant?.admin === 'superadmin')) {
                return;
            }

            // Rate limiting: prevent spam actions on the same user
            const lastAction = group.lastActionTime[sender] || 0;
            if (now - lastAction < 30000) { // 30 seconds cooldown
                return;
            }
            group.lastActionTime[sender] = now;

            // Extract message text for reporting
            let messageText = '';
            if (msg.message?.conversation) {
                messageText = msg.message.conversation;
            } else if (msg.message?.extendedTextMessage?.text) {
                messageText = msg.message.extendedTextMessage.text;
            }

            // Handle based on mode
            switch(group.mode) {
                case 'warn':
                    group.warnings[sender] = (group.warnings[sender] || 0) + 1;
                    saveSettings();
                    
                    const warningCount = group.warnings[sender];
                    let warningMsg = `⚠️ @${senderNum} - No mass mentions allowed!\n`;
                    warningMsg += `Warning #${warningCount}\n`;
                    warningMsg += `Violation: ${messageText.substring(0, 50)}${messageText.length > 50 ? '...' : ''}`;
                    
                    sock.sendMessage(chatId, { 
                        text: warningMsg,
                        mentions: [sender]
                    });
                    break;
                    
                case 'delete':
                    sock.sendMessage(chatId, { 
                        text: `🚫 @${senderNum} - Message deleted\nReason: Mass mention (@everyone/@all)`,
                        mentions: [sender]
                    });
                    
                    setTimeout(() => {
                        try {
                            sock.sendMessage(chatId, { 
                                delete: msg.key
                            });
                        } catch (error) {
                            console.log('Delete failed:', error.message);
                        }
                    }, 500);
                    break;
                    
                case 'kick':
                    const botJid = cleanJid(sock.user.id);
                    const bot = metadata.participants.find(p => cleanJid(p.id) === botJid);
                    
                    if (bot?.admin === 'superadmin' || bot?.admin === 'admin') {
                        sock.sendMessage(chatId, { 
                            text: `🚫 @${senderNum} - Kicked for mass mention\nViolation: ${messageText.substring(0, 30)}...`,
                            mentions: [sender]
                        });
                        
                        setTimeout(async () => {
                            try {
                                await sock.groupParticipantsUpdate(chatId, [sender], 'remove');
                                // Remove from warnings after kick
                                delete group.warnings[sender];
                                saveSettings();
                            } catch (error) {
                                console.log('Kick failed:', error.message);
                                sock.sendMessage(chatId, { 
                                    text: `⚠️ Failed to kick @${senderNum}. Bot needs admin rights.`,
                                    mentions: [sender]
                                });
                            }
                        }, 1000);
                    } else {
                        sock.sendMessage(chatId, { 
                            text: '⚠️ Bot needs admin rights to kick users'
                        });
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
