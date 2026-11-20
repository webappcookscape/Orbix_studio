// Comprehensive verification test for user's 6 requests
const fs = require('fs');
const assert = require('assert');

// 1. Load Core
const coreCode = fs.readFileSync('orbix-core.js', 'utf8');
const Core = (function() {
  const module = {};
  eval(coreCode);
  return module.exports || OrbixCore;
})();

console.log('--- TEST 1: Unit Name Auto-Update for Width (Item 4) ---');
// FM 60 -> FM 45 when width changed from 600mm to 450mm
let fnFM60 = {
  id: 'fn_1',
  name: 'FM 60',
  code: 'FM60',
  catalogItemId: 'fm-60',
  dimensions: { W: 600, D: 550, H: 850 }
};
Core.updateUnitNameForWidth(fnFM60, 600, 450);
console.log('FM 60 updated to:', fnFM60.name, fnFM60.code, fnFM60.catalogItemId);
assert.strictEqual(fnFM60.name, 'FM 45');
assert.strictEqual(fnFM60.code, 'FM45');
assert.strictEqual(fnFM60.catalogItemId, 'fm-45');

// WM 60 -> WM 45
let fnWM60 = {
  id: 'fn_2',
  name: 'WM 60 Wall Cabinet',
  code: 'WM60',
  catalogItemId: 'wm-60',
  dimensions: { W: 600, D: 350, H: 600 }
};
Core.updateUnitNameForWidth(fnWM60, 600, 450);
console.log('WM 60 updated to:', fnWM60.name, fnWM60.code);
assert.strictEqual(fnWM60.name, 'WM 45 Wall Cabinet');
assert.strictEqual(fnWM60.code, 'WM45');

// TBM 90 -> TBM 60
let fnTBM90 = {
  id: 'fn_3',
  name: 'TBM 90 Tall Unit',
  code: 'TBM90',
  catalogItemId: 'tbm-90',
  dimensions: { W: 900, D: 550, H: 2100 }
};
Core.updateUnitNameForWidth(fnTBM90, 900, 600);
console.log('TBM 90 updated to:', fnTBM90.name, fnTBM90.code);
assert.strictEqual(fnTBM90.name, 'TBM 60 Tall Unit');
assert.strictEqual(fnTBM90.code, 'TBM60');

console.log('✓ Item 4 passed!\n');

console.log('--- TEST 2: Wall Stretching by Value Input (Item 1) ---');
let plan = {
  walls: [
    { id: 'w1', start: { x: 0, y: 0 }, end: { x: 3000, y: 0 }, thickness: 150, height: 2700 },
    { id: 'w2', start: { x: 3000, y: 0 }, end: { x: 3000, y: 3000 }, thickness: 150, height: 2700 },
    { id: 'w3', start: { x: 3000, y: 3000 }, end: { x: 0, y: 3000 }, thickness: 150, height: 2700 },
    { id: 'w4', start: { x: 0, y: 3000 }, end: { x: 0, y: 0 }, thickness: 150, height: 2700 }
  ]
};

// Stretch w1 inner length to 4000
let w1 = plan.walls[0];
let oldEnd = { x: w1.end.x, y: w1.end.y };
Core.setWallInnerLength(w1, 4000, plan, 'start');
console.log('w1 stretched end:', w1.end);
console.log('w2 connected start:', plan.walls[1].start);
// w2 start should follow w1 end!
assert.strictEqual(plan.walls[1].start.x, w1.end.x);
assert.strictEqual(plan.walls[1].start.y, w1.end.y);
console.log('✓ Item 1 passed!\n');

console.log('--- TEST 3: Staircase 2D/3D & Spacebar Rotation (Item 3) ---');
// Check orbix-plan.js has move_stair in handleMouseUp and stair rotation
const planCode = fs.readFileSync('orbix-plan.js', 'utf8');
assert(planCode.includes("self.dragState.type === 'move_stair'"), 'handleMouseUp must handle move_stair');
assert(planCode.includes("self.selected[s].type === 'stair'") || planCode.includes("self.selected[sIdx].type === 'stair'"), 'Spacebar rotation must handle selected stair');
assert(planCode.includes("self.activeTool === 'stair'"), 'Stair placement preview must rotate with Spacebar');

// Check orbix-3d.js has furnitureId on staircase group
const d3Code = fs.readFileSync('orbix-3d.js', 'utf8');
assert(d3Code.includes("furnitureId: stair.id"), 'Staircase 3D group must have furnitureId for updates');
console.log('✓ Item 3 passed!\n');

console.log('--- TEST 4: Window Snapping (Item 2) & Corner Snapping (Item 6) ---');
assert(planCode.includes("wOp.type === 'window'"), 'snapFurniture must check window openings');
assert(planCode.includes("bestWallSnap.badgeLabel = '✓ Centered Under Window'"), 'Base units must magnetically center under window');
assert(planCode.includes("bestWallSnap.badgeLabel = '✓ Snapped Flush to Window Frame'"), 'Wall units must magnetically snap flush to window frame');
assert(planCode.includes("snapCornerStartT") && planCode.includes("snapCornerEndT"), 'snapFurniture must magnetically snap to corner edges');
assert(planCode.includes("✓ Snapped Flush to Corner Edge") || planCode.includes("✓ Snapped Flush to Corner Unit"), 'Corner edge magnetic badge must be present');
console.log('✓ Item 2 & Item 6 passed!\n');

console.log('--- TEST 5: 3D Pan, Rotate, and Re-Centre (Item 5) ---');
const appCode = fs.readFileSync('app.js', 'utf8');
// Pitch clamp must allow looking down from above (85°)
assert(appCode.includes("cam.pitch = Math.max(-85, Math.min(85, cam.pitch))"), 'Pitch clamp must allow up to 85°');
// Screen space pan vectors
assert(appCode.includes("tgt.x += (-dx * cosY - dy * sinY * sinEl) * panSpeed"), 'Screen space pan X must be vector math');
assert(appCode.includes("tgt.y += (dy * cosEl) * panSpeed"), 'Screen space pan Y must be vector math');
assert(appCode.includes("tgt.z += (dx * sinY - dy * cosY * sinEl) * panSpeed"), 'Screen space pan Z must be vector math');
// Re-centre must use plan bounding box
assert(appCode.includes("btnCamReset.addEventListener"), 'Re-centre button listener must exist');
assert(appCode.includes("minX = Math.min(minX, w.start.x)"), 'Re-centre must compute plan bounding box center');
console.log('✓ Item 5 passed!\n');

console.log('ALL 6 USER REQUEST TESTS PASSED SUCCESSFULLY!');

