const settings = require('../settings');
const { isSudo } = require('./index');

/**
 * Check if the sender is either the owner or a sudo user.
 * @param {string} senderId - WhatsApp ID of the sender (e.g., "1234567890@s.whatsapp.net")
 * @returns {Promise<boolean>} - True if sender is owner or sudo, false otherwise.
 */
async function isOwnerOrSudo(senderId) {
    try {
        // Defensive input validation
        if (typeof senderId !== 'string' || !senderId.trim()) {
            console.warn('[isOwnerOrSudo] Invalid senderId input');
            return false;
        }

        // Normalize sender ID
        const normalizedSenderId = senderId.trim().toLowerCase();

        // Ensure owner number is configured
        const ownerNumber = settings?.ownerNumber?.toString().trim();
        if (!ownerNumber) {
            console.warn('[isOwnerOrSudo] Owner number missing in settings');
            return false;
        }

        // Normalize owner JID
        const ownerJid = `${ownerNumber.replace(/@s\.whatsapp\.net$/, '')}@s.whatsapp.net`.toLowerCase();

        // Owner check
        if (normalizedSenderId === ownerJid) {
            return true;
        }

        // Sudo check
        const sudoStatus = await isSudo(normalizedSenderId);
        return Boolean(sudoStatus);

    } catch (error) {
        console.error(`[isOwnerOrSudo] Error for sender ${senderId}: ${error.message}`);
        return false;
    }
}

module.exports = isOwnerOrSudo;
