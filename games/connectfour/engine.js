/* games/connectfour/engine.js */
export const ROWS = 6;
export const COLS = 7;

export const ConnectFourEngine = {
  getInitialState: () => ({
    board: Array(ROWS * COLS).fill(null),
    activeSlotIndex: 0,
    status: 'playing',
    winner: null,
    winningLine: null 
  }),

  applyMove: (state, colIndex, activeSlotIndex) => {
    const symbol = activeSlotIndex === 0 ? 'R' : 'Y';
    const board = [...state.board];

    // Gravity logic: find lowest empty row
    let targetRow = -1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r * COLS + colIndex] === null) {
        targetRow = r;
        break;
      }
    }

    if (targetRow === -1) return null; // Column is full

    board[targetRow * COLS + colIndex] = symbol;
    return { 
      ...state, 
      board,
      activeSlotIndex: activeSlotIndex === 0 ? 1 : 0
    };
  },

  checkGameOver: (state, activeSlotIndex, mySlotIndex, isOnline) => {
    const board = state.board;
    const colorName = activeSlotIndex === 0 ? 'RED' : 'YELLOW';

    const getCell = (r, c) => board[r * COLS + c];

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        let p = getCell(r, c);
        if (!p) continue;

        const checkWin = (line) => {
          let title = "VICTORY";
          let subtitle = "Vertical domination at its finest. 🔴🟡";

          if (!isOnline) {
             title = "GAME OVER";
             subtitle = `${colorName} WON!`;
          } else if (mySlotIndex !== null) {
             if (mySlotIndex === activeSlotIndex) {
                 title = "VICTORY";
                 subtitle = "YOU WON";
             } else {
                 const winnerName = state.slots ? state.slots[activeSlotIndex].name : colorName;
                 title = "DEFEAT";
                 subtitle = `${winnerName} WON!`;
             }
          }

          return { 
            winner: activeSlotIndex, 
            winningLine: line,
            title,
            subtitle
          };
        };

        // Horizontal
        if (c + 3 < COLS && p === getCell(r, c + 1) && p === getCell(r, c + 2) && p === getCell(r, c + 3)) {
          return checkWin([r * COLS + c, r * COLS + (c + 1), r * COLS + (c + 2), r * COLS + (c + 3)]);
        }
        // Vertical
        if (r + 3 < ROWS && p === getCell(r + 1, c) && p === getCell(r + 2, c) && p === getCell(r + 3, c)) {
          return checkWin([r * COLS + c, (r + 1) * COLS + c, (r + 2) * COLS + c, (r + 3) * COLS + c]);
        }
        // Diagonal Down-Right
        if (r + 3 < ROWS && c + 3 < COLS && p === getCell(r + 1, c + 1) && p === getCell(r + 2, c + 2) && p === getCell(r + 3, c + 3)) {
          return checkWin([r * COLS + c, (r + 1) * COLS + (c + 1), (r + 2) * COLS + (c + 2), (r + 3) * COLS + (c + 3)]);
        }
        // Diagonal Down-Left
        if (r + 3 < ROWS && c - 3 >= 0 && p === getCell(r + 1, c - 1) && p === getCell(r + 2, c - 2) && p === getCell(r + 3, c - 3)) {
          return checkWin([r * COLS + c, (r + 1) * COLS + (c - 1), (r + 2) * COLS + (c - 2), (r + 3) * COLS + (c - 3)]);
        }
      }
    }

    if (!board.includes(null)) return { 
      winner: 'draw', 
      winningLine: [],
      subtitle: "The board is full! No more room to drop. 🤝"
    };
    return null;
  },
  hasSettings: false,
  getRulesHTML: () => `
    <ul style="padding-left: 1rem; margin-top: 0.5rem;">
      <li>Players alternate turns dropping their colored discs (Red or Yellow) into one of the 7 columns.</li>
      <li>The disc will fall to the lowest available space within the column.</li>
      <li>The first player to form a horizontal, vertical, or diagonal line of four of their own discs wins!</li>
      <li>If the board fills up before either player achieves 4-in-a-row, the game is a Draw.</li>
    </ul>
  `
};
