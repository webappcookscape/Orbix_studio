// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — Client Quote Management Routes (Authenticated Designer / Admin)
// ═══════════════════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const clientQuoteController = require('../controllers/clientQuoteController');
const { requireAuth } = require('../middlewares/authMiddleware');

router.use(requireAuth);

router.post('/', clientQuoteController.createQuote);
router.post('/export-pptx', clientQuoteController.exportPptx);
router.get('/project/:projectId', clientQuoteController.listByProject);
router.patch('/:quoteId', clientQuoteController.updateQuote);
router.delete('/:quoteId', clientQuoteController.deleteQuote);

module.exports = router;
