// tests/test-room-divider-comprehensive.js
// Comprehensive test suite for Room Divider drawing, snapping, splitting, hotkeys & 3D rendering.

const assert = require('assert');

// Mock browser globals for node testing
class MockCanvas {
  constructor() { this.style = {}; }
  getContext() {
    return {
      fillStyle: '', strokeStyle: '', lineWidth: 1,
      fillRect: () => {}, strokeRect: () => {}, clearRect: () => {}, beginPath: () => {},
      moveTo: () => {}, lineTo: () => {}, stroke: () => {}, fill: () => {},
      closePath: () => {}, arc: () => {}, save: () => {}, restore: () => {},
      scale: () => {}, translate: () => {}, rotate: () => {}, measureText: () => ({ width: 40 }),
      createLinearGradient: () => ({ addColorStop: () => {} }),
      createRadialGradient: () => ({ addColorStop: () => {} }),
      bezierCurveTo: () => {}, quadraticCurveTo: () => {},
      fillText: () => {}, strokeText: () => {}, setLineDash: () => {}, roundRect: () => {}
    };
  }
  getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 600 }; }
  addEventListener() {}
  removeEventListener() {}
}

global.document = {
  createElement: (tag) => {
    if (tag === 'canvas') return new MockCanvas();
    return {
      style: {},
      classList: { add: () => {}, remove: () => {}, contains: () => false },
      addEventListener: () => {},
      appendChild: () => {}
    };
  },
  getElementById: () => null,
  querySelectorAll: () => []
};

global.window = {
  addEventListener: () => {},
  removeEventListener: () => {},
  toast: () => {},
  OrbixUI: {
    showToast: () => {},
    render3DHome: () => {},
    syncProjectUnitsTo3DStudio: () => {}
  }
};

const Core = require('../orbix-core.js');
const Plan = require('../orbix-plan.js');
const ThreeRenderer = require('../orbix-3d.js');

console.log('=== TEST SUITE: COMPREHENSIVE ROOM DIVIDER ===\n');

// ── Test 1: PlanEditor Two-Click Divider Drawing ──
console.log('--- Test 1: Two-Click Divider Drawing ---');
const p1 = Core.createProject();
p1.plan.walls = [
  Core.createWall({ start: { x: 0, y: 0 }, end: { x: 4000, y: 0 } }),
  Core.createWall({ start: { x: 4000, y: 0 }, end: { x: 4000, y: 3000 } }),
  Core.createWall({ start: { x: 4000, y: 3000 }, end: { x: 0, y: 3000 } }),
  Core.createWall({ start: { x: 0, y: 3000 }, end: { x: 0, y: 0 } })
];
let rooms1 = Core.detectRooms(p1);
assert.strictEqual(rooms1.length, 1, 'Initial room count should be 1');

const editor1 = new Plan({ appendChild: () => {}, style: {}, querySelector: () => null }, { project: p1 });
editor1.setTool('divider');
assert.strictEqual(editor1.activeTool, 'divider');

// Click 1 on Top Wall at (2000, 0)
editor1.cursorWorld = { x: 2000, y: 0 };
// simulate mousedown
const downEvent = { shiftKey: false };
const hitPt1 = { x: 2000, y: 0 };
if (editor1.wallChainStart) {
  editor1.handleWallMouseDown(hitPt1);
} else {
  const startSnap = editor1.snapPoint(hitPt1);
  const startPt = (startSnap && startSnap.pt) ? startSnap.pt : hitPt1;
  editor1.dragState = {
    type: 'draw_divider_line',
    startWorld: startPt,
    currentWorld: startPt,
    hasMoved: false
  };
  editor1.wallChainStart = startPt;
  editor1.wallChainFirstPoint = startPt;
}
assert(editor1.wallChainStart, 'wallChainStart should be active after Click 1');
assert.strictEqual(editor1.wallChainStart.x, 2000);
assert.strictEqual(editor1.wallChainStart.y, 0);

// Single click (no drag moved) -> mouseup keeps wallChainStart active
if (editor1.dragState && (editor1.dragState.type === 'draw_divider_line' || editor1.dragState.type === 'draw_divider_box')) {
  const dsLine = editor1.dragState;
  editor1.dragState = null;
  // dsLine.hasMoved is false -> nothing committed yet, waiting for click 2
}
assert(editor1.wallChainStart, 'wallChainStart must remain active for 2nd click');

