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
const btnBannerRematch = document.getElementById('btn-banner-rematch');
const btnSheetRematch = document.getElementById('btn-rematch');

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
const btnSettingsRematch = document.getElementById('btn-settings-rematch');
const inputTokens = document.getElementById('input-tokens');
const inputWords = document.getElementById('input-words');
const inputP1Name = document.getElementById('input-p1-name');
const inputP2Name = document.getElementById('input-p2-name');

// Players Modal
const btnPlayers = document.getElementById('btn-profile'); // ID remains for simplicity
const playersModal = document.getElementById('players-modal');
const btnClosePlayers = document.getElementById('btn-close-players-modal');
const btnSavePlayers = document.getElementById('btn-save-players');
const displayTokens = document.getElementById('display-tokens');

// State
let config = {
  maxTurns: 9,
  customWords: [],
  p1Name: "Agent 1",
  p2Name: "Agent 2"
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
  
  config.p1Name = inputP1Name.value.trim() || "Agent 1";
  config.p2Name = inputP2Name.value.trim() || "Agent 2";
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

  btnSettingsRematch.addEventListener('click', () => processSettingsSave(true));

  btnReady.addEventListener('click', () => {
    passOverlay.classList.add('hidden');
    renderUI();
  });

  btnStartGame.addEventListener('click', () => {
    triggerPassDevice(1, 'intel');
  });

  // Prefill word area
  if (inputWords && !inputWords.value) {
    inputWords.value = DEFAULT_WORDS_2.join(', ');
  }

  inputTokens.addEventListener('input', () => {
    displayTokens.innerText = inputTokens.value;
  });

  btnGiveClue.addEventListener('click', submitClue);
  btnEndTurn.addEventListener('click', endGuessingPhase);
  
  btnBannerRematch.addEventListener('click', startNewGame);
  btnSheetRematch.addEventListener('click', () => {
    toggleSheet();
    startNewGame();
  });

  // Players Modal
  btnPlayers.addEventListener('click', () => {
    inputP1Name.value = config.p1Name;
    inputP2Name.value = config.p2Name;
    playersModal.classList.remove('hidden');
    toggleSheet(); 
  });
  btnClosePlayers.addEventListener('click', () => playersModal.classList.add('hidden'));
  btnSavePlayers.addEventListener('click', () => {
    config.p1Name = inputP1Name.value.trim() || 'Agent 1';
    config.p2Name = inputP2Name.value.trim() || 'Agent 2';
    playersModal.classList.add('hidden');
    renderUI();
    if (window.Notify) Notify.toast("Field Agents updated!");
  });

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
  const word = inputClueWord.value.trim();
  const num = parseInt(inputClueNum.value);
  const max = parseInt(inputClueNum.max) || 9;
  
  if (!word || isNaN(num) || num < 1 || num > max) {
    if (window.Notify) Notify.toast(`Valid clue number: 1-${max}`);
    return;
  }

  const clueStr = `${word.toUpperCase()}(${num})`;
  
  gameState.log.push({
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
        if (g.type === 'agent') cls = 'guess-agent';
        if (g.type === 'assassin') cls = 'guess-assassin';
        guessesHTML += `<div class="guess-pill ${cls}">${g.word}</div>`;
      });
      guessesHTML += '</div>';
    }

    const entryPlayerName = getPlayerName(entry.player);
    el.innerHTML = `
      <span class="log-player">${entryPlayerName}</span>
      <span class="log-clue">${entry.clue}</span>
      ${guessesHTML}
    `;
    clueLogEl.appendChild(el);
  });
  
  // Auto-scroll timeline to the right on new entries
  if (clueLogEl.parentElement) {
    clueLogEl.parentElement.scrollLeft = clueLogEl.parentElement.scrollWidth;
  }
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
      gameState.log[gameState.log.length - 1].guesses.push({ word: wordStr, type: 'assassin' });
      renderLog();
    }
    loseGame(`DEFEAT: HIT ASSASSIN '${wordStr}'!`);
    renderUI();
  } else if (type === 1) {
    // Correct Green
    gameState.revealed[index] = 'green';
    gameState.greensFound++;
    if (gameState.log.length > 0) {
      gameState.log[gameState.log.length - 1].guesses.push({ word: wordStr, type: 'agent' });
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
      gameState.log[gameState.log.length - 1].guesses.push({ word: wordStr, type: 'bystander' });
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
  gameOverText.classList.add('lose-text');
  gameOverBanner.classList.remove('hidden');
}

function winGame() {
  gameState.gameOver = true;
  gameOverText.innerText = "VICTORY! All agents found!";
  gameOverText.classList.add('win-text');
  gameOverBanner.classList.remove('hidden');
}

// --- UI Rendering ---
function renderUI() {
  const name = getPlayerName(gameState.activePlayer);
  activePlayerDisplay.innerText = gameState.phase === 'setup' ? "MISSION START" : `${name}: ${gameState.phase.toUpperCase()}`;
  activePlayerDisplay.style.color = gameState.activePlayer === 1 ? "#3b82f6" : "#ef4444";
  
  agentsFoundEl.innerText = gameState.greensFound;
  turnsDotsEl.innerText = `${Math.max(0, gameState.turnsLeft)} / ${config.maxTurns}`;
  
  if (!gameState.gameOver) {
    if (gameState.phase === 'setup') {
      clueInputArea.classList.add('hidden');
      btnEndTurn.classList.add('hidden');
      btnStartGame.classList.remove('hidden');
    } else if (gameState.phase === 'intel') {
      clueInputArea.classList.remove('hidden');
      btnEndTurn.classList.add('hidden');
      btnStartGame.classList.add('hidden');
      
      // Calculate remaining agents for current player's key
      const myKey = gameState.activePlayer === 1 ? gameState.p1Key : gameState.p2Key;
      let remaining = 0;
      for (let i = 0; i < 25; i++) {
        if (myKey[i] === 1 && (gameState.revealed[i] === null || Array.isArray(gameState.revealed[i]))) {
          remaining++;
        }
      }
      inputClueNum.max = remaining;
      if (parseInt(inputClueNum.value) > remaining) inputClueNum.value = remaining;
    } else {
      clueInputArea.classList.add('hidden');
      btnEndTurn.classList.remove('hidden');
      btnStartGame.classList.add('hidden');
    }
  } else {
    clueInputArea.classList.add('hidden');
    btnEndTurn.classList.add('hidden');
    btnStartGame.classList.add('hidden');
  }

  renderLog();
  renderBoard();
}

function renderBoard() {
  boardEl.innerHTML = '';
  const myKey = gameState.activePlayer === 1 ? gameState.p1Key : gameState.p2Key;

  for (let i = 0; i < 25; i++) {
    const word = gameState.words[i];
    const revealed = gameState.revealed[i];
    const isRevealed = revealed !== null && !Array.isArray(revealed);

    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.innerText = word;

    // 1. Revealed states (Found for everyone)
    if (isRevealed) {
      cardEl.classList.add('revealed', revealed);
    } else if (Array.isArray(revealed)) {
      cardEl.classList.add('partial-bystander');
      if (revealed.includes('bystander-1')) cardEl.innerHTML += `<div class="bystander-token p1"></div>`;
      if (revealed.includes('bystander-2')) cardEl.innerHTML += `<div class="bystander-token p2"></div>`;
      if (revealed.includes('bystander-1') && revealed.includes('bystander-2')) {
         cardEl.classList.remove('partial-bystander');
         cardEl.classList.add('revealed', 'bystander');
      }
    }

    // 2. Interaction
    const canClick = !isRevealed && !(Array.isArray(revealed) && revealed.includes(`bystander-${gameState.activePlayer}`));
    if (canClick && !gameState.gameOver) {
       cardEl.addEventListener('click', () => handleCardClick(i));
    }

    // 3. Intel Phase Overlays (Current Player's Key)
    if (gameState.phase === 'intel' && !gameState.gameOver) {
       const type = myKey[i];
       if (type === 1) {
         cardEl.classList.add('intel-green');
         // Visually mark as found if it's already green on the board
         if (isRevealed && revealed === 'green') {
           cardEl.classList.add('is-found');
         }
       } else if (type === 2) {
         cardEl.classList.add('intel-black');
       }
    }

    // 4. Game Over Reveal (Full Board)
    if (gameState.gameOver) {
       cardEl.classList.add('revealed');
       const p1Type = gameState.p1Key[i];
       const p2Type = gameState.p2Key[i];
       if (p1Type === 2 || p2Type === 2) cardEl.classList.add('black');
       else if (p1Type === 1 || p2Type === 1) cardEl.classList.add('green');
       else cardEl.classList.add('bystander');
    }

    boardEl.appendChild(cardEl);
  }
}

init();
