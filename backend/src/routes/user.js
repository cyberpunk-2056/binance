const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../services/db');
const router = express.Router();

router.get('/profile', (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, email, username, firstName, lastName, phone, country, avatar, role, status, kycStatus, twoFAEnabled, emailVerified, referralCode, createdAt FROM users WHERE id = ?').get(req.user.id);
  res.json({ user });
});

router.put('/profile', (req, res) => {
  try {
    const { firstName, lastName, phone, country, avatar } = req.body;
    const db = getDb();
    db.prepare("UPDATE users SET firstName=?, lastName=?, phone=?, country=?, avatar=?, updatedAt=datetime('now') WHERE id=?")
      .run(firstName||'', lastName||'', phone||'', country||'', avatar||'', req.user.id);
    const user = db.prepare('SELECT id, email, username, firstName, lastName, phone, country, avatar FROM users WHERE id=?').get(req.user.id);
    res.json({ user, message: 'Profile updated' });
  } catch(err) { res.status(500).json({ error: 'Failed to update profile' }); }
});

router.put('/password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const db = getDb();
    const user = db.prepare('SELECT password FROM users WHERE id=?').get(req.user.id);
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) return res.status(400).json({ error: 'Current password incorrect' });
    const hashed = await bcrypt.hash(newPassword, 12);
    db.prepare('UPDATE users SET password=? WHERE id=?').run(hashed, req.user.id);
    res.json({ message: 'Password changed successfully' });
  } catch(err) { res.status(500).json({ error: 'Failed to change password' }); }
});

router.get('/sessions', (req, res) => {
  const db = getDb();
  const sessions = db.prepare("SELECT id, device, ip, createdAt FROM sessions WHERE userId=? AND expiresAt > datetime('now')").all(req.user.id);
  res.json({ sessions });
});

router.get('/kyc', (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT kycStatus FROM users WHERE id=?').get(req.user.id);
  res.json({ kycStatus: user.kycStatus });
});

router.post('/kyc', (req, res) => {
  const db = getDb();
  db.prepare("UPDATE users SET kycStatus='PENDING' WHERE id=?").run(req.user.id);
  res.json({ message: 'KYC submitted for review', kycStatus: 'PENDING' });
});

module.exports = router;
