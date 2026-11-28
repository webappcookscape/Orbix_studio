// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — Client Quote Management Routes (Authenticated Designer / Admin)
// ═══════════════════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const clientQuoteController = require('../controllers/clientQuoteController');
const { requireAuth } = require('../middlewares/authMiddleware');

router.use(requireAuth);

router.get('/whatsapp-status', clientQuoteController.getWhatsappStatus);
router.get('/history', clientQuoteController.getQuoteHistory);
router.post('/test-whatsapp', clientQuoteController.sendTestWhatsappAlert);
router.post('/review', clientQuoteController.createReviewQuote);
router.post('/', clientQuoteController.createQuote);
router.post('/export-pptx', clientQuoteController.exportPptx);
router.post('/export-pdf', clientQuoteController.exportPdf);
router.get('/project/:projectId', clientQuoteController.listByProject);
router.post('/:quoteId/activate-client-link', clientQuoteController.activateClientLink);
router.post('/:quoteId/export-pptx', clientQuoteController.exportQuotePptxById);
router.post('/:quoteId/export-pdf', clientQuoteController.exportQuotePdfById);
router.patch('/:quoteId', clientQuoteController.updateQuote);
router.delete('/:quoteId', clientQuoteController.deleteQuote);

module.exports = router;
