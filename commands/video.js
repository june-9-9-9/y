const fs = require("fs");
const axios = require('axios');
const yts = require('yt-search');
const path = require('path');

async function videoCommand(sock, chatId, message) {
    try {
        await sock.sendMessage(chatId, {
            react: { text: '🎬', key: message.key }
        });

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const parts = text.split(' ');
        const query = parts.slice(1).join(' ').trim();

        if (!query) return await sock.sendMessage(chatId, { text: '🎥 Provide a video name or YouTube URL!\nExample: .video Not Like Us' }, { quoted: message });

        if (query.length > 100) return await sock.sendMessage(chatId, { text: `📝 Input too long! Max 100 chars.` }, { quoted: message });

        let videoUrl;
        let videoTitle;
        let videoThumbnail;

        // Check if input is a YouTube URL
        if (query.match(/(youtube\.com|youtu\.be)/i)) {
            videoUrl = query;
            const videoId = videoUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i)?.[1];
            if (!videoId) return await sock.sendMessage(chatId, { text: "❌ Invalid YouTube URL!" }, { quoted: message });
            
            videoTitle = "YouTube Video";
            videoThumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
        } else {
            // Search for videos
            const searchResult = await (await yts(query)).videos[0];
            if (!searchResult) return await sock.sendMessage(chatId, { text: "😕 Couldn't find that video. Try another one!" }, { quoted: message });

            videoUrl = searchResult.url;
            videoTitle = searchResult.title;
            videoThumbnail = searchResult.thumbnail;
        }

        // Send processing message
        await sock.sendMessage(chatId, { text: `📥 Downloading: *${videoTitle}*` }, { quoted: message });

        // Try Keith API first for video download
        let downloadUrl;
        let apiUsed = "Keith API";
        
        try {
            const keithResponse = await axios.get(`https://apiskeith.vercel.app/download/video?url=${encodeURIComponent(videoUrl)}`);
            if (keithResponse.data?.result) {
                downloadUrl = keithResponse.data.result;
            } else {
                throw new Error("No result from Keith API");
            }
        } catch (keithError) {
            console.log("Keith API failed, trying Yupra API...");
            apiUsed = "Yupra API";
            
            // Try Yupra API as fallback
            try {
                const yupraResponse = await axios.get(`https://api.yupra.my.id/api/downloader/ytmp4?url=${encodeURIComponent(videoUrl)}`);
                if (yupraResponse?.data?.success && yupraResponse?.data?.data?.download_url) {
                    downloadUrl = yupraResponse.data.data.download_url;
                    if (yupraResponse.data.data.title) {
                        videoTitle = yupraResponse.data.data.title;
                    }
                } else {
                    throw new Error("No download from Yupra");
                }
            } catch (yupraError) {
                console.log("Yupra API failed, trying Okatsu API...");
                apiUsed = "Okatsu API";
                
                // Try Okatsu API as final fallback
                const okatsuResponse = await axios.get(`https://okatsu-rolezapiiz.vercel.app/downloader/ytmp4?url=${encodeURIComponent(videoUrl)}`);
                if (okatsuResponse?.data?.result?.mp4) {
                    downloadUrl = okatsuResponse.data.result.mp4;
                    if (okatsuResponse.data.result.title) {
                        videoTitle = okatsuResponse.data.result.title;
                    }
                } else {
                    throw new Error("All video APIs failed!");
                }
            }
        }

        if (!downloadUrl) throw new Error("Failed to get video download URL");

        // Create temp directory
        const tempDir = path.join(__dirname, "temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        const timestamp = Date.now();
        const fileName = `video_${timestamp}.mp4`;
        const filePath = path.join(tempDir, fileName);

        // Download video
        const videoResponse = await axios({
            method: "get",
            url: downloadUrl,
            responseType: "stream",
            timeout: 600000
        });

        const writer = fs.createWriteStream(filePath);
        videoResponse.data.pipe(writer);
        await new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
        });

        if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
            throw new Error("Download failed or empty file!");
        }

        // Context info for video message
        const contextInfo = {
            externalAdReply: {
                title: videoTitle,
                body: `Powered by ${apiUsed}`,
                mediaType: 2, // Video media type
                sourceUrl: videoUrl,
                thumbnailUrl: videoThumbnail,
                renderLargerThumbnail: true
            }
        };

        // Send video
        await sock.sendMessage(chatId, {
            video: { url: filePath },
            mimetype: "video/mp4",
            caption: `*${videoTitle}*\n\nSource: ${videoUrl}`,
            contextInfo
        }, { quoted: message });

        // Send success message
        await sock.sendMessage(chatId, { 
            text: `✅ Video downloaded successfully!\nAPI used: ${apiUsed}` 
        }, { quoted: message });

        // Cleanup
        if (fs.existsSync(filePath)) {
            setTimeout(() => {
                fs.unlinkSync(filePath);
            }, 5000);
        }

    } catch (error) {
        console.error("Video command error:", error);
        
        // Send error message
        await sock.sendMessage(chatId, { 
            text: `🚫 Error: ${error.message || "Failed to download video. Please try again!"}` 
        }, { quoted: message });
        
        // React with error
        await sock.sendMessage(chatId, {
            react: { text: '❌', key: message.key }
        });
    }
}

module.exports = videoCommand;
