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

        // Extract first TikTok URL from text
        const urlMatch = text.match(/https?:\/\/(?:www\.)?(?:vm|vt)?\.?tiktok\.com\/[^\s]+/);
        const url = urlMatch ? urlMatch[0].trim() : null;

        if (!url) {
            return await sock.sendMessage(chatId, { 
                text: "Please provide a valid TikTok video link."
            });
        }

        await sock.sendMessage(chatId, {
            react: { text: '↘️', key: message.key }
        });

        try {
            // Call TikTok downloader API
            const apiResponse = await axios.get(
                `https://iamtkm.vercel.app/downloaders/tiktokdl?apikey=tkm&url=${encodeURIComponent(url)}`
            );
            const data = apiResponse.data;
            console.log('TikTok API response:', data);

            if (data && data.status && data.result) {
                const videoUrl = data.result.no_watermark || data.result.watermark;
                const caption = data.result.title || "";
                const TtAudio = data.result.music;

                if (!videoUrl) {
                    return await sock.sendMessage(chatId, {
                        text: "No video URL found in the response."
                    });
                }

                // Send video first
                await sock.sendMessage(chatId, {
                    video: { url: videoUrl },
                    mimetype: "video/mp4",
                    caption: caption
                }, { quoted: message });

                // Then send audio after a short delay
                if (TtAudio) {
                    setTimeout(async () => {
                        try {
                            await sock.sendMessage(chatId, {
                                audio: { url: TtAudio },
                                mimetype: "audio/mpeg",
                                ptt: false
                            }, { quoted: message });
                        } catch (audioError) {
                            console.error('Error sending audio:', audioError);
                            await sock.sendMessage(chatId, {
                                text: "Video sent, but audio failed to send."
                            });
                        }
                    }, 1000);
                }
            } else {
                return await sock.sendMessage(chatId, {
                    text: "Failed to fetch video. Please check the link or try again later."
                });
            }

        } catch (error) {
            console.error('Error in TikTok API:', error);
            await sock.sendMessage(chatId, {
                text: "Failed to download the TikTok video. Please try again later."
            });
        }
    } catch (error) {
        console.error('Error in TikTok command:', error);
        await sock.sendMessage(chatId, {
            text: "An unexpected error occurred. Please try again."
        });
    }
}

module.exports = tiktokCommand;
