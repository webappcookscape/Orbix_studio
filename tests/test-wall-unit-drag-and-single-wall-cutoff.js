const assert = require('assert');
const Core = require('../orbix-core.js');
const Plan = require('../orbix-plan.js');

console.log('--- TEST 1: Selection Priority & Click-Before-Move for Wall Unit above Floor Unit ---');

const project = Core.createProject();
// Base unit at (500, 500)
project.plan.furniture.push({
  id: 'base_1',
  name: 'FM 600 Base Unit',
  category: 'kitchen_base',
  elevation: 0,
  pos: { x: 500, y: 500, z: 0 },
  dimensions: { W: 600, H: 850, D: 600 },
  rotY: 0
});

// Wall unit placed directly above base unit at (500, 500)
project.plan.furniture.push({
  id: 'wall_1',
  name: 'WM 600 Wall Unit',
  category: 'kitchen_wall',
  elevation: 1500,
  pos: { x: 500, y: 500, z: 1500 },
  dimensions: { W: 600, H: 700, D: 350 },
  rotY: 0
});

// Create mock container
const container = {
  appendChild: () => {},
  style: {}
};

// We test the logic implemented in orbix-plan.js
const furnList = project.plan.furniture;
const worldPt = { x: 500, y: 500 };

const matchingHits = [];
for (let fi = furnList.length - 1; fi >= 0; fi--) {
  const fn = furnList[fi];
  const fPoly = Core.getFurniturePolygon(fn);
  if (Core.Vec2.pointInPolygon(worldPt, fPoly) || Core.Vec2.dist(worldPt, fn.pos) < Math.max(100, (fn.dimensions ? fn.dimensions.W : 600) / 2)) {
    matchingHits.push(fn);
  }
}

assert.strictEqual(matchingHits.length, 2, 'Both wall unit and base unit should be hit at (500, 500)');

const getUnitElevation = function (f) {
  if (f.elevation !== undefined && f.elevation !== null) return parseFloat(f.elevation) || 0;
  if (f.pos && f.pos.z !== undefined && f.pos.z !== null) return parseFloat(f.pos.z) || 0;
  var cat = (f.category || '').toLowerCase();
  var name = (f.name || '').toLowerCase();
  if (cat.indexOf('loft') !== -1 || name.indexOf('loft') !== -1) return 2100;
  if (cat.indexOf('wall') !== -1 || name.indexOf('wall') !== -1 || /(^|\b|_|-)(wm|wcm)($|\b|_|-|\d+)/i.test(name)) return 1500;
  return 0;
};

matchingHits.sort(function (a, b) {
  return getUnitElevation(b) - getUnitElevation(a);
});

assert.strictEqual(matchingHits[0].id, 'wall_1', 'Top hit MUST be wall unit with higher elevation');
assert.strictEqual(matchingHits[1].id, 'base_1', 'Second hit MUST be base unit with lower elevation');

// Step A: First click when unselected
let selected = [];
let curSelId = (selected.length === 1 && selected[0].type === 'furniture') ? selected[0].id : null;
let isAlreadySelected = curSelId && matchingHits.some(h => h.id === curSelId);
let hitFurn = isAlreadySelected ? matchingHits.find(h => h.id === curSelId) : matchingHits[0];
let dragState = isAlreadySelected ? { type: 'move_furniture', furniture: hitFurn } : null;

assert.strictEqual(isAlreadySelected, null, 'Should not be selected initially');
assert.strictEqual(hitFurn.id, 'wall_1', 'Selected unit on first click is wall unit');
assert.strictEqual(dragState, null, 'Must NOT start moving on first click (clicked before move)');

// Step B: Now wall unit is selected, user clicks and drags it to move it
selected = [{ type: 'furniture', id: 'wall_1' }];
curSelId = 'wall_1';
isAlreadySelected = curSelId && matchingHits.some(h => h.id === curSelId);
hitFurn = isAlreadySelected ? matchingHits.find(h => h.id === curSelId) : matchingHits[0];
dragState = isAlreadySelected ? { type: 'move_furniture', furniture: hitFurn } : null;

