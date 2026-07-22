import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { AppState } from './types';

function cleanForFirestore(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) return obj.map(cleanForFirestore);
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val !== undefined) cleaned[key] = cleanForFirestore(val);
    }
    return cleaned;
  }
  return obj;
}

// Timeout wrapper
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([promise, new Promise<T>(r => setTimeout(() => r(fallback), ms))]);
}

export async function loadStateFromFirestore(): Promise<AppState | null> {
  try {
    console.log('[Firebase] Loading state from Firestore...');
    // Read the single app_state/main document instead of 8 separate collections
    const mainDoc = await withTimeout(
      getDoc(doc(db, 'app_state', 'main')).catch(err => { console.warn('[Firebase] app_state read error:', err.message); return null; }),
      4000,
      null
    );

    if (!mainDoc || !mainDoc.exists()) {
      console.log('[Firebase] No app_state/main document found.');
      return null;
    }

    const data = mainDoc.data() as AppState;
    console.log('[Firebase] Loaded app_state/main:', { tasks: data.tasks?.length || 0, goals: data.goals?.length || 0 });
    return data;
  } catch (err) {
    console.error('[Firebase] Failed to load state:', err);
    return null;
  }
}

export async function saveStateToFirestore(state: AppState): Promise<boolean> {
  try {
    console.log('[Firebase] Saving state to Firestore...');
    const clean = cleanForFirestore(state);
    clean.lastUpdated = Date.now();

    // Write everything to a single document for speed
    await withTimeout(
      setDoc(doc(db, 'app_state', 'main'), clean),
      5000,
      undefined
    );

    console.log('[Firebase] Saved to app_state/main. Tasks:', clean.tasks?.length || 0);
    return true;
  } catch (err) {
    console.error('[Firebase] Failed to save state:', err);
    return false;
  }
}
