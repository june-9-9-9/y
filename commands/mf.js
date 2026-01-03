const fs = require("fs");
const axios = require('axios');
const path = require('path');

async function mediafireCommand(sock, chatId, message) {
    try {
        // Send reaction
        await sock.sendMessage(chatId, {
            react: { text: '📥', key: message.key }
        });
        
        // Get the message text
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const parts = text.split(' ');
        const url = parts.slice(1).join(' ').trim();

        // Check if URL is provided
        if (!url) {
            return await sock.sendMessage(chatId, { 
                text: '📎 Please provide a MediaFire link.\n\nExample: .mediafire https://www.mediafire.com/file/...' 
            }, { quoted: message });
        }

        // Validate URL format
        if (!url.includes('mediafire.com')) {
            return await sock.sendMessage(chatId, { 
                text: '❌ Invalid MediaFire URL. Please provide a valid MediaFire link.' 
            }, { quoted: message });
        }

        // Inform user about fetching
        await sock.sendMessage(chatId, { 
            text: '⏳ Fetching MediaFire file info...' 
        }, { quoted: message });

        // API endpoint for MediaFire downloader
        const apiUrl = `https://api.nekolabs.web.id/downloader/mediafire?url=${encodeURIComponent(url)}`;
        
        // Fetch file information from API
        const response = await axios.get(apiUrl, { timeout: 20000 });
        const apiData = response.data;

        // Check API response
        if (!apiData?.success || !apiData.result) {
            return await sock.sendMessage(chatId, { 
                text: '💥 Could not fetch the MediaFire file info.' 
            }, { quoted: message });
        }

        const fileInfo = apiData.result;
        const downloadUrl = fileInfo.download_url;
        const fileName = fileInfo.filename;
        const fileSize = fileInfo.filesize;
        const mimetype = fileInfo.mimetype || 'application/octet-stream';

        // Validate download URL
        if (!downloadUrl) {
            return await sock.sendMessage(chatId, { 
                text: '⚠️ Failed to get the download link. Try another MediaFire URL.' 
            }, { quoted: message });
        }

        // Create temporary directory if it doesn't exist
        const tempDir = path.join(__dirname, "temp");
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // Download the file temporarily (optional - can send directly)
        const timestamp = Date.now();
        const tempFileName = `mediafire_${timestamp}_${fileName}`;
        const filePath = path.join(tempDir, tempFileName);

        // Download file
        const fileResponse = await axios({
            method: "get",
            url: downloadUrl,
            responseType: "stream",
            timeout: 300000 // 5 minutes timeout for larger files
        });

        const writer = fs.createWriteStream(filePath);
        fileResponse.data.pipe(writer);
        
        await new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
        });

        // Verify file was downloaded
        if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
            throw new Error("Download failed or empty file!");
        }

        // Send the file as a document
        await sock.sendMessage(chatId, {
            document: { url: `file://${filePath}` }, // Use local file path
            fileName: fileName,
            mimetype: mimetype,
            caption: `📁 *MediaFire File*\n\n🧾 *Name:* ${fileName}\n📏 *Size:* ${fileSize}`
        }, { quoted: message });

        // Cleanup temporary file
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

    } catch (error) {
        console.error("Mediafire command error:", error);
        
        // Send appropriate error message
        let errorMessage = `🚫 Error: ${error.message}`;
        if (error.code === 'ECONNABORTED') {
            errorMessage = '⏰ Request timeout. Please try again.';
        } else if (error.response?.status === 404) {
            errorMessage = '🔍 File not found. The MediaFire link might be invalid or expired.';
        }
        
        return await sock.sendMessage(chatId, { 
            text: errorMessage 
        }, { quoted: message });
    }
}

module.exports = mediafireCommand;
