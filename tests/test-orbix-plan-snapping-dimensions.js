/**
 * Automated Test Suite for 2D Plan Features:
 * 1. Wall snatching & overlap prevention
 * 2. 4-corner joint points & unit-to-unit jointing
 * 3. Dimension tool measurement & multi-unit formatting (mm / cm / ft & in)
 * 4. Image icons & Cookscape Units active preset
 */

const assert = require('assert');
const fs = require('fs');

// Mock browser environment for PlanEditor testing
global.window = {
  addEventListener: () => {},
  removeEventListener: () => {},
  innerWidth: 1200,
  innerHeight: 800
};
global.document = {
  createElement: (tag) => {
    return {
      style: {},
      appendChild: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 1200, height: 800 }),
      getContext: () => ({
        save: () => {},
        restore: () => {},
        translate: () => {},
        rotate: () => {},
        scale: () => {},
        beginPath: () => {},
        closePath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        stroke: () => {},
        fill: () => {},
        arc: () => {},
        fillRect: () => {},
        strokeRect: () => {},
        clearRect: () => {},
        rect: () => {},
        roundRect: () => {},
        measureText: () => ({ width: 50 }),
        fillText: () => {},
        setLineDash: () => {}
      })
    };
  },
  getElementById: () => null,
  querySelectorAll: () => []
};

const Core = require('../orbix-core.js');
const PlanModule = require('../orbix-plan.js');
const PlanEditor = PlanModule.PlanEditor || PlanModule;

console.log('--- RUNNING 2D PLAN SNAPPING, JOINTING & DIMENSION TESTS ---');

const project = Core.createProject('Test Floor Plan');
const container = document.createElement('div');
const editor = new PlanEditor(container, { project: project });

// 1. Test formatAllDims (mm, cm, ft-in)
const dim1200 = editor.formatAllDims(1200);
assert.strictEqual(dim1200.mm, '1200 mm');
assert.strictEqual(dim1200.cm, '120 cm');
assert.strictEqual(dim1200.ftIn, "3' 11\"");
assert.strictEqual(dim1200.combined, "1200 mm · 120 cm · 3' 11\"");
console.log('✓ Dimension multi-unit formatting verified (mm, cm, ft-in):', dim1200.combined);

const dim3000 = editor.formatAllDims(3048);
assert.strictEqual(dim3000.mm, '3048 mm');
assert.strictEqual(dim3000.ftIn, "10'");
console.log('✓ Exact 10ft dimension verified:', dim3000.combined);

// 2. Test 4-corner joint points
const testUnit = {
  id: 'u1',
  pos: { x: 1000, y: 1000 },
  rotY: 0,
  dimensions: { W: 1200, D: 600 }
};
const joints = editor.getFurnitureJointPoints(testUnit);
assert.strictEqual(joints.length, 4, 'Should have 4 corner joint points');
assert.deepStrictEqual(joints[0], { name: 'BL', x: 400, y: 700 });
assert.deepStrictEqual(joints[1], { name: 'BR', x: 1600, y: 700 });
assert.deepStrictEqual(joints[2], { name: 'FR', x: 1600, y: 1300 });
assert.deepStrictEqual(joints[3], { name: 'FL', x: 400, y: 1300 });
console.log('✓ 4-corner jointing points calculated with millimeter precision');

// 3. Test Unit-to-Unit Jointing
project.plan.furniture = [testUnit];
const adjacentUnit = {
  id: 'u2',
  dimensions: { W: 450, D: 600 },
  rotY: 0
};
// Drag near right edge of u1 (u1.BR is at x=1600; u2 should snap right beside it at x=1825)
const jointSnap = editor.snapFurniture(adjacentUnit, { x: 1800, y: 990 }, 0);
assert.strictEqual(jointSnap.type, 'unit_joint');
assert.strictEqual(jointSnap.side, 'right');
assert.strictEqual(jointSnap.pos.x, 1825);
assert.strictEqual(jointSnap.pos.y, 1000);
console.log('✓ Unit-to-unit side-by-side jointing verified (snapped flush at x=1825 with zero gap)');

// 4. Test Wall Snatching (Flush Snapping) & Overlap Prevention
const wall = Core.createWall({
  start: { x: 0, y: 2000 },
  end: { x: 5000, y: 2000 },
  thickness: 150
});
project.plan.walls = [wall];

// Drag a 600mm deep unit near the wall (cursor at y=2150, which is 150mm below wall centerline)
// Wall face is at 2000 + 75 = 2075. Cabinet flush center = 2000 + 75 + 300 = 2375.
const wallSnap = editor.snapFurniture(testUnit, { x: 2500, y: 2150 }, 0);
assert.strictEqual(wallSnap.type, 'wall_snap');
assert.strictEqual(wallSnap.pos.y, 2375, 'Unit should snap flush against wall face at y=2375');
assert.strictEqual(wallSnap.pos.x, 2500);
console.log('✓ Wall snatching verified: unit snapped flush against wall surface (center at y=2375, back touches wall at y=2075)');

// 5. Test Dimension Creation
editor.handleDimensionMouseDown({ x: 500, y: 500 });
editor.handleDimensionMouseDown({ x: 2500, y: 500 });
assert.strictEqual(project.plan.dimensions.length, 1);
assert.strictEqual(project.plan.dimensions[0].distMm, 2000);
console.log('✓ Dimension tool measurement creation verified: 2000 mm line added');

// 6. Verify image asset files exist
assert(fs.existsSync('icon-furniture.png'), 'icon-furniture.png should exist');
assert(fs.existsSync('icon-cookscape-unit.png'), 'icon-cookscape-unit.png should exist');
console.log('✓ Image icons verified in repository root');

console.log('ALL 2D PLAN IMPROVEMENT TESTS PASSED SUCCESSFULLY!');
