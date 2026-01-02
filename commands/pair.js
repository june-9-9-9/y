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
            }, { quoted: message });
        }

        // Normalize and validate numbers
        const numbers = q.split(",")
            .map(v => v.replace(/[^0-9]/g, "")) // keep only digits
            .filter(v => v.length >= 6 && v.length <= 20);

        if (numbers.length === 0) {
            return sock.sendMessage(chatId, {
                text: "❌ Invalid number format. Please use digits only!",
                contextInfo: { forwardingScore: 1, isForwarded: true }
            }, { quoted: message });
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
                    `https://pairtesth2-e3bee12e097b.herokuapp.com/code?number=${number}`,
                    { timeout: 30000 } // defensive timeout
                );

                const code = response.data?.code;
                if (!code || code === "Service Unavailable") {
                    throw new Error("Service Unavailable");
                }

                await sleep(3000); // shorter wait for UX
                await sock.sendMessage(chatId, {
                    text: `${code}`,
                    contextInfo: { forwardingScore: 1, isForwarded: true }
                }, { quoted: message });
            // Send explanation separately
                await sock.sendMessage(chatId, {
                    text: `📌 How to link\n ${number} with pair code:\n\n1. Copy code above _*${code}*_\n2. Open WhatsApp on your phone.\n3. Go to Linked Devices in settings.\n4. Tap Link a Device or the pop up message\n5 Enter the code above when prompted.\n6. You device will be linked after loading.\n6. Use the session_id in your Dirrect chat(Dm) to deploy.`,
                    contextInfo: { forwardingScore: 1, isForwarded: false }
                }, { quoted: message });

            } catch (apiError) {
                console.error("API Error:", apiError.message);
                const errorMessage =
                    apiError.message === "Service Unavailable"
                        ? "⚠️ Service is currently unavailable. Please try again later."
                        : "❌ Failed to generate pairing code. Please try again later.";

                await sock.sendMessage(chatId, {
                    text: errorMessage,
                    contextInfo: { forwardingScore: 1, isForwarded: true }
                }, { quoted: message });
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
