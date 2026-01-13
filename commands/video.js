const fs = require("fs");
const axios = require('axios');
const yts = require('yt-search');
const path = require('path');

async function videoCommand(sock, chatId, message) {
    try {
        await sock.sendMessage(chatId, {
            react: { text: '🎬', key: message.key }
        });

        const tempDir = path.join(__dirname, "temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

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

        // Try multiple APIs with fallback
        let apiData;
        
        // Try Keith API first
        try {
            const keithApiUrl = `https://apiskeith.vercel.app/download/video?url=${encodeURIComponent(videoUrl)}`;
            const response = await axios.get(keithApiUrl);
            if (response.data?.result) {
                apiData = {
                    downloadUrl: response.data.result,
                    title: videoTitle
                };
            } else {
                throw new Error("Keith API failed");
            }
        } catch (keithError) {
            // Try Yupra API as fallback
            try {
                const yupraApiUrl = `https://api.yupra.my.id/api/downloader/ytmp4?url=${encodeURIComponent(videoUrl)}`;
                const response = await axios.get(yupraApiUrl);
                if (response?.data?.success && response?.data?.data?.download_url) {
                    apiData = {
                        downloadUrl: response.data.data.download_url,
                        title: response.data.data.title || videoTitle
                    };
                } else {
                    throw new Error("Yupra API failed");
                }
            } catch (yupraError) {
                // Try Okatsu API as final fallback
                const okatsuApiUrl = `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp4?url=${encodeURIComponent(videoUrl)}`;
                const response = await axios.get(okatsuApiUrl);
                if (response?.data?.result?.mp4) {
                    apiData = {
                        downloadUrl: response.data.result.mp4,
                        title: response.data.result.title || videoTitle
                    };
                } else {
                    throw new Error("All APIs failed to fetch video!");
                }
            }
        }

        if (!apiData || !apiData.downloadUrl) throw new Error("API failed to fetch video!");

        const timestamp = Date.now();
        const fileName = `video_${timestamp}.mp4`;
        const filePath = path.join(tempDir, fileName);

        // Download video
        const videoResponse = await axios({
            method: "get",
            url: apiData.downloadUrl,
            responseType: "stream",
            timeout: 600000
        });

        const writer = fs.createWriteStream(filePath);
        videoResponse.data.pipe(writer);
        await new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
        });

        if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) throw new Error("Download failed or empty file!");

        await sock.sendMessage(chatId, { text: `_🎥 Playing:_\n _${apiData.title}_` });

        // Context info for video message
        const contextInfo = {
            externalAdReply: {
                title: apiData.title,
                body: 'Powered by YouTube Downloader',
                mediaType: 2,
                sourceUrl: videoUrl,
                thumbnailUrl: videoThumbnail,
                renderLargerThumbnail: false
            }
        };

        // Send video as document (matching playCommand pattern)
        await sock.sendMessage(chatId, { 
            document: { url: filePath }, 
            mimetype: "video/mp4", 
            fileName: `${apiData.title.substring(0, 100)}.mp4`,
            caption: `*${apiData.title}*`,
            contextInfo
        }, { quoted: message });

        // Cleanup
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    } catch (error) {
        console.error("Video command error:", error);
        return await sock.sendMessage(chatId, { text: `🚫 Error: ${error.message}` }, { quoted: message });
    }
}

module.exports = videoCommand;
