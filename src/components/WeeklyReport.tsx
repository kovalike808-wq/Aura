import { useState, useMemo } from 'react';
import { 
  BarChart2, CheckSquare, Flame, Target, Star, TrendingUp, 
  Calendar, ArrowUpRight, ArrowDownRight, Minus, Download
} from 'lucide-react';
import { motion } from 'motion/react';
import { Task, Goal, Habit, DailyRating, Achievement } from '../types';
import { todayStr, dateToStr } from '../constants';

interface WeeklyReportProps {
  tasks: Task[];
  goals: Goal[];
  habits: Habit[];
  dailyRatings: DailyRating[];
  achievements: Achievement[];
}

function getWeekDates(offset: number = 0): { start: Date; end: Date; startStr: string; endStr: string } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  
  const start = new Date(now);
  start.setDate(now.getDate() + mondayOffset + offset * 7);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  
  return {
    start,
    end,
    startStr: dateToStr(start),
    endStr: dateToStr(end)
  };
}

function formatDateRange(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  return `${start.toLocaleDateString('ru-RU', opts)} — ${end.toLocaleDateString('ru-RU', opts)}`;
}

export default function WeeklyReport({
  tasks,
  goals,
  habits,
  dailyRatings,
  achievements
}: WeeklyReportProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const { start, end, startStr, endStr } = useMemo(() => getWeekDates(weekOffset), [weekOffset]);

  // Generate array of 7 date strings for the week
  const weekDays = useMemo(() => {
    const days: string[] = [];
    const d = new Date(start);
    for (let i = 0; i < 7; i++) {
      days.push(dateToStr(d));
      d.setDate(d.getDate() + 1);
    }
    return days;
  }, [start]);

  const weekDayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  // === TASKS ===
  const tasksCreated = tasks.filter(t => {
    const created = t.createdAt.slice(0, 10);
    return created >= startStr && created <= endStr;
  });

  const tasksCompleted = tasks.filter(t => {
    const completed = t.completedAt?.slice(0, 10);
    return completed && completed >= startStr && completed <= endStr;
  });

  const tasksCompletionRate = tasksCreated.length > 0
    ? Math.round((tasksCompleted.length / tasksCreated.length) * 100)
    : 0;

  // === HABITS ===
  const habitsCompletionByDay = weekDays.map(day => {
    const done = habits.filter(h => h.history.includes(day)).length;
    return { day, done, total: habits.length, rate: habits.length > 0 ? Math.round((done / habits.length) * 100) : 0 };
  });

  const totalHabitCompletions = habitsCompletionByDay.reduce((sum, d) => sum + d.done, 0);
  const totalPossible = habits.length * 7;
  const habitOverallRate = totalPossible > 0 ? Math.round((totalHabitCompletions / totalPossible) * 100) : 0;

  // === DAILY RATINGS ===
  const weekRatings = dailyRatings.filter(r => r.date >= startStr && r.date <= endStr);
  const avgRating = weekRatings.length > 0
    ? (weekRatings.reduce((sum, r) => sum + r.score, 0) / weekRatings.length).toFixed(1)
    : '—';

  // === GOALS ===
  const activeGoals = goals.filter(g => {
    const created = g.createdAt.slice(0, 10);
    return created <= endStr;
  });

  const goalsCompletedThisWeek = goals.filter(g => {
    const completedTasks = (g.taskIds || []).filter(id =>
      tasks.some(t => t.id === id && t.status === 'completed' && t.completedAt?.slice(0, 10) >= startStr && t.completedAt?.slice(0, 10) <= endStr)
    );
    return completedTasks.length > 0;
  });

  // === ACHIEVEMENTS ===
  const achievementsThisWeek = achievements.filter(a => {
    const unlocked = a.unlockedAt?.slice(0, 10);
    return a.unlocked && unlocked && unlocked >= startStr && unlocked <= endStr;
  });

  // === PRODUCTIVITY BY DAY ===
  const productivityByDay = weekDays.map((day, i) => {
    const completed = tasks.filter(t => t.completedAt?.slice(0, 10) === day).length;
    const rated = dailyRatings.find(r => r.date === day);
    return {
      day,
      label: weekDayNames[i],
      completed,
      rating: rated?.score || 0
    };
  });

  const maxCompleted = Math.max(...productivityByDay.map(d => d.completed), 1);

  const handleExport = () => {
    const report = {
      period: `${startStr} — ${endStr}`,
      tasks: { created: tasksCreated.length, completed: tasksCompleted.length, rate: `${tasksCompletionRate}%` },
      habits: { totalCompletions: totalHabitCompletions, rate: `${habitOverallRate}%` },
      ratings: { average: avgRating, count: weekRatings.length },
      goals: activeGoals.length,
      achievements: achievementsThisWeek.map(a => a.title)
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aura-report-${startStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isThisWeek = weekOffset === 0;

  return (
    <div id="weekly-report" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-zinc-50 to-zinc-100/50 dark:from-zinc-900/40 dark:to-zinc-900/10 p-6 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/40">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-600 dark:text-indigo-400">
              <BarChart2 className="w-5 h-5" />
            </span>
            <h2 className="text-2xl font-bold font-display tracking-tight text-zinc-900 dark:text-zinc-50">Еженедельный отчёт</h2>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {formatDateRange(start, end)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekOffset(w => w - 1)}
            className="px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            ← Пред.
          </button>
          {!isThisWeek && (
            <button
              onClick={() => setWeekOffset(0)}
              className="px-3 py-2 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer"
            >
              Сейчас
            </button>
          )}
          <button
            onClick={() => setWeekOffset(w => w + 1)}
            disabled={weekOffset >= 0}
            className="px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          >
            След. →
          </button>
          <button
            onClick={handleExport}
            className="px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5" /> Экспорт
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tasks */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-5 space-y-2 shadow-premium"
        >
          <div className="flex items-center justify-between text-zinc-400">
            <CheckSquare className="w-5 h-5 text-indigo-500" />
            <span className={`text-xs font-mono font-bold ${tasksCompletionRate >= 70 ? 'text-emerald-600 dark:text-emerald-400' : tasksCompletionRate >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-500'}`}>
              {tasksCompletionRate}%
            </span>
          </div>
          <p className="text-[10px] text-zinc-500 font-medium font-display uppercase tracking-wider">Задачи</p>
          <p className="text-xl font-bold font-display text-zinc-900 dark:text-zinc-100">
            {tasksCompleted.length} <span className="text-xs text-zinc-400 font-normal">из {tasksCreated.length}</span>
          </p>
        </motion.div>

        {/* Habits */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-5 space-y-2 shadow-premium"
        >
          <div className="flex items-center justify-between text-zinc-400">
            <Flame className="w-5 h-5 text-amber-500" />
            <span className={`text-xs font-mono font-bold ${habitOverallRate >= 70 ? 'text-emerald-600 dark:text-emerald-400' : habitOverallRate >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-500'}`}>
              {habitOverallRate}%
            </span>
          </div>
          <p className="text-[10px] text-zinc-500 font-medium font-display uppercase tracking-wider">Привычки</p>
          <p className="text-xl font-bold font-display text-zinc-900 dark:text-zinc-100">
            {totalHabitCompletions} <span className="text-xs text-zinc-400 font-normal">из {totalPossible}</span>
          </p>
        </motion.div>

        {/* Daily Rating */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-5 space-y-2 shadow-premium"
        >
          <div className="flex items-center justify-between text-zinc-400">
            <TrendingUp className="w-5 h-5 text-emerald-500" />
            <span className="text-xs font-mono text-zinc-500">{weekRatings.length} оценок</span>
          </div>
          <p className="text-[10px] text-zinc-500 font-medium font-display uppercase tracking-wider">Средняя оценка</p>
          <p className="text-xl font-bold font-display text-zinc-900 dark:text-zinc-100">
            {avgRating} <span className="text-xs text-zinc-400 font-normal">/ 10</span>
          </p>
        </motion.div>

        {/* Achievements */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-5 space-y-2 shadow-premium"
        >
          <div className="flex items-center justify-between text-zinc-400">
            <Star className="w-5 h-5 text-amber-500" />
            <span className="text-xs font-mono text-zinc-500">{achievementsThisWeek.length} новых</span>
          </div>
          <p className="text-[10px] text-zinc-500 font-medium font-display uppercase tracking-wider">Достижения</p>
          <p className="text-xl font-bold font-display text-zinc-900 dark:text-zinc-100">
            {achievements.filter(a => a.unlocked).length} <span className="text-xs text-zinc-400 font-normal">всего</span>
          </p>
        </motion.div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Productivity Bar Chart */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-5 shadow-premium space-y-4">
          <h3 className="text-sm font-medium font-display text-zinc-800 dark:text-zinc-200">Выполнение задач по дням</h3>
          <div className="space-y-2">
            {productivityByDay.map((day, i) => (
              <div key={day.day} className="flex items-center gap-3">
                <span className="text-xs font-mono text-zinc-400 w-6 text-right">{day.label}</span>
                <div className="flex-1 h-6 bg-zinc-100 dark:bg-zinc-800 rounded-lg overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(day.completed / maxCompleted) * 100}%` }}
                    transition={{ duration: 0.5, delay: i * 0.05 }}
                    className="h-full bg-gradient-to-r from-indigo-400 to-indigo-600 dark:from-indigo-500 dark:to-indigo-700 rounded-lg"
                  />
                </div>
                <span className="text-xs font-mono text-zinc-500 w-6">{day.completed}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Habit Completion Heatmap */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-5 shadow-premium space-y-4">
          <h3 className="text-sm font-medium font-display text-zinc-800 dark:text-zinc-200">Выполнение привычек по дням</h3>
          <div className="space-y-2">
            {habitsCompletionByDay.map((day, i) => (
              <div key={day.day} className="flex items-center gap-3">
                <span className="text-xs font-mono text-zinc-400 w-6 text-right">{weekDayNames[i]}</span>
                <div className="flex-1 h-6 bg-zinc-100 dark:bg-zinc-800 rounded-lg overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${day.rate}%` }}
                    transition={{ duration: 0.5, delay: i * 0.05 }}
                    className={`h-full rounded-lg ${
                      day.rate >= 80 ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' :
                      day.rate >= 50 ? 'bg-gradient-to-r from-amber-400 to-amber-600' :
                      day.rate > 0 ? 'bg-gradient-to-r from-rose-400 to-rose-600' :
                      'bg-zinc-200 dark:bg-zinc-700'
                    }`}
                  />
                </div>
                <span className="text-xs font-mono text-zinc-500 w-10">{day.done}/{day.total}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Goals Progress */}
      {activeGoals.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-5 shadow-premium space-y-4">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-cyan-500" />
            <h3 className="text-sm font-medium font-display text-zinc-800 dark:text-zinc-200">Прогресс целей</h3>
          </div>
          <div className="space-y-3">
            {activeGoals.slice(0, 5).map(goal => {
              const totalTasks = (goal.taskIds || []).length;
              const completedTasks = (goal.taskIds || []).filter(id =>
                tasks.some(t => t.id === id && t.status === 'completed')
              ).length;
              const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

              return (
                <div key={goal.id} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{goal.title}</span>
                    <span className="text-[10px] font-mono text-zinc-400">{completedTasks}/{totalTasks} задач</span>
                  </div>
                  <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.6 }}
                      className="h-full bg-gradient-to-r from-cyan-400 to-cyan-600 rounded-full"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Achievements List */}
      {achievementsThisWeek.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-amber-100/50 dark:from-amber-950/20 dark:to-amber-900/10 border border-amber-200/60 dark:border-amber-800/30 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
            <h3 className="text-sm font-medium font-display text-amber-800 dark:text-amber-200">Новые достижения этой недели</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {achievementsThisWeek.map(a => (
              <span
                key={a.id}
                className="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-800/40 rounded-lg text-xs font-semibold text-amber-700 dark:text-amber-300"
              >
                {a.title}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Verdict */}
      <div className="bg-gradient-to-r from-zinc-900 to-zinc-800 dark:from-zinc-50 dark:to-zinc-100 rounded-2xl p-6 text-center space-y-2">
        <p className="text-sm font-medium text-zinc-400 dark:text-zinc-500">Итог недели</p>
        <p className="text-lg font-bold font-display text-white dark:text-zinc-900">
          {tasksCompletionRate >= 80 && habitOverallRate >= 70
            ? 'Отличная неделя! Вы в ударе.'
            : tasksCompletionRate >= 50 && habitOverallRate >= 50
            ? 'Хороший прогресс. Продолжайте в том же духе!'
            : tasksCompletionRate > 0 || habitOverallRate > 0
            ? 'Есть над чем поработать. Начните с малого.'
            : 'Спокойная неделя. Начните планировать следующую!'}
        </p>
      </div>
    </div>
  );
}
