// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — Cloud Raytracing Render Controller
// ═══════════════════════════════════════════════════════════════════════════════

const path = require('path');
const fs = require('fs');
const renderService = require('../services/renderService');

exports.getBlenderStatus = (req, res) => {
  const info = renderService.getBlenderInfo();
  res.json({
    success: true,
    ...info
  });
};

exports.createRenderJob = (req, res) => {
  try {
    const { cyclesData, preset, lighting, projectId } = req.body || {};
    const userId = req.user ? req.user.id : (req.session && req.session.userId ? req.session.userId : (req.headers['x-user-id'] || 'anonymous'));

    if (!cyclesData) {
      return res.status(400).json({
        success: false,
        error: 'Missing cyclesData in request body.'
      });
    }

    const result = renderService.createJob({
      userId,
      projectId: projectId || (cyclesData.projectMeta && cyclesData.projectMeta.id) || 'current',
      cyclesData,
      preset: preset || 'preview',
      lighting
    });

    res.status(202).json({
      success: true,
      job: result.job,
      queuePosition: result.queuePosition
    });
  } catch (err) {
    console.error('[RenderController] Create job error:', err.message);
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
};

exports.getRenderJob = (req, res) => {
  const jobId = req.params.id;
  const job = renderService.getJob(jobId);
  if (!job) {
    return res.status(404).json({
      success: false,
      error: 'Render job not found.'
    });
  }
  res.json({
    success: true,
    job
  });
};

exports.listRenderJobs = (req, res) => {
  const userId = req.user ? req.user.id : (req.session && req.session.userId ? req.session.userId : (req.headers['x-user-id'] || 'anonymous'));
  const projectId = req.query.projectId;
  const jobs = renderService.listJobs(userId, projectId);
  res.json({
    success: true,
    jobs
  });
};

exports.cancelRenderJob = (req, res) => {
  const jobId = req.params.id;
  const success = renderService.cancelJob(jobId);
  res.json({
    success,
    message: success ? 'Render job cancelled.' : 'Could not cancel job (not found or already completed).'
  });
};

exports.serveOutput = (req, res) => {
  const filename = req.params.filename;
  const filePath = renderService.getOutputFilePath(filename);
  if (!filePath) {
    return res.status(404).json({
      success: false,
      error: 'Render image not found or not yet ready.'
    });
  }

  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day cache
  const isDownload = req.query.download === '1' || req.query.dl === '1';
  if (isDownload) {
    res.setHeader('Content-Disposition', `attachment; filename="orbix-cycles-${filename}"`);
  } else {
    res.setHeader('Content-Disposition', `inline; filename="orbix-cycles-${filename}"`);
  }

  fs.createReadStream(filePath).pipe(res);
};
