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

        let channelJid = null;
        let channelMeta = null;
        let method = 'Unknown';

        // ─────────────────────────────
        // METHOD 1: Argument provided
        // ─────────────────────────────
        if (args[0]) {
            const input = normalizeInput(args[0]);

            if (input.endsWith('@newsletter')) {
                // Case A: Direct JID
                channelJid = input;
                method = 'Direct JID';
                channelMeta = await fetchMeta('jid', channelJid);
            } else if (input.includes('whatsapp.com/channel/')) {
                // Case B: Channel link
                const inviteCode = input.split('/channel/')[1]?.split('?')[0]?.trim();
                if (!inviteCode) throw new Error('Invalid channel link format');
                method = 'Invite Link';
                channelMeta = await fetchMeta('invite', inviteCode);
                channelJid = channelMeta?.id;
            } else if (input.length > 10 && !input.includes('/')) {
                // Case C: Raw invite code
                method = 'Invite Code';
                channelMeta = await fetchMeta('invite', input);
                channelJid = channelMeta?.id;
            } else {
                throw new Error('Invalid channel input');
            }
        }

        // ─────────────────────────────
        // METHOD 2: Current chat
        // ─────────────────────────────
        else {
            const currentJid = message.key.remoteJid;
            if (!currentJid.endsWith('@newsletter')) {
                return await sock.sendMessage(
                    chatId,
                    {
                        text: `❌ This is not a WhatsApp channel

📌 Usage:
.channeljid <channel link | invite code | JID>

💡 Tip:
Run the command inside a channel to get its JID`
                    },
                    { quoted: message }
                );
            }
            channelJid = currentJid;
            method = 'Current Channel';
            channelMeta = await fetchMeta('jid', channelJid);
        }

        // ─────────────────────────────
        // VALIDATION
        // ─────────────────────────────
        if (!channelJid || !channelJid.endsWith('@newsletter')) {
            throw new Error('Failed to resolve channel JID');
        }

        // ─────────────────────────────
        // RESPONSE FORMAT
        // ─────────────────────────────
        const response = `📡 *CHANNEL JID RESOLVED*

🆔 JID:
${channelJid}

🛠 Method:
${method}
${channelMeta ? `
📊 Channel Info:
• Name: ${channelMeta.name || 'N/A'}
• Subscribers: ${formatNumber(channelMeta.subscribers)}
• Verified: ${channelMeta.verified ? '✅' : '❌'}
• Description:
${shortenText(channelMeta.description)}` : ''}

✅ Checklist:
✓ JID resolved
✓ Metadata optional
✓ Command executed successfully

⚡ Silva MD Channel Tools`;

        await sock.sendMessage(chatId, { text: response }, { quoted: message });

    } catch (err) {
        console.error(`[ChannelJID] Error: ${err.message}`);

        await sock.sendMessage(
            chatId,
            {
                text: `❌ *Channel JID Resolution Failed*

Reason:
${err.message}

Checklist:
✓ Channel is public
✓ Link or invite code is valid
✓ Bot has internet access
✓ You are subscribed to the channel

📌 Usage:
.channeljid <link | invite-code | JID>`
            },
            { quoted: message }
        );
    }
}

module.exports = { chaneljidCommand };
