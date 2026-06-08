const express = require('express');
const { getDb, generateId } = require('../services/db');
const { adminOnly } = require('../middleware/auth');
const { rewardDepositBonus } = require('../services/bonus');
const router = express.Router();

router.use(adminOnly);

router.get('/stats', (req, res) => {
  try {
    const db = getDb();
    const totalUsers = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
    const activeUsers = db.prepare("SELECT COUNT(*) as c FROM users WHERE status='ACTIVE'").get().c;
    const bannedUsers = db.prepare("SELECT COUNT(*) as c FROM users WHERE status='BANNED'").get().c;
    const totalOrders = db.prepare('SELECT COUNT(*) as c FROM orders').get().c;
    const filledOrders = db.prepare("SELECT COUNT(*) as c FROM orders WHERE status='FILLED'").get().c;
    const totalP2P = db.prepare('SELECT COUNT(*) as c FROM p2p_orders').get().c;
    const pendingP2P = db.prepare("SELECT COUNT(*) as c FROM p2p_orders WHERE status='PENDING'").get().c;
    const totalTx = db.prepare('SELECT COUNT(*) as c FROM transactions').get().c;
    const recentUsers = db.prepare('SELECT id, username, email, createdAt, status FROM users ORDER BY createdAt DESC LIMIT 5').all();
    res.json({ users: { total: totalUsers, active: activeUsers, banned: bannedUsers }, orders: { total: totalOrders, filled: filledOrders }, p2p: { total: totalP2P, pending: pendingP2P }, transactions: { total: totalTx }, recentUsers });
  } catch(err) { res.status(500).json({ error: 'Failed to fetch stats' }); }
});

router.get('/users', (req, res) => {
  try {
    const { search, status, role, page = 1, limit = 20 } = req.query;
    const db = getDb();
    const skip = (parseInt(page) - 1) * parseInt(limit);
    let where = '1=1';
    const params = [];
    if (status) { where += ' AND status=?'; params.push(status); }
    if (role) { where += ' AND role=?'; params.push(role); }
    if (search) { where += ' AND (email LIKE ? OR username LIKE ? OR firstName LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    const users = db.prepare(`SELECT id, email, username, firstName, lastName, role, status, kycStatus, emailVerified, createdAt, country FROM users WHERE ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`).all(...params, parseInt(limit), skip);
    const { total } = db.prepare(`SELECT COUNT(*) as total FROM users WHERE ${where}`).get(...params);
    res.json({ users, total, page: parseInt(page), limit: parseInt(limit) });
  } catch(err) { res.status(500).json({ error: 'Failed to fetch users' }); }
});

router.get('/users/:id', (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT id, email, username, firstName, lastName, role, status, kycStatus, emailVerified, createdAt, country, phone FROM users WHERE id=?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const wallets = db.prepare('SELECT * FROM wallets WHERE userId=?').all(req.params.id);
    const orders = db.prepare('SELECT * FROM orders WHERE userId=? ORDER BY createdAt DESC LIMIT 10').all(req.params.id);
    res.json({ user: { ...user, wallets, orders } });
  } catch(err) { res.status(500).json({ error: 'Failed to fetch user' }); }
});

router.put('/users/:id', (req, res) => {
  try {
    const { status, role, kycStatus } = req.body;
    const db = getDb();
    const updates = [];
    const params = [];
    if (status !== undefined) { updates.push('status=?'); params.push(status); }
    if (role !== undefined) { updates.push('role=?'); params.push(role); }
    if (kycStatus !== undefined) { updates.push('kycStatus=?'); params.push(kycStatus); }
    if (updates.length) {
      params.push(req.params.id);
      db.prepare(`UPDATE users SET ${updates.join(',')} WHERE id=?`).run(...params);
    }
    db.prepare('INSERT INTO admin_logs (id,adminId,action,targetUserId) VALUES (?,?,?,?)').run(generateId(), req.user.id, `Updated: ${JSON.stringify({ status, role, kycStatus })}`, req.params.id);
    const user = db.prepare('SELECT id, email, username, status, role, kycStatus FROM users WHERE id=?').get(req.params.id);
    res.json({ user, message: 'User updated' });
  } catch(err) { res.status(500).json({ error: 'Failed to update user' }); }
});

