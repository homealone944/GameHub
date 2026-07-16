/* games/sudoku/engine.js */

// Helper: Shuffles an array in place
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Helper: Checks if a value can be placed in cell `idx` on a grid
function isValid(board, idx, val) {
  const row = Math.floor(idx / 9);
  const col = idx % 9;

  // Check row
  for (let c = 0; c < 9; c++) {
    if (board[row * 9 + c] === val) return false;
  }

  // Check col
  for (let r = 0; r < 9; r++) {
    if (board[r * 9 + col] === val) return false;
  }

  // Check 3x3 box
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (board[(boxRow + r) * 9 + (boxCol + c)] === val) return false;
    }
  }

  return true;
}

// Backtracking solver
function solve(board) {
  for (let i = 0; i < 81; i++) {
    if (board[i] === 0) {
      const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];
      shuffle(numbers); // Shuffle to generate a random board each run
      for (const num of numbers) {
        if (isValid(board, i, num)) {
          board[i] = num;
          if (solve(board)) return true;
          board[i] = 0;
        }
      }
      return false; // Backtrack
    }
  }
  return true;
}

// Generates starting grid and solution
function generateBoard(difficulty) {
  const board = Array(81).fill(0);

  // Fill diagonal boxes first to speed up the solver
  for (let box = 0; box < 9; box += 4) {
    const startRow = Math.floor(box / 3) * 3;
    const startCol = (box % 3) * 3;
    const numbers = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    let nIdx = 0;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        board[(startRow + r) * 9 + (startCol + c)] = numbers[nIdx++];
      }
    }
  }

  // Solve the rest to create a complete valid solution
  solve(board);
  const solution = [...board];

  // Set number of clues based on difficulty
  let removeCount = 43; // Easy: 38 clues
  if (difficulty === 'medium') removeCount = 51; // Medium: 30 clues
  else if (difficulty === 'hard') removeCount = 57; // Hard: 24 clues


  // Remove cells randomly
  const indices = shuffle(Array.from({ length: 81 }, (_, i) => i));
  for (let i = 0; i < removeCount; i++) {
    board[indices[i]] = 0;
  }

  return {
    initialBoard: [...board],
    solution: solution,
    board: [...board]
  };
}

