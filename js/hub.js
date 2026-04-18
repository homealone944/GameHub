/* js/hub.js */
import { createUniversalLobby, joinLobby, leaveLobby, deleteLobby, setLobbyGame, subscribeToLobby, changeHost, broadcastMessage, updatePlayerName, updateLobbySettings, setVote } from './firebase-multiplayer.js';
import { GAMES_CATALOG } from './catalog.js';
import { generateRandomName } from './names.js';

// Client Session ID
let CLIENT_ID = localStorage.getItem('gh_clientId');
if (!CLIENT_ID) {
  CLIENT_ID = 'client_' + Math.random().toString(36).substr(2, 9);
  localStorage.setItem('gh_clientId', CLIENT_ID);
}

// Generate unique username on first load
if (!localStorage.getItem('gh_username')) {
  localStorage.setItem('gh_username', generateRandomName());
}
const seconds = 1000;
const minutes = 60 * seconds;
// Initialize
let lobbyUnsubscribe = null;
let currentLobbyData = null;
let lastSeenMessageTime = 0;
let garbageCollectorId = null;

// State
let currentSearch = '';
let activeFilters = {
   mode: 'Any',
   minPlayers: 1,
   maxPlayers: 10,
   category: 'All'
};

// DOM
const hubContent = document.getElementById('hub-main-content');
const searchInput = document.getElementById('search-input');
const filterPills = document.querySelectorAll('.pill');

const btnFilterSettings = document.getElementById('btn-filter-settings');
const filterModal = document.getElementById('filter-modal-overlay'); // Updated ID
const btnCloseFilter = document.getElementById('btn-close-filter'); // New reference
const selectFilterMode = document.getElementById('filter-select-mode');
const inputMinPlayers = document.getElementById('filter-min-players');
const inputMaxPlayers = document.getElementById('filter-max-players');
const displayPlayerRange = document.getElementById('player-range-val');
const btnFilterApply = document.getElementById('btn-filter-apply');
const btnFilterClearAll = document.getElementById('btn-filter-clear-all');
const activeFiltersRibbon = document.getElementById('active-filters-ribbon');

const profileBtn = document.getElementById('profile-btn');
const profileModal = document.getElementById('profile-modal');
const btnCloseProfile = document.getElementById('btn-close-profile');
const btnSaveProfile = document.getElementById('btn-save-profile');
const inputUsername = document.getElementById('input-username');
const displayUsername = document.getElementById('display-username');

const onlineModal = document.getElementById('online-modal');
const btnCloseOnline = document.getElementById('btn-close-online');
const modalTitle = document.getElementById('modal-game-title');
let selectedGame = null;

// Lobby Shell Bridge
window.onLobbyUpdate = (data) => {
   // Re-render games when lobby status changes (votes, host launch, etc.)
   renderCards();
};

// Initialize
initUser();
setupListeners();
// Wait a tiny bit for the shell to inject UI if we need specific unconnected bindings
setTimeout(setupLobbyBindings, 100); 
renderCards();

function setupLobbyBindings() {
   const btnOpenCreate = document.getElementById('hub-btn-open-create');
   const createForm = document.getElementById('create-lobby-form');
   const inputLobbyName = document.getElementById('hub-input-lobby-name');
   const sliderMaxPlayers = document.getElementById('hub-input-max-players');
   const displayMaxPlayersVal = document.getElementById('create-max-players-val');
   const btnConfirmCreate = document.getElementById('hub-btn-confirm-create');
   const btnCancelCreate = document.getElementById('hub-btn-cancel-create');
   const joinSection = document.getElementById('lobby-join-section');
   const inputJoinCode = document.getElementById('hub-input-lobby');
   const btnJoinLobby = document.getElementById('hub-btn-join-lobby');

   if (!btnOpenCreate) return;

   btnOpenCreate.addEventListener('click', () => {
     btnOpenCreate.classList.add('hidden');
     joinSection.classList.add('hidden');
     createForm.classList.remove('hidden');
     const uName = localStorage.getItem('gh_username') || 'Guest';
     inputLobbyName.value = `${uName}'s Party`;
   });

   btnCancelCreate.addEventListener('click', () => {
     createForm.classList.add('hidden');
     btnOpenCreate.classList.remove('hidden');
     joinSection.classList.remove('hidden');
   });

   if (sliderMaxPlayers) {
     sliderMaxPlayers.addEventListener('input', (e) => {
       if (displayMaxPlayersVal) displayMaxPlayersVal.innerText = e.target.value;
     });
   }

   btnConfirmCreate.addEventListener('click', async () => {
     const name = inputLobbyName.value.trim() || 'My Party';
     const maxP = parseInt(sliderMaxPlayers.value) || 4;
     const uName = localStorage.getItem('gh_username') || 'Guest';
     
     btnConfirmCreate.innerText = 'Creating...';
     try {
       const lid = await createUniversalLobby({
         name: name,
         hostId: CLIENT_ID,
         hostPlayerName: uName,
         maxPlayers: maxP
       });
       window.location.search = `?lobby=${lid}`;
     } catch (e) {
       if(window.Notify) Notify.toast("Failed to create lobby: " + e.message);
       btnConfirmCreate.innerText = 'Confirm Create';
     }
   });

   btnJoinLobby.addEventListener('click', async () => {
     const code = inputJoinCode.value.trim().toUpperCase();
     if(code.length !== 4) return;
     const uName = localStorage.getItem('gh_username') || 'Guest';
     try {
       await joinLobby(code, { id: CLIENT_ID, name: uName });
       window.location.search = `?lobby=${code}`;
     } catch(e) {
       if(window.Notify) window.Notify.toast("Join Failed: " + e.message);
     }
   });
}


