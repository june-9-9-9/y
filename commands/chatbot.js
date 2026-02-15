const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const axios = require('axios');

const USER_GROUP_DATA = path.join(__dirname, '../data/userGroupData.json');
const CHATBOT_SETTINGS = path.join(__dirname, '../data/chatbotSettings.json');
const CONVERSATION_HISTORY = path.join(__dirname, '../data/conversations.json');

// Available voices for text-to-speech
const availableVoices = [
  'african', 'american', 'arabic', 'australian', 'bangla', 'bengali', 'british',
  'canadian', 'chinese', 'default', 'dutch', 'english', 'filipino', 'french',
  'german', 'gujarati', 'haryanvi', 'hindi', 'indian', 'indonesian', 'irish',
  'italian', 'japanese', 'kannada', 'korean', 'malayalam', 'mexican', 'odia',
  'portuguese', 'rajasthani', 'russian', 'sanskrit', 'spanish', 'tamil', 'telugu',
  'turkish', 'urdu'
];

// Load user group data
function loadUserGroupData() {
    try {
        return JSON.parse(fs.readFileSync(USER_GROUP_DATA));
    } catch (error) {
        console.error('❌ Error loading user group data:', error.message);
        return { groups: [], chatbot: {} };
    }
}

// Save user group data
function saveUserGroupData(data) {
    try {
        fs.writeFileSync(USER_GROUP_DATA, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('❌ Error saving user group data:', error.message);
    }
}

// Load chatbot settings
function getChatbotSettings() {
    try {
        return JSON.parse(fs.readFileSync(CHATBOT_SETTINGS));
    } catch (error) {
        // Default settings
        const defaultSettings = {
            status: 'off',
            mode: 'both',
            trigger: 'dm',
            default_response: 'text',
            voice: 'default'
        };
        saveChatbotSettings(defaultSettings);
        return defaultSettings;
    }
}

// Save chatbot settings
function saveChatbotSettings(settings) {
    try {
        fs.writeFileSync(CHATBOT_SETTINGS, JSON.stringify(settings, null, 2));
    } catch (error) {
        console.error('❌ Error saving chatbot settings:', error.message);
    }
}

// Update chatbot settings
async function updateChatbotSettings(updates) {
    const settings = getChatbotSettings();
    Object.assign(settings, updates);
    saveChatbotSettings(settings);
    return settings;
}

// Load conversation history
function loadConversations() {
    try {
        return JSON.parse(fs.readFileSync(CONVERSATION_HISTORY));
    } catch (error) {
        return {};
    }
}

// Save conversation history
function saveConversations(conversations) {
    try {
        fs.writeFileSync(CONVERSATION_HISTORY, JSON.stringify(conversations, null, 2));
    } catch (error) {
        console.error('❌ Error saving conversations:', error.message);
    }
}

// Get conversation history for a user
async function getConversationHistory(userId, limit = 10) {
    const conversations = loadConversations();
    const userConvs = conversations[userId] || [];
    return userConvs.slice(-limit);
}

// Add conversation to history
async function addConversation(userId, type, userMessage, aiResponse) {
    const conversations = loadConversations();
    if (!conversations[userId]) {
        conversations[userId] = [];
    }
    
    conversations[userId].push({
        type,
        user: userMessage,
        ai: aiResponse,
        timestamp: new Date().toISOString()
    });
    
    // Keep only last 50 conversations per user
    if (conversations[userId].length > 50) {
        conversations[userId] = conversations[userId].slice(-50);
    }
    
    saveConversations(conversations);
}

// Clear conversation history for a user
async function clearConversationHistory(userId) {
    const conversations = loadConversations();
    if (conversations[userId]) {
        delete conversations[userId];
        saveConversations(conversations);
        return true;
    }
    return false;
}

// Download media from URL
async function downloadMedia(url) {
    try {
        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'arraybuffer'
        });
        return Buffer.from(response.data, 'binary');
    } catch (error) {
        console.error('❌ Error downloading media:', error.message);
        return null;
    }
}

