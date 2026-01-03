// chaneljidCommand.js

async function chaneljidCommand(sock, chatId, message) {
    try {
        // ─────────────────────────────
        // HELPERS
        // ─────────────────────────────
        const normalizeInput = (input) => input?.trim().toLowerCase() || null;

        const fetchMeta = async (type, value) => {
            try {
                return await sock.newsletterMetadata(type, value);
            } catch (err) {
                console.error(`[ChannelJID] Metadata fetch failed: ${err.message}`);
                return null;
            }
        };

        const formatNumber = (num) => (num ? num.toLocaleString() : 'N/A');

        const shortenText = (text, max = 80) => {
            if (!text) return 'N/A';
            return text.length > max ? text.slice(0, max - 3) + '...' : text;
        };

        // ─────────────────────────────
        // INPUT PARSING
        // ─────────────────────────────
        const text =
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            '';

        const args = text.trim().split(/\s+/).slice(1);
        const sender = message.key.participant || message.key.remoteJid;

        let targetJid = null;
        let meta = null;
        let method = 'Unknown';
        let type = 'Chat';

        // ─────────────────────────────
        // METHOD 1: Argument provided
        // ─────────────────────────────
        if (args[0]) {
            const input = normalizeInput(args[0]);

            if (input.endsWith('@newsletter')) {
                // Case A: Direct Channel JID
                targetJid = input;
                method = 'Direct JID';
                type = 'Channel';
                meta = await fetchMeta('jid', targetJid);
            } else if (input.includes('whatsapp.com/channel/')) {
                // Case B: Channel link
                const inviteCode = input.split('/channel/')[1]?.split('?')[0]?.trim();
                if (!inviteCode) throw new Error('Invalid channel link format');
                method = 'Invite Link';
                type = 'Channel';
                meta = await fetchMeta('invite', inviteCode);
                targetJid = meta?.id;
            } else if (input.length > 10 && !input.includes('/')) {
                // Case C: Raw invite code
                method = 'Invite Code';
                type = 'Channel';
                meta = await fetchMeta('invite', input);
                targetJid = meta?.id;
            } else {
                // Case D: Assume raw JID (chat/group)
                targetJid = input;
                method = 'Raw JID';
                type = targetJid.endsWith('@g.us') ? 'Group' : 'Chat';
            }
        }

        // ─────────────────────────────
        // METHOD 2: Current chat context
        // ─────────────────────────────
        else {
            targetJid = message.key.remoteJid;
            method = 'Current Context';
            if (targetJid.endsWith('@newsletter')) {
                type = 'Channel';
                meta = await fetchMeta('jid', targetJid);
            } else if (targetJid.endsWith('@g.us')) {
                type = 'Group';
            } else {
                type = 'Chat';
            }
        }

        // ─────────────────────────────
        // VALIDATION
        // ─────────────────────────────
        if (!targetJid) {
            throw new Error('Failed to resolve JID');
        }

        // ─────────────────────────────
        // RESPONSE FORMAT
        // ─────────────────────────────
        let response = `📡 *JID RESOLVED*\n\n🆔 JID:\n${targetJid}\n\n🛠 Method:\n${method}\n📂 Type:\n${type}`;

        if (type === 'Channel' && meta) {
            response += `\n\n📊 Channel Info:
• Name: ${meta.name || 'N/A'}
• Subscribers: ${formatNumber(meta.subscribers)}
• Verified: ${meta.verified ? '✅' : '❌'}
• Description:
${shortenText(meta.description)}`;
        }

        response += `\n\n✅ Checklist:
✓ JID resolved
✓ Metadata optional
✓ Command executed successfully

⚡ Silva MD Tools`;

        await sock.sendMessage(chatId, { text: response }, { quoted: message });

    } catch (err) {
        console.error(`[ChannelJID] Error: ${err.message}`);

        await sock.sendMessage(
            chatId,
            {
                text: `❌ *JID Resolution Failed*\n\nReason:\n${err.message}\n\nChecklist:\n✓ Input is valid\n✓ Bot has internet access\n✓ You are subscribed (for channels)\n\n📌 Usage:\n.channeljid <link | invite-code | JID>`
            },
            { quoted: message }
        );
    }
}

module.exports = { chaneljidCommand };
