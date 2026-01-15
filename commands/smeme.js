const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const webp = require('node-webpmux');
const crypto = require('crypto');
const settings = require('../settings');

async function smemeCommand(sock, chatId, message) {
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const targetMessage = quoted ? { key: { remoteJid: chatId }, message: quoted } : message;
    const mediaMessage = targetMessage.message?.imageMessage || targetMessage.message?.videoMessage || targetMessage.message?.stickerMessage;

    if (!mediaMessage) return sock.sendMessage(chatId, { text: 'Reply/send an image/sticker with caption: .smeme TOP | BOTTOM' }, { quoted: message });

    const caption = message.message?.imageMessage?.caption || message.message?.videoMessage?.caption || message.message?.extendedTextMessage?.text || '';
    if (!caption.trim()) return sock.sendMessage(chatId, { text: 'Provide meme text! Example: .smeme TOP | BOTTOM' }, { quoted: message });

    try {
        const buffer = await downloadMediaMessage(targetMessage, 'buffer', {}, { reuploadRequest: sock.updateMediaMessage });
        const tmpDir = path.join(process.cwd(), 'tmp'); if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
        const inFile = path.join(tmpDir, `in_${Date.now()}`), outFile = path.join(tmpDir, `out_${Date.now()}.webp`);
        fs.writeFileSync(inFile, buffer);

        const [top, bottom] = caption.split('|').map(t => t.trim());
        const textFilter = [top && `drawtext=text='${top}':x=(w-tw)/2:y=20:fontsize=50:fontcolor=white:borderw=3:bordercolor=black`,
                            bottom && `drawtext=text='${bottom}':x=(w-tw)/2:y=h-th-20:fontsize=50:fontcolor=white:borderw=3:bordercolor=black`]
                            .filter(Boolean).join(',');

        const cmd = `ffmpeg -i "${inFile}" -vf "crop=min(iw\\,ih):min(iw\\,ih),scale=512:512${textFilter ? ','+textFilter : ''}" -c:v libwebp -loop 0 -quality 75 "${outFile}"`;
        await new Promise((res, rej) => exec(cmd, (e) => e ? rej(e) : res()));

        const img = new webp.Image(); await img.load(fs.readFileSync(outFile));
        img.exif = Buffer.concat([Buffer.from([0x49,0x49,0x2A,0x00,0x08,0x00,0x00,0x00,0x01,0x00,0x41,0x57,0x07,0x00,0x00,0x00,0x00,0x00,0x16,0x00,0x00,0x00]),
                                   Buffer.from(JSON.stringify({ 'sticker-pack-id': crypto.randomBytes(32).toString('hex'), 'sticker-pack-name': settings.packname || 'MemePack', emojis: ['😂'] }))]);
        const finalBuffer = await img.save(null);
        await sock.sendMessage(chatId, { sticker: finalBuffer }, { quoted: message });

        fs.unlinkSync(inFile); fs.unlinkSync(outFile);
    } catch (e) {
        await sock.sendMessage(chatId, { text: 'Error creating meme sticker: ' + e.message }, { quoted: message });
    }
}

module.exports = smemeCommand;
