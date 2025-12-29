const fs = require('fs');
const path = require('path');

// Function to load user and group data from JSON file
function loadUserGroupData() {
    try {
        const dataPath = path.join(__dirname, '../data/userGroupData.json');
        
        // Create directory if it doesn't exist
        const dir = path.dirname(dataPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        if (!fs.existsSync(dataPath)) {
            // Create the file with default structure if it doesn't exist
            const defaultData = {
                antibadword: {},
                antilink: {},
                antitag: {},
                welcome: {},
                goodbye: {},
                chatbot: {},
                warnings: {},
                sudo: []
            };
            fs.writeFileSync(dataPath, JSON.stringify(defaultData, null, 2));
            return defaultData;
        }
        
        const fileContent = fs.readFileSync(dataPath, 'utf8');
        const data = JSON.parse(fileContent);
        
        // Ensure all required properties exist
        return {
            antibadword: data.antibadword || {},
            antilink: data.antilink || {},
            antitag: data.antitag || {},
            welcome: data.welcome || {},
            goodbye: data.goodbye || {},
            chatbot: data.chatbot || {},
            warnings: data.warnings || {},
            sudo: Array.isArray(data.sudo) ? data.sudo : []
        };
    } catch (error) {
        console.error('Error loading user group data:', error);
        // Return default structure on error
        return {
            antibadword: {},
            antilink: {},
            antitag: {},
            welcome: {},
            goodbye: {},
            chatbot: {},
            warnings: {},
            sudo: []
        };
    }
}

// Function to save user and group data to JSON file
function saveUserGroupData(data) {
    try {
        const dataPath = path.join(__dirname, '../data/userGroupData.json');
        
        // Ensure the directory exists
        const dir = path.dirname(dataPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        // Ensure data has all required properties before saving
        const completeData = {
            antibadword: data.antibadword || {},
            antilink: data.antilink || {},
            antitag: data.antitag || {},
            welcome: data.welcome || {},
            goodbye: data.goodbye || {},
            chatbot: data.chatbot || {},
            warnings: data.warnings || {},
            sudo: Array.isArray(data.sudo) ? data.sudo : []
        };
        
        fs.writeFileSync(dataPath, JSON.stringify(completeData, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving user group data:', error);
        return false;
    }
}

// Helper function to normalize group ID (removes any prefixes if present)
function normalizeGroupId(groupId) {
    if (!groupId) return groupId;
    
    // Remove common prefixes
    const prefixes = ['@g.us', '@s.whatsapp.net'];
    for (const prefix of prefixes) {
        if (groupId.endsWith(prefix)) {
            return groupId.replace(prefix, '');
        }
    }
    return groupId;
}

// Add these functions to your SQL helper file
async function setAntilink(groupId, type, action = 'delete') {
    try {
        const normalizedId = normalizeGroupId(groupId);
        const data = loadUserGroupData();
        
        if (!data.antilink[normalizedId]) {
            data.antilink[normalizedId] = {};
        }
        
        data.antilink[normalizedId] = {
            enabled: type === 'on',
            action: action
        };
        
        return saveUserGroupData(data);
    } catch (error) {
        console.error('Error setting antilink:', error);
        return false;
    }
}

async function getAntilink(groupId) {
    try {
        const normalizedId = normalizeGroupId(groupId);
        const data = loadUserGroupData();
        
        if (!data.antilink || !data.antilink[normalizedId]) {
            return null;
        }
        
        return data.antilink[normalizedId];
    } catch (error) {
        console.error('Error getting antilink:', error);
        return null;
    }
}

async function removeAntilink(groupId) {
    try {
        const normalizedId = normalizeGroupId(groupId);
        const data = loadUserGroupData();
        
        if (data.antilink && data.antilink[normalizedId]) {
            delete data.antilink[normalizedId];
            return saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        console.error('Error removing antilink:', error);
        return false;
    }
}

// Add antitag functions
async function setAntitag(groupId, type, action = 'delete') {
    try {
        const normalizedId = normalizeGroupId(groupId);
        const data = loadUserGroupData();
        
        if (!data.antitag[normalizedId]) {
            data.antitag[normalizedId] = {};
        }
        
        data.antitag[normalizedId] = {
            enabled: type === 'on',
            action: action
        };
        
        return saveUserGroupData(data);
    } catch (error) {
        console.error('Error setting antitag:', error);
        return false;
    }
}

async function getAntitag(groupId) {
    try {
        const normalizedId = normalizeGroupId(groupId);
        const data = loadUserGroupData();
        
        if (!data.antitag || !data.antitag[normalizedId]) {
            return null;
        }
        
        return data.antitag[normalizedId];
    } catch (error) {
        console.error('Error getting antitag:', error);
        return null;
    }
}

async function removeAntitag(groupId) {
    try {
        const normalizedId = normalizeGroupId(groupId);
        const data = loadUserGroupData();
        
        if (data.antitag && data.antitag[normalizedId]) {
            delete data.antitag[normalizedId];
            return saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        console.error('Error removing antitag:', error);
        return false;
    }
}

// Add these functions for warning system
async function incrementWarningCount(groupId, userId) {
    try {
        const normalizedGroupId = normalizeGroupId(groupId);
        const data = loadUserGroupData();
        
        if (!data.warnings[normalizedGroupId]) {
            data.warnings[normalizedGroupId] = {};
        }
        
        if (!data.warnings[normalizedGroupId][userId]) {
            data.warnings[normalizedGroupId][userId] = 0;
        }
        
        data.warnings[normalizedGroupId][userId]++;
        saveUserGroupData(data);
        return data.warnings[normalizedGroupId][userId];
    } catch (error) {
        console.error('Error incrementing warning count:', error);
        return 0;
    }
}

async function getWarningCount(groupId, userId) {
    try {
        const normalizedGroupId = normalizeGroupId(groupId);
        const data = loadUserGroupData();
        
        if (data.warnings && 
            data.warnings[normalizedGroupId] && 
            data.warnings[normalizedGroupId][userId]) {
            return data.warnings[normalizedGroupId][userId];
        }
        return 0;
    } catch (error) {
        console.error('Error getting warning count:', error);
        return 0;
    }
}

async function resetWarningCount(groupId, userId) {
    try {
        const normalizedGroupId = normalizeGroupId(groupId);
        const data = loadUserGroupData();
        
        if (data.warnings && 
            data.warnings[normalizedGroupId] && 
            data.warnings[normalizedGroupId][userId]) {
            delete data.warnings[normalizedGroupId][userId];
            return saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        console.error('Error resetting warning count:', error);
        return false;
    }
}

// Add sudo check function
async function isSudo(userId) {
    try {
        const data = loadUserGroupData();
        
        if (!Array.isArray(data.sudo)) {
            return false;
        }
        
        // Direct match
        if (data.sudo.includes(userId)) {
            return true;
        }
        
        // Try to load settings for owner number check
        try {
            const settings = require('../settings');
            const ownerNumber = settings.ownerNumber;
            
            if (ownerNumber && userId) {
                // Check if userId contains ownerNumber (for LID format)
                if (userId.includes(ownerNumber)) {
                    // Check if any sudo entry contains the same ownerNumber
                    for (const sudoEntry of data.sudo) {
                        if (sudoEntry && sudoEntry.includes && sudoEntry.includes(ownerNumber)) {
                            return true;
                        }
                    }
                }
            }
        } catch (settingsError) {
            // If settings can't be loaded, just continue without owner check
            console.warn('Could not load settings for sudo check:', settingsError.message);
        }
        
        return false;
    } catch (error) {
        console.error('Error checking sudo:', error);
        return false;
    }
}

// Manage sudo users
async function addSudo(userJid) {
    try {
        const data = loadUserGroupData();
        
        if (!Array.isArray(data.sudo)) {
            data.sudo = [];
        }
        
        if (!data.sudo.includes(userJid)) {
            data.sudo.push(userJid);
            return saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        console.error('Error adding sudo:', error);
        return false;
    }
}

async function removeSudo(userJid) {
    try {
        const data = loadUserGroupData();
        
        if (!Array.isArray(data.sudo)) {
            return true;
        }
        
        const idx = data.sudo.indexOf(userJid);
        if (idx !== -1) {
            data.sudo.splice(idx, 1);
            return saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        console.error('Error removing sudo:', error);
        return false;
    }
}

async function getSudoList() {
    try {
        const data = loadUserGroupData();
        return Array.isArray(data.sudo) ? data.sudo : [];
    } catch (error) {
        console.error('Error getting sudo list:', error);
        return [];
    }
}

// Welcome functions
async function addWelcome(jid, enabled, message = null) {
    try {
        const normalizedId = normalizeGroupId(jid);
        const data = loadUserGroupData();
        
        const defaultMessage = `┌─❖
│「 𝗛𝗶 👋 」
└┬❖ 「  {user}  」
   │✑  𝗪𝗲𝗹𝗰𝗼𝗺𝗲 𝘁𝗼 
   │✑  {group}
   │✑  𝗠𝗲𝗺𝗯𝗲𝗿 : 
   │✑ Welcome thanks for joining 🎉
   └───────────────┈ ⳹`;
        
        data.welcome[normalizedId] = {
            enabled: Boolean(enabled),
            message: message || defaultMessage,
            channelId: '@newsletter'
        };
        
        return saveUserGroupData(data);
    } catch (error) {
        console.error('Error in addWelcome:', error);
        return false;
    }
}

async function delWelcome(jid) {
    try {
        const normalizedId = normalizeGroupId(jid);
        const data = loadUserGroupData();
        
        if (data.welcome && data.welcome[normalizedId]) {
            delete data.welcome[normalizedId];
            return saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        console.error('Error in delWelcome:', error);
        return false;
    }
}

async function isWelcomeOn(jid) {
    try {
        const normalizedId = normalizeGroupId(jid);
        const data = loadUserGroupData();
        
        return !!(data.welcome && 
                 data.welcome[normalizedId] && 
                 data.welcome[normalizedId].enabled);
    } catch (error) {
        console.error('Error in isWelcomeOn:', error);
        return false;
    }
}

async function getWelcomeMessage(jid) {
    try {
        const normalizedId = normalizeGroupId(jid);
        const data = loadUserGroupData();
        
        if (data.welcome && data.welcome[normalizedId]) {
            return data.welcome[normalizedId].message;
        }
        return null;
    } catch (error) {
        console.error('Error getting welcome message:', error);
        return null;
    }
}

// Goodbye functions
async function addGoodbye(jid, enabled, message = null) {
    try {
        const normalizedId = normalizeGroupId(jid);
        const data = loadUserGroupData();
        
        const defaultMessage = `┌─❖
│「 𝗚𝗼𝗼𝗱𝗯𝘆𝗲 👋 」
└┬❖ 「 {user}  」
   │✑  𝗟𝗲𝗳𝘁 
   │✑ {group}
   │✑ You will never be missed 🫦
   └───────────────┈ ⳹`;
        
        data.goodbye[normalizedId] = {
            enabled: Boolean(enabled),
            message: message || defaultMessage,
            channelId: '@newsletter'
        };
        
        return saveUserGroupData(data);
    } catch (error) {
        console.error('Error in addGoodbye:', error);
        return false;
    }
}

async function delGoodBye(jid) {
    try {
        const normalizedId = normalizeGroupId(jid);
        const data = loadUserGroupData();
        
        if (data.goodbye && data.goodbye[normalizedId]) {
            delete data.goodbye[normalizedId];
            return saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        console.error('Error in delGoodBye:', error);
        return false;
    }
}

async function isGoodByeOn(jid) {
    try {
        const normalizedId = normalizeGroupId(jid);
        const data = loadUserGroupData();
        
        return !!(data.goodbye && 
                 data.goodbye[normalizedId] && 
                 data.goodbye[normalizedId].enabled);
    } catch (error) {
        console.error('Error in isGoodByeOn:', error);
        return false;
    }
}

async function getGoodbyeMessage(jid) {
    try {
        const normalizedId = normalizeGroupId(jid);
        const data = loadUserGroupData();
        
        if (data.goodbye && data.goodbye[normalizedId]) {
            return data.goodbye[normalizedId].message;
        }
        return null;
    } catch (error) {
        console.error('Error getting goodbye message:', error);
        return null;
    }
}

// Anti-badword functions
async function setAntiBadword(groupId, type, action = 'delete') {
    try {
        const normalizedId = normalizeGroupId(groupId);
        const data = loadUserGroupData();
        
        if (!data.antibadword[normalizedId]) {
            data.antibadword[normalizedId] = {};
        }
        
        data.antibadword[normalizedId] = {
            enabled: type === 'on',
            action: action
        };
        
        return saveUserGroupData(data);
    } catch (error) {
        console.error('Error setting antibadword:', error);
        return false;
    }
}

async function getAntiBadword(groupId) {
    try {
        const normalizedId = normalizeGroupId(groupId);
        const data = loadUserGroupData();
        
        if (!data.antibadword || !data.antibadword[normalizedId]) {
            return null;
        }
        
        return data.antibadword[normalizedId];
    } catch (error) {
        console.error('Error getting antibadword:', error);
        return null;
    }
}

async function removeAntiBadword(groupId) {
    try {
        const normalizedId = normalizeGroupId(groupId);
        const data = loadUserGroupData();
        
        if (data.antibadword && data.antibadword[normalizedId]) {
            delete data.antibadword[normalizedId];
            return saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        console.error('Error removing antibadword:', error);
        return false;
    }
}

// Chatbot functions
async function setChatbot(groupId, enabled) {
    try {
        const normalizedId = normalizeGroupId(groupId);
        const data = loadUserGroupData();
        
        data.chatbot[normalizedId] = {
            enabled: Boolean(enabled)
        };
        
        return saveUserGroupData(data);
    } catch (error) {
        console.error('Error setting chatbot:', error);
        return false;
    }
}

async function getChatbot(groupId) {
    try {
        const normalizedId = normalizeGroupId(groupId);
        const data = loadUserGroupData();
        
        return data.chatbot?.[normalizedId] || null;
    } catch (error) {
        console.error('Error getting chatbot:', error);
        return null;
    }
}

async function removeChatbot(groupId) {
    try {
        const normalizedId = normalizeGroupId(groupId);
        const data = loadUserGroupData();
        
        if (data.chatbot && data.chatbot[normalizedId]) {
            delete data.chatbot[normalizedId];
            return saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        console.error('Error removing chatbot:', error);
        return false;
    }
}

module.exports = {
    // Data loading/saving
    loadUserGroupData,
    saveUserGroupData,
    
    // Anti-link functions
    setAntilink,
    getAntilink,
    removeAntilink,
    
    // Anti-tag functions
    setAntitag,
    getAntitag,
    removeAntitag,
    
    // Warning system
    incrementWarningCount,
    getWarningCount,
    resetWarningCount,
    
    // Sudo management
    isSudo,
    addSudo,
    removeSudo,
    getSudoList,
    
    // Welcome system
    addWelcome,
    delWelcome,
    isWelcomeOn,
    getWelcomeMessage,
    
    // Goodbye system
    addGoodbye,
    delGoodBye,
    isGoodByeOn,
    getGoodbyeMessage,
    
    // Anti-badword
    setAntiBadword,
    getAntiBadword,
    removeAntiBadword,
    
    // Chatbot
    setChatbot,
    getChatbot,
    removeChatbot
};
