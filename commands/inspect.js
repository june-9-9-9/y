const axios = require('axios');

async function inspectCommand(sock, chatId, senderId, message, userMessage) {
    try {
        const args = userMessage.split(' ').slice(1);
        const url = args.join(' ');

        if (!url) {
            return await sock.sendMessage(chatId, {
                text: `Usage:\n.inspect <url>\n\nExample:\n.inspect https://example.com\n.inspect https://api.example.com/data.json`
            });
        }

        let parsedUrl;
        try {
            parsedUrl = new URL(url);
        } catch {
            return await sock.sendMessage(chatId, {
                text: 'Invalid URL format. Please include protocol (http/https).'
            });
        }

        let response;
        try {
            response = await axios({
                method: 'GET',
                url,
                timeout: 15000,
                maxContentLength: 5 * 1024 * 1024,
                responseType: 'arraybuffer',
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                    'Accept': '*/*'
                },
                validateStatus: status => status >= 200 && status < 400
            });
        } catch (axiosError) {
            console.error('URL inspection error:', axiosError);
            return await sock.sendMessage(chatId, {
                text: `Failed to fetch: ${url}\n\nPossible issues:\n• URL not accessible\n• Server down\n• Timeout\n• Invalid SSL certificate`
            });
        }

        const contentType = response.headers['content-type'] || 'application/octet-stream';
        const buffer = Buffer.from(response.data);

        let contentPreview = '';

        // JSON
        if (contentType.includes('application/json') || url.endsWith('.json')) {
            try {
                const json = JSON.parse(buffer.toString());
                const jsonString = JSON.stringify(json, null, 2);
                contentPreview = jsonString.slice(0, 2000) + (jsonString.length > 2000 ? "\n... (truncated)" : "");
            } catch {
                contentPreview = buffer.toString('utf8', 0, 2000);
            }
        }
        // HTML
        else if (contentType.includes('text/html')) {
            contentPreview = buffer.toString('utf8', 0, 2000) + (buffer.length > 2000 ? "\n... (truncated)" : "");
        }
        // Text
        else if (contentType.includes('text/')) {
            contentPreview = buffer.toString('utf8', 0, 2000) + (buffer.length > 2000 ? "\n... (truncated)" : "");
        }
        // Media
        else if (contentType.includes('image/') || contentType.includes('video/') || contentType.includes('audio/')) {
            contentPreview = `Media file detected (${contentType}). Content not previewable.`;
        }
        // Binary
        else {
            contentPreview = `Binary content detected (${contentType}). Hex preview:\n${buffer.toString('hex', 0, 200)}${buffer.length > 200 ? "\n... (truncated)" : ""}`;
        }

        await sock.sendMessage(chatId, { text: contentPreview }, { quoted: message });

    } catch (error) {
        console.error('URL inspection command error:', error);
        await sock.sendMessage(chatId, {
            text: 'An unexpected error occurred during URL inspection. Please try again.'
        });
    }
}

module.exports = inspectCommand;
