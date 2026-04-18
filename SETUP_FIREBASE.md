# Transitioning from Mock to Real Firebase

Currently, the `js/mock-multiplayer.js` file handles local real-time multiplayer by using the browser's `localStorage` and `storage` event listeners. This means you can test multi-window connections locally, but they won't work across different computers over the internet.

To enable true online multiplayer, you need to set up Firebase and swap the logic. Follow these steps:

### 1. Create a Firebase Project
1. Go to the [Firebase Console](https://console.firebase.google.com/) and click **Add Project**.
2. Name your project (e.g. "GameHub"). Disable Google Analytics for simplicity.
3. Once created, click the **Web** icon (`</>`) to add a web app to your project.
4. Name the app "GameHub Web".
5. Firebase will provide you with a `firebaseConfig` object containing your `apiKey`, `projectId`, etc. Save this.

### 2. Enable Firestore
1. In the left sidebar of the Firebase Console, navigate to **Firestore Database**.
2. Click **Create Database**. 
3. Start in **Test Mode** (you can secure your rules later) and choose a location close to you.

### 3. Replace the Code
Once Firebase is ready, replace your app's `js/mock-multiplayer.js` file with `js/multiplayer.js` which should look something like this:

```javascript
/* js/multiplayer.js */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  // PASTE YOUR FIREBASE CONFIG HERE
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  // ...
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function generateLobbyId() { ... }

export async function createLobby(gameType, initialGameState) {
  const lobbyId = generateLobbyId();
  await setDoc(doc(db, "lobbies", lobbyId), {
    gameType,
    gameState: initialGameState,
    createdAt: Date.now()
  });
  return lobbyId;
}

export async function lobbyExists(lobbyId) {
  const docSnap = await getDoc(doc(db, "lobbies", lobbyId));
  return docSnap.exists();
}

export async function updateGameState(lobbyId, newState) {
  await setDoc(doc(db, "lobbies", lobbyId), {
    gameState: newState
  }, { merge: true });
}

export function subscribeToGameState(lobbyId, callback) {
  // Returns an unsubscribe function just like our mock!
  return onSnapshot(doc(db, "lobbies", lobbyId), (doc) => {
    if (doc.exists()) {
      callback(doc.data().gameState);
    }
  });
}
```

By abstracting `createLobby`, `updateGameState`, and `subscribeToGameState`, the rest of the game code will function identically whether it runs on the local mock or the real Firebase.
