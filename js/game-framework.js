import { subscribeToLobby, updateGameState, setLobbyGame, leaveLobby } from './database-manager.js';
import { GameShell } from './game-shell.js';



/**
 * GameFramework handles the plumbing for turn-based games:
 * - Mode detection (Local vs Online)
 * - Network synchronization via Firebase
 * - Seating & Team management (via Modal)
 * - Spectator tracking
 * - Game Over / Victory sequences
 */
export class GameFramework {
  static COLORS = [
    { name: 'Neutral', value: 'rgba(255,255,255,0.2)', text: '#fff' },
    { name: 'Coral', value: '#ff6b6b', text: '#fff' },
    { name: 'Mint', value: '#4ecdc4', text: '#1e1e1e' },
    { name: 'Blue', value: '#45b7d1', text: '#fff' },
    { name: 'Gold', value: '#f9ca24', text: '#1e1e1e' },
    { name: 'Purple', value: '#a29bfe', text: '#fff' },
    { name: 'Pink', value: '#fd79a8', text: '#fff' }
  ];

  constructor(config) {
    this.gameId = config.gameId;
    this.seating = config.seating || { archetype: 'ffa', minPlayers: 2, maxPlayers: 4 };
    this.engine = config.engine;
    this.ui = config.ui;
    this.passThePhone = config.passThePhone || false;
    this.confettiContinuous = config.confettiContinuous !== undefined ? config.confettiContinuous : true;
    this.hasLobby = config.hasLobby !== undefined ? config.hasLobby : true;

    this.validateSeatingConfig();


    // Internal State
    this.isOnline = false;
    this.lobbyId = null;
    this.gameState = null;
    this.mySlotIndex = null;
    this.gameOverDismissed = false;
    this.confettiInterval = null;
    this.localLobbyPlayers = []; // For Local mode personas
    this.selectedPillId = null; 
    this.editingTeamKey = null; 
    this.editingPlayerId = null; // Track who is being renamed inline
    this.lobbyPlayers = []; // Cache for online or local pools
    
    // UI References (Populated in init)
    this.dom = {
      turnIndicator: null,
      selfRoleBadge: null,
      resetBtn: null,
      settingsBtn: null,
      rulesBtn: null,
      playersBtn: null,
      passDeviceOverlay: null,
      playersModal: null,
      gameOverOverlay: null
    };
  }

  validateSeatingConfig() {
    if (!this.seating || this.seating.archetype !== 'teams') return;

    const teams = this.seating.teams || [];
    const sumMin = teams.reduce((acc, t) => acc + (t.min || 0), 0);
    const sumMax = teams.reduce((acc, t) => acc + (t.max || 0), 0);

    // Auto-infer if missing
    if (this.seating.minPlayers === undefined) this.seating.minPlayers = sumMin;
    if (this.seating.maxPlayers === undefined) this.seating.maxPlayers = sumMax;

    const configMin = this.seating.minPlayers;
    const configMax = this.seating.maxPlayers;

    if (sumMin !== configMin || sumMax !== configMax) {
       console.warn(
          `%c ⚠️ GameFramework: Seating Config Inconsistency %c\n` +
          `The sum of team capacities does not match minPlayers/maxPlayers.\n` +
          `- Sum of Teams: Min=${sumMin}, Max=${sumMax}\n` +
          `- Config declared: Min=${configMin}, Max=${configMax}\n` +
          `Please ensure these match or remove the explicit Min/Max to use auto-inference.`,
          "background: #ffcc00; color: #000; font-weight: bold; padding: 2px 5px; border-radius: 3px;",
          "color: inherit;"
       );
    }
  }


  getTeamColor(teamKey) {
    if (!this.gameState || !this.gameState.teams) return '#ffffff';
    const teamState = this.gameState.teams[teamKey] || { color: 'Neutral' };
    const colors = GameFramework.COLORS;
    const colorMeta = colors.find(c => c.name === teamState.color) || colors[0];
    return colorMeta ? colorMeta.value : '#ffffff';
  }

  getSlotColor(slotIndex) {
    if (!this.gameState || !this.gameState.slots[slotIndex]) return '#ffffff';
    const slot = this.gameState.slots[slotIndex];
    
    // Prioritize stored color (Custom selection or Auto-assigned)
    if (slot.color) {
       const colors = GameFramework.COLORS;
       const colorMeta = colors.find(c => c.name === slot.color) || colors[0];
       return colorMeta.value;
    }

    const teamKey = slot.team || '_default';
    
    // If FFA/Default team without explicit color, assign distinct color based on slot index
    if (teamKey === '_default') {
       const colorIdx = (slotIndex % (GameFramework.COLORS.length - 1)) + 1; // Skip Neutral
       return GameFramework.COLORS[colorIdx].value;
    }
    
    return this.getTeamColor(teamKey);
  }

  async init() {
    // 1. Inject the standard Game Shell (UI Layout)
    GameShell.injectBaseShell();

    // 2. Setup Framework DOM and Components
    this.bindFrameworkDOM();
    this.injectFrameworkComponents();
    
    // 3. Detect Mode
    const urlParams = new URLSearchParams(window.location.search);
    this.isOnline = urlParams.get('mode') === 'online';
    this.lobbyId = urlParams.get('lobby');

    this.setupFrameworkListeners();

    // 4. Connect to Data Layer
    if (this.isOnline && this.lobbyId) {
      this.initNetworkSync();
    } else {
      this.resetLocalGame();
    }

    // 5. Initial Pre-Game Lobby Check
    this.checkPreGameStatus();

    // 6. Dev Mode Check & Tools Button Visibility
    this.checkDevMode().then(isDev => {
      if (this.dom.toolsBtn && (isDev || (this.engine && this.engine.getToolsHTML))) {
        this.dom.toolsBtn.classList.remove('hidden');
      }
    });
  }

