/* js/profile-manager.js */
import { generateRandomName } from './names.js';

const ICON_CHOICES = ["👤", "🐱", "🐶", "🦊", "🐯", "🐼", "🐨", "🦁", "🦒", "🦓", "🐘", "🎩", "🕶️", "🚀", "💎", "🍎"];
const DEFAULT_AVATAR_COLOR = '#252525';

export class ProfileManager {
  constructor(isHub = true) {
    this.isHub = isHub;
    this.selectedIcon = localStorage.getItem('gh_usericon') || '👤';
    this.localPlayers = [];
    try {
      this.localPlayers = JSON.parse(localStorage.getItem('gh_local_players')) || [];
    } catch (e) {
      this.localPlayers = [];
    }
    this.dom = {};
  }

  getProfile() {
    return {
      name: localStorage.getItem('gh_username') || generateRandomName(),
      icon: this.selectedIcon,
      color: DEFAULT_AVATAR_COLOR
    };
  }

  init() {
    this.bindDOM();
    this.initUser();
    this.setupListeners();
  }

  bindDOM() {
    this.dom.profileBtn = document.getElementById('profile-btn');
    this.dom.profileModal = document.getElementById('profile-modal');
    this.dom.btnCloseProfile = document.getElementById('btn-close-profile');
    this.dom.btnSaveProfile = document.getElementById('btn-save-profile');
    this.dom.inputUsername = document.getElementById('input-username');
    this.dom.displayUsername = document.getElementById('display-username');
    this.dom.displayAvatar = document.getElementById('header-avatar');
    this.dom.modalPreviewAvatar = document.getElementById('modal-avatar-preview');
    this.dom.avatarCustomizer = document.getElementById('avatar-customizer');
    this.dom.iconSelector = document.getElementById('icon-selector');
    
    // Local player additions
    this.dom.localPlayersList = document.getElementById('local-players-list');
    this.dom.inputLocalPlayerName = document.getElementById('input-local-player-name');
    this.dom.btnAddLocalPlayer = document.getElementById('btn-add-local-player');
  }

  initUser() {
    const savedName = localStorage.getItem('gh_username') || generateRandomName();
    if (!localStorage.getItem('gh_username')) localStorage.setItem('gh_username', savedName);
    
    if (this.dom.displayUsername) this.dom.displayUsername.innerText = savedName;
    
    if (this.dom.displayAvatar) {
      this.dom.displayAvatar.innerText = this.selectedIcon;
      this.dom.displayAvatar.style.backgroundColor = DEFAULT_AVATAR_COLOR;
    }
    
    if (this.dom.modalPreviewAvatar) {
      this.dom.modalPreviewAvatar.innerText = this.selectedIcon;
      this.dom.modalPreviewAvatar.style.backgroundColor = DEFAULT_AVATAR_COLOR;
    }

    this.renderSelectors();
    this.renderLocalPlayers();
  }

  renderSelectors() {
    if (this.dom.iconSelector) {
      this.dom.iconSelector.innerHTML = '';
      ICON_CHOICES.forEach(icon => {
        const bubble = document.createElement('div');
        bubble.className = 'icon-bubble';
        bubble.innerText = icon;
        bubble.classList.toggle('selected', icon === this.selectedIcon);
        bubble.onclick = () => {
          this.selectedIcon = icon;
          if (this.dom.modalPreviewAvatar) this.dom.modalPreviewAvatar.innerText = icon;
          document.querySelectorAll('.icon-bubble').forEach(b => b.classList.toggle('selected', b.innerText === icon));
        };
        this.dom.iconSelector.appendChild(bubble);
      });
    }
  }

