const TicTacToe = require('../lib/tictactoe');

// Store games globally
const games = {};

async function tictactoeCommand(sock, chatId, senderId, text) {
    try {
        // Check if player is already in a game
        const existingGame = Object.values(games).find(room => 
            room.id && room.id.startsWith('tictactoe') && 
            (room.game.playerX === senderId || room.game.playerO === senderId) &&
            room.state !== 'ENDED'
        );

        if (existingGame) {
            await sock.sendMessage(chatId, { 
                text: '❌ You are still in a game. Type *surrender* to quit.' 
            });
            return;
        }

        // Clean up old games
        const now = Date.now();
        Object.keys(games).forEach(id => {
            if (games[id].state === 'ENDED' || 
                (id.includes('-') && now - parseInt(id.split('-')[1]) > 3600000)) {
                delete games[id];
            }
        });

        // Look for existing room to join
        let room = Object.values(games).find(room => 
            room.id && 
            room.id.startsWith('tictactoe') && 
            room.state === 'WAITING' && 
            (!text || room.name === text) &&
            room.x !== chatId
        );

        if (room) {
            // Join existing room
            room.o = chatId;
            room.game.playerO = senderId;
            room.state = 'PLAYING';

            const boardDisplay = room.game.renderWithCoordinates();
            
            const str = `
🎮 *TicTacToe Game Started!* 🎮

⏰ *Turn:* @${room.game.currentTurn.split('@')[0]} (${room.game.currentTurn === room.game.playerX ? '❎' : '⭕'})

${boardDisplay}

📊 *Players:*
❎ @${room.game.playerX.split('@')[0]}
⭕ @${room.game.playerO.split('@')[0]}

📝 *How to play:*
• Type number *1-9* to place your symbol
• Available moves: ${room.game.getAvailableMoves().join(', ')}
• Type *surrender* to give up
• Type *board* to show current board

🏆 *Win by* making 3 in a row vertically, horizontally or diagonally!
`;

            await sock.sendMessage(chatId, { 
                text: str,
                mentions: [room.game.currentTurn, room.game.playerX, room.game.playerO].filter(Boolean)
            });

            // Notify the creator
            if (room.x !== chatId) {
                await sock.sendMessage(room.x, { 
                    text: `🎮 Opponent found! Game has started.\n\n${boardDisplay}`
                });
            }

        } else {
            // Create new room with emoji numbers enabled
            room = {
                id: 'tictactoe-' + Date.now(),
                x: chatId,
                o: '',
                game: new TicTacToe(senderId, null, { 
                    useEmojiNumbers: true,
                    highlightWinner: true 
                }),
                state: 'WAITING'
            };

            // Store game type/name if provided
            if (text) room.name = text;

            games[room.id] = room;

            const emojiBoard = room.game.render(); // assume string
            const emojiRows = [
                emojiBoard.slice(0, 3),
                emojiBoard.slice(3, 6),
                emojiBoard.slice(6)
            ].join('\n');

            await sock.sendMessage(chatId, { 
                text: `🎮 *TicTacToe Room Created!* 🎮

${emojiRows}

⏳ *Waiting for opponent...*
📝 Type *.ttt${text ? ' ' + text : ''}* to join!

🎲 *Room ID:* ${room.id.substring(0, 8)}...
⏰ *Expires in:* 5 minutes

📋 *Available symbols:*
1️⃣ 2️⃣ 3️⃣
4️⃣ 5️⃣ 6️⃣
7️⃣ 8️⃣ 9️⃣
`
            });

            // Auto-cleanup after 5 minutes
            setTimeout(() => {
                if (games[room.id] && games[room.id].state === 'WAITING') {
                    delete games[room.id];
                    sock.sendMessage(chatId, { 
                        text: '⌛ *Room expired.* No one joined the game.' 
                    }).catch(() => {});
                }
            }, 300000);
        }

    } catch (error) {
        console.error('Error in tictactoe command:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Error starting game. Please try again.' 
        });
    }
}

module.exports = {
    tictactoeCommand
};