router.put('/users/:id/balance', (req, res) => {
  try {
    const { coin, balance, lockedBalance = 0, address } = req.body;
    if (!coin) return res.status(400).json({ error: 'Coin is required' });
    const db = getDb();
    const existing = db.prepare('SELECT id FROM wallets WHERE userId=? AND coin=?').get(req.params.id, coin);
    const targetBalance = balance !== undefined ? parseFloat(balance) : 0;
    const targetLocked = lockedBalance !== undefined ? parseFloat(lockedBalance) : 0;
    const defaultAddress = '0x9F04b2b03D9B87b2EA9087AcdA92d96F5f17BEBd';
    const targetAddress = address !== undefined && address.trim() !== '' ? address.trim() : (existing ? existing.address : defaultAddress);

    if (existing) {
      db.prepare('UPDATE wallets SET balance=?, lockedBalance=?, address=? WHERE id=?').run(targetBalance, targetLocked, targetAddress, existing.id);
    } else {
      db.prepare('INSERT INTO wallets (id,userId,coin,balance,lockedBalance,address) VALUES (?,?,?,?,?,?)').run(generateId(), req.params.id, coin, targetBalance, targetLocked, targetAddress);
    }
    db.prepare('INSERT INTO admin_logs (id,adminId,action,targetUserId) VALUES (?,?,?,?)').run(generateId(), req.user.id, `Adjusted ${coin} balance to ${targetBalance}, locked to ${targetLocked}, address to ${targetAddress}`, req.params.id);
    res.json({ message: 'Balance and address updated successfully' });
  } catch(err) { res.status(500).json({ error: 'Failed to update balance' }); }
});

router.get('/transactions', (req, res) => {
  try {
    const { type, status, page = 1, limit = 20 } = req.query;
    const db = getDb();
    const skip = (parseInt(page) - 1) * parseInt(limit);
    let where = '1=1';
    const params = [];
    if (type) { where += ' AND t.type=?'; params.push(type); }
    if (status) { where += ' AND t.status=?'; params.push(status); }
    const transactions = db.prepare(`SELECT t.*, u.username, u.email FROM transactions t JOIN wallets w ON t.walletId=w.id JOIN users u ON w.userId=u.id WHERE ${where} ORDER BY t.createdAt DESC LIMIT ? OFFSET ?`).all(...params, parseInt(limit), skip);
    const { total } = db.prepare(`SELECT COUNT(*) as total FROM transactions t JOIN wallets w ON t.walletId=w.id WHERE ${where}`).get(...params);
    res.json({ transactions, total });
  } catch(err) { res.status(500).json({ error: 'Failed to fetch transactions' }); }
});

router.get('/orders', (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const db = getDb();
    const skip = (parseInt(page) - 1) * parseInt(limit);
    let where = '1=1';
    const params = [];
    if (status) { where += ' AND o.status=?'; params.push(status); }
    const orders = db.prepare(`SELECT o.*, u.username, u.email FROM orders o JOIN users u ON o.userId=u.id WHERE ${where} ORDER BY o.createdAt DESC LIMIT ? OFFSET ?`).all(...params, parseInt(limit), skip);
    const { total } = db.prepare(`SELECT COUNT(*) as total FROM orders o WHERE ${where}`).get(...params);
    res.json({ orders, total });
  } catch(err) { res.status(500).json({ error: 'Failed to fetch orders' }); }
});

