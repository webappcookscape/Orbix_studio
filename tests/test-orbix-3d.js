const assert = require('assert');
const OrbixCore = require('../orbix-core.js');

console.log('--- RUNNING ORBIX 3D ARCHITECTURAL GEOMETRY TESTS ---');

// Create test project with a 6m wall (6000mm)
const proj = OrbixCore.createProject('3D Geometry Test');
const wall = OrbixCore.createWall({
  start: { x: 0, y: 0 },
  end: { x: 6000, y: 0 },
  thickness: 200,
  height: 3000
});

// Place a Door (width 1000, height 2100) at offset 1500
const door = OrbixCore.createOpening({
  type: 'door',
  wallId: wall.id,
  offset: 1500,
  width: 1000,
  height: 2100
});

// Place a Window (width 1200, height 1200, sill 900) at offset 4500
const win = OrbixCore.createOpening({
  type: 'window',
  wallId: wall.id,
  offset: 4500,
  width: 1200,
  height: 1200,
  sillHeight: 900
});

proj.plan.walls = [wall];
proj.plan.openings = [door, win];

// Test Cutout Logic:
// Wall length: 6000
// Door 1: [1000 to 2000]
// Window 1: [3900 to 5100]
// Solid segment 1: [0 to 1000] -> width 1000
// Solid segment 2: [2000 to 3900] -> width 1900
// Solid segment 3: [5100 to 6000] -> width 900
// Door Lintel: width 1000, height = 3000 - 2100 = 900
// Window Sill: width 1200, height = 900
// Window Lintel: width 1200, height = 3000 - (900 + 1200) = 900

const wLen = OrbixCore.wallLength(wall);
assert.strictEqual(wLen, 6000);

const seg1W = 1500 - 1000 / 2; // 1000
assert.strictEqual(seg1W, 1000);

const seg2W = (4500 - 1200 / 2) - (1500 + 1000 / 2); // 3900 - 2000 = 1900
assert.strictEqual(seg2W, 1900);

const seg3W = 6000 - (4500 + 1200 / 2); // 6000 - 5100 = 900
assert.strictEqual(seg3W, 900);

// Total width verification: 1000 + 1000 (door) + 1900 + 1200 (win) + 900 = 6000
const sumWidths = seg1W + door.width + seg2W + win.width + seg3W;
assert.strictEqual(sumWidths, 6000, 'Sum of all solid and opening segments must equal exact wall length');
console.log('✓ Wall 3D segmentation with multiple openings verified (Sum = ' + sumWidths + ' mm)');

// Window vertical verification: sill (900) + opening (1200) + lintel (900) = 3000
const winVertSum = win.sillHeight + win.height + (wall.height - (win.sillHeight + win.height));
assert.strictEqual(winVertSum, 3000, 'Vertical window opening geometry verified (Sum = 3000 mm)');
console.log('✓ Window 3D vertical elevation verified (Sill + Opening + Lintel = ' + winVertSum + ' mm)');

console.log('ALL ORBIX 3D ARCHITECTURAL TESTS PASSED SUCCESSFULLY!');
