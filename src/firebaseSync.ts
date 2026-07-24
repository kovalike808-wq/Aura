import { AppState } from './types';

const STORAGE_KEY = 'aura-app-state-backup';
const POLL_INTERVAL = 3000;

let onCloudUpdate: ((state: AppState) => void) | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let lastWriteTime = 0;

// --- localStorage helpers ---

export function loadStateFromStorage(): AppState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.tasks)) {
      return parsed as AppState;
    }
    return null;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function saveToStorage(state: AppState): void {
  state.lastUpdated = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// --- Firebase helpers ---

async function getDb() {
  const { getFirestore } = await import('firebase/firestore');
  const { db } = await import('./firebase');
  return db;
}

async function firebaseRead(): Promise<AppState | null> {
  try {
    const { getDoc, doc } = await import('firebase/firestore');
    const db = await getDb();
    const snap = await getDoc(doc(db, 'app_state', 'main'));
    return snap.exists() ? (snap.data() as AppState) : null;
  } catch (err: any) {
    console.warn('[Firebase] Read failed:', err.code || err.message);
    return null;
  }
}

async function firebaseWrite(state: AppState): Promise<boolean> {
  try {
    const { setDoc, doc } = await import('firebase/firestore');
    const db = await getDb();
    lastWriteTime = Date.now();
    await setDoc(doc(db, 'app_state', 'main'), { ...state, lastUpdated: lastWriteTime });
    return true;
  } catch (err: any) {
    console.warn('[Firebase] Write failed:', err.code || err.message);
    return false;
  }
}

// --- Polling: check cloud every N seconds ---

function startPolling() {
  if (pollTimer) return;

  pollTimer = setInterval(async () => {
    const cloud = await firebaseRead();
    if (!cloud) return;

    // Skip if this is our own recent write
    if (cloud.lastUpdated === lastWriteTime) return;

    // Only update if cloud is newer than local
    const local = loadStateFromStorage();
    if (cloud.lastUpdated > (local?.lastUpdated || 0)) {
      console.log('[Firebase] Poll update. Tasks:', cloud.tasks.length);
      saveToStorage(cloud);
      onCloudUpdate?.(cloud);
    }
  }, POLL_INTERVAL);
}

// --- Public API ---

export async function loadState(): Promise<AppState> {
  // 1. Instant from localStorage
  const local = loadStateFromStorage();
  if (local) {
    console.log('[Load] localStorage. Tasks:', local.tasks.length);
    // Start polling in background
    startPolling();
    return local;
  }

  // 2. No local — fetch from Firebase
  console.log('[Load] Fetching from Firebase...');
  const cloud = await firebaseRead();

  if (cloud) {
    saveToStorage(cloud);
    console.log('[Load] Firebase. Tasks:', cloud.tasks.length);
    startPolling();
    return cloud;
  }

  // 3. Empty
  const empty: AppState = {
    tasks: [], goals: [], habits: [], notes: [],
    achievements: [], dailyRatings: [],
    telegram: { botToken: '', botUsername: '', isActive: false },
    taskCategories: ['Дизайн', 'Разработка', 'Здоровье', 'Развитие', 'Быт', 'Разное'],
    lastUpdated: Date.now()
  };
  saveToStorage(empty);
  startPolling();
  return empty;
}

export async function saveState(state: AppState): Promise<void> {
  saveToStorage(state);
  const ok = await firebaseWrite(state);
  if (ok) {
    console.log('[Firebase] Saved. Tasks:', state.tasks.length);
  }
}

export function subscribeToFirebase(callback: (state: AppState) => void): void {
  onCloudUpdate = callback;
  startPolling();
}
