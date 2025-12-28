const fetch = require('node-fetch');

async function inspectCommand(sock, chatId, message, userMessage, senderId) {
  if (!userMessage) {
    await sock.sendMessage(chatId, { text: "Enter URL" }, { quoted: message });
    return;
  }

  try {
    let url = userMessage.trim();
    let res = await fetch(url);

    // ✅ Check for HTTP errors first
    if (!res.ok) {
      throw new Error(`HTTP Error ${res.status} ${res.statusText}`);
    }

    // ✅ Only parse if response is OK
    if (res.headers.get('Content-Type')?.includes('application/json')) {
      let json = await res.json();
      await sock.sendMessage(chatId, { text: JSON.stringify(json, null, 2) }, { quoted: message });
    } else {
      let resText = await res.text();
      await sock.sendMessage(chatId, { text: resText }, { quoted: message });
    }

  } catch (error) {
    await sock.sendMessage(chatId, { text: `Error fetching URL: ${error.message}` }, { quoted: message });
  }
}

module.exports = inspectCommand;
