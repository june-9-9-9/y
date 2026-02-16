const fs = require("fs");
const axios = require('axios');
const yts = require('yt-search');
const path = require('path');
const os = require("os");

async function playCommand(sock, chatId, message) {
    try { 
        await sock.sendMessage(chatId, {
            react: { text: '🎼', key: message.key }
        });
        
        // Use a safe temp directory
        const tempDir = path.join(__dirname, "temp");
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        } else {
            const stat = fs.statSync(tempDir);
            if (!stat.isDirectory()) {
                // If "temp" exists but is a file, delete it and recreate as directory
                fs.unlinkSync(tempDir);
                fs.mkdirSync(tempDir, { recursive: true });
            }
        }
        
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const parts = text.split(' ');
        const query = parts.slice(1).join(' ').trim();

        if (!query) return await sock.sendMessage(chatId, { text: '🎵 Provide a song name!\nExample:.play Not Like Us'},{ quoted: message});

        if (query.length > 100) return await sock.sendMessage(chatId, { text: `📝 Song name too long! Max 100 chars.`},{ quoted: message});

        const searchResult = await (await yts(`${query} official`)).videos[0];
        if (!searchResult) return sock.sendMessage(chatId, { text: "😕 Couldn't find that song. Try another one!"},{ quoted: message });

        const video = searchResult;
        
        let downloadUrl;
        let videoTitle;
        
        const apis = [
            `https://apiskeith.vercel.app/download/audio?url=${encodeURIComponent(video.url)}`,
            `https://api.giftedtech.co.ke/api/download/ytmp3?apikey=gifted&url=${encodeURIComponent(video.url)}`,
            `https://apis.xwolf.space/download/yta3?url=${encodeURIComponent(video.url)}`
        ];
        
        for (const api of apis) {
            try {
                const response = await axios.get(api, { timeout: 30000 });
                
                if (api.includes('apiskeith')) {
                    if (response.data?.status && response.data?.result) {
                        downloadUrl = response.data.result;
                        videoTitle = response.data.title || video.title;
                        break;
                    }
                } else if (api.includes('gifted2')) {
                    if (response.data?.status && response.data?.result?.download_url) {
                        downloadUrl = response.data.result.download_url;
                        videoTitle = response.data.result.title || video.title;
                        break;
                    }
                } else if (api.includes('gifted')) {
                    if (response.data?.status && response.data?.result?.downloadUrl) {
                        downloadUrl = response.data.result.downloadUrl;
                        videoTitle = response.data.result.title || video.title;
                        break;
                    }
                }
            } catch (e) {
                continue;
            }
        }
        
        if (!downloadUrl) throw new Error("All download APIs failed. Try again later.");

        const timestamp = Date.now();
        const fileName = `audio_${timestamp}.mp3`;
        const filePath = path.join(tempDir, fileName);

        const audioResponse = await axios({ 
            method: "get", 
            url: downloadUrl, 
            responseType: "stream", 
            timeout: 900000,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const writer = fs.createWriteStream(filePath);
        audioResponse.data.pipe(writer);
        await new Promise((resolve, reject) => { 
            writer.on("finish", resolve); 
            writer.on("error", reject); 
        });

        if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) throw new Error("Download failed or empty file!");
        
        // Send ONLY document - clean, no caption, no extra notifications
        await sock.sendMessage(chatId, { 
            document: { url: filePath }, 
            mimetype: "audio/mpeg", 
            fileName: `${(videoTitle || video.title).substring(0, 100)}.mp3`
        }, { quoted: message });

        // Cleanup
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    } catch (error) {
        console.error("Play command error:", error);
        return await sock.sendMessage(chatId, { text: `🚫 Error: ${error.message || "Failed to download audio"}`},{ quoted: message});
    }
}

module.exports = playCommand;
