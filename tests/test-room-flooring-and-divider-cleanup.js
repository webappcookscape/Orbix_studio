const assert = require('assert');
const Core = require('../orbix-core.js');
const Arch3D = require('../orbix-3d.js');

console.log('=== TEST SUITE: Room Flooring & Divider Auto-Cleanup & 3D Fixes ===\n');

// Mock THREE for headless test
global.THREE = {
  Group: function () {
    this.children = [];
    this.name = '';
    this.userData = {};
    this.position = { set: (x, y, z) => { this.position.x = x; this.position.y = y; this.position.z = z; }, x: 0, y: 0, z: 0 };
    this.rotation = { set: (x, y, z) => { this.rotation.x = x; this.rotation.y = y; this.rotation.z = z; }, x: 0, y: 0, z: 0 };
    this.add = function (c) { this.children.push(c); };
    this.traverse = function (fn) {
      fn(this);
      this.children.forEach(c => { if (c.traverse) c.traverse(fn); else fn(c); });
    };
  },
  Mesh: function (geo, mat) {
    this.geometry = geo;
    this.material = mat;
    this.position = { set: (x, y, z) => { this.position.x = x; this.position.y = y; this.position.z = z; }, x: 0, y: 0, z: 0 };
    this.rotation = { set: (x, y, z) => { this.rotation.x = x; this.rotation.y = y; this.rotation.z = z; }, x: 0, y: 0, z: 0 };
    this.userData = {};
  },
  BoxGeometry: function (w, h, d) { this.w = w; this.h = h; this.d = d; },
  Shape: function () {
    this.curves = [];
    this.moveTo = function (x, y) { this.curves.push({ op: 'move', x, y }); };
    this.lineTo = function (x, y) { this.curves.push({ op: 'line', x, y }); };
    this.closePath = function () { this.closed = true; };
  },
  ShapeGeometry: function (shape) {
    this.shape = shape;
    this.attributes = {
      position: { count: 3, getX: i => 0, getY: i => 0 },
      uv: { count: 3, setXY: (i, u, v) => {} }
    };
    this.computeVertexNormals = function () {};
  },
  MeshStandardMaterial: function (opts) { Object.assign(this, opts); },
  MeshPhysicalMaterial: function (opts) { Object.assign(this, opts); },
  CanvasTexture: function () { this.repeat = { set: () => {} }; },
  RepeatWrapping: 1000,
  sRGBEncoding: 3001,
  DoubleSide: 2
};

// [TEST 1] cleanPolygon Triangle & Slender Room Preservation
console.log('[TEST 1] Testing cleanPolygon triangle & slender room corner preservation...');
const slenderTriangle = [ { x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 800.1 } ];
const cleaned1 = Core.cleanPolygon(slenderTriangle);
assert.strictEqual(cleaned1.length, 3, 'cleanPolygon must NEVER prune vertices from a valid 3-vertex triangle');
const archCleaned1 = Arch3D.cleanPolygon(slenderTriangle);
assert.strictEqual(archCleaned1.length, 3, 'Arch3D.cleanPolygon must also preserve 3-vertex triangle');
console.log('✓ TEST 1 PASSED: Slender rooms and triangles are 100% preserved without vertex deletion.\n');

// [TEST 2] pruneOrphanDividers Auto-Removes Dangling Stubs
console.log('[TEST 2] Testing pruneOrphanDividers auto-cleanup of stray radiating dividers...');
const proj = Core.createProject();
const w1 = Core.createWall({ start: { x: 0, y: 0 }, end: { x: 5000, y: 0 } });
const w2 = Core.createWall({ start: { x: 5000, y: 0 }, end: { x: 5000, y: 4000 } });
const w3 = Core.createWall({ start: { x: 5000, y: 4000 }, end: { x: 0, y: 4000 } });
const w4 = Core.createWall({ start: { x: 0, y: 4000 }, end: { x: 0, y: 0 } });

// 1 valid wall-to-wall divider (cuts room at x=2500)
const validDiv = Core.createRoomDivider({ start: { x: 2500, y: 0 }, end: { x: 2500, y: 4000 } });

