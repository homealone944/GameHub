/* games/codenames/game.js */
import { subscribeToLobby, updateGameState } from '../../js/database-manager.js';

// DOM Elements
const boardEl = document.getElementById('board');
const clueLogEl = document.getElementById('clue-log');
const activePlayerDisplay = document.getElementById('active-player-display');
const turnsDotsEl = document.getElementById('turns-dots');
const agentsFoundEl = document.getElementById('agents-found');
const selfRoleBadge = document.getElementById('self-role-badge');

const btnEndTurn = document.getElementById('btn-end-turn');
const btnGiveClue = document.getElementById('btn-give-clue');
const btnStartGame = document.getElementById('btn-start-game');
const inputClueWord = document.getElementById('clue-word');
const inputClueNum = document.getElementById('clue-num');
const clueInputArea = document.getElementById('clue-input-area');

const gameOverBanner = document.getElementById('game-over-banner');
const gameOverText = document.getElementById('game-over-text');
const btnBannerRematch = document.getElementById('btn-banner-rematch');
const btnSheetRematch = document.getElementById('btn-rematch');

const passOverlay = document.getElementById('pass-device-overlay');
const btnReady = document.getElementById('btn-ready');
const nextPlayerName = document.getElementById('next-player-name');

const settingsModal = document.getElementById('settings-modal');
const btnSettings = document.getElementById('btn-settings');
const btnRules = document.getElementById('btn-rules');
const rulesModal = document.getElementById('rules-modal');
const btnCloseRules = document.getElementById('btn-close-rules');
const btnRulesOk = document.getElementById('btn-rules-ok');

const btnCloseSettings = document.getElementById('btn-close-settings');
const btnSettingsRematch = document.getElementById('btn-settings-rematch');
const inputTokens = document.getElementById('input-tokens');
const inputWords = document.getElementById('input-words');

const hostSeatingSection = document.getElementById('host-seating-section');
const selectAgent1 = document.getElementById('select-agent-1');
const selectAgent2 = document.getElementById('select-agent-2');

// State
let config = {
  maxTurns: 9,
  customWords: []
};

let gameState = {
  words: [],
  p1Key: [],
  p2Key: [],
  revealed: Array(25).fill(null),
  activePlayer: 1, // 1 or 2
  phase: 'setup',
  turnsLeft: 9,
  gameOver: false,
  greensFound: 0,
  log: [],
  player1: { id: null, name: 'Waiting...' },
  player2: { id: null, name: 'Waiting...' }
};

let isOnline = false;
let lobbyId = null;
let isAnimating = false;

// --- Initialization ---
function init() {
  const urlParams = new URLSearchParams(window.location.search);
  isOnline = urlParams.get('mode') === 'online';
  lobbyId = urlParams.get('lobby');

  loadSettings();
  setupListeners();

  if (isOnline && lobbyId) {
    initOnlineMode();
  } else {
    startNewGame();
  }
}

function loadSettings() {
  const savedTokens = localStorage.getItem('cd_tokens');
  if (savedTokens) config.maxTurns = parseInt(savedTokens);
  
  const savedWords = localStorage.getItem('cd_words');
  if (savedWords) config.customWords = savedWords.split(',').map(w => w.trim().toUpperCase()).filter(w => w.length > 0);
  
  inputTokens.value = config.maxTurns;
  inputWords.value = config.customWords.join(', ');
}

