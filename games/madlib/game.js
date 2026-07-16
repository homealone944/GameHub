/* games/madlib/game.js */
import { GameFramework } from '../../js/game-framework.js';
import { MadLibEngine } from './engine.js';
import { STORIES, parseStory } from './stories.js';

// Setup Mock Lobby Data for Local Testbed when directly loading the game in browser
if (!window.currentLobbyData && (new URLSearchParams(window.location.search).has('debug') || true)) {
  console.log("🛠️ MadLib: Mocking local session data");
  window.currentLobbyData = {
    id: 'LOCAL',
    name: 'Local Party',
    hostId: 'guest-1',
    players: [
      { id: 'guest-1', name: 'Player', icon: '👤' }
    ]
  };
  window.CLIENT_ID = 'guest-1';
}

const framework = new GameFramework({
  gameId: 'madlib',
  seating: {
    archetype: 'ffa',
    minPlayers: 1,
    maxPlayers: 2
  },
  engine: MadLibEngine,
  hasLobby: false,    // Bypass generic framework lobby to use custom setup screen
  passThePhone: true, // Automatically triggers standard hand-device overlays
  ui: {
    render: (state, fw) => {
      const lobbyCard = document.getElementById('lobby-card');
      const promptCard = document.getElementById('prompt-card');
      const storyReveal = document.getElementById('story-reveal');

      // Customize the pass-the-phone message to keep it generic
      const nextPlayerEl = document.getElementById('fw-next-player-name');
      if (nextPlayerEl) {
         nextPlayerEl.innerText = "the next person";
      }

      if (state.phase === 'lobby') {
        // --- Custom Lobby/Setup Phase ---
        if (lobbyCard) lobbyCard.classList.remove('hidden');
        if (promptCard) promptCard.classList.add('hidden');
        if (storyReveal) storyReveal.classList.add('hidden');

        // Populate story selector dropdown dynamically if not already populated/changed
        const storySelect = document.getElementById('lobby-story-select');
        if (storySelect) {
          const currentVal = storySelect.value;
          const optionsHTML = Object.entries(STORIES).map(([id, story]) => {
            const count = parseStory(story.text).length;
            return `<option value="${id}">${story.title} (${count} prompts)</option>`;
          }).join('\n');
          
          if (storySelect.innerHTML.trim() === "" || currentVal !== state.storyId) {
            storySelect.innerHTML = optionsHTML;
            storySelect.value = state.storyId;
          }
        }

        // Mode dropdown
        const modeSelect = document.getElementById('lobby-mode-select');
        if (modeSelect) {
          modeSelect.value = state.mode;
        }

      } else if (state.phase === 'setup') {
        // --- Prompt Answering Phase ---
        if (lobbyCard) lobbyCard.classList.add('hidden');
        if (promptCard) promptCard.classList.remove('hidden');
        if (storyReveal) storyReveal.classList.add('hidden');

        const story = STORIES[state.storyId];
        if (story) {
          const prompts = parseStory(story.text);
          const currentPromptNum = document.getElementById('current-prompt-number');
          const totalPromptsNum = document.getElementById('total-prompts-number');
          const promptLabel = document.getElementById('prompt-label');
          const promptInput = document.getElementById('prompt-input');

          if (currentPromptNum) currentPromptNum.innerText = state.currentPromptIdx + 1;
          if (totalPromptsNum) totalPromptsNum.innerText = prompts.length;
          
          if (promptLabel) {
            const promptType = prompts[state.currentPromptIdx] || "Word";
            promptLabel.innerText = `Give a ${promptType.toLowerCase()}`;
          }

          // Reset and refocus input when turning to a new prompt
          if (promptInput) {
            if (promptInput.dataset.lastIdx !== String(state.currentPromptIdx)) {
              promptInput.value = '';
              promptInput.dataset.lastIdx = state.currentPromptIdx;
              
              setTimeout(() => {
                promptInput.focus();
              }, 100);
            }
          }
        }
      } else if (state.phase === 'story') {
        // --- Final Story Reveal Phase ---
        if (lobbyCard) lobbyCard.classList.add('hidden');
        if (promptCard) promptCard.classList.add('hidden');
        if (storyReveal) storyReveal.classList.remove('hidden');

        const storyTitle = document.getElementById('story-title');
        const storyText = document.getElementById('story-text');

        if (storyTitle) storyTitle.innerText = state.storyTitle || "Compiled Story";
        if (storyText) storyText.innerHTML = state.storyHTML || "";
      }
    }
  }
});

// Expose framework globally
window.framework = framework;

function setupUI() {
  const form = document.getElementById('prompt-form');
  const input = document.getElementById('prompt-input');
  const btnEndGame = document.getElementById('btn-end-game');

  // Lobby UI elements
  const storySelect = document.getElementById('lobby-story-select');
  const modeSelect = document.getElementById('lobby-mode-select');
  const btnRandomStory = document.getElementById('btn-random-story');
  const btnStartMatch = document.getElementById('btn-start-match');

  // Update settings handler
  const triggerSettingsUpdate = () => {
    if (!storySelect || !modeSelect) return;
    framework.handleAction({
      type: 'updateSettings',
      storyId: storySelect.value,
      mode: modeSelect.value
    });
  };

  if (storySelect) {
    storySelect.addEventListener('change', triggerSettingsUpdate);
  }
  if (modeSelect) {
    modeSelect.addEventListener('change', triggerSettingsUpdate);
  }

  // Choose Random
  if (btnRandomStory) {
    btnRandomStory.addEventListener('click', () => {
      framework.handleAction({ type: 'randomStory' });
    });
  }

  // Start Match
  if (btnStartMatch) {
    btnStartMatch.addEventListener('click', () => {
      framework.handleAction({ type: 'startMatch' });
    });
  }

  // Prompt Submit
  if (form && input) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = input.value.trim();
      if (!val) return;

      framework.handleAction({ type: 'answer', val });
    });
  }

  // End Game
  if (btnEndGame) {
    btnEndGame.addEventListener('click', () => {
      framework.handleAction({ type: 'endGame' });
    });
  }
}

// Bind events and initialize
setupUI();
framework.init();
