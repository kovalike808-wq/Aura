import { useState, useEffect, useMemo, useRef } from 'react';
import {
  CheckSquare, Target, Flame, BookOpen, BarChart2,
  Award, Calendar as CalendarIcon, Star, Layers,
  Menu, X, Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Import Types and Constants
import { AppState, Task, Goal, Habit, Note, Achievement, DailyRating, TelegramConfig } from './types';
import { DEFAULT_ACHIEVEMENTS, todayStr, dateToStr } from './constants';

// Import storage sync (localStorage + optional Firebase)
import { loadState, saveState, loadStateFromStorage, subscribeToFirebase } from './firebaseSync';

// Import Components
import ThemeToggle from './components/ThemeToggle';
import Dashboard from './components/Dashboard';
import TasksSection from './components/TasksSection';
import GoalsSection from './components/GoalsSection';
import HabitsSection from './components/HabitsSection';
import NotesSection from './components/NotesSection';
import AnalyticsSection from './components/AnalyticsSection';
import AchievementsSection from './components/AchievementsSection';
import CalendarSection from './components/CalendarSection';


// Helper to merge state non-destructively
function mergeAppStates(st1: AppState, st2: AppState): AppState {
  const taskMap = new Map<string, Task>();
  [...(st1.tasks || []), ...(st2.tasks || [])].forEach(t => {
    if (!taskMap.has(t.id)) {
      taskMap.set(t.id, t);
    } else {
      const existing = taskMap.get(t.id)!;
      if (t.status === 'completed' || existing.status === 'completed') {
        taskMap.set(t.id, { ...existing, ...t, status: 'completed' });
      } else {
        taskMap.set(t.id, { ...existing, ...t });
      }
    }
  });

  const goalMap = new Map<string, Goal>();
  [...(st1.goals || []), ...(st2.goals || [])].forEach(g => {
    if (!goalMap.has(g.id)) {
      goalMap.set(g.id, g);
    } else {
      const existing = goalMap.get(g.id)!;
      const combinedTaskIds = Array.from(new Set([...(existing.taskIds || []), ...(g.taskIds || [])]));
      goalMap.set(g.id, {
        ...existing,
        ...g,
        taskIds: combinedTaskIds
      });
    }
  });

  const habitMap = new Map<string, Habit>();
  [...(st1.habits || []), ...(st2.habits || [])].forEach(h => {
    if (!habitMap.has(h.id)) {
      habitMap.set(h.id, h);
    } else {
      const existing = habitMap.get(h.id)!;
      const combinedHistory = Array.from(new Set([...(existing.history || []), ...(h.history || [])])).sort();
      habitMap.set(h.id, {
        ...existing,
        ...h,
        history: combinedHistory,
        streak: Math.max(existing.streak || 0, h.streak || 0)
      });
    }
  });

  const noteMap = new Map<string, Note>();
  [...(st1.notes || []), ...(st2.notes || [])].forEach(n => noteMap.set(n.id, n));

  const ratingMap = new Map<string, DailyRating>();
  [...(st1.dailyRatings || []), ...(st2.dailyRatings || [])].forEach(r => ratingMap.set(r.date, r));

  const mergedAchievements = DEFAULT_ACHIEVEMENTS.map(def => {
    const a1 = (st1.achievements || []).find(a => a.id === def.id);
    const a2 = (st2.achievements || []).find(a => a.id === def.id);
    const isUnlocked = Boolean(def.unlocked || a1?.unlocked || a2?.unlocked);
    const unlockedAt = a1?.unlockedAt || a2?.unlockedAt;
    return {
      ...def,
      unlocked: isUnlocked,
      unlockedAt: isUnlocked ? (unlockedAt || new Date().toISOString()) : undefined
    };
  });

  const categories = Array.from(new Set([
    'Дизайн', 'Разработка', 'Здоровье', 'Развитие', 'Быт', 'Разное',
    ...(st1.taskCategories || []),
    ...(st2.taskCategories || [])
  ]));

  const telegram = {
    botToken: st1.telegram?.botToken || st2.telegram?.botToken || '',
    botUsername: st1.telegram?.botUsername || st2.telegram?.botUsername || '',
    isActive: Boolean(st1.telegram?.isActive || st2.telegram?.isActive),
    chatId: st1.telegram?.chatId || st2.telegram?.chatId
  };

  return {
    tasks: Array.from(taskMap.values()),
    goals: Array.from(goalMap.values()),
    habits: Array.from(habitMap.values()),
    notes: Array.from(noteMap.values()),
    achievements: mergedAchievements,
    dailyRatings: Array.from(ratingMap.values()),
    telegram,
    taskCategories: categories,
    lastUpdated: Math.max(st1.lastUpdated || 0, st2.lastUpdated || 0, Date.now())
  };
}

export default function App() {
  // Navigation tabs
  const [tab, setTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // App Master State
  const [state, setState] = useState<AppState | null>(null);
  const stateRef = useRef<AppState | null>(null);
  stateRef.current = state;

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

  // Ensure safe AppState structure
  const ensureSafeState = (raw: any): AppState => {
    if (!raw || typeof raw !== 'object') {
      return {
        tasks: [],
        goals: [],
        habits: [],
        notes: [],
        achievements: DEFAULT_ACHIEVEMENTS,
        dailyRatings: [],
        telegram: { botToken: '', botUsername: '', isActive: false },
        taskCategories: ['Дизайн', 'Разработка', 'Здоровье', 'Развитие', 'Быт', 'Разное'],
        lastUpdated: Date.now()
      };
    }

    const rawAchievements: Achievement[] = Array.isArray(raw.achievements) ? raw.achievements : [];
    const mergedAchievements = DEFAULT_ACHIEVEMENTS.map(def => {
      const found = rawAchievements.find(a => a.id === def.id);
      if (found) {
        return { ...def, ...found, unlocked: Boolean(def.unlocked || found.unlocked) };
      }
      return def;
    });

    return {
      tasks: Array.isArray(raw.tasks) ? raw.tasks : [],
      goals: Array.isArray(raw.goals) ? raw.goals : [],
      habits: Array.isArray(raw.habits) ? raw.habits : [],
      notes: Array.isArray(raw.notes) ? raw.notes : [],
      achievements: mergedAchievements,
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
  };

  // Load state on mount + subscribe to real-time Firebase updates
  useEffect(() => {
    loadState().then(loaded => {
      setState(loaded);
      console.log('[App] State loaded. Tasks:', loaded.tasks.length, 'Goals:', loaded.goals.length);
    });

    // Real-time listener — updates state instantly when another device changes data
    subscribeToFirebase((cloudState) => {
      console.log('[App] Real-time cloud update. Tasks:', cloudState.tasks.length);
      setState(cloudState);
    });
  }, []);

  // Sync to localStorage on visibility change (for multi-tab)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && stateRef.current) {
        const saved = loadStateFromStorage();
        if (saved && saved.lastUpdated > stateRef.current.lastUpdated) {
          setState(saved);
          console.log('[Tab] Synced from another tab.');
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Calculated: Favorites list of items across categories
  const favoriteItems = useMemo(() => {
    if (!state) {
      return {
        tasks: [],
        goals: [],
        habits: [],
        notes: [],
        totalCount: 0
      };
    }
    const favTasks = state.tasks.filter(t => t.isFavorite);
    const favGoals = state.goals.filter(g => g.isFavorite);
    const favHabits = state.habits.filter(h => h.isFavorite);
    const favNotes = state.notes.filter(n => n.isFavorite);

    return {
      tasks: favTasks,
      goals: favGoals,
      habits: favHabits,
      notes: favNotes,
      totalCount: favTasks.length + favGoals.length + favHabits.length + favNotes.length
    };
  }, [state]);

  // Helper to sync local updates (localStorage + optional Firebase)
  const syncStateWithServer = async (updated: AppState) => {
    const nextState = { ...updated, lastUpdated: Date.now() };
    stateRef.current = nextState;
    setState(nextState);
    saveState(nextState);
  };

  if (!state) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center font-sans">
        <div className="text-center space-y-4">
          <div className="relative w-12 h-12 mx-auto">
            <div className="absolute inset-0 border-4 border-zinc-200 dark:border-zinc-800 rounded-full" />
            <div className="absolute inset-0 border-4 border-zinc-900 dark:border-zinc-50 border-t-transparent rounded-full animate-spin" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 font-display">Загрузка Aura</p>
            <p className="text-xs text-zinc-400">Подготовка вашей личной системы...</p>
          </div>
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
      dueDate: todayStr()
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

  const handleAddTasksBatch = (taskFieldsList: Omit<Task, 'id' | 'createdAt' | 'status'>[], linkedGoalId?: string) => {
    const newTasks: Task[] = taskFieldsList.map(fields => ({
      ...fields,
      id: 'task_' + Math.random().toString(36).substr(2, 9),
      status: 'pending',
      createdAt: new Date().toISOString()
    }));

    const nextState = { ...state, tasks: [...state.tasks, ...newTasks] };

    if (linkedGoalId) {
      nextState.goals = nextState.goals.map(g => {
        if (g.id === linkedGoalId) {
          return {
            ...g,
            taskIds: [...(g.taskIds || []), ...newTasks.map(t => t.id)]
          };
        }
        return g;
      });
    }

    syncStateWithServer(nextState);
    return newTasks.map(t => t.id);
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
  const handleAddGoal = (
    goalFields: Omit<Goal, 'id' | 'createdAt'>,
    batchTasks?: Omit<Task, 'id' | 'createdAt' | 'status'>[]
  ) => {
    const goalId = 'goal_' + Math.random().toString(36).substr(2, 9);
    let newTasks: Task[] = [];
    let mergedTaskIds = goalFields.taskIds || [];

    if (batchTasks && batchTasks.length > 0) {
      newTasks = batchTasks.map(fields => ({
        ...fields,
        id: 'task_' + Math.random().toString(36).substr(2, 9),
        status: 'pending',
        createdAt: new Date().toISOString()
      }));
      const batchIds = newTasks.map(t => t.id);
      mergedTaskIds = Array.from(new Set([...mergedTaskIds, ...batchIds]));
    }

    const newGoal: Goal = {
      ...goalFields,
      taskIds: mergedTaskIds,
      id: goalId,
      createdAt: new Date().toISOString()
    };

    const nextState = {
      ...state,
      tasks: newTasks.length > 0 ? [...state.tasks, ...newTasks] : state.tasks,
      goals: [...state.goals, newGoal]
    };
    
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
  const handleAddHabit = (title: string, frequency: 'daily' | 'weekly', startTime?: string) => {
    const newHabit: Habit = {
      id: 'habit_' + Math.random().toString(36).substr(2, 9),
      title,
      frequency,
      streak: 0,
      history: [],
      createdAt: new Date().toISOString(),
      isFavorite: false,
      startTime: startTime || undefined
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
          const todayDateStr = todayStr();
          
          let checkDate = new Date();
          let checkDateStr = dateToStr(checkDate);

          // If not completed today or yesterday, streak is broken / reset
          const completedToday = sortedHistory.includes(todayDateStr);
          
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = dateToStr(yesterday);
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
              const targetStr = dateToStr(checkDate);
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

  // Daily Rating
  const handleRateDay = (score: number, comment: string) => {
    const todayDateStr = todayStr();
    const existingIdx = state.dailyRatings.findIndex(r => r.date === todayDateStr);
    const newRating: DailyRating = { date: todayDateStr, score, comment };

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

  const sidebarTabs = [
    { id: 'dashboard', label: 'Рабочий стол', icon: Layers },
    { id: 'tasks', label: 'Задачи', icon: CheckSquare },
    { id: 'goals', label: 'Цели и проекты', icon: Target },
    { id: 'habits', label: 'Привычки', icon: Flame },
    { id: 'notes', label: 'Блокнот', icon: BookOpen },
    { id: 'favorites', label: 'Избранное', icon: Star, badge: favoriteItems.totalCount > 0 ? favoriteItems.totalCount : undefined },
    { id: 'calendar', label: 'Календарь', icon: CalendarIcon },
    { id: 'analytics', label: 'Аналитика', icon: BarChart2 },
    { id: 'achievements', label: 'Достижения', icon: Award }
  ];

  return (
    <div id="app-root" className="h-[100dvh] w-screen overflow-hidden flex flex-col md:flex-row bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 transition-colors duration-300">
      
      {/* Mobile Top Navigation Header */}
      <header
        id="mobile-header"
        className="md:hidden flex items-center justify-between px-4 pb-4 border-b border-zinc-200/50 dark:border-zinc-800/50 bg-white/80 dark:bg-zinc-900/80 sticky top-0 z-40 backdrop-blur-xl shrink-0 select-none"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center shadow-lg">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg font-display tracking-tight">Aura</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle darkMode={darkMode} setDarkMode={handleSetDarkMode} />
          <button
            id="mobile-menu-toggle-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-zinc-600 dark:text-zinc-300 cursor-pointer rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Persistent Sidebar for iPad / Desktop Screens */}
      <aside id="desktop-sidebar" className="hidden md:flex flex-col w-64 bg-white dark:bg-zinc-900/95 border-r border-zinc-200/50 dark:border-zinc-800/50 p-5 shrink-0 justify-between sticky top-0 h-screen z-30">
        <div className="space-y-6">
          {/* Logo brand and Theme configuration */}
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Layers className="w-4.5 h-4.5 text-white" />
              </div>
              <div>
                <span className="font-bold text-lg font-display tracking-tight text-zinc-950 dark:text-zinc-50 block leading-tight">Aura</span>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">Личная система</span>
              </div>
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
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold rounded-xl tracking-tight transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-zinc-900 to-zinc-800 text-white dark:from-zinc-50 dark:to-zinc-100 dark:text-zinc-900 shadow-lg shadow-zinc-900/20 dark:shadow-zinc-500/20'
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

        {/* Sync & Info label */}
        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-2 px-1">
          <div className="flex items-center gap-2 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2 rounded-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Синхронизация активна</span>
          </div>
          <div className="text-[10px] text-zinc-400 select-none px-1">
            Aura v1.0 — PWA Platform
          </div>
        </div>
      </aside>

      {/* Mobile Drawer Menu Overlays */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            id="mobile-drawer"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="md:hidden fixed inset-x-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-4 z-35 flex flex-col gap-1.5 shadow-premium-dark max-h-[75vh] overflow-y-auto"
            style={{ top: 'calc(env(safe-area-inset-top, 0px) + 3.5rem)' }}
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
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-zinc-900 to-zinc-800 text-white dark:from-zinc-50 dark:to-zinc-100 dark:text-zinc-900 shadow-lg'
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
      <main 
        id="main-content-stage" 
        className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full overflow-y-auto overflow-x-hidden"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 5rem)' }}
      >
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
                dailyRatings={state.dailyRatings}
                onAddTask={handleAddTask}
                onAddNote={(title, content) => handleAddNote({ title, content, type: 'text', checklistItems: [], isFavorite: false })}
                onToggleTask={(id) => {
                  const t = state.tasks.find(x => x.id === id);
                  if (t) {
                    handleUpdateTask(id, {
                      status: t.status === 'completed' ? 'pending' : 'completed',
                      completedAt: t.status === 'completed' ? undefined : new Date().toISOString()
                    });
                  }
                }}
                onToggleHabitDay={handleToggleHabitDay}
                onRateDay={handleRateDay}
                setTab={setTab}
              />
            )}

            {tab === 'tasks' && (
              <TasksSection
                tasks={state.tasks}
                goals={state.goals}
                onAddTask={handleCreateTaskDetailed}
                onAddTasksBatch={handleAddTasksBatch}
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

            {tab === 'favorites' && (
              <div className="space-y-6 bg-aura">
                <div>
                  <h2 className="text-2xl font-semibold font-display tracking-tight text-zinc-900 dark:text-zinc-50">Избранное и закреплённое</h2>
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
                            <div key={t.id} className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200/60 rounded-xl flex items-center justify-between text-xs gap-2">
                              <div className="min-w-0 flex-1">
                                <span className="font-semibold text-zinc-800 dark:text-zinc-200 block truncate">{t.title}</span>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[10px] bg-zinc-100 dark:bg-zinc-850 px-2 py-0.5 rounded text-zinc-500">{t.category}</span>
                                  {t.startTime && <span className="text-[10px] text-indigo-400">🕐 {t.startTime}</span>}
                                </div>
                              </div>
                              <button
                                onClick={() => {
                                  const newTask: Task = {
                                    id: 'task_' + Math.random().toString(36).substr(2, 9),
                                    title: t.title,
                                    description: t.description,
                                    category: t.category,
                                    priority: t.priority,
                                    status: 'pending',
                                    estimatedTime: t.estimatedTime,
                                    actualTime: 0,
                                    createdAt: new Date().toISOString(),
                                    isFavorite: false,
                                    dueDate: todayStr(),
                                    startTime: t.startTime,
                                    telegramReminder: t.telegramReminder ? { ...t.telegramReminder } : undefined
                                  };
                                  const nextState = { ...state, tasks: [...state.tasks, newTask] };
                                  syncStateWithServer(nextState);
                                }}
                                className="shrink-0 px-3 py-1.5 bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 rounded-lg text-[11px] font-semibold hover:opacity-90 active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                                title="Создать копию задачи"
                              >
                                <Plus className="w-3 h-3" /> Новая
                              </button>
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

          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
