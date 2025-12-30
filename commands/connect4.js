const ConnectFour = require('../lib/connect4'); // You'll need to create this module

// Store games globally
const connectFourGames = {};

async function connectFourCommand(sock, chatId, senderId, text) {
    try {
        // Check if player is already in a game
        const existingGame = Object.values(connectFourGames).find(room => 
            room.id && room.id.startsWith('connectfour') && 
            (room.game.playerRed === senderId || room.game.playerYellow === senderId) &&
            room.state !== 'ENDED'
        );

        if (existingGame) {
            await sock.sendMessage(chatId, { 
                text: '❌ You are already in a Connect Four game. Type *.forfeit* to quit.' 
            });
            return;
        }

        // Clean up old games
        Object.keys(connectFourGames).forEach(id => {
            if (connectFourGames[id].state === 'ENDED' || Date.now() - parseInt(id.split('-')[1]) > 3600000) {
                delete connectFourGames[id];
            }
        });

        // Look for existing room to join
        let room = Object.values(connectFourGames).find(room => 
            room.id && 
            room.id.startsWith('connectfour') && 
            room.state === 'WAITING' && 
            (!text || room.name === text) &&
            room.red !== chatId // Prevent joining your own waiting room
        );

        if (room) {
            // Join existing room
            room.yellow = chatId;
            room.game.playerYellow = senderId;
            room.state = 'PLAYING';

            const board = room.game.render();
            const str = `
🎮 *Connect Four Game Started!*

Waiting for @${room.game.currentTurn.split('@')[0]} to make a move...

${board}

▢ *Room ID:* ${room.id}
▢ *Rules:*
• Use *.drop <column>* to drop your disc (1-7)
• Connect 4 discs horizontally, vertically, or diagonally to win
• Type *.forfeit* to give up

🔴 Red Player: @${room.game.playerRed.split('@')[0]}
🟡 Yellow Player: @${room.game.playerYellow.split('@')[0]}
`;

            await sock.sendMessage(chatId, { 
                text: str,
                mentions: [room.game.currentTurn, room.game.playerRed, room.game.playerYellow]
            });

            // Also notify the creator
            if (room.red !== chatId) {
                await sock.sendMessage(room.red, { 
                    text: `🎮 Opponent found! Connect Four game has started in another chat.`
                });
            }

        } else {
            // Create new room
            room = {
                id: 'connectfour-' + Date.now(),
                red: chatId,
                yellow: '',
                game: new ConnectFour(senderId, 'yellow'), // Creator is red
                state: 'WAITING'
            };

            // Store game type/name if provided
            if (text) room.name = text;

            connectFourGames[room.id] = room;

            await sock.sendMessage(chatId, { 
                text: `⏳ *Waiting for Connect Four opponent...*\nType *.connectfour${text ? ' ' + text : ''}* to join!\n\nYou will be 🔴 Red. Room will expire in 5 minutes.\n\n*Commands:*\n• .drop <1-7> - Drop disc in column\n• .forfeit - Give up`
            });

            // Auto-cleanup after 5 minutes if no one joins
            setTimeout(() => {
                if (connectFourGames[room.id] && connectFourGames[room.id].state === 'WAITING') {
                    delete connectFourGames[room.id];
                    sock.sendMessage(chatId, { 
                        text: '⌛ Room expired. No one joined the Connect Four game.' 
                    }).catch(() => {});
                }
            }, 300000); // 5 minutes

        }

    } catch (error) {
        console.error('Error in connectfour command:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Error starting Connect Four game. Please try again.' 
        });
    }
}

