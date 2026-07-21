import React, { useState, useEffect } from 'react';
import { Send, Key, CheckCircle, AlertCircle, HelpCircle, RefreshCw, Smartphone, Bell, Volume2, Info } from 'lucide-react';
import { TelegramConfig } from '../types';

interface TelegramSectionProps {
  telegram: TelegramConfig;
  onUpdateConfig: (botToken: string) => Promise<boolean>;
  onTestNotify: () => Promise<boolean>;
}

export default function TelegramSection({
  telegram,
  onUpdateConfig,
  onTestNotify
}: TelegramSectionProps) {
  // Telegram states
  const [tokenInput, setTokenInput] = useState(telegram.botToken || '');
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [testSuccess, setTestSuccess] = useState(false);

  // PWA Push states
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushSuccessMsg, setPushSuccessMsg] = useState('');
  const [pushErrorMsg, setPushErrorMsg] = useState('');
  const [testPushLoading, setTestPushLoading] = useState(false);

  useEffect(() => {
    setTokenInput(telegram.botToken || '');
  }, [telegram.botToken]);

  // Check PWA Push support & active subscription on mount
  useEffect(() => {
    const checkPushSupport = async () => {
      const hasSW = 'serviceWorker' in navigator;
      const hasPush = 'PushManager' in window;
      const supported = hasSW && hasPush;
      setPushSupported(supported);

      if (supported) {
        setPushPermission(Notification.permission);
        try {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();
          setIsSubscribed(!!sub);
        } catch (e) {
          console.error('Error checking push subscription:', e);
        }
      }
    };
    checkPushSupport();
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    
    try {
      const ok = await onUpdateConfig(tokenInput.trim());
      if (ok) {
        setSuccessMsg('Бот успешно сконфигурирован и запущен!');
      } else {
        setErrorMsg('Ошибка подключения к боту. Убедитесь, что токен верен.');
      }
    } catch (err) {
      setErrorMsg('Произошла непредвиденная ошибка подключения.');
    } finally {
      setLoading(false);
    }
  };

  const handleTestNotification = async () => {
    setTestLoading(true);
    setErrorMsg('');
    setTestSuccess(false);

    try {
      const ok = await onTestNotify();
      if (ok) {
        setTestSuccess(true);
      } else {
        setErrorMsg('Ошибка отправки. Убедитесь, что вы отправили /start вашему боту в Telegram!');
      }
    } catch (err) {
      setErrorMsg('Не удалось отправить сообщение.');
    } finally {
      setTestLoading(false);
    }
  };

  // Helper to convert base64 VAPID public key
  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  // Play custom pleasant sound when completing an action or testing sound
  const playSystemChime = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = audioCtx.currentTime;
      
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5
      
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1174.66, now + 0.05); // D6
      
      gain2.gain.setValueAtTime(0.06, now + 0.05);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      
      osc.start(now);
      osc.stop(now + 0.8);
      osc2.start(now + 0.05);
      osc2.stop(now + 0.5);
    } catch (e) {
      console.warn('Web Audio playback blocked or unsupported:', e);
    }
  };

  // Enable Push Notification flow
  const handleSubscribePush = async () => {
    setPushLoading(true);
    setPushErrorMsg('');
    setPushSuccessMsg('');

    try {
      if (!pushSupported) {
        throw new Error('Уведомления не поддерживаются на этом браузере или устройстве.');
      }

      // 1. Request permission
      const permission = await Notification.requestPermission();
      setPushPermission(permission);
      if (permission !== 'granted') {
        throw new Error('Вы отклонили запрос на отправку уведомлений. Пожалуйста, разрешите их в настройках Safari.');
      }

      // 2. Fetch public key from server
      const keyRes = await fetch('/api/push/public-key');
      if (!keyRes.ok) {
        throw new Error('Не удалось получить ключ сервера для push-уведомлений.');
      }
      const { publicKey } = await keyRes.json();

      // 3. Register push subscription
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      // 4. Send subscription data to back-end
      const subRes = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub })
      });

      if (!subRes.ok) {
        throw new Error('Не удалось сохранить подписку на сервере.');
      }

      setIsSubscribed(true);
      setPushSuccessMsg('Push-уведомления успешно подключены! На ваш экран должно прийти приветственное уведомление.');
      playSystemChime();
    } catch (err: any) {
      setPushErrorMsg(err.message || 'Ошибка подключения push-уведомлений.');
    } finally {
      setPushLoading(false);
    }
  };

  // Disable Push Notification flow
  const handleUnsubscribePush = async () => {
    setPushLoading(true);
    setPushErrorMsg('');
    setPushSuccessMsg('');

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        // Unsubscribe locally
        await sub.unsubscribe();
        
        // Remove from server
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: sub })
        });
      }
      setIsSubscribed(false);
      setPushSuccessMsg('Вы успешно отписались от push-уведомлений.');
    } catch (err: any) {
      setPushErrorMsg(err.message || 'Не удалось отключить push-уведомления.');
    } finally {
      setPushLoading(false);
    }
  };

  // Trigger test Web Push
  const handleTestPushNotification = async () => {
    setTestPushLoading(true);
    setPushErrorMsg('');
    setPushSuccessMsg('');

    try {
      const res = await fetch('/api/push/test', { method: 'POST' });
      if (res.ok) {
        setPushSuccessMsg('Тестовый Push-сигнал отправлен! Он прозвучит на вашем телефоне в течение секунды.');
        playSystemChime();
      } else {
        const errData = await res.json();
        throw new Error(errData.error || 'Ошибка отправки тестового Push-уведомления.');
      }
    } catch (err: any) {
      setPushErrorMsg(err.message);
    } finally {
      setTestPushLoading(false);
    }
  };

  return (
    <div id="telegram-section" className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-semibold font-display tracking-tight text-zinc-900 dark:text-zinc-50">Центр уведомлений и PWA</h2>
        <p className="text-sm text-zinc-500">Управляйте каналами уведомлений и напоминаний. Получайте мгновенные сообщения на iPhone и управляйте задачами через Telegram-бота.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Columns: Forms */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Card 1: Browser PWA Push Notifications (Requested by user) */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-2xl p-6 shadow-premium space-y-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-xl shrink-0">
                <Bell className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-100 tracking-tight">
                  Браузерные Push-уведомления (Safari PWA)
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Получайте утренние сводки задач, вечерние напоминания о привычках и уведомления о завершении прямо на ваш iPhone через официальный стандарт Safari Web Push.
                </p>
              </div>
            </div>

            <div className="border-t border-zinc-100 dark:border-zinc-800/60 pt-5 space-y-4">
              {/* Push Support Badge */}
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="font-semibold text-zinc-500">Статус поддержки:</span>
                {pushSupported ? (
                  <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-full font-bold text-[11px] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                    Поддерживается устройством
                  </span>
                ) : (
                  <span className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 rounded-full font-bold text-[11px] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                    Не в режиме PWA (Добавьте на экран «Домой»)
                  </span>
                )}

                <span className="font-semibold text-zinc-500 ml-2">Подписка:</span>
                {isSubscribed ? (
                  <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 rounded-full font-bold text-[11px]">
                    Активна 🔔
                  </span>
                ) : (
                  <span className="px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-full font-bold text-[11px]">
                    Отключена
                  </span>
                )}
              </div>

              {/* Push Action Controls */}
              <div className="flex flex-wrap gap-2.5">
                {!isSubscribed ? (
                  <button
                    id="enable-pwa-push-btn"
                    onClick={handleSubscribePush}
                    disabled={pushLoading || !pushSupported}
                    className="px-5 py-2.5 bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 rounded-xl text-xs font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 cursor-pointer flex items-center gap-2 shadow-premium"
                  >
                    {pushLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Bell className="w-4 h-4" />
                    )}
                    Разрешить и включить уведомления
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleTestPushNotification}
                      disabled={testPushLoading}
                      className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-500 active:scale-95 transition-all cursor-pointer flex items-center gap-2"
                    >
                      {testPushLoading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      Отправить тестовый push (со звуком)
                    </button>

                    <button
                      onClick={handleUnsubscribePush}
                      disabled={pushLoading}
                      className="px-4 py-2.5 border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-rose-500 hover:border-rose-200 dark:hover:border-rose-950 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                    >
                      Отписаться
                    </button>
                  </>
                )}

                {/* Local audio tester */}
                <button
                  onClick={() => {
                    playSystemChime();
                  }}
                  className="px-4 py-2.5 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-xl text-xs font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-950 transition-colors cursor-pointer flex items-center gap-1.5"
                  title="Тестировать звук сигнала в приложении"
                >
                  <Volume2 className="w-4 h-4 text-emerald-500" />
                  Тест звука
                </button>
              </div>

              {/* Status and Errors messages */}
              {pushErrorMsg && (
                <div className="p-3.5 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-semibold flex items-start gap-2 leading-relaxed">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>{pushErrorMsg}</div>
                </div>
              )}

              {pushSuccessMsg && (
                <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-medium flex items-start gap-2 leading-relaxed">
                  <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>{pushSuccessMsg}</div>
                </div>
              )}

              {/* iOS Sound Instruction */}
              <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-800/80 rounded-xl space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  <Volume2 className="w-4 h-4 text-indigo-500" />
                  Важно: как включить звук уведомлений на iPhone?
                </div>
                <div className="text-[11px] text-zinc-500 leading-relaxed space-y-1">
                  <p>1. <b>Добавьте на экран «Домой»:</b> открыв сайт в Safari на iPhone, нажмите кнопку <b className="text-zinc-700 dark:text-zinc-300">«Поделиться»</b> ➡️ <b className="text-zinc-700 dark:text-zinc-300">«На экран "Домой"»</b>. Открывать и настраивать уведомления нужно именно из этого установленного приложения.</p>
                  <p>2. <b>Включите звук и режим:</b> проверьте, что переключатель на боковой грани iPhone не находится в беззвучном режиме, а в Настройках смартфона разрешены звуки для приложения Aura.</p>
                  <p>3. <b>Фоновый режим:</b> звук автоматически воспроизводится системой при получении фоновых Push-уведомлений, а при открытом приложении срабатывает наш приятный аудио-сигнал.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Setup Configuration Card (Telegram) */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-2xl p-6 shadow-premium space-y-6">
            <div className="space-y-2">
              <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-100 tracking-tight flex items-center gap-2">
                <Key className="w-5 h-5 text-indigo-500" />
                Подключение токена Telegram-бота
              </h3>
              <p className="text-xs text-zinc-400">
                Создайте нового бота через официального <b>@BotFather</b> в Telegram, получите токен бота и введите его ниже для активации синхронизации.
              </p>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">API-токен Telegram-бота</label>
                <input
                  id="bot-token-input"
                  type="text"
                  placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ..."
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-zinc-400 text-zinc-850 dark:text-zinc-200 font-mono"
                />
              </div>

              {/* Error and Success states */}
              {errorMsg && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-lg text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {errorMsg}
                </div>
              )}

              {successMsg && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-semibold flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  {successMsg}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  id="save-bot-config-btn"
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 rounded-xl text-xs font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-55 cursor-pointer flex items-center gap-2 shadow-premium"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Подключение...
                    </>
                  ) : (
                    'Сохранить и запустить'
                  )}
                </button>

                {telegram.isActive && (
                  <button
                    type="button"
                    onClick={handleTestNotification}
                    disabled={testLoading}
                    className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-xl text-xs font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-950 transition-colors cursor-pointer flex items-center gap-2"
                  >
                    {testLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    Тестовое уведомление
                  </button>
                )}
              </div>
            </form>

            {/* Test notify success toast */}
            {testSuccess && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-medium">
                Тестовое уведомление успешно отправлено на ваш смартфон! Проверьте мессенджер.
              </div>
            )}
          </div>
        </div>

        {/* Right: Active Status Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-2xl p-6 shadow-premium space-y-5 h-fit">
          <h3 className="text-sm font-bold tracking-tight text-zinc-800 dark:text-zinc-200 uppercase font-display">Статус синхронизации</h3>
          
          <div className="space-y-4">
            {telegram.isActive ? (
              <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                  <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
                  Бот активен и запущен
                </div>
                <div className="space-y-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                  <p>Бот: <b className="text-zinc-800 dark:text-zinc-200">@{telegram.botUsername}</b></p>
                  <p>Чат-клиент: <span className="font-mono text-[10px] bg-white dark:bg-zinc-900 px-1 py-0.5 rounded border border-zinc-200/30">{telegram.chatId || 'Ожидание первого /start'}</span></p>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-1">
                <span className="text-xs font-semibold text-zinc-400 block">Интеграция не настроена</span>
                <p className="text-[10px] text-zinc-400 leading-relaxed">Введите валидный API Token слева для автоматического включения лонг-поллинга бота на сервере.</p>
              </div>
            )}

            {/* Smart Instructions block */}
            <div className="space-y-3">
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5 text-zinc-400" /> Инструкция по запуску
              </span>
              <ol className="list-decimal list-inside text-[11px] text-zinc-500 space-y-1.5 leading-relaxed pl-1">
                <li>Перейдите в Telegram к боту <b>@BotFather</b></li>
                <li>Отправьте команду <code>/newbot</code> для создания</li>
                <li>Скопируйте полученный <b>HTTP API Token</b></li>
                <li>Вставьте токен в форму слева и нажмите сохранить</li>
                <li>Найдите вашего созданного бота в поиске Telegram и отправьте ему <code>/start</code> для активации привязки!</li>
              </ol>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
