function createFakeContact(message) {
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "status@broadcast",
            fromMe: false,
            id: "June x"
        },
        message: {
            contactMessage: {
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:DAVE X\nitem1.TEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

async function chaneljidCommand(sock, chatId, message) {
    const fake = createFakeContact(message);

    const text = message.message?.conversation || 
                 message.message?.extendedTextMessage?.text || '';

    const url = text.split(' ').slice(1).join(' ').trim();

    if (!url) {
        return sock.sendMessage(chatId, { 
            text: 'Example: chjid https://whatsapp.com/chanel/...'
        }, { quoted: message });
    }

    if (!url.includes("https://whatsapp.com/channel/")) {
        return sock.sendMessage(chatId, { 
            text: 'Invalid WhatsApp channel link'
        }, { quoted: fake });
    }

    try {
        const result = url.split('https://whatsapp.com/channel/')[1];
        const res = await sock.newsletterMetadata("invite", result);

        const info = `ID: ${res.id}\nName: ${res.name}\nFollower: ${res.subscribers}\nStatus: ${res.state}\nVerified: ${res.verification === "VERIFIED" ? "Yes" : "No"}`;
        
               await sock.sendMessage(chatId, { 
            text: `${res.id}`
        }, { quoted: message });
        

    } catch (error) {
        console.error('ChannelJID Error:', error);
        await sock.sendMessage(chatId, { 
            text: 'Failed to get channel info'
        }, { quoted: message });
    }
}

module.exports = { chaneljidCommand };
