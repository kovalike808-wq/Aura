import fs from 'fs';
import path from 'path';
import { AppState, Task, Habit, Goal } from './src/types';
import { DEFAULT_ACHIEVEMENTS } from './src/constants';

const DB_PATH = path.join(process.cwd(), 'data', 'db.json');
const ENV_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const ENV_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

// --- State reader ---

function readState(): AppState | null {
  try {
    if (!fs.existsSync(DB_PATH)) return null;
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(raw) as AppState;
  } catch {
    return null;
  }
}

// --- Telegram API ---

async function sendMessage(text: string, chatId?: string) {
  const state = readState();
  const botToken = ENV_BOT_TOKEN || state?.telegram?.botToken || '';
  const targetChat = chatId || ENV_CHAT_ID || state?.telegram?.chatId || '';

  if (!botToken) {
    console.warn('[Telegram] No bot token configured. Message not sent.');
    return;
  }
  if (!targetChat) {
    console.warn('[Telegram] No chat ID configured. Message not sent.');
    return;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: targetChat,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });
    const data = await res.json() as any;
    if (!data.ok) {
      console.error('[Telegram] Send failed:', data.description);
    } else {
      console.log('[Telegram] Message sent to', targetChat);
    }
  } catch (err: any) {
    console.error('[Telegram] Network error:', err.message);
  }
}

// --- Date helpers ---

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// --- Summary builders ---

function buildMorningSummary(state: AppState): string {
  const today = todayStr();
  const todayTasks = state.tasks.filter(t => t.dueDate === today && t.status === 'pending');
  const overdueTasks = state.tasks.filter(t => t.dueDate && t.dueDate < today && t.status === 'pending');
  const allPending = state.tasks.filter(t => t.status === 'pending');
  const habits = state.habits;
  const goals = state.goals;

  const lines: string[] = [];
  lines.push('<b>☀️ Доброе утро! Сводка на сегодня</b>');
  lines.push(`📅 <i>${new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}</i>`);
  lines.push('');

  // Today's tasks (sorted by startTime if available)
  const sortedTodayTasks = [...todayTasks].sort((a, b) => {
    if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
    if (a.startTime) return -1;
    if (b.startTime) return 1;
    return 0;
  });

  if (sortedTodayTasks.length > 0) {
    lines.push(`<b>📋 Задачи на сегодня (${sortedTodayTasks.length}):</b>`);
    sortedTodayTasks.forEach(t => {
      const priority = t.priority === 'high' ? '🔴' : t.priority === 'medium' ? '🟡' : '🟢';
      const time = t.estimatedTime ? ` ⏱ ${t.estimatedTime}м` : '';
      const start = t.startTime ? ` 🕐 ${t.startTime}` : '';
      lines.push(`  ${priority} ${t.title}${start}${time}`);
    });
  } else {
    lines.push('📋 Задач на сегодня нет.');
  }

  // Overdue
  if (overdueTasks.length > 0) {
    lines.push('');
    lines.push(`<b>⚠️ Просроченные (${overdueTasks.length}):</b>`);
    overdueTasks.slice(0, 5).forEach(t => {
      lines.push(`  🔴 ${t.title} — до ${t.dueDate}`);
    });
    if (overdueTasks.length > 5) {
      lines.push(`  ... и ещё ${overdueTasks.length - 5}`);
    }
  }

  // Habits (sorted by startTime)
  if (habits.length > 0) {
    const sortedHabits = [...habits].sort((a, b) => {
      if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
      if (a.startTime) return -1;
      if (b.startTime) return 1;
      return 0;
    });
    lines.push('');
    lines.push(`<b>🔥 Привычки (${habits.length}):</b>`);
    sortedHabits.forEach(h => {
      const streak = h.streak > 0 ? ` 🔥${h.streak}дн` : '';
      const doneToday = h.history.includes(today);
      const status = doneToday ? '✅' : '⬜';
      const start = h.startTime ? ` 🕐 ${h.startTime}` : '';
      lines.push(`  ${status} ${h.title}${start}${streak}`);
    });
  }

  // Goals progress
  const activeGoals = goals.filter(g => g.taskIds.length > 0);
  if (activeGoals.length > 0) {
    lines.push('');
    lines.push('<b>🎯 Прогресс целей:</b>');
    activeGoals.slice(0, 5).forEach(g => {
      const linkedTasks = state.tasks.filter(t => g.taskIds.includes(t.id));
      const done = linkedTasks.filter(t => t.status === 'completed').length;
      const total = linkedTasks.length;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      const bar = pct >= 100 ? '🟩🟩🟩🟩🟩' :
                  pct >= 75 ? '🟩🟩🟩🟩⬜' :
                  pct >= 50 ? '🟩🟩🟩⬜⬜' :
                  pct >= 25 ? '🟩🟩⬜⬜⬜' : '🟩⬜⬜⬜⬜';
      lines.push(`  ${g.title}: ${bar} ${pct}% (${done}/${total})`);
    });
  }

  // Total pending
  lines.push('');
  lines.push(`📊 Всего активных задач: <b>${allPending.length}</b>`);

  return lines.join('\n');
}

