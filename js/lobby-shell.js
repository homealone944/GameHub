/* js/lobby-shell.js */
import { subscribeToLobby, leaveLobby, deleteLobby, setLobbyGame, changeHost, broadcastMessage, updatePlayerName, updateLobbySettings, setVote, touchLobby, getAllLobbies } from './database-manager.js';

// Client Session ID (shared across all pages via localStorage)
let CLIENT_ID = localStorage.getItem('gh_clientId');
if (!CLIENT_ID) {
  CLIENT_ID = 'client_' + Math.random().toString(36).substr(2, 9);
  localStorage.setItem('gh_clientId', CLIENT_ID);
}

const urlParams = new URLSearchParams(window.location.search);
const LOBBY_ID = urlParams.get('lobby') ? urlParams.get('lobby').trim().toUpperCase() : null;

// Global State Exposure
window.CLIENT_ID = CLIENT_ID;
window.currentLobbyId = LOBBY_ID;
window.currentLobbyData = null;
window.isEndingGame = false; // Prevents local redirect-bounce during host cleanup

// Internal State
window.sessionStartTime = Date.now(); // Track page life for redirection grace periods
let lastSeenMessageTime = 0;
let lobbyUnsubscribe = null;

// DOM references (will be assigned after injection)
let dom = {};

// Entry Point
initLobbyShell();

function initLobbyShell() {
  injectSidebarHTML();
  bindDOM();
  setupListeners();
  
  // Make Hub/Logo links lobby-aware
  makeLinksLobbyAware();

  // Start Garbage Collector (Lobby Cleanup)
  startGarbageCollector();

  if (LOBBY_ID) {
    // Start Heartbeat for THIS lobby
    startHeartbeat();
    
    lobbyUnsubscribe = subscribeToLobby(LOBBY_ID, (data) => {
      if (!data) {
         handleLobbyClosure("This lobby no longer exists.");
         return;
      }
      
      window.currentLobbyData = data;
      
      // Check if I was kicked or left
      const me = data.players.find(p => p.id === CLIENT_ID);
      if (!me) {
         handleLobbyClosure("You are no longer in this lobby.");
         return;
      }

      // Direct Redirection Logic
      handleGlobalRedirection(data);
      
      // Broadcast message detection
      if (data.hostMessage && data.hostMessage.timestamp > lastSeenMessageTime && data.hostMessage.text) {
         if (lastSeenMessageTime !== 0 && data.hostId !== CLIENT_ID) {
            if (window.Notify) window.Notify.toast(`📣 Host: ${data.hostMessage.text}`, 5000);
         }
         lastSeenMessageTime = data.hostMessage.timestamp;
      }

      renderUI(data);
      
      // Trigger any registered update hooks (e.g. hub.js re-render)
      if (window.onLobbyUpdate) window.onLobbyUpdate(data);
    });
  } else {
    // We are unconnected. Ensure the UI shows the unconnected state
    renderUnconnectedUI();
  }
}

