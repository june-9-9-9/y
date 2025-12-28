const fetch = require('node-fetch');

async function inspectCommand(sock, chatId, message, userMessage) {
    try {
        
        const args = userMessage.split(' ').slice(1).join(' ');
        // Show help if no arguments
        if (args.length === 0) {
            const helpMessage = `🔍 *INSPECT COMMAND*\n\n` +
                `*Usage:*\n` +
                `.inspect <url> - Fetch and inspect data from URL\n` +
                `.inspect <url> -j - Pretty JSON format\n` +
                `.inspect <url> -d - Download media\n` +
                `.inspect <url> -h - Show response headers only\n\n` +
                `*Examples:*\n` +
                `.inspect https://api.github.com/users/octocat\n` +
                `.inspect https://api.github.com/users/octocat -j\n` +
                `.inspect https://example.com/image.jpg -d\n` +
                `.inspect https://example.com -h`;
            
            await sock.sendMessage(chatId, { text: helpMessage }, { quoted: message });
            return;
        }
        
        // Parse arguments
        let url = args[0];
        const download = args.includes('-d');
        const json = args.includes('-j');
        const headersOnly = args.includes('-h');
        const followRedirects = !args.includes('-n'); // -n for no redirects
        
        // Send initial message
        await sock.sendMessage(chatId, { 
            text: `🔍 Inspecting:\n${url}` 
        }, { quoted: message });
        
        // Fetch the data
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; WhatsAppBot/1.0)'
            },
            redirect: followRedirects ? 'follow' : 'manual'
        });
        
        // Collect response info
        const responseInfo = {
            status: response.status,
            statusText: response.statusText,
            url: response.url,
            redirected: response.redirected,
            headers: {}
        };
        
        // Get headers
        response.headers.forEach((value, key) => {
            responseInfo.headers[key] = value;
        });
        
        // Handle headers-only request
        if (headersOnly) {
            let headersText = `📋 *Response Headers:*\n`;
            headersText += `Status: ${responseInfo.status} ${responseInfo.statusText}\n`;
            headersText += `URL: ${responseInfo.url}\n`;
            headersText += `Redirected: ${responseInfo.redirected}\n\n`;
            
            for (const [key, value] of Object.entries(responseInfo.headers)) {
                headersText += `${key}: ${value}\n`;
            }
            
            await sock.sendMessage(chatId, { 
                text: headersText 
            }, { quoted: message });
            return;
        }
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        // Get content type
        const contentType = response.headers.get('content-type') || '';
        
        // Handle media download
        if (download && (contentType.includes('audio/') || 
                         contentType.includes('video/') || 
                         contentType.includes('image/'))) {
            
            const contentLength = response.headers.get('content-length');
            const maxSize = 50 * 1024 * 1024; // 50MB WhatsApp limit
            
            if (contentLength && parseInt(contentLength) > maxSize) {
                await sock.sendMessage(chatId, { 
                    text: `❌ File too large (${(parseInt(contentLength)/1024/1024).toFixed(2)}MB)\nMaximum size: 50MB` 
                }, { quoted: message });
                return;
            }
            
            const buffer = await response.arrayBuffer();
            const fileBuffer = Buffer.from(buffer);
            
            if (contentType.includes('audio/')) {
                await sock.sendMessage(chatId, {
                    audio: fileBuffer,
                    mimetype: contentType
                }, { quoted: message });
            } else if (contentType.includes('video/')) {
                await sock.sendMessage(chatId, {
                    video: fileBuffer,
                    mimetype: contentType
                }, { quoted: message });
            } else if (contentType.includes('image/')) {
                await sock.sendMessage(chatId, {
                    image: fileBuffer
                }, { quoted: message });
            }
            
            await sock.sendMessage(chatId, { 
                text: `✅ Downloaded ${contentType.split('/')[0]}\nSize: ${(fileBuffer.length / 1024).toFixed(2)}KB` 
            }, { quoted: message });
            return;
        }
        
        // Handle JSON response
        if (json || contentType.includes('application/json')) {
            const jsonData = await response.json();
            const formattedJson = JSON.stringify(jsonData, null, 2);
            
            let displayJson = formattedJson;
            if (formattedJson.length > 2500) {
                displayJson = formattedJson.substring(0, 2500) + '\n\n... (truncated)';
            }
            
            let responseText = `📊 *JSON Response:*\n`;
            responseText += `Status: ${responseInfo.status}\n`;
            responseText += `Content-Type: ${contentType}\n`;
            responseText += `Size: ${formattedJson.length} characters\n\n`;
            responseText += `\`\`\`json\n${displayJson}\`\`\``;
            
            await sock.sendMessage(chatId, { 
                text: responseText 
            }, { quoted: message });
            return;
        }
        
        // Handle text response
        if (contentType.includes('text/')) {
            const text = await response.text();
            
            let displayText = text;
            if (text.length > 2500) {
                displayText = text.substring(0, 2500) + '\n\n... (truncated)';
            }
            
            let responseText = `📄 *Text Response:*\n`;
            responseText += `Status: ${responseInfo.status}\n`;
            responseText += `Content-Type: ${contentType}\n`;
            responseText += `Size: ${text.length} characters\n\n`;
            responseText += `\`\`\`\n${displayText}\`\`\``;
            
            await sock.sendMessage(chatId, { 
                text: responseText 
            }, { quoted: message });
            return;
        }
        
        // Handle other content types with detailed info
        let infoText = `📦 *Response Details:*\n\n`;
        infoText += `Status: ${responseInfo.status} ${responseInfo.statusText}\n`;
        infoText += `URL: ${responseInfo.url}\n`;
        infoText += `Content-Type: ${contentType}\n`;
        infoText += `Size: ${response.headers.get('content-length') || 'Unknown'} bytes\n`;
        infoText += `Redirected: ${responseInfo.redirected}\n\n`;
        
        // Show important headers
        const importantHeaders = ['server', 'date', 'cache-control', 'content-encoding', 'last-modified'];
        infoText += `*Important Headers:*\n`;
        for (const header of importantHeaders) {
            if (responseInfo.headers[header]) {
                infoText += `${header}: ${responseInfo.headers[header]}\n`;
            }
        }
        
        await sock.sendMessage(chatId, { 
            text: infoText 
        }, { quoted: message });
        
    } catch (error) {
        console.error('Inspect error:', error);
        
        let errorMessage = `❌ Inspection failed: ${error.message}`;
        
        if (error.name === 'AbortError') {
            errorMessage = '⏱️ Request timeout (30 seconds)';
        } else if (error.code === 'ENOTFOUND') {
            errorMessage = '🔍 Could not resolve domain';
        } else if (error.code === 'ECONNREFUSED') {
            errorMessage = '🚫 Connection refused';
        } else if (error.type === 'invalid-json') {
            errorMessage = '📄 Response is not valid JSON';
        }
        
        await sock.sendMessage(chatId, { 
            text: errorMessage 
        }, { quoted: message });
    }
}

module.exports = { inspectCommand };
