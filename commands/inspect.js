const axios = require('axios');

async function inspectCommand(sock, chatId, message) {
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
    const parts = text.split(' ');
    const command = parts[0].toLowerCase();
    const url = parts.slice(1).join(' ').trim();
    
    // Input validation
    if (!url) {
        await sock.sendMessage(chatId, {
            text: `*🔍 Please provide a URL to inspect.*\n\n_Usage:_\n${command} https://example.com\n\n_Example:_\n${command} https://api.github.com/users/octocat`
        }, { quoted: message });
        return;
    }

    // URL validation
    let parsedUrl;
    try {
        parsedUrl = new URL(url);
    } catch (error) {
        await sock.sendMessage(chatId, {
            text: "❌ *Invalid URL format.* Please provide a valid URL including protocol (http/https)."
        }, { quoted: message });
        return;
    }

    // Rate limiting check
    if (global.inspectRequests && global.inspectRequests[chatId]) {
        const lastRequest = global.inspectRequests[chatId];
        const timeDiff = Date.now() - lastRequest;
        if (timeDiff < 3000) { // 3 seconds cooldown
            await sock.sendMessage(chatId, {
                text: `⏳ *Please wait* ${Math.ceil((3000 - timeDiff) / 1000)} seconds before making another inspect request.`
            }, { quoted: message });
            return;
        }
    }

    // Initialize rate limiting
    if (!global.inspectRequests) global.inspectRequests = {};
    global.inspectRequests[chatId] = Date.now();

    try {
        // React loading
        await sock.sendMessage(chatId, { react: { text: "🔍", key: message.key } });

        // Enhanced request with timeout and headers
        const response = await axios({
            method: 'GET',
            url: url,
            timeout: 15000, // 15 seconds timeout
            maxContentLength: 5 * 1024 * 1024, // 5MB max for inspection
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

        // Size validation for inspection
        if (contentLength && parseInt(contentLength) > 5 * 1024 * 1024) { // 5MB limit for inspection
            const headersInfo = Object.entries(response.headers)
                .map(([key, value]) => `• ${key}: ${value}`)
                .join('\n');
            
            await sock.sendMessage(chatId, {
                text: `📊 *URL Inspection - Large Content*\n\n🔗 *URL:* ${url}\n🌐 *Domain:* ${parsedUrl.hostname}\n📏 *Size:* ${(contentLength / (1024 * 1024)).toFixed(2)} MB\n📁 *Type:* ${contentType}\n\n📋 *Response Headers:*\n\`\`\`\n${headersInfo}\n\`\`\`\n\n⚠️ *Note:* Content too large for full inspection (5MB limit)`
            }, { quoted: message });
            return;
        }

        // React processing
        await sock.sendMessage(chatId, { react: { text: "📊", key: message.key } });

        // Build response information
        const headersInfo = Object.entries(response.headers)
            .map(([key, value]) => `• ${key}: ${value}`)
            .join('\n');

        let contentPreview = '';
        let contentInfo = '';

        // Process based on content type
        // JSON Content
        if (contentType.includes('application/json') || url.endsWith('.json')) {
            try {
                const json = JSON.parse(buffer.toString());
                const jsonString = JSON.stringify(json, null, 2);
                const preview = jsonString.slice(0, 1000);
                contentPreview = `📋 *Content Preview:*\n\`\`\`json\n${preview}${jsonString.length > 1000 ? "\n... (preview truncated)" : ""}\n\`\`\``;
                contentInfo = `📁 *Type:* JSON\n📊 *Structure:* ${Object.keys(json).length} keys\n📏 *Size:* ${buffer.length.toLocaleString()} bytes`;
            } catch (jsonError) {
                const textContent = buffer.toString('utf8', 0, 1000);
                contentPreview = `📋 *Content Preview:*\n\`\`\`text\n${textContent}${buffer.length > 1000 ? "\n... (preview truncated)" : ""}\n\`\`\``;
                contentInfo = `📁 *Type:* Text (JSON parse failed)\n📏 *Size:* ${buffer.length.toLocaleString()} bytes`;
            }
        }
        // HTML Content
        else if (contentType.includes('text/html')) {
            const htmlContent = buffer.toString('utf8', 0, 1000);
            const titleMatch = htmlContent.match(/<title[^>]*>([^<]+)<\/title>/i);
            const title = titleMatch ? titleMatch[1] : 'No title found';
            const metaTags = htmlContent.match(/<meta[^>]+>/g) || [];
            
            contentPreview = `📋 *Content Preview:*\n🏷️ *Title:* ${title}\n📝 *Meta Tags:* ${metaTags.length}\n\`\`\`html\n${htmlContent.slice(0, 500)}${buffer.length > 500 ? "\n... (preview truncated)" : ""}\n\`\`\``;
            contentInfo = `📁 *Type:* HTML\n📄 *Elements:* ~${htmlContent.split('<').length} tags\n📏 *Size:* ${buffer.length.toLocaleString()} bytes`;
        }
        // Text Content
        else if (contentType.includes('text/')) {
            const textContent = buffer.toString('utf8', 0, 1000);
            const lines = textContent.split('\n').length;
            const words = textContent.split(/\s+/).filter(w => w.length > 0).length;
            
            contentPreview = `📋 *Content Preview:*\n\`\`\`text\n${textContent}${buffer.length > 1000 ? "\n... (preview truncated)" : ""}\n\`\`\``;
            contentInfo = `📁 *Type:* ${contentType}\n📊 *Lines:* ${lines}\n📝 *Words:* ${words}\n📏 *Size:* ${buffer.length.toLocaleString()} bytes`;
        }
        // Media Content
        else if (contentType.includes('image/') || contentType.includes('video/') || contentType.includes('audio/')) {
            contentPreview = `🖼️ *Media File Detected*\n📁 *Filename:* ${filename}\n🔤 *MIME Type:* ${contentType}`;
            contentInfo = `📁 *Type:* ${contentType.split('/')[0].toUpperCase()}\n📏 *Size:* ${buffer.length.toLocaleString()} bytes\n📦 *Format:* ${contentType.split('/')[1]}`;
        }
        // Other Content
        else {
            const hexPreview = buffer.toString('hex', 0, 100);
            contentPreview = `📋 *Content Preview (Hex):*\n\`\`\`hex\n${hexPreview}${buffer.length > 50 ? "\n... (hex preview truncated)" : ""}\n\`\`\``;
            contentInfo = `📁 *Type:* ${contentType}\n📏 *Size:* ${buffer.length.toLocaleString()} bytes\n🔤 *Encoding:* Binary`;
        }

        // Send inspection results
        await sock.sendMessage(chatId, {
            text: `🔍 *URL Inspection Results*\n\n🔗 *URL:* ${url}\n🌐 *Domain:* ${parsedUrl.hostname}\n⚡ *Status:* ${response.status} ${response.statusText}\n📄 *Filename:* ${filename}\n\n${contentInfo}\n\n📋 *Response Headers:*\n\`\`\`\n${headersInfo.slice(0, 1500)}\n\`\`\`\n\n${contentPreview}`
        }, { quoted: message });

        // Success reaction
        await sock.sendMessage(chatId, { react: { text: "✅", key: message.key } });
        
        // Log successful inspection
        console.log(`URL inspected: ${url} | Status: ${response.status} | Type: ${contentType} | Size: ${buffer.length} bytes`);

    } catch (error) {
        console.error('Inspect Command Error:', error);

        // Remove rate limit on error
        if (global.inspectRequests && global.inspectRequests[chatId]) {
            delete global.inspectRequests[chatId];
        }

        // Enhanced error messages
        let errorMessage = "❌ *Failed to inspect the URL.*";

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
            text: `${errorMessage}\n\n🔗 *URL:* ${url}\n💡 *Tips:*\n• Check if the URL is correct\n• Try adding https:// prefix\n• The site might be blocked or down\n• Verify network connectivity`
        }, { quoted: message });

        // Error reaction
        await sock.sendMessage(chatId, { react: { text: "❌", key: message.key } });
    }
}

module.exports = inspectCommand;