router.get('/p2p', (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const db = getDb();
    const skip = (parseInt(page) - 1) * parseInt(limit);
    let where = '1=1';
    const params = [];
    if (status) { where += ' AND o.status=?'; params.push(status); }
    const orders = db.prepare(`SELECT o.*, s.username as sellerUsername, b.username as buyerUsername FROM p2p_orders o JOIN users s ON o.sellerId=s.id JOIN users b ON o.buyerId=b.id WHERE ${where} ORDER BY o.createdAt DESC LIMIT ? OFFSET ?`).all(...params, parseInt(limit), skip);
    const { total } = db.prepare(`SELECT COUNT(*) as total FROM p2p_orders o WHERE ${where}`).get(...params);
    res.json({ orders, total });
  } catch(err) { res.status(500).json({ error: 'Failed to fetch P2P orders' }); }
});

router.get('/announcements', (req, res) => {
  try {
    const db = getDb();
    const announcements = db.prepare('SELECT * FROM announcements ORDER BY createdAt DESC').all();
    res.json({ announcements });
  } catch(err) { res.status(500).json({ error: 'Failed to fetch announcements' }); }
});

router.post('/announcements', (req, res) => {
  try {
    const { title, content, type } = req.body;
    const db = getDb();
    const id = generateId();
    db.prepare('INSERT INTO announcements (id,title,content,type) VALUES (?,?,?,?)').run(id, title, content, type||'INFO');
    const announcement = db.prepare('SELECT * FROM announcements WHERE id=?').get(id);
    res.status(201).json({ announcement });
  } catch(err) { res.status(500).json({ error: 'Failed to create announcement' }); }
});

router.put('/announcements/:id', (req, res) => {
  try {
    const { title, content, type, active } = req.body;
    const db = getDb();
    db.prepare('UPDATE announcements SET title=?,content=?,type=?,active=? WHERE id=?').run(title, content, type, active?1:0, req.params.id);
    const announcement = db.prepare('SELECT * FROM announcements WHERE id=?').get(req.params.id);
    res.json({ announcement });
  } catch(err) { res.status(500).json({ error: 'Failed to update announcement' }); }
});

router.delete('/announcements/:id', (req, res) => {
  try {
    getDb().prepare('DELETE FROM announcements WHERE id=?').run(req.params.id);
    res.json({ message: 'Announcement deleted' });
  } catch(err) { res.status(500).json({ error: 'Failed to delete announcement' }); }
});

router.get('/logs', (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const db = getDb();
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const logs = db.prepare('SELECT l.*, u.username as adminUsername FROM admin_logs l JOIN users u ON l.adminId=u.id ORDER BY l.createdAt DESC LIMIT ? OFFSET ?').all(parseInt(limit), skip);
    const { total } = db.prepare('SELECT COUNT(*) as total FROM admin_logs').get();
    res.json({ logs, total });
  } catch(err) { res.status(500).json({ error: 'Failed to fetch logs' }); }
});

router.post('/transactions/:id/approve', (req, res) => {
  try {
    const db = getDb();
    const tx = db.prepare('SELECT * FROM transactions WHERE id=?').get(req.params.id);
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });
    if (tx.status !== 'PENDING') return res.status(400).json({ error: 'Transaction is not pending' });

    const wallet = db.prepare('SELECT * FROM wallets WHERE id=?').get(tx.walletId);
    if (!wallet) return res.status(404).json({ error: 'Associated wallet not found' });

    if (tx.type === 'DEPOSIT') {
      db.prepare('UPDATE wallets SET balance=balance+? WHERE id=?').run(tx.amount, wallet.id);
      db.prepare("UPDATE transactions SET status='COMPLETED', note=? WHERE id=?").run(tx.note ? `${tx.note} (Approved)` : 'Approved by Admin', tx.id);
      
      // Credit BNB deposit bonus asynchronously
      rewardDepositBonus(db, wallet.userId, tx.coin, tx.amount, tx.id);
    } else if (tx.type === 'WITHDRAW') {
      if (wallet.lockedBalance < tx.amount) {
        return res.status(400).json({ error: 'Insufficient locked balance' });
      }
      db.prepare('UPDATE wallets SET lockedBalance=lockedBalance-? WHERE id=?').run(tx.amount, wallet.id);
      db.prepare("UPDATE transactions SET status='COMPLETED', note=? WHERE id=?").run(tx.note ? `${tx.note} (Approved)` : 'Approved by Admin', tx.id);
    } else {
      return res.status(400).json({ error: 'Unsupported transaction type for approval' });
    }

    db.prepare('INSERT INTO admin_logs (id,adminId,action,targetUserId) VALUES (?,?,?,?)').run(
      generateId(),
      req.user.id,
      `Approved ${tx.type} of ${tx.amount} ${tx.coin} for tx ${tx.id}`,
      wallet.userId
    );

    res.json({ message: 'Transaction approved successfully' });
  } catch(err) {
    console.error('Approve transaction error:', err);
    res.status(500).json({ error: 'Failed to approve transaction' });
  }
});

