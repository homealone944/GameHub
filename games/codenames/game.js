// DOM Elements
const boardEl = document.getElementById('board');
const clueLogEl = document.getElementById('clue-log');

const activePlayerDisplay = document.getElementById('active-player-display');
const turnsDotsEl = document.getElementById('turns-dots');
const agentsFoundEl = document.getElementById('agents-found');

const btnEndTurn = document.getElementById('btn-end-turn');
const btnGiveClue = document.getElementById('btn-give-clue');
const btnStartGame = document.getElementById('btn-start-game');
const inputClueWord = document.getElementById('clue-word');
const inputClueNum = document.getElementById('clue-num');
const clueInputArea = document.getElementById('clue-input-area');

const gameOverBanner = document.getElementById('game-over-banner');
const gameOverText = document.getElementById('game-over-text');
const btnNavRematch = document.getElementById('btn-nav-rematch');
const btnBannerRematch = document.getElementById('btn-banner-rematch');

const passOverlay = document.getElementById('pass-device-overlay');
const btnReady = document.getElementById('btn-ready');
const nextPlayerName = document.getElementById('next-player-name');
const passClueDisplay = document.getElementById('pass-clue-display');
const passClueText = document.getElementById('pass-clue-text');

const settingsModal = document.getElementById('settings-modal');
const btnSettings = document.getElementById('btn-settings');
const btnRules = document.getElementById('btn-rules');
const rulesModal = document.getElementById('rules-modal');
const btnCloseRules = document.getElementById('btn-close-rules');
const btnRulesOk = document.getElementById('btn-rules-ok');

const btnCloseSettings = document.getElementById('btn-close-settings');
const btnSaveSettings = document.getElementById('btn-save-settings');
const btnSettingsRematch = document.getElementById('btn-settings-rematch');
const inputTokens = document.getElementById('input-tokens');
const inputWords = document.getElementById('input-words');
const inputP1Name = document.getElementById('input-p1-name');
const inputP2Name = document.getElementById('input-p2-name');

// State
let config = {
  maxTurns: 9,
  customWords: [],
  p1Name: "Player 1",
  p2Name: "Player 2"
};

let gameState = {
  words: [],
  p1Key: [], // 0 = bystander, 1 = green, 2 = assassin
  p2Key: [], // 0 = bystander, 1 = green, 2 = assassin
  revealed: Array(25).fill(null), // null, 'green', 'black', or array: ['bystander-1', 'bystander-2']
  activePlayer: 1, // 1 or 2
  phase: 'setup', // 'setup', 'intel', 'guessing'
  turnsLeft: 9,
  gameOver: false,
  greensFound: 0,
  log: [] 
};

let isAnimating = false;

// --- Initialization ---
function init() {
  loadSettings();
  setupListeners();
  
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get('mode');
  
  if (mode === 'online') {
    alert("Online not supported yet for Duet. Forcing Local mode.");
  }
  
  startNewGame();
}

function loadSettings() {
  const savedTokens = localStorage.getItem('cd_tokens');
  if (savedTokens) config.maxTurns = parseInt(savedTokens);
  
  const savedWords = localStorage.getItem('cd_words');
  if (savedWords) config.customWords = savedWords.split(',').map(w => w.trim().toUpperCase()).filter(w => w.length > 0);
  
  const p1 = localStorage.getItem('cd_p1_name');
  if (p1) config.p1Name = p1;
  const p2 = localStorage.getItem('cd_p2_name');
  if (p2) config.p2Name = p2;
  
  inputTokens.value = config.maxTurns;
  inputWords.value = config.customWords.join(', ');
  inputP1Name.value = config.p1Name;
  inputP2Name.value = config.p2Name;
}

