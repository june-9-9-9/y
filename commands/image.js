const axios = require('axios');

async function imageCommand(sock, message, chatId) {
    try {
        // Check if there's a search query
        if (!message.text || message.text.trim().split(' ').length < 2) {
            await sock.sendMessage(chatId, {
                text: 'Please provide a search query!\n\nExample: .image cats'
            });
            return;
        }

        // Extract search query (remove command part)
        const searchQuery = message.text.trim().split(' ').slice(1).join(' ');
        
        // Define the APIs
        const apis = [
            `https://api.mrfrankofc.gleeze.com/api/images?query=${encodeURIComponent(searchQuery)}`,
            `https://api.davidcyriltech.gleeze.com/api/images?query=${encodeURIComponent(searchQuery)}`
        ];

        let images = [];
        let usedAPI = '';
        let success = false;

        // Try each API until we get results
        for (const apiUrl of apis) {
            try {
                const response = await axios.get(apiUrl, {
                    timeout: 10000 // 10 second timeout
                });
                
                const data = response.data;
                
                // Check if we got valid image data
                if (data && Array.isArray(data) && data.length > 0) {
                    images = data;
                    usedAPI = apiUrl;
                    success = true;
                    break;
                }
            } catch (error) {
                console.log(`API failed: ${apiUrl}`, error.message);
                // Continue to next API
                continue;
            }
        }

        if (!success || images.length === 0) {
            await sock.sendMessage(chatId, {
                text: `No images found for "${searchQuery}". Try a different search term.`
            });
            return;
        }

        // Send the first image (or you can send multiple)
        const imageData = images[0];
        
        // Check if the image has a valid URL
        if (imageData.url) {
            // Send as image
            await sock.sendMessage(chatId, {
                image: { url: imageData.url },
                caption: `📸 *Image Search Results*\n\n` +
                         `🔍 *Query:* ${searchQuery}\n` +
                         `📁 *Source:* ${imageData.source || 'Unknown'}\n` +
                         `🌐 *API:* ${new URL(usedAPI).hostname}\n\n` +
                         `Total images found: ${images.length}`
            });
        } else {
            await sock.sendMessage(chatId, {
                text: 'Error: No valid image URL found in the response.'
            });
        }

        // Optional: Send more images (limited to avoid flooding)
        // You can add this if you want to send multiple images
        /*
        const limitedImages = images.slice(1, 5); // Send next 4 images
        for (const img of limitedImages) {
            if (img.url) {
                await sock.sendMessage(chatId, {
                    image: { url: img.url }
                });
                // Small delay between images
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        */

    } catch (error) {
        console.error('Error in image command:', error);
        await sock.sendMessage(chatId, {
            text: '❌ An error occurred while fetching images. Please try again later.'
        });
    }
}

module.exports = imageCommand;
