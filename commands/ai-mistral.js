const axios = require('axios');

async function mistralCommand(sock, chatId, message) {
    try {
        // Send initial reaction
        await sock.sendMessage(chatId, {
            react: { text: '📥', key: message.key }
        });

        const text = message.message?.conversation || 
                     message.message?.extendedTextMessage?.text || 
                     message.message?.imageMessage?.caption || 
                     '';
        
        if (!text.includes(' ')) {
            return await sock.sendMessage(chatId, {
                text: '❌ Please provide a query for Mistral AI!\n\nExample: .mistral What is artificial intelligence?'
            }, { quoted: message });
        }

        const parts = text.split(' ');
        const query = parts.slice(1).join(' ').trim();

        if (!query) {
            return await sock.sendMessage(chatId, {
                text: '❌ Please provide a query for Mistral AI!\n\nExample: .mistral What is artificial intelligence?'
            }, { quoted: message });
        }

        if (query.length > 1000) {
            return await sock.sendMessage(chatId, {
                text: '📝 Query too long! Max 1000 characters.'
            }, { quoted: message });
        }

        // Update presence to "typing"
        await sock.sendPresenceUpdate('composing', chatId);

        // Fetch AI response using Mistral API
        const apiUrl = `https://apiskeith.vercel.app/ai/mistral?q=${encodeURIComponent(query)}`;
        const response = await axios.get(apiUrl, { timeout: 30000 });
        const apiData = response.data;

        if (!apiData?.status || !apiData?.result) {
            throw new Error("API failed to generate response!");
        }

        // Send success reaction
        await sock.sendMessage(chatId, {
            react: { text: '✅', key: message.key }
        });

        // Format and send response
        const aiResponse = apiData.result.trim();
        
        await sock.sendMessage(chatId, {
            text: `🤖 *Mistral AI Assistant*\n\n📝 *Query:* ${query}\n\n💬 *Response:*\n${aiResponse}\n\n> *Powered by Keith's Mistral AI*`
        }, { quoted: message });

        // Send final reaction
        await sock.sendMessage(chatId, {
            react: { text: '📤', key: message.key }
        });

    } catch (error) {
        console.error("Mistral AI command error:", error);
        
        // Send error reaction
        await sock.sendMessage(chatId, {
            react: { text: '❌', key: message.key }
        });

        let errorMessage;
        if (error.response?.status === 404) {
            errorMessage = 'Mistral AI API endpoint not found!';
        } else if (error.message.includes('timeout') || error.code === 'ECONNABORTED') {
            errorMessage = 'Request timed out! Try again.';
        } else if (error.code === 'ENOTFOUND') {
            errorMessage = 'Cannot connect to Mistral AI service!';
        } else if (error.response?.status === 429) {
            errorMessage = 'Too many requests! Please try again later.';
        } else if (error.response?.status >= 500) {
            errorMessage = 'Mistral AI service is currently unavailable.';
        } else if (error.message.includes('API failed')) {
            errorMessage = 'Mistral AI failed to generate a response.';
        } else {
            errorMessage = `Error: ${error.message}`;
        }
            
        await sock.sendMessage(chatId, {
            text: `🚫 ${errorMessage}`
        }, { quoted: message });
    }
}

module.exports = mistralCommand;
