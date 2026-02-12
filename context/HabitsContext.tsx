import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { AppState, AppStateStatus } from "react-native";
import { useAudioPlayer } from "expo-audio";
import { Habit, HabitEntry, parseScheduleJson, isScheduledForToday, isScheduledForDate } from "../types/habit";
import { getAllHabits, createHabit, updateHabit as updateHabitDb, archiveHabit as archiveHabitDb, updateHabitOrder, clearAllHabitData as clearAllHabitDataDb } from "../services/database/habitService";
import { getEntriesForDate, upsertEntry, deleteEntryForHabit, hasCoinBeenAwarded, markCoinAwarded, getEntryForHabit } from "../services/database/entryService";
import { generateUUID } from "../services/database/db";
import { useSound } from "./SoundContext";
import { addTokens as addTokensDb } from "../services/database/tokenService";
import { scheduleHabitNotifications, cancelHabitNotifications, rescheduleMonthlyNotifications } from "../services/notificationService";

type HabitsContextType = {
  habits: Habit[];
  entries: Map<string, HabitEntry>;
  loading: boolean;
  toggleHabit: (id: string) => void;
  updateEntryValue: (habitId: string, value: number) => Promise<void>;
  getEntryValue: (habitId: string) => number;
  addHabit: (habit: Omit<Habit, 'id' | 'created_at' | 'archived' | 'sort_order'>) => Promise<Habit>;
  updateHabit: (id: string, updates: Partial<Omit<Habit, 'id' | 'created_at'>>) => Promise<void>;
  archiveHabit: (id: string) => Promise<void>;
  reorderHabits: (fromIndex: number, toIndex: number) => void;
  resetHabitData: () => Promise<void>;
  completedCount: number;
  isHabitCompleted: (habitId: string) => boolean;
  isHabitScheduledForToday: (habitId: string) => boolean;
  isHabitScheduledForDate: (habitId: string, date: string) => boolean;
  currentDate: string;
  viewingDate: string;
  setViewingDate: (date: string) => void;
  isViewingToday: boolean;
  onTokenEarned?: () => void;
  setOnTokenEarned: (callback: (() => void) | undefined) => void;
};

const HabitsContext = createContext<HabitsContextType | null>(null);

