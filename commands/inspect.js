// Owner.js
const axios = require('axios');

async function inspectCommand(sock, chatId, message, senderId, args, userMessage) {
  // Check if user provided a URL
  if (!args || args.length === 0) {
    await sock.sendMessage(chatId, { text: "❌ Provide a valid URL to fetch.\n\nUsage: .fetch <url>" });
    return;
  }

  const url = args[0]; // Get first argument as URL

  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const contentType = response.headers['content-type'];

    if (!contentType) {
      await sock.sendMessage(chatId, { text: "❌ Server did not return a content-type." });
      return;
    }

    console.log("Content-Type:", contentType);
    const buffer = Buffer.from(response.data);
    const filename = url.split('/').pop() || "file";

    // Handle different content types
    if (contentType.includes('application/json')) {
      const json = JSON.parse(buffer.toString());
      const jsonString = JSON.stringify(json, null, 2);
      const truncatedJson = jsonString.length > 4000 ? jsonString.slice(0, 4000) + "..." : jsonString;
      await sock.sendMessage(chatId, { text: "```json\n" + truncatedJson + "\n```" });
      return;
    }

    if (contentType.includes('text/html')) {
      const html = buffer.toString();
      const truncatedHtml = html.length > 4000 ? html.slice(0, 4000) + "..." : html;
      await sock.sendMessage(chatId, { text: truncatedHtml });
      return;
    }

    if (contentType.includes('image')) {
      await sock.sendMessage(chatId, {
        image: buffer,
        caption: url
      }, { quoted: message });
      return;
    }

    if (contentType.includes('video')) {
      await sock.sendMessage(chatId, {
        video: buffer,
        caption: url
      }, { quoted: message });
      return;
    }

    if (contentType.includes('audio')) {
      await sock.sendMessage(chatId, {
        audio: buffer,
        mimetype: "audio/mpeg",
        fileName: filename
      }, { quoted: message });
      return;
    }

    if (contentType.includes('application/pdf')) {
      await sock.sendMessage(chatId, {
        document: buffer,
        mimetype: "application/pdf",
        fileName: filename
      }, { quoted: message });
      return;
    }

    if (contentType.includes('application')) {
      await sock.sendMessage(chatId, {
        document: buffer,
        mimetype: contentType,
        fileName: filename
      }, { quoted: message });
      return;
    }

    if (contentType.includes('text/')) {
      const text = buffer.toString();
      const truncatedText = text.length > 4000 ? text.slice(0, 4000) + "..." : text;
      await sock.sendMessage(chatId, { text: truncatedText });
      return;
    }

    await sock.sendMessage(chatId, { text: "❌ Unsupported or unknown content type." });

  } catch (err) {
    console.error("fetch error:", err);
    await sock.sendMessage(chatId, { text: "❌ Failed to fetch the URL.\nError: " + err.message });
  }
}

module.exports = inspectCommand;
