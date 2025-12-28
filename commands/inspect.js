const fetch = require('node-fetch');

async function inspectCommand(sock, chatId, senderId, message, userMessage) {
    try {
        const args = userMessage.split(' ').slice(1);
        const url = args.join(' ').trim();

        if (!url) {
            return await sock.sendMessage(chatId, {
                text: `Usage:\n.browse <url>\nExample:\n.browse https://example.com`
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
            return await sock.sendMessage(chatId, { text: `❌ Failed: ${err.message}` });
        }

        const contentType = response.headers.get('content-type') || 'unknown';
        
        let content;
        try {
            if (contentType.includes('application/json')) {
                // Parse JSON properly
                const jsonData = await response.json();
                content = JSON.stringify(jsonData, null, 2);
            } else {
                content = await response.text();
            }
        } catch (err) {
            console.error('Content reading error:', err);
            await sock.sendMessage(chatId, { react: { text: "❌", key: message.key } });
            return await sock.sendMessage(chatId, { text: `❌ Failed to read response content: ${err.message}` });
        }

        // Prepare the response message - no truncation
        let resultMessage = `✅ *Fetched:*\nType: ${contentType}\nStatus: ${response.status}\n\n${content}`;

        // Send the message
        await sock.sendMessage(chatId, { text: resultMessage }, { quoted: message });

        // Success reaction
        await sock.sendMessage(chatId, { react: { text: "✅", key: message.key } });

    } catch (error) {
        console.error('Command error:', error);
        await sock.sendMessage(chatId, { react: { text: "❌", key: message.key } });
        await sock.sendMessage(chatId, { text: `❌ Error: ${error.message}` });
    }
}

module.exports = inspectCommand;
