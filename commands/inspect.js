const fetch = require('node-fetch');

async function inspectCommand(sock, chatId, senderId, message, userMessage) {
    try {
        const args = userMessage.split(' ').slice(1);
        const url = args.join(' ').trim();

        if (!url) {
            return await sock.sendMessage(chatId, {
                text: `🔍 *Content Fetcher*\n\nUsage: .inspect <url>\nExample: .inspect https://api.example.com/data\n.inspect https://website.com`
            });
        }

        if (!/^https?:\/\//i.test(url)) {
            return await sock.sendMessage(chatId, {
                text: '❌ URL must start with http:// or https://'
            });
        }

        await sock.sendMessage(chatId, {
            text: `📥 Fetching content from ${url}...`
        }, { quoted: message });

        let response;
        try {
            response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (fetchError) {
            console.error('Fetch error:', fetchError);
            return await sock.sendMessage(chatId, {
                text: `❌ Failed to fetch: ${fetchError.message}`
            });
        }

        const contentType = response.headers.get('content-type') || '';
        let content;
        
        // Check if response is JSON
        if (contentType.includes('application/json')) {
            try {
                const jsonData = await response.json();
                content = JSON.stringify(jsonData, null, 2);
            } catch (jsonError) {
                content = await response.text();
            }
        } else {
            content = await response.text();
        }

        // Truncate content if too long (WhatsApp message limit ~4096 chars)
        const maxLength = 3500;
        let truncated = false;
        
        if (content.length > maxLength) {
            content = content.substring(0, maxLength);
            truncated = true;
        }

        // Format the message based on content type
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

        // Add info about truncation
        if (truncated) {
            messageText += `\n\n⚠️ *Note:* Content truncated (original: ${content.length + (maxLength - content.length)} chars)`;
        }

        await sock.sendMessage(chatId, { text: messageText }, { quoted: message });

    } catch (error) {
        console.error('Inspect error:', error);
        await sock.sendMessage(chatId, {
            text: `❌ Error: ${error.message}`
        });
    }
}

module.exports = inspectCommand;
