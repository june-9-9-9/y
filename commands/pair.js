const axios = require('axios');
const { sleep } = require('../lib/myfunc');

/**
 * WhatsApp number validation and formatting
 */
function validateAndFormatNumber(input) {
    // Remove all non-digit characters
    const cleaned = input.replace(/[^\d]/g, '');
    
    // Check if number has valid length
    if (cleaned.length < 8 || cleaned.length > 15) {
        return null;
    }
    
    // Add country code if missing (assuming +62 for Indonesia)
    let formatted = cleaned;
    if (!cleaned.startsWith('62') && !cleaned.startsWith('0')) {
        formatted = '62' + cleaned;
    } else if (cleaned.startsWith('0')) {
        formatted = '62' + cleaned.substring(1);
    }
    
    return formatted;
}

/**
 * Extract numbers from text input
 */
function extractNumbers(text) {
    const numbers = text.split(/[,;\s]+/)
        .map(num => num.trim())
        .filter(num => num.length > 0)
        .map(validateAndFormatNumber)
        .filter(num => num !== null);
    
    return [...new Set(numbers)]; // Remove duplicates
}

/**
 * Send formatted message with consistent styling
 */
async function sendMessage(sock, chatId, text, isError = false) {
    const prefix = isError ? '❌ ' : '✅ ';
    const message = isError ? text : prefix + text;
    
    return await sock.sendMessage(chatId, {
        text: message,
        contextInfo: {
            forwardingScore: 1,
            isForwarded: true
        }
    });
}

/**
 * Main pair command handler
 */
async function pairCommand(sock, chatId, message) {
    try {
        // Extract text from the incoming message
        const text = message.message?.conversation 
            || message.message?.extendedTextMessage?.text 
            || "";

        // Remove the command prefix and trim spaces
        const query = text.replace(/^\.pair\s*/i, "").trim();

        if (!query) {
            return await sendMessage(sock, chatId, 
                "Please provide valid WhatsApp number(s)\n\n" +
                "📋 *Examples:*\n" +
                "• `.pair 081234567890` (single number)\n" +
                "• `.pair 081234567890, 081298765432` (multiple numbers)\n" +
                "• `.pair 081234567890 081298765432` (space separated)\n\n" +
                "📝 *Format:*\n" +
                "You can use:\n" +
                "- 081234567890\n" +
                "- 81234567890\n" +
                "- 6281234567890", 
                true
            );
        }

        // Extract and validate numbers
        const numbers = extractNumbers(query);
        
        if (numbers.length === 0) {
            return await sendMessage(sock, chatId, 
                "Invalid number(s) provided! ⚠️\n" +
                "Please check the format and try again.", 
                true
            );
        }

        if (numbers.length > 5) {
            return await sendMessage(sock, chatId,
                `Maximum 5 numbers allowed! You provided ${numbers.length} numbers.`,
                true
            );
        }

        // Process each number
        for (const [index, number] of numbers.entries()) {
            const whatsappID = number + '@s.whatsapp.net';
            
            // Show processing message
            await sendMessage(sock, chatId, 
                `Processing number ${index + 1} of ${numbers.length}: ${number}...`
            );

            // Check if number exists on WhatsApp
            const result = await sock.onWhatsApp(whatsappID);
            
            if (!result[0]?.exists) {
                await sendMessage(sock, chatId,
                    `Number ${number} is not registered on WhatsApp ❌`,
                    true
                );
                continue; // Skip to next number
            }

            // Generate pairing code
            await sendMessage(sock, chatId, "Generating pairing code... ⏳");
            
            try {
                const response = await axios.get(
                    `https://pairtesth2-e3bee12e097b.herokuapp.com/pair/code?number=${number}`,
                    { timeout: 10000 } // 10 second timeout
                );
                
                if (response.data && response.data.code) {
                    const code = response.data.code;
                    
                    if (code === "Service Unavailable") {
                        throw new Error('Service Unavailable');
                    }
                    
                    // Add delay for better UX
                    await sleep(3000);
                    
                    // Send the code in a formatted way
                    await sendMessage(sock, chatId,
                        `📱 *Number:* ${number}\n` +
                        `🔢 *Pairing Code:* ${code}\n` +
                        `⏰ *Valid for:* 15 minutes\n\n` +
                        `_Use this code to complete the pairing process._`
                    );
                    
                } else {
                    throw new Error('Invalid response from server');
                }
                
            } catch (apiError) {
                console.error('API Error for number', number, ':', apiError);
                
                let errorMessage;
                if (apiError.code === 'ECONNABORTED') {
                    errorMessage = "Request timeout. Please try again.";
                } else if (apiError.message === 'Service Unavailable') {
                    errorMessage = "Pairing service is currently unavailable. Please try again later.";
                } else if (apiError.response?.status === 404) {
                    errorMessage = "Pairing service endpoint not found.";
                } else if (apiError.response?.status === 500) {
                    errorMessage = "Server error. Please try again later.";
                } else {
                    errorMessage = "Failed to generate pairing code. Please try again.";
                }
                
                await sendMessage(sock, chatId, errorMessage, true);
                
                // Continue with next number instead of stopping
                continue;
            }
            
            // Small delay between processing numbers
            if (index < numbers.length - 1) {
                await sleep(2000);
            }
        }

        // Send completion message
        if (numbers.length > 1) {
            await sendMessage(sock, chatId,
                `✅ Processed ${numbers.length} numbers successfully!\n` +
                `Check above for individual results.`
            );
        }

    } catch (error) {
        console.error('Pair command error:', error);
        
        let errorMessage = "An unexpected error occurred. Please try again later.";
        
        if (error.message?.includes('socket')) {
            errorMessage = "Connection error. Please check your internet connection.";
        } else if (error.message?.includes('timeout')) {
            errorMessage = "Request timeout. Please try again.";
        }
        
        await sendMessage(sock, chatId, errorMessage, true);
    }
}

module.exports = pairCommand;
