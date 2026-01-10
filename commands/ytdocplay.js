const fs = require("fs");
const axios = require('axios');
const yts = require('yt-search');
const path = require('path');

async function ytdocplayCommand(sock, chatId, message) {
    try {
        await sock.sendMessage(chatId, {
            react: { text: '🎶', key: message.key }
        });

        const tempDir = path.join(__dirname, "temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const parts = text.split(' ');
        const query = parts.slice(1).join(' ').trim();

        if (!query) {
            return await sock.sendMessage(chatId, {
                text: '📁 Provide a YouTube link or search query!\nExample: .ytdoc https://youtube.com/watch?v=...\nExample: .ytdoc lofi beats'
            }, { quoted: message });
        }

        if (query.length > 500) {
            return await sock.sendMessage(chatId, {
                text: '📝 Input too long! Max 500 characters.'
            }, { quoted: message });
        }

        // YouTube URL validation patterns
        const youtubePatterns = [
            /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/(watch\?v=|embed\/|v\/|shorts\/)?([a-zA-Z0-9_-]{11})/,
            /^https?:\/\/youtu\.be\/([a-zA-Z0-9_-]{11})/,
            /^https?:\/\/www\.youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
            /^https?:\/\/www\.youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
        ];

        let videoUrl;
        let isDirectLink = false;

        // Check if input is a YouTube URL
        for (const pattern of youtubePatterns) {
            const match = query.match(pattern);
            if (match) {
                const videoId = match[5] || match[1];
                videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
                isDirectLink = true;
                break;
            }
        }

        let videoInfo;
        
        if (isDirectLink) {
            // Direct YouTube URL provided
            try {
                const searchResults = await yts({ videoId: videoUrl.split('v=')[1] });
                videoInfo = searchResults;
            } catch (error) {
                return await sock.sendMessage(chatId, {
                    text: '❌ Invalid YouTube URL or video not found!'
                }, { quoted: message });
            }
        } else {
            // Search for the query
            const searchResults = await yts(query);
            if (!searchResults.videos || searchResults.videos.length === 0) {
                return await sock.sendMessage(chatId, {
                    text: '🔍 No results found! Try a different search.'
                }, { quoted: message });
            }
            videoInfo = searchResults.videos[0];
            videoUrl = videoInfo.url;
        }

        // Fetch MP3 from API
        const apiUrl = `https://api.privatezia.biz.id/api/downloader/ytmp3?url=${encodeURIComponent(videoUrl)}`;
        const response = await axios.get(apiUrl, { timeout: 10000 });
        const apiData = response.data;

        if (!apiData.status || !apiData.result || !apiData.result.downloadUrl) {
            throw new Error("API failed to fetch audio!");
        }

        const timestamp = Date.now();
        const fileName = `audio_${timestamp}.mp3`;
        const filePath = path.join(tempDir, fileName);

        // Download MP3 with timeout
        const audioResponse = await axios({
            method: "get",
            url: apiData.result.downloadUrl,
            responseType: "stream",
            timeout: 120000 // 2 minutes
        });

        const writer = fs.createWriteStream(filePath);
        audioResponse.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
            setTimeout(() => reject(new Error("Download timeout!")), 120000);
        });

        // Verify download
        if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
            throw new Error("Download failed - empty file!");
        }

        // Send as document
        const title = apiData.result.title || videoInfo.title || 'YouTube Audio';
        const safeTitle = title.replace(/[^\w\s-]/g, '').substring(0, 100);
        
        await sock.sendMessage(chatId, {
            text: `📥 *Downloading Audio*\n📄 Title: ${title}\n⏳ Duration: ${videoInfo.timestamp || 'N/A'}`
        });

        await sock.sendMessage(chatId, {
            document: { 
                url: filePath 
            },
            mimetype: "audio/mpeg",
            fileName: `${safeTitle}.mp3`
        }, { quoted: message });

        // Cleanup
        if (fs.existsSync(filePath)) {
            setTimeout(() => fs.unlinkSync(filePath), 5000);
        }

    } catch (error) {
        console.error("ytdocplayCommand error:", error);
        
        const errorMessage = error.response?.status === 404 
            ? 'Video not found or unavailable!'
            : error.message.includes('timeout')
            ? 'Request timed out! Try again.'
            : `Error: ${error.message}`;
            
        await sock.sendMessage(chatId, {
            text: `❌ ${errorMessage}`
        }, { quoted: message });
    }
}

module.exports = ytdocplayCommand;
