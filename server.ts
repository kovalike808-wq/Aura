import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { AppState, Task, Goal, Habit, Note, Idea, Achievement, DailyRating } from './src/types';
import { DEFAULT_ACHIEVEMENTS } from './src/constants';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';

const app = express();
const PORT = 3000;
const DB_PATH = path.join(process.cwd(), 'data', 'db.json');

// --- Firebase Setup ---
let firebaseDb: any = null;
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const firebaseApp = initializeApp({
      apiKey: firebaseConfig.apiKey,
      authDomain: firebaseConfig.authDomain,
      projectId: firebaseConfig.projectId,
      storageBucket: firebaseConfig.storageBucket,
      messagingSenderId: firebaseConfig.messagingSenderId,
      appId: firebaseConfig.appId,
    });
    firebaseDb = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId || '(default)');
    console.log('Firebase initialized successfully with project:', firebaseConfig.projectId);
    console.log('Firestore database ID:', firebaseConfig.firestoreDatabaseId || '(default)');
  } else {
    console.warn('firebase-applet-config.json not found. Running with local storage only.');
  }
} catch (e) {
  console.error('Firebase initialization failed:', e);
}

// Ensure data folder exists
if (!fs.existsSync(path.join(process.cwd(), 'data'))) {
  fs.mkdirSync(path.join(process.cwd(), 'data'), { recursive: true });
}

// --- Web Push Setup ---
import webpush from 'web-push';
const VAPID_PATH = path.join(process.cwd(), 'data', 'vapid.json');
let vapidKeys: { publicKey: string; privateKey: string };
if (fs.existsSync(VAPID_PATH)) {
  vapidKeys = JSON.parse(fs.readFileSync(VAPID_PATH, 'utf-8'));
} else {
  vapidKeys = webpush.generateVAPIDKeys();
  fs.writeFileSync(VAPID_PATH, JSON.stringify(vapidKeys, null, 2), 'utf-8');
  console.log('Generated and saved new VAPID keys.');
}

