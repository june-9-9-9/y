const fs = require("fs");
const axios = require("axios");
const path = require("path");
const {
  generateWAMessageContent,
  generateWAMessageFromContent,
} = require("@whiskeysockets/baileys");
const { sendButtons } = require("gifted-btns");

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
            // Show help with buttons
            return await sendButtons(sock, chatId, {
                title: "🎬 *Movie Commands*",
                text: "Choose an option below:",
                footer: "Select a command to continue",
                buttons: [
                    {
                        name: "quick_reply",
                        buttonParamsJson: JSON.stringify({
                            display_text: "🔍 Search Movie",
                            id: ".movies [movie name]"
                        })
                    },
                    {
                        name: "quick_reply",
                        buttonParamsJson: JSON.stringify({
                            display_text: "📈 Trending",
                            id: ".trending"
                        })
                    },
                    {
                        name: "quick_reply",
                        buttonParamsJson: JSON.stringify({
                            display_text: "🔥 Hot Content",
                            id: ".hot"
                        })
                    }
                ]
            }, { quoted: message });
        }

        if (query.length > 100) {
            return await sock.sendMessage(chatId, {
                text: "📝 Movie name too long! Max 100 chars."
            }, { quoted: message });
        }

        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json",
            "Referer": "https://movieapi.xcasper.space/"
        };

        // Search for movies
        const searchResponse = await axios.get(
            `https://movieapi.xcasper.space/api/search?keyword=${encodeURIComponent(query)}&page=1&perPage=10&subjectType=1`,
            { headers, timeout: 15000 }
        );

        if (!searchResponse.data.success || !searchResponse.data.data?.items?.length) {
            return sock.sendMessage(chatId, {
                text: "😕 Couldn't find that movie. Try another one!"
            }, { quoted: message });
        }

        const items = searchResponse.data.data.items.slice(0, 5); // Max 5 for carousel

        // Create carousel cards for each movie
        const cards = await Promise.all(
            items.map(async (movie) => {
                // Get additional details for each movie
                let details = {};
                try {
                    const detailResponse = await axios.get(
                        `https://movieapi.xcasper.space/api/detail?subjectId=${movie.subjectId}`,
                        { headers, timeout: 10000 }
                    );
                    if (detailResponse.data?.success) {
                        details = detailResponse.data.data;
                    }
                } catch (e) {
                    console.error("Error fetching details:", e.message);
                }

                const year = movie.releaseDate ? `(${movie.releaseDate.split('-')[0]})` : '';
                const rating = movie.imdbRatingValue || 'N/A';
                const genre = movie.genre?.split(',')[0] || 'N/A';
                const description = details.subject?.description || movie.description || 'No description available';
                const shortDesc = description.length > 100 ? description.substring(0, 100) + '...' : description;
                
                // Get cast names if available
                const cast = details.stars?.slice(0, 3).map(s => s.name).join(', ') || 'N/A';
                
                // Create body text with movie info
                let bodyText = `⭐ *Rating:* ${rating}\n`;
                bodyText += `🎭 *Genre:* ${genre}\n`;
                if (movie.duration) {
                    const duration = `${Math.floor(movie.duration / 60)}min`;
                    bodyText += `⏱️ *Duration:* ${duration}\n`;
                }
                bodyText += `📝 *Desc:* ${shortDesc}\n`;
                if (cast !== 'N/A') bodyText += `👥 *Cast:* ${cast}\n`;
                
                // Get poster URL
                const posterUrl = movie.cover?.url || 
                                 movie.cover || 
                                 "https://files.giftedtech.co.ke/image/ZAwmovie-placeholder.jpg";

                return {
                    header: {
                        title: `🎬 *${movie.title}* ${year}`,
                        hasMediaAttachment: true,
                        imageMessage: (
                            await generateWAMessageContent(
                                { image: { url: posterUrl } },
                                { upload: sock.waUploadToServer }
                            )
                        ).imageMessage,
                    },
                    body: {
                        text: bodyText,
                    },
                    footer: { text: `> *GIFTED-MD*` },
                    nativeFlowMessage: {
                        buttons: [
                            {
                                name: "cta_copy",
                                buttonParamsJson: JSON.stringify({
                                    display_text: "📋 Copy ID",
                                    copy_code: movie.subjectId,
                                }),
                            },
                            {
                                name: "cta_url",
                                buttonParamsJson: JSON.stringify({
                                    display_text: "🔗 View Details",
                                    url: `https://h5.aoneroom.com/wefeed-h5-bff/web/subject/detail?subjectId=${movie.subjectId}`,
                                }),
                            },
                            {
                                name: "quick_reply",
                                buttonParamsJson: JSON.stringify({
                                    display_text: "📌 More Info",
                                    id: `.movieid ${movie.subjectId}`,
                                }),
                            },
                        ],
                    },
                };
            })
        );

        // Create and send the carousel message
        const carouselMessage = generateWAMessageFromContent(
            chatId,
            {
                viewOnceMessage: {
                    message: {
                        messageContextInfo: {
                            deviceListMetadata: {},
                            deviceListMetadataVersion: 2,
                        },
                        interactiveMessage: {
                            body: { text: `🎬 *Movie Results for:* ${query}` },
                            footer: {
                                text: `📂 Found *${items.length}* movies | Select one below`,
                            },
                            carouselMessage: { cards },
                        },
                    },
                },
            },
            { quoted: message }
        );

        await sock.relayMessage(chatId, carouselMessage.message, {
            messageId: carouselMessage.key.id,
        });
        
        await sock.sendMessage(chatId, {
            react: { text: "✅", key: message.key }
        });

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

