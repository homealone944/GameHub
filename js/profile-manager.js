/* js/profile-manager.js */
import { generateRandomName } from './names.js';

const ICON_CHOICES = ["👤", "🐱", "🐶", "🦊", "🐯", "🐼", "🐨", "🦁", "🦒", "🦓", "🐘", "🎩", "🕶️", "🚀", "💎", "🍎"];
const DEFAULT_AVATAR_COLOR = '#252525';

export class ProfileManager {
  constructor(isHub = true) {
    this.isHub = isHub;
    this.selectedIcon = localStorage.getItem('gh_usericon') || '👤';
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
        
        if (this.dom.modalPreviewAvatar) {
          this.dom.modalPreviewAvatar.innerText = this.selectedIcon;
          this.dom.modalPreviewAvatar.style.backgroundColor = DEFAULT_AVATAR_COLOR;
        }
        
        this.renderSelectors();
        this.dom.profileModal.classList.remove('hidden');
      });
    }

    const closeProfile = () => this.dom.profileModal.classList.add('hidden');
    if (this.dom.btnCloseProfile) this.dom.btnCloseProfile.addEventListener('click', closeProfile);

    if (this.dom.profileModal) {
      this.dom.profileModal.addEventListener('click', (e) => {
        if (e.target === this.dom.profileModal) closeProfile();
      });
    }

    if (this.dom.btnSaveProfile) {
      this.dom.btnSaveProfile.addEventListener('click', async () => {
        let newName = this.dom.inputUsername.value.trim().substring(0, 12) || generateRandomName();
        
        localStorage.setItem('gh_username', newName);
        localStorage.setItem('gh_usericon', this.selectedIcon);

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
