const yts = require('yt-search');
const axios = require('axios');
const fetch = require('node-fetch');

// Fancy text generator for JUNE X
function applyJuneXText(text) {
    const fancyBanner = `
╔═══════════════════════╗
      J U N E   X
╚═══════════════════════╝`;

    const footer = `
✧･ﾟ: *✧･ﾟ:*  *:･ﾟ✧*:･ﾟ✧
    Powered by JUNE X
✧･ﾟ: *✧･ﾟ:*  *:･ﾟ✧*:･ﾟ✧`;

    return `${fancyBanner}\n\n${text}\n${footer}`;
}

async function imageCommand(sock, chatId, message, userMessage) {
    try {
        // Initial reaction 📸
        await sock.sendMessage(chatId, {
            react: { text: "📸", key: message.key }
        });

        const args = userMessage.split(' ').slice(1);
        const searchQuery = args.join(' ').trim();

        if (!searchQuery) {
            return await sock.sendMessage(chatId, { 
                text: applyJuneXText("What images are you looking for?") 
            }, { quoted: message });
        }

        // Try multiple APIs with fallback (using the same pattern as song command)
        const apis = [
            `https://api.mrfrankofc.gleeze.com/api/images?query=${encodeURIComponent(searchQuery)}`,
            `https://api.davidcyriltech.gleeze.com/api/images?query=${encodeURIComponent(searchQuery)}`
        ];

        let images = [];
        let usedAPI = '';

        // Try each API until we get results
        for (const apiUrl of apis) {
            try {
                const response = await axios.get(apiUrl);
                const data = response.data;

                // Handle different API response structures
                if (apiUrl.includes('mrfrankofc')) {
                    if (data.status === true && data.result && Array.isArray(data.result)) {
                        images = data.result;
                        usedAPI = 'MrFrank API';
                    } else if (data.data && Array.isArray(data.data)) {
                        images = data.data;
                        usedAPI = 'MrFrank API';
                    }
                } else if (apiUrl.includes('davidcyriltech')) {
                    if (data.success && data.results && Array.isArray(data.results)) {
                        images = data.results;
                        usedAPI = 'David Cyril API';
                    }
                }

                if (images.length > 0) break;
            } catch (apiError) {
                console.error(`API ${apiUrl} error:`, apiError.message);
                continue;
            }
        }

        if (!images || images.length === 0) {
            return await sock.sendMessage(chatId, { 
                text: applyJuneXText("No images found for your search!") 
            }, { quoted: message });
        }

        // Send status message with JUNE X styling
        await sock.sendMessage(chatId, { 
            text: applyJuneXText(`_🔍 Searching images for:_\n_*"${searchQuery}"*_`)
        });

        // Limit to first 5 images
        const imagesToSend = images.slice(0, 5);
        let sentCount = 0;

        // Send each image with JUNE X text
        for (const image of imagesToSend) {
            try {
                let imageUrl = '';
                
                // Extract URL from different response formats
                if (typeof image === 'string') {
                    imageUrl = image;
                } else if (image.url) {
                    imageUrl = image.url;
                } else if (image.link) {
                    imageUrl = image.link;
                }

                if (!imageUrl) continue;

                // Apply JUNE X fancy text to caption
                const caption = applyJuneXText(
                    `🔍 *Search:* ${searchQuery}\n📸 *Source:* ${usedAPI}\n🎯 *Result:* ${sentCount + 1}/${imagesToSend.length}`
                );

                // Fetch image and convert to buffer (similar to song command)
                let imageBuffer = null;
                try {
                    const imageResponse = await fetch(imageUrl);
                    imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
                } catch (err) {
                    console.error("Image fetch failed:", err);
                }

                // Send the image with JUNE X caption
                await sock.sendMessage(chatId, {
                    image: { url: imageUrl },
                    mimetype: "image/jpeg",
                    caption: caption
                }, { quoted: message });

                sentCount++;
                
                // Small delay between sending images
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (imageError) {
                console.error('Error sending image:', imageError);
            }
        }

        // Send summary with JUNE X styling
        if (sentCount > 0) {
            await sock.sendMessage(chatId, { 
                text: applyJuneXText(
                    `✅ *Successfully sent:* ${sentCount} images\n📸 *Total found:* ${images.length} images\n✨ *Powered by JUNE X*`
                )
            });
        }

        // Success reaction 
        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } catch (error) {
        console.error('Error in imageCommand:', error);
        await sock.sendMessage(chatId, { 
            text: applyJuneXText("Image search failed. Please try again later.") 
        }, { quoted: message });
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
    }
}

module.exports = imageCommand;
