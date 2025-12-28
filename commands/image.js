const gis = require('g-i-s');

async function imageCommand(sock, chatId, senderId, message, userMessage) {
    try {
        const args = userMessage.split(' ').slice(1);
        const query = args.join(' ');

        if (!query) {
            return await sock.sendMessage(chatId, {
                text: `📷 *Image Search Command*\n\nUsage:\n.image <search_query>\n\nExample:\n.image cat\n.image beautiful sunset\n.image anime characters`
            });
        }

        await sock.sendMessage(chatId, {
            text: `🔍 Searching images for: "${query}"...`
        }, { quoted: message });

        try {
            gis(query, async (error, results) => {
                if (error) {
                    console.error('Image search error:', error);
                    return await sock.sendMessage(chatId, {
                        text: `❌ Error searching images.\n${error.message || 'Please try again later.'}`
                    });
                }

                if (!results || results.length === 0) {
                    return await sock.sendMessage(chatId, {
                        text: `❌ No images found for "${query}"\n\nTry different keywords.`
                    });
                }

                const numberOfImages = Math.min(results.length, 5);
                const imageUrls = results.slice(0, numberOfImages).map(result => result.url);

                if (imageUrls.length === 0) {
                    return await sock.sendMessage(chatId, {
                        text: `❌ No valid images found for "${query}"`
                    });
                }

                // Fancy text for JUNE X
                const fancyBotName = `ᴊᴜɴᴇ-𝚇`;
                
                for (const url of imageUrls) {
                    try {
                        await sock.sendMessage(chatId, {
                            image: { url: url },
                            caption: `📸 𝐃𝐨𝐰𝐧𝐥𝐨𝐚𝐝𝐞𝐝 𝐛𝐲 ${fancyBotName}`
                        }, { quoted: message });
                        
                        // Small delay between images to avoid rate limiting
                        await new Promise(resolve => setTimeout(resolve, 500));
                    } catch (imgError) {
                        console.error('Error sending image:', imgError);
                        // Continue sending other images even if one fails
                    }
                }
            });
        } catch (searchError) {
            console.error('Image search command error:', searchError);
            await sock.sendMessage(chatId, {
                text: '❌ An error occurred while searching for images. Please try again.'
            });
        }

    } catch (error) {
        console.error('Image command error:', error);
        await sock.sendMessage(chatId, {
            text: '❌ An unexpected error occurred. Please try again.'
        });
    }
}

module.exports = imageCommand;
