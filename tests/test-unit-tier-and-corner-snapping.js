const assert = require('assert');
const Core = require('../orbix-core.js');

// Mock browser globals for PlanEditor
global.window = global;
global.window.addEventListener = function() {};
global.window.removeEventListener = function() {};

const mockContainer = {
  style: {},
  appendChild: () => {},
  querySelector: () => null,
  querySelectorAll: () => [],
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  clientWidth: 800,
  clientHeight: 600
};

const mockCtx = new Proxy({
  measureText: () => ({ width: 50 })
}, {
  get: (target, prop) => {
    if (prop in target) return target[prop];
    return () => {};
  },
  set: () => true
});

global.document = {
  createElement: () => ({
    getContext: () => mockCtx,
    style: {},
    addEventListener: () => {},
    removeEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    setAttribute: () => {},
    getAttribute: () => '',
    appendChild: () => {},
    remove: () => {},
    querySelectorAll: () => [],
    querySelector: () => null,
    width: 800,
    height: 600
  }),
  getElementById: () => null,
  querySelectorAll: () => [],
  querySelector: () => null
};

const PlanEditor = require('../orbix-plan.js');

console.log('Testing Elevation Tier Filtering and Corner Snapping...');

// ── TEST 1: Unit Tier Classification ──
console.log('\n[Test 1] Unit Tier Classification (getUnitTier)');
const project = Core.createProject('Test Tier Filtering');
const editor = new PlanEditor(mockContainer, { project: project });

const floorUnit = Core.createFurniturePlacement('fm-60');
floorUnit.elevation = 0;
assert.strictEqual(editor.getUnitTier(floorUnit), 'floor', 'FM 60 must be classified as floor tier');

const wallUnit = Core.createFurniturePlacement('wm-60');
wallUnit.elevation = 1500;
assert.strictEqual(editor.getUnitTier(wallUnit), 'wall', 'WM 60 must be classified as wall tier');

const loftUnit = Core.createFurniturePlacement('loft-60');
loftUnit.elevation = 2100;
assert.strictEqual(editor.getUnitTier(loftUnit), 'loft', 'Loft 60 must be classified as loft tier');

const openBox = Core.createFurniturePlacement('ob-60');
openBox.elevation = 1500;
assert.strictEqual(editor.getUnitTier(openBox), 'wall', 'Open box at 1500mm must be wall tier');

const spiceRack = Core.createFurniturePlacement('sr-60');
spiceRack.elevation = 1350;
assert.strictEqual(editor.getUnitTier(spiceRack), 'wall', 'Spice rack at 1350mm must be wall tier');

console.log('✓ getUnitTier classified floor, wall, loft, open box, and spice rack correctly!');

// ── TEST 2: Overlapping Stack Hit-Testing With Filters ──
console.log('\n[Test 2] Overlapping Stack Selection (Floor + Wall + Loft at same (x, y))');
floorUnit.pos = { x: 1000, y: 100, z: 0 };
wallUnit.pos = { x: 1000, y: 100, z: 1500 };
loftUnit.pos = { x: 1000, y: 100, z: 2100 };

project.plan.furniture = [floorUnit, wallUnit, loftUnit];

// A. Filter: 'wall' -> clicking at (1000, 100) MUST select ONLY wallUnit
editor.setUnitTierFilter('wall');
editor.handleSelectMouseDown({ x: 1000, y: 100 }, false);
assert.strictEqual(editor.selected.length, 1, 'Exactly one unit selected');
assert.strictEqual(editor.selected[0].id, wallUnit.id, 'Must select ONLY Wall Unit when wall filter is active');
console.log('✓ Wall filter selected ONLY Wall Unit from overlapping stack!');

// B. Filter: 'floor' -> clicking at (1000, 100) MUST select ONLY floorUnit
editor.setUnitTierFilter('floor');
editor.handleSelectMouseDown({ x: 1000, y: 100 }, false);
assert.strictEqual(editor.selected.length, 1, 'Exactly one unit selected');
assert.strictEqual(editor.selected[0].id, floorUnit.id, 'Must select ONLY Floor Unit when floor filter is active');
console.log('✓ Floor filter selected ONLY Floor Unit from overlapping stack!');

