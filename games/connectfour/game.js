/* games/connectfour/game.js */
import { subscribeToLobby, updateGameState } from '../../js/database-manager.js';

// DOM Elements
const btnRematch = document.getElementById('btn-rematch');
const turnIndicator = document.getElementById('turn-indicator');
const selfRoleBadge = document.getElementById('self-role-badge');
const boardEl = document.getElementById('board');
const clickColumns = document.querySelectorAll('.click-col');
const hostSeatingSection = document.getElementById('host-seating-section');
const selectPlayerRed = document.getElementById('select-player-red');
const selectPlayerYellow = document.getElementById('select-player-yellow');

const btnRules = document.getElementById('btn-rules');
const rulesModal = document.getElementById('rules-modal');
const btnCloseRules = document.getElementById('btn-close-rules');
const btnRulesOk = document.getElementById('btn-rules-ok');

const sheet = document.getElementById('control-sheet');
const overlay = document.getElementById('sheet-overlay');

const ROWS = 6;
const COLS = 7;

// Game State (Local fallback / initial)
let gameState = {
  board: Array(ROWS * COLS).fill(null), // Flattened 1D board
  redIsNext: true,
  winner: null,
  winningCells: [],
  isDraw: false,
  playerRed: { id: null, name: 'Waiting...' },
  playerYellow: { id: null, name: 'Waiting...' }
};

let cellElements = [];
let isOnline = false;
let lobbyId = null;

// --- Initialization ---
function init() {
  const urlParams = new URLSearchParams(window.location.search);
  isOnline = urlParams.get('mode') === 'online';
  lobbyId = urlParams.get('lobby');

  btnRematch.addEventListener('click', () => {
    if (isOnline) {
      if (isHost()) {
        resetGameState(true);
      } else {
        if (window.Notify) Notify.toast("Only the Host can request a rematch.");
      }
    } else {
      resetGameState();
    }
  });

  // Generate DOM cells for the 6x7 board
  boardEl.innerHTML = '';
  cellElements = [];
  for (let i = 0; i < ROWS * COLS; i++) {
    const cell = document.createElement('div');
    cell.classList.add('c4-cell');
    boardEl.appendChild(cell);
    cellElements.push(cell);
  }

  clickColumns.forEach(cc => {
    cc.addEventListener('click', (e) => {
      const col = parseInt(e.target.dataset.col);
      handleColClick(col);
    });
  });

  if(btnRules && rulesModal) {
    btnRules.addEventListener('click', () => rulesModal.classList.remove('hidden'));
    btnCloseRules.addEventListener('click', () => rulesModal.classList.add('hidden'));
    btnRulesOk.addEventListener('click', () => rulesModal.classList.add('hidden'));
  }

  if (isOnline && lobbyId) {
    initOnlineMode();
  } else {
    resetGameState();
  }
}

function initOnlineMode() {
  subscribeToLobby(lobbyId, (data) => {
    if (!data) return;

    // Host initializes state if missing
    if (!data.gameState || !data.gameState.board) {
      if (data.hostId === window.CLIENT_ID) {
        console.log("[ConnectFour] Initializing Online State");

        // Auto-fill first two players
        const p1 = data.players[0] || { id: null, name: 'Waiting...' };
        const p2 = data.players[1] || { id: null, name: 'Waiting...' };

        const initialState = {
          board: Array(ROWS * COLS).fill(null),
          redIsNext: true,
          winner: null,
          winningCells: [],
          isDraw: false,
          playerRed: { id: p1.id, name: p1.name },
          playerYellow: { id: p2.id, name: p2.name }
        };
        updateGameState(lobbyId, initialState);
      }
      return;
    }

    gameState = data.gameState;
    renderBoard();

    // Host Management UI
    if (data.hostId === window.CLIENT_ID) {
       renderHostSeating(data.players);
       btnRematch.classList.remove('hidden-host-only');
    } else {
       btnRematch.classList.add('hidden-host-only');
       hostSeatingSection.classList.add('hidden');
    }
  });

  // Change listeners for Host dropdowns
  selectPlayerRed.addEventListener('change', (e) => {
    const pid = e.target.value;
    const player = window.currentLobbyData.players.find(p => p.id === pid);
    if (player) assignSeat('Red', pid, player.name);
  });
  selectPlayerYellow.addEventListener('change', (e) => {
    const pid = e.target.value;
    const player = window.currentLobbyData.players.find(p => p.id === pid);
    if (player) assignSeat('Yellow', pid, player.name);
  });
}

