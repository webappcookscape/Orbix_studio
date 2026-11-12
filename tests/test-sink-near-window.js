const assert = require('assert');
const path = require('path');

// Mock browser environment for Core
const Core = require('../orbix-core.js');

console.log('--- TESTING SINK & BASE UNIT PLACEMENT NEAR / UNDER WINDOWS ---');

const wall = Core.createWall({
  id: 'w1',
  start: { x: 0, y: 0 },
  end: { x: 5000, y: 0 },
  thickness: 150,
  height: 2800
});

const windowOp = Core.createOpening({
  id: 'win1',
  type: 'window',
  wallId: 'w1',
  offset: 2500, // Center of window along wall
  width: 1200,
  height: 1200,
  sillHeight: 900
});

const plan = {
  walls: [wall],
  openings: [windowOp],
  furniture: []
};

// 1. Kitchen Base Unit under window (Countertop sits at 855mm, below 900mm sill)
// Wall is at y=0, thickness=150 (halfT=75). For D=560, flush wall face position is y = 75 + 280 = 355
const baseUnit = {
  id: 'base1',
  name: 'Base Unit 2 Door',
  category: 'kitchen_base',
  pos: { x: 2500, y: 355 }, // Placed flush against wall under window
  dimensions: { W: 900, H: 720, D: 560 },
  elevation: 0,
  rotY: 0
};

const col1 = Core.checkPlacementOverlap(baseUnit, plan);
console.log('1. Base Unit under window overlap check:', col1);
assert.strictEqual(col1.hasOverlap, false, 'Base Unit must be allowed under window');

// 2. Kitchen Sink on counter under window
const sinkDecor = {
  id: 'sink1',
  name: 'Double Bowl Kitchen Sink',
  category: 'decor',
  decorType: 'sink',
  pos: { x: 2500, y: 355 },
  dimensions: { W: 800, H: 400, D: 500 },
  elevation: 850,
  rotY: 0
};

const col2 = Core.checkPlacementOverlap(sinkDecor, plan);
console.log('2. Sink under window overlap check:', col2);
assert.strictEqual(col2.hasOverlap, false, 'Sink must be allowed under window');

// 3. Sink sitting on top of / inside Base Unit (no false furniture collision)
const col3 = Core.checkFurnitureCollision(sinkDecor, [baseUnit]);
console.log('3. Sink on Base Unit furniture collision check:', col3);
assert.strictEqual(col3.collided, false, 'Sink on Base Unit must not collide with the base cabinet below it');

// 4. Tall Unit (2100mm Wardrobe) placed across window (MUST block window)
const tallWardrobe = {
  id: 'wardrobe1',
  name: 'Full Height Wardrobe',
  category: 'wardrobe',
  pos: { x: 2500, y: 375 },
  dimensions: { W: 1000, H: 2100, D: 600 },
  elevation: 0,
  rotY: 0
};

const col4 = Core.checkPlacementOverlap(tallWardrobe, plan);
console.log('4. Tall Wardrobe blocking window overlap check:', col4);
assert.strictEqual(col4.hasOverlap, true, 'Tall wardrobe blocking window must still be prevented');
assert.strictEqual(col4.type, 'opening', 'Collision target must be opening');

console.log('\n======================================================');
console.log('>>> ALL SINK & WINDOW PLACEMENT TESTS PASSED! <<<');
console.log('======================================================\n');
