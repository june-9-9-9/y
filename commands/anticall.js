const { getAntiCallSettings, updateAntiCallSettings } = require('../lib/database');

async function anticallCommand(sock, chatId, message) {
    try {
        // React immediately
        await sock.sendMessage(chatId, {
            react: { text: '📞', key: message.key }
        });
        
        // Extract text
        const text = message.message?.conversation || 
                     message.message?.extendedTextMessage?.text || "";
        const parts = text.split(' ');
        const subcommand = parts[1]?.toLowerCase();
        const value = parts.slice(2).join(' ').trim();
        
        // Superuser check
        const isSuperUser = true; // Replace with actual check
        if (!isSuperUser) {
            return await sock.sendMessage(chatId, { 
                text: "❌ Superuser only."
            }, { quoted: message });
        }
        
        // Current settings
        const settings = await getAntiCallSettings();
        const prefix = "."; // Replace with your prefix
        
        // Show settings
        if (!subcommand) {
            const status = settings.status ? '✅ ON' : '❌ OFF';
            const action = settings.action === 'block' ? '🚫 Block' : '❌ Reject';
            
            return await sock.sendMessage(chatId, {
                text: 
                    `*Anti-Call*\n\n` +
                    `🔹 Status: ${status}\n` +
                    `🔹 Action: ${action}\n` +
                    `🔹 Msg: ${settings.message || 'None'}\n\n` +
                    `*Usage:*\n` +
                    `▸ ${prefix}anticall on/off\n` +
                    `▸ ${prefix}anticall message <text>\n` +
                    `▸ ${prefix}anticall action reject/block`
            }, { quoted: message });
        }
        
        // Subcommands
        switch (subcommand) {
            case 'on':
            case 'off': {
                const newStatus = subcommand === 'on';
                if (settings.status === newStatus) {
                    return await sock.sendMessage(chatId, {
                        text: `⚠️ Already ${newStatus ? 'ON' : 'OFF'}.`
                    }, { quoted: message });
                }
                await updateAntiCallSettings({ status: newStatus });
                return await sock.sendMessage(chatId, {
                    text: `✅ Anti-call ${newStatus ? 'ON' : 'OFF'}.`
                }, { quoted: message });
            }
            
            case 'message': {
                if (!value) {
                    return await sock.sendMessage(chatId, {
                        text: '❌ No message provided.'
                    }, { quoted: message });
                }
                if (value.length > 500) {
                    return await sock.sendMessage(chatId, {
                        text: '❌ Max 500 chars.'
                    }, { quoted: message });
                }
                await updateAntiCallSettings({ message: value });
                return await sock.sendMessage(chatId, {
                    text: `✅ Msg set:\n"${value}"`
                }, { quoted: message });
            }
            
            case 'action': {
                const action = value.toLowerCase();
                if (!['reject', 'block'].includes(action)) {
                    return await sock.sendMessage(chatId, {
                        text: '❌ Use "reject" or "block".'
                    }, { quoted: message });
                }
                if (settings.action === action) {
                    return await sock.sendMessage(chatId, {
                        text: `⚠️ Already "${action}".`
                    }, { quoted: message });
                }
                await updateAntiCallSettings({ action });
                return await sock.sendMessage(chatId, {
                    text: `✅ Action: ${action}.`
                }, { quoted: message });
            }
            
            default:
                return await sock.sendMessage(chatId, {
                    text: 
                        '❌ Invalid.\n' +
                        `▸ ${prefix}anticall on/off\n` +
                        `▸ ${prefix}anticall message <text>\n` +
                        `▸ ${prefix}anticall action reject/block`
                }, { quoted: message });
        }
        
    } catch (error) {
        console.error("Anti-call command error:", error);
        
        let errorMessage = "🚫 Error.";
        if (error.message.includes("database")) errorMessage = "💾 DB error.";
        else if (error.message.includes("permission")) errorMessage = "🔒 No permission.";
        
        return await sock.sendMessage(chatId, { text: errorMessage }, { quoted: message });
    }
}

module.exports = anticallCommand;
