// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — Auth Routes
// ═══════════════════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.get('/status', authController.getStatus);
router.get('/me', authController.getCurrentUser);
router.post('/login', authController.login);
router.post('/logout', authController.logout);

module.exports = router;

