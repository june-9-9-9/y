const axios = require('axios');

async function inspectCommand(sock, chatId, message) {
    // Extract text safely
    const text =
        message.message?.conversation ||
        message.message?.extendedTextMessage?.text ||
        "";

    if (!text.trim()) {
        await sock.sendMessage(chatId, {
            text: "❌ *No text found in the message.* Please provide a command and URL."
        }, { quoted: message });
        return;
    }

    const parts = text.trim().split(/\s+/);
    const command = parts[0]?.toLowerCase();
    const url = parts.slice(1).join(" ").trim();

    if (!url) {
        await sock.sendMessage(chatId, {
            text: `*🔍 Please provide a URL to inspect.*\n\n_Usage:_\n${command} https://example.com`
        }, { quoted: message });
        return;
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(url);
    } catch {
        await sock.sendMessage(chatId, {
            text: "❌ *Invalid URL format.* Please provide a valid URL including protocol (http/https)."
        }, { quoted: message });
        return;
    }

    try {
        // React loading
        await sock.sendMessage(chatId, { react: { text: "🔍", key: message.key } });

        const response = await axios({
            method: 'GET',
            url,
            timeout: 15000,
            maxContentLength: 5 * 1024 * 1024, // 5MB limit
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Accept': '*/*'
            },
            validateStatus: status => status >= 200 && status < 400
        });

        const contentType = response.headers['content-type'] || 'application/octet-stream';
        const buffer = Buffer.from(response.data);

        // Filename detection
        let filename = url.split('/').pop() || "file";
        const contentDisposition = response.headers['content-disposition'];
        if (contentDisposition) {
            const match = contentDisposition.match(/filename="?([^"]+)"?/i);
            if (match) filename = match[1];
        }

        let contentPreview = '';
        let contentInfo = '';

        // JSON
        if (contentType.includes('application/json') || url.endsWith('.json')) {
            try {
                const json = JSON.parse(buffer.toString());
                const jsonString = JSON.stringify(json, null, 2);
                const preview = jsonString.slice(0, 1000);
                contentPreview = `📋 *Content Preview:*\n\`\`\`json\n${preview}${jsonString.length > 1000 ? "\n... (truncated)" : ""}\n\`\`\``;
                contentInfo = `📁 *Type:* JSON\n📊 *Keys:* ${Object.keys(json).length}\n📏 *Size:* ${buffer.length.toLocaleString()} bytes`;
            } catch {
                contentPreview = `❌ Failed to parse JSON.`;
                contentInfo = `📁 *Type:* Text (invalid JSON)\n📏 *Size:* ${buffer.length.toLocaleString()} bytes`;
            }
        }
        // HTML
        else if (contentType.includes('text/html')) {
            const htmlContent = buffer.toString('utf8', 0, 1000);
            const titleMatch = htmlContent.match(/<title[^>]*>([^<]+)<\/title>/i);
            const title = titleMatch ? titleMatch[1] : 'No title found';
            const metaTags = htmlContent.match(/<meta[^>]+>/g) || [];
            contentPreview = `📋 *Content Preview:*\n🏷️ *Title:* ${title}\n📝 *Meta Tags:* ${metaTags.length}\n\`\`\`html\n${htmlContent}${buffer.length > 1000 ? "\n... (truncated)" : ""}\n\`\`\``;
            contentInfo = `📁 *Type:* HTML\n📄 *Tags:* ~${htmlContent.split('<').length}\n📏 *Size:* ${buffer.length.toLocaleString()} bytes`;
        }
        // Text
        else if (contentType.includes('text/')) {
            const textContent = buffer.toString('utf8', 0, 1000);
            const lines = textContent.split('\n').length;
            const words = textContent.split(/\s+/).filter(w => w.length > 0).length;
            contentPreview = `📋 *Content Preview:*\n\`\`\`text\n${textContent}${buffer.length > 1000 ? "\n... (truncated)" : ""}\n\`\`\``;
            contentInfo = `📁 *Type:* ${contentType}\n📊 *Lines:* ${lines}\n📝 *Words:* ${words}\n📏 *Size:* ${buffer.length.toLocaleString()} bytes`;
        }
        // Media
        else if (contentType.includes('image/') || contentType.includes('video/') || contentType.includes('audio/')) {
            contentPreview = `🖼️ *Media File Detected*\n📁 *Filename:* ${filename}\n🔤 *MIME Type:* ${contentType}`;
            contentInfo = `📁 *Type:* ${contentType.split('/')[0].toUpperCase()}\n📏 *Size:* ${buffer.length.toLocaleString()} bytes\n📦 *Format:* ${contentType.split('/')[1]}`;
        }
        // Binary
        else {
            const hexPreview = buffer.toString('hex', 0, 100);
            contentPreview = `📋 *Hex Preview:*\n\`\`\`hex\n${hexPreview}${buffer.length > 100 ? "\n... (truncated)" : ""}\n\`\`\``;
            contentInfo = `📁 *Type:* ${contentType}\n📏 *Size:* ${buffer.length.toLocaleString()} bytes\n🔤 *Encoding:* Binary`;
        }

        await sock.sendMessage(chatId, {
            text: `🔍 *Inspection Results*\n\n🔗 *URL:* ${url}\n🌐 *Domain:* ${parsedUrl.hostname}\n⚡ *Status:* ${response.status}\n📄 *Filename:* ${filename}\n\n${contentInfo}\n\n${contentPreview}`
        }, { quoted: message });

        await sock.sendMessage(chatId, { react: { text: "✅", key: message.key } });

    } catch (error) {
        console.error('Inspect Command Error:', error);
        await sock.sendMessage(chatId, {
            text: `❌ *Failed to inspect the URL.*\n\n🔗 *URL:* ${url}\n💡 Check if the endpoint is reachable and valid.`
        }, { quoted: message });
        await sock.sendMessage(chatId, { react: { text: "❌", key: message.key } });
    }
}

module.exports = inspectCommand;
