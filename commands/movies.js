const fs = require("fs");
const axios = require("axios");
const path = require("path");

async function moviesCommand(sock, chatId, message) {
    let tempFiles = [];
    
    try {
        await sock.sendMessage(chatId, {
            react: { text: "🔍", key: message.key }
        });

        const tempDir = path.join(__dirname, "temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        // Extract query from message
        let text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        let query = null;
        let command = text?.split(" ")[0]?.toLowerCase() || ".movies";

        if (text) {
            const parts = text.split(" ");
            // Check if it's a special command
            if (parts[0].toLowerCase() === ".trending") {
                return await handleTrending(sock, chatId, message, tempDir, tempFiles);
            } else if (parts[0].toLowerCase() === ".hot") {
                return await handleHot(sock, chatId, message, tempDir, tempFiles);
            } else {
                query = parts.slice(1).join(" ").trim();
            }
        }

        // Check quoted message
        const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!query && quoted) {
            if (quoted.conversation) {
                query = quoted.conversation.trim();
            } else if (quoted.extendedTextMessage?.text) {
                query = quoted.extendedTextMessage.text.trim();
            }
        }

        // Show help if no query
        if (!query) {
            return await sock.sendMessage(chatId, {
                text: "🎬 *Movie Commands*\n\n" +
                      "🔍 *.movies [name]* - Search for movies\n" +
                      "📈 *.trending* - Get trending movies/series\n" +
                      "🔥 *.hot* - Get hot movies & TV shows\n" +
                      "ℹ️ *.movie [subjectId]* - Get detailed info\n\n" +
                      "Example: *.movies Avatar*"
            }, { quoted: message });
        }

        if (query.length > 100) {
            return await sock.sendMessage(chatId, {
                text: "📝 Movie name too long! Max 100 chars."
            }, { quoted: message });
        }

        // Base headers
        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json",
            "Referer": "https://movieapi.xcasper.space/"
        };

        // Search for movies
        const searchResponse = await axios.get(
            `https://movieapi.xcasper.space/api/search?keyword=${encodeURIComponent(query)}&page=1&perPage=5&subjectType=1`,
            { headers, timeout: 15000 }
        );

        if (!searchResponse.data.success || !searchResponse.data.data?.items?.length) {
            return sock.sendMessage(chatId, {
                text: "😕 Couldn't find that movie. Try another one!"
            }, { quoted: message });
        }

        const items = searchResponse.data.data.items;

        // If multiple results, show selection menu
        if (items.length > 1) {
            let menuText = `🎬 *Multiple movies found:*\n\n`;
            items.forEach((item, index) => {
                const year = item.releaseDate ? `(${item.releaseDate.split('-')[0]})` : '';
                menuText += `${index + 1}. *${item.title}* ${year}\n`;
                menuText += `   ⭐ ${item.imdbRatingValue || 'N/A'} | ${item.genre?.split(',')[0] || 'N/A'}\n`;
                menuText += `   📌 ID: \`${item.subjectId}\`\n\n`;
            });
            menuText += `Reply with *.movie [subjectId]* for details`;
            
            return await sock.sendMessage(chatId, { text: menuText }, { quoted: message });
        }

        // Single result - get details
        const movie = items[0];
        return await getMovieDetails(sock, chatId, message, movie.subjectId, tempDir, tempFiles);

    } catch (error) {
        console.error("Movies command error:", error);
        return await sock.sendMessage(chatId, {
            text: `🚫 Error: ${error.message}`
        }, { quoted: message });
    } finally {
        // Cleanup temp files
        for (const file of tempFiles) {
            try {
                if (fs.existsSync(file)) fs.unlinkSync(file);
            } catch (e) {
                console.error("Cleanup error:", e);
            }
        }
    }
}

// Handle trending command
async function handleTrending(sock, chatId, message, tempDir, tempFiles) {
    try {
        await sock.sendMessage(chatId, {
            react: { text: "📈", key: message.key }
        });

        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json"
        };

        const response = await axios.get(
            "https://movieapi.xcasper.space/api/trending?page=0&perPage=10",
            { headers, timeout: 15000 }
        );

        if (!response.data.success || !response.data.data?.subjectList?.length) {
            return sock.sendMessage(chatId, { text: "📉 No trending items found" }, { quoted: message });
        }

        const items = response.data.data.subjectList;
        let text = "📈 *TRENDING NOW*\n\n";

        items.slice(0, 10).forEach((item, index) => {
            const type = item.subjectType === 1 ? "🎬 Movie" : "📺 Series";
            const year = item.releaseDate ? `(${item.releaseDate.split('-')[0]})` : '';
            text += `${index + 1}. *${item.title}* ${year}\n`;
            text += `   ${type} | ⭐ ${item.imdbRatingValue || 'N/A'}\n`;
            text += `   📌 ID: \`${item.subjectId}\`\n\n`;
        });

        text += `Use *.movie [subjectId]* for details`;

        await sock.sendMessage(chatId, { text }, { quoted: message });
        await sock.sendMessage(chatId, { react: { text: "✅", key: message.key } });

    } catch (error) {
        console.error("Trending error:", error);
        await sock.sendMessage(chatId, { text: "🚫 Failed to get trending" }, { quoted: message });
    }
}

