import * as SQLite from 'expo-sqlite';

const DATABASE_NAME = 'habits.db';

let db: SQLite.SQLiteDatabase | null = null;
let isInitializing = false;
let initError: Error | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  // If we had a previous init error, throw it
  if (initError) {
    throw initError;
  }

  // If already initialized and valid, return it
  if (db) {
    return db;
  }

  // Prevent concurrent initialization
  if (isInitializing) {
    // Wait for initialization to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    return getDatabase();
  }

  isInitializing = true;

  try {
    db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS habits (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at INTEGER NOT NULL,
        archived INTEGER DEFAULT 0,
        color TEXT,
        icon TEXT,
        target_type TEXT DEFAULT 'check',
        target_value INTEGER DEFAULT 1,
        schedule_type TEXT DEFAULT 'daily',
        schedule_json TEXT
      );

      CREATE TABLE IF NOT EXISTS habit_entries (
        id TEXT PRIMARY KEY,
        habit_id TEXT NOT NULL,
        date TEXT NOT NULL,
        value INTEGER DEFAULT 1,
        note TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (habit_id) REFERENCES habits(id)
      );

      CREATE INDEX IF NOT EXISTS idx_habit_entries_habit_date ON habit_entries(habit_id, date);
      CREATE INDEX IF NOT EXISTS idx_habit_entries_date ON habit_entries(date);
    `);

    isInitializing = false;
    return db;
  } catch (error) {
    isInitializing = false;
    initError = error as Error;
    db = null;
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

export function resetDatabase(): void {
  db = null;
  initError = null;
  isInitializing = false;
}

export function isDatabaseAvailable(): boolean {
  return db !== null && initError === null;
}

export function getDatabaseError(): Error | null {
  return initError;
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
