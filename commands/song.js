const fs = require("fs");
const axios = require("axios");
const yts = require("yt-search");
const path = require("path");
const os = require("os");

// fakeQuoted function
function createFakeContact(message) {
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "status@broadcast",
            fromMe: false,
            id: "JUNE-X"
        },
        message: {
            contactMessage: {
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:JUNE MD\nitem1.TEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

// API fallbacks method
async function fetchAudioFromAPIs(videoUrl, videoTitle) {
    const apis = [
        {
            url: `https://api.giftedtech.co.ke/api/download/ytmp3?apikey=gifted&url=${encodeURIComponent(videoUrl)}`,
            parse: (data) => data?.status ? { url: data.result.download_url, title: data.result.title } : null
        },
        {
            url: `https://apiskeith.top/download/audio?url=${encodeURIComponent(videoUrl)}`,
            parse: (data) => (data?.status && data?.result) ? { url: data.result, title: data.title } : null
        },
        {
            url: `https://api.giftedtech.co.ke/api/download/ytmp3?apikey=gifted&url=${encodeURIComponent(videoUrl)}`,
            parse: (data) => (data?.status && data?.result?.download_url) ? { url: data.result.download_url, title: data.result.title } : null
        }
    ];

    for (const api of apis) {
        try {
            const response = await axios.get(api.url, { timeout: 30000 });
            const result = api.parse(response.data);
            if (result) {
                return {
                    downloadUrl: result.url,
                    videoTitle: result.title || videoTitle
                };
            }
        } catch {
            continue;
        }
    }
    
    return null;
}

// Download file method
async function downloadFile(downloadUrl, filePath) {
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
    
    return true;
}

async function songCommand(sock, chatId, message) {
    try {
        // Create fake quoted contact
        const fake = createFakeContact(message);

        // React to command
        await sock.sendMessage(chatId, { react: { text: "🎶", key: message.key } });

        // Prepare temp directory
        const tempDir = path.join(os.tmpdir(), "june-x-temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        // Extract query
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const query = text?.split(" ").slice(1).join(" ").trim();

        if (!query) {
            return sock.sendMessage(chatId, {
                text: "🎵 Provide a song name!\nExample: .song Not Like Us"
            }, { quoted: fake });
        }

        if (query.length > 100) {
            return sock.sendMessage(chatId, {
                text: "📝 Song name too long! Max 100 chars."
            }, { quoted: fake });
        }

        // Search YouTube
        const searchResult = (await yts(query + " official")).videos[0];
        if (!searchResult) {
            return sock.sendMessage(chatId, {
                text: "😕 Couldn't find that song. Try another one!"
            }, { quoted: fake });
        }

        const video = searchResult;

        // Fetch audio using API fallbacks
        const audioData = await fetchAudioFromAPIs(video.url, video.title);
        if (!audioData) throw new Error("API failed to fetch track!");

        // File setup
        const fileName = `audio_${Date.now()}.mp3`;
        const filePath = path.join(tempDir, fileName);

        // Download MP3
        await downloadFile(audioData.downloadUrl, filePath);

        // Notify user
        const title = (audioData.videoTitle || video.title).substring(0, 100);
        await sock.sendMessage(chatId, { text: `_🎶 Track ready:_\n_${title}_` }, { quoted: fake });

        // Send audio format
        await sock.sendMessage(chatId, {
            audio: { url: filePath },
            mimetype: "audio/mpeg",
            fileName: `${title}.mp3`
        }, { quoted: fake });

        // Send document format
        await sock.sendMessage(chatId, {
            document: { url: filePath },
            mimetype: "audio/mpeg",
            fileName: `${title}.mp3`
        }, { quoted: fake });

        // Cleanup
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    } catch (error) {
        console.error("Song command error:", error);
        return sock.sendMessage(chatId, {
            text: `🚫 Error: ${error.message}`
        }, { quoted: createFakeContact(message) }); // Fallback to function call if fake not in scope
    }
}

module.exports = songCommand;
