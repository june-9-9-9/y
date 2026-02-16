const fs = require("fs");
const axios = require("axios");
const path = require("path");
const { randomBytes } = require("crypto");

async function moviesCommand(sock, chatId, message) {
    let tempFiles = [];
    
    try {
        await sock.sendMessage(chatId, {
            react: { text: "🎬", key: message.key }
        });

        const tempDir = path.join(__dirname, "temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        // Extract query from message
        let text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        let query = null;

        if (text) {
            const parts = text.split(" ");
            query = parts.slice(1).join(" ").trim();
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

        // Generate realistic browser fingerprints
        const browserVersion = Math.floor(Math.random() * 30) + 100; // 100-129
        const chromeVersion = `1${Math.floor(Math.random() * 9)}0.0.0`; // 110-190
        
        // Rotating user agents that look like real browsers
        const userAgents = [
            `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion}.0.${Math.floor(Math.random() * 9999)}.${Math.floor(Math.random() * 999)} Safari/537.36`,
            `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion}.0.${Math.floor(Math.random() * 9999)}.${Math.floor(Math.random() * 999)} Safari/537.36`,
            `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:${Math.floor(Math.random() * 30) + 100}.0) Gecko/20100101 Firefox/${Math.floor(Math.random() * 30) + 100}.0`,
            `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion}.0.${Math.floor(Math.random() * 9999)}.${Math.floor(Math.random() * 999)} Safari/537.36`
        ];
        
        const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];
        
        // Generate realistic browser headers
        const headers = {
            "User-Agent": randomUA,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "Referer": "https://www.google.com/",
            "Sec-Ch-Ua": `"Chromium";v="${browserVersion}", "Not_A Brand";v="24"`,
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": `"${Math.random() > 0.5 ? 'Windows' : 'macOS'}"`,
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "cross-site",
            "Sec-Fetch-User": "?1",
            "Upgrade-Insecure-Requests": "1",
            "Cache-Control": "max-age=0",
            "Connection": "keep-alive",
            "DNT": "1"
        };

        // Add random browser fingerprinting
        const fingerprint = randomBytes(16).toString('hex');
        headers["X-Client-Data"] = fingerprint;

        // Create axios instance with browser-like config
        const axiosInstance = axios.create({
            timeout: 30000,
            headers: headers,
            maxRedirects: 5,
            validateStatus: function (status) {
                return status >= 200 && status < 300; // Default
            },
            decompress: true // Handle gzip/deflate
        });

        // Add cookie jar support
        const cookieJar = {};
        axiosInstance.interceptors.response.use((response) => {
            const setCookie = response.headers['set-cookie'];
            if (setCookie) {
                setCookie.forEach(cookie => {
                    const [name, value] = cookie.split('=');
                    cookieJar[name] = value.split(';')[0];
                });
            }
            return response;
        });

        axiosInstance.interceptors.request.use((config) => {
            if (Object.keys(cookieJar).length > 0) {
                const cookieString = Object.entries(cookieJar)
                    .map(([name, value]) => `${name}=${value}`)
                    .join('; ');
                config.headers.Cookie = cookieString;
            }
            return config;
        });

        // Add random delay before search (2-5 seconds)
        await new Promise(resolve => setTimeout(resolve, Math.random() * 3000 + 2000));

        // Search with retry mechanism
        let searchResult;
        let retries = 3;
        
        while (retries > 0) {
            try {
                const searchResponse = await axiosInstance.get(
                    `https://movieapi.xcasper.space/api/showbox/search?keyword=${encodeURIComponent(query)}&type=movie`
                );
                searchResult = searchResponse.data;
                break;
            } catch (error) {
                retries--;
                if (retries === 0) throw error;
                // Wait before retry (3-6 seconds)
                await new Promise(resolve => setTimeout(resolve, Math.random() * 3000 + 3000));
                // Rotate user agent on retry
                headers["User-Agent"] = userAgents[Math.floor(Math.random() * userAgents.length)];
            }
        }

        if (!searchResult.data || searchResult.data.length === 0) {
            return sock.sendMessage(chatId, {
                text: "😕 Couldn't find that movie. Try another one!"
            }, { quoted: message });
        }

        const movie = searchResult.data[0];

        // Add delay before stream request (1-3 seconds)
        await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));

        // Get stream links with retry
        let streamResult;
        retries = 3;
        
        while (retries > 0) {
            try {
                const streamResponse = await axiosInstance.get(
                    `https://movieapi.xcasper.space/api/stream?id=${movie.id}&type=movie`
                );
                streamResult = streamResponse.data;
                break;
            } catch (error) {
                retries--;
                if (retries === 0) throw error;
                await new Promise(resolve => setTimeout(resolve, Math.random() * 3000 + 2000));
            }
        }

        if (!streamResult.data || !streamResult.data.links || streamResult.data.links.length === 0) {
            return sock.sendMessage(chatId, {
                text: "🚫 No streaming links available for this movie!"
            }, { quoted: message });
        }

        // Format movie info with emojis
        let resultText = `🎬 *${movie.title}* ${movie.releaseDate ? `(${movie.releaseDate})` : ''}\n\n` +
                         `⭐ *Rating:* ${movie.rating || 'N/A'}\n` +
                         `🎭 *Genres:* ${movie.genres ? movie.genres.join(', ') : 'N/A'}\n` +
                         `⏱️ *Duration:* ${movie.duration || 'N/A'}\n` +
                         `📝 *Description:* ${movie.description || 'No description available'}\n\n` +
                         `🔗 *Streaming Links:*\n`;

        // Add links with better formatting
        for (const link of streamResult.data.links) {
            resultText += `\n━━━━━━━━━━━━━━━━━━\n`;
            resultText += `🎥 *${link.provider}*\n`;
            resultText += `📺 *Quality:* ${link.quality || 'Auto'}\n`;
            resultText += `🔗 Link: ${link.url}\n`;
        }

        // Download and send poster with improved headers
        if (movie.poster) {
            try {
                // Add delay before poster download (1-2 seconds)
                await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 1000));
                
                const posterResponse = await axiosInstance({
                    method: "get",
                    url: movie.poster,
                    responseType: "stream"
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
        console.error("Movies command error:", error);
        
        // Check if it's an antibot detection
        if (error.response && error.response.status === 403) {
            return await sock.sendMessage(chatId, {
                text: "🚫 Bot detected! Try again with a more specific movie name."
            }, { quoted: message });
        }
        
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

module.exports = moviesCommand;
