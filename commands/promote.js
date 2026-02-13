const { isAdmin } = require('../lib/isAdmin');

async function promoteCommand(sock, chatId, mentionedJids, message) {
    let userToPromote = [];
    
    if (mentionedJids?.length > 0) {
        userToPromote = mentionedJids;
    }
    else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
        userToPromote = [message.message.extendedTextMessage.contextInfo.participant];
    }
    
    if (userToPromote.length === 0) {
        await sock.sendMessage(chatId, { 
            text: 'Please mention the user or reply to their message to promote!'
        });
        return;
    }

    try {
        await sock.groupParticipantsUpdate(chatId, userToPromote, "promote");
        
        const promotedUsers = userToPromote.map(jid => `@${jid.split('@')[0]}`).join(', ');
        
        const promotionMessage = `Promoted: ${promotedUsers}`;
        
        await sock.sendMessage(chatId, { 
            text: promotionMessage,
            mentions: userToPromote
        });
    } catch (error) {
        console.error('Error in promote command:', error);
        await sock.sendMessage(chatId, { text: 'Failed to promote user(s)!'});
    }
}

async function handlePromotionEvent(sock, groupId, participants, author) {
    try {
        if (!Array.isArray(participants) || participants.length === 0) return;

        const botJid = sock.user.id;
        const authorJid = typeof author === 'string' ? author : (author?.id || '');
        
        if (authorJid !== botJid) return;

        const promotedUsers = participants.map(jid => {
            const jidString = typeof jid === 'string' ? jid : (jid.id || '');
            return `@${jidString.split('@')[0]}`;
        }).join(', ');
        
        const promotionMessage = `Promoted: ${promotedUsers}`;
        
        const mentionList = participants.map(jid => 
            typeof jid === 'string' ? jid : (jid.id || '')
        );

        await sock.sendMessage(groupId, {
            text: promotionMessage,
            mentions: mentionList
        });
    } catch (error) {
        console.error('Error handling promotion event:', error);
    }
}

module.exports = { promoteCommand, handlePromotionEvent };