function buildEveningSummary(state: AppState): string {
  const today = todayStr();
  const todayCompleted = state.tasks.filter(t => t.completedAt && t.completedAt.startsWith(today));
  const todayPending = state.tasks.filter(t => t.dueDate === today && t.status === 'pending');
  const habits = state.habits;
  const todayRating = state.dailyRatings.find(r => r.date === today);

  const lines: string[] = [];
  lines.push('<b>🌙 Добрый вечер! Итоги дня</b>');
  lines.push(`📅 <i>${new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}</i>`);
  lines.push('');

  // Completed today
  if (todayCompleted.length > 0) {
    lines.push(`<b>✅ Выполнено сегодня (${todayCompleted.length}):</b>`);
    todayCompleted.forEach(t => {
      const time = t.actualTime ? ` (${t.actualTime}мин)` : '';
      lines.push(`  ✓ ${t.title}${time}`);
    });
  } else {
    lines.push('✅ Сегодня ничего не выполнено.');
  }

  // Remaining from today (sorted by startTime)
  const sortedPending = [...todayPending].sort((a, b) => {
    if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
    if (a.startTime) return -1;
    if (b.startTime) return 1;
    return 0;
  });

  if (sortedPending.length > 0) {
    lines.push('');
    lines.push(`<b>⏳ Осталось на сегодня (${sortedPending.length}):</b>`);
    sortedPending.forEach(t => {
      const start = t.startTime ? ` 🕐 ${t.startTime}` : '';
      lines.push(`  ○ ${t.title}${start}`);
    });
  }

  // Habits
  if (habits.length > 0) {
    lines.push('');
    lines.push('<b>🔥 Привычки сегодня:</b>');
    habits.forEach(h => {
      const done = h.history.includes(today);
      const streak = h.streak > 0 ? ` (серия ${h.streak}дн)` : '';
      lines.push(`  ${done ? '✅' : '❌'} ${h.title}${streak}`);
    });
  }

  // Daily rating
  lines.push('');
  if (todayRating) {
    const stars = '⭐'.repeat(todayRating.score) + '☆'.repeat(10 - todayRating.score);
    lines.push(`<b>Оценка дня:</b> ${stars} (${todayRating.score}/10)`);
    if (todayRating.comment) {
      lines.push(`💬 ${todayRating.comment}`);
    }
  } else {
    lines.push('📝 Оценка дня ещё не выставлена. Зайдите в приложение, чтобы оценить день!');
  }

  // Stats
  const totalCompleted = state.tasks.filter(t => t.status === 'completed').length;
  const activeHabits = habits.filter(h => h.streak > 0);
  const maxStreak = activeHabits.length > 0 ? Math.max(...activeHabits.map(h => h.streak)) : 0;

  lines.push('');
  lines.push(`📊 Статистика: ${totalCompleted} задач выполнено всего`);
  if (maxStreak > 0) {
    lines.push(`🔥 Лучшая серия привычек: ${maxStreak} дней`);
  }

  return lines.join('\n');
}

