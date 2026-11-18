// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — AI Photorealistic Render Routes
// ═══════════════════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { requireAuth } = require('../middlewares/authMiddleware');

router.use(requireAuth);

router.post('/render', aiController.renderAI);
router.get('/config', aiController.getAIConfig);
router.get('/key', aiController.getAIKey);

module.exports = router;
