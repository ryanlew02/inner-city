import { getDatabase } from './db';

export type ThemePreference = 'system' | 'light' | 'dark';

export async function getThemePreference(): Promise<ThemePreference> {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM app_settings WHERE key = ?',
      ['theme_preference']
    );
    if (row && (row.value === 'system' || row.value === 'light' || row.value === 'dark')) {
      return row.value;
    }
    return 'system';
  } catch {
    return 'system';
  }
}

export async function setThemePreference(preference: ThemePreference): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
    ['theme_preference', preference]
  );
}
