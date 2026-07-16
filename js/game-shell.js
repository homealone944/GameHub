/* js/game-shell.js */

/**
 * GameShell handles the "Standard Premium Shell" for all GameHub games.
 * This includes the header, central container, and interactive bottom sheet.
 * It is decoupled from networking (lobby sync) to support local/offline play.
 */
export class GameShell {
  static injectBaseShell() {
    const mount = document.getElementById('game-mount');
    if (!mount || mount.querySelector('.game-viewport')) return;

    const gameTitle = document.title.split('|')[0].trim();
    const hasCustomStatus = !!mount.querySelector('#game-status-bar');

    const shellHTML = `
      <div class="game-viewport">
        
        <!-- Premium Top Bar -->
        <header class="game-header">
          <div class="nav-left">
            <button id="nav-btn-hub" class="logo-text text-gradient" style="border:none; cursor:pointer; padding:0; font-family:inherit;">
              <span class="logo-full">GameHub</span>
              <span class="logo-short">GH</span>
            </button>
          </div>
          <div class="nav-center">
            <h2 class="nav-game-title">${gameTitle}</h2>
          </div>
          <div class="nav-right" id="header-nav-right">
             <!-- Profile Button injected by ProfileManager -->
          </div>
        </header>

        <!-- Main Content Area -->
        <main class="game-body">
          
          <!-- Standard Status Bar (Only if not provided by game) -->
          ${!hasCustomStatus ? `
          <div id="game-status-bar" class="status-bar-premium">
              <div class="status-item">
                <div class="status-label">GAME STATUS</div>
                <div id="turn-indicator" class="status-value text-gradient">WAITING...</div>
                <div id="self-role-badge" class="role-badge spectating">SPECTATING</div>
              </div>
          </div>
          ` : ''}

          <div id="central-game-container">
             <!-- Game mount moved here -->
          </div>

        </main>

        <!-- Interactive Bottom Sheet -->
        <div id="control-sheet" class="bottom-sheet">
          <div id="sheet-header-close" class="sheet-header">
            <div class="sheet-handle"></div>
          </div>
          
          <div class="sheet-content">
            <button id="btn-rules" class="sheet-btn">
              <span>📖</span>
              <span>Rules</span>
            </button>
            <button id="btn-players" class="sheet-btn">
              <span>👥</span>
              <span>Players</span>
            </button>
            <button id="btn-settings" class="sheet-btn">
              <span>⚙️</span>
              <span>Settings</span>
            </button>
            <button id="btn-rematch" class="sheet-btn" style="color: var(--accent-coral);">
              <span>🔄</span>
              <span>Reset</span>
            </button>
          </div>
        </div>

        <!-- Overlay for closure -->
        <div id="sheet-overlay" class="hidden" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.3); z-index:115;"></div>

      </div>

      <!-- Pre-Game "Lobby" Modal -->
      <div id="fw-pregame-modal" class="modal hidden">
        <div class="modal-content" style="max-width: 450px; padding: 2.5rem 2rem; position: relative;">
          <!-- Exit to Hub Button -->
          <button id="fw-btn-lobby-hub" class="btn-close" style="top: 1rem; left: 1rem; right: auto; font-size: 1.2rem; transform: scaleX(1.5);" title="Return to Hub">&lsaquo;</button>

          <h1 class="text-gradient" id="fw-lobby-title" style="font-size: 2.5rem; margin-bottom: 0.5rem; letter-spacing: -1px;">SETUP</h1>
          <p id="fw-lobby-desc" style="color: var(--text-secondary); margin-bottom: 2.5rem; font-weight: 500;">
            Start the game when ready!
          </p>

          <!-- Host / Local Controls -->
          <div id="fw-host-controls" class="modal-actions" style="display: flex; flex-direction: column; gap: 1rem; width: 100%;">
            <button id="fw-btn-start" class="btn btn-mint w-100" style="padding: 1.25rem; font-size: 1.1rem; font-weight: 900; letter-spacing: 2px;">START GAME</button>
            
            <div style="display: flex; gap: 1rem; width: 100%;">
              <button id="fw-btn-lobby-players" class="btn btn-secondary w-100" style="background: rgba(255,255,255,0.05); color: white; padding: 1rem; flex: 1; display: flex; align-items: center; justify-content: center; font-weight: 800; border: 1px solid rgba(255,255,255,0.05);">
                <span style="font-size: 1.2rem; margin-right: 10px; display: inline-flex; width: 24px; justify-content: center;">👥</span> Players
              </button>
              <button id="fw-btn-lobby-settings" class="btn btn-secondary w-100" style="background: rgba(255,255,255,0.05); color: white; padding: 1rem; flex: 1; display: flex; align-items: center; justify-content: center; font-weight: 800; border: 1px solid rgba(255,255,255,0.05);">
                <span style="font-size: 1.2rem; margin-right: 10px; display: inline-flex; width: 24px; justify-content: center;">⚙️</span> Settings
              </button>
            </div>
          </div>
          
          <!-- Guest View -->
          <div id="fw-guest-controls" class="hidden" style="width: 100%; display: flex; flex-direction: column; gap: 1rem;">
             <div style="padding: 1.25rem; background: rgba(255,255,255,0.03); border-radius: 16px; border: 1px solid rgba(255,255,255,0.05); color: var(--accent-coral); font-weight: 800; font-size: 0.9rem; letter-spacing: 1px; text-align: center;">
                WAITING FOR HOST TO START...
             </div>
             <button id="fw-btn-lobby-players-guest" class="btn btn-secondary w-100" style="background: rgba(255,255,255,0.05); color: white; padding: 1rem; display: flex; align-items: center; justify-content: center; font-weight: 800; border: 1px solid rgba(255,255,255,0.05);">
                <span style="font-size: 1.2rem; margin-right: 10px; display: inline-flex; width: 24px; justify-content: center;">👥</span> Players
             </button>
          </div>

          <!-- Shared Footer -->
          <div style="margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid rgba(255,255,255,0.05); width: 100%;">
             <button id="fw-btn-lobby-rules" class="btn btn-link" style="color: var(--text-secondary); font-weight: 600; opacity: 0.7; transition: opacity 0.2s;">
                <span style="margin-right: 6px;">📖</span> View Game Rules
             </button>
          </div>
        </div>
      </div>

      <!-- Confirmation Modal -->
      <div id="fw-confirm-modal" class="modal hidden" style="z-index: 12000;">
        <div class="modal-content" style="max-width: 400px; padding: 2.5rem 2rem;">
          <h2 id="fw-confirm-title" class="text-gradient" style="margin-bottom: 0.5rem; font-size: 1.8rem;">ARE YOU SURE?</h2>
          <p id="fw-confirm-msg" style="color: var(--text-secondary); margin-bottom: 2rem; font-size: 0.95rem; line-height: 1.5;">
            Action description goes here.
          </p>
          <div style="display: flex; gap: 1rem; width: 100%;">
            <button id="fw-btn-confirm-cancel" class="btn btn-secondary w-100" style="padding: 0.75rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);">Cancel</button>
            <button id="fw-btn-confirm-ok" class="btn btn-mint w-100" style="padding: 0.75rem;">Confirm</button>
          </div>
        </div>
      </div>

      <!-- Common Rules Modal (Defined last to appear on top) -->
      <div id="rules-modal" class="modal hidden" style="z-index: 10001;">
        <div class="modal-content text-left">
          <h2 class="text-gradient">${gameTitle} Rules</h2>
          <button class="btn-close" id="btn-close-rules">&times;</button>
          
          <div id="rules-content-body" style="margin-top: 1rem; color: var(--text-secondary); line-height: 1.6; font-size: 0.95rem;">
            <!-- Content injected via Engine.getRulesHTML() -->
          </div>
          <button id="btn-rules-ok" class="btn btn-mint mt-2 w-100">Understood</button>
        </div>
      </div>
    `;

    // Inject into body
    const viewportBox = document.createElement('div');
    viewportBox.innerHTML = shellHTML;
    
    // We prepend to avoid interfering with game-mount scripts if any
    const children = Array.from(viewportBox.children);
    children.reverse().forEach(child => document.body.prepend(child));

    // Move game-mount into the container
    const container = document.getElementById('central-game-container');
    const gameBody = document.querySelector('.game-body');
    const customStatus = mount.querySelector('#game-status-bar');

    if (customStatus && gameBody) {
      gameBody.insertBefore(customStatus, container);
    }
    if (container) {
      container.appendChild(mount);
    }
  }

