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
  days_of_month?: number[];    // 1-31 for specific days of month
};

export function parseScheduleJson(json: string): ScheduleData {
  try {
    const parsed = JSON.parse(json);
    return {
      habit_mode: parsed.habit_mode || 'build',
      specific_days: parsed.specific_days,
      times_per_week: parsed.times_per_week,
      days_of_month: parsed.days_of_month,
    };
  } catch {
    return { habit_mode: 'build' };
  }
}

export function isScheduledForToday(scheduleData: ScheduleData): boolean {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const dayOfMonth = today.getDate(); // 1-31

  // If days_of_month is set, check if today's date is in the list
  if (scheduleData.days_of_month && scheduleData.days_of_month.length > 0) {
    return scheduleData.days_of_month.includes(dayOfMonth);
  }

  // If specific_days is set, check if today is in the list
  if (scheduleData.specific_days && scheduleData.specific_days.length > 0) {
    return scheduleData.specific_days.includes(dayOfWeek);
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
