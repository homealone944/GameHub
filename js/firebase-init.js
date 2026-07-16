/* js/firebase-init.js */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
  initializeFirestore,
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
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// GameHub Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDlWeqH_T07o_zACqU7bUk8D5eMwinFkCk",
  authDomain: "gamehub-f5d58.firebaseapp.com",
  projectId: "gamehub-f5d58",
  storageBucket: "gamehub-f5d58.firebasestorage.app",
  messagingSenderId: "746688870410",
  appId: "1:746688870410:web:d444ecb7d20680146907f3"
};

// Initialize Firebase lazily only when requested
let app = null;
let db = null;

function getDB() {
  if (!db) {
     console.log("[Firebase] Lazy Initializing SDK...");
     app = initializeApp(firebaseConfig);
     db = initializeFirestore(app, {
       experimentalForceLongPolling: true,
       useFetchStreams: false
     });
  }
  return db;
}

// Export initialization helper and primitives
export { 
  getDB, 
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
};
