const yts = require('yt-search');
const axios = require('axios');
const fetch = require('node-fetch'); // to fetch thumbnail image


async function songCommand(sock, chatId, message) {
    try {
        // Initial reaction 🎵
        await sock.sendMessage(chatId, {
            react: { text: "🎵", key: message.key }
        });

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const searchQuery = text.split(' ').slice(1).join(' ').trim();

        if (!searchQuery) {
            return await sock.sendMessage(chatId, { 
                text: "What song do you want to download?" 
            }, { quoted: message });
        }

        // Search for the song
        const { videos } = await yts(searchQuery);
        if (!videos || videos.length === 0) {
            return await sock.sendMessage(chatId, { text: "No songs found!" });
        }

        // Get the first video result
        const video = videos[0];
        const urlYt = video.url;

        // Fetch audio data from API
        const response = await axios.get(`https://api.privatezia.biz.id/api/downloader/ytmp3?url=${urlYt}`);
        const apiData = response.data;

        if (!apiData || !apiData.status || !apiData.result || !apiData.result.downloadUrl) {
            return await sock.sendMessage(chatId, { 
                text: "Failed to fetch audio from the API. Please try again later." 
            }, { quoted: message });
        }

        const audioUrl = apiData.result.downloadUrl;
        const title = apiData.result.title;
        const Thumb = apiData.result.thumbnail;

        // Fetch thumbnail image and convert to buffer
        let thumbBuffer = null;
        try {
            const thumbResponse = await fetch(video.thumbnail);
            thumbBuffer = Buffer.from(await thumbResponse.arrayBuffer());
        } catch (err) {
            console.error("Thumbnail fetch failed:", err);
        }

        // Send status message
        await sock.sendMessage(chatId, { text: `_🎶 Playing song:_\n_*${title}*_` });

        // Send the audio with thumbnail
        await sock.sendMessage(chatId, {
            audio: { url: audioUrl },
            mimetype: "audio/mpeg",
            fileName: `${title}.mp3`,
            Thumbnail: Thumb // attach thumbnail here
        }, { quoted: message });


        // Success reaction 
        await sock.sendMessage(chatId, { react: { text: '🎺', key: message.key } });

    } catch (error) {
        console.error('Error in songCommand:', error);
        await sock.sendMessage(chatId, { text: "Download failed. Please try again later." });
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
    }
}

module.exports = songCommand;