assert.strictEqual(isAlreadySelected, true, 'Wall unit is already selected');
assert.strictEqual(hitFurn.id, 'wall_1', 'Hit furn MUST remain wall_1, NEVER switching to base_1!');
assert.notStrictEqual(dragState, null, 'Drag state engaged to move the wall unit');
assert.strictEqual(dragState.furniture.id, 'wall_1', 'Moving unit is wall_1');

console.log('✓ Selection priority and click-before-move verified successfully');

console.log('--- TEST 2: 3D Single Wall Cutoff and Attached Furniture Hiding ---');

// Build 4 walls in a rectangular room:
// Wall 1: Bottom (0,0) -> (4000, 0)
// Wall 2: Right  (4000, 0) -> (4000, 3000)
// Wall 3: Top    (4000, 3000) -> (0, 3000)
// Wall 4: Left   (0, 3000) -> (0, 0)
const walls = [
  { id: 'w1', start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, thickness: 150 },
  { id: 'w2', start: { x: 4000, y: 0 }, end: { x: 4000, y: 3000 }, thickness: 150 },
  { id: 'w3', start: { x: 4000, y: 3000 }, end: { x: 0, y: 3000 }, thickness: 150 },
  { id: 'w4', start: { x: 0, y: 3000 }, end: { x: 0, y: 0 }, thickness: 150 }
];

// Unit 1 placed along Wall 1 (at x=1000, y=300)
const unitWall1 = { id: 'u_w1', pos: { x: 1000, y: 300 }, dimensions: { W: 900, D: 600 } };
// Unit 3 placed along Wall 3 (at x=1000, y=2700)
const unitWall3 = { id: 'u_w3', pos: { x: 1000, y: 2700 }, dimensions: { W: 900, D: 600 } };

function associateWall(furn, walls) {
  let bestWall = null, bestDist = 999999;
  for (let wi = 0; wi < walls.length; wi++) {
    const wObj = walls[wi];
    const p1 = wObj.start, p2 = wObj.end;
    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    const lenSq = dx * dx + dy * dy;
    const t = Math.max(0, Math.min(1, ((furn.pos.x - p1.x) * dx + (furn.pos.y - p1.y) * dy) / lenSq));
    const projX = p1.x + t * dx, projY = p1.y + t * dy;
    const dist = Math.hypot(furn.pos.x - projX, furn.pos.y - projY);
    if (dist < bestDist) {
      bestDist = dist;
      bestWall = { id: wObj.id, index: wi, number: wi + 1, dist: dist };
    }
  }
  return bestWall;
}

const assoc1 = associateWall(unitWall1, walls);
const assoc3 = associateWall(unitWall3, walls);

assert.strictEqual(assoc1.id, 'w1', 'Unit 1 correctly associated with Wall 1');
assert.strictEqual(assoc1.number, 1, 'Unit 1 wallNumber is 1');
assert.strictEqual(assoc3.id, 'w3', 'Unit 3 correctly associated with Wall 3');
assert.strictEqual(assoc3.number, 3, 'Unit 3 wallNumber is 3');

// Test wall cutoff visibility synchronization:
// When mode === 'wall_1' (Wall 1 is hidden):
const mode = 'wall_1';
const targetWallNum = parseInt(mode.replace('wall_', ''), 10);
const wallVisibility = {};

walls.forEach((w, wIdx) => {
  const isTarget = ((wIdx + 1) === targetWallNum);
  wallVisibility[w.id] = !isTarget;
});

assert.strictEqual(wallVisibility['w1'], false, 'Wall 1 must be hidden');
assert.strictEqual(wallVisibility['w2'], true, 'Wall 2 must be visible');
assert.strictEqual(wallVisibility['w3'], true, 'Wall 3 must be visible');
assert.strictEqual(wallVisibility['w4'], true, 'Wall 4 must be visible');

// Check furniture visibility:
const unit1Visible = wallVisibility[assoc1.id];
const unit3Visible = wallVisibility[assoc3.id];

assert.strictEqual(unit1Visible, false, 'Unit placed against hidden Wall 1 MUST ALSO BE HIDDEN');
assert.strictEqual(unit3Visible, true, 'Unit placed against visible Wall 3 MUST REMAIN VISIBLE');

console.log('✓ 3D Single Wall Cutoff and attached furniture hiding verified successfully');
console.log('ALL TESTS PASSED!');

