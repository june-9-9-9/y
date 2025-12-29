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

            // Prepare media object
            let mediaObject = {
                mimetype: contentType
            };

            let mediaType;
            
            if (contentType.includes('audio/')) {
                mediaObject.audio = fileBuffer;
                await sock.sendMessage(chatId, mediaObject, { quoted: message });
                mediaType = 'Audio';
            } else if (contentType.includes('video/')) {
                mediaObject.video = fileBuffer;
                await sock.sendMessage(chatId, mediaObject, { quoted: message });
                mediaType = 'Video';
            } else if (contentType.includes('image/')) {
                mediaObject.image = fileBuffer;
                // For images, you might want to add optional caption
                if (flags.includes('-c')) {
                    const captionIndex = flags.indexOf('-c') + 1;
                    if (captionIndex < flags.length) {
                        mediaObject.caption = flags[captionIndex];
                    }
                }
                await sock.sendMessage(chatId, mediaObject, { quoted: message });
                mediaType = 'Image';
            }

            // Prepare and send info message as a separate message
            const infoMessage = {
                text: `✅ Downloaded ${mediaType}\n*Size:* ${(fileBuffer.length / 1024).toFixed(2)}KB\n*Type:* ${contentType}\n*Original URL:* ${response.url}`
            };

            // Send info after media
            setTimeout(async () => {
                await sock.sendMessage(chatId, infoMessage, { quoted: message });
            }, 500);

            return;

        }

        // Enhanced media detection even without -d flag
        if (!download && (contentType.includes('audio/') || 
                         contentType.includes('image/') || 
                         contentType.includes('video/'))) {
            
            const buffer = await response.arrayBuffer();
            const fileBuffer = Buffer.from(buffer);
            const contentLength = response.headers.get('content-length');
            const fileSize = contentLength ? parseInt(contentLength) : fileBuffer.length;
            const maxSize = 50 * 1024 * 1024;

            if (fileSize > maxSize) {
                return await sock.sendMessage(chatId, {
                    text: `📁 *Media Detected*\n*Type:* ${contentType}\n*Size:* ${(fileSize/1024/1024).toFixed(2)}MB (too large)\n*URL:* ${response.url}\n\nUse *-d* flag to download media under 50MB`
                }, { quoted: message });
            }

            // Offer to download with button or instruction
            return await sock.sendMessage(chatId, {
                text: `📁 *Media Detected*\n*Type:* ${contentType}\n*Size:* ${(fileSize/1024/1024).toFixed(2)}MB\n*URL:* ${response.url}\n\nUse *.inspect ${url} -d* to download this media.`
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

            let responseText = `JSON RESPONSE:\n\n`;
            responseText += `\`\`\`json\n${formattedJson}\`\`\``;

            return await sock.sendMessage(chatId, { text: responseText }, { quoted: message });
        }

        if (contentType.includes('text/')) {
            const text = await response.text();

            let responseText = `*TEXT RESPONSE:*\n\n`;
            responseText += `\`\`\`\n${text}\`\`\``;

            return await sock.sendMessage(chatId, { text: responseText }, { quoted: message });
        }

        // Clean fallback
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
