/* games/tictactoe/game.js */
import { subscribeToLobby, updateGameState } from '../../js/database-manager.js';

// DOM Elements
const btnRematch = document.getElementById('btn-rematch');
const turnIndicator = document.getElementById('turn-indicator');
const selfRoleBadge = document.getElementById('self-role-badge');
const cells = document.querySelectorAll('.cell');
const hostSeatingSection = document.getElementById('host-seating-section');
const selectPlayerX = document.getElementById('select-player-x');
const selectPlayerO = document.getElementById('select-player-o');

const btnRules = document.getElementById('btn-rules');
const rulesModal = document.getElementById('rules-modal');
const btnCloseRules = document.getElementById('btn-close-rules');
const btnRulesOk = document.getElementById('btn-rules-ok');

const sheet = document.getElementById('control-sheet');
const footerTrigger = document.getElementById('footer-trigger');
const overlay = document.getElementById('sheet-overlay');
const sheetHeader = document.getElementById('sheet-header-close');

// Game State (Local fallback / initial)
let gameState = {
  board: Array(9).fill(null),
  xIsNext: true,
  winner: null,
  winningLine: null,
  isDraw: false,
  playerX: { id: null, name: 'Waiting...' },
  playerO: { id: null, name: 'Waiting...' }
};

const WINNING_COMBINATIONS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
  [0, 4, 8], [2, 4, 6]             // Diagonals
];

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
    toggleSheet();
  });
  
  cells.forEach(cell => {
    cell.addEventListener('click', (e) => handleCellClick(parseInt(e.target.dataset.index)));
  });
  
  // Sheet Toggle Logic
  function toggleSheet() {
    if (sheet.classList.contains('static')) return;
    const isActive = sheet.classList.toggle('active');
    overlay.classList.toggle('hidden', !isActive);
  }

  footerTrigger.addEventListener('click', toggleSheet);
  overlay.addEventListener('click', toggleSheet);
  sheetHeader.addEventListener('click', toggleSheet);

  if(btnRules && rulesModal) {
    btnRules.addEventListener('click', () => {
      rulesModal.classList.remove('hidden');
      toggleSheet();
    });
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
    
    // If game state doesn't exist yet, Host initializes it
    if (!data.gameState || !data.gameState.board) {
      if (data.hostId === window.CLIENT_ID) {
        console.log("[TicTacToe] Initializing Online State as Host");
        
        // Auto-fill first two players
        const p1 = data.players[0] || { id: null, name: 'Waiting...' };
        const p2 = data.players[1] || { id: null, name: 'Waiting...' };

        const initialState = {
          board: Array(9).fill(null),
          xIsNext: true,
          winner: null,
          winningLine: null,
          isDraw: false,
          playerX: { id: p1.id, name: p1.name },
          playerO: { id: p2.id, name: p2.name }
        };
        updateGameState(lobbyId, initialState);
      }
      return;
    }

    // Sync local state to Firebase
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

  // Setup change listeners for dropdowns (once)
  selectPlayerX.addEventListener('change', (e) => {
    const pid = e.target.value;
    const player = window.currentLobbyData.players.find(p => p.id === pid);
    if (player) assignSeat('X', pid, player.name);
  });
  selectPlayerO.addEventListener('change', (e) => {
    const pid = e.target.value;
    const player = window.currentLobbyData.players.find(p => p.id === pid);
    if (player) assignSeat('O', pid, player.name);
  });
}

function isHost() {
  return window.currentLobbyData && window.currentLobbyData.hostId === window.CLIENT_ID;
}

function renderHostSeating(players) {
  hostSeatingSection.classList.remove('hidden');

  // Helper to build options
  const buildOptions = (currentId) => {
    let html = `<option value="" ${!currentId ? 'selected' : ''} disabled>Select Player...</option>`;
    players.forEach(p => {
       html += `<option value="${p.id}" ${p.id === currentId ? 'selected' : ''}>${p.name}${p.id === window.CLIENT_ID ? ' (You)' : ''}</option>`;
    });
    return html;
  };

  // Only update innerHTML if players list has changed (prevents focus loss)
  const currentTotal = players.length;
  if (selectPlayerX.options.length !== (currentTotal + 1)) {
     selectPlayerX.innerHTML = buildOptions(gameState.playerX.id);
     selectPlayerO.innerHTML = buildOptions(gameState.playerO.id);
  } else {
     // Just update selection
     selectPlayerX.value = gameState.playerX.id || "";
     selectPlayerO.value = gameState.playerO.id || "";
  }
}

