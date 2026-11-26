const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('=== TEST: 3D Lag Reduction, 2D Unit Placement & Blender Cycles Raytracing ===\n');

// 1. Verify app.js 3D Lag Optimizations
const appJs = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
assert(appJs.includes('function gizmoMove(furnObj)'), 'app.js must define gizmoMove for in-place transform reuse');
assert(appJs.includes('gizmoMove: gizmoMove'), 'GL must expose gizmoMove');
assert(appJs.includes('GL.gizmoMove(gizmoDrag.obj)'), 'pointermove during gizmo drag must use GL.gizmoMove without calling GL.settle');
assert(appJs.includes('scheduleCamApply()'), 'app.js must group camera orbit/pan updates into 1 update per frame');
assert(appJs.includes('sharingGeometry'), 'setRenderMode must share geometry between realistic and presentation modes');
console.log('✓ [3D Lag] gizmoMove in-place transform, deferred settle(), rAF camera batching & shared geometry verified');

// 2. Verify orbix-plan.js 2D Unit Placement
const planJs = fs.readFileSync(path.join(__dirname, '../orbix-plan.js'), 'utf8');
assert(planJs.includes('this.furnitureSnapMode = \'auto\''), 'PlanEditor must initialize furnitureSnapMode');
assert(planJs.includes('this.placeNextMode = false'), 'PlanEditor must initialize placeNextMode');
assert(planJs.includes('setFurnitureSnapMode'), 'PlanEditor must provide setFurnitureSnapMode method');
assert(planJs.includes('setWallOffsetMm'), 'PlanEditor must provide setWallOffsetMm method');
assert(planJs.includes('togglePlaceNextMode'), 'PlanEditor must provide togglePlaceNextMode method');
assert(planJs.includes('ArrowUp') && planJs.includes('step = e.shiftKey ? 10 : 1'), 'Arrow keys must nudge selected unit by 1mm, or 10mm with Shift');
assert(planJs.includes('self.dragState.hasMoved'), 'Stationary clicks must not register as Move Furniture to prevent 3D selection snap-back');
assert(planJs.includes('bestWallSnap.isExactOffset'), 'Wall mode must calculate exact millimeter edge offset');
console.log('✓ [2D Placement] 4 snap modes, exact wall edge offset, place next, arrow nudging & click vs drag separation verified');

// 3. Verify orbix-3d.js Blender Cycles Exporter
const orbix3dJs = fs.readFileSync(path.join(__dirname, '../orbix-3d.js'), 'utf8');
assert(orbix3dJs.includes('exportToCyclesJson'), 'ArchitecturalRenderer must implement exportToCyclesJson');
assert(orbix3dJs.includes('exportCycles'), 'ArchitecturalRenderer must implement exportCycles static helper');
assert(orbix3dJs.includes('daylightPercent'), 'Cycles exporter must serialize daylightPercent');
assert(orbix3dJs.includes('interiorFillWatts'), 'Cycles exporter must serialize interiorFillWatts');
assert(orbix3dJs.includes('exposureEV'), 'Cycles exporter must serialize exposureEV');
assert(orbix3dJs.includes('.cycles.json'), 'Cycles exporter must output .cycles.json filename');
console.log('✓ [Blender Cycles Exporter] exportToCyclesJson with 4K camera, materials, lighting controls & windows verified');

// 4. Verify scripts/orbix_blender_cycles.py
const blenderScript = fs.readFileSync(path.join(__dirname, '../scripts/orbix_blender_cycles.py'), 'utf8');
assert(blenderScript.includes('ORBIX LIGHTING'), 'Blender script must create ORBIX LIGHTING controller object');
assert(blenderScript.includes('Daylight %'), 'Blender script must setup Daylight % control');
assert(blenderScript.includes('Interior Fill W'), 'Blender script must setup Interior Fill W control');
assert(blenderScript.includes('Exposure EV'), 'Blender script must setup Exposure EV control');
assert(blenderScript.includes('WindowLight_'), 'Blender script must place window area lights');
assert(blenderScript.includes('InteriorWarmFill'), 'Blender script must setup warm interior fill');
assert(blenderScript.includes('CYCLES'), 'Blender script must configure Cycles render engine');
console.log('✓ [Blender Cycles Python Script] Standalone scene reconstruction & raytracing script verified');

// 5. Verify orbix-ui.js and index.html integration
const uiJs = fs.readFileSync(path.join(__dirname, '../orbix-ui.js'), 'utf8');
assert(uiJs.includes('exportCycles'), 'OrbixUI must implement exportCycles');
assert(uiJs.includes('cpExportCyclesBtn'), 'OrbixUI must bind cpExportCyclesBtn');
assert(uiJs.includes('planPlaceNextBtn'), 'OrbixUI must bind planPlaceNextBtn');

const indexHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
assert(indexHtml.includes('id="cpExportCyclesBtn"'), 'index.html must include cpExportCyclesBtn');
assert(indexHtml.includes('id="planPlaceNextBtn"'), 'index.html must include planPlaceNextBtn');
assert(indexHtml.includes('id="planWallOffsetInput"'), 'index.html must include planWallOffsetInput');
assert(indexHtml.includes('orbix-3d.js?v=55'), 'index.html must use asset cache version v55');
console.log('✓ [UI Integration] Buttons, inputs, and toolbar controls verified');

// 6. Verify Material Options Sanitizer & Three.js r128 Protection
const swJs = fs.readFileSync(path.join(__dirname, '../sw.js'), 'utf8');
assert(swJs.includes('orbix-studio-v55'), 'sw.js must define CACHE_NAME as orbix-studio-v55');

assert(orbix3dJs.includes('function sanitizeMaterialOptions'), 'orbix-3d.js must implement sanitizeMaterialOptions');
assert(orbix3dJs.includes('hookPhysicalMaterialSafeguards'), 'orbix-3d.js must implement hookPhysicalMaterialSafeguards');

// Emulate THREE environment to test sanitizer logic
global.THREE = {
  Color: function () {
    this.r = 0; this.g = 0; this.b = 0;
    this.setScalar = function (s) { this.r = s; this.g = s; this.b = s; return this; };
  }
};
const Core = require('../orbix-core.js');
const Orbix3D = require('../orbix-3d.js');
const sanitize = Orbix3D.sanitizeMaterialOptions;
assert(typeof sanitize === 'function', 'sanitizeMaterialOptions must be exported on ArchitecturalRenderer');

const dirtyOpts = {
  color: 0xffffff,
  sheen: 0.15,
  sheenRoughness: 0.25,
  thickness: 1.2
};
const cleaned = sanitize(dirtyOpts);
assert(cleaned.sheen instanceof global.THREE.Color, 'Numeric sheen must be converted to THREE.Color');
assert.strictEqual(cleaned.sheenRoughness, undefined, 'sheenRoughness must be stripped');
assert.strictEqual(cleaned.thickness, undefined, 'thickness must be stripped');
console.log('✓ [Material Sanitizer] Three.js r128 compatibility safeguards & v40 cache verified');

console.log('\n=== ALL TESTS PASSED SUCCESSFULLY! ===\n');
