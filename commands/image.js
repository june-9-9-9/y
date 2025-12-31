const axios = require('axios');

// Track processed message IDs to prevent duplicate handling
const processedMessages = new Set();

async function imageCommand(sock, chatId, message) {
    try {
        const msgId = message?.key?.id;
        if (!msgId) return;

        // ✅ Prevent duplicate processing
        if (processedMessages.has(msgId)) return;
        processedMessages.add(msgId);
        setTimeout(() => processedMessages.delete(msgId), 5 * 60 * 1000);

        // ✅ Extract text content
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        if (!text) {
            return sock.sendMessage(chatId, { 
                text: "Please provide a search term for images.\nExample: /image cats"
            });
        }

        // ✅ Parse query (strip command prefix)
        const query = text.split(' ').slice(1).join(' ').trim();
        if (!query) {
            return sock.sendMessage(chatId, { 
                text: "Please provide a search term for images.\nExample: /image cats"
            });
        }

        // ✅ React indicator
        await sock.sendMessage(chatId, { react: { text: '🔍', key: message.key } });

        // ✅ API call
        const apiUrl = `https://iamtkm.vercel.app/downloaders/img?apikey=tkm&text=${encodeURIComponent(query)}`;
        let apiResponse;
        try {
            apiResponse = await axios.get(apiUrl);
        } catch (err) {
            console.error("Image API request failed:", err.message);
            return sock.sendMessage(chatId, { text: "⚠️ Unable to reach the image service. Please try again later." });
        }

        const data = apiResponse?.data;
        const imageUrls = Array.isArray(data?.result) ? data.result.slice(0, 10) : [];

        if (data?.status && imageUrls.length > 0) {
            // ✅ Send images sequentially with delay
            for (let i = 0; i < imageUrls.length; i++) {
                try {
                    await sock.sendMessage(chatId, {
                        image: { url: imageUrls[i] },
                        caption: i === 0 
                            ? `Results for: *${query}*\nImage ${i + 1}/${imageUrls.length}` 
                            : `Image ${i + 1}/${imageUrls.length}`
                    });
                    if (i < imageUrls.length - 1) {
                        await new Promise(res => setTimeout(res, 500));
                    }
                } catch (imgErr) {
                    console.error(`Error sending image ${i + 1}:`, imgErr.message);
                }
            }

            // ✅ Summary message
            await sock.sendMessage(chatId, { text: `✅ Sent ${imageUrls.length} images for: *${query}*` });

        } else {
            await sock.sendMessage(chatId, { text: `No images found for: *${query}*\nTry a different search term.` });
        }

    } catch (error) {
        console.error("Unexpected error in imageCommand:", error.message);
        await sock.sendMessage(chatId, { text: "❌ An unexpected error occurred. Please try again." });
    }
}

module.exports = imageCommand;
