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

        await sock.sendMessage(chatId, { text: `🔍 Fetching: ${url}` }, { quoted: message });

        let response;
        try {
            response = await fetch(url, {
                timeout: 10000, // 10 second timeout
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
        } catch (err) {
            console.error('Fetch error:', err);
            return await sock.sendMessage(chatId, { text: `❌ Failed to fetch: ${err.message}` });
        }

        const contentType = response.headers.get('content-type') || 'unknown';
        const contentLength = response.headers.get('content-length') || 'unknown';
        
        // Check for binary content types
        if (contentType.includes('image') || contentType.includes('video') || 
            contentType.includes('audio') || contentType.includes('octet-stream')) {
            return await sock.sendMessage(chatId, { 
                text: `✅ *Fetched:* ${url}\n📄 Type: ${contentType}\n📏 Size: ${contentLength}\n\n⚠️ Binary content detected. Use direct download for files.`
            }, { quoted: message });
        }

        let content;
        try {
            content = await response.text();
        } catch (err) {
            return await sock.sendMessage(chatId, { 
                text: `✅ *Fetched:* ${url}\n📄 Type: ${contentType}\n📏 Size: ${contentLength}\n\n❌ Could not read content as text.`
            }, { quoted: message });
        }

        // WhatsApp message limit is 4096 characters
        const maxLen = 3800; // Leave room for metadata
        
        // Clean the content - remove null bytes and control characters
        content = content.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, '');
        
        // Limit the content length
        let truncated = false;
        if (content.length > maxLen) {
            content = content.substring(0, maxLen);
            truncated = true;
        }

        // Create the result message
        let resultMessage = `✅ *Fetched:* ${url}\n📄 Type: ${contentType}\n📏 Size: ${contentLength}\n⚡ Status: ${response.status}\n\n`;
        
        // Add truncated notice if needed
        if (truncated) {
            resultMessage += `⚠️ Content truncated to ${maxLen} characters\n\n`;
        }
        
        // Add the actual content
        resultMessage += content;

        // Send the message
        await sock.sendMessage(chatId, { text: resultMessage }, { quoted: message });

    } catch (error) {
        console.error('Command error:', error);
        await sock.sendMessage(chatId, { text: `❌ Unexpected error: ${error.message}` });
    }
}

module.exports = inspectCommand;
