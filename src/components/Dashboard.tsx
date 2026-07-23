import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, Clock, Calendar, Flame, Target, Sparkles, BookOpen, 
  ArrowRight, Plus, Star, CheckSquare, ListTodo, Clipboard, Lightbulb, TrendingUp
} from 'lucide-react';
import { Task, Goal, Habit, Note, Idea, DailyRating } from '../types';
import { motion } from 'motion/react';
import { todayStr } from '../constants';

interface DashboardProps {
  tasks: Task[];
  goals: Goal[];
  habits: Habit[];
  notes: Note[];
  ideas: Idea[];
  dailyRatings: DailyRating[];
  onAddTask: (title: string, priority: 'low' | 'medium' | 'high') => void;
  onAddNote: (title: string, content: string) => void;
  onAddIdea: (title: string, content: string) => void;
  onToggleTask: (id: string) => void;
  onToggleHabitDay: (id: string, dateStr: string) => void;
  onRateDay: (score: number, comment: string) => void;
  setTab: (tab: string) => void;
}

export default function Dashboard({
  tasks,
  goals,
  habits,
  notes,
  ideas,
  dailyRatings,
  onAddTask,
  onAddNote,
  onAddIdea,
  onToggleTask,
  onToggleHabitDay,
  onRateDay,
  setTab
}: DashboardProps) {
  const [time, setTime] = useState(new Date());
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [ratingScore, setRatingScore] = useState<number | null>(null);
  const [ratingComment, setRatingComment] = useState('');
  const [showRatingSuccess, setShowRatingSuccess] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getGreeting = () => {
    const hour = time.getHours();
    if (hour < 6) return 'Доброй ночи';
    if (hour < 12) return 'Доброе утро';
    if (hour < 18) return 'Добрый день';
    return 'Добрый вечер';
  };

  const formattedDate = time.toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });

  const formattedTime = time.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const isEvening = time.getHours() >= 18;

  // Calculate statistics
  const todayDateStr = todayStr();
  const todayTasks = tasks.filter(t => !t.dueDate || t.dueDate === todayDateStr);
  const completedTodayTasks = todayTasks.filter(t => t.status === 'completed');
  const tasksProgress = todayTasks.length > 0 ? Math.round((completedTodayTasks.length / todayTasks.length) * 100) : 0;

  const activeHabits = habits.slice(0, 8);
  const totalStreak = habits.reduce((max, h) => Math.max(max, h.streak), 0);

  // Quick task submit
  const handleQuickTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTaskTitle.trim()) return;
    onAddTask(quickTaskTitle, 'medium');
    setQuickTaskTitle('');
  };

  // Check if today already rated
  const ratedToday = dailyRatings.find(r => r.date === todayDateStr);

  const handleRatingSubmit = () => {
    if (ratingScore === null) return;
    onRateDay(ratingScore, ratingComment);
    setShowRatingSuccess(true);
    setTimeout(() => {
      setShowRatingSuccess(false);
      setRatingScore(null);
      setRatingComment('');
    }, 3000);
  };

  return (
    <div id="dashboard-root" className="space-y-6 bg-aura">
      {/* Top Greeting & Time Card */}
      <div id="greeting-banner" className="relative overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 dark:from-zinc-800 dark:via-zinc-900 dark:to-zinc-950 rounded-2xl p-6 md:p-8 text-white shadow-xl">
        {/* Decorative gradient orb */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-purple-500/10 to-pink-500/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/4" />

        <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div className="md:col-span-2 space-y-2">
            <span className="text-sm font-medium tracking-wider text-zinc-400 uppercase font-display">
              {formattedDate}
            </span>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight font-display">
              {getGreeting()}
            </h1>
            <p className="text-zinc-400 text-sm max-w-md">
              Добро пожаловать в вашу личную систему фокуса. Сегодня отличный день для достижения новых высот.
            </p>
          </div>
          <div className="flex flex-col items-center md:items-end justify-center">
            <div className="flex items-center gap-2 text-zinc-400 text-sm font-mono mb-1">
              <Clock className="w-4 h-4" />
              <span>Текущее время</span>
            </div>
            <span className="text-3xl md:text-4xl font-mono font-medium tracking-tight text-white">
              {formattedTime}
            </span>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div id="metrics-grid" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-5 space-y-2 shadow-premium card-hover">
          <div className="flex items-center justify-between text-zinc-400">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-indigo-500" />
            </div>
            <span className="text-xs font-medium font-mono text-indigo-600/80 dark:text-indigo-400/80">{tasksProgress}%</span>
          </div>
          <p className="text-xs text-zinc-500 font-medium font-display uppercase tracking-wider">Задачи дня</p>
          <p className="text-2xl font-semibold font-display text-zinc-900 dark:text-zinc-100">
            {completedTodayTasks.length} <span className="text-sm text-zinc-400 font-normal">из {todayTasks.length}</span>
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-5 space-y-2 shadow-premium card-hover">
          <div className="flex items-center justify-between text-zinc-400">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center">
              <Flame className="w-5 h-5 text-amber-500 animate-pulse" />
            </div>
            <span className="text-xs font-mono text-amber-600/80 dark:text-amber-400/80">Рекорд</span>
          </div>
          <p className="text-xs text-zinc-500 font-medium font-display uppercase tracking-wider">Серия привычек</p>
          <p className="text-2xl font-semibold font-display text-zinc-900 dark:text-zinc-100">
            {totalStreak} <span className="text-sm text-zinc-400 font-normal">дней</span>
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-5 space-y-2 shadow-premium card-hover">
          <div className="flex items-center justify-between text-zinc-400">
            <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/30 flex items-center justify-center">
              <Target className="w-5 h-5 text-cyan-500" />
            </div>
            <span className="text-xs font-mono text-cyan-600/80 dark:text-cyan-400/80">Целей в работе</span>
          </div>
          <p className="text-xs text-zinc-500 font-medium font-display uppercase tracking-wider">Прогресс целей</p>
          <p className="text-2xl font-semibold font-display text-zinc-900 dark:text-zinc-100">
            {goals.length} <span className="text-sm text-zinc-400 font-normal">активных</span>
          </p>
        </div>

        <div
          onClick={() => {
            const el = document.getElementById('daily-rating-block');
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }}
          className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-5 space-y-2 shadow-premium card-hover cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 transition-all duration-200"
          title="Нажмите, чтобы оценить сегодняшний день"
        >
          <div className="flex items-center justify-between text-zinc-400">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
            </div>
            <span className="text-xs font-mono text-emerald-600/80 dark:text-emerald-400/80">Сегодня</span>
          </div>
          <p className="text-xs text-zinc-500 font-medium font-display uppercase tracking-wider">Оценка дня</p>
          <p className="text-2xl font-semibold font-display text-zinc-900 dark:text-zinc-100">
            {ratedToday ? `${ratedToday.score}/10` : 'Начать →'}
          </p>
        </div>
      </div>

      {/* Main Content Layout Grid */}
      <div id="main-dashboard-grid" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column: Tasks list & Quick Action */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Task input */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-5 shadow-premium">
            <h3 className="text-sm font-medium font-display mb-3 text-zinc-800 dark:text-zinc-200">Быстрое действие: Добавить задачу</h3>
            <form onSubmit={handleQuickTaskSubmit} className="flex gap-2">
              <input
                id="quick-task-input"
                type="text"
                placeholder="Что нужно сделать дальше?"
                value={quickTaskTitle}
                onChange={(e) => setQuickTaskTitle(e.target.value)}
                className="flex-1 px-4 py-2 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-400 focus:border-zinc-400 text-zinc-800 dark:text-zinc-200"
              />
              <button
                id="quick-task-submit-btn"
                type="submit"
                className="px-4 py-2 bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 rounded-lg text-sm font-medium hover:opacity-90 active:scale-95 transition-all cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Добавить
              </button>
            </form>
          </div>

          {/* Today's Tasks */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-5 shadow-premium space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-zinc-500" />
                <h3 className="text-sm font-medium font-display text-zinc-800 dark:text-zinc-200">Фокус на сегодня</h3>
              </div>
              <button 
                onClick={() => setTab('tasks')}
                className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 flex items-center gap-1 cursor-pointer transition-colors"
              >
                Все задачи <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-2">
              {todayTasks.length === 0 ? (
                <div className="py-8 text-center text-zinc-400 text-xs">
                  На сегодня задач нет. Отличный момент спланировать день!
                </div>
              ) : (
                todayTasks.map(task => (
                  <div 
                    key={task.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-950 border border-transparent hover:border-zinc-100 dark:hover:border-zinc-800/50 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => onToggleTask(task.id)}
                        className={`w-5 h-5 rounded border flex items-center justify-center transition-colors cursor-pointer ${
                          task.status === 'completed'
                            ? 'bg-zinc-900 dark:bg-zinc-50 border-zinc-900 dark:border-zinc-50 text-white dark:text-zinc-900'
                            : 'border-zinc-300 dark:border-zinc-700 hover:border-zinc-400'
                        }`}
                      >
                        {task.status === 'completed' && <CheckSquare className="w-3 h-3 stroke-[3]" />}
                      </button>
                      <div>
                        <p className={`text-sm font-medium transition-all ${
                          task.status === 'completed' ? 'line-through text-zinc-400 dark:text-zinc-500' : 'text-zinc-800 dark:text-zinc-100'
                        }`}>
                          {task.title}
                        </p>
                        {task.description && (
                          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 line-clamp-1 max-w-md">
                            {task.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                        {task.category}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Habits, Ratings & Note Preview */}
        <div className="space-y-6">
          {/* Daily Rating Block */}
          <div id="daily-rating-block" className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-5 shadow-premium space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-medium font-display text-zinc-800 dark:text-zinc-200">Оценка сегодняшнего дня</h3>
            </div>

            {ratedToday ? (
              <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-lg border border-zinc-100 dark:border-zinc-800 text-center space-y-1">
                <span className="text-3xl font-bold text-zinc-800 dark:text-zinc-100 font-display">
                  {ratedToday.score} <span className="text-sm font-normal text-zinc-400">/ 10</span>
                </span>
                {ratedToday.comment && (
                  <p className="text-xs text-zinc-500 italic mt-1">«{ratedToday.comment}»</p>
                )}
              </div>
            ) : !isEvening ? (
              <div className="text-center py-4">
                <p className="text-xs text-zinc-400">Оценка дня доступна с 18:00</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-zinc-500">Оцените качество сегодняшнего дня от 1 до 10:</p>
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <button
                      key={num}
                      onClick={() => setRatingScore(num)}
                      className={`h-8 text-xs font-semibold rounded-md flex items-center justify-center transition-all cursor-pointer ${
                        ratingScore === num
                          ? 'bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 font-bold'
                          : 'bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-950 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
                {ratingScore !== null && (
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Комментарий (необязательно)"
                      value={ratingComment}
                      onChange={(e) => setRatingComment(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-400 text-zinc-800 dark:text-zinc-200"
                    />
                    <button
                      onClick={handleRatingSubmit}
                      className="w-full py-1.5 bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 text-xs font-medium rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
                    >
                      Сохранить оценку
                    </button>
                  </div>
                )}
                {showRatingSuccess && (
                  <p className="text-xs text-emerald-500 font-medium text-center">Оценка дня успешно сохранена!</p>
                )}
              </div>
            )}
          </div>

          {/* Active Habits */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-5 shadow-premium space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-medium font-display text-zinc-800 dark:text-zinc-200">Активные привычки</h3>
              </div>
              <button 
                onClick={() => setTab('habits')}
                className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 flex items-center gap-1 cursor-pointer transition-colors"
              >
                Все <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-2">
              {activeHabits.length === 0 ? (
                <div className="py-4 text-center text-zinc-400 text-xs">Нет активных привычек.</div>
              ) : (
                activeHabits.map(habit => {
                  const doneToday = habit.history.includes(todayDateStr);
                  return (
                    <button
                      key={habit.id}
                      onClick={() => onToggleHabitDay(habit.id, todayDateStr)}
                      className={`w-full flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer ${
                        doneToday
                          ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40'
                          : 'bg-zinc-50 dark:bg-zinc-950/50 border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800/30'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                          doneToday
                            ? 'bg-emerald-500 border-emerald-500'
                            : 'border-zinc-300 dark:border-zinc-600'
                        }`}>
                          {doneToday && <CheckCircle2 className="w-3 h-3 text-white" />}
                        </div>
                        <span className={`text-xs font-semibold ${doneToday ? 'text-emerald-700 dark:text-emerald-300' : 'text-zinc-700 dark:text-zinc-300'}`}>{habit.title}</span>
                      </div>
                      <span className="text-[10px] text-zinc-400">🔥 {habit.streak}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Recent Notes */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-5 shadow-premium space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-medium font-display text-zinc-800 dark:text-zinc-200">Последние заметки</h3>
              </div>
              <button 
                onClick={() => setTab('notes')}
                className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 flex items-center gap-1 cursor-pointer transition-colors"
              >
                Все заметки <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-3">
              {notes.slice(0, 2).map(note => (
                <div 
                  key={note.id} 
                  onClick={() => setTab('notes')}
                  className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800/50 cursor-pointer transition-all space-y-1 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-100 group-hover:text-zinc-900 dark:group-hover:text-white">{note.title}</span>
                    {note.isFavorite && <Star className="w-3 h-3 text-amber-400 fill-amber-400" />}
                  </div>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 line-clamp-2 leading-relaxed">
                    {note.type === 'checklist' 
                      ? `${note.checklistItems.filter(i => i.checked).length} из ${note.checklistItems.length} задач решено`
                      : note.content
                    }
                  </p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
