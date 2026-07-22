import { doc, getDoc, setDoc, getDocs, collection, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { AppState, Task, Goal, Habit, Note, Idea, Achievement, DailyRating } from './types';

function cleanForFirestore(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) return obj.map(cleanForFirestore);
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val !== undefined) cleaned[key] = cleanForFirestore(val);
    }
    return cleaned;
  }
  return obj;
}

export async function loadStateFromFirestore(): Promise<AppState | null> {
  try {
    console.log('[Firebase] Loading state from Firestore...');
    const [tasksSnap, goalsSnap, habitsSnap, notesSnap, ideasSnap, achSnap, ratingsSnap, settingsSnap] = await Promise.all([
      getDocs(collection(db, 'tasks')).catch(() => null),
      getDocs(collection(db, 'goals')).catch(() => null),
      getDocs(collection(db, 'habits')).catch(() => null),
      getDocs(collection(db, 'notes')).catch(() => null),
      getDocs(collection(db, 'ideas')).catch(() => null),
      getDocs(collection(db, 'achievements')).catch(() => null),
      getDocs(collection(db, 'dailyRatings')).catch(() => null),
      getDoc(doc(db, 'settings', 'config')).catch(() => null),
    ]);

    const tasks: Task[] = tasksSnap ? tasksSnap.docs.map(d => d.data() as Task) : [];
    const goals: Goal[] = goalsSnap ? goalsSnap.docs.map(d => d.data() as Goal) : [];
    const habits: Habit[] = habitsSnap ? habitsSnap.docs.map(d => d.data() as Habit) : [];
    const notes: Note[] = notesSnap ? notesSnap.docs.map(d => d.data() as Note) : [];
    const ideas: Idea[] = ideasSnap ? ideasSnap.docs.map(d => d.data() as Idea) : [];
    const achievements: Achievement[] = achSnap ? achSnap.docs.map(d => d.data() as Achievement) : [];
    const dailyRatings: DailyRating[] = ratingsSnap ? ratingsSnap.docs.map(d => d.data() as DailyRating) : [];

    const settingsData = settingsSnap && settingsSnap.exists() ? settingsSnap.data() : {};

    const hasData = tasks.length > 0 || goals.length > 0 || habits.length > 0 || notes.length > 0 || ideas.length > 0;

    if (!hasData) {
      console.log('[Firebase] No data found in Firestore collections.');
      return null;
    }

    const state: AppState = {
      tasks,
      goals,
      habits,
      notes,
      ideas,
      achievements,
      dailyRatings,
      telegram: settingsData.telegram || { botToken: '', botUsername: '', isActive: false },
      taskCategories: settingsData.taskCategories || ['Дизайн', 'Разработка', 'Здоровье', 'Развитие', 'Быт', 'Разное'],
      lastUpdated: settingsData.lastUpdated || Date.now()
    };

    console.log('[Firebase] Loaded:', {
      tasks: tasks.length,
      goals: goals.length,
      habits: habits.length,
      notes: notes.length,
      ideas: ideas.length,
    });

    return state;
  } catch (err) {
    console.error('[Firebase] Failed to load state:', err);
    return null;
  }
}

export async function saveStateToFirestore(state: AppState): Promise<boolean> {
  try {
    console.log('[Firebase] Saving state to Firestore...');
    const clean = cleanForFirestore(state);

    const writes: Promise<any>[] = [];

    (clean.tasks || []).forEach((t: Task) => {
      if (t && t.id) writes.push(setDoc(doc(db, 'tasks', t.id), t));
    });
    (clean.goals || []).forEach((g: Goal) => {
      if (g && g.id) writes.push(setDoc(doc(db, 'goals', g.id), g));
    });
    (clean.habits || []).forEach((h: Habit) => {
      if (h && h.id) writes.push(setDoc(doc(db, 'habits', h.id), h));
    });
    (clean.notes || []).forEach((n: Note) => {
      if (n && n.id) writes.push(setDoc(doc(db, 'notes', n.id), n));
    });
    (clean.ideas || []).forEach((i: Idea) => {
      if (i && i.id) writes.push(setDoc(doc(db, 'ideas', i.id), i));
    });
    (clean.achievements || []).forEach((a: Achievement) => {
      if (a && a.id) writes.push(setDoc(doc(db, 'achievements', a.id), a));
    });
    (clean.dailyRatings || []).forEach((r: DailyRating) => {
      if (r && r.date) writes.push(setDoc(doc(db, 'dailyRatings', r.date), r));
    });

    writes.push(setDoc(doc(db, 'settings', 'config'), {
      taskCategories: clean.taskCategories || [],
      telegram: clean.telegram || {},
      lastUpdated: Date.now()
    }));

    await Promise.all(writes);
    console.log('[Firebase] Saved', writes.length, 'documents.');
    return true;
  } catch (err) {
    console.error('[Firebase] Failed to save state:', err);
    return false;
  }
}
