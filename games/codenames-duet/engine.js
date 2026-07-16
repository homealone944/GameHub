/* games/codenames-duet/engine.js */
import { DEFAULT_WORDS } from './words.js';

export const ROWS = 5;
export const COLS = 5;

export const CodenamesEngine = {
  getInitialState: (config = {}) => {
    // Preserve config in state if provided
    const maxTurns = parseInt(config.maxTurns) || 9;
    const words = generateWords(config.customWords);
    const keys = generateKeysInternal();
    return {
      words: words,
      p1Key: keys.p1,
      p2Key: keys.p2,
      revealed: Array(25).fill(null),
      activeSlotIndex: null, // No active player until start
      phase: 'setup',
      turnsLeft: maxTurns,
      config: config,
      status: 'playing', 
      winner: null,
      greensFound: 0,
      log: [],
      revealAll: false
    };
  },

  applyMove: (state, action, slotIndex) => {
    if (action.type === 'toggleReveal') {
      const ns = JSON.parse(JSON.stringify(state));
      ns.revealAll = !ns.revealAll;
      return ns;
    }
    if (state.status === 'finished') return null;
    const newState = { ...state, log: [...state.log] };

    // Initial Start Action
    if (action.type === 'start') {
      if (newState.phase !== 'setup') return null;
      newState.status = 'playing'; 
      return transitionToIntel(newState, 0);
    }

    // Clue Submission (Intel Phase)
    if (action.type === 'clue') {
      if (newState.phase !== 'setup' && newState.phase !== 'intel') return null;
      
      const clueStr = `${action.word.toUpperCase()}(${action.num})`;
      newState.log.push({
        player: slotIndex,
        clue: clueStr,
        guesses: []
      });
      newState.turnsLeft--;
      newState.activeSlotIndex = slotIndex === 0 ? 1 : 0;
      newState.phase = 'guessing';
      newState.statusText = `${newState.slots[newState.activeSlotIndex].name} is GUESSING`;
      return newState;
    }

    // Guessing Turn - Card Click
    if (action.type === 'card') {
      if (newState.phase !== 'guessing') return null;
      const index = action.index;
      
      const currentReveal = newState.revealed[index];
      if (currentReveal === 'green' || currentReveal === 'black' || currentReveal === 'bystander') return null;
      if (currentReveal === `bystander-${slotIndex}`) return null;

      const opposingKey = slotIndex === 0 ? newState.p2Key : newState.p1Key;
      const type = opposingKey[index];
      const wordStr = newState.words[index];

      const currentLog = newState.log[newState.log.length - 1];
      
      if (type === 2) { // Assassin
        newState.revealed[index] = 'black';
        currentLog.guesses.push({ word: wordStr, type: 'assassin' });
        newState.status = 'finished';
        newState.winner = 'assassin';
      } else if (type === 1) { // Agent
        newState.revealed[index] = 'green';
        newState.greensFound++;
        currentLog.guesses.push({ word: wordStr, type: 'agent' });
        // Check if all found
        if (newState.greensFound >= 15) {
          newState.status = 'finished';
          newState.winner = 'victory';
        } else {
          // Check if this player has found all remaining opposing agents
          let opposingAgentsGuessed = 0;
          for (let i = 0; i < 25; i++) {
             if (opposingKey[i] === 1 && newState.revealed[i] === 'green') {
                opposingAgentsGuessed++;
             }
          }
          if (opposingAgentsGuessed >= 9) {
             if (newState.turnsLeft <= 0) {
                newState.status = 'finished';
                newState.winner = 'timeout';
             } else {
                return transitionToIntel(newState, slotIndex);
             }
          }
        }
      } else { // Bystander
        if (newState.revealed[index] === null) {
          newState.revealed[index] = `bystander-${slotIndex}`;
        } else {
          newState.revealed[index] = 'bystander';
        }
        currentLog.guesses.push({ word: wordStr, type: 'bystander' });
        // Auto-end turn on bystander
        if (newState.turnsLeft <= 0 && newState.greensFound < 15) {
          newState.status = 'finished';
          newState.winner = 'timeout';
        } else {
          return transitionToIntel(newState, slotIndex);
        }
      }
      return newState;
    }

    // End Guessing Turn
    if (action.type === 'endTurn') {
      if (newState.phase !== 'guessing') return null;
      
      if (newState.turnsLeft <= 0 && newState.greensFound < 15) {
        newState.status = 'finished';
        newState.winner = 'timeout';
      } else {
        return transitionToIntel(newState, slotIndex);
      }
      return newState;
    }

    return null;
  },

  checkGameOver: (state, lastSlotIndex, mySlotIndex, isOnline) => {
    if (state.status === 'finished') {
       if (state.winner === 'victory') return { 
         winner: 'victory',
         title: "MISSION SUCCESS",
         subtitle: `All 15 secret agents have been safely contacted! ✨`,
         glowColor: "#4ecdc4" // Mint/Success
       };
       if (state.winner === 'assassin') return { 
         winner: 'assassin',
         title: "MISSION FAILED",
         subtitle: `You contacted the Assassin! 💀`,
         glowColor: "#ff6b6b" // Coral/Failure
       };
      if (state.winner === 'timeout') return {
        winner: 'timeout',
        title: "MISSION FAILED",
        subtitle: "You ran out of time. Better luck next time, agents. 💀",
        glowColor: "#ff6b6b" // Coral/Failure
      };
      else return { 
         winner: 'defeat',
         title: "MISSION FAILED",
         subtitle: "The mission was compromised. Better luck next time, agents. 💀",
         glowColor: "#ff6b6b" // Coral/Failure
      }; 
    }
    return null;
  },
  getRulesHTML: () => `
    <p>Codenames Duet is a cooperative game where you work together to find 15 secret agents.</p>
    <h3 style="color: var(--text-primary); margin-top: 1rem;">The Board</h3>
    <p>You see 25 words. Some are Agents (Green), some are Assassins (Black), and some are Bystanders.</p>
    <h3 style="color: var(--text-primary); margin-top: 1rem;">Intel Phase</h3>
    <p>Give your partner a one-word clue and a number. The number tells them how many Agents on their side relate to that word.</p>
    <h3 style="color: var(--text-primary); margin-top: 1rem;">Guessing Phase</h3>
    <p>Your partner taps cards to find Agents. If they find an Agent, they can keep guessing. Find a Bystander, and the turn ends. Hit an Assassin, and the mission fails immediately!</p>
  `,

  getSettingsHTML: (config = {}) => {
    const turns = config.maxTurns || 9;
    const wordlist = (config.customWords && config.customWords.length > 0) 
      ? config.customWords.join(', ') 
      : DEFAULT_WORDS.join(', ');

    return `
      <div class="fw-settings-group">
        <label class="fw-settings-label">Turns <span class="range-val-badge">${turns}</span></label>
        <p style="font-size: 0.7rem; color: var(--text-secondary); margin-bottom: 0.5rem;">Time tokens available for the mission.</p>
        <input type="range" name="maxTurns" value="${turns}" min="3" max="15" class="fw-settings-range" 
               oninput="this.parentElement.querySelector('.range-val-badge').innerText = this.value">
      </div>

      <div class="fw-settings-group">
        <label class="fw-settings-label">Word List Pool</label>
        <p style="font-size: 0.7rem; color: var(--text-secondary); margin-bottom: 0.5rem;">Edit the list below (comma separated) to customize the word pool.</p>
        <textarea name="wordlist" class="fw-settings-textarea" spellcheck="false">${wordlist}</textarea>
      </div>
    `;
  },

  _defaultWordsCSV: DEFAULT_WORDS.join(', '),

  applySettings: (formData) => {
    const rawWords = formData.get('wordlist') || '';
    const cleanWordList = rawWords.split(',')
      .map(w => w.trim())
      .filter(w => w.length > 0);

    if (cleanWordList.length < 25) {
      return { error: `Word list must have at least 25 words (Found ${cleanWordList.length})` };
    }

    return {
      maxTurns: parseInt(formData.get('maxTurns')),
      customWords: cleanWordList
    };
  }
};