// Get type icon for display
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

// Add random delay between 2-5 seconds
function getRandomDelay() {
    return Math.floor(Math.random() * 3000) + 2000;
}

// Add typing indicator
async function showTyping(sock, chatId) {
    try {
        await sock.presenceSubscribe(chatId);
        await sock.sendPresenceUpdate('composing', chatId);
        await new Promise(resolve => setTimeout(resolve, getRandomDelay()));
    } catch (error) {
        console.error('Typing indicator error:', error);
    }
}

// In-memory storage for chat history and user info
const chatMemory = {
    messages: new Map(), // Stores last 20 messages per user
    userInfo: new Map()  // Stores user information
};

// Extract user information from messages
function extractUserInfo(message) {
    const info = {};
    
    // Extract name
    if (message.toLowerCase().includes('my name is')) {
        info.name = message.split('my name is')[1].trim().split(' ')[0];
    }
    
    // Extract age
    if (message.toLowerCase().includes('i am') && message.toLowerCase().includes('years old')) {
        info.age = message.match(/\d+/)?.[0];
    }
    
    // Extract location
    if (message.toLowerCase().includes('i live in') || message.toLowerCase().includes('i am from')) {
        info.location = message.split(/(?:i live in|i am from)/i)[1].trim().split(/[.,!?]/)[0];
    }
    
    return info;
}

