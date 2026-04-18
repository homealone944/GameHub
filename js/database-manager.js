/* js/database-manager.js */
import { 
  db, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  collection, 
  onSnapshot, 
  updateDoc, 
  deleteDoc, 
  arrayUnion, 
  arrayRemove, 
  deleteField 
} from './firebase-init.js';

/**
 * Helper to push lastActiveAt timestamps on every mutating action
 */
export async function touchLobby(lobbyId, updates = {}) {
  updates.lastActiveAt = Date.now();
  console.log(`[Database] touchLobby ATTEMPT path="lobbies/${lobbyId}" (ID length: ${lobbyId?.length})`, updates);
  
  try {
    const docRef = doc(db, "lobbies", lobbyId);
    console.log(`[Database] docRef path resolved to:`, docRef.path);
    await setDoc(docRef, updates, { merge: true });
    console.log(`[Database] touchLobby SUCCESS for ${lobbyId}`);
  } catch (err) {
    console.error(`[Database] touchLobby FAILED for ${lobbyId}:`, err);
    throw err;
  }
}

/**
 * Generate a random 4-character lobby code
 */
export function generateLobbyId() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

/**
 * Creates a new Universal Lobby
 * @param {object} hostConfig - { name, hostId, hostPlayerName, maxPlayers }
 * @returns {string} lobbyId
 */
export async function createUniversalLobby(hostConfig) {
  const lobbyId = generateLobbyId();
  await setDoc(doc(db, "lobbies", lobbyId), {
    name: hostConfig.name,
    hostId: hostConfig.hostId,
    maxPlayers: hostConfig.maxPlayers,
    players: [{ id: hostConfig.hostId, name: hostConfig.hostPlayerName }],
    currentGame: "STAGING",
    gameState: {},
    votes: {},
    playerIds: [hostConfig.hostId],
    isLocked: false,
    createdAt: Date.now(),
    lastActiveAt: Date.now()
  });
  return lobbyId;
}

/**
 * Authenticates and connects a player into a lobby
 */
export async function joinLobby(lobbyId, playerObj) {
  const lobbyRef = doc(db, "lobbies", lobbyId);
  const snap = await getDoc(lobbyRef);
  
  if (!snap.exists()) throw new Error("Lobby not found");
  
  const data = snap.data();
  if (data.isLocked) {
     throw new Error("This lobby is currently locked by the Host.");
  }
  if (data.players.length >= data.maxPlayers) {
    if (!data.players.find(p => p.id === playerObj.id)) {
       throw new Error("Lobby is full");
    }
  }

  await touchLobby(lobbyId, {
    players: arrayUnion(playerObj),
    playerIds: arrayUnion(playerObj.id)
  });
}

/**
 * Removes a player and cleans up their votes
 */
export async function leaveLobby(lobbyId, playerObj) {
  const lobbyRef = doc(db, "lobbies", lobbyId);
  const snap = await getDoc(lobbyRef);
  if (!snap.exists()) return;
  
  const data = snap.data();
  const votes = data.votes || {};
  
  // Scrip votes for this player across all games
  for (const gameId in votes) {
    votes[gameId] = votes[gameId].filter(id => id !== playerObj.id);
  }

  await touchLobby(lobbyId, {
    players: arrayRemove(playerObj),
    playerIds: arrayRemove(playerObj.id),
    votes: votes
  });
}

/**
 * Used strictly by the Host to violently destroy the document
 */
export async function deleteLobby(lobbyId) {
  await deleteDoc(doc(db, "lobbies", lobbyId));
}

/**
 * Sets the active game (bringing everyone in) or drops them out (null)
 */
