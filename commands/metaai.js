const axios = require('axios');

async function metaaiCommand(sock, chatId, message) {
    try {
        // Send reaction
        await sock.sendMessage(chatId, {
            react: { text: '🤖', key: message.key }
        });

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const parts = text.split(' ');
        const query = parts.slice(1).join(' ').trim();

        if (!query) {
            return await sock.sendMessage(chatId, {
                text: '❌ Please provide a question to ask Meta AI!\n\nExample: .metaai What is artificial intelligence?'
            }, { quoted: message });
        }

        if (query.length > 1000) {
            return await sock.sendMessage(chatId, {
                text: '📝 Question too long! Max 1000 characters.'
            }, { quoted: message });
        }

        // Update presence to "typing"
        await sock.sendPresenceUpdate('composing', chatId);

        // Fetch AI response
        const apiUrl = `https://apis.davidcyriltech.my.id/ai/metaai?text=${encodeURIComponent(query)}`;
        const response = await axios.get(apiUrl, { timeout: 30000 });
        const apiData = response.data;

        if (!apiData.success || !apiData.response) {
            throw new Error("API failed to generate response!");
        }

        // Send success reaction
        await sock.sendMessage(chatId, {
            react: { text: '✅', key: message.key }
        });

        // Format and send response
        const aiResponse = apiData.response.trim();
        
        await sock.sendMessage(chatId, {
            text: `🤖 *Meta AI*\n\n📝 *Question:* ${query}\n\n💬 *Response:* ${aiResponse}\n\n📊 *Powered by Meta AI*`
        }, { quoted: message });

    } catch (error) {
        console.error("Meta AI command error:", error);
        
        // Send error reaction
        await sock.sendMessage(chatId, {
            react: { text: '❌', key: message.key }
        });

        const errorMessage = error.response?.status === 404 
            ? 'API endpoint not found!'
            : error.message.includes('timeout')
            ? 'Request timed out! Try again.'
            : error.code === 'ENOTFOUND'
            ? 'Cannot connect to AI service!'
            : `Error: ${error.message}`;
            
        await sock.sendMessage(chatId, {
            text: `🚫 ${errorMessage}`
        }, { quoted: message });
    }
}

module.exports = metaaiCommand;
