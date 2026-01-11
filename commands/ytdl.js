const yts = require('yt-search');
const axios = require('axios');
const fetch = require('node-fetch');

const ytRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/;

async function getVideoInfo(input) {
  if (ytRegex.test(input)) {
    const id = input.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/)?.[1];
    if (!id) throw new Error("Invalid YouTube URL");
    return await yts({ videoId: id });
  }
  const { videos } = await yts(input);
  if (!videos?.length) throw new Error("No results found");
  return videos[0];
}

async function fetchThumb(url) {
  try {
    const res = await fetch(url);
    return Buffer.from(await res.arrayBuffer());
  } catch { return null; }
}

async function ytplayCommand(sock, chatId, msg) {
  try {
    await sock.sendMessage(chatId, { react: { text: "📺", key: msg.key } });
    const input = (msg.message?.conversation || msg.message?.extendedTextMessage?.text)?.split(' ').slice(1).join(' ').trim();
    if (!input) return sock.sendMessage(chatId, { text: "Provide a YouTube link or title!" }, { quoted: msg });

    const info = await getVideoInfo(input);
    const { data } = await axios.get(`https://veron-apis.zone.id/downloader/youtube1?url=${info.url}`);
    if (!data?.result?.downloadUrl) throw new Error("API failed");

    const caption = `*📹 YouTube Video*\n\n*Title:* ${info.title}\n*Duration:* ${info.timestamp || "?"}\n*Views:* ${info.views || "?"}\n*Uploaded:* ${info.ago || "?"}`;
    await sock.sendMessage(chatId, {
      video: { url: data.result.downloadUrl },
      mimetype: "video/mp4",
      caption,
      thumbnail: await fetchThumb(info.thumbnail)
    }, { quoted: msg });

    await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
  } catch (e) {
    await sock.sendMessage(chatId, { text: e.message || "Download failed" }, { quoted: msg });
    await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
  }
}

async function ytsongCommand(sock, chatId, msg) {
  try {
    await sock.sendMessage(chatId, { react: { text: "🎵", key: msg.key } });
    const input = (msg.message?.conversation || msg.message?.extendedTextMessage?.text)?.split(' ').slice(1).join(' ').trim();
    if (!input) return sock.sendMessage(chatId, { text: "Provide a YouTube link or song name!" }, { quoted: msg });

    const info = await getVideoInfo(input);
    const { data } = await axios.get(`https://api.privatezia.biz.id/api/downloader/ytmp3?url=${info.url}`);
    if (!data?.result?.downloadUrl) throw new Error("API failed");

    const caption = `*🎵 YouTube Song*\n\n*Title:* ${data.result.title || info.title}\n*Duration:* ${info.timestamp || "?"}\n*Size:* ${data.result.size || "?"}\n*Views:* ${info.views || "?"}\n*Uploaded:* ${info.ago || "?"}`;
    await sock.sendMessage(chatId, {
      audio: { url: data.result.downloadUrl },
      mimetype: "audio/mpeg",
      fileName: `${(data.result.title || info.title).replace(/[^\w\s]/g, '')}.mp3`,
      caption,
      thumbnail: await fetchThumb(info.thumbnail),
      contextInfo: { externalAdReply: { title: info.title, body: `Duration: ${info.timestamp} • Views: ${info.views}`, mediaUrl: info.url, sourceUrl: info.url } }
    }, { quoted: msg });

    await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
  } catch (e) {
    await sock.sendMessage(chatId, { text: e.message || "Download failed" }, { quoted: msg });
    await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
  }
}

module.exports = { ytplayCommand, ytsongCommand };
