const fs = require("fs");
const axios = require("axios");
const yts = require("yt-search");
const path = require("path");

// Error handler utility
function getErrorMessage(error) {
    const msg = (error.message || "").toLowerCase();

    if (msg.includes("timeout")) {
        return "⏱️ Download timeout! The video might be too large or the connection unstable.";
    }
    if (msg.includes("api failed")) {
        return "🔧 API error! The video service is currently unavailable. Please try again later.";
    }
    if (msg.includes("empty file")) {
        return "📭 Download failed! The video file is empty or inaccessible.";
    }
    if (msg.includes("network")) {
        return "🌐 Network error! Check your internet connection and try again.";
    }
    if (msg.includes("not found")) {
        return "🚫 Video not found! Please provide a valid YouTube link or name.";
    }

    // Default fallback
    return `⚠️ Unexpected error: ${error.message}`;
}

async function xvdlCommand(sock, chatId, message) {
    try {
        await sock.sendMessage(chatId, {
            react: { text: "🎬", key: message.key }
        });

        const tempDir = path.join(__dirname, "temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        const text =
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text;
        const parts = text.split(" ");
        const query = parts.slice(1).join(" ").trim();

        if (!query) {
            return await sock.sendMessage(
                chatId,
                {
                    text: "🎬 Provide a YouTube link or Name\nExample:\n\nxvdl Not Like Us Music Video\nxvdl Espresso "
                },
                { quoted: message }
            );
        }

        if (query.length > 100) {
            return await sock.sendMessage(
                chatId,
                {
                    text: `📝 Video name too long! Max 100 chars.`
                },
                { quoted: message }
            );
        }

        // Search for video
        const searchResult = (await yts(query)).videos[0];
        if (!searchResult) {
            return sock.sendMessage(
                chatId,
                {
                    text: " 🚫 Couldn't find that video. Try another one!"
                },
                { quoted: message }
            );
        }

        const video = searchResult;
        const apiUrl = `https://iamtkm.vercel.app/downloaders/xnxx?apikey=tkm&query=${encodeURIComponent(
            video.url
        )}`;

        const response = await axios.get(apiUrl);
        const apiData = response.data;

        if (!apiData?.status || !apiData?.result?.url) {
            throw new Error("API failed to fetch video!");
        }

        const timestamp = Date.now();
        const fileName = `video_${timestamp}.mp4`;
        const filePath = path.join(tempDir, fileName);

        // Download MP4 video
        const videoResponse = await axios({
            method: "get",
            url: apiData.result.url,
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
        await sock.sendMessage(
            chatId,
            {
                document: { url: filePath },
                mimetype: "video/mp4",
                fileName: `${video.title.substring(0, 100)}.mp4`,
                caption: `*🎞️ Video Downloaded*\n\n *Title:* ${video.title}\n *Duration:* ${video.timestamp}\n *Channel:* ${video.author.name}\n *Size:* ${fileSizeMB} MB`
            },
            { quoted: message }
        );

        // Cleanup
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (error) {
        console.error(`[xvdl] Error at ${new Date().toISOString()}:`, error.stack);

        const errorMessage = getErrorMessage(error);

        return await sock.sendMessage(
            chatId,
            {
                text: errorMessage
            },
            { quoted: message }
        );
    }
}

module.exports = xvdlCommand;
