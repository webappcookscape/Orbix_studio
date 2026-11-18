// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — Protected Client Quote Portal API Routes (Session-Isolated)
// ═══════════════════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const clientQuoteController = require('../controllers/clientQuoteController');

// Per-IP + token brute-force protection on client portal login
const portalLoginAttempts = new Map();
const PORTAL_WINDOW_MS = 15 * 60 * 1000;
const MAX_PORTAL_FAILS = 15;

function rateLimitPortalLogin(req, res, next) {
  const key = `${req.ip || 'unknown'}:${req.params.token || ''}`;
  const now = Date.now();
  const entry = portalLoginAttempts.get(key);
  if (entry && entry.resetAt > now && entry.count >= MAX_PORTAL_FAILS) {
    return res.status(429).json({
      success: false,
      error: 'Too many failed login attempts. Please wait a few minutes and try again.'
    });
  }
  res.on('finish', () => {
    const t = Date.now();
    if (res.statusCode === 200) {
      portalLoginAttempts.delete(key);
    } else if (res.statusCode === 401 || res.statusCode === 400) {
      const cur = portalLoginAttempts.get(key);
      if (!cur || cur.resetAt <= t) {
        portalLoginAttempts.set(key, { count: 1, resetAt: t + PORTAL_WINDOW_MS });
      } else {
        cur.count += 1;
      }
    }
  });
  next();
}

router.get('/:token/info', clientQuoteController.getPortalInfo);
router.post('/:token/login', rateLimitPortalLogin, clientQuoteController.loginPortal);
router.post('/:token/logout', clientQuoteController.logoutPortal);
router.get('/:token/payload', clientQuoteController.getPortalPayload);
router.get('/:token/asset/:assetKey', clientQuoteController.getPortalAsset);
router.post('/:token/audit', clientQuoteController.postAuditEvent);

module.exports = router;
