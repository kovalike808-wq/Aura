import React, { useState, useEffect } from 'react';
import { Send, Key, CheckCircle, AlertCircle, HelpCircle, RefreshCw, Smartphone } from 'lucide-react';
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
  const [tokenInput, setTokenInput] = useState(telegram.botToken || '');
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [testSuccess, setTestSuccess] = useState(false);

  useEffect(() => {
    setTokenInput(telegram.botToken || '');
  }, [telegram.botToken]);

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

  return (
    <div id="telegram-section" className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-semibold font-display tracking-tight text-zinc-900 dark:text-zinc-50">Интеграция с Telegram</h2>
        <p className="text-sm text-zinc-500">Управляйте своими задачами, создавайте заметки и получайте своевременные напоминания прямо в мессенджере.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Setup Configuration Card */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-2xl p-6 shadow-premium space-y-6">
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

        {/* Right: Active Status Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-2xl p-6 shadow-premium space-y-5">
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
