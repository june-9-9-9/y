// chaneljidCommand.js

async function chaneljidCommand(sock, chatId, message) {
    try {
        const normalizeInput = (input) => input?.trim().toLowerCase() || null;

        const fetchMeta = async (type, value) => {
            try {
                return await sock.newsletterMetadata(type, value);
            } catch (err) {
                console.error(`[ChannelJID] Metadata fetch failed: ${err.message}`);
                return null;
            }
        };

        const text =
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            '';

        const args = text.trim().split(/\s+/).slice(1);

        let targetJid = null;
        let meta = null;

        if (args[0]) {
            const input = normalizeInput(args[0]);

            if (input.endsWith('@newsletter')) {
                targetJid = input;
                meta = await fetchMeta('jid', targetJid);
            } else if (input.includes('whatsapp.com/channel/')) {
                const inviteCode = input.split('/channel/')[1]?.split('?')[0]?.trim();
                if (!inviteCode) throw new Error('Invalid channel link format');
                meta = await fetchMeta('invite', inviteCode);
                targetJid = meta?.id;
            } else if (input.length > 10 && !input.includes('/')) {
                meta = await fetchMeta('invite', input);
                targetJid = meta?.id;
            } else {
                targetJid = input;
            }
        } else {
            targetJid = message.key.remoteJid;
            if (targetJid.endsWith('@newsletter')) {
                meta = await fetchMeta('jid', targetJid);
            }
        }

        if (!targetJid) throw new Error('Failed to resolve JID');

        // ─────────────────────────────
        // CLEAN JID OUTPUT ONLY
        // ─────────────────────────────
        await sock.sendMessage(chatId, { text: targetJid }, { quoted: message });

    } catch (err) {
        console.error(`[ChannelJID] Error: ${err.message}`);
        await sock.sendMessage(
            chatId,
            {
                text: `❌ *JID Resolution Failed*\n\nReason:\n${err.message}\n\n📌 Usage:\n.channeljid <link | invite-code | JID>`
            },
            { quoted: message }
        );
    }
}

module.exports = { chaneljidCommand };
