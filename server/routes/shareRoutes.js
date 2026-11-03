// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — Project Share Routes
// ═══════════════════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const shareController = require('../controllers/shareController');

// Resolving share token can be accessed publicly or with auth
router.get('/:token', shareController.getShare);
router.post('/:token/copy', shareController.copyShare);

module.exports = router;

