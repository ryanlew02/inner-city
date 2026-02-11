import { File, Paths } from 'expo-file-system';
import { shareAsync } from 'expo-sharing';
import { getDatabase } from './db';

const BACKUP_VERSION = 1;

type BackupData = {
  version: number;
  exportedAt: string;
  habits: Record<string, unknown>[];
  habitEntries: Record<string, unknown>[];
  placedBuildings: Record<string, unknown>[];
  tokens: number;
  appSettings: Record<string, string>;
};

export async function exportAllData(): Promise<void> {
  const db = await getDatabase();

  const habits = await db.getAllAsync<Record<string, unknown>>('SELECT * FROM habits');
  const habitEntries = await db.getAllAsync<Record<string, unknown>>('SELECT * FROM habit_entries');
  const placedBuildings = await db.getAllAsync<Record<string, unknown>>('SELECT * FROM placed_buildings');
  const userStats = await db.getFirstAsync<{ tokens: number }>(
    "SELECT tokens FROM user_stats WHERE id = 'user'"
  );
  const settingsRows = await db.getAllAsync<{ key: string; value: string }>(
    'SELECT * FROM app_settings'
  );

  const appSettings: Record<string, string> = {};
  for (const row of settingsRows) {
    appSettings[row.key] = row.value;
  }

  const backup: BackupData = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    habits,
    habitEntries,
    placedBuildings,
    tokens: userStats?.tokens ?? 0,
    appSettings,
  };

  const file = new File(Paths.cache, 'inner-city-backup.json');
  if (file.exists) {
    file.delete();
  }
  file.create();
  file.write(JSON.stringify(backup, null, 2));

  await shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Export Inner City Backup',
  });
}

export async function importAllData(): Promise<void> {
  const picked = await File.pickFileAsync(undefined, 'application/json');

  // pickFileAsync can return a single File or an array
  const file = Array.isArray(picked) ? picked[0] : picked;
  if (!file) {
    throw new Error('cancelled');
  }

  const content = await file.text();
  const backup: BackupData = JSON.parse(content);

  if (!backup.version || backup.version > BACKUP_VERSION) {
    throw new Error(
      'This backup file is not compatible with the current version of the app.'
    );
  }

  const db = await getDatabase();

  await db.execAsync('DELETE FROM habit_entries');
  await db.execAsync('DELETE FROM habits');
  await db.execAsync('DELETE FROM placed_buildings');
  await db.execAsync('DELETE FROM app_settings');

  // Restore habits
  for (const h of backup.habits) {
    await db.runAsync(
      `INSERT INTO habits (id, name, description, created_at, archived, color, icon, target_type, target_value, schedule_type, schedule_json, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        h.id as string,
        h.name as string,
        (h.description as string) ?? '',
        h.created_at as number,
        (h.archived as number) ?? 0,
        (h.color as string) ?? '#22C55E',
        (h.icon as string) ?? '',
        (h.target_type as string) ?? 'check',
        (h.target_value as number) ?? 1,
        (h.schedule_type as string) ?? 'daily',
        (h.schedule_json as string) ?? '{}',
        (h.sort_order as number) ?? 0,
      ]
    );
  }

  // Restore habit entries
  for (const e of backup.habitEntries) {
    await db.runAsync(
      `INSERT INTO habit_entries (id, habit_id, date, value, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        e.id as string,
        e.habit_id as string,
        e.date as string,
        (e.value as number) ?? 1,
        (e.note as string) ?? '',
        e.created_at as number,
      ]
    );
  }

  // Restore placed buildings
  for (const b of backup.placedBuildings) {
    await db.runAsync(
      `INSERT INTO placed_buildings (id, plot_index, building_type, tier, variant, size_x, size_y, created_at, grid_row, grid_col)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        b.id as string,
        (b.plot_index as number) ?? 0,
        b.building_type as string,
        (b.tier as number) ?? 1,
        b.variant as number,
        (b.size_x as number) ?? 1,
        (b.size_y as number) ?? 1,
        b.created_at as number,
        (b.grid_row as number) ?? null,
        (b.grid_col as number) ?? null,
      ]
    );
  }

  // Restore tokens
  await db.runAsync(
    "UPDATE user_stats SET tokens = ? WHERE id = 'user'",
    [backup.tokens ?? 0]
  );

  // Restore app settings
  for (const [key, value] of Object.entries(backup.appSettings ?? {})) {
    await db.runAsync(
      'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
      [key, value]
    );
  }
}
