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
                mentions: [room.game.currentTurn, room.game.playerX, room.game.playerO]
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
                game: new TicTacToe(senderId, 'o', { 
                    useEmojiNumbers: true,
                    highlightWinner: true 
                }),
                state: 'WAITING'
            };

            // Store game type/name if provided
            if (text) room.name = text;

            games[room.id] = room;

            const emojiBoard = room.game.render().join(' ');
            const emojiRows = [
                emojiBoard.slice(0, 3).join(''),
                emojiBoard.slice(3, 6).join(''),
                emojiBoard.slice(6).join('')
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

        const isSurrender = /^(surrender|give up|quit|resign|ff)$/i.test(text);
        const showBoard = /^(board|status|show)$/i.test(text);
        
        if (showBoard) {
            const boardDisplay = room.game.renderWithCoordinates();
            const stats = room.game.getStats();
            
            await sock.sendMessage(chatId, { 
                text: `📊 *Current Board*\n\n${boardDisplay}\n\n⏰ Turn ${stats.turns}/9\n🎲 Next: @${room.game.currentTurn.split('@')[0]}`,
                mentions: [room.game.currentTurn]
            });
            return;
        }
        
        // If not a valid move command and not surrender, ignore
        if (!isSurrender && !/^[1-9]$/.test(text)) return;

        // Check if it's player's turn (except for surrender)
        if (senderId !== room.game.currentTurn && !isSurrender) {
            const waitMsg = `⏳ Not your turn! Wait for @${room.game.currentTurn.split('@')[0]} to move.`;
            await sock.sendMessage(chatId, { 
                text: waitMsg,
                mentions: [room.game.currentTurn]
            });
            return;
        }

        let moveResult;
        if (isSurrender) {
            moveResult = true;
        } else {
            try {
                moveResult = room.game.turn(
                    senderId === room.game.playerO,
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
            const available = room.game.getAvailableMoves();
            await sock.sendMessage(chatId, { 
                text: `❌ Invalid move! Position already taken.\n📋 Available moves: ${available.join(', ')}` 
            });
            return;
        }

        let winner = null;
        let isTie = false;
        
        if (isSurrender) {
            winner = senderId === room.game.playerX ? room.game.playerO : room.game.playerX;
            room.state = 'ENDED';
            
            const surrenderMessage = `🏳️ *Surrender!*\n@${senderId.split('@')[0]} has given up!\n\n🎉 @${winner.split('@')[0]} wins the game!`;
            
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
        const stats = room.game.getStats();

        const boardDisplay = room.game.renderWithCoordinates();
        
        let gameStatus;
        if (winner) {
            gameStatus = `🏆 *VICTORY!* 🏆\n@${winner.split('@')[0]} wins the game!`;
            room.state = 'ENDED';
        } else if (isTie) {
            gameStatus = `🤝 *DRAW!* 🤝\nGame ended in a tie!`;
            room.state = 'ENDED';
        } else {
            gameStatus = `🎲 *Turn ${stats.turns}/9*\nNext: @${room.game.currentTurn.split('@')[0]} (${room.game.currentTurn === room.game.playerX ? '❎' : '⭕'})`;
        }

        const str = `
🎮 *TicTacToe Game* 🎮

${gameStatus}

${boardDisplay}

📊 *Stats:*
❎ @${room.game.playerX.split('@')[0]}
⭕ @${room.game.playerO.split('@')[0]}
⏰ Time: ${stats.duration}

${!winner && !isTie ? 
`📝 *Available moves:* ${room.game.getAvailableMoves().join(', ')}

💡 *Commands:*
• Type number *1-9* to place your symbol
• Type *surrender* to give up
• Type *board* to show current board` : 
`🎮 *Game Over!*
Type *.ttt* to start a new game!`}
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
                text: '❌ An error occurred. Please start a new game with *.ttt*' 
            });
        } catch (e) {}
    }
}

module.exports = {
    tictactoeCommand,
    handleTicTacToeMove
};
