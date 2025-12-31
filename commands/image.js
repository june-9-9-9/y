const axios = require('axios');

// Store processed message IDs to prevent duplicates
const processedMessages = new Set();

async function imageCommand(sock, chatId, message) {
    try {
        // ✅ Normalize message ID
        const msgId = message?.key?.id || `${Date.now()}-${Math.random()}`;
        if (processedMessages.has(msgId)) {
            console.log(`Skipping duplicate message: ${msgId}`);
            return;
        }
        processedMessages.add(msgId);
        setTimeout(() => processedMessages.delete(msgId), 5 * 60 * 1000);

        // ✅ Normalize text extraction
        const text =
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            message.message?.imageMessage?.caption ||
            "";

        if (!text.trim()) {
            return await sock.sendMessage(chatId, {
                text: "Please provide a search term for images.\nExample: /image cats"
            });
        }

        // ✅ Extract query after command
        const parts = text.trim().split(/\s+/);
        const command = parts[0].toLowerCase();
        const query = parts.slice(1).join(" ").trim();

        if (command !== "/image" || !query) {
            return await sock.sendMessage(chatId, {
                text: "Please provide a search term for images.\nExample: /image cats"
            });
        }

        // Show reaction
        await sock.sendMessage(chatId, {
            react: { text: "🔍", key: message.key }
        });

        // ✅ API call
        const apiUrl = `https://iamtkm.vercel.app/downloaders/img?apikey=tkm&text=${encodeURIComponent(query)}`;
        console.log("Fetching images from:", apiUrl);

        const apiResponse = await axios.get(apiUrl);
        const data = apiResponse.data;
        console.log("API response:", data);

        if (data?.status && Array.isArray(data.result) && data.result.length > 0) {
            const imageUrls = data.result.slice(0, 10); // limit to 10

            for (let i = 0; i < imageUrls.length; i++) {
                try {
                    await sock.sendMessage(chatId, {
                        image: { url: imageUrls[i] },
                        caption:
                            i === 0
                                ? `Results for: *${query}*\nImage ${i + 1}/${imageUrls.length}`
                                : `Image ${i + 1}/${imageUrls.length}`
                    }, { quoted: message });

                    if (i < imageUrls.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                } catch (imgError) {
                    console.error(`Error sending image ${i + 1}:`, imgError);
                }
            }

            await sock.sendMessage(chatId, {
                text: `✅ Sent ${imageUrls.length} images for: *${query}*`
            });
        } else {
            await sock.sendMessage(chatId, {
                text: `No images found for: *${query}*\nPlease try a different search term.`
            });
        }
    } catch (error) {
        console.error("Error in imageCommand:", error);

        if (error.response) {
            await sock.sendMessage(chatId, {
                text: `API Error: ${error.response.status} - ${error.response.statusText}\nPlease try again later.`
            });
        } else if (error.request) {
            await sock.sendMessage(chatId, {
                text: "Unable to connect to the image service. Please check your internet connection."
            });
        } else {
            await sock.sendMessage(chatId, {
                text: "An unexpected error occurred. Please try again."
            });
        }
    }
}

module.exports = imageCommand;