  checkPreGameStatus() {
     if (!this.gameState) return;
     
     // Show the pre-game setup modal to everyone if match hasn't started
     const shouldShowModal = !this.gameState.started;
     console.log(`[Framework] checkPreGameStatus. started: ${this.gameState.started}, shouldShow: ${shouldShowModal}`);

     if (shouldShowModal) {
        GameShell.showPreGameModal(
           this.isHost(), 
           () => this.startGame(),
           () => this.openPlayersModal(),
           () => this.openRulesModal(),
           (this.engine.getSettingsHTML || this.engine.settings) ? () => this.openSettingsModal() : null,
           () => this.returnToHub()
        );
     } else {
        GameShell.hidePreGameModal();
     }
  }

  startGame() {
     if (this.isOnline && !this.isHost()) return;

     // Set both lobby state ('started') and game status ('playing')
     const newState = { ...this.gameState, started: true, status: 'playing' };
     
     if (this.isOnline) {
        this.commit(newState);
        GameShell.hidePreGameModal();
     } else {
        this.gameState = newState;
        this.renderFrameworkUI();
        if (this.ui && this.ui.render) this.ui.render(this.gameState, this);
        GameShell.hidePreGameModal();
     }
  }

  bindFrameworkDOM() {
     this.dom.turnIndicator = document.getElementById('turn-indicator');
     this.dom.selfRoleBadge = document.getElementById('self-role-badge');
     this.dom.resetBtn = document.getElementById('btn-rematch');
     this.dom.settingsBtn = document.getElementById('btn-settings');
     this.dom.toolsBtn = document.getElementById('btn-tools');
     this.dom.toolsModal = document.getElementById('fw-tools-modal');
     this.dom.rulesBtn = document.getElementById('btn-rules');
     this.dom.playersBtn = document.getElementById('btn-players');
     this.dom.navHubBtn = document.getElementById('nav-btn-hub');
     
     // Log errors if critical shell components are missing
     if (!this.dom.resetBtn) console.error("GameFramework: #btn-rematch not found in DOM");
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
          <p style="color: var(--text-secondary); font-size: 0.8rem; margin-bottom: 20px;">Drag or Tap players to fill teams</p>
          <button class="btn-close" id="fw-players-close">&times;</button>
          
          <div id="fw-seating-toolbar" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
              <button class="btn btn-sm btn-mint" style="padding: 4px 12px; font-size: 0.75rem;" onclick="window.framework.randomAutoFill()">✨ Random Auto-fill</button>
              <div id="fw-toolbar-actions" style="display: flex; gap: 0.5rem; align-items: center;"></div>
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

    document.getElementById('fw-btn-return-hub').addEventListener('click', () => this.returnToHub());

    // 4. Settings Modal
    const settingsHTML = `
      <div id="fw-settings-modal" class="modal hidden" style="z-index: 10000;">
        <div class="modal-content" style="max-height: 85vh; overflow-y: auto;">
          <h2 class="text-gradient" style="margin-bottom: 4px;">Game Settings</h2>
          <p style="color: var(--text-secondary); font-size: 0.8rem; margin-bottom: 20px;">Adjust rules and preferences for the next match</p>
          <button class="btn-close" id="fw-settings-close">&times;</button>
          
          <form id="fw-settings-form" style="margin-top: 1rem; text-align: left;">
            <!-- Engine-specific settings here -->
          </form>
          
          <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
            <button id="fw-settings-reset" class="btn btn-secondary w-100" style="background: rgba(255,255,255,0.05); color: white; padding: 0.8rem;">Reset Defaults</button>
            <button id="fw-settings-ok" class="btn btn-mint w-100" style="padding: 0.8rem;">Save</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', settingsHTML);
    this.dom.settingsModal = document.getElementById('fw-settings-modal');
    document.getElementById('fw-settings-close').addEventListener('click', () => this.closeSettingsModal());
    document.getElementById('fw-settings-ok').addEventListener('click', () => this.saveSettings());
    document.getElementById('fw-settings-reset').addEventListener('click', () => this.resetSettingsToDefault());
  }

  returnToHub() {
    if (this.isOnline) {
      if (this.isHost()) {
         GameShell.showConfirmModal(
            "RETURN TO HUB?",
            "This will end the match for everyone and move the whole lobby back to the Hub. Are you sure?",
            async () => {
               window.isEndingGame = true; // Lock redirection logic
               await setLobbyGame(this.lobbyId, "HUB");
               window.location.href = '../../index.html' + (this.lobbyId ? `?lobby=${this.lobbyId}` : '');
            }
         );
      } else {
         GameShell.showConfirmModal(
            "LEAVE MATCH?",
            "Are you sure you want to leave this match and return to the Hub?",
            async () => {
               const uId = window.CLIENT_ID || localStorage.getItem('gh_clientId');
               const pObj = window.currentLobbyData?.players?.find(p => p.id === uId);
               if (pObj) {
                  await leaveLobby(this.lobbyId, pObj);
               }
               window.location.href = '../../index.html';
            }
         );
      }
    } else {
       window.location.href = '../../index.html' + (this.lobbyId ? `?lobby=${this.lobbyId}` : '');
    }
  }

  setupFrameworkListeners() {
    // 1. Reset/Rematch Button
    if (this.dom.resetBtn) {
       this.dom.resetBtn.addEventListener('click', () => {
          if (this.isOnline) {
            if (this.isHost()) this.resetOnlineGame();
            else if (window.Notify) window.Notify.toast("Waiting for Host to restart...");
          } else {
            this.resetLocalGame();
          }
       });
    }

    // 2. Players Modal
    if (this.dom.playersBtn) {
       this.dom.playersBtn.addEventListener('click', () => {
          if (this.seating.maxPlayers > 1) {
             this.openPlayersModal();
          } else if (window.Notify) {
             window.Notify.toast("No seating management for solo games.");
          }
       });
    }

    // 3. Rules Modal
    if (this.dom.rulesBtn) {
       this.dom.rulesBtn.addEventListener('click', () => {
          this.openRulesModal();
          this.toggleSheet(false); // Close sheet when opening rules
       });
    }

    // 3.5. Tools Modal
    if (this.dom.toolsBtn) {
       this.dom.toolsBtn.addEventListener('click', () => {
          this.openToolsModal();
          this.toggleSheet(false); // Close sheet when opening tools
       });
    }

    // 4. Sheet Toggles
    const sheetOverlay = document.getElementById('sheet-overlay');
    const sheetClose = document.getElementById('sheet-header-close');

    if (sheetOverlay) sheetOverlay.addEventListener('click', () => this.toggleSheet(false));
    if (sheetClose) sheetClose.addEventListener('click', () => this.toggleSheet());

    // 5. Modal Close Listeners (Rules & Tools)
    const btnCloseRules = document.getElementById('btn-close-rules');
    const btnRulesOk = document.getElementById('btn-rules-ok');
    if (btnCloseRules) btnCloseRules.addEventListener('click', () => this.closeRulesModal());
    if (btnRulesOk) btnRulesOk.addEventListener('click', () => this.closeRulesModal());

    const btnCloseTools = document.getElementById('btn-close-tools');
    const btnToolsOk = document.getElementById('btn-tools-ok');
    if (btnCloseTools) btnCloseTools.addEventListener('click', () => this.closeToolsModal());
    if (btnToolsOk) btnToolsOk.addEventListener('click', () => this.closeToolsModal());

    // 6. Navigation
    if (this.dom.navHubBtn) {
       this.dom.navHubBtn.addEventListener('click', () => this.returnToHub());
    }
  }

  toggleSheet(forceState) {
    const sheet = document.getElementById('control-sheet');
    const overlay = document.getElementById('sheet-overlay');
    if (!sheet || !overlay) return;

    const isVisible = (forceState !== undefined) ? forceState : !sheet.classList.contains('active');
    
    if (isVisible) {
       sheet.classList.add('active');
       overlay.classList.remove('hidden');
    } else {
       sheet.classList.remove('active');
       overlay.classList.add('hidden');
    }
  }

  openRulesModal() {
    const modal = document.getElementById('rules-modal');
    const contentBody = document.getElementById('rules-content-body');
    if (!modal) return;

    if (contentBody && this.engine && this.engine.getRulesHTML) {
       contentBody.innerHTML = this.engine.getRulesHTML();
    }
    
    modal.classList.remove('hidden');
  }

  closeRulesModal() {
    const modal = document.getElementById('rules-modal');
    if (modal) modal.classList.add('hidden');
  }

  async checkDevMode() {
    if (window.isDevMode !== undefined) return window.isDevMode;

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('debug') || urlParams.get('dev') === 'true') {
       window.isDevMode = true;
       return true;
    }

    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
       window.isDevMode = true;
       return true;
    }

    try {
      const root = window.getProjectRoot ? window.getProjectRoot() : '../../';
      const res = await fetch(root + '.dev', { method: 'HEAD' }).catch(() => null);
      if (res && (res.ok || res.status === 200)) {
         window.isDevMode = true;
         return true;
      }
    } catch(e) { /* ignore */ }

    window.isDevMode = false;
    return false;
  }

  openToolsModal() {
     const modal = document.getElementById('fw-tools-modal');
     const contentBody = document.getElementById('tools-content-body');
     if (!modal) return;

     if (contentBody) {
        if (this.engine && this.engine.getToolsHTML) {
           contentBody.innerHTML = this.engine.getToolsHTML(this.gameState, this);
        } else {
           contentBody.innerHTML = `
             <div style="padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px; text-align: center; color: var(--text-secondary);">
                <p style="margin: 0; font-size: 0.9rem;">🛠️ Dev Mode Active</p>
                <p style="font-size: 0.8rem; margin-top: 4px; opacity: 0.7;">No game-specific debug tools available for this game.</p>
             </div>
           `;
        }

        // Bind data-tool-action handlers
        const actionBtns = contentBody.querySelectorAll('[data-tool-action]');
        actionBtns.forEach(btn => {
           btn.onclick = () => {
              const actionType = btn.getAttribute('data-tool-action');
              let actionPayload = { type: actionType };
              const payloadStr = btn.getAttribute('data-tool-payload');
              if (payloadStr) {
                 try { actionPayload = { ...actionPayload, ...JSON.parse(payloadStr) }; } catch(e) {}
              }
              this.handleAction(actionPayload);
              setTimeout(() => this.openToolsModal(), 50);
           };
        });
     }

     modal.classList.remove('hidden');
  }

  closeToolsModal() {
     const modal = document.getElementById('fw-tools-modal');
     if (modal) modal.classList.add('hidden');
  }

  openSettingsModal() {
     const form = document.getElementById('fw-settings-form');
     if (!form || !this.engine.getSettingsHTML) return;
     
     const currentConfig = (this.gameState && this.gameState.config) || {};
     form.innerHTML = this.engine.getSettingsHTML(currentConfig);
     
     this.dom.settingsModal.classList.remove('hidden');
  }

  closeSettingsModal() {
     if (this.dom.settingsModal) this.dom.settingsModal.classList.add('hidden');
  }

  saveSettings() {
     const form = document.getElementById('fw-settings-form');
     if (!form || !this.engine.applySettings) return;

     const formData = new FormData(form);
     const result = this.engine.applySettings(formData);
     if (result && result.error) {
        if (window.Notify) window.Notify.toast("❌ " + result.error);
        return;
     }
     const newConfig = result;

     // Confirm and apply
     if (this.isOnline) {
        if (this.isHost()) {
           this.resetOnlineGame(newConfig);
        }
     } else {
        this.resetLocalGame(newConfig);
     }
     
     this.closeSettingsModal();
     if (window.Notify) window.Notify.toast("✅ Settings applied!");
  }

  resetSettingsToDefault() {
     if (this.isOnline) {
        if (this.isHost()) {
           this.resetOnlineGame({});
        } else {
           if (window.Notify) window.Notify.toast("Only the Host can reset settings.");
        }
     } else {
        this.resetLocalGame({});
     }

     this.closeSettingsModal();
     if (window.Notify) window.Notify.toast("🔄 Settings reset to defaults!");
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
    if (toolbar) {
       toolbar.classList.toggle('host-only', !isHost || !this.isOnline);
       
       // Handle Team Swap Button for local or host
       const canSwap = this.seating.archetype === 'teams' && this.seating.teams && this.seating.teams.length === 2;
       const swapContainer = document.getElementById('fw-toolbar-actions');
       if (swapContainer) {
          swapContainer.innerHTML = canSwap ? `<button class="btn btn-secondary btn-sm" id="fw-btn-swap-teams" title="Swap Sides">⇅ Swap Teams</button>` : '';
          const swapBtn = document.getElementById('fw-btn-swap-teams');
          if (swapBtn) swapBtn.onclick = () => this.swapTeams();
       }
    }

    // Get the right player pool (Online Lobby or Local Guests)
    this.lobbyPlayers = this.isOnline 
       ? (window.currentLobbyData?.players || []) 
       : this.localLobbyPlayers;

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
      const colors = GameFramework.COLORS;
      const colorMeta = colors.find(c => c.name === teamState.color) || colors[0];
      
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

         const colorsHTML = GameFramework.COLORS.map(c => {
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

    // 2. Spectators (Elastic Zone) - Only for Online games
    if (this.isOnline) {
       const specSection = document.createElement('div');
       specSection.style.marginTop = '1rem';
       specSection.innerHTML = `<label style="color: var(--text-secondary); font-size: 0.7rem; font-weight: 800; letter-spacing: 1px; text-transform: uppercase;">Spectators</label>`;
       
       const dropZone = document.createElement('div');
       dropZone.className = 'fw-drop-zone';
       dropZone.dataset.team = '_spec';

       const assignedIds = currentSlots.map(s => s.id).filter(id => id !== null);
       const spectators = this.lobbyPlayers.filter(p => !assignedIds.includes(p.id));

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
    }

    list.appendChild(container);
    
    // Re-initialize interaction behaviors
    this.setupSeatingInteractions();
  }

  setupSeatingInteractions() {
    // 1. Drag & Drop
    this.setupDragAndDrop();

    // 2. Tap-to-Move (Delegated Click)
    const container = document.getElementById('fw-players-modal')?.querySelector('.modal-content');
    if (!container) return;

    container.onclick = (e) => {
       const pill = e.target.closest('.fw-player-pill');
       const slot = e.target.closest('.fw-slot-placeholder') || e.target.closest('.fw-drop-zone');
       const isToolkit = e.target.closest('#fw-seating-toolbar');
       const isHeader = e.target.closest('.fw-team-header') || e.target.closest('h2') || e.target.closest('p');
       const isRename = e.target.closest('.fw-pill-rename');

       if (isToolkit) return;

       if (isRename && pill) {
          e.stopPropagation();
          this.editingPlayerId = pill.dataset.id;
          this.renderSeatingUI();
          return;
       }

       // --- MOVEMENT GUARDS ---
       if (!this.isOnline) return;

       if (pill) {
          if (this.selectedPillId === pill.dataset.id) {
             this.selectedPillId = null;
          } else {
             this.selectedPillId = pill.dataset.id;
          }
          this.renderSeatingUI();
       } 
       else if (slot && this.selectedPillId) {
          const targetTeam = slot.dataset.team;
          const targetIndex = parseInt(slot.dataset.index);
          this.moveToSlot(this.selectedPillId, targetTeam, targetIndex);
          this.selectedPillId = null;
       }
       else if (!isHeader && !e.target.closest('.fw-team-card')) {
          if (this.selectedPillId) {
             this.selectedPillId = null;
             this.renderSeatingUI();
          }
       }
    };
  }

  createPlayerPill(data, slotIndex) {
     const pill = document.createElement('div');
     pill.className = 'fw-player-pill';
     if (data.id === window.CLIENT_ID) pill.classList.add('is-me');
     if (this.selectedPillId === data.id) pill.classList.add('is-selected');
     pill.dataset.id = data.id;
     pill.dataset.slotIndex = slotIndex;

     // --- Inline Editor Mode ---
     if (this.editingPlayerId === data.id) {
        const editorContainer = document.createElement('div');
        editorContainer.className = 'fw-pill-editor';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'fw-pill-input';
        input.value = data.name;
        input.maxLength = 15;
        
        let selectedColorName = data.color || null;

        input.onblur = (e) => {
           // Small delay to allow swatch clicks to register first
           setTimeout(() => {
              if (this.editingPlayerId === data.id) this.savePlayerEdits(data.id, input.value, selectedColorName);
           }, 150);
        };
        input.onkeydown = (e) => {
           if (e.key === 'Enter') {
              e.preventDefault();
              this.savePlayerEdits(data.id, input.value, selectedColorName);
           }
           if (e.key === 'Escape') {
              this.editingPlayerId = null;
              this.renderSeatingUI();
           }
        };

        editorContainer.appendChild(input);

        // FFA Color Picker
        if (this.seating.archetype === 'ffa') {
           const colorPicker = document.createElement('div');
           colorPicker.className = 'fw-color-picker';

           // Identify taken colors by OTHER players
           const takenColors = this.gameState.slots
              .filter(s => s.id && s.id !== data.id)
              .map(s => s.color);

           GameFramework.COLORS.forEach(c => {
              if (c.name === 'Neutral') return;
              
              const swatch = document.createElement('div');
              swatch.className = 'fw-color-swatch';
              swatch.style.background = c.value;
              swatch.title = c.name;

              const isTaken = takenColors.includes(c.name);
              const isSelected = selectedColorName === c.name;

              if (isTaken) swatch.classList.add('taken');
              if (isSelected) swatch.classList.add('selected');

              swatch.onclick = (e) => {
                 e.stopPropagation();
                 if (isTaken) return;
                 selectedColorName = c.name;
                 this.savePlayerEdits(data.id, input.value, selectedColorName);
              };

              colorPicker.appendChild(swatch);
           });
           editorContainer.appendChild(colorPicker);
        }

        pill.appendChild(editorContainer);
        setTimeout(() => input.focus(), 50);
        return pill;
     }

     // --- View Mode ---
     const isLocalGuest = !this.isOnline || (data.id && data.id.startsWith('guest-'));
     const slotColor = this.getSlotColor(slotIndex);

     const showIndicator = this.seating.archetype === 'ffa' || this.seating.archetype === 'coop';

     pill.innerHTML = `
        ${showIndicator ? `<div class="fw-player-color-indicator" style="background: ${slotColor}"></div>` : ''}
        <span class="fw-pill-name">${data.name}${data.id === window.CLIENT_ID ? ' (You)' : ''}</span>
        ${isLocalGuest ? `<div class="fw-pill-rename" title="Rename Player">✏️</div>` : ''}
     `;
     return pill;
  }

  savePlayerEdits(playerId, newName, newColor) {
     if (!this.editingPlayerId) return;
     
     const player = this.lobbyPlayers.find(p => p.id === playerId);
     if (player) {
        // Update Name
        if (newName && newName.trim()) {
           player.name = newName.trim().substring(0, 15);
        }
        
        // Update Color for FFA
        if (newColor && this.seating.archetype === 'ffa') {
           player.color = newColor;
        }

        // 2. Update all slots matching this ID
        this.gameState.slots = this.gameState.slots.map(s => {
           if (s.id === playerId) {
              const updated = { ...s, name: player.name };
              if (newColor) updated.color = newColor;
              return updated;
           }
           return s;
        });

        // 3. Persist & Clean up
        this.commit(this.gameState);
     }
     
     this.editingPlayerId = null;
     this.renderSeatingUI();
  }

  setupDragAndDrop() {
    if (!this.isOnline) return;
    
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
      
      const isHost = this.isHost();
      console.log(`[Framework] Lobby Snapshot. Host: ${isHost}, GameState: ${!!data.gameState}`);

      if (!data.gameState || !data.gameState.status) {
        if (isHost && data.currentGame !== 'STAGING' && data.currentGame !== 'HUB') {
          console.log("[Framework] No game state found. I am host, initializing...");
          this.initServerState(data);
        } else {
          console.log("[Framework] No game state found. I am guest, waiting for host...");
        }
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
    state.status = this.hasLobby ? 'waiting' : 'playing';
    state.started = !this.hasLobby; // Skip lobby if game doesn't need it
    state.teams = {};
    state.slots = [];
    
    // 1. Generate initial slots & teams based on seating config
    if (this.seating.archetype === 'ffa' || this.seating.archetype === 'coop') {
       const min = this.seating.minPlayers || 2;
       for (let i = 0; i < min; i++) {
          const colorIdx = (i % (GameFramework.COLORS.length - 1)) + 1;
          const team = this.seating.archetype === 'coop' ? '_coop' : '_default';
          state.slots.push({ id: null, name: 'Waiting...', team, color: GameFramework.COLORS[colorIdx].name });
       }
       if (this.seating.archetype === 'coop') {
          state.teams['_coop'] = { name: this.seating.teamName || 'Team', color: this.seating.color || 'Mint' };
       }
    } else if (this.seating.archetype === 'teams') {
       this.seating.teams.forEach(t => {
          state.teams[t.id] = { name: t.name, color: t.color || 'Neutral' };
          for (let i = 0; i < t.min; i++) {
             state.slots.push({ id: null, name: 'Waiting...', team: t.id });
          }
       });
    }

    // 2. Auto-Assign available players (Randomized)
    this.autoAssignPlayers(state, lobbyData.players);

    this.commit(state);
  }

  autoAssignPlayers(state, lobbyPlayers, shouldShuffle = true) {
    if (!state || !state.slots) return;
    
    // Clear existing assignments first to start fresh
    state.slots.forEach(s => s.id = null);
    
    // Fisher-Yates Shuffle (Optional)
    const players = [...lobbyPlayers];
    if (shouldShuffle) {
      for (let i = players.length - 1; i > 0; i--) {
         const j = Math.floor(Math.random() * (i + 1));
         [players[i], players[j]] = [players[j], players[i]];
      }
    }

    const available = [...players];
    
    // Pass 1: Fill mandatory slots
    state.slots = state.slots.map(slot => {
       if (available.length > 0) {
          const p = available.shift();
          return { ...slot, id: p.id, name: p.name, icon: p.icon || '👤' };
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
                state.slots.push({ id: p.id, name: p.name, team: t.id, icon: p.icon || '👤' });
             }
          });
       } else {
          const groupKey = this.seating.archetype === 'coop' ? '_coop' : '_default';
          const max = this.seating.maxPlayers || 99;
          while (available.length > 0 && state.slots.length < max) {
             const p = available.shift();
             state.slots.push({ id: p.id, name: p.name, team: groupKey, icon: p.icon || '👤' });
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
    if (!this.isOnline) return true; // Local mode: everyone is the host
    const clientId = window.CLIENT_ID || localStorage.getItem('gh_clientId');
    const isHost = window.currentLobbyData && window.currentLobbyData.hostId === clientId;
    return !!isHost;
  }

  async handleAction(action) {
    if (this.gameState.status === 'finished') return;
    if (this.isOnline) {
       const isStartAction = action.type === 'start' || action.type === 'startMatch';
       if (!isStartAction && this.gameState.activeSlotIndex !== null && this.mySlotIndex !== this.gameState.activeSlotIndex) {
          const expected = this.gameState.slots[this.gameState.activeSlotIndex]?.name || "another player";
          if (window.Notify) window.Notify.toast(`It's not your turn! Waiting for ${expected}.`);
          return;
       }
    }
    const newState = this.engine.applyMove(this.gameState, action, this.gameState.activeSlotIndex);
    if (!newState) return;

    // Capture modular context from engine
    if (newState.statusText) this.gameState.statusText = newState.statusText;
    if (newState.blockerTitle) this.gameState.blockerTitle = newState.blockerTitle;

    const gameOver = this.engine.checkGameOver(newState, this.gameState.activeSlotIndex, this.mySlotIndex, this.isOnline);
    if (gameOver) {
       newState.status = 'finished';
       newState.winner = gameOver.winner ?? null;
       newState.winningLine = gameOver.winningLine ?? null;
       newState.gameOverTitle = gameOver.title ?? null;
       newState.gameOverSubtitle = gameOver.subtitle ?? null;
       newState.glowColor = gameOver.glowColor ?? null;
    } else {
        // The engine is now responsible for updating activeSlotIndex.
        // We just check if it changed to trigger Pass the Phone.

       const oldSlot = this.gameState.activeSlotIndex;
       const newSlot = newState.activeSlotIndex;
       
       if (!this.isOnline && this.passThePhone && newSlot !== oldSlot && newSlot !== null) {
          const nextName = this.gameState.slots[newSlot].name;
          document.getElementById('fw-next-player-name').innerText = nextName;
          
          // Modular Blocker Title
          const passTitleEl = document.getElementById('fw-pass-title');
          if (passTitleEl) {
             passTitleEl.innerText = newState.blockerTitle || "PASS DEVICE";
          }
          
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
       try {
          await updateGameState(this.lobbyId, state);
       } catch (err) {
          console.error("GameFramework: commit failed:", err);
       }
    }
    
    this.renderFrameworkUI();
    if (this.ui && this.ui.render) this.ui.render(this.gameState, this);
  }

  resetLocalGame(newConfig = null) {
    const config = newConfig || (this.gameState && this.gameState.config) || {};
    this.gameState = this.engine.getInitialState(config);
    this.gameState.config = config; // Ensure config is persisted
    this.gameState.status = this.hasLobby ? 'waiting' : 'playing';
    this.gameState.started = !this.hasLobby; // Skip lobby if game doesn't need it
    this.gameState.teams = {};
    
    // 1. Generate initial slots & teams based on seating config
    const initialSlots = [];
    if (this.seating.archetype === 'ffa' || this.seating.archetype === 'coop') {
       const min = this.seating.minPlayers || 2;
       for (let i = 0; i < min; i++) {
          const colorIdx = (i % (GameFramework.COLORS.length - 1)) + 1;
          const team = this.seating.archetype === 'coop' ? '_coop' : '_default';
          initialSlots.push({ id: null, name: 'Waiting...', team, color: GameFramework.COLORS[colorIdx].name });
       }
       if (this.seating.archetype === 'coop') {
          this.gameState.teams['_coop'] = { name: this.seating.teamName || 'Team', color: this.seating.color || 'Mint' };
       }
    } else if (this.seating.archetype === 'teams') {
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

    // 2. Local-only: Populate a fixed guest pool if no lobby exists
    if (!this.isOnline) {
       const profileName = localStorage.getItem('gh_username') || 'Guest';
       const profileIcon = localStorage.getItem('gh_usericon') || '👤';
       
       let savedPlayers = [];
       try {
          savedPlayers = JSON.parse(localStorage.getItem('gh_local_players')) || [];
       } catch (e) {
          savedPlayers = [];
       }

       const maxPossible = this.seating.maxPlayers || 8;
       
       // Cache the existing player names/icons so we don't lose custom renames on rematch
       const existingNames = {};
       const existingIcons = {};
       if (this.localLobbyPlayers && this.localLobbyPlayers.length > 0) {
          this.localLobbyPlayers.forEach(p => {
             existingNames[p.id] = p.name;
             existingIcons[p.id] = p.icon;
          });
       }

       this.localLobbyPlayers = [];
       for (let i = 1; i <= maxPossible; i++) {
          const guestId = `guest-${i}`;
          let name = existingNames[guestId];
          let icon = existingIcons[guestId];

          if (!name) {
             name = i === 1 ? profileName : (savedPlayers[i - 2] || `Guest ${i - 1}`);
             icon = i === 1 ? profileIcon : '👤';
          }
          this.localLobbyPlayers.push({ id: guestId, name: name, icon: icon });
       }
    }

    // 3. Auto-Assign available players (Don't shuffle on local reset to keep player 1 in slot 0)
    const playersToAssign = this.isOnline 
       ? (window.currentLobbyData?.players || []) 
       : this.localLobbyPlayers;
       
    this.autoAssignPlayers(this.gameState, playersToAssign, false);
    this.updateMySlot();
    
    // Note: We deliberately DO NOT force activeSlotIndex = 0 here anymore.
    // We let the engine's getInitialState value stand (e.g. null for Codenames).
    
    if (this.dom.gameOverOverlay) this.dom.gameOverOverlay.classList.remove('visible');
    this.gameOverDismissed = false;
    this.stopConfetti();
    this.renderFrameworkUI();
    if (this.ui && this.ui.render) this.ui.render(this.gameState, this);
  }

  resetOnlineGame(newConfig = null) {
    const config = newConfig || (this.gameState && this.gameState.config) || {};
    const newState = this.engine.getInitialState(config);
    newState.config = config; // Ensure config is persisted
    newState.slots = this.gameState.slots; 
    newState.teams = this.gameState.teams; 
    newState.status = 'playing';
    
    // Respect engine's initial activeSlotIndex if provided (e.g., null for Codenames Duet)
    if (newState.activeSlotIndex === undefined) {
       newState.activeSlotIndex = 0;
    }
    
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
          return { ...s, id: null, name: 'Waiting...', icon: '👤' };
       }
       return s;
    });

    // 2. Assign to new slot if not spectator
    if (teamKey !== '_spec') {
       if (isNaN(slotIndex) || slotIndex === -1) {
          // Elastic zone drop OR Virtual Placeholder
          const firstEmpty = newState.slots.findIndex(s => s.team === teamKey && s.id === null);
          if (firstEmpty !== -1) {
             newState.slots[firstEmpty] = { id: playerId, name: player.name, team: teamKey, icon: player.icon || '👤' };
          } else {
             newState.slots.push({ id: playerId, name: player.name, team: teamKey, icon: player.icon || '👤' });
          }
       } else {
          // Fixed slot drop
          newState.slots[slotIndex] = { id: playerId, name: player.name, team: teamKey, icon: player.icon || '👤' };
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

  async swapTeams() {
     if (!this.gameState || !this.seating.teams || this.seating.teams.length !== 2) return;
     
     const teamAKey = this.seating.teams[0].id;
     const teamBKey = this.seating.teams[1].id;
     
     const newState = { ...this.gameState };
     newState.slots = this.gameState.slots.map(slot => {
        if (slot.team === teamAKey) return { ...slot, team: teamBKey };
        if (slot.team === teamBKey) return { ...slot, team: teamAKey };
        return slot;
     });
     
     // Re-sort slots by team to maintain order if using teams
     newState.slots.sort((a,b) => {
        const order = [teamAKey, teamBKey, '_default', '_spec'];
        return order.indexOf(a.team) - order.indexOf(b.team);
     });

     await this.commit(newState);
     this.renderSeatingUI();
     if (window.Notify) window.Notify.toast("Teams Swapped!");
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

    this.updateControls(); // Standardized 4-button management
    
    if (this.dom.turnIndicator) {
       const status = this.gameState.status;

       if (status === 'waiting') {
          // --- LOBBY WAITING PHASE ---
          this.dom.turnIndicator.classList.add('text-gradient');
          this.dom.turnIndicator.style.webkitTextFillColor = 'transparent';
          this.dom.turnIndicator.innerText = "Lobby: Assigning Players";
          
          if (this.dom.resetBtn) {
             this.dom.resetBtn.disabled = this.isOnline && !this.isHost();
             this.dom.resetBtn.onclick = () => this.isOnline ? (this.isHost() && this.resetOnlineGame()) : this.resetLocalGame();
          }
       } else if (status === 'finished') {
          // --- MATCH FINISHED ---
          if (this.dom.resetBtn) {
             this.dom.resetBtn.disabled = this.isOnline && !this.isHost();
             this.dom.resetBtn.onclick = () => this.isOnline ? (this.isHost() && this.resetOnlineGame()) : this.resetLocalGame();
          }

          if (this.gameState.winner === 'draw') {
             this.dom.turnIndicator.classList.add('text-gradient');
             this.dom.turnIndicator.style.webkitTextFillColor = 'transparent';
             this.dom.turnIndicator.innerText = "It's a Draw!";
             this.showGameOver('draw');
          } else if (this.gameState.winner === 'victory') {
             this.dom.turnIndicator.classList.add('text-gradient');
             this.dom.turnIndicator.style.webkitTextFillColor = 'transparent';
             this.dom.turnIndicator.innerText = "VICTORY!";
             this.showGameOver('victory');
          } else if (this.gameState.winner === 'defeat' || typeof this.gameState.winner === 'string') {
             // Handle 'defeat' or any custom string outcomes like 'assassin' or 'timeout'
             this.dom.turnIndicator.classList.add('text-gradient');
             this.dom.turnIndicator.style.webkitTextFillColor = 'transparent';
             this.dom.turnIndicator.innerText = this.gameState.statusText || "Mission Failed! ❌";
             this.showGameOver(this.gameState.winner);
          } else {
             // Fallback for numeric indices (the winner[s] of competitive games)
             const winners = Array.isArray(this.gameState.winner) ? this.gameState.winner : [this.gameState.winner];
             const winnerColor = this.getSlotColor(winners[0]);
             
             this.dom.turnIndicator.classList.remove('text-gradient');
             this.dom.turnIndicator.style.webkitTextFillColor = 'initial';

             if (winners.length === 1 && winners[0] === this.mySlotIndex) {
                 this.dom.turnIndicator.innerHTML = `<span style="color: ${winnerColor}; font-weight: 800;">YOU WIN!</span>`;
             } else {
                 const winnerNames = winners.map(idx => this.gameState.slots[idx]?.name || "Winner").join(' & ');
                 this.dom.turnIndicator.innerHTML = `<span style="color: ${winnerColor}; font-weight: 800;">${winnerNames}</span> Wins!`;
             }
             this.showGameOver(winners[0]); 
          }
       } else {
          // --- PLAYING ---
          if (this.dom.resetBtn) {
             this.dom.resetBtn.disabled = this.isOnline && !this.isHost();
             this.dom.resetBtn.onclick = () => this.isOnline ? (this.isHost() && this.resetOnlineGame()) : this.resetLocalGame();
          }

          if (this.gameState.activeSlotIndex === null) {
             this.dom.turnIndicator.classList.add('hidden');
          } else {
             const activeSlot = this.gameState.slots[this.gameState.activeSlotIndex];
             const isMyTurn = (this.mySlotIndex === this.gameState.activeSlotIndex);
             const teamColor = this.getSlotColor(this.gameState.activeSlotIndex);
             
             const nameToDisplay = isMyTurn ? "YOUR" : `${activeSlot.name.toUpperCase()}'S`;
             
             // Look for a symbol (like X or O) in the team config
             let symbolSuffix = "";
             if (this.seating.archetype === 'teams' && activeSlot.team) {
                const teamCfg = this.seating.teams.find(t => t.id === activeSlot.team);
                if (teamCfg && teamCfg.symbol) {
                   symbolSuffix = ` (${teamCfg.symbol.toUpperCase()})`;
                }
             }
             
             this.dom.turnIndicator.classList.remove('text-gradient');
             this.dom.turnIndicator.style.webkitTextFillColor = 'initial'; // Override transparent
             
             if (this.gameState.statusText) {
                this.dom.turnIndicator.innerHTML = `<span style="color: ${teamColor}; font-weight: 900;">${this.gameState.statusText.toUpperCase()}</span>`;
             } else {
                this.dom.turnIndicator.innerHTML = `<span style="color: ${teamColor}; font-weight: 900;">${nameToDisplay} TURN${symbolSuffix}</span>`;
             }
          }
          
          if (this.dom.gameOverOverlay) {
             this.dom.gameOverOverlay.classList.remove('visible');
             this.gameOverDismissed = false;
             this.stopConfetti();
          }
       }
    }
    this.checkPreGameStatus();
  }

  updateControls() {
    const isHost = this.isHost();
    const isOnline = this.isOnline;
    const hasSettings = this.engine && (this.engine.hasSettings || this.engine.constructor?.hasSettings);

    // 1. Rules: Always enabled
    if (this.dom.rulesBtn) {
       this.dom.rulesBtn.disabled = false;
       this.dom.rulesBtn.style.display = 'flex';
    }

    // 2. Players: Enabled if maxPlayers > 1
    if (this.dom.playersBtn) {
       const isSolo = (this.seating.maxPlayers || 2) === 1;
       this.dom.playersBtn.disabled = isSolo;
       this.dom.playersBtn.style.display = 'flex';
    }

    // 3. Game Settings: Host-only online, clickable if engine supports
    if (this.dom.settingsBtn) {
       const hasSettings = this.engine && (this.engine.hasSettings || this.engine.getSettingsHTML);
       const shouldShow = !isOnline || isHost;
       this.dom.settingsBtn.style.display = shouldShow ? 'flex' : 'none';
       this.dom.settingsBtn.disabled = !hasSettings;
       this.dom.settingsBtn.onclick = hasSettings ? () => this.openSettingsModal() : null;
    }

    // 4. Reset: Host-only online, always shown
    if (this.dom.resetBtn) {
       const shouldShow = !isOnline || isHost;
       this.dom.resetBtn.style.display = shouldShow ? 'flex' : 'none';
       this.dom.resetBtn.disabled = isOnline && !this.isHost();
    }
  }

  showGameOver(winnerIndex) {
    if (!this.dom.gameOverOverlay || this.gameOverDismissed) return;
    const title = document.getElementById('fw-gameover-title');
    const subtitle = document.getElementById('fw-winner-name');
    const glow = document.getElementById('fw-glow');

    const colors = GameFramework.COLORS;
    let colorMeta = colors[0];

    if (winnerIndex === 'draw') {
       title.innerText = this.gameState.gameOverTitle || "IT'S A DRAW";
       subtitle.innerText = this.gameState.gameOverSubtitle || "A perfectly balanced match! 🤝";
       glow.style.background = `radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)`;
    } else if (winnerIndex === 'defeat' || winnerIndex === 'victory') {
       // Cooperative / Named Global States
       const isWin = winnerIndex === 'victory';
       title.innerText = this.gameState.gameOverTitle || (isWin ? "VICTORY" : "DEFEAT");
       subtitle.innerText = this.gameState.gameOverSubtitle || (isWin ? "Victory" : "Defeat");
       
       const glowCol = isWin ? "rgba(16, 185, 129, 0.1)" : "rgba(255, 107, 107, 0.1)";
       glow.style.background = `radial-gradient(circle, ${glowCol} 0%, transparent 70%)`;
    } else if (typeof winnerIndex === 'string') {
       // Catch-all for other named outcomes like 'assassin', 'timeout'
       title.innerText = this.gameState.gameOverTitle || "DEFEAT";
       subtitle.innerText = this.gameState.gameOverSubtitle || "Defeat";
       glow.style.background = `radial-gradient(circle, rgba(255, 107, 107, 0.1) 0%, transparent 70%)`;
    } else {
       // Competitive / Personal Indices
       const slotData = this.gameState.slots[winnerIndex];
       if (!slotData) {
          title.innerText = this.gameState.gameOverTitle || "GAME OVER";
          subtitle.innerText = this.gameState.gameOverSubtitle || "The match has concluded.";
          return;
       }

       const winnerName = slotData.name;
       
       // Determine personalization
       const isMyWin = (this.mySlotIndex === winnerIndex) || 
                       (this.mySlotIndex !== null && this.gameState.slots[this.mySlotIndex]?.team === slotData.team);

       title.innerText = isMyWin ? "VICTORY" : "DEFEAT";

       const teamKey = slotData.team || '_default';
       const teamState = (this.gameState.teams && this.gameState.teams[teamKey]) || { name: 'Players', color: 'Neutral' };
       colorMeta = colors.find(c => c.name === teamState.color) || colors[0];

       if (this.mySlotIndex === winnerIndex) {
          subtitle.innerHTML = `You won the match! 🏆`;
       } else {
          subtitle.innerHTML = `<span style="color: ${colorMeta.value}; font-weight: 800;">${winnerName}</span> wins the match!`;
       }
       glow.style.background = `radial-gradient(circle, ${colorMeta.value}26 0%, transparent 70%)`;
    }

    // Final glow override if engine provided a specific color
    if (this.gameState.glowColor) {
       glow.style.background = `radial-gradient(circle, ${this.gameState.glowColor}44 0%, transparent 70%)`;
    }

    const isMyWin = (winnerIndex === 'victory') || (this.mySlotIndex === winnerIndex) || 
                                         (this.mySlotIndex !== null && this.gameState.slots?.[this.mySlotIndex]?.team && this.gameState.slots?.[this.mySlotIndex]?.team === (this.gameState.slots?.[winnerIndex]?.team));

    const isAlreadyShowing = this.dom.gameOverOverlay.classList.contains('visible');
    if (!isAlreadyShowing && (isMyWin || this.mySlotIndex === null)) {
       this.triggerConfetti(colorMeta.value);
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
