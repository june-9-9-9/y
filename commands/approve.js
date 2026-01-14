async function approveCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || "";
        const args = text.trim().split(/\s+/).slice(1);

        // Group metadata
        const metadata = await sock.groupMetadata(chatId).catch(() => null);
        if (!metadata) return sock.sendMessage(chatId, { text: '❌ Group only command.' }, { quoted: message });

        // Sender & bot admin check
        const sender = metadata.participants.find(p => [message.key.participant, message.key.remoteJid].includes(p.id));
        const bot = metadata.participants.find(p => p.id.includes(sock.user.id.split(':')[0]));
        if (!sender?.admin) return sock.sendMessage(chatId, { text: '❌ Admins only.' }, { quoted: message });
        if (!bot?.admin) return sock.sendMessage(chatId, { text: '❌ I need admin rights.' }, { quoted: message });

        // Pending requests
        const pending = await sock.groupRequestParticipantsList(chatId).catch(() => []);
        if (!pending.length) return sock.sendMessage(chatId, { text: '📭 No pending requests.' }, { quoted: message });

        if (args[0]?.toLowerCase() === 'all') {
            // Approve all
            for (const p of pending) {
                await sock.groupRequestParticipantsUpdate(chatId, [p.jid], "approve").catch(() => {});
            }
            return sock.sendMessage(chatId, { text: `✅ Approved all ${pending.length} requests.` }, { quoted: message });
        }

        if (args.length) {
            // Approve mentioned
            const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (!mentioned.length) return sock.sendMessage(chatId, { text: '❌ Mention users or use ".approve all".' }, { quoted: message });

            const approved = [], failed = [];
            for (const jid of mentioned) {
                if (pending.some(p => p.jid === jid)) {
                    await sock.groupRequestParticipantsUpdate(chatId, [jid], "approve")
                        .then(() => approved.push(jid.split('@')[0]))
                        .catch(() => failed.push(jid.split('@')[0]));
                } else failed.push(jid.split('@')[0]);
            }

            return sock.sendMessage(chatId, { text: `✅ Approved: ${approved.join(', ')}\n❌ Failed: ${failed.join(', ')}`.trim() }, { quoted: message });
        }

        // Show pending list
        const list = pending.map(p => `• @${p.jid.split('@')[0]}`).join('\n');
        return sock.sendMessage(chatId, {
            text: `📋 *Pending Requests (${pending.length}):*\n\n${list}\n\nUse:\n• .approve all\n• .approve @user`,
            mentions: pending.map(p => p.jid)
        }, { quoted: message });

    } catch (err) {
        console.error('❌ Approve Command Error:', err);
        sock.sendMessage(chatId, { text: '⚠️ Error processing request.' }, { quoted: message });
    }
}

module.exports = approveCommand;
