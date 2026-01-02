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

        const searchQuery = message.text.trim().split(' ').slice(1).join(' ');
        
        // Send searching message
        await sock.sendMessage(chatId, {
            text: `🔍 Searching images for "${searchQuery}"...`
        });

        const apis = [
            `https://api.mrfrankofc.gleeze.com/api/images?query=${encodeURIComponent(searchQuery)}`,
            `https://api.davidcyriltech.gleeze.com/api/images?query=${encodeURIComponent(searchQuery)}`
        ];

        let images = [];
        let usedAPI = '';

        for (const apiUrl of apis) {
            try {
                const response = await axios.get(apiUrl, { timeout: 10000 });
                const data = response.data;
                
                if (data && Array.isArray(data) && data.length > 0) {
                    images = data;
                    usedAPI = apiUrl;
                    break;
                }
            } catch (error) {
                continue;
            }
        }

        if (images.length === 0) {
            await sock.sendMessage(chatId, {
                text: `❌ No images found for "${searchQuery}". Try a different search term.`
            });
            return;
        }

        // Send first image with info
        const firstImage = images[0];
        if (firstImage.url) {
            await sock.sendMessage(chatId, {
                image: { url: firstImage.url },
                caption: `📸 *Image Search Results*\n\n` +
                         `🔍 *Query:* ${searchQuery}\n` +
                         `📁 *Source:* ${firstImage.source || 'Unknown'}\n` +
                         `📊 *Total found:* ${images.length}\n` +
                         `🌐 *API:* ${new URL(usedAPI).hostname}`
            });
        }

        // Send remaining images (limit to 5 total)
        const remainingImages = images.slice(1, 5);
        for (const img of remainingImages) {
            if (img.url) {
                await sock.sendMessage(chatId, {
                    image: { url: img.url }
                });
                // Delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

    } catch (error) {
        console.error('Error in image command:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Failed to fetch images. Please try again.'
        });
    }
}

module.exports = imageCommand;
