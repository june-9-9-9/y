class TicTacToe {
    constructor(playerX, playerO = null, options = {}) {
        this.playerX = playerX;
        this.playerO = playerO;
        this.currentTurn = playerX; // X always starts
        this.board = Array(9).fill(null);
        this.turns = 0;
        this.winner = null;
        this.startTime = Date.now();
        this.options = Object.assign({
            useEmojiNumbers: true,
            highlightWinner: true
        }, options);
        this.winningLine = null;
    }

    // Render board with emoji numbers or plain numbers
    render() {
        const emojiNumbers = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣'];
        return this.board.map((cell, idx) => {
            if (cell === 'X') return '❎';
            if (cell === 'O') return '⭕';
            return this.options.useEmojiNumbers ? emojiNumbers[idx] : (idx + 1).toString();
        });
    }

    // Render board with coordinates in a grid
    renderWithCoordinates() {
        const cells = this.render();
        return `
${cells[0]} | ${cells[1]} | ${cells[2]}
${cells[3]} | ${cells[4]} | ${cells[5]}
${cells[6]} | ${cells[7]} | ${cells[8]}
`;
    }

    // Available moves
    getAvailableMoves() {
        return this.board
            .map((cell, idx) => cell ? null : (idx + 1))
            .filter(Boolean);
    }

    // Make a move
    turn(isO, position) {
        if (this.winner) return false;
        if (position < 0 || position > 8) return false;
        if (this.board[position]) return false;

        const symbol = isO ? 'O' : 'X';
        this.board[position] = symbol;
        this.turns++;

        // Check winner
        this.checkWinner();

        // Switch turn if no winner yet
        if (!this.winner) {
            this.currentTurn = (this.currentTurn === this.playerX) ? this.playerO : this.playerX;
        }

        return true;
    }

    // Winner detection
    checkWinner() {
        const wins = [
            [0,1,2],[3,4,5],[6,7,8], // rows
            [0,3,6],[1,4,7],[2,5,8], // cols
            [0,4,8],[2,4,6]          // diagonals
        ];
        for (const [a,b,c] of wins) {
            if (this.board[a] && this.board[a] === this.board[b] && this.board[a] === this.board[c]) {
                this.winner = (this.board[a] === 'X') ? this.playerX : this.playerO;
                this.winningLine = [a,b,c];
                return;
            }
        }
    }

    // Stats helper
    getStats() {
        return {
            turns: this.turns,
            duration: ((Date.now() - this.startTime) / 1000).toFixed(1) + 's',
            winner: this.winner
        };
    }
}

module.exports = TicTacToe;
