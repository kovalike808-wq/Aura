import { useState } from 'react';
import { ChevronLeft, ChevronRight, CheckSquare, Target, Flame, Award, Calendar } from 'lucide-react';
import { Task, Goal, Habit, Note, Achievement } from '../types';

interface CalendarSectionProps {
  tasks: Task[];
  goals: Goal[];
  habits: Habit[];
  achievements: Achievement[];
}

export default function CalendarSection({
  tasks,
  goals,
  habits,
  achievements
}: CalendarSectionProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDayStr, setSelectedDayStr] = useState<string>(new Date().toISOString().split('T')[0]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = currentDate.toLocaleString('ru-RU', { month: 'long', year: 'numeric' });

  // Get days of the month
  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayIndex = (y: number, m: number) => {
    const idx = new Date(y, m, 1).getDay();
    return idx === 0 ? 6 : idx - 1; // standard Mon-Sun index
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDayIndex = getFirstDayIndex(year, month);

  const prevMonthDays = getDaysInMonth(year, month - 1);

  const totalGridCells = 42; // standard 6 rows
  const gridCells: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

  // Prev month filler
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, prevMonthDays - i);
    gridCells.push({
      dateStr: d.toISOString().split('T')[0],
      dayNum: prevMonthDays - i,
      isCurrentMonth: false
    });
  }

  // Current month
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(year, month, i);
    gridCells.push({
      dateStr: d.toISOString().split('T')[0],
      dayNum: i,
      isCurrentMonth: true
    });
  }

  // Next month filler
  let nextMonthDay = 1;
  while (gridCells.length < totalGridCells) {
    const d = new Date(year, month + 1, nextMonthDay);
    gridCells.push({
      dateStr: d.toISOString().split('T')[0],
      dayNum: nextMonthDay,
      isCurrentMonth: false
    });
    nextMonthDay++;
  }

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Find daily occurrences
  const getDayOccurrences = (dateStr: string) => {
    const dayTasks = tasks.filter(t => t.dueDate === dateStr || (t.completedAt && t.completedAt.startsWith(dateStr)));
    const dayHabits = habits.filter(h => h.history.includes(dateStr));
    const dayAchievements = achievements.filter(a => a.unlocked && a.unlockedAt && a.unlockedAt.startsWith(dateStr));
    
    return {
      dayTasks,
      dayHabits,
      dayAchievements
    };
  };

  const { dayTasks, dayHabits, dayAchievements } = getDayOccurrences(selectedDayStr);

  return (
    <div id="calendar-section" className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold font-display tracking-tight text-zinc-900 dark:text-zinc-50">Интерактивный Календарь</h2>
        <p className="text-sm text-zinc-500">Просматривайте хронологию ваших дел, привычек и достижений по выбранным датам.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Monthly Grid Calendar */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-2xl p-5 shadow-premium space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold tracking-tight text-zinc-800 dark:text-zinc-200 uppercase font-display">{monthName}</h3>
            <div className="flex gap-1">
              <button onClick={handlePrevMonth} className="p-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg cursor-pointer">
                <ChevronLeft className="w-4 h-4 text-zinc-500" />
              </button>
              <button onClick={handleNextMonth} className="p-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg cursor-pointer">
                <ChevronRight className="w-4 h-4 text-zinc-500" />
              </button>
            </div>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
            {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => (
              <div key={day} className="py-1">{day}</div>
            ))}
          </div>

          {/* Cells */}
          <div className="grid grid-cols-7 gap-1">
            {gridCells.map((cell, idx) => {
              const { dayTasks, dayHabits, dayAchievements } = getDayOccurrences(cell.dateStr);
              const totalEvents = dayTasks.length + dayHabits.length + dayAchievements.length;
              const isSelected = selectedDayStr === cell.dateStr;

              return (
                <div
                  key={`${cell.dateStr}-${idx}`}
                  onClick={() => setSelectedDayStr(cell.dateStr)}
                  className={`aspect-square rounded-xl p-1 flex flex-col justify-between cursor-pointer border transition-all ${
                    isSelected
                      ? 'bg-zinc-900 border-zinc-900 text-white dark:bg-zinc-50 dark:border-zinc-50 dark:text-zinc-900 shadow-premium'
                      : cell.isCurrentMonth
                      ? 'bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-950 dark:hover:bg-zinc-850 border-zinc-200/30 dark:border-zinc-850/30'
                      : 'bg-transparent text-zinc-300 dark:text-zinc-700 border-transparent cursor-default pointer-events-none'
                  }`}
                >
                  <span className="text-xs font-bold leading-none">{cell.dayNum}</span>
                  
                  {/* Indicator Dots */}
                  <div className="flex gap-0.5 justify-center">
                    {dayTasks.length > 0 && (
                      <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white dark:bg-zinc-900' : 'bg-indigo-500'}`} />
                    )}
                    {dayHabits.length > 0 && (
                      <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white dark:bg-zinc-900' : 'bg-amber-500'}`} />
                    )}
                    {dayAchievements.length > 0 && (
                      <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white dark:bg-zinc-900' : 'bg-emerald-500'}`} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Selected Day Details */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-2xl p-6 shadow-premium space-y-5">
          <div className="border-b border-zinc-100 dark:border-zinc-850 pb-3">
            <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider font-display">Хронология на день</span>
            <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-100 tracking-tight flex items-center gap-1.5 mt-0.5">
              <Calendar className="w-4.5 h-4.5 text-zinc-400" />
              {new Date(selectedDayStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
            </h3>
          </div>

          <div className="space-y-5 max-h-[400px] overflow-y-auto pr-1">
            {/* Tasks section */}
            <div className="space-y-2">
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Задачи дня ({dayTasks.length})</span>
              {dayTasks.length === 0 ? (
                <p className="text-xs text-zinc-400 italic">Задачи не зафиксированы.</p>
              ) : (
                dayTasks.map(t => (
                  <div key={t.id} className="flex items-start gap-2 p-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-850 rounded-lg">
                    <CheckSquare className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
                    <div>
                      <span className={`text-xs font-bold leading-tight block ${t.status === 'completed' ? 'line-through text-zinc-400' : 'text-zinc-700 dark:text-zinc-300'}`}>
                        {t.title}
                      </span>
                      <span className="text-[10px] text-zinc-400">{t.category} • План: {t.estimatedTime} мин</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Habits section */}
            <div className="space-y-2">
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Привычки дня ({dayHabits.length})</span>
              {dayHabits.length === 0 ? (
                <p className="text-xs text-zinc-400 italic">Привычки не выполнялись.</p>
              ) : (
                dayHabits.map(h => (
                  <div key={h.id} className="flex items-center gap-2 p-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-850 rounded-lg">
                    <Flame className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      {h.title} <span className="text-[10px] text-zinc-400 font-normal">(серия {h.streak} дн.)</span>
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Achievements section */}
            <div className="space-y-2">
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Награды дня ({dayAchievements.length})</span>
              {dayAchievements.length === 0 ? (
                <p className="text-xs text-zinc-400 italic">Достижений в этот день нет.</p>
              ) : (
                dayAchievements.map(a => (
                  <div key={a.id} className="flex items-center gap-2 p-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-850 rounded-lg">
                    <Award className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{a.title}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
