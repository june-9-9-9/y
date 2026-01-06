const settings = require('../settings');
const { addSudo, removeSudo, getSudoList } = require('../lib/index');

/**
 * Normalize and extract JID from mentions or raw text.
 * @param {object} msg - WhatsApp message object
 * @returns {string|null} JID string or null
 */
function getTargetJid(msg) {
  try {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
    if (mentioned?.length) return mentioned[0];

    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
    const match = text.match(/\b(\d{7,15})\b/);
    return match ? `${match[1]}@s.whatsapp.net` : null;
  } catch {
    return null;
  }
}

/**
 * Handle sudo commands (.sudo add/del/list).
 */
async function sudoCommand(sock, chatId, msg) {
  try {
    const sender = msg.key.participant || msg.key.remoteJid;
    const owner = `${settings.ownerNumber}@s.whatsapp.net`;
    const isOwner = msg.key.fromMe || sender === owner;

    const raw = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
    const [ , action ] = raw.trim().split(/\s+/);
    const sub = (action || '').toLowerCase();

    if (!['add','del','remove','list'].includes(sub)) {
      return sock.sendMessage(chatId, {
        text: '⚙️ *Usage*\n.sudo add <@user|number>\n.sudo del <@user|number>\n.sudo list'
      }, { quoted: msg });
    }

    if (sub === 'list') {
      const list = await getSudoList();
      return sock.sendMessage(chatId, {
        text: list?.length ? `👑 *Sudo Users:*\n${list.map((j,i)=>`${i+1}. ${j}`).join('\n')}` : '📭 No sudo users set.'
      }, { quoted: msg });
    }

    if (!isOwner) {
      return sock.sendMessage(chatId, {
        text: '❌ Only *owner* can add/remove sudo users.\nUse `.sudo list` to view.'
      }, { quoted: msg });
    }

    const target = getTargetJid(msg);
    if (!target) {
      return sock.sendMessage(chatId, { text: '⚠️ Mention a user or provide a valid number.' }, { quoted: msg });
    }

    if (sub === 'add') {
      const ok = await addSudo(target);
      return sock.sendMessage(chatId, { text: ok ? `✅ Added sudo: *${target}*` : '❌ Failed to add sudo.' }, { quoted: msg });
    }

    if (['del','remove'].includes(sub)) {
      if (target === owner) {
        return sock.sendMessage(chatId, { text: '⚠️ Owner cannot be removed.' }, { quoted: msg });
      }
      const ok = await removeSudo(target);
      return sock.sendMessage(chatId, { text: ok ? `✅ Removed sudo: *${target}*` : '❌ Failed to remove sudo.' }, { quoted: msg });
    }
  } catch (err) {
    console.error('sudoCommand error:', err);
    await sock.sendMessage(chatId, { text: '⚠️ Unexpected error while processing sudo command.' }, { quoted: msg });
  }
}

module.exports = sudoCommand;
