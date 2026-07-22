import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { AppState, Task, Goal, Habit, Note, Idea, Achievement, DailyRating } from './src/types';

const app = express();
const PORT = 3000;
const DB_PATH = path.join(process.cwd(), 'data', 'db.json');

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


// Generate default achievements
const DEFAULT_ACHIEVEMENTS: Achievement[] = [
  { id: 'ach_first_task', title: 'Первый шаг', description: 'Выполнена первая задача', unlocked: false, category: 'tasks' },
  { id: 'ach_10_tasks', title: 'Опытный планировщик', description: 'Выполнено 10 задач', unlocked: false, category: 'tasks' },
  { id: 'ach_100_tasks', title: 'Мастер продуктивности', description: 'Выполнено 100 задач', unlocked: false, category: 'tasks' },
  { id: 'ach_streak_30', title: 'Стальной характер', description: 'Серия привычек достигла 30 дней', unlocked: false, category: 'streak' },
  { id: 'ach_perfect_day', title: 'Идеальный день', description: 'Выполнены все задачи, запланированные на день', unlocked: false, category: 'tasks' },
  { id: 'ach_first_goal', title: 'Вижу цель', description: 'Завершена первая цель', unlocked: false, category: 'goals' }
];

// Generate mock data for beautiful initial layout
const getYesterdayString = (daysAgo: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
};

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

// --- Firebase Setup ---
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

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
  } else {
    console.warn('firebase-applet-config.json not found. Running with local storage only.');
  }
} catch (e) {
  console.error('Firebase initialization failed:', e);
}

// Helper to sanitize and guard AppState shape
function sanitizeState(raw: any): AppState {
  if (!raw || typeof raw !== 'object') return DEFAULT_STATE;
  return {
    tasks: Array.isArray(raw.tasks) ? raw.tasks : [],
    goals: Array.isArray(raw.goals) ? raw.goals : [],
    habits: Array.isArray(raw.habits) ? raw.habits : [],
    notes: Array.isArray(raw.notes) ? raw.notes : [],
    ideas: Array.isArray(raw.ideas) ? raw.ideas : [],
    achievements: Array.isArray(raw.achievements) && raw.achievements.length > 0 ? raw.achievements : DEFAULT_ACHIEVEMENTS,
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

// Load from Firestore asynchronously with max 2s timeout guard
let initStatePromise: Promise<void> | null = null;

if (firebaseDb) {
  initStatePromise = (async () => {
    try {
      const docRef = doc(firebaseDb, 'app_state', 'main');
      const docSnap = await withTimeout(getDoc(docRef), 2000, null as any);
      if (docSnap && docSnap.exists()) {
        const cloudData = docSnap.data();
        if (cloudData) {
          const sanitizedCloud = sanitizeState(cloudData);
          const cloudTime = sanitizedCloud.lastUpdated || 0;
          const localTime = state.lastUpdated || 0;

          const localItemCount = (state.tasks?.length || 0) + (state.goals?.length || 0) + (state.habits?.length || 0) + (state.notes?.length || 0);
          const cloudItemCount = (sanitizedCloud.tasks?.length || 0) + (sanitizedCloud.goals?.length || 0) + (sanitizedCloud.habits?.length || 0) + (sanitizedCloud.notes?.length || 0);

          if (cloudItemCount >= localItemCount || cloudTime >= localTime) {
            state = sanitizedCloud;
            fs.writeFileSync(DB_PATH, JSON.stringify(state, null, 2), 'utf-8');
            console.log(`State synchronized from Firestore on startup (${cloudItemCount} items restored).`);
          } else {
            console.log('Local state has more data than Firestore. Keeping local state and syncing to Firestore.');
            setDoc(docRef, JSON.parse(JSON.stringify(state))).catch(() => {});
          }
        }
      } else if (docSnap) {
        console.log('No state found in Firestore. Uploading local state to Firestore.');
        setDoc(docRef, JSON.parse(JSON.stringify(state))).catch(() => {});
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
    
    // Save to Firestore asynchronously with clean JSON object
    if (firebaseDb) {
      const docRef = doc(firebaseDb, 'app_state', 'main');
      const cleanData = JSON.parse(JSON.stringify(state));
      setDoc(docRef, cleanData).then(() => {
        console.log('State synchronized to Firestore.');
      }).catch((err) => {
        console.error('Failed to save state to Firestore:', err);
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

async function notifyUserViaTelegram(text: string) {
  // Disabled
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
  res.json(state);
});

// Sync / Update whole state
app.post('/api/state', async (req, res) => {
  if (initStatePromise) await initStatePromise;
  const incoming = req.body;
  if (incoming && typeof incoming === 'object') {
    // Merge updates to preserve important settings on server
    const prevTelegram = state.telegram;
    
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
    
    state = {
      ...state,
      ...incoming,
      // Always enforce structure
      tasks: incoming.tasks || state.tasks,
      goals: incoming.goals || state.goals,
      habits: incoming.habits || state.habits,
      notes: incoming.notes || state.notes,
      ideas: incoming.ideas || state.ideas,
      achievements: incoming.achievements || state.achievements,
      dailyRatings: incoming.dailyRatings || state.dailyRatings,
      telegram: incoming.telegram ? { ...prevTelegram, ...incoming.telegram } : prevTelegram,
      taskCategories: incoming.taskCategories || state.taskCategories
    };
    
    saveDb();
    checkAchievements();

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
      const docRef = doc(firebaseDb, 'app_state', 'main');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const cloudData = docSnap.data() as AppState;
        if (cloudData) {
          state = { ...DEFAULT_STATE, ...cloudData };
          fs.writeFileSync(DB_PATH, JSON.stringify(state, null, 2), 'utf-8');
          checkAchievements();
          console.log('Force re-synced state directly from Firestore.');
          return res.json({ status: 'synced', state });
        }
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

init();
