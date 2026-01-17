const axios = require('axios');

async function perplexityCommand(sock, chatId, message) {
    try {
        // Send initial reaction
        await sock.sendMessage(chatId, {
            react: { text: '🤔', key: message.key }
        });

        const text = message.message?.conversation || 
                     message.message?.extendedTextMessage?.text || 
                     message.message?.imageMessage?.caption || 
                     '';
        
        if (!text.includes(' ')) {
            return await sock.sendMessage(chatId, {
                text: '❌ Please provide a query!\n\nUsage:\n.perplexity What is AI?\n.perplexity latest news about space exploration'
            }, { quoted: message });
        }

        const parts = text.split(' ');
        const query = parts.slice(1).join(' ').trim();

        if (!query) {
            return await sock.sendMessage(chatId, {
                text: '❌ Please provide a query!\n\nExample:\n.perplexity What is artificial intelligence?'
            }, { quoted: message });
        }

        if (query.length > 1000) {
            return await sock.sendMessage(chatId, {
                text: '📝 Query too long! Max 1000 characters.'
            }, { quoted: message });
        }

        // Update presence to "typing"
        await sock.sendPresenceUpdate('composing', chatId);

        // Fetch AI response using Perplexity API
        const apiUrl = `https://apiskeith.vercel.app/ai/perplexity?q=${encodeURIComponent(query)}`;
        const response = await axios.get(apiUrl, { timeout: 30000 });
        const apiData = response.data;

        if (!apiData?.status || !apiData?.result) {
            throw new Error("Perplexity AI failed to generate response!");
        }

        // Send success reaction
        await sock.sendMessage(chatId, {
            react: { text: '✅', key: message.key }
        });

        // Send clean response only
        const aiResponse = apiData.result.trim();
        await sock.sendMessage(chatId, { text: aiResponse }, { quoted: message });

        // Final reaction
        await sock.sendMessage(chatId, {
            react: { text: '📚', key: message.key }
        });

    } catch (error) {
        console.error("Perplexity AI command error:", error);

        await sock.sendMessage(chatId, {
            react: { text: '❌', key: message.key }
        });

        let errorMessage;
        if (error.response?.status === 404) {
            errorMessage = 'API endpoint not found!';
        } else if (error.message.includes('timeout') || error.code === 'ECONNABORTED') {
            errorMessage = 'Request timed out!';
        } else if (error.code === 'ENOTFOUND') {
            errorMessage = 'Cannot connect to service!';
        } else if (error.response?.status === 429) {
            errorMessage = 'Too many requests!';
        } else if (error.response?.status >= 500) {
            errorMessage = 'Service unavailable!';
        } else if (error.message.includes('failed to generate')) {
            errorMessage = 'Failed to generate a response.';
        } else {
            errorMessage = `Error: ${error.message}`;
        }

        await sock.sendMessage(chatId, {
            text: `🚫 ${errorMessage}`
        }, { quoted: message });
    }
}

module.exports = perplexityCommand;