function setupListeners() {
  btnSettings.addEventListener('click', () => settingsModal.classList.remove('hidden'));
  btnCloseSettings.addEventListener('click', () => settingsModal.classList.add('hidden'));
  
  if(btnRules && rulesModal) {
    btnRules.addEventListener('click', () => rulesModal.classList.remove('hidden'));
    btnCloseRules.addEventListener('click', () => rulesModal.classList.add('hidden'));
    btnRulesOk.addEventListener('click', () => rulesModal.classList.add('hidden'));
  }

  btnSettingsRematch.addEventListener('click', () => {
    let t = parseInt(inputTokens.value) || 9;
    config.maxTurns = t;
    localStorage.setItem('cd_tokens', t);
    
    const w = inputWords.value.split(',').map(s => s.trim().toUpperCase()).filter(s => s.length > 0);
    config.customWords = w;
    localStorage.setItem('cd_words', w.join(','));
    
    settingsModal.classList.add('hidden');
    startNewGame();
  });

  btnReady.addEventListener('click', () => {
    passOverlay.classList.add('hidden');
    renderUI();
  });

  btnStartGame.addEventListener('click', () => {
    if (isOnline) {
      if (isHost()) {
        const newState = { ...gameState, phase: 'intel', activePlayer: 1 };
        updateGameState(lobbyId, newState);
      } else {
        if (window.Notify) Notify.toast("Only the Host can start the mission.");
      }
    } else {
      triggerLocalPassDevice(1, 'intel');
    }
  });

  btnGiveClue.addEventListener('click', submitClue);
  btnEndTurn.addEventListener('click', endGuessingPhase);
  
  btnBannerRematch.addEventListener('click', startNewGame);
  btnSheetRematch.addEventListener('click', () => {
    toggleSheet();
    startNewGame();
  });

  // Seating
  if (isOnline) {
    selectAgent1.addEventListener('change', (e) => assignSeat(1, e.target.value));
    selectAgent2.addEventListener('change', (e) => assignSeat(2, e.target.value));
  }

  // Sheet Toggle
  const sheetHandle = document.getElementById('sheet-handle');
  const sheetOverlay = document.getElementById('sheet-overlay');
  if (sheetHandle) sheetHandle.addEventListener('click', toggleSheet);
  if (sheetOverlay) sheetOverlay.addEventListener('click', toggleSheet);
}

function toggleSheet() {
  const sheet = document.getElementById('control-sheet');
  const overlay = document.getElementById('sheet-overlay');
  if (!sheet) return;
  sheet.classList.toggle('active');
  if (overlay) overlay.classList.toggle('hidden');
}

function initOnlineMode() {
  subscribeToLobby(lobbyId, (data) => {
    if (!data) return;

    if (!data.gameState || !data.gameState.words || data.gameState.words.length === 0) {
      if (data.hostId === window.CLIENT_ID) {
        console.log("[Codenames] Initializing Online State");
        
        // Auto-fill players
        const p1 = data.players[0] || { id: null, name: 'Waiting...' };
        const p2 = data.players[1] || { id: null, name: 'Waiting...' };

        const initialState = Object.assign(generateInitialState(), {
          player1: { id: p1.id, name: p1.name },
          player2: { id: p2.id, name: p2.name }
        });
        updateGameState(lobbyId, initialState);
      }
      return;
    }

    gameState = data.gameState;
    renderUI();

    // Host UI
    if (data.hostId === window.CLIENT_ID) {
      renderHostSeating(data.players);
      btnSheetRematch.classList.remove('hidden-host-only');
    } else {
      hostSeatingSection.classList.add('hidden');
      btnSheetRematch.classList.add('hidden-host-only');
    }
  });
}

function generateInitialState() {
  const words = generateWords();
  const keys = generateKeysInternal();
  return {
    words: words,
    p1Key: keys.p1,
    p2Key: keys.p2,
    revealed: Array(25).fill(null),
    activePlayer: 1,
    phase: 'setup',
    turnsLeft: config.maxTurns,
    gameOver: false,
    loseReason: null,
    greensFound: 0,
    log: []
  };
}

function renderHostSeating(players) {
  hostSeatingSection.classList.remove('hidden');
  const buildOptions = (currentId) => {
    let html = `<option value="" ${!currentId ? 'selected' : ''} disabled>Select Agent...</option>`;
    players.forEach(p => {
       html += `<option value="${p.id}" ${p.id === currentId ? 'selected' : ''}>${p.name}${p.id === window.CLIENT_ID ? ' (You)' : ''}</option>`;
    });
    return html;
  };

  if (selectAgent1.options.length !== (players.length + 1)) {
    selectAgent1.innerHTML = buildOptions(gameState.player1.id);
    selectAgent2.innerHTML = buildOptions(gameState.player2.id);
  } else {
    selectAgent1.value = gameState.player1.id || "";
    selectAgent2.value = gameState.player2.id || "";
  }
}

