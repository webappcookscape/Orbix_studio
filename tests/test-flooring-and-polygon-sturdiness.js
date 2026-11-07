// tests/test-flooring-and-polygon-sturdiness.js
// Verification of robust room flooring, polygon sanitization, dead-end pruning, and streak elimination

const assert = require('assert');
const Core = require('../orbix-core.js');

console.log('--- Testing Robust Room Flooring & Polygon Sanitization ---');

// Mock browser globals for Node test environment
class MockCanvas {
  constructor(w, h) { this.width = w || 512; this.height = h || 512; }
  getContext(type) {
    return {
      fillStyle: '', strokeStyle: '', lineWidth: 1,
      fillRect: () => {}, strokeRect: () => {}, beginPath: () => {},
      moveTo: () => {}, lineTo: () => {}, bezierCurveTo: () => {}, stroke: () => {},
      createLinearGradient: () => ({ addColorStop: () => {} }),
      createRadialGradient: () => ({ addColorStop: () => {} })
    };
  }
}

global.document = {
  createElement: (tag) => {
    if (tag === 'canvas') return new MockCanvas(512, 512);
    return { classList: { add: () => {}, remove: () => {} }, style: {}, addEventListener: () => {} };
  },
  getElementById: () => null,
  querySelectorAll: () => []
};

global.window = { innerWidth: 1920, innerHeight: 1080, document: global.document, LAMINATES: [] };

global.THREE = {
  DoubleSide: 2,
  RepeatWrapping: 1000,
  sRGBEncoding: 3001,
  ACESFilmicToneMapping: 4,
  PCFSoftShadowMap: 2,
  CanvasTexture: function (canvas) {
    this.canvas = canvas;
    this.wrapS = 0; this.wrapT = 0;
    this.repeat = { set: (x, y) => { this.repeatX = x; this.repeatY = y; } };
  },
  MeshStandardMaterial: function (params) { Object.assign(this, params); },
  MeshPhysicalMaterial: function (params) { Object.assign(this, params); },
  MeshBasicMaterial: function (params) { Object.assign(this, params); },
  Shape: function () {
    this.points = [];
    this.moveTo = (x, y) => this.points.push({ x, y });
    this.lineTo = (x, y) => this.points.push({ x, y });
    this.closePath = () => {};
  },
  ShapeGeometry: function (shape) {
    this.shape = shape;
    const pts = shape.points || [];
    this.attributes = {
      position: {
        count: pts.length,
        getX: (i) => pts[i] ? pts[i].x : 0,
        getY: (i) => pts[i] ? pts[i].y : 0
      },
      uv: {
        setXY: (i, u, v) => { this.uvs = this.uvs || []; this.uvs[i] = [u, v]; },
        needsUpdate: false
      }
    };
    this.computeVertexNormals = () => {};
  },
  BoxGeometry: function (w, h, d) { this.parameters = { width: w, height: h, depth: d }; },
  Group: function () {
    this.children = [];
    this.position = { x: 0, y: 0, z: 0, set: function(x, y, z) { this.x = x; this.y = y; this.z = z; } };
    this.rotation = { x: 0, y: 0, z: 0 };
    this.add = (c) => this.children.push(c);
    this.traverse = function (fn) {
      fn(this);
      this.children.forEach(c => { if (c.traverse) c.traverse(fn); else fn(c); });
    };
  },
  Mesh: function (geo, mat) {
    this.geometry = geo;
    this.material = mat;
    this.position = { x: 0, y: 0, z: 0, set: function(x, y, z) { this.x = x; this.y = y; this.z = z; } };
    this.rotation = { x: 0, y: 0, z: 0 };
    this.userData = {};
  }
};

const ArchRenderer = require('../orbix-3d.js');
const renderer = new ArchRenderer(null);

// [Test 1] Core.cleanPolygon Sanitizer Unit Tests
console.log('\n[Test 1] cleanPolygon Sanitizer Unit Tests');
// 1.1 Duplicates
const dupPoly = [{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }];
const cleanDups = Core.cleanPolygon(dupPoly);
assert.strictEqual(cleanDups.length, 4, 'Consecutive duplicate vertices within 20mm must be pruned');

// 1.2 Spikes (A -> B -> A)
const spikePoly = [
  { x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 6000, y: 0 },
  { x: 7500, y: 1500 }, // Antenna / Dead-end spike tip
  { x: 6000, y: 0 },    // Return back along same wall
  { x: 8000, y: 0 }, { x: 8000, y: 3000 }, { x: 0, y: 3000 }
];
const cleanSpike = Core.cleanPolygon(spikePoly);
assert.strictEqual(cleanSpike.length, 4, 'Dead-end antenna spike and intermediate collinear point must be pruned');
console.log('✓ cleanPolygon eliminated dead-end spikes and duplicate vertices.');

