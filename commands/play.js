const fs = require("fs");
const axios = require('axios');
const path = require('path');

async function playCommand(sock, chatId, message) {
    try {
        // Send reaction
        await sock.sendMessage(chatId, {
            react: { text: '🎵', key: message.key }
        });

        // Create temp directory if it doesn't exist
        const tempDir = path.join(__dirname, "temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        // Extract query from message
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const parts = text.split(' ');
        const query = parts.slice(1).join(' ').trim();

        // Check if query exists
        if (!query) return await sock.sendMessage(chatId, { 
            text: '🎵 Provide a song name or YouTube URL!\nExample: .play Not Like Us\nExample: .play https://youtube.com/watch?v=...'
        }, { quoted: message });

        // Check query length
        if (query.length > 500) return await sock.sendMessage(chatId, { 
            text: '📝 Query too long! Max 500 characters.'
        }, { quoted: message });

        let videoUrl;
        let videoTitle;

        // Check if input is a YouTube URL
        if (query.match(/(youtube\.com|youtu\.be)/i)) {
            videoUrl = query;
            const videoId = videoUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i)?.[1];
            if (!videoId) {
                return await sock.sendMessage(chatId, { 
                    text: '❌ Invalid YouTube URL!'
                }, { quoted: message });
            }
            videoTitle = "YouTube Audio";
        } else {
            // Search for video
            const searchResponse = await axios.get(`https://apiskeith.vercel.app/search/yts?query=${encodeURIComponent(query)}`);
            const videos = searchResponse.data?.result;
            
            if (!Array.isArray(videos) || videos.length === 0) {
                return await sock.sendMessage(chatId, { 
                    text: '😕 Could not find any results for your search!'
                }, { quoted: message });
            }

            const firstVideo = videos[0];
            videoUrl = firstVideo.url;
            videoTitle = firstVideo.title;
        }

        // Download audio
        const downloadResponse = await axios.get(`https://apiskeith.vercel.app/download/audio?url=${encodeURIComponent(videoUrl)}`);
        const downloadUrl = downloadResponse.data?.result;
        
        if (!downloadUrl) {
            return await sock.sendMessage(chatId, { 
                text: '❌ Failed to download audio from YouTube!'
            }, { quoted: message });
        }

        // Generate filename
        const timestamp = Date.now();
        const fileName = `audio_${timestamp}.mp3`;
        const filePath = path.join(tempDir, fileName);

        // Download MP3 to temp file
        const audioResponse = await axios({
            method: "get",
            url: downloadUrl,
            responseType: "stream",
            timeout: 600000
        });
        
        const writer = fs.createWriteStream(filePath);
        audioResponse.data.pipe(writer);
        await new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
        });

        // Check if file was downloaded successfully
        if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
            throw new Error("Download failed or empty file!");
        }

        // Clean filename for sending
        const cleanFileName = `${videoTitle.replace(/[^\w\s.-]/gi, '')}.mp3`.substring(0, 100);

        // Send audio as audio message
        await sock.sendMessage(chatId, {
            audio: { url: `file://${filePath}` },
            mimetype: "audio/mpeg",
            fileName: cleanFileName
        }, { quoted: message });

        // Send audio as document
        await sock.sendMessage(chatId, {
            document: { url: `file://${filePath}` },
            mimetype: "audio/mpeg",
            fileName: cleanFileName
        }, { quoted: message });

        // Cleanup temp file
        if (fs.existsSync(filePath)) {
            setTimeout(() => {
                fs.unlinkSync(filePath);
            }, 10000); // Delete after 10 seconds to ensure sending is complete
        }

    } catch (error) {
        console.error("Play command error:", error);
        
        let errorMessage = "🚫 Error processing your request!";
        if (error.message.includes("timeout")) {
            errorMessage = "⏰ Download timeout! Try again later.";
        } else if (error.message.includes("network")) {
            errorMessage = "🌐 Network error! Check your connection.";
        }
        
        return await sock.sendMessage(chatId, { 
            text: errorMessage
        }, { quoted: message });
    }
}

module.exports = playCommand;
