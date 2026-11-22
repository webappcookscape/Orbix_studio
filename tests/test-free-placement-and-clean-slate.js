const assert = require('assert');
const fs = require('fs');

console.log('=== TEST SUITE: Free Unit Placement, Anti-Overlap & Clean Slate / Deletion ===\n');

// Mock browser globals
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
  getElementById: (id) => null,
  querySelector: (sel) => null,
  querySelectorAll: (sel) => []
};
global.localStorage = {
  _store: {},
  getItem: function(k) { return this._store[k] || null; },
  setItem: function(k, v) { this._store[k] = String(v); },
  removeItem: function(k) { delete this._store[k]; }
};

// Load dependencies
const Core = require('../orbix-core.js');
global.OrbixCore = Core;
const Vec2 = Core.Vec2;
const PlanEditor = require('../orbix-plan.js');
global.PlanEditor = PlanEditor;
const OrbixUI = require('../orbix-ui.js');
global.OrbixUI = OrbixUI;

// --- TEST 1: Clean Slate on New Project & No Ghost Unit Resurrections ---
console.log('[TEST 1] Verifying New Project has 0 units and does NOT resurrect old units...');
window.S = {
  units: [
    { label: 'Ghost Unit 1', ctype: 'wardrobe', W: 900, H: 2100, D: 600, pos: { x: 600, y: 600 } }
  ],
  active: 0
};
localStorage.setItem('cupboard-cad', JSON.stringify({ units: window.S.units }));

// Call createNewProject
const freshProj = OrbixUI.createNewProject('Clean Test Project', 'Ramesh');
assert.strictEqual(freshProj.plan.furniture.length, 0, 'New project plan must have 0 furniture units');
assert.strictEqual(window.S.units.length, 0, 'window.S.units must be empty [ ] on new project');
assert.strictEqual(localStorage.getItem('cupboard-cad'), null, 'cupboard-cad local draft should be cleared');
console.log('✓ Test 1 Passed: Creating a new project provides a 100% clean slate with 0 units.\n');

// --- TEST 2: Deletion from 2D Plan cleanly deletes and does NOT resurrect ---
console.log('[TEST 2] Verifying Unit Deletion keeps unit deleted permanently...');
const testProj = Core.createProject('Delete Test Project');
const u1 = {
  id: 'furn_del_1',
  name: 'Base 600',
  category: 'kitchen_base',
  dimensions: { W: 600, H: 850, D: 560 },
  elevation: 0,
  pos: { x: 1000, y: 1000 },
  rotY: 0
};
testProj.plan.furniture.push(u1);
window.S.units = [{ _furnId: 'furn_del_1', label: 'Base 600', W: 600, H: 850, D: 560 }];
window.S.active = 0;

const mockContainer = document.createElement('div');
const editor = new PlanEditor(mockContainer, { project: testProj });
editor.selected = [{ type: 'furniture', id: 'furn_del_1' }];

// Delete selected
editor.deleteSelected();
assert.strictEqual(testProj.plan.furniture.length, 0, 'Plan furniture array must be empty after deletion');
assert.strictEqual(window.S.units.length, 0, 'window.S.units must be empty after deleting the unit');

// Trigger sync - should NOT resurrect
OrbixUI.project = testProj;
OrbixUI.syncProjectUnitsTo3DStudio();
assert.strictEqual(testProj.plan.furniture.length, 0, 'Deleted units must NOT be resurrected by syncProjectUnitsTo3DStudio');
assert.strictEqual(window.S.units.length, 0, 'window.S.units must remain empty');
console.log('✓ Test 2 Passed: Deletion is permanent and zero ghost resurrections occur.\n');

// --- TEST 3: Free Wall Placement right up to Corner without Artificial Lockout ---
console.log('[TEST 3] Verifying Units can be placed freely on walls all the way to corners...');
const wallA = Core.createWall({
  start: { x: 0, y: 1000 },
  end: { x: 3000, y: 1000 },
  thickness: 150
});
const wallB = Core.createWall({
  start: { x: 0, y: 1000 },
  end: { x: 0, y: 4000 },
  thickness: 150
});
testProj.plan.walls = [wallA, wallB];

// Try placing a 600mm unit (halfActiveW = 300) near the corner at x = 300
// Wall face is at y = 1000 + 75 = 1075. Cabinet flush center = 1075 + 280 = 1355 (for D=560)
const snapCorner = editor.snapFurniture(u1, { x: 300, y: 1355 }, 0);
assert.strictEqual(snapCorner.type, 'wall_snap', 'Must snap to wall');
assert.strictEqual(snapCorner.pos.x, 300, 'Must allow placing right at the corner edge (x=300)');
assert.strictEqual(snapCorner.pos.y, 1355, 'Must align flush against wall surface');
console.log('✓ Test 3 Passed: Unit placed right at corner (x=300) without being artificially clamped away.\n');

// --- TEST 4: Placing Next to Existing Unit Without Overlapping ---
console.log('[TEST 4] Verifying Placement next to existing unit prevents overlap...');
// Place first unit at x = 1000 on wallA
testProj.plan.furniture = [{
  id: 'unit_exist_1',
  name: 'Existing Base 600',
  category: 'kitchen_base',
  dimensions: { W: 600, H: 850, D: 560 },
  elevation: 0,
  pos: { x: 1000, y: 1355 },
  rotY: 0
}];

// User drags second unit near x = 1100 (which directly overlaps the existing unit [700 to 1300])
const u2 = {
  id: 'unit_new_2',
  name: 'New Base 600',
  category: 'kitchen_base',
  dimensions: { W: 600, H: 850, D: 560 },
  elevation: 0,
  rotY: 0
};

// Candidate dragged at x = 1150 (overlapping from the right)
const snapRight = editor.snapFurniture(u2, { x: 1150, y: 1250 }, 0);
assert.strictEqual(snapRight.type, 'wall_snap');
// Snapped flush against existing unit's right edge: 1000 + 300 + 300 = 1600
assert.strictEqual(snapRight.pos.x, 1600, 'Must push flush to positive side of existing unit to prevent overlap');
console.log('✓ Overlap prevented: Unit approaching from right snaps flush side-by-side at x = 1600.');

// Candidate dragged at x = 850 (overlapping from the left)
const snapLeft = editor.snapFurniture(u2, { x: 850, y: 1250 }, 0);
assert.strictEqual(snapLeft.type, 'wall_snap');
// Snapped flush against existing unit's left edge: 1000 - 300 - 300 = 400
assert.strictEqual(snapLeft.pos.x, 400, 'Must push flush to negative side of existing unit to prevent overlap');
console.log('✓ Overlap prevented: Unit approaching from left snaps flush side-by-side at x = 400.');

// Candidate dragged at x = 2000 (well outside the 35mm contact zone, gap = 400mm)
const snapFree = editor.snapFurniture(u2, { x: 2000, y: 1250 }, 0);
assert.strictEqual(snapFree.type, 'wall_snap');
assert.strictEqual(snapFree.pos.x, 2000, 'Must leave unit exactly at x = 2000 when gap is clear');
console.log('✓ Free placement verified: Unit with clearance stays exactly where placed (x = 2000).');

console.log('\n=== ALL FREE PLACEMENT & CLEAN SLATE TESTS PASSED! ===');