// Movie details by ID command
async function movieIdCommand(sock, chatId, message, subjectId) {
    let tempFiles = [];
    const tempDir = path.join(__dirname, "temp");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

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

        // Send action buttons
        await sendButtons(sock, chatId, {
            title: "🎬 *Movie Actions*",
            text: `What would you like to do with "${movie.title}"?`,
            footer: "Choose an option",
            buttons: [
                {
                    name: "cta_url",
                    buttonParamsJson: JSON.stringify({
                        display_text: "🎥 Watch Online",
                        url: `https://h5.aoneroom.com/wefeed-h5-bff/web/subject/detail?subjectId=${subjectId}`
                    })
                },
                {
                    name: "cta_copy",
                    buttonParamsJson: JSON.stringify({
                        display_text: "📋 Copy ID",
                        copy_code: subjectId
                    })
                },
                {
                    name: "quick_reply",
                    buttonParamsJson: JSON.stringify({
                        display_text: "🔍 Search Again",
                        id: ".movies"
                    })
                }
            ]
        }, { quoted: message });

        await sock.sendMessage(chatId, {
            react: { text: "✅", key: message.key }
        });

    } catch (error) {
        console.error("Movie details error:", error);
        await sock.sendMessage(chatId, {
            text: `🚫 Error getting details: ${error.message}`
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

// Trending command with carousel
async function trendingCommand(sock, chatId, message) {
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

        const items = response.data.data.subjectList.slice(0, 5);

        // Create carousel cards for trending items
        const cards = await Promise.all(
            items.map(async (item) => {
                const type = item.subjectType === 1 ? "🎬 Movie" : "📺 Series";
                const year = item.releaseDate ? `(${item.releaseDate.split('-')[0]})` : '';
                
                const posterUrl = item.cover?.url || 
                                 "https://files.giftedtech.co.ke/image/ZAwmovie-placeholder.jpg";

                return {
                    header: {
                        title: `${type} *${item.title}* ${year}`,
                        hasMediaAttachment: true,
                        imageMessage: (
                            await generateWAMessageContent(
                                { image: { url: posterUrl } },
                                { upload: sock.waUploadToServer }
                            )
                        ).imageMessage,
                    },
                    body: {
                        text: `⭐ *Rating:* ${item.imdbRatingValue || 'N/A'}\n🎭 *Genre:* ${item.genre?.split(',')[0] || 'N/A'}`,
                    },
                    footer: { text: `> *GIFTED-MD*` },
                    nativeFlowMessage: {
                        buttons: [
                            {
                                name: "cta_copy",
                                buttonParamsJson: JSON.stringify({
                                    display_text: "📋 Copy ID",
                                    copy_code: item.subjectId,
                                }),
                            },
                            {
                                name: "quick_reply",
                                buttonParamsJson: JSON.stringify({
                                    display_text: "📌 View Details",
                                    id: `.movieid ${item.subjectId}`,
                                }),
                            },
                        ],
                    },
                };
            })
        );

        const carouselMessage = generateWAMessageFromContent(
            chatId,
            {
                viewOnceMessage: {
                    message: {
                        messageContextInfo: {
                            deviceListMetadata: {},
                            deviceListMetadataVersion: 2,
                        },
                        interactiveMessage: {
                            body: { text: `📈 *Trending Now*` },
                            footer: {
                                text: `📂 Top ${items.length} trending items`,
                            },
                            carouselMessage: { cards },
                        },
                    },
                },
            },
            { quoted: message }
        );

        await sock.relayMessage(chatId, carouselMessage.message, {
            messageId: carouselMessage.key.id,
        });
        
        await sock.sendMessage(chatId, {
            react: { text: "✅", key: message.key }
        });

    } catch (error) {
        console.error("Trending error:", error);
        await sock.sendMessage(chatId, { text: "🚫 Failed to get trending" }, { quoted: message });
    }
}

// Hot command with carousel
async function hotCommand(sock, chatId, message) {
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
        
        // Combine and limit to 5 items
        const allItems = [...movies.slice(0, 3), ...tv.slice(0, 2)].slice(0, 5);

        // Create carousel cards for hot items
        const cards = await Promise.all(
            allItems.map(async (item) => {
                const type = item.subjectType === 1 ? "🎬 Movie" : "📺 Series";
                const year = item.releaseDate ? `(${item.releaseDate.split('-')[0]})` : '';
                
                const posterUrl = item.cover?.url || 
                                 "https://files.giftedtech.co.ke/image/ZAwmovie-placeholder.jpg";

                return {
                    header: {
                        title: `${type} *${item.title}* ${year}`,
                        hasMediaAttachment: true,
                        imageMessage: (
                            await generateWAMessageContent(
                                { image: { url: posterUrl } },
                                { upload: sock.waUploadToServer }
                            )
                        ).imageMessage,
                    },
                    body: {
                        text: `⭐ *Rating:* ${item.imdbRatingValue || 'N/A'}\n🎭 *Genre:* ${item.genre?.split(',')[0] || 'N/A'}`,
                    },
                    footer: { text: `> *GIFTED-MD*` },
                    nativeFlowMessage: {
                        buttons: [
                            {
                                name: "cta_copy",
                                buttonParamsJson: JSON.stringify({
                                    display_text: "📋 Copy ID",
                                    copy_code: item.subjectId,
                                }),
                            },
                            {
                                name: "quick_reply",
                                buttonParamsJson: JSON.stringify({
                                    display_text: "📌 View Details",
                                    id: `.movieid ${item.subjectId}`,
                                }),
                            },
                        ],
                    },
                };
            })
        );

        const carouselMessage = generateWAMessageFromContent(
            chatId,
            {
                viewOnceMessage: {
                    message: {
                        messageContextInfo: {
                            deviceListMetadata: {},
                            deviceListMetadataVersion: 2,
                        },
                        interactiveMessage: {
                            body: { text: `🔥 *Hot Content*` },
                            footer: {
                                text: `📂 Top hot movies & TV shows`,
                            },
                            carouselMessage: { cards },
                        },
                    },
                },
            },
            { quoted: message }
        );

        await sock.relayMessage(chatId, carouselMessage.message, {
            messageId: carouselMessage.key.id,
        });
        
        await sock.sendMessage(chatId, {
            react: { text: "✅", key: message.key }
        });

    } catch (error) {
        console.error("Hot error:", error);
        await sock.sendMessage(chatId, { text: "🚫 Failed to get hot content" }, { quoted: message });
    }
}

// Export all commands
module.exports = {
    moviesCommand,
    movieIdCommand,
    trendingCommand,
    hotCommand
};