function getYesterday(todayStr: string): string {
  const date = new Date(todayStr + 'T12:00:00');
  date.setDate(date.getDate() - 1);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

function getTodayDate(): string {
  // Use Intl.DateTimeFormat to get the date in the user's local timezone
  // This is more reliable than new Date() getters across JS engines
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  return formatter.format(now); // Returns YYYY-MM-DD
}

export function HabitsProvider({ children }: { children: ReactNode }) {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [entries, setEntries] = useState<Map<string, HabitEntry>>(new Map());
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(getTodayDate());
  const [viewingDate, setViewingDateState] = useState(getTodayDate());
  const [onTokenEarned, setOnTokenEarned] = useState<(() => void) | undefined>(undefined);
  const { soundEnabled } = useSound();
  const useInMemory = useRef(false);
  const inMemoryCoinsAwarded = useRef(new Set<string>());
  const appState = useRef(AppState.currentState);
  const completionPlayer = useAudioPlayer(require("../assets/sounds/complete.wav"));

  const isViewingToday = viewingDate === currentDate;

  const playCompletionSound = () => {
    if (!soundEnabled) return;
    completionPlayer.seekTo(0);
    completionPlayer.play();
  };

  useEffect(() => {
    loadData();
  }, []);

  // Check for date change when app comes to foreground
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App has come to foreground - check if date changed
        const today = getTodayDate();
        if (today !== currentDate) {
          // Award quit habit coins for yesterday before switching dates
          const yesterday = getYesterday(today);
          awardQuitHabitCoins(yesterday, habits);
          // Clear entries immediately to avoid showing yesterday's completed data
          setEntries(new Map());
          setCurrentDate(today);
          setViewingDateState(today);
          reloadEntriesForDate(today);
        }
        // Reschedule days_of_month notifications (they use fixed dates)
        rescheduleMonthlyNotifications(habits).catch(() => {});
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [currentDate]);

  async function awardQuitHabitCoins(dateToCheck: string, habitsList: Habit[]) {
    if (useInMemory.current) return;
    try {
      const quitHabits = habitsList.filter(h => {
        if (h.archived) return false;
        const schedule = parseScheduleJson(h.schedule_json);
        if (schedule.habit_mode !== 'quit') return false;
        // Check the habit was created before or on the date
        const checkDateObj = new Date(dateToCheck + 'T00:00:00');
        const createdDate = new Date(h.created_at);
        createdDate.setHours(0, 0, 0, 0);
        if (checkDateObj < createdDate) return false;
        // Check it was scheduled for that date
        return isScheduledForDate(schedule, checkDateObj);
      });

      let coinsToAward = 0;
      for (const habit of quitHabits) {
        const alreadyAwarded = await hasCoinBeenAwarded(habit.id, dateToCheck);
        if (alreadyAwarded) continue;

        const entry = await getEntryForHabit(habit.id, dateToCheck);
        let completed = false;
        if (habit.target_type === 'check') {
          completed = !entry || entry.value === 0;
        } else {
          completed = !entry || entry.value < habit.target_value;
        }

        if (completed) {
          await markCoinAwarded(habit.id, dateToCheck);
          coinsToAward++;
        }
      }

      if (coinsToAward > 0) {
        await addTokensDb(coinsToAward);
        onTokenEarned?.();
      }
    } catch (error) {
      __DEV__ && console.error('Failed to award quit habit coins:', error);
    }
  }

  async function reloadEntriesForDate(date: string) {
    if (useInMemory.current) {
      // Clear entries for in-memory mode on new day
      setEntries(new Map());
      return;
    }

    try {
      const loadedEntries = await getEntriesForDate(date);
      const entriesMap = new Map<string, HabitEntry>();
      loadedEntries.forEach(entry => {
        entriesMap.set(entry.habit_id, entry);
      });
      setEntries(entriesMap);
    } catch (error) {
      __DEV__ && console.error('Failed to reload entries for new date:', error);
    }
  }

  const setViewingDate = async (date: string) => {
    setViewingDateState(date);
    await reloadEntriesForDate(date);
  };

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

      // Award quit habit coins for yesterday on app startup
      const yesterday = getYesterday(currentDate);
      await awardQuitHabitCoins(yesterday, loadedHabits);
    } catch (error) {
      __DEV__ && console.error('Failed to load habits data, using in-memory fallback:', error);
      useInMemory.current = true;
    } finally {
      setLoading(false);
    }
  }

  const isHabitCompleted = (habitId: string): boolean => {
    const entry = entries.get(habitId);
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return false;

    // Don't count dates before the habit was created
    const viewingDateObj = new Date(viewingDate + 'T00:00:00');
    const createdDate = new Date(habit.created_at);
    createdDate.setHours(0, 0, 0, 0);
    if (viewingDateObj < createdDate) return false;

    const scheduleData = parseScheduleJson(habit.schedule_json);
    const isQuitHabit = scheduleData.habit_mode === 'quit';

    if (isQuitHabit) {
      // Quit habits: success = NOT doing the activity or staying under limit
      if (habit.target_type === 'check') {
        // Quit check: completed if NO entry or value is 0 (didn't do the thing)
        return !entry || entry.value === 0;
      }
      // Quit count/minutes/hours: completed if value < target (under the limit)
      return !entry || entry.value < habit.target_value;
    }

    // Build habits: normal completion logic
    if (!entry) return false;

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

    const existingEntry = entries.get(id);
    const scheduleData = parseScheduleJson(habit.schedule_json);
    const isQuitCheck = scheduleData.habit_mode === 'quit' && habit.target_type === 'check';

    // For quit check habits, toggle is inverted:
    // - No entry (or value 0) = completed (didn't do the bad thing)
    // - Tapping marks that you DID the bad thing (creates entry with value 1)
    // - Tapping again undoes it (deletes the entry)
    const hasEntry = existingEntry && existingEntry.value >= 1;
    const shouldRemove = isQuitCheck ? hasEntry : isHabitCompleted(id);

    if (useInMemory.current) {
      if (shouldRemove) {
        setEntries(prev => {
          const newMap = new Map(prev);
          newMap.delete(id);
          return newMap;
        });
      } else {
        const newEntry: HabitEntry = {
          id: generateUUID(),
          habit_id: id,
          date: viewingDate,
          value: habit.target_type === 'check' ? 1 : habit.target_value,
          note: '',
          created_at: Date.now(),
        };
        setEntries(prev => {
          const newMap = new Map(prev);
          newMap.set(id, newEntry);
          return newMap;
        });
        if (!isQuitCheck && (!existingEntry || existingEntry.value === 0)) {
          const key = `${id}:${viewingDate}`;
          if (!inMemoryCoinsAwarded.current.has(key)) {
            inMemoryCoinsAwarded.current.add(key);
            playCompletionSound();
            onTokenEarned?.();
          } else {
            playCompletionSound();
          }
        }
      }
      return;
    }

    try {
      if (shouldRemove) {
        await deleteEntryForHabit(id, viewingDate);
        setEntries(prev => {
          const newMap = new Map(prev);
          newMap.delete(id);
          return newMap;
        });
      } else {
        const newEntry = await upsertEntry({
          habit_id: id,
          date: viewingDate,
          value: habit.target_type === 'check' ? 1 : habit.target_value,
          note: '',
        });
        setEntries(prev => {
          const newMap = new Map(prev);
          newMap.set(id, newEntry);
          return newMap;
        });
        if (!isQuitCheck && (!existingEntry || existingEntry.value === 0)) {
          const alreadyAwarded = await hasCoinBeenAwarded(id, viewingDate);
          if (!alreadyAwarded) {
            await markCoinAwarded(id, viewingDate);
            playCompletionSound();
            await addTokensDb(1);
            onTokenEarned?.();
          } else {
            playCompletionSound();
          }
        }
      }
    } catch (error) {
      __DEV__ && console.error('Failed to toggle habit:', error);
    }
  };

  const updateEntryValue = async (habitId: string, value: number): Promise<void> => {
    const habit = habits.find(h => h.id === habitId);
    const existingEntry = entries.get(habitId);
    const wasCompleted = habit ? isHabitCompleted(habitId) : false;

    if (value <= 0) {
      if (useInMemory.current) {
        setEntries(prev => {
          const newMap = new Map(prev);
          newMap.delete(habitId);
          return newMap;
        });
        return;
      }

      try {
        await deleteEntryForHabit(habitId, viewingDate);
        setEntries(prev => {
          const newMap = new Map(prev);
          newMap.delete(habitId);
          return newMap;
        });
      } catch (error) {
        __DEV__ && console.error('Failed to delete entry:', error);
      }
      return;
    }

    if (useInMemory.current) {
      const newEntry: HabitEntry = existingEntry
        ? { ...existingEntry, value }
        : {
            id: generateUUID(),
            habit_id: habitId,
            date: viewingDate,
            value,
            note: '',
            created_at: Date.now(),
          };
      setEntries(prev => {
        const newMap = new Map(prev);
        newMap.set(habitId, newEntry);
        return newMap;
      });
      if (!wasCompleted && habit) {
        const targetValue = habit.target_value;
        if (value >= targetValue) {
          const key = `${habitId}:${viewingDate}`;
          if (!inMemoryCoinsAwarded.current.has(key)) {
            inMemoryCoinsAwarded.current.add(key);
            playCompletionSound();
            onTokenEarned?.();
          } else {
            playCompletionSound();
          }
        }
      }
      return;
    }

    try {
      const newEntry = await upsertEntry({
        habit_id: habitId,
        date: viewingDate,
        value,
        note: '',
      });
      setEntries(prev => {
        const newMap = new Map(prev);
        newMap.set(habitId, newEntry);
        return newMap;
      });
      if (!wasCompleted && habit) {
        const targetValue = habit.target_value;
        if (value >= targetValue) {
          const alreadyAwarded = await hasCoinBeenAwarded(habitId, viewingDate);
          if (!alreadyAwarded) {
            await markCoinAwarded(habitId, viewingDate);
            playCompletionSound();
            await addTokensDb(1);
            onTokenEarned?.();
          } else {
            playCompletionSound();
          }
        }
      }
    } catch (error) {
      __DEV__ && console.error('Failed to update entry value:', error);
    }
  };

  const addHabit = async (habit: Omit<Habit, 'id' | 'created_at' | 'archived' | 'sort_order'>): Promise<Habit> => {
    if (useInMemory.current) {
      // In-memory fallback
      const maxOrder = habits.reduce((max, h) => Math.max(max, h.sort_order), -1);
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
        sort_order: maxOrder + 1,
      };
      setHabits(prev => [...prev, newHabit]);
      return newHabit;
    }

    const newHabit = await createHabit(habit);
    setHabits(prev => [...prev, newHabit]);

    const scheduleData = parseScheduleJson(newHabit.schedule_json);
    if (scheduleData.notification_enabled) {
      scheduleHabitNotifications(newHabit).catch(() => {});
    }

    return newHabit;
  };

  const updateHabit = async (id: string, updates: Partial<Omit<Habit, 'id' | 'created_at'>>): Promise<void> => {
    if (useInMemory.current) {
      setHabits(prev => prev.map(h => h.id === id ? { ...h, ...updates } : h));
      return;
    }

    await updateHabitDb(id, updates);
    const updatedHabit = habits.find(h => h.id === id);
    if (updatedHabit) {
      const merged = { ...updatedHabit, ...updates };
      const scheduleData = parseScheduleJson(merged.schedule_json);
      await cancelHabitNotifications(id);
      if (scheduleData.notification_enabled) {
        scheduleHabitNotifications(merged as Habit).catch(() => {});
      }
    }
    setHabits(prev => prev.map(h => h.id === id ? { ...h, ...updates } : h));
  };

  const archiveHabit = async (id: string): Promise<void> => {
    if (useInMemory.current) {
      setHabits(prev => prev.filter(h => h.id !== id));
      return;
    }

    await cancelHabitNotifications(id).catch(() => {});
    await archiveHabitDb(id);
    setHabits(prev => prev.filter(h => h.id !== id));
  };

  const reorderHabits = (fromIndex: number, toIndex: number) => {
    setHabits(prev => {
      const newHabits = [...prev];
      const [moved] = newHabits.splice(fromIndex, 1);
      newHabits.splice(toIndex, 0, moved);
      // Assign new sort_order values
      const updated = newHabits.map((h, i) => ({ ...h, sort_order: i }));
      // Persist to DB
      if (!useInMemory.current) {
        updateHabitOrder(updated.map(h => ({ id: h.id, sort_order: h.sort_order }))).catch(() => {});
      }
      return updated;
    });
  };

  const resetHabitData = async (): Promise<void> => {
    if (useInMemory.current) {
      setHabits([]);
      setEntries(new Map());
      return;
    }
    await clearAllHabitDataDb();
    setHabits([]);
    setEntries(new Map());
  };

  const isHabitScheduledForToday = (habitId: string): boolean => {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return false;
    const scheduleData = parseScheduleJson(habit.schedule_json);
    return isScheduledForToday(scheduleData);
  };

  const isHabitScheduledForDateFn = (habitId: string, dateStr: string): boolean => {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return false;
    const scheduleData = parseScheduleJson(habit.schedule_json);
    const date = new Date(dateStr + 'T00:00:00');
    return isScheduledForDate(scheduleData, date);
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
      reorderHabits,
      resetHabitData,
      completedCount,
      isHabitCompleted,
      isHabitScheduledForToday,
      isHabitScheduledForDate: isHabitScheduledForDateFn,
      currentDate,
      viewingDate,
      setViewingDate,
      isViewingToday,
      onTokenEarned,
      setOnTokenEarned,
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
