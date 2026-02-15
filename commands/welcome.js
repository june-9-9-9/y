const { isWelcomeOn, getWelcome, handleWelcome } = require('../lib/welcome');
const { channelInfo } = require('../lib/messageConfig');
const fetch = require('node-fetch');
const { normalizeJid, findParticipant } = require('../lib/jid');

async function welcomeCommand(sock, chatId, message) {
    // Check if it's a group
    if (!chatId.endsWith('@g.us')) {
        await sock.sendMessage(chatId, { text: 'This command can only be used in groups.' },{ quoted: message });
        return;
    }

    // Extract match from message
    const text = message.message?.conversation || 
                message.message?.extendedTextMessage?.text || '';
    const matchText = text.split(' ').slice(1).join(' ');

    await handleWelcome(sock, chatId, message, matchText);
}

async function handleJoinEvent(sock, id, participants) {
    // Check if welcome is enabled for this group
    const isWelcomeEnabled = await isWelcomeOn(id);
    if (!isWelcomeEnabled) return;

    // Get custom welcome message
    const customMessage = await getWelcome(id);

    // Get group metadata
    const groupMetadata = await sock.groupMetadata(id);
    const groupName = groupMetadata.subject;
    const groupDesc = groupMetadata.desc || 'No description available';

    // Send welcome message for each new participant
    for (const participant of participants) {
        try {
            const participantString = normalizeJid(typeof participant === 'string' ? participant : (participant.id || participant.toString()));
            const user = participantString.split('@')[0];
            
            let displayName = user;
            try {
                const found = findParticipant(groupMetadata.participants, participantString);
                if (found && found.name) {
                    displayName = found.name;
                }
            } catch (nameError) {
                console.log('Could not fetch display name, using phone number');
            }

            // Get user profile picture
            let profilePicUrl = '';
            let profilePicBuffer = null;
            try {
                profilePicUrl = await sock.profilePictureUrl(participantString, 'image');
                // Fetch the profile picture buffer
                const picResponse = await fetch(profilePicUrl);
                if (picResponse.ok) {
                    profilePicBuffer = await picResponse.buffer();
                }
            } catch (profileError) {
                console.log('No profile picture available for user:', displayName);
                // Use default avatar if no profile picture
                profilePicUrl = 'https://img.pyrocdn.com/dbKUgahg.png';
                const defaultResponse = await fetch(profilePicUrl);
                if (defaultResponse.ok) {
                    profilePicBuffer = await defaultResponse.buffer();
                }
            }
            
            // Process custom message with variables
            let finalMessage;
            if (customMessage) {
                finalMessage = customMessage
                    .replace(/{user}/g, `@${displayName}`)
                    .replace(/{group}/g, groupName)
                    .replace(/{description}/g, groupDesc);
            } else {
                // Default message if no custom message is set
                const now = new Date();
                const timeString = now.toLocaleString('en-US', {
                    month: '2-digit',
                    day: '2-digit', 
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true
                });
                
                finalMessage = `╭╼━≪•NEW-MEMBER•≫━╾╮\n┃WELCOME: @${displayName} 👋\n┃Member count: #${groupMetadata.participants.length}\n┃𝚃𝙸𝙼𝙴: ${timeString}⏰\n╰━━━━━━━━━━━━━━━╯\n\n*@${displayName}* Welcome to *${groupName}*! 🎉\n*𝙳𝙴𝚂𝙲𝚁𝙸𝙿𝚃𝙸𝙾𝙽*\n${groupDesc}\n\n`;
            }
            
            // Try to send with image first
            try {
                if (profilePicBuffer) {
                    // Option 1: Send profile picture as an image with caption
                    await sock.sendMessage(id, {
                        image: profilePicBuffer,
                        caption: finalMessage,
                        mentions: [participantString],
                        ...channelInfo
                    });
                } else {
                    // Option 2: Try API-generated welcome image with profile picture
                    const apiUrl = `https://api.some-random-api.com/welcome/img/2/gaming3?type=join&textcolor=green&username=${encodeURIComponent(displayName)}&guildName=${encodeURIComponent(groupName)}&memberCount=${groupMetadata.participants.length}&avatar=${encodeURIComponent(profilePicUrl || 'https://img.pyrocdn.com/dbKUgahg.png')}`;
                    
                    const response = await fetch(apiUrl);
                    if (response.ok) {
                        const imageBuffer = await response.buffer();
                        
                        // Send welcome image with caption
                        await sock.sendMessage(id, {
                            image: imageBuffer,
                            caption: finalMessage,
                            mentions: [participantString],
                            ...channelInfo
                        });
                    } else {
                        throw new Error('API image generation failed');
                    }
                }
            } catch (imageError) {
                console.log('Image sending failed, falling back to text with profile picture');
                
                // Fallback: Send profile picture separately with text
                try {
                    if (profilePicBuffer) {
                        // Send profile picture first
                        await sock.sendMessage(id, {
                            image: profilePicBuffer,
                            caption: `📸 Profile picture of @${displayName}`,
                            mentions: [participantString],
                            ...channelInfo
                        });
                    }
                } catch (picError) {
                    console.log('Could not send profile picture separately');
                }
                
                // Send welcome text message
                await sock.sendMessage(id, {
                    text: finalMessage,
                    mentions: [participantString],
                    ...channelInfo
                });
            }
        } catch (error) {
            console.error('Error sending welcome message:', error);
            // Fallback to text message
            const participantString = typeof participant === 'string' ? participant : (participant.id || participant.toString());
            const user = participantString.split('@')[0];
            
            // Use custom message if available, otherwise use simple fallback
            let fallbackMessage;
            if (customMessage) {
                fallbackMessage = customMessage
                    .replace(/{user}/g, `@${user}`)
                    .replace(/{group}/g, groupName)
                    .replace(/{description}/g, groupDesc);
            } else {
                fallbackMessage = `Welcome @${user} to ${groupName}! 🎉\nMembers count: ${groupMetadata.participants.length}\n`;
            }
            
            await sock.sendMessage(id, {
                text: fallbackMessage,
                mentions: [participantString],
                ...channelInfo
            });
        }
    }
}

module.exports = { welcomeCommand, handleJoinEvent };
