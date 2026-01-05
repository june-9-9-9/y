const axios = require('axios');

async function lyricsCommand(sock, chatId, songTitle, message) {
    if (!songTitle) {
        await sock.sendMessage(chatId, { 
            text: '🔍 Please enter the song name to get the lyrics! Usage: lyrics <song name>'
        }, { quoted: message });
        return;
    }

    try {
        const res = await axios.get(`https://apiskeith.vercel.app/search/lyrics2?query=${encodeURIComponent(songTitle)}`);
        const data = res.data;

        if (!data.status || !data.result) {
            await sock.sendMessage(chatId, { text: "💢 Not found" }, { quoted: message });
            return;
        }

        const caption = `🎶 ${data.result}`;

        await sock.sendMessage(chatId, { text: caption }, { quoted: message });
    } catch (error) {
        console.error('Error in lyrics command:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ An error occurred while fetching the lyrics for "${songTitle}".`
        }, { quoted: message });
    }
}

module.exports = { lyricsCommand };
