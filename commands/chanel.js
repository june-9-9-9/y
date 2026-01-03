async function chaneljidCommand(sock, chatId, message) {
    try {
        // ✅ Ensure command only runs inside a channel/newsletter
        if (!message.key.remoteJid.endsWith('@newsletter')) {
            return await sock.sendMessage(
                chatId,
                { text: '❌ This command can only be used inside a WhatsApp channel/newsletter.' },
                { quoted: message }
            );
        }

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        let args = [];
        if (text) {
            args = text.trim().split(/\s+/).slice(1);
        }
        
        let targetJid = null;

        if (args[0]) {
            const input = args[0];
            if (input.endsWith('@newsletter')) {
                targetJid = input;
            } else if (input.includes('whatsapp.com/channel/')) {
                const code = input.split('/').pop().trim();
                targetJid = `120363${code}@newsletter`;
            } else {
                return await sock.sendMessage(
                    chatId,
                    { text: '❌ Invalid channel link or JID' },
                    { quoted: message }
                );
            }
        } else {
            targetJid = message.key.remoteJid;
        }

        if (!targetJid.endsWith('@newsletter')) {
            return await sock.sendMessage(
                chatId,
                { text: '❌ This is not a valid WhatsApp channel/newsletter\n\n📌 Tip:\n.channeljid <channel link or JID>' },
                { quoted: message }
            );
        }

        await sock.sendMessage(chatId, { text: `${targetJid}` }, { quoted: message });

    } catch (err) {
        console.error('❌ ChannelJID Error:', err);
        await sock.sendMessage(chatId, { text: '⚠️ Failed to fetch channel JID' }, { quoted: message });
    }
}

module.exports = { chaneljidCommand };
