const axios = require('axios');

/**
 * GPT-4 Command Handler
 * @param {object} sock - WhatsApp socket
 * @param {string} chatId - Chat ID
 * @param {object} message - Message object
 */
async function gpt4Command(sock, chatId, message) {
    try {
        // Extract text from message
        const text = extractMessageText(message);
        
        if (!text) {
            return await sendPromptMessage(sock, chatId, message);
        }

        // Parse command and query
        const { command, query } = parseCommand(text);
        
        if (!query) {
            return await sendEmptyQueryMessage(sock, chatId, message);
        }

        // Process GPT request
        await processGPTRequest(sock, chatId, message, query);
        
    } catch (error) {
        console.error('GPT-4 Command Error:', error);
        await sendErrorMessage(sock, chatId, message);
    }
}

/**
 * Extract text from message object
 */
function extractMessageText(message) {
    return message.message?.conversation || 
           message.message?.extendedTextMessage?.text || 
           message.message?.imageMessage?.caption ||
           message.text ||
           '';
}

/**
 * Parse command and query from text
 */
function parseCommand(text) {
    const parts = text.split(' ');
    const command = parts[0].toLowerCase();
    const query = parts.slice(1).join(' ').trim();
    
    return { command, query };
}

/**
 * Send initial prompt message
 */
async function sendPromptMessage(sock, chatId, message) {
    const promptText = "Please provide a question after !gpt\n\n" +
                      "Example: !gpt What is quantum computing?";
    
    return await sock.sendMessage(chatId, { text: promptText }, { quoted: message });
}

/**
 * Send empty query message
 */
async function sendEmptyQueryMessage(sock, chatId, message) {
    return await sock.sendMessage(chatId, { 
        text: "❌ Please provide a query.\nExample: !gpt What is quantum computing?" 
    }, { quoted: message });
}

/**
 * Send error message
 */
async function sendErrorMessage(sock, chatId, message) {
    return await sock.sendMessage(chatId, {
        text: "❌ An error occurred while processing your request. Please try again later.",
        contextInfo: {
            mentionedJid: [message.key?.participant || message.key?.remoteJid],
            quotedMessage: message.message
        }
    }, { quoted: message });
}

/**
 * Process GPT request
 */
async function processGPTRequest(sock, chatId, message, query) {
    // Show processing indicator
    await sock.sendPresenceUpdate('composing', chatId);
    
    // Optional: Add a reaction to show processing
    if (message.key) {
        await sock.sendMessage(chatId, {
            react: { text: '⏳', key: message.key }
        });
    }

    try {
        await handleGPTAPIRequest(sock, chatId, message, query);
    } catch (error) {
        console.error('API Processing Error:', error);
        await sendAPIErrorMessage(sock, chatId, message, error);
    }
}

/**
 * Handle GPT API request
 */
async function handleGPTAPIRequest(sock, chatId, message, query) {
    // Encode the query for URL
    const encodedQuery = encodeURIComponent(query);
    
    // Make API request to the GPT-5 endpoint
    const apiUrl = `https://iamtkm.vercel.app/ai/gpt5?apikey=tkm&text=${encodedQuery}`;
    
    const response = await axios.get(apiUrl);
    const data = response.data;
    
    // Extract response from API
    const replyText = data?.response || 
                     data?.message || 
                     "⚠️ No response from AI service.";
    
    if (replyText !== "⚠️ No response from AI service.") {
        // Clear typing indicator
        await sock.sendPresenceUpdate('paused', chatId);
        
        // Update reaction to show success
        if (message.key) {
            await sock.sendMessage(chatId, {
                react: { text: '✅', key: message.key }
            });
        }
        
        await sock.sendMessage(chatId, {
            text: replyText
        }, { quoted: message });
    } else {
        throw new Error('No valid response from GPT API');
    }
}

/**
 * Send API error message
 */
async function sendAPIErrorMessage(sock, chatId, message, error) {
    let errorMessage = "❌ An error occurred. Please try again later.";
    
    if (error.response) {
        // API error (non-2xx response)
        const status = error.response.status;
        
        if (status === 429) {
            errorMessage = "❌ Rate limit exceeded. Please wait a minute before trying again.";
        } else if (status === 404) {
            errorMessage = "❌ AI service is currently unavailable. Please try again later.";
        } else {
            errorMessage = `❌ API Error (${status}): ${error.response.data?.message || 'Unknown error'}`;
        }
    } else if (error.request) {
        // No response received
        errorMessage = "❌ No response from AI service. Please check your connection.";
    } else if (error.code === 'ENOTFOUND') {
        // Network/DNS error
        errorMessage = "❌ Cannot connect to the AI service. Please try again later.";
    }
    
    // Clear typing indicator
    await sock.sendPresenceUpdate('paused', chatId);
    
    // Update reaction to show error
    if (message.key) {
        await sock.sendMessage(chatId, {
            react: { text: '❌', key: message.key }
        });
    }
    
    await sock.sendMessage(chatId, {
        text: errorMessage,
        contextInfo: {
            mentionedJid: [message.key?.participant || message.key?.remoteJid],
            quotedMessage: message.message
        }
    }, { quoted: message });
}

module.exports = gpt4Command;
