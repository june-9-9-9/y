const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const settings = require('../settings');
const webp = require('node-webpmux');
const crypto = require('crypto');

async function smemeCommand(sock, chatId, message) {
    // The message that will be quoted in the reply.
    const messageToQuote = message;
    
    // Extract text from message
    let text = '';
    
    // Check if message has text
    if (message.message?.conversation) {
        text = message.message.conversation;
    } else if (message.message?.extendedTextMessage?.text) {
        text = message.message.extendedTextMessage.text;
    }
    
    // Remove the command prefix (.smeme) and any leading/trailing spaces
    text = text.replace(/^\.smeme\s*/i, '').trim();
    
    // The message object that contains the media to be downloaded.
    let targetMessage = message;

    // If the message is a reply, the target media is in the quoted message.
    if (message.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
        // We need to build a new message object for downloadMediaMessage to work correctly.
        const quotedInfo = message.message.extendedTextMessage.contextInfo;
        targetMessage = {
            key: {
                remoteJid: chatId,
                id: quotedInfo.stanzaId,
                participant: quotedInfo.participant
            },
            message: quotedInfo.quotedMessage
        };
    }

    const mediaMessage = targetMessage.message?.imageMessage || targetMessage.message?.videoMessage || targetMessage.message?.documentMessage || targetMessage.message?.stickerMessage;

    if (!mediaMessage) {
        await sock.sendMessage(chatId, { 
            text: 'Please reply to an image/video/sticker with .smeme <text>, or send an image/video/sticker with .smeme <text> as the caption.\n\nExample: .smeme TOP TEXT | BOTTOM TEXT'
        },{ quoted: messageToQuote });
        return;
    }

    // Check if text is provided
    if (!text || text.trim() === '') {
        await sock.sendMessage(chatId, { 
            text: 'Please provide meme text! Use "|" to separate top and bottom text.\n\nExample: .smeme TOP TEXT | BOTTOM TEXT'
        },{ quoted: messageToQuote });
        return;
    }

    try {
        const mediaBuffer = await downloadMediaMessage(targetMessage, 'buffer', {}, { 
            logger: undefined, 
            reuploadRequest: sock.updateMediaMessage 
        });

        if (!mediaBuffer) {
            await sock.sendMessage(chatId, { 
                text: 'Failed to download media. Please try again.'
            });
            return;
        }

        // Create temp directory if it doesn't exist
        const tmpDir = path.join(process.cwd(), 'tmp');
        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
        }

        // Generate temp file paths
        const randomId = Date.now();
        const tempInput = path.join(tmpDir, `temp_${randomId}`);
        const tempOutput = path.join(tmpDir, `meme_${randomId}.webp`);

        // Write media to temp file
        fs.writeFileSync(tempInput, mediaBuffer);

        // Check if media is animated (GIF or video)
        const isAnimated = mediaMessage.mimetype?.includes('gif') || 
                          mediaMessage.mimetype?.includes('video') || 
                          mediaMessage.seconds > 0;

        // Split text into top and bottom parts using "|" separator
        const [topText, bottomText] = text.split('|').map(t => t.trim());
        
        // Escape special characters for ffmpeg
        const escapeText = (text) => {
            return text
                .replace(/\\/g, '\\\\')
                .replace(/'/g, "'\\''")
                .replace(/:/g, '\\:')
                .replace(/\[/g, '\\[')
                .replace(/\]/g, '\\]')
                .replace(/,/g, '\\,')
                .replace(/;/g, '\\;');
        };

        // Prepare text overlay filter for ffmpeg
        let textFilter = '';
        
        if (topText) {
            const escapedTopText = escapeText(topText);
            textFilter += `drawtext=text='${escapedTopText}':fontcolor=white:fontsize=50:x=(w-tw)/2:y=20:borderw=3:bordercolor=black:fontfile='C\\\\:/Windows/Fonts/impact.ttf',`;
        }
        
        if (bottomText) {
            const escapedBottomText = escapeText(bottomText);
            textFilter += `drawtext=text='${escapedBottomText}':fontcolor=white:fontsize=50:x=(w-tw)/2:y=h-th-20:borderw=3:bordercolor=black:fontfile='C\\\\:/Windows/Fonts/impact.ttf',`;
        }
        
        // Remove trailing comma if exists
        if (textFilter.endsWith(',')) {
            textFilter = textFilter.slice(0, -1);
        }

        // Prepare ffmpeg command with text overlay
        let ffmpegCommand;
        
        if (isAnimated) {
            if (textFilter) {
                // For animated content, apply text overlay and crop to square
                ffmpegCommand = `ffmpeg -i "${tempInput}" -vf "crop=min(iw\\,ih):min(iw\\,ih),scale=512:512,${textFilter},fps=15" -c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p -quality 75 -compression_level 6 "${tempOutput}"`;
            } else {
                ffmpegCommand = `ffmpeg -i "${tempInput}" -vf "crop=min(iw\\,ih):min(iw\\,ih),scale=512:512,fps=15" -c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p -quality 75 -compression_level 6 "${tempOutput}"`;
            }
        } else {
            if (textFilter) {
                // For static content, apply text overlay and crop to square
                ffmpegCommand = `ffmpeg -i "${tempInput}" -vf "crop=min(iw\\,ih):min(iw\\,ih),scale=512:512,${textFilter},format=rgba" -c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p -quality 75 -compression_level 6 "${tempOutput}"`;
            } else {
                ffmpegCommand = `ffmpeg -i "${tempInput}" -vf "crop=min(iw\\,ih):min(iw\\,ih),scale=512:512,format=rgba" -c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p -quality 75 -compression_level 6 "${tempOutput}"`;
            }
        }

        // Alternative font paths (for different OS)
        const fontPaths = [
            'C\\\\:/Windows/Fonts/impact.ttf',
            '/usr/share/fonts/truetype/msttcorefonts/impact.ttf',
            '/usr/share/fonts/TTF/impact.ttf',
            '/Library/Fonts/impact.ttf'
        ];

        let ffmpegSuccess = false;
        let lastError = null;

        // Try different font paths
        for (const fontPath of fontPaths) {
            try {
                const altFfmpegCommand = ffmpegCommand.replace(/fontfile='[^']*'/g, `fontfile='${fontPath}'`);
                
                await new Promise((resolve, reject) => {
                    exec(altFfmpegCommand, (error, stdout, stderr) => {
                        if (error) {
                            reject(error);
                        } else {
                            resolve();
                        }
                    });
                });
                
                ffmpegSuccess = true;
                break;
            } catch (error) {
                lastError = error;
                console.log(`Tried font path ${fontPath}, failed. Trying next...`);
            }
        }

        // If all font paths fail, try without font specification
        if (!ffmpegSuccess && textFilter) {
            try {
                const noFontCommand = ffmpegCommand.replace(/fontfile='[^']*'/g, '');
                await new Promise((resolve, reject) => {
                    exec(noFontCommand, (error, stdout, stderr) => {
                        if (error) {
                            reject(error);
                        } else {
                            resolve();
                        }
                    });
                });
                ffmpegSuccess = true;
            } catch (error) {
                lastError = error;
            }
        }

        if (!ffmpegSuccess) {
            throw lastError || new Error('FFmpeg processing failed');
        }

        // Read the WebP file
        const webpBuffer = fs.readFileSync(tempOutput);

        // Add metadata using webpmux
        const img = new webp.Image();
        await img.load(webpBuffer);

        // Create metadata
        const json = {
            'sticker-pack-id': crypto.randomBytes(32).toString('hex'),
            'sticker-pack-name': settings.packname || 'June-x Meme',
            'emojis': ['😂']
        };

        // Create exif buffer
        const exifAttr = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00]);
        const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf8');
        const exif = Buffer.concat([exifAttr, jsonBuffer]);
        exif.writeUIntLE(jsonBuffer.length, 14, 4);

        // Set the exif data
        img.exif = exif;

        // Get the final buffer with metadata
        const finalBuffer = await img.save(null);

        // Send the sticker
        await sock.sendMessage(chatId, { 
            sticker: finalBuffer
        },{ quoted: messageToQuote });

        // Cleanup temp files
        try {
            fs.unlinkSync(tempInput);
            fs.unlinkSync(tempOutput);
        } catch (err) {
            console.error('Error cleaning up temp files:', err);
        }

    } catch (error) {
        console.error('Error in smeme command:', error);
        await sock.sendMessage(chatId, { 
            text: 'Failed to create meme sticker! Make sure ffmpeg is installed and try with a different image.\n\nError: ' + error.message
        });
    }
}

module.exports = smemeCommand;
