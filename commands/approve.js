const isAdmin = require('../lib/isAdmin');

async function approveCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || "";
        const args = text.trim().split(/\s+/).slice(1);

        if (!chatId.endsWith('@g.us'))
            return sock.sendMessage(chatId, { text: '⚠️ *Group only command.*'}, { quoted: message });

        let metadata;
        try { metadata = await sock.groupMetadata(chatId); }
        catch { return sock.sendMessage(chatId, { text: '❌ *Unable to access group info.*'}, { quoted: message }); }

        const senderId = message.key.participant || message.key.remoteJid;
        const botId = sock.user.id;
        if (!(await isAdmin(sock, chatId, senderId)))
            return sock.sendMessage(chatId, { text: '⛔ *Admins only.*', quoted: message });
        if (!(await isAdmin(sock, chatId, botId)))
            return sock.sendMessage(chatId, { text: '🔒 *Bot must be admin.*'}, { quoted: message });

        let pending;
        try { pending = await sock.groupRequestParticipantsList(chatId); }
        catch { return sock.sendMessage(chatId, { text: '⚠️ *Unable to fetch requests.*'}, { quoted: message }); }

        if (!pending?.length)
            return sock.sendMessage(chatId, { text: '📭 *No pending requests.*'}, { quoted: message });

        // Helper: batch approve
        const batchApprove = async (jids) => {
            const BATCH_SIZE = 50, failed = [];
            for (let i = 0; i < jids.length; i += BATCH_SIZE) {
                const batch = jids.slice(i, i + BATCH_SIZE);
                try {
                    await sock.groupRequestParticipantsUpdate(chatId, batch, "approve");
                    if (i + BATCH_SIZE < jids.length) await new Promise(r => setTimeout(r, 1000));
                } catch {
                    for (const jid of batch) {
                        try { await sock.groupRequestParticipantsUpdate(chatId, [jid], "approve"); }
                        catch { failed.push(jid); }
                    }
                }
            }
            return failed;
        };

        if (args[0]?.toLowerCase() === 'all') {
            const failed = await batchApprove(pending.map(p => p.jid));
            return sock.sendMessage(chatId, {
                text: `📋 *Results*\n✅ Approved: ${pending.length - failed.length}\n❌ Failed: ${failed.length}`,
                mentions: failed.slice(0, 10)
            });
        }

        const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        if (mentioned.length) {
            const valid = mentioned.filter(j => pending.some(p => p.jid === j));
            const invalid = mentioned.filter(j => !pending.some(p => p.jid === j));
            if (!valid.length)
                return sock.sendMessage(chatId, { text: `⚠️ Not pending: ${invalid.map(j => '@' + j.split('@')[0]).join(', ')}`, mentions: invalid, quoted: message });

            const failed = await batchApprove(valid);
            return sock.sendMessage(chatId, {
                text: `📋 *Results*\n✅ Approved: ${valid.length - failed.length}\n❌ Failed: ${failed.length}\n⚠️ Not Pending: ${invalid.length}`,
                mentions: mentioned
            });
        }

        const list = pending.map(p => `• @${p.jid.split('@')[0]}`).join('\n');
        return sock.sendMessage(chatId, {
            text: `📋 *Pending Requests (${pending.length})*\n\n${list}\n\n*Commands:*\n.approve all\n.approve @user`,
            mentions: pending.map(p => p.jid)
        }, { quoted: message });

    } catch (err) {
        console.error('❌ Approve Command Error:', err);
        return sock.sendMessage(chatId, { text: '⚠️ *Unexpected error.*', quoted: message });
    }
}

module.exports = approveCommand;
