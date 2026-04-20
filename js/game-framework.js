/* js/game-framework.js */
import { subscribeToLobby, updateGameState } from './database-manager.js';

export const FRAMEWORK_COLORS = [
  { name: 'Neutral', value: 'rgba(255,255,255,0.2)', text: '#fff' },
  { name: 'Coral', value: '#ff6b6b', text: '#fff' },
  { name: 'Mint', value: '#4ecdc4', text: '#1e1e1e' },
  { name: 'Blue', value: '#45b7d1', text: '#fff' },
  { name: 'Gold', value: '#f9ca24', text: '#1e1e1e' },
  { name: 'Purple', value: '#a29bfe', text: '#fff' },
  { name: 'Pink', value: '#fd79a8', text: '#fff' }
];

/**
 * GameFramework handles the plumbing for turn-based games:
 * - Mode detection (Local vs Online)
 * - Network synchronization via Firebase
 * - Seating & Team management (via Modal)
 * - Spectator tracking
 * - Game Over / Victory sequences
 */
export class GameFramework {
  constructor(config) {
    this.gameId = config.gameId;
    this.slots = config.slots; // e.g. [{ name: 'X', team: 'Blue' }]
    this.engine = config.engine;
    this.ui = config.ui;
    this.passThePhone = config.passThePhone || false;

    // Internal State
    this.isOnline = false;
    this.lobbyId = null;
    this.gameState = null;
    this.mySlotIndex = null;
    this.editingTeamKey = null; // UI state for the Host
    
    // UI References
    this.dom = {
      turnIndicator: document.getElementById('turn-indicator'),
      selfRoleBadge: document.getElementById('self-role-badge'),
      rematchBtn: document.getElementById('btn-rematch'),
      passDeviceOverlay: null,
      playersModal: null,
      gameOverOverlay: null
    };
  }

  async init() {
    this.injectFrameworkComponents();
    const urlParams = new URLSearchParams(window.location.search);
    this.isOnline = urlParams.get('mode') === 'online';
    this.lobbyId = urlParams.get('lobby');

    this.setupFrameworkListeners();

    if (this.isOnline && this.lobbyId) {
      this.initNetworkSync();
    } else {
      this.resetLocalGame();
    }
  }

