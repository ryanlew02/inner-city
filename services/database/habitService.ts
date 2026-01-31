import { getDatabase, generateUUID } from './db';
import { Habit } from '../../types/habit';

export async function getAllHabits(): Promise<Habit[]> {
  const db = await getDatabase();
  const result = await db.getAllAsync<Habit>(
    'SELECT * FROM habits WHERE archived = 0 ORDER BY created_at DESC'
  );
  return result;
}

export async function createHabit(habit: Omit<Habit, 'id' | 'created_at' | 'archived'>): Promise<Habit> {
  const db = await getDatabase();
  const id = generateUUID();
  const created_at = Date.now();

  const name = habit.name.replace(/'/g, "''");
  const description = (habit.description || '').replace(/'/g, "''");
  const color = (habit.color || '#22C55E').replace(/'/g, "''");
  const icon = (habit.icon || '').replace(/'/g, "''");
  const target_type = habit.target_type || 'check';
  const target_value = habit.target_value || 1;
  const schedule_type = habit.schedule_type || 'daily';
  const schedule_json = (habit.schedule_json || '{}').replace(/'/g, "''");

  await db.execAsync(`
    INSERT INTO habits (id, name, description, created_at, archived, color, icon, target_type, target_value, schedule_type, schedule_json)
    VALUES ('${id}', '${name}', '${description}', ${created_at}, 0, '${color}', '${icon}', '${target_type}', ${target_value}, '${schedule_type}', '${schedule_json}')
  `);

  return {
    id,
    created_at,
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
}

export async function updateHabit(id: string, updates: Partial<Omit<Habit, 'id' | 'created_at'>>): Promise<void> {
  const db = await getDatabase();

  const setParts: string[] = [];

  if (updates.name !== undefined) {
    setParts.push(`name = '${updates.name.replace(/'/g, "''")}'`);
  }
  if (updates.description !== undefined) {
    setParts.push(`description = '${updates.description.replace(/'/g, "''")}'`);
  }
  if (updates.color !== undefined) {
    setParts.push(`color = '${updates.color.replace(/'/g, "''")}'`);
  }
  if (updates.icon !== undefined) {
    setParts.push(`icon = '${updates.icon.replace(/'/g, "''")}'`);
  }
  if (updates.target_type !== undefined) {
    setParts.push(`target_type = '${updates.target_type}'`);
  }
  if (updates.target_value !== undefined) {
    setParts.push(`target_value = ${updates.target_value}`);
  }
  if (updates.schedule_type !== undefined) {
    setParts.push(`schedule_type = '${updates.schedule_type}'`);
  }
  if (updates.schedule_json !== undefined) {
    setParts.push(`schedule_json = '${updates.schedule_json.replace(/'/g, "''")}'`);
  }
  if (updates.archived !== undefined) {
    setParts.push(`archived = ${updates.archived}`);
  }

  if (setParts.length === 0) {
    return;
  }

  await db.execAsync(`UPDATE habits SET ${setParts.join(', ')} WHERE id = '${id}'`);
}

export async function archiveHabit(id: string): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(`UPDATE habits SET archived = 1 WHERE id = '${id}'`);
}
