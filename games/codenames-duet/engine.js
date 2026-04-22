/* games/codenames-duet/engine.js */

export const ROWS = 5;
export const COLS = 5;

export const CodenamesEngine = {
  getInitialState: (config = {}) => {
    const words = generateWords(config.customWords);
    const keys = generateKeysInternal();
    return {
      words: words,
      p1Key: keys.p1,
      p2Key: keys.p2,
      revealed: Array(25).fill(null),
      activeSlotIndex: 0, // Slot 0 (Agent 1) or Slot 1 (Agent 2)
      phase: 'setup',
      turnsLeft: config.maxTurns || 9,
      status: 'playing', // 'playing' or 'finished'
      winner: null,
      greensFound: 0,
      log: []
    };
  },

  applyMove: (state, action, slotIndex) => {
    if (state.status === 'finished') return null;
    const newState = { ...state, log: [...state.log] };

    // Initial Start Action
    if (action.type === 'start') {
      if (newState.phase !== 'setup') return null;
      newState.phase = 'intel';
      newState.activeSlotIndex = 0;
      return newState;
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
        }
      } else { // Bystander
        if (newState.revealed[index] === null) {
          newState.revealed[index] = `bystander-${slotIndex}`;
        } else {
          newState.revealed[index] = 'bystander';
        }
        currentLog.guesses.push({ word: wordStr, type: 'bystander' });
        // Auto-end turn on bystander
        newState.phase = 'intel';
        // Check for out of turns
        if (newState.turnsLeft <= 0 && newState.greensFound < 15) {
          newState.status = 'finished';
          newState.winner = 'timeout';
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
        newState.phase = 'intel';
      }
      return newState;
    }

    return null;
  },

  checkGameOver: (state) => {
    if (state.status === 'finished') {
       if (state.winner === 'victory') return { winner: 0 }; // 0 represents the whole team in Duet
       return { winner: 'defeat' }; // Special case handled in framework? 
       // NOTE: GameFramework expects winner to be an index for winners, or 'draw'
       // I'll return [0,1] meaning both Slots won.
       if (state.winner === 'victory') return { winner: [0, 1] };
       return { winner: 'defeat' }; 
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
  `
};

/**
 * --- INTERNAL UTILS ---
 */

function generateWords(custom = []) {
  // Mock DEFAULT_WORDS if not imported
  const FALLBACK_WORDS = ["APPLE","BANANA","CRANE","DOG","EAGLE","FLAME","GRAPE","HOUSE","ICE","JELLY","KITE","LEMON","MOUSE","NIGHT","OCEAN","PIZZA","QUEEN","RIVER","SNAKE","TIGER","UNDER","VINE","WHALE","XRAY","YACHT"];
  let pool = (custom && custom.length >= 25) ? custom : FALLBACK_WORDS;
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