  renderLocalPlayers() {
    if (!this.dom.localPlayersList) return;
    this.dom.localPlayersList.innerHTML = '';
    
    if (this.localPlayers.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.style.color = 'var(--text-secondary)';
      emptyMsg.style.fontSize = '0.85rem';
      emptyMsg.style.padding = '0.5rem';
      emptyMsg.style.fontStyle = 'italic';
      emptyMsg.innerText = 'No local players added yet.';
      this.dom.localPlayersList.appendChild(emptyMsg);
      return;
    }
    
    this.localPlayers.forEach((player, index) => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.alignItems = 'center';
      row.style.padding = '0.4rem 0.6rem';
      row.style.background = 'rgba(255,255,255,0.05)';
      row.style.borderRadius = '8px';
      row.style.border = '1px solid rgba(255,255,255,0.05)';
      
      const nameSpan = document.createElement('span');
      nameSpan.innerText = player;
      nameSpan.style.fontWeight = '600';
      nameSpan.style.color = 'white';
      nameSpan.style.fontSize = '0.95rem';
      
      const btnRemove = document.createElement('button');
      btnRemove.innerText = '×';
      btnRemove.style.background = 'transparent';
      btnRemove.style.border = 'none';
      btnRemove.style.color = 'var(--accent-coral)';
      btnRemove.style.fontSize = '1.3rem';
      btnRemove.style.cursor = 'pointer';
      btnRemove.style.fontWeight = 'bold';
      btnRemove.style.padding = '0 0.5rem';
      btnRemove.style.lineHeight = '1';
      btnRemove.onclick = () => {
        this.localPlayers.splice(index, 1);
        this.renderLocalPlayers();
      };
      
      row.appendChild(nameSpan);
      row.appendChild(btnRemove);
      this.dom.localPlayersList.appendChild(row);
    });
  }

  setupListeners() {
    if (this.dom.profileBtn) {
      if (!this.isHub) {
        this.dom.profileBtn.style.cursor = 'default';
        return; // Skip click listeners if not on hub
      }
      
      this.dom.profileBtn.addEventListener('click', () => {
        this.dom.inputUsername.value = localStorage.getItem('gh_username') || '';
        this.selectedIcon = localStorage.getItem('gh_usericon') || '👤';
        this.selectedColor = localStorage.getItem('gh_usercolor') || '#252525';
        
        try {
          this.localPlayers = JSON.parse(localStorage.getItem('gh_local_players')) || [];
        } catch (e) {
          this.localPlayers = [];
        }
        
        if (this.dom.modalPreviewAvatar) {
          this.dom.modalPreviewAvatar.innerText = this.selectedIcon;
          this.dom.modalPreviewAvatar.style.backgroundColor = DEFAULT_AVATAR_COLOR;
        }
        
        this.renderSelectors();
        this.renderLocalPlayers();
        this.dom.profileModal.classList.remove('hidden');
      });
    }

    const closeProfile = () => {
      try {
        this.localPlayers = JSON.parse(localStorage.getItem('gh_local_players')) || [];
      } catch (e) {
        this.localPlayers = [];
      }
      this.dom.profileModal.classList.add('hidden');
    };
    
    if (this.dom.btnCloseProfile) this.dom.btnCloseProfile.addEventListener('click', closeProfile);

    if (this.dom.profileModal) {
      this.dom.profileModal.addEventListener('click', (e) => {
        if (e.target === this.dom.profileModal) closeProfile();
      });
    }

    if (this.dom.btnAddLocalPlayer) {
      this.dom.btnAddLocalPlayer.addEventListener('click', (e) => {
        e.preventDefault();
        const newPlayerName = this.dom.inputLocalPlayerName.value.trim().substring(0, 12);
        if (!newPlayerName) return;
        
        if (this.localPlayers.includes(newPlayerName)) {
          if (window.Notify) window.Notify.toast("Player name already exists!");
          return;
        }
        
        this.localPlayers.push(newPlayerName);
        this.dom.inputLocalPlayerName.value = '';
        this.renderLocalPlayers();
      });
      
      this.dom.inputLocalPlayerName.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.dom.btnAddLocalPlayer.click();
        }
      });
    }

    if (this.dom.btnSaveProfile) {
      this.dom.btnSaveProfile.addEventListener('click', async () => {
        let newName = this.dom.inputUsername.value.trim().substring(0, 12) || generateRandomName();
        
        localStorage.setItem('gh_username', newName);
        localStorage.setItem('gh_usericon', this.selectedIcon);
        localStorage.setItem('gh_local_players', JSON.stringify(this.localPlayers));

        if (this.dom.displayUsername) this.dom.displayUsername.innerText = newName;
        if (this.dom.displayAvatar) {
           this.dom.displayAvatar.innerText = this.selectedIcon;
           this.dom.displayAvatar.style.backgroundColor = DEFAULT_AVATAR_COLOR;
        }
        
        this.dom.profileModal.classList.add('hidden');
        
        if (window.currentLobbyId) {
           const { updatePlayerProfile } = await import('./database-manager.js');
           await updatePlayerProfile(window.currentLobbyId, window.CLIENT_ID, { 
             name: newName, 
             icon: this.selectedIcon,
             color: DEFAULT_AVATAR_COLOR 
           });
        }
      });
    }
  }
}
