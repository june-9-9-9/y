async function addCommand(sock, chatId, message) {
    try {
        // Initial reaction ➕
        await sock.sendMessage(chatId, {
            react: { text: "➕", key: message.key }
        });

        // Check if it's a group by examining the chat ID
        const isGroup = chatId.endsWith('@g.us');
        
        if (!isGroup) {
            return await sock.sendMessage(chatId, { 
                text: "❌ This command is only for groups" 
            }, { quoted: message });
        }

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        
        if (!text && !message.quoted) {
            return await sock.sendMessage(chatId, { 
                text: `📌 *Usage:*\n.add 2547xxxxxxx\nOr reply to a message to add that user`
            }, { quoted: message });
        }

        // Get target user number
        const numbersOnly = text
            ? text.replace(/\D/g, '') + '@s.whatsapp.net'
            : message.quoted?.sender;

        if (!numbersOnly) {
            return await sock.sendMessage(chatId, { 
                text: "❌ Invalid user specified"
            }, { quoted: message });
        }

        // Check if bot is admin in the group
        const groupMeta = await sock.groupMetadata(chatId);
        const participants = groupMeta.participants || [];
        
        // Find bot participant
        const botParticipant = participants.find(p => 
            p.id.includes(sock.user.id.split(':')[0] || sock.user.id)
        );
        
        if (!botParticipant || !['admin', 'superadmin'].includes(botParticipant.admin)) {
            return await sock.sendMessage(chatId, { 
                text: "❌ I need to be a group admin to add members"
            }, { quoted: message });
        }

        // Check if user adding is admin
        const sender = message.key.participant || message.key.remoteJid;
        const userParticipant = participants.find(p => p.id === sender);
        
        if (!userParticipant || !['admin', 'superadmin'].includes(userParticipant.admin)) {
            return await sock.sendMessage(chatId, { 
                text: "❌ Only group admins can add members"
            }, { quoted: message });
        }

        // Add user to group
        const res = await sock.groupParticipantsUpdate(chatId, [numbersOnly], 'add');
        
        for (let i of res) {
            if (i.status === 408) {
                return await sock.sendMessage(chatId, { 
                    text: "❌ User is already in the group",
                    mentions: [numbersOnly]
                }, { quoted: message });
            }
            
            if (i.status === 401) {
                return await sock.sendMessage(chatId, { 
                    text: "🚫 I'm blocked by this user",
                    mentions: [numbersOnly]
                }, { quoted: message });
            }
            
            if (i.status === 409) {
                return await sock.sendMessage(chatId, { 
                    text: "⚠️ User recently left this group",
                    mentions: [numbersOnly]
                }, { quoted: message });
            }
            
            if (i.status === 500) {
                return await sock.sendMessage(chatId, { 
                    text: "❌ Invalid request. Please try again later."
                }, { quoted: message });
            }
            
            if (i.status === 403) {
                // User has privacy settings, send invite link
                const inviteCode = await sock.groupInviteCode(chatId);
                const groupName = groupMeta.subject || "Group";
                
                await sock.sendMessage(chatId, {
                    text: `@${numbersOnly.split('@')[0]} cannot be added because their account is private.\n📩 An invite link has been sent to their private chat.`,
                    mentions: [numbersOnly]
                }, { quoted: message });

                // Send invite to user's DM
                try {
                    await sock.sendMessage(numbersOnly, {
                        text: `📢 *Group Invitation*\n\n🏷️ *Group:* ${groupName}\n🔗 *Link:* https://chat.whatsapp.com/${inviteCode}\n━━━━━━━━━━━━━━━\n👑 *Invited by:* ${userParticipant?.notify || "Admin"}\n📌 You've been invited to join this group!`,
                        detectLink: true
                    });
                } catch (err) {
                    await sock.sendMessage(chatId, { 
                        text: "❌ Failed to send invitation. The user may have blocked me."
                    }, { quoted: message });
                }
                
                return; // Exit after handling private user
            }
            
            // Success - user added
            await sock.sendMessage(chatId, {
                text: `✅ Successfully added @${numbersOnly.split('@')[0]} to the group!`,
                mentions: [numbersOnly]
            }, { quoted: message });
        }

        // Success reaction ✅
        await sock.sendMessage(chatId, {
            react: { text: '✅', key: message.key }
        });

    } catch (error) {
        console.error('Error in addCommand:', error);
        
        let errorMsg = "⚠️ Could not add user!";
        if (error.message?.includes("not authorized")) {
            errorMsg = "❌ I'm not authorized to add members. Make sure I'm an admin.";
        } else if (error.message?.includes("not admin")) {
            errorMsg = "❌ Only group admins can add members.";
        }
        
        await sock.sendMessage(chatId, { 
            text: errorMsg 
        }, { quoted: message });
        
        await sock.sendMessage(chatId, {
            react: { text: '❌', key: message.key }
        });
    }
}

module.exports = addCommand;
