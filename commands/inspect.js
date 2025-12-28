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
            return await sock.sendMessage(chatId, { text: `❌ Failed: ${err.message}` });
        }

        const contentType = response.headers.get('content-type') || 'unknown';
        let body;

        // Parse JSON if possible
        if (contentType.includes('application/json')) {
            try {
                body = await response.json();
            } catch {
                body = await response.text();
            }
        } else {
            body = await response.text();
        }

        // Build structured result
        const result = {
            status: response.status,
            statusText: response.statusText,
            contentType,
            url,
            body
        };

        // Send nicely formatted JSON
        await sock.sendMessage(chatId, { 
            text: `✅ *Fetched:*\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\`` 
        }, { quoted: message });

        // Success reaction
        await sock.sendMessage(chatId, { react: { text: "✅", key: message.key } });

    } catch (error) {
        console.error('Command error:', error);
        await sock.sendMessage(chatId, { react: { text: "❌", key: message.key } });
        await sock.sendMessage(chatId, { text: `❌ Error: ${error.message}` });
    }
}

module.exports = inspectCommand;
