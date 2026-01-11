
// help.js - Enhanced version with integrated functions
const settings = require('../settings');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { getMenuStyle, getMenuSettings, MENU_STYLES } = require('./menuSettings');
const { generateWAMessageFromContent } = require('@whiskeysockets/baileys');
const { getPrefix, handleSetPrefixCommand } = require('./setprefix');

const { getOwnerName, handleSetOwnerCommand } = require('./setowner');

const more = String.fromCharCode(8206);
const readmore = more.repeat(4001);

// Utility Functions
function formatTime(seconds) {
    const days = Math.floor(seconds / (24 * 60 * 60));
    seconds = seconds % (24 * 60 * 60);
    const hours = Math.floor(seconds / (60 * 60));
    seconds = seconds % (60 * 60);
    const minutes = Math.floor(seconds / 60);
    seconds = Math.floor(seconds % 60);

    let time = '';
    if (days > 0) time += `${days}d `;
    if (hours > 0) time += `${hours}h `;
    if (minutes > 0) time += `${minutes}m `;
    if (seconds > 0 || time === '') time += `${seconds}s`;

    return time.trim();
}

    // Detect host/platform
const detectPlatform = () => {
  if (process.env.DYNO) return "☁️ Heroku";
  if (process.env.RENDER) return "⚡ Render";
  if (process.env.PREFIX && process.env.PREFIX.includes("termux")) return "📱 Termux";
  if (process.env.PORTS && process.env.CYPHERX_HOST_ID) return "🌀 CypherX Platform";
  if (process.env.P_SERVER_UUID) return "🖥️ Panel";
  if (process.env.LXC) return "📦 Linux Container (LXC)";
  
  switch (os.platform()) {
    case "win32": return "🪟 Windows";
    case "darwin": return "🍎 macOS";
    case "linux": return "🐧 Linux";
    default: return "❓ Unknown";
  }
};

    const hostName = detectPlatform();

// Memory formatting function
const formatMemory = (memory) => {
    return memory < 1024 * 1024 * 1024
        ? Math.round(memory / 1024 / 1024) + ' MB'
        : Math.round(memory / 1024 / 1024 / 1024) + ' GB';
};

// Progress bar function
const progressBar = (used, total, size = 10) => {
    let percentage = Math.round((used / total) * size);
    let bar = '█'.repeat(percentage) + '░'.repeat(size - percentage);
    return `${bar} ${Math.round((used / total) * 100)}%`;
};

