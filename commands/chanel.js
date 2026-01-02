async function channeljidCommand(sock, chatId, message) {
    try {
        // Initial reaction 📢
        await sock.sendMessage(chatId, {
            react: { text: "📢", key: message.key }
        });

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const args = text.split(' ').slice(1);
        
        let targetJid = null;

        // 1️⃣ If a link or JID is provided
        if (args[0]) {
            const input = args[0];

            // Newsletter JID directly
            if (input.endsWith('@newsletter')) {
                targetJid = input;
            }
            // WhatsApp channel/newsletter link
            else if (input.includes('whatsapp.com/channel/')) {
                const code = input.split('/').pop().trim();
                targetJid = `120363${code}@newsletter`;
            }
            else {
                return await sock.sendMessage(chatId, { 
                    text: '❌ Invalid channel link or JID\n\n📌 Usage:\n.song <song name>\n.channeljid <channel link or JID>' 
                }, { quoted: message });
            }
        }
        // 2️⃣ If no argument, use current chat JID
        else {
            targetJid = chatId;
        }

        // 3️⃣ Final validation
        if (!targetJid.endsWith('@newsletter')) {
            return await sock.sendMessage(chatId, {
                text: '❌ This is not a WhatsApp channel/newsletter\n\n📌 Tip:\n.channeljid <channel link or JID>',
                contextInfo: {
                    mentionedJid: [message.key.participant || chatId],
                    forwardingScore: 999,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363200367779016@newsletter',
                        newsletterName: 'Silva MD Channels 📢',
                        serverMessageId: Math.floor(Math.random() * 1000)
                    }
                }
            }, { quoted: message });
        }

        // 4️⃣ Output ONLY the JID (clean & obvious)
        await sock.sendMessage(chatId, {
            text: `${targetJid}`,
            contextInfo: {
                mentionedJid: [message.key.participant || chatId],
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363200367779016@newsletter',
                    newsletterName: 'Silva MD Channels 📢',
                    serverMessageId: Math.floor(Math.random() * 1000)
                }
            }
        }, { quoted: message });

        // Success reaction ✅
        await sock.sendMessage(chatId, {
            react: { text: '✅', key: message.key }
        });

    } catch (error) {
        console.error('Error in channeljidCommand:', error);
        await sock.sendMessage(chatId, { 
            text: "Failed to fetch channel JID. Please try again later." 
        }, { quoted: message });
        await sock.sendMessage(chatId, {
            react: { text: '❌', key: message.key }
        });
    }
}

module.exports = channeljidCommand;
