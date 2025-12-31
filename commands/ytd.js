const axios = require('axios');

// Simple YouTube URL validator (matches youtu.be and youtube.com/watch?v=)
function isValidYouTubeUrl(url) {
    const ytRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w\-]{11}(&.*)?$/;
    return ytRegex.test(url);
}

async function ytmp4Command(sock, chatId, senderId, message, userMessage) {
    const url = userMessage.split(' ')[1];
    if (!url || !isValidYouTubeUrl(url)) {
        return sock.sendMessage(chatId, {
            text: "🎬 *YouTube MP4 Download*\nUsage:\n.ytmp4 <youtube_url>\n\n⚠️ Please provide a valid YouTube link."
        });
    }

    await sock.sendMessage(chatId, { react: { text: '🕖', key: message.key } });  
    await sock.sendMessage(chatId, { text: `⏬ Downloading MP4 from: ${url}...` }, { quoted: message });  

    try {  
        const { data } = await axios.get(`https://iamtkm.vercel.app/downloaders/ytmp4?apikey=tkm&url=${encodeURIComponent(url)}`);  
        const dlLink = data?.data?.url;  

        if (!dlLink) throw new Error("No video link");  

        await sock.sendMessage(chatId, {  
            video: { url: dlLink },  
            caption: `🎬 ${data.data.title || 'YouTube Video'}`,  
            mimetype: "video/mp4"  
        }, { quoted: message });  

        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });  
    } catch (err) {  
        console.error(err);  
        await sock.sendMessage(chatId, { text: '❌ Failed to download video.' });  
    }
}

async function ytmp3Command(sock, chatId, senderId, message, userMessage) {
    const url = userMessage.split(' ')[1];
    if (!url || !isValidYouTubeUrl(url)) {
        return sock.sendMessage(chatId, {
            text: "🎵 *YouTube MP3 Download*\nUsage:\n.ytmp3 <youtube_url>\n\n⚠️ Please provide a valid YouTube link."
        });
    }

    await sock.sendMessage(chatId, { react: { text: '🕖', key: message.key } });  
    await sock.sendMessage(chatId, { text: `⏬ Downloading MP3 from: ${url}...` }, { quoted: message });  

    try {  
        const { data } = await axios.get(`https://iamtkm.vercel.app/downloaders/ytmp3?apikey=tkm&url=${encodeURIComponent(url)}`);  
        const dlLink = data?.data?.url;  

        if (!dlLink) throw new Error("No audio link");  

        await sock.sendMessage(chatId, {  
            document: { url: dlLink },  
            mimetype: "audio/mpeg",  
            fileName: `${data.data.title || 'audio'}.mp3`,  
            contextInfo: {  
                externalAdReply: {  
                    thumbnailUrl: data.data.thumbnail,  
                    title: data.data.title || "YouTube Audio",  
                    body: "Downloaded via YouTube MP3",  
                    sourceUrl: null,  
                    renderLargerThumbnail: true,  
                    mediaType: 1  
                }  
            }  
        }, { quoted: message });  

        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });  
    } catch (err) {  
        console.error(err);  
        await sock.sendMessage(chatId, { text: '❌ Failed to download audio.' });  
    }
}

module.exports = { ytmp4Command, ytmp3Command };
