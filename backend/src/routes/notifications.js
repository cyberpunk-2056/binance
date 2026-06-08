const express = require('express');
const { getDb, generateId } = require('../services/db');
const router = express.Router();

router.get('/', (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const db = getDb();
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const notifications = db.prepare('SELECT * FROM notifications WHERE userId=? ORDER BY createdAt DESC LIMIT ? OFFSET ?').all(req.user.id, parseInt(limit), skip);
    const { total } = db.prepare('SELECT COUNT(*) as total FROM notifications WHERE userId=?').get(req.user.id);
    const { unread } = db.prepare('SELECT COUNT(*) as unread FROM notifications WHERE userId=? AND read=0').get(req.user.id);
    res.json({ notifications, total, unreadCount: unread });
  } catch(err) { res.status(500).json({ error: 'Failed to fetch notifications' }); }
});

router.put('/:id/read', (req, res) => {
  try {
    getDb().prepare('UPDATE notifications SET read=1 WHERE id=? AND userId=?').run(req.params.id, req.user.id);
    res.json({ message: 'Marked as read' });
  } catch(err) { res.status(500).json({ error: 'Failed to update' }); }
});

router.put('/read-all', (req, res) => {
  try {
    getDb().prepare('UPDATE notifications SET read=1 WHERE userId=? AND read=0').run(req.user.id);
    res.json({ message: 'All notifications marked as read' });
  } catch(err) { res.status(500).json({ error: 'Failed to update' }); }
});

module.exports = router;
