/* games/codenames-duet/game.js */
import { GameFramework } from '../../js/game-framework.js';
import { CodenamesEngine, ROWS, COLS } from './engine.js';

let cellElements = [];

/**
 * Codenames Duet Driver Configuration
 * Note: Core UI components (Header, Status Bar, Bottom Sheet, Rules Modal)
 * are now centrally injected by lobby-shell.js and managed by GameFramework.
 */
const framework = new GameFramework({
  gameId: 'codenames-duet',
  seating: {
    archetype: 'coop',
    minPlayers: 2,
    maxPlayers: 2,
    teamName: 'Field Ops',
    color: 'Blue'
  },
  engine: CodenamesEngine,
  passThePhone: true,
  ui: {
    getBlockerInfo: (state) => {
      if (state.phase === 'guessing' && state.log.length > 0) {
        const lastEntry = state.log[state.log.length - 1];
        const playerColor = lastEntry.player === 0 ? "#3b82f6" : "#ef4444";
        const playerName = state.slots[lastEntry.player].name;
        
        return `<div style="font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 0.5rem; letter-spacing: 1px;">MISSION INTEL FROM <span style="color: ${playerColor}; font-weight: 800;">${playerName}</span></div>
                <div style="font-size: 2.5rem; font-weight: 900; color: white;">${lastEntry.clue}</div>`;
      }
      return null;
    },
    render: (state, fw) => {
      const activePlayerDisplay = document.getElementById('active-player-display');
      const turnsDotsEl = document.getElementById('turns-dots');
      const agentsFoundEl = document.getElementById('agents-found');
      const clueInputArea = document.getElementById('clue-input-area');
      const btnEndTurn = document.getElementById('btn-end-turn');
      const actionBay = document.getElementById('action-bay');
      const btnStartGame = document.getElementById('btn-start-game');

      // 1. Metrics & Status
      if (activePlayerDisplay) {
         activePlayerDisplay.innerText = state.phase === 'setup' ? "Briefing" : `${state.slots[state.activeSlotIndex].name}: ${state.phase.toUpperCase()}`;
         activePlayerDisplay.style.color = state.activeSlotIndex === 0 ? "#3b82f6" : "#ef4444";
      }
      if (agentsFoundEl) agentsFoundEl.innerText = state.greensFound;
      if (turnsDotsEl) turnsDotsEl.innerText = `${Math.max(0, state.turnsLeft)}`;

      // 2. Phase-Based Controls
      const isMyTurn = (fw.isOnline && fw.mySlotIndex === state.activeSlotIndex) || (!fw.isOnline);
      
      if (state.status === 'finished') {
         if (actionBay) actionBay.classList.add('hidden');
         btnStartGame.classList.add('hidden');
      } else if (state.phase === 'setup') {
         if (actionBay) actionBay.classList.add('hidden');
         btnStartGame.classList.toggle('hidden', fw.isOnline && !fw.isHost());
      } else {
         // Playing: Intel or Guessing
         if (actionBay) actionBay.classList.remove('hidden');
         btnStartGame.classList.add('hidden');

         if (state.phase === 'intel') {
            clueInputArea.classList.toggle('hidden', !isMyTurn);
            btnEndTurn.classList.add('hidden');
         } else if (state.phase === 'guessing') {
            clueInputArea.classList.add('hidden');
            btnEndTurn.classList.toggle('hidden', !isMyTurn);
         }
      }

      // 3. Render Log & Board
      renderLog(state, fw);
      renderBoard(state, fw);
    }
  }
});

// Expose globally
window.framework = framework;