/**
 * --- INTERNAL UTILS ---
 */

function generateWords(custom = []) {
  let pool = (custom && custom.length >= 25) ? custom : DEFAULT_WORDS;
  return [...pool].sort(() => 0.5 - Math.random()).slice(0, 25);
}

function generateKeysInternal() {
  const distribution = [
    [1,1], [1,1], [1,1], [1,0], [1,0], [1,0], [1,0], [1,0], [0,1], [0,1], [0,1], [0,1], [0,1], 
    [1,2], [2,1], [2,2], [2,0], [0,2], [0,0], [0,0], [0,0], [0,0], [0,0], [0,0], [0,0]
  ];
  distribution.sort(() => 0.5 - Math.random());
  const p1 = [];
  const p2 = [];
  for (let i = 0; i < 25; i++) {
    p1[i] = distribution[i][0];
    p2[i] = distribution[i][1];
  }
  return { p1, p2 };
}

function transitionToIntel(state, lastGuesser) {
  // In Duet, the person who was just guessing is now the one who gives the clue.
  const nextPlayer = lastGuesser;
  const otherPlayer = lastGuesser === 0 ? 1 : 0;
  
  const hasAgents = (player) => {
    const key = player === 0 ? state.p1Key : state.p2Key;
    for (let i = 0; i < 25; i++) {
       if (key[i] === 1 && state.revealed[i] !== 'green') return true;
    }
    return false;
  };

  // Check if target player has any info. If not, check the other player.
  if (hasAgents(nextPlayer)) {
    state.activeSlotIndex = nextPlayer;
    state.phase = 'intel';
    state.statusText = `${state.slots[nextPlayer].name} is gathering Intel`;
    // state.blockerTitle = "Intel from " + state.slots[nextPlayer].name;
    state.blockerTitle = "TRANSFERRING INTEL";
  } else if (hasAgents(otherPlayer)) {
    state.activeSlotIndex = otherPlayer;
    state.phase = 'intel';
    state.statusText = `${state.slots[otherPlayer].name} is gathering Intel`;
    state.blockerTitle = "TRANSFERRING INTEL";
    // state.blockerTitle = "Intel from " + state.slots[otherPlayer].name;
  } else {
    // No one has any agents left! Should have triggered victory already, 
    // but safety fallback to finishing.
  }
  return state;
}
