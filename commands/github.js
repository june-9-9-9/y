const moment = require('moment-timezone');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

async function githubCommand(sock, chatId, message) {
  // Minimal fake contact
  function createFakeContact(message) {
    const participant = message.key.participant || message.key.remoteJid;
    const userNumber = participant.split('@')[0];

    return {
      key: {
        fromMe: false,
        participant: "0@s.whatsapp.net",
        id: "JUNE-X"
      },
      message: {
        contactMessage: {
          displayName: "JUNE MD",
          vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:JUNE MD\nitem1.TEL;waid=${userNumber}:${userNumber}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`
        }
      }
    };
  }

  try {
    const fkontak = createFakeContact(message);

    const sender = message.key.participant || message.key.remoteJid;
    const userNumber = sender.split('@')[0];
    const userJid = `${userNumber}@s.whatsapp.net`;

    const res = await fetch('https://api.github.com/repos/vinpink2/June-md');
    if (!res.ok) throw new Error('Error fetching repository data');
    const json = await res.json();

    let txt = `🔹  \`𝙹𝚄𝙽𝙴  𝚁𝙴𝙿𝙾 𝙸𝙽𝙵𝙾.\` \n\n`;
    txt += `🔸  *Name* : ${json.name}\n`;
    txt += `🔸  *Watchers* : ${json.watchers_count}\n`;
    txt += `🔸  *Size* : ${(json.size / 1024).toFixed(2)} MB\n`;
    txt += `🔸  *Last Updated* : ${moment(json.updated_at).format('DD/MM/YY - HH:mm:ss')}\n`;
    txt += `🔸  *REPO* : ${json.html_url}\n\n`;    
    txt += `🔹  *Forks* : ${json.forks_count}\n`;
    txt += `🔹  *Stars* : ${json.stargazers_count}\n`;
    txt += `🔹  *Desc* : ${json.description || 'None'}\n\n`;
    // Correct mention string
    txt += `_Hey👋.. @${userNumber}_\n_Thank you for choosing June x Bot, fork and Star the repository_`;

    // Use the local asset image
    const imgPath = path.join(__dirname, '../assets/menu3.jpg');
    const imgBuffer = fs.readFileSync(imgPath);

    // Send message with image and correct mentions
    await sock.sendMessage(chatId, {
      image: imgBuffer,
      caption: txt,
      mentions: [userJid] // must match the @number in caption
    }, { quoted: fkontak });

    // React success ✔️
    await sock.sendMessage(chatId, {
      react: { key: message.key, emoji: '✔️' }
    });

  } catch (error) {
    console.error('Github Command Error:', error);
    await sock.sendMessage(chatId, { 
      text: '❌ Error fetching repository information.' 
    }, { quoted: message });
  }
}

module.exports = githubCommand;
