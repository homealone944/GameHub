// DOM Elements
const boardEl = document.getElementById('board');
const turnIndicator = document.getElementById('turn-indicator');
const scoreP1El = document.getElementById('score-p1');
const scoreP2El = document.getElementById('score-p2');
const btnRematch = document.getElementById('btn-rematch');
const btnNavRematch = document.getElementById('btn-rematch-nav');

// Modals
const btnRules = document.getElementById('btn-rules');
const rulesModal = document.getElementById('rules-modal');
const btnCloseRules = document.getElementById('btn-close-rules');
const btnRulesOk = document.getElementById('btn-rules-ok');

const btnSettings = document.getElementById('btn-settings');
const settingsModal = document.getElementById('settings-modal');
const btnCloseSettings = document.getElementById('btn-close-settings');
const btnSaveSettings = document.getElementById('btn-save-settings');
const inputCols = document.getElementById('input-cols');
const inputRows = document.getElementById('input-rows');

// Game Configuration
let config = {
  cols: 5,
  rows: 5
};

// Game State
let gameState = {
  activePlayer: 1, // 1 or 2
  score: { 1: 0, 2: 0 },
  gameOver: false,
  hLines: [], // Array of row arrays
  vLines: [], // Array of row arrays
  boxes: [],  // Array of row arrays
};

// --- Initialization ---
function init() {
  loadSettings();
  setupListeners();
  startNewGame();
}

function loadSettings() {
  const c = localStorage.getItem('dab_cols');
  const r = localStorage.getItem('dab_rows');
  if (c) config.cols = parseInt(c) || 5;
  if (r) config.rows = parseInt(r) || 5;
  
  inputCols.value = config.cols;
  inputRows.value = config.rows;
}

function saveSettings() {
  let c = parseInt(inputCols.value);
  let r = parseInt(inputRows.value);
  if (isNaN(c) || c < 3) c = 3;
  if (isNaN(r) || r < 3) r = 3;
  if (c > 15) c = 15;
  if (r > 15) r = 15;
  
  config.cols = c;
  config.rows = r;
  localStorage.setItem('dab_cols', c);
  localStorage.setItem('dab_rows', r);
  
  settingsModal.classList.add('hidden');
  startNewGame();
}

function setupListeners() {
  // Settings
  btnSettings.addEventListener('click', () => settingsModal.classList.remove('hidden'));
  btnCloseSettings.addEventListener('click', () => settingsModal.classList.add('hidden'));
  btnSaveSettings.addEventListener('click', saveSettings);

  // Rules
  if(btnRules && rulesModal) {
    btnRules.addEventListener('click', () => rulesModal.classList.remove('hidden'));
    btnCloseRules.addEventListener('click', () => rulesModal.classList.add('hidden'));
    btnRulesOk.addEventListener('click', () => rulesModal.classList.add('hidden'));
  }

  // Core
  btnRematch.addEventListener('click', startNewGame);
  btnNavRematch.addEventListener('click', startNewGame);
}

// --- Game Logic ---
function startNewGame() {
  // If the screen aspect ratio aggressively doesn't match the grid aspect ratio, gracefully flip the board orientation!
  const isPortrait = window.innerWidth < window.innerHeight;
  if (isPortrait && config.cols > config.rows) {
     let t = config.cols; config.cols = config.rows; config.rows = t;
  } else if (!isPortrait && config.rows > config.cols) {
     let t = config.cols; config.cols = config.rows; config.rows = t;
  }

  gameState = {
    activePlayer: 1,
    score: { 1: 0, 2: 0 },
    gameOver: false,
    hLines: Array(config.rows).fill(null).map(() => Array(config.cols - 1).fill(0)),
    vLines: Array(config.rows - 1).fill(null).map(() => Array(config.cols).fill(0)),
    boxes:  Array(config.rows - 1).fill(null).map(() => Array(config.cols - 1).fill(0))
  };
  
  btnRematch.classList.add('hidden');
  btnNavRematch.classList.add('hidden');
  
  renderBoard();
  updateStatus();
}

function handleLineClick(type, r, c) {
  if (gameState.gameOver) return;
  
  // Check if already claimed
  if (type === 'h' && gameState.hLines[r][c] !== 0) return;
  if (type === 'v' && gameState.vLines[r][c] !== 0) return;

  // Claim the line
  if (type === 'h') gameState.hLines[r][c] = gameState.activePlayer;
  if (type === 'v') gameState.vLines[r][c] = gameState.activePlayer;
  
  // Check for newly completed boxes
  let boxesCaptured = 0;
  
  if (type === 'h') {
    // Check box above
    if (r > 0 && checkBox(r - 1, c)) boxesCaptured++;
    // Check box below
    if (r < config.rows - 1 && checkBox(r, c)) boxesCaptured++;
  } else {
    // Check box to the left
    if (c > 0 && checkBox(r, c - 1)) boxesCaptured++;
    // Check box to the right
    if (c < config.cols - 1 && checkBox(r, c)) boxesCaptured++;
  }
  
  // If player captures 0 boxes, their turn ends.
  if (boxesCaptured === 0) {
    gameState.activePlayer = gameState.activePlayer === 1 ? 2 : 1;
  } else {
    gameState.score[gameState.activePlayer] += boxesCaptured;
    if(window.Notify) Notify.toast(`Player ${gameState.activePlayer} scored! Extra turn.`, 2000);
  }
  
  checkGameOver();
  renderBoard();
  updateStatus();
}

