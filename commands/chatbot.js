const fs = require("fs");
const axios = require("axios");
const path = require("path");

// In-memory storage for settings and conversation history
let chatbotSettings = {
    status: 'on',
    mode: 'both',
    trigger: 'dm',
    default_response: 'text',
    voice: 'nova'
};

let conversationHistory = new Map();
const availableVoices = ['nova', 'alloy', 'echo', 'fable', 'onyx', 'shimmer'];

/**
 * Create context object from message and client
 */
function createContext(message, client, from) {
    const getMessageContent = () => {
        if (message.message?.conversation) {
            return message.message.conversation;
        } else if (message.message?.extendedTextMessage?.text) {
            return message.message.extendedTextMessage.text;
        } else if (message.message?.imageMessage?.caption) {
            return message.message.imageMessage.caption;
        } else if (message.message?.videoMessage?.caption) {
            return message.message.videoMessage.caption;
        }
        return '';
    };

    const getQuotedMessage = () => {
        const contextInfo = message.message?.extendedTextMessage?.contextInfo;
        if (contextInfo?.quotedMessage) {
            return contextInfo.quotedMessage;
        }
        return null;
    };

    const text = getMessageContent();
    
    // Extract command and query
    const parts = text.split(" ");
    const command = parts[0]?.toLowerCase() || '';
    const q = parts.slice(1).join(" ").trim();

    return {
        reply: async (text) => {
            return await client.sendMessage(from, { text }, { quoted: message });
        },
        sendMessage: async (content) => {
            return await client.sendMessage(from, content, { quoted: message });
        },
        q: q,
        command: command,
        isSuperUser: checkIfSuperUser(message, client), // You'll need to implement this
        senderId: message.key?.participant || message.key?.remoteJid,
        chatId: from,
        message: message,
        quoted: getQuotedMessage(),
        client: client
    };
}

/**
 * Check if user is super user (implement based on your needs)
 */
function checkIfSuperUser(message, client) {
    // Implement your super user logic here
    // Example: Check if sender is in owner list
    const sender = message.key?.participant || message.key?.remoteJid;
    const ownerNumbers = ['234XXXXXXXXXX', '123XXXXXXXXXX']; // Add your owner numbers
    
    // Extract phone number from JID
    const senderNumber = sender?.split('@')[0];
    return ownerNumbers.includes(senderNumber);
}

/**
 * Handle chatbot configuration commands
 */
