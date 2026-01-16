const axios = require('axios');
const yts = require('yt-search');

async function videoCommand(sock, chatId, message) {
    try {
        // Initial reaction
        await sock.sendMessage(chatId, {
            react: { text: '🎬', key: message.key }
        });

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

        // Searching reaction
        await sock.sendMessage(chatId, {
            react: { text: '🔎', key: message.key }
        });

        // Search for video
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
        const apiUrl = `https://apiskeith.vercel.app/download/video?url=${encodeURIComponent(video.url)}`;

        let response;
        try {
            response = await axios.get(apiUrl, { timeout: 70000 }); // 60s timeout
        } catch (err) {
            if (err.message.includes("socket hang up")) {
                console.warn("Retrying after socket hang up...");
                response = await axios.get(apiUrl, { timeout: 70000 });
            } else {
                throw err;
            }
        }

        const apiData = response.data;
        if (!apiData || !apiData.result) {
            throw new Error("API failed to fetch video!");
        }

        // Download reaction
        await sock.sendMessage(chatId, {
            react: { text: '⬇️', key: message.key }
        });

        const caption = `*Title:* ${video.title}\n*Duration:* ${video.timestamp}`;

        // Send as normal video
        await sock.sendMessage(chatId, {
            video: { url: apiData.result },
            caption,
            mimetype: "video/mp4"
        }, { quoted: message });

        // Send as document
        await sock.sendMessage(chatId, {
            document: { url: apiData.result },
            mimetype: "video/mp4",
            fileName: `${video.title.substring(0, 100)}.mp4`,
            caption
        }, { quoted: message });

        // Success reaction
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
        } else if (error.message.includes("socket hang up")) {
            errorMessage = "📡 Connection lost! Please retry.";
        }

        await sock.sendMessage(chatId, {
            react: { text: '⚠️', key: message.key }
        });

        return sock.sendMessage(chatId, { text: errorMessage }, { quoted: message });
    }
}

module.exports = videoCommand;
