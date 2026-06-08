const express = require('express');
const { getDb, generateId } = require('../services/db');
const { rewardDepositBonus } = require('../services/bonus');
const router = express.Router();

router.get('/', (req, res) => {
  const db = getDb();
  const wallets = db.prepare('SELECT * FROM wallets WHERE userId=? ORDER BY coin').all(req.user.id);
  res.json({ wallets });
});

router.get('/transactions', (req, res) => {
  try {
    const { coin, type, page = 1, limit = 20 } = req.query;
    const db = getDb();
    const wallets = db.prepare('SELECT id FROM wallets WHERE userId=?').all(req.user.id);
    if (!wallets.length) return res.json({ transactions: [], total: 0 });
    
    const ids = wallets.map(w => `'${w.id}'`).join(',');
    let where = `walletId IN (${ids})`;
    if (type) where += ` AND type='${type}'`;
    if (coin) where += ` AND coin='${coin}'`;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const transactions = db.prepare(`SELECT * FROM transactions WHERE ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`).all(parseInt(limit), skip);
    const { total } = db.prepare(`SELECT COUNT(*) as total FROM transactions WHERE ${where}`).get();
    res.json({ transactions, total, page: parseInt(page), limit: parseInt(limit) });
  } catch(err) { res.status(500).json({ error: 'Failed to fetch transactions' }); }
});

router.post('/deposit', (req, res) => {
  try {
    const { coin, amount } = req.body;
    if (!coin || !amount || amount <= 0) return res.status(400).json({ error: 'Invalid deposit' });
    const db = getDb();
    let wallet = db.prepare('SELECT * FROM wallets WHERE userId=? AND coin=?').get(req.user.id, coin);
    if (!wallet) {
      const wId = generateId();
      db.prepare('INSERT INTO wallets (id, userId, coin, balance, lockedBalance, address) VALUES (?,?,?,0,0,?)').run(wId, req.user.id, coin, '0x9F04b2b03D9B87b2EA9087AcdA92d96F5f17BEBd');
      wallet = db.prepare('SELECT * FROM wallets WHERE id=?').get(wId);
    }

    const setting = db.prepare("SELECT value FROM settings WHERE key='auto_approve_deposits'").get();
    const autoApprove = setting && setting.value === 'true';

    if (autoApprove) {
      db.prepare('UPDATE wallets SET balance=balance+? WHERE id=?').run(parseFloat(amount), wallet.id);
      const txId = generateId();
      db.prepare("INSERT INTO transactions (id,walletId,type,coin,amount,fee,status,txHash,note) VALUES (?,?,?,?,?,0,'COMPLETED',?,?)").run(txId, wallet.id, 'DEPOSIT', coin, parseFloat(amount), `demo_${Date.now()}`, 'Simulated deposit (Auto-Approved)');
      
      // Credit BNB deposit bonus asynchronously
      rewardDepositBonus(db, req.user.id, coin, parseFloat(amount), txId);

      res.json({ message: `Simulated deposit of ${amount} ${coin} completed successfully!` });
    } else {
      db.prepare("INSERT INTO transactions (id,walletId,type,coin,amount,fee,status,txHash,note) VALUES (?,?,?,?,?,0,'PENDING',?,?)").run(generateId(), wallet.id, 'DEPOSIT', coin, parseFloat(amount), `demo_${Date.now()}`, 'Simulated deposit (Pending Admin Approval)');
      res.json({ message: `Deposit request of ${amount} ${coin} submitted and pending admin approval.` });
    }
  } catch(err) { res.status(500).json({ error: 'Deposit failed' }); }
});

router.post('/withdraw', (req, res) => {
  try {
    const { coin, amount, address } = req.body;
    if (!coin || !amount || amount <= 0 || !address) return res.status(400).json({ error: 'Invalid withdrawal' });
    const db = getDb();
    const wallet = db.prepare('SELECT * FROM wallets WHERE userId=? AND coin=?').get(req.user.id, coin);
    if (!wallet || wallet.balance < parseFloat(amount)) return res.status(400).json({ error: 'Insufficient balance' });
    const fee = parseFloat(amount) * 0.001;
    db.prepare('UPDATE wallets SET balance=balance-?, lockedBalance=lockedBalance+? WHERE id=?').run(parseFloat(amount), parseFloat(amount), wallet.id);
    db.prepare("INSERT INTO transactions (id,walletId,type,coin,amount,fee,status,txHash,note) VALUES (?,?,?,?,?,?,'PENDING',?,?)").run(generateId(), wallet.id, 'WITHDRAW', coin, parseFloat(amount), fee, `demo_${Date.now()}`, `Withdrawal to ${address} (Pending Admin Approval)`);
    res.json({ message: `Withdrawal of ${amount} ${coin} initiated and pending admin approval.` });
  } catch(err) { res.status(500).json({ error: 'Withdrawal failed' }); }
});

module.exports = router;