// C. Filter: 'loft' -> clicking at (1000, 100) MUST select ONLY loftUnit
editor.setUnitTierFilter('loft');
editor.handleSelectMouseDown({ x: 1000, y: 100 }, false);
assert.strictEqual(editor.selected.length, 1, 'Exactly one unit selected');
assert.strictEqual(editor.selected[0].id, loftUnit.id, 'Must select ONLY Loft Unit when loft filter is active');
console.log('✓ Loft filter selected ONLY Loft Unit from overlapping stack!');

// D. Filter: 'all' -> click cycling between overlapping units
editor.setUnitTierFilter('all');
editor.selected = [];
editor.handleSelectMouseDown({ x: 1000, y: 100 }, false);
assert.strictEqual(editor.selected.length, 1);
const firstSelId = editor.selected[0].id;
// Second click at same spot cycles to next unit
editor.handleSelectMouseDown({ x: 1000, y: 100 }, false);
assert.strictEqual(editor.selected.length, 1);
const secondSelId = editor.selected[0].id;
assert.notStrictEqual(firstSelId, secondSelId, 'Consecutive clicks in "all" mode cycle through overlapping stack');
console.log('✓ "All" mode cycles through overlapping units on consecutive clicks!');

// ── TEST 3: Corner Placement Snapping (FBCM 90° Corner Snapping) ──
console.log('\n[Test 3] L-Corner Unit Corner Snapping');
// Clear furniture from previous test
project.plan.furniture = [];
// Create two perpendicular walls meeting at (0, 0):
// Wall A: (0,0) to (3000, 0), thickness 200
// Wall B: (0,0) to (0, 3000), thickness 200
project.plan.walls = [
  { id: 'wA', start: { x: 0, y: 0 }, end: { x: 3000, y: 0 }, thickness: 200, height: 2800 },
  { id: 'wB', start: { x: 0, y: 0 }, end: { x: 0, y: 3000 }, thickness: 200, height: 2800 }
];

const fbcmPreset = {
  id: 'fbcm',
  name: 'L-Shaped Corner Base Unit',
  category: 'kitchen_corner',
  catalogItemId: 'fbcm',
  dimensions: { W: 900, D: 560, H: 850 },
  unitConfig: {
    unitType: 'fbcm',
    geometryType: 'l_shaped_corner',
    corner: { enabled: true, legW: 900, legD: 900, depth: 560 }
  }
};

// Simulate dragging FBCM near corner at (250, 250)
const snapResult = editor.snapFurniture(fbcmPreset, { x: 250, y: 250 }, 0);
assert(snapResult, 'Snap result must not be null');
assert.strictEqual(snapResult.type, 'wall_snap', 'Must snap to wall corner');
console.log('FBCM Snapped Position:', snapResult.pos, 'Badge:', snapResult.badgeLabel);
assert(snapResult.badgeLabel.includes('Room Corner'), 'Badge must indicate Room Corner snap');
console.log('✓ L-Corner Unit successfully snapped flush into 90° room corner!');

// ── TEST 4: Standard Unit Jointing to Corner Unit Arms ──
console.log('\n[Test 4] Standard Unit Jointing to Corner Unit Arm 1 and Arm 2');
const placedFbcm = Core.createFurniturePlacement({
  id: 'corner_1',
  catalogItemId: 'fbcm',
  name: 'L-Shaped Corner Base Unit',
  category: 'kitchen_corner',
  pos: snapResult.pos,
  rotY: snapResult.rotY,
  dimensions: { W: 900, D: 560, H: 850 },
  unitConfig: {
    unitType: 'fbcm',
    geometryType: 'l_shaped_corner',
    corner: { enabled: true, legW: 900, legD: 900, depth: 560 }
  }
});
project.plan.furniture = [placedFbcm];

// Place FM 60 near Arm 1
const fm60Preset = {
  id: 'fm-60',
  name: 'FM 60',
  category: 'kitchen_fm',
  dimensions: { W: 600, D: 560, H: 850 }
};

// Position cursor near Arm 1
const arm1NearPos = { x: snapResult.pos.x + 600, y: snapResult.pos.y };
const jointSnap1 = editor.snapFurniture(fm60Preset, arm1NearPos, snapResult.rotY);
assert(jointSnap1, 'Must find snap near Arm 1');
console.log('Arm Joint Snap:', jointSnap1.badgeLabel);
console.log('✓ Standard unit successfully snaps to Corner Unit Arm!');

console.log('\nALL ELEVATION TIER AND CORNER SNAPPING TESTS PASSED PERFECTLY!');
