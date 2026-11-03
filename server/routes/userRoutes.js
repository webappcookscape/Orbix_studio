// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — User CRUD Routes
// ═══════════════════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { requireAuth, requireAdmin } = require('../middlewares/authMiddleware');

// All user routes require authentication
router.use(requireAuth);

router.get('/', userController.getAll);
router.get('/:id', userController.getById);
router.post('/', requireAdmin, userController.create);
router.put('/:id', requireAdmin, userController.update);
router.delete('/:id', requireAdmin, userController.delete);

module.exports = router;
