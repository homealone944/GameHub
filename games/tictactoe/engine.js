/* games/tictactoe/engine.js */

const WINNING_COMBINATIONS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
  [0, 4, 8], [2, 4, 6]             // Diagonals
];

export const TicTacToeEngine = {
  getInitialState: () => ({
    board: Array(9).fill(null),
    winningLine: null,
    winner: null,
    activeSlotIndex: 0
  }),

  applyMove: (state, action, slotIndex) => {
    // action is the cell index (0-8)
    const index = action;
    if (state.board[index]) return null; // Invalid: already occupied

    const newState = { ...state, board: [...state.board] };
    newState.board[index] = slotIndex === 0 ? 'X' : 'O';
    newState.activeSlotIndex = slotIndex === 0 ? 1 : 0;
    return newState;
  },

  checkGameOver: (state, lastSlotIndex, mySlotIndex, isOnline) => {
    const symbol = lastSlotIndex === 0 ? 'X' : 'O';
    
    for (const combo of WINNING_COMBINATIONS) {
      if (combo.every(idx => state.board[idx] === symbol)) {
        let title = "VICTORY";
        let subtitle = "A masterclass in strategy! 🏆";

        if (!isOnline) {
          title = "GAME OVER";
          subtitle = `${symbol} WON!`;
        } else if (mySlotIndex !== null) {
          if (mySlotIndex === lastSlotIndex) {
            title = "VICTORY";
            subtitle = "YOU WON";
          } else {
            const winnerName = state.slots ? state.slots[lastSlotIndex].name : symbol;
            title = "DEFEAT";
            subtitle = `${winnerName} WON!`;
          }
        }

        return { 
          winner: lastSlotIndex, 
          winningLine: combo,
          title,
          subtitle
        };
      }
    }

    if (!state.board.includes(null)) {
      return { 
        winner: 'draw', 
        winningLine: [],
        subtitle: "A perfectly balanced match! 🤝"
      };
    }

    return null;
  },
  hasSettings: false,
  getRulesHTML: () => `
    <ul style="padding-left: 1rem; margin-top: 0.5rem;">
      <li>Players alternate turns placing their marks (X or O) on a 3x3 grid.</li>
      <li>The first player to get 3 of their marks in a horizontal, vertical, or diagonal row wins!</li>
      <li>If all 9 squares are filled and no player has 3 in a row, the game is a draw.</li>
    </ul>
  `
};
