const axios = require('axios');
const FormData = require('form-data');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

async function transcribeCommand(sock, chatId, message) {
    try {
        // Initial reaction
        await sock.sendMessage(chatId, {
            react: { text: '🎤', key: message.key }
        });

        // Extract quoted message
        const quotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quotedMsg) {
            return await sock.sendMessage(chatId, {
                text: '🎤 *Audio/Video Transcription*\n\n❌ Please reply to an audio or video message!\n\n📝 *Usage:*\n• Reply to audio with: .transcribe\n• Reply to video with: .speech\n\n🔊 *Supported formats:*\n• Audio (MP3, OGG, voice notes)\n• Video (with audio track)\n\n💡 *Tips:*\n• Clear audio works best\n• Keep clips under 5 minutes'
            }, { quoted: message });
        }

        // Detect media type
        let mediaType;
        if (quotedMsg.audioMessage) {
            mediaType = 'audio';
        } else if (quotedMsg.videoMessage) {
            mediaType = 'video';
        } else {
            return await sock.sendMessage(chatId, {
                text: '🎤 *Audio/Video Transcription*\n\n❌ Unsupported media type!\n\n📌 Please reply to:\n• Audio message\n• Video message\n• Voice note\n\n❌ Not supported:\n• Images\n• Documents\n• Text messages'
            }, { quoted: message });
        }

        // Show "recording" presence
        await sock.sendPresenceUpdate('recording', chatId);

        // ✅ FIX: Pass the full quoted message object
        const buffer = await downloadMediaMessage(
            { message: quotedMsg },
            'buffer',
            {},
            { sock }
        );

        // Upload to temporary hosting
        const formData = new FormData();
        formData.append('files[]', buffer, {
            filename: `transcribe_${Date.now()}.${mediaType === 'audio' ? 'mp3' : 'mp4'}`
        });

        const uploadResponse = await axios.post('https://uguu.se/upload.php', formData, {
            headers: formData.getHeaders(),
            timeout: 30000
        });

        const mediaUrl = uploadResponse.data.files?.[0]?.url;
        if (!mediaUrl) throw new Error('Failed to upload media');

        // Call transcription API
        const apiUrl = `https://apiskeith.top/ai/transcribe?q=${encodeURIComponent(mediaUrl)}`;
        const response = await axios.get(apiUrl, { timeout: 60000 });

        if (!response.data?.status || !response.data?.result?.text) {
            throw new Error('No transcription result');
        }

        const transcription = response.data.result.text.trim();

        // Success reaction
        await sock.sendMessage(chatId, {
            react: { text: '✅', key: message.key }
        });

        // Clean output option
        const isClean = message.message?.conversation?.includes('.transcribe clean') 
                     || message.message?.extendedTextMessage?.text?.includes('.transcribe clean');

        // Send transcription
        await sock.sendMessage(chatId, {
            text: isClean 
                ? transcription 
                : `🎤 *Transcription Result*\n\n📝 ${transcription}\n\n🔊 Media Type: ${mediaType.toUpperCase()}`
        }, { quoted: message });

        // Final reaction
        await sock.sendMessage(chatId, {
            react: { text: '📝', key: message.key }
        });

    } catch (error) {
        console.error("Transcription command error:", error);

        await sock.sendMessage(chatId, {
            react: { text: '❌', key: message.key }
        });

        let errorMessage;
        if (error.response?.status === 404) {
            errorMessage = 'Transcription API not found!';
        } else if (error.message.includes('timeout') || error.code === 'ECONNABORTED') {
            errorMessage = 'Transcription timed out! Try shorter clips.';
        } else if (error.code === 'ENOTFOUND') {
            errorMessage = 'Cannot connect to transcription service!';
        } else if (error.response?.status === 429) {
            errorMessage = 'Too many requests! Please wait.';
        } else if (error.response?.status >= 500) {
            errorMessage = 'Service unavailable right now.';
        } else if (error.message.includes('No transcription')) {
            errorMessage = 'No speech detected in the media.';
        } else if (error.message.includes('Failed to upload')) {
            errorMessage = 'Failed to upload media file.';
        } else {
            errorMessage = `Error: ${error.message}`;
        }

        await sock.sendMessage(chatId, {
            text: `🎤 *Transcription Error*\n\n🚫 ${errorMessage}\n\n💡 Tips:\n• Ensure audio is clear\n• Keep clips under 5 minutes\n• Check your internet\n• Retry later`
        }, { quoted: message });
    }
}

module.exports = transcribeCommand;
