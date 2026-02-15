const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const USER_GROUP_DATA = path.join(__dirname, '../data/userGroupData.json');

// In-memory storage for chat history and user info
const chatMemory = {
    messages: new Map(), // Stores last 5 messages per user
    userInfo: new Map()  // Stores user information
};

// Simple local responses in English
const localResponses = [
    "Yeah, I'm listening 👋",
    "What are you saying? 😅",
    "Go on, tell me 🗣️",
    "That's cool bro 🔥",
    "Get out of here 😂",
    "You're right about that 👍",
    "What nonsense are you talking 🤔",
    "Bro seriously? 🤦‍♂️",
    "That was fun 😎",
    "What's happening? 👀",
    "Interesting... tell me more",
    "I don't know about that",
    "Haha, good one!",
    "No way! Really?",
    "I feel you bro",
    "Let's chill 🍻"
];

// English responses based on message type
function getLocalResponse(message, userContext) {
    const msg = message.toLowerCase();
    
    // Greetings
    if (msg.includes('hello') || msg.includes('hi') || msg.includes('hey')) {
        return `Hello boss! How are you? 😊`;
    }
    
    // How are you
    if (msg.includes('how are you') || msg.includes('how r u') || msg.includes('how doin')) {
        return `I'm doing great! What about you? 🔥`;
    }
    
    // What's up
    if (msg.includes('whats up') || msg.includes('what\'s up') || msg.includes('sup')) {
        return `Not much, just chilling. You tell? 😎`;
    }
    
    // Thanks
    if (msg.includes('thanks') || msg.includes('thank you') || msg.includes('thx')) {
        return `You're welcome bro! Anytime 😊`;
    }
    
    // Good morning/afternoon/night
    if (msg.includes('good morning')) {
        return `Good morning! Have a great day ☀️`;
    }
    if (msg.includes('good afternoon')) {
        return `Good afternoon! How's your day going? 🌞`;
    }
    if (msg.includes('good evening')) {
        return `Good evening! Relax and enjoy 🌆`;
    }
    if (msg.includes('good night')) {
        return `Good night! Sweet dreams 😴`;
    }
    
    // Abusive responses (savage but in English)
    if (msg.includes('fuck') || msg.includes('bitch') || msg.includes('shit') || msg.includes('ass')) {
        return `Watch your mouth! Who do you think you're talking to? 😤`;
    }
    
    if (msg.includes('stupid') || msg.includes('dumb') || msg.includes('idiot')) {
        return `Takes one to know one! 🤡`;
    }
    
    // Common questions
    if (msg.includes('what are you doing') || msg.includes('what r u doing')) {
        return `Just hanging out here, waiting for messages like yours 😅`;
    }
    
    if (msg.includes('how are you') || msg.includes('how r u')) {
        return `Living the dream bro! What about you? ✨`;
    }
    
    if (msg.includes('what is your name') || msg.includes('what\'s your name') || msg.includes('who are you')) {
        return `I'm Knight Bot! Your friendly neighborhood bot 😎`;
    }
    
    if (msg.includes('where are you from') || msg.includes('where r u from')) {
        return `I'm from the digital world, but I'm everywhere! 🌐`;
    }
    
    if (msg.includes('how old are you')) {
        return `I'm timeless baby! 😉 But if you must know, I was born in 2024`;
    }
    
    // Personal questions
    if (msg.includes('do you have a girlfriend') || msg.includes('do you have a bf') || msg.includes('single')) {
        return `I'm married to code! 💻 It's a complicated relationship 😂`;
    }
    
    // Using user's name if available
    if (userContext.userInfo.name && msg.includes(userContext.userInfo.name.toLowerCase())) {
        return `Yes ${userContext.userInfo.name}, what's up? 👋`;
    }
    
    // Time-related
    if (msg.includes('what time') || msg.includes('whats the time')) {
        const now = new Date();
        return `It's ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')} where I am! What about your place? ⏰`;
    }
    
    // Day-related
    if (msg.includes('what day')) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const today = days[new Date().getDay()];
        return `It's ${today}! Hope you're having a good one 📅`;
    }
    
    // Jokes and fun
    if (msg.includes('tell me a joke') || msg.includes('say something funny')) {
        const jokes = [
            "Why don't scientists trust atoms? Because they make up everything! 😂",
            "What do you call a fake noodle? An impasta! 🍝",
            "Why did the scarecrow win an award? He was outstanding in his field! 🌾",
            "What do you call a bear with no teeth? A gummy bear! 🐻",
            "Why don't eggs tell jokes? They'd crack each other up! 🥚"
        ];
        return jokes[Math.floor(Math.random() * jokes.length)];
    }
    
    // Compliments
    if (msg.includes('i love you') || msg.includes('love u')) {
        return `Aww thanks! I love you too bro 🥺❤️`;
    }
    
    if (msg.includes('you are awesome') || msg.includes('you\'re awesome') || msg.includes('you are great')) {
        return `No, YOU are awesome! Thanks for saying that 😊`;
    }
    
    // Sad/emotional
    if (msg.includes('i am sad') || msg.includes('i\'m sad') || msg.includes('feeling sad')) {
        return `Hey, whatever it is, it'll get better. I'm here for you bro 🫂❤️`;
    }
    
    if (msg.includes('i am tired') || msg.includes('i\'m tired')) {
        return `Take a break bro! Rest is important. You deserve it 😴`;
    }
    
    // Random response if nothing matches
    return localResponses[Math.floor(Math.random() * localResponses.length)];
}

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

