const yts = require('yt-search');
const axios = require('axios');
const fetch = require('node-fetch');

async function ytplayCommand(sock, chatId, message) {
    try {
        // Initial reaction 📺
        await sock.sendMessage(chatId, {
            react: { text: "📺", key: message.key }
        });

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const input = text.split(' ').slice(1).join(' ').trim();

        if (!input) {
            return await sock.sendMessage(chatId, { 
                text: "Please provide a YouTube link or video title!" 
            }, { quoted: message });
        }

        let videoUrl;
        let videoInfo;
        
        // Check if input is a YouTube URL
        const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/;
        if (youtubeRegex.test(input)) {
            videoUrl = input;
            
            // Extract video ID from different YouTube URL formats
            let videoId;
            if (input.includes('youtu.be/')) {
                videoId = input.split('youtu.be/')[1]?.split('?')[0];
            } else if (input.includes('youtube.com/watch?v=')) {
                videoId = input.split('v=')[1]?.split('&')[0];
            } else if (input.includes('youtube.com/embed/')) {
                videoId = input.split('embed/')[1]?.split('?')[0];
            }
            
            if (!videoId) {
                return await sock.sendMessage(chatId, { 
                    text: "Invalid YouTube URL format!" 
                }, { quoted: message });
            }
            
            // Get video info by ID
            const searchResult = await yts({ videoId });
            if (!searchResult || !searchResult.title) {
                return await sock.sendMessage(chatId, { 
                    text: "Failed to fetch video information. Please check the URL." 
                });
            }
            
            videoInfo = searchResult;
        } else {
            // Search by query if not a URL
            const { videos } = await yts(input);
            if (!videos || videos.length === 0) {
                return await sock.sendMessage(chatId, { 
                    text: "No videos found!" 
                });
            }
            
            // Get the first video result
            const video = videos[0];
            videoUrl = video.url;
            videoInfo = video;
        }

        // Fetch video data from API
        const response = await axios.get(`https://api.privatezia.biz.id/api/downloader/youtube?url=${videoUrl}`);
        const ApiData = response.data;

        if (!ApiData || !ApiData.status || !ApiData.result || !ApiData.result.downloadUrl) {
            return await sock.sendMessage(chatId, { 
                text: "Failed to fetch video from the API. Please try again later." 
            }, { quoted: message });
        }

        const downloadUrl = ApiData.result.downloadUrl;
        const title = videoInfo.title;
        const thumbnail = videoInfo.thumbnail;
        const duration = videoInfo.timestamp || "Unknown";
        const views = videoInfo.views || "Unknown";
        const uploadDate = videoInfo.ago || "Unknown";

        // Fetch thumbnail image
        let thumbBuffer = null;
        try {
            const thumbResponse = await fetch(thumbnail);
            thumbBuffer = Buffer.from(await thumbResponse.arrayBuffer());
        } catch (err) {
            console.error("Thumbnail fetch failed:", err);
        }

        // Create video info text as caption
        const infoText = `*📹 YouTube Video*\n\n` +
                        `*Title:* ${title}\n` +
                        `*Duration:* ${duration}\n` +
                        `*Views:* ${views}\n` +
                        `*Uploaded:* ${uploadDate}`;

        // Send the video with info as caption
        await sock.sendMessage(chatId, {
            video: { url: downloadUrl },
            mimetype: "video/mp4",
            caption: infoText,
            thumbnail: thumbBuffer
        }, { quoted: message });

        // Success reaction
        await sock.sendMessage(chatId, { 
            react: { text: '✅', key: message.key } 
        });

    } catch (error) {
        console.error('Error in ytplayCommand:', error);
        
        // Provide specific error messages based on error type
        let errorMessage = "Download failed. Please try again later.";
        
        if (error.message.includes('timeout')) {
            errorMessage = "Request timeout. The video might be too long or the server is busy.";
        } else if (error.message.includes('Network Error')) {
            errorMessage = "Network error. Please check your connection.";
        } else if (error.response?.status === 404) {
            errorMessage = "Video not found or removed.";
        } else if (error.response?.status === 403) {
            errorMessage = "Access forbidden. The video might be age-restricted or private.";
        }
        
        await sock.sendMessage(chatId, { 
            text: errorMessage 
        }, { quoted: message });
        
        await sock.sendMessage(chatId, { 
            react: { text: '❌', key: message.key } 
        });
    }
}

