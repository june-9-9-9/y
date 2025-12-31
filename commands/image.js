const gis = require('g-i-s');

function gisSearch(query) {
    return new Promise((resolve, reject) => {
        gis(query, (error, results) => {
            if (error) return reject(error);
            resolve(results);
        });
    });
}

async function imageCommand(sock, chatId, message) {
    try {
        // Initial reaction 📷
        await sock.sendMessage(chatId, {
            react: { text: "📷", key: message.key }
        });

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const searchQuery = text.split(' ').slice(1).join(' ').trim();

        if (!searchQuery) {
            return await sock.sendMessage(chatId, { 
                text: `📷 *Image Search Command*\n\nUsage:\n.image <search_query>\n\nExample:\n.image cat\n.image beautiful sunset\n.image anime characters`
            }, { quoted: message });
        }

        // Search for images
        const results = await gisSearch(searchQuery);

        if (!results || results.length === 0) {
            return await sock.sendMessage(chatId, { 
                text: `❌ No images found for "${searchQuery}"` 
            }, { quoted: message });
        }

        const imageUrls = results
            .map(r => r.url)
            .filter(url => url && (url.endsWith('.jpg') || url.endsWith('.png')))
            .slice(0, 5);

        if (imageUrls.length === 0) {
            return await sock.sendMessage(chatId, { 
                text: `❌ No valid images found for "${searchQuery}"` 
            }, { quoted: message });
        }

        // Send status message
        await sock.sendMessage(chatId, { 
            text: `🔍 _Found images for:_\n_*${searchQuery}*_` 
        });

        const fancyBotName = `ᴊᴜɴᴇ-𝚇`;

        // Send each image
        for (const url of imageUrls) {
            try {
                await sock.sendMessage(chatId, {
                    image: { url },
                    caption: `📸 𝐃𝐨𝐰𝐧𝐥𝐨𝐚𝐝𝐞𝐝 𝐛𝐲 ${fancyBotName}`,
                    mimetype: "image/jpeg"
                }, { quoted: message });

                // Small delay between sends
                await new Promise(res => setTimeout(res, 500));
            } catch (err) {
                console.error('Error sending image:', err);
                continue; // Continue with next image if one fails
            }
        }

        // Success reaction 
        await sock.sendMessage(chatId, { 
            react: { text: '✅', key: message.key } 
        });

    } catch (error) {
        console.error('Error in imageCommand:', error);
        await sock.sendMessage(chatId, { 
            text: "Failed to search images. Please try again later." 
        }, { quoted: message });
        await sock.sendMessage(chatId, { 
            react: { text: '❌', key: message.key } 
        });
    }
}

module.exports = imageCommand;
