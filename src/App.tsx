import { useState, useEffect, useMemo } from 'react';
import { 
  CheckSquare, Target, Flame, BookOpen, Lightbulb, BarChart2, 
  Award, Calendar as CalendarIcon, Send, Star, Layers, Sun, Moon, 
  Menu, X, Smartphone, ArrowRight, ShieldCheck, Heart 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Import Types
import { AppState, Task, Goal, Habit, Note, Idea, Achievement, DailyRating, TelegramConfig } from './types';

// Import Components
import ThemeToggle from './components/ThemeToggle';
import Dashboard from './components/Dashboard';
import TasksSection from './components/TasksSection';
import GoalsSection from './components/GoalsSection';
import HabitsSection from './components/HabitsSection';
import NotesSection from './components/NotesSection';
import IdeasSection from './components/IdeasSection';
import AnalyticsSection from './components/AnalyticsSection';
import AchievementsSection from './components/AchievementsSection';
import CalendarSection from './components/CalendarSection';
import TelegramSection from './components/TelegramSection';

export default function App() {
  // Navigation tabs
  const [tab, setTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // App Master State
  const [state, setState] = useState<AppState | null>(null);

  // Load and apply dark mode setting on mount
  useEffect(() => {
    const localDark = localStorage.getItem('aura-dark-mode');
    if (localDark === 'true') {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      setDarkMode(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const handleSetDarkMode = (dark: boolean) => {
    setDarkMode(dark);
    if (dark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('aura-dark-mode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('aura-dark-mode', 'false');
    }
  };

  // Synchronise state with server on mount, with client-side durability fallback
  useEffect(() => {
    async function loadState() {
      let serverState: AppState | null = null;
      try {
        const res = await fetch('/api/state');
        if (res.ok) {
          serverState = await res.json();
        }
      } catch (e) {
        console.warn('Failed to fetch state from server:', e);
      }

      // Safe local storage check
      const cachedStateStr = localStorage.getItem('aura-app-state-backup');
      let cachedState: AppState | null = null;
      if (cachedStateStr) {
        try {
          cachedState = JSON.parse(cachedStateStr) as AppState;
        } catch (parseErr) {
          console.error('Failed to parse cached state, clearing corrupted cache:', parseErr);
          localStorage.removeItem('aura-app-state-backup');
        }
      }

      // Core fallback decision tree
      try {
        if (serverState) {
          if (cachedState && cachedState.lastUpdated > (serverState.lastUpdated || 0)) {
            // Restore server with newer client-side backup
            try {
              await fetch('/api/state/restore', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cachedState)
              });
            } catch (restoreErr) {
              console.warn('Failed to restore newer local state on server:', restoreErr);
            }
            setState(cachedState);
            console.log('Restored server state from local storage backup.');
            return;
          }
          setState(serverState);
          localStorage.setItem('aura-app-state-backup', JSON.stringify(serverState));
        } else if (cachedState) {
          setState(cachedState);
          console.log('Using local storage cached state due to server failure.');
        } else {
          // Absolute fallback if everything fails
          const fallbackState: AppState = {
            tasks: [],
            goals: [],
            habits: [],
            notes: [],
            ideas: [],
            achievements: [],
            dailyRatings: [],
            telegram: { botToken: '', botUsername: '', isActive: false },
            taskCategories: ['Дизайн', 'Разработка', 'Здоровье', 'Развитие', 'Быт', 'Разное'],
            lastUpdated: Date.now()
          };
          setState(fallbackState);
          localStorage.setItem('aura-app-state-backup', JSON.stringify(fallbackState));
          console.log('Using fresh fallback state.');
        }
      } catch (error) {
        console.error('Critical state initialization failure:', error);
        // Fallback to minimal non-null state
        setState({
          tasks: [],
          goals: [],
          habits: [],
          notes: [],
          ideas: [],
          achievements: [],
          dailyRatings: [],
          telegram: { botToken: '', botUsername: '', isActive: false },
          taskCategories: ['Дизайн', 'Разработка', 'Здоровье', 'Развитие', 'Быт', 'Разное'],
          lastUpdated: Date.now()
        });
      }
    }

    loadState();
  }, []);

  // Real-time synchronization polling (checks for Telegram bot actions every 4 seconds)
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    async function pollState() {
      try {
        const res = await fetch('/api/state');
        const serverState = await res.json();
        
        if (state && serverState.lastUpdated > state.lastUpdated) {
          setState(serverState);
          localStorage.setItem('aura-app-state-backup', JSON.stringify(serverState));
          console.log('Detected external updates from Telegram Bot. Syncing state.');
        }
      } catch (e) {
        // Ignore polling failures
      }
    }

    intervalId = setInterval(pollState, 4000);
    return () => clearInterval(intervalId);
  }, [state]);

  // Calculated: Favorites list of items across categories
  const favoriteItems = useMemo(() => {
    if (!state) {
      return {
        tasks: [],
        goals: [],
        habits: [],
        notes: [],
        ideas: [],
        totalCount: 0
      };
    }
    const favTasks = state.tasks.filter(t => t.isFavorite);
    const favGoals = state.goals.filter(g => g.isFavorite);
    const favHabits = state.habits.filter(h => h.isFavorite);
    const favNotes = state.notes.filter(n => n.isFavorite);
    const favIdeas = state.ideas.filter(i => i.isFavorite);

    return {
      tasks: favTasks,
      goals: favGoals,
      habits: favHabits,
      notes: favNotes,
      ideas: favIdeas,
      totalCount: favTasks.length + favGoals.length + favHabits.length + favNotes.length + favIdeas.length
    };
  }, [state]);

  // Helper to sync local updates back to Express server
  const syncStateWithServer = async (updated: AppState) => {
    setState(updated);
    localStorage.setItem('aura-app-state-backup', JSON.stringify(updated));
    try {
      await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
    } catch (e) {
      console.warn('Network sync failed. Offline mode active.', e);
    }
  };

  if (!state) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center font-sans">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-4 border-zinc-900 dark:border-zinc-50 border-t-transparent dark:border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-zinc-500 font-medium">Загрузка вашей личной системы Aura...</p>
        </div>
      </div>
    );
  }

  // Task Mutators
  const handleAddTask = (title: string, priority: 'low' | 'medium' | 'high' = 'medium') => {
    const newTask: Task = {
      id: 'task_' + Math.random().toString(36).substr(2, 9),
      title,
      category: 'Разное',
      priority,
      status: 'pending',
      estimatedTime: 30,
      actualTime: 0,
      createdAt: new Date().toISOString(),
      isFavorite: false,
      dueDate: new Date().toISOString().split('T')[0]
    };

    const nextState = {
      ...state,
      tasks: [...state.tasks, newTask]
    };
    syncStateWithServer(nextState);
  };

  const handleCreateTaskDetailed = (taskFields: Omit<Task, 'id' | 'createdAt' | 'status'>) => {
    const newTask: Task = {
      ...taskFields,
      id: 'task_' + Math.random().toString(36).substr(2, 9),
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    const nextState = { ...state, tasks: [...state.tasks, newTask] };
    syncStateWithServer(nextState);
  };

  const handleUpdateTask = (id: string, updates: Partial<Task>) => {
    const updatedTasks = state.tasks.map(t => t.id === id ? { ...t, ...updates } : t);
    
    // Auto-archive logic if status is completed
    const nextTasks = updatedTasks.map(t => {
      if (t.id === id && updates.status === 'completed') {
        // Complete -> move to completed, let analytics show it, wait for clear/archive later
        return { ...t, completedAt: new Date().toISOString() };
      }
      return t;
    });

    const nextState = { ...state, tasks: nextTasks };
    syncStateWithServer(nextState);
  };

  const handleDeleteTask = (id: string) => {
    const nextState = {
      ...state,
      tasks: state.tasks.filter(t => t.id !== id)
    };
    syncStateWithServer(nextState);
  };

  const handleClearArchivedTasks = () => {
    // Delete tasks currently in archived status
    const nextState = {
      ...state,
      tasks: state.tasks.filter(t => t.status !== 'archived')
    };
    syncStateWithServer(nextState);
  };

  // Goal Mutators
  const handleAddGoal = (goalFields: Omit<Goal, 'id' | 'createdAt'>) => {
    const newGoal: Goal = {
      ...goalFields,
      id: 'goal_' + Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString()
    };
    const nextState = { ...state, goals: [...state.goals, newGoal] };
    syncStateWithServer(nextState);
  };

  const handleUpdateGoal = (id: string, updates: Partial<Goal>) => {
    const nextState = {
      ...state,
      goals: state.goals.map(g => g.id === id ? { ...g, ...updates } : g)
    };
    syncStateWithServer(nextState);
  };

  const handleDeleteGoal = (id: string) => {
    const nextState = {
      ...state,
      goals: state.goals.filter(g => g.id !== id)
    };
    syncStateWithServer(nextState);
  };

  // Habit Mutators
  const handleAddHabit = (title: string, frequency: 'daily' | 'weekly') => {
    const newHabit: Habit = {
      id: 'habit_' + Math.random().toString(36).substr(2, 9),
      title,
      frequency,
      streak: 0,
      history: [],
      createdAt: new Date().toISOString(),
      isFavorite: false
    };
    const nextState = { ...state, habits: [...state.habits, newHabit] };
    syncStateWithServer(nextState);
  };

  const handleToggleHabitDay = (id: string, dateStr: string) => {
    const nextHabits = state.habits.map(h => {
      if (h.id === id) {
        const hasDay = h.history.includes(dateStr);
        let nextHistory = [];
        if (hasDay) {
          nextHistory = h.history.filter(d => d !== dateStr);
        } else {
          nextHistory = [...h.history, dateStr];
        }

        // Recalculate streak based on contiguous daily logs
        let currentStreak = 0;
        const sortedHistory = [...nextHistory].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
        
        if (sortedHistory.length > 0) {
          const today = new Date();
          const todayStr = today.toISOString().split('T')[0];
          
          let checkDate = new Date();
          let checkDateStr = checkDate.toISOString().split('T')[0];

          // If not completed today or yesterday, streak is broken / reset
          const completedToday = sortedHistory.includes(todayStr);
          
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split('T')[0];
          const completedYesterday = sortedHistory.includes(yesterdayStr);

          if (completedToday || completedYesterday) {
            if (completedToday) {
              currentStreak = 1;
              checkDate.setDate(checkDate.getDate() - 1);
            } else {
              currentStreak = 1;
              checkDate = yesterday;
            }

            while (true) {
              checkDate.setDate(checkDate.getDate() - 1);
              const targetStr = checkDate.toISOString().split('T')[0];
              if (sortedHistory.includes(targetStr)) {
                currentStreak++;
              } else {
                break;
              }
              // preventative loop boundary
              if (currentStreak > 365) break;
            }
          }
        }

        return {
          ...h,
          history: nextHistory,
          streak: currentStreak
        };
      }
      return h;
    });

    const nextState = { ...state, habits: nextHabits };
    syncStateWithServer(nextState);
  };

  const handleDeleteHabit = (id: string) => {
    const nextState = { ...state, habits: state.habits.filter(h => h.id !== id) };
    syncStateWithServer(nextState);
  };

  // Note Mutators
  const handleAddNote = (noteFields: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newNote: Note = {
      ...noteFields,
      id: 'note_' + Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const nextState = { ...state, notes: [...state.notes, newNote] };
    syncStateWithServer(nextState);
  };

  const handleUpdateNote = (id: string, updates: Partial<Note>) => {
    const nextState = {
      ...state,
      notes: state.notes.map(n => n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n)
    };
    syncStateWithServer(nextState);
  };

  const handleDeleteNote = (id: string) => {
    const nextState = { ...state, notes: state.notes.filter(n => n.id !== id) };
    syncStateWithServer(nextState);
  };

  // Idea Mutators
  const handleAddIdea = (title: string, content: string) => {
    const newIdea: Idea = {
      id: 'idea_' + Math.random().toString(36).substr(2, 9),
      title,
      content,
      isFavorite: false,
      createdAt: new Date().toISOString()
    };
    const nextState = { ...state, ideas: [...state.ideas, newIdea] };
    syncStateWithServer(nextState);
  };

  const handleUpdateIdea = (id: string, updates: Partial<Idea>) => {
    const nextState = {
      ...state,
      ideas: state.ideas.map(i => i.id === id ? { ...i, ...updates } : i)
    };
    syncStateWithServer(nextState);
  };

  const handleDeleteIdea = (id: string) => {
    const nextState = { ...state, ideas: state.ideas.filter(i => i.id !== id) };
    syncStateWithServer(nextState);
  };

  const handleConvertIdea = (id: string, targetType: 'task' | 'goal' | 'note') => {
    const idea = state.ideas.find(i => i.id === id);
    if (!idea) return;

    let targetId = '';
    const updatedState = { ...state };

    if (targetType === 'task') {
      targetId = 'task_' + Math.random().toString(36).substr(2, 9);
      const newTask: Task = {
        id: targetId,
        title: idea.title,
        description: idea.content,
        category: 'Разное',
        priority: 'medium',
        status: 'pending',
        estimatedTime: 30,
        actualTime: 0,
        createdAt: new Date().toISOString(),
        isFavorite: false,
        dueDate: new Date().toISOString().split('T')[0]
      };
      updatedState.tasks = [...state.tasks, newTask];
    } else if (targetType === 'goal') {
      targetId = 'goal_' + Math.random().toString(36).substr(2, 9);
      const newGoal: Goal = {
        id: targetId,
        title: idea.title,
        description: idea.content,
        targetDate: undefined,
        isFavorite: false,
        taskIds: [],
        createdAt: new Date().toISOString()
      };
      updatedState.goals = [...state.goals, newGoal];
    } else if (targetType === 'note') {
      targetId = 'note_' + Math.random().toString(36).substr(2, 9);
      const newNote: Note = {
        id: targetId,
        title: idea.title,
        content: idea.content,
        type: 'text',
        checklistItems: [],
        isFavorite: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      updatedState.notes = [...state.notes, newNote];
    }

    // Mark idea as converted
    updatedState.ideas = state.ideas.map(i => i.id === id ? {
      ...i,
      convertedTo: { type: targetType, id: targetId }
    } : i);

    syncStateWithServer(updatedState);
  };

  // Daily Rating
  const handleRateDay = (score: number, comment: string) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const existingIdx = state.dailyRatings.findIndex(r => r.date === todayStr);
    const newRating: DailyRating = { date: todayStr, score, comment };

    let nextRatings = [...state.dailyRatings];
    if (existingIdx !== -1) {
      nextRatings[existingIdx] = newRating;
    } else {
      nextRatings.push(newRating);
    }

    const nextState = { ...state, dailyRatings: nextRatings };
    syncStateWithServer(nextState);
  };

  const handleUpdateCategories = (categories: string[]) => {
    const nextState = { ...state, taskCategories: categories };
    syncStateWithServer(nextState);
  };

  // Config Telegram Bot and reload bot polling on backend
  const handleUpdateTelegramConfig = async (botToken: string) => {
    try {
      const res = await fetch('/api/telegram/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken })
      });
      const data = await res.json();
      if (res.ok) {
        setState(prev => prev ? { ...prev, telegram: data.telegram } : null);
        return true;
      }
    } catch (e) {
      console.error('Failed to configure telegram:', e);
    }
    return false;
  };

  const handleTestTelegramNotification = async () => {
    try {
      const res = await fetch('/api/telegram/test-notify', { method: 'POST' });
      return res.ok;
    } catch (e) {
      return false;
    }
  };

  const sidebarTabs = [
    { id: 'dashboard', label: 'Рабочий стол', icon: Layers },
    { id: 'tasks', label: 'Задачи', icon: CheckSquare },
    { id: 'goals', label: 'Цели и проекты', icon: Target },
    { id: 'habits', label: 'Привычки', icon: Flame },
    { id: 'notes', label: 'Блокнот', icon: BookOpen },
    { id: 'ideas', label: 'Банк идей', icon: Lightbulb },
    { id: 'favorites', label: 'Избранное', icon: Star, badge: favoriteItems.totalCount > 0 ? favoriteItems.totalCount : undefined },
    { id: 'calendar', label: 'Календарь', icon: CalendarIcon },
    { id: 'analytics', label: 'Аналитика', icon: BarChart2 },
    { id: 'achievements', label: 'Достижения', icon: Award },
    { id: 'telegram', label: 'Telegram бот', icon: Send, badge: state.telegram.isActive ? 'Active' : undefined }
  ];

  return (
    <div id="app-root" className="min-h-screen flex flex-col md:flex-row bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 transition-colors duration-300">
      
      {/* Mobile Top Navigation Header */}
      <header id="mobile-header" className="md:hidden flex items-center justify-between p-4 border-b border-zinc-200/50 dark:border-zinc-800/50 bg-white dark:bg-zinc-900/90 sticky top-0 z-40 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-zinc-950 dark:text-zinc-50" />
          <span className="font-semibold text-base font-display">Aura</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle darkMode={darkMode} setDarkMode={handleSetDarkMode} />
          <button 
            id="mobile-menu-toggle-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
            className="p-2 text-zinc-600 dark:text-zinc-300 cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Persistent Sidebar for iPad / Desktop Screens */}
      <aside id="desktop-sidebar" className="hidden md:flex flex-col w-64 bg-white dark:bg-zinc-900/90 border-r border-zinc-200/50 dark:border-zinc-800/50 p-5 shrink-0 justify-between sticky top-0 h-screen z-30">
        <div className="space-y-6">
          {/* Logo brand and Theme configuration */}
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-zinc-900 dark:bg-zinc-50 flex items-center justify-center">
                <Layers className="w-4 h-4 text-white dark:text-zinc-900" />
              </div>
              <span className="font-bold text-lg font-display tracking-tight text-zinc-950 dark:text-zinc-50">Aura</span>
            </div>
            <ThemeToggle darkMode={darkMode} setDarkMode={handleSetDarkMode} />
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {sidebarTabs.map(item => {
              const Icon = item.icon;
              const isActive = tab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold rounded-xl tracking-tight transition-all cursor-pointer ${
                    isActive
                      ? 'bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 shadow-premium'
                      : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                      isActive 
                        ? 'bg-white/20 text-white dark:bg-zinc-900/20 dark:text-zinc-900' 
                        : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sync Status / Info Card in margins */}
        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
          {state.telegram.isActive ? (
            <div className="flex items-center gap-2 text-[10px] text-emerald-500 font-bold px-1">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span>Бот @{state.telegram.botUsername} онлайн</span>
            </div>
          ) : (
            <button 
              onClick={() => setTab('telegram')}
              className="text-[10px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-left block w-full px-1"
            >
              Подключить Telegram bot →
            </button>
          )}
        </div>
      </aside>

      {/* Mobile Drawer Menu Overlays */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            id="mobile-drawer"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.15 }}
            className="md:hidden fixed top-16 inset-x-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-4 z-35 flex flex-col gap-1.5 shadow-premium max-h-[80vh] overflow-y-auto"
          >
            {sidebarTabs.map(item => {
              const Icon = item.icon;
              const isActive = tab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold ${
                    isActive
                      ? 'bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900'
                      : 'text-zinc-500 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4.5 h-4.5" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Panel Content Stage */}
      <main id="main-content-stage" className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="h-full"
          >
            {tab === 'dashboard' && (
              <Dashboard
                tasks={state.tasks}
                goals={state.goals}
                habits={state.habits}
                notes={state.notes}
                ideas={state.ideas}
                dailyRatings={state.dailyRatings}
                onAddTask={handleAddTask}
                onAddNote={(title, content) => handleAddNote({ title, content, type: 'text', checklistItems: [], isFavorite: false })}
                onAddIdea={handleAddIdea}
                onToggleTask={(id) => {
                  const t = state.tasks.find(x => x.id === id);
                  if (t) {
                    handleUpdateTask(id, { 
                      status: t.status === 'completed' ? 'pending' : 'completed',
                      completedAt: t.status === 'completed' ? undefined : new Date().toISOString()
                    });
                  }
                }}
                onRateDay={handleRateDay}
                setTab={setTab}
              />
            )}

            {tab === 'tasks' && (
              <TasksSection
                tasks={state.tasks}
                onAddTask={handleCreateTaskDetailed}
                onUpdateTask={handleUpdateTask}
                onDeleteTask={handleDeleteTask}
                onClearArchived={handleClearArchivedTasks}
                taskCategories={state.taskCategories}
                onUpdateCategories={handleUpdateCategories}
              />
            )}

            {tab === 'goals' && (
              <GoalsSection
                goals={state.goals}
                tasks={state.tasks}
                onAddGoal={handleAddGoal}
                onUpdateGoal={handleUpdateGoal}
                onDeleteGoal={handleDeleteGoal}
              />
            )}

            {tab === 'habits' && (
              <HabitsSection
                habits={state.habits}
                onAddHabit={handleAddHabit}
                onToggleHabitDay={handleToggleHabitDay}
                onDeleteHabit={handleDeleteHabit}
              />
            )}

            {tab === 'notes' && (
              <NotesSection
                notes={state.notes}
                onAddNote={handleAddNote}
                onUpdateNote={handleUpdateNote}
                onDeleteNote={handleDeleteNote}
              />
            )}

            {tab === 'ideas' && (
              <IdeasSection
                ideas={state.ideas}
                onAddIdea={handleAddIdea}
                onUpdateIdea={handleUpdateIdea}
                onDeleteIdea={handleDeleteIdea}
                onConvertIdea={handleConvertIdea}
              />
            )}

            {tab === 'favorites' && (
              <div className="space-y-6 bg-aura">
                <div>
                  <h2 className="text-2xl font-semibold font-display tracking-tight text-zinc-900 dark:text-zinc-50">Избранное и Закреплённое</h2>
                  <p className="text-sm text-zinc-500">Универсальный раздел, собирающий все ваши избранные задачи, цели, привычки, заметки и идеи в одном месте.</p>
                </div>

                {favoriteItems.totalCount === 0 ? (
                  <div className="py-16 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900">
                    <Star className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 font-display">Закреплённых элементов пока нет</p>
                    <p className="text-xs text-zinc-400 mt-1">Нажимайте на звездочки в других разделах, чтобы закрепить важные вещи здесь.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Favorite Tasks */}
                    {favoriteItems.tasks.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">⭐ Избранные задачи ({favoriteItems.tasks.length})</span>
                        <div className="grid grid-cols-1 gap-2">
                          {favoriteItems.tasks.map(t => (
                            <div key={t.id} className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200/60 rounded-xl flex items-center justify-between text-xs">
                              <span className="font-semibold text-zinc-800 dark:text-zinc-200">{t.title}</span>
                              <span className="text-[10px] bg-zinc-100 dark:bg-zinc-850 px-2 py-0.5 rounded text-zinc-500">{t.category}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Favorite Goals */}
                    {favoriteItems.goals.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">🎯 Закреплённые цели ({favoriteItems.goals.length})</span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {favoriteItems.goals.map(g => (
                            <div key={g.id} className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200/60 rounded-xl text-xs space-y-1">
                              <span className="font-bold text-zinc-800 dark:text-zinc-200 block">{g.title}</span>
                              {g.description && <p className="text-zinc-400 line-clamp-1">{g.description}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Favorite Notes */}
                    {favoriteItems.notes.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">📝 Избранные заметки ({favoriteItems.notes.length})</span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {favoriteItems.notes.map(n => (
                            <div key={n.id} className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200/60 rounded-xl text-xs space-y-1">
                              <span className="font-bold text-zinc-800 dark:text-zinc-200 block">{n.title}</span>
                              <p className="text-zinc-400 line-clamp-2 leading-relaxed">{n.content}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Favorite Ideas */}
                    {favoriteItems.ideas.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">💡 Избранные идеи ({favoriteItems.ideas.length})</span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {favoriteItems.ideas.map(i => (
                            <div key={i.id} className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200/60 rounded-xl text-xs space-y-1">
                              <span className="font-bold text-zinc-800 dark:text-zinc-200 block">{i.title}</span>
                              <p className="text-zinc-400 line-clamp-2 leading-relaxed">{i.content}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {tab === 'calendar' && (
              <CalendarSection
                tasks={state.tasks}
                goals={state.goals}
                habits={state.habits}
                achievements={state.achievements}
              />
            )}

            {tab === 'analytics' && (
              <AnalyticsSection
                tasks={state.tasks}
                dailyRatings={state.dailyRatings}
                habits={state.habits}
              />
            )}

            {tab === 'achievements' && (
              <AchievementsSection achievements={state.achievements} />
            )}

            {tab === 'telegram' && (
              <TelegramSection
                telegram={state.telegram}
                onUpdateConfig={handleUpdateTelegramConfig}
                onTestNotify={handleTestTelegramNotification}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