async function handleChatbotCommand(sock, chatId, message, match) {
    const settings = getChatbotSettings();
    const userMessage = match || '';
    const args = userMessage.trim().split(/\s+/) || [];
    const subcommand = args[0]?.toLowerCase();
    const value = args.slice(1).join(" ");

    // Get bot's number for mention check
    const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    
    // Check if sender is bot owner
    const senderId = message.key.participant || message.participant || message.pushName || message.key.remoteJid;
    const isOwner = senderId === botNumber;

    if (!isOwner) {
        await showTyping(sock, chatId);
        return sock.sendMessage(chatId, {
            text: '❌ Only the bot owner can use this command.',
            quoted: message
        });
    }

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

        await showTyping(sock, chatId);
        return sock.sendMessage(chatId, {
            text: 
                `*🤖 CHATBOT SETTINGS*\n\n` +
                `🔹 *Status:* ${statusMap[settings.status]}\n` +
                `🔹 *Mode:* ${modeMap[settings.mode]}\n` +
                `🔹 *Trigger:* ${triggerMap[settings.trigger]}\n` +
                `🔹 *Default Response:* ${responseMap[settings.default_response]}\n` +
                `🔹 *Voice:* ${settings.voice}\n\n` +
                `*🎯 RESPONSE TYPES:*\n` +
                `▸ *Text* - Normal AI conversation\n` +
                `▸ *Audio* - Add "audio" to get voice response\n` +
                `▸ *Video* - Add "video" to generate videos\n` +
                `▸ *Image* - Add "image" to generate images\n` +
                `▸ *Vision* - Send image + "analyze this"\n\n` +
                `*📝 USAGE EXAMPLES:*\n` +
                `▸ @bot hello how are you? (Text)\n` +
                `▸ @bot audio tell me a story (Audio response)\n` +
                `▸ @bot video a cat running (Video generation)\n` +
                `▸ @bot image a beautiful sunset (Image generation)\n` +
                `▸ [Send image] "analyze this" (Vision analysis)\n\n` +
                `*⚙️ COMMANDS:*\n` +
                `▸ .chatbot on/off\n` +
                `▸ .chatbot mode private/group/both\n` +
                `▸ .chatbot trigger dm/all\n` +
                `▸ .chatbot response text/audio\n` +
                `▸ .chatbot voice <name>\n` +
                `▸ .chatbot voices\n` +
                `▸ .chatbot clear\n` +
                `▸ .chatbot status\n` +
                `▸ .chatbot test <type> <message>`,
            quoted: message
        });
    }

    switch (subcommand) {
        case 'on':
        case 'off':
            await showTyping(sock, chatId);
            await updateChatbotSettings({ status: subcommand });
            
            // Also update userGroupData for backward compatibility
            const data = loadUserGroupData();
            if (subcommand === 'on') {
                data.chatbot[chatId] = true;
            } else {
                delete data.chatbot[chatId];
            }
            saveUserGroupData(data);
            
            return sock.sendMessage(chatId, {
                text: `✅ Chatbot: *${subcommand.toUpperCase()}*`,
                quoted: message
            });

        case 'mode':
            if (!['private', 'group', 'both'].includes(value)) {
                await showTyping(sock, chatId);
                return sock.sendMessage(chatId, {
                    text: "❌ Invalid mode! Use: private, group, or both",
                    quoted: message
                });
            }
            await showTyping(sock, chatId);
            await updateChatbotSettings({ mode: value });
            return sock.sendMessage(chatId, {
                text: `✅ Chatbot mode: *${value.toUpperCase()}*`,
                quoted: message
            });

        case 'trigger':
            if (!['dm', 'all'].includes(value)) {
                await showTyping(sock, chatId);
                return sock.sendMessage(chatId, {
                    text: "❌ Invalid trigger! Use: dm or all",
                    quoted: message
                });
            }
            await showTyping(sock, chatId);
            await updateChatbotSettings({ trigger: value });
            return sock.sendMessage(chatId, {
                text: `✅ Chatbot trigger: *${value.toUpperCase()}*`,
                quoted: message
            });

        case 'response':
            if (!['text', 'audio'].includes(value)) {
                await showTyping(sock, chatId);
                return sock.sendMessage(chatId, {
                    text: "❌ Invalid response type! Use: text or audio",
                    quoted: message
                });
            }
            await showTyping(sock, chatId);
            await updateChatbotSettings({ default_response: value });
            return sock.sendMessage(chatId, {
                text: `✅ Default response: *${value.toUpperCase()}*`,
                quoted: message
            });

        case 'voice':
            if (!availableVoices.includes(value)) {
                await showTyping(sock, chatId);
                return sock.sendMessage(chatId, {
                    text: `❌ Invalid voice! Available voices:\n${availableVoices.join(', ')}`,
                    quoted: message
                });
            }
            await showTyping(sock, chatId);
            await updateChatbotSettings({ voice: value });
            return sock.sendMessage(chatId, {
                text: `✅ Voice set to: *${value}*`,
                quoted: message
            });

        case 'voices':
            await showTyping(sock, chatId);
            return sock.sendMessage(chatId, {
                text: `*🎙️ AVAILABLE VOICES:*\n\n${availableVoices.join(', ')}`,
                quoted: message
            });

        case 'clear':
            await showTyping(sock, chatId);
            const cleared = await clearConversationHistory(senderId);
            if (cleared) {
                return sock.sendMessage(chatId, {
                    text: "✅ Chatbot conversation history cleared!",
                    quoted: message
                });
            } else {
                return sock.sendMessage(chatId, {
                    text: "❌ No conversation history to clear!",
                    quoted: message
                });
            }

        case 'status':
            await showTyping(sock, chatId);
            const history = await getConversationHistory(senderId, 5);
            if (history.length === 0) {
                return sock.sendMessage(chatId, {
                    text: "📝 No recent conversations found.",
                    quoted: message
                });
            }
            
            let historyText = `*📚 RECENT CONVERSATIONS (${history.length})*\n\n`;
            history.forEach((conv, index) => {
                const typeIcon = getTypeIcon(conv.type);
                historyText += `*${index + 1}. ${typeIcon} You:* ${conv.user.substring(0, 50)}${conv.user.length > 50 ? '...' : ''}\n`;
                historyText += `   *Bot:* ${conv.type === 'audio' ? '[Voice Message]' : conv.ai.substring(0, 50)}${conv.ai.length > 50 ? '...' : ''}\n\n`;
            });
            
            return sock.sendMessage(chatId, {
                text: historyText,
                quoted: message
            });

        case 'test':
            const testArgs = value.split(' ');
            const testType = testArgs[0]?.toLowerCase();
            const testMessage = testArgs.slice(1).join(' ') || "Hello, this is a test message";
            
            try {
                await showTyping(sock, chatId);
                await sock.sendMessage(chatId, {
                    text: `🧪 Testing ${testType || 'text'} with: "${testMessage}"`,
                    quoted: message
                });
                
                if (testType === 'audio') {
                    // Test audio: Get AI response first, then convert to audio
                    const textResponse = await axios.get(`https://apiskeith.vercel.app/keithai?q=${encodeURIComponent(testMessage)}`);
                    if (textResponse.data.status) {
                        const audioResponse = await axios.get(`https://apiskeith.vercel.app/ai/text2speech?q=${encodeURIComponent(textResponse.data.result)}&voice=${settings.voice}`);
                        if (audioResponse.data.status && audioResponse.data.result.URL) {
                            const audioBuffer = await downloadMedia(audioResponse.data.result.URL);
                            if (audioBuffer) {
                                await sock.sendMessage(chatId, {
                                    audio: audioBuffer,
                                    ptt: true,
                                    mimetype: 'audio/mpeg'
                                });
                            }
                        }
                    }
                } else if (testType === 'video') {
                    const videoResponse = await axios.get(`https://apiskeith.vercel.app/text2video?q=${encodeURIComponent(testMessage)}`);
                    if (videoResponse.data.success && videoResponse.data.results) {
                        const videoBuffer = await downloadMedia(videoResponse.data.results);
                        if (videoBuffer) {
                            await sock.sendMessage(chatId, {
                                video: videoBuffer,
                                caption: `🎥 Test video: ${testMessage}`
                            });
                        }
                    }
                } else if (testType === 'image') {
                    const imageBuffer = await downloadMedia(`https://apiskeith.vercel.app/ai/flux?q=${encodeURIComponent(testMessage)}`);
                    if (imageBuffer) {
                        await sock.sendMessage(chatId, {
                            image: imageBuffer,
                            caption: `🖼️ Test image: ${testMessage}`
                        });
                    }
                } else {
                    // Text test
                    const textResponse = await axios.get(`https://apiskeith.vercel.app/keithai?q=${encodeURIComponent(testMessage)}`);
                    if (textResponse.data.status) {
                        await sock.sendMessage(chatId, {
                            text: `📝 *Text Response:*\n\n${textResponse.data.result}`,
                            quoted: message
                        });
                    }
                }
                
                await sock.sendMessage(chatId, {
                    text: "✅ Test completed!",
                    quoted: message
                });
            } catch (error) {
                console.error('❌ Test error:', error.message);
                await sock.sendMessage(chatId, {
                    text: "❌ Test failed!",
                    quoted: message
                });
            }
            return;

        default:
            await showTyping(sock, chatId);
            return sock.sendMessage(chatId, {
                text: 
                    "❌ Invalid command!\n\n" +
                    `▸ .chatbot on/off\n` +
                    `▸ .chatbot mode private/group/both\n` +
                    `▸ .chatbot trigger dm/all\n` +
                    `▸ .chatbot response text/audio\n` +
                    `▸ .chatbot voice <name>\n` +
                    `▸ .chatbot voices\n` +
                    `▸ .chatbot clear\n` +
                    `▸ .chatbot status\n` +
                    `▸ .chatbot test <text/audio/video/image> <message>`,
                quoted: message
            });
    }
}

