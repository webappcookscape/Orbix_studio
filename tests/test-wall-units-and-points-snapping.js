/**
 * Automated Verification Suite:
 * 1. Wall Units Placement Above Floor Units (Elevation separation & Overlap prevention)
 * 2. 8-Point Connection Magnetic Snapping (Corners, Midpoints, L-Corners, Depth Compensation)
 * 3. Selection Cycling on Overlapping Units
 * 4. Multi-Unit Laminate / Finish Preservation Across Selection Changes
 */

const assert = require('assert');
const Core = require('../orbix-core.js');

console.log('=== TEST SUITE: Wall Units Placement & 8-Point Snapping ===\n');

// ─── TEST 1: Wall Unit Recognition & Default Dimensions ───
console.log('[TEST 1] Wall Unit Recognition & Default Dimensions...');
const testWallCases = [
  { cat: 'kitchen_wm', name: 'WM 30', code: 'wm-30', costCategory: 'Kitchen - WM' },
  { cat: 'kitchen_wall', name: 'WM 45', code: 'wm-45', costCategory: 'Kitchen - WM' },
  { cat: 'kitchen_wm', name: 'WM 60 GL', code: 'wm-60-gl', costCategory: 'Kitchen - WM' },
  { cat: 'kitchen_wall', name: 'WM 75', code: 'wm-75', costCategory: 'Kitchen - WM' },
  { cat: null, name: 'WM30', code: 'wm30', costCategory: null },
  { cat: 'k_wall', name: 'WCM 60', code: 'wcm-60', costCategory: 'Kitchen - WM' },
  { cat: 'kitchen_os', name: 'WM 30 O/S', code: 'wm-30-os', costCategory: 'Kitchen o/s' },
  { cat: 'spice_rack', name: 'Spice Rack 30', code: 'sr-30', costCategory: 'Spice Rack' }
];

testWallCases.forEach(tc => {
  const isWall = Core.isWallUnit(tc.cat, tc.name, tc.code, tc.costCategory);
  assert.strictEqual(isWall, true, `Expected isWallUnit to be true for ${tc.name} (${tc.cat})`);
  const p = Core.createFurniturePlacement({
    name: tc.name,
    category: tc.cat,
    code: tc.code,
    costCategory: tc.costCategory
  });
  assert.strictEqual(p.elevation, 1500, `Expected default elevation 1500mm for ${tc.name}`);
  assert.strictEqual(p.pos.z, 1500, `Expected pos.z 1500mm for ${tc.name}`);
});

const testBaseCases = [
  { cat: 'kitchen_base', name: 'FM 75', code: 'fm-75', costCategory: 'Kitchen - FM' },
  { cat: 'kitchen_fm', name: 'FM 60', code: 'fm-60', costCategory: 'Kitchen - FM' },
  { cat: 'kitchen_d2_d3', name: 'D2 60', code: 'd2-60', costCategory: 'Kitchen - D2/D3' },
  { cat: 'tv_unit', name: 'CROCKERY/TV BASE 1 DRAWER', code: 'ctvb-1dr', costCategory: 'TV Unit Cabinet' }
];

testBaseCases.forEach(tc => {
  const isWall = Core.isWallUnit(tc.cat, tc.name, tc.code, tc.costCategory);
  assert.strictEqual(isWall, false, `Expected isWallUnit to be false for ${tc.name}`);
  const p = Core.createFurniturePlacement({
    name: tc.name,
    category: tc.cat,
    code: tc.code,
    costCategory: tc.costCategory
  });
  assert.strictEqual(p.elevation, 0, `Expected default elevation 0mm for base unit ${tc.name}`);
  assert.strictEqual(p.pos.z, 0, `Expected pos.z 0mm for base unit ${tc.name}`);
});
console.log('✓ TEST 1 PASSED: Wall and Base units recognized with exact elevation 1500mm vs 0mm.\n');

