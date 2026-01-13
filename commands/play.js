const fs = require("fs");
const axios = require('axios');
const yts = require('yt-search');
const path = require('path');

async function playCommand(sock, chatId, message) {
    try {
        await sock.sendMessage(chatId, {
            react: { text: '🎼', key: message.key }
        });

        const tempDir = path.join(__dirname, "temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const parts = text.split(' ');
        const query = parts.slice(1).join(' ').trim();

        if (!query) return await sock.sendMessage(chatId, { text: '🎵 Provide a song name or YouTube URL!\nExample: .play Not Like Us' }, { quoted: message });

        if (query.length > 100) return await sock.sendMessage(chatId, { text: `📝 Input too long! Max 100 chars.` }, { quoted: message });

        let videoUrl;
        let videoTitle;
        let videoThumbnail;

        // Check if input is a YouTube URL
        if (query.match(/(youtube\.com|youtu\.be)/i)) {
            videoUrl = query;
            const videoId = videoUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i)?.[1];
            if (!videoId) return await sock.sendMessage(chatId, { text: "❌ Invalid YouTube URL!" }, { quoted: message });
            
            videoTitle = "YouTube Audio";
            videoThumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
        } else {
            // Search for videos
            const searchResult = await (await yts(`${query} official`)).videos[0];
            if (!searchResult) return await sock.sendMessage(chatId, { text: "😕 Couldn't find that song. Try another one!" }, { quoted: message });

            videoUrl = searchResult.url;
            videoTitle = searchResult.title;
            videoThumbnail = searchResult.thumbnail;
        }

        // Download audio using Keith API
        const apiUrl = `https://apiskeith.vercel.app/download/audio?url=${encodeURIComponent(videoUrl)}`;
        const response = await axios.get(apiUrl);
        const downloadUrl = response.data?.result;

        if (!downloadUrl) throw new Error("API failed to fetch audio!");

        const timestamp = Date.now();
        const fileName = `audio_${timestamp}.mp3`;
        const filePath = path.join(tempDir, fileName);

        // Download MP3
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

        if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) throw new Error("Download failed or empty file!");

        // Context info for audio message
        const contextInfo = {
            externalAdReply: {
                title: videoTitle,
                body: 'Powered by Keith API',
                mediaType: 1,
                sourceUrl: videoUrl,
                thumbnailUrl: videoThumbnail,
                renderLargerThumbnail: false
            }
        };

        // Send as audio
        await sock.sendMessage(chatId, {
            audio: { url: downloadUrl },
            mimetype: "audio/mpeg",
            fileName: `${videoTitle.substring(0, 100)}.mp3`,
            contextInfo
        }, { quoted: message });

        // Send as document
        await sock.sendMessage(chatId, {
            document: { url: filePath },
            mimetype: "audio/mpeg",
            fileName: `${videoTitle.substring(0, 100)}.mp3`,
            contextInfo: {
                ...contextInfo,
                externalAdReply: {
                    ...contextInfo.externalAdReply,
                    body: 'Document version - Powered by Keith API'
                }
            }
        }, { quoted: message });

        // Cleanup
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    } catch (error) {
        console.error("Play command error:", error);
        return await sock.sendMessage(chatId, { text: `🚫 Error: ${error.message}` }, { quoted: message });
    }
}

module.exports = playCommand;
