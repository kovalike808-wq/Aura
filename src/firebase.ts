import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAd7L81DMIoCUl6guW-DAVU_V2Z9rzk4lI",
  authDomain: "gen-lang-client-0339646751.firebaseapp.com",
  projectId: "gen-lang-client-0339646751",
  storageBucket: "gen-lang-client-0339646751.firebasestorage.app",
  messagingSenderId: "255805494428",
  appId: "1:255805494428:web:3b7d27abe99b96f76d4959",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