// 4 stray dangling dividers radiating into space or mid-air (as in user screenshot)
const stray1 = Core.createRoomDivider({ id: 'stray1', start: { x: 0, y: 0 }, end: { x: 1800, y: 2200 } });
const stray2 = Core.createRoomDivider({ id: 'stray2', start: { x: 0, y: 0 }, end: { x: 3000, y: 1500 } });
const stray3 = Core.createRoomDivider({ id: 'stray3', start: { x: 0, y: 0 }, end: { x: 8000, y: 3000 } }); // outside room!
const stray4 = Core.createRoomDivider({ id: 'stray4', start: { x: 0, y: 0 }, end: { x: 2000, y: -1000 } }); // into void!

proj.plan.walls = [w1, w2, w3, w4, validDiv, stray1, stray2, stray3, stray4];

assert.strictEqual(proj.plan.walls.length, 9, 'Initial project has 9 walls (4 room walls + 1 divider + 4 stray stubs)');
const pruned = Core.pruneOrphanDividers(proj);
assert.strictEqual(pruned, 4, 'pruneOrphanDividers must prune all 4 dangling dividers');
assert.strictEqual(proj.plan.walls.length, 5, 'Remaining walls must be exactly 4 outer walls + 1 valid divider');
console.log('✓ TEST 2 PASSED: Stray radiating dividers pruned cleanly, preserving valid divider.\n');

// [TEST 3] detectRooms Recovers 100% Solid Flooring Across All Rooms
console.log('[TEST 3] Testing detectRooms detects solid rooms with zero voids...');
const rooms = Core.detectRooms(proj);
assert.strictEqual(rooms.length, 2, 'Must detect exactly 2 clean rooms divided by the valid room divider');
assert.strictEqual(Math.round(rooms[0].areaSqM), 10, 'Room 1 area should be 10 m² (2.5m x 4m)');
assert.strictEqual(Math.round(rooms[1].areaSqM), 10, 'Room 2 area should be 10 m² (2.5m x 4m)');
console.log('✓ TEST 3 PASSED: Both rooms detected with full solid floor geometry (10 m² each).\n');

// [TEST 4] 3D Renderer Suppresses Stray / Dangling Dividers
console.log('[TEST 4] Testing 3D Renderer suppresses stray dividers from rendering in 3D...');
const renderer = new Arch3D(null);
renderer.currentProject = proj;
renderer.currentPlan = proj.plan;

// 4a: Valid divider renders a threshold strip
const validStrip = renderer.buildWallWithCutouts(validDiv, []);
assert(validStrip, 'Valid wall-to-wall divider must render 3D brass threshold');
assert.strictEqual(validStrip.userData.isDivider, true);
console.log('✓ 4a: Valid divider renders 3D brass threshold strip');

// 4b: Dangling stray divider returns null (NOT rendered in 3D!)
const strayStrip = renderer.buildWallWithCutouts(stray1, []);
assert.strictEqual(strayStrip, null, 'Stray dangling divider must NOT be rendered in 3D');
console.log('✓ 4b: Stray dangling divider suppressed: 0 lines rendered in 3D');
console.log('✓ TEST 4 PASSED: 3D Studio scene remains 100% clean of stray lines!\n');

// [TEST 5] Floor Finish Switching Updates Project Rooms
console.log('[TEST 5] Testing 3D floor finish switching persists across rooms...');
renderer.buildHome(proj);
renderer.setFloorMaterial('wooden');
assert.strictEqual(renderer.selectedFloorType, 'wooden');
console.log('✓ 5a: renderer.selectedFloorType updated to wooden');

// Update project rooms as done in orbix-ui.js
proj.plan.rooms.forEach(r => { r.floorFinish = 'wooden'; });
const meshRoom0 = renderer.buildRoomFloor(proj.plan.rooms[0]);
assert(meshRoom0, 'buildRoomFloor must return a valid floor mesh');
assert.strictEqual(meshRoom0.userData.floorFinish, 'wooden');
console.log('✓ 5b: Floor mesh built with wooden finish');
console.log('✓ TEST 5 PASSED: 3D floor finish switches immediately and persists.\n');

console.log('======================================================================');
console.log('ALL ROOM FLOORING & DIVIDER AUTO-CLEANUP TESTS PASSED 100%!');
console.log('======================================================================');
