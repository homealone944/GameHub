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

  checkGameOver: (state, lastSlotIndex) => {
    const symbol = lastSlotIndex === 0 ? 'X' : 'O';
    
    for (const combo of WINNING_COMBINATIONS) {
      if (combo.every(idx => state.board[idx] === symbol)) {
        return { winner: lastSlotIndex, winningLine: combo };
      }
    }

    if (!state.board.includes(null)) {
      return { winner: 'draw', winningLine: [] };
    }

    return null;
  },
  hasSettings: false
};