// --- Cron scheduler (inline, no dependency) ---

// Track sent reminders to avoid duplicates within the same day
const sentReminders = new Set<string>();

function startScheduler() {
  // Schedule check every minute
  setInterval(() => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const state = readState();

    if (!state || !state.telegram.isActive) return;

    // Reset reminders at midnight
    if (hours === 0 && minutes === 0) {
      sentReminders.clear();
    }

    // Morning summary at 08:00
    if (hours === 8 && minutes === 0) {
      console.log('[Scheduler] Sending morning summary...');
      const msg = buildMorningSummary(state);
      sendMessage(msg);
    }

    // Evening summary at 21:00
    if (hours === 21 && minutes === 0) {
      console.log('[Scheduler] Sending evening summary...');
      const msg = buildEveningSummary(state);
      sendMessage(msg);
    }

    // Task start reminders — check every minute
    const today = todayStr();
    const currentMinutes = hours * 60 + minutes;
    const todayTasks = state.tasks.filter(t =>
      t.dueDate === today && t.status === 'pending' && t.startTime && t.telegramReminder?.enabled
    );

    todayTasks.forEach(t => {
      if (!t.startTime || !t.telegramReminder) return;
      const [taskH, taskM] = t.startTime.split(':').map(Number);
      const taskStartMinutes = taskH * 60 + taskM;
      const reminderAt = taskStartMinutes - t.telegramReminder.minutesBefore;

      if (currentMinutes === reminderAt) {
        const key = `${t.id}_${today}`;
        if (!sentReminders.has(key)) {
          sentReminders.add(key);
          const priority = t.priority === 'high' ? '🔴' : t.priority === 'medium' ? '🟡' : '🟢';
          const mins = t.telegramReminder.minutesBefore;
          const timeLabel = mins >= 60 ? `${mins / 60} ч.` : `${mins} мин`;
          const msg = `⏰ <b>Напоминание!</b>\n\nЧерез ${timeLabel} начинается:\n${priority} <b>${t.title}</b>\n🕐 ${t.startTime} | ⏱ ${t.estimatedTime} мин`;
          console.log(`[Scheduler] Reminder for "${t.title}" at ${t.startTime} (${mins}min before)`);
          sendMessage(msg);
        }
      }
    });

    // Habit reminders — 10 min before start time (if set)
    const todayHabits = state.habits.filter(h => h.startTime);
    todayHabits.forEach(h => {
      if (!h.startTime) return;
      const [habitH, habitM] = h.startTime.split(':').map(Number);
      const habitStartMinutes = habitH * 60 + habitM;
      const reminderAt = habitStartMinutes - 10; // 10 min before

      if (currentMinutes === reminderAt) {
        const key = `habit_${h.id}_${today}`;
        if (!sentReminders.has(key)) {
          sentReminders.add(key);
          const doneToday = h.history.includes(today);
          const status = doneToday ? '✅ Уже выполнено' : '⬜ Ещё нет';
          const msg = `⏰ <b>Напоминание!</b>\n\nЧерез 10 минут пора:\n🔥 <b>${h.title}</b>\n🕐 ${h.startTime}\n${status}`;
          console.log(`[Scheduler] Habit reminder for "${h.title}" at ${h.startTime}`);
          sendMessage(msg);
        }
      }
    });
  }, 60_000);

  console.log('[Scheduler] Cron scheduler started. Morning: 08:00, Evening: 21:00, Reminders: per-task config');
}

// --- Long Polling for bot commands ---

let longPollOffset = 0;