function initUser() {
  const savedName = localStorage.getItem('gh_username');
  if (savedName) {
    displayUsername.innerText = savedName;
  }
}

function setupListeners() {
  // Search
  searchInput.addEventListener('input', (e) => {
    currentSearch = e.target.value.toLowerCase();
    renderCards();
  });

  // Quick Filter Pills
  filterPills.forEach(pill => {
    pill.addEventListener('click', (e) => {
      filterPills.forEach(p => p.classList.remove('active'));
      e.target.classList.add('active');
      
      const filterType = e.target.dataset.filter;
      applyQuickFilter(filterType);
    });
  });

  // Advanced Filter Modal
  btnFilterSettings.addEventListener('click', () => {
    filterModal.classList.remove('hidden');
    // Sync UI with state
    selectFilterMode.value = activeFilters.mode;
    inputMinPlayers.value = activeFilters.minPlayers;
    inputMaxPlayers.value = activeFilters.maxPlayers;
    if (displayPlayerRange) displayPlayerRange.innerText = `${activeFilters.minPlayers} - ${activeFilters.maxPlayers}`;
  });

  // Dual Slider Sync logic
  const handleSliderInput = () => {
     let min = parseInt(inputMinPlayers.value);
     let max = parseInt(inputMaxPlayers.value);
     if (min > max) {
        // swap or push
        if (event.target.id === 'filter-min-players') inputMaxPlayers.value = min;
        else inputMinPlayers.value = max;
     }
     if (displayPlayerRange) displayPlayerRange.innerText = `${inputMinPlayers.value} - ${inputMaxPlayers.value}`;
  };

  if (inputMinPlayers) inputMinPlayers.addEventListener('input', handleSliderInput);
  if (inputMaxPlayers) inputMaxPlayers.addEventListener('input', handleSliderInput);

  if (btnCloseFilter) {
    btnCloseFilter.addEventListener('click', () => {
      filterModal.classList.add('hidden');
    });
  }

  btnFilterApply.addEventListener('click', () => {
    activeFilters.mode = selectFilterMode.value;
    activeFilters.minPlayers = parseInt(inputMinPlayers.value);
    activeFilters.maxPlayers = parseInt(inputMaxPlayers.value);
    
    filterModal.classList.add('hidden');
    renderActiveFiltersRibbon();
    renderCards();
  });

  btnFilterClearAll.addEventListener('click', () => {
    activeFilters = { mode: 'Any', minPlayers: 1, maxPlayers: 10, category: 'All' };
    selectFilterMode.value = 'Any';
    inputMinPlayers.value = 1;
    inputMaxPlayers.value = 10;
    if (displayPlayerRange) displayPlayerRange.innerText = '1 - 10';
    
    // Reset pills
    filterPills.forEach(p => p.classList.remove('active'));
    document.querySelector('.pill[data-filter="All"]').classList.add('active');
    
    filterModal.classList.add('hidden'); // Also close on clear
    renderActiveFiltersRibbon();
    renderCards();
  });

  // Profile Modal
  profileBtn.addEventListener('click', () => {
    inputUsername.value = localStorage.getItem('gh_username') || '';
    profileModal.classList.remove('hidden');
  });

  btnCloseProfile.addEventListener('click', () => {
    profileModal.classList.remove('hidden');
  });

  btnSaveProfile.addEventListener('click', async () => {
    let newName = inputUsername.value.trim();
    
    // Default to a new random name if completely cleared
    if (!newName) {
       newName = generateRandomName();
       localStorage.setItem('gh_username', newName);
    } else {
       localStorage.setItem('gh_username', newName);
    }

    displayUsername.innerText = newName;
    profileModal.classList.add('hidden');
    
    // Reactive Update to Firebase if currently locked in a Lobby
    if (window.currentLobbyId) {
       await updatePlayerName(window.currentLobbyId, window.CLIENT_ID, newName);
    }
  });

}

