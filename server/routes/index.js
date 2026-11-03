// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — Centralized API Router
// ═══════════════════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const projectRoutes = require('./projectRoutes');
const shareRoutes = require('./shareRoutes');

// Mount Sub-Routers
router.use('/', authRoutes);
router.use('/users', userRoutes);
router.use('/projects', projectRoutes);
router.use('/share', shareRoutes);

module.exports = router;