async function initLongPollOffset(botToken: string) {
  try {
    const url = `https://api.telegram.org/bot${botToken}/getUpdates?offset=-1&limit=1`;
    const res = await fetch(url);
    const data = await res.json() as any;
    if (data.ok && data.result && data.result.length > 0) {
      longPollOffset = data.result[data.result.length - 1].update_id + 1;
      console.log(`[LongPoll] Initialized offset to ${longPollOffset}`);
    }
  } catch {
    // ignore — will start from 0
  }
}

async function processTelegramUpdate(update: any) {
  if (!update?.message) return;

  const chatId = String(update.message.chat.id);
  const text = (update.message.text || '').trim().toLowerCase();
  const state = readState();

  if (!state) {
    await sendMessage('⚠️ Данные недоступны.', chatId);
    return;
  }

  if (text === '/start' || text === '/help') {
    await sendMessage(
      '<b>Aura Bot</b> 🌟\n\n' +
      'Команды:\n' +
      '/morning — утренняя сводка\n' +
      '/evening — вечерняя сводка\n' +
      '/today — задачи на сегодня\n' +
      '/habits — статус привычек\n' +
      '/stats — общая статистика',
      chatId
    );
  } else if (text === '/morning') {
    await sendMessage(buildMorningSummary(state), chatId);
  } else if (text === '/evening') {
    await sendMessage(buildEveningSummary(state), chatId);
  } else if (text === '/today') {
    const today = todayStr();
    const todayTasks = state.tasks.filter(t => t.dueDate === today && t.status === 'pending');
    if (todayTasks.length === 0) {
      await sendMessage('📋 Задач на сегодня нет. Отдыхайте! 😊', chatId);
    } else {
      const sorted = [...todayTasks].sort((a, b) => {
        if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
        if (a.startTime) return -1;
        if (b.startTime) return 1;
        return 0;
      });
      const lines = [`<b>📋 Задачи на сегодня (${sorted.length}):</b>`, ''];
      sorted.forEach(t => {
        const p = t.priority === 'high' ? '🔴' : t.priority === 'medium' ? '🟡' : '🟢';
        const start = t.startTime ? ` 🕐 ${t.startTime}` : '';
        lines.push(`${p} <b>${t.title}</b>${start}`);
        if (t.description) lines.push(`   <i>${t.description}</i>`);
        lines.push(`   ⏱ ${t.estimatedTime} мин | 📂 ${t.category}`);
        lines.push('');
      });
      await sendMessage(lines.join('\n'), chatId);
    }
  } else if (text === '/habits') {
    if (state.habits.length === 0) {
      await sendMessage('🔥 Привычек пока нет.', chatId);
    } else {
      const today = todayStr();
      const sorted = [...state.habits].sort((a, b) => {
        if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
        if (a.startTime) return -1;
        if (b.startTime) return 1;
        return 0;
      });
      const lines = ['<b>🔥 Ваши привычки:</b>', ''];
      sorted.forEach(h => {
        const done = h.history.includes(today);
        const streak = h.streak > 0 ? ` 🔥${h.streak}дн` : '';
        const start = h.startTime ? ` 🕐 ${h.startTime}` : '';
        lines.push(`${done ? '✅' : '⬜'} <b>${h.title}</b>${start}${streak}`);
      });
      await sendMessage(lines.join('\n'), chatId);
    }
  } else if (text === '/stats') {
    const completed = state.tasks.filter(t => t.status === 'completed').length;
    const pending = state.tasks.filter(t => t.status === 'pending').length;
    const activeHabits = state.habits.filter(h => h.streak > 0);
    const maxStreak = activeHabits.length > 0 ? Math.max(...activeHabits.map(h => h.streak)) : 0;
    const unlockedAch = state.achievements.filter(a => a.unlocked).length;

    const lines = [
      '<b>📊 Общая статистика</b>',
      '',
      `📋 Задач выполнено: <b>${completed}</b>`,
      `📋 Задач активно: <b>${pending}</b>`,
      `🔥 Привычек отслеживается: <b>${state.habits.length}</b>`,
      `🏆 Лучшая серия: <b>${maxStreak} дней</b>`,
      `🎯 Целей: <b>${state.goals.length}</b>`,
      `⭐ Достижений: <b>${unlockedAch}/${state.achievements.length}</b>`,
      `📝 Заметок: <b>${state.notes.length}</b>`
    ];
    await sendMessage(lines.join('\n'), chatId);
  }
}