router.post('/transactions/:id/reject', (req, res) => {
  try {
    const db = getDb();
    const tx = db.prepare('SELECT * FROM transactions WHERE id=?').get(req.params.id);
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });
    if (tx.status !== 'PENDING') return res.status(400).json({ error: 'Transaction is not pending' });

    const wallet = db.prepare('SELECT * FROM wallets WHERE id=?').get(tx.walletId);
    if (!wallet) return res.status(404).json({ error: 'Associated wallet not found' });

    if (tx.type === 'DEPOSIT') {
      db.prepare("UPDATE transactions SET status='FAILED', note=? WHERE id=?").run(tx.note ? `${tx.note} (Rejected)` : 'Rejected by Admin', tx.id);
    } else if (tx.type === 'WITHDRAW') {
      if (wallet.lockedBalance < tx.amount) {
        return res.status(400).json({ error: 'Insufficient locked balance' });
      }
      db.prepare('UPDATE wallets SET balance=balance+?, lockedBalance=lockedBalance-? WHERE id=?').run(tx.amount, tx.amount, wallet.id);
      db.prepare("UPDATE transactions SET status='FAILED', note=? WHERE id=?").run(tx.note ? `${tx.note} (Rejected & Refunded)` : 'Rejected by Admin', tx.id);
    } else {
      return res.status(400).json({ error: 'Unsupported transaction type for rejection' });
    }

    db.prepare('INSERT INTO admin_logs (id,adminId,action,targetUserId) VALUES (?,?,?,?)').run(
      generateId(),
      req.user.id,
      `Rejected ${tx.type} of ${tx.amount} ${tx.coin} for tx ${tx.id}`,
      wallet.userId
    );

    res.json({ message: 'Transaction rejected successfully' });
  } catch(err) {
    console.error('Reject transaction error:', err);
    res.status(500).json({ error: 'Failed to reject transaction' });
  }
});

router.get('/settings', (req, res) => {
  try {
    const db = getDb();
    const settings = db.prepare('SELECT * FROM settings').all();
    const settingsMap = {};
    settings.forEach(s => { settingsMap[s.key] = s.value; });
    res.json({ settings: settingsMap });
  } catch(err) { res.status(500).json({ error: 'Failed to fetch settings' }); }
});

router.post('/settings', (req, res) => {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Invalid settings body' });
    }
    const db = getDb();
    const insert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    
    db.transaction(() => {
      for (const [key, val] of Object.entries(settings)) {
        insert.run(key, String(val));
      }
    })();
    
    db.prepare('INSERT INTO admin_logs (id,adminId,action,targetUserId) VALUES (?,?,?,?)').run(
      generateId(),
      req.user.id,
      `Updated settings: ${JSON.stringify(settings)}`,
      ''
    );
    
    res.json({ message: 'Settings updated successfully' });
  } catch(err) {
    console.error('Save settings error:', err);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

module.exports = router;
