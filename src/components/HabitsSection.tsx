import React, { useState } from 'react';
import { Plus, Flame, Check, Trash2, Calendar, Star, Sparkles, Award, TrendingUp, Zap, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Habit } from '../types';

interface HabitsSectionProps {
  habits: Habit[];
  onAddHabit: (title: string, frequency: 'daily' | 'weekly') => void;
  onToggleHabitDay: (id: string, dateStr: string) => void;
  onDeleteHabit: (id: string) => void;
}

export default function HabitsSection({
  habits,
  onAddHabit,
  onToggleHabitDay,
  onDeleteHabit
}: HabitsSectionProps) {
  const [showModal, setShowModal] = useState(false);
  const [newHabitTitle, setNewHabitTitle] = useState('');
  const [newHabitFreq, setNewHabitFreq] = useState<'daily' | 'weekly'>('daily');

  const todayStr = new Date().toISOString().split('T')[0];

  // Generate last 15 days strings for activity calendars
  const last15Days = Array.from({ length: 15 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (14 - i));
    return d.toISOString().split('T')[0];
  });

  const handleCreateHabit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabitTitle.trim()) return;
    onAddHabit(newHabitTitle, newHabitFreq);
    setNewHabitTitle('');
    setShowModal(false);
  };

  const getDayLetter = (dateStr: string) => {
    const d = new Date(dateStr);
    const options: Intl.DateTimeFormatOptions = { weekday: 'short' };
    return d.toLocaleDateString('ru-RU', options).slice(0, 2);
  };

  return (
    <div id="habits-section" className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-zinc-50 to-zinc-100/50 dark:from-zinc-900/40 dark:to-zinc-900/10 p-6 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/40">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-amber-500/10 rounded-lg text-amber-600 dark:text-amber-400">
              <Zap className="w-5 h-5 animate-pulse" />
            </span>
            <h2 className="text-2xl font-bold font-display tracking-tight text-zinc-900 dark:text-zinc-50">Трекер Привычек</h2>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xl">
            Формируйте полезную рутину день за днем. Накапливайте серии дней и задействуйте визуальный календарь для закрепления привычек.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="sm:self-center px-4 py-2.5 bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-900 text-sm font-semibold rounded-xl hover:opacity-90 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm"
        >
          <Plus className="w-4 h-4" /> Добавить привычку
        </button>
      </div>

      {/* Habits Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AnimatePresence mode="popLayout">
          {habits.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="col-span-full py-20 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900/60 p-8"
            >
              <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center mx-auto mb-4">
                <Flame className="w-6 h-6 text-amber-500 animate-pulse" />
              </div>
              <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-100 font-display">Полезных привычек пока нет</h3>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 max-w-sm mx-auto mt-2 leading-relaxed">
                Запланируйте первое регулярное действие (например, стакан воды по утрам или 15 минут чтения) и начните свой путь к осознанности.
              </p>
              <button
                onClick={() => setShowModal(true)}
                className="mt-5 px-4 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold rounded-lg transition-colors"
              >
                Создать первую привычку
              </button>
            </motion.div>
          ) : (
            habits.map((habit, index) => {
              const isDoneToday = habit.history.includes(todayStr);
              const totalCompletions = habit.history.length;
              
              // Calculate adherence rate based on last 15 days
              const completionsLast15 = last15Days.filter(d => habit.history.includes(d)).length;
              const completionRate = Math.round((completionsLast15 / 15) * 100);

              return (
                <motion.div
                  key={habit.id}
                  layout
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.25, delay: index * 0.04 }}
                  className="bg-gradient-to-b from-white to-zinc-50/20 dark:from-zinc-900 dark:to-zinc-900/40 border border-zinc-200/60 dark:border-zinc-800/60 rounded-2xl p-5 shadow-premium space-y-4 flex flex-col justify-between hover:border-zinc-300 dark:hover:border-zinc-700/80 transition-all group relative overflow-hidden"
                >
                  {/* Subtle hover gradient indicator */}
                  <div className="absolute top-0 left-0 h-[2px] w-0 bg-gradient-to-r from-amber-400 to-amber-500 group-hover:w-full transition-all duration-300" />

                  {/* Header Area */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {/* Interactive dynamic glow icon container */}
                      <div className={`p-2.5 rounded-xl transition-colors ${
                        isDoneToday 
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400' 
                          : 'bg-amber-500/10 text-amber-500 dark:bg-amber-500/5 dark:text-amber-400'
                      }`}>
                        <Flame className={`w-5 h-5 ${isDoneToday ? 'animate-bounce' : 'animate-pulse'}`} />
                      </div>

                      <div className="space-y-0.5">
                        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 tracking-tight group-hover:text-amber-500 transition-colors">
                          {habit.title}
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {habit.frequency === 'daily' ? 'Ежедневно' : 'Раз в неделю'}
                          </span>
                          <span>•</span>
                          <span>Выполнено: {totalCompletions}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Performant tactile complete button */}
                      <button
                        onClick={() => onToggleHabitDay(habit.id, todayStr)}
                        className={`h-8 px-3 rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center gap-1 ${
                          isDoneToday
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30 shadow-sm shadow-emerald-500/5'
                            : 'bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:hover:bg-zinc-100 dark:text-zinc-900 shadow-sm hover:scale-[1.02] active:scale-95'
                        }`}
                      >
                        {isDoneToday ? (
                          <>
                            <Check className="w-3.5 h-3.5 stroke-[3] text-emerald-600 dark:text-emerald-400" /> 
                            <span>Готово</span>
                          </>
                        ) : (
                          <span>Выполнить</span>
                        )}
                      </button>

                      <button
                        onClick={() => onDeleteHabit(habit.id)}
                        className="p-2 text-zinc-300 hover:text-rose-500 dark:text-zinc-600 dark:hover:text-rose-400 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors"
                        title="Удалить привычку"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Micro metrics with improved readability and sleek layouts */}
                  <div className="grid grid-cols-2 gap-3 bg-zinc-50/50 dark:bg-zinc-950/40 p-3 rounded-xl border border-zinc-100 dark:border-zinc-850/60">
                    <div className="space-y-0.5 text-center border-r border-zinc-200/60 dark:border-zinc-800/60">
                      <span className="text-[9px] text-zinc-400 dark:text-zinc-500 block uppercase font-display tracking-wider font-semibold">Текущая серия</span>
                      <span className="text-sm font-bold text-zinc-800 dark:text-zinc-100 font-mono flex items-center justify-center gap-1.5">
                        🔥 {habit.streak} {habit.streak === 1 ? 'день' : habit.streak >= 2 && habit.streak <= 4 ? 'дня' : 'дней'}
                      </span>
                    </div>
                    <div className="space-y-0.5 text-center">
                      <span className="text-[9px] text-zinc-400 dark:text-zinc-500 block uppercase font-display tracking-wider font-semibold">Успешность за 15 дн.</span>
                      <span className="text-sm font-bold text-zinc-800 dark:text-zinc-100 font-mono flex items-center justify-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
                        {completionRate}%
                      </span>
                    </div>
                  </div>

                  {/* Progress Line */}
                  <div className="space-y-1">
                    <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-emerald-400 to-teal-500 dark:from-emerald-500 dark:to-teal-600 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${Math.min(100, Math.max(0, completionRate))}%` }}
                      />
                    </div>
                  </div>

                  {/* Activity Tracker Grid (Mini GitHub Style with smooth roundings) */}
                  <div className="space-y-2 pt-1 border-t border-zinc-100 dark:border-zinc-850/40">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-bold">15-дневная лента активности</span>
                      <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium">
                        Выполнено в {completionsLast15} из 15 дней
                      </span>
                    </div>
                    <div className="overflow-x-auto w-full -mx-1 px-1 py-1 scrollbar-none">
                      <div className="grid grid-cols-[repeat(15,minmax(0,1fr))] gap-1 md:gap-1.5 min-w-[420px] md:min-w-0">
                        {last15Days.map(day => {
                          const completedOnDay = habit.history.includes(day);
                          const isToday = day === todayStr;
                          return (
                            <div
                              key={day}
                              onClick={() => onToggleHabitDay(habit.id, day)}
                              className={`aspect-square rounded-md flex flex-col items-center justify-center relative cursor-pointer group/dot transition-all duration-200 hover:scale-110 ${
                                completedOnDay
                                  ? 'bg-gradient-to-br from-emerald-400 to-teal-500 dark:from-emerald-500 dark:to-teal-600 shadow-sm shadow-emerald-500/10'
                                  : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700/80'
                              } ${isToday ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900' : ''}`}
                            >
                              {/* Day letter tooltip with beautiful styles */}
                              <span className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-[9px] px-2 py-1 rounded-lg opacity-0 group-hover/dot:opacity-100 pointer-events-none transition-opacity duration-150 whitespace-nowrap shadow-md z-20">
                                {new Date(day).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}: {completedOnDay ? 'Выполнено' : 'Пропущено'}
                              </span>
                              <span className={`text-[8px] font-bold tracking-tight select-none pointer-events-none ${
                                completedOnDay ? 'text-white dark:text-zinc-900' : 'text-zinc-400 dark:text-zinc-500'
                              }`}>
                                {getDayLetter(day)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* Habit Creation Dialog */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 max-w-sm w-full p-6 shadow-premium-dark space-y-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold tracking-tight font-display text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Создание привычки</span>
                </h3>
                <button 
                  onClick={() => setShowModal(false)}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg cursor-pointer font-bold"
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleCreateHabit} className="space-y-4">
                {/* Title */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">Название действия</label>
                  <input
                    type="text"
                    required
                    placeholder="Медитация, Чтение книг, Спорт, Сон до 23:00..."
                    value={newHabitTitle}
                    onChange={(e) => setNewHabitTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-400/50 dark:focus:ring-zinc-800/50 text-zinc-800 dark:text-zinc-200 transition-all"
                  />
                </div>

                {/* Frequency selection */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">Регулярность</label>
                  <select
                    value={newHabitFreq}
                    onChange={(e: any) => setNewHabitFreq(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-400/50 dark:focus:ring-zinc-800/50 text-zinc-800 dark:text-zinc-200 transition-all cursor-pointer"
                  >
                    <option value="daily">Каждый день (Ежедневно)</option>
                    <option value="weekly">Раз в неделю (Еженедельно)</option>
                  </select>
                </div>

                {/* Actions */}
                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl text-sm font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-950 transition-colors cursor-pointer"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-900 rounded-xl text-sm font-semibold hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                  >
                    Создать
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
