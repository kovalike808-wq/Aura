import { AppState } from './types';

const STORAGE_KEY = 'aura-app-state-backup';

// State change callback — set by App.tsx
let onCloudUpdate: ((state: AppState) => void) | null = null;

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
function saveStateToStorage(state: AppState): void {
  try {
    state.lastUpdated = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('[Storage] Failed to save:', err);
  }
}

// --- Firebase Real-time Sync ---

let unsubscribe: (() => void) | null = null;
let lastWrittenTimestamp = 0;

// Start real-time listener on Firestore
export function subscribeToFirebase(callback: (state: AppState) => void): void {
  onCloudUpdate = callback;

  (async () => {
    try {
      const { onSnapshot, doc } = await import('firebase/firestore');
      const { db } = await import('./firebase');

      unsubscribe = onSnapshot(
        doc(db, 'app_state', 'main'),
        (snapshot) => {
          if (!snapshot.exists()) {
            console.log('[Firebase] No cloud document yet.');
            return;
          }

          const cloud = snapshot.data() as AppState;

          // Skip if this is our own write (avoid feedback loop)
          if (cloud.lastUpdated === lastWrittenTimestamp) {
            return;
          }

          // Only update if cloud is newer
          const local = loadStateFromStorage();
          if (cloud.lastUpdated > (local?.lastUpdated || 0)) {
            console.log('[Firebase] Real-time update received. Tasks:', cloud.tasks.length);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(cloud));
            onCloudUpdate?.(cloud);
          }
        },
        (err) => {
          console.warn('[Firebase] Listener error:', err.code, err.message);
        }
      );

      console.log('[Firebase] Real-time listener started.');
    } catch (err: any) {
      console.warn('[Firebase] Failed to start listener:', err.code || err.message);
    }
  })();
}

// Stop real-time listener
export function unsubscribeFromFirebase(): void {
  unsubscribe?.();
  unsubscribe = null;
}

// Save to localStorage + Firebase
export async function saveState(state: AppState): Promise<void> {
  saveStateToStorage(state);

  // Write to Firebase with timestamp to avoid feedback loop
  try {
    const { setDoc, doc } = await import('firebase/firestore');
    const { db } = await import('./firebase');
    lastWrittenTimestamp = Date.now();
    await setDoc(doc(db, 'app_state', 'main'), {
      ...state,
      lastUpdated: lastWrittenTimestamp
    });
    console.log('[Firebase] Saved to cloud. Tasks:', state.tasks.length);
  } catch (err: any) {
    console.warn('[Firebase] Save failed:', err.code, err.message);
  }
}

// Initial load: localStorage first, Firebase as fallback
export async function loadState(): Promise<AppState> {
  const local = loadStateFromStorage();

  if (local) {
    console.log('[Load] From localStorage. Tasks:', local.tasks.length);
    return local;
  }

  // No local data — try Firebase
  console.log('[Load] No local cache, trying Firebase...');
  try {
    const { getDoc, doc } = await import('firebase/firestore');
    const { db } = await import('./firebase');

    const cloud = await Promise.race([
      getDoc(doc(db, 'app_state', 'main')),
      new Promise<null>((r) => setTimeout(() => r(null), 5000))
    ]);

    if (cloud && 'exists' in cloud && cloud.exists()) {
      const data = cloud.data() as AppState;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      console.log('[Load] From Firebase. Tasks:', data.tasks.length);
      return data;
    }
  } catch (err: any) {
    console.warn('[Load] Firebase fetch failed:', err.code || err.message);
  }

  // Nothing — return empty state
  const empty: AppState = {
    tasks: [], goals: [], habits: [], notes: [], ideas: [],
    achievements: [], dailyRatings: [],
    telegram: { botToken: '', botUsername: '', isActive: false },
    taskCategories: ['Дизайн', 'Разработка', 'Здоровье', 'Развитие', 'Быт', 'Разное'],
    lastUpdated: Date.now()
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(empty));
  return empty;
}
