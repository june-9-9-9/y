const axios = require('axios');

// Store processed message IDs to prevent duplicates
const processedMessages = new Set();

async function tiktokCommand(sock, chatId, message) {
    try {
        // Prevent duplicate processing
        if (processedMessages.has(message.key.id)) return;
        processedMessages.add(message.key.id);
        setTimeout(() => processedMessages.delete(message.key.id), 5 * 60 * 1000);

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        if (!text) {
            return await sock.sendMessage(chatId, { 
                text: "Please provide a TikTok link for the video."
            });
        }

        const url = text.split(' ').slice(1).join(' ').trim();
        if (!url) {
            return await sock.sendMessage(chatId, { 
                text: "Please provide a TikTok link for the video."
            });
        }

        const tiktokPatterns = [
            /https?:\/\/(?:www\.)?tiktok\.com\//,
            /https?:\/\/(?:vm\.)?tiktok\.com\//,
            /https?:\/\/(?:vt\.)?tiktok\.com\//,
            /https?:\/\/(?:www\.)?tiktok\.com\/@/,
            /https?:\/\/(?:www\.)?tiktok\.com\/t\//
        ];

        const isValidUrl = tiktokPatterns.some(pattern => pattern.test(url));
        if (!isValidUrl) {
            return await sock.sendMessage(chatId, { 
                text: "That is not a valid TikTok link. Please provide a valid TikTok video link."
            });
        }

        await sock.sendMessage(chatId, {
            react: { text: '↘️', key: message.key }
        });

        try {
            // ✅ TikTok download API (video only)
            const apiResponse = await axios.get(
                `https://apiskeith.top/download/tiktokdl3?url=${encodeURIComponent(url)}`
            );
            const data = apiResponse.data;

            if (data && data.status && data.result) {
                const videoUrl = data.result;
                const caption = data.result.title || "JUNE-X";

                await sock.sendMessage(chatId, {
                    video: { url: videoUrl },
                    mimetype: "video/mp4",
                    caption: caption
                }, { quoted: message });

            } else {
                return await sock.sendMessage(chatId, {
                    text: "Failed to fetch video. Please check the link or try again later."
                });
            }

        } catch (error) {
            console.error('Error in TikTok API:', error.message || error);
            await sock.sendMessage(chatId, {
                text: "Failed to download the TikTok video. Please try again later."
            });
        }
    } catch (error) {
        console.error('Error in TikTok command:', error.message || error);
        await sock.sendMessage(chatId, {
            text: "An unexpected error occurred. Please try again."
        });
    }
}

module.exports = tiktokCommand;