function processSettingsSave(restart) {
  let t = parseInt(inputTokens.value);
  if (isNaN(t) || t < 3) t = 3;
  if (t > 11) t = 11;
  config.maxTurns = t;
  localStorage.setItem('cd_tokens', t);
  
  const w = inputWords.value.split(',').map(s => s.trim().toUpperCase()).filter(s => s.length > 0);
  config.customWords = w;
  localStorage.setItem('cd_words', w.join(','));
  
  config.p1Name = inputP1Name.value.trim() || "Player 1";
  config.p2Name = inputP2Name.value.trim() || "Player 2";
  localStorage.setItem('cd_p1_name', config.p1Name);
  localStorage.setItem('cd_p2_name', config.p2Name);
  
  settingsModal.classList.add('hidden');
  
  if (restart) {
    startNewGame();
  } else {
    renderLog();
    renderUI();
  }
}

function setupListeners() {
  btnSettings.addEventListener('click', () => settingsModal.classList.remove('hidden'));
  btnCloseSettings.addEventListener('click', () => settingsModal.classList.add('hidden'));
  
  if(btnRules && rulesModal) {
    btnRules.addEventListener('click', () => rulesModal.classList.remove('hidden'));
    btnCloseRules.addEventListener('click', () => rulesModal.classList.add('hidden'));
    btnRulesOk.addEventListener('click', () => rulesModal.classList.add('hidden'));
  }

  btnSaveSettings.addEventListener('click', () => processSettingsSave(false));
  btnSettingsRematch.addEventListener('click', () => processSettingsSave(true));

  btnReady.addEventListener('click', () => {
    passOverlay.classList.add('hidden');
    renderUI();
  });

  btnStartGame.addEventListener('click', () => {
    triggerPassDevice(1, 'intel');
  });

  btnGiveClue.addEventListener('click', submitClue);
  btnEndTurn.addEventListener('click', endGuessingPhase);
  
  btnNavRematch.addEventListener('click', startNewGame);
  btnBannerRematch.addEventListener('click', startNewGame);
}

// --- Game Logic ---
function startNewGame() {
  gameState = {
    words: generateWords(),
    p1Key: Array(25).fill(0),
    p2Key: Array(25).fill(0),
    revealed: Array(25).fill(null),
    activePlayer: 1,
    phase: 'setup',
    turnsLeft: config.maxTurns,
    gameOver: false,
    greensFound: 0,
    log: []
  };

  generateKeys();
  renderLog();
  
  gameOverBanner.classList.add('hidden');
  btnNavRematch.classList.add('hidden');
  passOverlay.classList.add('hidden'); // Ensure mask is off so they can see the words 
  
  renderUI(); // Render the board blankly to let them see the words
}

function getPlayerName(num) {
  return num === 1 ? config.p1Name : config.p2Name;
}

function triggerPassDevice(targetPlayer, phase, clueStr) {
  gameState.activePlayer = targetPlayer;
  gameState.phase = phase;
  
  const name = getPlayerName(targetPlayer);
  nextPlayerName.innerText = `${name} (${phase.toUpperCase()} PHASE)`;
  
  if (clueStr) {
    passClueDisplay.classList.remove('hidden');
    passClueText.innerText = clueStr;
  } else {
    passClueDisplay.classList.add('hidden');
  }

  passOverlay.classList.remove('hidden');
  
  // Clear UI underneath so no peeking
  boardEl.innerHTML = '';
}

function generateWords() {
  let pool = config.customWords.length >= 25 ? config.customWords : DEFAULT_WORDS;
  let shuffled = [...pool].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 25);
}

function generateKeys() {
  const distribution = [
    [1,1], [1,1], [1,1], // 3 GG
    [1,0], [1,0], [1,0], [1,0], [1,0], // 5 GB
    [0,1], [0,1], [0,1], [0,1], [0,1], // 5 BG
    [1,2], // 1 GA
    [2,1], // 1 AG
    [2,2], // 1 AA
    [2,0], // 1 AB
    [0,2], // 1 BA
    [0,0], [0,0], [0,0], [0,0], [0,0], [0,0], [0,0] // 7 BB
  ];

  distribution.sort(() => 0.5 - Math.random());

  for (let i = 0; i < 25; i++) {
    gameState.p1Key[i] = distribution[i][0];
    gameState.p2Key[i] = distribution[i][1];
  }
}

