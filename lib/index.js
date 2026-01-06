const fs = require('fs');
const path = require('path');

// Function to load user and group data from JSON file
function loadUserGroupData() {
    try {
        const dataPath = path.join(__dirname, '../data/userGroupData.json');
        if (!fs.existsSync(dataPath)) {
            // Create the file with default structure if it doesn't exist
            const defaultData = {
                antibadword: {},
                antilink: {},
                welcome: {},
                goodbye: {},
                chatbot: {},
                warnings: {},
                sudo: []
            };
            fs.writeFileSync(dataPath, JSON.stringify(defaultData, null, 2));
            return defaultData;
        }
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        return data;
    } catch (error) {
        console.error('Error loading user group data:', error);
        return {
            antibadword: {},
            antilink: {},
            welcome: {},
            goodbye: {},
            chatbot: {},
            warnings: {}
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
        fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving user group data:', error);
        return false;
    }
}

// Add these functions to your SQL helper file
async function setAntilink(groupId, type, action) {
    try {
        const data = loadUserGroupData();
        if (!data.antilink) data.antilink = {};
        if (!data.antilink[groupId]) data.antilink[groupId] = {};
        
        data.antilink[groupId] = {
            enabled: type === 'on',
            action: action || 'delete' // Set default action to delete
        };
        
        saveUserGroupData(data);
        return true;
    } catch (error) {
        console.error('Error setting antilink:', error);
        return false;
    }
}

async function getAntilink(groupId, type) {
    try {
        const data = loadUserGroupData();
        if (!data.antilink || !data.antilink[groupId]) return null;
        
        return type === 'on' ? data.antilink[groupId] : null;
    } catch (error) {
        console.error('Error getting antilink:', error);
        return null;
    }
}

async function removeAntilink(groupId, type) {
    try {
        const data = loadUserGroupData();
        if (data.antilink && data.antilink[groupId]) {
            delete data.antilink[groupId];
            saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        console.error('Error removing antilink:', error);
        return false;
    }
}

// Add antitag functions
async function setAntitag(groupId, type, action) {
    try {
        const data = loadUserGroupData();
        if (!data.antitag) data.antitag = {};
        if (!data.antitag[groupId]) data.antitag[groupId] = {};
        
        data.antitag[groupId] = {
            enabled: type === 'on',
            action: action || 'delete' // Set default action to delete
        };
        
        saveUserGroupData(data);
        return true;
    } catch (error) {
        console.error('Error setting antitag:', error);
        return false;
    }
}

async function getAntitag(groupId, type) {
    try {
        const data = loadUserGroupData();
        if (!data.antitag || !data.antitag[groupId]) return null;
        
        return type === 'on' ? data.antitag[groupId] : null;
    } catch (error) {
        console.error('Error getting antitag:', error);
        return null;
    }
}

async function removeAntitag(groupId, type) {
    try {
        const data = loadUserGroupData();
        if (data.antitag && data.antitag[groupId]) {
            delete data.antitag[groupId];
            saveUserGroupData(data);
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
        const data = loadUserGroupData();
        if (!data.warnings) data.warnings = {};
        if (!data.warnings[groupId]) data.warnings[groupId] = {};
        if (!data.warnings[groupId][userId]) data.warnings[groupId][userId] = 0;
        
        data.warnings[groupId][userId]++;
        saveUserGroupData(data);
        return data.warnings[groupId][userId];
    } catch (error) {
        console.error('Error incrementing warning count:', error);
        return 0;
    }
}

async function resetWarningCount(groupId, userId) {
    try {
        const data = loadUserGroupData();
        if (data.warnings && data.warnings[groupId] && data.warnings[groupId][userId]) {
            data.warnings[groupId][userId] = 0;
            saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        console.error('Error resetting warning count:', error);
        return false;
    }
}

// Helper function to extract phone number from JID
function extractPhoneNumber(jid) {
    if (!jid) return null;
    
    // Handle different JID formats:
    // 1. Standard WhatsApp JID: 1234567890@s.whatsapp.net
    // 2. LID format: 1234567890:123@lid
    // 3. Just the number: 1234567890
    
    // Remove @s.whatsapp.net or @lid suffix
    const cleanJid = jid.split('@')[0];
    
    // Handle LID format with colon (e.g., "1234567890:123")
    const phonePart = cleanJid.split(':')[0];
    
    // Remove any non-numeric characters except +
    return phonePart.replace(/[^\d+]/g, '');
}

// Add sudo check function - made synchronous since it doesn't need async operations
function isSudo(userId) {
    try {
        const data = loadUserGroupData();
        
        // Initialize sudo array if it doesn't exist
        if (!data.sudo || !Array.isArray(data.sudo)) {
            data.sudo = [];
            saveUserGroupData(data);
            return false;
        }
        
        // Direct match (exact JID match)
        if (data.sudo.includes(userId)) {
            return true;
        }
        
        // Handle by phone number comparison
        const userPhoneNumber = extractPhoneNumber(userId);
        if (!userPhoneNumber) return false;
        
        // Check if any sudo entry matches this phone number
        for (const sudoEntry of data.sudo) {
            if (!sudoEntry) continue;
            
            const sudoPhoneNumber = extractPhoneNumber(sudoEntry);
            
            // Direct phone number match
            if (sudoPhoneNumber === userPhoneNumber) {
                return true;
            }
            
            // Special case: Check if sudo entry contains the phone number
            // This handles partial matches and special formats
            if (sudoEntry.includes(userPhoneNumber) || 
                userPhoneNumber.includes(extractPhoneNumber(sudoEntry))) {
                return true;
            }
        }
        
        return false;
    } catch (error) {
        console.error('Error checking sudo:', error);
        return false;
    }
}

// Manage sudo users with phone number normalization
async function addSudo(userJid) {
    try {
        const data = loadUserGroupData();
        if (!data.sudo || !Array.isArray(data.sudo)) {
            data.sudo = [];
        }
        
        // Check if already exists (by phone number, not just exact JID)
        const newPhoneNumber = extractPhoneNumber(userJid);
        const alreadyExists = data.sudo.some(existingJid => {
            const existingPhone = extractPhoneNumber(existingJid);
            return existingPhone === newPhoneNumber;
        });
        
        if (!alreadyExists) {
            // Add the normalized JID
            const normalizedJid = userJid.includes('@') ? userJid : `${userJid}@s.whatsapp.net`;
            data.sudo.push(normalizedJid);
            saveUserGroupData(data);
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
        if (!data.sudo || !Array.isArray(data.sudo)) {
            return true;
        }
        
        // Remove by phone number match (not just exact JID)
        const targetPhoneNumber = extractPhoneNumber(userJid);
        const originalLength = data.sudo.length;
        
        data.sudo = data.sudo.filter(existingJid => {
            const existingPhone = extractPhoneNumber(existingJid);
            return existingPhone !== targetPhoneNumber;
        });
        
        // If changes were made, save the data
        if (data.sudo.length !== originalLength) {
            saveUserGroupData(data);
        }
        
        return true;
    } catch (error) {
        console.error('Error removing sudo:', error);
        return false;
    }
}

// Get normalized sudo list with phone numbers
async function getSudoList() {
    try {
        const data = loadUserGroupData();
        
        if (!data.sudo || !Array.isArray(data.sudo)) {
            return [];
        }
        
        // Return a formatted list with phone numbers
        return data.sudo.map(jid => {
            const phone = extractPhoneNumber(jid);
            return {
                jid: jid,
                phoneNumber: phone,
                display: phone || jid
            };
        });
    } catch (error) {
        console.error('Error getting sudo list:', error);
        return [];
    }
}

// Additional utility functions for better sudo management

// Check if a user is sudo by phone number only
function isSudoByPhone(phoneNumber) {
    if (!phoneNumber) return false;
    
    const cleanPhone = phoneNumber.replace(/[^\d+]/g, '');
    const data = loadUserGroupData();
    
    if (!data.sudo || !Array.isArray(data.sudo)) {
        return false;
    }
    
    return data.sudo.some(sudoJid => {
        const sudoPhone = extractPhoneNumber(sudoJid);
        return sudoPhone === cleanPhone;
    });
}

// Find sudo JID by phone number
function findSudoJidByPhone(phoneNumber) {
    if (!phoneNumber) return null;
    
    const cleanPhone = phoneNumber.replace(/[^\d+]/g, '');
    const data = loadUserGroupData();
    
    if (!data.sudo || !Array.isArray(data.sudo)) {
        return null;
    }
    
    return data.sudo.find(sudoJid => {
        const sudoPhone = extractPhoneNumber(sudoJid);
        return sudoPhone === cleanPhone;
    });
}

// Clear all sudo users
async function clearAllSudo() {
    try {
        const data = loadUserGroupData();
        data.sudo = [];
        saveUserGroupData(data);
        return true;
    } catch (error) {
        console.error('Error clearing sudo list:', error);
        return false;
    }
}

// Get sudo count
function getSudoCount() {
    try {
        const data = loadUserGroupData();
        return Array.isArray(data.sudo) ? data.sudo.length : 0;
    } catch (error) {
        console.error('Error getting sudo count:', error);
        return 0;
    }
}

// Add these functions
async function addWelcome(jid, enabled, message) {
    try {
        const data = loadUserGroupData();
        if (!data.welcome) data.welcome = {};
        
        data.welcome[jid] = {
            enabled: enabled,
            message: message || `┌─❖
│「 𝗛𝗶 👋 」
└┬❖ 「  {user}  」
   │✑  𝗪𝗲𝗹𝗰𝗼𝗺𝗲 𝘁𝗼 
   │✑  {group}
   │✑  𝗠𝗲𝗺𝗯𝗲𝗿 : 
   │✑ Welcome  thanks for joining 🎉
   └───────────────┈ ⳹
      `,
            channelId: '@newsletter'
        };
        
        saveUserGroupData(data);
        return true;
    } catch (error) {
        console.error('Error in addWelcome:', error);
        return false;
    }
}

async function delWelcome(jid) {
    try {
        const data = loadUserGroupData();
        if (data.welcome && data.welcome[jid]) {
            delete data.welcome[jid];
            saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        console.error('Error in delWelcome:', error);
        return false;
    }
}

async function isWelcomeOn(jid) {
    try {
        const data = loadUserGroupData();
        return data.welcome && data.welcome[jid] && data.welcome[jid].enabled;
    } catch (error) {
        console.error('Error in isWelcomeOn:', error);
        return false;
    }
}

async function addGoodbye(jid, enabled, message) {
    try {
        const data = loadUserGroupData();
        if (!data.goodbye) data.goodbye = {};
        
        data.goodbye[jid] = {
            enabled: enabled,
            message: message || `┌─❖
│「 𝗚𝗼𝗼𝗱𝗯𝘆𝗲 👋 」
└┬❖ 「 {user}  」
   │✑  𝗟𝗲𝗳𝘁 
   │✑ {group}
   │✑ You will never be missed 🫦
   └───────────────┈ ⳹`,
            channelId: '@newsletter'
        };
        
        saveUserGroupData(data);
        return true;
    } catch (error) {
        console.error('Error in addGoodbye:', error);
        return false;
    }
}

async function delGoodBye(jid) {
    try {
        const data = loadUserGroupData();
        if (data.goodbye && data.goodbye[jid]) {
            delete data.goodbye[jid];
            saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        console.error('Error in delGoodBye:', error);
        return false;
    }
}

async function isGoodByeOn(jid) {
    try {
        const data = loadUserGroupData();
        return data.goodbye && data.goodbye[jid] && data.goodbye[jid].enabled;
    } catch (error) {
        console.error('Error in isGoodByeOn:', error);
        return false;
    }
}

// Add these functions to your existing SQL helper file
async function setAntiBadword(groupId, type, action) {
    try {
        const data = loadUserGroupData();
        if (!data.antibadword) data.antibadword = {};
        if (!data.antibadword[groupId]) data.antibadword[groupId] = {};
        
        data.antibadword[groupId] = {
            enabled: type === 'on',
            action: action || 'delete'
        };
        
        saveUserGroupData(data);
        return true;
    } catch (error) {
        console.error('Error setting antibadword:', error);
        return false;
    }
}

async function getAntiBadword(groupId, type) {
    try {
        const data = loadUserGroupData();
        //console.log('Loading antibadword config for group:', groupId);
        //console.log('Current data:', data.antibadword);
        
        if (!data.antibadword || !data.antibadword[groupId]) {
            console.log('No antibadword config found');
            return null;
        }
        
        const config = data.antibadword[groupId];
       // console.log('Found config:', config);
        
        return type === 'on' ? config : null;
    } catch (error) {
        console.error('Error getting antibadword:', error);
        return null;
    }
}

async function removeAntiBadword(groupId, type) {
    try {
        const data = loadUserGroupData();
        if (data.antibadword && data.antibadword[groupId]) {
            delete data.antibadword[groupId];
            saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        console.error('Error removing antibadword:', error);
        return false;
    }
}

async function setChatbot(groupId, enabled) {
    try {
        const data = loadUserGroupData();
        if (!data.chatbot) data.chatbot = {};
        
        data.chatbot[groupId] = {
            enabled: enabled
        };
        
        saveUserGroupData(data);
        return true;
    } catch (error) {
        console.error('Error setting chatbot:', error);
        return false;
    }
}

async function getChatbot(groupId) {
    try {
        const data = loadUserGroupData();
        return data.chatbot?.[groupId] || null;
    } catch (error) {
        console.error('Error getting chatbot:', error);
        return null;
    }
}

async function removeChatbot(groupId) {
    try {
        const data = loadUserGroupData();
        if (data.chatbot && data.chatbot[groupId]) {
            delete data.chatbot[groupId];
            saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        console.error('Error removing chatbot:', error);
        return false;
    }
}

module.exports = {
    // ... existing exports
    setAntilink,
    getAntilink,
    removeAntilink,
    
    setAntitag,
    getAntitag,
    removeAntitag,
    
    incrementWarningCount,
    resetWarningCount,
    
    isSudo,
    addSudo,
    removeSudo,
    getSudoList,
    
    addWelcome,
    delWelcome,
    isWelcomeOn,
    addGoodbye,
    delGoodBye,
    isGoodByeOn,
    
    setAntiBadword,
    getAntiBadword,
    removeAntiBadword,
    setChatbot,
    
    getChatbot,
    removeChatbot,
}; 
