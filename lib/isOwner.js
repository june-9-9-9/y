const settings = require('../settings');
const { isSudo } = require('./index');
const { compareJids, toUserJid } = require('./jid');

async function isOwnerOrSudo(senderId) {
    try {
        if (typeof senderId !== 'string' || !senderId.trim()) {
            return false;
        }

        const ownerNumber = settings?.ownerNumber?.toString().trim();
        if (!ownerNumber) {
            return false;
        }

        const ownerJid = toUserJid(ownerNumber);
        if (compareJids(senderId, ownerJid)) {
            return true;
        }

        const sudoStatus = await isSudo(senderId);
        return Boolean(sudoStatus);
    } catch (error) {
        console.error(`[isOwnerOrSudo] Error for sender ${senderId}: ${error.message}`);
        return false;
    }
}

module.exports = isOwnerOrSudo;
