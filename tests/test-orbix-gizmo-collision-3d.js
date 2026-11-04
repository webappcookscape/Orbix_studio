const assert = require('assert');
const Core = require('../orbix-core.js');

console.log('--- 1. Testing Core.checkPlacementOverlap ---');

// Build 2 walls meeting at a 90-degree corner at (0, 0)
const w1 = Core.createWall({ id: 'w1', start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, thickness: 150 });
const w2 = Core.createWall({ id: 'w2', start: { x: 0, y: 0 }, end: { x: 0, y: 4000 }, thickness: 150 });

// Add a door opening on Wall 1 from 1500 to 2400 mm
const op1 = Core.createOpening({
  id: 'op1',
  wallId: 'w1',
  type: 'door',
  offset: 1500,
  width: 900,
  height: 2100
});

const plan = {
  walls: [w1, w2],
  openings: [op1],
  furniture: []
};

// Case A: Valid unit placed cleanly along Wall 1 right in the corner (touching Wall 1 and Wall 2)
// Wall 1 Y range: [-75, 75]. Unit back at Y = 75. Depth = 600 -> Center Y = 375.
// Wall 2 X range: [-75, 75]. Unit left at X = 75. Width = 1000 -> Center X = 575.
const fCornerValid = {
  id: 'furn_c1',
  name: 'Base Unit Clean Corner',
  category: 'kitchen_base',
  pos: { x: 575, y: 375 },
  dimensions: { W: 1000, H: 850, D: 600 },
  rotY: 0,
  elevation: 0
};

const chkValid = Core.checkPlacementOverlap(fCornerValid, plan, fCornerValid.id);
console.log('Clean corner placement overlap:', chkValid.hasOverlap);
assert.strictEqual(chkValid.hasOverlap, false, 'Clean corner placement must NOT collide!');

// Case B: Unit penetrates into Wall 2 by 60mm (left edge at X=15, inside Wall 2 core)
const fWall2Penetration = {
  id: 'furn_c2',
  name: 'Base Unit Wall 2 Penetration',
  category: 'kitchen_base',
  pos: { x: 515, y: 375 },
  dimensions: { W: 1000, H: 850, D: 600 },
  rotY: 0,
  elevation: 0
};

const chkW2 = Core.checkPlacementOverlap(fWall2Penetration, plan, fWall2Penetration.id);
console.log('Wall 2 penetration overlap:', chkW2.hasOverlap, 'type:', chkW2.type);
assert.strictEqual(chkW2.hasOverlap, true, 'Penetrating into Wall 2 must trigger collision!');
assert.strictEqual(chkW2.type, 'wall', 'Collision type must be wall');

// Case C: Unit penetrates into Wall 1 by 60mm (back edge at Y=15, inside Wall 1 core)
const fWall1Penetration = {
  id: 'furn_c3',
  name: 'Base Unit Wall 1 Penetration',
  category: 'kitchen_base',
  pos: { x: 575, y: 315 },
  dimensions: { W: 1000, H: 850, D: 600 },
  rotY: 0,
  elevation: 0
};

const chkW1 = Core.checkPlacementOverlap(fWall1Penetration, plan, fWall1Penetration.id);
console.log('Wall 1 penetration overlap:', chkW1.hasOverlap, 'type:', chkW1.type);
assert.strictEqual(chkW1.hasOverlap, true, 'Penetrating into Wall 1 must trigger collision!');

// Case D: Two units placed overlapping in the corner
const fCornerCabinet2 = {
  id: 'furn_c4',
  name: 'Corner Cabinet 2 along Wall 2',
  category: 'kitchen_base',
  pos: { x: 375, y: 575 },
  dimensions: { W: 1000, H: 850, D: 600 },
  rotY: Math.PI / 2,
  elevation: 0
};

plan.furniture = [fCornerValid];
const chkFurnCol = Core.checkPlacementOverlap(fCornerCabinet2, plan, fCornerCabinet2.id);
console.log('Corner units mutual collision:', chkFurnCol.hasOverlap, 'type:', chkFurnCol.type);
assert.strictEqual(chkFurnCol.hasOverlap, true, 'Overlapping units in corner must collide!');
assert.strictEqual(chkFurnCol.type, 'furniture', 'Collision type must be furniture');

