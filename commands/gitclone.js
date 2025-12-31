const axios = require('axios');

// Store processed message IDs to prevent duplicates
const processedGitMessages = new Set();

async function gitcloneCommand(sock, chatId, message) {
    try {
        // Check if message has already been processed
        if (processedGitMessages.has(message.key.id)) {
            return;
        }
        
        // Add message ID to processed set
        processedGitMessages.add(message.key.id);
        
        // Clean up old message IDs after 5 minutes
        setTimeout(() => {
            processedGitMessages.delete(message.key.id);
        }, 5 * 60 * 1000);

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        
        if (!text) {
            return await sock.sendMessage(chatId, { 
                text: "🖇️ Please provide a GitHub repository link.\n\n*Example:* .gitclone https://github.com/Vinpink2/JUNE-MD"
            });
        }

        // Extract URL from command (remove "gitclone" command if present)
        const url = text.replace(/^gitclone\s+/i, '').trim();
        
        if (!url) {
            return await sock.sendMessage(chatId, { 
                text: "🖇️ Please provide a GitHub repository link.\n\n*Example:* .gitclone https://github.com/Vinpink2/JUNE-MD"
            });
        }

        // Check for GitHub URL patterns
        if (!url.includes('github.com')) {
            return await sock.sendMessage(chatId, { 
                text: "❌ Is that a GitHub repository link?"
            });
        }

        // GitHub URL regex pattern
        const gitRegex = /(?:https|git)(?::\/\/|@)github\.com[\/:]([^\/:]+)\/(.+)/i;
        const match = url.match(gitRegex);
        
        if (!match) {
            return await sock.sendMessage(chatId, { 
                text: "❌ Invalid GitHub repository URL format.\n\n*Valid format:* https://github.com/username/repository"
            });
        }

        const [, username, repoPath] = match;
        const repo = repoPath.replace(/\.git$/, '');

        // React with clock emoji
        await sock.sendMessage(chatId, {
            reactionMessage: {
                key: message.key,
                text: '🕖'
            }
        });

        try {
            const apiUrl = `https://api.github.com/repos/${username}/${repo}/zipball`;
            
            // First, check if repository exists and get file info
            const headResponse = await axios.head(apiUrl, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            // Extract filename from Content-Disposition header
            const contentDisposition = headResponse.headers['content-disposition'];
            let filename = `${username}-${repo}.zip`;
            
            if (contentDisposition) {
                const match = contentDisposition.match(/filename=(?:"(.+)"|([^;]+))/i);
                if (match) {
                    filename = match[1] || match[2] || filename;
                }
            }

            // Ensure .zip extension
            if (!filename.endsWith('.zip')) {
                filename += '.zip';
            }

            // Send the ZIP file
            await sock.sendMessage(chatId, {
                document: { url: apiUrl },
                fileName: filename,
                mimetype: 'application/zip',
                caption: `📦 *GitHub Repository Clone*\n\n👤 Author: ${username}\n📁 Repository: ${repo}\n🔗 Original: ${url}`
            }, { quoted: message });

            // React with checkmark emoji
            await sock.sendMessage(chatId, {
                reactionMessage: {
                    key: message.key,
                    text: '✅'
                }
            });

        } catch (error) {
            console.error("GitHub Clone Error:", error);
            
            // More specific error messages
            if (error.response?.status === 404) {
                await sock.sendMessage(chatId, { 
                    text: "❌ Repository not found. Please check if the URL is correct and the repository exists."
                }, { quoted: message });
            } else if (error.response?.status === 403) {
                await sock.sendMessage(chatId, { 
                    text: "❌ Rate limit exceeded or access forbidden. Please try again later."
                }, { quoted: message });
            } else if (error.code === 'ECONNABORTED') {
                await sock.sendMessage(chatId, { 
                    text: "❌ Request timeout. GitHub API is taking too long to respond."
                }, { quoted: message });
            } else {
                await sock.sendMessage(chatId, { 
                    text: "❌ Failed to download repository. It might be private or the URL is invalid."
                }, { quoted: message });
            }
        }
    } catch (error) {
        console.error('Error in gitclone command:', error);
        await sock.sendMessage(chatId, { 
            text: "❌ An unexpected error occurred. Please try again later."
        }, { quoted: message });
    }
}

module.exports = gitcloneCommand;
