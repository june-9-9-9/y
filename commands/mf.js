const axios = require('axios');
const cheerio = require('cheerio');

function createFakeContact(message) {
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "status@broadcast",
            fromMe: false,
            id: "JUNE-X"
        },
        message: {
            contactMessage: {
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:JUNE X\nitem1.TEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

async function MediaFire(url, options) {
    try {
        options = options || {};
        const res = await axios.get(url, options);
        const $ = cheerio.load(res.data);

        const link = $('a#downloadButton').attr('href');
        if (!link) return null;

        const size = $('a#downloadButton').text()
            .replace('Download', '')
            .replace(/[()\n]/g, '')
            .trim();

        const seplit = link.split('/');
        const nama = seplit[5]; // actual filename from MediaFire link
        const mime = nama.includes('.') ? nama.split('.').pop() : 'application/octet-stream';

        return [{ nama, mime, size, link }];
    } catch (err) {
        return null;
    }
}

async function mediafireCommand(sock, chatId, message) {
    const fake = createFakeContact(message);

    const text = message.message?.conversation || 
                 message.message?.extendedTextMessage?.text || '';

    const url = text.split(' ').slice(1).join(' ').trim();

    if (!url) {
        return sock.sendMessage(chatId, { 
            text: "Provide mediafire link...\nmediafire https://www.mediafire.com/..."
        }, { quoted: fake });
    }

    if (!url.includes('mediafire.com')) {
        return sock.sendMessage(chatId, { 
            text: "That's not a mediafire link"
        }, { quoted: fake });
    }

    try {
        const fileInfo = await MediaFire(url);

        if (!fileInfo || !fileInfo.length) {
            return sock.sendMessage(chatId, { 
                text: "File no longer available on MediaFire"
            }, { quoted: fake });
        }

        const { nama, mime, link } = fileInfo[0];

        await sock.sendMessage(chatId, {
            document: { url: link },
            fileName: nama,          // ✅ ensures the file keeps its original name
            mimetype: mime,
            caption: `*${nama}*\n`,
        }, { quoted: fake });

    } catch (error) {
        console.error("MediaFire Error:", error);
        await sock.sendMessage(chatId, { 
            text: "Failed to download file"
        }, { quoted: fake });
    }
}

module.exports = mediafireCommand;
