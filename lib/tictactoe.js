// lib/tictactoe.js
class TicTacToe {
    constructor(playerX, playerO, options = {}) {
        this.playerX = playerX;
        this.playerO = playerO;
        this.currentTurn = playerX;
        
        // Emoji mapping for numbers and symbols
        this.emojiMap = {
            '1': '1️⃣', '2': '2️⃣', '3': '3️⃣',
            '4': '4️⃣', '5': '5️⃣', '6': '6️⃣',
            '7': '7️⃣', '8': '8️⃣', '9': '9️⃣',
            'X': '❎', 'O': '⭕',
            'X_win': '✨', 'O_win': '⭐',
            'empty': '⬜'
        };
        
        // Initialize boards
        this.originalBoard = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
        this.displayBoard = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
        
        this.turns = 0;
        this.winner = null;
        this.winningLine = null;
        this.gameStarted = Date.now();
        
        // Options with defaults
        this.useEmojiNumbers = options.useEmojiNumbers !== false; // Default true
        this.highlightWinner = options.highlightWinner !== false; // Default true
        this.showCoordinates = options.showCoordinates !== false; // Default true
        
        // Game history
        this.movesHistory = [];
        this.lastMove = null;
    }

    turn(isO, pos) {
        pos = parseInt(pos);
        
        // Validate position
        if (pos < 0 || pos > 8) {
            return false;
        }
        
        // Check if position is already taken
        const currentValue = this.originalBoard[pos];
        if (currentValue === 'X' || currentValue === 'O') {
            return false;
        }
        
        // Make the move
        const symbol = isO ? 'O' : 'X';
        const displaySymbol = isO ? '⭕' : '❎';
        const player = isO ? this.playerO : this.playerX;
        
        // Update boards
        this.originalBoard[pos] = symbol;
        this.displayBoard[pos] = displaySymbol;
        
        // Record move
        this.movesHistory.push({
            turn: this.turns + 1,
            player: player,
            position: pos,
            symbol: symbol,
            timestamp: Date.now()
        });
        
        this.lastMove = {
            player: player,
            position: pos,
            symbol: symbol
        };
        
        this.turns++;
        
        // Switch turn
        this.currentTurn = isO ? this.playerX : this.playerO;
        
        // Check for winner
        this.checkWinner();
        
        return true;
    }

    checkWinner() {
        const winPatterns = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
            [0, 4, 8], [2, 4, 6]             // Diagonals
        ];

