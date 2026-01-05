const fs = require("fs");
const axios = require("axios");
const path = require("path");

async function ytdocvideoCommand(sock, chatId, message) {
    try {
        await sock.sendMessage(chatId, {
            react: { text: "🎬", key: message.key }
        });

        const tempDir = path.join(__dirname, "temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const parts = text.split(" ");
        const query = parts.slice(1).join(" ").trim();

        if (!query) {
            return await sock.sendMessage(chatId, {
                text: "🎬 Provide a YouTube link\nExample:\n\nytdocvideo https://www.youtube.com/watch?v=abc123"
            }, { quoted: message });
        }

        // Validate YouTube link
        const ytRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
        if (!ytRegex.test(query)) {
            return await sock.sendMessage(chatId, {
                text: "🚫 Invalid input! Please provide a valid YouTube link."
            }, { quoted: message });
        }

        const apiUrl = `https://veron-apis.zone.id/downloader/youtube1?url=${encodeURIComponent(query)}`;
        const response = await axios.get(apiUrl);
        const apiData = response.data;

        if (!apiData.success || !apiData.result || !apiData.result.downloadUrl) {
            throw new Error("API failed to fetch video!");
        }

        const timestamp = Date.now();
        const fileName = `video_${timestamp}.mp4`;
        const filePath = path.join(tempDir, fileName);

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
            fileName: `${apiData.result.title.substring(0, 100)}.mp4`,
            caption: `*🎞️ YouTube Video Downloaded*\n\n *Title:* ${apiData.result.title}\n *Duration:* ${apiData.result.duration}\n *Channel:* ${apiData.result.channel}\n *Size:* ${fileSizeMB} MB`
        }, { quoted: message });

        // Cleanup
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    } catch (error) {
        console.error("ytdocvideo command error:", error);

        let errorMessage = `🚫 Error: ${error.message}`;
        if (error.message.includes("timeout")) {
            errorMessage = "⏱️ Download timeout! Video might be too large.";
        } else if (error.message.includes("API failed")) {
            errorMessage = "🔧 API error! Try again in a few moments.";
        } else if (error.message.includes("empty file")) {
            errorMessage = "📭 Download failed! Video might not be available.";
        }

        return await sock.sendMessage(chatId, { text: errorMessage }, { quoted: message });
    }
}

module.exports = ytdocvideoCommand;
