const axios = require('axios');

async function inspectCommand(sock, chatId, senderId, message, userMessage) {
    try {
        const args = userMessage.split(' ').slice(1);
        const url = args.join(' ').trim();

        if (!url) {
            return await sock.sendMessage(chatId, {
                text: `Usage:\n.inspect <url>\nExample:\n.inspect https://example.com\n\nAliases: fetch, get, curl`
            });
        }

        if (!/^https?:\/\//i.test(url)) {
            return await sock.sendMessage(chatId, { text: '❌ URL must start with http:// or https://' });
        }

        // React to show progress
        await sock.sendMessage(chatId, { react: { text: "⏳", key: message.key } });

        let response;
        try {
            response = await axios.get(url, { 
                responseType: 'arraybuffer',
                timeout: 10000, // 10 second timeout
                validateStatus: function (status) {
                    return status >= 200 && status < 500; // Accept all 2xx-4xx responses
                }
            });
        } catch (err) {
            console.error('Fetch error:', err);
            await sock.sendMessage(chatId, { react: { text: "❌", key: message.key } });
            return await sock.sendMessage(chatId, { 
                text: `❌ Failed to fetch URL: ${err.message || 'Unknown error'}` 
            });
        }

        // Check if response data exists
        if (!response || !response.data) {
            await sock.sendMessage(chatId, { react: { text: "❌", key: message.key } });
            return await sock.sendMessage(chatId, { 
                text: `❌ No data received from the URL (empty response)` 
            });
        }

        const contentType = response.headers['content-type'] || 'unknown';
        console.log("Content-Type:", contentType, "Data size:", response.data.length || 0);

        // Create buffer safely
        let buffer;
        try {
            // Check if response.data is valid before creating buffer
            if (response.data === null || response.data === undefined) {
                throw new Error('Response data is null');
            }
            
            // If response.data is already a Buffer, use it directly
            if (Buffer.isBuffer(response.data)) {
                buffer = response.data;
            } 
            // If it's an ArrayBuffer or Array-like
            else if (ArrayBuffer.isView(response.data) || response.data instanceof ArrayBuffer) {
                buffer = Buffer.from(response.data);
            }
            // If it's a string
            else if (typeof response.data === 'string') {
                buffer = Buffer.from(response.data);
            }
            // If it's an object (shouldn't happen with arraybuffer responseType)
            else if (typeof response.data === 'object') {
                buffer = Buffer.from(JSON.stringify(response.data));
            }
            else {
                // Try to convert whatever it is to string first
                buffer = Buffer.from(String(response.data));
            }
        } catch (bufferError) {
            console.error('Buffer creation error:', bufferError);
            await sock.sendMessage(chatId, { react: { text: "❌", key: message.key } });
            return await sock.sendMessage(chatId, { 
                text: `❌ Failed to process response data: ${bufferError.message}` 
            });
        }

        // Check if buffer is valid and has content
        if (!buffer || buffer.length === 0) {
            await sock.sendMessage(chatId, { react: { text: "❌", key: message.key } });
            return await sock.sendMessage(chatId, { 
                text: `❌ Empty response received from URL` 
            });
        }

        const filename = url.split('/').pop() || "file";

        // Handle different content types
        try {
            if (contentType.includes('application/json')) {
                try {
                    const json = JSON.parse(buffer.toString());
                    await sock.sendMessage(chatId, { 
                        text: "```json\n" + JSON.stringify(json, null, 2).slice(0, 4000) + "\n```" 
                    }, { quoted: message });
                } catch (parseError) {
                    await sock.sendMessage(chatId, { 
                        text: `⚠️ Invalid JSON received:\n${buffer.toString().slice(0, 4000)}` 
                    }, { quoted: message });
                }
            } 
            else if (contentType.includes('text/html')) {
                await sock.sendMessage(chatId, { 
                    text: buffer.toString().slice(0, 4000) 
                }, { quoted: message });
            }
            else if (contentType.includes('image')) {
                await sock.sendMessage(chatId, { 
                    image: buffer, 
                    caption: `📸 Fetched from: ${url}` 
                }, { quoted: message });
            }
            else if (contentType.includes('video')) {
                await sock.sendMessage(chatId, { 
                    video: buffer, 
                    caption: `🎬 Fetched from: ${url}` 
                }, { quoted: message });
            }
            else if (contentType.includes('audio')) {
                await sock.sendMessage(chatId, {
                    audio: buffer,
                    mimetype: contentType || "audio/mpeg",
                    fileName: filename,
                    caption: `🎵 Fetched from: ${url}`
                }, { quoted: message });
            }
            else if (contentType.includes('application/pdf')) {
                await sock.sendMessage(chatId, {
                    document: buffer,
                    mimetype: "application/pdf",
                    fileName: filename,
                    caption: `📄 Fetched from: ${url}`
                }, { quoted: message });
            }
            else if (contentType.includes('application/')) {
                await sock.sendMessage(chatId, {
                    document: buffer,
                    mimetype: contentType,
                    fileName: filename,
                    caption: `📎 Fetched from: ${url}`
                }, { quoted: message });
            }
            else if (contentType.includes('text/')) {
                await sock.sendMessage(chatId, { 
                    text: buffer.toString().slice(0, 4000) 
                }, { quoted: message });
            }
            else {
                // Try to send as text if it's text-like
                const textContent = buffer.toString();
                if (textContent.length > 0 && textContent.length < 10000) {
                    await sock.sendMessage(chatId, { 
                        text: `❓ Unknown content type: ${contentType}\n\nData:\n${textContent.slice(0, 4000)}` 
                    }, { quoted: message });
                } else {
                    // Send as document if too large or binary
                    await sock.sendMessage(chatId, {
                        document: buffer,
                        fileName: filename,
                        caption: `📎 Fetched from: ${url}\nContent-Type: ${contentType}`
                    }, { quoted: message });
                }
            }

            // Success reaction
            await sock.sendMessage(chatId, { react: { text: "✅", key: message.key } });

        } catch (sendError) {
            console.error('Send message error:', sendError);
            await sock.sendMessage(chatId, { react: { text: "❌", key: message.key } });
            await sock.sendMessage(chatId, { 
                text: `❌ Failed to send content: ${sendError.message}` 
            });
        }

    } catch (error) {
        console.error('Inspect command error:', error);
        await sock.sendMessage(chatId, { react: { text: "❌", key: message.key } });
        await sock.sendMessage(chatId, { 
            text: `❌ Error: ${error.message || 'Unknown error occurred'}` 
        });
    }
}

module.exports = inspectCommand;
