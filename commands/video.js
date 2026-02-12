const axios = require('axios');
const yts = require('yt-search');
const fs = require('fs');
const path = require('path');

async function videoCommand(sock, chatId, message) {
    try {
        await sock.sendMessage(chatId, {
            react: { text: '🎬', key: message.key }
        });

        const tempDir = path.join(__dirname, "temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        const text = message.message?.conversation 
            || message.message?.extendedTextMessage?.text 
            || message.message?.imageMessage?.caption 
            || "";
        const parts = text.split(' ');
        const query = parts.slice(1).join(' ').trim();

        if (!query) {
            await sock.sendMessage(chatId, {
                react: { text: '❓', key: message.key }
            });
            return sock.sendMessage(chatId, {
                text: '🎬 Provide a YouTube link or Name\nExample:\n\nvideo Not Like Us Music Video\nvideo Espresso '
            }, { quoted: message });
        }

        if (query.length > 100) {
            await sock.sendMessage(chatId, {
                react: { text: '📝', key: message.key }
            });
            return sock.sendMessage(chatId, {
                text: `📝 Video name too long! Max 100 chars.`
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, {
            react: { text: '🔎', key: message.key }
        });

        const searchResult = (await yts(query)).videos[0];
        if (!searchResult) {
            await sock.sendMessage(chatId, {
                react: { text: '🚫', key: message.key }
            });
            return sock.sendMessage(chatId, {
                text: " 🚫 Couldn't find that video. Try another one!"
            }, { quoted: message });
        }

        const video = searchResult;
        
        // Multiple API fallbacks for large videos
        let downloadUrl;
        let videoTitle = video.title;
        
        const apis = [
            `https://apiskeith.top/download/video?url=${encodeURIComponent(video.url)}`,
            `https://api.ryzendesu.vip/api/downloader/ytmp4?url=${encodeURIComponent(video.url)}`,
            `https://api.giftedtech.co.ke/api/download/ytv?apikey=gifted&url=${encodeURIComponent(video.url)}`
        ];
        
        for (const api of apis) {
            try {
                const response = await axios.get(api, { timeout: 30000 });
                
                if (api.includes('apiskeith')) {
                    if (response.data?.result) {
                        downloadUrl = response.data.result;
                        videoTitle = response.data.title || video.title;
                        break;
                    }
                } else if (api.includes('ryzendesu')) {
                    if (response.data?.status && response.data?.url) {
                        downloadUrl = response.data.url;
                        videoTitle = response.data.title || video.title;
                        break;
                    }
                } else if (api.includes('gifted')) {
                    if (response.data?.status && response.data?.result?.sownload_url) {
                        downloadUrl = response.data.result.download_url;
                        videoTitle = response.data.result.title || video.title;
                        break;
                    }
                }
            } catch (e) {
                continue;
            }
        }
        
        if (!downloadUrl) throw new Error("API failed to fetch video!");

        await sock.sendMessage(chatId, {
            react: { text: '⬇️', key: message.key }
        });

        const timestamp = Date.now();
        const fileName = `video_${timestamp}.mp4`;
        const filePath = path.join(tempDir, fileName);

        // Download video with support for files over 100MB
        const videoResponse = await axios({
            method: "get",
            url: downloadUrl,
            responseType: "stream",
            timeout: 900000, // 15 minutes for large files
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const writer = fs.createWriteStream(filePath);
        videoResponse.data.pipe(writer);
        
        await new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
        });

        if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
            throw new Error("Download failed or empty file!");
        }

        const fileSize = fs.statSync(filePath).size;
        const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);

        const caption = `*Title:* ${videoTitle}\n*Duration:* ${video.timestamp}\n*Size:* ${fileSizeMB} MB`;

        // Send as normal video
        await sock.sendMessage(chatId, {
            video: { url: filePath },
            caption,
            mimetype: "video/mp4"
        }, { quoted: message });

        // Send as document
        await sock.sendMessage(chatId, {
            document: { url: filePath },
            mimetype: "video/mp4",
            fileName: `${videoTitle.substring(0, 100)}.mp4`
        }, { quoted: message });

        await sock.sendMessage(chatId, {
            react: { text: '✅', key: message.key }
        });

        // Cleanup
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    } catch (error) {
        console.error("video command error:", error);

        let errorMessage = `🚫 Error: ${error.message}`;
        if (error.message.includes("timeout")) {
            errorMessage = "⏱️ Download timeout! Video might be too large.";
        } else if (error.message.includes("API failed")) {
            errorMessage = "🔧 API error! Try again in a few moments.";
        }

        await sock.sendMessage(chatId, {
            react: { text: '⚠️', key: message.key }
        });

        return sock.sendMessage(chatId, { text: errorMessage }, { quoted: message });
    }
}

module.exports = videoCommand;
