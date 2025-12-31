const fs = require('fs');
const path = require('path');

async function vcfCommand(sock, chatId, message) {
    try {
        // Restrict to groups only
        if (!chatId.endsWith('@g.us')) {
            await sock.sendMessage(chatId, { 
                text: "❌ This command can only be used in groups." 
            }, { quoted: message });
            return;
        }

        // Get group metadata
        const groupMetadata = await sock.groupMetadata(chatId);
        const participants = groupMetadata.participants || [];
        
        // Validate group size
        if (participants.length < 2) {
            await sock.sendMessage(chatId, { 
                text: "❌ Group must have at least 2 members." 
            }, { quoted: message });
            return;
        }

        // Generate VCF content with better contact info
        let vcfContent = '';
        participants.forEach(participant => {
            const phoneNumber = participant.id.split('@')[0];
            
            // Try to get the best available name
            let displayName = '';
            let firstName = '';
            let lastName = '';
            
            if (participant.notify) {
                displayName = participant.notify;
                // Simple parsing - you can improve this based on your needs
                const nameParts = participant.notify.split(' ');
                firstName = nameParts[0] || '';
                lastName = nameParts.slice(1).join(' ') || '';
            } else if (participant.name) {
                displayName = participant.name;
                const nameParts = participant.name.split(' ');
                firstName = nameParts[0] || '';
                lastName = nameParts.slice(1).join(' ') || '';
            } else {
                displayName = `User_${phoneNumber}`;
                firstName = `User_${phoneNumber}`;
            }
            
            // Clean names for VCF format
            displayName = displayName.replace(/,/g, '').replace(/;/g, '');
            firstName = firstName.replace(/,/g, '').replace(/;/g, '');
            lastName = lastName.replace(/,/g, '').replace(/;/g, '');
            
            // Generate unique UID for each contact
            const uid = `${phoneNumber}_${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
            
            // Create VCF entry with full contact information
            vcfContent += `BEGIN:VCARD\n` +
                         `VERSION:3.0\n` +
                         `N:${lastName};${firstName};;;\n` +
                         `FN:${displayName}\n` +
                         `TEL;TYPE=CELL,VOICE:+${phoneNumber}\n` +
                         `TEL;TYPE=MAIN:+${phoneNumber}\n` +
                         `ITEM1.TEL:+${phoneNumber}\n` +
                         `ITEM1.X-ABLabel:Mobile\n` +
                         `CATEGORIES:${groupMetadata.subject.replace(/[^\w\s]/g, '')}\n` +
                         `NOTE:From WhatsApp Group: ${groupMetadata.subject}\n` +
                         `UID:${uid}\n` +
                         `REV:${new Date().toISOString()}\n` +
                         `END:VCARD\n\n`;
        });

        // Create temp file
        const sanitizedGroupName = groupMetadata.subject.replace(/[^\w\s]/g, '_').replace(/\s+/g, '_');
        const tempDir = path.join(__dirname, '../temp');
        
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const timestamp = Date.now();
        const vcfPath = path.join(tempDir, `${sanitizedGroupName}_${timestamp}.vcf`);
        fs.writeFileSync(vcfPath, vcfContent);

        // Send VCF file immediately
        await sock.sendMessage(chatId, {
            document: fs.readFileSync(vcfPath),
            mimetype: 'text/vcard',
            fileName: `${sanitizedGroupName}_contacts.vcf`,
            caption: `📇 *Group Contacts Export*\n\n` +
                     `🔗 *Group:* ${groupMetadata.subject}\n` +
                     `👥 *Total Members:* ${participants.length}\n` +
                     `📱 *File Format:* VCF (vCard)\n` +
                     `💾 *Import:* Save to phone contacts`
        }, { quoted: message });

        // Cleanup after sending
        setTimeout(() => {
            try {
                if (fs.existsSync(vcfPath)) {
                    fs.unlinkSync(vcfPath);
                }
            } catch (cleanupError) {
                console.error('Error cleaning up VCF file:', cleanupError);
            }
        }, 3000);

    } catch (error) {
        console.error('VCF Error:', error);
        await sock.sendMessage(chatId, { 
            text: "❌ Failed to generate VCF file. Please try again later." 
        }, { quoted: message });
    }
}

module.exports = vcfCommand;
