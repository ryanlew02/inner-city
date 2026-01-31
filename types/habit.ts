export type Habit = {
  id: string;
  name: string;
  description: string;
  created_at: number;
  archived: number;
  color: string;
  icon: string;
  target_type: 'check' | 'count' | 'minutes' | 'hours';
  target_value: number;
  schedule_type: 'daily' | 'weekly' | 'custom';
  schedule_json: string;
};

export type ScheduleData = {
  habit_mode: 'build' | 'quit';
  specific_days?: number[];    // 0=Sun, 1=Mon, ..., 6=Sat
  times_per_week?: number;     // e.g., 3
};

export function parseScheduleJson(json: string): ScheduleData {
  try {
    const parsed = JSON.parse(json);
    return {
      habit_mode: parsed.habit_mode || 'build',
      specific_days: parsed.specific_days,
      times_per_week: parsed.times_per_week,
    };
  } catch {
    return { habit_mode: 'build' };
  }
}

export function isScheduledForToday(scheduleData: ScheduleData): boolean {
  const today = new Date().getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

  // If specific_days is set, check if today is in the list
  if (scheduleData.specific_days && scheduleData.specific_days.length > 0) {
    return scheduleData.specific_days.includes(today);
  }

  // times_per_week habits show every day (user picks which days to log)
  // Daily habits (no specific_days or times_per_week) show every day
  return true;
}

export type HabitEntry = {
  id: string;
  habit_id: string;
  date: string;
  value: number;
  note: string;
  created_at: number;
};
