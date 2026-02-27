const fs = require("fs");
const axios = require("axios");
const yts = require("yt-search");
const path = require("path");

const AXIOS_DEFAULTS = {
    timeout: 60000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
    }
};

// Create fake contact for enhanced replies
function createFakeContact(message) {
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "status@broadcast",
            fromMe: false,
            id: "Smart project"
        },
        message: {
            contactMessage: {
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN: whatsapp bot\nitem1.TEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

async function tryRequest(getter, attempts = 2) {
    let lastError;
    for (let i = 1; i <= attempts; i++) {
        try {
            return await getter();
        } catch (err) {
            lastError = err;
            if (i < attempts) await new Promise(r => setTimeout(r, 1500));
        }
    }
    throw lastError;
}

async function searchYouTube(query) {
    try {
        // Search for the video with 'official' to get better results
        const searchResults = await yts(`${query} official audio`);
        
        if (!searchResults.videos || searchResults.videos.length === 0) {
            // Try without 'official' if no results
            const fallbackResults = await yts(query);
            return fallbackResults.videos[0] || null;
        }
        
        return searchResults.videos[0];
    } catch (error) {
        console.error("YouTube search error:", error);
        throw new Error("Failed to search YouTube");
    }
}

async function getAudioDownload(youtubeUrl, title) {
    const apis = [
        `https://api.giftedtech.co.ke/api/download/yta?apikey=gifted&url=${encodeURIComponent(youtubeUrl)}`,
        `https://apiskeith.top/download/ytmp3?url=${encodeURIComponent(youtubeUrl)}`,
    ];

    let lastError;
    for (const apiUrl of apis) {
        try {
            const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
            if (!res?.data) continue;

            const data = res.data;
            const result = data.result || data;
            const url = (typeof result === 'string' && result.startsWith('http')) ? result :
                result?.download_url || result?.url || result?.downloadUrl || null;

            if (url) {
                return {
                    download: url,
                    title: title || result?.title || data?.title || 'YouTube Audio'
                };
            }
        } catch (err) {
            lastError = err;
            continue;
        }
    }
    throw lastError || new Error('All audio APIs failed');
}

async function playCommand(sock, chatId, message, fkontak) {
    try {
        await sock.sendMessage(chatId, { react: { text: "🎼", key: message.key } });

        const tempDir = path.join(__dirname, "temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        const text =
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            "";

        const parts = text.split(" ");
        const query = parts.slice(1).join(" ").trim();

        // Use fkontak if provided, otherwise create fake contact
        const quoted = fkontak || createFakeContact(message);

        if (!query)
            return sock.sendMessage(chatId, { text: "🎵 Provide a song name!\nExample: .play Not Like Us" }, { quoted });

        if (query.length > 100)
            return sock.sendMessage(chatId, { text: "📝 Song name too long! Max 100 chars." }, { quoted });

        // Search for the video using yt-search
        const video = await searchYouTube(query);

        if (!video) {
            return sock.sendMessage(chatId, { 
                text: "😕 Couldn't find that song. Try another one!" 
            }, { quoted });
        }

        // Log the found video info (optional, for debugging)
        console.log(`Found video: ${video.title} (${video.url})`);

        // Get audio download using the video URL and title
        const audio = await getAudioDownload(video.url, video.title);
        const downloadUrl = audio.download;
        const songTitle = audio.title || video.title;

        // Send info message
        await sock.sendMessage(chatId, { 
            text: `🎵 *Found:* ${songTitle}\n⏱️ *Duration:* ${video.timestamp || 'N/A'}\n📥 *Downloading...*` 
        }, { quoted });

        const timestamp = Date.now();
        const fileName = `audio_${timestamp}.mp3`;
        const filePath = path.join(tempDir, fileName);

        // Download the audio
        const audioStream = await axios({
            method: "get",
            url: downloadUrl,
            responseType: "stream",
            timeout: 600000
        });

        const writer = fs.createWriteStream(filePath);
        audioStream.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
        });

        if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
            throw new Error("Download failed or empty file!");
        }

        // Send the audio file
        await sock.sendMessage(
            chatId,
            {
                document: fs.readFileSync(filePath),
                mimetype: "audio/mpeg",
                fileName: `${songTitle.substring(0, 100)}.mp3`,
                caption: `🎵 *${songTitle}*`
            },
            { quoted }
        );

        // Clean up
        fs.unlinkSync(filePath);

    } catch (error) {
        console.error("Play command error:", error);
        
        // Use fkontak or create fake contact for error messages too
        const quoted = fkontak || createFakeContact(message);
        await sock.sendMessage(chatId, { 
            text: `🚫 Error: ${error.message}` 
        }, { quoted });
    }
}

module.exports = playCommand;
