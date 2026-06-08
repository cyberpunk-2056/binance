const express = require('express');
const { getDb, generateId } = require('../services/db');
const { authenticate, optionalAuth } = require('../middleware/auth');
const router = express.Router();

// GET /api/p2p/ads
router.get('/ads', optionalAuth, (req, res) => {
  try {
    const { type, coin, page = 1, limit = 20 } = req.query;
    const db = getDb();
    const skip = (parseInt(page) - 1) * parseInt(limit);
    let where = "a.status='ACTIVE'";
    const params = [];
    if (type) { where += ' AND a.type=?'; params.push(type); }
    if (coin) { where += ' AND a.coin=?'; params.push(coin); }
    
    const ads = db.prepare(`
      SELECT a.*, u.username, u.avatar, u.createdAt as userCreatedAt
      FROM p2p_ads a
      JOIN users u ON a.userId = u.id
      WHERE ${where}
      ORDER BY a.createdAt DESC LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), skip);
    
    const { total } = db.prepare(`SELECT COUNT(*) as total FROM p2p_ads a WHERE ${where}`).get(...params);
    res.json({ ads, total, page: parseInt(page), limit: parseInt(limit) });
  } catch(err) { res.status(500).json({ error: 'Failed to fetch ads' }); }
});

// POST /api/p2p/ads
router.post('/ads', authenticate, (req, res) => {
  try {
    const { type, coin, currency, price, minAmount, maxAmount, totalAmount, paymentMethod, terms } = req.body;
    if (!type || !coin || !price || !minAmount || !maxAmount || !totalAmount || !paymentMethod) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const db = getDb();
    const id = generateId();
    db.prepare(`INSERT INTO p2p_ads (id,userId,type,coin,currency,price,minAmount,maxAmount,totalAmount,availableAmount,paymentMethod,terms) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, req.user.id, type, coin, currency||'USD', parseFloat(price), parseFloat(minAmount), parseFloat(maxAmount), parseFloat(totalAmount), parseFloat(totalAmount), paymentMethod, terms||'');
    const ad = db.prepare('SELECT * FROM p2p_ads WHERE id=?').get(id);
    res.status(201).json({ ad, message: 'Ad created successfully' });
  } catch(err) { res.status(500).json({ error: 'Failed to create ad' }); }
});

// POST /api/p2p/orders
router.post('/orders', authenticate, (req, res) => {
  try {
    const { adId, amount } = req.body;
    const db = getDb();
    const ad = db.prepare('SELECT a.*, u.id as ownerId FROM p2p_ads a JOIN users u ON a.userId=u.id WHERE a.id=?').get(adId);
    if (!ad) return res.status(404).json({ error: 'Ad not found' });
    if (ad.status !== 'ACTIVE') return res.status(400).json({ error: 'Ad is not active' });
    if (ad.userId === req.user.id) return res.status(400).json({ error: 'Cannot trade with yourself' });

    const orderAmount = parseFloat(amount);
    if (orderAmount < ad.minAmount || orderAmount > ad.maxAmount) {
      return res.status(400).json({ error: `Amount must be between ${ad.minAmount} and ${ad.maxAmount}` });
    }
    const sellerId = ad.type === 'SELL' ? ad.userId : req.user.id;
    const buyerId = ad.type === 'SELL' ? req.user.id : ad.userId;
    const total = orderAmount * ad.price;
    const id = generateId();
    db.prepare('INSERT INTO p2p_orders (id,adId,sellerId,buyerId,coin,price,amount,total) VALUES (?,?,?,?,?,?,?,?)').run(id, ad.id, sellerId, buyerId, ad.coin, ad.price, orderAmount, total);
    db.prepare('UPDATE p2p_ads SET availableAmount=availableAmount-? WHERE id=?').run(orderAmount, adId);
    const order = db.prepare('SELECT * FROM p2p_orders WHERE id=?').get(id);
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${sellerId}`).emit('p2p_order', { order });
      io.to(`user_${buyerId}`).emit('p2p_order', { order });
    }
    res.status(201).json({ order, message: 'P2P order created' });
  } catch(err) { res.status(500).json({ error: 'Failed to create P2P order' }); }
});

// GET /api/p2p/orders
router.get('/orders', authenticate, (req, res) => {
  try {
    const { status } = req.query;
    const db = getDb();
    let where = '(o.sellerId=? OR o.buyerId=?)';
    const params = [req.user.id, req.user.id];
    if (status) { where += ' AND o.status=?'; params.push(status); }
    const orders = db.prepare(`
      SELECT o.*, 
        s.username as sellerUsername, s.avatar as sellerAvatar,
        b.username as buyerUsername, b.avatar as buyerAvatar
      FROM p2p_orders o
      JOIN users s ON o.sellerId=s.id
      JOIN users b ON o.buyerId=b.id
      WHERE ${where}
      ORDER BY o.createdAt DESC
    `).all(...params);
    res.json({ orders });
  } catch(err) { res.status(500).json({ error: 'Failed to fetch orders' }); }
});

// GET /api/p2p/orders/:id
router.get('/orders/:id', authenticate, (req, res) => {
  try {
    const db = getDb();
    const order = db.prepare(`
      SELECT o.*,
        s.id as sellerId, s.username as sellerUsername, s.avatar as sellerAvatar,
        b.id as buyerId, b.username as buyerUsername, b.avatar as buyerAvatar
      FROM p2p_orders o
      JOIN users s ON o.sellerId=s.id
      JOIN users b ON o.buyerId=b.id
      WHERE o.id=?
    `).get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.sellerId !== req.user.id && order.buyerId !== req.user.id) return res.status(403).json({ error: 'Access denied' });

    const chats = db.prepare(`
      SELECT c.*, u.username as senderUsername, u.avatar as senderAvatar
      FROM p2p_chats c JOIN users u ON c.senderId=u.id
      WHERE c.orderId=? ORDER BY c.createdAt ASC
    `).all(req.params.id);
    res.json({ order: { ...order, chats } });
  } catch(err) { res.status(500).json({ error: 'Failed to fetch order' }); }
});

// PUT /api/p2p/orders/:id/status
router.put('/orders/:id/status', authenticate, (req, res) => {
  try {
    const { status } = req.body;
    const db = getDb();
    db.prepare('UPDATE p2p_orders SET status=? WHERE id=?').run(status, req.params.id);
    const io = req.app.get('io');
    if (io) io.to(`p2p_${req.params.id}`).emit('p2p_status', { orderId: req.params.id, status });
    res.json({ message: 'Order status updated', status });
  } catch(err) { res.status(500).json({ error: 'Failed to update order' }); }
});

// POST /api/p2p/orders/:id/chat
router.post('/orders/:id/chat', authenticate, (req, res) => {
  try {
    const { message } = req.body;
    const db = getDb();
    const order = db.prepare('SELECT * FROM p2p_orders WHERE id=?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.sellerId !== req.user.id && order.buyerId !== req.user.id) return res.status(403).json({ error: 'Access denied' });
    const id = generateId();
    db.prepare('INSERT INTO p2p_chats (id,orderId,senderId,message) VALUES (?,?,?,?)').run(id, order.id, req.user.id, message);
    const chat = db.prepare('SELECT c.*, u.username as senderUsername FROM p2p_chats c JOIN users u ON c.senderId=u.id WHERE c.id=?').get(id);
    const io = req.app.get('io');
    if (io) io.to(`p2p_${order.id}`).emit('p2p_chat', { chat });
    res.status(201).json({ chat });
  } catch(err) { res.status(500).json({ error: 'Failed to send message' }); }
});

module.exports = router;
