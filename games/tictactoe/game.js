// DOM Elements
const btnRematch = document.getElementById('btn-rematch');
const turnIndicator = document.getElementById('turn-indicator');
const cells = document.querySelectorAll('.cell');

const btnRules = document.getElementById('btn-rules');
const rulesModal = document.getElementById('rules-modal');
const btnCloseRules = document.getElementById('btn-close-rules');
const btnRulesOk = document.getElementById('btn-rules-ok');

// Game State
let gameState = {
  board: Array(9).fill(null), // null, 'X', or 'O'
  xIsNext: true,
  winner: null,
  winningLine: null,
  isDraw: false
};

const WINNING_COMBINATIONS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
  [0, 4, 8], [2, 4, 6]             // Diagonals
];

// --- initialization ---
function init() {
  btnRematch.addEventListener('click', rematch);
  cells.forEach(cell => {
    cell.addEventListener('click', (e) => handleCellClick(parseInt(e.target.dataset.index)));
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
  gameState = { board: Array(9).fill(null), xIsNext: true, winner: null, winningLine: null, isDraw: false };
  renderBoard();
}

function checkWinner(board) {
  for (let i = 0; i < WINNING_COMBINATIONS.length; i++) {
    const [a, b, c] = WINNING_COMBINATIONS[i];
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line: [a, b, c] };
    }
  }
  if (!board.includes(null)) return { winner: 'Draw', line: [] };
  return null;
}

function handleCellClick(index) {
  if (gameState.winner || gameState.isDraw || gameState.board[index]) return;
  
  const currentTurnSymbol = gameState.xIsNext ? 'X' : 'O';

  gameState.board[index] = currentTurnSymbol;
  
  const winResult = checkWinner(gameState.board);
  if (winResult) {
    if (winResult.winner === 'Draw') gameState.isDraw = true;
    else { gameState.winner = winResult.winner; gameState.winningLine = winResult.line; }
  } else {
    gameState.xIsNext = !gameState.xIsNext;
  }

  renderBoard();
}

// --- Rendering ---
function renderBoard() {
  for (let i = 0; i < 9; i++) {
    const cell = cells[i];
    const val = gameState.board[i];
    cell.innerText = val ? val : '';
    cell.className = 'cell';    
    if (val) cell.classList.add('occupied', val === 'X' ? 'x-mark' : 'o-mark');
    if (gameState.winningLine && gameState.winningLine.includes(i)) cell.classList.add('win-cell');
  }

  if (gameState.winner) {
    turnIndicator.innerText = `${gameState.winner} Wins! 🎉`;
    btnRematch.classList.remove('hidden');
  } else if (gameState.isDraw) {
    turnIndicator.innerText = "It's a Draw! 🤝";
    btnRematch.classList.remove('hidden');
  } else {
    const nextSym = gameState.xIsNext ? 'X' : 'O';
    turnIndicator.innerText = `${nextSym}'s Turn`;
    btnRematch.classList.add('hidden');
  }
}

init();
