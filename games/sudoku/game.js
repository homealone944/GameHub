/* games/sudoku/game.js */
import { GameFramework } from '../../js/game-framework.js';
import { SudokuEngine } from './engine.js';

// Setup Mock Lobby Data for Local Testbed when loading directly in browser
if (!window.currentLobbyData && (new URLSearchParams(window.location.search).has('debug') || true)) {
  console.log("🛠️ Sudoku: Mocking local session data");
  window.currentLobbyData = {
    id: 'LOCAL',
    name: 'Local Party',
    hostId: 'guest-1',
    players: [
      { id: 'guest-1', name: 'Player 1', icon: '👤' }
    ]
  };
  window.CLIENT_ID = 'guest-1';
}

// Global UI Settings
let selectedCellIndex = null;
let selectedNumber = 0; // Active number highlight when no cell is selected, or matching cell value
let notesMode = false;
let timerInterval = null;
let timerSeconds = 0;

// Initialize Timer Logic
function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerSeconds = 0;
  updateTimerUI();
  timerInterval = setInterval(() => {
    timerSeconds++;
    updateTimerUI();
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateTimerUI() {
  const timerEl = document.getElementById('stat-timer');
  if (!timerEl) return;
  const mins = Math.floor(timerSeconds / 60).toString().padStart(2, '0');
  const secs = (timerSeconds % 60).toString().padStart(2, '0');
  timerEl.innerText = `${mins}:${secs}`;
}

// Grid Creation Helper
function ensureGridCreated() {
  const grid = document.getElementById('sudoku-grid');
  if (!grid || grid.children.length === 81) return;

  grid.innerHTML = '';
  for (let i = 0; i < 81; i++) {
    const cell = document.createElement('div');
    cell.className = 'sudoku-cell';
    cell.dataset.index = i;

    // Borders for 3x3 boxes
    const row = Math.floor(i / 9);
    const col = i % 9;

    if (col === 2 || col === 5) {
      cell.classList.add('thick-right');
    }
    if (row === 2 || row === 5) {
      cell.classList.add('thick-bottom');
    }

    cell.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(cell.dataset.index);
      const state = framework.gameState;
      if (!state) return;

      if (selectedCellIndex === idx) {
        // If clicked again on an already selected user-entered number, clear it
        if (state.initialBoard[idx] === 0 && state.board[idx] !== 0) {
          framework.handleAction({ type: 'eraseCell', index: idx });
          selectedNumber = 0;
        } else {
          selectedCellIndex = null;
          selectedNumber = 0;
          renderGame();
        }
      } else if (selectedCellIndex === null && selectedNumber !== 0 && state.initialBoard[idx] === 0 && state.board[idx] === 0) {
        // Place the active selectedNumber in the empty cell (digit-first mode)
        if (notesMode) {
          framework.handleAction({
            type: 'toggleNoteValue',
            index: idx,
            val: selectedNumber
          });
        } else {
          framework.handleAction({
            type: 'setCellValue',
            index: idx,
            val: selectedNumber
          });
        }
      } else {
        selectedCellIndex = idx;
        selectedNumber = state.board[idx];
        renderGame();
      }
    });

    grid.appendChild(cell);
  }
}

// Handle Number/Pencil Entry
function applyNumberInput(val) {
  if (selectedCellIndex === null) return;
  
  const state = framework.gameState;
  if (!state || state.initialBoard[selectedCellIndex] !== 0) return; // Can't edit given clues

  if (notesMode) {
    framework.handleAction({
      type: 'toggleNoteValue',
      index: selectedCellIndex,
      val: val
    });
  } else {
    // If the cell already has this exact value, erase it (convenience toggle)
    if (state.board[selectedCellIndex] === val) {
      framework.handleAction({
        type: 'eraseCell',
        index: selectedCellIndex
      });
    } else {
      framework.handleAction({
        type: 'setCellValue',
        index: selectedCellIndex,
        val: val
      });
    }
  }
}

// Notes Mode Toggle
function toggleNotesMode() {
  notesMode = !notesMode;
  const btn = document.getElementById('btn-notes');
  const indicator = document.getElementById('notes-mode-indicator');
  if (!btn || !indicator) return;

  if (notesMode) {
    btn.classList.add('active');
    indicator.innerText = 'ON';
    indicator.className = '';
  } else {
    btn.classList.remove('active');
    indicator.innerText = 'OFF';
    indicator.className = 'badge-off';
  }
}

