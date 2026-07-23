import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Search, Filter, ArrowUpDown, Trash2, Edit3, Star, Play, Pause, 
  Square, CheckCircle2, Circle, Clock, Tag, AlertTriangle, Archive, RefreshCw, Calendar, Settings
} from 'lucide-react';
import { Task, Goal } from '../types';
import { todayStr, dateToStr } from '../constants';

interface TasksSectionProps {
  tasks: Task[];
  goals?: Goal[];
  onAddTask: (task: Omit<Task, 'id' | 'createdAt' | 'status'>) => void;
  onAddTasksBatch?: (taskFieldsList: Omit<Task, 'id' | 'createdAt' | 'status'>[], linkedGoalId?: string) => string[];
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onDeleteTask: (id: string) => void;
  onClearArchived: () => void;
  taskCategories?: string[];
  onUpdateCategories: (categories: string[]) => void;
}

const generateTaskDates = (
  startDateStr: string,
  endDateStr: string,
  frequency: 'daily' | 'weekdays' | 'weekends' | 'custom',
  customDays: number[]
): string[] => {
  const dates: string[] = [];
  if (!startDateStr || !endDateStr) return dates;
  
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return dates;

  let loopSafety = 0;
  const current = new Date(start);

  while (current <= end && loopSafety < 366) {
    loopSafety++;
    const dayOfWeek = current.getDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
    
    let include = false;
    if (frequency === 'daily') {
      include = true;
    } else if (frequency === 'weekdays') {
      include = dayOfWeek >= 1 && dayOfWeek <= 5;
    } else if (frequency === 'weekends') {
      include = dayOfWeek === 0 || dayOfWeek === 6;
    } else if (frequency === 'custom') {
      include = customDays.includes(dayOfWeek);
    }

    if (include) {
      const dateStr = dateToStr(current);
      dates.push(dateStr);
    }

    current.setDate(current.getDate() + 1);
  }

  return dates;
};

