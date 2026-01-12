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
    
    // Check for mentionedJid in any message type (official mentions)
    const checkOfficial = (m) => m?.contextInfo?.mentionedJid?.length > 0;
    
    const hasOfficialMention = checkOfficial(msg.extendedTextMessage) || 
                               checkOfficial(msg.imageMessage) || 
                               checkOfficial(msg.videoMessage) || 
                               checkOfficial(msg.documentMessage) || 
                               checkOfficial(msg.audioMessage);
    
    // Check for manual @mentions in text
    let hasManualMention = false;
    let detectedNumbers = [];
    
    // Get message text from various message types
    const messageText = msg.message?.conversation || 
                       msg.message?.extendedTextMessage?.text || 
                       msg.message?.imageMessage?.caption || 
                       msg.message?.videoMessage?.caption || 
                       msg.message?.documentMessage?.caption || 
                       msg.message?.audioMessage?.caption || '';
    
    // Manual mention detection patterns
    if (messageText) {
        // Pattern 1: @ followed by numbers (e.g., @1234567890)
        const atPattern = /@(\d+)/g;
        const atMatches = [...messageText.matchAll(atPattern)];
        detectedNumbers = [...detectedNumbers, ...atMatches.map(m => m[1])];
        
        // Pattern 2: Standalone phone numbers (10+ digits)
        const numberPattern = /\b\d{10,15}\b/g;
        const numberMatches = [...messageText.matchAll(numberPattern)];
        detectedNumbers = [...detectedNumbers, ...numberMatches.map(m => m[0])];
        
        // Pattern 3: Common mention formats like: mention @user, tagging @123, etc.
        const mentionKeywords = ['mention', 'tagging', 'tag', '@', 'at'];
        const containsMentionKeyword = mentionKeywords.some(keyword => 
            messageText.toLowerCase().includes(keyword.toLowerCase())
        );
        
        if (containsMentionKeyword) {
            // Extract any numbers near mention keywords
            const keywordPattern = /(?:mention|tagging|tag|at)\s*[@]?\s*(\d+)/gi;
            const keywordMatches = [...messageText.matchAll(keywordPattern)];
            detectedNumbers = [...detectedNumbers, ...keywordMatches.map(m => m[1])];
        }
        
        // Remove duplicates and filter valid phone numbers
        detectedNumbers = [...new Set(detectedNumbers)]
            .filter(num => num.length >= 10 && num.length <= 15)
            .map(num => num.replace(/\D/g, '')) // Ensure only digits
            .filter(num => {
                // Basic phone number validation (not starting with 0, length check)
                return num.length >= 10 && !num.startsWith('0');
            });
        
        hasManualMention = detectedNumbers.length > 0;
        
        // If we found manual mentions, add them to the message context
        if (hasManualMention && !msg.message.contextInfo) {
            msg.message.contextInfo = msg.message.contextInfo || {};
            msg.message.contextInfo.mentionedJid = detectedNumbers.map(num => num + '@s.whatsapp.net');
        }
    }
    
    return hasOfficialMention || hasManualMention;
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
            case 'test':
                return testDetection(sock, chatId, message, args.slice(1).join(' '));
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
        warnings: {},
        detectionTypes: {
            officialMentions: true,
            atSymbol: true,
            phoneNumbers: true,
            mentionKeywords: true
        }
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
        text: `✅ Anti-Mention Enabled\nMode: ${mode} (${modeText})\nAdmins are exempted.\n\nDetection includes:\n• Official mentions\n• @symbol mentions\n• Phone numbers\n• Mention keywords` 
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

async function testDetection(sock, chatId, message, testText) {
    if (!testText) {
        return sock.sendMessage(chatId, { 
            text: 'Usage: .antimention test [text]\nExample: .antimention test @1234567890' 
        }, { quoted: message });
    }
    
    const mockMessage = {
        message: {
            conversation: testText
        }
    };
    
    const hasMention = hasMentions(mockMessage);
    const detectedNumbers = mockMessage.message.contextInfo?.mentionedJid || [];
    
    let result = `🔍 Detection Test:\nText: "${testText}"\n\n`;
    result += `✅ Mentions Detected: ${hasMention ? 'YES' : 'NO'}\n`;
    
    if (detectedNumbers.length > 0) {
        result += `📱 Detected Numbers:\n`;
        detectedNumbers.forEach(num => {
            result += `• ${num}\n`;
        });
    } else {
        result += `No phone numbers detected.`;
    }
    
    sock.sendMessage(chatId, { text: result }, { quoted: message });
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

.antimention test [text]
  Test mention detection

Example:
.antimention on delete

📌 Detects:
• Official WhatsApp mentions
• @symbol mentions (@1234567890)
• Phone numbers in text
• Mention keywords (mention, tag, etc.)`;

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
                        text: `🚫 @${senderNum} - Message deleted (mention detected)`,
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
    setupAntimentionListener,
    hasMentions // Export for testing
};
