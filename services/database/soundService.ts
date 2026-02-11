import { getDatabase } from './db';

export async function getSoundEnabled(): Promise<boolean> {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM app_settings WHERE key = ?',
      ['sound_enabled']
    );
    if (row) {
      return row.value !== 'false';
    }
    return true;
  } catch {
    return true;
  }
}

export async function setSoundEnabled(enabled: boolean): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
    ['sound_enabled', enabled ? 'true' : 'false']
  );
}
