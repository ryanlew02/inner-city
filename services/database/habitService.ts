import { getDatabase, generateUUID } from './db';
import { Habit } from '../../types/habit';

export async function getAllHabits(): Promise<Habit[]> {
  const db = await getDatabase();
  const result = await db.getAllAsync<Habit>(
    'SELECT * FROM habits WHERE archived = 0 ORDER BY sort_order ASC, created_at DESC'
  );
  return result;
}

export async function createHabit(habit: Omit<Habit, 'id' | 'created_at' | 'archived' | 'sort_order'>): Promise<Habit> {
  const db = await getDatabase();
  const id = generateUUID();
  const created_at = Date.now();

  const name = habit.name;
  const description = habit.description || '';
  const color = habit.color || '#22C55E';
  const icon = habit.icon || '';
  const target_type = habit.target_type || 'check';
  const target_value = habit.target_value || 1;
  const schedule_type = habit.schedule_type || 'daily';
  const schedule_json = habit.schedule_json || '{}';

  // Shift existing habits down so new habit appears at top (sort_order = 0)
  await db.runAsync(`UPDATE habits SET sort_order = sort_order + 1 WHERE archived = 0`);

  await db.runAsync(
    `INSERT INTO habits (id, name, description, created_at, archived, color, icon, target_type, target_value, schedule_type, schedule_json, sort_order)
     VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, 0)`,
    [id, name, description, created_at, color, icon, target_type, target_value, schedule_type, schedule_json]
  );

  return {
    id,
    created_at,
    archived: 0,
    name,
    description,
    color,
    icon,
    target_type,
    target_value,
    schedule_type,
    schedule_json,
    sort_order: 0,
  };
}

export async function updateHabit(id: string, updates: Partial<Omit<Habit, 'id' | 'created_at'>>): Promise<void> {
  const db = await getDatabase();

  const setParts: string[] = [];
  const params: (string | number)[] = [];

  if (updates.name !== undefined) {
    setParts.push('name = ?');
    params.push(updates.name);
  }
  if (updates.description !== undefined) {
    setParts.push('description = ?');
    params.push(updates.description);
  }
  if (updates.color !== undefined) {
    setParts.push('color = ?');
    params.push(updates.color);
  }
  if (updates.icon !== undefined) {
    setParts.push('icon = ?');
    params.push(updates.icon);
  }
  if (updates.target_type !== undefined) {
    setParts.push('target_type = ?');
    params.push(updates.target_type);
  }
  if (updates.target_value !== undefined) {
    setParts.push('target_value = ?');
    params.push(updates.target_value);
  }
  if (updates.schedule_type !== undefined) {
    setParts.push('schedule_type = ?');
    params.push(updates.schedule_type);
  }
  if (updates.schedule_json !== undefined) {
    setParts.push('schedule_json = ?');
    params.push(updates.schedule_json);
  }
  if (updates.archived !== undefined) {
    setParts.push('archived = ?');
    params.push(updates.archived);
  }

  if (setParts.length === 0) {
    return;
  }

  params.push(id);
  await db.runAsync(`UPDATE habits SET ${setParts.join(', ')} WHERE id = ?`, params);
}

export async function archiveHabit(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE habits SET archived = 1 WHERE id = ?', [id]);
}

export async function clearAllHabitData(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(`DELETE FROM habit_entries`);
  await db.execAsync(`DELETE FROM habits`);
}

export async function updateHabitOrder(habits: { id: string; sort_order: number }[]): Promise<void> {
  const db = await getDatabase();
  for (const habit of habits) {
    await db.runAsync('UPDATE habits SET sort_order = ? WHERE id = ?', [habit.sort_order, habit.id]);
  }
}