  injectFrameworkComponents() {
    // Expose for inline handlers
    window.framework = this;

    // 1. Pass the Phone Overlay
    if (this.passThePhone) {
      const passHTML = `
        <div id="fw-pass-device-overlay" class="hidden" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.95); z-index:9999; display:flex; flex-direction:column; align-items:center; justify-content:center; color:white; text-align:center;">
          <h1 id="fw-pass-title" style="margin-bottom:1rem; font-size:2rem; font-weight:900;">PASS DEVICE</h1>
          <p id="fw-pass-msg" style="margin-bottom:2rem; color:var(--text-secondary);">Hand the device to <span id="fw-next-player-name" style="color:white; font-weight:bold;">Player 2</span></p>
          <div id="fw-pass-context" class="hidden" style="margin-bottom: 2.5rem; background: rgba(255,255,255,0.05); padding: 1.5rem 2rem; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); width: 100%; max-width: 400px; font-size: 1.1rem;"></div>
          <button id="fw-btn-ready" class="btn btn-mint" style="padding: 1rem 3rem; font-size: 1.2rem;">I AM READY</button>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', passHTML);
      this.dom.passDeviceOverlay = document.getElementById('fw-pass-device-overlay');
      document.getElementById('fw-btn-ready').addEventListener('click', () => this.dom.passDeviceOverlay.classList.add('hidden'));
    }

    // 2. Players Modal
    const modalHTML = `
      <div id="fw-players-modal" class="modal hidden" style="z-index: 10000;">
        <div class="modal-content" style="max-height: 85vh; overflow-y: auto;">
          <h2 class="text-gradient">Players & Teams</h2>
          <button class="btn-close" id="fw-players-close">&times;</button>
          
          <div id="fw-teams-container" style="margin-top: 1.5rem; text-align: left;">
            <!-- Sorted Slots & Team Headers here -->
          </div>

          <div id="fw-spectators-container" style="margin-top: 2rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 1rem; text-align: left;">
             <label style="color: var(--text-secondary); font-size: 0.7rem; font-weight: 800; letter-spacing: 1px; text-transform: uppercase;">Spectators</label>
             <div id="fw-spectators-list" style="margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.5rem;"></div>
          </div>
          
          <button id="fw-players-ok" class="btn btn-mint mt-2 w-100">Done</button>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.dom.playersModal = document.getElementById('fw-players-modal');
    document.getElementById('fw-players-close').addEventListener('click', () => this.closePlayersModal());
    document.getElementById('fw-players-ok').addEventListener('click', () => this.closePlayersModal());

    // 3. Game Over Overlay
    const gameOverHTML = `
      <div id="fw-gameover-overlay">
        <div class="fw-victory-glow" id="fw-glow"></div>
        <div class="fw-gameover-content">
          <h1 id="fw-gameover-title" class="fw-gameover-title text-gradient">VICTORY</h1>
          <p id="fw-winner-name" class="fw-winner-name">Player 1 wins the match!</p>
          
          <div class="fw-gameover-actions">
            <button id="fw-btn-rematch-hero" class="btn btn-mint w-100" style="padding: 1rem;">Rematch</button>
            <button id="fw-btn-return-hub" class="btn btn-secondary w-100">Return to Hub</button>
          </div>
        </div>
        <div id="fw-confetti-container" style="position:fixed; top:0; left:0; width:100%; height:100%; pointer-events:none;"></div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', gameOverHTML);
    this.dom.gameOverOverlay = document.getElementById('fw-gameover-overlay');
    this.dom.spectatorContainer = document.getElementById('fw-spectators-container');
    
    document.getElementById('fw-btn-rematch-hero').addEventListener('click', () => {
      if (this.isOnline) {
        if (this.isHost()) this.resetOnlineGame();
        else if (window.Notify) window.Notify.toast("Waiting for Host to restart...");
      } else {
        this.resetLocalGame();
      }
    });

    document.getElementById('fw-btn-return-hub').addEventListener('click', () => {
      if (this.isOnline) {
        if (this.isHost()) {
           // Synchronize navigation for everyone
           const newState = { ...this.gameState, status: 'hub' };
           this.commit(newState);
        } else {
            if (window.Notify) window.Notify.toast("Waiting for Host to return to Hub...");
        }
      } else {
         window.location.href = '../../index.html';
      }
    });
  }

  setupFrameworkListeners() {
    if (this.dom.rematchBtn) {
       this.dom.rematchBtn.addEventListener('click', () => {
         if (this.isOnline) {
           if (this.isHost()) this.resetOnlineGame();
           else if (window.Notify) window.Notify.toast("Waiting for Host to restart...");
         } else {
           this.resetLocalGame();
         }
       });
    }

    const btnPlayers = document.getElementById('btn-players');
    if (btnPlayers) {
      btnPlayers.addEventListener('click', () => this.openPlayersModal());
    }
  }

  /**
   * --- PLAYERS MODAL ---
   */
  openPlayersModal() {
    this.renderSeatingUI();
    this.dom.playersModal.classList.remove('hidden');
  }

  closePlayersModal() {
    this.dom.playersModal.classList.add('hidden');
    this.editingTeamKey = null;
  }

  renderSeatingUI() {
    const list = document.getElementById('fw-teams-container');
    list.innerHTML = '';
    if (!this.gameState) return;

    const isHost = this.isHost();
    const lobbyPlayers = (window.currentLobbyData && window.currentLobbyData.players) || [];

    // Hide spectators in local mode
    if (this.dom.spectatorContainer) {
       this.dom.spectatorContainer.classList.toggle('hidden', !this.isOnline);
    }

    const teamMap = {};
    this.slots.forEach((slot, i) => {
      const teamKey = slot.team || '_default';
      if (!teamMap[teamKey]) teamMap[teamKey] = [];
      teamMap[teamKey].push({ config: slot, index: i });
    });

    Object.keys(teamMap).forEach(teamKey => {
       const teamState = (this.gameState.teams && this.gameState.teams[teamKey]) || { name: teamKey === '_default' ? 'Players' : teamKey, color: 'Neutral' };
       const colorMeta = FRAMEWORK_COLORS.find(c => c.name === teamState.color) || FRAMEWORK_COLORS[0];

       const header = document.createElement('div');
       header.className = 'fw-team-header';
       header.style = `display: flex; justify-content: space-between; align-items: center; border-left: 4px solid ${colorMeta.value}; padding-left: 10px; margin-bottom: 1rem;`;
       
       if (this.editingTeamKey === teamKey && isHost) {
          header.innerHTML = `
            <div style="flex: 1; display: flex; flex-direction: column; gap: 8px;">
               <input type="text" id="fw-edit-team-name" value="${teamState.name}" style="background: var(--bg-card); color: white; border: 1px solid var(--accent-mint); padding: 4px 8px; border-radius: 4px; font-size: 0.9rem;">
               <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                  ${FRAMEWORK_COLORS.map(c => `<div class="fw-color-bubble" data-color="${c.name}" style="background: ${c.value}; width: 20px; height: 20px; border-radius: 50%; cursor: pointer; border: 2px solid ${teamState.color === c.name ? 'white' : 'transparent'};"></div>`).join('')}
               </div>
            </div>
            <button id="fw-save-team" class="btn btn-sm btn-mint" style="margin-left: 10px;">Save</button>
          `;
          header.querySelectorAll('.fw-color-bubble').forEach(b => {
             b.onclick = (e) => {
                this.updateTeamUI(teamKey, document.getElementById('fw-edit-team-name').value, e.target.dataset.color);
             };
          });
          header.querySelector('#fw-save-team').onclick = () => {
             const newName = document.getElementById('fw-edit-team-name').value;
             this.commitTeamChange(teamKey, newName, teamState.color);
             this.editingTeamKey = null;
             this.renderSeatingUI();
          };
       } else {
          header.innerHTML = `
            <span style="font-weight: 800; font-size: 0.8rem; text-transform: uppercase;">${teamState.name}</span>
            ${isHost && teamKey !== '_default' ? `<button class="btn btn-sm" style="background: none; border: none; padding: 0;" onclick="window.framework.editingTeamKey = '${teamKey}'; window.framework.renderSeatingUI();">⚙️</button>` : ''}
          `;
       }
       list.appendChild(header);

       teamMap[teamKey].forEach(item => {
          const slotIndex = item.index;
          const currentSlotData = this.gameState.slots[slotIndex];
          const slotDiv = document.createElement('div');
          slotDiv.className = 'seat-slot';
          slotDiv.style.marginBottom = '1.25rem';
          
          let html = ``; // Removed redundant label
          
          if (this.isOnline) {
            if (isHost) {
              html += `<select class="seat-select w-100 mt-05">`;
              html += `<option value="" ${!currentSlotData.id ? 'selected' : ''} disabled>Select Player...</option>`;
              lobbyPlayers.forEach(p => {
                html += `<option value="${p.id}" ${p.id === currentSlotData.id ? 'selected' : ''}>${p.name}${p.id === window.CLIENT_ID ? ' (You)' : ''}</option>`;
              });
              html += `</select>`;
              slotDiv.innerHTML = html;
              slotDiv.querySelector('select').addEventListener('change', (e) => this.assignSeat(slotIndex, e.target.value));
            } else {
              const name = currentSlotData.name || 'Waiting...';
              html += `<div style="padding: 0.75rem; background: rgba(255,255,255,0.05); border-radius: 8px; color: white; font-weight: 600; margin-top: 4px;">${name}</div>`;
              slotDiv.innerHTML = html;
            }
          } else {
            html += `<input type="text" class="w-100 mt-05" style="padding: 0.75rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); background: var(--bg-card); color: white;" value="${currentSlotData.name || ''}" placeholder="Name">`;
            slotDiv.innerHTML = html;
            slotDiv.querySelector('input').addEventListener('input', (e) => this.renameLocalSlot(slotIndex, e.target.value));
          }
          list.appendChild(slotDiv);
       });
    });

    this.renderSpectators(lobbyPlayers);
  }

  renderSpectators(allPlayers) {
    const specList = document.getElementById('fw-spectators-list');
    specList.innerHTML = '';
    const assignedIds = this.gameState.slots.map(s => s.id).filter(id => id !== null);
    const spectators = allPlayers.filter(p => !assignedIds.includes(p.id));
    if (spectators.length === 0) {
      specList.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.8rem; font-style: italic;">No spectators currently.</p>';
      return;
    }
    spectators.forEach(p => {
       const div = document.createElement('div');
       div.style = "padding: 0.6rem 0.8rem; background: rgba(255,255,255,0.03); border-radius: 6px; font-size: 0.9rem; color: var(--text-secondary); display: flex; align-items: center; gap: 8px;";
       div.innerHTML = `<span>👤</span> <span>${p.name}${p.id === window.CLIENT_ID ? ' (You)' : ''}</span>`;
       specList.appendChild(div);
    });
  }

  updateTeamUI(key, tempName, tempColorName) {
     const teamState = { ...this.gameState.teams[key], name: tempName, color: tempColorName };
     this.gameState.teams[key] = teamState;
     this.renderSeatingUI();
     if (this.gameState.status === 'finished') this.renderFrameworkUI();
  }

  async commitTeamChange(key, newName, newColorName) {
     const newState = { ...this.gameState };
     if (!newState.teams) newState.teams = {};
     newState.teams[key] = { name: newName, color: newColorName };
     await this.commit(newState);
  }

  renameLocalSlot(index, newName) {
    if (!newName.trim()) return;
    this.gameState.slots[index].name = newName;
    this.renderFrameworkUI();
    this.ui.render(this.gameState, this);
  }

  initNetworkSync() {
    this.unsubscribe = subscribeToLobby(this.lobbyId, (data) => {
      if (!data) return;
      window.currentLobbyData = data;
      if (!data.gameState || !data.gameState.status) {
        if (this.isHost()) this.initServerState(data);
        return;
      }
      this.gameState = data.gameState;
      this.updateMySlot(data);
      this.renderFrameworkUI();
      this.ui.render(this.gameState, this);
      if (!this.dom.playersModal.classList.contains('hidden')) this.renderSeatingUI();
      
      if (this.dom.rematchBtn) {
         if (this.isHost()) this.dom.rematchBtn.classList.remove('hidden-host-only');
         else this.dom.rematchBtn.classList.add('hidden-host-only');
      }
    });
  }

  initServerState(lobbyData) {
    const state = this.engine.getInitialState();
    state.teams = {};
    const uniqueTeams = [...new Set(this.slots.map(s => s.team).filter(Boolean))];
    uniqueTeams.forEach(t => {
       state.teams[t] = { name: t, color: 'Neutral' };
    });
    state.slots = this.slots.map((s, i) => {
       const p = lobbyData.players[i] || { id: null, name: 'Waiting...' };
       return { id: p.id, name: p.name };
    });
    state.status = 'playing';
    state.activeSlotIndex = 0;
    this.commit(state);
  }

  updateMySlot(data) {
    this.mySlotIndex = null;
    this.gameState.slots.forEach((slot, i) => {
      if (slot.id === window.CLIENT_ID) this.mySlotIndex = i;
    });
  }

  isHost() {
    return window.currentLobbyData && window.currentLobbyData.hostId === window.CLIENT_ID;
  }

  async handleAction(action) {
    if (this.gameState.status === 'finished') return;
    if (this.isOnline) {
       if (this.mySlotIndex !== this.gameState.activeSlotIndex) {
          const expected = this.slots[this.gameState.activeSlotIndex].name;
          if (window.Notify) window.Notify.toast(`It's not your turn! Waiting for ${expected}.`);
          return;
       }
    }
    const newState = this.engine.applyMove(this.gameState, action, this.gameState.activeSlotIndex);
    if (!newState) return;
    const gameOver = this.engine.checkGameOver(newState, this.gameState.activeSlotIndex);
    if (gameOver) {
       newState.status = 'finished';
       newState.winner = gameOver.winner;
       newState.winningLine = gameOver.winningLine;
    } else {
       const oldSlot = this.gameState.activeSlotIndex;
       const newSlot = newState.activeSlotIndex;
       
       if (!this.isOnline && this.passThePhone && newSlot !== oldSlot) {
          const nextName = this.slots[newSlot].name;
          document.getElementById('fw-next-player-name').innerText = nextName;
          
          // Populate generic context info
          const contextEl = document.getElementById('fw-pass-context');
          if (contextEl && this.ui.getBlockerInfo) {
             const info = this.ui.getBlockerInfo(newState);
             if (info) {
                contextEl.innerHTML = info;
                contextEl.classList.remove('hidden');
             } else {
                contextEl.classList.add('hidden');
             }
          } else if (contextEl) {
             contextEl.classList.add('hidden');
          }
          this.dom.passDeviceOverlay.classList.remove('hidden');
       }
    }
    if (this.isOnline) await this.commit(newState);
    else {
       this.gameState = newState;
       this.renderFrameworkUI();
       this.ui.render(this.gameState, this);
    }
  }

  async commit(state) {
    this.gameState = state;
    await updateGameState(this.lobbyId, state);
  }

  resetLocalGame() {
    this.gameState = this.engine.getInitialState();
    this.gameState.slots = this.slots.map(s => ({ id: null, name: s.name }));
    this.gameState.status = 'playing';
    this.gameState.activeSlotIndex = 0;
    if (this.dom.gameOverOverlay) this.dom.gameOverOverlay.classList.remove('visible');
    const confettiContainer = document.getElementById('fw-confetti-container');
    if (confettiContainer) confettiContainer.innerHTML = '';
    this.renderFrameworkUI();
    this.ui.render(this.gameState, this);
  }

  resetOnlineGame() {
    const newState = this.engine.getInitialState();
    newState.slots = this.gameState.slots; 
    newState.teams = this.gameState.teams; 
    newState.status = 'playing';
    newState.activeSlotIndex = 0;
    if (this.dom.gameOverOverlay) this.dom.gameOverOverlay.classList.remove('visible');
    const confettiContainer = document.getElementById('fw-confetti-container');
    if (confettiContainer) confettiContainer.innerHTML = '';
    this.commit(newState);
  }

  async assignSeat(slotIndex, playerId) {
    const players = window.currentLobbyData.players;
    const player = players.find(p => p.id === playerId);
    if (!player) return;
    const newState = { ...this.gameState };
    newState.slots[slotIndex] = { id: playerId, name: player.name };
    const fresh = this.engine.getInitialState();
    Object.assign(newState, fresh);
    newState.status = 'playing';
    newState.activeSlotIndex = 0;
    await this.commit(newState);
  }

  renderFrameworkUI() {
    if (!this.gameState) return;

    // Synced Hub Navigation (with Guard to prevent multiple redirect attempts)
    if (this.gameState.status === 'hub') {
       if (this._isRedirecting) return;
       this._isRedirecting = true;
       
       // Formal teardown: stop listening to state updates before we leave
       if (this.unsubscribe) {
          this.unsubscribe();
          this.unsubscribe = null;
       }
       
       // Micro-delay to let the browser settle before the hard replace
       setTimeout(() => {
          const target = '../../index.html' + (this.lobbyId ? `?lobby=${this.lobbyId}` : '');
          window.location.replace(target);
       }, 10);
       return;
    }

    if (this.dom.selfRoleBadge) {
       if (this.isOnline) {
          if (this.mySlotIndex !== null) {
             const slotMeta = this.slots[this.mySlotIndex];
             this.dom.selfRoleBadge.innerText = `PLAYING AS ${slotMeta.name}`;
             this.dom.selfRoleBadge.className = `role-badge playing-slot-${this.mySlotIndex}`;
          } else {
             this.dom.selfRoleBadge.innerText = "SPECTATING";
             this.dom.selfRoleBadge.className = "role-badge spectating";
          }
       } else {
          this.dom.selfRoleBadge.innerText = "LOCAL MODE";
          this.dom.selfRoleBadge.className = "role-badge spectating";
       }
    }

    if (this.dom.turnIndicator) {
       if (this.gameState.status === 'finished') {
          if (this.gameState.winner === 'draw') {
             this.dom.turnIndicator.innerText = "It's a Draw! 🤝";
             this.showGameOver('draw');
          } else if (this.gameState.winner === 'defeat') {
             this.dom.turnIndicator.innerText = "Mission Failed! ❌";
             this.showGameOver('defeat');
          } else {
             // Support single index or array of indices
             const winners = Array.isArray(this.gameState.winner) ? this.gameState.winner : [this.gameState.winner];
             
             // Get color of first winner for the text
             const slotMeta = this.slots[winners[0]];
             const teamKey = slotMeta.team || '_default';
             const teamState = (this.gameState.teams && this.gameState.teams[teamKey]) || { color: 'Neutral' };
             const colorMeta = FRAMEWORK_COLORS.find(c => c.name === teamState.color) || FRAMEWORK_COLORS[0];

             if (winners.length === 1 && winners[0] === this.mySlotIndex) {
                 this.dom.turnIndicator.innerText = `You Win! 🎉`;
             } else {
                 const winnerNames = winners.map(idx => this.gameState.slots[idx].name).join(' & ');
                 this.dom.turnIndicator.innerHTML = `<span style="color: ${colorMeta.value}; font-weight: 800;">${winnerNames}</span> Wins! 🎉`;
             }
             
             this.showGameOver(winners[0]); 
          }
       } else {
          const activeName = this.gameState.slots[this.gameState.activeSlotIndex].name;
          if (this.isOnline && activeName === 'Waiting...') {
             this.dom.turnIndicator.innerText = "Assign Players to Start";
          } else {
             const isMyTurn = (this.mySlotIndex === this.gameState.activeSlotIndex);
             this.dom.turnIndicator.innerText = isMyTurn ? "Your Turn" : `${activeName}'s Turn`;
          }
          
          // Dismiss overlay and clear confetti if game has been reset
          if (this.dom.gameOverOverlay && this.dom.gameOverOverlay.classList.contains('visible')) {
             this.dom.gameOverOverlay.classList.remove('visible');
             const confettiContainer = document.getElementById('fw-confetti-container');
             if (confettiContainer) confettiContainer.innerHTML = '';
          }
       }
    }
  }

  showGameOver(winnerIndex) {
    if (!this.dom.gameOverOverlay) return;
    const title = document.getElementById('fw-gameover-title');
    const subtitle = document.getElementById('fw-winner-name');
    const glow = document.getElementById('fw-glow');
    
    if (winnerIndex === 'draw') {
       title.innerText = "IT'S A DRAW";
       subtitle.innerText = "A perfectly balanced match! 🤝";
       glow.style.background = `radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)`;
    } else if (winnerIndex === 'defeat') {
       title.innerText = "DEFEAT";
       subtitle.innerText = "The mission was compromised. 💀";
       glow.style.background = `radial-gradient(circle, rgba(255, 107, 107, 0.1) 0%, transparent 70%)`;
    } else {
       const winnerName = this.gameState.slots[winnerIndex].name;
       const slotMeta = this.slots[winnerIndex];
       
       // Determine personalization
       const isMyWin = (this.mySlotIndex === winnerIndex) || 
                       (this.mySlotIndex !== null && this.slots[this.mySlotIndex].team && this.slots[this.mySlotIndex].team === slotMeta.team);

       if (this.mySlotIndex === null) {
          title.innerText = "GAME OVER";
       } else {
          title.innerText = isMyWin ? "VICTORY" : "DEFEAT";
       }

       const teamKey = slotMeta.team || '_default';
       const teamState = (this.gameState.teams && this.gameState.teams[teamKey]) || { name: 'Players', color: 'Neutral' };
       const colorMeta = FRAMEWORK_COLORS.find(c => c.name === teamState.color) || FRAMEWORK_COLORS[0];

       if (this.mySlotIndex === winnerIndex) {
         subtitle.innerHTML = `You won the match! 🏆`;
       } else {
         subtitle.innerHTML = `<span style="color: ${colorMeta.value}; font-weight: 800;">${winnerName}</span> wins the match!`;
       }

       glow.style.background = `radial-gradient(circle, ${colorMeta.value}26 0%, transparent 70%)`;
       
       if (isMyWin || this.mySlotIndex === null) {
         this.triggerConfetti(colorMeta.value);
       }
    }
    
    this.dom.gameOverOverlay.classList.add('visible');
  }

  triggerConfetti(color) {
    const container = document.getElementById('fw-confetti-container');
    container.innerHTML = '';
    const particleCount = 36; // Optimized count
    
    for (let i = 0; i < particleCount; i++) {
       const confetti = document.createElement('div');
       confetti.className = 'fw-confetti';
       confetti.style.left = (Math.random() * 100) + 'vw';
       confetti.style.backgroundColor = color === 'rgba(255,255,255,0.2)' ? (['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24'][Math.floor(Math.random() * 4)]) : color;
       
       // Set X drift via CSS variable
       const xDrift = (Math.random() - 0.5) * 200; // -100px to +100px
       confetti.style.setProperty('--fw-confetti-x', `${xDrift}px`);
       
       confetti.style.animation = `fw-confetti-fall ${2 + Math.random() * 2}s linear forwards`;
       confetti.style.animationDelay = (Math.random() * 1.5) + 's';
       container.appendChild(confetti);
    }
  }
}

window.framework = null;
