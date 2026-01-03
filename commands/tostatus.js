const fs = require('fs');
const path = require('path');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

async function tostatusCommand(sock, chatId, message) {
  try {
    await sock.sendMessage(chatId, { react: { text: '📤', key: message.key } });

    if (!message.key.fromMe)
      return sock.sendMessage(chatId, { text: '😡 Command only for the owner.', quoted: message });

    const tempDir = path.join(__dirname, "temp");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

    const sendStatus = async (options, successMsg) => {
      try {
        await sock.sendMessage('status@broadcast', options);
        await sock.sendMessage(chatId, { text: successMsg, quoted: message });
      } catch (err) {
        console.error(err);
        await sock.sendMessage(chatId, { text: '❌ Failed to update status.', quoted: message });
      }
    };

    const handleMedia = async (msg, type, caption = '') => {
      const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: console, reuploadRequest: sock.updateMediaMessage });
      const ext = type === 'imageMessage' ? 'jpg' : 'mp4';
      const filePath = path.join(tempDir, `status_${Date.now()}.${ext}`);
      fs.writeFileSync(filePath, buffer);

      const mediaOptions = {
        imageMessage: { image: fs.readFileSync(filePath), caption },
        videoMessage: { video: fs.readFileSync(filePath), caption },
        audioMessage: { audio: fs.readFileSync(filePath), ptt: msg.message.audioMessage?.ptt, mimetype: 'audio/mp4' }
      }[type];

      await sendStatus(mediaOptions, `✅ ${type.replace('Message','')} status updated!${caption ? `\n\nCaption: ${caption}` : ''}`);
      fs.unlinkSync(filePath);
    };

    const msgType = Object.keys(message.message)[0];
    const mediaTypes = ['imageMessage', 'videoMessage', 'audioMessage'];

    if (msgType === 'extendedTextMessage') {
      const text = message.message.extendedTextMessage.text;
      if (!text) return;
      if (text.length > 1000) return sock.sendMessage(chatId, { text: '📝 Status text too long! Max 1000 chars.', quoted: message });
      await sendStatus({ text }, `✅ Text status updated!\n\nContent: ${text}`);
    } else if (mediaTypes.includes(msgType)) {
      await handleMedia(message, msgType, message.message[msgType]?.caption || '');
    } else if (message.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
      const quoted = message.message.extendedTextMessage.contextInfo.quotedMessage;
      const qType = Object.keys(quoted)[0];
      if (mediaTypes.includes(qType)) {
        await handleMedia({ key: message.key, message: quoted }, qType, quoted[qType]?.caption || message.message.extendedTextMessage.text || '');
      } else if (qType === 'extendedTextMessage') {
        const text = quoted.extendedTextMessage.text;
        if (text.length > 1000) return sock.sendMessage(chatId, { text: '📝 Quoted text too long! Max 1000 chars.', quoted: message });
        await sendStatus({ text }, `✅ Quoted text status updated!\n\nContent: ${text}`);
      } else {
        await sock.sendMessage(chatId, { text: '⚠️ Quoted message type not supported.', quoted: message });
      }
    } else {
      await sock.sendMessage(chatId, {
        text: '⚠️ Please send:\n• Text for text status\n• Image/Video/Audio for media status\n• Or reply to a message to quote it',
        quoted: message
      });
    }
  } catch (err) {
    console.error('⚠️ Unexpected error:', err);
    await sock.sendMessage(chatId, { text: `❌ Unexpected error.\nError: ${err.message}`, quoted: message });
  }
}

module.exports = tostatusCommand;
