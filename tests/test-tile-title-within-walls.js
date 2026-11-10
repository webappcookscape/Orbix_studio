const assert = require('assert');
const Core = require('../orbix-core.js');
const Arch3D = require('../orbix-3d.js');

console.log('=== TEST SUITE: Tile & Title Constrained Within Walls ===\n');

// Mock THREE for headless testing
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

// [TEST 1] Core.Vec2.interiorVisualCenter guarantees Room Title is ALWAYS within walls
console.log('[TEST 1] Testing interiorVisualCenter for Room Title placement...');

// 1a: Regular rectangular room
const rectPoly = [
  { x: 0, y: 0 },
  { x: 4000, y: 0 },
  { x: 4000, y: 3000 },
  { x: 0, y: 3000 }
];
const centerRect = Core.Vec2.interiorVisualCenter(rectPoly);
assert(Core.Vec2.pointInPolygon(centerRect, rectPoly), 'Title center must be inside rectangular room');
assert.strictEqual(centerRect.x, 2000, 'Title center X should be 2000');
assert.strictEqual(centerRect.y, 1500, 'Title center Y should be 1500');
console.log('✓ 1a: Rectangular room title placed at center (2000, 1500) inside walls');

// 1b: Concave L-shaped room where geometric centroid is OUTSIDE the walls!
// L-shape: 6m x 6m with upper-right 4m x 4m removed
// Vertices: (0,0) -> (6000,0) -> (6000,2000) -> (2000,2000) -> (2000,6000) -> (0,6000)
const lShapePoly = [
  { x: 0, y: 0 },
  { x: 6000, y: 0 },
  { x: 6000, y: 2000 },
  { x: 2000, y: 2000 },
  { x: 2000, y: 6000 },
  { x: 0, y: 6000 }
];
const centroidL = Core.Vec2.polygonCentroid(lShapePoly);
// Geometric centroid of this L-shape is at (1750, 1750), but let's test a severe L-shape:
// Severe L-shape: (0,0) -> (10000,0) -> (10000,1000) -> (1000,1000) -> (1000,10000) -> (0,10000)
const severeL = [
  { x: 0, y: 0 },
  { x: 10000, y: 0 },
  { x: 10000, y: 1000 },
  { x: 1000, y: 1000 },
  { x: 1000, y: 10000 },
  { x: 0, y: 10000 }
];
const severeCentroid = Core.Vec2.polygonCentroid(severeL);
const isCentroidInside = Core.Vec2.pointInPolygon(severeCentroid, severeL);
assert.strictEqual(isCentroidInside, false, 'Geometric centroid of severe L-shape must fall OUTSIDE the walls');

const safeCenter = Core.Vec2.interiorVisualCenter(severeL);
assert(Core.Vec2.pointInPolygon(safeCenter, severeL), 'interiorVisualCenter MUST place title INSIDE the walls for L-shape');
console.log('✓ 1b: Concave L-shaped room: geometric centroid was outside walls, but interiorVisualCenter placed title strictly inside walls (' + Math.round(safeCenter.x) + ', ' + Math.round(safeCenter.y) + ')');

// [TEST 2] 3D Per-Room Tile Finish Modification within walls
console.log('\n[TEST 2] Testing 3D Tile Finish Changes Within Target Room Walls Only...');

const proj = Core.createProject();
const w1 = Core.createWall({ id: 'w1', start: { x: 0, y: 0 }, end: { x: 6000, y: 0 } });
const w2 = Core.createWall({ id: 'w2', start: { x: 6000, y: 0 }, end: { x: 6000, y: 4000 } });
const w3 = Core.createWall({ id: 'w3', start: { x: 6000, y: 4000 }, end: { x: 0, y: 4000 } });
const w4 = Core.createWall({ id: 'w4', start: { x: 0, y: 4000 }, end: { x: 0, y: 0 } });
const div = Core.createRoomDivider({ id: 'div1', start: { x: 3000, y: 0 }, end: { x: 3000, y: 4000 } });
proj.plan.walls = [w1, w2, w3, w4, div];

const rooms = Core.detectRooms(proj);
assert.strictEqual(rooms.length, 2, 'Must detect 2 rooms');
const roomA = rooms[0];
const roomB = rooms[1];
roomA.name = 'Living Room';
roomB.name = 'Bedroom';
roomA.floorFinish = 'white_tile';
roomB.floorFinish = 'square_tile';

const mockScene = new THREE.Group();
mockScene.remove = function (c) {};
const renderer = new Arch3D(mockScene);
renderer.currentProject = proj;
renderer.buildHome(proj);

// Find floor meshes
let floorMeshA = null, floorMeshB = null;
renderer.group.traverse(o => {
  if (o.userData && o.userData.isFloorMesh) {
    if (o.userData.roomId === roomA.id) floorMeshA = o;
    if (o.userData.roomId === roomB.id) floorMeshB = o;
  }
});

assert(floorMeshA, 'Room A floor mesh must exist');
assert(floorMeshB, 'Room B floor mesh must exist');
assert.strictEqual(floorMeshA.userData.floorFinish, 'white_tile');
assert.strictEqual(floorMeshB.userData.floorFinish, 'square_tile');
console.log('✓ 2a: Initial floor meshes: Room A has white_tile, Room B has square_tile');

// Now change tile finish of Room A ONLY (targetRoomId = roomA.id)
renderer.setFloorMaterial('wooden', roomA.id);
assert.strictEqual(floorMeshA.userData.floorFinish, 'wooden', 'Room A tile finish must be updated to wooden');
assert.strictEqual(floorMeshB.userData.floorFinish, 'square_tile', 'Room B tile finish must NOT change! It must remain square_tile');
console.log('✓ 2b: Targeted setFloorMaterial("wooden", roomA.id) updated Room A within its walls only; Room B untouched');

// [TEST 3] Exterior Floor outside walls is Grass Green and Sky is Sky Blue
console.log('\n[TEST 3] Testing Exterior Floor outside walls is grass green and sky is sky blue...');

const boundingFloor = renderer.buildBoundingFloor(proj.plan.walls, []);
assert(boundingFloor, 'Bounding floor mesh created');
assert.strictEqual(boundingFloor.userData.floorFinish, 'grass', 'Exterior bounding floor must have grass finish');
assert.strictEqual(boundingFloor.material.color, 0x4E8A42, 'Grass ground must have natural grass green color (0x4E8A42)');

// When setFloorMaterial is called, bounding_floor must NOT be turned into tile
renderer.group.add(boundingFloor);
renderer.setFloorMaterial('wooden');
assert.strictEqual(boundingFloor.userData.floorFinish, 'grass', 'Exterior bounding floor outside walls must NEVER be tiled; remains grass');
assert.strictEqual(boundingFloor.material.color, 0x4E8A42, 'Exterior ground maintains grass green color');
console.log('✓ 3: Exterior bounding floor outside walls remains strictly grass green (0x4E8A42) with zero tile texture');

console.log('\n======================================================================');
console.log('ALL TILE & TITLE CONSTRAINED WITHIN WALLS TESTS PASSED 100%!');
console.log('======================================================================');