function applyQuickFilter(type) {
  // Clear modal fields to avoid confusion
  selectFilterMode.value = 'Any';
  inputMinPlayers.value = 1;
  inputMaxPlayers.value = 10;

  activeFilters = { mode: 'Any', minPlayers: 1, maxPlayers: 10, category: 'All' };

  if (type === 'Lobby') {
    activeFilters.mode = 'Online';
    if (window.currentLobbyData) {
      activeFilters.playerCount = window.currentLobbyData.players.length;
    }
  } else if (type === 'Solo') {
    activeFilters.mode = 'Solo';
  } else if (type === 'Local') {
    activeFilters.mode = 'Local';
  } else if (type === 'Online') {
    activeFilters.mode = 'Online';
  } else if (type === 'Coming Soon') {
    activeFilters.category = 'Coming Soon';
  }

  renderActiveFiltersRibbon();
  renderCards();
}

function renderActiveFiltersRibbon() {
  if (!activeFiltersRibbon) return;
  activeFiltersRibbon.innerHTML = '';

  const createTag = (label, onRemove) => {
    const tag = document.createElement('div');
    tag.style = "background:var(--accent-coral); color:white; padding:2px 8px; border-radius:12px; font-size:0.75rem; display:flex; align-items:center; gap:6px;";
    tag.innerHTML = `<span>${label}</span> <span style="cursor:pointer; font-weight:bold;">×</span>`;
    tag.querySelector('span:last-child').addEventListener('click', onRemove);
    activeFiltersRibbon.appendChild(tag);
  };

  if (activeFilters.mode !== 'Any') {
    createTag(`Mode: ${activeFilters.mode}`, () => {
      activeFilters.mode = 'Any';
      renderActiveFiltersRibbon();
      renderCards();
    });
  }

  if (activeFilters.minPlayers > 1 || activeFilters.maxPlayers < 10) {
    createTag(`${activeFilters.minPlayers}-${activeFilters.maxPlayers} Players`, () => {
      activeFilters.minPlayers = 1;
      activeFilters.maxPlayers = 10;
      renderActiveFiltersRibbon();
      renderCards();
    });
  }

  if (activeFilters.category !== 'All') {
    createTag(activeFilters.category, () => {
      activeFilters.category = 'All';
      renderActiveFiltersRibbon();
      renderCards();
    });
  }
}

function startGarbageCollector() {
  if (garbageCollectorId) clearInterval(garbageCollectorId);
  garbageCollectorId = setInterval(async () => {
    // Note: Garbage collection now only triggers if we have currentLobbyData from the shell
    if (!window.currentLobbyId) return;
    const data = await new Promise(resolve => {
        // We'd ideally want to get this from the shell, but for now we'll just check if currentLobbyId is global
        // Actually, lobby-shell.js could handle GC but it's cleaner to keep heartbeats on the active page
    });
  }, 5000);
}

function renderCards() {
  const isSearching = currentSearch.length > 0;
  const isFiltering = activeFilters.mode !== 'Any' || activeFilters.playerCount !== null || activeFilters.category !== 'All';

  if (isSearching || isFiltering) {
    renderGridView();
  } else {
    renderCategorizedView();
  }
}

function renderCategorizedView() {
  hubContent.innerHTML = '';
  
  // 1. Recommended (First 4)
  renderSection("Recommended For You", GAMES_CATALOG.slice(0, 4));

  // 2. Online Multiplayer
  const onlineGames = GAMES_CATALOG.filter(g => g.tags.includes('Online'));
  renderSection("Online Party", onlineGames);

  // 3. Local Multiplayer
  const localGames = GAMES_CATALOG.filter(g => g.tags.includes('Local'));
  renderSection("Local Rivalry", localGames);

  // 4. Single Player
  const soloGames = GAMES_CATALOG.filter(g => g.tags.includes('Solo'));
  if (soloGames.length > 0) {
    renderSection("Single Player", soloGames);
  }

  // 5. Coming Soon
  const comingSoon = GAMES_CATALOG.filter(g => g.tags.includes('Coming Soon'));
  if (comingSoon.length > 0) {
    renderSection("Coming Soon", comingSoon);
  }

  attachCardListeners();
}

