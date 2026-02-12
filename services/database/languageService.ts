import { getDatabase } from './db';

export type LanguageCode = 'en' | 'es' | 'zh' | 'hi' | 'ar' | 'fr' | 'pt' | 'ru' | 'ja' | 'ko';

const VALID_CODES: LanguageCode[] = ['en', 'es', 'zh', 'hi', 'ar', 'fr', 'pt', 'ru', 'ja', 'ko'];

export async function getLanguagePreference(): Promise<LanguageCode | null> {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM app_settings WHERE key = ?',
      ['language_preference']
    );
    if (row && VALID_CODES.includes(row.value as LanguageCode)) {
      return row.value as LanguageCode;
    }
    return null;
  } catch {
    return null;
  }
}

export async function setLanguagePreference(code: LanguageCode): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
    ['language_preference', code]
  );
}