async function assignSeat(num, pid) {
  const players = window.currentLobbyData.players;
  const pObj = players.find(p => p.id === pid);
  if (!pObj) return;

  const newState = { ...gameState };
  if (num === 1) newState.player1 = { id: pid, name: pObj.name };
  else newState.player2 = { id: pid, name: pObj.name };

  // Reset board on seating change
  const fresh = generateInitialState();
  Object.assign(newState, fresh);

  updateGameState(lobbyId, newState);
  if (window.Notify) Notify.toast(`Assigned ${pObj.name} to Agent ${num}`);
}

function isHost() {
  return window.currentLobbyData && window.currentLobbyData.hostId === window.CLIENT_ID;
}

// --- Game Logic ---
function startNewGame() {
  if (isOnline) {
    if (isHost()) {
      const fresh = generateInitialState();
      const newState = { ...gameState, ...fresh };
      updateGameState(lobbyId, newState);
    } else {
      if (window.Notify) Notify.toast("Only the Host can restart the mission.");
    }
    return;
  }

  gameState = generateInitialState();
  gameOverBanner.classList.add('hidden');
  passOverlay.classList.add('hidden');
  renderUI();
}

function triggerLocalPassDevice(targetPlayer, phase, clueStr) {
  gameState.activePlayer = targetPlayer;
  gameState.phase = phase;
  
  const name = targetPlayer === 1 ? config.p1Name : config.p2Name;
  nextPlayerName.innerText = `${name} (${phase.toUpperCase()} PHASE)`;
  passOverlay.classList.remove('hidden');
  boardEl.innerHTML = '';
}

function generateWords() {
  let pool = config.customWords.length >= 25 ? config.customWords : DEFAULT_WORDS;
  let shuffled = [...pool].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 25);
}

function generateKeysInternal() {
  const distribution = [
    [1,1], [1,1], [1,1], [1,0], [1,0], [1,0], [1,0], [1,0], [0,1], [0,1], [0,1], [0,1], [0,1], 
    [1,2], [2,1], [2,2], [2,0], [0,2], [0,0], [0,0], [0,0], [0,0], [0,0], [0,0], [0,0]
  ];
  distribution.sort(() => 0.5 - Math.random());
  
  const p1 = [];
  const p2 = [];
  for (let i = 0; i < 25; i++) {
    p1[i] = distribution[i][0];
    p2[i] = distribution[i][1];
  }
  return { p1, p2 };
}

function submitClue() {
  if (gameState.gameOver || gameState.phase !== 'intel') return;

  // Online Lock
  if (isOnline) {
    const assignedId = gameState.activePlayer === 1 ? gameState.player1.id : gameState.player2.id;
    if (window.CLIENT_ID !== assignedId) {
      if (window.Notify) Notify.toast(`It's not your turn! Waiting for Agent ${gameState.activePlayer}.`);
      return;
    }
  }

  const word = inputClueWord.value.trim();
  const num = parseInt(inputClueNum.value);
  if (!word || isNaN(num) || num < 1) {
    if (window.Notify) Notify.toast("Invalid clue format.");
    return;
  }

  const clueStr = `${word.toUpperCase()}(${num})`;
  const newState = { ...gameState };
  newState.log.push({
    player: gameState.activePlayer,
    clue: clueStr,
    guesses: []
  });
  newState.turnsLeft--;
  newState.activePlayer = gameState.activePlayer === 1 ? 2 : 1;
  newState.phase = 'guessing';

  inputClueWord.value = '';
  inputClueNum.value = '';

  if (isOnline) {
    updateGameState(lobbyId, newState);
  } else {
    gameState = newState;
    renderUI();
  }
}