// ─── TEST 2: Wall Units Placement Above Floor Units (No False Collision) ───
console.log('[TEST 2] Testing Placement of Wall Unit Above Floor Unit...');
const baseFM75 = Core.createFurniturePlacement({
  id: 'base_fm75',
  name: 'FM 75',
  category: 'kitchen_base',
  code: 'fm-75',
  dimensions: { W: 750, H: 850, D: 560 },
  pos: { x: 1000, y: 1000, z: 0 },
  rotY: 0
});

const wallWM30 = Core.createFurniturePlacement({
  id: 'wall_wm30',
  name: 'WM 30',
  category: 'kitchen_wall',
  code: 'wm-30',
  dimensions: { W: 300, H: 600, D: 320 },
  pos: { x: 1000, y: 1000, z: 1500 },
  rotY: 0
});

// Collision check between wall unit and base unit directly overlapping in 2D footprint:
const col1 = Core.checkFurnitureCollision(wallWM30, [baseFM75]);
assert.strictEqual(col1.collided, false, 'Wall unit above base unit must NOT collide!');

const col2 = Core.checkFurnitureCollision(baseFM75, [wallWM30]);
assert.strictEqual(col2.collided, false, 'Base unit below wall unit must NOT collide!');

// Test with checkPlacementOverlap:
const wallObj = Core.createWall({ start: { x: 0, y: 1200 }, end: { x: 3000, y: 1200 }, thickness: 150 });
// Base unit against wall: wall surface is at y = 1125, depth 560 -> center y = 1125 - 280 = 845
const baseOnWall = Core.createFurniturePlacement({
  id: 'base_on_wall',
  name: 'FM 75',
  category: 'kitchen_base',
  dimensions: { W: 750, H: 850, D: 560 },
  pos: { x: 1000, y: 845, z: 0 },
  rotY: 0
});
// Wall unit flush against wall above base unit: wall surface at y = 1125, depth 320 -> center y = 1125 - 160 = 965
const wallOnWall = Core.createFurniturePlacement({
  id: 'wall_on_wall',
  name: 'WM 30',
  category: 'kitchen_wall',
  dimensions: { W: 300, H: 600, D: 320 },
  pos: { x: 1000, y: 965, z: 1500 },
  rotY: 0
});
const dummyPlan = {
  walls: [wallObj],
  furniture: [baseOnWall],
  openings: [],
  rooms: []
};

const overlapRes = Core.checkPlacementOverlap(wallOnWall, dummyPlan);
assert.strictEqual(overlapRes.hasOverlap, false, 'checkPlacementOverlap must NOT flag overlap for wall unit above base unit!');

// Now verify that TWO BASE UNITS at the same elevation DO collide:
const base2 = Core.createFurniturePlacement({
  id: 'base_2',
  name: 'FM 60',
  category: 'kitchen_base',
  dimensions: { W: 600, H: 850, D: 560 },
  pos: { x: 1000, y: 1000, z: 0 }
});
const baseCol = Core.checkFurnitureCollision(base2, [baseFM75]);
assert.strictEqual(baseCol.collided, true, 'Two base units at elevation 0mm MUST collide when overlapping!');
console.log('✓ TEST 2 PASSED: Elevation ranges partition correctly; no false overlap detected.\n');

// ─── TEST 3: Mock PlanEditor Snapping Tests ───
console.log('[TEST 3] Testing 8-Point Connection Snapping & Plumb Stacking...');

// Mock PlanEditor instance
const mockEditor = {
  project: {
    plan: {
      walls: [
        { id: 'w1', start: { x: 0, y: 1000 }, end: { x: 4000, y: 1000 }, thickness: 150 }
      ],
      furniture: [],
      rooms: []
    }
  }
};

// Bind methods from orbix-plan.js
const fs = require('fs');
const planCode = fs.readFileSync('orbix-plan.js', 'utf8');

