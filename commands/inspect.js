const axios = require('axios');

async function fetchCommand(sock, chatId, message) {
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
    const parts = text.split(' ');
    const command = parts[0].toLowerCase();
    const url = parts.slice(1).join(' ').trim();
    
    // Input validation
    if (!url) {
        await sock.sendMessage(chatId, {
            text: `*🔗 Please provide a URL to fetch.*\n\n_Usage:_\n${command} https://example.com\n\n_Example:_\n${command} https://api.github.com/users/octocat`
        }, { quoted: message });
        return;
    }

    // URL validation
    try {
        new URL(url);
    } catch (error) {
        await sock.sendMessage(chatId, {
            text: "❌ *Invalid URL format.* Please provide a valid URL including protocol (http/https)."
        }, { quoted: message });
        return;
    }

    // Rate limiting check
    if (global.fetchRequests && global.fetchRequests[chatId]) {
        const lastRequest = global.fetchRequests[chatId];
        const timeDiff = Date.now() - lastRequest;
        if (timeDiff < 3000) { // 3 seconds cooldown
            await sock.sendMessage(chatId, {
                text: `⏳ *Please wait* ${Math.ceil((3000 - timeDiff) / 1000)} seconds before making another fetch request.`
            }, { quoted: message });
            return;
        }
    }

    // Initialize rate limiting
    if (!global.fetchRequests) global.fetchRequests = {};
    global.fetchRequests[chatId] = Date.now();

    try {
        // React loading
        await sock.sendMessage(chatId, { react: { text: "🔍", key: message.key } });

        // Enhanced request with timeout and headers
        const response = await axios({
            method: 'GET',
            url: url,
            timeout: 15000, // 15 seconds timeout
            maxContentLength: 50 * 1024 * 1024, // 50MB max
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive'
            },
            validateStatus: function (status) {
                return status >= 200 && status < 400; // Accept 2xx and 3xx status codes
            }
        });

        const contentType = response.headers['content-type'] || 'application/octet-stream';
        const contentLength = response.headers['content-length'];
        const buffer = Buffer.from(response.data);
        
        // Get filename from URL or headers
        let filename = url.split('/').pop() || "file";
        const contentDisposition = response.headers['content-disposition'];
        if (contentDisposition) {
            const match = contentDisposition.match(/filename="?([^"]+)"?/i);
            if (match) filename = match[1];
        }

        // Size validation
        if (contentLength && parseInt(contentLength) > 50 * 1024 * 1024) { // 50MB limit
            await sock.sendMessage(chatId, {
                text: `❌ *File too large.* Content exceeds 50MB limit.\n\n📊 *Details:*\n• Size: ${(contentLength / (1024 * 1024)).toFixed(2)} MB\n• Type: ${contentType}\n• URL: ${url}`
            }, { quoted: message });
            return;
        }

        // React processing
        await sock.sendMessage(chatId, { react: { text: "📥", key: message.key } });

        // Process based on content type
        let sent = false;
        
        // JSON Content
        if (contentType.includes('application/json') || url.endsWith('.json')) {
            try {
                const json = JSON.parse(buffer.toString());
                const jsonString = JSON.stringify(json, null, 2);
                const truncated = jsonString.length > 3500 ? jsonString.slice(0, 3500) + "\n... (truncated)" : jsonString;
                
                await sock.sendMessage(chatId, {
                    text: `📊 *JSON Response*\n\n\`\`\`json\n${truncated}\n\`\`\`\n\n🔗 *URL:* ${url}\n📁 *Type:* JSON\n📏 *Size:* ${buffer.length.toLocaleString()} bytes`
                }, { quoted: message });
                sent = true;
            } catch (jsonError) {
                // If JSON parsing fails, send as text
                const textContent = buffer.toString('utf8', 0, 4000);
                await sock.sendMessage(chatId, {
                    text: `📄 *Text Content*\n\n${textContent}${buffer.length > 4000 ? "\n... (truncated)" : ""}\n\n🔗 *URL:* ${url}\n📁 *Type:* Text\n📏 *Size:* ${buffer.length.toLocaleString()} bytes`
                }, { quoted: message });
                sent = true;
            }
        }
        
        // HTML Content
        else if (contentType.includes('text/html')) {
            const htmlContent = buffer.toString('utf8', 0, 3000);
            await sock.sendMessage(chatId, {
                text: `🌐 *HTML Content*\n\n\`\`\`html\n${htmlContent}${buffer.length > 3000 ? "\n... (truncated)" : ""}\n\`\`\`\n\n🔗 *URL:* ${url}\n📁 *Type:* HTML\n📏 *Size:* ${buffer.length.toLocaleString()} bytes`
            }, { quoted: message });
            sent = true;
        }
        
        // Image Content
        else if (contentType.includes('image/')) {
            await sock.sendMessage(chatId, {
                image: buffer,
                caption: `🖼️ *Image Fetched*\n\n🔗 *URL:* ${url}\n📁 *Type:* ${contentType}\n📏 *Size:* ${buffer.length.toLocaleString()} bytes\n📄 *Name:* ${filename}`
            }, { quoted: message });
            sent = true;
        }
        
        // Video Content
        else if (contentType.includes('video/')) {
            await sock.sendMessage(chatId, {
                video: buffer,
                caption: `🎬 *Video Fetched*\n\n🔗 *URL:* ${url}\n📁 *Type:* ${contentType}\n📏 *Size:* ${buffer.length.toLocaleString()} bytes\n📄 *Name:* ${filename}`
            }, { quoted: message });
            sent = true;
        }
        
        // Audio Content
        else if (contentType.includes('audio/')) {
            await sock.sendMessage(chatId, {
                audio: buffer,
                mimetype: contentType,
                fileName: filename,
                caption: `🎵 *Audio Fetched*\n\n🔗 *URL:* ${url}\n📁 *Type:* ${contentType}\n📏 *Size:* ${buffer.length.toLocaleString()} bytes`
            }, { quoted: message });
            sent = true;
        }
        
        // PDF Content
        else if (contentType.includes('application/pdf')) {
            await sock.sendMessage(chatId, {
                document: buffer,
                mimetype: contentType,
                fileName: filename.endsWith('.pdf') ? filename : `${filename}.pdf`,
                caption: `📄 *PDF Document*\n\n🔗 *URL:* ${url}\n📏 *Size:* ${buffer.length.toLocaleString()} bytes`
            }, { quoted: message });
            sent = true;
        }
        
        // Text Content
        else if (contentType.includes('text/')) {
            const textContent = buffer.toString('utf8', 0, 4000);
            await sock.sendMessage(chatId, {
                text: `📄 *Text Content*\n\n${textContent}${buffer.length > 4000 ? "\n... (truncated)" : ""}\n\n🔗 *URL:* ${url}\n📁 *Type:* ${contentType}\n📏 *Size:* ${buffer.length.toLocaleString()} bytes`
            }, { quoted: message });
            sent = true;
        }
        
        // Other Documents
        else if (contentType.includes('application/') || contentType.includes('text/')) {
            await sock.sendMessage(chatId, {
                document: buffer,
                mimetype: contentType,
                fileName: filename,
                caption: `📁 *Document Fetched*\n\n🔗 *URL:* ${url}\n📁 *Type:* ${contentType}\n📏 *Size:* ${buffer.length.toLocaleString()} bytes`
            }, { quoted: message });
            sent = true;
        }
        
        // Binary/Unknown Content
        else {
            await sock.sendMessage(chatId, {
                document: buffer,
                fileName: filename,
                caption: `📦 *File Fetched*\n\n🔗 *URL:* ${url}\n📁 *Type:* ${contentType || "Unknown"}\n📏 *Size:* ${buffer.length.toLocaleString()} bytes\n⚠️ *Note:* Unknown file type, downloading as document`
            }, { quoted: message });
            sent = true;
        }

        if (sent) {
            // Success reaction
            await sock.sendMessage(chatId, { react: { text: "✅", key: message.key } });
            
            // Log successful fetch
            console.log(`Content fetched: ${url} | Type: ${contentType} | Size: ${buffer.length} bytes`);
        }

    } catch (error) {
        console.error('Fetch Command Error:', error);

        // Remove rate limit on error
        if (global.fetchRequests && global.fetchRequests[chatId]) {
            delete global.fetchRequests[chatId];
        }

        // Enhanced error messages
        let errorMessage = "❌ *Failed to fetch the URL.*";

        if (error.code === 'ECONNABORTED') {
            errorMessage = "⏰ *Request timeout.* The server took too long to respond.";
        } else if (error.response) {
            if (error.response.status === 404) {
                errorMessage = "🔍 *URL not found.* The requested resource doesn't exist.";
            } else if (error.response.status === 403) {
                errorMessage = "🚫 *Access forbidden.* You don't have permission to access this URL.";
            } else if (error.response.status === 401) {
                errorMessage = "🔐 *Authentication required.* This URL requires login credentials.";
            } else if (error.response.status >= 500) {
                errorMessage = "🔧 *Server error.* The remote server encountered an error.";
            } else {
                errorMessage = `⚠️ *HTTP Error ${error.response.status}*\n\n${error.response.statusText || 'Request failed'}`;
            }
        } else if (error.code === 'ENOTFOUND') {
            errorMessage = "🌐 *DNS error.* Could not resolve the hostname.";
        } else if (error.code === 'ECONNREFUSED') {
            errorMessage = "🚫 *Connection refused.* The server rejected the connection.";
        } else if (error.message.includes('Invalid URL')) {
            errorMessage = "❌ *Invalid URL format.* Please check the URL and try again.";
        }

        await sock.sendMessage(chatId, {
            text: `${errorMessage}\n\n🔗 *URL:* ${url}\n💡 *Tips:*\n• Check if the URL is correct\n• Try adding https:// prefix\n• The site might be blocked or down`
        }, { quoted: message });

        // Error reaction
        await sock.sendMessage(chatId, { react: { text: "❌", key: message.key } });
    }
}

module.exports = fetchCommand;
