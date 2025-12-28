const axios = require('axios');

async function inspectCommand(sock, chatId, senderId, message, userMessage) {
    try {
        const args = userMessage.split(' ').slice(1);
        const url = args.join(' ').trim();

        if (!url) {
            return await sock.sendMessage(chatId, {
                text: `Usage:\n.inspect <url>\nExample:\n.inspect https://example.com\n\nAliases: fetch, get, curl`
            });
        }

        if (!/^https?:\/\//i.test(url)) {
            return await sock.sendMessage(chatId, { text: '❌ URL must start with http:// or https://' });
        }

        // React to show progress
        await sock.sendMessage(chatId, { react: { text: "⏳", key: message.key } });

        let response;
        try {
            response = await axios.get(url, { responseType: 'arraybuffer' });
        } catch (err) {
            console.error('Fetch error:', err);
            await sock.sendMessage(chatId, { react: { text: "❌", key: message.key } });
            return await sock.sendMessage(chatId, { 
                text: `❌ Failed to fetch URL: ${err.message || 'Unknown error'}` 
            });
        }

        const contentType = response.headers['content-type'] || 'unknown';
        console.log("Content-Type:", contentType);

        const buffer = Buffer.from(response.data);
        const filename = url.split('/').pop() || "file";

        // Handle different content types
        if (contentType.includes('application/json')) {
            const json = JSON.parse(buffer.toString());
            await sock.sendMessage(chatId, { 
                text: "```json\n" + JSON.stringify(json, null, 2).slice(0, 4000) + "\n```" 
            }, { quoted: message });
        } 
        else if (contentType.includes('text/html')) {
            const html = buffer.toString();
            await sock.sendMessage(chatId, { 
                text: html.slice(0, 4000) 
            }, { quoted: message });
        }
        else if (contentType.includes('image')) {
            await sock.sendMessage(chatId, { 
                image: buffer, 
                caption: `📸 Fetched from: ${url}` 
            }, { quoted: message });
        }
        else if (contentType.includes('video')) {
            await sock.sendMessage(chatId, { 
                video: buffer, 
                caption: `🎬 Fetched from: ${url}` 
            }, { quoted: message });
        }
        else if (contentType.includes('audio')) {
            await sock.sendMessage(chatId, {
                audio: buffer,
                mimetype: "audio/mpeg",
                fileName: filename,
                caption: `🎵 Fetched from: ${url}`
            }, { quoted: message });
        }
        else if (contentType.includes('application/pdf')) {
            await sock.sendMessage(chatId, {
                document: buffer,
                mimetype: "application/pdf",
                fileName: filename,
                caption: `📄 Fetched from: ${url}`
            }, { quoted: message });
        }
        else if (contentType.includes('application/')) {
            await sock.sendMessage(chatId, {
                document: buffer,
                mimetype: contentType,
                fileName: filename,
                caption: `📎 Fetched from: ${url}`
            }, { quoted: message });
        }
        else if (contentType.includes('text/')) {
            await sock.sendMessage(chatId, { 
                text: buffer.toString().slice(0, 4000) 
            }, { quoted: message });
        }
        else {
            await sock.sendMessage(chatId, { 
                text: `❌ Unsupported content type: ${contentType}\n\nRaw data (first 2000 chars):\n${buffer.toString().slice(0, 2000)}` 
            }, { quoted: message });
        }

        // Success reaction
        await sock.sendMessage(chatId, { react: { text: "✅", key: message.key } });

    } catch (error) {
        console.error('Inspect command error:', error);
        await sock.sendMessage(chatId, { react: { text: "❌", key: message.key } });
        await sock.sendMessage(chatId, { 
            text: `❌ Error: ${error.message || 'Unknown error occurred'}` 
        });
    }
}

module.exports = inspectCommand;
