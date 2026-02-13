async function groupInfoCommand(sock, chatId, msg) {
    try {
        // Validate chat type - ensure it's a group
        if (!chatId.endsWith('@g.us')) {
            await sock.sendMessage(chatId, { 
                text: '❌ This command can only be used in groups!' 
            });
            return;
        }

        // Get group metadata with timeout
        const groupMetadata = await Promise.race([
            sock.groupMetadata(chatId),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout fetching group metadata')), 10000)
            )
        ]);

        if (!groupMetadata) {
            throw new Error('Failed to retrieve group metadata');
        }

        // Get group profile picture with better error handling
        let pp;
        let ppError = false;
        try {
            pp = await sock.profilePictureUrl(chatId, 'image');
            // Validate URL
            if (!pp || typeof pp !== 'string') {
                throw new Error('Invalid profile picture URL');
            }
        } catch (error) {
            console.log('Profile picture error:', error.message);
            pp = 'https://i.imgur.com/2wzGhpF.jpeg'; // Default image
            ppError = true;
        }

        // Process participants data
        const participants = groupMetadata.participants || [];
        const totalMembers = participants.length;
        
        // Get admins with proper filtering
        const groupAdmins = participants.filter(p => 
            p.admin && (p.admin === 'admin' || p.admin === 'superadmin')
        );
        
        // Get owner - more reliable method
        const owner = groupMetadata.owner || 
                     groupAdmins.find(p => p.admin === 'superadmin')?.id ||
                     participants.find(p => p.admin === 'superadmin')?.id ||
                     'Unknown';

        // Format admin list with better handling
        const listAdmin = groupAdmins.length > 0 
            ? groupAdmins.map((v, i) => `${i + 1}. @${v.id.split('@')[0]}`).join('\n')
            : 'No admins found';

        // Get creation date if available
        const creationDate = groupMetadata.creation ? 
            new Date(groupMetadata.creation * 1000).toLocaleDateString() : 
            'Unknown';

        // Get group description with proper formatting
        const description = groupMetadata.desc 
            ? groupMetadata.desc.toString().trim()
            : 'No description';

        // Truncate long descriptions
        const maxDescLength = 500;
        const truncatedDesc = description.length > maxDescLength 
            ? description.substring(0, maxDescLength) + '...' 
            : description;

        // Check if group is announced/restricted
        const isAnnounce = groupMetadata.announce === true || groupMetadata.restrict === true;
        const groupMode = isAnnounce ? 'Restricted (Only admins can send messages)' : 'Everyone can send messages';

        // Create enhanced info text with better formatting
        const text = `
🌟 *GROUP INFORMATION* 🌟

📝 *Basic Info:*
├─ *Name:* ${groupMetadata.subject || 'Unnamed Group'}
├─ *ID:* ${groupMetadata.id || 'Unknown'}
├─ *Created:* ${creationDate}
├─ *Total Members:* ${totalMembers}
├─ *Admins:* ${groupAdmins.length}
└─ *Group Mode:* ${groupMode}

👑 *Ownership:*
└─ *Owner:* @${owner.split('@')[0]}

⚡ *Administrators:*
  ${listAdmin}

📋 *Description:*
  ${truncatedDesc}

  ${ppError ? '📷 *Note:* Using default group image' : ''}
`.trim();

        // Prepare mentions avoiding duplicates
        const mentions = [];
        if (owner && owner !== 'Unknown') {
            mentions.push(owner);
        }
        
        groupAdmins.forEach(admin => {
            if (admin.id && !mentions.includes(admin.id) && admin.id !== owner) {
                mentions.push(admin.id);
            }
        });

        // Send message with enhanced options
        const messageOptions = {
            image: { url: pp },
            caption: text,
            mentions: mentions,
            contextInfo: {
                mentionedJid: mentions,
                isForwarded: false
            },
            headerType: 1
        };

        await sock.sendMessage(chatId, messageOptions);

        // Log successful execution
        console.log(`Group info command executed successfully for group: ${groupMetadata.subject}`);

    } catch (error) {
        console.error('Error in groupinfo command:', error);
        
        // More specific error messages
        let errorMessage = 'Failed to get group info!';
        
        if (error.message.includes('Timeout')) {
            errorMessage = '⏰ Request timeout. Please try again.';
        } else if (error.message.includes('not in group')) {
            errorMessage = '❌ Bot is not in this group or group not found.';
        } else if (error.message.includes('401')) {
            errorMessage = '❌ Unauthorized access to group information.';
        }

        await sock.sendMessage(chatId, { 
            text: errorMessage,
            contextInfo: {
                isForwarded: false
            }
        });
    }
}

module.exports = groupInfoCommand;
