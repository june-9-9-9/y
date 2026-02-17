const axios = require("axios");

async function joinCommand(sock, chatId, message) {
    try {
        // Initial reaction
        await sock.sendMessage(chatId, {
            react: { text: "🔗", key: message.key }
        });

        // Extract query from direct text or quoted message
        let text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        let query = null;

        if (text) {
            const parts = text.split(" ");
            query = parts.slice(1).join(" ").trim();
        }

        // Check quoted message for query
        const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!query && quoted) {
            if (quoted.conversation) {
                query = quoted.conversation.trim();
            } else if (quoted.extendedTextMessage?.text) {
                query = quoted.extendedTextMessage.text.trim();
            }
        }

        if (!query) {
            return await sock.sendMessage(chatId, {
                text: "🔗 Please provide a WhatsApp group invite link!\n\nExample: .join https://chat.whatsapp.com/IxMbtAN4lhVEhmbb6BfAsk\nOr quote a message containing the link"
            }, { quoted: message });
        }

        if (query.length > 200) {
            return await sock.sendMessage(chatId, {
                text: "📝 Link too long! Max 200 chars."
            }, { quoted: message });
        }

        // Extract invite code from the link
        let inviteCode;
        
        if (query.includes("chat.whatsapp.com/")) {
            inviteCode = query.split("chat.whatsapp.com/")[1].split("?")[0].split("/")[0];
        } else if (query.match(/^[A-Za-z0-9]{22}$/)) {
            inviteCode = query;
        } else {
            return await sock.sendMessage(chatId, {
                text: "❌ Invalid WhatsApp group link format!\n\nProvide a link like: https://chat.whatsapp.com/IxMbtAN4lhVEhmbb6BfAsk\nOr just the code: IxMbtAN4lhVEhmbb6BfAsk"
            }, { quoted: message });
        }

        // Validate invite code length
        if (inviteCode.length !== 22) {
            return await sock.sendMessage(chatId, {
                text: "❌ Invalid invite code length! WhatsApp codes should be 22 characters."
            }, { quoted: message });
        }

        // Get invite info with timeout
        const groupInfo = await Promise.race([
            sock.groupGetInviteInfo(inviteCode),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout fetching group info')), 10000)
            )
        ]);

        if (!groupInfo) {
            throw new Error('Failed to retrieve group information');
        }

        // Accept the invite with timeout
        await Promise.race([
            sock.groupAcceptInvite(inviteCode),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout joining group')), 10000)
            )
        ]);

        const groupName = groupInfo.subject || 'Unknown Group';

        // Simplified success message
        const groupInfoMessage = `✅ *Successfully Joined Group!*\n\n📌 *Name:* ${groupName}`;

        try {
            const ppUrl = await sock.profilePictureUrl(`${groupInfo.id}@g.us`, 'image');
            if (ppUrl) {
                const ppResponse = await axios.get(ppUrl, { responseType: "arraybuffer", timeout: 10000 });
                await sock.sendMessage(chatId, {
                    image: Buffer.from(ppResponse.data),
                    caption: groupInfoMessage
                }, { quoted: message });
            } else {
                await sock.sendMessage(chatId, { text: groupInfoMessage }, { quoted: message });
            }
        } catch {
            await sock.sendMessage(chatId, { text: groupInfoMessage }, { quoted: message });
        }

        // Final success reaction
        await sock.sendMessage(chatId, { react: { text: "✅", key: message.key } });

        console.log(`Successfully joined group: ${groupName}`);

    } catch (error) {
        console.error("Join command error:", error);
        
        let errorMessage = '❌ Failed to join group!';
        if (error.message.includes('Timeout')) {
            errorMessage = '⏰ Request timeout. Please try again.';
        } else if (error.message.includes('invite') || error.message.includes('expired')) {
            errorMessage = '❌ The invite link is invalid or has expired!';
        } else if (error.message.includes('already')) {
            errorMessage = '⚠️ Bot is already in that group!';
        } else if (error.message.includes('admin') || error.message.includes('not-authorized')) {
            errorMessage = '❌ Bot is not authorized to join this group.';
        } else if (error.message.includes('401') || error.message.includes('unauthorized')) {
            errorMessage = '❌ Unauthorized access to group information.';
        } else if (error.message.includes('500')) {
            errorMessage = '❌ Server error. Please try again later.';
        }

        return await sock.sendMessage(chatId, { text: errorMessage }, { quoted: message });
    }
}

module.exports = joinCommand;
