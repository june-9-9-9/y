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

        // Filter and extract TikTok URL from text
        const tiktokPattern = /(https?:\/\/(?:www\.|vm\.|vt\.|m\.)?tiktok\.com\/(?:@[\w.-]+\/video\/\d+|t\/\w+|\w+|\/video\/\d+|\w+\?.*))/i;
        const urlMatch = text.match(tiktokPattern);
        
        if (!urlMatch) {
            return await sock.sendMessage(chatId, { 
                text: "❌ No valid TikTok link found. Please provide a valid TikTok video link."
            });
        }

        const url = urlMatch[0]; // Extract only the TikTok URL

        await sock.sendMessage(chatId, {
            react: { text: '⬇️', key: message.key }
        });

        try {
            // API for TikTok download (no watermark version)
            const apiResponse = await axios.get(`https://iamtkm.vercel.app/downloaders/tiktokdl?apikey=tkm&url=${encodeURIComponent(url)}`);
            const data = apiResponse.data;

            if (data && data.status && data.result && data.result.nowm) {
                const videoUrl = data.result.nowm; // No watermark video only
                const caption = data.result.title || "🎬 TikTok Video";
                
                // Send video only (no audio)
                await sock.sendMessage(chatId, {
                    video: { url: videoUrl },
                    mimetype: "video/mp4",
                    caption: caption
                }, { quoted: message });
                
                // Remove audio sending completely
                
            } else {
                return await sock.sendMessage(chatId, {
                    text: "❌ Failed to fetch video. Please check the link or try again later."
                });
            }

        } catch (error) {
            console.error('Error in TikTok API:', error);
            await sock.sendMessage(chatId, {
                text: "❌ Failed to download the TikTok video. Please try again later."
            });
        }
    } catch (error) {
        console.error('Error in TikTok command:', error);
        await sock.sendMessage(chatId, {
            text: "❌ An unexpected error occurred. Please try again."
        });
    }
}

module.exports = tiktokCommand;
