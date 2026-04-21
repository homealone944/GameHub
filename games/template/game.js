/* games/template/game.js */
import { GameFramework } from '../../js/game-framework.js';

/**
 * Dummy Engine for Testing Seating & UI
 */
class DummyEngine {
  constructor(state) {
    this.state = state;
  }
  static getInitialState(slots) {
    return {
      status: 'playing',
      activeSlotIndex: 0,
      slots: slots ? slots.map(s => ({ ...s, id: null, name: 'Waiting...' })) : []
    };
  }
  handleAction(state, action, slotIndex) {
    return state; // No-op for testing
  }
}

// 1. Setup Dummy Data for the Template Testbed
if (new URLSearchParams(window.location.search).has('debug') || true) {
  console.log("🛠️ Template: Mocking Lobby Data for Testing");
  window.currentLobbyData = {
    id: 'TEST',
    name: 'Debug Lobby',
    hostId: 'user-1',
    players: [
      { id: 'user-1', name: 'Risin', icon: '🧔' },
      { id: 'user-2', name: 'Alpha', icon: '🦊' },
      { id: 'user-3', name: 'Bravo', icon: '🐻' },
      { id: 'user-4', name: 'Charlie', icon: '🐱' },
      { id: 'user-5', name: 'Delta', icon: '🐶' },
      { id: 'user-6', name: 'Echo', icon: '🐘' },
      { id: 'user-7', name: 'Foxtrot', icon: '🦊' },
      { id: 'user-8', name: 'Golf', icon: '⛳' }
    ]
  };
  window.CLIENT_ID = 'user-1';
}

/**
 * Complex Seating Configuration for Framework Testing
 */
const framework = new GameFramework({
  gameId: 'template-test',
  seating: {
    archetype: 'teams',
    minPlayers: 2,
    maxPlayers: 10,
    teams: [
      { id: 'judge', name: 'The Judge', min: 1, max: 1, color: 'Coral' },
      { id: 'ffa', name: 'Competition Pool', min: 1, max: 5, color: 'Mint' }
    ]
  },
  engine: DummyEngine,
  ui: {
    render: (state, fw) => {
      // Background template UI
      const canvas = document.querySelector('.game-canvas');
      canvas.innerHTML = `
        <div style="text-align:center;">
          <p>Seating Stress Test Active</p>
          <p style="font-size:0.8rem; opacity:0.6;">Open 'Players' in bottom sheet to test dragging.</p>
        </div>
      `;
    }
  }
});

// Expose globally
window.framework = framework;

// Initialize
framework.init();

// Hook up Template UI
const sheet = document.getElementById('control-sheet');
const footerTrigger = document.getElementById('footer-trigger');
const overlay = document.getElementById('sheet-overlay');
const sheetHeader = document.getElementById('sheet-header-close');

function toggleSheet() {
  const isActive = sheet.classList.toggle('active');
  overlay.classList.toggle('hidden', !isActive);
}

footerTrigger.addEventListener('click', toggleSheet);
overlay.addEventListener('click', toggleSheet);
sheetHeader.addEventListener('click', toggleSheet);

document.getElementById('btn-players').addEventListener('click', () => {
    framework.openPlayersModal();
    toggleSheet();
});
