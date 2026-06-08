const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, '../../prisma/dev.db');
let db;

const getDb = () => {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
};

const initSchema = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      firstName TEXT DEFAULT '',
      lastName TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      country TEXT DEFAULT '',
      avatar TEXT DEFAULT '',
      role TEXT DEFAULT 'USER',
      status TEXT DEFAULT 'ACTIVE',
      kycStatus TEXT DEFAULT 'NONE',
      twoFAEnabled INTEGER DEFAULT 0,
      twoFASecret TEXT DEFAULT '',
      emailVerified INTEGER DEFAULT 1,
      referralCode TEXT UNIQUE,
      referredBy TEXT DEFAULT '',
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS wallets (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      coin TEXT NOT NULL,
      balance REAL DEFAULT 0,
      lockedBalance REAL DEFAULT 0,
      address TEXT DEFAULT '',
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      UNIQUE(userId, coin),
      FOREIGN KEY (userId) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      walletId TEXT NOT NULL,
      type TEXT NOT NULL,
      coin TEXT NOT NULL,
      amount REAL NOT NULL,
      fee REAL DEFAULT 0,
      status TEXT DEFAULT 'PENDING',
      txHash TEXT DEFAULT '',
      note TEXT DEFAULT '',
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (walletId) REFERENCES wallets(id)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      pair TEXT NOT NULL,
      type TEXT NOT NULL,
      side TEXT NOT NULL,
      price REAL NOT NULL,
      amount REAL NOT NULL,
      filled REAL DEFAULT 0,
      status TEXT DEFAULT 'OPEN',
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS p2p_ads (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      type TEXT NOT NULL,
      coin TEXT NOT NULL,
      currency TEXT DEFAULT 'USD',
      price REAL NOT NULL,
      minAmount REAL NOT NULL,
      maxAmount REAL NOT NULL,
      totalAmount REAL NOT NULL,
      availableAmount REAL NOT NULL,
      paymentMethod TEXT NOT NULL,
      terms TEXT DEFAULT '',
      status TEXT DEFAULT 'ACTIVE',
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS p2p_orders (
      id TEXT PRIMARY KEY,
      adId TEXT NOT NULL,
      sellerId TEXT NOT NULL,
      buyerId TEXT NOT NULL,
      coin TEXT NOT NULL,
      price REAL NOT NULL,
      amount REAL NOT NULL,
      total REAL NOT NULL,
      status TEXT DEFAULT 'PENDING',
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (adId) REFERENCES p2p_ads(id),
      FOREIGN KEY (sellerId) REFERENCES users(id),
      FOREIGN KEY (buyerId) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS p2p_chats (
      id TEXT PRIMARY KEY,
      orderId TEXT NOT NULL,
      senderId TEXT NOT NULL,
      message TEXT NOT NULL,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (orderId) REFERENCES p2p_orders(id),
      FOREIGN KEY (senderId) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      read INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      device TEXT DEFAULT '',
      ip TEXT DEFAULT '',
      expiresAt TEXT NOT NULL,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      type TEXT DEFAULT 'INFO',
      active INTEGER DEFAULT 1,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS admin_logs (
      id TEXT PRIMARY KEY,
      adminId TEXT NOT NULL,
      action TEXT NOT NULL,
      targetUserId TEXT DEFAULT '',
      details TEXT DEFAULT '',
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (adminId) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS price_alerts (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      coin TEXT NOT NULL,
      condition TEXT NOT NULL,
      price REAL NOT NULL,
      triggered INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const hasSetting = db.prepare("SELECT 1 FROM settings WHERE key='auto_approve_deposits'").get();
  if (!hasSetting) {
    db.prepare("INSERT INTO settings (key, value) VALUES ('auto_approve_deposits', 'false')").run();
  }
};

// Helper functions
const generateId = () => uuidv4();

const now = () => new Date().toISOString();

module.exports = { getDb, generateId, now };
