/**
 * Automated Verification Test Suite for FBCM & WBCM L-Corner Placement:
 * Verifies that L-corner units (FBCM 900x900 and WBCM 600x600) lock solidly into 90° corners
 * without oscillating/snatching between walls.
 */

const assert = require('assert');

// Mock browser globals for OrbixPlan and OrbixCore
global.window = global;
global.window.addEventListener = () => {};
global.window.removeEventListener = () => {};

const createMockEl = () => ({
  style: {},
  classList: { contains: () => false, add: () => {}, remove: () => {} },
  addEventListener: () => {},
  removeEventListener: () => {},
  querySelector: () => null,
  querySelectorAll: () => [],
  appendChild: () => {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  clientWidth: 800,
  clientHeight: 600
});

global.document = {
  createElement: (tag) => {
    if (tag === 'canvas') {
      const mockCtx = new Proxy({
        measureText: () => ({ width: 50 })
      }, {
        get: (target, prop) => (prop in target ? target[prop] : () => {}),
        set: () => true
      });
      return {
        getContext: () => mockCtx,
        style: {},
        addEventListener: () => {},
        removeEventListener: () => {},
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
        width: 800,
        height: 600
      };
    }
    return createMockEl();
  },
  getElementById: () => createMockEl(),
  querySelectorAll: () => [],
  querySelector: () => null
};

const Core = require('../orbix-core.js');
global.OrbixCore = Core;
const PlanEditor = require('../orbix-plan.js');
global.OrbixPlan = PlanEditor;

console.log('================================================================');
console.log('TEST: FBCM & WBCM L-CORNER SNAPPING & WALL SNATCH PREVENTION');
console.log('================================================================');

const fbcm = Core.FURNITURE_CATALOG.find(f => f.id === 'fbcm' || (f.code && f.code.toUpperCase() === 'FBCM'));
const wbcm = Core.FURNITURE_CATALOG.find(f => f.id === 'fbcm-1500' || (f.code && f.code.toUpperCase() === 'WBCM'));
assert(fbcm, 'FBCM must exist in catalog');
assert(wbcm, 'WBCM must exist in catalog');

// Test 1: Standard 4-wall room corner grid test (no snatching, consistent lock)
console.log('\n[1] Testing FBCM corner lock consistency across cursor drag positions...');
const proj1 = Core.createProject('Room Corner Test');
proj1.plan.walls = [
  Core.createWall({ start: { x: 0, y: 0 }, end: { x: 5000, y: 0 }, thickness: 150 }),
  Core.createWall({ start: { x: 5000, y: 0 }, end: { x: 5000, y: 4000 }, thickness: 150 }),
  Core.createWall({ start: { x: 5000, y: 4000 }, end: { x: 0, y: 4000 }, thickness: 150 }),
  Core.createWall({ start: { x: 0, y: 4000 }, end: { x: 0, y: 0 }, thickness: 150 })
];
proj1.plan.rooms = [
  Core.createRoom({
    id: 'room_1',
    polygon: [{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 4000 }, { x: 0, y: 4000 }]
  })
];

const editor1 = new PlanEditor(createMockEl(), { project: proj1 });

// Test grid of cursor points approaching the Top-Left corner (0, 0)
const approachPts = [
  { x: 100, y: 100 },
  { x: 300, y: 150 },
  { x: 500, y: 150 },
  { x: 800, y: 150 },
  { x: 150, y: 500 },
  { x: 150, y: 800 },
  { x: 450, y: 450 },
  { x: 600, y: 600 }
];

approachPts.forEach(pt => {
  const snap = editor1.snapFurniture(fbcm, pt, 0);
  assert(snap, `Must snap at (${pt.x}, ${pt.y})`);
  assert(snap.badgeLabel && snap.badgeLabel.includes('Room Corner'), `Must lock as Room Corner at (${pt.x}, ${pt.y})`);
  // Top-left corner center should be exactly at (525, 525) with thickness 150 and FBCM 900x900
  assert(Math.abs(snap.pos.x - 525) < 1, `Center X must be 525, got ${snap.pos.x} at (${pt.x}, ${pt.y})`);
  assert(Math.abs(snap.pos.y - 525) < 1, `Center Y must be 525, got ${snap.pos.y} at (${pt.x}, ${pt.y})`);
});
console.log('  ✓ FBCM firmly locks to Top-Left corner (525, 525) without jumping or oscillating');

// Test 2: WBCM in the same corner
console.log('\n[2] Testing WBCM corner lock...');
approachPts.slice(0, 4).forEach(pt => {
  const snapW = editor1.snapFurniture(wbcm, pt, 0);
  assert(snapW, `WBCM must snap at (${pt.x}, ${pt.y})`);
  assert(snapW.badgeLabel && snapW.badgeLabel.includes('Room Corner'), 'Must lock as Room Corner');
  // WBCM 600x600 center: wall inner face 75 + 300 = 375
  assert(Math.abs(snapW.pos.x - 375) < 1, `WBCM center X must be 375, got ${snapW.pos.x}`);
  assert(Math.abs(snapW.pos.y - 375) < 1, `WBCM center Y must be 375, got ${snapW.pos.y}`);
});
console.log('  ✓ WBCM firmly locks to Top-Left corner (375, 375)');

// Test 3: T-Junction corners
console.log('\n[3] Testing T-Junction corners (left and right corner locking)...');
const projT = Core.createProject('T-Junction Test');
projT.plan.walls = [
  Core.createWall({ start: { x: 0, y: 0 }, end: { x: 6000, y: 0 }, thickness: 150 }),
  Core.createWall({ start: { x: 3000, y: 0 }, end: { x: 3000, y: 4000 }, thickness: 150 })
];
const editorT = new PlanEditor(createMockEl(), { project: projT });

// Left corner of T-junction (x < 3000, y > 0): wall at y=0 (+X) and wall at x=3000 (+Y)
const snapTLeft = editorT.snapFurniture(fbcm, { x: 2600, y: 300 }, 0);
assert(snapTLeft, 'Must snap at T-junction left corner');
assert(snapTLeft.badgeLabel.includes('Room Corner'), 'Must be Room Corner snap');
assert(Math.abs(snapTLeft.pos.x - 2475) < 2, `T-Left center X must be 2475, got ${snapTLeft.pos.x}`);
assert(Math.abs(snapTLeft.pos.y - 525) < 2, `T-Left center Y must be 525, got ${snapTLeft.pos.y}`);
console.log('  ✓ T-Junction left corner snaps flush (2475, 525)');

// Right corner of T-junction (x > 3000, y > 0): wall at y=0 (+X) and wall at x=3000 (+Y)
const snapTRight = editorT.snapFurniture(fbcm, { x: 3400, y: 300 }, 0);
assert(snapTRight, 'Must snap at T-junction right corner');
assert(snapTRight.badgeLabel.includes('Room Corner'), 'Must be Room Corner snap');
assert(Math.abs(snapTRight.pos.x - 3525) < 2, `T-Right center X must be 3525, got ${snapTRight.pos.x}`);
assert(Math.abs(snapTRight.pos.y - 525) < 2, `T-Right center Y must be 525, got ${snapTRight.pos.y}`);
console.log('  ✓ T-Junction right corner snaps flush (3525, 525)');

// Test 4: Reversed Wall Drawing Order
console.log('\n[4] Testing reversed wall drawing directions...');
const projRev = Core.createProject('Reversed Walls Test');
projRev.plan.walls = [
  Core.createWall({ start: { x: 4000, y: 0 }, end: { x: 0, y: 0 }, thickness: 150 }),
  Core.createWall({ start: { x: 0, y: 4000 }, end: { x: 0, y: 0 }, thickness: 150 })
];
const editorRev = new PlanEditor(createMockEl(), { project: projRev });
const snapRev = editorRev.snapFurniture(fbcm, { x: 300, y: 300 }, 0);
assert(snapRev && snapRev.badgeLabel.includes('Room Corner'), 'Must snap to reversed corner');
assert(Math.abs(snapRev.pos.x - 525) < 2, 'Center X must be 525');
assert(Math.abs(snapRev.pos.y - 525) < 2, 'Center Y must be 525');
console.log('  ✓ Reversed wall drawing directions lock into corner cleanly');

console.log('\n================================================================');
console.log('ALL FBCM & WBCM L-CORNER SNAPPING TESTS PASSED SUCCESSFULLY!');
console.log('================================================================\n');

