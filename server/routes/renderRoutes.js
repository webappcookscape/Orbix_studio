// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — Cloud Raytracing Render Routes
// ═══════════════════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const renderController = require('../controllers/renderController');

// Blender availability & status
router.get('/status', renderController.getBlenderStatus);

// Job lifecycle
router.post('/jobs', renderController.createRenderJob);
router.get('/jobs', renderController.listRenderJobs);
router.get('/jobs/:id', renderController.getRenderJob);
router.post('/jobs/:id/cancel', renderController.cancelRenderJob);

// Output image serving & downloading
router.get('/output/:filename', renderController.serveOutput);

module.exports = router;
