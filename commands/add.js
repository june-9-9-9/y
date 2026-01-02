async function addCommand(sock, chatId, message) {
  try {
    await sock.sendMessage(chatId, { react: { text: "➕", key: message.key } });

    if (!chatId.endsWith('@g.us'))
      return sock.sendMessage(chatId, { text: "❌ Group only" }, { quoted: message });

    const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
    const target = text ? text.replace(/\D/g, '') + '@s.whatsapp.net' : message.quoted?.sender;
    if (!target) return sock.sendMessage(chatId, { text: "📌 Usage: .add 2547xxxxxxx or reply" }, { quoted: message });

    const meta = await sock.groupMetadata(chatId);
    const participants = meta.participants || [];
    const normalize = jid => jid?.split(':')[0].split('@')[0] || '';

    const isAdmin = jid => {
      const p = participants.find(x => normalize(x.id) === normalize(jid));
      return p && ['admin', 'superadmin'].includes(p.admin);
    };

    if (!isAdmin(sock.user.id)) return sock.sendMessage(chatId, { text: "❌ I need admin rights" }, { quoted: message });
    if (!isAdmin(message.key.participant || message.key.remoteJid))
      return sock.sendMessage(chatId, { text: "❌ Only admins can add" }, { quoted: message });

    const res = await sock.groupParticipantsUpdate(chatId, [target], 'add');
    for (let r of res) {
      const statusMsg = {
        408: "❌ Already in group",
        401: "🚫 I'm blocked",
        409: "⚠️ User recently left",
        500: "❌ Invalid request"
      }[r.status];

      if (statusMsg)
        return sock.sendMessage(chatId, { text: statusMsg, mentions: [target] }, { quoted: message });

      if (r.status === 403) {
        const link = await sock.groupInviteCode(chatId);
        await sock.sendMessage(chatId, {
          text: `@${target.split('@')[0]} has privacy settings.\n📩 Invite link sent.`,
          mentions: [target]
        }, { quoted: message });
        try {
          await sock.sendMessage(target, {
            text: `📢 *Group Invitation*\n🏷️ ${meta.subject}\n🔗 https://chat.whatsapp.com/${link}`,
            detectLink: true
          });
        } catch {
          await sock.sendMessage(chatId, { text: "❌ Failed to send invite" }, { quoted: message });
        }
        return;
      }

      await sock.sendMessage(chatId, {
        text: `✅ Added @${target.split('@')[0]}!`,
        mentions: [target]
      }, { quoted: message });
    }

    await sock.sendMessage(chatId, { react: { text: "✅", key: message.key } });
  } catch (err) {
    console.error("AddCommand error:", err);
    const msg = /not authorized/.test(err.message) ? "❌ I'm not admin"
      : /not admin/.test(err.message) ? "❌ Only admins can add"
      : "⚠️ Could not add user!";
    await sock.sendMessage(chatId, { text: msg }, { quoted: message });
    await sock.sendMessage(chatId, { react: { text: "❌", key: message.key } });
  }
}

module.exports = addCommand;
