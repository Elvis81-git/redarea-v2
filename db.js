const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = process.env.PERSISTENT_DISK_PATH 
  ? path.join(process.env.PERSISTENT_DISK_PATH, 'redzone.db') 
  : path.join(__dirname, 'redzone.db');
const db = new DatabaseSync(dbPath);

// Enable WAL mode for high concurrency read/write
db.exec("PRAGMA journal_mode = WAL;");

// Create users table
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    cash INTEGER DEFAULT 10000,
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    stash_json TEXT,
    equipped_json TEXT,
    deployed_after_relief INTEGER DEFAULT 1,
    medal_count INTEGER DEFAULT 0,
    quests_json TEXT,
    quests_last_reset TEXT,
    cheat_card_purchases INTEGER DEFAULT 0
  )
`);

// Alter database schema to support retrofitting older accounts
const migrations = [
  "ALTER TABLE users ADD COLUMN deployed_after_relief INTEGER DEFAULT 1;",
  "ALTER TABLE users ADD COLUMN medal_count INTEGER DEFAULT 0;",
  "ALTER TABLE users ADD COLUMN quests_json TEXT;",
  "ALTER TABLE users ADD COLUMN quests_last_reset TEXT;",
  "ALTER TABLE users ADD COLUMN cheat_card_purchases INTEGER DEFAULT 0;"
];

migrations.forEach(query => {
  try {
    db.exec(query);
  } catch (err) {
    // Ignore error if column already exists
  }
});

console.log('Database initialized successfully in WAL mode.');

module.exports = db;
