// lib/tictactoe.js
class TicTacToe {
    constructor(playerX, playerO, options = {}) {
        this.playerX = playerX;
        this.playerO = playerO;
        this.currentTurn = playerX;
        this.board = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
        this.originalBoard = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
        this.turns = 0;
        this.winner = null;
        this.winningLine = null;
        this.gameStarted = Date.now();
        this.useEmojiNumbers = options.useEmojiNumbers !== false; // Default true
        this.highlightWinner = options.highlightWinner !== false; // Default true
    }

    turn(isO, pos) {
        pos = parseInt(pos);
        if (pos < 0 || pos > 8 || 
            this.board[pos] === '❎' || this.board[pos] === '⭕' ||
            this.board[pos] === '❌' || this.board[pos] === '🔵' ||
            this.board[pos] === '⭐' || this.board[pos] === '✨') {
            return false;
        }
        
        const symbol = isO ? '⭕' : '❎';
        this.board[pos] = symbol;
        this.originalBoard[pos] = isO ? 'O' : 'X';
        this.turns++;
        this.currentTurn = isO ? this.playerX : this.playerO;
        
        this.checkWinner();
        return true;
    }

    checkWinner() {
        const lines = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
            [0, 4, 8], [2, 4, 6] // diagonals
        ];

        for (const [a, b, c] of lines) {
            const valA = this.originalBoard[a];
            const valB = this.originalBoard[b];
            const valC = this.originalBoard[c];
            
            if (valA !== '1' && valA !== '2' && valA !== '3' && 
                valA !== '4' && valA !== '5' && valA !== '6' && 
                valA !== '7' && valA !== '8' && valA !== '9' &&
                valA === valB && valB === valC) {
                this.winner = valA === 'X' ? this.playerX : this.playerO;
                this.winningLine = [a, b, c];
                this.highlightWinningLine();
                return;
            }
        }
    }

    highlightWinningLine() {
        if (!this.highlightWinner || !this.winningLine) return;
        
        const winEmoji = this.originalBoard[this.winningLine[0]] === 'X' ? '✨' : '⭐';
        
        this.winningLine.forEach(pos => {
            const current = this.board[pos];
            if (current === '❎') {
                this.board[pos] = '✨'; // Sparkle for X win
            } else if (current === '⭕') {
                this.board[pos] = '⭐'; // Star for O win
            }
        });
    }

    render() {
        if (!this.useEmojiNumbers) {
            return this.board.map((cell, index) => {
                if (cell === '❎' || cell === '⭕' || cell === '✨' || cell === '⭐') {
                    return cell;
                }
                return (index + 1).toString();
            });
        }
        return [...this.board];
    }

    renderAscii() {
        return `
 ${this.getCell(0)} │ ${this.getCell(1)} │ ${this.getCell(2)}
───┼───┼───
 ${this.getCell(3)} │ ${this.getCell(4)} │ ${this.getCell(5)}
───┼───┼───
 ${this.getCell(6)} │ ${this.getCell(7)} │ ${this.getCell(8)}
`;
    }

    getCell(pos) {
        const cell = this.board[pos];
        if (cell === '❎' || cell === '⭕' || cell === '✨' || cell === '⭐') {
            return cell;
        }
        return this.useEmojiNumbers ? cell : (pos + 1).toString();
    }

    // Advanced statistics
    getStats() {
        const duration = Date.now() - this.gameStarted;
        const minutes = Math.floor(duration / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);
        
        return {
            turns: this.turns,
            duration: `${minutes}m ${seconds}s`,
            boardState: this.render(),
            winner: this.winner,
            isDraw: this.turns === 9 && !this.winner,
            currentPlayer: this.currentTurn === this.playerX ? 'X (❎)' : 'O (⭕)',
            winningLine: this.winningLine
        };
    }

    // Get available moves
    getAvailableMoves() {
        const moves = [];
        this.originalBoard.forEach((cell, index) => {
            if (cell >= '1' && cell <= '9') {
                moves.push(index + 1);
            }
        });
        return moves;
    }

    // Reset game with same players
    reset() {
        this.board = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
        this.originalBoard = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
        this.turns = 0;
        this.winner = null;
        this.winningLine = null;
        this.currentTurn = this.playerX; // Alternate starting player?
        this.gameStarted = Date.now();
    }

    // Get board for display with coordinates
    renderWithCoordinates() {
        const rows = [];
        for (let i = 0; i < 3; i++) {
            const row = [];
            for (let j = 0; j < 3; j++) {
                const pos = i * 3 + j;
                row.push(this.board[pos]);
            }
            rows.push(row.join('│'));
        }
        return rows.join('\n──┼──┼──\n');
    }

    // Convert to simple array for compatibility
    toSimpleArray() {
        return this.board.map(cell => {
            if (cell === '❎' || cell === '✨') return 'X';
            if (cell === '⭕' || cell === '⭐') return 'O';
            if (cell === '1️⃣') return '1';
            if (cell === '2️⃣') return '2';
            if (cell === '3️⃣') return '3';
            if (cell === '4️⃣') return '4';
            if (cell === '5️⃣') return '5';
            if (cell === '6️⃣') return '6';
            if (cell === '7️⃣') return '7';
            if (cell === '8️⃣') return '8';
            if (cell === '9️⃣') return '9';
            return cell;
        });
    }
}

module.exports = TicTacToe;
