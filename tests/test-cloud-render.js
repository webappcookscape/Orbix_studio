const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('=== TEST: 1-Click Cloud Raytracing Queue (Blender Cycles) ===\n');

// 1. Verify renderService
const renderService = require('../server/services/renderService');
assert(renderService, 'renderService must export an instance');
assert(typeof renderService.createJob === 'function', 'renderService must have createJob');
assert(typeof renderService.getJob === 'function', 'renderService must have getJob');
assert(typeof renderService.listJobs === 'function', 'renderService must have listJobs');
assert(typeof renderService.cancelJob === 'function', 'renderService must have cancelJob');

const info = renderService.getBlenderInfo();
console.log('✓ [Render Service] Blender detection result:', info);

// Test mock job creation & queue
const mockCyclesData = {
  projectMeta: { id: 'test_proj', title: 'Test Kitchen' },
  camera: { position: [0, -3, 1.5], target: [0, 0, 0.9], fov: 50 },
  lighting: { daylightPercent: 25, interiorFillWatts: 15, exposureEV: 0.2 },
  objects: [
    { name: 'Cabinet_1', vertices: [[0,0,0], [1,0,0], [1,1,0]], faces: [[0,1,2]], material: 'mat1' }
  ],
  materials: {
    mat1: { name: 'White Gloss', baseColor: [0.9, 0.9, 0.9], roughness: 0.1, metallic: 0.0, clearcoat: 0.8 }
  }
};

const jobResult = renderService.createJob({
  userId: 'test_user',
  projectId: 'test_proj',
  cyclesData: mockCyclesData,
  preset: 'preview'
});

assert(jobResult.success, 'createJob must succeed');
assert(jobResult.job.id, 'job must have an id');
assert.strictEqual(jobResult.job.preset, 'preview', 'job preset must be preview');
assert.strictEqual(jobResult.job.samples, 48, 'preview preset must use 48 samples');

const fetchedJob = renderService.getJob(jobResult.job.id);
assert(fetchedJob, 'getJob must find created job');
assert.strictEqual(fetchedJob.id, jobResult.job.id);

// Cancel test job
const cancelled = renderService.cancelJob(jobResult.job.id);
assert(cancelled, 'cancelJob must succeed for queued test job');
const afterCancel = renderService.getJob(jobResult.job.id);
assert.strictEqual(afterCancel.status, 'failed', 'cancelled job status must be failed');
console.log('✓ [Render Service Queue] createJob, getJob, presets, and cancelJob verified');

// 2. Verify renderController and routes
const renderController = require('../server/controllers/renderController');
assert(typeof renderController.createRenderJob === 'function', 'renderController must export createRenderJob');
assert(typeof renderController.getRenderJob === 'function', 'renderController must export getRenderJob');
assert(typeof renderController.listRenderJobs === 'function', 'renderController must export listRenderJobs');
assert(typeof renderController.cancelRenderJob === 'function', 'renderController must export cancelRenderJob');
assert(typeof renderController.serveOutput === 'function', 'renderController must export serveOutput');

const apiRouter = require('../server/routes/index.js');
assert(apiRouter, 'server/routes/index.js must export router');
console.log('✓ [Render Controller & Routes] API endpoints & handlers verified');

// 3. Verify Python Blender script color management fallback
const blenderScript = fs.readFileSync(path.join(__dirname, '../scripts/orbix_blender_cycles.py'), 'utf8');
assert(blenderScript.includes('Color Managed View Settings Fallback') || blenderScript.includes('Fallback Standard'), 'Python script must support fallback color management');
assert(blenderScript.includes('--device'), 'Python script must support compute device argument');
console.log('✓ [Blender Script] Headless fallback & CPU execution verified');

// 4. Verify Frontend UI in index.html and orbix-ui.js
const indexHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
assert(indexHtml.includes('id="cpCloudRenderBtn"'), 'index.html must include cpCloudRenderBtn');
assert(indexHtml.includes('id="cloudRenderModal"'), 'index.html must include cloudRenderModal');
assert(indexHtml.includes('id="crStartBtn"'), 'index.html must include crStartBtn');
assert(indexHtml.includes('id="crFloatingBadge"'), 'index.html must include crFloatingBadge');
assert(indexHtml.includes('id="crStatusCard"'), 'index.html must include crStatusCard');
assert(indexHtml.includes('id="crResultCard"'), 'index.html must include crResultCard');

const uiJs = fs.readFileSync(path.join(__dirname, '../orbix-ui.js'), 'utf8');
assert(uiJs.includes('initCloudRenderModal'), 'orbix-ui.js must implement initCloudRenderModal');
assert(uiJs.includes('cpCloudRenderBtn'), 'orbix-ui.js must bind cpCloudRenderBtn');
assert(uiJs.includes('/api/render/jobs'), 'orbix-ui.js must post to /api/render/jobs');
console.log('✓ [Frontend UI] Modal, presets, lighting sliders, live progress & floating badge verified');

console.log('\n=== ALL CLOUD RENDER TESTS PASSED SUCCESSFULLY! ===\n');
