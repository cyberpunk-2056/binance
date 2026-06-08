const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

if (!process.env.JWT_SECRET) {
  console.error('\n❌ ERROR: JWT_SECRET environment variable is not defined!');
  console.error('This usually means the .env file was not found or is empty.');
  console.error(`Attempted to load .env from: ${path.join(__dirname, '../../.env')}\n`);
  process.exit(1);
}

const bcrypt = require('bcryptjs');
const { getDb, generateId } = require('./db');

async function seed() {
  console.log('🌱 Seeding database...');
  const db = getDb();

  // Admin user
  const adminPassword = await bcrypt.hash('admin123456', 12);
  const existingAdmin = db.prepare('SELECT id FROM users WHERE email=?').get('admin@binance-clone.com');
  if (!existingAdmin) {
    const adminId = generateId();
    db.prepare('INSERT INTO users (id,email,username,password,firstName,lastName,role,status,kycStatus,emailVerified,referralCode) VALUES (?,?,?,?,?,?,?,?,?,1,?)')
      .run(adminId, 'admin@binance-clone.com', 'admin', adminPassword, 'Admin', 'User', 'ADMIN', 'ACTIVE', 'APPROVED', 'ADMIN001');

    const adminWallets = [{ coin: 'USDT', balance: 1000000 }, { coin: 'BTC', balance: 10 }, { coin: 'ETH', balance: 100 }, { coin: 'BNB', balance: 500 }];
    for (const w of adminWallets) {
      db.prepare('INSERT INTO wallets (id,userId,coin,balance,address) VALUES (?,?,?,?,?)').run(generateId(), adminId, w.coin, w.balance, '0x9F04b2b03D9B87b2EA9087AcdA92d96F5f17BEBd');
    }
    console.log('✅ Admin user created');
  } else {
    console.log('ℹ️  Admin already exists');
  }

  // Demo user
  const userPassword = await bcrypt.hash('user123456', 12);
  const existingDemo = db.prepare('SELECT id FROM users WHERE email=?').get('demo@binance-clone.com');
  if (!existingDemo) {
    const demoId = generateId();
    db.prepare('INSERT INTO users (id,email,username,password,firstName,lastName,role,status,kycStatus,emailVerified,referralCode) VALUES (?,?,?,?,?,?,?,?,?,1,?)')
      .run(demoId, 'demo@binance-clone.com', 'demouser', userPassword, 'Demo', 'Trader', 'USER', 'ACTIVE', 'APPROVED', 'DEMO001');

    const demoWallets = [
      { coin: 'USDT', balance: 50000 }, { coin: 'BTC', balance: 0.5 },
      { coin: 'ETH', balance: 5 }, { coin: 'BNB', balance: 50 },
      { coin: 'SOL', balance: 100 }, { coin: 'ADA', balance: 5000 },
      { coin: 'DOGE', balance: 10000 }, { coin: 'XRP', balance: 3000 },
    ];
    for (const w of demoWallets) {
      db.prepare('INSERT INTO wallets (id,userId,coin,balance,address) VALUES (?,?,?,?,?)').run(generateId(), demoId, w.coin, w.balance, '0x9F04b2b03D9B87b2EA9087AcdA92d96F5f17BEBd');
    }

    // Demo P2P ads
    db.prepare('INSERT INTO p2p_ads (id,userId,type,coin,currency,price,minAmount,maxAmount,totalAmount,availableAmount,paymentMethod,terms) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(generateId(), demoId, 'SELL', 'BTC', 'USD', 67500, 0.001, 0.1, 0.1, 0.1, 'Bank Transfer', 'Fast release within 15 min.');
    db.prepare('INSERT INTO p2p_ads (id,userId,type,coin,currency,price,minAmount,maxAmount,totalAmount,availableAmount,paymentMethod,terms) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(generateId(), demoId, 'BUY', 'USDT', 'USD', 1.0, 100, 5000, 5000, 5000, 'PayPal', 'Send payment first.');
    console.log('✅ Demo user created');
  } else {
    console.log('ℹ️  Demo user already exists');
  }

  // Announcements
  const annCount = db.prepare('SELECT COUNT(*) as c FROM announcements').get().c;
  if (annCount === 0) {
    db.prepare('INSERT INTO announcements (id,title,content,type) VALUES (?,?,?,?)').run(generateId(), '🎉 Welcome to Binance Clone!', 'Start trading with $50,000 USDT demo balance. All trades are simulated.', 'SUCCESS');
    db.prepare('INSERT INTO announcements (id,title,content,type) VALUES (?,?,?,?)').run(generateId(), '⚡ Real-time Price Data', 'Live prices are powered by Binance public API. Charts update in real-time.', 'INFO');
    db.prepare('INSERT INTO announcements (id,title,content,type) VALUES (?,?,?,?)').run(generateId(), '🔐 Security Reminder', 'Enable 2FA for extra account security. Never share your credentials.', 'WARNING');
    console.log('✅ Announcements created');
  }

  console.log('\n✅ Database seeded successfully!');
  console.log('\n📋 Demo Credentials:');
  console.log('  Admin: admin@binance-clone.com / admin123456');
  console.log('  User:  demo@binance-clone.com / user123456');
}

seed().catch(console.error);
