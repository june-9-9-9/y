const fs = require("fs");
const axios = require('axios');
const yts = require('yt-search');
const path = require('path');

async function songCommand(sock, chatId, message) {
    try {
        await sock.sendMessage(chatId, {
            react: { text: '🎼', key: message.key }
        });

        const tempDir = path.join(__dirname, "temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const parts = text.split(' ');
        const query = parts.slice(1).join(' ').trim();

        if (!query) return await sock.sendMessage(chatId, { text: '🎵 Provide a song name or YouTube URL!\nExample: .song Not Like Us' }, { quoted: message });

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

        // Notify before playing
        await sock.sendMessage(chatId, { 
            text: `_Now Playing_\n_Title: ${videoTitle} Downloading..._` 
        }, { quoted: message });

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


        // Send as MP3 for better quality
        await sock.sendMessage(chatId, {
            audio: fs.readFileSync(filePath),
            mimetype: "audio/mpeg",
            fileName: `${videoTitle.substring(0, 100)}.mp3`
        }, { quoted: message });

        // Cleanup
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    } catch (error) {
        console.error("Song command error:", error);
        return await sock.sendMessage(chatId, { text: `🚫 Error: ${error.message}` }, { quoted: message });
    }
}

module.exports = songCommand;