// Handle hot command
async function handleHot(sock, chatId, message, tempDir, tempFiles) {
    try {
        await sock.sendMessage(chatId, {
            react: { text: "🔥", key: message.key }
        });

        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json"
        };

        const response = await axios.get(
            "https://movieapi.xcasper.space/api/hot",
            { headers, timeout: 15000 }
        );

        if (!response.data.success) {
            return sock.sendMessage(chatId, { text: "🔥 No hot items found" }, { quoted: message });
        }

        const movies = response.data.data.movie || [];
        const tv = response.data.data.tv || [];

        let text = "🔥 *HOT CONTENT*\n\n";

        if (movies.length > 0) {
            text += "🎬 *HOT MOVIES*\n";
            movies.slice(0, 5).forEach((movie, index) => {
                const year = movie.releaseDate ? `(${movie.releaseDate.split('-')[0]})` : '';
                text += `${index + 1}. *${movie.title}* ${year}\n`;
                text += `   ⭐ ${movie.imdbRatingValue || 'N/A'} | ${movie.genre?.split(',')[0] || 'N/A'}\n`;
                text += `   📌 ID: \`${movie.subjectId}\`\n\n`;
            });
        }

        if (tv.length > 0) {
            text += "📺 *HOT TV SHOWS*\n";
            tv.slice(0, 5).forEach((show, index) => {
                const year = show.releaseDate ? `(${show.releaseDate.split('-')[0]})` : '';
                text += `${index + 1}. *${show.title}* ${year}\n`;
                text += `   ⭐ ${show.imdbRatingValue || 'N/A'} | ${show.genre?.split(',')[0] || 'N/A'}\n`;
                text += `   📌 ID: \`${show.subjectId}\`\n\n`;
            });
        }

        text += `Use *.movie [subjectId]* for details`;

        await sock.sendMessage(chatId, { text }, { quoted: message });
        await sock.sendMessage(chatId, { react: { text: "✅", key: message.key } });

    } catch (error) {
        console.error("Hot error:", error);
        await sock.sendMessage(chatId, { text: "🚫 Failed to get hot content" }, { quoted: message });
    }
}

// Get movie details by subjectId
async function getMovieDetails(sock, chatId, message, subjectId, tempDir, tempFiles) {
    try {
        await sock.sendMessage(chatId, {
            react: { text: "📋", key: message.key }
        });

        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json"
        };

        const response = await axios.get(
            `https://movieapi.xcasper.space/api/detail?subjectId=${subjectId}`,
            { headers, timeout: 15000 }
        );

        if (!response.data.success || !response.data.data?.subject) {
            return sock.sendMessage(chatId, { text: "🚫 Movie details not found" }, { quoted: message });
        }

        const movie = response.data.data.subject;
        const stars = response.data.data.stars || [];

        // Format duration
        const duration = movie.duration ? `${Math.floor(movie.duration / 60)}min` : 'N/A';
        
        // Format description
        const description = movie.description || 'No description available';
        const shortDesc = description.length > 200 ? description.substring(0, 200) + '...' : description;

        // Build movie info
        let resultText = `🎬 *${movie.title}*\n`;
        resultText += `📅 *Release:* ${movie.releaseDate || 'N/A'}\n`;
        resultText += `⭐ *IMDb:* ${movie.imdbRatingValue || 'N/A'} (${movie.imdbRatingCount?.toLocaleString() || '0'} votes)\n`;
        resultText += `🎭 *Genre:* ${movie.genre?.replace(/,/g, ', ') || 'N/A'}\n`;
        resultText += `⏱️ *Duration:* ${duration}\n`;
        resultText += `🌍 *Country:* ${movie.countryName || 'N/A'}\n\n`;
        resultText += `📝 *Description:*\n${shortDesc}\n`;

        // Add cast if available
        if (stars.length > 0) {
            resultText += `\n👥 *Cast:*\n`;
            stars.slice(0, 5).forEach(star => {
                resultText += `• ${star.name} as "${star.character || '?'}"\n`;
            });
        }

        // Add subtitles if available
        if (movie.subtitles) {
            const subs = movie.subtitles.split(',').slice(0, 5).join(', ');
            resultText += `\n🔤 *Subtitles:* ${subs}${movie.subtitles.split(',').length > 5 ? '...' : ''}\n`;
        }

        // Add trailer info if available
        if (movie.trailer?.videoAddress?.url) {
            resultText += `\n🎥 *Trailer available*\n`;
        }

        // Add resource info
        if (movie.hasResource) {
            resultText += `\n✅ *Available for streaming*\n`;
        }

        // Add link to view in browser
        if (movie.detailPath) {
            resultText += `\n🔗 *Link:* https://h5.aoneroom.com/wefeed-h5-bff/web/subject/detail?subjectId=${subjectId}\n`;
        }

        // Send poster if available
        if (movie.cover?.url) {
            try {
                const posterResponse = await axios({
                    method: "get",
                    url: movie.cover.url,
                    responseType: "stream",
                    timeout: 15000,
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                        "Referer": "https://h5.aoneroom.com/"
                    }
                });

                const posterPath = path.join(tempDir, `poster_${Date.now()}.jpg`);
                tempFiles.push(posterPath);
                
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
        console.error("Movie details error:", error);
        await sock.sendMessage(chatId, {
            text: `🚫 Error getting details: ${error.message}`
        }, { quoted: message });
    }
}

module.exports = moviesCommand;
