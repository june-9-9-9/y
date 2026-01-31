const fs = require("fs");
const path = require("path");
const { downloadMediaMessage } = require("@whiskeysockets/baileys");

async function tostatusCommand(sock, chatId, message) {
    try {
        // Send reaction
        await sock.sendMessage(chatId, {
            react: { text: '📤', key: message.key }
        });

        const tempDir = path.join(__dirname, "temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        // Extract text
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const parts = text?.split(' ') || [];
        const query = parts.slice(1).join(' ').trim();

        // Extract quoted message
        const quotedInfo = message.message?.extendedTextMessage?.contextInfo;
        const quoted = quotedInfo?.quotedMessage;

        // Load users from JSON file
        const usersFile = path.join(__dirname, "users.json");
        let users = [];
        if (fs.existsSync(usersFile)) {
            try {
                users = JSON.parse(fs.readFileSync(usersFile));
            } catch (err) {
                console.error("Failed to parse users.json:", err);
            }
        }

        // Status options
        const statusOptions = { statusJidList: users };

        // Check if there's content
        if (!query && !quoted) {
            return await sock.sendMessage(chatId, { 
                text: `*Usage:*\n- Reply to an image, video, or audio\n- Send a text to post it as a status\n\nExample: .tostatus Hello everyone!` 
            }, { quoted: message });
        }

        // Handle media
        if (quoted) {
            let mediaPath;
            try {
                if (quoted.imageMessage) {
                    const buffer = await downloadMediaMessage(
                        { message: quoted },
                        "buffer",
                        {},
                        { reuploadRequest: sock }
                    );
                    const timestamp = Date.now();
                    mediaPath = path.join(tempDir, `status_img_${timestamp}.jpg`);
                    fs.writeFileSync(mediaPath, buffer);

                    await sock.sendMessage("status@broadcast", 
                        { image: { url: mediaPath }, caption: query || "" }, 
                        statusOptions
                    );

                    fs.unlinkSync(mediaPath);
                    return await sock.sendMessage(chatId, { text: "✅ Image posted to status." }, { quoted: message });
                }

                if (quoted.videoMessage) {
                    const buffer = await downloadMediaMessage(
                        { message: quoted },
                        "buffer",
                        {},
                        { reuploadRequest: sock }
                    );
                    const timestamp = Date.now();
                    mediaPath = path.join(tempDir, `status_vid_${timestamp}.mp4`);
                    fs.writeFileSync(mediaPath, buffer);

                    await sock.sendMessage("status@broadcast", 
                        { video: { url: mediaPath }, caption: query || "" }, 
                        statusOptions
                    );

                    fs.unlinkSync(mediaPath);
                    return await sock.sendMessage(chatId, { text: "✅ Video posted to status." }, { quoted: message });
                }

                if (quoted.audioMessage) {
                    const buffer = await downloadMediaMessage(
                        { message: quoted },
                        "buffer",
                        {},
                        { reuploadRequest: sock }
                    );
                    const timestamp = Date.now();
                    mediaPath = path.join(tempDir, `status_audio_${timestamp}.mp3`);
                    fs.writeFileSync(mediaPath, buffer);

                    await sock.sendMessage("status@broadcast", 
                        { audio: { url: mediaPath }, mimetype: "audio/mp4", ptt: true }, 
                        statusOptions
                    );

                    fs.unlinkSync(mediaPath);
                    return await sock.sendMessage(chatId, { text: "✅ Audio posted to status." }, { quoted: message });
                }

                return await sock.sendMessage(chatId, { text: "⚠️ Unsupported media type. Reply to an image, video, or audio." }, { quoted: message });

            } catch (mediaError) {
                console.error("Media processing error:", mediaError);
                throw new Error("Failed to process media file.");
            }
        }

        // Handle text status
        if (query) {
            await sock.sendMessage("status@broadcast", { text: query }, statusOptions);
            return await sock.sendMessage(chatId, { text: "✅ Text status posted." }, { quoted: message });
        }

    } catch (error) {
        console.error("Tostatus command error:", error);
        return await sock.sendMessage(chatId, { text: `🚫 Error: ${error.message || "Failed to post status"}` }, { quoted: message });
    }
}

module.exports = tostatusCommand;
