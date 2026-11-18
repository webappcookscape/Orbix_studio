// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — Project Share Routes
// ═══════════════════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const shareController = require('../controllers/shareController');
const { requireAuth } = require('../middlewares/authMiddleware');

// Reading a shared preview link can be accessed with the opaque share token; creating a workspace copy requires login
router.get('/:token', shareController.getShare);
router.post('/:token/copy', requireAuth, shareController.copyShare);

module.exports = router;

