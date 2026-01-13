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
        
        if (!query) return await sock.sendMessage(chatId, { 
            text: '🎵 Provide a song name!\nExample: .play Not Like Us'
        }, { quoted: message });
        
        if (query.length > 100) return await sock.sendMessage(chatId, { 
            text: `📝 Song name too long! Max 100 chars.`
        }, { quoted: message });
        
        // Search for the song
        const searchResults = await yts(`${query}`);
        if (!searchResults.videos || searchResults.videos.length === 0) {
            return sock.sendMessage(chatId, { 
                text: "😕 Couldn't find that song. Try another one!"
            }, { quoted: message });
        }
        
        const video = searchResults.videos[0];
        const apiUrl = `https://iamtkm.vercel.app/downloaders/ytmp3?apikey=tkm&url=${encodeURIComponent(video.url)}`;
        
        // Send initial processing message
        await sock.sendMessage(chatId, { 
            text: `🎵 *Processing:* ${video.title}\n⏳ Duration: ${video.timestamp}\n⬇️ Downloading audio...`
        }, { quoted: message });
        
        const response = await axios.get(apiUrl);
        const apiData = response.data;
        
        if (!apiData.status || !apiData.data || !apiData.data.url) {
            throw new Error("API failed to fetch track!");
        }
        
        const timestamp = Date.now();
        const fileName = `audio_${timestamp}.mp3`;
        const filePath = path.join(tempDir, fileName);
        
        // Download MP3 with better error handling
        const audioResponse = await axios({
            method: "get",
            url: apiData.data.url,
            responseType: "stream",
            timeout: 120000 // 2 minutes timeout
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
        
        // Get file stats
        const fileStats = fs.statSync(filePath);
        const fileSizeMB = (fileStats.size / (1024 * 1024)).toFixed(2);
        
        // Check if file is too large for WhatsApp (usually 16MB limit)
        if (fileStats.size > 15 * 1024 * 1024) {
            await sock.sendMessage(chatId, {
                text: `⚠️ File too large (${fileSizeMB}MB). WhatsApp has a 16MB limit for audio.\nTry searching for a shorter version.`
            }, { quoted: message });
            
            // Cleanup
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            return;
        }
        
        // Send as audio message (not document)
        await sock.sendMessage(chatId, {
            audio: { 
                url: filePath 
            },
            mimetype: 'audio/mpeg',
            ptt: false, // Set to true if you want push-to-talk format
            fileName: `${video.title.substring(0, 60)}.mp3`,
            caption: `🎵 *${video.title}*\n🎤 ${video.author.name}\n⏱️ ${video.timestamp}\n📊 Size: ${fileSizeMB}MB`
        }, { quoted: message });
        
        // Send additional info
        await sock.sendMessage(chatId, {
            text: `✅ *Download Complete!*\n\n*Title:* ${video.title}\n*Artist:* ${video.author.name}\n*Duration:* ${video.timestamp}\n*Views:* ${video.views.toLocaleString()}\n*Uploaded:* ${video.ago}\n\n🎧 Enjoy your music!`
        });
        
        // Cleanup with delay to ensure file is sent
        setTimeout(() => {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }, 30000); // Clean up after 30 seconds
        
    } catch (error) {
        console.error("Play command error:", error);
        return await sock.sendMessage(chatId, { 
            text: `🚫 *Error!*\n\nReason: ${error.message}\n\nPlease try again with a different song or check your connection.`
        }, { quoted: message });
    }
}

module.exports = playCommand;
