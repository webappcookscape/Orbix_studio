// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — Centralized API Router
// ═══════════════════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const projectRoutes = require('./projectRoutes');
const shareRoutes = require('./shareRoutes');
const aiRoutes = require('./aiRoutes');
const clientQuoteRoutes = require('./clientQuoteRoutes');
const clientPortalRoutes = require('./clientPortalRoutes');
const quoteReviewRoutes = require('./quoteReviewRoutes');
const renderRoutes = require('./renderRoutes');
const logRoutes = require('./logRoutes');

// Mount Sub-Routers
router.use('/', authRoutes);
router.use('/users', userRoutes);
router.use('/projects', projectRoutes);
router.use('/share', shareRoutes);
router.use('/ai', aiRoutes);
router.use('/client-quotes', clientQuoteRoutes);
router.use('/client-portal', clientPortalRoutes);
router.use('/quote-review', quoteReviewRoutes);
router.use('/render', renderRoutes);
router.use('/logs', logRoutes);

module.exports = router;

