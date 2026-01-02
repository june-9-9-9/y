const fs = require("fs");
const axios = require('axios');
const yts = require('yt-search');
const path = require('path');

async function ytdocvideoCommand(sock, chatId, message) {
    try {
        await sock.sendMessage(chatId, {
            react: { text: '🎬', key: message.key }
        });

        const tempDir = path.join(__dirname, "temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const parts = text.split(' ');
        const query = parts.slice(1).join(' ').trim();

        if (!query) return await sock.sendMessage(chatId, {
            text: '🎬 Provide a YouTube video name or link!\nExample: .ytdocvideo Not Like Us Music Video\nExample: .ytdocvideo https://youtu.be/example'
        }, { quoted: message });

        if (query.length > 500) return await sock.sendMessage(chatId, {
            text: `📝 Input too long! Max 500 chars.`
        }, { quoted: message });

        let videoUrl;
        let videoInfo;

        // Check if input is a YouTube URL
        if (isValidYouTubeUrl(query)) {
            // Direct YouTube URL provided
            videoUrl = normalizeYouTubeUrl(query);
            
            // Validate URL format
            if (!videoUrl) {
                return await sock.sendMessage(chatId, {
                    text: "🔗 Invalid YouTube URL format!\nSupported formats:\n• https://youtu.be/VIDEO_ID\n• https://www.youtube.com/watch?v=VIDEO_ID\n• https://youtube.com/shorts/VIDEO_ID\n• https://m.youtube.com/watch?v=VIDEO_ID"
                }, { quoted: message });
            }

            // Get video info using yts
            try {
                const search = await yts({ videoId: extractVideoId(videoUrl) });
                if (!search || !search.title) {
                    throw new Error("Video not found or private");
                }
                videoInfo = {
                    title: search.title,
                    url: videoUrl,
                    timestamp: search.timestamp || "Unknown",
                    author: { name: search.author?.name || "Unknown" }
                };
            } catch (error) {
                return await sock.sendMessage(chatId, {
                    text: "🚫 Could not fetch video information. The video might be private, deleted, or unavailable."
                }, { quoted: message });
            }
        } else {
            // Search for video by query
            try {
                const searchResult = await (await yts(`${query}`)).videos[0];
                if (!searchResult) return sock.sendMessage(chatId, {
                    text: "🚫 Couldn't find that video. Try another one!"
                }, { quoted: message });

                videoInfo = {
                    title: searchResult.title,
                    url: searchResult.url,
                    timestamp: searchResult.timestamp,
                    author: { name: searchResult.author?.name || "Unknown" }
                };
                videoUrl = searchResult.url;
            } catch (error) {
                return await sock.sendMessage(chatId, {
                    text: "🔍 Search failed! Please try a different search term."
                }, { quoted: message });
            }
        }

        // Validate video duration (optional: limit to 1 hour)
        if (videoInfo.timestamp !== "Unknown") {
            const durationInSeconds = parseDurationToSeconds(videoInfo.timestamp);
            if (durationInSeconds > 3600) { // 1 hour limit
                return await sock.sendMessage(chatId, {
                    text: "⏰ Video is too long! Maximum allowed duration is 1 hour."
                }, { quoted: message });
            }
        }

        const apiUrl = `https://veron-apis.zone.id/downloader/youtube1?url=${encodeURIComponent(videoUrl)}`;
        
        // Validate API response
        let response;
        try {
            response = await axios.get(apiUrl, { timeout: 10000 });
        } catch (apiError) {
            return await sock.sendMessage(chatId, {
                text: "🌐 API server error! Please try again later."
            }, { quoted: message });
        }

        const apiData = response.data;

        if (!apiData || !apiData.success || !apiData.result || !apiData.result.downloadUrl) {
            throw new Error("API failed to fetch video!");
        }

        // Validate download URL
        if (!isValidUrl(apiData.result.downloadUrl)) {
            throw new Error("Invalid download URL received from API");
        }

        const timestamp = Date.now();
        const fileName = `video_${timestamp}.mp4`;
        const filePath = path.join(tempDir, fileName);

        // Send processing message
        await sock.sendMessage(chatId, {
            text: `📥 *Downloading Video...*\n_Title: ${videoInfo.title}_\n_Duration: ${videoInfo.timestamp}_\n_Channel: ${videoInfo.author.name}_`
        }, { quoted: message });

        // Download MP4 video
        const videoResponse = await axios({
            method: "get",
            url: apiData.result.downloadUrl,
            responseType: "stream",
            timeout: 300000 // 5 minutes timeout
        });

        const writer = fs.createWriteStream(filePath);
        videoResponse.data.pipe(writer);
        
        await new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
        });

        if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
            throw new Error("Video download failed or empty file!");
        }

        // Get file size and validate
        const fileSize = fs.statSync(filePath).size;
        const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);
        
        // Check file size limit (100MB)
        if (fileSize > 100 * 1024 * 1024) {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            return await sock.sendMessage(chatId, {
                text: "📁 File too large! Maximum size is 100MB."
            }, { quoted: message });
        }

        // Send as document (video)
        await sock.sendMessage(chatId, {
            document: { url: filePath },
            mimetype: "video/mp4",
            fileName: `${videoInfo.title.substring(0, 100).replace(/[^\w\s]/gi, '')}.mp4`,
            caption: `🎬 *YouTube Video Downloaded*\n\n📌 *Title:* ${videoInfo.title}\n⏱️ *Duration:* ${videoInfo.timestamp}\n👤 *Channel:* ${videoInfo.author.name}\n📊 *Size:* ${fileSizeMB} MB`
        }, { quoted: message });

        // Cleanup
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    } catch (error) {
        console.error("ytdocvideo command error:", error);
        
        // Provide specific error messages
        let errorMessage = `🚫 Error: ${error.message}`;
        
        if (error.message.includes("timeout")) {
            errorMessage = "⏱️ Download timeout! Video might be too large.";
        } else if (error.message.includes("API failed")) {
            errorMessage = "🔧 API error! Try again in a few moments.";
        } else if (error.message.includes("empty file")) {
            errorMessage = "📭 Download failed! Video might not be available.";
        } else if (error.message.includes("network") || error.message.includes("ECONNREFUSED")) {
            errorMessage = "🌐 Network error! Check your connection.";
        } else if (error.message.includes("Invalid download URL")) {
            errorMessage = "🔗 Invalid video link! The video might be restricted.";
        }
        
        return await sock.sendMessage(chatId, {
            text: errorMessage
        }, { quoted: message });
    }
}

// Helper functions for YouTube validation
function isValidYouTubeUrl(url) {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|m\.youtube\.com)\/(watch\?v=|shorts\/|embed\/|v\/)?([a-zA-Z0-9_-]{11})/;
    return youtubeRegex.test(url);
}

function extractVideoId(url) {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

function normalizeYouTubeUrl(url) {
    const videoId = extractVideoId(url);
    return videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;
}

function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

function parseDurationToSeconds(duration) {
    // Converts "HH:MM:SS" or "MM:SS" to seconds
    const parts = duration.split(':').map(Number);
    if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    }
    return 0;
}

module.exports = ytdocvideoCommand;
