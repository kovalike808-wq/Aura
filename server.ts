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
  lastUpdated: Date.now()
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

// State store
let state: AppState = DEFAULT_STATE;

// Synchronously load from local file first as fallback
try {
  if (fs.existsSync(DB_PATH)) {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    state = { ...DEFAULT_STATE, ...parsed };
    if (!state.achievements || state.achievements.length === 0) {
      state.achievements = DEFAULT_ACHIEVEMENTS;
    }
    console.log('Local database loaded successfully.');
  } else {
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_STATE, null, 2), 'utf-8');
    console.log('Local database file created.');
  }
} catch (e) {
  console.error('Error loading local database:', e);
}

// Load from Firestore asynchronously
if (firebaseDb) {
  try {
    const docRef = doc(firebaseDb, 'app_state', 'main');
    getDoc(docRef).then((docSnap) => {
      if (docSnap.exists()) {
        const cloudData = docSnap.data();
        if (cloudData) {
          // Compare lastUpdated or just merge
          if (!state.lastUpdated || (cloudData.lastUpdated && cloudData.lastUpdated > state.lastUpdated)) {
            state = { ...DEFAULT_STATE, ...cloudData };
            // Ensure achievements exist
            if (!state.achievements || state.achievements.length === 0) {
              state.achievements = DEFAULT_ACHIEVEMENTS;
            }
            // Save local file copy
            fs.writeFileSync(DB_PATH, JSON.stringify(state, null, 2), 'utf-8');
            console.log('State synchronized from Firestore on startup (newer version found).');
          } else {
            console.log('Local state is newer or same age as Firestore. Keeping local state.');
            // Sync local to Firestore
            setDoc(docRef, state).catch(err => console.error('Failed to sync newer local state to Firestore:', err));
          }
        }
      } else {
        console.log('No state found in Firestore. Uploading local state to Firestore.');
        setDoc(docRef, state).catch(err => console.error('Failed to initialize state in Firestore:', err));
      }
    }).catch((err) => {
      console.error('Failed to fetch state from Firestore on startup:', err);
    });
  } catch (e) {
    console.error('Error scheduling Firestore fetch:', e);
  }
}

