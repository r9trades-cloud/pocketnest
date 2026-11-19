const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'pocketnest.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
const createTables = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('parent', 'child')),
      avatar TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS families (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      invitation_code TEXT UNIQUE NOT NULL,
      parent_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS family_members (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('parent', 'child')),
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(family_id, user_id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS wallets (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      balance REAL DEFAULT 0,
      is_frozen INTEGER DEFAULT 0,
      spending_limit REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      wallet_id TEXT NOT NULL,
      amount REAL NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'deduction', 'spending', 'savings')),
      description TEXT,
      status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'rejected', 'cancelled')),
      reference_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS withdrawal_requests (
      id TEXT PRIMARY KEY,
      child_id TEXT NOT NULL,
      parent_id TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
      requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      processed_at DATETIME,
      FOREIGN KEY (child_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('info', 'success', 'warning', 'error')),
      is_read INTEGER DEFAULT 0,
      related_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS savings_goals (
      id TEXT PRIMARY KEY,
      child_id TEXT NOT NULL,
      title TEXT NOT NULL,
      target_amount REAL NOT NULL,
      current_amount REAL DEFAULT 0,
      description TEXT,
      target_date DATE,
      is_completed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (child_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS spending_limits (
      id TEXT PRIMARY KEY,
      child_id TEXT NOT NULL,
      limit_amount REAL NOT NULL,
      period TEXT NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly')),
      set_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (child_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (set_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_transactions_wallet ON transactions(wallet_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_withdrawal_child ON withdrawal_requests(child_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_withdrawal_parent ON withdrawal_requests(parent_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_savings_child ON savings_goals(child_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_family_members_family ON family_members(family_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_family_members_user ON family_members(user_id)`);

  console.log('Database tables created successfully!');
};

createTables();

// Export wrapper to match sqlite3 API
module.exports = {
  run: (sql, params = []) => {
    const stmt = db.prepare(sql);
    const result = stmt.run(...params);
    return { lastID: result.lastInsertRowid, changes: result.changes };
  },
  get: (sql, params = []) => {
    const stmt = db.prepare(sql);
    return stmt.get(...params);
  },
  all: (sql, params = []) => {
    const stmt = db.prepare(sql);
    return stmt.all(...params);
  },
  exec: (sql) => {
    db.exec(sql);
  },
  close: () => db.close()
};