async function assignSeat(role, pid, pname) {
  const newState = { ...gameState };
  
  if (role === 'X') {
    if (newState.playerX.id === pid) return; // already assigned
    newState.playerX = { id: pid, name: pname };
  } else {
    if (newState.playerO.id === pid) return; // already assigned
    newState.playerO = { id: pid, name: pname };
  }

  // Reset board when players change for a fresh start
  newState.board = Array(9).fill(null);
  newState.xIsNext = true;
  newState.winner = null;
  newState.winningLine = null;
  newState.isDraw = false;

  await updateGameState(lobbyId, newState);
  if (window.Notify) Notify.toast(`Assigned ${pname} to ${role}`);
}

// --- Game Logic ---
function resetGameState(sync = false) {
  const emptyState = { 
    board: Array(9).fill(null), 
    xIsNext: true, 
    winner: null, 
    winningLine: null, 
    isDraw: false,
    playerX: gameState.playerX, // keep current players
    playerO: gameState.playerO 
  };

  if (sync && isOnline) {
    updateGameState(lobbyId, emptyState);
  } else {
    gameState = emptyState;
    renderBoard();
  }
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

  // Permission Check
  if (isOnline) {
    const currentPlayerId = currentTurnSymbol === 'X' ? gameState.playerX.id : gameState.playerO.id;
    if (window.CLIENT_ID !== currentPlayerId) {
      if (window.Notify) Notify.toast(`It's not your turn! Waiting for ${currentTurnSymbol}.`);
      return;
    }
  }

  const newState = { ...gameState };
  newState.board[index] = currentTurnSymbol;
  
  const winResult = checkWinner(newState.board);
  if (winResult) {
    if (winResult.winner === 'Draw') newState.isDraw = true;
    else { newState.winner = winResult.winner; newState.winningLine = winResult.line; }
  } else {
    newState.xIsNext = !newState.xIsNext;
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
  for (let i = 0; i < 9; i++) {
    const cell = cells[i];
    const val = gameState.board[i];
    cell.innerText = val ? val : '';
    cell.className = 'cell';    
    if (val) cell.classList.add('occupied', val === 'X' ? 'x-mark' : 'o-mark');
    if (gameState.winningLine && gameState.winningLine.includes(i)) cell.classList.add('win-cell');
  }

  // Update Role Badge
  if (isOnline) {
    if (window.CLIENT_ID === gameState.playerX.id) {
       selfRoleBadge.innerText = "PLAYING AS X";
       selfRoleBadge.className = "role-badge playing-x";
    } else if (window.CLIENT_ID === gameState.playerO.id) {
       selfRoleBadge.innerText = "PLAYING AS O";
       selfRoleBadge.className = "role-badge playing-o";
    } else {
       selfRoleBadge.innerText = "SPECTATING";
       selfRoleBadge.className = "role-badge spectating";
    }
  } else {
    selfRoleBadge.innerText = "LOCAL MODE";
    selfRoleBadge.className = "role-badge spectating";
  }

  // Update Turn Text
  if (gameState.winner) {
    const winnerName = gameState.winner === 'X' ? gameState.playerX.name : gameState.playerO.name;
    turnIndicator.innerText = isOnline ? `${winnerName} Wins! 🎉` : `${gameState.winner} Wins! 🎉`;
    if (window.Notify) Notify.toast(`${isOnline ? winnerName : gameState.winner} has won the game!`);
  } else if (gameState.isDraw) {
    turnIndicator.innerText = "It's a Draw! 🤝";
  } else {
    const nextSym = gameState.xIsNext ? 'X' : 'O';
    const nextName = gameState.xIsNext ? gameState.playerX.name : gameState.playerO.name;
    
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

init();
