/**
 * Catch-all 404 handler for unmatched API routes.
 */
function notFoundHandler(req, res) {
  return res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

/**
 * Centralized Express JSON error handler.
 * Prevents unhandled rejections or HTML error responses from hanging Vercel serverless invocations.
 */
function errorHandler(err, _req, res, _next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let details;

  // Malformed JSON request payload
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    message = 'Malformed JSON request body.';
  }

  // Mongoose invalid ObjectId
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path || 'identifier'}: ${err.value}`;
  }

  // Mongoose schema validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    const errors = Object.values(err.errors || {}).map((e) => e.message);
    message = errors.join('; ') || 'Validation failed.';
    details = errors;
  }

  // MongoDB duplicate key constraint
  if (err.code === 11000) {
    statusCode = 409;
    const fields = Object.keys(err.keyValue || {});
    message = fields.length
      ? `Duplicate value for field: ${fields.join(', ')}`
      : 'Resource already exists.';
  }

  if (statusCode >= 500 && process.env.NODE_ENV !== 'test') {
    console.error('[Nexus API Error]', err);
  }

  return res.status(statusCode).json({
    success: false,
    message,
    ...(details ? { details } : {}),
    ...(process.env.NODE_ENV !== 'production' && statusCode >= 500
      ? { stack: err.stack }
      : {}),
  });
}

module.exports = { notFoundHandler, errorHandler };