function submitClue() {
  if (gameState.gameOver || gameState.phase !== 'intel') return;
  const word = inputClueWord.value.trim().toUpperCase();
  const num = inputClueNum.value;
  if (!word || !num) return;

  const clueStr = `${word} - ${num}`;
  
  gameState.log.unshift({
    player: gameState.activePlayer,
    clue: clueStr,
    guesses: []
  });

  inputClueWord.value = '';
  inputClueNum.value = '';

  gameState.turnsLeft--;
  
  const nextPlayer = gameState.activePlayer === 1 ? 2 : 1;
  triggerPassDevice(nextPlayer, 'guessing', clueStr);
}

function renderLog() {
  clueLogEl.innerHTML = '';
  gameState.log.forEach(entry => {
    const el = document.createElement('div');
    el.className = `log-entry player${entry.player}-log`;
    
    let guessesHTML = '';
    if (entry.guesses.length > 0) {
      guessesHTML = '<div class="log-guesses">';
      entry.guesses.forEach(g => {
        let cls = 'guess-bystander';
        if (g.type === 'green') cls = 'guess-green';
        if (g.type === 'assassin') cls = 'guess-assassin';
        guessesHTML += `<div class="guess-pill ${cls}">${g.word}</div>`;
      });
      guessesHTML += '</div>';
    }

    el.innerHTML = `
      <span class="log-player">${getPlayerName(entry.player)}</span>
      <span class="log-clue">"${entry.clue}"</span>
      ${guessesHTML}
    `;
    clueLogEl.appendChild(el);
  });
}

function endGuessingPhase() {
  if (gameState.gameOver || gameState.phase !== 'guessing') return;
  
  if (gameState.turnsLeft <= 0 && gameState.greensFound < 15) {
     loseGame("DEFEAT: RAN OUT OF TURNS!");
     return;
  }
  
  gameState.phase = 'intel';
  renderUI();
}

function handleCardClick(index) {
  if (gameState.gameOver || isAnimating) return;
  if (gameState.phase === 'intel' || gameState.phase === 'setup') return;
  
  const currentReveal = gameState.revealed[index];
  if (currentReveal === 'green' || currentReveal === 'black') return;
  if (Array.isArray(currentReveal) && currentReveal.includes(`bystander-${gameState.activePlayer}`)) return;

  const opposingKey = gameState.activePlayer === 1 ? gameState.p2Key : gameState.p1Key;
  const type = opposingKey[index];
  const wordStr = gameState.words[index];
  
  if (type === 2) {
    // Assassin!
    gameState.revealed[index] = 'black';
    if (gameState.log.length > 0) {
      gameState.log[0].guesses.push({ word: wordStr + " (ASSASSIN!)", type: 'assassin' });
      renderLog();
    }
    loseGame(`DEFEAT: HIT ASSASSIN '${wordStr}'!`);
    renderUI();
  } else if (type === 1) {
    // Correct Green
    gameState.revealed[index] = 'green';
    gameState.greensFound++;
    if (gameState.log.length > 0) {
      gameState.log[0].guesses.push({ word: wordStr, type: 'green' });
      renderLog();
    }
    if (gameState.greensFound >= 15) {
      winGame();
    }
    renderUI();
  } else {
    // Bystander
    let rev = gameState.revealed[index] || [];
    if (!Array.isArray(rev)) rev = [];
    rev.push(`bystander-${gameState.activePlayer}`);
    gameState.revealed[index] = rev;
    
    if (gameState.log.length > 0) {
      gameState.log[0].guesses.push({ word: wordStr, type: 'bystander' });
      renderLog(); 
    }
    
    isAnimating = true;
    renderUI(); // Trigger UI rebuild so DOM node is fresh
    
    const cardEl = boardEl.children[index];
    if (cardEl) {
      cardEl.classList.add('bystander-shake-x');
    }
    boardEl.classList.add('shake-board');
    
    setTimeout(() => {
      isAnimating = false;
      endGuessingPhase();
    }, 1200);
  }
}