async function pollTelegramUpdates() {
  const state = readState();
  const botToken = ENV_BOT_TOKEN || state?.telegram?.botToken || '';
  if (!botToken) return;

  try {
    const url = `https://api.telegram.org/bot${botToken}/getUpdates?offset=${longPollOffset}&timeout=30`;
    const res = await fetch(url);
    const data = await res.json() as any;

    if (data.ok && data.result) {
      for (const update of data.result) {
        longPollOffset = update.update_id + 1;
        await processTelegramUpdate(update);
      }
    }
  } catch (err: any) {
    console.error('[LongPoll] Error:', err.message);
  }

  // Continue polling
  setTimeout(pollTelegramUpdates, 1000);
}

async function startLongPolling() {
  const state = readState();
  const botToken = ENV_BOT_TOKEN || state?.telegram?.botToken || '';
  if (botToken) {
    await initLongPollOffset(botToken);
  }
  console.log('[LongPoll] Starting long polling for bot commands...');
  pollTelegramUpdates();
}

// --- Webhook for manual triggers via Express ---

export function setupTelegramBot(serverApp: any) {
  // Manual trigger endpoints
  serverApp.get('/api/telegram/morning', async (req: any, res: any) => {
    const state = readState();
    if (!state) return res.status(500).json({ error: 'No state' });
    const msg = buildMorningSummary(state);
    await sendMessage(msg);
    res.json({ status: 'sent', type: 'morning' });
  });

  serverApp.get('/api/telegram/evening', async (req: any, res: any) => {
    const state = readState();
    if (!state) return res.status(500).json({ error: 'No state' });
    const msg = buildEveningSummary(state);
    await sendMessage(msg);
    res.json({ status: 'sent', type: 'evening' });
  });

  // Telegram webhook for bot commands
  serverApp.post('/api/telegram/webhook', async (req: any, res: any) => {
    const update = req.body;
    if (!update?.message) return res.sendStatus(200);

    const chatId = String(update.message.chat.id);
    const text = (update.message.text || '').trim().toLowerCase();
    const state = readState();

    if (!state) {
      await sendMessage('⚠️ Данные недоступны.', chatId);
      return res.sendStatus(200);
    }

    if (text === '/start' || text === '/help') {
      await sendMessage(
        '<b>Aura Bot</b> 🌟\n\n' +
        'Команды:\n' +
        '/morning — утренняя сводка\n' +
        '/evening — вечерняя сводка\n' +
        '/today — задачи на сегодня\n' +
        '/habits — статус привычек\n' +
        '/stats — общая статистика',
        chatId
      );
    } else if (text === '/morning') {
      await sendMessage(buildMorningSummary(state), chatId);
    } else if (text === '/evening') {
      await sendMessage(buildEveningSummary(state), chatId);
    } else if (text === '/today') {
      const today = todayStr();
      const todayTasks = state.tasks.filter(t => t.dueDate === today && t.status === 'pending');
      if (todayTasks.length === 0) {
        await sendMessage('📋 Задач на сегодня нет. Отдыхайте! 😊', chatId);
      } else {
        const sorted = [...todayTasks].sort((a, b) => {
          if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
          if (a.startTime) return -1;
          if (b.startTime) return 1;
          return 0;
        });
        const lines = [`<b>📋 Задачи на сегодня (${sorted.length}):</b>`, ''];
        sorted.forEach(t => {
          const p = t.priority === 'high' ? '🔴' : t.priority === 'medium' ? '🟡' : '🟢';
          const start = t.startTime ? ` 🕐 ${t.startTime}` : '';
          lines.push(`${p} <b>${t.title}</b>${start}`);
          if (t.description) lines.push(`   <i>${t.description}</i>`);
          lines.push(`   ⏱ ${t.estimatedTime} мин | 📂 ${t.category}`);
          lines.push('');
        });
        await sendMessage(lines.join('\n'), chatId);
      }
    } else if (text === '/habits') {
      if (state.habits.length === 0) {
        await sendMessage('🔥 Привычек пока нет.', chatId);
      } else {
        const today = todayStr();
        const sorted = [...state.habits].sort((a, b) => {
          if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
          if (a.startTime) return -1;
          if (b.startTime) return 1;
          return 0;
        });
        const lines = ['<b>🔥 Ваши привычки:</b>', ''];
        sorted.forEach(h => {
          const done = h.history.includes(today);
          const streak = h.streak > 0 ? ` 🔥${h.streak}дн` : '';
          const start = h.startTime ? ` 🕐 ${h.startTime}` : '';
          lines.push(`${done ? '✅' : '⬜'} <b>${h.title}</b>${start}${streak}`);
        });
        await sendMessage(lines.join('\n'), chatId);
      }
    } else if (text === '/stats') {
      const completed = state.tasks.filter(t => t.status === 'completed').length;
      const pending = state.tasks.filter(t => t.status === 'pending').length;
      const activeHabits = state.habits.filter(h => h.streak > 0);
      const maxStreak = activeHabits.length > 0 ? Math.max(...activeHabits.map(h => h.streak)) : 0;
      const unlockedAch = state.achievements.filter(a => a.unlocked).length;

      const lines = [
        '<b>📊 Общая статистика</b>',
        '',
        `📋 Задач выполнено: <b>${completed}</b>`,
        `📋 Задач активно: <b>${pending}</b>`,
        `🔥 Привычек отслеживается: <b>${state.habits.length}</b>`,
        `🏆 Лучшая серия: <b>${maxStreak} дней</b>`,
        `🎯 Целей: <b>${state.goals.length}</b>`,
        `⭐ Достижений: <b>${unlockedAch}/${state.achievements.length}</b>`,
        `📝 Заметок: <b>${state.notes.length}</b>`
      ];
      await sendMessage(lines.join('\n'), chatId);
    }

    res.sendStatus(200);
  });

  // Start scheduler
  startScheduler();

  // Start long polling for bot commands
  startLongPolling();

  console.log('[Telegram] Bot endpoints registered:');
  console.log('  GET  /api/telegram/morning  — send morning summary now');
  console.log('  GET  /api/telegram/evening  — send evening summary now');
  console.log('  POST /api/telegram/webhook  — Telegram bot webhook');
  console.log('[Telegram] Long polling active for bot commands');
  console.log('[Telegram] Scheduler: morning 08:00, evening 21:00');
}

// --- Standalone mode ---
// If run directly (not imported), just send a test message
if (process.argv[1] && process.argv[1].includes('telegram-bot')) {
  const state = readState();
  if (!state) {
    console.error('[Telegram] No state found. Run the main server first.');
    process.exit(1);
  }

  const botToken = ENV_BOT_TOKEN || state.telegram?.botToken;
  if (!botToken) {
    console.error('[Telegram] No bot token found in env or state. Configure TELEGRAM_BOT_TOKEN or set it in the app.');
    process.exit(1);
  }

  const testType = process.argv[2] || 'morning';
  if (testType === 'morning') {
    console.log('[Telegram] Sending morning summary test...');
    sendMessage(buildMorningSummary(state));
  } else if (testType === 'evening') {
    console.log('[Telegram] Sending evening summary test...');
    sendMessage(buildEveningSummary(state));
  } else {
    console.log('[Telegram] Usage: tsx telegram-bot.ts [morning|evening]');
  }

  setTimeout(() => process.exit(0), 3000);
}
