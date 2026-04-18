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

// Initialize Firebase with stable connection settings
const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  useFetchStreams: false
});

// Export instances and primitives for the Database Manager
export { 
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
};