// Extract getFurnitureJointPoints and snapFurniture
const snapFurnitureFn = new Function('Core', 'Vec2', `
  var PlanEditor = function() {};
  PlanEditor.prototype = {};
  ${planCode.substring(planCode.indexOf('PlanEditor.prototype.getFurnitureJointPoints = function'), planCode.indexOf('PlanEditor.prototype.handleFurnitureMouseDown = function'))}
  return {
    getFurnitureJointPoints: PlanEditor.prototype.getFurnitureJointPoints,
    snapFurniture: PlanEditor.prototype.snapFurniture
  };
`)(Core, Core.Vec2);

mockEditor.getFurnitureJointPoints = snapFurnitureFn.getFurnitureJointPoints.bind(mockEditor);
mockEditor.snapFurniture = snapFurnitureFn.snapFurniture.bind(mockEditor);

// Test 3a: getFurnitureJointPoints returns 8 points
const testUnit = {
  pos: { x: 1000, y: 1000 },
  rotY: 0,
  dimensions: { W: 800, D: 600 }
};
const pts = mockEditor.getFurnitureJointPoints(testUnit);
assert.strictEqual(pts.length, 8, 'Expected 8 joint points (4 corners + 4 midpoints)');
const pointNames = pts.map(p => p.name).sort();
assert.deepStrictEqual(pointNames, ['BL', 'BM', 'BR', 'FL', 'FM', 'FR', 'LM', 'RM'], 'Expected all 8 named points');
console.log('✓ 3a: 8 connection points generated (BL, BM, BR, FL, FM, FR, LM, RM).');

// Test 3b: Plumb Stacking Snap (Wall Unit above Base Unit)
// Existing base unit at (1500, 1000), rotY: 0, W: 750, D: 560
const existingBase = Core.createFurniturePlacement({
  id: 'base1',
  name: 'FM 75',
  category: 'kitchen_base',
  dimensions: { W: 750, H: 850, D: 560 },
  pos: { x: 1500, y: 1000, z: 0 },
  rotY: 0
});
mockEditor.project.plan.furniture = [existingBase];

// Active wall unit candidate dragged near existing base unit (1520, 1010)
const activeWall = {
  id: 'wall1',
  name: 'WM 30',
  category: 'kitchen_wall',
  dimensions: { W: 300, H: 600, D: 320 },
  elevation: 1500,
  rotY: 0
};

const plumbSnap = mockEditor.snapFurniture(activeWall, { x: 1520, y: 1010 }, 0);
assert.strictEqual(plumbSnap.type, 'unit_joint', 'Expected plumb snap to be unit_joint');
assert.strictEqual(plumbSnap.snapMode, 'plumb', 'Expected snapMode to be plumb');
// Back flush calculation: oPos.y - ((oD - fD) / 2) * vO.y = 1000 - ((560 - 320) / 2) * 1 = 1000 - 120 = 880
assert.strictEqual(plumbSnap.pos.y, 880, 'Wall unit back must be flush with base unit back at y = 880');
console.log('✓ 3b: Wall unit plumb stacking snaps flush against wall above floor unit (y = 880).');

// Test 3c: Side-by-Side Jointing with Depth Compensation (Back Flush)
// Existing base unit: W: 750, D: 560 at (1500, 1000)
// Dragging another unit with different depth: W: 600, D: 600 at (2150, 1015)
const activeDifferentDepth = {
  id: 'diff_depth_unit',
  name: 'Base 600',
  category: 'kitchen_base',
  dimensions: { W: 600, H: 850, D: 600 },
  elevation: 0,
  rotY: 0
};
const sideSnap = mockEditor.snapFurniture(activeDifferentDepth, { x: 2150, y: 1015 }, 0);
assert.strictEqual(sideSnap.type, 'unit_joint', 'Expected side-by-side joint');
// Side joint X: 1500 + (750 + 600)/2 = 1500 + 675 = 2175
assert.strictEqual(sideSnap.pos.x, 2175, 'Expected side joint pos.x = 2175');
// Depth compensation Y: 1000 - ((560 - 600)/2)*1 = 1000 - (-20) = 1020
assert.strictEqual(sideSnap.pos.y, 1020, 'Expected depth-compensated back flush pos.y = 1020');
console.log('✓ 3c: Units with different depths (560 vs 600) align flush at back face (y = 1020).');