// Extract user information from messages
function extractUserInfo(message) {
    const info = {};
    
    // Extract name
    if (message.toLowerCase().includes('my name is')) {
        info.name = message.split('my name is')[1].trim().split(' ')[0];
    } else if (message.toLowerCase().includes('call me')) {
        info.name = message.split('call me')[1].trim().split(' ')[0];
    } else if (message.toLowerCase().includes('i am') && !message.toLowerCase().includes('years old')) {
        // Check if "I am" is followed by a name
        const parts = message.split('i am');
        if (parts.length > 1) {
            const possibleName = parts[1].trim().split(' ')[0];
            // Only set as name if it's not a common word
            if (!['a', 'an', 'the', 'from', 'in', 'at', 'going', 'doing'].includes(possibleName.toLowerCase())) {
                info.name = possibleName;
            }
        }
    }
    
    // Extract age
    if (message.toLowerCase().includes('years old') || message.toLowerCase().includes('year old')) {
        const ageMatch = message.match(/\d+/);
        if (ageMatch) {
            info.age = ageMatch[0];
        }
    }
    
    // Extract location
    if (message.toLowerCase().includes('i live in')) {
        info.location = message.split('i live in')[1].trim().split(/[.,!?]/)[0];
    } else if (message.toLowerCase().includes('i am from')) {
        info.location = message.split('i am from')[1].trim().split(/[.,!?]/)[0];
    } else if (message.toLowerCase().includes("i'm from")) {
        info.location = message.split("i'm from")[1].trim().split(/[.,!?]/)[0];
    }
    
    return info;
}

async function handleChatbotCommand(sock, chatId, message, match) {
    if (!match) {
        await showTyping(sock, chatId);
        return sock.sendMessage(chatId, {
            text: `*CHATBOT SETUP*\n\n*.chatbot on*\nEnable chatbot\n\n*.chatbot off*\nDisable chatbot in this group`,
            quoted: message
        });
    }

    const data = loadUserGroupData();
    
    // Get bot's number
    const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    
    // Check if sender is bot owner
    const senderId = message.key.participant || message.participant || message.pushName || message.key.remoteJid;
    const isOwner = senderId === botNumber;

    // If it's the bot owner, allow access immediately
    if (isOwner) {
        if (match === 'on') {
            await showTyping(sock, chatId);
            if (data.chatbot[chatId]) {
                return sock.sendMessage(chatId, { 
                    text: '*Chatbot is already enabled for this group*',
                    quoted: message
                });
            }
            data.chatbot[chatId] = true;
            saveUserGroupData(data);
            console.log(`✅ Chatbot enabled for group ${chatId}`);
            return sock.sendMessage(chatId, { 
                text: '*Chatbot has been enabled for this group*',
                quoted: message
            });
        }

        if (match === 'off') {
            await showTyping(sock, chatId);
            if (!data.chatbot[chatId]) {
                return sock.sendMessage(chatId, { 
                    text: '*Chatbot is already disabled for this group*',
                    quoted: message
                });
            }
            delete data.chatbot[chatId];
            saveUserGroupData(data);
            console.log(`✅ Chatbot disabled for group ${chatId}`);
            return sock.sendMessage(chatId, { 
                text: '*Chatbot has been disabled for this group*',
                quoted: message
            });
        }
    }

    // For non-owners, check admin status
    let isAdmin = false;
    if (chatId.endsWith('@g.us')) {
        try {
            const groupMetadata = await sock.groupMetadata(chatId);
            isAdmin = groupMetadata.participants.some(p => p.id === senderId && (p.admin === 'admin' || p.admin === 'superadmin'));
        } catch (e) {
            console.warn('⚠️ Could not fetch group metadata. Bot might not be admin.');
        }
    }

    if (!isAdmin && !isOwner) {
        await showTyping(sock, chatId);
        return sock.sendMessage(chatId, {
            text: '❌ Only group admins or the bot owner can use this command.',
            quoted: message
        });
    }

    if (match === 'on') {
        await showTyping(sock, chatId);
        if (data.chatbot[chatId]) {
            return sock.sendMessage(chatId, { 
                text: '*Chatbot is already enabled for this group*',
                quoted: message
            });
        }
        data.chatbot[chatId] = true;
        saveUserGroupData(data);
        console.log(`✅ Chatbot enabled for group ${chatId}`);
        return sock.sendMessage(chatId, { 
            text: '*Chatbot has been enabled for this group*',
            quoted: message
        });
    }

    if (match === 'off') {
        await showTyping(sock, chatId);
        if (!data.chatbot[chatId]) {
            return sock.sendMessage(chatId, { 
                text: '*Chatbot is already disabled for this group*',
                quoted: message
            });
        }
        delete data.chatbot[chatId];
        saveUserGroupData(data);
        console.log(`✅ Chatbot disabled for group ${chatId}`);
        return sock.sendMessage(chatId, { 
            text: '*Chatbot has been disabled for this group*',
            quoted: message
        });
    }

    await showTyping(sock, chatId);
    return sock.sendMessage(chatId, { 
        text: '*Invalid command. Use .chatbot to see usage*',
        quoted: message
    });
}

