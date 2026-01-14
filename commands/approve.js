const isAdmin = require('../lib/isAdmin');

async function approveCommand(sock, chatId, message) {
    const reply = (text, extra = {}) =>
        sock.sendMessage(chatId, { text, quoted: message, ...extra });

    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || "";
        const args = text.trim().split(/\s+/).slice(1);
        const senderId = message.key.participant || message.key.remoteJid;
        const botId = sock.user.id;

        if (!chatId.endsWith('@g.us'))
            return reply('⚠️ *This command is only available in groups.*');

        let metadata;
        try { metadata = await sock.groupMetadata(chatId); }
        catch { return reply('❌ *Unable to access group information.*'); }
        if (!metadata) return reply('❌ *Group information not found.*');

        const [senderIsAdmin, botIsAdmin] = await Promise.all([
            isAdmin(sock, chatId, senderId),
            isAdmin(sock, chatId, botId)
        ]);
        if (!senderIsAdmin) return reply('⛔ *Permission Denied*\n\nOnly admins can use this.');
        if (!botIsAdmin) return reply('🔒 *Bot Permission Required*\n\nPromote the bot to admin.');

        let pending;
        try { pending = await sock.groupRequestParticipantsList(chatId); }
        catch { return reply('⚠️ *Unable to fetch pending requests.*'); }
        if (!pending?.length) return reply('📭 *No Pending Requests*');

        // Approve all
        if (args[0]?.toLowerCase() === 'all') {
            let approved = 0, failed = 0;
            for (const p of pending) {
                try { await sock.groupRequestParticipantsUpdate(chatId, [p.jid], "approve"); approved++; }
                catch { failed++; }
            }
            return reply(
                `📋 *Approval Results*\n\n✅ Approved: ${approved}\n❌ Failed: ${failed}\n📊 Total: ${pending.length}`
            );
        }

        // Approve mentioned
        if (args.length) {
            const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (!mentioned.length)
                return reply('❌ *Invalid Usage*\n\nUse `.approve all` or `.approve @user`');

            const approved = [], failed = [], notPending = [];
            for (const jid of mentioned) {
                if (pending.some(p => p.jid === jid)) {
                    try { await sock.groupRequestParticipantsUpdate(chatId, [jid], "approve"); approved.push(jid); }
                    catch { failed.push(jid); }
                } else notPending.push(jid);
            }

            const format = arr => arr.map(j => `@${j.split('@')[0]}`).join(', ');
            return reply(
                `📋 *Approval Results*\n\n` +
                (approved.length ? `✅ Approved: ${format(approved)}\n\n` : '') +
                (failed.length ? `❌ Failed: ${format(failed)}\n\n` : '') +
                (notPending.length ? `⚠️ Not Pending: ${format(notPending)}` : ''),
                { mentions: mentioned }
            );
        }

        // Show pending list
        const list = pending.map(p => `• @${p.jid.split('@')[0]}`).join('\n');
        return reply(
            `📋 *Pending Join Requests (${pending.length})*\n\n${list}\n\n*Commands:*\n.approve all\n.approve @user`,
            { mentions: pending.map(p => p.jid) }
        );

    } catch (err) {
        console.error('❌ Approve Command Error:', err);
        return reply('⚠️ *An unexpected error occurred.*');
    }
}

module.exports = approveCommand;
