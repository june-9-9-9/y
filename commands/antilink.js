const { setAntilink, getAntilink, removeAntilink } = require('../lib/index');
const isAdmin = require('../lib/isAdmin');

// Link detection patterns
const linkPatterns = {
    whatsappGroup: /chat\.whatsapp\.com\/[A-Za-z0-9]{20,}/,
    whatsappChannel: /wa\.me\/channel\/[A-Za-z0-9]{20,}/,
    telegram: /t\.me\/[A-Za-z0-9_]+/,
    allLinks: /https?:\/\/[^\s]+/,
};

// Check if message contains links
function containsLink(text) {
    if (!text) return false;
    return (
        linkPatterns.whatsappGroup.test(text) ||
        linkPatterns.whatsappChannel.test(text) ||
        linkPatterns.telegram.test(text) ||
        linkPatterns.allLinks.test(text)
    );
}

// Enforcement handler (unchanged)
async function enforce(sock, chatId, sender, msg, action) {
    const quotedMessageId = msg.key.id;
    const quotedParticipant = msg.key.participant || sender;

    switch (action) {
        case 'warn':
            await sock.sendMessage(chatId, { 
                text: `⚠️ Warning! @${sender.split('@')[0]}, posting links is not allowed.`, 
                mentions: [sender] 
            });
            return { success: true, action: 'warned' };

        case 'delete':
            try {
                await sock.sendMessage(chatId, {
                    delete: { remoteJid: chatId, fromMe: false, id: quotedMessageId, participant: quotedParticipant }
                });
                console.log(`Message with ID ${quotedMessageId} deleted successfully.`);
                return { success: true, action: 'deleted' };
            } catch (e) {
                console.error('Delete failed:', e);
                return { success: false, error: e };
            }

        case 'kick':
            // Only valid in groups
            try {
                await sock.groupParticipantsUpdate(chatId, [sender], 'remove');
                await sock.sendMessage(chatId, { 
                    text: `🚫 User @${sender.split('@')[0]} has been removed for posting links.`,
                    mentions: [sender]
                });
                return { success: true, action: 'kicked' };
            } catch (e) {
                console.error('Kick failed:', e);
                return { success: false, error: e };
            }

        default:
            return { success: false, error: 'Invalid action' };
    }
}

// Real-time listener setup
let isListenerSetup = false;

function setupAntiLinkListener(sock) {
    sock.ev.on('messages.upsert', async ({ messages }) => {
        try {
            const msg = messages[0];
            if (!msg || msg.key.fromMe) return;

            const chatId = msg.key.remoteJid;
            const sender = msg.key.participant || msg.key.remoteJid;
            if (!sender) return;

            const antilinkConfig = await getAntilink(chatId, 'on');
            if (!antilinkConfig?.enabled) return;

            const text =
                msg.message?.conversation ||
                msg.message?.extendedTextMessage?.text ||
                msg.message?.imageMessage?.caption ||
                msg.message?.videoMessage?.caption ||
                msg.message?.documentMessage?.caption || '';

            if (!containsLink(text)) return;

            // Admin check only for groups
            let senderIsAdmin = false;
            if (chatId.endsWith('@g.us')) {
                try {
                    senderIsAdmin = await isAdmin(sock, chatId, sender);
                } catch (error) {
                    console.error('Error checking admin status:', error);
                }
            }
            if (senderIsAdmin) {
                console.log(`Sender ${sender} is an admin. Skipping antilink enforcement.`);
                return;
            }

            // Allowed links check
            const allowedConfig = await getAntilink(chatId, 'allowed') || [];
            const allowedLinks = Array.isArray(allowedConfig) ? allowedConfig : [];
            if (allowedLinks.some(link => text.toLowerCase().includes(link.toLowerCase()))) {
                console.log(`Link allowed for pattern in message from ${sender}`);
                return;
            }

            // Enforce action (force delete in private mode)
            const action = chatId.endsWith('@g.us') ? antilinkConfig.action : 'delete';
            const result = await enforce(sock, chatId, sender, msg, action);

            if (!result.success) {
                console.error(`Failed to enforce ${action} mode:`, result.error);
            }
        } catch (error) {
            console.error('Error in anti-link listener:', error);
        }
    });
}

function initializeAntiLink(sock) {
    if (!isListenerSetup) {
        setupAntiLinkListener(sock);
        isListenerSetup = true;
        console.log('✅ Anti-link listener initialized (groups + private)');
    }
}

module.exports = {
    handleAntilinkCommand,
    handleLinkDetection,
    initializeAntiLink
};
