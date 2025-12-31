const axios = require('axios');

async function fetchCommand(sock, chatId, message) {
    try {
        // Initial reaction
        await sock.sendMessage(chatId, {
            react: { text: "🔍", key: message.key }
        });

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const url = text.split(' ').slice(1).join(' ').trim();

        if (!url) {
            return await sock.sendMessage(chatId, { 
                text: "❌ Please provide a valid URL to fetch." 
            }, { quoted: message });
        }

        // Fetch content from URL
        const response = await axios.get(url, { 
            responseType: 'arraybuffer',
            timeout: 30000
        });
        
        const contentType = response.headers['content-type'];
        if (!contentType) {
            return await sock.sendMessage(chatId, { 
                text: "❌ Server did not return a content-type." 
            }, { quoted: message });
        }

        const buffer = Buffer.from(response.data);
        const filename = url.split('/').pop() || "file";

        // Handle different content types
        if (contentType.includes('application/json')) {
            const json = JSON.parse(buffer.toString());
            return await sock.sendMessage(chatId, { 
                text: "```json\n" + JSON.stringify(json, null, 2).slice(0, 4000) + "\n```" 
            }, { quoted: message });
        }

        if (contentType.includes('text/html')) {
            const html = buffer.toString();
            return await sock.sendMessage(chatId, { 
                text: html.slice(0, 4000) 
            }, { quoted: message });
        }

        if (contentType.includes('text/')) {
            return await sock.sendMessage(chatId, { 
                text: buffer.toString().slice(0, 4000) 
            }, { quoted: message });
        }

        if (contentType.includes('image')) {
            return await sock.sendMessage(chatId, { 
                image: buffer,
                caption: url 
            }, { quoted: message });
        }

        if (contentType.includes('video')) {
            return await sock.sendMessage(chatId, { 
                video: buffer,
                caption: url 
            }, { quoted: message });
        }

        if (contentType.includes('audio')) {
            return await sock.sendMessage(chatId, {
                audio: buffer,
                mimetype: "audio/mpeg",
                fileName: filename
            }, { quoted: message });
        }

        if (contentType.includes('application/pdf')) {
            return await sock.sendMessage(chatId, {
                document: buffer,
                mimetype: "application/pdf",
                fileName: filename
            }, { quoted: message });
        }

        if (contentType.includes('application')) {
            return await sock.sendMessage(chatId, {
                document: buffer,
                mimetype: contentType,
                fileName: filename
            }, { quoted: message });
        }

        // If no specific type matched
        await sock.sendMessage(chatId, { 
            text: "❌ Unsupported or unknown content type." 
        }, { quoted: message });

        // Error reaction
        await sock.sendMessage(chatId, { 
            react: { text: '❌', key: message.key } 
        });

    } catch (error) {
        console.error('Error in fetchCommand:', error);
        await sock.sendMessage(chatId, { 
            text: "❌ Failed to fetch the URL. Please check the URL and try again." 
        }, { quoted: message });
        await sock.sendMessage(chatId, { 
            react: { text: '❌', key: message.key } 
        });
    }
}

module.exports = fetchCommand;