async function handleChatbotCommand(sock, chatId, message) {
    try {
        // Create context object
        const conText = createContext(message, sock, chatId);
        const { reply, q, isSuperUser } = conText;

        if (!isSuperUser) {
            return await reply("❌ Owner Only Command!");
        }

        const args = q?.trim().split(/\s+/) || [];
        const subcommand = args[0]?.toLowerCase();
        const value = args.slice(1).join(" ");

        if (!subcommand) {
            const statusMap = {
                'on': '✅ ON',
                'off': '❌ OFF'
            };

            const modeMap = {
                'private': '🔒 Private Only',
                'group': '👥 Group Only',
                'both': '🌐 Both'
            };

            const triggerMap = {
                'dm': '📨 DM Trigger',
                'all': '🔊 All Messages'
            };

            const responseMap = {
                'text': '📝 Text',
                'audio': '🎵 Audio'
            };

            return await reply(
                `*🤖 Chatbot Settings*\n\n` +
                `🔹 *Status:* ${statusMap[chatbotSettings.status]}\n` +
                `🔹 *Mode:* ${modeMap[chatbotSettings.mode]}\n` +
                `🔹 *Trigger:* ${triggerMap[chatbotSettings.trigger]}\n` +
                `🔹 *Default Response:* ${responseMap[chatbotSettings.default_response]}\n` +
                `🔹 *Voice:* ${chatbotSettings.voice}\n\n` +
                `*🎯 Response Types:*\n` +
                `▸ *Text* - Normal AI conversation\n` +
                `▸ *Audio* - Add "audio" to get voice response\n` +
                `▸ *Video* - Add "video" to generate videos\n` +
                `▸ *Image* - Add "image" to generate images\n` +
                `▸ *Vision* - Send image + "analyze this"\n\n` +
                `*Usage Examples:*\n` +
                `▸ @bot hello how are you? (Text)\n` +
                `▸ @bot audio tell me a story (Audio response)\n` +
                `▸ @bot video a cat running (Video generation)\n` +
                `▸ @bot image a beautiful sunset (Image generation)\n` +
                `▸ [Send image] "analyze this" (Vision analysis)\n\n` +
                `*Commands:*\n` +
                `▸ chatbot on/off\n` +
                `▸ chatbot mode private/group/both\n` +
                `▸ chatbot trigger dm/all\n` +
                `▸ chatbot response text/audio\n` +
                `▸ chatbot voice <name>\n` +
                `▸ chatbot voices\n` +
                `▸ chatbot clear\n` +
                `▸ chatbot status\n` +
                `▸ chatbot test <type> <message>`
            );
        }

        switch (subcommand) {
            case 'on':
            case 'off':
                chatbotSettings.status = subcommand;
                return await reply(`✅ Chatbot: *${subcommand.toUpperCase()}*`);

            case 'mode':
                if (!['private', 'group', 'both'].includes(value)) {
                    return await reply("❌ Invalid mode! Use: private, group, or both");
                }
                chatbotSettings.mode = value;
                return await reply(`✅ Chatbot mode: *${value.toUpperCase()}*`);

            case 'trigger':
                if (!['dm', 'all'].includes(value)) {
                    return await reply("❌ Invalid trigger! Use: dm or all");
                }
                chatbotSettings.trigger = value;
                return await reply(`✅ Chatbot trigger: *${value.toUpperCase()}*`);

            case 'response':
                if (!['text', 'audio'].includes(value)) {
                    return await reply("❌ Invalid response type! Use: text or audio");
                }
                chatbotSettings.default_response = value;
                return await reply(`✅ Default response: *${value.toUpperCase()}*`);

            case 'voice':
                if (!availableVoices.includes(value)) {
                    return await reply(`❌ Invalid voice! Available voices:\n${availableVoices.join(', ')}`);
                }
                chatbotSettings.voice = value;
                return await reply(`✅ Voice set to: *${value}*`);

            case 'voices':
                return await reply(`*🎙️ Available Voices:*\n\n${availableVoices.join(', ')}`);

            case 'clear':
                if (conversationHistory.delete(chatId)) {
                    return await reply("✅ Chatbot conversation history cleared!");
                } else {
                    return await reply("❌ No conversation history to clear!");
                }

            case 'status':
                const history = getConversationHistory(chatId, 5);
                if (history.length === 0) {
                    return await reply("📝 No recent conversations found.");
                }
                
                let historyText = `*📚 Recent Conversations (${history.length})*\n\n`;
                history.forEach((conv, index) => {
                    const typeIcon = getTypeIcon(conv.type);
                    historyText += `*${index + 1}. ${typeIcon} You:* ${conv.user}\n`;
                    historyText += `   *AI:* ${conv.type === 'audio' ? '[Voice Message]' : conv.ai}\n\n`;
                });
                
                return await reply(historyText);

            case 'test':
                return await handleTestCommand(sock, chatId, message, value, chatbotSettings.voice);

            default:
                return await reply(
                    "❌ Invalid command!\n\n" +
                    `▸ chatbot on/off\n` +
                    `▸ chatbot mode private/group/both\n` +
                    `▸ chatbot trigger dm/all\n` +
                    `▸ chatbot response text/audio\n` +
                    `▸ chatbot voice <name>\n` +
                    `▸ chatbot voices\n` +
                    `▸ chatbot clear\n` +
                    `▸ chatbot status\n` +
                    `▸ chatbot test <text/audio/video/image> <message>`
                );
        }
    } catch (error) {
        console.error("Chatbot command error:", error);
        return await sock.sendMessage(chatId, {
            text: `🚫 Error: ${error.message}`
        }, { quoted: message });
    }
}

