// tests/test-wall-moving-removed.js
// Verification that wall moving feature is completely stopped and removed

const assert = require('assert');
const Core = require('../orbix-core.js');

console.log('--- Testing Wall Moving Feature Removal ---');

// Mock browser globals for Node test environment
class MockCanvas {
  constructor(w, h) { this.width = w || 800; this.height = h || 600; this.style = {}; }
  getContext(type) {
    return {
      fillStyle: '', strokeStyle: '', lineWidth: 1,
      fillRect: () => {}, strokeRect: () => {}, clearRect: () => {}, beginPath: () => {},
      moveTo: () => {}, lineTo: () => {}, stroke: () => {}, fill: () => {},
      closePath: () => {}, arc: () => {}, save: () => {}, restore: () => {},
      scale: () => {}, translate: () => {}, rotate: () => {}, measureText: () => ({ width: 40 }),
      fillText: () => {}, strokeText: () => {}, setLineDash: () => {}, roundRect: () => {}
    };
  }
  getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 600 }; }
  addEventListener() {}
  removeEventListener() {}
}

const mockContainer = {
  style: {},
  appendChild: () => {},
  querySelector: () => null,
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 })
};

global.document = {
  createElement: (tag) => {
    if (tag === 'canvas') return new MockCanvas(800, 600);
    return { classList: { add: () => {}, remove: () => {} }, style: {}, appendChild: () => {}, addEventListener: () => {} };
  },
  getElementById: () => null,
  querySelectorAll: () => []
};

global.window = {
  innerWidth: 1920, innerHeight: 1080, document: global.document,
  addEventListener: () => {}, removeEventListener: () => {}, LAMINATES: []
};

const PlanModule = require('../orbix-plan.js');
const PlanEditor = PlanModule.PlanEditor || PlanModule;

const project = Core.createProject({ title: 'Wall Moving Test' });
const testWall = Core.createWall({
  start: { x: 1000, y: 1000 },
  end: { x: 4000, y: 1000 },
  thickness: 150
});
const testFurn = Core.createFurniturePlacement({
  id: 'furn_test',
  modelType: 'kitchen_fm',
  pos: { x: 2000, y: 2000 },
  width: 1000, depth: 600, height: 2100
});
project.plan.walls = [testWall];
project.plan.furniture = [testFurn];

const editor = new PlanEditor(mockContainer, { project: project });

// [Test 1] Clicking a Wall Selects It But Does NOT Initiate Move Wall
console.log('\n[Test 1] Clicking a Wall Selects It But Does NOT Initiate Move Wall');
const clickWallPt = { x: 2500, y: 1000 };
editor.handleSelectMouseDown(clickWallPt, false);

assert.strictEqual(editor.selected.length, 1, 'Wall should be selected');
assert.strictEqual(editor.selected[0].type, 'wall', 'Selected item must be type wall');
assert.strictEqual(editor.selected[0].id, testWall.id, 'Selected item ID must match test wall');
assert.strictEqual(editor.dragState, null, 'dragState MUST be null; move_wall must not be initiated');
console.log('✓ Wall clicked: Selected successfully without activating move_wall dragState.');

// [Test 2] Clicking Endpoint Handle of Selected Wall Does NOT Drag Vertex
console.log('\n[Test 2] Clicking Endpoint Handle of Selected Wall Does NOT Drag Vertex');
const clickStartPt = { x: 1000, y: 1000 };
editor.handleSelectMouseDown(clickStartPt, false);
assert.strictEqual(editor.dragState, null, 'dragState MUST be null; move_vertex must not be initiated');
console.log('✓ Endpoint clicked: dragState remains null, preventing vertex dragging.');

// [Test 3] Wall Coordinates Remain Strictly Invariant
console.log('\n[Test 3] Wall Coordinates Remain Strictly Invariant');
assert.strictEqual(testWall.start.x, 1000);
assert.strictEqual(testWall.start.y, 1000);
assert.strictEqual(testWall.end.x, 4000);
assert.strictEqual(testWall.end.y, 1000);
console.log('✓ Wall start and end points remain completely locked in place.');

// [Test 4] Furniture Moving Remains Fully Functional
console.log('\n[Test 4] Furniture Moving Remains Fully Functional');
const clickFurnPt = { x: 2000, y: 2000 };
editor.handleSelectMouseDown(clickFurnPt, false);
assert(editor.dragState, 'dragState should be active for furniture');
assert.strictEqual(editor.dragState.type, 'move_furniture', 'dragState type must be move_furniture');
assert.strictEqual(editor.selected[0].id, testFurn.id, 'Selected furniture unit verified');
console.log('✓ Furniture dragging remains active and functional.');

console.log('\nALL WALL MOVING REMOVAL TESTS PASSED PERFECTLY!\n');