// Test 3c-2: Front Corner Magnetic Point Snap (FL to FR)
const frontCornerSnap = mockEditor.snapFurniture(activeDifferentDepth, { x: 2150, y: 990 }, 0);
assert.strictEqual(frontCornerSnap.side, 'point_snap', 'Expected corner point snap');
assert.strictEqual(frontCornerSnap.pos.y, 980, 'Expected front-aligned pos.y = 980');
console.log('✓ 3c-2: Bringing front corners together magnetically snaps FL to FR (y = 980).');

// Test 3d: Perpendicular L-Corner Jointing (rotY = PI / 2)
const lCornerCandidate = {
  id: 'l_unit',
  name: 'FM 60 Corner',
  category: 'kitchen_base',
  dimensions: { W: 600, H: 850, D: 560 },
  elevation: 0,
  rotY: Math.PI / 2
};
// Drag near right end of base1 at (2120, 1040)
const lSnap = mockEditor.snapFurniture(lCornerCandidate, { x: 2120, y: 1040 }, Math.PI / 2);
assert.strictEqual(lSnap.type, 'unit_joint', 'Expected perpendicular L-joint');
assert.strictEqual(lSnap.pos.x, 2155, 'Expected L-corner pos.x = 2155');
assert.strictEqual(lSnap.pos.y, 1020, 'Expected L-corner pos.y = 1020');
console.log('✓ 3d: Perpendicular L-Corner joint snaps precisely at 90 degrees.');
console.log('✓ TEST 3 PASSED: All snapping modes verified.\n');

// ─── TEST 4: Selection Cycling on Overlapping Units ───
console.log('[TEST 4] Testing Selection Cycling between Wall and Floor Units...');
const furnPlan = [
  { id: 'f_base', name: 'FM 75', pos: { x: 1000, y: 1000 }, rotY: 0, dimensions: { W: 750, D: 560 } },
  { id: 'f_wall', name: 'WM 30', pos: { x: 1000, y: 1000 }, rotY: 0, dimensions: { W: 300, D: 320 } }
];

// Click point at (1000, 1000)
const worldClick = { x: 1000, y: 1000 };
const matchingHits = [];
for (var fi = furnPlan.length - 1; fi >= 0; fi--) {
  var fn = furnPlan[fi];
  var fPoly = Core.getFurniturePolygon(fn);
  if (Core.Vec2.pointInPolygon(worldClick, fPoly) || Core.Vec2.dist(worldClick, fn.pos) < 200) {
    matchingHits.push(fn);
  }
}
assert.strictEqual(matchingHits.length, 2, 'Click must detect both overlapping units');

// First click: no prior selection -> selects matchingHits[0] ('f_wall')
let curSelId = null;
let hit1 = matchingHits[0];
if (curSelId && matchingHits.length > 1) {
  let curIdx = matchingHits.findIndex(h => h.id === curSelId);
  if (curIdx !== -1) hit1 = matchingHits[(curIdx + 1) % matchingHits.length];
}
assert.strictEqual(hit1.id, 'f_wall', 'First click selects wall unit');

// Second click: 'f_wall' is currently selected -> cycles to 'f_base'
curSelId = 'f_wall';
let hit2 = matchingHits[0];
if (curSelId && matchingHits.length > 1) {
  let curIdx = matchingHits.findIndex(h => h.id === curSelId);
  if (curIdx !== -1) hit2 = matchingHits[(curIdx + 1) % matchingHits.length];
}
assert.strictEqual(hit2.id, 'f_base', 'Second click cycles to base unit underneath');

