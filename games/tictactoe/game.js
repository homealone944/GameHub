/* games/tictactoe/game.js */
import { GameFramework } from '../../js/game-framework.js';
import { TicTacToeEngine } from './engine.js';

/**
 * Tic-Tac-Toe Drive Configuration
 * Note: Core UI components (Header, Status Bar, Bottom Sheet, Rules Modal)
 * are now centrally injected by lobby-shell.js and managed by GameFramework.
 */
const framework = new GameFramework({
  gameId: 'tictactoe',
  seating: {
    archetype: 'teams',
    minPlayers: 2,
    maxPlayers: 2,
    teams: [
      { id: 'x', name: 'Team X', min: 1, max: 1, color: 'Coral', symbol: 'X' },
      { id: 'o', name: 'Team O', min: 1, max: 1, color: 'Blue', symbol: 'O' }
    ]
  },
  engine: TicTacToeEngine,
  ui: {
    render: (state, fw) => {
      // DOM elements are within the #game-mount or provided by the shell
      const cells = document.querySelectorAll('.cell');
      const xColor = fw.getSlotColor(0);
      const oColor = fw.getSlotColor(1);

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
          cell.style.boxShadow = `0 0 20px ${val === 'X' ? xColor : oColor}44`;
        } else {
          cell.style.boxShadow = '';
        }
      }
    }
  },
  hasLobby: false
});

// Expose framework globally for inline event handlers
window.framework = framework;

/**
 * Event Binding - Specific to the game board
 */
function setupUI() {
  const cells = document.querySelectorAll('.cell');
  cells.forEach(cell => {
    cell.addEventListener('click', (e) => {
      framework.handleAction(parseInt(e.target.dataset.index));
    });
  });
}

// Start
setupUI();
framework.init();