/**
 * Handle automatic chatbot responses to messages
 */
async function handleChatbotResponse(sock, chatId, message) {
    try {
        // Extract message content
        let messageText = '';
        let quotedMessage = null;
        
        if (message.message?.conversation) {
            messageText = message.message.conversation;
        } else if (message.message?.extendedTextMessage?.text) {
            messageText = message.message.extendedTextMessage.text;
            quotedMessage = message.message.extendedTextMessage.contextInfo?.quotedMessage;
        } else if (message.message?.imageMessage?.caption) {
            messageText = message.message.imageMessage.caption;
        } else if (message.message?.videoMessage?.caption) {
            messageText = message.message.videoMessage.caption;
        }

        // Skip if no text or if it's a command
        if (!messageText || messageText.startsWith('.')) return;

        // Determine if in group or private
        const isGroup = chatId.includes('@g.us');
        const senderId = message.key?.participant || message.key?.remoteJid;

        // Check if chatbot is enabled
        if (chatbotSettings.status !== 'on') return;

        // Check mode
        if (chatbotSettings.mode === 'private' && isGroup) return;
        if (chatbotSettings.mode === 'group' && !isGroup) return;

        // Check trigger
        if (chatbotSettings.trigger === 'dm') {
            const isDM = !isGroup;
            const isMentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.includes(sock.user.id?.split(':')[0] + '@s.whatsapp.net');
            
            if (!isDM && !isMentioned) return;
        }

        // Send reaction to show processing
        await sock.sendMessage(chatId, {
            react: { text: "🤖", key: message.key }
        });

        // Determine response type
        let responseType = chatbotSettings.default_response;
        const lowercaseText = messageText?.toLowerCase() || '';
        
        if (lowercaseText.includes('audio') || lowercaseText.includes('voice')) {
            responseType = 'audio';
        } else if (lowercaseText.includes('video')) {
            responseType = 'video';
        } else if (lowercaseText.includes('image') || lowercaseText.includes('pic') || lowercaseText.includes('generate')) {
            responseType = 'image';
        } else if ((lowercaseText.includes('analyze') || lowercaseText.includes('what')) && quotedMessage?.imageMessage) {
            responseType = 'vision';
        }

        // Send typing indicator
        await sock.sendPresenceUpdate('composing', chatId);

        // Process based on response type
        switch (responseType) {
            case 'audio':
                await handleAudioResponse(sock, chatId, message, messageText, chatbotSettings.voice);
                break;
            case 'video':
                await handleVideoResponse(sock, chatId, message, messageText);
                break;
            case 'image':
                await handleImageResponse(sock, chatId, message, messageText);
                break;
            case 'vision':
                await handleVisionResponse(sock, chatId, message, quotedMessage);
                break;
            default:
                await handleTextResponse(sock, chatId, message, messageText);
        }

        // Store conversation history
        storeConversation(chatId, messageText, 'AI Response', responseType);

    } catch (error) {
        console.error("Chatbot response error:", error);
        await sock.sendMessage(chatId, {
            text: `🤖 Chatbot error: ${error.message}`
        }, { quoted: message });
    }
}

/**
 * Helper function to handle text responses
 */
async function handleTextResponse(sock, chatId, message, query) {
    try {
        const response = await axios.get(`https://apiskeith.vercel.app/keithai?q=${encodeURIComponent(query)}`, {
            timeout: 30000
        });

        if (response.data?.status && response.data?.result) {
            await sock.sendMessage(chatId, {
                text: response.data.result
            }, { quoted: message });
        } else {
            throw new Error("Failed to get AI response");
        }
    } catch (error) {
        throw new Error(`Text response failed: ${error.message}`);
    }
}

/**
 * Helper function to handle audio responses
 */
