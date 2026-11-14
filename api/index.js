const app = require('../backend/app');
const { connectDB } = require('../backend/config/db');

/**
 * Vercel Serverless Function entry point.
 * Ensures the cached MongoDB Atlas connection is active before handing off to Express.
 */
module.exports = async (req, res) => {
  try {
    if (process.env.NODE_ENV !== 'test') {
      await connectDB();
    }
    return app(req, res);
  } catch (err) {
    console.error('[Vercel API Handler] Initialization error:', err.message);
    return res.status(503).json({
      success: false,
      message: 'Service temporarily unavailable: database initialization failed.',
      error: process.env.NODE_ENV === 'production' ? undefined : err.message,
    });
  }
};
