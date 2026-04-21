/* games/tictactoe/game.js */
import { GameFramework } from '../../js/game-framework.js';
import { TicTacToeEngine } from './engine.js';

// DOM Elements
const cells = document.querySelectorAll('.cell');
const sheet = document.getElementById('control-sheet');
const footerTrigger = document.getElementById('footer-trigger');
const overlay = document.getElementById('sheet-overlay');
const sheetHeader = document.getElementById('sheet-header-close');
const btnRules = document.getElementById('btn-rules');
const rulesModal = document.getElementById('rules-modal');
const btnCloseRules = document.getElementById('btn-close-rules');
const btnRulesOk = document.getElementById('btn-rules-ok');

/**
 * Tic-Tac-Toe Drive Configuration
 */
const framework = new GameFramework({
  gameId: 'tictactoe',
  confettiContinuous: false,
  slots: [
    { name: 'X', color: '#ef4444', team: 'Team X' },
    { name: 'O', color: '#10b981', team: 'Team O' }
  ],
  engine: TicTacToeEngine,
  ui: {
    render: (state, fw) => {
      // Import framework colors for dynamic tinting
      const { FRAMEWORK_COLORS } = Array.from(document.scripts).find(s => s.src.includes('game-framework')) ? { FRAMEWORK_COLORS: fw.constructor.FRAMEWORK_COLORS } : { FRAMEWORK_COLORS: [] };
      const getTeamHex = (slotIdx) => {
         const slotConfig = fw.slots[slotIdx];
         const teamKey = slotConfig.team || '_default';
         const teamState = (state.teams && state.teams[teamKey]) || { color: 'Neutral' };
         // Fallback to config color if dynamic team state isn't ready
         const colorName = teamState.color;
         const meta = (window.framework.constructor.FRAMEWORK_COLORS || []).find(c => c.name === colorName);
         return meta ? meta.value : slotConfig.color;
      };

      const xColor = getTeamHex(0);
      const oColor = getTeamHex(1);

      // Render Board Logic
      for (let i = 0; i < 9; i++) {
        const cell = cells[i];
        const val = state.board[i];
        cell.innerText = val || '';
        cell.className = 'cell';    
        cell.style.color = ''; // Reset

        if (val) {
          cell.classList.add('occupied', val === 'X' ? 'x-mark' : 'o-mark');
          cell.style.color = val === 'X' ? xColor : oColor;
        }
        
        if (state.winningLine && state.winningLine.includes(i)) {
          cell.classList.add('win-cell');
          // Add a glow in the winner's color
          cell.style.boxShadow = `0 0 20px ${val === 'X' ? xColor : oColor}44`;
        } else {
          cell.style.boxShadow = '';
        }
      }
    }
  }
});

// Expose framework globally for inline event handlers
window.framework = framework;

/**
 * Event Binding
 */
function setupUI() {
  // Cell Clicks
  cells.forEach(cell => {
    cell.addEventListener('click', (e) => {
      framework.handleAction(parseInt(e.target.dataset.index));
    });
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

  // Rules Modal
  if (btnRules && rulesModal) {
    btnRules.addEventListener('click', () => {
      rulesModal.classList.remove('hidden');
      toggleSheet();
    });
    btnCloseRules.addEventListener('click', () => rulesModal.classList.add('hidden'));
    btnRulesOk.addEventListener('click', () => rulesModal.classList.add('hidden'));
  }
}

// Start
setupUI();
framework.init();