function saveDb() {
  try {
    state.lastUpdated = Date.now();
    fs.writeFileSync(DB_PATH, JSON.stringify(state, null, 2), 'utf-8');
    
    // Save to Firestore asynchronously
    if (firebaseDb) {
      const docRef = doc(firebaseDb, 'app_state', 'main');
      setDoc(docRef, state).then(() => {
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

// Telegram Bot Engine
let botPollingActive = false;
let botTimeoutId: NodeJS.Timeout | null = null;
let currentOffset = 0;

async function sendTelegramRequest(method: string, body: any) {
  if (!state.telegram.botToken) return null;
  const url = `https://api.telegram.org/bot${state.telegram.botToken}/${method}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return await res.json();
  } catch (e) {
    console.error(`Telegram API error during ${method}:`, e);
    return null;
  }
}

// Send telegram push helper
async function notifyUserViaTelegram(text: string, inlineButtons?: any[]) {
  if (!state.telegram.chatId || !state.telegram.isActive) return;
  const body: any = {
    chat_id: state.telegram.chatId,
    text,
    parse_mode: 'HTML'
  };
  if (inlineButtons && inlineButtons.length > 0) {
    body.reply_markup = {
      inline_keyboard: inlineButtons
    };
  }
  await sendTelegramRequest('sendMessage', body);
}

async function handleBotUpdate(update: any) {
  if (update.message) {
    const message = update.message;
    const text = message.text || '';
    const chatId = message.chat.id;
    const username = message.from.username || '';

    // Bind this chatId as active user
    if (!state.telegram.chatId || state.telegram.chatId !== chatId) {
      state.telegram.chatId = chatId;
      saveDb();
    }

    const lowerText = text.trim().toLowerCase();

    // /start command
    if (lowerText.startsWith('/start')) {
      const welcomeMsg = 
        `👋 Приветствую в <b>Aura</b>!\n\n` +
        `Я ваш личный ассистент продуктивности. Мы успешно связали этот чат с вашим приложением!\n\n` +
        `📌 <b>Доступные команды:</b>\n` +
        `/tasks — Показать сегодняшние задачи\n` +
        `/task [текст] — Создать новую задачу\n` +
        `/goals — Мой прогресс целей\n` +
        `/habits — Мои привычки и серии\n` +
        `/note [текст] — Быстрая заметка\n` +
        `/stats — Краткая аналитика\n` +
        `/rate [оценка от 1 до 10] [комментарий] — Оценить сегодняшний день\n\n` +
        `<i>Все изменения мгновенно синхронизируются с вашим веб-интерфейсом!</i>`;
      await sendTelegramRequest('sendMessage', {
        chat_id: chatId,
        text: welcomeMsg,
        parse_mode: 'HTML'
      });
      return;
    }

    // /tasks command
    if (lowerText.startsWith('/tasks')) {
      const today = new Date().toISOString().split('T')[0];
      const pendingTasks = state.tasks.filter(t => t.status === 'pending' && (!t.dueDate || t.dueDate === today));
      
      if (pendingTasks.length === 0) {
        await sendTelegramRequest('sendMessage', {
          chat_id: chatId,
          text: `🎉 <b>Отлично!</b> На сегодня нет невыполненных задач.`,
          parse_mode: 'HTML'
        });
        return;
      }

      let textMsg = `📌 <b>Ваши сегодняшние задачи:</b>\n\n`;
      const buttons: any[] = [];

      pendingTasks.forEach((t, idx) => {
        const priorityLabel = t.priority === 'high' ? '🔴' : t.priority === 'medium' ? '🟡' : '🟢';
        textMsg += `${idx + 1}. ${priorityLabel} <b>${t.title}</b>\n${t.description ? `   <i>${t.description}</i>\n` : ''}\n`;
        buttons.push([{
          text: `✅ Выполнить: ${t.title.slice(0, 20)}...`,
          callback_data: `complete_${t.id}`
        }]);
      });

      await sendTelegramRequest('sendMessage', {
        chat_id: chatId,
        text: textMsg,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buttons }
      });
      return;
    }

    // /task command (creation)
    if (lowerText.startsWith('/task ')) {
      const taskTitle = text.slice(6).trim();
      if (!taskTitle) {
        await sendTelegramRequest('sendMessage', { chat_id: chatId, text: `⚠️ Пожалуйста, укажите название задачи.` });
        return;
      }

      const newTask: Task = {
        id: 'task_' + Math.random().toString(36).substr(2, 9),
        title: taskTitle,
        category: 'Разное',
        priority: 'medium',
        status: 'pending',
        estimatedTime: 30,
        actualTime: 0,
        createdAt: new Date().toISOString(),
        isFavorite: false,
        dueDate: new Date().toISOString().split('T')[0]
      };

      state.tasks.push(newTask);
      saveDb();
      checkAchievements();

      await sendTelegramRequest('sendMessage', {
        chat_id: chatId,
        text: `✅ Задача <b>"${taskTitle}"</b> успешно добавлена на сегодня!`,
        parse_mode: 'HTML'
      });
      return;
    }

    // /goals command
    if (lowerText.startsWith('/goals')) {
      if (state.goals.length === 0) {
        await sendTelegramRequest('sendMessage', { chat_id: chatId, text: `🎯 У вас пока нет целей. Создайте их в приложении!` });
        return;
      }

      let textMsg = `🎯 <b>Ваши цели и прогресс:</b>\n\n`;
      state.goals.forEach(g => {
        const linkedTasks = state.tasks.filter(t => g.taskIds.includes(t.id));
        const total = linkedTasks.length;
        const completed = linkedTasks.filter(t => t.status === 'completed').length;
        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
        
        // Progress bar
        const filled = Math.round(pct / 10);
        const bar = '■'.repeat(filled) + '□'.repeat(10 - filled);

        textMsg += `🏆 <b>${g.title}</b>\n${bar} ${pct}%\n Выполнено задач: ${completed}/${total}\n\n`;
      });

      await sendTelegramRequest('sendMessage', { chat_id: chatId, text: textMsg, parse_mode: 'HTML' });
      return;
    }

    // /habits command
    if (lowerText.startsWith('/habits')) {
      if (state.habits.length === 0) {
        await sendTelegramRequest('sendMessage', { chat_id: chatId, text: `🌿 У вас пока нет привычек. Создайте их в приложении!` });
        return;
      }

      let textMsg = `🌿 <b>Ваши привычки и статистика серии:</b>\n\n`;
      state.habits.forEach(h => {
        textMsg += `🔥 <b>${h.title}</b>\n   Текущая серия: <b>${h.streak} дней</b>\n   Всего выполнений: <b>${h.history.length}</b>\n\n`;
      });

      await sendTelegramRequest('sendMessage', { chat_id: chatId, text: textMsg, parse_mode: 'HTML' });
      return;
    }

    // /note command
    if (lowerText.startsWith('/note ')) {
      const noteContent = text.slice(6).trim();
      if (!noteContent) {
        await sendTelegramRequest('sendMessage', { chat_id: chatId, text: `⚠️ Укажите текст для заметки.` });
        return;
      }

      const newNote: Note = {
        id: 'note_' + Math.random().toString(36).substr(2, 9),
        title: noteContent.slice(0, 30) + (noteContent.length > 30 ? '...' : ''),
        content: noteContent,
        type: 'text',
        checklistItems: [],
        isFavorite: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      state.notes.push(newNote);
      saveDb();

      await sendTelegramRequest('sendMessage', {
        chat_id: chatId,
        text: `📝 Заметка <b>"${newNote.title}"</b> успешно сохранена!`,
        parse_mode: 'HTML'
      });
      return;
    }

    // /stats command
    if (lowerText.startsWith('/stats')) {
      const totalTasks = state.tasks.length;
      const completedTasks = state.tasks.filter(t => t.status === 'completed').length;
      const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      
      const totalGoals = state.goals.length;
      const habitsCount = state.habits.length;
      const avgScore = state.dailyRatings.length > 0
        ? (state.dailyRatings.reduce((sum, r) => sum + r.score, 0) / state.dailyRatings.length).toFixed(1)
        : 'Нет оценок';

      const textMsg = 
        `📊 <b>Ваша статистика продуктивности:</b>\n\n` +
        `✅ Задачи: <b>${completedTasks}/${totalTasks}</b> (${completionRate}% выполнено)\n` +
        `🎯 Цели в процессе: <b>${totalGoals}</b>\n` +
        `🌿 Активные привычки: <b>${habitsCount}</b>\n` +
        `⭐ Средняя оценка дня: <b>${avgScore}/10</b>\n\n` +
        `📈 <i>Вы отлично справляетесь! Продолжайте в том же духе.</i>`;
      
      await sendTelegramRequest('sendMessage', { chat_id: chatId, text: textMsg, parse_mode: 'HTML' });
      return;
    }

    // /rate command
    if (lowerText.startsWith('/rate ')) {
      const payload = text.slice(6).trim();
      const parts = payload.split(' ');
      const scoreNum = parseInt(parts[0], 10);
      const comment = parts.slice(1).join(' ').trim();

      if (isNaN(scoreNum) || scoreNum < 1 || scoreNum > 10) {
        await sendTelegramRequest('sendMessage', {
          chat_id: chatId,
          text: `⚠️ Пожалуйста, введите оценку от 1 до 10.\nПример: <code>/rate 9 Отличный продуктивный день!</code>`,
          parse_mode: 'HTML'
        });
        return;
      }

      const todayStr = new Date().toISOString().split('T')[0];
      // Check if already rated today
      const existingIdx = state.dailyRatings.findIndex(r => r.date === todayStr);
      const ratingObj: DailyRating = {
        date: todayStr,
        score: scoreNum,
        comment: comment || 'Без комментариев (через Telegram)'
      };

      if (existingIdx !== -1) {
        state.dailyRatings[existingIdx] = ratingObj;
      } else {
        state.dailyRatings.push(ratingObj);
      }
      saveDb();

      await sendTelegramRequest('sendMessage', {
        chat_id: chatId,
        text: `⭐ Спасибо! Вы оценили сегодняшний день на <b>${scoreNum}/10</b>.${comment ? `\nКомментарий: <i>"${comment}"</i>` : ''}`,
        parse_mode: 'HTML'
      });
      return;
    }

    // /help or unknown command
    await sendTelegramRequest('sendMessage', {
      chat_id: chatId,
      text: `❓ <b>Неизвестная команда.</b> Напишите /start для просмотра доступных команд.`,
      parse_mode: 'HTML'
    });
  } else if (update.callback_query) {
    // Inline button response
    const callbackQuery = update.callback_query;
    const data = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;

    if (data.startsWith('complete_')) {
      const taskId = data.slice(9);
      const task = state.tasks.find(t => t.id === taskId);
      
      if (task) {
        if (task.status === 'pending') {
          task.status = 'completed';
          task.completedAt = new Date().toISOString();
          saveDb();
          checkAchievements();

          await sendTelegramRequest('answerCallbackQuery', {
            callback_query_id: callbackQuery.id,
            text: `Задача "${task.title}" выполнена!`
          });

          // Update message
          await sendTelegramRequest('editMessageText', {
            chat_id: chatId,
            message_id: messageId,
            text: `✅ Задача <b>"${task.title}"</b> была успешно выполнена!`,
            parse_mode: 'HTML'
          });
        } else {
          await sendTelegramRequest('answerCallbackQuery', {
            callback_query_id: callbackQuery.id,
            text: `Эта задача уже выполнена.`
          });
        }
      } else {
        await sendTelegramRequest('answerCallbackQuery', {
          callback_query_id: callbackQuery.id,
          text: `Задача не найдена.`
        });
      }
    }
  }
}

async function runBotPollingLoop() {
  if (!botPollingActive) return;
  try {
    const res = await sendTelegramRequest('getUpdates', {
      offset: currentOffset,
      timeout: 20
    });

    if (res && res.ok && res.result) {
      for (const update of res.result) {
        currentOffset = update.update_id + 1;
        await handleBotUpdate(update);
      }
    }
  } catch (e) {
    console.error('Error in Telegram Bot Polling Loop:', e);
    // Pause briefly on error to prevent infinite tight loop
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  if (botPollingActive) {
    botTimeoutId = setTimeout(runBotPollingLoop, 500);
  }
}

async function startBotEngine() {
  if (!state.telegram.botToken) {
    state.telegram.isActive = false;
    saveDb();
    console.log('Telegram Bot: No token set, polling disabled.');
    return;
  }

  // Stop current polling if active
  botPollingActive = false;
  if (botTimeoutId) {
    clearTimeout(botTimeoutId);
    botTimeoutId = null;
  }

  // Test the token
  const res = await fetch(`https://api.telegram.org/bot${state.telegram.botToken}/getMe`);
  const data = await res.json();
  if (data && data.ok && data.result) {
    state.telegram.botUsername = data.result.username || '';
    state.telegram.isActive = true;
    botPollingActive = true;
    saveDb();
    console.log(`Telegram Bot @${state.telegram.botUsername} started polling successfully!`);
    
    // Start loop
    currentOffset = 0;
    runBotPollingLoop();
  } else {
    state.telegram.isActive = false;
    state.telegram.botUsername = '';
    saveDb();
    console.warn('Telegram Bot: Token verification failed.');
  }
}

// Boot Telegram bot
startBotEngine();

// Automated periodic notifications (Morning / Evening reminders)
async function checkAndSendAutoNotifications() {
  if (!state.telegram.isActive || !state.telegram.chatId || !state.telegram.botToken) return;

  try {
    const now = new Date();
    const moscowDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Europe/Moscow' }); // YYYY-MM-DD
    const moscowTimeStr = now.toLocaleTimeString('ru-RU', { timeZone: 'Europe/Moscow', hour12: false }); // HH:MM:SS
    const moscowHour = parseInt(moscowTimeStr.split(':')[0], 10);

    // 1. Morning Digest (09:00 - 11:00 Moscow time)
    if (moscowHour >= 9 && moscowHour < 12) {
      if (state.telegram.lastTasksDigestDate !== moscowDateStr) {
        const today = new Date().toISOString().split('T')[0];
        const pendingTasks = state.tasks.filter(t => t.status === 'pending' && (!t.dueDate || t.dueDate === today));
        
        let textMsg = `🌅 <b>Доброе утро! Ваши задачи на сегодня:</b>\n\n`;
        if (pendingTasks.length === 0) {
          textMsg += `🎉 Отлично! На сегодня нет невыполненных задач. Самое время запланировать новые в Aura!`;
        } else {
          pendingTasks.forEach((t, idx) => {
            const priorityLabel = t.priority === 'high' ? '🔴' : t.priority === 'medium' ? '🟡' : '🟢';
            textMsg += `${idx + 1}. ${priorityLabel} <b>${t.title}</b>\n`;
          });
          textMsg += `\n<i>Продуктивного дня!</i>`;
        }

        await notifyUserViaTelegram(textMsg);
        state.telegram.lastTasksDigestDate = moscowDateStr;
        saveDb();
      }
    }

    // 2. Evening Reminder (20:00 - 22:00 Moscow time)
    if (moscowHour >= 20 && moscowHour < 23) {
      if (state.telegram.lastEveningReminderDate !== moscowDateStr) {
        let textMsg = 
          `🌙 <b>Добрый вечер! Время подвести итоги дня.</b>\n\n` +
          `🌿 Не забудьте отметить выполнение ваших привычек в Aura!\n` +
          `⭐ Оцените сегодняшний день прямо здесь командой:\n` +
          `<code>/rate [оценка от 1 до 10] [комментарий]</code>\n\n` +
          `<i>Желаем приятного отдыха!</i>`;

        await notifyUserViaTelegram(textMsg);
        state.telegram.lastEveningReminderDate = moscowDateStr;
        saveDb();
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
app.get('/api/state', (req, res) => {
  res.json(state);
});

// Sync / Update whole state
app.post('/api/state', (req, res) => {
  const incoming = req.body;
  if (incoming && typeof incoming === 'object') {
    // Merge updates to preserve important settings on server
    const prevTelegram = state.telegram;
    
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
    res.json({ status: 'success', state });
  } else {
    res.status(400).json({ error: 'Invalid state object' });
  }
});

// Force Restore state from local storage (Client-side resiliency)
app.post('/api/state/restore', (req, res) => {
  const incoming = req.body;
  if (incoming && Array.isArray(incoming.tasks)) {
    state = incoming;
    saveDb();
    checkAchievements();
    // Restart Telegram Bot if token exists in restored state
    if (state.telegram && state.telegram.botToken) {
      startBotEngine();
    }
    res.json({ status: 'restored', state });
  } else {
    res.status(400).json({ error: 'Invalid restore payload' });
  }
});

// Update Telegram Settings and reboot bot
app.post('/api/telegram/config', async (req, res) => {
  const { botToken } = req.body;
  
  if (botToken === undefined) {
    return res.status(400).json({ error: 'botToken required' });
  }

  state.telegram.botToken = botToken;
  saveDb();

  if (botToken === '') {
    botPollingActive = false;
    state.telegram.botUsername = '';
    state.telegram.isActive = false;
    saveDb();
    return res.json({ status: 'disabled', telegram: state.telegram });
  }

  await startBotEngine();

  if (state.telegram.isActive) {
    res.json({ status: 'success', telegram: state.telegram });
  } else {
    res.status(400).json({ error: 'Invalid bot token or failed to connect to Telegram' });
  }
});

// Send test message
app.post('/api/telegram/test-notify', async (req, res) => {
  if (!state.telegram.chatId) {
    return res.status(400).json({ error: 'Бот еще не запущен пользователем. Отправьте /start боту в Telegram!' });
  }

  try {
    await notifyUserViaTelegram('🔔 <b>Тестовое уведомление от Aura</b>\n\nСинхронизация работает идеально! Этот чат теперь получает мгновенные уведомления о ваших целях, привычках и задачах.');
    res.json({ status: 'sent' });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to send' });
  }
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
