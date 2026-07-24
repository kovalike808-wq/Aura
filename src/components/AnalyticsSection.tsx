import { useMemo } from 'react';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { Task, DailyRating, Habit } from '../types';
import { 
  TrendingUp, Clock, CheckCircle, Flame, Calendar, Award 
} from 'lucide-react';
import { todayStr, dateToStr } from '../constants';

interface AnalyticsSectionProps {
  tasks: Task[];
  dailyRatings: DailyRating[];
  habits: Habit[];
}

const COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

export default function AnalyticsSection({
  tasks,
  dailyRatings,
  habits
}: AnalyticsSectionProps) {

  // 1. Productivity Summary Metrics
  const metrics = useMemo(() => {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'completed' || t.status === 'archived').length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    const totalWorkMinutes = tasks.reduce((sum, t) => sum + (t.actualTime || 0), 0);
    const workHours = (totalWorkMinutes / 60).toFixed(1);

    const averageRating = dailyRatings.length > 0 
      ? (dailyRatings.reduce((sum, r) => sum + r.score, 0) / dailyRatings.length).toFixed(1)
      : '—';

    const maxStreak = habits.reduce((max, h) => Math.max(max, h.streak), 0);

    return {
      totalTasks,
      completedTasks,
      completionRate,
      workHours,
      averageRating,
      maxStreak
    };
  }, [tasks, dailyRatings, habits]);

  // 2. Format Tasks by Category (Pie Chart)
  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {};
    tasks.forEach(t => {
      counts[t.category] = (counts[t.category] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [tasks]);

  // 3. Format Daily Ratings Trend (Line Chart)
  const ratingTrendData = useMemo(() => {
    return [...dailyRatings]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-10) // show last 10 logs
      .map(r => ({
        date: new Date(r.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
        'Оценка': r.score
      }));
  }, [dailyRatings]);

  // 4. Tasks completed per day over last 7 days (Bar Chart)
  const last7DaysTasksData = useMemo(() => {
    const days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return dateToStr(d);
    });

    return days.map(dayStr => {
      const count = tasks.filter(t => {
        if (t.status !== 'completed' && t.status !== 'archived') return false;
        if (!t.completedAt) return false;
        return t.completedAt.startsWith(dayStr);
      }).length;

      return {
        day: new Date(dayStr).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric' }),
        'Задачи': count
      };
    });
  }, [tasks]);

  // 5. GitHub-style activity grid (last 30 days)
  const last30Days = useMemo(() => {
    return Array.from({ length: 30 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      return dateToStr(d);
    });
  }, []);

  return (
    <div id="analytics-section" className="space-y-6">
      {/* Title */}
      <div className="bg-gradient-to-r from-zinc-50 to-zinc-100/50 dark:from-zinc-900/40 dark:to-zinc-900/10 p-6 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/40">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-cyan-500/10 rounded-lg text-cyan-600 dark:text-cyan-400">
              <TrendingUp className="w-5 h-5" />
            </span>
            <h2 className="text-2xl font-bold font-display tracking-tight text-zinc-900 dark:text-zinc-50">Аналитика</h2>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xl">
            Оценивайте качество своего времени, фокус внимания и находите скрытые точки роста.
          </p>
        </div>
      </div>

      {/* Grid of Micro-Metrics cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-5 shadow-premium space-y-1 card-hover">
          <div className="flex items-center justify-between text-zinc-400 mb-1">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-indigo-500" />
            </div>
            <span className="text-[10px] font-semibold text-zinc-500 uppercase">Успеваемость</span>
          </div>
          <span className="text-2xl font-bold font-display text-zinc-800 dark:text-zinc-100">
            {metrics.completionRate}%
          </span>
          <p className="text-[10px] text-zinc-400">Выполнено: {metrics.completedTasks} из {metrics.totalTasks} задач</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-5 shadow-premium space-y-1 card-hover">
          <div className="flex items-center justify-between text-zinc-400 mb-1">
            <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/30 flex items-center justify-center">
              <Clock className="w-5 h-5 text-cyan-500" />
            </div>
            <span className="text-[10px] font-semibold text-zinc-500 uppercase">Время фокуса</span>
          </div>
          <span className="text-2xl font-bold font-display text-zinc-800 dark:text-zinc-100">
            {metrics.workHours} ч
          </span>
          <p className="text-[10px] text-zinc-400">Суммарное фактически замерянное время</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-5 shadow-premium space-y-1 card-hover">
          <div className="flex items-center justify-between text-zinc-400 mb-1">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
            </div>
            <span className="text-[10px] font-semibold text-zinc-500 uppercase">Качество дней</span>
          </div>
          <span className="text-2xl font-bold font-display text-zinc-800 dark:text-zinc-100">
            {metrics.averageRating}
          </span>
          <p className="text-[10px] text-zinc-400">Средняя оценка удовлетворенности по вечерам</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-5 shadow-premium space-y-1 card-hover">
          <div className="flex items-center justify-between text-zinc-400 mb-1">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center">
              <Flame className="w-5 h-5 text-amber-500" />
            </div>
            <span className="text-[10px] font-semibold text-zinc-500 uppercase">Постоянство</span>
          </div>
          <span className="text-2xl font-bold font-display text-zinc-800 dark:text-zinc-100">
            {metrics.maxStreak} дн.
          </span>
          <p className="text-[10px] text-zinc-400">Максимальная серия выполнения привычек</p>
        </div>
      </div>

      {/* Main Charts Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Tasks per day last 7 days */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-5 shadow-premium space-y-4">
          <h3 className="text-sm font-semibold tracking-tight text-zinc-800 dark:text-zinc-200">Выполненные задачи (Последние 7 дней)</h3>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={last7DaysTasksData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#888' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#888' }} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
                <Bar dataKey="Задачи" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Tasks categories Pie Chart */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-5 shadow-premium space-y-4">
          <h3 className="text-sm font-semibold tracking-tight text-zinc-800 dark:text-zinc-200">Распределение по категориям</h3>
          {categoryData.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-xs text-zinc-400">
              Нет данных для графика
            </div>
          ) : (
            <div className="h-[200px] w-full flex flex-col justify-center">
              <ResponsiveContainer width="100%" height="90%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px] font-semibold text-zinc-500">
                {categoryData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span>{entry.name} ({entry.value})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Line: Rating Trend over time */}
        <div className="lg:col-span-3 bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-5 shadow-premium space-y-4">
          <h3 className="text-sm font-semibold tracking-tight text-zinc-800 dark:text-zinc-200">Тренд удовлетворенности днями</h3>
          {ratingTrendData.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-xs text-zinc-400">
              Запишите оценки дня в течение нескольких дней для построения графика тренда.
            </div>
          ) : (
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={ratingTrendData} margin={{ top: 5, right: 15, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#888' }} tickLine={false} />
                  <YAxis domain={[1, 10]} tick={{ fontSize: 10, fill: '#888' }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                  />
                  <Line type="monotone" dataKey="Оценка" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 1 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* GitHub Contribution Grid (Last 30 Days) */}
        <div className="lg:col-span-3 bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-5 shadow-premium space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold tracking-tight text-zinc-800 dark:text-zinc-200">Сетка активности Aura (Последние 30 дней)</h3>
            <span className="text-[10px] text-zinc-400 font-medium">Показывает завершенные задачи и привычки</span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap pt-2">
            {last30Days.map(day => {
              // Find completed tasks on that day
              const tasksDone = tasks.filter(t => {
                if (t.status !== 'completed' && t.status !== 'archived') return false;
                return t.completedAt && t.completedAt.startsWith(day);
              }).length;

              // Find habits done on that day
              const habitsDone = habits.filter(h => h.history.includes(day)).length;

              const totalActivities = tasksDone + habitsDone;

              let cellColor = 'bg-zinc-100 dark:bg-zinc-800'; // level 0
              if (totalActivities >= 1 && totalActivities <= 2) cellColor = 'bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700'; // level 1
              if (totalActivities >= 3 && totalActivities <= 4) cellColor = 'bg-indigo-300 dark:bg-indigo-800 text-indigo-900 dark:text-indigo-200'; // level 2
              if (totalActivities >= 5) cellColor = 'bg-indigo-600 dark:bg-indigo-500 text-white'; // level 3

              return (
                <div
                  key={day}
                  className={`w-6 h-6 rounded flex items-center justify-center text-[8px] font-bold cursor-help relative group ${cellColor}`}
                >
                  <span className="absolute bottom-full mb-1 bg-zinc-950 text-white text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-10">
                    {new Date(day).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}: {totalActivities} активн.
                  </span>
                  {totalActivities > 0 ? totalActivities : ''}
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
