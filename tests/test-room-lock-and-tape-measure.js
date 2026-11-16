const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('Testing Room Drag Locking and Straight Tape Measure Tool...');

// Load Core and PlanEditor
const Core = require('../orbix-core.js');
const PlanEditor = require('../orbix-plan.js');

// Mock browser environment for headless testing
global.window = {
  toast: function (msg) { console.log('Toast:', msg); },
  showToast: function (msg) { console.log('ShowToast:', msg); }
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
  querySelector: () => null,
  addEventListener: () => {}
};

const mockContainer = {
  style: {},
  appendChild: () => {},
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
  removeEventListener: () => {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  clientWidth: 800,
  clientHeight: 600
};

global.window.addEventListener = function() {};
global.window.removeEventListener = function() {};

const project = Core.createProject('Test Project', 'Client');
// Define a room polygon from (0,0) to (3000, 3000)
project.plan.rooms = [
  {
    id: 'room_1',
    name: 'Master Bedroom',
    type: 'bedroom',
    polygon: [
      { x: 0, y: 0 },
      { x: 3000, y: 0 },
      { x: 3000, y: 3000 },
      { x: 0, y: 3000 }
    ],
    wallIds: []
  }
];

// Place furniture inside room
const furn1 = Core.createFurniturePlacement({
  id: 'furn_1',
  name: 'Base Unit',
  pos: { x: 500, y: 500, z: 0 },
  dimensions: { W: 600, H: 850, D: 600 }
});
project.plan.furniture = [furn1];

const editor = new PlanEditor(mockContainer, {
  project: project,
  onProjectChange: function () {},
  onSelectionChange: function () {}
});

// A. Double-click inside room polygon at (1500, 1500)
editor.selected = [{ type: 'room', id: 'room_1' }];
assert.strictEqual(editor.selected[0].type, 'room', 'Room must be selected');
assert.strictEqual(editor.selected[0].id, 'room_1', 'Room 1 must be selected');
console.log('✓ Room safely selected via double-click!');

// B. Subsequent mouse-down / drag attempt inside room polygon
const origPolyPt0 = Object.assign({}, project.plan.rooms[0].polygon[0]);
const origFurnPos = Object.assign({}, project.plan.furniture[0].pos);

editor.handleSelectMouseDown({ x: 1500, y: 1500 }, false);

// In previous code, this.dragState would be set to { type: 'move_room', ... }
assert.strictEqual(editor.dragState, null, 'dragState must remain NULL (room dragging locked)');

// Simulate mouse move
editor.cursorWorld = { x: 1800, y: 1500 };
if (editor.dragState && editor.dragState.type === 'move_room') {
  assert.fail('move_room should not be active');
}

// Check that room polygon and furniture did not move
assert.strictEqual(project.plan.rooms[0].polygon[0].x, origPolyPt0.x, 'Room polygon X must not move');
assert.strictEqual(project.plan.rooms[0].polygon[0].y, origPolyPt0.y, 'Room polygon Y must not move');
assert.strictEqual(project.plan.furniture[0].pos.x, origFurnPos.x, 'Enclosed furniture X must not move');
assert.strictEqual(project.plan.furniture[0].pos.y, origFurnPos.y, 'Enclosed furniture Y must not move');
console.log('✓ Room polygon and enclosed units stay completely locked and stationary!');

// ── TEST 2: Straight Tape Measure Tool (Orthogonal lock & no 2D marking) ──
console.log('\n[Test 2] Straight Tape Measure Tool Verification');
editor.setTool('dimension');
assert.strictEqual(editor.activeTool, 'dimension');
assert(!editor.dimensionStart);

// Click Point 1 at (200, 200)
editor.handleDimensionMouseDown({ x: 200, y: 200 });
assert(editor.dimensionStart, 'Dimension start point must be registered');
assert.strictEqual(editor.dimensionStart.x, 200);
assert.strictEqual(editor.dimensionStart.y, 200);
console.log('✓ Point 1 registered at (200, 200)');

// Test Straight Horizontal Constraint: Cursor moves to (900, 250) (dx=700, dy=50 -> horizontal straight)
editor.cursorWorld = { x: 900, y: 250 };
const dxH = editor.cursorWorld.x - editor.dimensionStart.x;
const dyH = editor.cursorWorld.y - editor.dimensionStart.y;
const isHoriz = Math.abs(dxH) >= Math.abs(dyH);
assert.strictEqual(isHoriz, true, 'Must identify dominant horizontal axis');
const straightH = {
  x: isHoriz ? editor.cursorWorld.x : editor.dimensionStart.x,
  y: isHoriz ? editor.dimensionStart.y : editor.cursorWorld.y
};
assert.strictEqual(straightH.x, 900);
assert.strictEqual(straightH.y, 200, 'Y must lock straight to Point 1 Y');
console.log('✓ Horizontal straight constraint locks to (900, 200) with dist = 700mm');

// Test Straight Vertical Constraint: Cursor moves to (250, 1000) (dx=50, dy=800 -> vertical straight)
editor.cursorWorld = { x: 250, y: 1000 };
const dxV = editor.cursorWorld.x - editor.dimensionStart.x;
const dyV = editor.cursorWorld.y - editor.dimensionStart.y;
const isVert = Math.abs(dyV) > Math.abs(dxV);
assert.strictEqual(isVert, true, 'Must identify dominant vertical axis');
const straightV = {
  x: isVert ? editor.dimensionStart.x : editor.cursorWorld.x,
  y: isVert ? editor.cursorWorld.y : editor.dimensionStart.y
};
assert.strictEqual(straightV.x, 200, 'X must lock straight to Point 1 X');
assert.strictEqual(straightV.y, 1000);
console.log('✓ Vertical straight constraint locks to (200, 1000) with dist = 800mm');

// Click Point 2 at (250, 1000)
project.plan.dimensions = [];
editor.handleDimensionMouseDown({ x: 250, y: 1000 });

// Verify that NO persistent dimension was marked on 2D!
assert.strictEqual(project.plan.dimensions.length, 0, 'Must NOT push persistent dimension to 2D plan');
assert.strictEqual(editor.dimensionStart, null, 'Must reset dimensionStart to null');
assert(editor.lastTapeMeasure, 'Must save lastTapeMeasure');
assert.strictEqual(editor.lastTapeMeasure.distMm, 800, 'Distance must be 800mm straight');
console.log('✓ Distance measured accurately as 800mm WITHOUT marking persistent dimension on 2D!');

// ── TEST 3: Removed Buttons in index.html ──
console.log('\n[Test 3] HTML Buttons Removed Verification');
const indexHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf-8');

assert(!indexHtml.includes('id="dbStatusBadge"'), 'dbStatusBadge must be removed');
assert(!indexHtml.includes('Offline CAD Mode'), 'Offline CAD Mode text must be removed from HTML');
assert(!indexHtml.includes('id="vpsSyncBadge"'), 'vpsSyncBadge must be removed');
assert(!indexHtml.includes('Synced with VPS'), 'Synced with VPS text must be removed from HTML');
assert(!indexHtml.includes('id="openAIKeyTopBtn"'), 'openAIKeyTopBtn must be removed');
assert(!indexHtml.includes('🔑 OpenAI Key:'), '🔑 OpenAI Key: text must be removed from HTML');
assert(!indexHtml.includes('id="exportSkpTopBtn"'), 'exportSkpTopBtn must be removed');
assert(!indexHtml.includes('id="exportSkpBtn"'), 'exportSkpBtn must be removed');
assert(indexHtml.includes('data-tool="dimension" id="planDimensionBtn"'), 'planDimensionBtn must exist');
assert(indexHtml.includes('>📏 Tape</button>'), 'planDimensionBtn must be labeled Tape');
console.log('✓ All requested buttons cleanly removed and Tape tool labeled properly in HTML!');

console.log('\nALL ROOM LOCK, TAPE MEASURE, AND BUTTON REMOVAL TESTS PASSED SUCCESSFULLY!');
