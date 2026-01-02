const fs = require("fs");
const axios = require("axios");
const yts = require("yt-search");
const path = require("path");

const YT_PATTERNS = {
  VIDEO: /(?:watch\?v=|youtu\.be\/|embed\/|shorts\/|live\/|music\.youtube\.com\/watch\?v=)([\w-]{11})/,
  PLAYLIST: /playlist\?list=/,
  CHANNEL: /\/(channel|user|c)\//
};

const isYouTubeURL = url => /youtu(\.be|be\.com)/.test(url);
const getVideoId = url => (url.match(YT_PATTERNS.VIDEO) || [])[1];
const classifyURL = url => {
  if (YT_PATTERNS.PLAYLIST.test(url)) return "playlist";
  if (YT_PATTERNS.CHANNEL.test(url)) return "channel";
  if (getVideoId(url)) return "video";
  return "other";
};

async function ytdocvideoCommand(sock, chatId, message) {
  try {
    await sock.sendMessage(chatId, { react: { text: "🎬", key: message.key } });

    const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
    const query = text.split(" ").slice(1).join(" ").trim();
    if (!query) return sock.sendMessage(chatId, { text: "🎬 Provide a YouTube link or name!" }, { quoted: message });
    if (query.length > 200) return sock.sendMessage(chatId, { text: "📝 Input too long! Max 200 chars." }, { quoted: message });

    let video;
    if (isYouTubeURL(query)) {
      const type = classifyURL(query);
      if (type !== "video") return sock.sendMessage(chatId, { text: `❌ ${type} URLs not supported.` }, { quoted: message });
      const id = getVideoId(query);
      if (!id) return sock.sendMessage(chatId, { text: "❌ Invalid video URL." }, { quoted: message });
      video = await yts({ videoId: id }).catch(() => null);
    }
    if (!video) {
      const res = await yts(query);
      video = res.videos[0];
      if (!video) return sock.sendMessage(chatId, { text: "🚫 Couldn't find that video." }, { quoted: message });
    }

    const apiUrl = `https://veron-apis.zone.id/downloader/youtube1?url=${encodeURIComponent(video.url)}`;
    const { data } = await axios.get(apiUrl, { timeout: 10000 });
    if (!data?.result?.downloadUrl?.startsWith("http")) throw new Error("API error");

    const filePath = path.join(__dirname, "temp", `video_${Date.now()}.mp4`);
    const writer = fs.createWriteStream(filePath);
    (await axios.get(data.result.downloadUrl, { responseType: "stream", timeout: 300000 })).data.pipe(writer);
    await new Promise((res, rej) => { writer.on("finish", res); writer.on("error", rej); });

    const sizeMB = (fs.statSync(filePath).size / 1024 / 1024).toFixed(2);
    if (sizeMB > 50) return sock.sendMessage(chatId, { text: `📦 Too large (${sizeMB} MB). Max 50 MB.` }, { quoted: message });

    await sock.sendMessage(chatId, {
      document: { url: filePath },
      mimetype: "video/mp4",
      fileName: `${video.title.slice(0, 100).replace(/[^\w\s-]/g, "")}.mp4`,
      caption: `↘️ *Video Downloaded*\n\n*Title:* ${video.title}\n*Duration:* ${video.timestamp || "N/A"}\n*Channel:* ${video.author?.name || "Unknown"}\n*Size:* ${sizeMB} MB`
    }, { quoted: message });

    fs.unlinkSync(filePath);
  } catch (e) {
    const errors = {
      timeout: "⏱️ Download timeout!",
      "API error": "🔧 API error!",
      "empty file": "📭 Download failed!",
      ENOTFOUND: "🌐 Network error!",
      ECONNREFUSED: "🌐 Network error!"
    };
    await sock.sendMessage(chatId, { text: errors[e.message] || `🚫 Error: ${e.message}` }, { quoted: message });
  }
}

module.exports = ytdocvideoCommand;
