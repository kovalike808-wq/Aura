import { Achievement } from './types';

export const DEFAULT_ACHIEVEMENTS: Achievement[] = [
  { id: 'ach_first_task', title: 'Первый шаг', description: 'Выполнена первая задача', unlocked: false, category: 'tasks' },
  { id: 'ach_10_tasks', title: 'Опытный планировщик', description: 'Выполнено 10 задач', unlocked: false, category: 'tasks' },
  { id: 'ach_100_tasks', title: 'Мастер продуктивности', description: 'Выполнено 100 задач', unlocked: false, category: 'tasks' },
  { id: 'ach_streak_30', title: 'Стальной характер', description: 'Серия привычек достигла 30 дней', unlocked: false, category: 'streak' },
  { id: 'ach_perfect_day', title: 'Идеальный день', description: 'Выполнены все задачи, запланированные на день', unlocked: false, category: 'tasks' },
  { id: 'ach_first_goal', title: 'Вижу цель', description: 'Завершена первая цель', unlocked: false, category: 'goals' }
];
