const fs = require("fs");
const axios = require("axios");
const path = require("path");

async function ytdocplayCommand(sock, chatId, message) {
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
                text: "📁 Provide a YouTube link!\nExample: .ytdoc https://youtube.com/watch?v=..."
            }, { quoted: message });
        }

        // Validate YouTube link
        const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
        if (!youtubeRegex.test(query)) {
            return await sock.sendMessage(chatId, {
                text: "❌ Please provide a valid YouTube link!"
            }, { quoted: message });
        }

        const videoUrl = query;

        // Fetch MP3 from API
        const apiUrl = `https://api.privatezia.biz.id/api/downloader/ytmp3?url=${encodeURIComponent(videoUrl)}`;
        const response = await axios.get(apiUrl, { timeout: 30000 }); // 30s API timeout
        const apiData = response.data;

        if (!apiData.status || !apiData.result || !apiData.result.downloadUrl) {
            throw new Error("API failed to fetch audio!");
        }

        const timestamp = Date.now();
        const fileName = `audio_${timestamp}.mp3`;
        const filePath = path.join(tempDir, fileName);

        // Download MP3 with extended timeout
        const audioResponse = await axios({
            method: "get",
            url: apiData.result.downloadUrl,
            responseType: "stream",
            timeout: 600000 // 10 minutes
        });

        const writer = fs.createWriteStream(filePath);
        audioResponse.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
        });

        if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
            throw new Error("Download failed - empty file!");
        }

        const title = apiData.result.title || "YouTube Audio";
        const safeTitle = title.replace(/[^\w\s-]/g, "").substring(0, 100);

        await sock.sendMessage(chatId, {
            text: `📥 *Downloading Audio*\n📄 Title: ${title}`
        });

        await sock.sendMessage(chatId, {
            document: { url: filePath },
            mimetype: "audio/mpeg",
            fileName: `${safeTitle}.mp3`
        }, { quoted: message });

        // Cleanup
        if (fs.existsSync(filePath)) {
            setTimeout(() => fs.unlinkSync(filePath), 10000); // delete after 10s
        }

    } catch (error) {
        console.error("ytdocplayCommand error:", error);

        const errorMessage = error.response?.status === 404
            ? "Video not found or unavailable!"
            : error.message.includes("timeout")
            ? "Request timed out! Try again."
            : `Error: ${error.message}`;

        await sock.sendMessage(chatId, {
            text: `❌ ${errorMessage}`
        }, { quoted: message });
    }
}

module.exports = ytdocplayCommand;
