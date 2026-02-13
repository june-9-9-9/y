const axios = require('axios');

async function deepseekCommand(sock, chatId, message) {
    try {
        // Send reaction
        await sock.sendMessage(chatId, {
            react: { text: '🤖', key: message.key }
        });

        const text = message.message?.conversation || 
                     message.message?.extendedTextMessage?.text || 
                     message.message?.imageMessage?.caption || 
                     '';
        
        if (!text.includes(' ')) {
            return await sock.sendMessage(chatId, {
                text: '❌ Please provide a question for the AI!\n\nExample: .deepseek What is artificial intelligence?'
            }, { quoted: message });
        }

        const parts = text.split(' ');
        const query = parts.slice(1).join(' ').trim();

        if (!query) {
            return await sock.sendMessage(chatId, {
                text: '❌ Please provide a question for the AI!\n\nExample: .deepseek What is artificial intelligence?'
            }, { quoted: message });
        }

        if (query.length > 1000) {
            return await sock.sendMessage(chatId, {
                text: '📝 Question too long! Max 1000 characters.'
            }, { quoted: message });
        }

        // Update presence to "typing"
        await sock.sendPresenceUpdate('composing', chatId);

        // Fetch AI response using GPT-4 API
        const apiUrl = `https://meta-api.zone.id/ai/copilot?message=${encodeURIComponent(query)}`;
        const response = await axios.get(apiUrl, { timeout: 30000 });
        const apiData = response.data;

        if (!apiData.responseTime || !apiData.answer) {
            throw new Error("API failed to generate response!");
        }

        // Send success reaction
        await sock.sendMessage(chatId, {
            react: { text: '✅', key: message.key }
        });

        // Format and send response
        const aiResponse = apiData.answer.trim();
        
        await sock.sendMessage(chatId, {
            text: `🤖 *AI Assistant*\n\n📝 *Question:* ${query}\n\n💬 *Response:* ${aiResponse}\n\n ↘️ *Powered by DeepSeek*`
        }, { quoted: message });

    } catch (error) {
        console.error("DeepSeek command error:", error);
        
        // Send error reaction
        await sock.sendMessage(chatId, {
            react: { text: '❌', key: message.key }
        });

        let errorMessage;
        if (error.response?.status === 404) {
            errorMessage = 'API endpoint not found!';
        } else if (error.message.includes('timeout') || error.code === 'ECONNABORTED') {
            errorMessage = 'Request timed out! Try again.';
        } else if (error.code === 'ENOTFOUND') {
            errorMessage = 'Cannot connect to AI service!';
        } else if (error.response?.status === 429) {
            errorMessage = 'Too many requests! Please try again later.';
        } else if (error.response?.status >= 500) {
            errorMessage = 'AI service is currently unavailable.';
        } else {
            errorMessage = `Error: ${error.message}`;
        }
            
        await sock.sendMessage(chatId, {
            text: `🚫 ${errorMessage}`
        }, { quoted: message });
    }
}

module.exports = deepseekCommand;
