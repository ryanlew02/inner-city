import { getDatabase, generateUUID } from './db';
import { HabitEntry } from '../../types/habit';

export async function getEntriesForDate(date: string): Promise<HabitEntry[]> {
  const db = await getDatabase();
  const result = await db.getAllAsync<HabitEntry>(
    `SELECT * FROM habit_entries WHERE date = '${date}'`
  );
  return result;
}

export async function getEntryForHabit(habitId: string, date: string): Promise<HabitEntry | null> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<HabitEntry>(
    `SELECT * FROM habit_entries WHERE habit_id = '${habitId}' AND date = '${date}'`
  );
  return result || null;
}

export async function upsertEntry(entry: Omit<HabitEntry, 'id' | 'created_at'>): Promise<HabitEntry> {
  const db = await getDatabase();

  const existing = await getEntryForHabit(entry.habit_id, entry.date);
  const note = (entry.note || '').replace(/'/g, "''");

  if (existing) {
    await db.execAsync(
      `UPDATE habit_entries SET value = ${entry.value}, note = '${note}' WHERE id = '${existing.id}'`
    );
    return {
      ...existing,
      value: entry.value,
      note: entry.note || '',
    };
  } else {
    const id = generateUUID();
    const created_at = Date.now();

    await db.execAsync(`
      INSERT INTO habit_entries (id, habit_id, date, value, note, created_at)
      VALUES ('${id}', '${entry.habit_id}', '${entry.date}', ${entry.value}, '${note}', ${created_at})
    `);

    return {
      id,
      created_at,
      habit_id: entry.habit_id,
      date: entry.date,
      value: entry.value,
      note: entry.note || '',
    };
  }
}

export async function deleteEntry(id: string): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(`DELETE FROM habit_entries WHERE id = '${id}'`);
}

export async function deleteEntryForHabit(habitId: string, date: string): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(
    `DELETE FROM habit_entries WHERE habit_id = '${habitId}' AND date = '${date}'`
  );
}
