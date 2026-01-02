// Channel JID Extractor (Clean Output)
async function channelJidCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;

        // Extract args from the message text
        const args = text ? text.trim().split(/\s+/).slice(1) : [];

        let targetJid = null;

        // 1️⃣ If a link or JID is provided
        if (args[0]) {
            const input = args[0];

            if (input.endsWith('@newsletter')) {
                targetJid = input;
            } else if (input.includes('whatsapp.com/channel/')) {
                const code = input.split('/').pop().trim();
                targetJid = `120363${code}@newsletter`;
            } else {
                return await sock.sendMessage(chatId, { text: '❌ Invalid channel link or JID' }, { quoted: message });
            }
        } 
        // 2️⃣ If no argument, use current chat JID
        else {
            targetJid = message.key.remoteJid;
        }

        // 3️⃣ Final validation
        if (!targetJid.endsWith('@newsletter')) {
            return await sock.sendMessage(
                chatId,
                { text: '❌ Not a WhatsApp channel/newsletter\n\n📌 Usage:\n.channeljid <channel link or JID>' },
                { quoted: message }
            );
        }

        // 4️⃣ Output ONLY the clean JID
        await sock.sendMessage(chatId, { text: targetJid }, { quoted: message });

    } catch (err) {
        console.error('❌ ChannelJID Error:', err);
        await sock.sendMessage(chatId, { text: '⚠️ Failed to fetch channel JID' }, { quoted: message });
    }
}

module.exports = { channelJidCommand };