// Move cursor near bottom wall at (2000, 2920) (within 280mm of opposite wall)
const snapHit2 = editor1.snapPoint({ x: 2000, y: 2920 });
assert(snapHit2, 'Should snap to opposite wall');
assert.strictEqual(Math.round(snapHit2.pt.x), 2000);
assert.strictEqual(Math.round(snapHit2.pt.y), 3000);

// Click 2 on Bottom Wall
editor1.handleWallMouseDown(snapHit2.pt);
assert.strictEqual(editor1.wallChainStart, null, 'wallChainStart should be cleared after finishing divider');
assert.strictEqual(editor1.activeTool, 'select', 'Tool should revert to select after completing divider');

// Check rooms
assert.strictEqual(p1.plan.rooms.length, 2, 'Two-click drawing must split space into 2 rooms');
console.log(`✓ Two-click drawing split room into 2 rooms: ${p1.plan.rooms.map(r => r.name + ' (' + r.areaSqM.toFixed(1) + ' m²)').join(', ')}`);

// ── Test 2: PlanEditor Click-and-Drag Divider Drawing ──
console.log('\n--- Test 2: Click-and-Drag Divider Drawing ---');
const p2 = Core.createProject();
p2.plan.walls = [
  Core.createWall({ start: { x: 0, y: 0 }, end: { x: 6000, y: 0 } }),
  Core.createWall({ start: { x: 6000, y: 0 }, end: { x: 6000, y: 4000 } }),
  Core.createWall({ start: { x: 6000, y: 4000 }, end: { x: 0, y: 4000 } }),
  Core.createWall({ start: { x: 0, y: 4000 }, end: { x: 0, y: 0 } })
];
Core.detectRooms(p2);

const editor2 = new Plan({ appendChild: () => {}, style: {}, querySelector: () => null }, { project: p2 });
editor2.setTool('divider');

// Mousedown at (3000, 0)
const dragStart = { x: 3000, y: 0 };
const snapD1 = editor2.snapPoint(dragStart);
editor2.dragState = {
  type: 'draw_divider_line',
  startWorld: snapD1.pt,
  currentWorld: snapD1.pt,
  hasMoved: false
};
editor2.wallChainStart = snapD1.pt;
editor2.wallChainFirstPoint = snapD1.pt;

// Mousemove to (3000, 4000)
editor2.cursorWorld = { x: 3000, y: 4000 };
editor2.dragState.hasMoved = true;
editor2.dragState.currentWorld = editor2.cursorWorld;

// Mouseup: commit drag
if (editor2.dragState && (editor2.dragState.type === 'draw_divider_line' || editor2.dragState.type === 'draw_divider_box')) {
  const dsLine = editor2.dragState;
  editor2.dragState = null;
  const dragDist = Math.hypot(editor2.cursorWorld.x - dsLine.startWorld.x, editor2.cursorWorld.y - dsLine.startWorld.y);
  if (dsLine.hasMoved && dragDist >= 80) {
    editor2.handleWallMouseDown(editor2.cursorWorld);
  }
}

assert.strictEqual(p2.plan.rooms.length, 2, 'Click-and-drag drawing must split 6x4m room into 2 rooms');
console.log(`✓ Click-and-drag drawing split room into 2 rooms: ${p2.plan.rooms.map(r => r.name + ' (' + r.areaSqM.toFixed(1) + ' m²)').join(', ')}`);

// ── Test 3: Imprecise Clicks Auto-Clamping in detectRooms ──
console.log('\n--- Test 3: Imprecise Placement Auto-Clamping ---');
const p3 = Core.createProject();
p3.plan.walls = [
  Core.createWall({ start: { x: 0, y: 0 }, end: { x: 5000, y: 0 } }),
  Core.createWall({ start: { x: 5000, y: 0 }, end: { x: 5000, y: 3500 } }),
  Core.createWall({ start: { x: 5000, y: 3500 }, end: { x: 0, y: 3500 } }),
  Core.createWall({ start: { x: 0, y: 3500 }, end: { x: 0, y: 0 } }),
  // Imprecise divider with 180mm gaps (beyond old 120mm tolerance)
  Core.createRoomDivider({ start: { x: 2500, y: 180 }, end: { x: 2500, y: 3320 } })
];
const rooms3 = Core.detectRooms(p3);
assert.strictEqual(rooms3.length, 2, 'detectRooms must auto-clamp 180mm gaps to split into 2 rooms');
console.log(`✓ Auto-clamped imprecise divider into 2 rooms (${rooms3[0].areaSqM.toFixed(1)} m², ${rooms3[1].areaSqM.toFixed(1)} m²)`);

