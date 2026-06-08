const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb, generateId, now } = require('../services/db');

const router = express.Router();

const generateTokens = (userId) => {
  const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '24h' });
  const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
};

const STARTER_WALLETS = [
  { coin: 'USDT', balance: 10000 },
  { coin: 'BTC',  balance: 0.05 },
  { coin: 'ETH',  balance: 1.5 },
  { coin: 'BNB',  balance: 10 },
  { coin: 'SOL',  balance: 20 },
  { coin: 'ADA',  balance: 500 },
  { coin: 'DOGE', balance: 1000 },
  { coin: 'XRP',  balance: 300 },
];

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, username, password, firstName, lastName } = req.body;
    if (!email || !username || !password) {
      return res.status(400).json({ error: 'Email, username and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get(email, username);
    if (existing) return res.status(409).json({ error: 'Email or username already exists' });

    const hashedPassword = await bcrypt.hash(password, 12);
    const userId = generateId();
    const refCode = Math.random().toString(36).substring(2, 10).toUpperCase();

    db.prepare(`INSERT INTO users (id, email, username, password, firstName, lastName, referralCode, emailVerified)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1)`)
      .run(userId, email, username, hashedPassword, firstName || '', lastName || '', refCode);

    // Create starter wallets
    const insertWallet = db.prepare(`INSERT INTO wallets (id, userId, coin, balance, address) VALUES (?, ?, ?, ?, ?)`);
    for (const w of STARTER_WALLETS) {
      insertWallet.run(generateId(), userId, w.coin, w.balance, `${w.coin.toLowerCase()}1${generateId().replace(/-/g,'').substring(0,26)}`);
    }

    const { accessToken, refreshToken } = generateTokens(userId);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare('INSERT INTO sessions (id, userId, token, device, ip, expiresAt) VALUES (?, ?, ?, ?, ?, ?)')
      .run(generateId(), userId, refreshToken, req.headers['user-agent'] || '', req.ip || '', expiresAt);

    const user = db.prepare('SELECT id, email, username, firstName, lastName, role, kycStatus FROM users WHERE id = ?').get(userId);
    res.status(201).json({ message: 'Account created successfully', accessToken, refreshToken, user });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ? OR username = ?').get(email, email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (user.status === 'BANNED') return res.status(403).json({ error: 'Account banned. Contact support.' });

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });

    const { accessToken, refreshToken } = generateTokens(user.id);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare('INSERT INTO sessions (id, userId, token, device, ip, expiresAt) VALUES (?, ?, ?, ?, ?, ?)')
      .run(generateId(), user.id, refreshToken, req.headers['user-agent'] || '', req.ip || '', expiresAt);

    const { password: _, ...safeUser } = user;
    res.json({ message: 'Login successful', accessToken, refreshToken, user: safeUser });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ error: 'Refresh token required' });

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const db = getDb();
    const session = db.prepare('SELECT * FROM sessions WHERE token = ?').get(refreshToken);

    if (!session || new Date(session.expiresAt) < new Date()) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(decoded.userId);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare('UPDATE sessions SET token = ?, expiresAt = ? WHERE token = ?').run(newRefreshToken, expiresAt, refreshToken);

    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (err) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      getDb().prepare('DELETE FROM sessions WHERE token = ?').run(refreshToken);
    }
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Logout failed' });
  }
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token' });
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const db = getDb();
    const user = db.prepare('SELECT id, email, username, firstName, lastName, phone, country, avatar, role, status, kycStatus, twoFAEnabled, emailVerified, referralCode, createdAt FROM users WHERE id = ?').get(decoded.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', (req, res) => {
  res.json({ message: 'If that email exists, a reset link has been sent.' });
});

// POST /api/auth/reset-password
router.post('/reset-password', (req, res) => {
  res.json({ message: 'Password reset successfully' });
});

module.exports = router;
