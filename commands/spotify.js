const axios = require('axios');

async function spotifyCommand(sock, chatId, message) {
    try {
        const rawText = message.message?.conversation?.trim() ||
            message.message?.extendedTextMessage?.text?.trim() ||
            message.message?.imageMessage?.caption?.trim() ||
            message.message?.videoMessage?.caption?.trim() ||
            '';
        
        const used = (rawText || '').split(/\s+/)[0] || '.spotify';
        const query = rawText.slice(used.length).trim();
        
        if (!query) {
            await sock.sendMessage(chatId, { 
                text: 'Usage: .spotify <song/artist/keywords>\n\nExample: .spotify Faded\nExample: .spotify Alan Walker' 
            }, { quoted: message });
            return;
        }

        // Send initial reaction
        await sock.sendMessage(chatId, {
            react: { text: '🔍', key: message.key }
        });

        // Call the new API
        const apiUrl = `https://veron-apis.zone.id/downloader/spotify?query=${encodeURIComponent(query)}`;
        const { data } = await axios.get(apiUrl, { 
            timeout: 30000, // Increased timeout for processing
            headers: { 
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'accept': 'application/json'
            } 
        });

        // Check if API call was successful
        if (!data?.success || !data?.result?.success || !data.result.metadata) {
            throw new Error(data?.result?.error || 'No results found for this query');
        }

        const metadata = data.result.metadata;
        const downloadInfo = data.result.downloadInfo;

        // Build direct download URL
        const directDownloadUrl = `https://veron-apis.zone.id${downloadInfo.directDownload}`;

        // Build caption
        let caption = `🎵 *Spotify Music*\n\n`;
        caption += `📔 Title: *${metadata.title}*\n`;
        caption += `👤 Artist: ${metadata.artist}\n`;
        caption += `⏰ Duration: ${metadata.duration}\n`;
        caption += `📦 Size: ${(downloadInfo.size / 1024 / 1024).toFixed(2)} MB\n`;
        caption += `🎧 Format: ${downloadInfo.format}\n`;
        caption += `✨ Quality: ${downloadInfo.quality}\n`;
        
        if (metadata.url) {
            caption += `\n🔗 Spotify URL: ${metadata.url}`;
        }
        caption += `\n\n📥 Downloading audio please wait...`;

        // Send thumbnail with caption
        if (metadata.cover) {
            await sock.sendMessage(chatId, { 
                image: { url: metadata.cover }, 
                caption 
            }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { 
                text: caption 
            }, { quoted: message });
        }

        // Update reaction
        await sock.sendMessage(chatId, {
            react: { text: '⬇️', key: message.key }
        });

        // Send audio file
        const safeTitle = metadata.title.replace(/[\\/:*?"<>|]/g, '');
        await sock.sendMessage(chatId, {
            audio: { url: directDownloadUrl },
            mimetype: 'audio/mpeg',
            fileName: `${safeTitle} - ${metadata.artist}.mp3`
        }, { quoted: message });

        // Success reaction
        await sock.sendMessage(chatId, {
            react: { text: '✅', key: message.key }
        });
        

    } catch (error) {
        console.error('[SPOTIFY] error:', error?.message || error);
        
        let errorMsg = 'Unknown error occurred';
        if (error?.response?.data?.message) {
            errorMsg = error.response.data.message;
        } else if (error?.message) {
            errorMsg = error.message;
        } else if (error?.response?.data?.result?.error) {
            errorMsg = error.response.data.result.error;
        }

        await sock.sendMessage(chatId, { 
            text: `❌ *Failed to download Spotify audio*\n\n` +
                  `_Error:_ ${errorMsg}\n\n` +
                  `Please try:\n` +
                  `• Different search keywords\n` +
                  `• Check your internet connection\n` +
                  `• Try again later`
        }, { quoted: message });
    }
}

module.exports = spotifyCommand;
