const fs = require("fs");
const axios = require("axios");
const yts = require("yt-search");
const path = require("path");

async function playCommand(sock, chatId, message) {
  try {
    // React to command
    await sock.sendMessage(chatId, {
      react: { text: "🎼", key: message.key },
    });

    // Ensure temp directory exists
    const tempDir = path.join(__dirname, "temp");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

    // Extract query
    const text =
      message.message?.conversation ||
      message.message?.extendedTextMessage?.text ||
      "";
    const parts = text.trim().split(" ");
    const query = parts.slice(1).join(" ").trim();

    if (!query) {
      return sock.sendMessage(
        chatId,
        { text: "🎵 Provide a song name!\nExample: .play Not Like Us" },
        { quoted: message }
      );
    }

    if (query.length > 100) {
      return sock.sendMessage(
        chatId,
        { text: "📝 Song name too long! Max 100 chars." },
        { quoted: message }
      );
    }

    // Search YouTube
    const searchResult = (await yts(`${query} official`)).videos[0];
    if (!searchResult) {
      return sock.sendMessage(
        chatId,
        { text: "😕 Couldn't find that song. Try another one!" },
        { quoted: message }
      );
    }

    const video = searchResult;
    const apiUrl = `https://apis.xwolf.space/download/ytmp3?url=${encodeURIComponent(
      video.url
    )}`;

    // Fetch MP3 download link
    const response = await axios.get(apiUrl, { timeout: 30000 });
    const apiData = response.data;

    if (!apiData?.success || !apiData?.downloadUrl) {
      throw new Error("API failed to fetch track!");
    }

    const timestamp = Date.now();
    const fileName = `audio_${timestamp}.mp3`;
    const filePath = path.join(tempDir, fileName);

    // Download MP3 with large file support
    const audioResponse = await axios({
      method: "get",
      url: apiData.downloadUrl,
      responseType: "stream",
      timeout: 0, // allow long downloads
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    const writer = fs.createWriteStream(filePath);

    // Optional: progress logging
    let downloaded = 0;
    audioResponse.data.on("data", (chunk) => {
      downloaded += chunk.length;
      console.log(`Downloaded ${Math.round(downloaded / 1024 / 1024)} MB...`);
    });

    audioResponse.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", (err) => {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath); // cleanup partial file
        reject(err);
      });
    });

    if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
      throw new Error("Download failed or empty file!");
    }

    // Notify user
    const title = (apiData.title || video.title).substring(0, 100);
    await sock.sendMessage(chatId, {
      text: `_🎶 Playing:_\n_${title}_`,
    });

    await sock.sendMessage(
      chatId,
      {
        document: { url: filePath },
        mimetype: "audio/mpeg",
        fileName: `${title}.mp3`,
      },
      { quoted: message }
    );

    // Cleanup
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (error) {
    console.error("Play command error:", error);
    await sock.sendMessage(
      chatId,
      { text: `🚫 Error: ${error.message}` },
      { quoted: message }
    );
  }
}

module.exports = playCommand;