  static toggleSheet(force) {
    const sheet = document.getElementById('control-sheet');
    const overlay = document.getElementById('sheet-overlay');
    if (!sheet || !overlay) return;

    const isActive = (force !== undefined) ? force : !sheet.classList.contains('active');
    sheet.classList.toggle('active', isActive);
    overlay.classList.toggle('hidden', !isActive);
  }

  static showPreGameModal(isHost, onStart, onPlayers, onRules, onSettings, onHub) {
     const modal = document.getElementById('fw-pregame-modal');
     const hostControls = document.getElementById('fw-host-controls');
     const guestControls = document.getElementById('fw-guest-controls');
     
     const startBtn = document.getElementById('fw-btn-start');
     const playersBtn = document.getElementById('fw-btn-lobby-players');
     const playersGuestBtn = document.getElementById('fw-btn-lobby-players-guest');
     const settingsBtn = document.getElementById('fw-btn-lobby-settings');
     const rulesBtn = document.getElementById('fw-btn-lobby-rules');
     const hubBtn = document.getElementById('fw-btn-lobby-hub');

     if (!modal) {
        console.warn("[GameShell] fw-pregame-modal NOT FOUND");
        return;
     }
     
     console.log(`[GameShell] Showing PreGame Modal. isHost: ${isHost}, Current Classes: ${modal.className}`);
     modal.classList.remove('hidden');
     modal.style.display = 'flex'; // Force visibility
     modal.style.opacity = '1';
     modal.style.visibility = 'visible';

     if (isHost) {
        if (hostControls) hostControls.classList.remove('hidden');
        if (guestControls) guestControls.classList.add('hidden');
     } else {
        if (hostControls) hostControls.classList.add('hidden');
        if (guestControls) guestControls.classList.remove('hidden');
     }

     if (startBtn) startBtn.onclick = onStart;
     if (playersBtn) playersBtn.onclick = onPlayers;
     if (playersGuestBtn) playersGuestBtn.onclick = onPlayers;
     if (settingsBtn) {
        settingsBtn.onclick = onSettings;
        settingsBtn.style.display = onSettings ? 'flex' : 'none';
     }
     if (rulesBtn) rulesBtn.onclick = onRules;
     if (hubBtn) hubBtn.onclick = onHub;
  }

  static hidePreGameModal() {
     document.getElementById('fw-pregame-modal')?.classList.add('hidden');
  }

  static showConfirmModal(title, msg, onConfirm) {
     const modal = document.getElementById('fw-confirm-modal');
     const titleEl = document.getElementById('fw-confirm-title');
     const msgEl = document.getElementById('fw-confirm-msg');
     const okBtn = document.getElementById('fw-btn-confirm-ok');
     const cancelBtn = document.getElementById('fw-btn-confirm-cancel');
     
     if (!modal) return;
     
     if (titleEl) titleEl.innerText = title;
     if (msgEl) msgEl.innerText = msg;
     
     okBtn.onclick = () => {
        onConfirm();
        this.hideConfirmModal();
     };
     cancelBtn.onclick = () => this.hideConfirmModal();
     
     modal.classList.remove('hidden');
  }

  static hideConfirmModal() {
     const modal = document.getElementById('fw-confirm-modal');
     if (modal) modal.classList.add('hidden');
  }
}
