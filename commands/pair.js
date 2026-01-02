const axios = require('axios');
const { sleep } = require('../lib/myfunc');

async function pairCommand(sock, chatId, message) {
    try {
        // Extract text from incoming message
        const text =
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            "";

        // Remove command prefix ".pair" and trim spaces
        const q = text.replace(/^\.pair\s*/i, "").trim();

        if (!q) {
            return sock.sendMessage(chatId, {
                text: "⚠️ Please provide a valid WhatsApp number.\n\nExample:\n.pair 25678467XXXX",
                contextInfo: { forwardingScore: 1, isForwarded: true }
            });
        }

        // Normalize and validate numbers
        const numbers = q.split(",")
            .map(v => v.replace(/[^0-9]/g, "")) // keep only digits
            .filter(v => v.length >= 6 && v.length <= 20);

        if (numbers.length === 0) {
            return sock.sendMessage(chatId, {
                text: "❌ Invalid number format. Please use digits only!",
                contextInfo: { forwardingScore: 1, isForwarded: true }
            });
        }

        for (const number of numbers) {
            const whatsappID = `${number}@s.whatsapp.net`;
            const result = await sock.onWhatsApp(whatsappID);

            if (!result?.[0]?.exists) {
                await sock.sendMessage(chatId, {
                    text: `🚫 Number ${number} is not registered on WhatsApp.`,
                    contextInfo: { forwardingScore: 1, isForwarded: true }
                });
                continue; // move to next number instead of stopping
            }

            await sock.sendMessage(chatId, {
                text: `⏳ Generating code for ${number}...`,
                contextInfo: { forwardingScore: 1, isForwarded: true }
            });

            try {
                const response = await axios.get(
                    `https://pairtesth2-e3bee12e097b.herokuapp.com/pair/code?number=${number}`,
                    { timeout: 10000 } // defensive timeout
                );

                const code = response.data?.code;
                if (!code || code === "Service Unavailable") {
                    throw new Error("Service Unavailable");
                }

                await sleep(3000); // shorter wait for UX
                await sock.sendMessage(chatId, {
                    text: `✅ Pairing code for ${number}: ${code}`,
                    contextInfo: { forwardingScore: 1, isForwarded: true }
                });

            } catch (apiError) {
                console.error("API Error:", apiError.message);
                const errorMessage =
                    apiError.message === "Service Unavailable"
                        ? "⚠️ Service is currently unavailable. Please try again later."
                        : "❌ Failed to generate pairing code. Please try again later.";

                await sock.sendMessage(chatId, {
                    text: errorMessage,
                    contextInfo: { forwardingScore: 1, isForwarded: true }
                });
            }
        }
    } catch (error) {
        console.error("Command Error:", error);
        await sock.sendMessage(chatId, {
            text: "❌ An unexpected error occurred. Please try again later.",
            contextInfo: { forwardingScore: 1, isForwarded: true }
        });
    }
}

module.exports = pairCommand;
