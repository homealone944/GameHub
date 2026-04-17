/* js/hub.js */

const GAMES_CATALOG = [
  {
    id: 'tictactoe',
    title: 'Tic-Tac-Toe',
    icon: '❌⭕',
    desc: 'The classic 3x3 battle of wits.',
    tags: ['Local', 'Online', 'Multiplayer']
  },
  {
    id: 'connectfour',
    title: 'Connect Four',
    icon: '🔴🟡',
    desc: 'Drop discs and connect 4 to win.',
    tags: ['Local', 'Online', 'Multiplayer']
  },
  {
    id: 'sudoku',
    title: 'Sudoku',
    icon: '🔢',
    desc: 'A logic-based number placement puzzle.',
    tags: ['Local', 'Solo','Coming Soon']
  },
  {
    id: 'solitaire',
    title: 'Solitaire',
    icon: '🃏',
    desc: 'The classic solo card sorting game.',
    tags: ['Local', 'Solo','Coming Soon']
  },
  {
    id: 'codenames',
    title: 'Codenames',
    icon: '🕵️',
    desc: 'Cooperative word deduction game.',
    tags: ['Local', 'Online', 'Co-op', 'Multiplayer']
  },
  {
    id: 'cardsagainsthumanity',
    title: 'Cards Against Humanity',
    icon: '⬛⬜',
    desc: 'A party game for horrible people.',
    tags: ['Local', 'Online', 'Multiplayer','Coming Soon']
  },
  {
    id: 'dotsandboxes',
    title: 'Dots & Boxes',
    icon: '🔳',
    desc: 'Connect the dots to claim the most boxes.',
    tags: ['Local', 'Online', 'Multiplayer']
  }
];

// State
let currentSearch = '';
let currentFilter = 'All';

// DOM
const gameGrid = document.getElementById('game-grid');
const searchInput = document.getElementById('search-input');
const filterPills = document.querySelectorAll('.pill');

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

document.addEventListener('DOMContentLoaded', () => {
  initUser();
  setupListeners();
  renderCards();
});

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

  // Filters
  filterPills.forEach(pill => {
    pill.addEventListener('click', (e) => {
      filterPills.forEach(p => p.classList.remove('active'));
      e.target.classList.add('active');
      currentFilter = e.target.dataset.filter;
      renderCards();
    });
  });

  // Profile Modal
  profileBtn.addEventListener('click', () => {
    inputUsername.value = localStorage.getItem('gh_username') || '';
    profileModal.classList.remove('hidden');
  });

  btnCloseProfile.addEventListener('click', () => {
    profileModal.classList.add('hidden');
  });

  btnSaveProfile.addEventListener('click', () => {
    const newName = inputUsername.value.trim();
    if (newName) {
      localStorage.setItem('gh_username', newName);
      displayUsername.innerText = newName;
      profileModal.classList.add('hidden');
    }
  });

  // Online Modal
  if (btnCloseOnline) {
    btnCloseOnline.addEventListener('click', () => {
      onlineModal.classList.add('hidden');
    });
  }
}

function renderCards() {
  // Filter Logic
  const filtered = GAMES_CATALOG.filter(game => {
    const matchesSearch = game.title.toLowerCase().includes(currentSearch) || game.desc.toLowerCase().includes(currentSearch);
    
    let matchesFilter = true;
    if (currentFilter !== 'All') {
      matchesFilter = game.tags.includes(currentFilter);
    }
    
    return matchesSearch && matchesFilter;
  });

  // Render HTML
  gameGrid.innerHTML = '';

  if (filtered.length === 0) {
    gameGrid.innerHTML = `<p style="grid-column: 1/-1; color: var(--text-secondary);">No games found for "${currentSearch}"</p>`;
    return;
  }

  filtered.forEach(game => {
    const card = document.createElement('div');
    card.className = 'game-card';
    
    // Check supported modes based on tags
    const supportsLocal = game.tags.includes('Local');
    const supportsOnline = game.tags.includes('Online');
    
    // Crucially: if user filtered by 'Local' AND game sports 'Online', explicitly hide 'Online' (and vice versa)
    let hideOnlineBtn = !supportsOnline;
    let hideLocalBtn = !supportsLocal;
    
    if (currentFilter === 'Local') hideOnlineBtn = true;
    if (currentFilter === 'Online') hideLocalBtn = true;

    // Draw buttons
    let buttonsHtml = '';
    
    if (!hideLocalBtn) {
      buttonsHtml += `<button class="btn btn-primary btn-sm btn-local" data-game="${game.id}">Local</button>`;
    }
    
    if (!hideOnlineBtn) {
      buttonsHtml += `<button class="btn btn-coral btn-sm btn-online" data-game="${game.id}">Online</button>`;
    }

    card.innerHTML = `
      <div class="game-content">
        <div class="game-icon">${game.icon}</div>
        <h2 class="game-title">${game.title}</h2>
        <p class="game-desc">${game.desc}</p>
        <div style="margin-top:0.5rem; display:flex; gap:0.5rem; justify-content:center; flex-wrap:wrap;">
           ${game.tags.map(t => `<span style="font-size:0.75rem; color:var(--text-secondary); background:rgba(255,255,255,0.05); padding:2px 8px; border-radius:12px;">${t}</span>`).join('')}
        </div>
      </div>
      <div class="game-actions">
        ${buttonsHtml}
      </div>
    `;

    gameGrid.appendChild(card);
  });

  // Re-attach Card Action Listeners for dynamically rendered elements
  document.querySelectorAll('.btn-local').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const gameId = e.target.dataset.game;
      const targetGame = GAMES_CATALOG.find(g => g.id === gameId);
      if (targetGame && targetGame.tags.includes('Coming Soon')) {
        Notify.popup({ title: 'Construction Zone', message: 'That game is still in development! Hang tight.', autoCloseMs: 3500 });
        return;
      }
      window.location.href = `./games/${gameId}/index.html?mode=local`;
    });
  });

  document.querySelectorAll('.btn-online').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      Notify.toast("Online Multiplayer is coming soon! Please use Local play.", 4000);
    });
  });
}
