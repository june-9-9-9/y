const { getAntiCallSettings, updateAntiCallSettings } = require('../lib/database');

// Handle incoming calls
async function handleIncomingCall(sock, callData) {
  try {
    const settings = await getAntiCallSettings();
    if (!settings.status) return;

    const call = callData[0];
    const callerJid = call.from;
    console.log(`📞 Incoming call from ${callerJid} - Action: ${settings.action}`);

    // Handle block action
    if (settings.action === 'block') {
      try {
        await sock.updateBlockStatus(callerJid, 'block');
        console.log(`🚫 Blocked caller: ${callerJid}`);

        const adminJid = process.env.ADMIN_JID;
        if (adminJid) {
          await sock.sendMessage(`${adminJid}@s.whatsapp.net`, {
            text: `🚨 *Call Blocked*\n📞 Caller: ${callerJid}\n🕐 Time: ${new Date().toLocaleString()}\n📝 Reason: Anti-call protection`
          });
        }
      } catch (err) {
        console.error('Error blocking user:', err);
      }
    }

    // Reject call
    try {
      await sock.rejectCall(call.id, call.from);
      console.log(`❌ Rejected call from: ${callerJid}`);
    } catch (err) {
      console.error('Error rejecting call:', err);
    }
  } catch (err) {
    console.error('Error in call handler:', err);
  }
}

// Anti-call command
async function anticallCommand(sock, chatId, message) {
  try {
    await sock.sendMessage(chatId, { react: { text: '📞', key: message.key } });

    const senderJid = message.key.participant || message.key.remoteJid;
    const ownerJid = process.env.OWNER_JID || '';
    const isOwner = senderJid === ownerJid || message.key.fromMe;

    if (!isOwner) {
      return sock.sendMessage(chatId, { text: "❌ Owner-only command." }, { quoted: message });
    }

    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || "";
    const [cmd, sub, ...args] = text.split(' ');
    const value = args.join(' ').trim();
    const settings = await getAntiCallSettings();
    const prefix = ".";

    if (!sub) {
      return sock.sendMessage(chatId, {
        text: `*📜 Anti-Call Settings*\n\n🔹 Status: ${settings.status ? '✅ ON' : '❌ OFF'}\n🔹 Action: ${settings.action}\n\n*🛠 Commands:*\n${prefix}anticall on/off\n${prefix}anticall action reject/block`
      }, { quoted: message });
    }

    switch (sub.toLowerCase()) {
      case 'on':
      case 'off':
        await updateAntiCallSettings({ status: sub === 'on' });
        return sock.sendMessage(chatId, { text: `Anti-call ${sub === 'on' ? '✅ ENABLED' : '❌ DISABLED'}` }, { quoted: message });

      case 'action':
        if (!['reject', 'block'].includes(value)) {
          return sock.sendMessage(chatId, { text: '❌ Invalid action. Use reject/block.' }, { quoted: message });
        }
        await updateAntiCallSettings({ action: value });
        return sock.sendMessage(chatId, { text: `✅ Action set to ${value.toUpperCase()}` }, { quoted: message });

      default:
        return sock.sendMessage(chatId, { text: '❌ Invalid command.' }, { quoted: message });
    }
  } catch (err) {
    console.error("Anti-call command error:", err);
    return sock.sendMessage(chatId, { text: "🚫 Error updating anti-call settings." }, { quoted: message });
  }
}

module.exports = { anticallCommand, handleIncomingCall };