async function handleAudioResponse(sock, chatId, message, query, voice) {
    try {
        const tempDir = path.join(__dirname, "temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        // Get AI response first
        const textResponse = await axios.get(`https://apiskeith.vercel.app/keithai?q=${encodeURIComponent(query)}`, {
            timeout: 30000
        });

        if (!textResponse.data?.status || !textResponse.data?.result) {
            throw new Error("Failed to get AI response");
        }

        const aiText = textResponse.data.result;

        // Convert to speech
        const audioResponse = await axios.get(
            `https://apiskeith.vercel.app/ai/text2speech?q=${encodeURIComponent(aiText)}&voice=${voice}`,
            { timeout: 30000 }
        );

        if (!audioResponse.data?.status || !audioResponse.data?.result?.URL) {
            throw new Error("Failed to generate audio");
        }

        const timestamp = Date.now();
        const fileName = `tts_${timestamp}.mp3`;
        const filePath = path.join(tempDir, fileName);

        // Download audio
        const downloadResponse = await axios({
            method: "get",
            url: audioResponse.data.result.URL,
            responseType: "stream",
            timeout: 60000,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const writer = fs.createWriteStream(filePath);
        downloadResponse.data.pipe(writer);
        await new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
        });

        if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
            throw new Error("Download failed or empty file!");
        }

        // Send as voice message
        await sock.sendMessage(chatId, {
            audio: { url: filePath },
            ptt: true, // Send as voice note
            mimetype: "audio/mpeg"
        }, { quoted: message });

        // Cleanup
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    } catch (error) {
        throw new Error(`Audio response failed: ${error.message}`);
    }
}

/**
 * Helper function to handle video responses
 */
async function handleVideoResponse(sock, chatId, message, query) {
    try {
        const tempDir = path.join(__dirname, "temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        const videoResponse = await axios.get(
            `https://apiskeith.vercel.app/text2video?q=${encodeURIComponent(query)}`,
            { timeout: 120000 } // 2 minutes for video generation
        );

        if (!videoResponse.data?.success || !videoResponse.data?.results) {
            throw new Error("Failed to generate video");
        }

        const timestamp = Date.now();
        const fileName = `video_${timestamp}.mp4`;
        const filePath = path.join(tempDir, fileName);

        // Download video
        const downloadResponse = await axios({
            method: "get",
            url: videoResponse.data.results,
            responseType: "stream",
            timeout: 300000, // 5 minutes for large videos
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const writer = fs.createWriteStream(filePath);
        downloadResponse.data.pipe(writer);
        await new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
        });

        if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
            throw new Error("Download failed or empty file!");
        }

        // Send video
        await sock.sendMessage(chatId, {
            video: { url: filePath },
            caption: `🎥 Generated video: ${query.substring(0, 100)}`,
            mimetype: "video/mp4"
        }, { quoted: message });

        // Cleanup
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    } catch (error) {
        throw new Error(`Video response failed: ${error.message}`);
    }
}

/**
 * Helper function to handle image responses
 */
async function handleImageResponse(sock, chatId, message, query) {
    try {
        const tempDir = path.join(__dirname, "temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        const timestamp = Date.now();
        const fileName = `image_${timestamp}.png`;
        const filePath = path.join(tempDir, fileName);

        // Download image
        const downloadResponse = await axios({
            method: "get",
            url: `https://apiskeith.vercel.app/ai/flux?q=${encodeURIComponent(query)}`,
            responseType: "stream",
            timeout: 60000,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const writer = fs.createWriteStream(filePath);
        downloadResponse.data.pipe(writer);
        await new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
        });

        if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
            throw new Error("Download failed or empty file!");
        }

        // Send image
        await sock.sendMessage(chatId, {
            image: { url: filePath },
            caption: `🖼️ Generated image: ${query.substring(0, 100)}`
        }, { quoted: message });

        // Cleanup
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    } catch (error) {
        throw new Error(`Image response failed: ${error.message}`);
    }
}

/**
 * Helper function to handle vision analysis
 */
