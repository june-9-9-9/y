const axios = require('axios');

// Store processed message IDs to prevent duplicates
const processedMessages = new Set();

// List of fallback TikTok downloader APIs
const tiktokApis = [
    url => `https://iamtkm.vercel.app/downloaders/tiktokdl?apikey=tkm&url=${encodeURIComponent(url)}`,
    url => `https://api.giftedtech.co.ke/api/download/tiktokdlv3?apikey=gifted&url=${encodeURIComponent(url)}`,
    url => `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`
];

async function fetchTikTokData(url) {
    for (const api of tiktokApis) {
        try {
            const response = await axios.get(api(url));
            const data = response.data;
            if (data && (data.result || data.data)) {
                // Normalize response structure
                return {
                    videoUrl: data.data?.no_watermark || data.result?.video_hd|| data.result?. video || data.data?.watermark,
                    caption: data.result?.title || data.data?.title || "",
                    audioUrl: data.result?.music || data.data?.music || null
                };
            }
        } catch (err) {
            console.error(`API failed: ${api(url)}`, err.message);
        }
    }
    return null;
}

async function tiktokCommand(sock, chatId, message) {
    try {
        if (processedMessages.has(message.key.id)) return;
        processedMessages.add(message.key.id);
        setTimeout(() => processedMessages.delete(message.key.id), 5 * 60 * 1000);

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        if (!text) {
            return await sock.sendMessage(chatId, { text: "Please provide a TikTok link for the video." });
        }

        const urlMatch = text.match(/https?:\/\/(?:www\.)?(?:vm|vt)?\.?tiktok\.com\/[^\s]+/);
        const url = urlMatch ? urlMatch[0].trim() : null;

        if (!url) {
            return await sock.sendMessage(chatId, { text: "Please provide a valid TikTok video link." });
        }

        await sock.sendMessage(chatId, { react: { text: '↘️', key: message.key } });

        const result = await fetchTikTokData(url);

        if (result && result.videoUrl) {
            await sock.sendMessage(chatId, {
                video: { url: result.videoUrl },
                mimetype: "video/mp4",
                caption: result.caption
            }, { quoted: message });

            if (result.audioUrl) {
                setTimeout(async () => {
                    try {
                        await sock.sendMessage(chatId, {
                            audio: { url: result.audioUrl },
                            mimetype: "audio/mpeg",
                            ptt: false
                        }, { quoted: message });
                    } catch (audioError) {
                        console.error('Error sending audio:', audioError);
                        await sock.sendMessage(chatId, { text: "Video sent, but audio failed to send." });
                    }
                }, 1000);
            }
        } else {
            await sock.sendMessage(chatId, { text: "Failed to fetch video from all fallback APIs." });
        }
    } catch (error) {
        console.error('Error in TikTok command:', error);
        await sock.sendMessage(chatId, { text: "An unexpected error occurred. Please try again." });
    }
}

module.exports = tiktokCommand;
