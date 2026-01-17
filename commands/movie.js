const axios = require('axios');

async function movieCommand(sock, chatId, message) {
    try {
        // Initial reaction
        await sock.sendMessage(chatId, {
            react: { text: '🎬', key: message.key }
        });

        // Extract text safely
        const text =
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            message.message?.imageMessage?.caption ||
            '';

        if (!text.includes(' ')) {
            return await sock.sendMessage(
                chatId,
                {
                    text: '🎬 *Movie Information Search*\n\n❌ Please provide a movie title!\n\n📝 *Usage:*\n.movie Inception\n.moviesearch The Dark Knight\n.movie Avengers Endgame\n\n🔍 *Examples:*\n• .movie Titanic\n• .movie Interstellar\n• .movie Spider-Man: No Way Home'
                },
                { quoted: message }
            );
        }

        const parts = text.split(' ');
        const movieTitle = parts.slice(1).join(' ').trim();

        if (!movieTitle) {
            return await sock.sendMessage(
                chatId,
                {
                    text: '🎬 *Movie Information Search*\n\n❌ Please provide a movie title!\n\n📝 *Example:*\n.movie The Matrix'
                },
                { quoted: message }
            );
        }

        if (movieTitle.length > 100) {
            return await sock.sendMessage(
                chatId,
                {
                    text: '🎬 *Movie Information Search*\n\n📝 Movie title too long! Max 100 characters.\n\n💡 Try a shorter movie title.'
                },
                { quoted: message }
            );
        }

        // Show "recording" presence
        await sock.sendPresenceUpdate('recording', chatId);

        // Call Movie API
        const apiUrl = `https://apiskeith.vercel.app/search/movie?q=${encodeURIComponent(movieTitle)}`;
        const response = await axios.get(apiUrl, { timeout: 30000 });

        if (
            !response.data?.status ||
            !response.data?.result ||
            Object.keys(response.data.result).length === 0
        ) {
            throw new Error('Movie not found');
        }

        const movie = response.data.result;

        // Success reaction
        await sock.sendMessage(chatId, {
            react: { text: '✅', key: message.key }
        });

        // Build caption
        let caption = `🎬 *${movie.Title}* (${movie.Year})\n\n`;

        if (movie.Rated && movie.Rated !== 'N/A') caption += `⭐ *Rated:* ${movie.Rated}\n`;
        if (movie.Released && movie.Released !== 'N/A') caption += `📅 *Released:* ${movie.Released}\n`;
        if (movie.Runtime && movie.Runtime !== 'N/A') caption += `⏱ *Runtime:* ${movie.Runtime}\n`;
        if (movie.Genre && movie.Genre !== 'N/A') caption += `🎭 *Genre:* ${movie.Genre}\n`;
        if (movie.Director && movie.Director !== 'N/A') caption += `🎥 *Director:* ${movie.Director}\n`;

        if (movie.Writer && movie.Writer !== 'N/A') {
            const writer = movie.Writer.length > 100 ? movie.Writer.substring(0, 100) + '...' : movie.Writer;
            caption += `✍️ *Writer:* ${writer}\n`;
        }

        if (movie.Actors && movie.Actors !== 'N/A') {
            const actors = movie.Actors.length > 100 ? movie.Actors.substring(0, 100) + '...' : movie.Actors;
            caption += `👥 *Actors:* ${actors}\n`;
        }

        if (movie.Language && movie.Language !== 'N/A') caption += `🌍 *Language:* ${movie.Language}\n`;
        if (movie.Country && movie.Country !== 'N/A') caption += `📍 *Country:* ${movie.Country}\n`;
        if (movie.Awards && movie.Awards !== 'N/A') caption += `🏆 *Awards:* ${movie.Awards}\n`;

        if (movie.imdbRating && movie.imdbRating !== 'N/A') {
            caption += `📊 *IMDb Rating:* ${movie.imdbRating}`;
            if (movie.imdbVotes && movie.imdbVotes !== 'N/A') {
                caption += ` (${movie.imdbVotes} votes)\n`;
            } else {
                caption += '\n';
            }
        }

        if (movie.BoxOffice && movie.BoxOffice !== 'N/A') caption += `💰 *Box Office:* ${movie.BoxOffice}\n`;
        if (movie.Production && movie.Production !== 'N/A') caption += `🎞️ *Production:* ${movie.Production}\n`;

        if (movie.Plot && movie.Plot !== 'N/A') caption += `\n📝 *Plot:* ${movie.Plot}\n`;

        caption += `\n> Powered by Keith's Movie API`;

        // Send movie info (poster only if valid)
        const msgPayload = { caption };
        if (movie.Poster && movie.Poster !== 'N/A') {
            msgPayload.image = { url: movie.Poster };
        }

        await sock.sendMessage(chatId, msgPayload, { quoted: message });

        // Final reaction
        await sock.sendMessage(chatId, {
            react: { text: '🎥', key: message.key }
        });
    } catch (error) {
        console.error('Movie command error:', {
            message: error.message,
            code: error.code,
            status: error.response?.status,
            data: error.response?.data
        });

        // Error reaction
        await sock.sendMessage(chatId, {
            react: { text: '❌', key: message.key }
        });

        let errorMessage;
        if (error.response?.status === 404) {
            errorMessage = 'Movie API endpoint not found!';
        } else if (error.message.includes('timeout') || error.code === 'ECONNABORTED') {
            errorMessage = 'Movie search timed out! Try again.';
        } else if (error.code === 'ENOTFOUND') {
            errorMessage = 'Cannot connect to movie database!';
        } else if (error.response?.status === 429) {
            errorMessage = 'Too many movie search requests! Please wait.';
        } else if (error.response?.status >= 500) {
            errorMessage = 'Movie database is currently unavailable.';
        } else if (error.message.includes('Movie not found')) {
            errorMessage = `Movie ${movieTitle ? `"${movieTitle}"` : ''} not found in database!`;
        } else {
            errorMessage = `Error: ${error.message}`;
        }

        await sock.sendMessage(
            chatId,
            {
                text: `🎬 *Movie Information Search*\n\n🚫 ${errorMessage}\n\n *Tips:*\n• Check the movie title spelling\n• Try the full movie title\n• Use English movie titles\n• Wait a few minutes and try again`
            },
            { quoted: message }
        );
    }
}

module.exports = movieCommand;