function injectSidebarHTML() {
  const sidebarHTML = `
    <!-- Online Side Panel -->
    <input type="checkbox" id="online-toggle" class="online-toggle-checkbox hidden" style="display:none;">
    <label for="online-toggle" class="online-drawer-toggle">
      <span style="font-size: 1.2rem;">🌐</span>
      <span id="drawer-label-text" class="drawer-label-text">Lobby</span>
    </label>
    <div class="online-drawer">
       <h2 class="text-gradient" style="font-size: 1.8rem; margin-bottom: 0.5rem;">Online Lobby</h2>
       <p style="color: var(--text-secondary); font-size: 0.8rem; line-height: 1.4;">Gather your friends in a lobby room before selecting a game to play together.</p>
       <hr style="border-color: rgba(255,255,255,0.1); margin: 1rem 0;">
       
       <!-- UNCONNECTED UI -->
       <div id="lobby-unconnected-ui" class="hidden">
          <button id="hub-btn-open-create" class="btn btn-coral w-100">Create New Lobby</button>
          
          <div id="create-lobby-form" class="hidden mt-1" style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px;">
             <label style="font-size: 0.8rem; color: var(--text-secondary); display:block; margin-bottom:4px;">Lobby Name</label>
             <input type="text" id="hub-input-lobby-name" class="w-100" style="padding: 0.5rem; border-radius: 6px; background: var(--bg-primary); color: white; border: 1px solid rgba(255,255,255,0.2); margin-bottom: 0.75rem;" maxlength="20">
             
             <label style="font-size: 0.8rem; color: var(--text-secondary); display:flex; justify-content:space-between; margin-bottom:4px;">
               <span>Max Players</span>
               <span id="create-max-players-val" style="color:white; font-weight:bold;">4</span>
             </label>
             <input type="range" id="hub-input-max-players" min="2" max="10" value="4" step="1" class="w-100" style="margin-bottom: 1rem; accent-color: var(--accent-coral);">
             
             <button id="hub-btn-confirm-create" class="btn btn-coral w-100">Confirm Create</button>
             <button id="hub-btn-cancel-create" class="btn btn-secondary w-100 mt-1" style="font-size: 0.8rem; padding: 0.4rem;">Cancel</button>
          </div>

          <div id="lobby-join-section">
            <div id="lobby-divider-or" class="divider mt-2 mb-2" style="width: 100%; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.1); line-height: 0.1em; margin: 15px 0 20px;">
               <span style="background: var(--bg-card); padding: 0 10px; color: var(--text-secondary); font-size: 0.8rem;">OR</span>
            </div>
            <div style="display: flex; gap: 0.5rem;">
              <input type="text" id="hub-input-lobby" placeholder="CODE" maxlength="4" style="flex: 1; padding: 0.75rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.2); background: var(--bg-primary); color: white; text-transform: uppercase; font-weight: bold; text-align: center; letter-spacing: 2px;">
              <button id="hub-btn-join-lobby" class="btn btn-mint">Join</button>
            </div>
          </div>
       </div>

       <!-- CONNECTED UI -->
       <div id="lobby-connected-ui" class="hidden" style="display: flex; flex-direction: column; gap: 1rem; flex: 1; overflow-y: auto;">
          <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px; text-align: center; position: relative;">
             <span id="display-lobby-name" style="color: white; font-weight:bold; font-size: 1.1rem; display:block;">My Lobby</span>
             <button id="hub-btn-edit-lobby" class="btn hidden" style="position: absolute; top: 10px; right: 10px; background: none; border: none; font-size: 1.1rem; cursor: pointer; padding: 2px;" title="Edit Settings">⚙️</button>
             <span style="color: var(--text-secondary); font-size: 0.8rem; text-transform: uppercase; margin-top:5px; display:block;">Code: <span id="current-lobby-code" class="text-gradient" style="font-weight: 900; letter-spacing: 2px;">${LOBBY_ID || ''}</span></span>
          </div>
          
          <div id="host-edit-panel" class="hidden mt-1" style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px;">
             <label style="font-size: 0.8rem; color: var(--text-secondary); display:block; margin-bottom:4px;">Edit Name</label>
             <input type="text" id="edit-lobby-name" class="w-100" style="padding: 0.5rem; border-radius: 6px; background: var(--bg-primary); color: white; border: 1px solid rgba(255,255,255,0.2); margin-bottom: 0.75rem;" maxlength="20">
             
             <label style="font-size: 0.8rem; color: var(--text-secondary); display:flex; justify-content:space-between; margin-bottom:4px;">
               <span>Edit Max Players</span>
               <span id="edit-max-players-val" style="color:white; font-weight:bold;">4</span>
             </label>
             <input type="range" id="edit-max-players-range" min="2" max="10" value="4" step="1" class="w-100" style="margin-bottom: 1rem; accent-color: var(--accent-coral);">
             
             <label style="font-size: 0.8rem; color: var(--text-secondary); display:flex; align-items:center; gap: 0.5rem; margin-bottom:1rem; cursor:pointer;">
               <input type="checkbox" id="edit-lobby-locked" style="accent-color: var(--accent-coral); transform: scale(1.2);"> Lock Lobby
             </label>
             
             <button id="hub-btn-save-edit" class="btn btn-mint w-100">Save Changes</button>
             <button id="hub-btn-cancel-edit" class="btn btn-secondary w-100 mt-1" style="font-size: 0.8rem; padding: 0.4rem;">Cancel</button>
          </div>

          <div>
             <h3 id="display-player-count" style="font-size: 0.9rem; color: var(--text-secondary); border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.5rem; margin-bottom: 0.5rem;">Players</h3>
             <ul id="lobby-player-list" style="list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.5rem;"></ul>
          </div>

          <div id="host-messaging-panel" class="hidden mt-1" style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px;">
             <label style="font-size: 0.8rem; color: var(--accent-coral); display:block; margin-bottom:4px; font-weight:bold;">Host Broadcast</label>
             <div style="display: flex; gap: 0.5rem;">
               <input type="text" id="hub-input-host-msg" placeholder="Message..." style="flex: 1; padding: 0.5rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.2); background: var(--bg-primary); color: white; width: 50%;">
               <button id="hub-btn-send-msg" class="btn btn-coral btn-sm">Send</button>
             </div>
          </div>

          <button id="hub-btn-leave-lobby" class="btn btn-secondary w-100" style="margin-top: auto;">Leave Lobby</button>
          <button id="hub-btn-delete-lobby" class="btn btn-coral w-100 hidden" style="margin-top: auto;">Delete Lobby</button>
       </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', sidebarHTML);
}

function bindDOM() {
  dom = {
    viewUnconnected: document.getElementById('lobby-unconnected-ui'),
    viewConnected: document.getElementById('lobby-connected-ui'),
    toggle: document.getElementById('online-toggle'),
    drawerLabelText: document.getElementById('drawer-label-text'),
    lobbyName: document.getElementById('display-lobby-name'),
    playerCount: document.getElementById('display-player-count'),
    playerList: document.getElementById('lobby-player-list'),
    editToggle: document.getElementById('hub-btn-edit-lobby'),
    editPanel: document.getElementById('host-edit-panel'),
    inputEditName: document.getElementById('edit-lobby-name'),
    sliderEditMax: document.getElementById('edit-max-players-range'),
    displayEditMaxVal: document.getElementById('edit-max-players-val'),
    checkEditLocked: document.getElementById('edit-lobby-locked'),
    btnSaveEdit: document.getElementById('hub-btn-save-edit'),
    btnCancelEdit: document.getElementById('hub-btn-cancel-edit'),
    msgPanel: document.getElementById('host-messaging-panel'),
    inputMsg: document.getElementById('hub-input-host-msg'),
    btnSendMsg: document.getElementById('hub-btn-send-msg'),
    btnLeave: document.getElementById('hub-btn-leave-lobby'),
    btnDelete: document.getElementById('hub-btn-delete-lobby')
  };
}

function setupListeners() {
  if (dom.editToggle) {
    dom.editToggle.addEventListener('click', () => {
      dom.editPanel.classList.remove('hidden');
      dom.inputEditName.value = window.currentLobbyData.name;
      dom.sliderEditMax.value = window.currentLobbyData.maxPlayers;
      dom.displayEditMaxVal.innerText = window.currentLobbyData.maxPlayers;
      dom.checkEditLocked.checked = !!window.currentLobbyData.isLocked;
    });
  }

  if (dom.btnCancelEdit) dom.btnCancelEdit.addEventListener('click', () => dom.editPanel.classList.add('hidden'));

  if (dom.sliderEditMax) {
    dom.sliderEditMax.addEventListener('input', (e) => dom.displayEditMaxVal.innerText = e.target.value);
  }

  if (dom.btnSaveEdit) {
    dom.btnSaveEdit.addEventListener('click', async () => {
      const newMax = parseInt(dom.sliderEditMax.value);
      if (newMax < window.currentLobbyData.players.length) {
        if(window.Notify) window.Notify.toast(`Cannot lower capacity below currently connected players.`);
        return;
      }
      await updateLobbySettings(LOBBY_ID, {
        name: dom.inputEditName.value.trim() || 'My Lobby',
        maxPlayers: newMax,
        isLocked: dom.checkEditLocked.checked
      });
      dom.editPanel.classList.add('hidden');
    });
  }

  if (dom.btnSendMsg) {
    dom.btnSendMsg.addEventListener('click', async () => {
      const text = dom.inputMsg.value.trim();
      if (!text) return;
      dom.inputMsg.value = '';
      await broadcastMessage(LOBBY_ID, text);
    });
  }

  if (dom.btnLeave) {
    dom.btnLeave.addEventListener('click', async () => {
        const isHost = window.currentLobbyData && window.currentLobbyData.hostId === CLIENT_ID;
        const isInGame = window.location.pathname.includes('/games/');

        if (isHost && isInGame) {
           console.log("[Shell] Host leaving active game - clearing currentGame to 'STAGING'");
           await setLobbyGame(LOBBY_ID, "STAGING");
        }

        const uName = localStorage.getItem('gh_username') || 'Guest';
        await leaveLobby(LOBBY_ID, { id: CLIENT_ID, name: uName });
        handleLobbyClosure(null); // Silent exit
    });
  }

  if (dom.btnDelete) {
    dom.btnDelete.addEventListener('click', async () => {
      if (window.Notify && window.Notify.confirm) {
        window.Notify.confirm({
          title: "Delete Lobby",
          message: "Destroy this lobby for everyone?",
          confirmText: "Delete",
          onConfirm: async () => await deleteLobby(LOBBY_ID)
        });
      } else if (confirm("Delete this lobby?")) {
        await deleteLobby(LOBBY_ID);
      }
    });
  }

  // Click Outside to Close Drawer
  document.addEventListener('mousedown', (e) => {
    if (!dom.toggle.checked) return;
    const drawer = document.querySelector('.online-drawer');
    const label = document.querySelector('.online-drawer-toggle');
    if (!drawer.contains(e.target) && !label.contains(e.target)) {
       dom.toggle.checked = false;
    }
  });
}

function handleLobbyClosure(reason) {
  if (lobbyUnsubscribe) lobbyUnsubscribe();
  if (reason && window.Notify) window.Notify.popup({ title: "Lobby Closed", message: reason, autoCloseMs: 3000 });
  
  // Strip lobby from URL and return to Hub
  const root = getProjectRoot();
  setTimeout(() => window.location.href = root + 'index.html', reason ? 3000 : 0);
}

window.getProjectRoot = getProjectRoot;

function getProjectRoot() {
   const path = window.location.pathname;
   // If we are in a game folder, we need to go up two levels or find the root
   if (path.includes('/games/')) {
      const parts = path.split('/games/');
      return parts[0] + '/';
   }
   // If we are at the root (e.g. /index.html), we just want the base path
   return path.substring(0, path.lastIndexOf('/') + 1);
}

/**
 * Finds any links pointing back to Hub and ensures they carry the lobby code.
 */
function makeLinksLobbyAware() {
  if (!LOBBY_ID) return;
  
  // Target Logo and any Hub links
  const links = document.querySelectorAll('a[href*="index.html"]');
  links.forEach(link => {
    // 1. Ensure the link always carries the lobby ID for standard navigation
    let hrefAttr = link.getAttribute('href');
    if (hrefAttr && !hrefAttr.includes('lobby=')) {
      const separator = hrefAttr.includes('?') ? '&' : '?';
      link.setAttribute('href', `${hrefAttr}${separator}lobby=${LOBBY_ID}`);
    }

    // 2. Intercept clicks to handle Game Termination (Host) or Leave Confirmation (Guest)
    link.addEventListener('click', async (e) => {
      // Only intercept if we are in an ONLINE game folder
      const isOnline = new URLSearchParams(window.location.search).get('mode') !== 'local';
      const isInGameFolder = window.location.pathname.includes('/games/');
      
      if (!isOnline || !isInGameFolder || !window.currentLobbyData) return;

      // Stop normal navigation
      e.preventDefault();
      const targetUrl = link.href;
      const isHost = window.currentLobbyData && window.currentLobbyData.hostId === CLIENT_ID;

      console.log(`[Shell] Hub link clicked. Host: ${isHost}, ID: ${CLIENT_ID}`);

      if (isHost) {
        // HOST Logic: Ask to end the game for everyone
        if (window.Notify && window.Notify.confirm) {
          window.Notify.confirm({
            title: "End Game?",
            message: "Are you sure you want to end the game for everyone and return to the hub?",
            confirmText: "End Game",
            onConfirm: async () => {
              console.log(`[Shell] TERMINATION START: LobbyID="${LOBBY_ID}" (len: ${LOBBY_ID?.length})`);
              if(window.Notify) window.Notify.toast("Ending game for everyone...", 3000);
              
              try {
                // 1. Mark this as a manual termination to block the redirect loop
                localStorage.setItem('gh_last_game_end_time', Date.now());
                window.isEndingGame = true; // LOCK: Prevent handleGlobalRedirection from taking over

                // 2. Ensure the Firebase command is issued and confirmed
                console.log("[Shell] Calling setLobbyGame(STAGING)...");
                await setLobbyGame(LOBBY_ID, "STAGING");

                // 3. Redirection is only safe AFTER the await above finishes
                console.log("[Shell] Sync confirmed. Finalizing redirection to Hub.");
                window.location.href = targetUrl;
              } catch (err) {
                window.isEndingGame = false; // UNLOCK on failure
                console.error("[Shell] Game End Sync FAILED:", err);
                if(window.Notify) window.Notify.toast("Termination Failed: " + err.message);
              }
            }
          });
        } else if (confirm("End game for everyone?")) {
          await setLobbyGame(LOBBY_ID, "hub");
          window.location.href = targetUrl;
        }
      } else {
        // GUEST Logic: Ask to leave the lobby match
        if (window.Notify && window.Notify.confirm) {
          window.Notify.confirm({
            title: "Leave Game?",
            message: "Would you like to formally leave this lobby match?",
            confirmText: "Leave",
            onConfirm: async () => {
              const uName = localStorage.getItem('gh_username') || 'Guest';
              await leaveLobby(LOBBY_ID, { id: CLIENT_ID, name: uName });
              window.location.href = targetUrl;
            }
          });
        } else if (confirm("Leave this lobby match?")) {
          const uName = localStorage.getItem('gh_username') || 'Guest';
          await leaveLobby(LOBBY_ID, { id: CLIENT_ID, name: uName });
          window.location.href = targetUrl;
        }
      }
    });
  });
}

/**
 * Periodically touch the lobby to keep it from timing out.
 */
function startHeartbeat() {
  if (!LOBBY_ID) return;
  setInterval(async () => {
    try {
      await touchLobby(LOBBY_ID);
    } catch(e) { /* ignore */ }
  }, 30000); // 30 seconds
}

/**
 * Scans for and removes dead lobbies.
 */
async function startGarbageCollector() {
  const absMaxTimeMs = 2 * 60 * 60 * 1000; // 2 hours
  const idleMaxTimeMs = 5 * 60 * 1000;      // 5 mins
  
  const performCleanup = async () => {
    try {
      const lobbies = await getAllLobbies();
      const now = Date.now();
      
      for (const lob of lobbies) {
        const age = now - lob.createdAt;
        const idle = now - lob.lastActiveAt;
        
        if (age > absMaxTimeMs || idle > idleMaxTimeMs) {
          console.log(`[GC] Cleaning up lobby ${lob.id}`);
          await deleteLobby(lob.id);
        }
      }
    } catch(e) { /* ignore */ }
  };

  // Run once on load, then every 5 mins
  performCleanup();
  setInterval(performCleanup, 5 * 60 * 1000);
}

function handleGlobalRedirection(data) {
  // If we are currently the host and actively launching a game from the Hub,
  // we block handleGlobalRedirection so logic files can await the server sync
  // before manually navigating.
  if (window.isLaunchingGame || window.isEndingGame) return;

  const currentPath = window.location.pathname;
  const root = getProjectRoot();

  console.log("handleGlobalRedirection")
  console.log(data)
  
  if (data.currentGame && data.currentGame !== "STAGING" && data.currentGame !== "HUB") {
    const targetPathPart = `/games/${data.currentGame}/`;
    const isOnline = new URLSearchParams(window.location.search).get('mode') === 'online';
    
    // Redirect if:
    // 1. We are NOT in the right game folder
    // 2. OR we are in the right folder but NOT in online mode
    if (!currentPath.includes(targetPathPart) || !isOnline) {
       if (window.Notify) window.Notify.toast("New Game Starting. STAND BY...", 3000);
       console.log(`[Shell] Starting Game: ${data.currentGame}`);
       window.location.href = root + `games/${data.currentGame}/index.html?lobby=${LOBBY_ID}&mode=online`;
    }
  } else {
    // CurrentGame is null (Lobby is in "staging" or "hub" mode)
    const isLocalMode = new URLSearchParams(window.location.search).get('mode') === 'local';
    const isInGameFolder = currentPath.includes('/games/');
    
    // Only kick back to Hub if we are in a game folder AND not intentionally in local mode
    if (isInGameFolder && !isLocalMode) {
       console.log(`[Shell] No active lobby game detected. Recalling to Hub.`);
       window.location.href = root + `index.html?lobby=${LOBBY_ID}`;
    }
  }
}

function renderUnconnectedUI() {
  if (dom.viewConnected) dom.viewConnected.classList.add('hidden');
  if (dom.viewUnconnected) dom.viewUnconnected.classList.remove('hidden');
  if (dom.drawerLabelText) dom.drawerLabelText.innerText = "LOBBY";
}

function renderUI(data) {
  const isHost = data.hostId === CLIENT_ID;
  
  if (dom.viewUnconnected) dom.viewUnconnected.classList.add('hidden');
  if (dom.viewConnected) dom.viewConnected.classList.remove('hidden');
  
  dom.lobbyName.innerText = data.name;
  if (dom.drawerLabelText) {
     dom.drawerLabelText.innerText = LOBBY_ID;
     dom.drawerLabelText.classList.add('text-gradient');
  }
  
  const cap = data.maxPlayers || '?';
  const cur = data.players ? data.players.length : 0;
  dom.playerCount.innerText = `Players (${cur}/${cap})${data.isLocked ? ' 🔒' : ''}`;

  // Host Privilege UI
  dom.btnDelete.classList.toggle('hidden', !isHost);
  dom.btnLeave.classList.toggle('hidden', isHost);
  dom.msgPanel.classList.toggle('hidden', !isHost);
  dom.editToggle.classList.toggle('hidden', !isHost);

  // Player List
  dom.playerList.innerHTML = '';
  data.players.forEach(p => {
    const li = document.createElement('li');
    li.style = "padding: 0.5rem; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; background: " + (p.id === data.hostId ? "rgba(59, 130, 246, 0.1)" : "rgba(255, 255, 255, 0.05)");
    if (p.id === data.hostId) li.style.borderLeft = "3px solid #3b82f6";
    
    let controls = null;
    if (isHost && p.id !== CLIENT_ID) {
       // Host can Kick/Transfer
       const controlsDiv = document.createElement('div');
       controlsDiv.style = "display:flex; gap:5px;";
       
       const trans = document.createElement('button');
       trans.className = "btn btn-primary";
       trans.style = "padding:0.2rem 0.6rem; font-size:0.6rem;";
       trans.innerText = "👑";
       trans.title = "Make Host";
       trans.onclick = () => changeHost(LOBBY_ID, p.id);

       const kick = document.createElement('button');
       kick.className = "btn btn-coral";
       kick.style = "padding:0.2rem 0.6rem; font-size:0.6rem;";
       kick.innerText = "Kick";
       kick.onclick = () => leaveLobby(LOBBY_ID, p);

       controlsDiv.appendChild(trans);
       controlsDiv.appendChild(kick);
       controls = controlsDiv;
    }

    const nameSpan = document.createElement('span');
    nameSpan.innerText = (p.id === data.hostId ? "👑 " : "👤 ") + p.name;
    li.prepend(nameSpan);
    if (controls) li.appendChild(controls);
    
    dom.playerList.appendChild(li);
  });
}
