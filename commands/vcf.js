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
        
        // Validate group size (minimum only, no upper limit)
        if (participants.length < 2) {
            await sock.sendMessage(chatId, { 
                text: "❌ Group must have at least 2 members." 
            }, { quoted: message });
            return;
        }

        // Generate VCF content
        let vcfContent = '';
        participants.forEach(participant => {
            // Extract raw phone number from JID
            let phoneNumber = participant.id.split('@')[0];
            
            // Remove any non-numeric characters to get clean number
            phoneNumber = phoneNumber.replace(/\D/g, '');
            
            // Remove common prefixes like 'lid' or other identifiers
            // Keep only if it's a valid phone number (at least 5 digits)
            if (phoneNumber.length >= 5) {
                const displayName = participant.notify || `User_${phoneNumber}`;
                
                vcfContent += `BEGIN:VCARD\n` +
                              `VERSION:3.0\n` +
                              `FN:${displayName}\n` +
                              `TEL;TYPE=CELL:${phoneNumber}\n` +
                              `NOTE:From ${groupMetadata.subject}\n` +
                              `END:VCARD\n\n`;
            }
        });

        // Check if we have valid contacts
        if (!vcfContent.trim()) {
            await sock.sendMessage(chatId, { 
                text: "❌ No valid phone numbers found in group members." 
            }, { quoted: message });
            return;
        }

        // Create temp file
        const sanitizedGroupName = groupMetadata.subject.replace(/[^\w]/g, '_');
        const tempDir = path.join(__dirname, '../temp');
        
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const vcfPath = path.join(tempDir, `${sanitizedGroupName}_${Date.now()}.vcf`);
        fs.writeFileSync(vcfPath, vcfContent);

        // Count valid contacts
        const contactCount = (vcfContent.match(/BEGIN:VCARD/g) || []).length;

        // Send VCF file immediately
        await sock.sendMessage(chatId, {
            document: fs.readFileSync(vcfPath),
            mimetype: 'text/vcard',
            fileName: `${sanitizedGroupName}_contacts.vcf`,
            caption: `📇 *Group Contacts*\n\n` +
                     `🔗 Group: ${groupMetadata.subject}\n` +
                     `📑 Members: ${participants.length}\n` +
                     `✅ Valid Contacts: ${contactCount}`
        }, { quoted: message });

        // Cleanup
        setTimeout(() => {
            try {
                if (fs.existsSync(vcfPath)) {
                    fs.unlinkSync(vcfPath);
                }
            } catch (cleanupError) {
                console.error('Error cleaning up VCF file:', cleanupError);
            }
        }, 5000);

    } catch (error) {
        console.error('VCF Error:', error);
        await sock.sendMessage(chatId, { 
            text: "❌ Failed to generate VCF file. Please try again later." 
        }, { quoted: message });
    }
}

module.exports = vcfCommand;
