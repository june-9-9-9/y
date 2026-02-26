const fs = require("fs");
const axios = require("axios");
const yts = require("yt-search");
const path = require("path");
const os = require("os");

async function playCommand(sock, chatId, message) {
    try {
        // React to command
        await sock.sendMessage(chatId, { react: { text: "🎼", key: message.key } });

        // Prepare temp directory
        const tempDir = path.join(os.tmpdir(), "june-x-temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        // Extract query
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const query = text?.split(" ").slice(1).join(" ").trim();

        if (!query) {
            return sock.sendMessage(chatId, {
                text: "🎵 Provide a song name!\nExample: .play Not Like Us"
            }, { quoted: message });
        }

        if (query.length > 100) {
            return sock.sendMessage(chatId, {
                text: "📝 Song name too long! Max 100 chars."
            }, { quoted: message });
        }

        // Search YouTube
        const searchResult = (await yts(query + " official")).videos[0];
        if (!searchResult) {
            return sock.sendMessage(chatId, {
                text: "😕 Couldn't find that song. Try another one!"
            }, { quoted: message });
        }

        const video = searchResult;

        // API fallbacks
        const apis = [
            {
                url: `https://apiskeith.top/download/audio?url=${encodeURIComponent(video.url)}`,
                parse: (data) => data?.status ? { url: data.result, title: data.result.title } : null
            },
            {
                url: `https://apiskeith.top/download/audio?url=${encodeURIComponent(video.url)}`,
                parse: (data) => (data?.status && data?.result) ? { url: data.result, title: data.title } : null
            },
            {
                url: `https://api.giftedtech.co.ke/api/download/ytmp3?apikey=gifted&url=${encodeURIComponent(video.url)}`,
                parse: (data) => (data?.status && data?.result?.download_url) ? { url: data.result.download_url, title: data.result.title } : null
            }
        ];

        let downloadUrl, videoTitle;
        for (const api of apis) {
            try {
                const response = await axios.get(api.url, { timeout: 30000 });
                const result = api.parse(response.data);
                if (result) {
                    downloadUrl = result.url;
                    videoTitle = result.title || video.title;
                    break;
                }
            } catch {
                continue;
            }
        }

        if (!downloadUrl) throw new Error("API failed to fetch track!");

        // File setup
        const fileName = `audio_${Date.now()}.mp3`;
        const filePath = path.join(tempDir, fileName);

        // Download MP3
        const audioResponse = await axios({
            method: "get",
            url: downloadUrl,
            responseType: "stream",
            timeout: 900000, // 15 minutes
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            headers: { "User-Agent": "Mozilla/5.0" }
        });

        const writer = fs.createWriteStream(filePath);
        audioResponse.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", (err) => {
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                reject(err);
            });
        });

        if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
            throw new Error("Download failed or empty file!");
        }

        // Notify user
        const title = (videoTitle || video.title).substring(0, 100);
        await sock.sendMessage(chatId, { text: `_🎶 Track ready:_\n_${title}_` });

        // Send audio as document
        await sock.sendMessage(chatId, {
            document: { url: filePath },
            mimetype: "audio/mpeg",
            fileName: `${title}.mp3`
        }, { quoted: message });

        // Cleanup
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    } catch (error) {
        console.error("Play command error:", error);
        return sock.sendMessage(chatId, {
            text: `🚫 Error: ${error.message}`
        }, { quoted: message });
    }
}

module.exports = playCommand;