function loseGame(reason) {
  gameState.gameOver = true;
  gameOverText.innerText = reason;
  gameOverText.className = 'lose-text';
  gameOverBanner.classList.remove('hidden');
  btnNavRematch.classList.remove('hidden');
}

function winGame() {
  gameState.gameOver = true;
  gameOverText.innerText = "VICTORY! All agents found!";
  gameOverText.className = 'win-text';
  gameOverBanner.classList.remove('hidden');
  btnNavRematch.classList.remove('hidden');
}

// --- UI Rendering ---
function renderUI() {
  const name = getPlayerName(gameState.activePlayer);
  activePlayerDisplay.innerText = gameState.phase === 'setup' ? "LOBBY - REVIEW BOARD" : `${name}: ${gameState.phase}`;
  agentsFoundEl.innerText = gameState.greensFound;

  // Render turn count
  turnsDotsEl.innerHTML = `<span>${Math.max(0, gameState.turnsLeft)}</span> <span class="muted">/ ${config.maxTurns}</span>`;
  
  if (!gameState.gameOver) {
    if (gameState.phase === 'setup') {
      clueInputArea.classList.add('hidden');
      btnEndTurn.classList.add('hidden');
      btnStartGame.classList.remove('hidden');
      boardEl.classList.remove('intel-phase-board');
    } else if (gameState.phase === 'intel') {
      clueInputArea.classList.remove('hidden');
      btnEndTurn.classList.add('hidden');
      btnStartGame.classList.add('hidden');
      boardEl.classList.add('intel-phase-board');
    } else {
      clueInputArea.classList.add('hidden');
      btnEndTurn.classList.remove('hidden');
      btnStartGame.classList.add('hidden');
      boardEl.classList.remove('intel-phase-board');
    }
  } else {
    clueInputArea.classList.add('hidden');
    btnEndTurn.classList.add('hidden');
    btnStartGame.classList.add('hidden');
  }

  renderLog();

  // Render Board
  boardEl.innerHTML = '';
  const myKey = gameState.activePlayer === 1 ? gameState.p1Key : gameState.p2Key;
  
  for (let i = 0; i < 25; i++) {
    const card = document.createElement('div');
    card.innerText = gameState.words[i];
    card.className = 'card';
    
    if (gameState.gameOver) {
      card.classList.add('revealed');
      const p1v = gameState.p1Key[i];
      const p2v = gameState.p2Key[i];
      if (p1v === 2 || p2v === 2) card.classList.add('black');
      else if (p1v === 1 || p2v === 1) card.classList.add('green');
      else card.classList.add('bystander');
    } else if (gameState.revealed[i] !== null) {
      const rev = gameState.revealed[i];
      if (rev === 'green' || rev === 'black') {
        card.classList.add('revealed');
        card.classList.add(rev);
      } else if (Array.isArray(rev)) {
        card.classList.add('partial-bystander');
        if (rev.includes('bystander-1')) card.innerHTML += `<div class="bystander-token p1"></div>`;
        if (rev.includes('bystander-2')) card.innerHTML += `<div class="bystander-token p2"></div>`;
        if (rev.includes('bystander-1') && rev.includes('bystander-2')) {
           card.classList.add('revealed');
           card.classList.add('bystander');
        }
      }
    }
    
    if (gameState.revealed[i] === null || Array.isArray(gameState.revealed[i])) {
      card.addEventListener('click', () => handleCardClick(i));
    }
    
    if (gameState.phase === 'intel') {
      if (myKey[i] === 1) card.classList.add('intel-green');
      if (myKey[i] === 2) card.classList.add('intel-black');
    }
    
    boardEl.appendChild(card);
  }
}

init();