async function handleConnectFourMove(sock, chatId, senderId, columnText) {
    try {
        // Find player's game
        const room = Object.values(connectFourGames).find(room => 
            room.id && 
            room.id.startsWith('connectfour') && 
            (room.game.playerRed === senderId || room.game.playerYellow === senderId) && 
            room.state === 'PLAYING'
        );

        if (!room) return false; // Return false if no game found

        const isForfeit = /^(forfeit|give up|quit|resign|surrender)$/i.test(columnText);
        const column = parseInt(columnText);
        
        // If not a valid move command and not forfeit, ignore
        if (!isForfeit && (isNaN(column) || column < 1 || column > 7)) return false;

        // Check if it's player's turn (except for forfeit)
        if (senderId !== room.game.currentTurn && !isForfeit) {
            await sock.sendMessage(chatId, { 
                text: '❌ Not your turn! Wait for your opponent to move.' 
            });
            return true;
        }

        let moveResult;
        if (isForfeit) {
            moveResult = true; // Allow forfeit
        } else {
            try {
                moveResult = room.game.dropDisc(
                    senderId === room.game.playerYellow, // true if player is yellow
                    column - 1 // Convert to 0-indexed
                );
            } catch (error) {
                console.error('Move error:', error);
                await sock.sendMessage(chatId, { 
                    text: '❌ Invalid column! Please use *.drop 1* to *.drop 7*.' 
                });
                return true;
            }
        }

        if (!moveResult && !isForfeit) {
            await sock.sendMessage(chatId, { 
                text: '❌ Column is full! Choose another column.' 
            });
            return true;
        }

        let winner = null;
        let isDraw = false;
        
        if (isForfeit) {
            // Set winner to opponent
            winner = senderId === room.game.playerRed ? room.game.playerYellow : room.game.playerRed;
            room.state = 'ENDED';
            
            const forfeitMessage = `🏳️ @${senderId.split('@')[0]} has forfeited!\n🎉 @${winner.split('@')[0]} wins the Connect Four game!`;
            
            // Send to both players
            const mentions = [senderId, winner];
            await sock.sendMessage(room.red, { 
                text: forfeitMessage,
                mentions: mentions
            });
            
            if (room.yellow && room.red !== room.yellow) {
                await sock.sendMessage(room.yellow, { 
                    text: forfeitMessage,
                    mentions: mentions
                });
            }
            
            delete connectFourGames[room.id];
            return true;
        }

        // Check game status
        winner = room.game.winner || null;
        isDraw = room.game.isDraw();

        const board = room.game.render();
        let gameStatus;
        if (winner) {
            const winnerSymbol = winner === room.game.playerRed ? '🔴' : '🟡';
            gameStatus = `${winnerSymbol} @${winner.split('@')[0]} wins by connecting four!`;
            room.state = 'ENDED';
        } else if (isDraw) {
            gameStatus = `🤝 Game ended in a draw! Board is full.`;
            room.state = 'ENDED';
        } else {
            const turnSymbol = room.game.currentTurn === room.game.playerRed ? '🔴' : '🟡';
            gameStatus = `🎲 Turn: @${room.game.currentTurn.split('@')[0]} (${turnSymbol})`;
        }

        const str = `
🎮 *Connect Four Game*

${gameStatus}

${board}

🔴 Red Player: @${room.game.playerRed.split('@')[0]}
🟡 Yellow Player: @${room.game.playerYellow.split('@')[0]}

${!winner && !isDraw ? '• Use *.drop <1-7>* to make your move\n• Type *.forfeit* to give up' : '• Type *.connectfour* to start a new game'}
`;

        const mentions = [
            room.game.playerRed, 
            room.game.playerYellow,
            ...(winner ? [winner] : [room.game.currentTurn])
        ];

        // Send to both players
        await sock.sendMessage(room.red, { 
            text: str,
            mentions: mentions
        });

        if (room.yellow && room.red !== room.yellow) {
            await sock.sendMessage(room.yellow, { 
                text: str,
                mentions: mentions
            });
        }

        if (winner || isDraw) {
            delete connectFourGames[room.id];
        }

        return true;

    } catch (error) {
        console.error('Error in connectfour move:', error);
        try {
            await sock.sendMessage(chatId, { 
                text: '❌ An error occurred during the move. Please start a new game.' 
            });
        } catch (e) {}
        return true;
    }
}

module.exports = {
    connectFourCommand,
    handleConnectFourMove
};
