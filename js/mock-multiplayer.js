/**
 * mock-multiplayer.js
 * 
 * This is a mocked version of what the Firebase layer will look like.
 * It uses `localStorage` to simulate a real-time database, allowing you
 * to test "online multiplayer" by opening the game in two separate browser tabs.
 */

// Generate a random 4-character lobby code
function generateLobbyId() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

/**
 * Creates a new lobby
 * @param {string} gameType - e.g. 'tictactoe'
 * @param {object} initialGameState - Starting state
 * @returns {string} lobbyId
 */
export function createLobby(gameType, initialGameState) {
  const lobbyId = generateLobbyId();
  
  const lobbyData = {
    gameType,
    gameState: initialGameState,
    createdAt: Date.now(),
    players: 1
  };
  
  localStorage.setItem(`lobby_${lobbyId}`, JSON.stringify(lobbyData));
  return lobbyId;
}

/**
 * Checks if a lobby exists
 */
export function lobbyExists(lobbyId) {
  return localStorage.getItem(`lobby_${lobbyId}`) !== null;
}

/**
 * Updates the game state
 */
export function updateGameState(lobbyId, newState) {
  const key = `lobby_${lobbyId}`;
  const dataStr = localStorage.getItem(key);
  
  if (!dataStr) return;
  
  const lobbyData = JSON.parse(dataStr);
  lobbyData.gameState = newState;
  
  // Update local storage
  localStorage.setItem(key, JSON.stringify(lobbyData));
}

/**
 * Subscribes to changes in the game state.
 * Because we are mocking via localStorage, we use the window 'storage' event
 * which fires when ANOTHER tab changes localStorage.
 * 
 * We also dispatch a custom event if we want local same-tab updates to trigger it,
 * though typically in games if YOU make the move, you already know the state changed.
 */
export function subscribeToGameState(lobbyId, callback) {
  const key = `lobby_${lobbyId}`;
  
  // Initial callback
  const initial = localStorage.getItem(key);
  if (initial) {
    callback(JSON.parse(initial).gameState);
  }
  
  // Listen for changes from other tabs
  const listener = (event) => {
    if (event.key === key) {
        if(event.newValue) {
            const data = JSON.parse(event.newValue);
            callback(data.gameState);
        }
    }
  };
  
  window.addEventListener('storage', listener);
  
  // Return an unsubscribe function
  return () => {
    window.removeEventListener('storage', listener);
  };
}
