import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, getDocs, collection, onSnapshot, updateDoc, deleteDoc, arrayUnion, arrayRemove, deleteField } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// =======================================================
const firebaseConfig = {
  apiKey: "AIzaSyDlWeqH_T07o_zACqU7bUk8D5eMwinFkCk",
  authDomain: "gamehub-f5d58.firebaseapp.com",
  projectId: "gamehub-f5d58",
  storageBucket: "gamehub-f5d58.firebasestorage.app",
  messagingSenderId: "746688870410",
  appId: "1:746688870410:web:d444ecb7d20680146907f3"
};

// =======================================================

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Helper to push lastActiveAt timestamps on every mutating action
export async function touchLobby(lobbyId, updates = {}) {
  updates.lastActiveAt = Date.now();
  console.log(`[Firebase] touchLobby ATTEMPT path="lobbies/${lobbyId}" (ID length: ${lobbyId?.length})`, updates);
  
  try {
    const docRef = doc(db, "lobbies", lobbyId);
    console.log(`[Firebase] docRef path resolved to:`, docRef.path);
    await setDoc(docRef, updates, { merge: true });
    console.log(`[Firebase] touchLobby SUCCESS for ${lobbyId}`);
  } catch (err) {
    console.error(`[Firebase] touchLobby FAILED for ${lobbyId}:`, err);
    throw err;
  }
}

// Generate a random 4-character lobby code
function generateLobbyId() {
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
  // Check max players
  if (data.isLocked) {
     throw new Error("This lobby is currently locked by the Host.");
  }
  if (data.players.length >= data.maxPlayers) {
    // Exception: if player is already in the list (re-joining) let them in
    if (!data.players.find(p => p.id === playerObj.id)) {
       throw new Error("Lobby is full");
    }
  }

  // Push user into array safely
  await touchLobby(lobbyId, {
    players: arrayUnion(playerObj)
  });
}

/**
 * Removes a player
 */
export async function leaveLobby(lobbyId, playerObj) {
  await touchLobby(lobbyId, {
    players: arrayRemove(playerObj)
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
  console.log(`[Firebase] setLobbyGame PRE-FLIGHT: Lobby=${lobbyId}, Game=${gameId}`);
  
  if (!lobbyId) {
    console.error("[Firebase] setLobbyGame FAILED: No Lobby ID provided.");
    return;
  }

  const updates = {
    currentGame: (gameId === null || gameId === undefined || gameId === "hub" || gameId === "STAGING") ? "STAGING" : gameId,
    gameState: deleteField() // Reset game state whenever the game changes
  };

  try {
    console.log(`[Firebase] setLobbyGame COMMIT START for ${lobbyId}`);
    await touchLobby(lobbyId, updates);
    console.log(`[Firebase] setLobbyGame COMMIT SUCCESS for ${lobbyId}. Field 'currentGame' should now be removed/updated.`);
  } catch (err) {
    console.error(`[Firebase] setLobbyGame COMMIT ERROR for ${lobbyId}:`, err);
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

  // Remove player from all games to enforce single vote
  for (const g in votes) {
    votes[g] = votes[g].filter(id => id !== playerId);
  }

  // If they were not removing their vote from this same game, add it
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
 */
export async function updateGameState(lobbyId, newState) {
  await setDoc(doc(db, "lobbies", lobbyId), {
    gameState: newState
  }, { merge: true });
}

/**
 * Subscribes to real-time changes of the universal lobby structure!
 * @returns {function} unsubscribe hook
 */
export function subscribeToLobby(lobbyId, callback) {
  return onSnapshot(doc(db, "lobbies", lobbyId), (docSnap) => {
    callback(docSnap.exists() ? docSnap.data() : null);
  });
}/**
 * Fetches all active lobbies for garbage collection or listing
 */
export async function getAllLobbies() {
  const lobbiesCol = collection(db, "lobbies");
  const snap = await getDocs(lobbiesCol);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
