import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Settings, CheckCircle2, Target, Flame, BookOpen, AlertCircle, Trash2, Loader2, X, MessageSquare, Mic, MicOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Task, Goal, Habit, Note, AppState } from '../types';
import { AIMessage, AIConfig, getAIConfig, saveAIConfig, sendAIMessage, AIToolCall } from '../services/aiService';

interface AIChatSectionProps {
  state: AppState;
  onAddTask: (task: Omit<Task, 'id' | 'createdAt' | 'status'>) => void;
  onAddTasksBatch: (taskFieldsList: Omit<Task, 'id' | 'createdAt' | 'status'>[], linkedGoalId?: string) => string[];
  onAddGoal: (goalFields: Omit<Goal, 'id' | 'createdAt'>, batchTasks?: Omit<Task, 'id' | 'createdAt' | 'status'>[]) => void;
  onAddHabit: (title: string, frequency: 'daily' | 'weekly') => void;
  onAddNote: (noteFields: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onDeleteTask: (id: string) => void;
  onDeleteHabit: (id: string) => void;
}

export default function AIChatSection({
  state,
  onAddTask,
  onAddTasksBatch,
  onAddGoal,
  onAddHabit,
  onAddNote,
  onUpdateTask,
  onDeleteTask,
  onDeleteHabit
}: AIChatSectionProps) {
  const [messages, setMessages] = useState<AIMessage[]>(() => {
    const saved = localStorage.getItem('aura-ai-chat-history');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return [];
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState<AIConfig>(getAIConfig());
  const [tempConfig, setTempConfig] = useState<AIConfig>(config);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Check speech recognition support on mount
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'ru-RU';

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript) {
          setInput(prev => prev + finalTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
    // Save chat history to localStorage
    if (messages.length > 0) {
      localStorage.setItem('aura-ai-chat-history', JSON.stringify(messages));
    }
  }, [messages]);

  const executeActions = async (actions: AIToolCall[]) => {
    for (const action of actions) {
      try {
        switch (action.type) {
          case 'add_task':
            onAddTask({
              title: action.data.title,
              category: action.data.category || 'Разное',
              priority: action.data.priority || 'medium',
              estimatedTime: action.data.estimatedTime || 30,
              actualTime: 0,
              isFavorite: false,
              dueDate: action.data.dueDate || new Date().toISOString().split('T')[0]
            });
            break;

          case 'add_tasks_batch':
            if (Array.isArray(action.data)) {
              onAddTasksBatch(action.data.map((t: any) => ({
                title: t.title,
                category: t.category || 'Разное',
                priority: t.priority || 'medium',
                estimatedTime: t.estimatedTime || 30,
                actualTime: 0,
                isFavorite: false,
                dueDate: t.dueDate || new Date().toISOString().split('T')[0]
              })));
            }
            break;

          case 'add_goal':
            onAddGoal({
              title: action.data.title,
              description: action.data.description || '',
              targetDate: action.data.targetDate,
              isFavorite: false,
              taskIds: []
            });
            break;

          case 'add_habit':
            onAddHabit(action.data.title, action.data.frequency || 'daily');
            break;

          case 'add_note':
            onAddNote({
              title: action.data.title,
              content: action.data.content || '',
              type: 'text',
              checklistItems: [],
              isFavorite: false
            });
            break;

          case 'complete_task': {
            const task = state.tasks.find(t => 
              t.title.toLowerCase().includes(action.data.title.toLowerCase()) ||
              action.data.title.toLowerCase().includes(t.title.toLowerCase())
            );
            if (task) {
              onUpdateTask(task.id, { 
                status: 'completed',
                completedAt: new Date().toISOString()
              });
            }
            break;
          }

          case 'uncomplete_task': {
            const taskToUncomplete = state.tasks.find(t => 
              t.title.toLowerCase().includes(action.data.title.toLowerCase()) ||
              action.data.title.toLowerCase().includes(t.title.toLowerCase())
            );
            if (taskToUncomplete) {
              onUpdateTask(taskToUncomplete.id, { 
                status: 'pending',
                completedAt: undefined
              });
            }
            break;
          }

          case 'delete_task': {
            const taskToDelete = state.tasks.find(t => 
              t.title.toLowerCase().includes(action.data.title.toLowerCase()) ||
              action.data.title.toLowerCase().includes(t.title.toLowerCase())
            );
            if (taskToDelete) {
              onDeleteTask(taskToDelete.id);
            }
            break;
          }

          case 'delete_habit': {
            const habitToDelete = state.habits.find(h => 
              h.title.toLowerCase().includes(action.data.title.toLowerCase()) ||
              action.data.title.toLowerCase().includes(h.title.toLowerCase())
            );
            if (habitToDelete) {
              onDeleteHabit(habitToDelete.id);
            }
            break;
          }
        }
      } catch (error) {
        console.error('Error executing AI action:', error);
      }
    }
  };

  const toggleRecording = () => {
    if (!recognitionRef.current) return;

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (e) {
        console.error('Failed to start recording:', e);
      }
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: AIMessage = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMessage];
    
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const response = await sendAIMessage(newMessages, state, config);
      
      const assistantMessage: AIMessage = { role: 'assistant', content: response.content };
      setMessages([...newMessages, assistantMessage]);

      // Execute any actions from the AI response
      if (response.actions.length > 0) {
        await executeActions(response.actions);
      }
    } catch (error: any) {
      const errorMessage: AIMessage = { 
        role: 'assistant', 
        content: `Произошла ошибка: ${error.message}` 
      };
      setMessages([...newMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const saveSettings = () => {
    saveAIConfig(tempConfig);
    setConfig(tempConfig);
    setShowSettings(false);
  };

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem('aura-ai-chat-history');
  };

  const renderMessage = (msg: AIMessage, index: number) => {
    const isUser = msg.role === 'user';
    
    // Clean up action blocks from displayed content
    const cleanContent = msg.content.replace(/```action[\s\S]*?```/g, '').trim();

    return (
      <motion.div
        key={index}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
      >
        {!isUser && (
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0">
            <Bot className="w-4 h-4 text-white" />
          </div>
        )}
        
        <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser 
            ? 'bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 rounded-br-md'
            : 'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-bl-md shadow-sm'
        }`}>
          <div className="text-sm leading-relaxed whitespace-pre-wrap">{cleanContent}</div>
        </div>

        {isUser && (
          <div className="w-8 h-8 rounded-xl bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300">Я</span>
          </div>
        )}
      </motion.div>
    );
  };

  const quickActions = [
    { text: 'Добавить задачу на завтра', icon: CheckCircle2 },
    { text: 'Создать привычку', icon: Flame },
    { text: 'Что у меня на сегодня?', icon: MessageSquare },
  ];

  return (
    <div id="ai-chat-section" className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold font-display tracking-tight text-zinc-900 dark:text-zinc-50">AI Ассистент</h2>
            <p className="text-xs text-zinc-500">
              {config.apiKey ? (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                  Подключён ({config.model})
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-500">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                  Требуется настройка
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearChat}
            className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Очистить чат"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setTempConfig(config); setShowSettings(true); }}
            className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Настройки AI"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <Bot className="w-8 h-8 text-white" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-200">Привет! Я ваш AI-ассистент</h3>
              <p className="text-sm text-zinc-500 max-w-md">
                Я помогу управлять задачами, целями и привычками. Просто напишите мне на естественном языке!
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {quickActions.map((action, i) => {
                const Icon = action.icon;
                return (
                  <button
                    key={i}
                    onClick={() => setInput(action.text)}
                    className="px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-750 transition-colors cursor-pointer flex items-center gap-2"
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {action.text}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => renderMessage(msg, i))
        )}
        
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-3"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2 text-zinc-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Думаю...</span>
              </div>
            </div>
          </motion.div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl p-3 shadow-sm">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isRecording ? "Говорите..." : "Напишите сообщение... (Enter — отправить)"}
            rows={1}
            className={`flex-1 resize-none bg-transparent text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none px-2 py-1.5 max-h-32 transition-all ${isRecording ? 'placeholder-rose-400' : ''}`}
            style={{ minHeight: '36px' }}
          />
          {speechSupported && (
            <button
              onClick={toggleRecording}
              className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                isRecording
                  ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-500/30'
                  : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-600'
              }`}
              title={isRecording ? 'Остановить запись' : 'Голосовой ввод'}
            >
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="p-2.5 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-xl hover:opacity-90 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        {isRecording && (
          <div className="flex items-center gap-2 mt-2 px-2">
            <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
            <span className="text-[10px] text-rose-500 font-medium">Идёт запись голоса... Нажмите кнопку микрофона для остановки</span>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 max-w-md w-full p-6 shadow-premium-dark space-y-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Настройки AI</h3>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Провайдер</label>
                  <select
                    value={tempConfig.provider}
                    onChange={(e) => {
                      const provider = e.target.value as AIConfig['provider'];
                      const defaults: Record<string, { baseUrl: string; model: string }> = {
                        openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
                        anthropic: { baseUrl: 'https://api.anthropic.com', model: 'claude-3-haiku-20240307' },
                        openrouter: { baseUrl: 'https://openrouter.ai/api/v1', model: 'nvidia/nemotron-3-ultra-550b-a55b:free' },
                        custom: { baseUrl: '', model: '' }
                      };
                      setTempConfig({ ...tempConfig, provider, baseUrl: defaults[provider].baseUrl, model: defaults[provider].model });
                    }}
                    className="w-full px-3.5 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-zinc-800 dark:text-zinc-200"
                  >
                    <option value="openrouter">OpenRouter (Бесплатные модели)</option>
                    <option value="openai">OpenAI (GPT)</option>
                    <option value="anthropic">Anthropic (Claude)</option>
                    <option value="custom">Совместимый API</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">API ключ</label>
                  <input
                    type="password"
                    value={tempConfig.apiKey}
                    onChange={(e) => setTempConfig({ ...tempConfig, apiKey: e.target.value })}
                    placeholder="sk-..."
                    className="w-full px-3.5 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-zinc-800 dark:text-zinc-200"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Base URL</label>
                  <input
                    type="text"
                    value={tempConfig.baseUrl}
                    onChange={(e) => setTempConfig({ ...tempConfig, baseUrl: e.target.value })}
                    placeholder="https://api.openai.com/v1"
                    className="w-full px-3.5 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-zinc-800 dark:text-zinc-200"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Модель</label>
                  <input
                    type="text"
                    value={tempConfig.model}
                    onChange={(e) => setTempConfig({ ...tempConfig, model: e.target.value })}
                    placeholder="gpt-4o-mini"
                    className="w-full px-3.5 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-zinc-800 dark:text-zinc-200"
                  />
                </div>

                <div className="p-3 bg-violet-50 dark:bg-violet-950/20 rounded-xl text-xs text-violet-600 dark:text-violet-400 space-y-1">
                  <p className="font-semibold">Как получить ключ:</p>
                  <p><b>OpenRouter (бесплатно):</b> openrouter.ai → Keys → Создать ключ</p>
                  <p><b>OpenAI:</b> platform.openai.com → API Keys</p>
                  <p><b>Claude:</b> console.anthropic.com → API Keys</p>
                  <p><b>Свой сервер:</b> любой OpenAI-совместимый API</p>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-950 transition-colors cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  onClick={saveSettings}
                  className="px-5 py-2 bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 rounded-xl text-sm font-medium hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                >
                  Сохранить
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