function renderBoard(state, fw) {
  const boardEl = document.getElementById('board');
  if (!boardEl) return;
  boardEl.innerHTML = '';
  cellElements = [];

  // Intel Key Visibility
  let myIntelKey = null;
  const isFinished = state.status === 'finished' || state.revealAll;

  if (!isFinished) {
     if (fw.isOnline) {
        if (fw.mySlotIndex === 0) myIntelKey = state.p1Key;
        else if (fw.mySlotIndex === 1) myIntelKey = state.p2Key;
     } else {
        if (state.phase === 'intel') {
           myIntelKey = state.activeSlotIndex === 0 ? state.p1Key : state.p2Key;
        }
     }
  }

  for (let i = 0; i < 25; i++) {
    const word = state.words[i];
    const revealed = state.revealed[i];
    const isRevealed = revealed === 'green' || revealed === 'black' || revealed === 'bystander';

    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.innerText = word;

    if (isRevealed) {
      cardEl.classList.add('revealed', revealed);
    } else if (revealed && revealed.startsWith('bystander-')) {
      cardEl.classList.add('partial-bystander');
      const side = revealed.split('-')[1] === '0' ? 'p1' : 'p2';
      cardEl.innerHTML += `<div class="bystander-token ${side}"></div>`;
    }

    // Interaction
    const canClick = !isRevealed && revealed !== `bystander-${state.activeSlotIndex}`;
    if (canClick && state.status === 'playing' && state.phase === 'guessing') {
       cardEl.addEventListener('click', () => framework.handleAction({ type: 'card', index: i }));
    }

    // Intel Overlays
    if (state.status === 'playing' && myIntelKey) {
       const type = myIntelKey[i];
       if (type === 1) cardEl.classList.add('intel-green');
       else if (type === 2) cardEl.classList.add('intel-black');
    }

    // Game Over / Peek Reveal
    if (isFinished) {
       cardEl.classList.add('revealed', 'reveal-border-mode');
       const p1X = state.p1Key[i];
       const p2X = state.p2Key[i];
       const getCol = (t) => t === 1 ? '#10b981' : (t === 2 ? '#ef4444' : 'rgba(255,255,255,0.15)');
       cardEl.style.borderLeft = `6px solid ${getCol(p1X)}`;
       cardEl.style.borderRight = `6px solid ${getCol(p2X)}`;
    }

    boardEl.appendChild(cardEl);
  }
}

function renderLog(state, fw) {
  const clueLogEl = document.getElementById('clue-log');
  const logBadgeEl = document.getElementById('log-count-badge');
  if (logBadgeEl) {
    logBadgeEl.innerText = state.log ? state.log.length : 0;
  }
  if (!clueLogEl) return;
  clueLogEl.innerHTML = '';

  if (!state.log || state.log.length === 0) {
    clueLogEl.innerHTML = `
      <div style="text-align: center; color: var(--text-secondary); padding: 1.5rem 0; font-size: 0.9rem;">
        No intel clues logged yet.
      </div>
    `;
    return;
  }

  state.log.forEach(entry => {
    const el = document.createElement('div');
    el.className = `log-entry player${entry.player === 0 ? 1 : 2}-log`;
    const pName = state.slots[entry.player].name;
    
    let guessesHTML = '<div class="log-guesses">';
    entry.guesses.forEach(g => {
      let cls = 'guess-bystander';
      if (g.type === 'agent') cls = 'guess-agent';
      if (g.type === 'assassin') cls = 'guess-assassin';
      guessesHTML += `<div class="guess-pill ${cls}">${g.word}</div>`;
    });
    guessesHTML += '</div>';

    el.innerHTML = `
      <span class="log-player">SOURCE: ${pName}</span>
      <span class="log-clue">${entry.clue}</span>
      ${guessesHTML}
    `;
    clueLogEl.appendChild(el);
  });
  
  const modalBody = document.getElementById('clue-log-modal-body');
  if (modalBody) {
    modalBody.scrollTop = modalBody.scrollHeight;
  }
}

/**
 * Event Binding - Game Specific
 */
function setupUI() {
  const btnStartGame = document.getElementById('btn-start-game');
  const btnGiveClue = document.getElementById('btn-give-clue');
  const btnEndTurn = document.getElementById('btn-end-turn');
  const inputClueWord = document.getElementById('clue-word');
  const inputClueNum = document.getElementById('clue-num');

  const btnOpenLog = document.getElementById('btn-open-log');
  const btnCloseLog = document.getElementById('btn-close-log');
  const btnLogOk = document.getElementById('btn-log-modal-ok');
  const logModal = document.getElementById('duet-log-modal');

  if (btnOpenLog && logModal) {
    btnOpenLog.addEventListener('click', () => logModal.classList.remove('hidden'));
  }
  if (btnCloseLog && logModal) {
    btnCloseLog.addEventListener('click', () => logModal.classList.add('hidden'));
  }
  if (btnLogOk && logModal) {
    btnLogOk.addEventListener('click', () => logModal.classList.add('hidden'));
  }

  if (btnStartGame) btnStartGame.addEventListener('click', () => {
    framework.handleAction({ type: 'start' });
  });

  if (btnGiveClue) btnGiveClue.addEventListener('click', () => {
    const word = inputClueWord.value.trim();
    const num = parseInt(inputClueNum.value);
    if (!word || isNaN(num) || num < 1) return;
    framework.handleAction({ type: 'clue', word, num });
    inputClueWord.value = '';
    inputClueNum.value = '';
  });

  if (btnEndTurn) btnEndTurn.addEventListener('click', () => {
    framework.handleAction({ type: 'endTurn' });
  });
}

// Initialize
setupUI();
framework.init();
