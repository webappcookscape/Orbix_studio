// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — Global Error Handler Middleware
// ═══════════════════════════════════════════════════════════════════════════════

function errorHandler(err, req, res, next) {
  console.error(`[Error] ${req.method} ${req.url}:`, err.message || err);

  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
  });
}

module.exports = errorHandler;

