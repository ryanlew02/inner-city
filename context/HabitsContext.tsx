import { createContext, useContext, useState, ReactNode } from "react";

export type Habit = {
  id: string;
  name: string;
  completed: boolean;
};

type HabitsContextType = {
  habits: Habit[];
  toggleHabit: (id: string) => void;
  completedCount: number;
};

const HabitsContext = createContext<HabitsContextType | null>(null);

const INITIAL_HABITS: Habit[] = [
  { id: "1", name: "Morning Exercise", completed: false },
  { id: "2", name: "Read for 30 minutes", completed: false },
  { id: "3", name: "Drink 8 glasses of water", completed: false },
  { id: "4", name: "Meditate", completed: false },
  { id: "5", name: "No social media before noon", completed: false },
];

export function HabitsProvider({ children }: { children: ReactNode }) {
  const [habits, setHabits] = useState<Habit[]>(INITIAL_HABITS);

  const toggleHabit = (id: string) => {
    setHabits((prev) =>
      prev.map((h) => (h.id === id ? { ...h, completed: !h.completed } : h))
    );
  };

  const completedCount = habits.filter((h) => h.completed).length;

  return (
    <HabitsContext.Provider value={{ habits, toggleHabit, completedCount }}>
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
