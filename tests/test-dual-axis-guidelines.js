const assert = require('assert');

// Mock browser environment if needed for PlanEditor
function createMockElement() {
  return {
    appendChild: function() {},
    addEventListener: function() {},
    removeEventListener: function() {},
    getBoundingClientRect: function() { return { left: 0, top: 0, width: 1200, height: 800 }; },
    getContext: function() {
      return {
        scale: function() {},
        clearRect: function() {},
        fillRect: function() {},
        measureText: function(t) { return { width: (t || '').length * 7 }; },
        beginPath: function() {},
        moveTo: function() {},
        lineTo: function() {},
        arc: function() {},
        stroke: function() {},
        fill: function() {},
        rect: function() {},
        roundRect: function() {},
        save: function() {},
        restore: function() {},
        setLineDash: function() {},
        fillText: function() {},
        strokeText: function() {},
        translate: function() {},
        rotate: function() {}
      };
    },
    style: {}
  };
}

global.window = {
  addEventListener: function() {},
  removeEventListener: function() {}
};
global.document = {
  createElement: function() { return createMockElement(); },
  addEventListener: function() {},
  removeEventListener: function() {}
};

const Core = require('../orbix-core.js');
const PlanEditor = require('../orbix-plan.js');

console.log('=== TEST SUITE: Dual-Axis Guidelines (X and Y Axis) ===\n');

const dummyContainer = createMockElement();
const editor = new PlanEditor(dummyContainer, {
  units: 'mm',
  plan: {
    walls: [
      Core.createWall({ start: { x: 1000, y: 1000 }, end: { x: 5100, y: 1000 }, thickness: 150, height: 2800 }),
      Core.createWall({ start: { x: 5100, y: 1000 }, end: { x: 5100, y: 3000 }, thickness: 150, height: 2800 })
    ],
    rooms: [],
    furniture: [],
    openings: [],
    snapToGrid: true
  }
});

// Setup 3rd line drawing state:
// Wall 1: (1000, 1000) -> (5100, 1000) [Length = 4100 mm]
// Wall 2: (5100, 1000) -> (5100, 3000) [Length = 2000 mm]
// User is drawing 3rd wall starting from (5100, 3000), moving leftwards towards X = 1000
editor.wallChainFirstPoint = { x: 1000, y: 1000 };
editor.wallChainStart = { x: 5100, y: 3000 };

console.log('[TEST 1] Setting 3rd line horizontally: mouse near X=1040, Y=3015');
const mousePos = { x: 1040, y: 3015 };
const snap = editor.snapPoint(mousePos);

console.log('Snap Result:', {
  pt: snap.pt,
  type: snap.type,
  label: snap.label,
  distMm: snap.distMm,
  isDualAxis: snap.isDualAxis,
  alignedVertex: snap.alignedVertex
});

assert.strictEqual(snap.pt.x, 1000, 'X should snap exactly to 1000 (aligned with top-left corner X)');
assert.strictEqual(snap.pt.y, 3000, 'Y should stay locked to horizontal wall line at Y=3000');
assert.strictEqual(snap.distMm, 4100, 'Distance should match exact inner wall length (4100 mm)');
assert.strictEqual(snap.isDualAxis, true, 'isDualAxis flag must be true');
assert(snap.alignedVertex, 'alignedVertex must be set');
assert.strictEqual(snap.alignedVertex.x, 1000, 'alignedVertex.x must be 1000');
assert.strictEqual(snap.alignedVertex.y, 1000, 'alignedVertex.y must be 1000');
console.log('✔ TEST 1 PASSED: 3rd line snaps on both X and Y axis simultaneously!\n');

console.log('[TEST 2] Verifying renderPreview draws both axis lines in Canvas context');
let linesDrawn = [];
const mockCtx = {
  measureText: function(t) { return { width: 50 }; },
  beginPath: function() { linesDrawn.push({ type: 'beginPath' }); },
  moveTo: function(x, y) { linesDrawn.push({ type: 'moveTo', x: Math.round(x), y: Math.round(y) }); },
  lineTo: function(x, y) { linesDrawn.push({ type: 'lineTo', x: Math.round(x), y: Math.round(y) }); },
  arc: function() {},
  closePath: function() {},
  stroke: function() { linesDrawn.push({ type: 'stroke' }); },
  fill: function() {},
  rect: function() {},
  roundRect: function() {},
  save: function() {},
  restore: function() {},
  setLineDash: function(d) { linesDrawn.push({ type: 'dash', dash: d }); },
  fillText: function() {},
  strokeText: function() {},
  translate: function() {},
  rotate: function() {}
};

// Set cursorWorld so renderPreview picks it up
editor.cursorWorld = mousePos;
editor.width = 1200;
editor.height = 800;
editor.renderPreview(mockCtx);

// Verify that stroke calls occurred with dash
const dashCalls = linesDrawn.filter(l => l.type === 'dash');
assert(dashCalls.length >= 1, 'Guideline dashed stroke must be set');

// Verify that at least 2 distinct line segments were drawn for the dual guidelines
const lineToCalls = linesDrawn.filter(l => l.type === 'lineTo');
assert(lineToCalls.length >= 2, 'Must draw at least 2 axis line segments (X-axis and Y-axis)');
console.log('✔ TEST 2 PASSED: Both X-axis and Y-axis guidelines rendered to canvas!\n');

console.log('[TEST 3] Vertical 3rd line alignment (e.g. L to U in vertical orientation)');
editor.project.plan.walls = [
  Core.createWall({ start: { x: 1000, y: 1000 }, end: { x: 1000, y: 4000 }, thickness: 150, height: 2800 }),
  Core.createWall({ start: { x: 1000, y: 4000 }, end: { x: 3500, y: 4000 }, thickness: 150, height: 2800 })
];
editor.wallChainFirstPoint = { x: 1000, y: 1000 };
editor.wallChainStart = { x: 3500, y: 4000 };

// User draws 3rd wall vertically upwards from (3500, 4000) towards Y = 1000
const mousePosVert = { x: 3510, y: 1060 };
const snapVert = editor.snapPoint(mousePosVert);

console.log('Vertical Snap Result:', {
  pt: snapVert.pt,
  distMm: snapVert.distMm,
  isDualAxis: snapVert.isDualAxis,
  alignedVertex: snapVert.alignedVertex
});

assert.strictEqual(snapVert.pt.x, 3500, 'X must be locked to 3500');
assert.strictEqual(snapVert.pt.y, 1000, 'Y must snap exactly to 1000');
assert.strictEqual(snapVert.distMm, 3000, 'Distance must be 3000 mm');
assert.strictEqual(snapVert.isDualAxis, true, 'isDualAxis must be true');
console.log('✔ TEST 3 PASSED: Vertical dual-axis alignment works with millimeter precision!\n');

console.log('======================================================================');
console.log('ALL DUAL-AXIS GUIDELINES TESTS PASSED 100%!');
console.log('======================================================================');
