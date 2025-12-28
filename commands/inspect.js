const fetch = require('node-fetch');

async function inspectCommand(sock, chatId, senderId, message, userMessage) {
    try {
        const args = userMessage.split(' ').slice(1);
        const url = args.join(' ').trim();

        if (!url) {
            return await sock.sendMessage(chatId, {
                text: `Usage:\n.inspect <url>\nExample:\n.inspect https://example.com`
            });
        }

        if (!/^https?:\/\//i.test(url)) {
            return await sock.sendMessage(chatId, { text: '❌ URL must start with http:// or https://' });
        }

        // React to show progress
        await sock.sendMessage(chatId, { react: { text: "⏳", key: message.key } });

        let response;
        try {
            response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
        } catch (err) {
            console.error('Fetch error:', err);
            await sock.sendMessage(chatId, { react: { text: "❌", key: message.key } });
            return await sock.sendMessage(chatId, { text: `❌ Fetch failed: ${err.message}` });
        }

        const contentType = response.headers.get('content-type') || 'unknown';
        
        // Determine if content is JSON
        const isJson = contentType.includes('application/json');
        
        let content;
        try {
            if (isJson) {
                // Parse JSON properly
                const jsonData = await response.json();
                content = JSON.stringify(jsonData, null, 2);
            } else {
                content = await response.text();
            }
        } catch (err) {
            console.error('Content reading error:', err);
            await sock.sendMessage(chatId, { react: { text: "❌", key: message.key } });
            return await sock.sendMessage(chatId, { 
                text: `❌ Failed to read response content: ${err.message}` 
            });
        }

        // Prepare the response message
        const maxLength = 4000; // WhatsApp character limit with some buffer
        
        let resultMessage = `✅ *Fetched:*\nType: ${contentType}\nStatus: ${response.status}\nURL: ${url}\n\n`;
        
        // Add content preview
        if (content.length > 0) {
            if (content.length > maxLength - resultMessage.length) {
                // Content is too large, show preview only
                const preview = content.substring(0, maxLength - resultMessage.length - 100);
                resultMessage += `*Preview (${content.length} characters total):*\n\`\`\`\n${preview}\n...\n[Content truncated. Total length: ${content.length} characters]\`\`\``;
            } else {
                // Content fits within limits
                resultMessage += `*Content:*\n\`\`\`\n${content}\n\`\`\``;
            }
        } else {
            resultMessage += `*Content:* Empty response`;
        }

        // Send the message
        await sock.sendMessage(chatId, { text: resultMessage }, { quoted: message });

        // Success reaction
        await sock.sendMessage(chatId, { react: { text: "✅", key: message.key } });

    } catch (error) {
        console.error('Command error:', error);
        await sock.sendMessage(chatId, { react: { text: "❌", key: message.key } });
        await sock.sendMessage(chatId, { text: `❌ Command error: ${error.message}` });
    }
}

module.exports = inspectCommand;
