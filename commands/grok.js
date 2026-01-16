const axios = require('axios');

async function grokCommand(sock, chatId, message) {
    try {
        const rawText = message.message?.conversation?.trim() ||
            message.message?.extendedTextMessage?.text?.trim() ||
            message.message?.imageMessage?.caption?.trim() ||
            message.message?.videoMessage?.caption?.trim() ||
            '';
        
        const used = (rawText || '').split(/\s+/)[0] || '.grok';
        const query = rawText.slice(used.length).trim();
        
        if (!query) {
            await sock.sendMessage(chatId, { 
                text: 'Usage: .grok <your query>'
            }, { quoted: message });
            return;
        }

        // Initial reaction
        await sock.sendMessage(chatId, {
            react: { text: '🤖', key: message.key }
        });

        // Show typing presence while searching
        await sock.presenceUpdate('composing', chatId);

        // Call Grok API
        const apiUrl = `https://apiskeith.vercel.app/ai/grok?q=${encodeURIComponent(query)}`;
        const { data } = await axios.get(apiUrl, { 
            timeout: 30000,
            headers: { 
                'user-agent': 'Mozilla/5.0',
                'accept': 'application/json'
            } 
        });

        if (!data?.status || !data?.result) {
            throw new Error(data?.error || 'Invalid response from Grok API');
        }

        // Processing reaction
        await sock.sendMessage(chatId, {
            react: { text: '💭', key: message.key }
        });

        // Stop typing presence before sending result
        await sock.presenceUpdate('paused', chatId);

        // Send only the result
        await sock.sendMessage(chatId, { 
            text: data.result 
        }, { quoted: message });

        // Success reaction
        await sock.sendMessage(chatId, {
            react: { text: '✅', key: message.key }
        });

    } catch (error) {
        console.error('[GROK] error:', error?.message || error);
        
        let errorMsg = error?.response?.data?.message || error?.message || error?.response?.data?.error || 'Unknown error occurred';

        // Error reaction
        await sock.sendMessage(chatId, {
            react: { text: '❌', key: message.key }
        });

        // Stop typing presence if error occurs
        await sock.presenceUpdate('paused', chatId);

        await sock.sendMessage(chatId, { 
            text: `❌ Failed to get Grok response\n\nError: ${errorMsg}`
        }, { quoted: message });
    }
}

module.exports = grokCommand;