function endGuessingPhase() {
  if (gameState.gameOver || gameState.phase !== 'guessing') return;

  // Online Lock
  if (isOnline) {
    const assignedId = gameState.activePlayer === 1 ? gameState.player1.id : gameState.player2.id;
    if (window.CLIENT_ID !== assignedId) return;
  }

  const newState = { ...gameState };
  if (newState.turnsLeft <= 0 && newState.greensFound < 15) {
     newState.gameOver = true;
     newState.loseReason = "RAN OUT OF TURNS!";
  } else {
     newState.phase = 'intel';
  }

  if (isOnline) {
    updateGameState(lobbyId, newState);
  } else {
    gameState = newState;
    renderUI();
  }
}

function handleCardClick(index) {
  if (gameState.gameOver || isAnimating || gameState.phase !== 'guessing') return;

  // Online Lock
  if (isOnline) {
    const assignedId = gameState.activePlayer === 1 ? gameState.player1.id : gameState.player2.id;
    if (window.CLIENT_ID !== assignedId) return;
  }

  const currentReveal = gameState.revealed[index];
  if (currentReveal === 'green' || currentReveal === 'black' || currentReveal === 'bystander') return;
  if (currentReveal === `bystander-${gameState.activePlayer}`) return;

  const opposingKey = gameState.activePlayer === 1 ? gameState.p2Key : gameState.p1Key;
  const type = opposingKey[index];
  const wordStr = gameState.words[index];

  const newState = { ...gameState };

  if (type === 2) {
    newState.revealed[index] = 'black';
    newState.log[newState.log.length - 1].guesses.push({ word: wordStr, type: 'assassin' });
    newState.gameOver = true;
    newState.loseReason = `HIT ASSASSIN '${wordStr}'!`;
  } else if (type === 1) {
    newState.revealed[index] = 'green';
    newState.greensFound++;
    newState.log[newState.log.length - 1].guesses.push({ word: wordStr, type: 'agent' });
    if (newState.greensFound >= 15) newState.gameOver = true;
  } else {
    // Flat string bystander logic
    if (gameState.revealed[index] === null) {
      newState.revealed[index] = `bystander-${gameState.activePlayer}`;
    } else if (gameState.revealed[index] === `bystander-${gameState.activePlayer === 1 ? 2 : 1}`) {
      newState.revealed[index] = 'bystander';
    }
    
    newState.log[newState.log.length - 1].guesses.push({ word: wordStr, type: 'bystander' });
    
    // Auto-end turn on bystander
    newState.phase = 'intel';
    if (newState.turnsLeft <= 0 && newState.greensFound < 15) {
      newState.gameOver = true;
      newState.loseReason = "RAN OUT OF TURNS!";
    }
  }

  if (isOnline) {
    updateGameState(lobbyId, newState);
  } else {
    gameState = newState;
    renderUI();
  }
}

