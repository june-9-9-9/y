async function chaneljidCommand(sock, chatId, message) {
    try {
        // Get message text
        const text = message.message?.conversation || 
                    message.message?.extendedTextMessage?.text || '';
        
        // Get command arguments (remove command word)
        const args = text.trim().split(' ').slice(1);
        
        // User must provide link/JID
        if (!args[0]) {
            return sock.sendMessage(chatId, { 
                text: '❌ Please provide a WhatsApp channel link\nExample: !channeljid https://whatsapp.com/channel/XXXXXXX' 
            });
        }
        
        const input = args[0];
        let jid;
        
        // If it's already a JID
        if (input.includes('@newsletter')) {
            jid = input;
        }
        // If it's a WhatsApp channel link
        else if (input.includes('whatsapp.com/channel/')) {
            const code = input.split('/').pop();
            jid = `120363${code}@newsletter`;
        }
        // Invalid input
        else {
            return sock.sendMessage(chatId, { 
                text: '❌ Invalid WhatsApp channel link' 
            });
        }
        
        // Send the JID
        await sock.sendMessage(chatId, { 
            text: jid 
        });
        
    } catch (error) {
        console.error('Error:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Error getting channel JID' 
        });
    }
}

module.exports = { chaneljidCommand };
