import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";

const dbPath = process.env.DEVNIX_DB_PATH || path.resolve(process.cwd(), "devnix.db");

// Global cached database connection for development hot-reloading
const globalDb = global as unknown as {
  __devnix_db?: DatabaseSync;
};

function initDb(): DatabaseSync {
  const parentDir = path.dirname(dbPath);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  const db = new DatabaseSync(dbPath);

  // Enable WAL mode for high concurrency
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");

  // 1. Users Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      displayName TEXT NOT NULL,
      passwordHash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'USER',
      isSuperAdmin INTEGER NOT NULL DEFAULT 0,
      isActive INTEGER NOT NULL DEFAULT 1,
      mustResetPassword INTEGER NOT NULL DEFAULT 0,
      failedAttempts INTEGER NOT NULL DEFAULT 0,
      lockedUntil INTEGER DEFAULT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
  `);

  // Migration: Add isSuperAdmin column if table existed previously without it
  try {
    const tableInfo = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
    const hasSuperAdmin = tableInfo.some((col) => col.name === "isSuperAdmin");
    if (!hasSuperAdmin) {
      db.exec("ALTER TABLE users ADD COLUMN isSuperAdmin INTEGER NOT NULL DEFAULT 0;");
      // If there are existing admins, promote the earliest user to Super Admin
      const earliestUser = db.prepare("SELECT id FROM users ORDER BY createdAt ASC LIMIT 1").get() as { id: string } | undefined;
      if (earliestUser) {
        db.prepare("UPDATE users SET isSuperAdmin = 1, role = 'ADMIN' WHERE id = ?").run(earliestUser.id);
      }
    }
  } catch {}

  // 2. Settings Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // 3. Sessions & Refresh Tokens Tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      tokenHash TEXT NOT NULL,
      expiresAt INTEGER NOT NULL,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      impersonatedBy TEXT DEFAULT NULL,
      expiresAt INTEGER NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 4. User Workspace Snippets Table (Persists code & stdin per language)
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_snippets (
      userId TEXT NOT NULL,
      languageId INTEGER NOT NULL,
      code TEXT NOT NULL,
      stdin TEXT DEFAULT '',
      updatedAt INTEGER NOT NULL,
      PRIMARY KEY (userId, languageId),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 5. User Preferences Table (Theme, Split Widths, Active Lang/Mode)
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_preferences (
      userId TEXT PRIMARY KEY,
      selectedLanguageId INTEGER DEFAULT 71,
      theme TEXT DEFAULT 'vs-dark',
      mode TEXT DEFAULT 'interactive',
      editorSplitPercent REAL DEFAULT 50,
      panel1Percent REAL DEFAULT 36,
      panel2Percent REAL DEFAULT 32,
      isAiPanelOpen INTEGER DEFAULT 1,
      updatedAt INTEGER NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 6. User AI Settings Table (Provider, Base URL, Models, Encrypted Keys, Chat History)
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_ai_settings (
      userId TEXT PRIMARY KEY,
      provider TEXT DEFAULT 'gemini',
      customBaseUrl TEXT DEFAULT '',
      modelsJson TEXT DEFAULT '{}',
      encryptedKeysJson TEXT DEFAULT '{}',
      chatHistoryJson TEXT DEFAULT '[]',
      updatedAt INTEGER NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Seed default settings if not exists
  const seedDefaults: Record<string, string> = {
    selfSignupEnabled: "true",
    rateLimitEnabled: "true",
    rateLimitWindow: "15",
    rateLimitMaxAttempts: "20",
  };

  const checkSettingStmt = db.prepare("SELECT value FROM settings WHERE key = ?");
  const insertSettingStmt = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)");

  for (const [key, val] of Object.entries(seedDefaults)) {
    const existing = checkSettingStmt.get(key);
    if (!existing) {
      insertSettingStmt.run(key, val);
    }
  }

  return db;
}

export function getDb(): DatabaseSync {
  if (!globalDb.__devnix_db) {
    globalDb.__devnix_db = initDb();
  } else {
    try {
      globalDb.__devnix_db.exec(`
        CREATE TABLE IF NOT EXISTS refresh_tokens (
          id TEXT PRIMARY KEY,
          userId TEXT NOT NULL,
          tokenHash TEXT NOT NULL,
          expiresAt INTEGER NOT NULL,
          createdAt INTEGER NOT NULL,
          FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
        );
      `);
    } catch {}
  }
  return globalDb.__devnix_db;
}
