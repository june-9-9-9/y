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
                text: "📸 *Image Search*\n\nPlease provide a search term.\nExample: /image flower"
            });
        }

        // Extract search query (remove command)
        const args = text.split(' ');
        args.shift(); // Remove command (e.g., "/image")
        const query = args.join(' ').trim();
        
        if (!query) {
            return await sock.sendMessage(chatId, { 
                text: "📸 *Image Search*\n\nPlease provide a search term.\nExample: /image flower"
            });
        }

        // Show searching indicator
        await sock.sendMessage(chatId, {
            react: { text: '🔍', key: message.key }
        });

        // Send initial message
        const searchingMsg = await sock.sendMessage(chatId, {
            text: `🔍 Searching for: *${query}*...`
        });

        try {
            // Call the API
            const apiUrl = `https://iamtkm.vercel.app/downloaders/img?apikey=tkm&text=${encodeURIComponent(query)}`;
            const apiResponse = await axios.get(apiUrl, {
                timeout: 10000 // 10 second timeout
            });
            
            const data = apiResponse.data;

            // Delete searching message
            await sock.sendMessage(chatId, {
                delete: searchingMsg.key
            });

            // Check API response structure
            if (!data || data.status !== true || !Array.isArray(data.result) || data.result.length === 0) {
                return await sock.sendMessage(chatId, {
                    text: `❌ No images found for: *${query}*\n\nTry a different search term.`
                });
            }

            // Success - Found images
            const images = data.result.all;
            const totalImages = images.length;
            const imagesToSend = Math.min(totalImages, 10); // Limit to 10 images max
            
            await sock.sendMessage(chatId, {
                react: { text: '✅', key: message.key }
            });

            // Send initial info
            await sock.sendMessage(chatId, {
                text: `📸 Found *${totalImages}* images for: *${query}*\nSending *${imagesToSend}* best results...`
            });

            // Send images with better handling
            let sentCount = 0;
            for (let i = 0; i < imagesToSend; i++) {
                try {
                    const imageUrl = images[i];
                    
                    // Validate URL format
                    if (!imageUrl || !imageUrl.startsWith('http')) {
                        console.warn(`Invalid image URL at index ${i}:`, imageUrl);
                        continue;
                    }

                    await sock.sendMessage(chatId, {
                        image: { url: imageUrl },
                        caption: `📸 *${query}* (${i + 1}/${imagesToSend})`,
                        contextInfo: {
                            externalAdReply: {
                                title: `Image ${i + 1}/${imagesToSend}`,
                                body: `Search: ${query}`,
                                thumbnailUrl: imageUrl,
                                sourceUrl: imageUrl,
                                mediaType: 1,
                                mediaUrl: imageUrl,
                                showAdAttribution: false
                            }
                        }
                    });
                    
                    sentCount++;
                    
                    // Delay to prevent flooding
                    if (i < imagesToSend - 1) {
                        await new Promise(resolve => setTimeout(resolve, 800));
                    }
                    
                } catch (imgError) {
                    console.error(`Failed to send image ${i + 1}:`, imgError);
                    // Continue with next image
                }
            }

            // Send completion message
            if (sentCount > 0) {
                await sock.sendMessage(chatId, {
                    text: `✅ Successfully sent *${sentCount}* images for: *${query}*\n\n📁 Total available: ${totalImages} images`
                });
            } else {
                await sock.sendMessage(chatId, {
                    text: `❌ Could not send any images for: *${query}*\nThe images might be blocked or unavailable.`
                });
            }

        } catch (error) {
            console.error('Image API Error:', error);
            
            // Try to delete searching message if it exists
            try {
                await sock.sendMessage(chatId, { delete: searchingMsg.key });
            } catch (e) {}
            
            let errorMessage = "❌ Failed to search for images.";
            
            if (error.code === 'ECONNABORTED') {
                errorMessage = "⏱️ Search timeout. Please try again.";
            } else if (error.response) {
                errorMessage = `❌ API Error: ${error.response.status}`;
            } else if (error.request) {
                errorMessage = "🌐 Network error. Check your connection.";
            }
            
            await sock.sendMessage(chatId, { 
                text: errorMessage + "\n\nTry again in a moment."
            });
        }
    } catch (error) {
        console.error('Image Command Error:', error);
        await sock.sendMessage(chatId, {
            text: "❌ An unexpected error occurred. Please try again."
        });
    }
}

module.exports = imageCommand;
