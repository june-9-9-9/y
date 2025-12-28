const fetch = require('node-fetch');

async function inspectCommand(sock, chatId, senderId, message, userMessage) {
    try {
        const args = userMessage.split(' ').slice(1);
        const url = args.join(' ').trim();

        if (!url) {
            await sock.sendMessage(chatId, {
                text: `🔍 *Content Fetcher*\n\nUsage: .inspect <url>\nExample:\n.inspect https://api.example.com/data\n.inspect https://website.com`
            });
            return await sock.sendMessage(chatId, { react: { text: "ℹ️", key: message.key } });
        }

        if (!/^https?:\/\//i.test(url)) {
            await sock.sendMessage(chatId, { text: '❌ URL must start with http:// or https://' });
            return await sock.sendMessage(chatId, { react: { text: "🚫", key: message.key } });
        }

        await sock.sendMessage(chatId, { text: `📥 Fetching content from ${url}...` }, { quoted: message });
        await sock.sendMessage(chatId, { react: { text: "⏳", key: message.key } });

        let response;
        try {
            response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
        } catch (fetchError) {
            console.error('Fetch error:', fetchError);
            await sock.sendMessage(chatId, { text: `❌ Failed to fetch: ${fetchError.message}` });
            return await sock.sendMessage(chatId, { react: { text: "❌", key: message.key } });
        }

        const contentType = response.headers.get('content-type') || '';
        let content;

        if (contentType.includes('application/json')) {
            try {
                const jsonData = await response.json();
                content = JSON.stringify(jsonData, null, 2);
            } catch {
                content = await response.text();
            }
        } else {
            content = await response.text();
        }

        const maxLength = 3500;
        let truncated = false;
        const originalLength = content.length;

        if (originalLength > maxLength) {
            content = content.substring(0, maxLength);
            truncated = true;
        }

        let messageText = '';
        if (contentType.includes('application/json')) {
            messageText = `📡 *API JSON Response* (${url})\n\n\`\`\`json\n${content}${truncated ? '\n\n... [CONTENT TRUNCATED] ...' : ''}\n\`\`\``;
        } else if (contentType.includes('text/html')) {
            messageText = `🌐 *HTML Content* (${url})\n\n\`\`\`html\n${content}${truncated ? '\n\n... [CONTENT TRUNCATED] ...' : ''}\n\`\`\``;
        } else if (contentType.includes('text/plain') || contentType.includes('text/')) {
            messageText = `📝 *Text Content* (${url})\n\n\`\`\`text\n${content}${truncated ? '\n\n... [CONTENT TRUNCATED] ...' : ''}\n\`\`\``;
        } else {
            messageText = `📄 *Raw Content* (${url})\nContent-Type: ${contentType}\n\n\`\`\`\n${content}${truncated ? '\n\n... [CONTENT TRUNCATED] ...' : ''}\n\`\`\``;
        }

        if (truncated) {
            messageText += `\n\n⚠️ *Note:* Content truncated (original length: ${originalLength} chars)`;
        }

        await sock.sendMessage(chatId, { text: messageText }, { quoted: message });
        await sock.sendMessage(chatId, { react: { text: "✅", key: message.key } });

    } catch (error) {
        console.error('Inspect error:', error);
        await sock.sendMessage(chatId, { text: `❌ Error: ${error.message}` });
        await sock.sendMessage(chatId, { react: { text: "💥", key: message.key } });
    }
}

module.exports = inspectCommand;