function renderSection(title, games) {
  if (games.length === 0) return;

  const section = document.createElement('section');
  section.className = 'hub-section';
  
  const h2 = document.createElement('h2');
  h2.className = 'hub-section-title';
  h2.innerText = title;
  
  const viewport = document.createElement('div');
  viewport.className = 'carousel-viewport';
  
  const row = document.createElement('div');
  row.className = 'carousel-row';
  
  games.forEach(game => {
    row.appendChild(createGameCard(game));
  });
  
  viewport.appendChild(row);
  section.appendChild(h2);
  section.appendChild(viewport);
  hubContent.appendChild(section);
}

function renderGridView() {
  const filtered = GAMES_CATALOG.filter(game => {
    // 1. Search Match
    const matchesSearch = game.title.toLowerCase().includes(currentSearch) || game.desc.toLowerCase().includes(currentSearch);
    
    // 2. Mode Match
    let matchesMode = true;
    if (activeFilters.mode === 'Local') matchesMode = game.tags.includes('Local');
    if (activeFilters.mode === 'Online') matchesMode = game.tags.includes('Online');
    if (activeFilters.mode === 'Solo') matchesMode = game.tags.includes('Solo');

    // 3. Player Count Range Match
    let matchesPlayers = true;
    // A game shows up if the filtered range (min-max) overlaps with the game's supported range
    // Logic: Game is shown if (GameMax >= FilterMin && GameMin <= FilterMax)
    matchesPlayers = (game.maxPlayers >= activeFilters.minPlayers && game.minPlayers <= activeFilters.maxPlayers);

    // 4. Category Match
    let matchesCategory = true;
    if (activeFilters.category === 'Coming Soon') {
       matchesCategory = game.tags.includes('Coming Soon');
    }
    
    return matchesSearch && matchesMode && matchesPlayers && matchesCategory;
  });

  hubContent.innerHTML = '<div class="game-grid" id="game-grid-inner"></div>';
  const gridInner = document.getElementById('game-grid-inner');

  if (filtered.length === 0) {
    hubContent.innerHTML = `<p style="color: var(--text-secondary); padding: 2rem;">No games found matching your search/filters.</p>`;
    return;
  }

  filtered.forEach(game => {
    gridInner.appendChild(createGameCard(game));
  });

  attachCardListeners();
}

