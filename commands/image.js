const axios = require('axios');

// Store processed message IDs to prevent duplicates
const processedMessages = new Set();

async function imageCommand(sock, chatId, message) {
    try {
        // Prevent duplicate processing
        if (processedMessages.has(message.key.id)) return;
        processedMessages.add(message.key.id);
        setTimeout(() => processedMessages.delete(message.key.id), 5 * 60 * 1000);

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        if (!text) {
            return await sock.sendMessage(chatId, { 
                text: "Please provide a search term for images.\nExample: /image cats"
            });
        }

        // Remove command prefix and get search query
        const query = text.split(' ').slice(1).join(' ').trim();
        if (!query) {
            return await sock.sendMessage(chatId, { 
                text: "Please provide a search term for images.\nExample: /image cats"
            });
        }

        // Show typing indicator or react
        await sock.sendMessage(chatId, {
            react: { text: '🔍', key: message.key }
        });

        try {
            // ✅ API for image search
            const apiUrl = `https://iamtkm.vercel.app/downloaders/img?apikey=tkm&text=${encodeURIComponent(query)}`;
            const apiResponse = await axios.get(apiUrl);
            const data = apiResponse.data;

            if (data && data.status && data.result && Array.isArray(data.result) && data.result.all > 0) {
                // Send all images from the result array
                const imageUrls = data.result.all.slice(0, 10); // Limit to first 10 images to avoid spam
                
                // Send each image individually with a delay to avoid rate limiting
                for (let i = 0; i < imageUrls.length; i++) {
                    try {
                        await sock.sendMessage(chatId, {
                            image: { url: imageUrls[i] },
                            caption: i === 0 ? `Results for: *${query}*\nImage ${i + 1}/${imageUrls.length}` : `Image ${i + 1}/${imageUrls.length}`
                        });
                        
                        // Add small delay between images to prevent flooding
                        if (i < imageUrls.length - 1) {
                            await new Promise(resolve => setTimeout(resolve, 500));
                        }
                    } catch (imgError) {
                        console.error(`Error sending image ${i + 1}:`, imgError);
                        // Continue with next image even if one fails
                    }
                }
                
                // Send summary message
                if (imageUrls.length > 0) {
                    await sock.sendMessage(chatId, {
                        text: `✅ Sent ${imageUrls.length} images for: *${query}*`
                    });
                }
                
            } else {
                return await sock.sendMessage(chatId, {
                    text: `No images found for: *${query}*\nPlease try a different search term.`
                });
            }

        } catch (error) {
            console.error('Error in Image API:', error);
            
            // More specific error messages
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
                    text: "Failed to search for images. Please try again later."
                });
            }
        }
    } catch (error) {
        console.error('Error in image command:', error);
        await sock.sendMessage(chatId, {
            text: "An unexpected error occurred. Please try again."
        });
    }
}

module.exports = imageCommand;
