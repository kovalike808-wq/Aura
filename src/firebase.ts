import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCmP7j7sBjuX-8TlSmMtrjs-4yFXnRKBtQ",
  authDomain: "aura-98747.firebaseapp.com",
  projectId: "aura-98747",
  storageBucket: "aura-98747.firebasestorage.app",
  messagingSenderId: "513766677044",
  appId: "1:513766677044:web:07fccefd6b3248326fc861",
};

const FIRESTORE_DATABASE_ID = '(default)';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, FIRESTORE_DATABASE_ID);
