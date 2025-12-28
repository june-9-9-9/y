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

        await sock.sendMessage(chatId, { text: `Fetching: ${url}` }, { quoted: message });

        let response;
        try {
            response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
        } catch (err) {
            console.error('Fetch error:', err);
            return await sock.sendMessage(chatId, { text: `❌ Failed: ${err.message}` });
        }

        const contentType = response.headers.get('content-type') || 'unknown';
        let content = await response.text();

        const maxLen = 1000;
        if (content.length > maxLen) {
            content = content.substring(0, maxLen) + '\n... [truncated] ...';
        }

        let resultMessage = `✅ *Fetched:* ${url}\nType: ${contentType}\nStatus: ${response.status}\n\n${content}`;

        await sock.sendMessage(chatId, { text: resultMessage }, { quoted: message });

    } catch (error) {
        console.error('Command error:', error);
        await sock.sendMessage(chatId, { text: `❌ Error: ${error.message}` });
    }
}

module.exports = inspectCommand;