// Generate Menu Function
const generateMenu = (pushname, currentMode, hostName, ping, uptimeFormatted, prefix = '.') => {
    const memoryUsage = process.memoryUsage();
    const botUsedMemory = memoryUsage.heapUsed;
    const totalMemory = os.totalmem();
    const systemUsedMemory = totalMemory - os.freemem();
    const prefix2 = getPrefix();
    let newOwner = getOwnerName();
    const menuSettings = getMenuSettings();
    
    let menu = `┏❐✦ JUNE-X BOT ✦❐\n`;
    menu += `┃✦ Prefix: [${prefix2}]\n`;
    menu += `┃✦ Owner: ${newOwner}\n`;
    menu += `┃✦ Mode: ${currentMode}\n`;
    menu += `┃✦ platform: ${hostName}\n`;
    menu += `┃✦ Speed: ${ping} ms\n`;
    
    
    if (menuSettings.showUptime) {
        menu += `┃✦ Uptime: ${uptimeFormatted}\n`;
    }
    
    menu += `┃✦ version: v${settings.version}\n`;
    
    if (menuSettings.showMemory) {
        menu += `┃✦ Usage: ${formatMemory(botUsedMemory)} of ${formatMemory(totalMemory)}\n`;
        menu += `┃✦ RAM: ${progressBar(systemUsedMemory, totalMemory)}\n`;
    }
    
    menu += `┗❐\n${readmore}\n`;

    // Owner Menu
    menu += `┏❐ \`OWNER MENU\` ❐\n`;
    menu += `┃ ${prefix2}ban\n┃ ${prefix2}restart\n┃ ${prefix2}unban\n┃ ${prefix2}promote\n┃ ${prefix2}demote\n┃ ${prefix2}mute\n┃ ${prefix2}unmute\n┃ ${prefix2}delete\n┃ ${prefix2}kick\n┃ ${prefix2}warnings\n┃ ${prefix2}antilink\n┃ ${prefix2}antibadword\n┃ ${prefix2}clear\n┃ ${prefix2}chatbot\n`;
    menu += `┗❐\n\n`;

    // Group Menu
    menu += `┏❐ \`GROUP MENU\` ❐\n`;
    menu += `┃ ${prefix2}promote\n┃ ${prefix2}demote\n┃ ${prefix2}settings\n┃ ${prefix2}togroupstatus\n┃ ${prefix2}tosgroup\n┃ ${prefix2}welcome\n┃ ${prefix2}setgpp\n┃ ${prefix2}getgpp\n┃ ${prefix2}listadmin\n┃ ${prefix2}goodbye\n┃ ${prefix2}tagnoadmin\n┃ ${prefix2}tag\n┃ ${prefix2}antilink\n┃ ${prefix2}set welcome\n┃ ${prefix2}listadmin\n┃ ${prefix2}groupinfo\n┃ ${prefix2}admins\n┃ ${prefix2}warn\n┃ ${prefix2}revoke\n┃ ${prefix2}resetlink\n┃ ${prefix2}open\n┃ ${prefix2}close\n┃ ${prefix2}mention\n┃ ${prefix2}setgdesc\n┃ ${prefix2}leave\n┃ ${prefix2}left\n┃ ${prefix2}killall\n┃ ${prefix2}removeall\n┃ ${prefix2}pair\n┃ ${prefix2}link\n┃ ${prefix2}add\n`;
    menu += `┗❐\n\n`;

    // AI Menu
    menu += `┏❐ \`AI MENU\` ❐\n`;
    menu += `┃ ${prefix2}dalle\n┃ ${prefix2}gpt\n┃ ${prefix2}gemini\n┃ ${prefix2}imagine\n┃ ${prefix2}flux\n┃ ${prefix2}copilot\n┃ ${prefix2}deepseek\n┃ ${prefix2}meta\n┃ ${prefix2}metai\n┃ ${prefix2}vision\n┃ ${prefix2}analyse\n`;
    menu += `┗❐\n\n`;

    // Setting Menu
    menu += `┏❐ \`SETTING MENU\` ❐\n`;
    menu += `┃ ${prefix2}mode\n┃ ${prefix2}autostatus\n┃ ${prefix2}pmblock\n┃ ${prefix2}setmention\n┃ ${prefix2}autoread\n┃ ${prefix2}clearsession\n┃ ${prefix2}antidelete\n┃ ${prefix2}cleartmp\n┃ ${prefix2}autoreact\n┃ ${prefix2}getpp\n┃ ${prefix2}setpp\n┃ ${prefix2}sudo\n┃ ${prefix2}autotyping\n┃ ${prefix2}setmenu\n┃ ${prefix2}menuconfig reset\n┃ ${prefix2}setmenu toggle\n┃ ${prefix2}setprefix\n┃ ${prefix2}setprefix reset\n`;
    menu += `┗❐\n${readmore}\n`;

    // Main Menu
    menu += `┏❐ \`MAIN MENU\` ❐\n`;
    menu += `┃ ${prefix2}yts\n┃ ${prefix2}url\n┃ ${prefix2}tourl\n┃ ${prefix2}block\n┃ ${prefix2}listblock\n┃ ${prefix2}blocklist\n┃ ${prefix2}tagall\n┃ ${prefix2}yts\n┃ ${prefix2}play\n┃ ${prefix2}spotify\n┃ ${prefix2}trt\n┃ ${prefix2}runtime\n┃ ${prefix2}ping\n┃ ${prefix2}apk\n┃ ${prefix2}vv\n┃ ${prefix2}video\n┃ ${prefix2}song\n┃ ${prefix2}ssweb\n┃ ${prefix2}instagram\n┃ ${prefix2}facebook\n┃ ${prefix2}tiktok\n┃ ${prefix2}ytmp4\n┃ ${prefix2}shazam\n┃ ${prefix2}find\n┃ ${prefix2}send\n┃ ${prefix2}get\n┃ ${prefix2}send\n┃ ${prefix2}tomp3\n┃ ${prefix2}toaudio\n┃ ${prefix2}ytsearch\n┃ ${prefix2}ytplay\n┃ ${prefix2}ytv\n┃ ${prefix2}fetch\n┃ ${prefix2}inspect\n┃ ${prefix2}img\n┃ ${prefix2}image\n┃ ${prefix2}vcf\n┃ ${prefix2}pair\n┃ ${prefix2}ytdocplay\n┃ ${prefix2}ytdocvideo\n┃ ${prefix2}mediafire\n┃ ${prefix2}mf\n┃ ${prefix2}ytv\n`;
    menu += `┗❐\n\n`;

    // Stick Menu
    menu += `┏❐ \`STICK MENU\` ❐\n`;
    menu += `┃ ${prefix2}blur\n┃ ${prefix2}timage\n┃ ${prefix2}sticker\n┃ ${prefix2}tgsticker\n┃ ${prefix2}meme\n┃ ${prefix2}take\n┃ ${prefix2}emojimix\n`;
    menu += `┗❐\n\n`;

    // Game Menu
    menu += `┏❐ \`GAME MENU\` ❐\n`;
    menu += `┃ ${prefix2}tictactoe\n┃ ${prefix2}hangman\n┃ ${prefix2}guess\n┃ ${prefix2}trivia\n┃ ${prefix2}answer\n┃ ${prefix2}truth\n┃ ${prefix2}dare\n┃ ${prefix2}8ball\n┃ ${prefix2}cf\n┃ ${prefix2}connect4\n┃ ${prefix2}connectfour\n`;
    menu += `┗❐\n\n`;

    // GitHub Menu
    menu += `┏❐ \`GITHUB CMD\` ❐\n`;
    menu += `┃ ${prefix2}git\n┃ ${prefix2}github\n┃ ${prefix2}sc\n┃ ${prefix2}script\n┃ ${prefix2}repo\n┃ ${prefix2}gitclone\n┃ ${prefix2}clone\n`;
    menu += `┗❐\n${readmore}\n`;

    // Maker Menu
    menu += `┏❐ \`MAKER MENU\`❐\n`;
    menu += `┃ ${prefix2}compliment\n┃ ${prefix2}insult\n┃ ${prefix2}flirt\n┃ ${prefix2}shayari\n┃ ${prefix2}goodnight\n┃ ${prefix2}roseday\n┃ ${prefix2}character\n┃ ${prefix2}wasted\n┃ ${prefix2}ship\n┃ ${prefix2}simp\n┃ ${prefix2}stupid\n`;
    menu += `┗❐\n\n`;

    // Anime Menu
    menu += `┏❐ \`ANIME MENU\` ❐\n`;
    menu += `┃ ${prefix2}neko\n┃ ${prefix2}waifu\n┃ ${prefix2}loli\n┃ ${prefix2}nom\n┃ ${prefix2}poke\n┃ ${prefix2}cry\n┃ ${prefix2}kiss\n┃ ${prefix2}pat\n┃ ${prefix2}hug\n┃ ${prefix2}wink\n┃ ${prefix2}facepalm\n`;
    menu += `┗❐\n\n`;

    // Text Maker Menu
    menu += `┏❐ \`TEXT MAKER MENU\` ❐\n`;
    menu += `┃ ${prefix2}metallic\n┃ ${prefix2}ice\n┃ ${prefix2}snow\n┃ ${prefix2}impressive\n┃ ${prefix2}matrix\n┃ ${prefix2}light\n┃ ${prefix2}neon\n┃ ${prefix2}devil\n┃ ${prefix2}purple\n┃ ${prefix2}thunder\n┃ ${prefix2}leaves\n┃ ${prefix2}1917\n┃ ${prefix2}arena\n┃ ${prefix2}hacker\n┃ ${prefix2}sand\n┃ ${prefix2}blackpink\n┃ ${prefix2}glitch\n┃ ${prefix2}fire\n`;
    menu += `┗❐\n\n`;

    // Image Edit Menu
    menu += `┏❐ \`IMG EDIT\` ❐\n`;
    menu += `┃ ${prefix2}heart\n┃ ${prefix2}horny\n┃ ${prefix2}circle\n┃ ${prefix2}lgbt\n┃ ${prefix2}lolice\n┃ ${prefix2}stupid\n┃ ${prefix2}namecard\n┃ ${prefix2}tweet\n┃ ${prefix2}ytcomment\n┃ ${prefix2}comrade\n┃ ${prefix2}gay\n┃ ${prefix2}glass\n┃ ${prefix2}jail\n┃ ${prefix2}passed\n┃ ${prefix2}triggered\n`;
    menu += `┗❐\n`;

    return menu;
};

