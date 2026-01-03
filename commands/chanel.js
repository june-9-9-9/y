async function chaneljidCommand(sock, chatId, message) {
    try {
        const text =
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            ''

        const args = text.trim().split(/\s+/).slice(1)
        const sender = message.key.participant || message.key.remoteJid

        let channelJid = null
        let channelMeta = null
        let method = 'Unknown'

        // ─────────────────────────────
        // METHOD 1: Argument provided
        // ─────────────────────────────
        if (args[0]) {
            const input = args[0].trim()

            // Case A: Direct newsletter JID
            if (input.endsWith('@newsletter')) {
                channelJid = input
                method = 'Direct JID'

                try {
                    channelMeta = await sock.newsletterMetadata('jid', channelJid)
                } catch (metaErr) {
                    console.log('Metadata fetch failed, JID still valid:', metaErr.message)
                }
            }

            // Case B: WhatsApp channel link
            else if (input.includes('whatsapp.com/channel/')) {
                const inviteCode = input
                    .split('/channel/')[1]
                    ?.split('?')[0]
                    ?.trim()

                if (!inviteCode) {
                    throw new Error('Invalid channel link format')
                }

                method = 'Invite Link'

                try {
                    channelMeta = await sock.newsletterMetadata('invite', inviteCode)
                    channelJid = channelMeta?.id
                } catch (metaErr) {
                    // Fallback: Try to follow the channel first
                    try {
                        const followResult = await sock.newsletterFollow(inviteCode)
                        channelJid = followResult?.id || `${inviteCode}@newsletter`
                        method = 'Invite Link (via follow)'
                    } catch (followErr) {
                        // Last resort: construct JID from invite code
                        channelJid = `${inviteCode}@newsletter`
                        method = 'Invite Link (constructed)'
                    }
                }
            }

            // Case C: Raw invite code
            else if (input.length > 10 && !input.includes('/')) {
                method = 'Invite Code'

                try {
                    channelMeta = await sock.newsletterMetadata('invite', input)
                    channelJid = channelMeta?.id
                } catch (metaErr) {
                    // Fallback: Try to follow or construct
                    try {
                        const followResult = await sock.newsletterFollow(input)
                        channelJid = followResult?.id || `${input}@newsletter`
                        method = 'Invite Code (via follow)'
                    } catch (followErr) {
                        channelJid = `${input}@newsletter`
                        method = 'Invite Code (constructed)'
                    }
                }
            }

            else {
                throw new Error('Invalid channel input format')
            }
        }

        // ─────────────────────────────
        // METHOD 2: Current chat
        // ─────────────────────────────
        else {
            const currentJid = message.key.remoteJid

            if (!currentJid.endsWith('@newsletter')) {
                return await sock.sendMessage(
                    chatId,
                    {
                        text:
`❌ This is not a WhatsApp channel

📌 Usage:
.channeljid <channel link | invite code | JID>

💡 Tip:
Run the command inside a channel to get its JID`
                    },
                    { quoted: message }
                )
            }

            channelJid = currentJid
            method = 'Current Channel'

            try {
                channelMeta = await sock.newsletterMetadata('jid', channelJid)
            } catch (metaErr) {
                console.log('Metadata fetch failed for current channel:', metaErr.message)
            }
        }

        // ─────────────────────────────
        // VALIDATION
        // ─────────────────────────────
        if (!channelJid || !channelJid.endsWith('@newsletter')) {
            throw new Error('Failed to resolve channel JID. Try subscribing to the channel first.')
        }

        // ─────────────────────────────
        // RESPONSE FORMAT
        // ─────────────────────────────
        const response =
`📡 *CHANNEL JID RESOLVED*

🆔 JID:
\`${channelJid}\`

🛠 Method:
${method}
${
    channelMeta
        ? `
📊 Channel Info:
• Name: ${channelMeta.name || 'N/A'}
• Subscribers: ${channelMeta.subscribers || 'N/A'}
• Verified: ${channelMeta.verified ? '✅' : '❌'}
• Description:
${channelMeta.description?.substring(0, 80) || 'N/A'}`
        : '\n⚠️ Metadata unavailable (JID is still valid)'
}

⚡ Silva MD Channel Tools`

        await sock.sendMessage(
            chatId,
            { text: response },
            { quoted: message }
        )

    } catch (err) {
        console.error('❌ ChannelJID Error:', err)

        await sock.sendMessage(
            chatId,
            {
                text:
`❌ *Channel JID Resolution Failed*

Reason:
${err.message}

Checklist:
✓ Channel must be public
✓ Link format: whatsapp.com/channel/XXXXX
✓ You must be subscribed to the channel
✓ Bot needs proper WhatsApp connection

📌 Usage:
.channeljid <link | invite-code | JID>

💡 Try:
1. Subscribe to the channel first
2. Run command inside the channel
3. Use the full channel link`
            },
            { quoted: message }
        )
    }
}

module.exports = { chaneljidCommand }
