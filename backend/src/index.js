const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

if (!process.env.JWT_SECRET) {
  console.error('\n❌ ERROR: JWT_SECRET environment variable is not defined!');
  console.error('This usually means the .env file was not found or is empty.');
  console.error(`Attempted to load .env from: ${path.join(__dirname, '../.env')}\n`);
  process.exit(1);
}

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const marketsRoutes = require('./routes/markets');
const ordersRoutes = require('./routes/orders');
const p2pRoutes = require('./routes/p2p');
const adminRoutes = require('./routes/admin');
const walletRoutes = require('./routes/wallet');
const notificationRoutes = require('./routes/notifications');

const { initBinanceWS } = require('./services/binanceWS');
const { authenticate } = require('./middleware/auth');
const { getDb } = require('./services/db');
// Initialize DB tables on startup
getDb();

const app = express();
const server = http.createServer(app);

const frontendOrigin = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');

const io = new Server(server, {
  cors: {
    origin: frontendOrigin,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Make io available globally
app.set('io', io);

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: frontendOrigin,
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many auth attempts, please try again later.' }
});

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/user', authenticate, userRoutes);
app.use('/api/markets', marketsRoutes);
app.use('/api/orders', authenticate, ordersRoutes);
app.use('/api/p2p', p2pRoutes);
app.use('/api/admin', authenticate, adminRoutes);
app.use('/api/wallet', authenticate, walletRoutes);
app.use('/api/notifications', authenticate, notificationRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('subscribe', (channels) => {
    if (Array.isArray(channels)) {
      channels.forEach(channel => socket.join(channel));
    }
  });

  socket.on('unsubscribe', (channels) => {
    if (Array.isArray(channels)) {
      channels.forEach(channel => socket.leave(channel));
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`\n🚀 Binance Clone Backend running on port ${PORT}`);
  console.log(`📊 API: http://localhost:${PORT}/api`);
  console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
  
  // Initialize Binance WebSocket proxy
  initBinanceWS(io);
});

module.exports = { app, server, io };
