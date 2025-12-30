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
        Object.keys(games).forEach(id => {
            if (games[id].state === 'ENDED' || Date.now() - parseInt(id.split('-')[1]) > 3600000) {
                delete games[id];
            }
        });

        // Look for existing room to join
        let room = Object.values(games).find(room => 
            room.id && 
            room.id.startsWith('tictactoe') && 
            room.state === 'WAITING' && 
            (!text || room.name === text) &&
            room.x !== chatId // Prevent joining your own waiting room in same chat
        );

        if (room) {
            // Join existing room
            room.o = chatId;
            room.game.playerO = senderId;
            room.state = 'PLAYING';

            const arr = room.game.render().map(v => ({
                'X': '❎',
                'O': '⭕',
                '1': '1️⃣',
                '2': '2️⃣',
                '3': '3️⃣',
                '4': '4️⃣',
                '5': '5️⃣',
                '6': '6️⃣',
                '7': '7️⃣',
                '8': '8️⃣',
                '9': '9️⃣',
            }[v] || '⬜'));

            const str = `
🎮 *TicTacToe Game Started!*

Waiting for @${room.game.currentTurn.split('@')[0]} to play...

${arr.slice(0, 3).join('')}
${arr.slice(3, 6).join('')}
${arr.slice(6).join('')}

▢ *Room ID:* ${room.id}
▢ *Rules:*
• Make 3 rows of symbols vertically, horizontally or diagonally to win
• Type a number (1-9) to place your symbol
• Type *surrender* to give up
`;

            await sock.sendMessage(chatId, { 
                text: str,
                mentions: [room.game.currentTurn, room.game.playerX, room.game.playerO]
            });

            // Also notify the creator
            if (room.x !== chatId) {
                await sock.sendMessage(room.x, { 
                    text: `🎮 Opponent found! Game has started in another chat.`
                });
            }

        } else {
            // Create new room
            room = {
                id: 'tictactoe-' + Date.now(),
                x: chatId,
                o: '',
                game: new TicTacToe(senderId, 'o'),
                state: 'WAITING'
            };

            // Store game type/name if provided
            if (text) room.name = text;

            games[room.id] = room;

            await sock.sendMessage(chatId, { 
                text: `⏳ *Waiting for opponent...*\nType *.ttt${text ? ' ' + text : ''}* to join!\n\nRoom will expire in 5 minutes.`
            });

            // Auto-cleanup after 5 minutes if no one joins
            setTimeout(() => {
                if (games[room.id] && games[room.id].state === 'WAITING') {
                    delete games[room.id];
                    sock.sendMessage(chatId, { 
                        text: '⌛ Room expired. No one joined the game.' 
                    }).catch(() => {});
                }
            }, 300000); // 5 minutes

        }

    } catch (error) {
        console.error('Error in tictactoe command:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Error starting game. Please try again.' 
        });
    }
}

async function handleTicTacToeMove(sock, chatId, senderId, text) {
    try {
        // Find player's game
        const room = Object.values(games).find(room => 
            room.id && 
            room.id.startsWith('tictactoe') && 
            (room.game.playerX === senderId || room.game.playerO === senderId) && 
            room.state === 'PLAYING'
        );

        if (!room) return;

        const isSurrender = /^(surrender|give up|quit|resign)$/i.test(text);
        
        // If not a valid move command and not surrender, ignore
        if (!isSurrender && !/^[1-9]$/.test(text)) return;

        // Check if it's player's turn (except for surrender)
        if (senderId !== room.game.currentTurn && !isSurrender) {
            await sock.sendMessage(chatId, { 
                text: '❌ Not your turn! Wait for your opponent to move.' 
            });
            return;
        }

        let moveResult;
        if (isSurrender) {
            moveResult = true; // Allow surrender
        } else {
            try {
                moveResult = room.game.turn(
                    senderId === room.game.playerO, // true if player is O
                    parseInt(text) - 1
                );
            } catch (error) {
                console.error('Move error:', error);
                await sock.sendMessage(chatId, { 
                    text: '❌ Invalid move! Please choose a number between 1-9.' 
                });
                return;
            }
        }

        if (!moveResult) {
            await sock.sendMessage(chatId, { 
                text: '❌ Invalid move! That position is already taken.' 
            });
            return;
        }

        let winner = null;
        let isTie = false;
        
        if (isSurrender) {
            // Set winner to opponent
            winner = senderId === room.game.playerX ? room.game.playerO : room.game.playerX;
            room.state = 'ENDED';
            
            const surrenderMessage = `🏳️ @${senderId.split('@')[0]} has surrendered!\n🎉 @${winner.split('@')[0]} wins the game!`;
            
            // Send to both players
            const mentions = [senderId, winner];
            await sock.sendMessage(room.x, { 
                text: surrenderMessage,
                mentions: mentions
            });
            
            if (room.o && room.x !== room.o) {
                await sock.sendMessage(room.o, { 
                    text: surrenderMessage,
                    mentions: mentions
                });
            }
            
            delete games[room.id];
            return;
        }

        // Check game status
        winner = room.game.winner || null;
        isTie = room.game.turns >= 9 && !winner;

        const arr = room.game.render().map(v => ({
            'X': '❎',
            'O': '⭕',
            '1': '1️⃣',
            '2': '2️⃣',
            '3': '3️⃣',
            '4': '4️⃣',
            '5': '5️⃣',
            '6': '6️⃣',
            '7': '7️⃣',
            '8': '8️⃣',
            '9': '9️⃣',
        }[v] || '⬜'));

        let gameStatus;
        if (winner) {
            gameStatus = `🎉 @${winner.split('@')[0]} wins the game!`;
            room.state = 'ENDED';
        } else if (isTie) {
            gameStatus = `🤝 Game ended in a draw!`;
            room.state = 'ENDED';
        } else {
            gameStatus = `🎲 Turn: @${room.game.currentTurn.split('@')[0]} (${room.game.currentTurn === room.game.playerX ? '❎' : '⭕'})`;
        }

        const str = `
🎮 *TicTacToe Game*

${gameStatus}

${arr.slice(0, 3).join('')}
${arr.slice(3, 6).join('')}
${arr.slice(6).join('')}

▢ Player ❎: @${room.game.playerX.split('@')[0]}
▢ Player ⭕: @${room.game.playerO.split('@')[0]}

${!winner && !isTie ? '• Type a number (1-9) to make your move\n• Type *surrender* to give up' : '• Type *.ttt* to start a new game'}
`;

        const mentions = [
            room.game.playerX, 
            room.game.playerO,
            ...(winner ? [winner] : [room.game.currentTurn])
        ];

        // Send to both players
        await sock.sendMessage(room.x, { 
            text: str,
            mentions: mentions
        });

        if (room.o && room.x !== room.o) {
            await sock.sendMessage(room.o, { 
                text: str,
                mentions: mentions
            });
        }

        if (winner || isTie) {
            delete games[room.id];
        }

    } catch (error) {
        console.error('Error in tictactoe move:', error);
        try {
            await sock.sendMessage(chatId, { 
                text: '❌ An error occurred during the move. Please start a new game.' 
            });
        } catch (e) {}
    }
}

module.exports = {
    tictactoeCommand,
    handleTicTacToeMove
};
