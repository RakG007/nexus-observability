const mongoose = require('mongoose');

/**
 * Global connection cache across Vercel Serverless Function warm invocations.
 * Avoids exhausting MongoDB Atlas connection pools during concurrent cold starts.
 */
let cached = global.__nexusMongooseCache;
if (!cached) {
  cached = global.__nexusMongooseCache = { conn: null, promise: null };
}

/**
 * Connects to MongoDB using a cached promise/connection handle.
 * @param {string} [overrideUri] - Optional connection URI (used in automated tests).
 * @returns {Promise<typeof mongoose>}
 */
async function connectDB(overrideUri) {
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  const uri = overrideUri || process.env.MONGODB_URI;
  if (!uri) {
    const err = new Error('MONGODB_URI environment variable is not configured.');
    err.statusCode = 503;
    throw err;
  }

  if (!cached.promise) {
    mongoose.set('strictQuery', true);
    cached.promise = mongoose
      .connect(uri, {
        bufferCommands: false,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      })
      .then((mongooseInstance) => mongooseInstance)
      .catch((err) => {
        // Clear failed promise so future invocations can retry cleanly.
        cached.promise = null;
        cached.conn = null;
        throw err;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

/**
 * Clears cached handles (primarily for test teardown).
 */
function resetDBCache() {
  cached.conn = null;
  cached.promise = null;
}

module.exports = { connectDB, resetDBCache };
