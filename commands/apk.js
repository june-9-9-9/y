// Enhanced APK Downloader with better error handling and features
    const axios = require('axios');

async function aiCommand(sock, chatId, message) {    
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
    const parts = text.split(' ');
    const command = parts[0].toLowerCase();
    const query = parts.slice(1).join(' ').trim();
    // Input validation
    if (!query) {
        await sock.sendMessage(chatId, {
            text: `*🔍 Please provide an app name to search.*\n\n_Usage:_\n${command} Instagram\n\n_Example:_\n${command} WhatsApp`
        }, { quoted: message });
        return;
    }

    // Query length validation
    if (query.length < 2) {
        await sock.sendMessage(chatId, {
            text: "❌ *Query too short.* Please provide at least 2 characters for search."
        }, { quoted: message });
        return;
    }

    // Rate limiting check (basic implementation)
    if (global.downloadRequests && global.downloadRequests[chatId]) {
        const lastRequest = global.downloadRequests[chatId];
        const timeDiff = Date.now() - lastRequest;
        if (timeDiff < 5000) { // 5 seconds cooldown
            await sock.sendMessage(chatId, {
                text: `⏳ *Please wait* ${Math.ceil((5000 - timeDiff) / 1000)} seconds before making another request.`
            }, { quoted: message });
            return;
        }
    }

    // Initialize rate limiting
    if (!global.downloadRequests) global.downloadRequests = {};
    global.downloadRequests[chatId] = Date.now();

    try {
        // React loading
        await sock.sendMessage(chatId, { react: { text: "🔍", key: message.key } });


        
        // Enhanced API URL with more parameters
        const apiUrl = `http://ws75.aptoide.com/api/7/apps/search/query=${encodeURIComponent(query)}/limit=10`;
        
        // Add timeout and headers
        const response = await axios.get(apiUrl, {
            timeout: 30000, // 30 seconds timeout
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const data = response.data;

        // Enhanced error handling for API response
        if (!data || !data.datalist || !data.datalist.list || data.datalist.list.length === 0) {
            await sock.sendMessage(chatId, {
                text: `❌ *No APK found for* "${query}"\n\n💡 *Suggestions:*\n• Check spelling\n• Try different keywords\n• App might not be available`
            }, { quoted: message });
            return;
        }

        // Get the first app (most relevant)
        const app = data.datalist.list[0];
        
        // Validate app data
        if (!app.file || !app.file.path_alt) {
            await sock.sendMessage(chatId, {
                text: "❌ *Download link not available* for this app."
            }, { quoted: message });
            return;
        }

        // Calculate size with proper formatting
        const sizeMB = app.size ? (app.size / (1024 * 1024)).toFixed(2) : 'Unknown';
        const downloads = app.downloads ? app.downloads.toLocaleString() : 'Unknown';
        const rating = app.rating ? app.rating.toFixed(1) : 'Not rated';

        // Enhanced caption with more details
        const caption = `
🎮 *${app.name || 'Unknown App'}*

📦 *Package:* \`${app.package || 'N/A'}\`
⭐ *Rating:* ${rating}/5
📥 *Downloads:* ${downloads}
📅 *Last Updated:* ${app.updated || 'Unknown'}
📁 *Size:* ${sizeMB} MB
🏷️ *Version:* ${app.vercode || app.vername || 'Unknown'}

🔒 *Use at your own risk. Always verify APK sources.*
`.trim();

        // Send processing reaction
        await sock.sendMessage(chatId, { react: { text: "⬇️", key: message.key } });

        // Verify file URL before sending
        try {
            const headResponse = await axios.head(app.file.path_alt, { timeout: 10000 });
            const contentLength = headResponse.headers['content-length'];
            
            if (contentLength && parseInt(contentLength) > 100 * 1024 * 1024) { // 100MB limit
                await sock.sendMessage(chatId, {
                    text: "❌ *File too large.* APK exceeds 100MB limit."
                }, { quoted: message });
                return;
            }
        } catch (error) {
            console.warn('Could not verify file URL:', error.message);
        }

        // Upload reaction
        await sock.sendMessage(chatId, { react: { text: "⬆️", key: message.key } });

        // Send the APK file with enhanced metadata
        await sock.sendMessage(chatId, {
            document: { 
                url: app.file.path_alt 
            },
            fileName: `${app.name.replace(/[^a-zA-Z0-9]/g, '_')}.apk`,
            mimetype: 'application/vnd.android.package-archive',
            caption: caption,
            contextInfo: {
                externalAdReply: {
                    title: app.name || 'APK Download',
                    body: `Rating: ${rating} | Size: ${sizeMB}MB`,
                    mediaType: 1,
                    thumbnailUrl: app.icon || '',
                    sourceUrl: app.file.path_alt,
                    renderLargerThumbnail: true,
                    showAdAttribution: false
                }
            }
        }, { quoted: message });

        // Success reaction
        await sock.sendMessage(chatId, { react: { text: "✅", key: message.key } });

        // Log successful download
        console.log(`APK downloaded: ${app.name} for query: ${query}`);

    } catch (error) {
        console.error('APK Download Error:', error);

        // Remove rate limit on error
        if (global.downloadRequests && global.downloadRequests[chatId]) {
            delete global.downloadRequests[chatId];
        }

        // Enhanced error messages
        let errorMessage = "❌ *An error occurred while processing your request.*";

        if (error.code === 'ECONNABORTED') {
            errorMessage = "⏰ *Request timeout.* Please try again later.";
        } else if (error.response) {
            if (error.response.status === 404) {
                errorMessage = "🔍 *API endpoint not found.* Service might be unavailable.";
            } else if (error.response.status >= 500) {
                errorMessage = "🔧 *Server error.* Please try again later.";
            }
        } else if (error.code === 'ENOTFOUND') {
            errorMessage = "🌐 *Network error.* Please check your connection.";
        }

        await sock.sendMessage(chatId, {
            text: errorMessage
        }, { quoted: message });

        // Error reaction
        await sock.sendMessage(chatId, { react: { text: "❌", key: message.key } });
    }
}

module.exports = aiCommand;
