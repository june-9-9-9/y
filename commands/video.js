const axios = require('axios');
const yts = require('yt-search');
const fs = require('fs');
const path = require('path');

async function videoCommand(sock, chatId, message) {
    let filePath = null;
    let writer = null;
    
    try {
        await sock.sendMessage(chatId, {
            react: { text: '🎬', key: message.key }
        });

        const tempDir = path.join(__dirname, "temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        // Clean old files before downloading new one
        const cleanupOldFiles = () => {
            const files = fs.readdirSync(tempDir);
            const now = Date.now();
            files.forEach(file => {
                const filePath = path.join(tempDir, file);
                try {
                    const stats = fs.statSync(filePath);
                    // Remove files older than 30 minutes
                    if (now - stats.mtimeMs > 30 * 60 * 1000) {
                        fs.unlinkSync(filePath);
                    }
                } catch (e) {}
            });
        };
        cleanupOldFiles();

        // Check available space before download
        const checkDiskSpace = () => {
            try {
                const stats = fs.statfsSync(tempDir);
                const freeBytes = stats.bfree * stats.bsize;
                const freeMB = freeBytes / (1024 * 1024);
                if (freeMB < 100) { // Less than 100MB free
                    throw new Error(`Low disk space: ${freeMB.toFixed(2)}MB free`);
                }
                return freeMB;
            } catch (e) {
                if (e.message.includes('Low disk space')) throw e;
                // If statfs fails, assume we have space
                return 1000;
            }
        };
        checkDiskSpace();

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
        
        let downloadUrl;
        let videoTitle = video.title;
        
        const apis = [
            `https://apiskeith.top/download/ytmp4?url=${encodeURIComponent(video.url)}`,
            `https://api.giftedtech.co.ke/api/download/savemp4?apikey=gifted&url=${encodeURIComponent(video.url)}`,
            `https://api.giftedtech.co.ke/api/download/ytv?apikey=gifted&url=${encodeURIComponent(video.url)}`
        ];
        
        for (const api of apis) {
            try {
                const response = await axios.get(api, { timeout: 15000 });
                
                if (api.includes('apiskeith')) {
                    if (response.data?.result) {
                        downloadUrl = response.data.result;
                        videoTitle = response.data.title || video.title;
                        break;
                    }
                } else if (api.includes('gifted')) {
                    if (response.data?.status && response.data?.result?.download_url) {
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

        // Get file size first
        let headResponse;
        try {
            headResponse = await axios({
                method: "head",
                url: downloadUrl,
                timeout: 10000
            });
        } catch (e) {
            // If HEAD fails, continue without size check
        }

        const contentLength = headResponse?.headers['content-length'];
        if (contentLength) {
            const fileSizeMB = parseInt(contentLength) / (1024 * 1024);
            if (fileSizeMB > 400) { // 400MB limit
                throw new Error(`Video too large: ${fileSizeMB.toFixed(2)}MB (Max: 400MB)`);
            }
            
            // Check if we have enough space
            const freeSpace = checkDiskSpace();
            if (freeSpace < fileSizeMB * 1.2) { // Need 20% extra
                throw new Error(`Not enough disk space. Need ${(fileSizeMB * 1.2).toFixed(2)}MB, have ${freeSpace.toFixed(2)}MB`);
            }
        }

        const timestamp = Date.now();
        const fileName = `video_${timestamp}.mp4`;
        filePath = path.join(tempDir, fileName);

        // Download with error handling for ENOSPC
        const videoResponse = await axios({
            method: "get",
            url: downloadUrl,
            responseType: "stream",
            timeout: 900000,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            onDownloadProgress: (progressEvent) => {
                // Optional: Check space during download
                try {
                    checkDiskSpace();
                } catch (spaceError) {
                    videoResponse.data.destroy();
                    throw spaceError;
                }
            }
        });
        
        writer = fs.createWriteStream(filePath);
        videoResponse.data.pipe(writer);
        
        await new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
            
            // Handle ENOSPC specifically
            writer.on("error", (err) => {
                if (err.code === 'ENOSPC') {
                    reject(new Error('⚠️ No space left on device. Try again later or download smaller videos.'));
                } else {
                    reject(err);
                }
            });
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

        // Only send as document if under 2GB and we have space
        if (fileSize < 2 * 1024 * 1024 * 1024) {
            await sock.sendMessage(chatId, {
                document: { url: filePath },
                mimetype: "video/mp4",
                fileName: `${videoTitle.substring(0, 100)}.mp4`
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, {
            react: { text: '✅', key: message.key }
        });

    } catch (error) {
        console.error("video command error:", error);

        let errorMessage = `🚫 Error: ${error.message}`;
        if (error.message.includes("timeout")) {
            errorMessage = "⏱️ Download timeout! Video might be too large.";
        } else if (error.message.includes("API failed")) {
            errorMessage = "🔧 API error! Try again in a few moments.";
        } else if (error.code === 'ENOSPC' || error.message.includes('No space left')) {
            errorMessage = "💾 No space left on device! Old videos cleared, try again now.";
            
            // Aggressive cleanup on ENOSPC
            try {
                const files = fs.readdirSync(tempDir);
                files.forEach(file => {
                    const filePath = path.join(tempDir, file);
                    try {
                        fs.unlinkSync(filePath);
                    } catch (e) {}
                });
                errorMessage += "\n✅ Temp folder cleaned. Try again.";
            } catch (cleanupError) {}
        } else if (error.message.includes('disk space')) {
            errorMessage = `💾 ${error.message}`;
        } else if (error.message.includes('too large')) {
            errorMessage = `📁 ${error.message}`;
        }

        await sock.sendMessage(chatId, {
            react: { text: '⚠️', key: message.key }
        });

        return sock.sendMessage(chatId, { text: errorMessage }, { quoted: message });
    } finally {
        // Cleanup single file
        if (filePath && fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
            } catch (e) {}
        }
        
        // Close writer if open
        if (writer && !writer.closed) {
            try {
                writer.end();
            } catch (e) {}
        }
    }
}

module.exports = videoCommand;
