const axios = require("axios");

// Create fake contact for quoting
function createFakeContact(message) {
    const participantId = message?.key?.participant?.split('@')[0] || 
                          message?.key?.remoteJid?.split('@')[0] || '0';

    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "0@s.whatsapp.net",
            fromMe: false
        },
        message: {
            contactMessage: {
                displayName: "DAVE-X",
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:DAVE-X\nitem1.TEL;waid=${participantId}:${participantId}\nitem1.X-ABLabel:Phone\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

// Generic helper for sending reactions
async function sendReaction(sock, chatId, key, emoji) {
    await sock.sendMessage(chatId, { react: { text: emoji, key } });
}

// Generic helper for fetching standings
async function fetchStandings(sock, chatId, message, leagueCode, leagueName) {
    const fake = createFakeContact(message);
    try {
        await sendReaction(sock, chatId, message.key, '⏳');

        const apiUrl = `https://api.dreaded.site/api/standings/${leagueCode}`;
        const response = await axios.get(apiUrl);

        if (!response.data?.data) {
            await sock.sendMessage(chatId, { 
                text: `❌ Unable to fetch ${leagueName} standings. Please try again later.` 
            }, { quoted: fake });
            await sendReaction(sock, chatId, message.key, '❌');
            return;
        }

        const standingsList = `⚽ *${leagueName.toUpperCase()} TABLE STANDINGS* ⚽\n\n${response.data.data}`;
        await sock.sendMessage(chatId, { text: standingsList }, { quoted: fake });

        await sendReaction(sock, chatId, message.key, '✅');
    } catch (error) {
        console.error(`Error fetching ${leagueName} standings:`, error);
        await sock.sendMessage(chatId, { 
            text: `❌ Something went wrong. Unable to fetch ${leagueName} standings.` 
        }, { quoted: fake });
        await sendReaction(sock, chatId, message.key, '❌');
    }
}

// Specific commands
async function ligue1StandingsCommand(sock, chatId, message) {
    return fetchStandings(sock, chatId, message, "FL1", "Ligue 1");
}

async function laligaStandingsCommand(sock, chatId, message) {
    return fetchStandings(sock, chatId, message, "PD", "LaLiga");
}

// Matches command
async function matchesCommand(sock, chatId, message) {
    const fake = createFakeContact(message);
    try {
        await sendReaction(sock, chatId, message.key, '⏳');

        const leagues = [
            { code: "PL", name: "Premier League", emoji: "🇬🇧" },
            { code: "PD", name: "La Liga", emoji: "🇪🇸" },
            { code: "BL1", name: "Bundesliga", emoji: "🇩🇪" },
            { code: "SA", name: "Serie A", emoji: "🇮🇹" },
            { code: "FR", name: "Ligue 1", emoji: "🇫🇷" }
        ];

        const results = await Promise.all(
            leagues.map(l => axios.get(`https://api.dreaded.site/api/matches/${l.code}`))
        );

        let messageText = `⚽ *Today's Football Matches* ⚽\n\n`;

        leagues.forEach((league, i) => {
            const matches = results[i].data?.data || "No matches scheduled";
            if (typeof matches === 'string') {
                messageText += `${league.emoji} ${league.name}:\n${matches}\n\n`;
            } else if (Array.isArray(matches) && matches.length > 0) {
                const matchesList = matches.map(m => 
                    `• ${m.game}\n  📅 ${m.date} | 🕐 ${m.time} (EAT)`
                ).join('\n');
                messageText += `${league.emoji} ${league.name}:\n${matchesList}\n\n`;
            } else {
                messageText += `${league.emoji} ${league.name}: No matches scheduled\n\n`;
            }
        });

        messageText += "🕐 Times are in East African Timezone (EAT)";

        // Handle long messages
        if (messageText.length > 4096) {
            const chunks = [];
            let currentChunk = '';
            for (const line of messageText.split('\n')) {
                if (currentChunk.length + line.length + 1 > 4096) {
                    chunks.push(currentChunk);
                    currentChunk = line + '\n';
                } else {
                    currentChunk += line + '\n';
                }
            }
            if (currentChunk) chunks.push(currentChunk);

            await sock.sendMessage(chatId, { text: chunks[0] }, { quoted: fake });
            for (let i = 1; i < chunks.length; i++) {
                await sock.sendMessage(chatId, { text: chunks[i] });
            }
        } else {
            await sock.sendMessage(chatId, { text: messageText }, { quoted: fake });
        }

        await sendReaction(sock, chatId, message.key, '✅');
    } catch (error) {
        console.error('Error fetching matches:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Something went wrong. Unable to fetch matches.' 
        }, { quoted: fake });
        await sendReaction(sock, chatId, message.key, '❌');
    }
}

module.exports = {
    ligue1StandingsCommand,
    laligaStandingsCommand,
    matchesCommand
};