const framework = new GameFramework({
  gameId: 'sudoku',
  seating: {
    archetype: 'ffa',
    minPlayers: 1,
    maxPlayers: 1
  },
  engine: SudokuEngine,
  hasLobby: false,
  ui: {
    render: (state, fw) => {
      const setupScreen = document.getElementById('sudoku-setup-screen');
      const gameScreen = document.getElementById('sudoku-game-screen');
      if (!setupScreen || !gameScreen) return;

      // Toggle Screens
      if (state.phase === 'setup') {
        setupScreen.classList.remove('hidden');
        gameScreen.classList.add('hidden');
        stopTimer();
        selectedCellIndex = null;
        return;
      }

      setupScreen.classList.add('hidden');
      gameScreen.classList.remove('hidden');

      // Timer triggers
      if (state.status === 'playing') {
        if (!timerInterval) startTimer();
      } else {
        stopTimer();
      }

      // Update statistics
      const diffEl = document.getElementById('stat-difficulty');
      const mistakesEl = document.getElementById('stat-mistakes');
      if (diffEl) diffEl.innerText = state.difficulty;
      
      const trackMistakes = state.config && state.config.trackMistakes !== undefined ? state.config.trackMistakes : true;
      if (mistakesEl) {
        if (trackMistakes) {
          mistakesEl.parentElement.parentElement.style.display = 'flex';
          mistakesEl.innerText = `${state.mistakes}/${state.maxMistakes}`;
        } else {
          mistakesEl.parentElement.parentElement.style.display = 'none';
        }
      }

      // Build grid elements
      ensureGridCreated();

      // Sync selectedNumber with current cell value if a cell is selected
      if (selectedCellIndex !== null) {
        selectedNumber = state.board[selectedCellIndex];
      }

      // Render Board & highlights
      const cells = document.querySelectorAll('.sudoku-cell');

      // Highlight the matching number key on the keypad
      const keyBtns = document.querySelectorAll('.key-btn');
      keyBtns.forEach(btn => {
        const btnVal = parseInt(btn.dataset.val);
        if (selectedNumber !== 0 && btnVal === selectedNumber) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
      
      const sRow = selectedCellIndex !== null ? Math.floor(selectedCellIndex / 9) : -1;
      const sCol = selectedCellIndex !== null ? selectedCellIndex % 9 : -1;
      const sBox = selectedCellIndex !== null ? Math.floor(sRow / 3) * 3 + Math.floor(sCol / 3) : -1;

      for (let i = 0; i < 81; i++) {
        const cell = cells[i];
        const val = state.board[i];
        const initVal = state.initialBoard[i];
        const solVal = state.solution[i];
        
        const row = Math.floor(i / 9);
        const col = i % 9;

        // Reset class defaults
        cell.className = 'sudoku-cell';
        if (col === 2 || col === 5) cell.classList.add('thick-right');
        if (row === 2 || row === 5) cell.classList.add('thick-bottom');

        // Styles based on content source
        if (initVal !== 0) {
          cell.classList.add('given');
        } else if (val !== 0) {
          cell.classList.add('user-entered');
        }

        // Selected highlights
        if (selectedCellIndex === i) {
          cell.classList.add('selected');
        } else if (selectedCellIndex !== null) {
          // Crosshair Highlight
          const cBox = Math.floor(row / 3) * 3 + Math.floor(col / 3);
          if (row === sRow || col === sCol) {
            cell.classList.add('highlighted');
          }
          if (cBox === sBox) {
            cell.classList.add('box-highlighted');
          }
          // Same Number Highlights
          if (val !== 0 && val === selectedNumber) {
            cell.classList.add('same-number');
          }
        } else if (selectedNumber !== 0) {
          // Highlight same numbers even when no cell is selected (number filter mode)
          if (val !== 0 && val === selectedNumber) {
            cell.classList.add('same-number');
          }
        }

        // Conflict check (against solution)
        const isBoardFull = state.board.every(v => v !== 0);
        const shouldShowConflict = trackMistakes ? (initVal === 0 && val !== 0 && val !== solVal) : (isBoardFull && initVal === 0 && val !== 0 && val !== solVal);
        if (shouldShowConflict) {
          cell.classList.add('conflict');
        }

        // Set value or notes
        cell.innerHTML = '';
        if (val !== 0) {
          cell.innerText = val;
        } else {
          // Render Pencil Notes
          const cellNotes = state.notes[i] || [];
          if (cellNotes.length > 0) {
            const notesGrid = document.createElement('div');
            notesGrid.className = 'notes-grid';
            
            for (let num = 1; num <= 9; num++) {
              const noteEl = document.createElement('div');
              noteEl.className = 'note-digit';
              if (cellNotes.includes(num)) {
                noteEl.innerText = num;
              }
              notesGrid.appendChild(noteEl);
            }
            cell.appendChild(notesGrid);
          }
        }
      }
    }
  }
});

function renderGame() {
  if (framework && framework.gameState) {
    framework.ui.render(framework.gameState, framework);
  }
}

// Setup DOM Event Listeners
function setupUI() {
  // Start Button Click
  const btnStart = document.getElementById('btn-start-sudoku');
  if (btnStart) {
    btnStart.addEventListener('click', () => {
      const checkedInput = document.querySelector('input[name="difficulty"]:checked');
      const difficulty = checkedInput ? checkedInput.value : 'medium';
      
      framework.handleAction({
        type: 'startMatch',
        difficulty: difficulty
      });
    });
  }

  // Action Buttons
  const btnUndo = document.getElementById('btn-undo');
  if (btnUndo) {
    btnUndo.addEventListener('click', (e) => {
      e.stopPropagation();
      framework.handleAction({ type: 'undo' });
    });
  }

  const btnErase = document.getElementById('btn-erase');
  if (btnErase) {
    btnErase.addEventListener('click', (e) => {
      e.stopPropagation();
      if (selectedCellIndex !== null) {
        framework.handleAction({ type: 'eraseCell', index: selectedCellIndex });
      }
    });
  }

  const btnNotes = document.getElementById('btn-notes');
  if (btnNotes) {
    btnNotes.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleNotesMode();
    });
  }

  // Keypad Click Event Bindings
  const keys = document.querySelectorAll('.key-btn');
  keys.forEach(key => {
    key.addEventListener('click', (e) => {
      e.stopPropagation();
      const val = parseInt(key.dataset.val);
      if (selectedCellIndex === null) {
        // Toggle selected number highlight when no cell is selected
        selectedNumber = (selectedNumber === val) ? 0 : val;
        renderGame();
      } else {
        // Normal cell-first placement
        applyNumberInput(val);
      }
    });
  });

  // Click off-board deselects cell and active keypad number
  document.addEventListener('click', () => {
    if (selectedCellIndex !== null || selectedNumber !== 0) {
      selectedCellIndex = null;
      selectedNumber = 0;
      renderGame();
    }
  });

  // Keyboard navigation & inputs
  document.addEventListener('keydown', (e) => {
    const state = framework.gameState;
    if (!state || state.phase !== 'playing' || state.status !== 'playing') return;

    if (selectedCellIndex === null) return;

    // Undo via Ctrl+Z / Cmd+Z
    if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      framework.handleAction({ type: 'undo' });
      return;
    }

    // Pencil toggle: 'n'
    if (e.key.toLowerCase() === 'n') {
      e.preventDefault();
      toggleNotesMode();
      return;
    }

    // Number key inputs: 1 to 9
    if (e.key >= '1' && e.key <= '9') {
      const val = parseInt(e.key);
      applyNumberInput(val);
      return;
    }

    // Erase cell: Backspace, Delete or 0
    if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
      e.preventDefault();
      framework.handleAction({ type: 'eraseCell', index: selectedCellIndex });
      return;
    }

    // Keyboard Arrow Selection Navigation
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedCellIndex = Math.max(0, selectedCellIndex - 9);
      renderGame();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedCellIndex = Math.min(80, selectedCellIndex + 9);
      renderGame();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      selectedCellIndex = (selectedCellIndex % 9 === 0) ? selectedCellIndex : selectedCellIndex - 1;
      renderGame();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      selectedCellIndex = (selectedCellIndex % 9 === 8) ? selectedCellIndex : selectedCellIndex + 1;
      renderGame();
    }
  });
}

// Run binding setup
setupUI();

// Register framework globally & initialize
window.framework = framework;
framework.init();