// Helper function to safely load thumbnail
async function loadThumbnail(thumbnailPath) {
    try {
        if (fs.existsSync(thumbnailPath)) {
            return fs.readFileSync(thumbnailPath);
        } else {
            console.log(`Thumbnail not found: ${thumbnailPath}, using fallback`);
            // Create a simple 1x1 pixel buffer as fallback
            return Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
        }
    } catch (error) {
        console.error('Error loading thumbnail:', error);
        // Return fallback buffer
        return Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    }
}

// Create fake contact for enhanced replies
function createFakeContact(message) {
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "status@broadcast",
            fromMe: false,
            id: "JUNE-X-MENU"
        },
        message: {
            contactMessage: {
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:JUNE X\nitem1.TEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

// YOUR EXACT MENU STYLE FUNCTION WITH FIXED tylorkids AND fkontak FOR ALL STYLES
async function sendMenuWithStyle(sock, chatId, message, menulist, menustyle, thumbnailBuffer, pushname) {
    const fkontak = createFakeContact(message);
    const botname = "JUNE-X BOT";
    const ownername = pushname;
    const tylorkids = thumbnailBuffer; // Fixed: using thumbnails from assets
    const plink = "https://github.com/vinpink2";

    if (menustyle === '1') {
        await sock.sendMessage(chatId, {
            document: {
                url: "https://i.ibb.co/2W0H9Jq/avatar-contact.png",
            },
            caption: menulist,
            mimetype: "application/zip",
            fileName: `${botname}`,
            fileLength: "9999999",
            contextInfo: {
                externalAdReply: {
                    showAdAttribution: false,
                    title: "",
                    body: "",
                    thumbnail: tylorkids,
                    sourceUrl: plink,
                    mediaType: 1,
                    renderLargerThumbnail: true,
                },
            },
        }, { quoted: fkontak });
    } else if (menustyle === '2') {
        await sock.sendMessage(chatId, { 
            text: menulist 
        }, { quoted: fkontak });
    } else if (menustyle === '3') {
        await sock.sendMessage(chatId, {
            text: menulist,
            contextInfo: {
                externalAdReply: {
                    showAdAttribution: false,
                    title: botname,
                    body: ownername,
                    thumbnail: tylorkids,
                    sourceUrl: plink,
                    mediaType: 1,
                    renderLargerThumbnail: true,
                },
            },
        }, { quoted: fkontak });
    } else if (menustyle === '4') {
        await sock.sendMessage(chatId, {
            image: tylorkids,
            caption: menulist,
        }, { quoted: fkontak });
    } else if (menustyle === '5') {
        let massage = generateWAMessageFromContent(chatId, {
            viewOnceMessage: {
                message: {
                    interactiveMessage: {
                        body: {
                            text: null,            
                        },
                        footer: {
                            text: menulist, 
                        },
                        nativeFlowMessage: {
                            buttons: [{
                                text: null
                            }], 
                        },
                    },
                },
            },
        }, { quoted: fkontak });
        await sock.relayMessage(chatId, massage.message, { messageId: massage.key.id });
    } else if (menustyle === '6') {
        await sock.relayMessage(chatId, {
            requestPaymentMessage: {
                currencyCodeIso4217: 'USD',
                requestFrom: '0@s.whatsapp.net',
                amount1000: '1',
                noteMessage: {
                    extendedTextMessage: {
                        text: menulist,
                        contextInfo: {
                            mentionedJid: [message.key.participant || message.key.remoteJid],
                            externalAdReply: {
                                showAdAttribution: false,
                            },
                        },
                    },
                },
            },
        }, {});
    } else {
        // Default fallback
        await sock.sendMessage(chatId, { 
            text: menulist 
        }, { quoted: fkontak });
    }
}

// Main help command function
async function helpCommand(sock, chatId, message) {
    const pushname = message.pushName || "Unknown User"; 
    const menuStyle = getMenuStyle();

    console.log('Current menu style:', menuStyle);

    let data = JSON.parse(fs.readFileSync('./data/messageCount.json'));
    
    // Create fake contact for enhanced reply
    const fkontak = createFakeContact(message);
    
    const start = Date.now();
    await sock.sendMessage(chatId, { 
        text: '_Wait loading menu..._' 
    }, { quoted: fkontak });
    const end = Date.now();
    const ping = Math.round((end - start) / 2);

    const uptimeInSeconds = process.uptime();
    const uptimeFormatted = formatTime(uptimeInSeconds);
    const currentMode = data.isPublic ? 'public' : 'private';
    const hostName = detectPlatform();
    
    const menulist = generateMenu(pushname, currentMode, hostName, ping, uptimeFormatted);

    // Random thumbnail selection from local files
    const thumbnailFiles = [
        'menu1.jpg',
        'menu2.jpg', 
        'menu3.jpg',
        'menu4.jpg',
        'menu5.jpg'
    ];
    const randomThumbFile = thumbnailFiles[Math.floor(Math.random() * thumbnailFiles.length)];
    const thumbnailPath = path.join(__dirname, '../assets', randomThumbFile);

    // Send reaction
    await sock.sendMessage(chatId, {
        react: { text: '📔', key: message.key }
    });

    try {
        // Load thumbnail using helper function
        const thumbnailBuffer = await loadThumbnail(thumbnailPath);

        // Send menu using YOUR EXACT menu style function
        await sendMenuWithStyle(sock, chatId, message, menulist, menuStyle, thumbnailBuffer, pushname);

        // Success reaction
        await sock.sendMessage(chatId, {
            react: { text: '✅', key: message.key }
        });

    } catch (error) {
        console.error('Error in help command:', error);
        // Fallback to simple text
        try {
            await sock.sendMessage(chatId, { 
                text: menulist 
            }, { quoted: fkontak });
        } catch (fallbackError) {
            console.error('Even fallback failed:', fallbackError);
        }
    }
}

module.exports = helpCommand;
