import React, { useState } from 'react';
import { Plus, Target, CheckCircle2, Calendar, Star, Trash2, Edit3, ArrowRight } from 'lucide-react';
import { Goal, Task } from '../types';

interface GoalsSectionProps {
  goals: Goal[];
  tasks: Task[];
  onAddGoal: (goal: Omit<Goal, 'id' | 'createdAt'>) => void;
  onUpdateGoal: (id: string, updates: Partial<Goal>) => void;
  onDeleteGoal: (id: string) => void;
}

export default function GoalsSection({
  goals,
  tasks,
  onAddGoal,
  onUpdateGoal,
  onDeleteGoal
}: GoalsSectionProps) {
  const [showModal, setShowModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  // Form states
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formTargetDate, setFormTargetDate] = useState('');
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);

  const openAddModal = () => {
    setEditingGoal(null);
    setFormTitle('');
    setFormDesc('');
    setFormTargetDate(new Date().toISOString().split('T')[0]);
    setSelectedTaskIds([]);
    setShowModal(true);
  };

  const openEditModal = (goal: Goal) => {
    setEditingGoal(goal);
    setFormTitle(goal.title);
    setFormDesc(goal.description || '');
    setFormTargetDate(goal.targetDate || '');
    setSelectedTaskIds(goal.taskIds || []);
    setShowModal(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    const payload = {
      title: formTitle,
      description: formDesc,
      targetDate: formTargetDate || undefined,
      taskIds: selectedTaskIds,
      isFavorite: editingGoal ? editingGoal.isFavorite : false
    };

    if (editingGoal) {
      onUpdateGoal(editingGoal.id, payload);
    } else {
      onAddGoal(payload);
    }
    setShowModal(false);
  };

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds(prev => 
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
    );
  };

  return (
    <div id="goals-section" className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold font-display tracking-tight text-zinc-900 dark:text-zinc-50">Цели и проекты</h2>
          <p className="text-sm text-zinc-500">Ставьте глобальные ориентиры, объединяйте под ними задачи и наблюдайте за своим прогрессом.</p>
        </div>
        <button
          onClick={openAddModal}
          className="px-4 py-2.5 bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 text-sm font-medium rounded-xl hover:opacity-90 active:scale-95 transition-all cursor-pointer flex items-center gap-2 shadow-premium"
        >
          <Plus className="w-4 h-4" /> Добавить цель
        </button>
      </div>

      {/* Goals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {goals.length === 0 ? (
          <div className="col-span-full py-16 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900">
            <Target className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Целей пока нет</p>
            <p className="text-xs text-zinc-400 mt-1">Добавьте глобальную цель и свяжите её с сегодняшними задачами.</p>
          </div>
        ) : (
          goals.map(goal => {
            // Find linked tasks
            const linkedTasks = tasks.filter(t => goal.taskIds.includes(t.id));
            const total = linkedTasks.length;
            const completed = linkedTasks.filter(t => t.status === 'completed').length;
            const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

            return (
              <div
                key={goal.id}
                className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md border border-zinc-200/50 dark:border-zinc-800/50 rounded-xl p-6 shadow-premium space-y-5 flex flex-col justify-between hover:bg-white/80 dark:hover:bg-zinc-900/80 hover:border-zinc-300 dark:hover:border-zinc-700/60 transition-all"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <Target className="w-5 h-5 text-zinc-400 dark:text-zinc-500" />
                      <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-100 tracking-tight leading-snug">
                        {goal.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onUpdateGoal(goal.id, { isFavorite: !goal.isFavorite })}
                        className={`p-1.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer ${
                          goal.isFavorite ? 'text-amber-400' : 'text-zinc-300 hover:text-zinc-500'
                        }`}
                      >
                        <Star className={`w-4 h-4 ${goal.isFavorite ? 'fill-current' : ''}`} />
                      </button>
                      <button
                        onClick={() => openEditModal(goal)}
                        className="p-1.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDeleteGoal(goal.id)}
                        className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {goal.description && (
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 leading-relaxed">
                      {goal.description}
                    </p>
                  )}
                </div>

                {/* Progress Indicators */}
                <div className="space-y-4 pt-2 border-t border-zinc-100 dark:border-zinc-850/30">
                  <div className="flex items-center justify-between text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      Прогресс выполнения
                    </span>
                    <span>{pct}% ({completed}/{total} задач)</span>
                  </div>

                  {/* Progress Line */}
                  <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-zinc-900 dark:bg-zinc-50 h-full transition-all duration-500 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {/* Details metadata row */}
                  <div className="flex items-center justify-between text-[11px] font-medium text-zinc-400">
                    {goal.targetDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                        Целевая дата: {new Date(goal.targetDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                    <span>Задач в проекте: {total}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Goal Form Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 max-w-lg w-full p-6 shadow-premium-dark space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold tracking-tight font-display text-zinc-900 dark:text-zinc-100">
                {editingGoal ? 'Редактировать цель' : 'Создать цель'}
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              {/* Title */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Название цели *</label>
                <input
                  type="text"
                  required
                  placeholder="Стать Senior Full Stack, Запустить PWA приложение..."
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-400 text-zinc-800 dark:text-zinc-200"
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Описание цели</label>
                <textarea
                  rows={2}
                  placeholder="Детализированное описание шагов, важности или метрик успеха этой цели..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-400 text-zinc-800 dark:text-zinc-200"
                />
              </div>

              {/* Target Date */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Целевая дата дедлайна</label>
                <input
                  type="date"
                  value={formTargetDate}
                  onChange={(e) => setFormTargetDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-400 text-zinc-800 dark:text-zinc-200"
                />
              </div>

              {/* Link tasks checkbox selection */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">Связать задачи с этой целью</label>
                <div className="max-h-40 overflow-y-auto border border-zinc-200 dark:border-zinc-800 rounded-lg p-2 bg-zinc-50 dark:bg-zinc-950 space-y-1.5">
                  {tasks.length === 0 ? (
                    <p className="text-xs text-zinc-400 py-4 text-center">Нет активных задач для связывания.</p>
                  ) : (
                    tasks.map(task => (
                      <label 
                        key={task.id} 
                        className="flex items-center gap-2.5 p-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer text-xs font-medium text-zinc-700 dark:text-zinc-300 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTaskIds.includes(task.id)}
                          onChange={() => toggleTaskSelection(task.id)}
                          className="w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
                        />
                        <span className="truncate">{task.title}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-950 transition-colors cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 rounded-lg text-sm font-medium hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                >
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
