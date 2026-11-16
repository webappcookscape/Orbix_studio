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

console.log('Testing Wall Selection with and without Shift...');

// Create a project with a wall and a furniture unit
const project = Core.createProject('Test Wall Selection');
project.plan.walls = [
  { id: 'w1', start: { x: 0, y: 0 }, end: { x: 3000, y: 0 }, thickness: 200, height: 2800 }
];
const furn1 = Core.createFurniturePlacement('fm-60');
furn1.pos = { x: 1000, y: 100, z: 0 };
project.plan.furniture = [furn1];

const editor = new PlanEditor(mockContainer, { project: project });
editor.activeTool = 'select';
editor.selected = [];

// 1. Click on the wall at (500, 0) WITHOUT Shift
console.log('1. Click wall at (500, 0) with isShift = false');
editor.handleSelectMouseDown({ x: 500, y: 0 }, false);
assert.strictEqual(editor.selected.length, 0, 'Wall should NOT be selected when clicked without Shift');
assert.strictEqual(editor.dragState, null, 'dragState should be null when wall clicked without Shift');
console.log('   PASS: Wall not selected without Shift');

// 2. Click on the wall at (500, 0) WITH Shift
console.log('2. Click wall at (500, 0) with isShift = true');
editor.handleSelectMouseDown({ x: 500, y: 0 }, true);
assert.strictEqual(editor.selected.length, 1, 'Wall SHOULD be selected when clicked with Shift');
assert.strictEqual(editor.selected[0].type, 'wall', 'Selected object must be wall');
assert.strictEqual(editor.selected[0].id, 'w1', 'Selected wall id must match w1');
assert.notEqual(editor.dragState, null, 'dragState should be initialized on Shift+Click');
console.log('   PASS: Wall selected with Shift');

// Reset
editor.selected = [];
editor.dragState = null;

// 3. Click on furniture unit at (1000, 100) WITHOUT Shift
console.log('3. Click furniture at (1000, 100) with isShift = false');
editor.handleSelectMouseDown({ x: 1000, y: 100 }, false);
assert.strictEqual(editor.selected.length, 1, 'Furniture unit should be selected');
assert.strictEqual(editor.selected[0].type, 'furniture', 'Selected object should be furniture');
assert.strictEqual(editor.selected[0].id, furn1.id, 'Selected furniture id must match furn1.id');
console.log('   PASS: Furniture unit selected cleanly without Shift');

console.log('\nAll wall Shift-click tests passed successfully!');
