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
    this.seating = config.seating || { archetype: 'ffa', minPlayers: 2, maxPlayers: 4 };
    this.engine = config.engine;
    this.ui = config.ui;
    this.passThePhone = config.passThePhone || false;
    this.confettiContinuous = config.confettiContinuous !== undefined ? config.confettiContinuous : true;

    // Internal State
    this.isOnline = false;
    this.lobbyId = null;
    this.gameState = null;
    this.mySlotIndex = null;
    this.editingTeamKey = null; // UI state for the Host
    this.gameOverDismissed = false;
    this.confettiInterval = null;
    
    // UI References
    this.dom = {
      turnIndicator: document.getElementById('turn-indicator'),
      selfRoleBadge: document.getElementById('self-role-badge'),
      rematchBtn: document.getElementById('btn-rematch'),
      settingsBtn: document.getElementById('btn-settings'),
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
          <h2 class="text-gradient" style="margin-bottom: 4px;">Players & Teams</h2>
          <p style="color: var(--text-secondary); font-size: 0.8rem; margin-bottom: 20px;">Drag players around to fill teams</p>
          <button class="btn-close" id="fw-players-close">&times;</button>
          
          <div id="fw-seating-toolbar" class="host-only" style="margin-bottom: 1rem; padding: 0.75rem; background: rgba(255,255,255,0.03); border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); display: flex; gap: 0.5rem; align-items: center;">
             <span style="font-size: 0.7rem; color: var(--text-secondary); font-weight: 800; text-transform: uppercase; margin-right: auto;">Host Toolkit</span>
             <button class="btn btn-sm btn-mint" style="padding: 4px 12px; font-size: 0.75rem;" onclick="window.framework.randomAutoFill()">✨ Random Auto-fill</button>
          </div>
          
          <div id="fw-teams-container" style="margin-top: 1rem; text-align: left;">
            <!-- Sorted Slots & Team Headers here -->
          </div>
          
          <button id="fw-players-ok" class="btn btn-mint mt-2 w-100">Done</button>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.dom.playersModal = document.getElementById('fw-players-modal');
    document.getElementById('fw-players-close').addEventListener('click', () => this.closePlayersModal());
    document.getElementById('fw-players-ok').addEventListener('click', () => {
       const validation = this.validateSeating();
       if (!validation.ok) {
          if (window.Notify) window.Notify.toast(validation.error);
          return;
       }
       this.closePlayersModal();
    });

    // 3. Game Over Overlay
    const gameOverHTML = `
      <div id="fw-gameover-overlay">
        <div class="fw-victory-glow" id="fw-glow"></div>
        <div class="fw-gameover-content">
          <button class="btn-close" id="fw-gameover-close" style="top: 1.5rem; right: 1.5rem; z-index: 10;">&times;</button>
          <h1 id="fw-gameover-title" class="fw-gameover-title text-gradient">VICTORY</h1>
          <p id="fw-winner-name" class="fw-winner-name">Player 1 wins the match!</p>
          
          <div class="fw-gameover-actions">
            <button id="fw-btn-rematch-hero" class="btn btn-mint w-100 host-only" style="padding: 1rem;">Rematch</button>
            <button id="fw-btn-return-hub" class="btn btn-secondary w-100 host-only">Return to Hub</button>
          </div>
        </div>
        <div id="fw-confetti-container" style="position:fixed; top:0; left:0; width:100%; height:100%; pointer-events:none;"></div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', gameOverHTML);
    this.dom.gameOverOverlay = document.getElementById('fw-gameover-overlay');
    
    // Use delegated or specific listener for the "X"
    this.dom.gameOverOverlay.addEventListener('click', (e) => {
      if (e.target.id === 'fw-gameover-close' || e.target.id === 'fw-gameover-overlay') {
        this.dom.gameOverOverlay.classList.remove('visible');
        this.gameOverDismissed = true;
        this.stopConfetti();
      }
    });
    
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
    const toolbar = document.getElementById('fw-seating-toolbar');
    if (toolbar) toolbar.classList.toggle('host-only', !isHost);

    const lobbyPlayers = (window.currentLobbyData && window.currentLobbyData.players) || [];
    const arch = this.seating.archetype;
    const currentSlots = this.gameState.slots;

    const container = document.createElement('div');
    container.className = 'fw-st-container';
    
    // 1. Team Grid
    const teamGrid = document.createElement('div');
    teamGrid.className = 'fw-team-grid';
    
    const teamMap = {};
    currentSlots.forEach((slot, i) => {
      const teamKey = slot.team || '_default';
      if (!teamMap[teamKey]) teamMap[teamKey] = [];
      teamMap[teamKey].push({ data: slot, index: i });
    });

    const teamKeys = Object.keys(teamMap);
    teamKeys.forEach(teamKey => {
      if (teamKey === '_spec') return; // Handled separately
      
      const teamState = (this.gameState.teams && this.gameState.teams[teamKey]) || { name: (teamKey === '_default' ? 'Players' : teamKey), color: 'Neutral' };
      const colorMeta = FRAMEWORK_COLORS.find(c => c.name === teamState.color) || FRAMEWORK_COLORS[0];
      
      let teamConfig = null;
      if (arch === 'teams' && this.seating.teams) {
         teamConfig = this.seating.teams.find(t => t.id === teamKey);
      }

      const slotsInTeam = teamMap[teamKey] || [];
      const headerControls = [];
      if (isHost) {
         if (arch === 'teams' && teamKey !== '_default') {
            headerControls.push(`<button class="btn btn-sm" style="background:none; border:none; padding:0; margin-left:8px;" onclick="window.framework.editingTeamKey = '${teamKey}'; window.framework.renderSeatingUI();">⚙️</button>`);
         }
      }

      const card = document.createElement('div');
      card.className = `fw-team-card ${!teamConfig || teamConfig.max > 10 ? 'fw-drop-zone' : ''}`;
      card.dataset.team = teamKey;
      card.style.borderLeft = `4px solid ${colorMeta.value}`;

      if (this.editingTeamKey === teamKey) {
         // --- EDIT MODE ---
         const usedColors = Object.entries(this.gameState.teams)
            .filter(([k, v]) => k !== teamKey)
            .map(([k, v]) => v.color);

         const colorsHTML = FRAMEWORK_COLORS.map(c => {
            const isTaken = usedColors.includes(c.name);
            return `
               <div class="fw-color-bubble ${c.name === teamState.color ? 'active' : ''} ${isTaken ? 'is-taken' : ''}" 
                    style="background: ${c.value}; ${isTaken ? 'opacity: 0.2; pointer-events: none; grayscale(1);' : ''}" 
                    title="${isTaken ? 'Already taken' : c.name}"
                    ${!isTaken ? `onclick="window.framework.updateTeamUI('${teamKey}', document.getElementById('edit-name-${teamKey}').value, '${c.name}')"` : ''}>
               </div>
            `;
         }).join('');

         card.innerHTML = `
           <div class="fw-team-edit-form">
              <label style="font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 800;">Rename Team</label>
              <input type="text" id="edit-name-${teamKey}" class="fw-edit-input" value="${teamState.name}" maxlength="15">
              
              <label style="font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 800;">Signature Color</label>
              <div class="fw-color-grid">${colorsHTML}</div>
              
              <div class="fw-edit-actions">
                 <button class="btn btn-sm btn-mint w-100" onclick="window.framework.saveTeamSettings('${teamKey}')">Save</button>
                 <button class="btn btn-sm btn-secondary" onclick="window.framework.cancelTeamEdit()">Cancel</button>
              </div>
           </div>
         `;
      } else {
         // --- VIEW MODE ---
         const header = `
           <div class="fw-team-header">
              <span class="fw-team-name">${teamState.name}</span>
              <div style="display:flex; align-items:center;">${headerControls.join('')}</div>
           </div>
         `;
         card.innerHTML = header;

         const pillList = document.createElement('div');
         pillList.className = 'fw-pill-list';

         // Fixed Slots Logic
         const maxSlots = teamConfig ? teamConfig.max : (this.seating.maxPlayers || slotsInTeam.length);
         const minForThisGroup = teamConfig ? (teamConfig.min || 0) : (teamKey === '_default' ? (this.seating.minPlayers || 0) : 0);

         for (let i = 0; i < maxSlots; i++) {
            const item = slotsInTeam[i];
            const isMandatory = i < minForThisGroup;

            if (item && item.data.id) {
               // Filled Slot (Pill)
               const pill = this.createPlayerPill(item.data, item.index);
               pillList.appendChild(pill);
            } else {
               // Empty Placeholder (Scrim)
               const placeholder = document.createElement('div');
               placeholder.className = 'fw-slot-placeholder';
               if (isMandatory) placeholder.classList.add('is-mandatory');
               
               placeholder.dataset.team = teamKey;
               // Map virtual index back to the real global slot index if possible
               placeholder.dataset.index = item ? item.index : -1; 
               
               pillList.appendChild(placeholder);
            }
         }
         card.appendChild(pillList);
      }
      
      teamGrid.appendChild(card);
    });
    
    container.appendChild(teamGrid);

    // 2. Spectators (Elastic Zone)
    const specSection = document.createElement('div');
    specSection.style.marginTop = '1rem';
    specSection.innerHTML = `<label style="color: var(--text-secondary); font-size: 0.7rem; font-weight: 800; letter-spacing: 1px; text-transform: uppercase;">Spectators</label>`;
    
    const dropZone = document.createElement('div');
    dropZone.className = 'fw-drop-zone';
    dropZone.dataset.team = '_spec';

    const assignedIds = currentSlots.map(s => s.id).filter(id => id !== null);
    const spectators = lobbyPlayers.filter(p => !assignedIds.includes(p.id));

    if (spectators.length === 0) {
       dropZone.innerHTML = `<span style="font-size: 0.8rem; color: rgba(255,255,255,0.1); width: 100%; text-align: center; padding: 1rem;">Drag players here to spectate</span>`;
    } else {
       spectators.forEach(p => {
          const pill = this.createPlayerPill({ id: p.id, name: p.name }, -1);
          dropZone.appendChild(pill);
       });
    }

    specSection.appendChild(dropZone);
    container.appendChild(specSection);

    list.appendChild(container);
    
    // Re-initialize drag behaviors
    this.setupDragAndDrop();
  }

  createPlayerPill(data, slotIndex) {
     const pill = document.createElement('div');
     pill.className = 'fw-player-pill';
     if (data.id === window.CLIENT_ID) pill.classList.add('is-me');
     if (this.selectedPillId === data.id) pill.classList.add('is-selected');
     pill.dataset.id = data.id;
     pill.dataset.slotIndex = slotIndex;
     pill.innerText = data.name + (data.id === window.CLIENT_ID ? ' (You)' : '');
     return pill;
  }

  setupDragAndDrop() {
    // We'll implement the full pointer-engine in the next step
    // For now, let's just tag them and add a basic click-assign as requested
    const pills = document.querySelectorAll('.fw-player-pill');
    const targets = document.querySelectorAll('.fw-slot-placeholder, .fw-drop-zone');
    
    // Pointer Dragging logic will go here
    this.initPointerDragEngine(pills, targets);
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
    this.ui.render(this.gameState, this);
    this.renderFrameworkUI();
    this.renderSeatingUI();
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
      
      if (this.isOnline) {
         const isHost = this.isHost();
         if (this.dom.rematchBtn) this.dom.rematchBtn.classList.toggle('host-only', !isHost);
         if (this.dom.settingsBtn) this.dom.settingsBtn.classList.toggle('host-only', !isHost);
      }
    });
  }

  initServerState(lobbyData) {
    const state = this.engine.getInitialState();
    state.status = 'waiting';
    state.teams = {};
    state.slots = [];

    // 2. Auto-Assign available players (Randomized)
    this.autoAssignPlayers(state, lobbyData.players);

    state.activeSlotIndex = 0;
    this.commit(state);
  }

  autoAssignPlayers(state, lobbyPlayers) {
    if (!state || !state.slots) return;
    
    // Clear existing assignments first to start fresh
    state.slots.forEach(s => s.id = null);
    
    // Fisher-Yates Shuffle
    const players = [...lobbyPlayers];
    for (let i = players.length - 1; i > 0; i--) {
       const j = Math.floor(Math.random() * (i + 1));
       [players[i], players[j]] = [players[j], players[i]];
    }

    const available = [...players];
    
    // Pass 1: Fill mandatory slots
    state.slots = state.slots.map(slot => {
       if (available.length > 0) {
          const p = available.shift();
          return { ...slot, id: p.id, name: p.name };
       }
       return slot;
    });

    // Pass 2: Fill optional slots up to max
    if (available.length > 0) {
       if (this.seating.archetype === 'teams') {
          this.seating.teams.forEach(t => {
             while (available.length > 0) {
                const currentInTeam = state.slots.filter(s => s.team === t.id).length;
                if (currentInTeam >= (t.max || 99)) break;
                const p = available.shift();
                state.slots.push({ id: p.id, name: p.name, team: t.id });
             }
          });
       } else {
          const groupKey = this.seating.archetype === 'coop' ? '_coop' : '_default';
          const max = this.seating.maxPlayers || 99;
          while (available.length > 0 && state.slots.length < max) {
             const p = available.shift();
             state.slots.push({ id: p.id, name: p.name, team: groupKey });
          }
       }
    }
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
    if (this.isOnline && this.lobbyId) {
       await updateGameState(this.lobbyId, state);
    } else {
       // Local or Mock mode update
       this.renderFrameworkUI();
       if (this.ui && this.ui.render) this.ui.render(this.gameState, this);
    }
  }

  resetLocalGame() {
    this.gameState = this.engine.getInitialState();
    this.gameState.status = 'waiting';
    this.gameState.teams = {};
    
    // 1. Generate initial slots & teams based on seating config
    const initialSlots = [];
    if (this.seating.archetype === 'teams') {
       this.seating.teams.forEach(t => {
          this.gameState.teams[t.id] = { name: t.name, color: t.color || 'Neutral' };
          for (let i = 0; i < t.min; i++) {
             initialSlots.push({ id: null, name: 'Waiting...', team: t.id });
          }
       });
    } else if (this.seating.archetype === 'coop') {
       this.gameState.teams['_coop'] = { name: this.seating.teamName || 'Team', color: this.seating.color || 'Mint' };
       for (let i = 0; i < this.seating.minPlayers; i++) {
          initialSlots.push({ id: null, name: 'Waiting...', team: '_coop' });
       }
    } else {
       for (let i = 0; i < this.seating.minPlayers; i++) {
          initialSlots.push({ id: null, name: 'Waiting...', team: '_default' });
       }
    }
    
    this.gameState.slots = initialSlots;

    // 2. Auto-Assign available players randomized
    const lobbyPlayers = (window.currentLobbyData && window.currentLobbyData.players) || [];
    this.autoAssignPlayers(this.gameState, lobbyPlayers);

    this.gameState.activeSlotIndex = 0;
    
    if (this.dom.gameOverOverlay) this.dom.gameOverOverlay.classList.remove('visible');
    this.gameOverDismissed = false;
    this.stopConfetti();
    this.renderFrameworkUI();
    if (this.ui && this.ui.render) this.ui.render(this.gameState, this);
  }

  resetOnlineGame() {
    const newState = this.engine.getInitialState();
    newState.slots = this.gameState.slots; 
    newState.teams = this.gameState.teams; 
    newState.status = 'playing';
    newState.activeSlotIndex = 0;
    if (this.dom.gameOverOverlay) this.dom.gameOverOverlay.classList.remove('visible');
    this.gameOverDismissed = false;
    this.stopConfetti();
    this.commit(newState);
  }

  initPointerDragEngine(pills, targets) {
    if (!this.isHost()) return;

    let dragPill = null;
    let ghost = null;
    let offset = { x: 0, y: 0 };
    let currentTarget = null;

    const onPointerDown = (e) => {
       const pill = e.target.closest('.fw-player-pill');
       if (!pill) return;
       
       dragPill = pill;
       const rect = pill.getBoundingClientRect();
       offset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
       
       // Create Ghost
       ghost = pill.cloneNode(true);
       ghost.classList.add('fw-player-pill-ghost');
       ghost.style.width = rect.width + 'px';
       ghost.style.left = rect.left + 'px';
       ghost.style.top = rect.top + 'px';
       document.body.appendChild(ghost);
       
       pill.classList.add('dragging');
       
       window.addEventListener('pointermove', onPointerMove);
       window.addEventListener('pointerup', onPointerUp);
       
       e.preventDefault();
    };

    const onPointerMove = (e) => {
       if (!ghost) return;
       
       ghost.style.left = (e.clientX - offset.x) + 'px';
       ghost.style.top = (e.clientY - offset.y) + 'px';
       
       // Hit Detection
       ghost.style.pointerEvents = 'none';
       const elements = document.elementsFromPoint(e.clientX, e.clientY);
       ghost.style.pointerEvents = 'auto';
       
       const target = elements.find(el => el.classList.contains('fw-slot-placeholder') || el.classList.contains('fw-drop-zone'));
       
       if (target !== currentTarget) {
          if (currentTarget) currentTarget.classList.remove('drop-hover');
          currentTarget = target;
          if (currentTarget) currentTarget.classList.add('drop-hover');
       }
    };

    const onPointerUp = (e) => {
       window.removeEventListener('pointermove', onPointerMove);
       window.removeEventListener('pointerup', onPointerUp);
       
       // Handle Drop
       if (currentTarget && dragPill) {
          const playerId = dragPill.dataset.id;
          const targetTeam = currentTarget.dataset.team;
          const targetIndex = parseInt(currentTarget.dataset.index);
          this.moveToSlot(playerId, targetTeam, targetIndex);
       } 
       // Handle Click Selection (Tap-to-Assign)
       else if (!ghost && e.target.closest('.fw-player-pill')) {
          const pill = e.target.closest('.fw-player-pill');
          if (this.selectedPillId === pill.dataset.id) {
             this.selectedPillId = null;
          } else {
             this.selectedPillId = pill.dataset.id;
          }
          this.renderSeatingUI();
       }
       else if (!ghost && this.selectedPillId && (e.target.closest('.fw-slot-placeholder') || e.target.closest('.fw-drop-zone'))) {
          const target = e.target.closest('.fw-slot-placeholder') || e.target.closest('.fw-drop-zone');
          this.moveToSlot(this.selectedPillId, target.dataset.team, parseInt(target.dataset.index));
          this.selectedPillId = null;
       }
       
       if (ghost) {
          ghost.remove();
          ghost = null;
       }
       if (dragPill) {
          dragPill.classList.remove('dragging');
          dragPill = null;
       }
       if (currentTarget) {
          currentTarget.classList.remove('drop-hover');
          currentTarget = null;
       }
    };

    pills.forEach(p => p.addEventListener('pointerdown', onPointerDown));
  }

  async moveToSlot(playerId, teamKey, slotIndex) {
    if (!this.isHost()) return;
    const lobbyPlayers = (window.currentLobbyData && window.currentLobbyData.players) || [];
    const player = lobbyPlayers.find(p => p.id === playerId);
    if (!player) return;

    const newState = { ...this.gameState };
    
    // 1. Clear player from any existing slot
    newState.slots = newState.slots.map(s => {
       if (s.id === playerId) {
          return { ...s, id: null, name: 'Waiting...' };
       }
       return s;
    });

    // 2. Assign to new slot if not spectator
    if (teamKey !== '_spec') {
       if (isNaN(slotIndex) || slotIndex === -1) {
          // Elastic zone drop OR Virtual Placeholder
          const firstEmpty = newState.slots.findIndex(s => s.team === teamKey && s.id === null);
          if (firstEmpty !== -1) {
             newState.slots[firstEmpty] = { id: playerId, name: player.name, team: teamKey };
          } else {
             newState.slots.push({ id: playerId, name: player.name, team: teamKey });
          }
       } else {
          // Fixed slot drop
          newState.slots[slotIndex] = { id: playerId, name: player.name, team: teamKey };
       }
    }

    // 3. Compact Slots (Move Up behavior)
    newState.slots = this.compactSlots(newState.slots);
    
    await this.commit(newState);
    this.renderSeatingUI();
  }

  updateTeamUI(teamKey, newName, newColor) {
    if (!this.gameState.teams) this.gameState.teams = {};
    this.gameState.teams[teamKey] = { name: newName, color: newColor };
    this.renderSeatingUI();
  }

  async saveTeamSettings(teamKey) {
    const input = document.getElementById(`edit-name-${teamKey}`);
    const newName = input.value.trim() || this.gameState.teams[teamKey].name;
    const color = this.gameState.teams[teamKey].color; // Already updated via updateTeamUI
    
    this.gameState.teams[teamKey].name = newName;
    this.editingTeamKey = null;
    await this.commit(this.gameState);
    this.renderSeatingUI();
  }

  cancelTeamEdit() {
    this.editingTeamKey = null;
    this.renderSeatingUI();
  }

  randomAutoFill() {
    if (!this.isHost()) return;
    const lobbyPlayers = (window.currentLobbyData && window.currentLobbyData.players) || [];
    this.autoAssignPlayers(this.gameState, lobbyPlayers);
    this.commit(this.gameState);
    this.renderSeatingUI();
  }

  validateSeating() {
    if (!this.gameState || !this.gameState.slots) return { ok: true };
    const lobbyPlayers = (window.currentLobbyData && window.currentLobbyData.players) || [];
    const assignedIds = this.gameState.slots.map(s => s.id).filter(id => id !== null);
    const spectators = lobbyPlayers.filter(p => !assignedIds.includes(p.id));
    
    if (spectators.length === 0) return { ok: true };

    const arch = this.seating.archetype;
    let emptyMandatoryCount = 0;

    if (arch === 'teams') {
       this.seating.teams.forEach(t => {
          const slotsInTeam = this.gameState.slots.filter(s => s.team === t.id);
          for (let i = 0; i < (t.min || 1); i++) {
             if (i < slotsInTeam.length && !slotsInTeam[i].id) {
                emptyMandatoryCount++;
             }
          }
       });
    } else {
       const min = this.seating.minPlayers || 2;
       for (let i = 0; i < min; i++) {
          if (i < this.gameState.slots.length && !this.gameState.slots[i].id) {
             emptyMandatoryCount++;
          }
       }
    }

    if (emptyMandatoryCount > 0) {
       return { 
          ok: false, 
          error: `Please fill mandatory slots! You have ${emptyMandatoryCount} empty required seat(s) and people waiting.` 
       };
    }

    return { ok: true };
  }

  compactSlots(slots) {
    const teams = Array.from(new Set(slots.map(s => s.team)));
    let newSlots = [];
    
    teams.forEach(tKey => {
       const teamInSlots = slots.filter(s => s.team === tKey);
       const players = teamInSlots.filter(s => s.id !== null);
       const emptyCount = teamInSlots.length - players.length;
       
       newSlots.push(...players);
       for(let i=0; i<emptyCount; i++) {
          newSlots.push({ id: null, name: 'Waiting...', team: tKey });
       }
    });

    return newSlots;
  }

  async addSlot(teamKey = '_default') {
    if (!this.isHost()) return;
    const newState = { ...this.gameState };
    newState.slots.push({ id: null, name: 'Waiting...', team: teamKey });
    await this.commit(newState);
    this.renderSeatingUI();
  }

  async removeSlot(slotIndex) {
    if (!this.isHost()) return;
    const newState = { ...this.gameState };
    newState.slots.splice(slotIndex, 1);
    await this.commit(newState);
    this.renderSeatingUI();
  }

  async startGame() {
    if (!this.isHost()) return;
    const newState = { ...this.gameState, status: 'playing' };
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
             const slotData = this.gameState.slots[this.mySlotIndex];
             this.dom.selfRoleBadge.innerText = `PLAYING AS ${slotData.name}`;
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
       const status = this.gameState.status;

       if (status === 'waiting') {
          // --- LOBBY WAITING PHASE ---
          this.dom.turnIndicator.innerText = "Lobby: Assigning Players";
          
          if (this.dom.rematchBtn) {
             const isHost = this.isHost();
             // Validation: Are minimum players met?
             let canStart = true;
             const filledSlots = this.gameState.slots.filter(s => s.id !== null).length;
             
             if (this.seating.archetype === 'teams') {
                this.seating.teams.forEach(tc => {
                   const teamCount = this.gameState.slots.filter(s => s.team === tc.id && s.id !== null).length;
                   if (teamCount < tc.min) canStart = false;
                });
             } else {
                if (filledSlots < (this.seating.minPlayers || 0)) canStart = false;
             }

             this.dom.rematchBtn.innerText = "Start Game";
             this.dom.rematchBtn.disabled = !canStart || !isHost;
             this.dom.rematchBtn.style.opacity = (canStart && isHost) ? "1" : "0.5";
             this.dom.rematchBtn.classList.toggle('host-only', !isHost);
             
             // Update the click handler just for the 'waiting' state
             this.dom.rematchBtn.onclick = () => {
                if (canStart && isHost) this.startGame();
             };
          }
       } else if (status === 'finished') {
          // --- MATCH FINISHED ---
          if (this.dom.rematchBtn) {
             this.dom.rematchBtn.innerText = this.isOnline ? "Rematch" : "Reset";
             this.dom.rematchBtn.disabled = false;
             this.dom.rematchBtn.style.opacity = "1";
             this.dom.rematchBtn.onclick = () => this.isOnline ? (this.isHost() && this.resetOnlineGame()) : this.resetLocalGame();
          }

          if (this.gameState.winner === 'draw') {
             this.dom.turnIndicator.innerText = "It's a Draw!";
             this.showGameOver('draw');
          } else if (this.gameState.winner === 'defeat') {
             this.dom.turnIndicator.innerText = "Mission Failed! ❌";
             this.showGameOver('defeat');
          } else {
             const winners = Array.isArray(this.gameState.winner) ? this.gameState.winner : [this.gameState.winner];
             const slotData = this.gameState.slots[winners[0]];
             const teamKey = slotData.team || '_default';
             const teamState = (this.gameState.teams && this.gameState.teams[teamKey]) || { color: 'Neutral' };
             const colorMeta = FRAMEWORK_COLORS.find(c => c.name === teamState.color) || FRAMEWORK_COLORS[0];

             if (winners.length === 1 && winners[0] === this.mySlotIndex) {
                 this.dom.turnIndicator.innerText = `You Win!`;
             } else {
                 const winnerNames = winners.map(idx => this.gameState.slots[idx].name).join(' & ');
                 this.dom.turnIndicator.innerHTML = `<span style="color: ${colorMeta.value}; font-weight: 800;">${winnerNames}</span> Wins!`;
             }
             this.showGameOver(winners[0]); 
          }
       } else {
          // --- PLAYING ---
          if (this.dom.rematchBtn) {
             this.dom.rematchBtn.innerText = "Rematch"; // Hidden usually via host-only or during play
             this.dom.rematchBtn.classList.add('host-only');
          }

          const activeName = this.gameState.slots[this.gameState.activeSlotIndex].name;
          const isMyTurn = (this.mySlotIndex === this.gameState.activeSlotIndex);
          this.dom.turnIndicator.innerText = isMyTurn ? "Your Turn" : `${activeName}'s Turn`;
          
          if (this.dom.gameOverOverlay) {
             this.dom.gameOverOverlay.classList.remove('visible');
             this.gameOverDismissed = false;
             this.stopConfetti();
          }
       }
    }
  }

  showGameOver(winnerIndex) {
    if (!this.dom.gameOverOverlay || this.gameOverDismissed) return;
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
       const slotData = this.gameState.slots[winnerIndex];
       
       // Determine personalization
       const isMyWin = (this.mySlotIndex === winnerIndex) || 
                       (this.mySlotIndex !== null && this.gameState.slots[this.mySlotIndex].team && this.gameState.slots[this.mySlotIndex].team === slotData.team);

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
       
       const isAlreadyShowing = this.dom.gameOverOverlay.classList.contains('visible');
       if (!isAlreadyShowing && (isMyWin || this.mySlotIndex === null)) {
         this.triggerConfetti(colorMeta.value);
       }
    }
    
    const isHost = this.isHost();
    const btnRematchHero = document.getElementById('fw-btn-rematch-hero');
    const btnReturnHub = document.getElementById('fw-btn-return-hub');
    if (this.isOnline) {
      if (btnRematchHero) btnRematchHero.classList.toggle('host-only', !isHost);
      if (btnReturnHub) btnReturnHub.classList.toggle('host-only', !isHost);
    } else {
      // Local mode: everyone is the "host"
      if (btnRematchHero) btnRematchHero.classList.remove('host-only');
      if (btnReturnHub) btnReturnHub.classList.remove('host-only');
    }

    this.dom.gameOverOverlay.classList.add('visible');
  }

  triggerConfetti(color) {
    const container = document.getElementById('fw-confetti-container');
    if (!container) return;
    
    this.stopConfetti();
    container.innerHTML = '';

    const spawn = () => {
       const confetti = document.createElement('div');
       confetti.className = 'fw-confetti';
       confetti.style.left = (Math.random() * 100) + 'vw';
       confetti.style.backgroundColor = color === 'rgba(255,255,255,0.2)' ? (['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24'][Math.floor(Math.random() * 4)]) : color;
       
       const xDrift = (Math.random() - 0.5) * 200;
       confetti.style.setProperty('--fw-confetti-x', `${xDrift}px`);
       
       const duration = 2 + Math.random() * 2;
       confetti.style.animation = `fw-confetti-fall ${duration}s linear forwards`;
       container.appendChild(confetti);
       
       // Clean up particle after it falls
       setTimeout(() => confetti.remove(), duration * 1000);
    };

    // Initial burst
    for(let i=0; i<50; i++) setTimeout(spawn, Math.random() * 500);
    
    // Continuous stream
    if (this.confettiContinuous) {
      this.confettiInterval = setInterval(spawn, 150);
    }
  }

  stopConfetti() {
    if (this.confettiInterval) {
      clearInterval(this.confettiInterval);
      this.confettiInterval = null;
    }
    const container = document.getElementById('fw-confetti-container');
    if (container) container.innerHTML = '';
  }
}

window.framework = null;