export async function setLobbyGame(lobbyId, gameId) {
  console.log(`[Database] setLobbyGame: Lobby=${lobbyId}, Game=${gameId}`);
  
  if (!lobbyId) {
    console.error("[Database] setLobbyGame FAILED: No Lobby ID provided.");
    return;
  }

  const updates = {
    currentGame: (gameId === null || gameId === undefined || gameId === "HUB" || gameId === "STAGING") ? "STAGING" : gameId,
    gameState: deleteField() // Reset game state whenever the game changes
  };

  try {
    console.log(`[Database] setLobbyGame COMMIT START for ${lobbyId}`);
    await touchLobby(lobbyId, updates);
    console.log(`[Database] setLobbyGame COMMIT SUCCESS for ${lobbyId}. Field 'currentGame' should now be removed/updated.`);
  } catch (err) {
    console.error(`[Database] setLobbyGame COMMIT ERROR for ${lobbyId}:`, err);
    throw err;
  }
}

/**
 * Host transfers ownership to another player
 */
export async function changeHost(lobbyId, newHostId) {
  await touchLobby(lobbyId, {
    hostId: newHostId
  });
}

/**
 * Host broadcasts a message to the lobby
 */
export async function broadcastMessage(lobbyId, text) {
  await touchLobby(lobbyId, {
    hostMessage: {
       text: text,
       timestamp: Date.now()
    }
  });
}

/**
 * Host explicitly overwrites Name / Max Players config
 */
export async function updateLobbySettings(lobbyId, settings) {
  await touchLobby(lobbyId, settings);
}

/**
 * Any client sets their single game vote
 */
export async function setVote(lobbyId, gameId, playerId) {
  const lobbyRef = doc(db, "lobbies", lobbyId);
  const snap = await getDoc(lobbyRef);
  if (!snap.exists()) return;
  const data = snap.data();
  let votes = data.votes || {};

  let isRemoving = votes[gameId] && votes[gameId].includes(playerId);

  for (const g in votes) {
    votes[g] = votes[g].filter(id => id !== playerId);
  }

  if (!isRemoving) {
    if (!votes[gameId]) votes[gameId] = [];
    votes[gameId].push(playerId);
  }

  await touchLobby(lobbyId, { votes });
}

/**
 * Updates a player's display name if they edit their profile
 */
export async function updatePlayerName(lobbyId, playerId, newName) {
  const lobbyRef = doc(db, "lobbies", lobbyId);
  const snap = await getDoc(lobbyRef);
  if (!snap.exists()) return;
  
  const data = snap.data();
  let changed = false;
  const newPlayers = data.players.map(p => {
     if (p.id === playerId) {
        changed = true;
        return { ...p, name: newName };
     }
     return p;
  });

  if (changed) {
     await touchLobby(lobbyId, { players: newPlayers });
  }
}

/**
 * Updates the game state natively by merging objects.
 * Use this for simple bulk overwrites.
 */
export async function updateGameState(lobbyId, newState) {
  await setDoc(doc(db, "lobbies", lobbyId), {
    gameState: newState
  }, { merge: true });
}

/**
 * Patches specific sub-fields of the game state.
 * Supports dot notation for nested updates (e.g., {"gameState.moves": arrayUnion(move)})
 * Use this for "History" models or atomic updates.
 */
export async function patchGameState(lobbyId, updates) {
  const lobbyRef = doc(db, "lobbies", lobbyId);
  // Ensure updates are targeted at the gameState field
  const finalUpdates = {};
  for (const key in updates) {
    if (key.startsWith('gameState.')) {
      finalUpdates[key] = updates[key];
    } else {
      finalUpdates[`gameState.${key}`] = updates[key];
    }
  }
  await updateDoc(lobbyRef, finalUpdates);
}

/**
 * Subscribes to real-time changes of the universal lobby structure!
 * @returns {function} unsubscribe hook
 */
export function subscribeToLobby(lobbyId, callback) {
  return onSnapshot(doc(db, "lobbies", lobbyId), (docSnap) => {
    callback(docSnap.exists() ? docSnap.data() : null);
  });
}

/**
 * Fetches all active lobbies for garbage collection or listing
 */
export async function getAllLobbies() {
  const lobbiesCol = collection(db, "lobbies");
  const snap = await getDocs(lobbiesCol);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