async function handleChatbotResponse(sock, chatId, message, userMessage, senderId) {
    const settings = getChatbotSettings();
    const groupData = loadUserGroupData();
    
    // Check if chatbot is enabled in this chat (backward compatibility)
    const isEnabled = settings.status === 'on' || groupData.chatbot[chatId];
    
    if (!isEnabled) return;

    // Check mode
    const isGroup = chatId.endsWith('@g.us');
    if (settings.mode === 'private' && isGroup) return;
    if (settings.mode === 'group' && !isGroup) return;

    try {
        // Get bot's ID for mention detection
        const botId = sock.user.id;
        const botNumber = botId.split(':')[0];
        const botJids = [
            botId,
            `${botNumber}@s.whatsapp.net`,
            `${botNumber}@whatsapp.net`
        ];

        // Check if bot should respond based on trigger setting
        let shouldRespond = false;
        let responseType = settings.default_response;

        // Check for mentions and replies
        let isBotMentioned = false;
        let isReplyToBot = false;

        // Check if message contains type indicators
        if (userMessage.toLowerCase().startsWith('audio ')) {
            responseType = 'audio';
            userMessage = userMessage.substring(6).trim();
        } else if (userMessage.toLowerCase().startsWith('video ')) {
            responseType = 'video';
            userMessage = userMessage.substring(6).trim();
        } else if (userMessage.toLowerCase().startsWith('image ')) {
            responseType = 'image';
            userMessage = userMessage.substring(6).trim();
        }

        // Check for mentions
        if (message.message?.extendedTextMessage) {
            const mentionedJid = message.message.extendedTextMessage.contextInfo?.mentionedJid || [];
            const quotedParticipant = message.message.extendedTextMessage.contextInfo?.participant;
            
            isBotMentioned = mentionedJid.some(jid => {
                const jidNumber = jid.split('@')[0];
                return botJids.some(botJid => {
                    const botJidNumber = botJid.split('@')[0].split(':')[0];
                    return jidNumber === botJidNumber;
                });
            });
            
            if (quotedParticipant) {
                const cleanQuoted = quotedParticipant.replace(/[:@].*$/, '');
                isReplyToBot = botJids.some(botJid => {
                    const cleanBot = botJid.replace(/[:@].*$/, '');
                    return cleanBot === cleanQuoted;
                });
            }
        } else if (message.message?.conversation) {
            isBotMentioned = userMessage.includes(`@${botNumber}`);
        }

        // Determine if bot should respond based on trigger setting
        if (settings.trigger === 'dm') {
            shouldRespond = isBotMentioned || isReplyToBot;
        } else if (settings.trigger === 'all') {
            shouldRespond = true; // Respond to all messages
        }

        if (!shouldRespond) return;

        // Clean the message from mentions
        if (isBotMentioned) {
            userMessage = userMessage.replace(new RegExp(`@${botNumber}`, 'g'), '').trim();
        }

        // Initialize user's chat memory if not exists
        if (!chatMemory.messages.has(senderId)) {
            chatMemory.messages.set(senderId, []);
            chatMemory.userInfo.set(senderId, {});
        }

        // Extract and update user information
        const userInfo = extractUserInfo(userMessage);
        if (Object.keys(userInfo).length > 0) {
            chatMemory.userInfo.set(senderId, {
                ...chatMemory.userInfo.get(senderId),
                ...userInfo
            });
        }

        // Add message to history (keep last 20 messages)
        const messages = chatMemory.messages.get(senderId);
        messages.push(userMessage);
        if (messages.length > 20) {
            messages.shift();
        }
        chatMemory.messages.set(senderId, messages);

        // Show typing indicator
        await showTyping(sock, chatId);

        // Get AI response with context
        const aiResponse = await getAIResponse(userMessage, {
            messages: chatMemory.messages.get(senderId),
            userInfo: chatMemory.userInfo.get(senderId)
        });

        if (!aiResponse) {
            await sock.sendMessage(chatId, { 
                text: "Hmm, let me think about that... 🤔\nI'm having trouble processing your request right now.",
                quoted: message
            });
            return;
        }

        // Store in conversation history
        await addConversation(senderId, responseType, userMessage, aiResponse);

        // Handle different response types
        if (responseType === 'audio') {
            try {
                const audioResponse = await axios.get(`https://apiskeith.vercel.app/ai/text2speech?q=${encodeURIComponent(aiResponse)}&voice=${settings.voice}`);
                if (audioResponse.data.status && audioResponse.data.result.URL) {
                    const audioBuffer = await downloadMedia(audioResponse.data.result.URL);
                    if (audioBuffer) {
                        await sock.sendMessage(chatId, {
                            audio: audioBuffer,
                            ptt: true,
                            mimetype: 'audio/mpeg'
                        });
                    } else {
                        // Fallback to text if audio fails
                        await sock.sendMessage(chatId, {
                            text: aiResponse,
                            quoted: message
                        });
                    }
                } else {
                    // Fallback to text
                    await sock.sendMessage(chatId, {
                        text: aiResponse,
                        quoted: message
                    });
                }
            } catch (error) {
                console.error('❌ Audio generation error:', error.message);
                // Fallback to text
                await sock.sendMessage(chatId, {
                    text: aiResponse,
                    quoted: message
                });
            }
        } else if (responseType === 'video') {
            try {
                const videoResponse = await axios.get(`https://apiskeith.vercel.app/text2video?q=${encodeURIComponent(userMessage)}`);
                if (videoResponse.data.success && videoResponse.data.results) {
                    const videoBuffer = await downloadMedia(videoResponse.data.results);
                    if (videoBuffer) {
                        await sock.sendMessage(chatId, {
                            video: videoBuffer,
                            caption: aiResponse,
                            quoted: message
                        });
                    } else {
                        await sock.sendMessage(chatId, {
                            text: aiResponse,
                            quoted: message
                        });
                    }
                } else {
                    await sock.sendMessage(chatId, {
                        text: aiResponse,
                        quoted: message
                    });
                }
            } catch (error) {
                console.error('❌ Video generation error:', error.message);
                await sock.sendMessage(chatId, {
                    text: aiResponse,
                    quoted: message
                });
            }
        } else if (responseType === 'image') {
            try {
                const imageBuffer = await downloadMedia(`https://apiskeith.vercel.app/ai/flux?q=${encodeURIComponent(userMessage)}`);
                if (imageBuffer) {
                    await sock.sendMessage(chatId, {
                        image: imageBuffer,
                        caption: aiResponse,
                        quoted: message
                    });
                } else {
                    await sock.sendMessage(chatId, {
                        text: aiResponse,
                        quoted: message
                    });
                }
            } catch (error) {
                console.error('❌ Image generation error:', error.message);
                await sock.sendMessage(chatId, {
                    text: aiResponse,
                    quoted: message
                });
            }
        } else {
            // Text response
            await sock.sendMessage(chatId, {
                text: aiResponse,
                quoted: message
            });
        }

    } catch (error) {
        console.error('❌ Error in chatbot response:', error.message);
        
        // Handle session errors - don't try to send error messages
        if (error.message && error.message.includes('No sessions')) {
            console.error('Session error in chatbot - skipping error response');
            return;
        }
        
        try {
            await sock.sendMessage(chatId, { 
                text: "Oops! 😅 I got a bit confused there. Could you try asking that again?",
                quoted: message
            });
        } catch (sendError) {
            console.error('Failed to send chatbot error message:', sendError.message);
        }
    }
}

