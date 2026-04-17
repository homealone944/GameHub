const btnRematch = document.getElementById('btn-rematch');
const turnIndicator = document.getElementById('turn-indicator');
const clickColumns = document.querySelectorAll('.click-col');
const boardEl = document.getElementById('board');

const btnRules = document.getElementById('btn-rules');
const rulesModal = document.getElementById('rules-modal');
const btnCloseRules = document.getElementById('btn-close-rules');
const btnRulesOk = document.getElementById('btn-rules-ok');

const ROWS = 6;
const COLS = 7;

let gameState = {
  board: Array(ROWS).fill(null).map(() => Array(COLS).fill(null)), // null, 'R', 'Y'
  redIsNext: true,
  winner: null,
  winningCells: [],
  isDraw: false
};

let cellElements = [];

function init() {
  btnRematch.addEventListener('click', rematch);

  // Generate DOM cells
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement('div');
      cell.classList.add('c4-cell');
      boardEl.appendChild(cell);
      cellElements.push(cell);
    }
  }

  clickColumns.forEach(cc => {
    cc.addEventListener('click', (e) => handleColClick(parseInt(e.target.dataset.col)));
  });

  if(btnRules && rulesModal) {
    btnRules.addEventListener('click', () => rulesModal.classList.remove('hidden'));
    btnCloseRules.addEventListener('click', () => rulesModal.classList.add('hidden'));
    btnRulesOk.addEventListener('click', () => rulesModal.classList.add('hidden'));
  }

  resetGameState();
}

function rematch() {
  resetGameState();
}

// --- Game Logic ---
function resetGameState() {
  gameState = {
    board: Array(ROWS).fill(null).map(() => Array(COLS).fill(null)),
    redIsNext: true,
    winner: null,
    winningCells: [],
    isDraw: false
  };
  renderBoard();
}

function checkWinCondition(board) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      let p = board[r][c];
      if (!p) continue;

      if (c + 3 < COLS && p === board[r][c+1] && p === board[r][c+2] && p === board[r][c+3]) {
        return { winner: p, cells: [[r,c], [r,c+1], [r,c+2], [r,c+3]] };
      }
      if (r + 3 < ROWS && p === board[r+1][c] && p === board[r+2][c] && p === board[r+3][c]) {
        return { winner: p, cells: [[r,c], [r+1,c], [r+2,c], [r+3,c]] };
      }
      if (r + 3 < ROWS && c + 3 < COLS && p === board[r+1][c+1] && p === board[r+2][c+2] && p === board[r+3][c+3]) {
        return { winner: p, cells: [[r,c], [r+1,c+1], [r+2,c+2], [r+3,c+3]] };
      }
      if (r + 3 < ROWS && c - 3 >= 0 && p === board[r+1][c-1] && p === board[r+2][c-2] && p === board[r+3][c-3]) {
        return { winner: p, cells: [[r,c], [r+1,c-1], [r+2,c-2], [r+3,c-3]] };
      }
    }
  }
  
  const isFull = board[0].every(val => val !== null);
  if (isFull) return { winner: 'Draw', cells: [] };
  
  return null;
}

function handleColClick(colIndex) {
  if (gameState.winner || gameState.isDraw) return;
  const currentTurnSymbol = gameState.redIsNext ? 'R' : 'Y';
  
  let targetRow = -1;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (gameState.board[r][colIndex] === null) {
      targetRow = r;
      break;
    }
  }
  
  if (targetRow === -1) return;

  gameState.board[targetRow][colIndex] = currentTurnSymbol;
  
  const winResult = checkWinCondition(gameState.board);
  if (winResult) {
    if (winResult.winner === 'Draw') gameState.isDraw = true;
    else { gameState.winner = winResult.winner; gameState.winningCells = winResult.cells; }
  } else {
    gameState.redIsNext = !gameState.redIsNext;
  }

  renderBoard();
}

// --- Rendering ---
function renderBoard() {
  let index = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = cellElements[index];
      const val = gameState.board[r][c];
      
      cell.className = 'c4-cell';
      if (val === 'R') cell.classList.add('red-disc');
      if (val === 'Y') cell.classList.add('yellow-disc');
      
      const isWinCell = gameState.winningCells.some(wc => wc[0] === r && wc[1] === c);
      if (isWinCell) cell.classList.add('win-cell');
      
      index++;
    }
  }

  if (gameState.winner) {
    const winName = gameState.winner === 'R' ? 'Red' : 'Yellow';
    turnIndicator.innerText = `${winName} Wins! 🎉`;
    btnRematch.classList.remove('hidden');
  } else if (gameState.isDraw) {
    turnIndicator.innerText = "It's a Draw! 🤝";
    btnRematch.classList.remove('hidden');
  } else {
    const nextSym = gameState.redIsNext ? 'R' : 'Y';
    const nextName = gameState.redIsNext ? 'Red' : 'Yellow';
    turnIndicator.innerText = `${nextName}'s Turn`;
    btnRematch.classList.add('hidden');
  }
}

init();
