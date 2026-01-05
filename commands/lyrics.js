const fetch = require('node-fetch');

async function lyricsCommand(sock, chatId, songTitle, message) {
    if (!songTitle) {
        await sock.sendMessage(chatId, { 
            text: '🔍 Please enter the song name to get the lyrics! Usage: *lyrics <song name>*'
        }, { quoted: message });
        return;
    }

    try {
        // Send initial reaction
        await sock.sendMessage(chatId, { react: { text: "🔍", key: message.key } });

        // Use lyricsapi.fly.dev to get lyrics
        const apiUrl = `https://lyricsapi.fly.dev/api/lyrics?q=${encodeURIComponent(songTitle)}`;
        const res = await fetch(apiUrl);
        
        if (!res.ok) {
            const errText = await res.text();
            throw new Error(errText);
        }
        
        const data = await res.json();
        const lyrics = data?.data?. plainLyrics;
        const songInfo = data?.data;
        
        if (!lyrics) {
            await sock.sendMessage(chatId, {
                text: `❌ Sorry, I couldn't find any lyrics for "${songTitle}".`
            }, { quoted: message });
            return;
        }

        // Get album artwork
        const artworkUrl = await getAlbumArtwork(songTitle, songInfo?.artist || '');

        // Process reaction
        await sock.sendMessage(chatId, { react: { text: "📝", key: message.key } });

        const maxChars = 4096;
        const truncatedLyrics = lyrics.length > maxChars ? lyrics.slice(0, maxChars - 3) + '...' : lyrics;

        // Create formatted caption
        const caption = createLyricsCaption(songTitle, songInfo, truncatedLyrics);

        if (artworkUrl) {
            try {
                // Send with image
                await sock.sendMessage(chatId, {
                    image: { url: artworkUrl },
                    caption: caption,
                    contextInfo: {
                        externalAdReply: {
                            title: songInfo?.title || songTitle,
                            body: `Artist: ${songInfo?.artist || 'Unknown'} | Lyrics`,
                            mediaType: 1,
                            thumbnailUrl: artworkUrl,
                            sourceUrl: artworkUrl,
                            renderLargerThumbnail: false,
                            showAdAttribution: false
                        }
                    }
                }, { quoted: message });
            } catch (imageError) {
                console.error('Image sending failed, sending text only:', imageError);
                // Fallback to text only
                await sock.sendMessage(chatId, { 
                    text: caption 
                }, { quoted: message });
            }
        } else {
            // Send without image if no artwork found
            await sock.sendMessage(chatId, { 
                text: caption 
            }, { quoted: message });
        }

        // Success reaction
        await sock.sendMessage(chatId, { react: { text: "🎵", key: message.key } });

    } catch (error) {
        console.error('Error in lyrics command:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ An error occurred while fetching the lyrics for "${songTitle}".`
        }, { quoted: message });
        await sock.sendMessage(chatId, { react: { text: "❌", key: message.key } });
    }
}

async function getAlbumArtwork(songTitle, artist = '') {
    try {
        // Try multiple sources for album artwork
        
        // Source 1: iTunes API (most reliable)
        const itunesQuery = encodeURIComponent(`${songTitle} ${artist}`.trim());
        const itunesUrl = `https://itunes.apple.com/search?term=${itunesQuery}&entity=song&limit=1`;
        
        const itunesResponse = await fetch(itunesUrl);
        if (itunesResponse.ok) {
            const itunesData = await itunesResponse.json();
            if (itunesData.results && itunesData.results.length > 0) {
                const artworkUrl = itunesData.results[0].artworkUrl100;
                if (artworkUrl) {
                    // Convert to higher resolution
                    return artworkUrl.replace('100x100', '600x600');
                }
            }
        }

        // Source 2: Deezer API
        const deezerUrl = `https://api.deezer.com/search?q=${itunesQuery}&limit=1`;
        const deezerResponse = await fetch(deezerUrl);
        if (deezerResponse.ok) {
            const deezerData = await deezerResponse.json();
            if (deezerData.data && deezerData.data.length > 0) {
                return deezerData.data[0].album.cover_xl || 
                       deezerData.data[0].album.cover_big || 
                       deezerData.data[0].album.cover_medium;
            }
        }

        // Source 3: Last.fm (without API key - using their image service)
        if (artist) {
            const lastfmUrl = `https://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=YOUR_API_KEY&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(songTitle)}&format=json`;
            // Note: You can get a free API key from Last.fm if needed
        }

        // Source 4: Genius API (for higher quality images)
        const geniusUrl = `https://genius.com/api/search?q=${encodeURIComponent(songTitle + ' ' + artist)}`;
        const geniusResponse = await fetch(geniusUrl);
        if (geniusResponse.ok) {
            const geniusData = await geniusResponse.json();
            if (geniusData.response?.hits?.length > 0) {
                const song = geniusData.response.hits[0].result;
                if (song && song.song_art_image_url) {
                    return song.song_art_image_url;
                }
            }
        }

        // Fallback: Use music-themed placeholder images
        return getMusicPlaceholderImage();

    } catch (error) {
        console.error('Error fetching album artwork:', error);
        return getMusicPlaceholderImage();
    }
}

function getMusicPlaceholderImage() {
    // Collection of high-quality music-themed placeholder images
    const placeholders = [
        'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&h=600&fit=crop', // Music studio
        'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=600&h=600&fit=crop', // Headphones
        'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&h=600&fit=crop', // DJ
        'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=600&h=600&fit=crop', // Concert
        'https://images.unsplash.com/photo-1494232410401-ad00d5433cfa?w=600&h=600&fit=crop', // Vinyl
        'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&h=600&fit=crop', // Microphone
    ];
    
    return placeholders[Math.floor(Math.random() * placeholders.length)];
}

function createLyricsCaption(songTitle, songInfo, lyrics) {
    const title = songInfo?.title || songTitle;
    const artist = songInfo?.artist || 'Unknown Artist';
    const album = songInfo?.album || 'Unknown Album';
    
    return `🎵 *${title}*
👤 *Artist:* ${artist}
💿 *Album:* ${album}

📝 *Lyrics:*
${lyrics}

━━━━━━━━━━━━━━━━━━━━━━━━
🔍 *Search Query:* ${songTitle}
🎶 *Powered by Lyrics API*`;
}

// Alternative simplified version for quick implementation
async function getSimpleArtwork(songTitle) {
    // Quick implementation using iTunes only
    try {
        const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(songTitle)}&entity=song&limit=1`;
        const response = await fetch(itunesUrl);
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            return data.results[0].artworkUrl100.replace('100x100', '600x600');
        }
    } catch (error) {
        console.error('Simple artwork fetch failed:', error);
    }
    
    return getMusicPlaceholderImage();
}

module.exports = { lyricsCommand };
