// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — Project CRUD Routes
// ═══════════════════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const shareController = require('../controllers/shareController');
const { requireAuth } = require('../middlewares/authMiddleware');

// Project CRUD endpoints require authentication
router.use(requireAuth);

router.get('/', projectController.getAll);
router.get('/:id', projectController.getById);
router.post('/', projectController.create);
router.put('/:id', projectController.update);
router.delete('/:id', projectController.delete);
router.post('/:id/fork', projectController.fork);
router.post('/:id/share', shareController.createShare);

module.exports = router;

