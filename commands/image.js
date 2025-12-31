const axios = require('axios');

async function imageCommand(sock, chatId, message) {
    try {
        // Initial reaction 📸
        await sock.sendMessage(chatId, {
            react: { text: "📸", key: message.key }
        });

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const searchQuery = text.split(' ').slice(1).join(' ').trim();

        if (!searchQuery) {
            return await sock.sendMessage(chatId, { 
                text: "What image do you want to search?\n\nExample: .image cats" 
            }, { quoted: message });
        }

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
            return await sock.sendMessage(chatId, {
                text: `No images found for "${searchQuery}". Try a different search term.`
            }, { quoted: message });
        }

        // Send status message
        await sock.sendMessage(chatId, { 
            text: `_📸 Searching images for:_\n_*${searchQuery}*_` 
        });

        // Get the first image
        const imageData = images[0];
        
        if (!imageData.url) {
            return await sock.sendMessage(chatId, {
                text: 'Error: No valid image URL found in the response.'
            }, { quoted: message });
        }

        // Send the image with caption
        await sock.sendMessage(chatId, {
            image: { url: imageData.url },
            caption: `📸 *Image Search Results*\n\n` +
                     `🔍 *Query:* ${searchQuery}\n` +
                     `📁 *Source:* ${imageData.source || 'Unknown'}\n` +
                     `🌐 *API:* ${new URL(usedAPI).hostname}\n\n` +
                     `Total images found: ${images.length}`
        }, { quoted: message });

        // Success reaction 
        await sock.sendMessage(chatId, { 
            react: { text: '✅', key: message.key } 
        });

    } catch (error) {
        console.error('Error in imageCommand:', error);
        await sock.sendMessage(chatId, { 
            text: "Failed to fetch images. Please try again later." 
        }, { quoted: message });
        await sock.sendMessage(chatId, { 
            react: { text: '❌', key: message.key } 
        });
    }
}

module.exports = imageCommand;
