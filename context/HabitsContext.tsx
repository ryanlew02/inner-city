import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { Habit, HabitEntry } from "../types/habit";
import { getAllHabits, createHabit, updateHabit as updateHabitDb, archiveHabit as archiveHabitDb } from "../services/database/habitService";
import { getEntriesForDate, upsertEntry, deleteEntryForHabit } from "../services/database/entryService";
import { generateUUID } from "../services/database/db";

type HabitsContextType = {
  habits: Habit[];
  entries: Map<string, HabitEntry>;
  loading: boolean;
  toggleHabit: (id: string) => void;
  updateEntryValue: (habitId: string, value: number) => Promise<void>;
  getEntryValue: (habitId: string) => number;
  addHabit: (habit: Omit<Habit, 'id' | 'created_at' | 'archived'>) => Promise<Habit>;
  updateHabit: (id: string, updates: Partial<Omit<Habit, 'id' | 'created_at'>>) => Promise<void>;
  archiveHabit: (id: string) => Promise<void>;
  completedCount: number;
  isHabitCompleted: (habitId: string) => boolean;
  currentDate: string;
};

const HabitsContext = createContext<HabitsContextType | null>(null);

function getTodayDate(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

export function HabitsProvider({ children }: { children: ReactNode }) {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [entries, setEntries] = useState<Map<string, HabitEntry>>(new Map());
  const [loading, setLoading] = useState(true);
  const [currentDate] = useState(getTodayDate());
  const useInMemory = useRef(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [loadedHabits, loadedEntries] = await Promise.all([
        getAllHabits(),
        getEntriesForDate(currentDate),
      ]);
      setHabits(loadedHabits);

      const entriesMap = new Map<string, HabitEntry>();
      loadedEntries.forEach(entry => {
        entriesMap.set(entry.habit_id, entry);
      });
      setEntries(entriesMap);
    } catch (error) {
      console.error('Failed to load habits data, using in-memory fallback:', error);
      useInMemory.current = true;
      // Start with empty state when database fails
    } finally {
      setLoading(false);
    }
  }

  const isHabitCompleted = (habitId: string): boolean => {
    const entry = entries.get(habitId);
    if (!entry) return false;

    const habit = habits.find(h => h.id === habitId);
    if (!habit) return false;

    if (habit.target_type === 'check') {
      return entry.value >= 1;
    }
    return entry.value >= habit.target_value;
  };

  const getEntryValue = (habitId: string): number => {
    const entry = entries.get(habitId);
    return entry?.value ?? 0;
  };

  const toggleHabit = async (id: string) => {
    const habit = habits.find(h => h.id === id);
    if (!habit) return;

    const isCompleted = isHabitCompleted(id);

    if (useInMemory.current) {
      // In-memory fallback
      if (isCompleted) {
        setEntries(prev => {
          const newMap = new Map(prev);
          newMap.delete(id);
          return newMap;
        });
      } else {
        const newEntry: HabitEntry = {
          id: generateUUID(),
          habit_id: id,
          date: currentDate,
          value: habit.target_type === 'check' ? 1 : habit.target_value,
          note: '',
          created_at: Date.now(),
        };
        setEntries(prev => {
          const newMap = new Map(prev);
          newMap.set(id, newEntry);
          return newMap;
        });
      }
      return;
    }

    try {
      if (isCompleted) {
        await deleteEntryForHabit(id, currentDate);
        setEntries(prev => {
          const newMap = new Map(prev);
          newMap.delete(id);
          return newMap;
        });
      } else {
        const newEntry = await upsertEntry({
          habit_id: id,
          date: currentDate,
          value: habit.target_type === 'check' ? 1 : habit.target_value,
          note: '',
        });
        setEntries(prev => {
          const newMap = new Map(prev);
          newMap.set(id, newEntry);
          return newMap;
        });
      }
    } catch (error) {
      console.error('Failed to toggle habit:', error);
    }
  };

  const updateEntryValue = async (habitId: string, value: number): Promise<void> => {
    if (value <= 0) {
      // If value is 0 or negative, delete the entry
      if (useInMemory.current) {
        setEntries(prev => {
          const newMap = new Map(prev);
          newMap.delete(habitId);
          return newMap;
        });
        return;
      }

      try {
        await deleteEntryForHabit(habitId, currentDate);
        setEntries(prev => {
          const newMap = new Map(prev);
          newMap.delete(habitId);
          return newMap;
        });
      } catch (error) {
        console.error('Failed to delete entry:', error);
      }
      return;
    }

    if (useInMemory.current) {
      const existingEntry = entries.get(habitId);
      const newEntry: HabitEntry = existingEntry
        ? { ...existingEntry, value }
        : {
            id: generateUUID(),
            habit_id: habitId,
            date: currentDate,
            value,
            note: '',
            created_at: Date.now(),
          };
      setEntries(prev => {
        const newMap = new Map(prev);
        newMap.set(habitId, newEntry);
        return newMap;
      });
      return;
    }

    try {
      const newEntry = await upsertEntry({
        habit_id: habitId,
        date: currentDate,
        value,
        note: '',
      });
      setEntries(prev => {
        const newMap = new Map(prev);
        newMap.set(habitId, newEntry);
        return newMap;
      });
    } catch (error) {
      console.error('Failed to update entry value:', error);
    }
  };

  const addHabit = async (habit: Omit<Habit, 'id' | 'created_at' | 'archived'>): Promise<Habit> => {
    if (useInMemory.current) {
      // In-memory fallback
      const newHabit: Habit = {
        id: generateUUID(),
        created_at: Date.now(),
        archived: 0,
        name: habit.name,
        description: habit.description || '',
        color: habit.color || '#22C55E',
        icon: habit.icon || '',
        target_type: habit.target_type || 'check',
        target_value: habit.target_value || 1,
        schedule_type: habit.schedule_type || 'daily',
        schedule_json: habit.schedule_json || '{}',
      };
      setHabits(prev => [newHabit, ...prev]);
      return newHabit;
    }

    const newHabit = await createHabit(habit);
    setHabits(prev => [newHabit, ...prev]);
    return newHabit;
  };

  const updateHabit = async (id: string, updates: Partial<Omit<Habit, 'id' | 'created_at'>>): Promise<void> => {
    if (useInMemory.current) {
      setHabits(prev => prev.map(h => h.id === id ? { ...h, ...updates } : h));
      return;
    }

    await updateHabitDb(id, updates);
    setHabits(prev => prev.map(h => h.id === id ? { ...h, ...updates } : h));
  };

  const archiveHabit = async (id: string): Promise<void> => {
    if (useInMemory.current) {
      setHabits(prev => prev.filter(h => h.id !== id));
      return;
    }

    await archiveHabitDb(id);
    setHabits(prev => prev.filter(h => h.id !== id));
  };

  const completedCount = habits.filter(h => isHabitCompleted(h.id)).length;

  return (
    <HabitsContext.Provider value={{
      habits,
      entries,
      loading,
      toggleHabit,
      updateEntryValue,
      getEntryValue,
      addHabit,
      updateHabit,
      archiveHabit,
      completedCount,
      isHabitCompleted,
      currentDate,
    }}>
      {children}
    </HabitsContext.Provider>
  );
}

export function useHabits() {
  const context = useContext(HabitsContext);
  if (!context) {
    throw new Error("useHabits must be used within a HabitsProvider");
  }
  return context;
}