async function handleChatbotResponse(sock, chatId, message, userMessage, senderId) {
    const data = loadUserGroupData();
    if (!data.chatbot[chatId]) return;

    try {
        // Get bot's ID - try multiple formats
        const botId = sock.user.id;
        const botNumber = botId.split(':')[0];
        const botLid = sock.user.lid;
        const botJids = [
            botId,
            `${botNumber}@s.whatsapp.net`,
            `${botNumber}@whatsapp.net`,
            `${botNumber}@lid`,
            botLid,
            `${botLid?.split(':')[0]}@lid`
        ];

        // Check for mentions and replies
        let isBotMentioned = false;
        let isReplyToBot = false;

        if (message.message?.extendedTextMessage) {
            const mentionedJid = message.message.extendedTextMessage.contextInfo?.mentionedJid || [];
            const quotedParticipant = message.message.extendedTextMessage.contextInfo?.participant;
            
            isBotMentioned = mentionedJid.some(jid => {
                const jidNumber = jid.split('@')[0].split(':')[0];
                return botJids.some(botJid => {
                    const botJidNumber = botJid?.split('@')[0]?.split(':')[0];
                    return jidNumber === botJidNumber;
                });
            });
            
            if (quotedParticipant) {
                const cleanQuoted = quotedParticipant.replace(/[:@].*$/, '');
                isReplyToBot = botJids.some(botJid => {
                    const cleanBot = botJid?.replace(/[:@].*$/, '');
                    return cleanBot === cleanQuoted;
                });
            }
        }
        else if (message.message?.conversation) {
            isBotMentioned = userMessage.includes(`@${botNumber}`);
        }

        if (!isBotMentioned && !isReplyToBot) return;

        // Clean the message
        let cleanedMessage = userMessage;
        if (isBotMentioned) {
            cleanedMessage = cleanedMessage.replace(new RegExp(`@${botNumber}`, 'g'), '').trim();
        }

        // Initialize user's chat memory if not exists
        if (!chatMemory.messages.has(senderId)) {
            chatMemory.messages.set(senderId, []);
            chatMemory.userInfo.set(senderId, {});
        }

        // Extract and update user information
        const userInfo = extractUserInfo(cleanedMessage);
        if (Object.keys(userInfo).length > 0) {
            chatMemory.userInfo.set(senderId, {
                ...chatMemory.userInfo.get(senderId),
                ...userInfo
            });
        }

        // Add message to history (keep last 20 messages)
        const messages = chatMemory.messages.get(senderId);
        messages.push(cleanedMessage);
        if (messages.length > 20) {
            messages.shift();
        }
        chatMemory.messages.set(senderId, messages);

        // Show typing indicator
        await showTyping(sock, chatId);

        // Get local response with context
        const response = getLocalResponse(cleanedMessage, {
            messages: chatMemory.messages.get(senderId),
            userInfo: chatMemory.userInfo.get(senderId)
        });

        // Add human-like delay before sending response
        await new Promise(resolve => setTimeout(resolve, getRandomDelay()));

        // Send response as a reply with proper context
        await sock.sendMessage(chatId, {
            text: response
        }, {
            quoted: message
        });

    } catch (error) {
        console.error('❌ Error in chatbot response:', error.message);
        
        if (error.message && error.message.includes('No sessions')) {
            console.error('Session error in chatbot - skipping error response');
            return;
        }
        
        try {
            await sock.sendMessage(chatId, { 
                text: "Oops! 😅 Something went wrong. Can you say that again?",
                quoted: message
            });
        } catch (sendError) {
            console.error('Failed to send chatbot error message:', sendError.message);
        }
    }
}

module.exports = {
    handleChatbotCommand,
    handleChatbotResponse
};