async function handleVisionResponse(sock, chatId, message, quotedMessage) {
    try {
        if (!quotedMessage?.imageMessage) {
            throw new Error("No image found to analyze");
        }

        await sock.sendMessage(chatId, {
            text: "🔍 Analyzing image, please wait..."
        }, { quoted: message });

        // For vision analysis, we need to download the image first
        // Since we can't directly send the image to the API, we'll use a placeholder response
        // In a real implementation, you would upload the image to a temporary hosting service
        // or convert it to base64 and send to a vision API
        
        const tempDir = path.join(__dirname, "temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        const timestamp = Date.now();
        const fileName = `vision_${timestamp}.jpg`;
        const filePath = path.join(tempDir, fileName);

        // Download the quoted image
        const media = await sock.downloadMediaMessage({
            key: message.message.extendedTextMessage.contextInfo.stanzaId,
            message: quotedMessage
        });

        if (!media) {
            throw new Error("Failed to download image");
        }

        fs.writeFileSync(filePath, media);

        // For now, use a simple analysis response
        // In production, you would send the image to a vision API
        const analysisResponse = await axios.get(
            `https://apiskeith.vercel.app/keithai?q=${encodeURIComponent("Analyze this image briefly: " + filePath)}`,
            { timeout: 30000 }
        );

        if (analysisResponse.data?.status && analysisResponse.data?.result) {
            await sock.sendMessage(chatId, {
                text: `🔍 *Image Analysis:*\n\n${analysisResponse.data.result}`
            }, { quoted: message });
        } else {
            throw new Error("Failed to analyze image");
        }

        // Cleanup
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    } catch (error) {
        throw new Error(`Vision analysis failed: ${error.message}`);
    }
}

/**
 * Helper function to handle test command
 */
async function handleTestCommand(sock, chatId, message, value, voice) {
    const testArgs = value.split(' ');
    const testType = testArgs[0]?.toLowerCase();
    const testMessage = testArgs.slice(1).join(' ') || "Hello, this is a test message";

    await sock.sendMessage(chatId, {
        text: `🧪 Testing ${testType || 'text'} with: "${testMessage}"`
    }, { quoted: message });

    try {
        if (testType === 'audio') {
            await handleAudioResponse(sock, chatId, message, testMessage, voice);
        } else if (testType === 'video') {
            await handleVideoResponse(sock, chatId, message, testMessage);
        } else if (testType === 'image') {
            await handleImageResponse(sock, chatId, message, testMessage);
        } else {
            await handleTextResponse(sock, chatId, message, testMessage);
        }

        return await sock.sendMessage(chatId, {
            text: "✅ Test completed!"
        }, { quoted: message });
    } catch (error) {
        return await sock.sendMessage(chatId, {
            text: `❌ Test failed: ${error.message}`
        }, { quoted: message });
    }
}

/**
 * Helper function to store conversation history
 */
function storeConversation(chatId, userMessage, aiResponse, type = 'text') {
    if (!conversationHistory.has(chatId)) {
        conversationHistory.set(chatId, []);
    }
    
    const history = conversationHistory.get(chatId);
    history.unshift({
        user: userMessage.substring(0, 100),
        ai: aiResponse.substring(0, 100),
        type: type,
        timestamp: Date.now()
    });
    
    // Keep only last 20 conversations
    if (history.length > 20) {
        history.pop();
    }
}

/**
 * Helper function to get conversation history
 */
function getConversationHistory(chatId, limit = 10) {
    const history = conversationHistory.get(chatId) || [];
    return history.slice(0, limit);
}

/**
 * Helper function to get type icon
 */
function getTypeIcon(type) {
    const icons = {
        'text': '📝',
        'audio': '🎵',
        'video': '🎥',
        'image': '🖼️',
        'vision': '🔍'
    };
    return icons[type] || '📝';
}

// Export the module
module.exports = {
    handleChatbotCommand,
    handleChatbotResponse
};
