const axios = require('axios');
const FormData = require('form-data');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

async function transcribeCommand(sock, chatId, message) {
    try {
        // Initial reaction
        await sock.sendMessage(chatId, {
            react: { text: '🎤', key: message.key }
        });

        // Check if message has quoted audio/video
        const quotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        
        if (!quotedMsg) {
            return await sock.sendMessage(chatId, {
                text: '🎤 *Audio Transcription*\n\n❌ Please reply to an audio or video message!\n\n📝 *Usage:*\n1. Reply to an audio message with: .transcribe\n2. Reply to a video message with: .speech\n\n🔊 *Supported formats:*\n• Audio messages (MP3, OGG)\n• Video messages (with audio)\n• Voice notes\n\n💡 *Tips:*\n• Clear audio works best\n• Try shorter clips (under 5 minutes)'
            }, { quoted: message });
        }

        // Determine media type
        let mediaType = 'unknown';
        let mediaNode = null;

        if (quotedMsg.audioMessage) {
            mediaType = 'audio';
            mediaNode = quotedMsg.audioMessage;
        } else if (quotedMsg.videoMessage) {
            mediaType = 'video';
            mediaNode = quotedMsg.videoMessage;
        } else {
            return await sock.sendMessage(chatId, {
                text: '🎤 *Audio Transcription*\n\n❌ Unsupported media type!\n\n📌 Please reply to:\n• An audio message\n• A video message\n• A voice note\n\n❌ *Not supported:*\n• Images\n• Documents\n• Text messages'
            }, { quoted: message });
        }

        // Update presence to "recording" (processing)
        await sock.sendPresenceUpdate('recording', chatId);

        // Download media as buffer
        const buffer = await downloadMediaMessage(
            { message: mediaNode },
            'buffer',
            {},
            { sock }
        );

        // Upload to temporary hosting (uguu.se)
        const formData = new FormData();
        formData.append('files[]', buffer, {
            filename: `transcribe_${Date.now()}.${mediaType === 'audio' ? 'mp3' : 'mp4'}`
        });

        const uploadResponse = await axios.post('https://uguu.se/upload.php', formData, {
            headers: {
                ...formData.getHeaders(),
            },
            timeout: 30000
        });

        const mediaUrl = uploadResponse.data.files?.[0]?.url;
        if (!mediaUrl) throw new Error('Failed to upload media');

        // Call transcription API
        const apiUrl = `https://apiskeith.vercel.app/ai/transcribe?q=${encodeURIComponent(mediaUrl)}`;
        const response = await axios.get(apiUrl, { timeout: 60000 });

        if (!response.data?.status || !response.data?.result?.text) {
            throw new Error('No transcription result');
        }

        const transcription = response.data.result.text.trim();

        // Success reaction
        await sock.sendMessage(chatId, {
            react: { text: '✅', key: message.key }
        });

        // Decide output mode
        const isClean = message.message?.conversation?.includes('.transcribe clean') 
                     || message.message?.extendedTextMessage?.text?.includes('.transcribe clean');

        // Send transcription result
        await sock.sendMessage(chatId, {
            text: isClean 
                ? transcription 
                : `🎤 *Audio Transcription*\n\n📝 *Transcribed Text:*\n${transcription}\n\n🔊 *Media Type:* ${mediaType.toUpperCase()}\n`
        }, { quoted: message });

        // Final reaction
        await sock.sendMessage(chatId, {
            react: { text: '📝', key: message.key }
        });

    } catch (error) {
        console.error("Transcription command error:", error);

        // Error reaction
        await sock.sendMessage(chatId, {
            react: { text: '❌', key: message.key }
        });

        let errorMessage;
        if (error.response?.status === 404) {
            errorMessage = 'Transcription API endpoint not found!';
        } else if (error.message.includes('timeout') || error.code === 'ECONNABORTED') {
            errorMessage = 'Transcription timed out! Try a shorter audio clip.';
        } else if (error.code === 'ENOTFOUND') {
            errorMessage = 'Cannot connect to transcription service!';
        } else if (error.response?.status === 429) {
            errorMessage = 'Too many transcription requests! Please wait.';
        } else if (error.response?.status >= 500) {
            errorMessage = 'Transcription service is currently unavailable.';
        } else if (error.message.includes('No transcription')) {
            errorMessage = 'No speech detected in the audio.';
        } else if (error.message.includes('Failed to upload')) {
            errorMessage = 'Failed to upload media file.';
        } else {
            errorMessage = `Error: ${error.message}`;
        }

        await sock.sendMessage(chatId, {
            text: `🎤 *Audio Transcription*\n\n🚫 ${errorMessage}\n\n💡 *Tips:*\n• Ensure audio is clear and loud\n• Try clips under 5 minutes\n• Check your internet connection\n• Wait a few minutes and try again`
        }, { quoted: message });
    }
}

module.exports = transcribeCommand;
