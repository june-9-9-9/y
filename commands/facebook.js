const axios = require('axios');
const fs = require('fs');
const path = require('path');

function createFakeContact(message) {
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "0@s.whatsapp.net",
            fromMe: false
        },
        message: {
            contactMessage: {
                displayName: "🄹 🅄 🄽 🄴   🅇",
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:DAVE-X\nitem1.TEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nitem1.X-ABLabel:Phone\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

async function facebookCommand(sock, chatId, message) {
    let tempFile = null;

    try {
        const fake = createFakeContact(message);

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const url = text.split(' ').slice(1).join(' ').trim();

        console.log('Facebook Command - Input URL:', url);

        if (!url) {
            return await sock.sendMessage(chatId, { 
                text: "Please provide a Facebook video URL."
            }, { quoted: fake });
        }

        // Validate Facebook URL
        const facebookPatterns = [
            'facebook.com',
            'fb.watch',
            'fb.com'
        ];

        const isFacebookUrl = facebookPatterns.some(pattern => url.includes(pattern));
        if (!isFacebookUrl) {
            return await sock.sendMessage(chatId, { 
                text: "Invalid Facebook video URL."
            }, { quoted: fake });
        }

        // Send loading reaction
        await sock.sendMessage(chatId, {
            react: { text: '⬇️', key: message.key }
        });

        // Use new API
        const apiUrl = `https://meta-api.zone.id/downloader/fbdlv2?url=${encodeURIComponent(url)}`;
        let apiResult;

        try {
            const response = await axios.get(apiUrl, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            apiResult = response.data;
            console.log('API response:', apiResult);
        } catch (error) {
            console.error('API call failed:', error.message);
            throw new Error('Download service unavailable');
        }

        // Extract video URL from API response
        let fbvid = null;
        let title = "";

        if (apiResult && apiResult.answer) {
            // Check for HD quality first
            if (apiResult.answer.hd) {
                fbvid = apiResult.answer.hd;
            } else if (apiResult.answer.sd) {
                fbvid = apiResult.answer.sd;
            } else if (apiResult.answer.url) {
                fbvid = apiResult.answer.url;
            }

            // Extract title if available
            if (apiResult.answer.title) {
                title = apiResult.answer.title;
            }
        }

        if (!fbvid) {
            throw new Error('Video not found or inaccessible');
        }

        console.log('Video URL found:', fbvid);

        // Try URL method first
        try {
            const caption = `${title}\n✦ ⋆ ⋅ ☆ ⋅ ⋆ ✦ ⋅ ☆ ⋅ ✦
     🄹 🅄 🄽 🄴   🅇
✦ ⋆ ⋅ ☆ ⋅ ⋆ ✦ ⋅ ☆ ⋅ ✦`;

            await sock.sendMessage(chatId, {
                video: { url: fbvid },
                mimetype: "video/mp4",
                caption: caption
            }, { quoted: fake });

            console.log('Video sent successfully');
            return;

        } catch (urlError) {
            console.error('URL method failed, trying download method:', urlError.message);

            // Fallback to download method
            const tmpDir = path.join(process.cwd(), 'tmp');
            if (!fs.existsSync(tmpDir)) {
                fs.mkdirSync(tmpDir, { recursive: true });
            }

            tempFile = path.join(tmpDir, `fb_${Date.now()}.mp4`);

            // Download the video
            const videoResponse = await axios({
                method: 'GET',
                url: fbvid,
                responseType: 'stream',
                timeout: 30000
            });

            const writer = fs.createWriteStream(tempFile);
            videoResponse.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
                setTimeout(() => reject(new Error('Download timeout')), 30000);
            });

            // Send downloaded video
            const caption = `${title}\n\n 🄹 🅄 🄽 🄴   🅇`;

            await sock.sendMessage(chatId, {
                video: fs.readFileSync(tempFile),
                mimetype: "video/mp4",
                caption: caption
            }, { quoted: fake });

            console.log('Video sent via download method');
        }

    } catch (error) {
        console.error('Facebook command error:', error.message);

        let errorMessage;

        if (error.message.includes('Please provide')) {
            errorMessage = "Please provide a Facebook video URL.";
        } else if (error.message.includes('Invalid Facebook')) {
            errorMessage = "Invalid Facebook video URL.";
        } else if (error.message.includes('Video not found')) {
            errorMessage = "Video not found or inaccessible.";
        } else if (error.message.includes('Download service')) {
            errorMessage = "Download service unavailable.";
        } else if (error.message.includes('timeout')) {
            errorMessage = "Request timeout.";
        } else {
            errorMessage = "Failed to download video.";
        }

        const fake = createFakeContact(message);
        await sock.sendMessage(chatId, { 
            text: errorMessage
        }, { quoted: fake });

    } finally {
        // Clean up temp file
        if (tempFile && fs.existsSync(tempFile)) {
            try {
                fs.unlinkSync(tempFile);
            } catch (cleanupError) {
                // Ignore cleanup errors
            }
        }
    }
}

module.exports = facebookCommand;