// Case E: Unit placed blocking door opening
const fDoorObstruction = {
  id: 'furn_door_block',
  name: 'Cabinet blocking door',
  category: 'wardrobe',
  pos: { x: 1950, y: 375 },
  dimensions: { W: 1000, H: 2100, D: 600 },
  rotY: 0,
  elevation: 0
};

const chkDoor = Core.checkPlacementOverlap(fDoorObstruction, plan, fDoorObstruction.id);
console.log('Door opening obstruction overlap:', chkDoor.hasOverlap, 'type:', chkDoor.type);
assert.strictEqual(chkDoor.hasOverlap, true, 'Blocking door must trigger collision!');
assert.strictEqual(chkDoor.type, 'opening', 'Collision type must be opening');

console.log('--- 2. Testing 3D Architectural Renderer & Bed Generation ---');

// Mock THREE.js minimal environment
global.THREE = {
  Group: function() {
    this.children = [];
    this.add = function(c) { this.children.push(c); };
    this.position = { x: 0, y: 0, z: 0, set: function(x, y, z) { this.x = x; this.y = y; this.z = z; } };
    this.rotation = { x: 0, y: 0, z: 0 };
    this.userData = {};
    this.traverse = function(cb) { cb(this); this.children.forEach(function(c) { if(c.traverse) c.traverse(cb); else cb(c); }); };
  },
  Mesh: function(geo, mat) {
    this.geometry = geo;
    this.material = mat;
    this.position = { x: 0, y: 0, z: 0, set: function(x, y, z) { this.x = x; this.y = y; this.z = z; } };
    this.rotation = { x: 0, y: 0, z: 0 };
    this.userData = {};
    this.isMesh = true;
  },
  BoxGeometry: function(w, h, d) { this.w = w; this.h = h; this.d = d; },
  CylinderGeometry: function(rt, rb, h, s) { this.h = h; },
  ConeGeometry: function(r, h, s) { this.h = h; },
  MeshStandardMaterial: function(opts) { Object.assign(this, opts); },
  MeshPhysicalMaterial: function(opts) { Object.assign(this, opts); },
  MeshBasicMaterial: function(opts) { Object.assign(this, opts); },
  CanvasTexture: function() {},
  DoubleSide: 2,
  RepeatWrapping: 1000,
  sRGBEncoding: 3001
};

global.window = {
  OrbixCore: Core,
  LAMINATES: []
};

// Require orbix-3d
const Orbix3D = require('../orbix-3d.js');
const renderer = new Orbix3D();

// Test Bed Unit Mesh
const bedFurn = {
  id: 'bed_king_01',
  name: 'King Size Bed with Headboard',
  category: 'bed',
  pos: { x: 1500, y: 2000, z: 0 },
  dimensions: { W: 1800, H: 1000, D: 2100 },
  rotY: 0,
  elevation: 0
};

const bedMesh = renderer.buildFurnitureMesh(bedFurn);
console.log('Bed mesh built. Children count:', bedMesh.children.length);
assert(bedMesh.children.length >= 4, 'Bed mesh must have headboard, frame, mattress, and pillows!');
assert.strictEqual(bedMesh.visible, true, 'Bed mesh must be visible in 3D Home!');

// Test Open Box unit (e.g. spice_rack or kitchen_os)
const openFurn = {
  id: 'spice_01',
  name: 'Spice Rack Open Box',
  category: 'spice_rack',
  pos: { x: 1000, y: 200, z: 1500 },
  dimensions: { W: 600, H: 600, D: 350 },
  rotY: 0,
  elevation: 1500
};

const openMesh = renderer.buildFurnitureMesh(openFurn);
// Verify no shutters generated on open box
let hasShutter = false;
openMesh.traverse(function(c) {
  if (c.userData && (c.userData.isShutter || c.userData.isShutterHinge || c.userData.isShutterGroup)) {
    hasShutter = true;
  }
});
console.log('Open shelf has shutters:', hasShutter);
assert.strictEqual(hasShutter, false, 'Open shelf / spice rack unit must NOT have front shutters!');
assert.strictEqual(openMesh.visible, true, 'Open shelf unit must be visible in 3D Home!');

console.log('\n>>> ALL 3D CAD GIZMO & WALL/CORNER OVERLAP TESTS PASSED! <<<');
