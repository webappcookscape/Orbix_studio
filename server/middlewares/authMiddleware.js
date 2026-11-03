// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — Authentication & Authorization Middleware
// ═══════════════════════════════════════════════════════════════════════════════

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Valid session required. Please sign in.'
    });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Administrator privileges required.'
    });
  }
  next();
}

module.exports = {
  requireAuth,
  requireAdmin
};

