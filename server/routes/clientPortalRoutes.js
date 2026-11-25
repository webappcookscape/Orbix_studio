// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — Protected Client Quote Portal API Routes (Session-Isolated)
// ═══════════════════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const clientQuoteController = require('../controllers/clientQuoteController');

// Helper: Resolve Real Client IP Behind Cloudflare & Nginx
function resolveClientIp(req) {
  const cf = req.headers['cf-connecting-ip'];
  if (cf && typeof cf === 'string' && cf.trim()) return cf.trim();
  const xReal = req.headers['x-real-ip'];
  if (xReal && typeof xReal === 'string' && xReal.trim()) return xReal.trim();
  const xff = req.headers['x-forwarded-for'];
  if (xff && typeof xff === 'string') {
    const first = xff.split(',')[0].trim();
    if (first) return first;
  }
  return req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
}

// Per-IP + token brute-force protection on client portal login
const portalLoginAttempts = new Map();
const PORTAL_WINDOW_MS = 5 * 60 * 1000;
const MAX_PORTAL_FAILS = 15;

function rateLimitPortalLogin(req, res, next) {
  const clientIp = resolveClientIp(req);
  const key = `${clientIp}:${req.params.token || ''}`;
  const now = Date.now();
  const entry = portalLoginAttempts.get(key);
  if (entry) {
    if (entry.resetAt <= now) {
      portalLoginAttempts.delete(key);
    } else if (entry.count >= MAX_PORTAL_FAILS) {
      const waitSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      return res.status(429).json({
        success: false,
        error: `Too many failed login attempts. Please wait ${waitSec} seconds and try again.`
      });
    }
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