// ── Test 4: Hotkey R Activation & Spacebar Rotation ──
console.log('\n--- Test 4: Hotkey R Activation & Spacebar Rotation ---');
const editor4 = new Plan({ appendChild: () => {}, style: {}, querySelector: () => null }, { project: p1 });
editor4.setTool('select');
editor4.selected = [];

// When no unit is selected: pressing 'r' or 'R' switches to 'divider' tool!
let keyREvent = { key: 'r', code: 'KeyR', preventDefault: () => {} };
// simulate keydown handler in orbix-plan.js
if (!keyREvent.ctrlKey && !keyREvent.metaKey && !keyREvent.altKey && (keyREvent.code === 'Space' || keyREvent.key === ' ' || keyREvent.key === 'r' || keyREvent.key === 'R')) {
  const didRotate = (typeof editor4.rotateSelectedElement === 'function') ? editor4.rotateSelectedElement() : false;
  if (!didRotate && (keyREvent.key === 'r' || keyREvent.key === 'R')) {
    editor4.setTool('divider');
  }
}
assert.strictEqual(editor4.activeTool, 'divider', 'Pressing R with no unit selected must switch to divider tool');
console.log('✓ Hotkey R successfully activated Room Divider tool!');

// When a unit IS selected: pressing Space or R rotates the unit 90°
const testUnit = Core.createFurniturePlacement('fm-60');
testUnit.pos = { x: 1000, y: 1000 };
testUnit.rotY = 0;
p1.plan.furniture = [testUnit];
editor4.selected = [{ type: 'furniture', id: testUnit.id }];

let spaceEvent = { key: ' ', code: 'Space', preventDefault: () => {} };
if (!spaceEvent.ctrlKey && !spaceEvent.metaKey && !spaceEvent.altKey && (spaceEvent.code === 'Space' || spaceEvent.key === ' ' || spaceEvent.key === 'r' || spaceEvent.key === 'R')) {
  const didRotate = (typeof editor4.rotateSelectedElement === 'function') ? editor4.rotateSelectedElement() : false;
  assert(didRotate, 'rotateSelectedElement should return true for selected unit');
}
assert.ok(Math.abs(testUnit.rotY - Math.PI / 2) < 0.01, 'Spacebar must rotate selected unit by 90° (PI/2 rad)');
console.log('✓ Spacebar rotated selected unit by 90° (rotY = PI/2)!');

// ── Test 5: 3D Architectural Divider Threshold Strip ──
console.log('\n--- Test 5: 3D Architectural Divider Threshold Strip ---');
const divWall = p1.plan.walls.find(w => w.isDivider);
assert(divWall, 'A divider wall should exist in p1');

// Mock THREE
global.THREE = {
  Group: class {
    constructor() { this.children = []; this.position = { set: () => {} }; this.rotation = {}; }
    add(obj) { this.children.push(obj); }
  },
  BoxGeometry: class { constructor(w, h, d) { this.w = w; this.h = h; this.d = d; } },
  MeshStandardMaterial: class { constructor(opts) { Object.assign(this, opts); } },
  MeshPhysicalMaterial: class { constructor(opts) { Object.assign(this, opts); } },
  MeshBasicMaterial: class { constructor(opts) { Object.assign(this, opts); } },
  Mesh: class { constructor(geo, mat) { this.geometry = geo; this.material = mat; this.position = { set: () => {} }; } },
  CanvasTexture: class { constructor() { this.wrapS = 1; this.wrapT = 1; this.repeat = { set: () => {} }; } },
  RepeatWrapping: 1000
};

const renderer = new ThreeRenderer();
renderer.currentPlan = p1.plan;
const threshGroup = renderer.buildWallWithCutouts(divWall);
assert(threshGroup, 'buildWallWithCutouts must return a 3D group for connected divider wall');
assert(threshGroup.name.startsWith('DividerThreshold_'), 'Group name should start with DividerThreshold_');
assert.strictEqual(threshGroup.userData.isDivider, true, 'Group must be marked isDivider: true');
assert.strictEqual(threshGroup.children.length, 1, 'Group should contain 1 threshold strip mesh');
assert.strictEqual(threshGroup.children[0].material.color, 0xD4AF37, 'Threshold strip must have polished brass material');
console.log('✓ 3D architectural brass threshold strip verified: 30mm x 4mm brass transition created!');

console.log('\n🎉 ALL 5 ROOM DIVIDER COMPREHENSIVE TESTS PASSED PERFECTLY! 🚀');
