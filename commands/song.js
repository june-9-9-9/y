const fs = require("fs");
const axios = require("axios");
const yts = require("yt-search");
const path = require("path");

async function songCommand(sock, chatId, message) {
    try {
        await sock.sendMessage(chatId, {
            react: { text: "🎼", key: message.key }
        });

        const tempDir = path.join(__dirname, "temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        // Extract query from direct text or quoted message
        let text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        let query = null;

        if (text) {
            const parts = text.split(" ");
            query = parts.slice(1).join(" ").trim();
        }

        // Check quoted message
        const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!query && quoted) {
            if (quoted.conversation) {
                query = quoted.conversation.trim();
            } else if (quoted.extendedTextMessage?.text) {
                query = quoted.extendedTextMessage.text.trim();
            } else if (quoted.audioMessage) {
                // If audio is quoted, just resend it
                return await sock.sendMessage(chatId, {
                    audio: quoted.audioMessage,
                    mimetype: "audio/mpeg",
                    fileName: "quoted_audio.mp3"
                }, { quoted: message });
            } else if (quoted.videoMessage) {
                // If video is quoted, resend video or use caption as query
                const caption = quoted.videoMessage.caption || "";
                if (caption) query = caption.trim();
                else {
                    return await sock.sendMessage(chatId, {
                        video: quoted.videoMessage,
                        mimetype: "video/mp4",
                        fileName: "quoted_video.mp4"
                    }, { quoted: message });
                }
            }
        }

        if (!query) {
            return await sock.sendMessage(chatId, {
                text: "🎵 Provide a song name or reply to a message with .song\nExample: .song Not Like Us"
            }, { quoted: message });
        }

        if (query.length > 100) {
            return await sock.sendMessage(chatId, {
                text: "📝 Song name too long! Max 100 chars."
            }, { quoted: message });
        }

        // Search YouTube
        const searchResult = (await yts(`${query} official`)).videos[0];
        if (!searchResult) {
            return sock.sendMessage(chatId, {
                text: "😕 Couldn't find that song. Try another one!"
            }, { quoted: message });
        }

        const video = searchResult;
        const apiUrl = `https://apiskeith.vercel.app/download/audio?url=${encodeURIComponent(video.url)}`;
        const response = await axios.get(apiUrl);
        const apiData = response.data;

        if (!apiData.status || !apiData.result) throw new Error("API failed to fetch track!");

        const timestamp = Date.now();
        const fileName = `audio_${timestamp}.mp3`;
        const filePath = path.join(tempDir, fileName);

        // Download MP3
        const audioResponse = await axios({
            method: "get",
            url: apiData.result,
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

        await sock.sendMessage(chatId, {
            text: `_🎶 Playing:_\n_${apiData.title || video.title}_`
        });

        // Send audio
        await sock.sendMessage(chatId, {
            audio: { url: filePath },
            mimetype: "audio/mpeg",
            fileName: `${video.title}.mp3`
        }, { quoted: message });

        // Send as document too
        await sock.sendMessage(chatId, {
            document: { url: filePath },
            mimetype: "audio/mpeg",
            fileName: `${(apiData.title || video.title).substring(0, 100)}.mp3`
        }, { quoted: message });

        // Cleanup
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    } catch (error) {
        console.error("Song command error:", error);
        return await sock.sendMessage(chatId, {
            text: `🚫 Error: ${error.message}`
        }, { quoted: message });
    }
}

module.exports = songCommand;
