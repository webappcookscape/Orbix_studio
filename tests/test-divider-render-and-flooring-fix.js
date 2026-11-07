/**
 * Test Suite: Room Divider Corner Stroke, Null-Safe Vec2, and Floor Mesh Robustness
 * Verifies fixes for:
 * 1. orbix-core.js:35 TypeError: Cannot read properties of undefined (reading 'x')
 * 2. orbix-ui.js:862 TypeError: Cannot read properties of null (reading 'getWall')
 * 3. Seamless room deletion and floor recalculation on divider removal
 */

var assert = require('assert');
var Core = require('../orbix-core.js');

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
      fillText: () => {}, strokeText: () => {}, setLineDash: () => {}, roundRect: () => {},
      bezierCurveTo: () => {}
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

var PlanModule = require('../orbix-plan.js');
var PlanEditor = PlanModule.PlanEditor || PlanModule;

console.log('--- Running Divider & Flooring Defect Verification Tests ---');

// 1. Test Vec2 Null Safety
console.log('\n[Test 1] Vec2 Null-Safety Guards');
assert.strictEqual(Core.Vec2.dist(null, { x: 10, y: 10 }), 0, 'dist with null a should be 0');
assert.strictEqual(Core.Vec2.dist({ x: 10, y: 10 }, undefined), 0, 'dist with undefined b should be 0');
assert.strictEqual(Core.Vec2.distSq(null, null), 0, 'distSq with null should be 0');
assert.strictEqual(Core.Vec2.len(undefined), 0, 'len with undefined should be 0');
assert.strictEqual(Core.Vec2.angle(null, { x: 5, y: 5 }), 0, 'angle with null should be 0');
assert.strictEqual(Core.Vec2.dot(null, { x: 1, y: 1 }), 0, 'dot with null should be 0');
assert.strictEqual(Core.Vec2.cross({ x: 1, y: 1 }, null), 0, 'cross with null should be 0');
console.log('✓ Vec2 methods never throw on null/undefined coordinates');

// 2. Test PlanEditor.renderWalls with Connected Room Divider
console.log('\n[Test 2] PlanEditor.renderWalls with Room Divider meeting Walls');
var testProject = {
  plan: {
    walls: [
      { id: 'w1', start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, thickness: 150, height: 2800 },
      { id: 'w2', start: { x: 4000, y: 0 }, end: { x: 4000, y: 3000 }, thickness: 150, height: 2800 },
      { id: 'w3', start: { x: 4000, y: 3000 }, end: { x: 0, y: 3000 }, thickness: 150, height: 2800 },
      { id: 'w4', start: { x: 0, y: 3000 }, end: { x: 0, y: 0 }, thickness: 150, height: 2800 },
      // Room divider connecting w1 and w3
      { id: 'div1', start: { x: 2000, y: 0 }, end: { x: 2000, y: 3000 }, thickness: 0, height: 2800, isDivider: true }
    ],
    openings: [],
    rooms: [],
    furniture: []
  }
};

var editor = new PlanEditor(mockContainer, {
  project: testProject,
  onProjectChange: function () {},
  onSelectionChange: function () {}
});

var ctxMock = new MockCanvas().getContext('2d');
assert.doesNotThrow(function () {
  editor.renderWalls(ctxMock);
}, 'renderWalls must not throw when walls are connected to a room divider');
console.log('✓ PlanEditor.renderWalls rendered walls and dividers cleanly without crash');

// 3. Test deleteSelected updating rooms
console.log('\n[Test 3] deleteSelected re-runs detectRooms');
Core.detectRooms(testProject);
assert.strictEqual(testProject.plan.rooms.length, 2, 'Should detect 2 rooms with divider');

// Select the divider and delete it
editor.selected = [{ type: 'wall', id: 'div1' }];
editor.deleteSelected();
assert.strictEqual(testProject.plan.walls.some(function(w){ return w.id === 'div1'; }), false, 'Divider removed from walls');
assert.strictEqual(testProject.plan.rooms.length, 1, 'detectRooms automatically re-ran: single room remains');
console.log('✓ Deleting room divider immediately cleans up stale rooms');

console.log('\nALL DIVIDER & FLOORING DEFECT TESTS PASSED PERFECTLY!');
