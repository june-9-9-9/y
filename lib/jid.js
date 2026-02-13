const { jidDecode } = require('@whiskeysockets/baileys');

function normalizeJid(jid) {
    if (!jid || typeof jid !== 'string') return jid;
    jid = jid.trim();
    if (/:\d+@/gi.test(jid)) {
        const decoded = jidDecode(jid) || {};
        if (decoded.user && decoded.server) {
            return `${decoded.user}@${decoded.server}`;
        }
    }
    return jid;
}

function isLid(jid) {
    if (!jid || typeof jid !== 'string') return false;
    return jid.endsWith('@lid');
}

function extractNumber(jid) {
    if (!jid || typeof jid !== 'string') return '';
    return jid.split('@')[0].split(':')[0];
}

function compareJids(a, b) {
    if (!a || !b) return false;
    const normA = normalizeJid(a);
    const normB = normalizeJid(b);
    if (normA === normB) return true;
    const numA = extractNumber(normA);
    const numB = extractNumber(normB);
    if (numA && numB && numA === numB) return true;
    const baseA = normA.replace('@lid', '@s.whatsapp.net');
    const baseB = normB.replace('@lid', '@s.whatsapp.net');
    if (baseA === baseB) return true;
    return false;
}

function findParticipant(participants, targetJid) {
    if (!participants || !targetJid) return null;
    const normalized = normalizeJid(targetJid);
    return participants.find(p => {
        const pid = normalizeJid(p.id);
        return compareJids(pid, normalized);
    }) || null;
}

function toUserJid(number) {
    if (!number) return '';
    const clean = number.toString().replace(/[^0-9]/g, '');
    return `${clean}@s.whatsapp.net`;
}

module.exports = { normalizeJid, isLid, extractNumber, compareJids, findParticipant, toUserJid };
