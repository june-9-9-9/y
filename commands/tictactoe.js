const TicTacToe = require('../lib/tictactoe');

// Store games globally
const games = {};

async function tictactoeCommand(sock, chatId, senderId, text) {
    try {
        // ... your existing room creation/join logic ...
        // (unchanged from your snippet)
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

        if (!isSurrender && !/^[1-9]$/.test(text)) return;

        // Check turn
        if (senderId !== room.game.currentTurn && !isSurrender) {
            await sock.sendMessage(chatId, { 
                text: `⏳ Not your turn! Wait for @${room.game.currentTurn.split('@')[0]}`,
                mentions: [room.game.currentTurn]
            });
            return;
        }

        let moveResult;
        if (isSurrender) {
            moveResult = true;
        } else {
            moveResult = room.game.turn(senderId === room.game.playerO, parseInt(text) - 1);
        }

        if (!moveResult) {
            await sock.sendMessage(chatId, { 
                text: `❌ Invalid move! Available: ${room.game.getAvailableMoves().join(', ')}`
            });
            return;
        }

        // Check status
        const winner = room.game.winner;
        const isTie = room.game.turns >= 9 && !winner;
        const stats = room.game.getStats();
        const boardDisplay = room.game.renderWithCoordinates();

        let gameStatus;
        if (winner) {
            gameStatus = `🏆 *VICTORY!* @${winner.split('@')[0]} wins!`;
            room.state = 'ENDED';
        } else if (isTie) {
            gameStatus = `🤝 *DRAW!* Game ended in a tie.`;
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
`;

        const mentions = [room.game.playerX, room.game.playerO].filter(Boolean);

        await sock.sendMessage(room.x, { text: str, mentions });
        if (room.o && room.x !== room.o) {
            await sock.sendMessage(room.o, { text: str, mentions });
        }

        if (winner || isTie) delete games[room.id];

    } catch (error) {
        console.error('Error in tictactoe move:', error);
        await sock.sendMessage(chatId, { text: '❌ Error occurred. Start new game with *.ttt*' });
    }
}

module.exports = {
    tictactoeCommand,
    handleTicTacToeMove
};
