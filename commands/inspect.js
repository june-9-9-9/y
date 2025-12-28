const fetch = require('node-fetch');

async function inspectCommand(sock, chatId, senderId, message, userMessage) {
    try {
        const args = userMessage.split(' ').slice(1);
        const query = args.join(' ');

        if (!query) {
            return await sock.sendMessage(chatId, {
                text: `*INSPECT COMMAND*\n\n*Usage:*\n.inspect <url> - Fetch and inspect data from URL\n.inspect <url> -j - Pretty JSON format\n.inspect <url> -d - Download media\n.inspect <url> -h - Show response headers only\n\n*Examples:*\n.inspect https://api.github.com/users/octocat\n.inspect https://api.github.com/users/octocat -j\n.inspect https://example.com/image.jpg -d\n.inspect https://example.com -h`
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, {
            text: `🔍 Inspecting...`
        }, { quoted: message });

        // Parse arguments
        const parts = query.split(' ');
        const url = parts[0];
        const flags = parts.slice(1);
        const download = flags.includes('-d');
        const json = flags.includes('-j');
        const headersOnly = flags.includes('-h');
        const followRedirects = !flags.includes('-n');

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; WhatsAppBot/1.0)'
            },
            redirect: followRedirects ? 'follow' : 'manual'
        });

        const responseInfo = {
            status: response.status,
            statusText: response.statusText,
            url: response.url,
            redirected: response.redirected,
            headers: {}
        };

        response.headers.forEach((value, key) => {
            responseInfo.headers[key] = value;
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type') || '';

        if (headersOnly) {
            let headersText = `📋 *RESPONSE HEADERS:*\n\n`;
            headersText += `*Status:* ${responseInfo.status} ${responseInfo.statusText}\n`;
            headersText += `*URL:* ${responseInfo.url}\n`;
            headersText += `*Redirected:* ${responseInfo.redirected}\n\n`;

            for (const [key, value] of Object.entries(responseInfo.headers)) {
                headersText += `${key}: ${value}\n`;
            }

            return await sock.sendMessage(chatId, { text: headersText }, { quoted: message });
        }

        if (download && (contentType.includes('audio/') ||
                         contentType.includes('video/') ||
                         contentType.includes('image/'))) {

            const contentLength = response.headers.get('content-length');
            const maxSize = 50 * 1024 * 1024;

            if (contentLength && parseInt(contentLength) > maxSize) {
                return await sock.sendMessage(chatId, {
                    text: `❌ File too large (${(parseInt(contentLength)/1024/1024).toFixed(2)}MB)\nMaximum size: 50MB`
                }, { quoted: message });
            }

            const buffer = await response.arrayBuffer();
            const fileBuffer = Buffer.from(buffer);

            let mediaType;
            if (contentType.includes('audio/')) {
                await sock.sendMessage(chatId, { audio: fileBuffer, mimetype: contentType }, { quoted: message });
                mediaType = 'Audio';
            } else if (contentType.includes('video/')) {
                await sock.sendMessage(chatId, { video: fileBuffer, mimetype: contentType }, { quoted: message });
                mediaType = 'Video';
            } else if (contentType.includes('image/')) {
                await sock.sendMessage(chatId, { image: fileBuffer }, { quoted: message });
                mediaType = 'Image';
            }

            return await sock.sendMessage(chatId, {
                text: `✅ Downloaded ${mediaType}\n*Size:* ${(fileBuffer.length / 1024).toFixed(2)}KB\n*Type:* ${contentType}`
            }, { quoted: message });
        }

        if (json || contentType.includes('application/json')) {
            let jsonData;
            try {
                jsonData = await response.json();
            } catch (err) {
                jsonData = null;
            }

            const formattedJson = jsonData ? JSON.stringify(jsonData, null, 2) : '{}';

            let displayJson = formattedJson;
            let truncationNote = '';
            if (formattedJson.length > 2500) {
                displayJson = formattedJson.substring(0, 2500);
                truncationNote = '\n\n... (truncated - too large to display)';
            }

            let responseText = `JSON RESPONSE:\n\n`;
            responseText += `\`\`\`json\n${displayJson}${truncationNote}\`\`\``;

            return await sock.sendMessage(chatId, { text: responseText }, { quoted: message });
        }

        if (contentType.includes('text/')) {
            const text = await response.text();

            let displayText = text;
            let truncationNote = '';
            if (text.length > 2500) {
                displayText = text.substring(0, 2500);
                truncationNote = '\n\n... (truncated - too large to display)';
            }

            let responseText = `*TEXT RESPONSE:*\n\n`;
            responseText += `\`\`\`\n${displayText}${truncationNote}\`\`\``;

            return await sock.sendMessage(chatId, { text: responseText }, { quoted: message });
        }

        // Clean fallback: no verbose RESPONSE DETAILS
        await sock.sendMessage(chatId, {
            text: `ℹ️ Response received.\n*Status:* ${responseInfo.status} ${responseInfo.statusText}\n*Content-Type:* ${contentType}`
        }, { quoted: message });

    } catch (error) {
        console.error('Inspect command error:', error);

        let errorMessage;
        if (error.name === 'AbortError') {
            errorMessage = '⏱️ Request timeout (30 seconds)';
        } else if (error.code === 'ENOTFOUND') {
            errorMessage = '🔍 Could not resolve domain';
        } else if (error.code === 'ECONNREFUSED') {
            errorMessage = '🚫 Connection refused';
        } else if (error.type === 'invalid-json') {
            errorMessage = '📄 Response is not valid JSON';
        } else if (error.message.includes('HTTP')) {
            errorMessage = `❌ HTTP Error: ${error.message}`;
        } else {
            errorMessage = '❌ An error occurred while inspecting the URL. Please check the URL and try again.';
        }

        await sock.sendMessage(chatId, { text: errorMessage }, { quoted: message });
    }
}

module.exports = inspectCommand;