function isHost() {
  return window.currentLobbyData && window.currentLobbyData.hostId === window.CLIENT_ID;
}

function renderHostSeating(players) {
  hostSeatingSection.classList.remove('hidden');

  const buildOptions = (currentId) => {
    let html = `<option value="" ${!currentId ? 'selected' : ''} disabled>Select Player...</option>`;
    players.forEach(p => {
       html += `<option value="${p.id}" ${p.id === currentId ? 'selected' : ''}>${p.name}${p.id === window.CLIENT_ID ? ' (You)' : ''}</option>`;
    });
    return html;
  };

  if (selectPlayerRed.options.length !== (players.length + 1)) {
    selectPlayerRed.innerHTML = buildOptions(gameState.playerRed.id);
    selectPlayerYellow.innerHTML = buildOptions(gameState.playerYellow.id);
  } else {
    selectPlayerRed.value = gameState.playerRed.id || "";
    selectPlayerYellow.value = gameState.playerYellow.id || "";
  }
}

async function assignSeat(role, pid, pname) {
  const newState = { ...gameState };
  if (role === 'Red') {
    if (newState.playerRed.id === pid) return;
    newState.playerRed = { id: pid, name: pname };
  } else {
    if (newState.playerYellow.id === pid) return;
    newState.playerYellow = { id: pid, name: pname };
  }

  // Mandatory board reset on player change
  newState.board = Array(ROWS * COLS).fill(null);
  newState.redIsNext = true;
  newState.winner = null;
  newState.winningCells = [];
  newState.isDraw = false;

  await updateGameState(lobbyId, newState);
  if (window.Notify) Notify.toast(`Assigned ${pname} to ${role}`);
}

// --- Game Logic ---
function resetGameState(sync = false) {
  const emptyState = {
    board: Array(ROWS * COLS).fill(null),
    redIsNext: true,
    winner: null,
    winningCells: [],
    isDraw: false,
    playerRed: gameState.playerRed,
    playerYellow: gameState.playerYellow
  };

  if (sync && isOnline) {
    updateGameState(lobbyId, emptyState);
  } else {
    gameState = emptyState;
    renderBoard();
  }
}

function checkWinCondition(board) {
  // Logic converts 1D to 2D concept
  const getCell = (r, c) => board[r * COLS + c];

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      let p = getCell(r, c);
      if (!p) continue;

      // Horizontal
      if (c + 3 < COLS && p === getCell(r, c + 1) && p === getCell(r, c + 2) && p === getCell(r, c + 3)) {
        return { winner: p, cells: [r * COLS + c, r * COLS + (c + 1), r * COLS + (c + 2), r * COLS + (c + 3)] };
      }
      // Vertical
      if (r + 3 < ROWS && p === getCell(r + 1, c) && p === getCell(r + 2, c) && p === getCell(r + 3, c)) {
        return { winner: p, cells: [r * COLS + c, (r + 1) * COLS + c, (r + 2) * COLS + c, (r + 3) * COLS + c] };
      }
      // Diagonal Down-Right
      if (r + 3 < ROWS && c + 3 < COLS && p === getCell(r + 1, c + 1) && p === getCell(r + 2, c + 2) && p === getCell(r + 3, c + 3)) {
        return { winner: p, cells: [r * COLS + c, (r + 1) * COLS + (c + 1), (r + 2) * COLS + (c + 2), (r + 3) * COLS + (c + 3)] };
      }
      // Diagonal Down-Left
      if (r + 3 < ROWS && c - 3 >= 0 && p === getCell(r + 1, c - 1) && p === getCell(r + 2, c - 2) && p === getCell(r + 3, c - 3)) {
        return { winner: p, cells: [r * COLS + c, (r + 1) * COLS + (c - 1), (r + 2) * COLS + (c - 2), (r + 3) * COLS + (c - 3)] };
      }
    }
  }

  if (!board.includes(null)) return { winner: 'Draw', cells: [] };
  return null;
}