export const SudokuEngine = {
  getInitialState: (config = {}) => {
    return {
      status: 'playing',
      phase: 'setup',
      difficulty: 'medium',
      initialBoard: Array(81).fill(0),
      solution: Array(81).fill(0),
      board: Array(81).fill(0),
      notes: Array(81).fill(null).map(() => []),
      mistakes: 0,
      maxMistakes: 3,
      history: [],
      activeSlotIndex: 0,
      slots: [
        { id: 'p1', name: 'Player 1', team: '_default' }
      ],
      statusText: "Choose a difficulty to start"
    };
  },

  applyMove: (state, action, slotIndex) => {
    if (state.status !== 'playing') return null;

    const newState = JSON.parse(JSON.stringify(state));

    // Handle Start Match
    if (action.type === 'startMatch') {
      const diff = action.difficulty || 'medium';
      const generated = generateBoard(diff);
      
      newState.phase = 'playing';
      newState.difficulty = diff;
      newState.initialBoard = generated.initialBoard;
      newState.solution = generated.solution;
      newState.board = generated.board;
      newState.notes = Array(81).fill(null).map(() => []);
      newState.mistakes = 0;
      newState.history = [];
      newState.statusText = "Puzzle is live!";
      return newState;
    }

    // Guard actions: only allowed during playing phase
    if (newState.phase !== 'playing') return null;

    // Handle Cell Value Update
    if (action.type === 'setCellValue') {
      const { index, val } = action;
      if (newState.initialBoard[index] !== 0) return null; // Cannot edit original clues

      // Record history for Undo
      newState.history.push({
        board: [...newState.board],
        notes: newState.notes.map(n => [...n])
      });

      // Caps history stack size
      if (newState.history.length > 100) {
        newState.history.shift();
      }

      newState.board[index] = val;
      newState.notes[index] = []; // Clear notes in the cell we just entered a value for

      // If value is incorrect (and not blank), increment mistakes (if enabled)
      const trackMistakes = newState.config && newState.config.trackMistakes !== undefined ? newState.config.trackMistakes : true;
      if (trackMistakes && val !== 0 && val !== newState.solution[index]) {
        newState.mistakes++;
      }

      return newState;
    }

    // Handle Note Toggling
    if (action.type === 'toggleNoteValue') {
      const { index, val } = action;
      if (newState.initialBoard[index] !== 0 || newState.board[index] !== 0) return null;

      newState.history.push({
        board: [...newState.board],
        notes: newState.notes.map(n => [...n])
      });

      const currentNotes = newState.notes[index] || [];
      if (currentNotes.includes(val)) {
        newState.notes[index] = currentNotes.filter(x => x !== val);
      } else {
        newState.notes[index] = [...currentNotes, val].sort((a, b) => a - b);
      }

      return newState;
    }

    // Handle Erase
    if (action.type === 'eraseCell') {
      const { index } = action;
      if (newState.initialBoard[index] !== 0) return null;

      newState.history.push({
        board: [...newState.board],
        notes: newState.notes.map(n => [...n])
      });

      newState.board[index] = 0;
      newState.notes[index] = [];

      return newState;
    }

    // Handle Undo
    if (action.type === 'undo') {
      if (newState.history.length === 0) return null;

      const previous = newState.history.pop();
      newState.board = previous.board;
      newState.notes = previous.notes;

      return newState;
    }

    return null;
  },

  checkGameOver: (state) => {
    if (state.phase !== 'playing') return null;

    const trackMistakes = state.config && state.config.trackMistakes !== undefined ? state.config.trackMistakes : true;

    // Check Defeat (too many mistakes, only if tracking is enabled)
    if (trackMistakes && state.mistakes >= state.maxMistakes) {
      return {
        winner: 'defeat',
        title: "DEFEAT",
        subtitle: "Too many mistakes! Game Over. ❌",
        glowColor: "rgba(239, 68, 68, 0.2)"
      };
    }

    // Check Victory (board matches solution)
    const isComplete = state.board.every((val, idx) => val === state.solution[idx]);
    if (isComplete) {
      return {
        winner: 0,
        title: "VICTORY",
        subtitle: "You solved the puzzle! 🏆",
        glowColor: "rgba(16, 185, 129, 0.2)"
      };
    }

    return null;
  },

  hasSettings: true,

  getSettingsHTML: (config = {}) => {
    const trackMistakes = config.trackMistakes !== undefined ? config.trackMistakes : true;
    return `
      <div class="fw-settings-group">
        <label class="fw-settings-label" style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; user-select: none;">
          <span>Keep Track of Mistakes</span>
          <input type="checkbox" name="trackMistakes" value="true" ${trackMistakes ? 'checked' : ''} style="width: 20px; height: 20px; cursor: pointer;">
        </label>
        <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.5rem; line-height: 1.3;">
          If enabled, incorrect entries will be pointed out in red immediately and count toward your 3 mistakes limit. If disabled, entries will not be checked until the grid is fully filled.
        </p>
      </div>
    `;
  },

  applySettings: (formData) => {
    const trackMistakes = formData.get('trackMistakes') === 'true';
    return { trackMistakes };
  },

  getRulesHTML: () => `
    <p>Sudoku is a logic-based number placement puzzle game.</p>
    <ul style="margin-top: 0.5rem; padding-left: 1rem;">
      <li>Place digits from 1 to 9 in the grid cells.</li>
      <li>Each number can only appear once in every row, once in every column, and once in every 3x3 sub-grid.</li>
      <li>Use <strong>Notes</strong> (or click 'N') to pencil in potential candidates.</li>
      <li>Be careful! Making 3 mistakes will end the puzzle.</li>
    </ul>
  `
};