// --- UI Rendering ---
function renderUI() {
  const p1 = isOnline ? gameState.player1.name : config.p1Name;
  const p2 = isOnline ? gameState.player2.name : config.p2Name;
  const getPName = (n) => n === 1 ? p1 : p2;

  const name = getPName(gameState.activePlayer);
  activePlayerDisplay.innerText = gameState.phase === 'setup' ? "MISSION START" : `${name}: ${gameState.phase.toUpperCase()}`;
  activePlayerDisplay.style.color = gameState.activePlayer === 1 ? "#3b82f6" : "#ef4444";
  
  agentsFoundEl.innerText = gameState.greensFound;
  turnsDotsEl.innerText = `${Math.max(0, gameState.turnsLeft)} / ${config.maxTurns}`;
  
  // Badge logic
  if (isOnline) {
    if (window.CLIENT_ID === gameState.player1.id) {
       selfRoleBadge.innerText = "AGENT 1";
       selfRoleBadge.className = "role-badge playing-blue";
    } else if (window.CLIENT_ID === gameState.player2.id) {
       selfRoleBadge.innerText = "AGENT 2";
       selfRoleBadge.className = "role-badge playing-red";
    } else {
       selfRoleBadge.innerText = "SPECTATING";
       selfRoleBadge.className = "role-badge spectating";
    }
  } else {
    selfRoleBadge.innerText = "LOCAL MODE";
  }

  if (!gameState.gameOver) {
    gameOverBanner.classList.add('hidden');
    
    // Turn Discipline Logic
    const isMyTurn = (gameState.activePlayer === 1 && window.CLIENT_ID === gameState.player1.id) || 
                     (gameState.activePlayer === 2 && window.CLIENT_ID === gameState.player2.id);

    if (gameState.phase === 'setup') {
      clueInputArea.classList.add('hidden');
      btnEndTurn.classList.add('hidden');
      btnStartGame.classList.remove('hidden');

      if (isOnline) {
        if (isHost()) {
          btnStartGame.innerText = "START OPERATION";
          btnStartGame.disabled = false;
          btnStartGame.style.opacity = "1";
          btnStartGame.style.cursor = "pointer";
        } else {
          btnStartGame.innerText = "WAITING ON HOST TO START";
          btnStartGame.disabled = true;
          btnStartGame.style.opacity = "0.6";
          btnStartGame.style.cursor = "not-allowed";
        }
      } else {
        btnStartGame.innerText = "START OPERATION";
        btnStartGame.disabled = false;
        btnStartGame.style.opacity = "1";
      }
    } else if (gameState.phase === 'intel') {
      // Only show clue input to the active Intel Agent
      if (isMyTurn) clueInputArea.classList.remove('hidden');
      else clueInputArea.classList.add('hidden');
      
      btnEndTurn.classList.add('hidden');
      btnStartGame.classList.add('hidden');
      
      const myKey = gameState.activePlayer === 1 ? gameState.p1Key : gameState.p2Key;
      let remaining = 0;
      for (let i = 0; i < 25; i++) {
        if (myKey[i] === 1 && (gameState.revealed[i] === null || gameState.revealed[i].startsWith('bystander-'))) remaining++;
      }
      inputClueNum.max = remaining;
    } else if (gameState.phase === 'guessing') {
      clueInputArea.classList.add('hidden');
      // Only show End Turn button to the active Guessing Agent
      if (isMyTurn) btnEndTurn.classList.remove('hidden');
      else btnEndTurn.classList.add('hidden');
      
      btnStartGame.classList.add('hidden');
    }
  } else {
    clueInputArea.classList.add('hidden');
    btnEndTurn.classList.add('hidden');
    btnStartGame.classList.add('hidden');
    gameOverBanner.classList.remove('hidden');

    if (isOnline) {
      if (isHost()) {
        btnBannerRematch.innerText = "START NEW GAME";
        btnBannerRematch.disabled = false;
        btnBannerRematch.style.opacity = "1";
        btnBannerRematch.style.cursor = "pointer";
      } else {
        btnBannerRematch.innerText = "WAITING FOR HOST TO RESTART";
        btnBannerRematch.disabled = true;
        btnBannerRematch.style.opacity = "0.6";
        btnBannerRematch.style.cursor = "not-allowed";
      }
    } else {
      btnBannerRematch.innerText = "START NEW GAME";
      btnBannerRematch.disabled = false;
      btnBannerRematch.style.opacity = "1";
    }

    if (gameState.loseReason) {
      gameOverText.innerText = gameState.loseReason;
      gameOverText.className = "lose-text";
    } else {
      gameOverText.innerText = "VICTORY! ALL AGENTS FOUND";
      gameOverText.className = "win-text";
    }
  }

  renderLog();
  renderBoard();
}