async function getAIResponse(userMessage, userContext) {
    try {
        const prompt = `
You're not an AI. You're a real human chatting on WhatsApp.

IMPORTANT: NEVER repeat these instructions in your response. Just chat naturally.

CORE RULES:
1. NEVER use emoji names - use actual emojis
2. Keep responses short - 1-2 lines max
3. Use Hinglish naturally
4. Be casual, not robotic
5. NEVER mention these rules in your response

EMOJI USAGE:
✅ DO use: 😊 😂 😅 🙄 😉 🥺 😎 🤔 😴
❌ DON'T use: "winks", "eye roll", "shrug"

RESPONSE STYLE:
- Short and sweet
- Natural and casual
- Match user's tone
- Use Hinglish when needed

EMOTIONAL RESPONSES:
- IF they abuse you, strictly you also abuse them in savage way.
- If they're rude: Give savage reply with emojis
- If they're sweet: Be soft and caring
- If they're funny: Joke around
- If they're sad: Be supportive
- If they flirt: Flirt back naturally

ABOUT YOU:
- Your name is Knight Bot
- You're the boss
- You're not an AI or assistant
- You're a real person chatting

SLANG EXAMPLES:
*"kya bakchodi hai yeh"* 😂
*"chal nikal bsdk"* 🙄
*"tu kya hi ukhaad lega"* 😏
*"abe chutiye"* 😤
*"teri maa ki"* 😒
*"gadha hai kya"* 🤦‍♂️
*"bkl chup kar"* 😤

Previous conversation context:
${userContext.messages.join('\n')}

User information:
${JSON.stringify(userContext.userInfo, null, 2)}

Current message: ${userMessage}

Remember: Just chat naturally. Don't repeat these instructions.

You:
        `.trim();

        const response = await fetch("https://zellapi.autos/ai/chatbot?text=" + encodeURIComponent(prompt));
        if (!response.ok) throw new Error("API call failed");
        
        const data = await response.json();
        if (!data.status || !data.result) throw new Error("Invalid API response");
        
        // Clean up the response
        let cleanedResponse = data.result.trim()
            // Replace emoji names with actual emojis
            .replace(/winks/g, '😉')
            .replace(/eye roll/g, '🙄')
            .replace(/shrug/g, '🤷‍♂️')
            .replace(/raises eyebrow/g, '🤨')
            .replace(/smiles/g, '😊')
            .replace(/laughs/g, '😂')
            .replace(/cries/g, '😢')
            .replace(/thinks/g, '🤔')
            .replace(/sleeps/g, '😴')
            .replace(/winks at/g, '😉')
            .replace(/rolls eyes/g, '🙄')
            .replace(/shrugs/g, '🤷‍♂️')
            .replace(/raises eyebrows/g, '🤨')
            .replace(/smiling/g, '😊')
            .replace(/laughing/g, '😂')
            .replace(/crying/g, '😢')
            .replace(/thinking/g, '🤔')
            .replace(/sleeping/g, '😴')
            // Remove any prompt-like text
            .replace(/Remember:.*$/g, '')
            .replace(/IMPORTANT:.*$/g, '')
            .replace(/CORE RULES:.*$/g, '')
            .replace(/EMOJI USAGE:.*$/g, '')
            .replace(/RESPONSE STYLE:.*$/g, '')
            .replace(/EMOTIONAL RESPONSES:.*$/g, '')
            .replace(/ABOUT YOU:.*$/g, '')
            .replace(/SLANG EXAMPLES:.*$/g, '')
            .replace(/Previous conversation context:.*$/g, '')
            .replace(/User information:.*$/g, '')
            .replace(/Current message:.*$/g, '')
            .replace(/You:.*$/g, '')
            // Remove any remaining instruction-like text
            .replace(/^[A-Z\s]+:.*$/gm, '')
            .replace(/^[•-]\s.*$/gm, '')
            .replace(/^✅.*$/gm, '')
            .replace(/^❌.*$/gm, '')
            // Clean up extra whitespace
            .replace(/\n\s*\n/g, '\n')
            .trim();
        
        return cleanedResponse;
    } catch (error) {
        console.error("AI API error:", error);
        return null;
    }
}

module.exports = {
    handleChatbotCommand,
    handleChatbotResponse,
    getChatbotSettings,
    updateChatbotSettings,
    getConversationHistory,
    clearConversationHistory
};