        for (const pattern of winPatterns) {
            const [a, b, c] = pattern;
            const valA = this.originalBoard[a];
            const valB = this.originalBoard[b];
            const valC = this.originalBoard[c];
            
            // Check if all three positions have the same symbol (X or O)
            if (valA === valB && valB === valC && (valA === 'X' || valA === 'O')) {
                this.winner = valA === 'X' ? this.playerX : this.playerO;
                this.winningLine = pattern;
                
                // Highlight winning line if enabled
                if (this.highlightWinner) {
                    this.highlightWinningLine();
                }
                return;
            }
        }
    }

    highlightWinningLine() {
        if (!this.winningLine) return;
        
        const winningSymbol = this.originalBoard[this.winningLine[0]];
        const highlightEmoji = winningSymbol === 'X' ? this.emojiMap['X_win'] : this.emojiMap['O_win'];
        
        for (const pos of this.winningLine) {
            this.displayBoard[pos] = highlightEmoji;
        }
    }

    render() {
        if (!this.useEmojiNumbers) {
            return this.originalBoard.slice();
        }
        return this.displayBoard.slice();
    }

    renderWithCoordinates() {
        const board = this.displayBoard;
        const rows = [];
        
        for (let i = 0; i < 3; i++) {
            const row = [];
            for (let j = 0; j < 3; j++) {
                const pos = i * 3 + j;
                row.push(board[pos]);
            }
            if (this.showCoordinates) {
                rows.push(`${row.join(' │ ')}`);
            } else {
                rows.push(row.join(''));
            }
        }
        
        if (this.showCoordinates) {
            return rows.join('\n───┼───┼───\n');
        }
        return rows.join('\n');
    }

    getStats() {
        const duration = Date.now() - this.gameStarted;
        const minutes = Math.floor(duration / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);
        
        return {
            turns: this.turns,
            duration: `${minutes}m ${seconds}s`,
            durationMs: duration,
            boardState: this.render(),
            winner: this.winner,
            isDraw: this.turns === 9 && !this.winner,
            currentPlayer: this.currentTurn === this.playerX ? 'X (❎)' : 'O (⭕)',
            winningLine: this.winningLine,
            lastMove: this.lastMove,
            movesHistory: this.movesHistory,
            playerX: this.playerX,
            playerO: this.playerO
        };
    }

    getAvailableMoves() {
        const moves = [];
        this.originalBoard.forEach((cell, index) => {
            if (cell !== 'X' && cell !== 'O') {
                moves.push(index + 1); // Return 1-9 instead of 0-8
            }
        });
        return moves;
    }

    isGameOver() {
        return this.winner !== null || this.turns === 9;
    }

    getWinner() {
        if (this.winner) {
            return {
                player: this.winner,
                symbol: this.winner === this.playerX ? 'X' : 'O',
                line: this.winningLine
            };
        }
        return null;
    }

    getBoardAsGrid() {
        const grid = [];
        for (let i = 0; i < 3; i++) {
            grid.push(this.displayBoard.slice(i * 3, i * 3 + 3));
        }
        return grid;
    }

    getBoardAsText() {
        const grid = this.getBoardAsGrid();
        let text = '';
        for (let i = 0; i < grid.length; i++) {
            text += grid[i].join(' ');
            if (i < grid.length - 1) text += '\n';
        }
        return text;
    }

    getPlayerSymbol(playerId) {
        if (playerId === this.playerX) return { symbol: 'X', emoji: '❎' };
        if (playerId === this.playerO) return { symbol: 'O', emoji: '⭕' };
        return null;
    }

    isPlayerTurn(playerId) {
        return this.currentTurn === playerId;
    }

    getGameInfo() {
        const stats = this.getStats();
        return {
            id: `ttt-${this.gameStarted}`,
            players: {
                X: this.playerX,
                O: this.playerO
            },
            status: this.isGameOver() ? 'ended' : 'playing',
            turns: stats.turns,
            duration: stats.duration,
            winner: stats.winner,
            board: this.getBoardAsText()
        };
    }

    reset() {
        // Save old game info
        const oldGame = this.getGameInfo();
        
        // Reset to initial state
        this.originalBoard = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
        this.displayBoard = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
        this.turns = 0;
        this.winner = null;
        this.winningLine = null;
        this.gameStarted = Date.now();
        this.movesHistory = [];
        this.lastMove = null;
        
        // Alternate starting player
        this.currentTurn = this.currentTurn === this.playerX ? this.playerO : this.playerX;
        
        return oldGame;
    }

    // Static helper methods
    static getPositionCoordinates(position) {
        // Convert 1-9 to row,col coordinates
        const pos = parseInt(position) - 1;
        if (pos < 0 || pos > 8) return null;
        
        const row = Math.floor(pos / 3);
        const col = pos % 3;
        return { row: row + 1, col: col + 1, index: pos };
    }

    static getPositionFromCoordinates(row, col) {
        // Convert row,col to 1-9 position
        if (row < 1 || row > 3 || col < 1 || col > 3) return null;
        return (row - 1) * 3 + (col - 1) + 1;
    }

    static isValidMove(board, position) {
        const pos = parseInt(position) - 1;
        if (pos < 0 || pos > 8) return false;
        
        const cell = board[pos];
        return !(cell === 'X' || cell === 'O' || cell === '❎' || cell === '⭕' || cell === '✨' || cell === '⭐');
    }

    static getEmptyPositions(board) {
        const positions = [];
        board.forEach((cell, index) => {
            if (cell !== 'X' && cell !== 'O' && cell !== '❎' && cell !== '⭕' && 
                cell !== '✨' && cell !== '⭐' && !cell.includes('️')) {
                positions.push(index + 1);
            }
        });
        return positions;
    }

    // AI Helper - Simple random move
    getRandomMove() {
        const available = this.getAvailableMoves();
        if (available.length === 0) return null;
        return available[Math.floor(Math.random() * available.length)];
    }

    // Create a visual representation of the board with numbers
    static createNumberBoard() {
        return [
            '1️⃣', '2️⃣', '3️⃣',
            '4️⃣', '5️⃣', '6️⃣',
            '7️⃣', '8️⃣', '9️⃣'
        ];
    }

    // Convert position to emoji
    static positionToEmoji(position) {
        const emojiMap = {
            1: '1️⃣', 2: '2️⃣', 3: '3️⃣',
            4: '4️⃣', 5: '5️⃣', 6: '6️⃣',
            7: '7️⃣', 8: '8️⃣', 9: '9️⃣'
        };
        return emojiMap[position] || position.toString();
    }

    // Create ASCII board
    createAsciiBoard() {
        const board = this.displayBoard;
        return `
 ${board[0]} │ ${board[1]} │ ${board[2]}
───┼───┼───
 ${board[3]} │ ${board[4]} │ ${board[5]}
───┼───┼───
 ${board[6]} │ ${board[7]} │ ${board[8]}
`;
    }

    // Get game summary
    getSummary() {
        const stats = this.getStats();
        const winnerInfo = this.getWinner();
        
        return {
            totalTurns: stats.turns,
            duration: stats.duration,
            winner: winnerInfo ? {
                player: winnerInfo.player,
                symbol: winnerInfo.symbol
            } : null,
            isDraw: stats.isDraw,
            moves: this.movesHistory.length,
            lastMove: this.lastMove
        };
    }
}

module.exports = TicTacToe;