webpush.setVapidDetails(
  'mailto:anima6532@inbox.ru',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

const SUBS_PATH = path.join(process.cwd(), 'data', 'push_subscriptions.json');
let pushSubscriptions: any[] = [];
if (fs.existsSync(SUBS_PATH)) {
  try {
    pushSubscriptions = JSON.parse(fs.readFileSync(SUBS_PATH, 'utf-8'));
  } catch (e) {
    console.error('Failed to parse push subscriptions:', e);
  }
}

function saveSubscriptions() {
  try {
    fs.writeFileSync(SUBS_PATH, JSON.stringify(pushSubscriptions, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save push subscriptions:', e);
  }
}

async function notifyAllViaPush(title: string, body: string, tag?: string) {
  if (pushSubscriptions.length === 0) return;
  const payload = JSON.stringify({ title, body, tag });
  const promises = pushSubscriptions.map(async (sub) => {
    try {
      await webpush.sendNotification(sub, payload);
    } catch (err: any) {
      console.error('Push error for endpoint:', sub.endpoint, err.message);
      if (err.statusCode === 410 || err.statusCode === 404) {
        pushSubscriptions = pushSubscriptions.filter(s => s.endpoint !== sub.endpoint);
        saveSubscriptions();
      }
    }
  });
  await Promise.all(promises);
}

const DEFAULT_STATE: AppState = {
  tasks: [],
  goals: [],
  habits: [],
  notes: [],
  ideas: [],
  achievements: DEFAULT_ACHIEVEMENTS,
  dailyRatings: [],
  telegram: {
    botToken: '',
    botUsername: '',
    isActive: false,
    chatId: undefined
  },
  taskCategories: ['Дизайн', 'Разработка', 'Здоровье', 'Развитие', 'Быт', 'Разное'],
  lastUpdated: 0
};


// Helper to merge state non-destructively
function mergeAppStates(st1: AppState, st2: AppState): AppState {
  const taskMap = new Map<string, Task>();
  [...(st1.tasks || []), ...(st2.tasks || [])].forEach(t => {
    if (!taskMap.has(t.id)) {
      taskMap.set(t.id, t);
    } else {
      const existing = taskMap.get(t.id)!;
      taskMap.set(t.id, { ...existing, ...t });
    }
  });

  const goalMap = new Map<string, Goal>();
  [...(st1.goals || []), ...(st2.goals || [])].forEach(g => {
    if (!goalMap.has(g.id)) {
      goalMap.set(g.id, g);
    } else {
      const existing = goalMap.get(g.id)!;
      const combinedTaskIds = Array.from(new Set([...(existing.taskIds || []), ...(g.taskIds || [])]));
      goalMap.set(g.id, {
        ...existing,
        ...g,
        taskIds: combinedTaskIds
      });
    }
  });

  const habitMap = new Map<string, Habit>();
  [...(st1.habits || []), ...(st2.habits || [])].forEach(h => {
    if (!habitMap.has(h.id)) {
      habitMap.set(h.id, h);
    } else {
      const existing = habitMap.get(h.id)!;
      const combinedHistory = Array.from(new Set([...(existing.history || []), ...(h.history || [])])).sort();
      habitMap.set(h.id, {
        ...existing,
        ...h,
        history: combinedHistory,
        streak: Math.max(existing.streak || 0, h.streak || 0)
      });
    }
  });

  const noteMap = new Map<string, Note>();
  [...(st1.notes || []), ...(st2.notes || [])].forEach(n => noteMap.set(n.id, n));

  const ideaMap = new Map<string, Idea>();
  [...(st1.ideas || []), ...(st2.ideas || [])].forEach(i => ideaMap.set(i.id, i));

  const ratingMap = new Map<string, DailyRating>();
  [...(st1.dailyRatings || []), ...(st2.dailyRatings || [])].forEach(r => ratingMap.set(r.date, r));

  const mergedAchievements = DEFAULT_ACHIEVEMENTS.map(def => {
    const a1 = (st1.achievements || []).find(a => a.id === def.id);
    const a2 = (st2.achievements || []).find(a => a.id === def.id);
    const isUnlocked = Boolean(def.unlocked || a1?.unlocked || a2?.unlocked);
    const unlockedAt = a1?.unlockedAt || a2?.unlockedAt;
    return {
      ...def,
      unlocked: isUnlocked,
      unlockedAt: isUnlocked ? (unlockedAt || new Date().toISOString()) : undefined
    };
  });

  const categories = Array.from(new Set([
    'Дизайн', 'Разработка', 'Здоровье', 'Развитие', 'Быт', 'Разное',
    ...(st1.taskCategories || []),
    ...(st2.taskCategories || [])
  ]));

  const telegram = {
    botToken: st1.telegram?.botToken || st2.telegram?.botToken || '',
    botUsername: st1.telegram?.botUsername || st2.telegram?.botUsername || '',
    isActive: Boolean(st1.telegram?.isActive || st2.telegram?.isActive),
    chatId: st1.telegram?.chatId || st2.telegram?.chatId
  };

  return {
    tasks: Array.from(taskMap.values()),
    goals: Array.from(goalMap.values()),
    habits: Array.from(habitMap.values()),
    notes: Array.from(noteMap.values()),
    ideas: Array.from(ideaMap.values()),
    achievements: mergedAchievements,
    dailyRatings: Array.from(ratingMap.values()),
    telegram,
    taskCategories: categories,
    lastUpdated: Math.max(st1.lastUpdated || 0, st2.lastUpdated || 0, Date.now())
  };
}

// Helper to sanitize and guard AppState shape
function sanitizeState(raw: any): AppState {
  if (!raw || typeof raw !== 'object') return DEFAULT_STATE;

  const rawAchievements: Achievement[] = Array.isArray(raw.achievements) ? raw.achievements : [];
  const mergedAchievements = DEFAULT_ACHIEVEMENTS.map(def => {
    const found = rawAchievements.find(a => a.id === def.id);
    if (found) {
      return { ...def, ...found, unlocked: Boolean(def.unlocked || found.unlocked) };
    }
    return def;
  });

  return {
    tasks: Array.isArray(raw.tasks) ? raw.tasks : [],
    goals: Array.isArray(raw.goals) ? raw.goals : [],
    habits: Array.isArray(raw.habits) ? raw.habits : [],
    notes: Array.isArray(raw.notes) ? raw.notes : [],
    ideas: Array.isArray(raw.ideas) ? raw.ideas : [],
    achievements: mergedAchievements,
    dailyRatings: Array.isArray(raw.dailyRatings) ? raw.dailyRatings : [],
    telegram: raw.telegram && typeof raw.telegram === 'object' ? {
      botToken: raw.telegram.botToken || '',
      botUsername: raw.telegram.botUsername || '',
      isActive: Boolean(raw.telegram.isActive),
      chatId: raw.telegram.chatId
    } : { botToken: '', botUsername: '', isActive: false },
    taskCategories: Array.isArray(raw.taskCategories) && raw.taskCategories.length > 0 ? raw.taskCategories : ['Дизайн', 'Разработка', 'Здоровье', 'Развитие', 'Быт', 'Разное'],
    lastUpdated: typeof raw.lastUpdated === 'number' ? raw.lastUpdated : Date.now()
  };
}

// Timeout helper so async calls never hang server
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))
  ]);
}

