import { AppState } from './types';

const STORAGE_KEY = 'aura-app-state-backup';

// Load state from localStorage (instant, always works)
export function loadStateFromStorage(): AppState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.tasks)) {
      return parsed as AppState;
    }
    return null;
  } catch (err) {
    console.error('[Storage] Failed to load:', err);
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

// Save state to localStorage (instant, always works)
export function saveStateToStorage(state: AppState): void {
  try {
    state.lastUpdated = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    console.log('[Storage] Saved. Tasks:', state.tasks.length);
  } catch (err) {
    console.error('[Storage] Failed to save:', err);
  }
}

// Firebase sync (optional, runs in background)
let firebaseAvailable = false;

async function tryFirebaseLoad(): Promise<AppState | null> {
  try {
    const { getDoc, doc } = await import('firebase/firestore');
    const { db } = await import('./firebase');
    const mainDoc = await getDoc(doc(db, 'app_state', 'main'));
    if (mainDoc.exists()) {
      firebaseAvailable = true;
      return mainDoc.data() as AppState;
    }
    return null;
  } catch (err) {
    console.warn('[Firebase] Not available:', err.message);
    firebaseAvailable = false;
    return null;
  }
}

async function tryFirebaseSave(state: AppState): Promise<boolean> {
  if (!firebaseAvailable) return false;
  try {
    const { setDoc, doc } = await import('firebase/firestore');
    const { db } = await import('./firebase');
    await setDoc(doc(db, 'app_state', 'main'), { ...state, lastUpdated: Date.now() });
    console.log('[Firebase] Saved to cloud.');
    return true;
  } catch (err) {
    console.warn('[Firebase] Save failed:', err.message);
    firebaseAvailable = false;
    return false;
  }
}

// Main load: localStorage first, then try Firebase in background
export async function loadState(): Promise<AppState> {
  // 1. Instant load from localStorage
  const local = loadStateFromStorage();
  const empty: AppState = {
    tasks: [], goals: [], habits: [], notes: [], ideas: [],
    achievements: [], dailyRatings: [],
    telegram: { botToken: '', botUsername: '', isActive: false },
    taskCategories: ['Дизайн', 'Разработка', 'Здоровье', 'Развитие', 'Быт', 'Разное'],
    lastUpdated: Date.now()
  };

  if (local) {
    console.log('[Load] From localStorage. Tasks:', local.tasks.length);
    // Try Firebase in background (don't block)
    tryFirebaseLoad().then(cloud => {
      if (cloud && cloud.lastUpdated > local.lastUpdated) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cloud));
        console.log('[Load] Firebase has newer data, updated localStorage.');
      }
    }).catch(() => {});
    return local;
  }

  // 2. No local data — try Firebase
  console.log('[Load] No local cache, trying Firebase...');
  const cloud = await Promise.race([
    tryFirebaseLoad(),
    new Promise<null>(r => setTimeout(() => r(null), 5000))
  ]);

  if (cloud) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cloud));
    console.log('[Load] From Firebase. Tasks:', cloud.tasks.length);
    return cloud;
  }

  // 3. Nothing — return empty state
  console.log('[Load] No data anywhere, starting fresh.');
  localStorage.setItem(STORAGE_KEY, JSON.stringify(empty));
  return empty;
}

// Main save: localStorage always, Firebase in background
export async function saveState(state: AppState): Promise<void> {
  // 1. Always save to localStorage (instant)
  saveStateToStorage(state);

  // 2. Try Firebase in background (non-blocking)
  tryFirebaseSave(state).catch(() => {});
}
