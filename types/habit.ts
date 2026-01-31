export type Habit = {
  id: string;
  name: string;
  description: string;
  created_at: number;
  archived: number;
  color: string;
  icon: string;
  target_type: 'check' | 'count' | 'minutes';
  target_value: number;
  schedule_type: 'daily' | 'weekly' | 'custom';
  schedule_json: string;
};

export type HabitEntry = {
  id: string;
  habit_id: string;
  date: string;
  value: number;
  note: string;
  created_at: number;
};