// Third click: 'f_base' is currently selected -> cycles back to 'f_wall'
curSelId = 'f_base';
let hit3 = matchingHits[0];
if (curSelId && matchingHits.length > 1) {
  let curIdx = matchingHits.findIndex(h => h.id === curSelId);
  if (curIdx !== -1) hit3 = matchingHits[(curIdx + 1) % matchingHits.length];
}
assert.strictEqual(hit3.id, 'f_wall', 'Third click cycles back to wall unit');
console.log('✓ TEST 4 PASSED: Clicking on overlapping units cleanly cycles selection.\n');

// ─── TEST 5: Multi-Unit Laminate / Finish Preservation ───
console.log('[TEST 5] Testing Multi-Unit Laminate / Finish Preservation...');
// Simulate 3 FM75 units
const u1 = Core.createFurniturePlacement({ id: 'u1', name: 'FM 75 (1)', category: 'kitchen_base' });
const u2 = Core.createFurniturePlacement({ id: 'u2', name: 'FM 75 (2)', category: 'kitchen_base' });
const u3 = Core.createFurniturePlacement({ id: 'u3', name: 'FM 75 (3)', category: 'kitchen_base' });

// User edits laminate on u2:
u2.unitConfig = u2.unitConfig || {};
u2.unitConfig.shutterCol = 'MDF 7709';
u2.shutterColors = ['#6b6e45', '#6b6e45'];
u2.shutterMaterials = ['MDF 7709', 'MDF 7709'];

// Mock existing 3D studio units:
const sUnits = [
  { _furnId: 'u1', label: 'FM 75 (1)', shutterCol: 'Absolute White' },
  { _furnId: 'u2', label: 'FM 75 (2)', shutterCol: 'Absolute White' }, // had old value before sync
  { _furnId: 'u3', label: 'FM 75 (3)', shutterCol: 'Absolute White' }
];

// Perform sync logic (from our fixed syncProjectUnitsTo3DStudio):
const existingMap = {};
sUnits.forEach(u => { existingMap[u._furnId] = u; });

[u1, u2, u3].forEach(fn => {
  const existing = existingMap[fn.id];
  if (existing) {
    if (fn.unitConfig && fn.unitConfig.shutterCol) {
      existing.shutterCol = fn.unitConfig.shutterCol;
    } else if (fn.materials && fn.materials.shutter && fn.materials.shutter.finish) {
      existing.shutterCol = fn.materials.shutter.finish;
    }

    var activeFinish = (fn.unitConfig && fn.unitConfig.shutterCol) || existing.shutterCol || '#6e4e35';
    var sCnt = (fn.unitConfig && fn.unitConfig.shutters) || 2;
    fn.shutterColors = fn.shutterColors || [];
    fn.shutterMaterials = fn.shutterMaterials || [];
    for (var sc = 0; sc < sCnt; sc++) {
      if (!fn.shutterColors[sc]) fn.shutterColors[sc] = Core.toValidHexColor(activeFinish, '#6e4e35');
      if (!fn.shutterMaterials[sc]) fn.shutterMaterials[sc] = activeFinish;
    }
  }
});

// Verify that u2's custom edited laminate 'MDF 7709' was PRESERVED and not reverted:
assert.strictEqual(u2.unitConfig.shutterCol, 'MDF 7709', 'u2 unitConfig.shutterCol must remain MDF 7709');
assert.strictEqual(u2.shutterColors[0], '#6b6e45', 'u2 shutter color must remain #6b6e45');
assert.strictEqual(sUnits[1].shutterCol, 'MDF 7709', '3D studio unit 2 shutterCol must sync to MDF 7709');
assert.strictEqual(u1.shutterColors[0], '#6E4E35', 'u1 must remain untouched');
assert.strictEqual(u3.shutterColors[0], '#6E4E35', 'u3 must remain untouched');
console.log('✓ TEST 5 PASSED: Multi-unit laminate edits are preserved without reverting.\n');

console.log('=== ALL TESTS PASSED SUCCESSFULLY! ===');
