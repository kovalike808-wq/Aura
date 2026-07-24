// Aura Telegram Bot — Cloudflare Worker
// Использует Firebase Firestore для хранения состояния

interface Env {
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
}

// --- Firebase REST API (без SDK) ---

const FIREBASE_PROJECT = 'aura-98747';
const FIREBASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`;

async function getFirestoreDoc(collection: string, docId: string): Promise<any> {
  const url = `${FIREBASE_URL}/${collection}/${docId}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json() as any;
  return data.fields ? parseFirestoreFields(data.fields) : null;
}

function parseFirestoreFields(fields: any): any {
  const result: any = {};
  for (const [key, val] of Object.entries(fields) as any) {
    if (val.stringValue !== undefined) result[key] = val.stringValue;
    else if (val.integerValue !== undefined) result[key] = Number(val.integerValue);
    else if (val.doubleValue !== undefined) result[key] = val.doubleValue;
    else if (val.booleanValue !== undefined) result[key] = val.booleanValue;
    else if (val.arrayValue !== undefined) result[key] = (val.arrayValue.values || []).map((v: any) => {
      if (v.stringValue !== undefined) return v.stringValue;
      if (v.integerValue !== undefined) return Number(v.integerValue);
      if (v.booleanValue !== undefined) return v.booleanValue;
      return v;
    });
    else if (val.mapValue !== undefined) result[key] = parseFirestoreFields(val.mapValue.fields || {});
    else if (val.nullValue !== undefined) result[key] = null;
  }
  return result;
}

// --- Telegram API ---

async function sendMsg(token: string, chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true })
  });
}

// --- Helpers ---

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// --- Summary builders ---

function morningSummary(s: any): string {
  const t = today();
  const todayTasks = (s.tasks || []).filter((x: any) => x.dueDate === t && x.status === 'pending');
  const overdue = (s.tasks || []).filter((x: any) => x.dueDate && x.dueDate < t && x.status === 'pending');
  const allPending = (s.tasks || []).filter((x: any) => x.status === 'pending');
  const habits = s.habits || [];
  const goals = s.goals || [];

  const lines = [
    '<b>☀️ Доброе утро! Сводка на сегодня</b>',
    `📅 <i>${new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}</i>`,
    ''
  ];

  const sorted = [...todayTasks].sort((a: any, b: any) => (a.startTime || '').localeCompare(b.startTime || ''));
  if (sorted.length) {
    lines.push(`<b>📋 Задачи на сегодня (${sorted.length}):</b>`);
    sorted.forEach((x: any) => {
      const p = x.priority === 'high' ? '🔴' : x.priority === 'medium' ? '🟡' : '🟢';
      const st = x.startTime ? ` 🕐 ${x.startTime}` : '';
      lines.push(`  ${p} ${x.title}${st}`);
    });
  } else {
    lines.push('📋 Задач на сегодня нет.');
  }

  if (overdue.length) {
    lines.push('', `<b>⚠️ Просроченные (${overdue.length}):</b>`);
    overdue.slice(0, 5).forEach((x: any) => lines.push(`  🔴 ${x.title} — до ${x.dueDate}`));
  }

  if (habits.length) {
    lines.push('', `<b>🔥 Привычки (${habits.length}):</b>`);
    habits.forEach((h: any) => {
      const done = (h.history || []).includes(t);
      const streak = h.streak > 0 ? ` 🔥${h.streak}дн` : '';
      const st = h.startTime ? ` 🕐 ${h.startTime}` : '';
      lines.push(`  ${done ? '✅' : '⬜'} ${h.title}${st}${streak}`);
    });
  }

  const activeGoals = goals.filter((g: any) => (g.taskIds || []).length > 0);
  if (activeGoals.length) {
    lines.push('', '<b>🎯 Прогресс целей:</b>');
    activeGoals.slice(0, 5).forEach((g: any) => {
      const linked = (s.tasks || []).filter((x: any) => (g.taskIds || []).includes(x.id));
      const done = linked.filter((x: any) => x.status === 'completed').length;
      const pct = linked.length ? Math.round((done / linked.length) * 100) : 0;
      lines.push(`  ${g.title}: ${pct}% (${done}/${linked.length})`);
    });
  }

  lines.push('', `📊 Всего активных задач: <b>${allPending.length}</b>`);
  return lines.join('\n');
}

function eveningSummary(s: any): string {
  const t = today();
  const done = (s.tasks || []).filter((x: any) => x.completedAt && x.completedAt.startsWith(t));
  const pending = (s.tasks || []).filter((x: any) => x.dueDate === t && x.status === 'pending');
  const habits = s.habits || [];
  const rating = (s.dailyRatings || []).find((r: any) => r.date === t);

  const lines = [
    '<b>🌙 Добрый вечер! Итоги дня</b>',
    `📅 <i>${new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}</i>`,
    ''
  ];

  if (done.length) {
    lines.push(`<b>✅ Выполнено сегодня (${done.length}):</b>`);
    done.forEach((x: any) => lines.push(`  ✓ ${x.title}`));
  } else {
    lines.push('✅ Сегодня ничего не выполнено.');
  }

  if (pending.length) {
    lines.push('', `<b>⏳ Осталось (${pending.length}):</b>`);
    pending.forEach((x: any) => lines.push(`  ○ ${x.title}`));
  }

  if (habits.length) {
    lines.push('', '<b>🔥 Привычки:</b>');
    habits.forEach((h: any) => {
      const ok = (h.history || []).includes(t);
      lines.push(`  ${ok ? '✅' : '❌'} ${h.title}`);
    });
  }

  if (rating) {
    lines.push('', `<b>Оценка дня:</b> ${'⭐'.repeat(rating.score)}${'☆'.repeat(10 - rating.score)} (${rating.score}/10)`);
  }

  const totalDone = (s.tasks || []).filter((x: any) => x.status === 'completed').length;
  lines.push('', `📊 Выполнено всего: ${totalDone} задач`);
  return lines.join('\n');
}

