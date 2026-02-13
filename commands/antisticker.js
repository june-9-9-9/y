const { setAntisticker, getAntisticker, removeAntisticker } = require('../lib/database');
const isAdmin = require('../lib/isAdmin');

/**
 * Create fake contact for quoted replies
 */
async function antistickerCommand(sock, chatId, msg, senderId) {
  const fakeContact = (m) => {
    const id = m?.key?.participant?.split('@')[0] || m?.key?.remoteJid?.split('@')[0] || '0';
    return {
      key: { participants: "0@s.whatsapp.net", remoteJid: "0@s.whatsapp.net", fromMe: false },
      message: {
        contactMessage: {
          displayName: "JUNE-X",
          vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:JUNE-X\nTEL;waid=${id}:${id}\nEND:VCARD`
        }
      },
      participant: "0@s.whatsapp.net"
    };
  };

  const quoted = fakeContact(msg);
  try {
    if (!(await isAdmin(sock, chatId, senderId)))
      return sock.sendMessage(chatId, { text: '❌ Admins only' }, { quoted });

    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
    const [action, sub] = text.trim().split(/\s+/).slice(1);
    const emoji = { delete: '🗑️', kick: '👢', warn: '⚠️' };

    switch ((action || '').toLowerCase()) {
      case 'on':
        await setAntisticker(chatId, true, 'delete');
        return sock.sendMessage(chatId, { text: '✅ Antisticker ON (Delete)' }, { quoted });
      case 'off':
        await removeAntisticker(chatId);
        return sock.sendMessage(chatId, { text: '❌ Antisticker OFF' }, { quoted });
      case 'set':
        if (!['delete', 'kick', 'warn'].includes(sub))
          return sock.sendMessage(chatId, { text: '❌ Use: delete | kick | warn' }, { quoted });
        await setAntisticker(chatId, true, sub);
        return sock.sendMessage(chatId, { text: `✅ Action: ${emoji[sub]} ${sub.toUpperCase()}` }, { quoted });
      case 'status': {
        const cfg = await getAntisticker(chatId);
        return sock.sendMessage(chatId, {
          text: cfg?.enabled
            ? `✅ ON\n${emoji[cfg.action]} ${cfg.action.toUpperCase()}`
            : '❌ OFF\nUse `.antisticker on`'
        }, { quoted });
      }
      default:
        return sock.sendMessage(chatId, { text: '❌ Commands: on | off | set | status' }, { quoted });
    }
  } catch (e) {
    console.error('antistickerCommand error:', e);
    sock.sendMessage(chatId, { text: '❌ Error' }, { quoted });
  }
}

async function handleStickerDetection(sock, chatId, msg, senderId) {
  const fakeContact = (m) => {
    const id = m?.key?.participant?.split('@')[0] || m?.key?.remoteJid?.split('@')[0] || '0';
    return {
      key: { participants: "0@s.whatsapp.net", remoteJid: "0@s.whatsapp.net", fromMe: false },
      message: {
        contactMessage: {
          displayName: "JUNE-X",
          vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:JUNE-X\nTEL;waid=${id}:${id}\nEND:VCARD`
        }
      },
      participant: "0@s.whatsapp.net"
    };
  };

  try {
    const cfg = await getAntisticker(chatId);
    if (!cfg?.enabled || !msg.message?.stickerMessage) return;
    if (await isAdmin(sock, chatId, senderId)) return;

    const quoted = fakeContact(msg);
    try { await sock.sendMessage(chatId, { delete: msg.key }); } catch (e) { console.error('Delete fail:', e); }

    if (cfg.action === 'warn')
      await sock.sendMessage(chatId, { text: `⚠️ @${senderId.split('@')[0]} Stickers not allowed`, mentions: [senderId] }, { quoted });
    else if (cfg.action === 'kick') {
      await sock.sendMessage(chatId, { text: `🚫 @${senderId.split('@')[0]} removed`, mentions: [senderId] }, { quoted });
      try { await sock.groupParticipantsUpdate(chatId, [senderId], 'remove'); } catch (e) { console.error('Kick fail:', e); }
    }
  } catch (e) {
    console.error('handleStickerDetection error:', e);
  }
}

module.exports = { antistickerCommand, handleStickerDetection };
