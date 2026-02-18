const { isSudo } = require('../lib/index');

const delay = ms => new Promise(res => setTimeout(res, ms));

const isOwnerOrSudo = async (msg) => {
    if (msg?.key?.fromMe === true) return true;
    const senderId = msg?.key?.participant || msg?.key?.remoteJid;
    return senderId ? await isSudo(senderId) : false;
};
const getBotId = sock => sock?.user?.id?.split(':')[0];
const react = async (sock, chatId, key, emoji) => {
  try { await sock.sendMessage(chatId, { react: { text: emoji, key } }); } catch {}
};

// Commands
async function blockCommand(sock, chatId, message) {
  if (!(await isOwnerOrSudo(message))) return sock.sendMessage(chatId, { text: 'Owner-only!', quoted: message });
  const user = message.message?.extendedTextMessage?.contextInfo?.participant;
  if (!user) return sock.sendMessage(chatId, { text: 'Reply to a user to block.', quoted: message });
  if (user.includes(getBotId(sock))) return sock.sendMessage(chatId, { text: 'Cannot block the bot.', quoted: message });

  try {
    await sock.updateBlockStatus(user, 'block');
    await sock.sendMessage(chatId, { text: 'Blocked ✅', quoted: message });
    await react(sock, chatId, message.key, '✅');
  } catch {
    await sock.sendMessage(chatId, { text: 'Block failed 💥', quoted: message });
    await react(sock, chatId, message.key, '💥');
  }
}

async function blocklistCommand(sock, chatId, message) {
  if (!(await isOwnerOrSudo(message))) return sock.sendMessage(chatId, { text: 'Owner-only!', quoted: message });
  const blocked = await sock.fetchBlocklist().catch(() => []);
  if (!blocked.length) return sock.sendMessage(chatId, { text: 'No blocked contacts 📭', quoted: message });

  let text = `Blocked contacts (${blocked.length}):\n\n`;
  blocked.forEach((jid, i) => text += `${String(i+1).padStart(3,'0')}. ${jid.split('@')[0]} ✅\n`);
  await sock.sendMessage(chatId, { text, quoted: message });
}

async function unblockallCommand(sock, chatId, message) {
  if (!(await isOwnerOrSudo(message))) return sock.sendMessage(chatId, { text: 'Owner-only!', quoted: message });
  const blocked = await sock.fetchBlocklist().catch(() => []);
  if (!blocked.length) return sock.sendMessage(chatId, { text: 'No contacts to unblock 📭', quoted: message });

  let count = 0;
  for (const jid of blocked) {
    try { await sock.updateBlockStatus(jid, 'unblock'); count++; await delay(300); } catch {}
  }
  await sock.sendMessage(chatId, { text: `Unblocked ${count}/${blocked.length} ✅`, quoted: message });
}

module.exports = { blockCommand, blocklistCommand, unblockallCommand };
