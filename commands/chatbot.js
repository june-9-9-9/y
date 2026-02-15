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
        isOwner: message.key?.fromMe || false, // Simple owner check using fromMe
        senderId: message.key?.participant || message.key?.remoteJid,
        chatId: from,
        message: message,
        quoted: getQuotedMessage(),
        client: client
    };
}

/**
 * Handle chatbot configuration commands
 */
async function handleChatbotCommand(sock, chatId, message) {
    try {
        // Create context object
        const conText = createContext(message, sock, chatId);
        const { reply, q, isOwner } = conText;

        // Simple owner check using fromMe
        if (!isOwner) {
            return await reply("❌ *Owner Only Command!*\n\nThis command is only for the bot owner.");
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

            return await reply(
                `*🤖 Chatbot Settings*\n\n` +
                `🔹 *Status:* ${statusMap[chatbotSettings.status]}\n` +
                `🔹 *Mode:* ${modeMap[chatbotSettings.mode]}\n` +
                `🔹 *Trigger:* ${triggerMap[chatbotSettings.trigger]}\n` +
                `🔹 *Default Response:* 📝 ${chatbotSettings.default_response}\n` +
                `🔹 *Voice:* 🎵 ${chatbotSettings.voice}\n\n` +
                `*Commands:*\n` +
                `▸ chatbot on/off\n` +
                `▸ chatbot mode private/group/both\n` +
                `▸ chatbot trigger dm/all\n` +
                `▸ chatbot response text/audio\n` +
                `▸ chatbot voice <name>\n` +
                `▸ chatbot voices\n` +
                `▸ chatbot clear\n` +
                `▸ chatbot status`
            );
        }

        switch (subcommand) {
            case 'on':
            case 'off':
                chatbotSettings.status = subcommand;
                return await reply(`✅ Chatbot turned *${subcommand.toUpperCase()}*`);

            case 'mode':
                if (!['private', 'group', 'both'].includes(value)) {
                    return await reply("❌ Invalid mode! Use: private, group, or both");
                }
                chatbotSettings.mode = value;
                return await reply(`✅ Chatbot mode set to *${value.toUpperCase()}*`);

            case 'trigger':
                if (!['dm', 'all'].includes(value)) {
                    return await reply("❌ Invalid trigger! Use: dm or all");
                }
                chatbotSettings.trigger = value;
                return await reply(`✅ Chatbot trigger set to *${value.toUpperCase()}*`);

            case 'response':
                if (!['text', 'audio'].includes(value)) {
                    return await reply("❌ Invalid response type! Use: text or audio");
                }
                chatbotSettings.default_response = value;
                return await reply(`✅ Default response set to *${value.toUpperCase()}*`);

            case 'voice':
                if (!availableVoices.includes(value)) {
                    return await reply(`❌ Invalid voice! Available voices:\n${availableVoices.join(', ')}`);
                }
                chatbotSettings.voice = value;
                return await reply(`✅ Voice set to *${value}*`);

            case 'voices':
                return await reply(`*Available Voices:*\n${availableVoices.join(', ')}`);

            case 'clear':
                if (conversationHistory.delete(chatId)) {
                    return await reply("✅ Conversation history cleared!");
                }
                return await reply("❌ No history to clear!");

            case 'status':
                const history = getConversationHistory(chatId, 3);
                let historyText = '';
                if (history.length > 0) {
                    historyText = '\n\n*Recent Chats:*\n';
                    history.forEach((conv, i) => {
                        historyText += `${i+1}. You: ${conv.user}\n   AI: ${conv.ai}\n`;
                    });
                }
                
                return await reply(
                    `*Current Settings:*\n` +
                    `• Status: ${chatbotSettings.status}\n` +
                    `• Mode: ${chatbotSettings.mode}\n` +
                    `• Trigger: ${chatbotSettings.trigger}\n` +
                    `• Response: ${chatbotSettings.default_response}\n` +
                    `• Voice: ${chatbotSettings.voice}` +
                    historyText
                );

            default:
                return await reply("❌ Unknown command. Use 'chatbot' to see all commands.");
        }
    } catch (error) {
        console.error("Chatbot command error:", error);
        return await sock.sendMessage(chatId, { 
            text: `❌ Error: ${error.message}` 
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

        // Skip if no text, command, or message from self
        if (!messageText || messageText.startsWith('.') || message.key?.fromMe) return;

        // Check if chatbot is enabled
        if (chatbotSettings.status !== 'on') return;

        // Check mode (private/group/both)
        const isGroup = chatId.includes('@g.us');
        if (chatbotSettings.mode === 'private' && isGroup) return;
        if (chatbotSettings.mode === 'group' && !isGroup) return;

        // Check trigger (dm/all)
        if (chatbotSettings.trigger === 'dm') {
            const isDM = !isGroup;
            const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            const mentionedJids = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const isMentioned = mentionedJids.includes(botJid);
            
            if (!isDM && !isMentioned) return;
        }

        // Send reaction
        await sock.sendMessage(chatId, {
            react: { text: "🤖", key: message.key }
        });

        // Send typing indicator
        await sock.sendPresenceUpdate('composing', chatId);

        // Determine response type
        const lowercaseText = messageText.toLowerCase();
        let responseType = chatbotSettings.default_response;
        
        if (lowercaseText.includes('audio') || lowercaseText.includes('voice')) {
            responseType = 'audio';
        } else if (lowercaseText.includes('video')) {
            responseType = 'video';
        } else if (lowercaseText.includes('image') || lowercaseText.includes('pic')) {
            responseType = 'image';
        } else if ((lowercaseText.includes('analyze') || lowercaseText.includes('see')) && quotedMessage?.imageMessage) {
            responseType = 'vision';
        }

        // Process response
        let aiResponse = '';
        switch (responseType) {
            case 'audio':
                aiResponse = await handleAudioResponse(sock, chatId, message, messageText, chatbotSettings.voice);
                break;
            case 'video':
                aiResponse = await handleVideoResponse(sock, chatId, message, messageText);
                break;
            case 'image':
                aiResponse = await handleImageResponse(sock, chatId, message, messageText);
                break;
            case 'vision':
                aiResponse = await handleVisionResponse(sock, chatId, message, quotedMessage);
                break;
            default:
                aiResponse = await handleTextResponse(sock, chatId, message, messageText);
        }

        // Store conversation
        if (aiResponse) {
            storeConversation(chatId, messageText, aiResponse, responseType);
        }

    } catch (error) {
        console.error("Chatbot response error:", error);
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
            return response.data.result;
        }
        throw new Error("Failed to get AI response");
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

        // Get AI response
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

        // Download audio
        const timestamp = Date.now();
        const filePath = path.join(tempDir, `tts_${timestamp}.mp3`);
        
        const downloadResponse = await axios({
            method: "get",
            url: audioResponse.data.result.URL,
            responseType: "stream",
            timeout: 60000
        });

        const writer = fs.createWriteStream(filePath);
        downloadResponse.data.pipe(writer);
        await new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
        });

        // Send voice message
        await sock.sendMessage(chatId, {
            audio: { url: filePath },
            ptt: true,
            mimetype: "audio/mpeg"
        }, { quoted: message });

        // Cleanup
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        
        return aiText;

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
            { timeout: 120000 }
        );

        if (!videoResponse.data?.success || !videoResponse.data?.results) {
            throw new Error("Failed to generate video");
        }

        // Download video
        const timestamp = Date.now();
        const filePath = path.join(tempDir, `video_${timestamp}.mp4`);
        
        const downloadResponse = await axios({
            method: "get",
            url: videoResponse.data.results,
            responseType: "stream",
            timeout: 300000
        });

        const writer = fs.createWriteStream(filePath);
        downloadResponse.data.pipe(writer);
        await new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
        });

        // Send video
        await sock.sendMessage(chatId, {
            video: { url: filePath },
            caption: `🎥 ${query.substring(0, 100)}`,
            mimetype: "video/mp4"
        }, { quoted: message });

        // Cleanup
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        
        return "[Video generated]";

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

        // Download image
        const timestamp = Date.now();
        const filePath = path.join(tempDir, `image_${timestamp}.png`);
        
        const downloadResponse = await axios({
            method: "get",
            url: `https://apiskeith.vercel.app/ai/flux?q=${encodeURIComponent(query)}`,
            responseType: "stream",
            timeout: 60000
        });

        const writer = fs.createWriteStream(filePath);
        downloadResponse.data.pipe(writer);
        await new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
        });

        // Send image
        await sock.sendMessage(chatId, {
            image: { url: filePath },
            caption: `🖼️ ${query.substring(0, 100)}`
        }, { quoted: message });

        // Cleanup
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        
        return "[Image generated]";

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
            throw new Error("No image found");
        }

        await sock.sendMessage(chatId, {
            text: "🔍 Analyzing image..."
        }, { quoted: message });

        const tempDir = path.join(__dirname, "temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        // Download image
        const timestamp = Date.now();
        const filePath = path.join(tempDir, `vision_${timestamp}.jpg`);
        
        const media = await sock.downloadMediaMessage({
            key: message.message.extendedTextMessage.contextInfo.stanzaId,
            message: quotedMessage
        });

        if (!media) {
            throw new Error("Failed to download image");
        }

        fs.writeFileSync(filePath, media);

        // Analyze image
        const analysisResponse = await axios.get(
            `https://apiskeith.vercel.app/keithai?q=${encodeURIComponent("Describe this image briefly")}`,
            { timeout: 30000 }
        );

        let analysis = "Could not analyze image";
        if (analysisResponse.data?.status && analysisResponse.data?.result) {
            analysis = analysisResponse.data.result;
            await sock.sendMessage(chatId, {
                text: `🔍 *Analysis:*\n\n${analysis}`
            }, { quoted: message });
        }

        // Cleanup
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        
        return analysis;

    } catch (error) {
        throw new Error(`Vision analysis failed: ${error.message}`);
    }
}

/**
 * Helper functions for conversation history
 */
function storeConversation(chatId, userMessage, aiResponse, type) {
    if (!conversationHistory.has(chatId)) {
        conversationHistory.set(chatId, []);
    }
    
    const history = conversationHistory.get(chatId);
    history.unshift({
        user: userMessage.substring(0, 50),
        ai: aiResponse.substring(0, 50),
        type: type,
        timestamp: Date.now()
    });
    
    // Keep last 10 conversations
    if (history.length > 10) {
        history.pop();
    }
}

function getConversationHistory(chatId, limit) {
    return (conversationHistory.get(chatId) || []).slice(0, limit);
}

// Export module
module.exports = {
    handleChatbotCommand,
    handleChatbotResponse
};
