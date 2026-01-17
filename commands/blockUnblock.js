// Utility: delay helper
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// --- Helpers ---
function isOwner(message) {
    return message?.key?.fromMe === true;
}

function getBotId(sock) {
    return sock?.user?.id?.split(':')[0];
}

async function react(sock, chatId, key, emoji) {
    try {
        await sock.sendMessage(chatId, { react: { text: emoji, key } });
    } catch (err) {
        console.warn(`⚠️ Failed to react with ${emoji}:`, err);
    }
}

// --- Commands ---
async function blockCommand(sock, chatId, message) {
    try {
        if (!isOwner(message)) {
            await sock.sendMessage(chatId, { text: '❌ Owner-only command!', quoted: message });
            return react(sock, chatId, message.key, '❌');
        }

        const contextInfo = message.message?.extendedTextMessage?.contextInfo;
        const userToBlock = contextInfo?.participant;

        if (!userToBlock) {
            await sock.sendMessage(chatId, { 
                text: '❌ Reply to a user\'s message to block them!\n\nUsage: Reply with !block',
                quoted: message
            });
            return react(sock, chatId, message.key, '⚠️');
        }

        if (userToBlock.includes(getBotId(sock))) {
            await sock.sendMessage(chatId, { text: '❌ Cannot block the bot itself!', quoted: message });
            return react(sock, chatId, message.key, '🤖');
        }

        await sock.updateBlockStatus(userToBlock, 'block');
        await sock.sendMessage(chatId, { text: `✅ Blocked: ${userToBlock}`, quoted: message });
        await react(sock, chatId, message.key, '✅');

        console.log(`✅ Blocked user: ${userToBlock}`);
    } catch (error) {
        console.error('Error in blockCommand:', error);
        await sock.sendMessage(chatId, { text: '❌ Failed to block user!', quoted: message }).catch(() => {});
        await react(sock, chatId, message.key, '💥');
    }
}

async function blocklistCommand(sock, chatId, message) {
    try {
        if (!isOwner(message)) {
            await sock.sendMessage(chatId, { text: '❌ Owner-only command!', quoted: message });
            return react(sock, chatId, message.key, '❌');
        }

        const blockedContacts = await sock.fetchBlocklist().catch(() => []);
        if (!blockedContacts.length) {
            await sock.sendMessage(chatId, { text: '📋 No blocked contacts found.', quoted: message });
            return react(sock, chatId, message.key, '📭');
        }

        await sock.sendMessage(chatId, { 
            text: `📋 FETCHING BLOCKLIST...\nTotal: ${blockedContacts.length} contacts\nProcessing...`,
            quoted: message
        });
        await react(sock, chatId, message.key, '🔍');

        const chunkSize = 100;
        const totalChunks = Math.ceil(blockedContacts.length / chunkSize);

        for (let chunk = 0; chunk < totalChunks; chunk++) {
            let chunkText = `📋 BLOCKED CONTACTS ${chunk * chunkSize + 1}-${Math.min((chunk + 1) * chunkSize, blockedContacts.length)} of ${blockedContacts.length}\n\n`;
            const startIndex = chunk * chunkSize;
            const endIndex = Math.min((chunk + 1) * chunkSize, blockedContacts.length);

            for (let i = startIndex; i < endIndex; i++) {
                const jid = blockedContacts[i];
                const number = jid.split('@')[0];
                const index = (i + 1).toString().padStart(3, '0');
                chunkText += `${index}. ${number}\n`;
            }

            await sock.sendMessage(chatId, { text: chunkText, quoted: message });
            if (chunk < totalChunks - 1) await delay(1500);
        }

        await sock.sendMessage(chatId, { 
            text: `✅ BLOCKLIST COMPLETE!\nTotal blocked contacts: ${blockedContacts.length}`,
            quoted: message
        });
        await react(sock, chatId, message.key, '✅');
    } catch (error) {
        console.error('Error in blocklistCommand:', error);
        await sock.sendMessage(chatId, { text: '❌ Failed to fetch blocklist!', quoted: message }).catch(() => {});
        await react(sock, chatId, message.key, '💥');
    }
}

async function unblockallCommand(sock, chatId, message) {
    try {
        if (!isOwner(message)) {
            await sock.sendMessage(chatId, { text: '❌ Owner-only command!', quoted: message });
            return react(sock, chatId, message.key, '❌');
        }

        const blockedContacts = await sock.fetchBlocklist().catch(() => []);
        if (!blockedContacts.length) {
            await sock.sendMessage(chatId, { text: '📋 No blocked contacts to unblock.', quoted: message });
            return react(sock, chatId, message.key, '📭');
        }

        await sock.sendMessage(chatId, { 
            text: `🔄 Starting soft unblock of ${blockedContacts.length} contacts...`,
            quoted: message
        });
        await react(sock, chatId, message.key, '🔄');

        let successCount = 0;
        for (const jid of blockedContacts) {
            try {
                await sock.updateBlockStatus(jid, 'unblock');
                successCount++;
                console.log(`✅ Unblocked: ${jid}`);

                if (successCount % 10 === 0) {
                    await sock.sendMessage(chatId, { 
                        text: `🔄 Progress: ${successCount}/${blockedContacts.length} contacts unblocked...`,
                        quoted: message
                    });
                }

                await delay(500);
            } catch {
                console.warn(`⚠️ Failed to unblock: ${jid}`);
            }
        }

        await sock.sendMessage(chatId, { 
            text: `✅ Finished soft unblock. Total unblocked: ${successCount}/${blockedContacts.length}`,
            quoted: message
        });
        await react(sock, chatId, message.key, '✅');

        console.log(`✅ Soft unblock complete: ${successCount}/${blockedContacts.length}`);
    } catch (error) {
        console.error('Error in unblockallCommand:', error);
        await sock.sendMessage(chatId, { text: '❌ Failed to unblock contacts!', quoted: message }).catch(() => {});
        await react(sock, chatId, message.key, '💥');
    }
}

module.exports = {
    blockCommand,
    blocklistCommand,
    unblockallCommand
};
