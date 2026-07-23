import React, { useState, useEffect } from 'react';
import { Send, CheckCircle, AlertCircle, RefreshCw, Bell, Volume2, Info, ExternalLink } from 'lucide-react';

const PUSH_SERVER = 'https://aura-production-f9a4.up.railway.app';

export default function NotificationsSection() {
  // PWA Push states
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushSuccessMsg, setPushSuccessMsg] = useState('');
  const [pushErrorMsg, setPushErrorMsg] = useState('');
  const [testPushLoading, setTestPushLoading] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);

  // Check if we are inside an iframe
  useEffect(() => {
    setIsInIframe(window.self !== window.top);
  }, []);

  // Check PWA Push support & active subscription on mount
  useEffect(() => {
    const checkPushSupport = async () => {
      const hasSW = 'serviceWorker' in navigator;
      const hasPush = 'PushManager' in window;
      const supported = hasSW && hasPush;
      setPushSupported(supported);

      const isBrowserGranted = 'Notification' in window && Notification.permission === 'granted';
      const isStoredGranted = localStorage.getItem('aura-notifications-enabled') === 'true';

      if (isBrowserGranted || isStoredGranted) {
        setIsSubscribed(true);
        setPushPermission('granted');

        // Silently renew subscription on refresh
        if (supported) {
          try {
            const keyRes = await fetch(`${PUSH_SERVER}/api/push/public-key`);
            if (keyRes.ok) {
              const { publicKey } = await keyRes.json();
              const reg = await navigator.serviceWorker.ready;
              let sub = await reg.pushManager.getSubscription();
              if (!sub) {
                sub = await reg.pushManager.subscribe({
                  userVisibleOnly: true,
                  applicationServerKey: urlBase64ToUint8Array(publicKey)
                });
              }
              if (sub) {
                await fetch(`${PUSH_SERVER}/api/push/subscribe`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ subscription: sub })
                });
                setIsSubscribed(true);
                localStorage.setItem('aura-notifications-enabled', 'true');
              }
            }
          } catch (e) {
            console.log('Background push renewal:', e);
          }
        }
      }
    };
    checkPushSupport();
  }, []);

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

  const [copiedLink, setCopiedLink] = useState(false);

  // Copy app link for iPhone Safari
  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  // Enable Push / Local Notification flow
  const handleSubscribePush = async () => {
    setPushLoading(true);
    setPushErrorMsg('');
    setPushSuccessMsg('');

    try {
      if (isInIframe) {
        throw new Error('Подписка на уведомления заблокирована внутри встроенного фрейма. Пожалуйста, откройте ссылку приложения напрямую в Safari на вашем iPhone!');
      }

      if (!('Notification' in window)) {
        throw new Error('Ваш браузер не поддерживает API уведомлений.');
      }

      // 1. Request standard Notification permission
      const permission = await Notification.requestPermission();
      setPushPermission(permission);
      
      if (permission !== 'granted') {
        throw new Error('Разрешение на уведомления отклонено. Перейдите в Настройки Safari на iPhone ➡️ Настройки сайтов ➡️ Уведомления и разрешите их.');
      }

      localStorage.setItem('aura-notifications-enabled', 'true');
      setIsSubscribed(true);

      // Play system chime test
      playSystemChime();

      // 2. Try Web Push if ServiceWorker & PushManager are active
      let pushSuccess = false;
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
          const keyRes = await fetch(`${PUSH_SERVER}/api/push/public-key`);
          if (keyRes.ok) {
            const { publicKey } = await keyRes.json();
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(publicKey)
            });

            await fetch(`${PUSH_SERVER}/api/push/subscribe`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ subscription: sub })
            });

            pushSuccess = true;
            setIsSubscribed(true);
          }
        } catch (swErr) {
          console.warn('Web Push registration notice:', swErr);
        }
      }

      if (pushSuccess) {
        setPushSuccessMsg('Push-уведомления и фоновые напоминания успешно включены на вашем устройстве! 🔔');
      } else {
        // Fallback: Local Browser Notifications active
        setIsSubscribed(true);
        setPushSuccessMsg('Уведомления браузера успешно разрешены! Полноценные фоновые пуши также будут приходить при добавлении приложения на экран «Домой» в Safari.');
        
        // Show test local notification
        try {
          new Notification('Aura', {
            body: 'Уведомления успешно подключены на вашем устройства! 🎉',
            icon: '/icon-512.png'
          });
        } catch (e) {
          console.log('Local notification displayed or handled by browser');
        }
      }
    } catch (err: any) {
      setPushErrorMsg(err.message || 'Ошибка активации уведомлений.');
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
        await fetch(`${PUSH_SERVER}/api/push/unsubscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: sub })
        });
      }
      setIsSubscribed(false);
      localStorage.removeItem('aura-notifications-enabled');
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
      const res = await fetch(`${PUSH_SERVER}/api/push/test`, { method: 'POST' });
      const text = await res.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch {}

      if (res.ok) {
        setPushSuccessMsg('Тестовый Push-сигнал отправлен! Он прозвучит на вашем устройстве в течение секунды.');
        playSystemChime();
      } else {
        throw new Error(data.error || `Сервер вернул ошибку ${res.status}`);
      }
    } catch (err: any) {
      setPushErrorMsg(err.message || 'Не удалось отправить тестовое уведомление. Проверьте, запущен ли сервер.');
    } finally {
      setTestPushLoading(false);
    }
  };

  return (
    <div id="notifications-section" className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-semibold font-display tracking-tight text-zinc-900 dark:text-zinc-50">Настройка PWA Push-уведомлений</h2>
        <p className="text-sm text-zinc-500">Управляйте системными push-уведомлениями для сводок задач на iPhone и Mac.</p>
      </div>

      {/* Iframe Warnings */}
      {isInIframe && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-amber-800 dark:text-amber-300">Фрейм AI Studio блокирует уведомления на iPhone</h4>
              <p className="text-xs text-amber-600 dark:text-amber-400 leading-relaxed">
                Политики iOS Safari запрещают отправлять запросы на уведомления внутри встроенного фрейма AI Studio. Чтобы включить уведомления на вашем iPhone, открывайте ссылку прямо в Safari!
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopyLink}
              className="px-3.5 py-2 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 rounded-xl text-xs font-semibold hover:bg-amber-200 active:scale-95 transition-all cursor-pointer"
            >
              {copiedLink ? '✓ Ссылка скопирована!' : 'Скопировать ссылку'}
            </button>
            <a
              href={window.location.origin}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-amber-600 text-white dark:bg-amber-500 rounded-xl text-xs font-semibold hover:bg-amber-700 dark:hover:bg-amber-400 active:scale-95 transition-all flex items-center justify-center gap-1.5"
            >
              <ExternalLink className="w-4 h-4" />
              Открыть Safari
            </a>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Columns: Push Management */}
        <div className="lg:col-span-2 space-y-6">
          
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
                  Получайте утренние сводки задач в 09:00 и вечерние напоминания о привычках в 20:00 прямо на ваш iPhone через стандарт Safari Web Push.
                </p>
              </div>
            </div>

            <div className="border-t border-zinc-100 dark:border-zinc-800/60 pt-5 space-y-4">
              {/* Push Support Badge */}
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="font-semibold text-zinc-500">Статус в браузере:</span>
                {pushSupported ? (
                  <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-full font-bold text-[11px] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                    Web Push поддерживается
                  </span>
                ) : (
                  <span className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 rounded-full font-bold text-[11px] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                    Добавьте приложение на экран «Домой»
                  </span>
                )}

                <span className="font-semibold text-zinc-500 ml-2">Подписка:</span>
                {isSubscribed ? (
                  <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 rounded-full font-bold text-[11px]">
                    Разрешена 🔔
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
                    disabled={pushLoading}
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
        </div>

        {/* Right Columns: Info/Status */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-2xl p-6 shadow-premium space-y-5 h-fit">
          <h3 className="text-sm font-bold tracking-tight text-zinc-800 dark:text-zinc-200 uppercase font-display">Статус PWA</h3>
          
          <div className="space-y-4">
            <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-2">
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block">Как работает Safari PWA Push:</span>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Начиная с iOS 16.4, Apple поддерживает стандарт Web Push для сайтов, добавленных на экран «Домой». Это позволяет получать полноценные пуши со звуками и баннерами прямо от приложения Aura, без необходимости скачивать что-либо из App Store.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
