export interface Task {
  id: string;
  title: string;
  description?: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'completed' | 'archived';
  estimatedTime: number; // in minutes
  actualTime: number; // in minutes
  createdAt: string; // ISO date
  completedAt?: string; // ISO date
  isFavorite: boolean;
  dueDate?: string; // YYYY-MM-DD
}

export interface Goal {
  id: string;
  title: string;
  description?: string;
  targetDate?: string;
  isFavorite: boolean;
  taskIds: string[]; // Tasks linked to this goal
  createdAt: string;
}

export interface Habit {
  id: string;
  title: string;
  frequency: 'daily' | 'weekly';
  streak: number;
  history: string[]; // Array of YYYY-MM-DD strings
  createdAt: string;
  isFavorite: boolean;
}

export interface NoteItem {
  id: string;
  text: string;
  checked: boolean;
}

export interface Note {
  id: string;
  title: string;
  content: string; // Markdown or simple text
  type: 'text' | 'checklist';
  checklistItems: NoteItem[];
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Idea {
  id: string;
  title: string;
  content: string;
  convertedTo?: {
    type: 'task' | 'goal' | 'note';
    id: string;
  };
  isFavorite: boolean;
  createdAt: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  unlockedAt?: string;
  category: 'tasks' | 'goals' | 'habits' | 'streak' | 'rating';
}

export interface DailyRating {
  date: string; // YYYY-MM-DD
  score: number; // 1-10
  comment?: string;
}

export interface TelegramConfig {
  botToken: string;
  botUsername: string;
  isActive: boolean;
  chatId?: string; // Active chat ID of the user
  lastTasksDigestDate?: string;
  lastEveningReminderDate?: string;
}

export interface AppState {
  tasks: Task[];
  goals: Goal[];
  habits: Habit[];
  notes: Note[];
  ideas: Idea[];
  achievements: Achievement[];
  dailyRatings: DailyRating[];
  telegram: TelegramConfig;
  lastUpdated: number; // Timestamp
  taskCategories?: string[];
}
