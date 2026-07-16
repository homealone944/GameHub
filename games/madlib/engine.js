import { STORIES, parseStory, compileStory } from './stories.js';

export const MadLibEngine = {
  getInitialState: (config = {}) => {
    const keys = Object.keys(STORIES);
    const randomStoryId = keys[Math.floor(Math.random() * keys.length)] || 'pizza';
    return {
      status: 'playing',
      phase: 'lobby',
      storyId: randomStoryId,
      mode: 'together',
      currentPromptIdx: 0,
      answers: {},
      activeSlotIndex: 0,
      slots: [
        { id: 'p1', name: 'Player 1', team: '_default' },
        { id: 'p2', name: 'Player 2', team: '_default' }
      ],
      statusText: "Setting up...",
      storyHTML: null,
      storyTitle: null
    };
  },

  applyMove: (state, action, slotIndex) => {
    if (state.status !== 'playing') return null;

    const newState = JSON.parse(JSON.stringify(state));

    if (action.type === 'updateSettings') {
      if (newState.phase !== 'lobby') return null;
      newState.storyId = action.storyId || newState.storyId;
      newState.mode = action.mode || newState.mode;
      return newState;
    }

    if (action.type === 'randomStory') {
      if (newState.phase !== 'lobby') return null;
      const keys = Object.keys(STORIES);
      let nextKey = keys[Math.floor(Math.random() * keys.length)];
      if (keys.length > 1 && nextKey === newState.storyId) {
        nextKey = keys.find(k => k !== newState.storyId) || nextKey;
      }
      newState.storyId = nextKey;
      return newState;
    }

    if (action.type === 'startMatch') {
      if (newState.phase !== 'lobby') return null;

      newState.phase = 'setup';
      newState.currentPromptIdx = 0;
      newState.answers = {};
      newState.activeSlotIndex = 0;
      newState.statusText = "Player's turn";
      return newState;
    }

    if (action.type === 'endGame') {
      newState.status = 'finished';
      newState.winner = 'victory';
      newState.statusText = "Story Compiled!";
      return newState;
    }

    if (action.type === 'answer') {
      if (newState.phase !== 'setup') return null;

      const val = action.val.trim();
      if (!val) return null;

      const story = STORIES[newState.storyId];
      const prompts = parseStory(story.text);

      // Record the answer
      newState.answers[newState.currentPromptIdx] = val;

      // Check if that was the last prompt
      if (newState.currentPromptIdx + 1 >= prompts.length) {
        newState.phase = 'story';
        newState.statusText = "Read Your Story!";

        // Compile final HTML here to persist on state
        const answersArray = Array.from({ length: prompts.length }, (_, i) => newState.answers[i] || '___');
        newState.storyHTML = compileStory(story.text, answersArray);
        newState.storyTitle = story.title;
        newState.activeSlotIndex = null; // No active turn during reveal
      } else {
        newState.currentPromptIdx++;
        
        if (newState.mode === 'pass' && newState.slots && newState.slots.length > 0) {
          newState.activeSlotIndex = newState.currentPromptIdx % newState.slots.length;
        } else {
          newState.activeSlotIndex = 0;
        }
        newState.statusText = "Player's turn";
      }
      return newState;
    }

    return null;
  },

  checkGameOver: (state) => {
    if (state.status === 'finished') {
      return {
        winner: 'victory',
        title: "STORY COMPILED!",
        subtitle: "Your masterpiece is ready. 📖",
        glowColor: "rgba(16, 185, 129, 0.2)"
      };
    }
    return null;
  },

  hasSettings: false,

  getRulesHTML: () => `
    <p>MadLib is a word game where players provide words to fill in the blanks of a hidden story!</p>
    <ul style="margin-top: 0.5rem; padding-left: 1rem;">
      <li>Select a story template and play mode in the setup screen.</li>
      <li>Enter a word matching the requested prompt (noun, verb, adjective, etc.).</li>
      <li>If playing in Pass & Play, hand the device to the next person when prompted.</li>
      <li>Once all prompts are filled, read your completed story together!</li>
    </ul>
  `
};
