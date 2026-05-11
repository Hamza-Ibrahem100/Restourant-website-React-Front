import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, FacebookAuthProvider } from "firebase/auth";
import { getDatabase, ref, set, get, update, remove, onValue, push, child, serverTimestamp } from "firebase/database";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyAR2z1DEr1OY5MbRDQxWM7OBQ8Ou-au25s",
  authDomain: "restaurant-food-lover.firebaseapp.com",
  projectId: "restaurant-food-lover",
  storageBucket: "restaurant-food-lover.firebasestorage.app",
  messagingSenderId: "835872524416",
  appId: "1:835872524416:web:39c7f3444c82090e133e65",
  measurementId: "G-FCQHNVQ1WF",
  databaseURL: "https://restaurant-food-lover-default-rtdb.firebaseio.com"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const facebookProvider = new FacebookAuthProvider();
export const db = getDatabase(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// Connect to local functions emulator if running on localhost
if (window.location.hostname === 'localhost') {
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}