// Retry helper for Firestore operations with exponential backoff
async function firestoreWithRetry<T>(operation: () => Promise<T>, maxRetries = 3, operationName = 'Firestore op'): Promise<T | null> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (err: any) {
      console.error(`[${operationName}] Attempt ${i + 1}/${maxRetries} failed:`, err.message || err);
      if (i < maxRetries - 1) {
        const delay = 1000 * Math.pow(2, i);
        console.log(`[${operationName}] Retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  console.error(`[${operationName}] All ${maxRetries} attempts failed.`);
  return null;
}

// State store
let state: AppState = DEFAULT_STATE;

// Synchronously load from local file first as fallback
try {
  if (fs.existsSync(DB_PATH)) {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    state = sanitizeState(parsed);
    console.log('Local database loaded successfully.');
  } else {
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_STATE, null, 2), 'utf-8');
    console.log('Local database file created.');
  }
} catch (e) {
  console.error('Error loading local database:', e);
}

function cleanForFirestore(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) {
    return obj.map(cleanForFirestore);
  }
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val !== undefined) {
        cleaned[key] = cleanForFirestore(val);
      }
    }
    return cleaned;
  }
  return obj;
}

// Load from Firestore collections and main doc asynchronously
async function loadFromFirestoreCollections(): Promise<AppState | null> {
  if (!firebaseDb) {
    console.warn('[loadFromFirestore] Firebase DB not initialized, skipping.');
    return null;
  }
  try {
    console.log('[loadFromFirestore] Loading data from Firestore collections...');
    const [tasksSnap, goalsSnap, habitsSnap, notesSnap, ideasSnap, achSnap, ratingsSnap, settingsSnap, legacySnap] = await Promise.all([
      getDocs(collection(firebaseDb, 'tasks')).catch(err => { console.error('[loadFromFirestore] Failed to read tasks:', err.message); return null; }),
      getDocs(collection(firebaseDb, 'goals')).catch(err => { console.error('[loadFromFirestore] Failed to read goals:', err.message); return null; }),
      getDocs(collection(firebaseDb, 'habits')).catch(err => { console.error('[loadFromFirestore] Failed to read habits:', err.message); return null; }),
      getDocs(collection(firebaseDb, 'notes')).catch(err => { console.error('[loadFromFirestore] Failed to read notes:', err.message); return null; }),
      getDocs(collection(firebaseDb, 'ideas')).catch(err => { console.error('[loadFromFirestore] Failed to read ideas:', err.message); return null; }),
      getDocs(collection(firebaseDb, 'achievements')).catch(err => { console.error('[loadFromFirestore] Failed to read achievements:', err.message); return null; }),
      getDocs(collection(firebaseDb, 'dailyRatings')).catch(err => { console.error('[loadFromFirestore] Failed to read dailyRatings:', err.message); return null; }),
      getDoc(doc(firebaseDb, 'settings', 'config')).catch(err => { console.error('[loadFromFirestore] Failed to read settings:', err.message); return null; }),
      getDoc(doc(firebaseDb, 'app_state', 'main')).catch(err => { console.error('[loadFromFirestore] Failed to read app_state:', err.message); return null; })
    ]);

    const tasks: Task[] = tasksSnap ? tasksSnap.docs.map(d => d.data() as Task) : [];
    const goals: Goal[] = goalsSnap ? goalsSnap.docs.map(d => d.data() as Goal) : [];
    const habits: Habit[] = habitsSnap ? habitsSnap.docs.map(d => d.data() as Habit) : [];
    const notes: Note[] = notesSnap ? notesSnap.docs.map(d => d.data() as Note) : [];
    const ideas: Idea[] = ideasSnap ? ideasSnap.docs.map(d => d.data() as Idea) : [];
    const achievements: Achievement[] = achSnap ? achSnap.docs.map(d => d.data() as Achievement) : [];
    const dailyRatings: DailyRating[] = ratingsSnap ? ratingsSnap.docs.map(d => d.data() as DailyRating) : [];

    let settingsData: any = settingsSnap && settingsSnap.exists() ? settingsSnap.data() : {};
    let legacyData: any = legacySnap && legacySnap.exists() ? legacySnap.data() : null;

    let collState: AppState = sanitizeState({
      tasks,
      goals,
      habits,
      notes,
      ideas,
      achievements,
      dailyRatings,
      telegram: settingsData.telegram || legacyData?.telegram,
      taskCategories: settingsData.taskCategories || legacyData?.taskCategories,
      lastUpdated: settingsData.lastUpdated || legacyData?.lastUpdated || 0
    });

    const hasCollectionData = tasks.length > 0 || goals.length > 0 || habits.length > 0 || notes.length > 0 || ideas.length > 0;

    console.log('[loadFromFirestore] Loaded from collections:', {
      tasks: tasks.length,
      goals: goals.length,
      habits: habits.length,
      notes: notes.length,
      ideas: ideas.length,
      achievements: achievements.length,
      dailyRatings: dailyRatings.length,
      hasLegacyData: !!legacyData
    });

    if (!hasCollectionData && legacyData) {
      console.log('[loadFromFirestore] No collection data found, using legacy app_state document.');
      return sanitizeState(legacyData);
    }

    return collState;
  } catch (err) {
    console.error('Error reading Firestore collections:', err);
    return null;
  }
}

async function saveToFirestoreCollections(currentState: AppState) {
  if (!firebaseDb) {
    console.warn('[saveToFirestore] Firebase DB not initialized, skipping save.');
    return;
  }
  try {
    console.log('[saveToFirestore] Saving state to Firestore collections...');
    const clean = cleanForFirestore(currentState);

    const [tasksSnap, goalsSnap, habitsSnap, notesSnap, ideasSnap] = await Promise.all([
      getDocs(collection(firebaseDb, 'tasks')).catch(err => { console.error('[saveToFirestore] Failed to read tasks for sync:', err.message); return null; }),
      getDocs(collection(firebaseDb, 'goals')).catch(err => { console.error('[saveToFirestore] Failed to read goals for sync:', err.message); return null; }),
      getDocs(collection(firebaseDb, 'habits')).catch(err => { console.error('[saveToFirestore] Failed to read habits for sync:', err.message); return null; }),
      getDocs(collection(firebaseDb, 'notes')).catch(err => { console.error('[saveToFirestore] Failed to read notes for sync:', err.message); return null; }),
      getDocs(collection(firebaseDb, 'ideas')).catch(err => { console.error('[saveToFirestore] Failed to read ideas for sync:', err.message); return null; }),
    ]);

    const writes: Promise<any>[] = [];

    const taskIdsInState = new Set((clean.tasks || []).map((t: Task) => t.id));
    (clean.tasks || []).forEach((t: Task) => {
      if (t && t.id) writes.push(setDoc(doc(firebaseDb, 'tasks', t.id), t));
    });
    if (tasksSnap) {
      tasksSnap.docs.forEach(d => {
        if (!taskIdsInState.has(d.id)) writes.push(deleteDoc(d.ref));
      });
    }

    const goalIdsInState = new Set((clean.goals || []).map((g: Goal) => g.id));
    (clean.goals || []).forEach((g: Goal) => {
      if (g && g.id) writes.push(setDoc(doc(firebaseDb, 'goals', g.id), g));
    });
    if (goalsSnap) {
      goalsSnap.docs.forEach(d => {
        if (!goalIdsInState.has(d.id)) writes.push(deleteDoc(d.ref));
      });
    }

    const habitIdsInState = new Set((clean.habits || []).map((h: Habit) => h.id));
    (clean.habits || []).forEach((h: Habit) => {
      if (h && h.id) writes.push(setDoc(doc(firebaseDb, 'habits', h.id), h));
    });
    if (habitsSnap) {
      habitsSnap.docs.forEach(d => {
        if (!habitIdsInState.has(d.id)) writes.push(deleteDoc(d.ref));
      });
    }

    const noteIdsInState = new Set((clean.notes || []).map((n: Note) => n.id));
    (clean.notes || []).forEach((n: Note) => {
      if (n && n.id) writes.push(setDoc(doc(firebaseDb, 'notes', n.id), n));
    });
    if (notesSnap) {
      notesSnap.docs.forEach(d => {
        if (!noteIdsInState.has(d.id)) writes.push(deleteDoc(d.ref));
      });
    }

    const ideaIdsInState = new Set((clean.ideas || []).map((i: Idea) => i.id));
    (clean.ideas || []).forEach((i: Idea) => {
      if (i && i.id) writes.push(setDoc(doc(firebaseDb, 'ideas', i.id), i));
    });
    if (ideasSnap) {
      ideasSnap.docs.forEach(d => {
        if (!ideaIdsInState.has(d.id)) writes.push(deleteDoc(d.ref));
      });
    }

    (clean.achievements || []).forEach((a: Achievement) => {
      if (a && a.id) writes.push(setDoc(doc(firebaseDb, 'achievements', a.id), a));
    });

    (clean.dailyRatings || []).forEach((r: DailyRating) => {
      if (r && r.date) writes.push(setDoc(doc(firebaseDb, 'dailyRatings', r.date), r));
    });

    writes.push(setDoc(doc(firebaseDb, 'settings', 'config'), {
      taskCategories: clean.taskCategories || [],
      telegram: clean.telegram || {},
      lastUpdated: clean.lastUpdated || Date.now()
    }));

    writes.push(setDoc(doc(firebaseDb, 'app_state', 'main'), clean));

    console.log(`[saveToFirestore] Executing ${writes.length} write operations...`);
    await Promise.all(writes);
    console.log('[saveToFirestore] Successfully saved state and synchronized deletions across Firestore collections.');
    console.log('[saveToFirestore] Items saved:', {
      tasks: (clean.tasks || []).length,
      goals: (clean.goals || []).length,
      habits: (clean.habits || []).length,
      notes: (clean.notes || []).length,
      ideas: (clean.ideas || []).length,
      achievements: (clean.achievements || []).length,
      dailyRatings: (clean.dailyRatings || []).length
    });
  } catch (err) {
    console.error('[saveToFirestore] Failed to save state to Firestore collections:', err);
    throw err;
  }
}

let initStatePromise: Promise<void> | null = null;

if (firebaseDb) {
  initStatePromise = (async () => {
    try {
      const cloudState = await loadFromFirestoreCollections();
      if (cloudState) {
        state = mergeAppStates(state, cloudState);
        fs.writeFileSync(DB_PATH, JSON.stringify(state, null, 2), 'utf-8');
        console.log('Synchronized state from Firestore collections on startup.');
      } else {
        console.warn('Could not read Firestore collections on startup, retaining local file state.');
      }
    } catch (err) {
      console.error('Failed to fetch state from Firestore on startup:', err);
    }
  })();
} else {
  initStatePromise = Promise.resolve();
}

function saveDb() {
  try {
    state.lastUpdated = Date.now();
    fs.writeFileSync(DB_PATH, JSON.stringify(state, null, 2), 'utf-8');
    
    if (firebaseDb) {
      saveToFirestoreCollections(state).catch((err) => {
        console.error('Failed to save state to Firestore collections:', err);
      });
    }
  } catch (e) {
    console.error('Error saving database:', e);
  }
}

// Check achievements auto-unlocking logic
function checkAchievements() {
  let changed = false;
  const completedTasksCount = state.tasks.filter(t => t.status === 'completed').length;

  const firstTask = state.achievements.find(a => a.id === 'ach_first_task');
  if (firstTask && !firstTask.unlocked && completedTasksCount >= 1) {
    firstTask.unlocked = true;
    firstTask.unlockedAt = new Date().toISOString();
    changed = true;
  }

  const tenTasks = state.achievements.find(a => a.id === 'ach_10_tasks');
  if (tenTasks && !tenTasks.unlocked && completedTasksCount >= 10) {
    tenTasks.unlocked = true;
    tenTasks.unlockedAt = new Date().toISOString();
    changed = true;
  }

  const hundredTasks = state.achievements.find(a => a.id === 'ach_100_tasks');
  if (hundredTasks && !hundredTasks.unlocked && completedTasksCount >= 100) {
    hundredTasks.unlocked = true;
    hundredTasks.unlockedAt = new Date().toISOString();
    changed = true;
  }

  // Habits streak achievement
  const maxStreak = state.habits.reduce((max, h) => Math.max(max, h.streak), 0);
  const streak30 = state.achievements.find(a => a.id === 'ach_streak_30');
  if (streak30 && !streak30.unlocked && maxStreak >= 30) {
    streak30.unlocked = true;
    streak30.unlockedAt = new Date().toISOString();
    changed = true;
  }

  // First goal completed
  const completedGoals = state.goals.filter(g => {
    if (g.taskIds.length === 0) return false;
    const linkedTasks = state.tasks.filter(t => g.taskIds.includes(t.id));
    return linkedTasks.length > 0 && linkedTasks.every(t => t.status === 'completed');
  }).length;
  const firstGoalAch = state.achievements.find(a => a.id === 'ach_first_goal');
  if (firstGoalAch && !firstGoalAch.unlocked && completedGoals >= 1) {
    firstGoalAch.unlocked = true;
    firstGoalAch.unlockedAt = new Date().toISOString();
    changed = true;
  }

  if (changed) {
    saveDb();
  }
}



// Memory flags to prevent double-sending push notifications in the same day
let lastPushMorningDate = '';
let lastPushEveningDate = '';

// Automated periodic notifications (Morning / Evening reminders)
async function checkAndSendAutoNotifications() {
  try {
    const now = new Date();
    const moscowDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Europe/Moscow' }); // YYYY-MM-DD
    const moscowTimeStr = now.toLocaleTimeString('ru-RU', { timeZone: 'Europe/Moscow', hour12: false }); // HH:MM:SS
    const moscowHour = parseInt(moscowTimeStr.split(':')[0], 10);

    // 1. Morning Digest (09:00 - 11:59 Moscow time)
    if (moscowHour >= 9 && moscowHour < 12) {
      // Web Push Morning Digest
      if (lastPushMorningDate !== moscowDateStr) {
        const today = new Date().toISOString().split('T')[0];
        const pendingTasks = state.tasks.filter(t => t.status === 'pending' && (!t.dueDate || t.dueDate === today));
        let bodyText = '';
        if (pendingTasks.length === 0) {
          bodyText = '🎉 У вас нет невыполненных задач на сегодня! Самое время запланировать новые в Aura.';
        } else {
          bodyText = `📋 У вас ${pendingTasks.length} запланированных задач на сегодня. Желаем продуктивного дня!`;
        }
        await notifyAllViaPush('Aura: Задачи на сегодня 🌅', bodyText, 'morning-digest');
        lastPushMorningDate = moscowDateStr;
      }
    }

    // 2. Evening Reminder (20:00 - 22:59 Moscow time)
    if (moscowHour >= 20 && moscowHour < 23) {
      // Web Push Evening Reminder
      if (lastPushEveningDate !== moscowDateStr) {
        await notifyAllViaPush(
          'Aura: Подведем итоги дня? 🌙',
          '🌿 Время отметить выполненные привычки и оценить качество сегодняшнего дня!',
          'evening-reminder'
        );
        lastPushEveningDate = moscowDateStr;
      }
    }
  } catch (e) {
    console.error('Error in checkAndSendAutoNotifications:', e);
  }
}

// Check auto-notifications every 1 minute
setInterval(checkAndSendAutoNotifications, 60000);
// Run once on boot as well
setTimeout(checkAndSendAutoNotifications, 5000);

// Express API Router
app.use(express.json());

// Get state
app.get('/api/state', async (req, res) => {
  if (initStatePromise) await initStatePromise;
  if (firebaseDb) {
    const cloudState = await firestoreWithRetry(
      () => loadFromFirestoreCollections(),
      2,
      'GET /api/state load'
    );
    if (cloudState) {
      if ((cloudState.lastUpdated || 0) >= (state.lastUpdated || 0) || (state.tasks.length === 0 && cloudState.tasks.length > 0)) {
        state = cloudState;
      } else {
        state = mergeAppStates(state, cloudState);
      }
    }
  }
  res.json(state);
});

// Sync / Update whole state
app.post('/api/state', async (req, res) => {
  if (initStatePromise) await initStatePromise;
  const incoming = req.body;
  if (incoming && typeof incoming === 'object') {
    // Detect newly completed tasks
    const newlyCompletedTasks: any[] = [];
    if (incoming.tasks && Array.isArray(incoming.tasks)) {
      incoming.tasks.forEach((inTask: any) => {
        const existingTask = state.tasks.find(t => t.id === inTask.id);
        if (inTask.status === 'completed' && (!existingTask || existingTask.status === 'pending')) {
          newlyCompletedTasks.push(inTask);
        }
      });
    }

    const sanitizedIncoming = sanitizeState(incoming);
    state = sanitizedIncoming;
    state.lastUpdated = incoming.lastUpdated || Date.now();

    console.log('[POST /api/state] Received state update. Saving locally...');
    saveDb();
    checkAchievements();

    if (firebaseDb) {
      console.log('[POST /api/state] Syncing to Firestore...');
      const saveResult = await firestoreWithRetry(
        () => saveToFirestoreCollections(state),
        3,
        'POST /api/state save'
      );
      if (saveResult === null) {
        console.error('[POST /api/state] WARNING: Firestore save failed after retries. Data saved locally only.');
      }
    } else {
      console.warn('[POST /api/state] Firebase not connected. Data saved to local DB only.');
    }

    // Trigger push notification for newly completed tasks
    if (newlyCompletedTasks.length > 0) {
      newlyCompletedTasks.forEach(t => {
        notifyAllViaPush('Задача выполнена! 🎉', `Вы успешно завершили задачу: "${t.title}"`, 'task-complete');
      });
    }

    res.json({ status: 'success', state });
  } else {
    res.status(400).json({ error: 'Invalid state object' });
  }
});

// Force fetch directly from Firestore Cloud
app.get('/api/state/sync-cloud', async (req, res) => {
  if (firebaseDb) {
    try {
      const cloudState = await loadFromFirestoreCollections();
      if (cloudState) {
        state = mergeAppStates(state, cloudState);
        fs.writeFileSync(DB_PATH, JSON.stringify(state, null, 2), 'utf-8');
        checkAchievements();
        console.log('Force re-synced state directly from Firestore collections.');
        return res.json({ status: 'synced', state });
      }
    } catch (e) {
      console.error('Error force fetching cloud state:', e);
    }
  }
  res.json({ status: 'current', state });
});

// Force Restore state from local storage (Protected against empty data wipes)
app.post('/api/state/restore', async (req, res) => {
  if (initStatePromise) await initStatePromise;
  const incoming = req.body;
  if (incoming && Array.isArray(incoming.tasks)) {
    const serverItems = (state.tasks?.length || 0) + (state.goals?.length || 0) + (state.notes?.length || 0) + (state.habits?.length || 0);
    const incomingItems = (incoming.tasks?.length || 0) + (incoming.goals?.length || 0) + (incoming.notes?.length || 0) + (incoming.habits?.length || 0);

    // Only restore if incoming has items or if server is completely empty
    if (incomingItems > 0 || serverItems === 0) {
      state = incoming;
      saveDb();
      checkAchievements();
      return res.json({ status: 'restored', state });
    } else {
      console.warn('Rejected empty restore attempt as server already holds populated data.');
      return res.json({ status: 'ignored', message: 'Server holds richer data, restore skipped', state });
    }
  } else {
    res.status(400).json({ error: 'Invalid restore payload' });
  }
});

// --- Web Push Endpoints ---
app.get('/api/push/public-key', (req, res) => {
  res.json({ publicKey: vapidKeys.publicKey });
});

app.post('/api/push/subscribe', async (req, res) => {
  const { subscription } = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Subscription structure is invalid' });
  }

  // Check if already subscribed
  const exists = pushSubscriptions.some(sub => sub.endpoint === subscription.endpoint);
  if (!exists) {
    pushSubscriptions.push(subscription);
    saveSubscriptions();
  }

  // Send test push to confirm
  try {
    const payload = JSON.stringify({
      title: 'Aura',
      body: 'Привет! Push-уведомления успешно подключены 🔔',
      tag: 'subscription-confirm'
    });
    await webpush.sendNotification(subscription, payload);
    res.json({ status: 'success', message: 'Subscribed and welcome notification sent!' });
  } catch (err: any) {
    console.error('Push confirmation failed:', err);
    res.json({ status: 'success', warning: 'Subscribed, but confirmation push failed: ' + err.message });
  }
});

app.post('/api/push/unsubscribe', (req, res) => {
  const { subscription } = req.body;
  if (subscription && subscription.endpoint) {
    pushSubscriptions = pushSubscriptions.filter(sub => sub.endpoint !== subscription.endpoint);
    saveSubscriptions();
  }
  res.json({ status: 'success' });
});

app.post('/api/push/test', async (req, res) => {
  if (pushSubscriptions.length === 0) {
    return res.status(400).json({ error: 'Нет активных подписок. Сначала включите уведомления на устройстве!' });
  }

  let successCount = 0;
  let failCount = 0;

  const payload = JSON.stringify({
    title: 'Aura',
    body: 'Ура! Тестовое PWA уведомление со звуком работает отлично 🎉',
    tag: 'test-notification'
  });

  const promises = pushSubscriptions.map(async (sub) => {
    try {
      await webpush.sendNotification(sub, payload);
      successCount++;
    } catch (err: any) {
      console.error('Push error:', err);
      if (err.statusCode === 410 || err.statusCode === 404) {
        pushSubscriptions = pushSubscriptions.filter(s => s.endpoint !== sub.endpoint);
        saveSubscriptions();
      }
      failCount++;
    }
  });

  await Promise.all(promises);
  res.json({ status: 'success', successCount, failCount });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', telegramActive: state.telegram.isActive, botUsername: state.telegram.botUsername });
});

// Detailed health check for debugging Firestore connection
app.get('/api/health/detailed', async (req, res) => {
  const health: any = {
    status: 'ok',
    firebaseConnected: !!firebaseDb,
    localDbExists: fs.existsSync(DB_PATH),
    pushSubscriptionsCount: pushSubscriptions.length,
    stateSize: JSON.stringify(state).length,
    lastUpdated: state.lastUpdated,
    lastUpdatedDate: state.lastUpdated ? new Date(state.lastUpdated).toISOString() : null,
    itemsCount: {
      tasks: state.tasks.length,
      goals: state.goals.length,
      habits: state.habits.length,
      notes: state.notes.length,
      ideas: state.ideas.length,
      achievements: state.achievements.length,
      dailyRatings: state.dailyRatings.length
    }
  };

  if (firebaseDb) {
    try {
      const testDoc = await getDoc(doc(firebaseDb, 'settings', 'config'));
      health.firestoreAccessible = true;
      health.firestoreConfigExists = testDoc.exists();
      if (testDoc.exists()) {
        health.firestoreConfigData = testDoc.data();
      }
    } catch (err: any) {
      health.firestoreAccessible = false;
      health.firestoreError = err.message || String(err);
      console.error('[health/detailed] Firestore connection test failed:', err);
    }
  } else {
    health.firestoreAccessible = false;
    health.firestoreError = 'Firebase DB not initialized';
  }

  res.json(health);
});

// Handle Vite in Dev / Static assets in Prod
async function init() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Test Firestore connection on startup
  if (firebaseDb) {
    console.log('[init] Testing Firestore connection...');
    try {
      const testDoc = await getDoc(doc(firebaseDb, 'settings', 'config'));
      console.log('[init] Firestore connection OK. Config document exists:', testDoc.exists());
    } catch (err: any) {
      console.error('[init] Firestore connection FAILED:', err.message || err);
      console.error('[init] Check Firebase project settings and Firestore database in Firebase Console.');
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
    console.log(`[init] Detailed health check: http://localhost:${PORT}/api/health/detailed`);
  });
}

init();