function handleColClick(colIndex) {
  if (gameState.winner || gameState.isDraw) return;
  const currentTurnSymbol = gameState.redIsNext ? 'R' : 'Y';

  // Online Permission Check
  if (isOnline) {
    const currentPlayerId = gameState.redIsNext ? gameState.playerRed.id : gameState.playerYellow.id;
    if (window.CLIENT_ID !== currentPlayerId) {
      if (window.Notify) Notify.toast(`It's not your turn! Waiting for ${gameState.redIsNext ? 'Red' : 'Yellow'}.`);
      return;
    }
  }

  // Gravity logic
  let targetRow = -1;
  const getCell = (r, c) => gameState.board[r * COLS + c];

  for (let r = ROWS - 1; r >= 0; r--) {
    if (getCell(r, colIndex) === null) {
      targetRow = r;
      break;
    }
  }

  if (targetRow === -1) return;

  const newState = { ...gameState };
  newState.board[targetRow * COLS + colIndex] = currentTurnSymbol;

  const winResult = checkWinCondition(newState.board);
  if (winResult) {
    if (winResult.winner === 'Draw') newState.isDraw = true;
    else { newState.winner = winResult.winner; newState.winningCells = winResult.cells; }
  } else {
    newState.redIsNext = !newState.redIsNext;
  }

  if (isOnline) {
    updateGameState(lobbyId, newState);
  } else {
    gameState = newState;
    renderBoard();
  }
}

// --- Rendering ---
function renderBoard() {
  for (let i = 0; i < ROWS * COLS; i++) {
    const cell = cellElements[i];
    const val = gameState.board[i];

    cell.className = 'c4-cell';
    if (val === 'R') cell.classList.add('red-disc');
    if (val === 'Y') cell.classList.add('yellow-disc');

    if (gameState.winningCells && gameState.winningCells.includes(i)) {
      cell.classList.add('win-cell');
    }
  }

  // Role Badge
  if (isOnline) {
    if (window.CLIENT_ID === gameState.playerRed.id) {
       selfRoleBadge.innerText = "PLAYING AS RED";
       selfRoleBadge.className = "role-badge playing-red";
    } else if (window.CLIENT_ID === gameState.playerYellow.id) {
       selfRoleBadge.innerText = "PLAYING AS YELLOW";
       selfRoleBadge.className = "role-badge playing-yellow";
    } else {
       selfRoleBadge.innerText = "SPECTATING";
       selfRoleBadge.className = "role-badge spectating";
    }
  } else {
    selfRoleBadge.innerText = "LOCAL MODE";
    selfRoleBadge.className = "role-badge spectating";
  }

  if (gameState.winner) {
    const winName = gameState.winner === 'R' ? gameState.playerRed.name : gameState.playerYellow.name;
    turnIndicator.innerText = isOnline ? `${winName} Wins! 🎉` : `${gameState.winner === 'R' ? 'Red' : 'Yellow'} Wins! 🎉`;
    if (window.Notify) Notify.toast(`${isOnline ? winName : (gameState.winner === 'R' ? 'Red' : 'Yellow')} has won the game!`);
  } else if (gameState.isDraw) {
    turnIndicator.innerText = "It's a Draw! 🤝";
  } else {
    const nextSym = gameState.redIsNext ? 'Red' : 'Yellow';
    const nextName = gameState.redIsNext ? gameState.playerRed.name : gameState.playerYellow.name;
    
    if (isOnline) {
      if (nextName === 'Waiting...') {
        turnIndicator.innerText = "Assign Players to Start";
      } else {
        turnIndicator.innerText = `${nextName}'s Turn (${nextSym})`;
      }
    } else {
      turnIndicator.innerText = `${nextSym}'s Turn`;
    }
  }
}

// --- Input Handling ---
function setupKeyboardListeners() {
  document.addEventListener('keydown', (e) => {
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
    const key = e.key;
    if (key >= '1' && key <= '7') {
      const colIndex = parseInt(key) - 1;
      handleColClick(colIndex);
    }
  });
}

init();
setupKeyboardListeners();
