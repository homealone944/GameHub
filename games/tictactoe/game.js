// DOM Elements
const btnRematch = document.getElementById('btn-rematch');
const turnIndicator = document.getElementById('turn-indicator');
const cells = document.querySelectorAll('.cell');

const btnRules = document.getElementById('btn-rules');
const rulesModal = document.getElementById('rules-modal');
const btnCloseRules = document.getElementById('btn-close-rules');
const btnRulesOk = document.getElementById('btn-rules-ok');

const sheet = document.getElementById('control-sheet');
const footerTrigger = document.getElementById('footer-trigger');
const overlay = document.getElementById('sheet-overlay');
const sheetHeader = document.getElementById('sheet-header-close');

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
  btnRematch.addEventListener('click', () => {
    rematch();
    toggleSheet(); // Close sheet after rematch
  });
  
  cells.forEach(cell => {
    cell.addEventListener('click', (e) => handleCellClick(parseInt(e.target.dataset.index)));
  });
  
  // Sheet Toggle Logic
  function toggleSheet() {
    if (sheet.classList.contains('static')) return; // Ignore toggles in static mode
    const isActive = sheet.classList.toggle('active');
    overlay.classList.toggle('hidden', !isActive);
  }

  footerTrigger.addEventListener('click', toggleSheet);
  overlay.addEventListener('click', toggleSheet);
  sheetHeader.addEventListener('click', toggleSheet);

  if(btnRules && rulesModal) {
    btnRules.addEventListener('click', () => {
      rulesModal.classList.remove('hidden');
      toggleSheet(); // Close sheet when opening modal
    });
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
    if (window.Notify) Notify.toast(`${gameState.winner} has won the game!`);
  } else if (gameState.isDraw) {
    turnIndicator.innerText = "It's a Draw! 🤝";
  } else {
    const nextSym = gameState.xIsNext ? 'X' : 'O';
    turnIndicator.innerText = `${nextSym}'s Turn`;
  }
}

init();
