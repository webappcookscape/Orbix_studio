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
    width: 800,
    height: 600
  }),
  getElementById: () => null,
  querySelectorAll: () => [],
  querySelector: () => null
};

const PlanEditor = require('../orbix-plan.js');

console.log('Testing Unique Furniture Instance IDs & Independent Editing/Deletion...');

// ── TEST 1: Direct Core.createFurniturePlacement ──
console.log('\n[Test 1] Core.createFurniturePlacement Multiple FM 60 Instances');
const u1 = Core.createFurniturePlacement('fm-60');
const u2 = Core.createFurniturePlacement('fm-60');
console.log('Unit 1 ID:', u1.id, 'catalogItemId:', u1.catalogItemId);
console.log('Unit 2 ID:', u2.id, 'catalogItemId:', u2.catalogItemId);

assert(u1.id, 'u1 must have an id');
assert(u2.id, 'u2 must have an id');
assert.notStrictEqual(u1.id, u2.id, 'Each placed FM 60 instance must have a UNIQUE id');
assert.strictEqual(u1.catalogItemId, 'fm-60', 'catalogItemId must be fm-60');
assert.strictEqual(u2.catalogItemId, 'fm-60', 'catalogItemId must be fm-60');
console.log('✓ Direct placement generates distinct instance IDs!');

// ── TEST 2: 2D Plan Placement Sequence (FM 60 then FM 60) ──
console.log('\n[Test 2] PlanEditor Sequential Unit Placement (fm-60 then fm-60)');
const project = Core.createProject('Test Sequential Placement');
const editor = new PlanEditor(mockContainer, { project: project });

const fm60Preset = Core.FURNITURE_CATALOG.find(f => f.id === 'fm-60');
assert(fm60Preset, 'fm-60 must exist in catalog');

// Select fm-60 in tool
editor.furniturePreset = Object.assign({}, fm60Preset);
editor.activeTool = 'furniture';

// Place 1st FM 60 at (1000, 1000)
editor.handleFurnitureMouseDown({ x: 1000, y: 1000 });

// Place 2nd FM 60 at (2000, 1000)
editor.furniturePreset = Object.assign({}, fm60Preset);
editor.activeTool = 'furniture';
editor.handleFurnitureMouseDown({ x: 2000, y: 1000 });

assert.strictEqual(project.plan.furniture.length, 2, 'Must have 2 units placed on plan');
const placed1 = project.plan.furniture[0];
const placed2 = project.plan.furniture[1];
console.log('Placed 1 ID:', placed1.id, 'Name:', placed1.name, 'W:', placed1.dimensions.W);
console.log('Placed 2 ID:', placed2.id, 'Name:', placed2.name, 'W:', placed2.dimensions.W);

assert.notStrictEqual(placed1.id, placed2.id, 'Placed 1 and Placed 2 must have different IDs');

// ── TEST 3: Independent Width Editing ──
console.log('\n[Test 3] Independent Editing Verification');
// User selects placed 2 and changes width to 750
editor.selected = [{ type: 'furniture', id: placed2.id }];

// Simulate inspector finding unit by ID
const targetUnit = project.plan.furniture.find(f => f.id === editor.selected[0].id);
assert.strictEqual(targetUnit.id, placed2.id, 'Must locate exactly unit 2 by ID');
targetUnit.dimensions.W = 750;

console.log('After editing Unit 2:');
console.log('Unit 1 Width:', placed1.dimensions.W, 'mm (expected 600mm)');
console.log('Unit 2 Width:', placed2.dimensions.W, 'mm (expected 750mm)');

assert.strictEqual(placed1.dimensions.W, 600, 'Unit 1 width must remain 600mm');
assert.strictEqual(placed2.dimensions.W, 750, 'Unit 2 width must be 750mm');
console.log('✓ Changing Unit 2 width does NOT affect Unit 1!');

// ── TEST 4: Independent Deletion ──
console.log('\n[Test 4] Independent Deletion Verification');
// Delete unit 2
editor.selected = [{ type: 'furniture', id: placed2.id }];
editor.deleteSelected();

console.log('Remaining units after deleting Unit 2:', project.plan.furniture.length);
assert.strictEqual(project.plan.furniture.length, 1, 'Exactly 1 unit must remain');
assert.strictEqual(project.plan.furniture[0].id, placed1.id, 'Unit 1 must remain untouched on plan');
console.log('✓ Deleting Unit 2 deletes ONLY Unit 2!');

// ── TEST 5: Legacy Project De-duplication on Deserialize ──
console.log('\n[Test 5] Legacy Duplicate ID De-duplication');
const legacyJson = JSON.stringify({
  schemaVersion: '1.0.0',
  plan: {
    walls: [],
    openings: [],
    rooms: [],
    furniture: [
      { id: 'fm-60', name: 'FM 60 (1)', dimensions: { W: 600, H: 850, D: 550 } },
      { id: 'fm-60', name: 'FM 60 (2)', dimensions: { W: 600, H: 850, D: 550 } }
    ]
  }
});

const cleanedProject = Core.deserializeProject(legacyJson);
const fClean = cleanedProject.plan.furniture;
console.log('Cleaned Unit 1 ID:', fClean[0].id);
console.log('Cleaned Unit 2 ID:', fClean[1].id);
assert.notStrictEqual(fClean[0].id, fClean[1].id, 'Legacy duplicate IDs must be automatically de-duplicated on load');
console.log('✓ Legacy projects with duplicate IDs are automatically sanitized!');

console.log('\nALL UNIQUE INSTANCE ID & EDITING/DELETION TESTS PASSED PERFECTLY!');

