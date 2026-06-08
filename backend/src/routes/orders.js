const express = require('express');
const { getDb, generateId } = require('../services/db');
const router = express.Router();

// POST /api/orders
// amount is ALWAYS the base coin quantity (e.g., 0.001 BTC).
// For Market BUY the frontend converts "USDT total / price" → coinQty before sending.
router.post('/', (req, res) => {
  try {
    const { pair, type, side, price, amount, marketPrice } = req.body;

    if (!pair || !type || !side || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const base    = pair.replace('USDT', '');
    const quote   = 'USDT';
    const isMarket = type === 'MARKET';
    const coinQty  = parseFloat(amount);
    const mktPrice = parseFloat(marketPrice || 0);

    // Determine execution price
    let execPrice;
    if (isMarket) {
      execPrice = mktPrice;
      if (!execPrice || execPrice <= 0) {
        return res.status(400).json({ error: 'Invalid market price' });
      }
    } else {
      // LIMIT or STOP_LIMIT
      execPrice = parseFloat(price);
      if (!execPrice || execPrice <= 0) {
        return res.status(400).json({ error: 'Limit price must be greater than 0' });
      }
    }

    if (!coinQty || coinQty <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }

    const usdtTotal = execPrice * coinQty;

    if (usdtTotal < 1) {
      return res.status(400).json({ error: 'Order total must be at least 1 USDT' });
    }

    const db = getDb();

    // --- Determine whether limit order fills immediately ---
    // LIMIT BUY  fills now if execPrice >= mktPrice  (willing to pay at/above market)
    // LIMIT SELL fills now if execPrice <= mktPrice  (willing to sell at/below market)
    const fillsNow = isMarket
      ? true
      : side === 'BUY'
        ? execPrice >= mktPrice
        : execPrice <= mktPrice;

    const orderStatus = fillsNow ? 'FILLED' : 'OPEN';

    // --- Source coin / amount to reserve or deduct ---
    const sourceCoin   = side === 'BUY' ? quote : base;
    const sourceAmount = side === 'BUY' ? usdtTotal : coinQty;

    const sourceWallet = db.prepare('SELECT * FROM wallets WHERE userId=? AND coin=?').get(req.user.id, sourceCoin);
    if (!sourceWallet || sourceWallet.balance < sourceAmount) {
      return res.status(400).json({ error: `Insufficient ${sourceCoin} balance` });
    }

    // Always deduct/reserve from source
    db.prepare('UPDATE wallets SET balance=balance-? WHERE id=?').run(sourceAmount, sourceWallet.id);

    let filledQty = 0;

    if (fillsNow) {
      // Credit destination — apply 0.1% fee deducted from what you receive
      const FEE_RATE   = 0.001;
      const destCoin   = side === 'BUY' ? base : quote;
      const rawReceive = side === 'BUY' ? coinQty : usdtTotal;
      const fee        = rawReceive * FEE_RATE;
      const netReceive = rawReceive - fee;

      let destWallet = db.prepare('SELECT * FROM wallets WHERE userId=? AND coin=?').get(req.user.id, destCoin);
      if (!destWallet) {
        const wId = generateId();
        const addr = `${destCoin.toLowerCase()}1${generateId().replace(/-/g, '').substring(0, 26)}`;
        db.prepare('INSERT INTO wallets (id,userId,coin,balance,address) VALUES (?,?,?,0,?)').run(wId, req.user.id, destCoin, addr);
        destWallet = db.prepare('SELECT * FROM wallets WHERE id=?').get(wId);
      }
      db.prepare('UPDATE wallets SET balance=balance+? WHERE id=?').run(netReceive, destWallet.id);

      filledQty = coinQty;

      // Transaction log
      db.prepare(`INSERT INTO transactions (id,walletId,type,coin,amount,fee,status,note) VALUES (?,?,?,?,?,?,'COMPLETED',?)`)
        .run(generateId(), sourceWallet.id, 'TRADE', sourceCoin, sourceAmount, fee,
          `${side} ${coinQty.toFixed(8)} ${base} @ ${execPrice} | fee: ${fee.toFixed(8)} ${destCoin}`);
    }

    // Create order record
    const orderId = generateId();
    db.prepare(`INSERT INTO orders (id,userId,pair,type,side,price,amount,filled,status) VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(orderId, req.user.id, pair, type, side, execPrice, coinQty, filledQty, orderStatus);

    const order = db.prepare('SELECT * FROM orders WHERE id=?').get(orderId);

    const io = req.app.get('io');
    if (io) io.to(`user_${req.user.id}`).emit('order_update', { order });

    const msg = fillsNow
      ? `Order filled: ${side} ${coinQty.toFixed(6)} ${base} @ $${execPrice.toLocaleString()}`
      : `Limit order placed: waiting for price to reach $${execPrice.toLocaleString()}`;

    res.status(201).json({ order, message: msg });
  } catch (err) {
    console.error('Order error:', err);
    res.status(500).json({ error: 'Failed to place order' });
  }
});

// GET /api/orders
router.get('/', (req, res) => {
  try {
    const { status, pair, page = 1, limit = 20 } = req.query;
    const db   = getDb();
    const skip = (parseInt(page) - 1) * parseInt(limit);
    let where   = 'userId=?';
    const params = [req.user.id];
    if (status) { where += ' AND status=?'; params.push(status); }
    if (pair)   { where += ' AND pair=?';   params.push(pair); }
    const orders = db.prepare(`SELECT * FROM orders WHERE ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`).all(...params, parseInt(limit), skip);
    const { total } = db.prepare(`SELECT COUNT(*) as total FROM orders WHERE ${where}`).get(...params);
    res.json({ orders, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// DELETE /api/orders/:id  — cancel an open limit order and refund source
router.delete('/:id', (req, res) => {
  try {
    const db    = getDb();
    const order = db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    if (order.status !== 'OPEN') return res.status(400).json({ error: 'Cannot cancel this order' });

    // Refund the reserved source balance
    const base         = order.pair.replace('USDT', '');
    const sourceCoin   = order.side === 'BUY' ? 'USDT' : base;
    const unfilled     = order.amount - order.filled;
    const refundAmount = order.side === 'BUY'
      ? unfilled * order.price   // USDT reserved
      : unfilled;                // coin reserved

    const sourceWallet = db.prepare('SELECT * FROM wallets WHERE userId=? AND coin=?').get(req.user.id, sourceCoin);
    if (sourceWallet && refundAmount > 0) {
      db.prepare('UPDATE wallets SET balance=balance+? WHERE id=?').run(refundAmount, sourceWallet.id);
    }

    db.prepare("UPDATE orders SET status='CANCELLED' WHERE id=?").run(req.params.id);
    res.json({ message: 'Order cancelled and funds refunded' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel order' });
  }
});

module.exports = router;
