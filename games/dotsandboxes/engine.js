/* games/dotsandboxes/engine.js */

export const DotsAndBoxesEngine = {
  getInitialState: (config = {}) => {
    const cols = parseInt(config.cols) || 5;
    const rows = parseInt(config.rows) || 5;

    return {
      status: 'playing', // 'playing' or 'finished'
      phase: 'playing',
      activeSlotIndex: 0,
      winner: null,
      cols,
      rows,
      scores: [0, 0],
      hLines: Array(rows * (cols - 1)).fill(null), // null = empty, 0/1 = player index
      vLines: Array((rows - 1) * cols).fill(null),
      boxes: Array((rows - 1) * (cols - 1)).fill(null),
      lastScored: null, // used for extra turn logic
      statusText: "Player 1's Turn"
    };
  },

  applyMove: (state, action, slotIndex) => {
    if (state.status !== 'playing') return null;
    if (state.activeSlotIndex !== slotIndex) return null;

    const { type, r, c } = action;
    const { rows, cols } = state;
    const newState = JSON.parse(JSON.stringify(state));

    // Validate Move
    if (type === 'h') {
      if (r < 0 || r >= rows || c < 0 || c >= cols - 1) return null;
      const idx = r * (cols - 1) + c;
      if (newState.hLines[idx] !== null) return null;
      newState.hLines[idx] = slotIndex;
    } else if (type === 'v') {
      if (r < 0 || r >= rows - 1 || c < 0 || c >= cols) return null;
      const idx = r * cols + c;
      if (newState.vLines[idx] !== null) return null;
      newState.vLines[idx] = slotIndex;
    } else {
      return null;
    }

    // Check for newly completed boxes
    let boxesCaptured = 0;
    
    const checkBox = (row, col) => {
      if (row < 0 || row >= rows - 1 || col < 0 || col >= cols - 1) return false;
      const boxIdx = row * (cols - 1) + col;
      if (newState.boxes[boxIdx] !== null) return false;
      
      const top = newState.hLines[row * (cols - 1) + col];
      const bottom = newState.hLines[(row + 1) * (cols - 1) + col];
      const left = newState.vLines[row * cols + col];
      const right = newState.vLines[row * cols + col + 1];
      
      if (top !== null && bottom !== null && left !== null && right !== null) {
        newState.boxes[boxIdx] = slotIndex;
        return true;
      }
      return false;
    };

    if (type === 'h') {
      if (checkBox(r - 1, c)) boxesCaptured++;
      if (checkBox(r, c)) boxesCaptured++;
    } else {
      if (checkBox(r, c - 1)) boxesCaptured++;
      if (checkBox(r, c)) boxesCaptured++;
    }

    const activeName = (state.slots && state.slots[slotIndex]) ? state.slots[slotIndex].name : `Player ${slotIndex + 1}`;
    const nextSlotIndex = slotIndex === 0 ? 1 : 0;
    const nextName = (state.slots && state.slots[nextSlotIndex]) ? state.slots[nextSlotIndex].name : `Player ${nextSlotIndex + 1}`;

    if (boxesCaptured > 0) {
      newState.scores[slotIndex] += boxesCaptured;
      newState.statusText = `${activeName} scored! Extra turn.`;
      // Player keeps turn
    } else {
      newState.activeSlotIndex = nextSlotIndex;
      newState.statusText = `${nextName}'s turn`;
    }

    // Check Win Condition
    let totalBoxes = (rows - 1) * (cols - 1);
    let filledBoxes = 0;
    newState.boxes.forEach(box => { if (box !== null) filledBoxes++; });

    if (filledBoxes === totalBoxes) {
      newState.status = 'finished';
      if (newState.scores[0] > newState.scores[1]) newState.winner = 0;
      else if (newState.scores[1] > newState.scores[0]) newState.winner = 1;
      else newState.winner = 'draw';
      
      newState.statusText = "Game Over!";
    }

    return newState;
  },

  checkGameOver: (state, activeSlotIndex, mySlotIndex, isOnline) => {
    if (state.status === 'finished') {
       if (state.winner === 'draw') {
          return {
             winner: 'draw',
             title: "IT'S A DRAW!",
             subtitle: "Both players were perfectly matched. 🤝"
          };
       }
       
       let title = "GAME OVER";
       let subtitle = `Final Score: ${state.scores[0]} - ${state.scores[1]}`;
       
       if (isOnline && mySlotIndex !== null) {
          if (mySlotIndex === state.winner) {
             title = "VICTORY";
             subtitle = `You won! Final Score: ${state.scores[0]} - ${state.scores[1]} 🏆`;
          } else {
             const winnerName = state.slots ? state.slots[state.winner].name : `Player ${state.winner + 1}`;
             title = "DEFEAT";
             subtitle = `${winnerName} won! Final Score: ${state.scores[0]} - ${state.scores[1]}`;
          }
       } else {
          const winnerName = state.slots ? state.slots[state.winner].name : `Player ${state.winner + 1}`;
          title = "GAME OVER";
          subtitle = `${winnerName} WON! Final Score: ${state.scores[0]} - ${state.scores[1]}`;
       }
       
       return {
         winner: state.winner,
         title,
         subtitle
       };
    }
    return null;
  },

  getRulesHTML: () => `
    <p>Dots and Boxes is a classic strategy game for two players.</p>
    <ul style="margin-top: 0.5rem; padding-left: 1rem;">
      <li>Players take turns drawing a single line between two unjoined dots.</li>
      <li>If a player completes a box, they earn one point and must take another turn.</li>
      <li>The player who completes the most boxes wins the game.</li>
    </ul>
  `,

  getSettingsHTML: (config = {}) => {
    const size = config.cols || 5; // Default to 5 if not set
    return `
      <div class="fw-settings-group">
        <label class="fw-settings-label">Grid Size: <span id="val-grid-size" style="color: var(--accent-mint); font-weight: 800;">${size}</span></label>
        <div style="margin-top: 1rem;">
          <input type="range" name="size" value="${size}" min="3" max="10" step="1" 
                 class="fw-settings-input" style="width: 100%; cursor: pointer;"
                 oninput="document.getElementById('val-grid-size').innerText = this.value">
        </div>
        <p style="font-size: 0.7rem; color: var(--accent-coral); margin-top: 0.5rem; opacity: 0.8;">Changing size will reset the match.</p>
      </div>
    `;
  },

  applySettings: (formData) => {
    const size = parseInt(formData.get('size')) || 5;
    return { cols: size, rows: size };
  }
};
