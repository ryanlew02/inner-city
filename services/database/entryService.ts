import { getDatabase, generateUUID } from './db';
import { HabitEntry } from '../../types/habit';

export async function getEntriesForDate(date: string): Promise<HabitEntry[]> {
  const db = await getDatabase();
  const result = await db.getAllAsync<HabitEntry>(
    'SELECT * FROM habit_entries WHERE date = ?',
    [date]
  );
  return result;
}

export async function getEntryForHabit(habitId: string, date: string): Promise<HabitEntry | null> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<HabitEntry>(
    'SELECT * FROM habit_entries WHERE habit_id = ? AND date = ?',
    [habitId, date]
  );
  return result || null;
}

export async function upsertEntry(entry: Omit<HabitEntry, 'id' | 'created_at'>): Promise<HabitEntry> {
  const db = await getDatabase();

  const existing = await getEntryForHabit(entry.habit_id, entry.date);
  const note = entry.note || '';

  if (existing) {
    await db.runAsync(
      'UPDATE habit_entries SET value = ?, note = ? WHERE id = ?',
      [entry.value, note, existing.id]
    );
    return {
      ...existing,
      value: entry.value,
      note,
    };
  } else {
    const id = generateUUID();
    const created_at = Date.now();

    await db.runAsync(
      'INSERT INTO habit_entries (id, habit_id, date, value, note, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, entry.habit_id, entry.date, entry.value, note, created_at]
    );

    return {
      id,
      created_at,
      habit_id: entry.habit_id,
      date: entry.date,
      value: entry.value,
      note,
    };
  }
}

export async function getEntriesForHabitInRange(
  habitId: string,
  startDate: string,
  endDate: string
): Promise<HabitEntry[]> {
  const db = await getDatabase();
  const result = await db.getAllAsync<HabitEntry>(
    `SELECT * FROM habit_entries WHERE habit_id = ? AND date >= ? AND date <= ?`,
    [habitId, startDate, endDate]
  );
  return result;
}

export async function deleteEntry(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM habit_entries WHERE id = ?', [id]);
}

export async function deleteEntryForHabit(habitId: string, date: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'DELETE FROM habit_entries WHERE habit_id = ? AND date = ?',
    [habitId, date]
  );
}

export async function hasCoinBeenAwarded(habitId: string, date: string): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ habit_id: string }>(
    'SELECT habit_id FROM coins_awarded WHERE habit_id = ? AND date = ?',
    [habitId, date]
  );
  return !!result;
}

export async function markCoinAwarded(habitId: string, date: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT OR IGNORE INTO coins_awarded (habit_id, date) VALUES (?, ?)',
    [habitId, date]
  );
}

export async function getTotalCompletedCount(): Promise<number> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM habit_entries WHERE value > 0`
  );
  return result?.count ?? 0;
}

export async function getEntriesForDateRange(startDate: string, endDate: string): Promise<HabitEntry[]> {
  const db = await getDatabase();
  return db.getAllAsync<HabitEntry>(
    'SELECT * FROM habit_entries WHERE date >= ? AND date <= ?',
    [startDate, endDate]
  );
}
