const fs = require("fs");
const axios = require('axios');
const yts = require('yt-search');
const path = require('path');

async function ytdocvideoCommand(sock, chatId, message) {
    try {
        await sock.sendMessage(chatId, {
            react: { text: '🎬', key: message.key }
        });

        const tempDir = path.join(__dirname, "temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const parts = text.split(' ');
        const query = parts.slice(1).join(' ').trim();

        if (!query) return await sock.sendMessage(chatId, {
            text: '🎬 Provide a YouTube video name!\nExample: .ytdocvideo Not Like Us Music Video'
        }, { quoted: message });

        if (query.length > 100) return await sock.sendMessage(chatId, {
            text: `📝 Video name too long! Max 100 chars.`
        }, { quoted: message });

        // Search for video
        const searchResult = await (await yts(`${query}`)).videos[0];
        if (!searchResult) return sock.sendMessage(chatId, {
            text: " 🚫 Couldn't find that video. Try another one!"
        }, { quoted: message });

        const video = searchResult;
        const apiUrl = `https://veron-apis.zone.id/downloader/youtube1?url=${encodeURIComponent(video.url)}`;
        const response = await axios.get(apiUrl);
        const apiData = response.data;

        if (!apiData.success || !apiData.result || !apiData.result.downloadUrl) {
            throw new Error("API failed to fetch video!");
        }

        const timestamp = Date.now();
        const fileName = `video_${timestamp}.mp4`;
        const filePath = path.join(tempDir, fileName);

        // Send processing message
        await sock.sendMessage(chatId, {
            text: `📥 *Downloading Video...*\n_Title: ${video.title}_\n_Duration: ${video.timestamp}_\n_Channel: ${video.author.name}_`
        }, { quoted: message });

        // Download MP4 video
        const videoResponse = await axios({
            method: "get",
            url: apiData.result.downloadUrl,
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
            throw new Error("Video download failed or empty file!");
        }

        // Get file size
        const fileSize = fs.statSync(filePath).size;
        const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);

        // Send as document (video)
        await sock.sendMessage(chatId, {
            document: { url: filePath },
            mimetype: "video/mp4",
            fileName: `${video.title.substring(0, 100)}.mp4`,
            caption: `🎬 *YouTube Video Downloaded*\n\n📌 *Title:* ${video.title}\n⏱️ *Duration:* ${video.timestamp}\n👤 *Channel:* ${video.author.name}\n📊 *Size:* ${fileSizeMB} MB`
        }, { quoted: message });

        // Cleanup
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    } catch (error) {
        console.error("ytdocvideo command error:", error);
        
        // Provide specific error messages
        let errorMessage = `🚫 Error: ${error.message}`;
        
        if (error.message.includes("timeout")) {
            errorMessage = "⏱️ Download timeout! Video might be too large.";
        } else if (error.message.includes("API failed")) {
            errorMessage = "🔧 API error! Try again in a few moments.";
        } else if (error.message.includes("empty file")) {
            errorMessage = "📭 Download failed! Video might not be available.";
        }
        
        return await sock.sendMessage(chatId, {
            text: errorMessage
        }, { quoted: message });
    }
}

module.exports = ytdocvideoCommand;