function checkBox(r, c) {
  // A box at (r, c) uses: hLines[r][c], hLines[r+1][c], vLines[r][c], vLines[r][c+1]
  if (gameState.boxes[r][c] !== 0) return false; // Already captured
  
  const top = gameState.hLines[r][c];
  const bottom = gameState.hLines[r+1][c];
  const left = gameState.vLines[r][c];
  const right = gameState.vLines[r][c+1];
  
  if (top !== 0 && bottom !== 0 && left !== 0 && right !== 0) {
    gameState.boxes[r][c] = gameState.activePlayer; // captured
    return true;
  }
  return false;
}

function checkGameOver() {
  let isFull = true;
  for (let r = 0; r < config.rows - 1; r++) {
    for (let c = 0; c < config.cols - 1; c++) {
      if (gameState.boxes[r][c] === 0) {
        isFull = false;
        break;
      }
    }
  }
  
  if (isFull) {
    gameState.gameOver = true;
    
    let tie = gameState.score[1] === gameState.score[2];
    let title = tie ? "It's a Draw!" : `Player ${gameState.score[1] > gameState.score[2] ? 1 : 2} Wins!`;
    
    if(window.Notify) {
      Notify.popup({
        title: title, 
        message: `Final Score\nP1: ${gameState.score[1]} - P2: ${gameState.score[2]}`, 
        showCloseButton: true 
      });
    }
    
    btnRematch.classList.remove('hidden');
    btnNavRematch.classList.remove('hidden');
  }
}

function updateStatus() {
  scoreP1El.innerText = gameState.score[1];
  scoreP2El.innerText = gameState.score[2];
  
  if (gameState.gameOver) {
    let tie = gameState.score[1] === gameState.score[2];
    turnIndicator.innerText = tie ? "DRAW!" : `PLAYER ${gameState.score[1] > gameState.score[2] ? 1 : 2} WINS`;
    turnIndicator.style.color = tie ? "#fff" : (gameState.score[1] > gameState.score[2] ? "#3b82f6" : "#ef4444");
  } else {
    turnIndicator.innerText = `PLAYER ${gameState.activePlayer} TURN`;
    turnIndicator.style.color = gameState.activePlayer === 1 ? "#3b82f6" : "#ef4444";
  }
}

// --- Graphical Rendering ---
function renderBoard() {
  boardEl.innerHTML = '';
  
  // Calculate dynamic dimensions to keep perfect squares
  const maxW = Math.min(window.innerWidth - 60, 600); // 600px max width, padding included
  const maxH = Math.min(window.innerHeight - 300, 600); // leave room for nav/status
  
  const boxesX = config.cols - 1;
  const boxesY = config.rows - 1;
  
  const boxW = maxW / boxesX;
  const boxH = maxH / boxesY;
  const boxSize = Math.min(boxW, boxH, 80); // max 80px per box
  
  const boardWidth = boxSize * boxesX;
  const boardHeight = boxSize * boxesY;
  
  boardEl.style.width = `${boardWidth}px`;
  boardEl.style.height = `${boardHeight}px`;

  // Provide resize listener to naturally redraw if the user resizes browser window
  if(!window._dabResizeBound) {
    window.addEventListener('resize', renderBoard);
    window._dabResizeBound = true;
  }
  
  const widthPercUnit = 100 / boxesX;
  const heightPercUnit = 100 / boxesY;
  
  // 1. Draw Boxes
  for (let r = 0; r < config.rows - 1; r++) {
    for (let c = 0; c < config.cols - 1; c++) {
      let boxState = gameState.boxes[r][c];
      const box = document.createElement('div');
      box.className = 'dab-box';
      
      box.style.left = `${c * widthPercUnit}%`;
      box.style.top = `${r * heightPercUnit}%`;
      box.style.width = `calc(${widthPercUnit}% + 1px)`; // slight overflow to prevent gaps
      box.style.height = `calc(${heightPercUnit}% + 1px)`;
      
      if (boxState !== 0) {
        box.classList.add('captured', `p${boxState}`);
      }
      boardEl.appendChild(box);
    }
  }
  
  // 2. Draw Horizontal Lines
  for (let r = 0; r < config.rows; r++) {
    for (let c = 0; c < config.cols - 1; c++) {
      let lineState = gameState.hLines[r][c];
      const line = document.createElement('div');
      line.className = 'dab-line horizontal';
      
      line.style.left = `${c * widthPercUnit}%`;
      line.style.top = `${r * heightPercUnit}%`;
      line.style.width = `${widthPercUnit}%`;
      
      if (lineState !== 0) {
        line.classList.add('claimed', `p${lineState}`);
      } else {
        line.addEventListener('click', () => handleLineClick('h', r, c));
      }
      boardEl.appendChild(line);
    }
  }

  // 3. Draw Vertical Lines
  for (let r = 0; r < config.rows - 1; r++) {
    for (let c = 0; c < config.cols; c++) {
      let lineState = gameState.vLines[r][c];
      const line = document.createElement('div');
      line.className = 'dab-line vertical';
      
      line.style.left = `${c * widthPercUnit}%`;
      line.style.top = `${r * heightPercUnit}%`;
      line.style.height = `${heightPercUnit}%`;
      
      if (lineState !== 0) {
        line.classList.add('claimed', `p${lineState}`);
      } else {
        line.addEventListener('click', () => handleLineClick('v', r, c));
      }
      boardEl.appendChild(line);
    }
  }

  // 4. Draw Dots (on top)
  for (let r = 0; r < config.rows; r++) {
    for (let c = 0; c < config.cols; c++) {
      const dot = document.createElement('div');
      dot.className = 'dab-dot';
      dot.style.left = `${c * widthPercUnit}%`;
      dot.style.top = `${r * heightPercUnit}%`;
      boardEl.appendChild(dot);
    }
  }
}

init();
