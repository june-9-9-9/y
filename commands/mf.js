const axios = require('axios');
const cheerio = require('cheerio');

function createFakeContact(message) {
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "status@broadcast",
            fromMe: false,
            id: "JUNE X"
        },
        message: {
            contactMessage: {
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:DAVE X\nitem1.TEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

async function MediaFire(url, options) {
    try {
        let mime;
        options = options ? options : {};
        const res = await axios.get(url, options);
        const $ = cheerio.load(res.data);
        const hasil = [];
        const link = $('a#downloadButton').attr('href');
        const size = $('a#downloadButton').text().replace('Download', '').replace('(', '').replace(')', '').replace('\n', '').replace('\n', '').replace('                         ', '');
        const seplit = link.split('/');
        const nama = seplit[5];
        mime = nama.split('.');
        mime = mime[1];
        hasil.push({ nama, mime, size, link });
        return hasil;
    } catch (err) {
        return err;
    }
}

async function mediafireCommand(sock, chatId, message) {
    const fake = createFakeContact(message);

    const text = message.message?.conversation || 
                 message.message?.extendedTextMessage?.text || '';

    const url = text.split(' ').slice(1).join(' ').trim();

    if (!url) {
        return sock.sendMessage(chatId, { 
            text: "↘️ Provide mediafire link...\n\nmediafire https://www.mediafire.com/file/...."
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

        await sock.sendMessage(chatId, {
            document: {
                url: fileInfo[0].link,
            },
            fileName: fileInfo[0].nama,
            mimetype: fileInfo[0].mime,
            caption: ``,
        }, { quoted: fake });

    } catch (error) {
        console.error("MediaFire Error:", error);
        await sock.sendMessage(chatId, { 
            text: "Failed to download file"
        }, { quoted: fake });
    }
}

module.exports = mediafireCommand;
