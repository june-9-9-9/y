const axios = require("axios");

async function ligue1StandingsCommand(sock, chatId, message) {
    try {
        // Send loading reaction
        await sock.sendMessage(chatId, { react: { text: '🔄', key: message.key } }, { quoted: message });

        const apiUrl = "https://api.dreaded.site/api/standings/FL1";
        const response = await axios.get(apiUrl);

        if (!response.data || !response.data.data) {
            await sock.sendMessage(chatId, { 
                text: '⚠️ Unable to fetch Ligue 1 standings. Please try again later.' 
            }, { quoted: message });

            await sock.sendMessage(chatId, { react: { text: '😕', key: message.key } }, { quoted: message });
            return;
        }

        const standings = response.data.data;

        let standingsList = `🏆 *LIGUE-1 TABLE STANDINGS* 🏆\n\n`;
        standingsList += `${standings}`;

        await sock.sendMessage(chatId, { text: standingsList }, { quoted: message });

        await sock.sendMessage(chatId, { react: { text: '🎉', key: message.key } }, { quoted: message });

    } catch (error) {
        console.error('Error fetching Ligue 1 standings:', error);

        await sock.sendMessage(chatId, { 
            text: '❌ Something went wrong. Unable to fetch Ligue 1 standings.' 
        }, { quoted: message });

        await sock.sendMessage(chatId, { react: { text: '💥', key: message.key } }, { quoted: message });
    }
}

async function laligaStandingsCommand(sock, chatId, message) {
    try {
        await sock.sendMessage(chatId, { react: { text: '🔄', key: message.key } }, { quoted: message });

        const apiUrl = "https://api.dreaded.site/api/standings/PD";
        const response = await axios.get(apiUrl);

        if (!response.data || !response.data.data) {
            await sock.sendMessage(chatId, { 
                text: '⚠️ Unable to fetch LaLiga standings. Please try again later.' 
            }, { quoted: message });

            await sock.sendMessage(chatId, { react: { text: '😕', key: message.key } }, { quoted: message });
            return;
        }

        const standings = response.data.data;

        let standingsList = `🏆 *LALIGA TABLE STANDINGS* 🏆\n\n`;
        standingsList += `${standings}`;

        await sock.sendMessage(chatId, { text: standingsList }, { quoted: message });

        await sock.sendMessage(chatId, { react: { text: '🔥', key: message.key } }, { quoted: message });

    } catch (error) {
        console.error('Error fetching LaLiga standings:', error);

        await sock.sendMessage(chatId, { 
            text: '❌ Something went wrong. Unable to fetch LaLiga standings.' 
        }, { quoted: message });

        await sock.sendMessage(chatId, { react: { text: '💥', key: message.key } }, { quoted: message });
    }
}

async function matchesCommand(sock, chatId, message) {
    try {
        await sock.sendMessage(chatId, { react: { text: '🔄', key: message.key } }, { quoted: message });

        const [plData, laligaData, bundesligaData, serieAData, ligue1Data] = await Promise.all([
            axios.get('https://api.dreaded.site/api/matches/PL'),
            axios.get('https://api.dreaded.site/api/matches/PD'),
            axios.get('https://api.dreaded.site/api/matches/BL1'),
            axios.get('https://api.dreaded.site/api/matches/SA'),
            axios.get('https://api.dreaded.site/api/matches/FR')
        ]);

        const pl = plData.data?.data || "No matches scheduled";
        const laliga = laligaData.data?.data || "No matches scheduled";
        const bundesliga = bundesligaData.data?.data || "No matches scheduled";
        const serieA = serieAData.data?.data || "No matches scheduled";
        const ligue1 = ligue1Data.data?.data || "No matches scheduled";

        let messageText = `📅 *Today's Football Matches* 📅\n\n`;

        const formatMatches = (matches, leagueName, emoji) => {
            if (typeof matches === 'string') {
                return `${emoji} ${leagueName}:\n${matches}\n\n`;
            } else if (Array.isArray(matches) && matches.length > 0) {
                const matchesList = matches.map(match => {
                    const { game, date, time } = match;
                    return `• ${game}\n  🗓️ ${date} | ⏰ ${time} (EAT)`;
                }).join('\n');
                return `${emoji} ${leagueName}:\n${matchesList}\n\n`;
            } else {
                return `${emoji} ${leagueName}: No matches scheduled\n\n`;
            }
        };

        messageText += formatMatches(pl, "Premier League", "👑");
        messageText += formatMatches(laliga, "La Liga", "💃");
        messageText += formatMatches(bundesliga, "Bundesliga", "⚡");
        messageText += formatMatches(serieA, "Serie A", "🍕");
        messageText += formatMatches(ligue1, "Ligue 1", "🥖");

        messageText += "⏰ Times are in East African Timezone (EAT)";

        if (messageText.length > 4096) {
            const chunks = [];
            let currentChunk = '';
            const lines = messageText.split('\n');
            
            for (const line of lines) {
                if (currentChunk.length + line.length + 1 > 4096) {
                    chunks.push(currentChunk);
                    currentChunk = line + '\n';
                } else {
                    currentChunk += line + '\n';
                }
            }
            if (currentChunk) chunks.push(currentChunk);
            
            await sock.sendMessage(chatId, { text: chunks[0] }, { quoted: message });
            
            for (let i = 1; i < chunks.length; i++) {
                await sock.sendMessage(chatId, { text: chunks[i] }, { quoted: message });
            }
        } else {
            await sock.sendMessage(chatId, { text: messageText }, { quoted: message });
        }

        await sock.sendMessage(chatId, { react: { text: '⚽', key: message.key } }, { quoted: message });

    } catch (error) {
        console.error('Error fetching matches:', error);

        await sock.sendMessage(chatId, { 
            text: '❌ Something went wrong. Unable to fetch matches.' 
        }, { quoted: message });

        await sock.sendMessage(chatId, { react: { text: '💥', key: message.key } }, { quoted: message });
    }
}

module.exports = {
    ligue1StandingsCommand,
    laligaStandingsCommand,
    matchesCommand
};
