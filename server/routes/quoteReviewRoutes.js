// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — Public Head Commercial Review & Approval API (No Password)
// ═══════════════════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const clientQuoteController = require('../controllers/clientQuoteController');

router.get('/:reviewToken', clientQuoteController.getReviewByToken);
router.post('/:reviewToken/approve', clientQuoteController.approveReviewByToken);

module.exports = router;
