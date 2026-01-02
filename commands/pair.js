const axios = require('axios');

async function pairCommand(sock, chatId, message) {
    try {
        let phoneNumber = '';

        // Case 1: Reply to a quoted message
        if (message?.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            const quotedMsg = message.message.extendedTextMessage.contextInfo.quotedMessage;
            const quotedText = quotedMsg.conversation ||
                               quotedMsg.extendedTextMessage?.text ||
                               '';
            phoneNumber = quotedText.replace(/[^0-9]/g, '');
        } 
        // Case 2: Direct command in conversation
        else if (message?.message?.conversation) {
            const text = message.message.conversation.trim();
            const args = text.split(/\s+/); // split by spaces
            if (args.length > 1) {
                phoneNumber = args[1].replace(/[^0-9]/g, '');
            }
        }
        // Case 3: Extended text message
        else if (message?.message?.extendedTextMessage?.text) {
            const text = message.message.extendedTextMessage.text.trim();
            const args = text.split(/\s+/);
            if (args.length > 1) {
                phoneNumber = args[1].replace(/[^0-9]/g, '');
            }
        }

        // Validate phone number
        if (!phoneNumber || phoneNumber.trim() === '') {
            return await sock.sendMessage(chatId, { 
                text: "❌ Please provide a phone number!\n\n" +
                      "*Usage:*\n" +
                      "• *.pair 254792021944* (direct)\n" +
                      "• Reply to a message containing a phone number with *.pair*"
            });
        }
        
        if (phoneNumber.length < 10) {
            return await sock.sendMessage(chatId, { 
                text: "❌ Invalid phone number format!\nExample: *.pair 254792021944*" 
            });
        }

        // Normalize WhatsApp ID
        const whatsappID = phoneNumber.includes('@s.whatsapp.net') 
            ? phoneNumber 
            : phoneNumber + '@s.whatsapp.net';
        
        const result = await sock.onWhatsApp(whatsappID);
        
        if (!result || !result[0]?.exists) {
            return await sock.sendMessage(chatId, { 
                text: `❌ Number ${phoneNumber} is not registered on WhatsApp!` 
            });
        }

        // Fetch pairing code
        const response = await axios.get(`https://session-v35f.onrender.com/code?number=${phoneNumber}`, {
            timeout: 10000,
            headers: { 'User-Agent': 'WhatsApp-Bot/1.0' }
        });

        if (!response.data || !response.data.code) {
            return await sock.sendMessage(chatId, { 
                text: "❌ Failed to generate pairing code. API returned no code." 
            });
        }

        const pairingCode = response.data.code;
        
        // Send pairing info
        await sock.sendMessage(chatId, { 
            text: `📱 *PAIRING CODE*\n\n` +
                  `• *Phone:* ${phoneNumber}\n` +
                  `• *Code:* \`${pairingCode}\`\n\n` +
                  `_Code will be sent separately for easy copying..._`
        });

        await new Promise(resolve => setTimeout(resolve, 1500));
        await sock.sendMessage(chatId, { text: `\`\`\`${pairingCode}\`\`\`` });

        await new Promise(resolve => setTimeout(resolve, 1000));
        await sock.sendMessage(chatId, { 
            text: `*How to use:*\n1. Open WhatsApp on your phone\n2. Go to Settings → Linked Devices\n3. Tap on "Link a Device"\n4. Enter the code above`
        });

    } catch (error) {
        console.error('Pair command error:', error);
        
        let errorMessage = "❌ An error occurred. Please try again later.";
        
        if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
            errorMessage = "❌ Request timeout. The pairing service is taking too long to respond.";
        } else if (error.response) {
            errorMessage = `❌ API Error: ${error.response.status}`;
        } else if (error.request) {
            errorMessage = "❌ No response from pairing service. Please try again.";
        }
        
        await sock.sendMessage(chatId, { text: errorMessage });
    }
}

module.exports = pairCommand;