// --- Worker ---

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Health
    if (url.pathname === '/health') {
      return Response.json({ ok: true });
    }

    // Webhook from Telegram
    if (url.pathname === '/webhook' && request.method === 'POST') {
      const update = await request.json() as any;
      const msg = update?.message;
      if (msg) {
        const chatId = String(msg.chat.id);
        if (env.TELEGRAM_CHAT_ID && chatId !== env.TELEGRAM_CHAT_ID) {
          return new Response('ok');
        }

        const text = (msg.text || '').trim().toLowerCase();
        const state = await getFirestoreDoc('app_state', 'main');

        if (!state) {
          await sendMsg(env.TELEGRAM_BOT_TOKEN, chatId, '⚠️ Данные недоступны.');
          return new Response('ok');
        }

        const token = env.TELEGRAM_BOT_TOKEN;

        if (text === '/start' || text === '/help') {
          await sendMsg(token, chatId, '<b>Aura Bot</b> 🌟\n\nКоманды:\n/morning — утренняя сводка\n/evening — вечерняя сводка\n/today — задачи на сегодня\n/habits — статус привычек\n/stats — статистика');
        } else if (text === '/morning') {
          await sendMsg(token, chatId, morningSummary(state));
        } else if (text === '/evening') {
          await sendMsg(token, chatId, eveningSummary(state));
        } else if (text === '/today') {
          const t = today();
          const tasks = (state.tasks || []).filter((x: any) => x.dueDate === t && x.status === 'pending');
          if (!tasks.length) {
            await sendMsg(token, chatId, '📋 Задач на сегодня нет 😊');
          } else {
            const lines = [`<b>📋 Задачи на сегодня (${tasks.length}):</b>`, ''];
            tasks.sort((a: any, b: any) => (a.startTime || '').localeCompare(b.startTime || '')).forEach((x: any) => {
              const p = x.priority === 'high' ? '🔴' : x.priority === 'medium' ? '🟡' : '🟢';
              lines.push(`${p} <b>${x.title}</b>${x.startTime ? ' 🕐 ' + x.startTime : ''}`);
            });
            await sendMsg(token, chatId, lines.join('\n'));
          }
        } else if (text === '/habits') {
          const habits = state.habits || [];
          if (!habits.length) {
            await sendMsg(token, chatId, '🔥 Привычек пока нет.');
          } else {
            const t = today();
            const lines = ['<b>🔥 Привычки:</b>', ''];
            habits.forEach((h: any) => {
              const done = (h.history || []).includes(t);
              lines.push(`${done ? '✅' : '⬜'} <b>${h.title}</b>${h.streak > 0 ? ' 🔥' + h.streak + 'дн' : ''}`);
            });
            await sendMsg(token, chatId, lines.join('\n'));
          }
        } else if (text === '/stats') {
          const tasks = state.tasks || [];
          const habits = state.habits || [];
          const completed = tasks.filter((x: any) => x.status === 'completed').length;
          const maxStreak = habits.reduce((m: number, h: any) => Math.max(m, h.streak || 0), 0);
          await sendMsg(token, chatId, [
            '<b>📊 Статистика</b>', '',
            `✅ Задач выполнено: <b>${completed}</b>`,
            `📋 Активных: <b>${tasks.filter((x: any) => x.status === 'pending').length}</b>`,
            `🔥 Привычек: <b>${habits.length}</b>`,
            `🏆 Серия: <b>${maxStreak} дней</b>`,
            `🎯 Целей: <b>${(state.goals || []).length}</b>`
          ].join('\n'));
        }
      }
      return new Response('ok');
    }

    // Ручная отправка сводки
    if (url.pathname === '/morning') {
      const state = await getFirestoreDoc('app_state', 'main');
      if (state && env.TELEGRAM_CHAT_ID) {
        await sendMsg(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, morningSummary(state));
      }
      return Response.json({ sent: true });
    }

    if (url.pathname === '/evening') {
      const state = await getFirestoreDoc('app_state', 'main');
      if (state && env.TELEGRAM_CHAT_ID) {
        await sendMsg(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, eveningSummary(state));
      }
      return Response.json({ sent: true });
    }

    return new Response('Aura Bot Worker');
  },

  // Cron: автоматические сводки
  async scheduled(event: ScheduledEvent, env: Env) {
    const hour = new Date().getUTCHours();
    const state = await getFirestoreDoc('app_state', 'main');
    if (!state || !env.TELEGRAM_CHAT_ID) return;

    if (hour === 8) await sendMsg(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, morningSummary(state));
    if (hour === 21) await sendMsg(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, eveningSummary(state));
  }
};
