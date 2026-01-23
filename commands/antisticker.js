const { setAntisticker, getAntisticker, removeAntisticker } = require('../lib/database');
const isAdmin = require('../lib/isAdmin');

/**
 * Create a fake quoted contact message for replies
 */
function createFakeContact(message) {
    const participantId =
        message?.key?.participant?.split('@')[0] ||
        message?.key?.remoteJid?.split('@')[0] ||
        '0';

    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "0@s.whatsapp.net",
            fromMe: false
        },
        message: {
            contactMessage: {
                displayName: "JUNE-X",
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:JUNE-X\nitem1.TEL;waid=${participantId}:${participantId}\nitem1.X-ABLabel:Phone\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

/**
 * Antisticker command handler
 */
async function antistickerCommand(sock, chatId, message, senderId) {
    const fake = createFakeContact(message);

    try {
        const isSenderAdmin = await isAdmin(sock, chatId, senderId);
        if (!isSenderAdmin) {
            return sock.sendMessage(chatId, { text: '❌ For Group Admins Only' }, { quoted: fake });
        }

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const args = text.trim().split(/\s+/).slice(1);
        const action = args[0]?.toLowerCase();

        const actionEmoji = {
            delete: '🗑️',
            kick: '👢',
            warn: '⚠️'
        };

        if (!action) {
            const usage = `💬 *ANTISTICKER SETUP*\n\nCommands:\n• .antisticker on\n• .antisticker set delete\n• .antisticker set kick\n• .antisticker set warn\n• .antisticker off\n• .antisticker status`;
            return sock.sendMessage(chatId, { text: usage }, { quoted: fake });
        }

        switch (action) {
            case 'on':
                await setAntisticker(chatId, true, 'delete');
                return sock.sendMessage(chatId, {
                    text: '✅ Antisticker has been turned ON\n\n🛡️ Action: Delete sticker\n\nNon-admins cannot send stickers'
                }, { quoted: fake });

            case 'off':
                await removeAntisticker(chatId);
                return sock.sendMessage(chatId, {
                    text: '❌ Antisticker has been turned OFF\n\nEveryone can now send stickers'
                }, { quoted: fake });

            case 'set': {
                const setAction = args[1]?.toLowerCase();
                if (!['delete', 'kick', 'warn'].includes(setAction)) {
                    return sock.sendMessage(chatId, {
                        text: '❌ Invalid action. Choose:\n• delete\n• kick\n• warn'
                    }, { quoted: fake });
                }

                await setAntisticker(chatId, true, setAction);
                return sock.sendMessage(chatId, {
                    text: `✅ Antisticker action set to: ${actionEmoji[setAction]} *${setAction.toUpperCase()}*\n\nStatus: ON`
                }, { quoted: fake });
            }

            case 'status': {
                const config = await getAntisticker(chatId);
                if (!config?.enabled) {
                    return sock.sendMessage(chatId, {
                        text: '💬 *Antisticker Status*\n\n❌ Status: OFF\n\nUse `.antisticker on` to enable'
                    }, { quoted: fake });
                }

                return sock.sendMessage(chatId, {
                    text: `💬 *Antisticker Status*\n\n✅ Status: ON\n${actionEmoji[config.action]} Action: ${config.action.toUpperCase()}\n\n🛡️ Non-admins cannot send stickers`
                }, { quoted: fake });
            }

            default:
                return sock.sendMessage(chatId, {
                    text: '❌ Invalid command. Use:\n• on\n• off\n• set\n• status'
                }, { quoted: fake });
        }
    } catch (error) {
        console.error('Error in antistickerCommand:', error);
        return sock.sendMessage(chatId, { text: '❌ An error occurred while processing the command' }, { quoted: fake });
    }
}

/**
 * Sticker detection handler
 */
async function handleStickerDetection(sock, chatId, message, senderId) {
    try {
        const config = await getAntisticker(chatId);
        if (!config?.enabled) return;

        const hasSticker = !!message.message?.stickerMessage;
        if (!hasSticker) return;

        const senderIsAdmin = await isAdmin(sock, chatId, senderId);
        if (senderIsAdmin) return;

        console.log(`Antisticker triggered by ${senderId} in ${chatId}`);
        const fake = createFakeContact(message);

        // Always delete sticker first
        try {
            await sock.sendMessage(chatId, { delete: message.key });
        } catch (err) {
            console.error('Failed to delete sticker:', err);
        }

        switch (config.action) {
            case 'delete':
                console.log('Sticker deleted');
                break;

            case 'warn':
                await sock.sendMessage(chatId, {
                    text: `⚠️ @${senderId.split('@')[0]}\n\nSending stickers is not allowed in this group!\n\nOnly admins can send stickers.`,
                    mentions: [senderId]
                }, { quoted: fake });
                console.log('Sticker deleted and warning sent');
                break;

            case 'kick':
                await sock.sendMessage(chatId, {
                    text: `🚫 @${senderId.split('@')[0]} has been removed for sending stickers.`,
                    mentions: [senderId]
                }, { quoted: fake });

                try {
                    await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
                    console.log('Sticker deleted and user kicked');
                } catch (err) {
                    console.error('Failed to kick user:', err);
                }
                break;
        }
    } catch (error) {
        console.error('Error in handleStickerDetection:', error);
    }
}

module.exports = {
    antistickerCommand,
    handleStickerDetection
};