function createGameCard(game) {
  const card = document.createElement('div');
  card.className = 'game-card';
  
  const supportsLocal = game.tags.includes('Local');
  const supportsOnline = game.tags.includes('Online');
  
  let hideOnlineBtn = !supportsOnline;
  let hideLocalBtn = !supportsLocal;
  
  if (activeFilters.mode === 'Local') hideOnlineBtn = true;
  if (activeFilters.mode === 'Online' || activeFilters.mode === 'Solo') hideLocalBtn = true;

  let buttonsHtml = '';
  if (!hideLocalBtn) {
    buttonsHtml += `<button class="btn btn-primary btn-sm btn-local" data-game="${game.id}">Local</button>`;
  }
  
  let voteUIHtml = '';
  if (!hideOnlineBtn) {
    let onlineText = "Online";
    let btnClass = "btn-coral";
    
    if (window.currentLobbyId && window.currentLobbyData) {
       if (window.currentLobbyData.hostId === window.CLIENT_ID) {
          onlineText = "Launch Game";
          btnClass = "btn-mint";
          const gameVotes = window.currentLobbyData.votes ? window.currentLobbyData.votes[game.id] : [];
          if (gameVotes && gameVotes.length > 0) {
             voteUIHtml = `<div style="position:absolute; top:10px; left:10px; z-index:10; background:rgba(0,0,0,0.6); padding:4px 8px; border-radius:12px; font-size:0.75rem; border:1px solid rgba(255,255,255,0.2);">⭐ ${gameVotes.length}</div>`;
          }
       } else {
          const gameVotes = window.currentLobbyData.votes ? window.currentLobbyData.votes[game.id] : [];
          const hasVoted = gameVotes && gameVotes.includes(window.CLIENT_ID);
          if (hasVoted) {
             voteUIHtml = `<button class="btn-online btn-vote" data-game="${game.id}" style="position:absolute; top:10px; left:10px; z-index:10; background:var(--accent-mint); color:#000; padding:4px 8px; border-radius:12px; font-size:0.75rem; border:none; cursor:pointer; font-weight:bold;">✅</button>`;
          } else {
             voteUIHtml = `<button class="btn-online btn-vote" data-game="${game.id}" style="position:absolute; top:10px; left:10px; z-index:10; background:rgba(255,255,255,0.1); padding:4px 8px; border-radius:12px; font-size:0.75rem; border:1px solid rgba(255,255,255,0.2); cursor:pointer;">✋</button>`;
          }
          onlineText = "Waiting for Host";
          btnClass = "btn-secondary disabled";
       }
    }
    buttonsHtml += `<button class="btn btn-sm btn-online ${btnClass}" data-game="${game.id}">${onlineText}</button>`;
  }

  card.innerHTML = `
    <div class="game-content" style="position:relative; width:100%;">
      ${voteUIHtml}
      <div class="game-icon">${game.icon}</div>
      <h2 class="game-title">${game.title}</h2>
      <p class="game-desc">${game.desc}</p>
      <div style="margin-top:0.5rem; display:flex; gap:0.5rem; justify-content:center; flex-wrap:wrap;">
         ${game.tags.map(t => `<span style="font-size:0.75rem; color:var(--text-secondary); background:rgba(255,255,255,0.05); padding:2px 8px; border-radius:12px;">${t}</span>`).join('')}
      </div>
    </div>
    <div class="game-actions" style="width:100%; margin-top:auto;">
      ${buttonsHtml}
    </div>
  `;
  return card;
}

function attachCardListeners() {
  document.querySelectorAll('.btn-local').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const gameId = e.target.dataset.game;
      const targetGame = GAMES_CATALOG.find(g => g.id === gameId);
      if (targetGame && targetGame.tags.includes('Coming Soon')) {
        Notify.popup({ title: 'Construction Zone', message: 'That game is still in development! Hang tight.', autoCloseMs: 3500 });
        return;
      }
      const urlParams = new URLSearchParams(window.location.search);
      const lobbyId = urlParams.get('lobby');
      let url = `./games/${gameId}/index.html?mode=local`;
      if (lobbyId) url += `&lobby=${lobbyId}`;
      window.location.href = url;
    });
  });

  document.querySelectorAll('.btn-online').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (btn.classList.contains('disabled')) return;
      
      const gameId = e.target.closest('button').dataset.game;
      
      if (window.currentLobbyId && window.currentLobbyData) {
         const targetGame = GAMES_CATALOG.find(g => g.id === gameId);
         if (targetGame && targetGame.tags.includes('Coming Soon')) {
            if(window.Notify) Notify.popup({ title: 'Construction Zone', message: 'That game is still in development!', autoCloseMs: 3500 });
            return;
         }
         
         if (window.currentLobbyData.hostId === window.CLIENT_ID) {
            if (!e.target.closest('button').classList.contains('btn-vote')) {
               // Host clicked launch
               const btn = e.target.closest('button');
               const originalText = btn.innerText;
               btn.innerText = "Launching...";
               btn.classList.add('disabled');
               
               try {
                  window.isLaunchingGame = true; // Block the shell's auto-redirect to wait for server sync
                  await setLobbyGame(window.currentLobbyId, gameId);
                  
                  // Now that we ARE sure the server has it, we can safely redirect
                  const root = window.getProjectRoot ? window.getProjectRoot() : './';
                  window.location.href = `${root}games/${gameId}/index.html?lobby=${window.currentLobbyId}&mode=online`;
               } catch (err) {
                  window.isLaunchingGame = false;
                  btn.innerText = originalText;
                  btn.classList.remove('disabled');
                  if(window.Notify) Notify.toast("Launch Failed: " + err.message);
               }
            }
         } else if (e.target.closest('button').classList.contains('btn-vote')) {
            // Guest clicked Vote
            await setVote(window.currentLobbyId, gameId, window.CLIENT_ID);
         }
      } else {
         // Non-lobby online click
         if(window.Notify) Notify.toast("Join or Create a Party 🌐 to play Online!", 4000);
         document.getElementById('online-toggle').checked = true; // pop out the drawer!
      }
    });
  });
}

