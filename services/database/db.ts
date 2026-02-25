import * as SQLite from 'expo-sqlite';

const DATABASE_NAME = 'habits.db';

let db: SQLite.SQLiteDatabase | null = null;
// Single shared promise — all concurrent callers await the same init,
// eliminating the recursive spin-wait that could hang on iOS.
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return Promise.resolve(db);
  if (!initPromise) {
    initPromise = initializeDatabase();
  }
  return initPromise;
}

async function initializeDatabase(): Promise<SQLite.SQLiteDatabase> {
  try {
    const database = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await database.execAsync(`
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

      CREATE TABLE IF NOT EXISTS user_stats (
        id TEXT PRIMARY KEY DEFAULT 'user',
        tokens INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS placed_buildings (
        id TEXT PRIMARY KEY,
        plot_index INTEGER NOT NULL DEFAULT 0,
        building_type TEXT NOT NULL,
        tier INTEGER DEFAULT 1,
        variant INTEGER NOT NULL,
        size_x INTEGER DEFAULT 1,
        size_y INTEGER DEFAULT 1,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      CREATE TABLE IF NOT EXISTS coins_awarded (
        habit_id TEXT NOT NULL,
        date TEXT NOT NULL,
        PRIMARY KEY (habit_id, date),
        FOREIGN KEY (habit_id) REFERENCES habits(id)
      );

      INSERT OR IGNORE INTO user_stats (id, tokens) VALUES ('user', 0);
    `);

    // Migration: Add size_x and size_y columns to existing placed_buildings table
    // These will fail silently if columns already exist
    try {
      await database.execAsync(`ALTER TABLE placed_buildings ADD COLUMN size_x INTEGER DEFAULT 1`);
    } catch (e) {
      // Column already exists, ignore
    }
    try {
      await database.execAsync(`ALTER TABLE placed_buildings ADD COLUMN size_y INTEGER DEFAULT 1`);
    } catch (e) {
      // Column already exists, ignore
    }

    // Migration: Add grid_row and grid_col columns for stable building positions
    try {
      await database.execAsync(`ALTER TABLE placed_buildings ADD COLUMN grid_row INTEGER`);
    } catch (e) {
      // Column already exists, ignore
    }
    try {
      await database.execAsync(`ALTER TABLE placed_buildings ADD COLUMN grid_col INTEGER`);
    } catch (e) {
      // Column already exists, ignore
    }

    // Remove any UNIQUE constraint on plot_index from older app versions.
    // SQLite doesn't support DROP CONSTRAINT, so we recreate the table if needed.
    try {
      // Check if plot_index has a unique constraint (from table SQL or index)
      const tableInfo = await database.getFirstAsync<{ sql: string }>(
        `SELECT sql FROM sqlite_master WHERE type='table' AND name='placed_buildings'`
      );
      const hasUniqueInSchema = tableInfo?.sql?.toLowerCase().includes('plot_index') &&
        tableInfo?.sql?.toLowerCase().includes('unique');

      // Also drop any standalone unique indexes on plot_index
      await database.execAsync(`DROP INDEX IF EXISTS idx_placed_buildings_plot_index`);
      await database.execAsync(`DROP INDEX IF EXISTS unique_plot_index`);
      await database.execAsync(`DROP INDEX IF EXISTS placed_buildings_plot_index`);

      // Check for any remaining unique indexes on placed_buildings
      const uniqueIndexes = await database.getAllAsync<{ name: string; sql: string }>(
        `SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='placed_buildings' AND sql IS NOT NULL`
      );
      for (const idx of uniqueIndexes) {
        if (idx.sql?.toLowerCase().includes('unique') && idx.sql?.toLowerCase().includes('plot_index')) {
          await database.execAsync(`DROP INDEX IF EXISTS "${idx.name}"`);
        }
      }

      if (hasUniqueInSchema) {
        // Recreate table without the UNIQUE constraint
        await database.execAsync(`
          CREATE TABLE IF NOT EXISTS placed_buildings_new (
            id TEXT PRIMARY KEY,
            plot_index INTEGER NOT NULL DEFAULT 0,
            building_type TEXT NOT NULL,
            tier INTEGER DEFAULT 1,
            variant INTEGER NOT NULL,
            size_x INTEGER DEFAULT 1,
            size_y INTEGER DEFAULT 1,
            created_at INTEGER NOT NULL,
            grid_row INTEGER,
            grid_col INTEGER
          );
          INSERT OR IGNORE INTO placed_buildings_new SELECT id, plot_index, building_type, tier, variant, size_x, size_y, created_at, grid_row, grid_col FROM placed_buildings;
          DROP TABLE placed_buildings;
          ALTER TABLE placed_buildings_new RENAME TO placed_buildings;
        `);
      }
    } catch (e) {
      __DEV__ && console.warn('Legacy constraint cleanup (non-fatal):', e);
    }

    // Migration: Add sort_order column to habits table
    try {
      await database.execAsync(`ALTER TABLE habits ADD COLUMN sort_order INTEGER DEFAULT 0`);
    } catch (e) {
      // Column already exists, ignore
    }

    // Migrate existing buildings from plot_index to grid_row/grid_col
    try {
      const { migrateToGridCoordinates } = require('./buildingService');
      await migrateToGridCoordinates();
    } catch (e) {
      __DEV__ && console.warn('Building migration failed (non-fatal):', e);
    }

    // Only assign the module-level db once everything has succeeded
    db = database;
    return database;
  } catch (error) {
    // Reset so callers can retry after a failure
    initPromise = null;
    db = null;
    __DEV__ && console.error('Failed to initialize database:', error);
    throw error;
  }
}

export function resetDatabase(): void {
  db = null;
  initPromise = null;
}

export function isDatabaseAvailable(): boolean {
  return db !== null;
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