const formatRussianDateShort = (dateStr: string) => {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}.${parts[1]}`; // DD.MM
};

export default function TasksSection({
  tasks,
  goals = [],
  onAddTask,
  onAddTasksBatch,
  onUpdateTask,
  onDeleteTask,
  onClearArchived,
  taskCategories = ['Дизайн', 'Разработка', 'Здоровье', 'Развитие', 'Быт', 'Разное'],
  onUpdateCategories
}: TasksSectionProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Все');
  const [selectedPriority, setSelectedPriority] = useState<'all' | 'low' | 'medium' | 'high'>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'pending' | 'completed' | 'archived'>('pending');
  const [sortBy, setSortBy] = useState<'createdAt' | 'priority' | 'estimatedTime'>('createdAt');
  
  // Create / Edit modal state
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  
  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formCategory, setFormCategory] = useState('Разное');
  const [formPriority, setFormPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [formEstTime, setFormEstTime] = useState(30);
  const [formDueDate, setFormDueDate] = useState('');

  // Batch states
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchTitle, setBatchTitle] = useState('');
  const [batchDesc, setBatchDesc] = useState('');
  const [batchCategory, setBatchCategory] = useState('Здоровье');
  const [batchPriority, setBatchPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [batchEstTime, setBatchEstTime] = useState(30);
  const [batchStartDate, setBatchStartDate] = useState('');
  const [batchEndDate, setBatchEndDate] = useState('');
  const [batchFrequency, setBatchFrequency] = useState<'daily' | 'weekdays' | 'weekends' | 'custom'>('daily');
  const [batchCustomDays, setBatchCustomDays] = useState<number[]>([1, 3, 5]); // Mon, Wed, Fri by default
  const [linkedGoalId, setLinkedGoalId] = useState<string>('');

  const weekdaysList = [
    { label: 'Пн', value: 1 },
    { label: 'Вт', value: 2 },
    { label: 'Ср', value: 3 },
    { label: 'Чт', value: 4 },
    { label: 'Пт', value: 5 },
    { label: 'Сб', value: 6 },
    { label: 'Вс', value: 0 }
  ];

  // Active Timer state
  const [activeTimerTaskId, setActiveTimerTaskId] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Category manager state
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCategoryInput.trim();
    if (!trimmed) return;
    if (taskCategories.includes(trimmed)) return;
    onUpdateCategories([...taskCategories, trimmed]);
    setNewCategoryInput('');
  };

  const handleRemoveCategory = (cat: string) => {
    const updated = taskCategories.filter(c => c !== cat);
    onUpdateCategories(updated);
    const fallback = updated[0] || 'Разное';
    tasks.forEach(t => {
      if (t.category === cat) {
        onUpdateTask(t.id, { category: fallback });
      }
    });
    if (selectedCategory === cat) {
      setSelectedCategory('Все');
    }
  };

  // Handle active timer logic
  useEffect(() => {
    if (isTimerRunning && activeTimerTaskId) {
      timerIntervalRef.current = setInterval(() => {
        setTimerSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isTimerRunning, activeTimerTaskId]);

  const startTimer = (taskId: string) => {
    if (activeTimerTaskId && activeTimerTaskId !== taskId) {
      // Save prev timer
      stopAndSaveTimer();
    }
    setActiveTimerTaskId(taskId);
    setTimerSeconds(0);
    setIsTimerRunning(true);
  };

  const pauseTimer = () => {
    setIsTimerRunning(false);
  };

  const resumeTimer = () => {
    setIsTimerRunning(true);
  };

  const stopAndSaveTimer = () => {
    if (!activeTimerTaskId) return;
    const minutesEarned = Math.round(timerSeconds / 60) || 1;
    const task = tasks.find(t => t.id === activeTimerTaskId);
    if (task) {
      onUpdateTask(activeTimerTaskId, {
        actualTime: (task.actualTime || 0) + minutesEarned
      });
    }
    setIsTimerRunning(false);
    setActiveTimerTaskId(null);
    setTimerSeconds(0);
  };

  const openAddModal = () => {
    setEditingTask(null);
    setFormTitle('');
    setFormDesc('');
    setFormCategory(taskCategories[0] || 'Разное');
    setFormPriority('medium');
    setFormEstTime(30);
    const todayDateStr = todayStr();
    setFormDueDate(todayDateStr);

    // Reset batch states
    setIsBatchMode(false);
    setBatchTitle('');
    setBatchDesc('');
    setBatchCategory(taskCategories[0] || 'Разное');
    setBatchPriority('medium');
    setBatchEstTime(30);
    setBatchStartDate(todayDateStr);
    
    // Default end date is 30 days from now
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    setBatchEndDate(dateToStr(futureDate));
    setBatchFrequency('daily');
    setBatchCustomDays([1, 3, 5]);
    setLinkedGoalId('');

    setShowModal(true);
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setFormTitle(task.title);
    setFormDesc(task.description || '');
    setFormCategory(task.category);
    setFormPriority(task.priority);
    setFormEstTime(task.estimatedTime);
    setFormDueDate(task.dueDate || '');
    setIsBatchMode(false);
    setShowModal(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingTask && isBatchMode) {
      if (!batchTitle.trim() || !onAddTasksBatch) return;

      const datesToGenerate = generateTaskDates(batchStartDate, batchEndDate, batchFrequency, batchCustomDays);
      const batchTasksPayload = datesToGenerate.map(dateStr => ({
        title: `${batchTitle.trim()} (${formatRussianDateShort(dateStr)})`,
        description: batchDesc.trim() || undefined,
        category: batchCategory,
        priority: batchPriority,
        estimatedTime: Number(batchEstTime),
        actualTime: 0,
        isFavorite: false,
        dueDate: dateStr
      }));

      onAddTasksBatch(batchTasksPayload, linkedGoalId || undefined);
    } else {
      if (!formTitle.trim()) return;

      const payload = {
        title: formTitle,
        description: formDesc,
        category: formCategory,
        priority: formPriority,
        estimatedTime: Number(formEstTime),
        actualTime: editingTask ? editingTask.actualTime : 0,
        isFavorite: editingTask ? editingTask.isFavorite : false,
        dueDate: formDueDate || undefined
      };

      if (editingTask) {
        onUpdateTask(editingTask.id, payload);
      } else {
        onAddTask(payload);
      }
    }

    setShowModal(false);
  };

  const toggleCustomDay = (dayValue: number) => {
    setBatchCustomDays(prev =>
      prev.includes(dayValue) ? prev.filter(d => d !== dayValue) : [...prev, dayValue]
    );
  };

  // Filter & Sort tasks
  const filteredTasks = tasks.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase()) || 
                          (t.description && t.description.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = selectedCategory === 'Все' || t.category === selectedCategory;
    const matchesPriority = selectedPriority === 'all' || t.priority === selectedPriority;
    const matchesStatus = selectedStatus === 'all' || t.status === selectedStatus;
    return matchesSearch && matchesCategory && matchesPriority && matchesStatus;
  }).sort((a, b) => {
    if (sortBy === 'createdAt') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    if (sortBy === 'estimatedTime') {
      return b.estimatedTime - a.estimatedTime;
    }
    if (sortBy === 'priority') {
      const priorityWeight = { high: 3, medium: 2, low: 1 };
      return priorityWeight[b.priority] - priorityWeight[a.priority];
    }
    return 0;
  });

  const getPriorityColor = (p: 'low' | 'medium' | 'high') => {
    if (p === 'high') return 'text-rose-500 bg-rose-50 border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/30';
    if (p === 'medium') return 'text-amber-500 bg-amber-50 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/30';
    return 'text-emerald-500 bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/30';
  };

  const formatTimerTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs > 0 ? `${hrs}:` : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div id="tasks-section" className="space-y-6">
      {/* Active Timer Dashboard Overlay */}
      {activeTimerTaskId && (
        <div id="active-timer-overlay" className="fixed bottom-6 right-6 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-5 py-4 rounded-xl shadow-premium-dark flex items-center gap-4 z-50 animate-bounce">
          <div className="space-y-0.5">
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-semibold block">Активный Таймер</span>
            <span className="text-sm font-semibold max-w-[150px] truncate block">
              {tasks.find(t => t.id === activeTimerTaskId)?.title}
            </span>
          </div>
          <div className="text-xl font-mono font-bold text-indigo-400 dark:text-indigo-600">
            {formatTimerTime(timerSeconds)}
          </div>
          <div className="flex items-center gap-1.5 border-l border-zinc-800 dark:border-zinc-200 pl-3">
            {isTimerRunning ? (
              <button onClick={pauseTimer} className="p-1.5 hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-lg cursor-pointer" title="Пауза">
                <Pause className="w-4 h-4 text-white dark:text-zinc-900" />
              </button>
            ) : (
              <button onClick={resumeTimer} className="p-1.5 hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-lg cursor-pointer" title="Продолжить">
                <Play className="w-4 h-4 text-emerald-500" />
              </button>
            )}
            <button onClick={stopAndSaveTimer} className="p-1.5 hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-lg cursor-pointer" title="Завершить и сохранить время">
              <Square className="w-4 h-4 text-rose-500 fill-rose-500" />
            </button>
          </div>
        </div>
      )}

      {/* Title & Add Actions */}
      <div id="tasks-header" className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold font-display tracking-tight text-zinc-900 dark:text-zinc-50">Менеджер Задач</h2>
          <p className="text-sm text-zinc-500">Управляйте вашими ежедневными делами, фиксируйте время работы и группируйте задачи.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            id="add-task-btn"
            onClick={openAddModal}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 text-sm font-medium rounded-xl hover:opacity-90 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-premium"
          >
            <Plus className="w-4 h-4" /> Создать Задачу
          </button>
          {selectedStatus === 'archived' && (
            <button
              onClick={onClearArchived}
              className="px-3 py-2.5 border border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400 text-sm font-medium rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              title="Очистить архив"
            >
              <Trash2 className="w-4 h-4" /> Очистить Архив
            </button>
          )}
        </div>
      </div>

      {/* Filter and Settings Panel */}
      <div id="filters-panel" className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-5 shadow-premium space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search bar */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <input
              id="search-input"
              type="text"
              placeholder="Поиск задач по названию или описанию..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-400 text-zinc-800 dark:text-zinc-200"
            />
          </div>

          {/* Sorters and Status Selects */}
          <div className="flex flex-wrap gap-2 items-center">
            {/* Status Segment */}
            <div className="flex rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-0.5">
              {(['pending', 'completed', 'archived'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setSelectedStatus(st)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                    selectedStatus === st
                      ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                  }`}
                >
                  {st === 'pending' ? 'Активные' : st === 'completed' ? 'Выполненные' : 'Архив'}
                </button>
              ))}
            </div>

            {/* Priority filter */}
            <select
              value={selectedPriority}
              onChange={(e: any) => setSelectedPriority(e.target.value)}
              className="text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 focus:outline-none text-zinc-600 dark:text-zinc-400"
            >
              <option value="all">Любой приоритет</option>
              <option value="high">Высокий приоритет</option>
              <option value="medium">Средний приоритет</option>
              <option value="low">Низкий приоритет</option>
            </select>

            {/* Sorter */}
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 focus:outline-none text-zinc-600 dark:text-zinc-400"
            >
              <option value="createdAt">По дате создания</option>
              <option value="priority">По приоритету</option>
              <option value="estimatedTime">По плановому времени</option>
            </select>
          </div>
        </div>

        {/* Categories Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 dark:border-zinc-800 pt-3">
          <div className="flex flex-wrap gap-1.5 flex-1">
            {['Все', ...taskCategories].map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 text-xs rounded-full border transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-50 dark:text-zinc-900 dark:border-zinc-50'
                    : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-zinc-400 dark:border-zinc-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowCategoryManager(!showCategoryManager)}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer animate-pulse"
          >
            <span>Настройка категорий</span>
          </button>
        </div>

        {showCategoryManager && (
          <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-col gap-3 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Управление вакими категориями</span>
              <button
                onClick={() => setShowCategoryManager(false)}
                className="text-[10px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 font-bold"
              >
                Закрыть
              </button>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {taskCategories.map(cat => (
                <div key={cat} className="flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  <span>{cat}</span>
                  {taskCategories.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveCategory(cat)}
                      className="text-zinc-400 hover:text-rose-500 transition-colors"
                      title={`Удалить категорию "${cat}"`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <form onSubmit={handleAddCategory} className="flex gap-2 max-w-sm">
              <input
                type="text"
                placeholder="Новая категория..."
                value={newCategoryInput}
                onChange={(e) => setNewCategoryInput(e.target.value)}
                className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-400 text-zinc-800 dark:text-zinc-200"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-lg text-xs font-semibold hover:opacity-90 active:scale-95 transition-all cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Добавить
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Tasks List */}
      <div id="tasks-list-container" className="space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="py-16 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900">
            <CheckCircle2 className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Ничего не найдено</p>
            <p className="text-xs text-zinc-400 mt-1">Попробуйте изменить параметры поиска или добавить новую задачу.</p>
          </div>
        ) : (
          filteredTasks.map(task => (
            <div
              key={task.id}
              className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md border border-zinc-200/50 dark:border-zinc-800/50 rounded-xl hover:bg-white/80 dark:hover:bg-zinc-900/80 hover:border-zinc-300 dark:hover:border-zinc-700/60 transition-all shadow-premium gap-4 group"
            >
              <div className="flex items-start gap-3.5 flex-1 min-w-0">
                {/* Complete checkbox */}
                <button
                  onClick={() => {
                    const nextStatus = task.status === 'completed' ? 'pending' : 'completed';
                    onUpdateTask(task.id, { 
                      status: nextStatus,
                      completedAt: nextStatus === 'completed' ? new Date().toISOString() : undefined
                    });
                  }}
                  className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition-all cursor-pointer ${
                    task.status === 'completed'
                      ? 'bg-zinc-900 border-zinc-900 text-white dark:bg-zinc-50 dark:border-zinc-50 dark:text-zinc-900'
                      : 'border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 text-transparent'
                  }`}
                >
                  <Circle className="w-3.5 h-3.5 fill-current" />
                </button>

                {/* Text Info */}
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${getPriorityColor(task.priority)}`}>
                      {task.priority === 'high' ? 'Высокий' : task.priority === 'medium' ? 'Средний' : 'Низкий'}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
                      <Tag className="w-3.5 h-3.5" />
                      {task.category}
                    </span>
                    {task.dueDate && (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
                        <Calendar className="w-3.5 h-3.5" />
                        До: {new Date(task.dueDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                  <h4 className={`text-sm font-semibold tracking-tight transition-all ${
                    task.status === 'completed' ? 'line-through text-zinc-400 dark:text-zinc-500' : 'text-zinc-800 dark:text-zinc-100'
                  }`}>
                    {task.title}
                  </h4>
                  {task.description && (
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 leading-relaxed max-w-2xl">
                      {task.description}
                    </p>
                  )}
                  {/* Time info */}
                  <div className="flex items-center gap-3 text-[10px] font-medium text-zinc-400 pt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-zinc-400" />
                      План: {task.estimatedTime} мин
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-emerald-500" />
                      Факт: {task.actualTime || 0} мин
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions row */}
              <div className="flex items-center justify-end gap-2 w-full sm:w-auto border-t sm:border-t-0 border-zinc-100 dark:border-zinc-800/60 pt-3 sm:pt-0">
                {/* Timer Control (Only if active task) */}
                {task.status === 'pending' && (
                  <>
                    {activeTimerTaskId === task.id ? (
                      isTimerRunning ? (
                        <button
                          onClick={pauseTimer}
                          className="p-2 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/20 dark:hover:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg transition-colors cursor-pointer"
                          title="Пауза таймера"
                        >
                          <Pause className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={resumeTimer}
                          className="p-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:hover:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg transition-colors cursor-pointer"
                          title="Продолжить таймер"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      )
                    ) : (
                      <button
                        onClick={() => startTimer(task.id)}
                        className="p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg transition-all cursor-pointer"
                        title="Запустить таймер выполнения"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                    )}
                  </>
                )}

                {/* Favorite status toggle */}
                <button
                  onClick={() => onUpdateTask(task.id, { isFavorite: !task.isFavorite })}
                  className={`p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer ${
                    task.isFavorite ? 'text-amber-400' : 'text-zinc-300 hover:text-zinc-500'
                  }`}
                  title={task.isFavorite ? 'Убрать из избранного' : 'В избранное'}
                >
                  <Star className={`w-4 h-4 ${task.isFavorite ? 'fill-current' : ''}`} />
                </button>

                {/* Edit & Delete */}
                {task.status !== 'archived' && (
                  <button
                    onClick={() => openEditModal(task)}
                    className="p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                    title="Редактировать задачу"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                )}

                <button
                  onClick={() => onDeleteTask(task.id)}
                  className="p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors cursor-pointer"
                  title="Удалить задачу"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create / Edit Modal Dialog */}
      {showModal && (
        <div id="task-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 max-w-xl w-full p-6 shadow-premium-dark space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/60 pb-3">
              <div className="space-y-0.5">
                <h3 className="text-lg font-semibold tracking-tight font-display text-zinc-900 dark:text-zinc-100">
                  {editingTask ? 'Редактировать Задачу' : 'Создать Задачу'}
                </h3>
                <p className="text-xs text-zinc-400">
                  {editingTask ? 'Внесите изменения в задачу' : 'Добавьте новую задачу вручную или пакетом'}
                </p>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Mode Tab Selector - Only on Task Creation */}
            {!editingTask && (
              <div className="flex bg-zinc-50 dark:bg-zinc-950 p-1 rounded-xl border border-zinc-150 dark:border-zinc-850">
                <button
                  type="button"
                  onClick={() => setIsBatchMode(false)}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    !isBatchMode 
                      ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm border border-zinc-200/50 dark:border-zinc-800/50' 
                      : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400'
                  }`}
                >
                  Одиночная задача
                </button>
                <button
                  type="button"
                  onClick={() => setIsBatchMode(true)}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    isBatchMode 
                      ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm border border-zinc-200/50 dark:border-zinc-800/50' 
                      : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400'
                  }`}
                >
                  Серия задач на период
                </button>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4">
              {/* SINGLE MODE OR EDIT MODE VIEW */}
              {(!isBatchMode || editingTask) ? (
                <>
                  {/* Title */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Название задачи *</label>
                    <input
                      id="modal-task-title-input"
                      type="text"
                      required
                      placeholder="Купить продукты, Написать код..."
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-400 text-zinc-800 dark:text-zinc-200"
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Описание</label>
                    <textarea
                      id="modal-task-desc-input"
                      rows={2}
                      placeholder="Дополнительные детали, ссылки или требования..."
                      value={formDesc}
                      onChange={(e) => setFormDesc(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-400 text-zinc-800 dark:text-zinc-200"
                    />
                  </div>

                  {/* 2x2 grid for configurations */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Category */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Категория</label>
                      <select
                        id="modal-task-category-select"
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-400 text-zinc-800 dark:text-zinc-200"
                      >
                        {taskCategories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    {/* Priority */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Приоритет</label>
                      <select
                        id="modal-task-priority-select"
                        value={formPriority}
                        onChange={(e: any) => setFormPriority(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-400 text-zinc-800 dark:text-zinc-200"
                      >
                        <option value="low">🟢 Низкий</option>
                        <option value="medium">🟡 Средний</option>
                        <option value="high">🔴 Высокий</option>
                      </select>
                    </div>

                    {/* Estimated Time */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Оценка (минут)</label>
                      <input
                        id="modal-task-est-input"
                        type="number"
                        min={1}
                        required
                        value={formEstTime}
                        onChange={(e) => setFormEstTime(Number(e.target.value))}
                        className="w-full px-3.5 py-2 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-400 text-zinc-800 dark:text-zinc-200"
                      />
                    </div>

                    {/* Due Date */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Дедлайн</label>
                      <input
                        id="modal-task-date-input"
                        type="date"
                        value={formDueDate}
                        onChange={(e) => setFormDueDate(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-400 text-zinc-800 dark:text-zinc-200"
                      />
                    </div>
                  </div>
                </>
              ) : (
                /* BATCH MODE VIEW */
                <div className="space-y-4 animate-in fade-in duration-150">
                  {/* Template Title */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Шаблон названия задач *</label>
                    <input
                      type="text"
                      required
                      placeholder="Например: Тренировка, Чтение, Подготовка"
                      value={batchTitle}
                      onChange={(e) => setBatchTitle(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-400 text-zinc-850 dark:text-zinc-200 font-semibold"
                    />
                  </div>

                  {/* Template Description */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Описание регулярных задач</label>
                    <input
                      type="text"
                      placeholder="Например: Ежедневная тренировка по 45 минут"
                      value={batchDesc}
                      onChange={(e) => setBatchDesc(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-400 text-zinc-850 dark:text-zinc-200"
                    />
                  </div>

                  {/* Category & Priority */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Категория</label>
                      <select
                        value={batchCategory}
                        onChange={(e) => setBatchCategory(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-400 text-zinc-850 dark:text-zinc-200"
                      >
                        {taskCategories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Приоритет</label>
                      <select
                        value={batchPriority}
                        onChange={(e: any) => setBatchPriority(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-400 text-zinc-850 dark:text-zinc-200"
                      >
                        <option value="low">🟢 Низкий</option>
                        <option value="medium">🟡 Средний</option>
                        <option value="high">🔴 Высокий</option>
                      </select>
                    </div>
                  </div>

                  {/* Dates: Start & End */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Начало</label>
                      <input
                        type="date"
                        required
                        value={batchStartDate}
                        onChange={(e) => setBatchStartDate(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-400"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Конец</label>
                      <input
                        type="date"
                        required
                        value={batchEndDate}
                        onChange={(e) => setBatchEndDate(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-400"
                      />
                    </div>
                  </div>

                  {/* Frequency Selector */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">Регулярность создания</label>
                    <div className="flex flex-wrap gap-2">
                      {([
                        { label: 'Каждый день', value: 'daily' },
                        { label: 'По будням', value: 'weekdays' },
                        { label: 'По выходным', value: 'weekends' },
                        { label: 'Выбрать дни', value: 'custom' }
                      ] as const).map(freq => (
                        <button
                          key={freq.value}
                          type="button"
                          onClick={() => setBatchFrequency(freq.value)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
                            batchFrequency === freq.value
                              ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-50 dark:text-zinc-900'
                              : 'bg-zinc-50 text-zinc-600 border-zinc-200 dark:bg-zinc-950 dark:text-zinc-400 dark:border-zinc-850 hover:bg-zinc-100'
                          }`}
                        >
                          {freq.label}
                        </button>
                      ))}
                    </div>

                    {batchFrequency === 'custom' && (
                      <div className="p-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-950 flex flex-wrap gap-1.5 mt-2">
                        {weekdaysList.map(day => (
                          <button
                            key={day.value}
                            type="button"
                            onClick={() => toggleCustomDay(day.value)}
                            className={`w-8 h-8 rounded-md text-xs font-bold transition-all border cursor-pointer ${
                              batchCustomDays.includes(day.value)
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white text-zinc-500 border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800'
                            }`}
                          >
                            {day.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Estimated time & Linked Goal Selector */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Оценка на 1 задачу (мин)</label>
                      <input
                        type="number"
                        min={1}
                        required
                        value={batchEstTime}
                        onChange={(e) => setBatchEstTime(Number(e.target.value))}
                        className="w-full px-3.5 py-2 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-400"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Привязать к цели</label>
                      <select
                        value={linkedGoalId}
                        onChange={(e) => setLinkedGoalId(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-400 text-zinc-850 dark:text-zinc-200 font-medium"
                      >
                        <option value="">Не привязывать</option>
                        {goals.map(goal => (
                          <option key={goal.id} value={goal.id}>🎯 {goal.title}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Summary tasks preview */}
                  <div className="flex items-center text-xs text-zinc-500 dark:text-zinc-400 bg-indigo-50/40 dark:bg-indigo-950/10 p-3 rounded-xl border border-indigo-100/50 dark:border-indigo-950/20">
                    <Calendar className="w-4 h-4 text-indigo-500 mr-2" />
                    Будет сгенерировано и добавлено всего задач на выбранный период:{' '}
                    <span className="font-bold text-indigo-600 dark:text-indigo-400 ml-1 text-sm">
                      {generateTaskDates(batchStartDate, batchEndDate, batchFrequency, batchCustomDays).length}
                    </span>
                  </div>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex gap-2 justify-end pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
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
