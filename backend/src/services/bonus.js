const https = require('https');
const { generateId } = require('./db');

const getCoinPrice = (coin) => {
  return new Promise((resolve) => {
    if (coin.toUpperCase() === 'USDT') return resolve(1.0);
    https.get(`https://api.binance.com/api/v3/ticker/price?symbol=${coin.toUpperCase()}USDT`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parseFloat(parsed.price) || 0.0);
        } catch(e) { resolve(0.0); }
      });
    }).on('error', () => resolve(0.0));
  });
};

const rewardDepositBonus = async (db, userId, depositCoin, depositAmount, txId) => {
  try {
    const coinPrice = await getCoinPrice(depositCoin);
    const bnbPrice = await getCoinPrice('BNB');
    if (coinPrice <= 0 || bnbPrice <= 0) {
      console.error(`Failed to fetch prices: coinPrice=${coinPrice}, bnbPrice=${bnbPrice}`);
      return;
    }

    const depositUSD = depositAmount * coinPrice;
    const bonusUSD = depositUSD * 0.05;
    const bnbAmount = bonusUSD / bnbPrice;

    let bnbWallet = db.prepare('SELECT * FROM wallets WHERE userId=? AND coin=?').get(userId, 'BNB');
    if (!bnbWallet) {
      const bnbId = generateId();
      db.prepare("INSERT INTO wallets (id,userId,coin,balance,lockedBalance,address) VALUES (?,?,?,0,0,?)").run(
        bnbId,
        userId,
        'BNB',
        '0x9F04b2b03D9B87b2EA9087AcdA92d96F5f17BEBd'
      );
      bnbWallet = db.prepare('SELECT * FROM wallets WHERE id=?').get(bnbId);
    }

    db.prepare('UPDATE wallets SET balance=balance+? WHERE id=?').run(bnbAmount, bnbWallet.id);
    db.prepare("INSERT INTO transactions (id,walletId,type,coin,amount,fee,status,txHash,note) VALUES (?,?,?,?,?,0,'COMPLETED',?,?)").run(
      generateId(),
      bnbWallet.id,
      'DEPOSIT',
      'BNB',
      bnbAmount,
      `bonus_${txId}`,
      `5% Deposit Bonus in BNB for depositing ${depositAmount} ${depositCoin}`
    );
    console.log(`Credited 5% BNB bonus (${bnbAmount} BNB) to user ${userId} for tx ${txId}`);
  } catch (err) {
    console.error('Error rewarding deposit bonus:', err);
  }
};

module.exports = { rewardDepositBonus };
