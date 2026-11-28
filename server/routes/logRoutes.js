// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — Application Logs Routes (Strictly admin@cookscape.com ONLY)
// View List & Delete ONLY (NO Edit endpoints).
// ═══════════════════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const logController = require('../controllers/logController');
const { requireAuth } = require('../middlewares/authMiddleware');

const ALLOWED_LOGS_EMAIL = 'admin@cookscape.com';

function requirePrimaryAdminEmail(req, res, next) {
  const email = String((req.user && req.user.email) || '').trim().toLowerCase();
  if (!req.user || email !== ALLOWED_LOGS_EMAIL) {
    return res.status(403).json({
      success: false,
      error: 'Access restricted: Application Logs are available exclusively for admin@cookscape.com.'
    });
  }
  next();
}

router.use(requireAuth, requirePrimaryAdminEmail);

router.get('/', logController.listLogs);
router.delete('/:id', logController.deleteLog);
router.delete('/', logController.bulkDeleteLogs);

module.exports = router;
