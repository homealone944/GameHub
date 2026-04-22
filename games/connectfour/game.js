/* games/connectfour/game.js */
import { GameFramework } from '../../js/game-framework.js';
import { ConnectFourEngine, ROWS, COLS } from './engine.js';

let cellElements = [];

/**
 * Connect Four Driver Configuration
 * Note: Core UI components (Header, Status Bar, Bottom Sheet, Rules Modal)
 * are now centrally injected by lobby-shell.js and managed by GameFramework.
 */
const framework = new GameFramework({
  gameId: 'connectfour',
  seating: {
    archetype: 'teams',
    minPlayers: 2,
    teams: [
      { id: 'red', name: 'Red Team', min: 1, max: 1, color: 'Coral', symbol: 'R' },
      { id: 'yellow', name: 'Yellow Team', min: 1, max: 1, color: 'Gold', symbol: 'Y' }
    ]
  },
  engine: ConnectFourEngine,
  ui: {
    render: (state, fw) => {
      const boardEl = document.getElementById('board');
      // Create board cells if they don't exist
      if (cellElements.length === 0) {
        boardEl.innerHTML = '';
        for (let i = 0; i < ROWS * COLS; i++) {
           const cell = document.createElement('div');
           cell.classList.add('c4-cell');
           boardEl.appendChild(cell);
           cellElements.push(cell);
        }
      }

      const redColor = fw.getSlotColor(0);
      const yellowColor = fw.getSlotColor(1);

      // Render Board State
      for (let i = 0; i < ROWS * COLS; i++) {
        const cell = cellElements[i];
        const val = state.board[i];

        cell.className = 'c4-cell';
        cell.style.background = ''; // Reset inline
        cell.style.boxShadow = '';  // Reset inline

        if (val === 'R') {
           cell.classList.add('red-disc');
           cell.style.background = `radial-gradient(circle at 30% 30%, ${redColor}, rgba(0,0,0,0.3))`;
           cell.style.boxShadow = `0 4px 10px ${redColor}66`;
        }
        if (val === 'Y') {
           cell.classList.add('yellow-disc');
           cell.style.background = `radial-gradient(circle at 30% 30%, ${yellowColor}, rgba(0,0,0,0.3))`;
           cell.style.boxShadow = `0 4px 10px ${yellowColor}66`;
        }

        if (state.winningLine && state.winningLine.includes(i)) {
          cell.classList.add('win-cell');
        }
      }
    }
  },
  hasLobby: false
});

// Expose globally for inline modal/helper handlers
window.framework = framework;

/**
 * Event Binding - Specific to the game board
 */
function setupUI() {
  const clickColumns = document.querySelectorAll('.click-col');
  
  // Column Clicks
  clickColumns.forEach(cc => {
    cc.addEventListener('click', (e) => {
      const col = parseInt(cc.dataset.col);
      framework.handleAction(col);
    });
  });

  // Keyboard Shortcuts (1-7)
  document.addEventListener('keydown', (e) => {
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
    const key = e.key;
    if (key >= '1' && key <= '7') {
      const colIndex = parseInt(key) - 1;
      framework.handleAction(colIndex);
    }
  });
}

// Start
setupUI();
framework.init();
