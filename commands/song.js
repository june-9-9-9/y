const fs = require("fs");
const axios = require("axios");
const yts = require("yt-search");
const path = require("path");

async function songCommand(sock, chatId, message) {
    try {
        // React to command
        await sock.sendMessage(chatId, {
            react: { text: "🎼", key: message.key }
        });

        // Ensure temp directory exists
        const tempDir = path.join(__dirname, "temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        // Extract query
        const text =
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text;
        const parts = text.split(" ");
        const query = parts.slice(1).join(" ").trim();

        if (!query)
            return await sock.sendMessage(
                chatId,
                {
                    text: "🎵 Provide a song name!\nExample: .song Not Like Us"
                },
                { quoted: message }
            );

        if (query.length > 100)
            return await sock.sendMessage(
                chatId,
                {
                    text: `📝 Song name too long! Max 100 chars.`
                },
                { quoted: message }
            );

        // Search YouTube
        const searchResult = (await yts(`${query} official`)).videos[0];
        if (!searchResult)
            return sock.sendMessage(
                chatId,
                {
                    text: "😕 Couldn't find that song. Try another one!"
                },
                { quoted: message }
            );

        const video = searchResult;
        const apiUrl = `https://api.privatezia.biz.id/api/downloader/ytmp3?url=${encodeURIComponent(
            video.url
        )}`;
        const response = await axios.get(apiUrl);
        const apiData = response.data;

        if (!apiData.status || !apiData.result || !apiData.result.downloadUrl) {
            throw new Error("API failed to fetch track!");
        }

        const timestamp = Date.now();
        const fileName = `audio_${timestamp}.mp3`;
        const filePath = path.join(tempDir, fileName);

        // Notify user
        await sock.sendMessage(chatId, {
            text: `_🎶 Downloading:_\n_${apiData.result.title || video.title}_`
        });

        // Download MP3
        const audioResponse = await axios({
            method: "get",
            url: apiData.result.downloadUrl,
            responseType: "stream",
            timeout: 600000
        });

        const writer = fs.createWriteStream(filePath);
        audioResponse.data.pipe(writer);
        await new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
        });

        if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
            throw new Error("Download failed or empty file!");
        }

        // Clean filename
        const fileNameClean = `${(
            apiData.result.title || video.title
        ).replace(/[<>:"/\\|?*]/g, "_").substring(0, 100)}.mp3`;

        // ✅ Send both audio and document
        await sock.sendMessage(
            chatId,
            {
                audio: { url: filePath },
                mimetype: "audio/mpeg",
                fileName: fileNameClean,
                ptt: false // set true if you want voice note style
            },
            { quoted: message }
        );

        await sock.sendMessage(
            chatId,
            {
                document: { url: filePath },
                mimetype: "audio/mpeg",
                fileName: fileNameClean
            },
            { quoted: message }
        );

        // Cleanup after 5s
        if (fs.existsSync(filePath)) {
            setTimeout(() => {
                try {
                    fs.unlinkSync(filePath);
                } catch (cleanupError) {
                    console.error("Cleanup error:", cleanupError);
                }
            }, 5000);
        }
    } catch (error) {
        console.error("Song command error:", error);
        return await sock.sendMessage(
            chatId,
            {
                text: `🚫 Error: ${error.message}`
            },
            { quoted: message }
        );
    }
}

module.exports = songCommand;