function renderBoard() {
  boardEl.innerHTML = '';
  
  // Decide which intel to show:
  // 1) Setup Phase: No one sees any keys.
  // 2) Active Phases: You see YOUR key UNLESS it is YOUR turn to guess.
  let myIntelKey = null;
  
  if (gameState.phase !== 'setup' && !gameState.gameOver) {
    if (isOnline) {
      const isPlayer1 = window.CLIENT_ID === gameState.player1.id;
      const isPlayer2 = window.CLIENT_ID === gameState.player2.id;
      
      if (isPlayer1) {
         // Agent 1 sees Key 1 as long as they aren't the one currently guessing
         if (!(gameState.activePlayer === 1 && gameState.phase === 'guessing')) {
            myIntelKey = gameState.p1Key;
         }
      } else if (isPlayer2) {
         // Agent 2 sees Key 2 as long as they aren't the one currently guessing
         if (!(gameState.activePlayer === 2 && gameState.phase === 'guessing')) {
            myIntelKey = gameState.p2Key;
         }
      }
    } else {
      // Local mode: Only show the active intellectual half
      myIntelKey = gameState.activePlayer === 1 ? gameState.p1Key : gameState.p2Key;
    }
  }

  for (let i = 0; i < 25; i++) {
    const word = gameState.words[i];
    const revealed = gameState.revealed[i];
    const isRevealed = revealed === 'green' || revealed === 'black' || revealed === 'bystander';

    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.innerText = word;

    if (isRevealed) {
      cardEl.classList.add('revealed', revealed);
    } else if (revealed === 'bystander-1' || revealed === 'bystander-2') {
      cardEl.classList.add('partial-bystander');
      if (revealed === 'bystander-1') cardEl.innerHTML += `<div class="bystander-token p1"></div>`;
      if (revealed === 'bystander-2') cardEl.innerHTML += `<div class="bystander-token p2"></div>`;
    }

    // Interaction
    const canClick = !isRevealed && revealed !== `bystander-${gameState.activePlayer}`;
    if (canClick && !gameState.gameOver && gameState.phase === 'guessing') {
       cardEl.addEventListener('click', () => handleCardClick(i));
    }

    // Intel Overlays (Shown during ANY phase where the player isn't the guesser)
    if (!gameState.gameOver && myIntelKey) {
       const type = myIntelKey[i];
       if (type === 1) cardEl.classList.add('intel-green');
       else if (type === 2) cardEl.classList.add('intel-black');
    }

    // Game Over Reveal (Split-Border Mode)
    if (gameState.gameOver) {
       cardEl.classList.add('revealed', 'reveal-border-mode');
       
       const p1X = gameState.p1Key[i];
       const p2X = gameState.p2Key[i];
       const getCol = (t) => t === 1 ? '#10b981' : (t === 2 ? '#ef4444' : 'rgba(255,255,255,0.15)');
       
       cardEl.style.borderLeft = `6px solid ${getCol(p1X)}`;
       cardEl.style.borderRight = `6px solid ${getCol(p2X)}`;

       if (isRevealed) {
          // Fill based on what was actually guessed
          if (revealed === 'green') cardEl.classList.add('reveal-solid-green');
          else if (revealed === 'black') cardEl.classList.add('reveal-solid-red');
          else cardEl.classList.add('reveal-solid-bystander');
       }
    }

    boardEl.appendChild(cardEl);
  }
}

function renderLog() {
  clueLogEl.innerHTML = '';
  gameState.log.forEach(entry => {
    const el = document.createElement('div');
    el.className = `log-entry player${entry.player}-log`;
    const pName = isOnline ? (entry.player === 1 ? gameState.player1.name : gameState.player2.name) : (entry.player === 1 ? config.p1Name : config.p2Name);
    
    let guessesHTML = '<div class="log-guesses">';
    entry.guesses.forEach(g => {
      let cls = 'guess-bystander';
      if (g.type === 'agent') cls = 'guess-agent';
      if (g.type === 'assassin') cls = 'guess-assassin';
      guessesHTML += `<div class="guess-pill ${cls}">${g.word}</div>`;
    });
    guessesHTML += '</div>';

    el.innerHTML = `
      <span class="log-player">${pName}</span>
      <span class="log-clue">${entry.clue}</span>
      ${guessesHTML}
    `;
    clueLogEl.appendChild(el);
  });
  if (clueLogEl.parentElement) clueLogEl.parentElement.scrollLeft = clueLogEl.parentElement.scrollWidth;
}

init();
