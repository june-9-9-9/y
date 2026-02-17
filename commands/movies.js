
const fs = require("fs");
const axios = require("axios");
const path = require("path");
const fetch = require("node-fetch"); // Ensure node-fetch is installed

async function moviesCommand(sock, chatId, message) {
    try {
        await sock.sendMessage(chatId, {
            react: { text: "🎬", key: message.key }
        });

        const tempDir = path.join(__dirname, "temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        let text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        let query = null;

        if (text) {
            const parts = text.split(" ");
            query = parts.slice(1).join(" ").trim();
        }

        const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!query && quoted) {
            if (quoted.conversation) {
                query = quoted.conversation.trim();
            } else if (quoted.extendedTextMessage?.text) {
                query = quoted.extendedTextMessage.text.trim();
            }
        }

        if (!query) {
            return await sock.sendMessage(chatId, {
                text: "🎬 Provide a movie name to search\nExample: .movies Avatar"
            }, { quoted: message });
        }

        if (query.length > 100) {
            return await sock.sendMessage(chatId, {
                text: "📝 Movie name too long! Max 100 chars."
            }, { quoted: message });
        }

        // Browser-like headers
        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
                          "AppleWebKit/537.36 (KHTML, like Gecko) " +
                          "Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json",
            "Referer": "https://movieapi.xcasper.space/"
        };

        // Search
        const searchResponse = await fetch(
            `https://movieapi.xcasper.space/api/showbox/search?keyword=${encodeURIComponent(query)}&type=movie`,
            { headers }
        );
        const searchResult = await searchResponse.json();

        if (!searchResult.data || searchResult.data.length === 0) {
            return sock.sendMessage(chatId, {
                text: "😕 Couldn't find that movie. Try another one!"
            }, { quoted: message });
        }

        const movie = searchResult.data[0];

        // Stream links
        const streamResponse = await fetch(
            `https://movieapi.xcasper.space/api/stream?id=${movie.id}&type=movie`,
            { headers }
        );
        const streamResult = await streamResponse.json();

        if (!streamResult.data || !streamResult.data.links || streamResult.data.links.length === 0) {
            return sock.sendMessage(chatId, {
                text: "🚫 No streaming links available for this movie!"
            }, { quoted: message });
        }

        let resultText = `🎬 *${movie.title}* ${movie.releaseDate ? `(${movie.releaseDate})` : ''}\n\n` +
                         `⭐ *Rating:* ${movie.rating || 'N/A'}\n` +
                         `🎭 *Genres:* ${movie.genres ? movie.genres.join(', ') : 'N/A'}\n` +
                         `⏱️ *Duration:* ${movie.duration || 'N/A'}\n` +
                         `📝 *Description:* ${movie.description || 'No description available'}\n\n` +
                         `🔗 *Streaming Links:*\n`;

        for (const link of streamResult.data.links) {
            resultText += `\n🎥 *${link.provider}*\n📺 ${link.quality || 'Auto'}\n🔗 ${link.url}\n`;
        }

        // Poster with axios + headers
        if (movie.poster) {
            try {
                const posterResponse = await axios({
                    method: "get",
                    url: movie.poster,
                    responseType: "stream",
                    timeout: 30000,
                    headers
                });

                const posterPath = path.join(tempDir, `poster_${Date.now()}.jpg`);
                const posterWriter = fs.createWriteStream(posterPath);
                posterResponse.data.pipe(posterWriter);

                await new Promise((resolve, reject) => {
                    posterWriter.on("finish", resolve);
                    posterWriter.on("error", reject);
                });

                await sock.sendMessage(chatId, {
                    image: { url: posterPath },
                    caption: resultText
                }, { quoted: message });

                if (fs.existsSync(posterPath)) fs.unlinkSync(posterPath);
            } catch (posterError) {
                console.error("Poster download error:", posterError);
                await sock.sendMessage(chatId, { text: resultText }, { quoted: message });
            }
        } else {
            await sock.sendMessage(chatId, { text: resultText }, { quoted: message });
        }

        await sock.sendMessage(chatId, {
            react: { text: "✅", key: message.key }
        });

    } catch (error) {
        console.error("Movies command error:", error);
        return await sock.sendMessage(chatId, {
            text: `🚫 Error: ${error.message}`
        }, { quoted: message });
    }
}

module.exports = moviesCommand;