async function ytsongCommand(sock, chatId, message) {
    try {
        // Initial reaction 🎵
        await sock.sendMessage(chatId, {
            react: { text: "🎵", key: message.key }
        });

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const input = text.split(' ').slice(1).join(' ').trim();

        if (!input) {
            return await sock.sendMessage(chatId, { 
                text: "Please provide a YouTube link or song name!" 
            }, { quoted: message });
        }

        let videoUrl;
        let videoInfo;
        
        // Check if input is a YouTube URL
        const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/;
        if (youtubeRegex.test(input)) {
            videoUrl = input;
            
            // Extract video ID from different YouTube URL formats
            let videoId;
            if (input.includes('youtu.be/')) {
                videoId = input.split('youtu.be/')[1]?.split('?')[0];
            } else if (input.includes('youtube.com/watch?v=')) {
                videoId = input.split('v=')[1]?.split('&')[0];
            } else if (input.includes('youtube.com/embed/')) {
                videoId = input.split('embed/')[1]?.split('?')[0];
            }
            
            if (!videoId) {
                return await sock.sendMessage(chatId, { 
                    text: "Invalid YouTube URL format!" 
                }, { quoted: message });
            }
            
            // Get video info by ID
            const searchResult = await yts({ videoId });
            if (!searchResult || !searchResult.title) {
                return await sock.sendMessage(chatId, { 
                    text: "Failed to fetch song information. Please check the URL." 
                });
            }
            
            videoInfo = searchResult;
        } else {
            // Search by query if not a URL
            const { videos } = await yts(input);
            if (!videos || videos.length === 0) {
                return await sock.sendMessage(chatId, { 
                    text: "No songs found!" 
                });
            }
            
            // Get the first video result
            const video = videos[0];
            videoUrl = video.url;
            videoInfo = video;
        }

        // Fetch audio data from API
        const response = await axios.get(`https://api.privatezia.biz.id/api/downloader/ytmp3?url=${videoUrl}`);
        const apiData = response.data;

        if (!apiData || !apiData.status || !apiData.result || !apiData.result.downloadUrl) {
            return await sock.sendMessage(chatId, { 
                text: "Failed to fetch audio from the API. Please try again later." 
            }, { quoted: message });
        }

        const audioUrl = apiData.result.downloadUrl;
        const title = apiData.result.title || videoInfo.title;
        const thumbnail = videoInfo.thumbnail;
        const duration = videoInfo.timestamp || "Unknown";
        const views = videoInfo.views || "Unknown";
        const uploadDate = videoInfo.ago || "Unknown";
        const size = apiData.result.size || "Unknown";

        // Fetch thumbnail image
        let thumbBuffer = null;
        try {
            const thumbResponse = await fetch(thumbnail);
            thumbBuffer = Buffer.from(await thumbResponse.arrayBuffer());
        } catch (err) {
            console.error("Thumbnail fetch failed:", err);
        }

        // Create song info text for context
        const infoText = `*🎵 YouTube Song*\n\n` +
                        `*Title:* ${title}\n` +
                        `*Duration:* ${duration}\n` +
                        `*Size:* ${size}\n` +
                        `*Views:* ${views}\n` +
                        `*Uploaded:* ${uploadDate}`;

        // Send the audio with info in contextInfo
        await sock.sendMessage(chatId, {
            audio: { url: audioUrl },
            mimetype: "audio/mpeg",
            fileName: `${title.replace(/[^\w\s]/gi, '')}.mp3`,
            ptt: false,
            waveform: [100, 0, 100, 0, 100, 0, 100], // Fake waveform for visual effect
            caption: infoText, // Send info as caption
            contextInfo: {
                externalAdReply: {
                    title: title,
                    body: `Duration: ${duration} • Views: ${views}`,
                    thumbnail: thumbBuffer,
                    mediaType: 2,
                    mediaUrl: videoUrl,
                    sourceUrl: videoUrl
                }
            }
        }, { quoted: message });

        // Success reaction
        await sock.sendMessage(chatId, { 
            react: { text: '✅', key: message.key } 
        });

    } catch (error) {
        console.error('Error in ytsongCommand:', error);
        
        // Provide specific error messages based on error type
        let errorMessage = "Download failed. Please try again later.";
        
        if (error.message.includes('timeout')) {
            errorMessage = "Request timeout. The song might be too long or the server is busy.";
        } else if (error.message.includes('Network Error')) {
            errorMessage = "Network error. Please check your connection.";
        } else if (error.response?.status === 404) {
            errorMessage = "Song not found or removed.";
        } else if (error.response?.status === 403) {
            errorMessage = "Access forbidden. The song might be age-restricted or private.";
        } else if (error.message.includes('audio only')) {
            errorMessage = "This video is audio-only content. Try with a different video.";
        }
        
        await sock.sendMessage(chatId, { 
            text: errorMessage 
        }, { quoted: message });
        
        await sock.sendMessage(chatId, { 
            react: { text: '❌', key: message.key } 
        });
    }
}

// Export both functions
module.exports = {
    ytplayCommand,
    ytsongCommand
};
