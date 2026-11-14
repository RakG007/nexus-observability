require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');

const { connectDB } = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const logRoutes = require('./routes/logRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const { notFoundHandler, errorHandler } = require('./middleware/errorMiddleware');

const app = express();

// Security & HTTP middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : true;

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Health check endpoint (does not block if DB is still warming up)
app.get('/api/health', (_req, res) => {
  const readyStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return res.status(200).json({
    success: true,
    service: 'Cipher Logiq — Nexus Observability API',
    developer: 'Rakshak Gupta',
    environment: process.env.NODE_ENV || 'development',
    dbState: readyStates[mongoose.connection.readyState] || 'unknown',
    timestamp: new Date().toISOString(),
  });
});

// Ensure cached MongoDB connection before executing API route controllers
app.use('/api', async (_req, _res, next) => {
  try {
    if (process.env.NODE_ENV !== 'test') {
      await connectDB();
    }
    return next();
  } catch (err) {
    return next(err);
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/analytics', analyticsRoutes);

// Centralized 404 & JSON error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Only bind a local port outside production & test environments
if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test' && require.main === module) {
  const PORT = Number(process.env.PORT) || 5001;
  connectDB()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`[Nexus API] Server listening on http://localhost:${PORT}`);
      });
    })
    .catch((err) => {
      console.error('[Nexus API] Failed to connect to MongoDB on startup:', err.message);
      process.exit(1);
    });
}

module.exports = app;
