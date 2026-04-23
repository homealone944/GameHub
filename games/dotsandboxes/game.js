/* games/dotsandboxes/game.js */
import { GameFramework } from '../../js/game-framework.js';
import { DotsAndBoxesEngine } from './engine.js';

const framework = new GameFramework({
  gameId: 'dotsandboxes',
  seating: {
    archetype: 'ffa',
    minPlayers: 2,
    maxPlayers: 2
  },
  engine: DotsAndBoxesEngine,
  hasLobby: false,
  ui: {
    render: (state, fw) => {
      // Sync names from profile if it's the very first render and they are generic
      if (!fw.isOnline && state.slots && state.slots[0] && state.slots[0].name === 'Player 1') {
        const profile = JSON.parse(localStorage.getItem('gh_local_profile') || '{}');
        if (profile.name) state.slots[0].name = profile.name;
      }

      const scoreP1El = document.getElementById('score-p1');
      const scoreP2El = document.getElementById('score-p2');
      const labelP1El = document.getElementById('label-p1');
      const labelP2El = document.getElementById('label-p2');
      const turnInd = document.getElementById('turn-indicator');
      const boardEl = document.getElementById('board');

      // Update Scores, Colors & Labels
      const p1Color = fw.getSlotColor(0);
      const p2Color = fw.getSlotColor(1);

      if (scoreP1El) {
        scoreP1El.innerText = state.scores[0];
        scoreP1El.style.color = p1Color;
      }
      if (scoreP2El) {
        scoreP2El.innerText = state.scores[1];
        scoreP2El.style.color = p2Color;
      }

      //User Scores
      if (labelP1El && state.slots[0]) labelP1El.innerText = `${state.slots[0].name.toUpperCase()}`;
      if (labelP2El && state.slots[1]) labelP2El.innerText = `${state.slots[1].name.toUpperCase()}`;

      // Synchronize turn indicator color
      if (turnInd && state.status === 'playing') {
        turnInd.style.color = fw.getSlotColor(state.activeSlotIndex);
      }

      // Render Board
      if (boardEl) {
        renderBoard(state, fw);
      }
    }
  }
});

function renderBoard(state, fw) {
  const boardEl = document.getElementById('board');
  if (!boardEl) return;
  boardEl.innerHTML = '';
  
  const { rows, cols } = state;
  const p1Color = fw.getSlotColor(0);
  const p2Color = fw.getSlotColor(1);
  
  // Calculate dynamic dimensions to maximize space while ensuring visibility
  const maxW = Math.min(window.innerWidth - 100, 800); 
  const maxH = Math.min(window.innerHeight - 300, 800);
  
  const boxesX = cols - 1;
  const boxesY = rows - 1;
  const boxSize = Math.min(maxW / boxesX, maxH / boxesY); 
  
  const boardWidth = boxSize * boxesX;
  const boardHeight = boxSize * boxesY;
  
  boardEl.style.width = `${boardWidth}px`;
  boardEl.style.height = `${boardHeight}px`;
  boardEl.style.margin = '10px'; // Safety margin for edge dots/lines

  if(!window._dabResizeBound) {
    window.addEventListener('resize', () => {
       if (framework.gameState) renderBoard(framework.gameState, framework);
    });
    window._dabResizeBound = true;
  }
  
  const widthPercUnit = 100 / boxesX;
  const heightPercUnit = 100 / boxesY;
  
  // 1. Draw Boxes
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      let boxState = state.boxes[r][c];
      const box = document.createElement('div');
      box.className = 'dab-box';
      box.style.left = `${c * widthPercUnit}%`;
      box.style.top = `${r * heightPercUnit}%`;
      box.style.width = `calc(${widthPercUnit}% + 1px)`;
      box.style.height = `calc(${heightPercUnit}% + 1px)`;
      
      if (boxState !== null) {
        const color = boxState === 0 ? p1Color : p2Color;
        box.classList.add('captured');
        box.style.backgroundColor = `${color}44`; // 44 is hex alpha (approx 25%)
        box.style.setProperty('--box-color', color);
      }
      boardEl.appendChild(box);
    }
  }
  
  // 2. Draw Horizontal Lines
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols - 1; c++) {
      let lineState = state.hLines[r][c];
      const line = document.createElement('div');
      line.className = 'dab-line horizontal';
      line.style.left = `${c * widthPercUnit}%`;
      line.style.top = `${r * heightPercUnit}%`;
      line.style.width = `${widthPercUnit}%`;
      
      if (lineState !== null) {
        const color = lineState === 0 ? p1Color : p2Color;
        line.classList.add('claimed');
        line.style.backgroundColor = color;
        line.style.boxShadow = `0 0 8px ${color}`;
      } else if (state.status === 'playing') {
        line.addEventListener('click', () => {
           if ((fw.isOnline && fw.mySlotIndex === state.activeSlotIndex) || !fw.isOnline) {
              fw.handleAction({ type: 'h', r, c });
           }
        });
      }
      boardEl.appendChild(line);
    }
  }

  // 3. Draw Vertical Lines
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols; c++) {
      let lineState = state.vLines[r][c];
      const line = document.createElement('div');
      line.className = 'dab-line vertical';
      line.style.left = `${c * widthPercUnit}%`;
      line.style.top = `${r * heightPercUnit}%`;
      line.style.height = `${heightPercUnit}%`;
      
      if (lineState !== null) {
        const color = lineState === 0 ? p1Color : p2Color;
        line.classList.add('claimed');
        line.style.backgroundColor = color;
        line.style.boxShadow = `0 0 8px ${color}`;
      } else if (state.status === 'playing') {
        line.addEventListener('click', () => {
           if ((fw.isOnline && fw.mySlotIndex === state.activeSlotIndex) || !fw.isOnline) {
              fw.handleAction({ type: 'v', r, c });
           }
        });
      }
      boardEl.appendChild(line);
    }
  }

  // 4. Draw Dots (on top)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const dot = document.createElement('div');
      dot.className = 'dab-dot';
      dot.style.left = `${c * widthPercUnit}%`;
      dot.style.top = `${r * heightPercUnit}%`;
      boardEl.appendChild(dot);
    }
  }
}

framework.init();
