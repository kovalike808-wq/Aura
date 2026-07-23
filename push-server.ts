import express from 'express';
import webpush from 'web-push';
import path from 'path';
import fs from 'fs';

const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);

app.use(express.json());

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// VAPID keys
const VAPID_PATH = path.join(process.cwd(), 'data', 'vapid.json');
let vapidKeys: { publicKey: string; privateKey: string };

if (fs.existsSync(VAPID_PATH)) {
  vapidKeys = JSON.parse(fs.readFileSync(VAPID_PATH, 'utf-8'));
} else {
  vapidKeys = webpush.generateVAPIDKeys();
  fs.mkdirSync(path.join(process.cwd(), 'data'), { recursive: true });
  fs.writeFileSync(VAPID_PATH, JSON.stringify(vapidKeys, null, 2), 'utf-8');
}

webpush.setVapidDetails('mailto:anima6532@inbox.ru', vapidKeys.publicKey, vapidKeys.privateKey);

// Subscriptions stored in memory (resets on restart — fine for now)
const SUBS_PATH = path.join(process.cwd(), 'data', 'push_subscriptions.json');
let pushSubscriptions: any[] = [];

if (fs.existsSync(SUBS_PATH)) {
  try { pushSubscriptions = JSON.parse(fs.readFileSync(SUBS_PATH, 'utf-8')); } catch {}
}

function saveSubscriptions() {
  fs.writeFileSync(SUBS_PATH, JSON.stringify(pushSubscriptions, null, 2), 'utf-8');
}

// --- Routes ---

app.get('/api/push/public-key', (_req, res) => {
  res.json({ publicKey: vapidKeys.publicKey });
});

app.post('/api/push/subscribe', (req, res) => {
  const { subscription } = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Invalid subscription' });
  }

  const exists = pushSubscriptions.some(s => s.endpoint === subscription.endpoint);
  if (!exists) {
    pushSubscriptions.push(subscription);
    saveSubscriptions();
  }

  // Send welcome push
  webpush.sendNotification(subscription, JSON.stringify({
    title: 'Aura',
    body: 'Push-уведомления успешно подключены!',
    tag: 'subscription-confirm'
  })).catch(() => {});

  res.json({ status: 'success' });
});

app.post('/api/push/unsubscribe', (req, res) => {
  const { subscription } = req.body;
  if (subscription?.endpoint) {
    pushSubscriptions = pushSubscriptions.filter(s => s.endpoint !== subscription.endpoint);
    saveSubscriptions();
  }
  res.json({ status: 'success' });
});

app.post('/api/push/test', async (_req, res) => {
  if (pushSubscriptions.length === 0) {
    return res.status(400).json({ error: 'Нет активных подписок' });
  }

  let successCount = 0;
  let failCount = 0;

  for (const sub of pushSubscriptions) {
    try {
      await webpush.sendNotification(sub, JSON.stringify({
        title: 'Aura',
        body: 'Тестовое уведомление работает!',
        tag: 'test-notification'
      }));
      successCount++;
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        pushSubscriptions = pushSubscriptions.filter(s => s.endpoint !== sub.endpoint);
        saveSubscriptions();
      }
      failCount++;
    }
  }

  res.json({ status: 'success', successCount, failCount });
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', subscriptions: pushSubscriptions.length });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Push server running on port ${PORT}`);
});
