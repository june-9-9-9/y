const axios = require('axios');

async function spotifyCommand(sock, chatId, message) {
    try {
        // Initial reaction
        await sock.sendMessage(chatId, {
            react: { text: '🎵', key: message.key }
        });

        const text = message.message?.conversation || 
                     message.message?.extendedTextMessage?.text || 
                     message.message?.imageMessage?.caption || 
                     '';
        
        if (!text.includes(' ')) {
            return await sock.sendMessage(chatId, {
                text: '🎵 *Spotify Music Downloader*\n\n❌ Please provide a song name or Spotify URL!\n\n📝 *Usage:*\n.spotify Blinding Lights\nThe Weeknd\n.spot https://open.spotify.com/track/...\n.spdl Shape of You Ed Sheeran\n\n🔍 *Examples:*\n• .spotify Bohemian Rhapsody\n• .spot Yesterday The Beatles\n• .spotify https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b\n\n💡 *Supported:*\n• Song names\n• Artist + Song\n• Spotify URLs\n• Playlist URLs (first track)'
            }, { quoted: message });
        }

        const parts = text.split(' ');
        const query = parts.slice(1).join(' ').trim();

        if (!query) {
            return await sock.sendMessage(chatId, {
                text: '🎵 *Spotify Music Downloader*\n\n❌ Please provide a song name or Spotify URL!\n\n📝 *Example:*\n.spotify Dance Monkey'
            }, { quoted: message });
        }

        if (query.length > 200) {
            return await sock.sendMessage(chatId, {
                text: '🎵 *Spotify Music Downloader*\n\n📝 Query too long! Max 200 characters.\n\n💡 Try a shorter song name.'
            }, { quoted: message });
        }

        // Presence update
        await sock.sendPresenceUpdate('recording', chatId);

        // API call
        const apiUrl = `https://apiskeith.vercel.app/download/spotify?q=${encodeURIComponent(query)}`;
        const response = await axios.get(apiUrl, { timeout: 60000 });

        const track = response.data?.result?.track;

        if (!track?.downloadLink) throw new Error('No download link found');
        if (!track?.title) throw new Error('Invalid track information');

        // Success reaction
        await sock.sendMessage(chatId, {
            react: { text: '✅', key: message.key }
        });

        // Clean filename
        const cleanFileName = (str) => str.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim();
        const fileName = cleanFileName(`${track.title} - ${track.artist || 'Unknown Artist'}.mp3`);

        // Track info FIRST
        let trackInfo = `🎵 *Spotify Music Downloader*\n\n`;
        trackInfo += `📀 *Title:* ${track.title}\n`;
        if (track.artist) trackInfo += `🎤 *Artist:* ${track.artist}\n`;
        if (track.album) trackInfo += `💿 *Album:* ${track.album}\n`;
        if (track.duration) trackInfo += `⏱ *Duration:* ${track.duration}\n`;
        if (track.releaseDate) trackInfo += `📅 *Released:* ${track.releaseDate}\n`;
        if (track.popularity) trackInfo += `⭐ *Popularity:* ${track.popularity}/100\n`;
        if (track.genres?.length > 0) trackInfo += `🎭 *Genres:* ${track.genres.join(', ')}\n`;
        if (track.url) trackInfo += `🔗 *Spotify URL:* ${track.url}\n`;
        trackInfo += `\n✅ *Download successful!*\n`;
        trackInfo += `> Powered by Keith's Spotify API`;

        await sock.sendMessage(chatId, { text: trackInfo }, { quoted: message });

        // Then audio
        await sock.sendMessage(chatId, {
            audio: { url: track.downloadLink },
            mimetype: 'audio/mpeg',
            fileName: fileName
        }, { quoted: message });

        // Then document
        await sock.sendMessage(chatId, {
            document: { url: track.downloadLink },
            mimetype: 'audio/mpeg',
            fileName: fileName
        }, { quoted: message });

        // Final reaction
        await sock.sendMessage(chatId, {
            react: { text: '🎧', key: message.key }
        });

    } catch (error) {
        console.error("Spotify command error:", error);

        await sock.sendMessage(chatId, {
            react: { text: '❌', key: message.key }
        });

        let errorMessage;
        if (error.response?.status === 404) errorMessage = 'Spotify API endpoint not found!';
        else if (error.message.includes('timeout') || error.code === 'ECONNABORTED') errorMessage = 'Download timed out! The song might be too long.';
        else if (error.code === 'ENOTFOUND') errorMessage = 'Cannot connect to Spotify service!';
        else if (error.response?.status === 429) errorMessage = 'Too many download requests! Please wait a while.';
        else if (error.response?.status === 403) errorMessage = 'Spotify download service is temporarily blocked!';
        else if (error.response?.status >= 500) errorMessage = 'Spotify service is currently unavailable.';
        else if (error.message.includes('No download link') || error.message.includes('Invalid track')) errorMessage = 'Song not found or cannot be downloaded!';
        else if (error.message.includes('premium')) errorMessage = 'This may be a premium-only track!';
        else if (error.message.includes('region') || error.message.includes('not available')) errorMessage = 'This track is not available in your region!';
        else errorMessage = `Error: ${error.message}`;

        await sock.sendMessage(chatId, {
            text: `🎵 *Spotify Music Downloader*\n\n🚫 ${errorMessage}\n\n *Tips:*\n• Try a different song\n• Check the spelling\n• Try without special characters\n• Use exact song title\n• Wait a few minutes and try again\n\n🔗 *Alternative:* Use .ytmp3 for YouTube downloads`
        }, { quoted: message });
    }
}

module.exports = spotifyCommand;