// [Test 2] Planar Graph Dead-End Pruning in detectRooms
console.log('\n[Test 2] Planar Graph Dead-End Pruning in detectRooms');
const projectWithDanglingWalls = Core.createProject();
projectWithDanglingWalls.plan.walls = [
  Core.createWall({ start: { x: 0, y: 0 }, end: { x: 4000, y: 0 } }),
  Core.createWall({ start: { x: 4000, y: 0 }, end: { x: 4000, y: 3000 } }),
  Core.createWall({ start: { x: 4000, y: 3000 }, end: { x: 0, y: 3000 } }),
  Core.createWall({ start: { x: 0, y: 3000 }, end: { x: 0, y: 0 } }),
  // Inward angled dangling wall (stub divider)
  Core.createWall({ start: { x: 2000, y: 0 }, end: { x: 2000, y: 1500 } }),
  // Outward angled open wall
  Core.createWall({ start: { x: 4000, y: 0 }, end: { x: 6000, y: -1000 } })
];
const rooms = Core.detectRooms(projectWithDanglingWalls);
assert.strictEqual(rooms.length, 1, 'Exactly 1 enclosed room must be detected');
assert.strictEqual(rooms[0].polygon.length, 4, 'Room polygon must contain only the 4 true enclosing room corners');
console.log('✓ Dangling interior and exterior walls pruned cleanly; room polygon has 4 corners.');

// [Test 3] Floor Mesh Construction in 3D Studio
console.log('\n[Test 3] Floor Mesh Construction in 3D Studio');
const floorMesh = renderer.buildRoomFloor(rooms[0]);
assert(floorMesh, 'Floor mesh must be created successfully');
assert.strictEqual(floorMesh.userData.isFloorMesh, true);
assert(Math.abs(floorMesh.rotation.x - (-Math.PI / 2)) < 0.001, 'Floor mesh must lie flat on X-Z floor plane');
assert.strictEqual(floorMesh.position.y, 1, 'Floor mesh must have 1mm Y offset to prevent Z-fighting');
console.log('✓ buildRoomFloor returned flat, non-degenerate mesh.');

// [Test 4] Multi-Room Layout with Room Divider
console.log('\n[Test 4] Multi-Room Layout with Room Divider');
const multiProject = Core.createProject();
multiProject.plan.walls = [
  Core.createWall({ start: { x: 0, y: 0 }, end: { x: 8000, y: 0 } }),
  Core.createWall({ start: { x: 8000, y: 0 }, end: { x: 8000, y: 4000 } }),
  Core.createWall({ start: { x: 8000, y: 4000 }, end: { x: 0, y: 4000 } }),
  Core.createWall({ start: { x: 0, y: 4000 }, end: { x: 0, y: 0 } }),
  // Divider wall partitioning into 2 rooms
  Core.createRoomDivider({ start: { x: 4000, y: 0 }, end: { x: 4000, y: 4000 } })
];
const multiRooms = Core.detectRooms(multiProject);
assert.strictEqual(multiRooms.length, 2, 'Must detect 2 rooms divided by Room Divider');
const floor1 = renderer.buildRoomFloor(multiRooms[0]);
const floor2 = renderer.buildRoomFloor(multiRooms[1]);
assert(floor1 && floor2, 'Both divided rooms must have valid 3D floor meshes');
assert.strictEqual(floor1.geometry.attributes.position.count, 4);
assert.strictEqual(floor2.geometry.attributes.position.count, 4);
console.log('✓ Multi-room layout with Room Divider produced 2 clean, independent floor meshes.');

// [Test 5] Dynamic Floor Material Switching with UV Scaling
console.log('\n[Test 5] Dynamic Floor Material Switching with UV Scaling');
renderer.group = new THREE.Group();
renderer.group.add(floor1);
renderer.setFloorMaterial('wooden');
assert.strictEqual(renderer.selectedFloorType, 'wooden');
assert.strictEqual(floor1.userData.floorFinish, 'wooden');
// Wooden uses 1200mm tile scale
const woodU = floor1.geometry.uvs[1][0];
renderer.setFloorMaterial('white_tile');
assert.strictEqual(renderer.selectedFloorType, 'white_tile');
assert.strictEqual(floor1.userData.floorFinish, 'white_tile');
// White tile uses 1600mm tile scale
const tileU = floor1.geometry.uvs[1][0];
assert(Math.abs(woodU - tileU) > 0.001, 'UV scaling must adjust proportionally when floor material changes');
console.log('✓ Floor material switcher dynamically updates floor meshes and UV coordinates.');

// [Test 6] Degenerate Polygon & Out-of-Bounds Rejection
console.log('\n[Test 6] Degenerate Polygon & Out-of-Bounds Rejection');
const degenerateRoom = {
  id: 'bad_rm',
  polygon: [{ x: 0, y: 0 }, { x: 10, y: 10 }] // only 2 points
};
const nullFloor = renderer.buildRoomFloor(degenerateRoom);
assert.strictEqual(nullFloor, null, 'Degenerate polygons with < 3 points must return null');
console.log('✓ Degenerate polygons cleanly rejected without crashing.');

console.log('\nALL ROBUST ROOM FLOORING & POLYGON SANITIZATION TESTS PASSED PERFECTLY!\n');
