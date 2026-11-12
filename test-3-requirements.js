// Automated test suite for the 3 user requirements
const fs = require('fs');
const path = require('path');

// Mock browser environment for Node.js
global.window = global;
global.document = {
  createElement: () => ({
    width: 512, height: 512,
    getContext: () => new Proxy({}, { get: () => () => ({ addColorStop: () => {} }) })
  })
};
global.Image = function () {
  this.src = '';
  this.onload = null;
};

// Mock THREE.js
global.THREE = {
  Group: function () {
    this.children = [];
    this.add = function (c) { this.children.push(c); };
    this.position = { set: (x, y, z) => { this.x = x; this.y = y; this.z = z; } };
    this.rotation = { y: 0 };
    this.traverse = function (fn) {
      fn(this);
      this.children.forEach(c => { if (c.traverse) c.traverse(fn); else fn(c); });
    };
  },
  BoxGeometry: function (w, h, d) { this.parameters = { width: w, height: h, depth: d }; },
  CylinderGeometry: function (rt, rb, h, s) { this.parameters = { radiusTop: rt, radiusBottom: rb, height: h, radialSegments: s }; },
  MeshStandardMaterial: function (opts) { Object.assign(this, opts); },
  MeshPhysicalMaterial: function (opts) { Object.assign(this, opts); },
  MeshBasicMaterial: function (opts) { Object.assign(this, opts); },
  CanvasTexture: function () { this.repeat = { set: () => {} }; },
  Texture: function (img) { this.image = img; this.repeat = { set: () => {} }; },
  Mesh: function (geo, mat) {
    this.geometry = geo;
    this.material = mat;
    this.position = { set: (x, y, z) => { this.x = x; this.y = y; this.z = z; } };
    this.rotation = { x: 0, y: 0, z: 0 };
    this.userData = {};
  },
  RepeatWrapping: 1000
};

// Load code files
require('./orbix-dado-textures.js');
const Core = require('./orbix-core.js');
const ArchitecturalRenderer = require('./orbix-3d.js');
const PlanEditor = require('./orbix-plan.js');

console.log('--- TEST 1: Only Shutter Base Unit has Legs and Countertop ---');
const arch = new ArchitecturalRenderer();
const mockOSBase = {
  id: 'fm-120 o/s',
  code: 'fm-120 o/s',
  name: 'FM 120 O/S',
  category: 'kitchen_base',
  dimensions: { W: 1200, H: 750, D: 560 },
  unitConfig: { shutters: 2, counter: 'granite' }
};

const fg = new THREE.Group();
const dims = { W: 1200, H: 750, D: 560 };
const carcassMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
const counterMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
const getShutterMat = () => new THREE.MeshStandardMaterial({ color: 0x224488 });

arch.buildOnlyShutterMesh(mockOSBase, fg, dims, carcassMat, getShutterMat, 'bar', null, counterMat, 100, 35, true);

let foundCounter = false;
let foundPlinth = false;
let foundLegs = false;
let foundShutters = false;

fg.children.forEach(child => {
  if (child.geometry && child.geometry.parameters) {
    const p = child.geometry.parameters;
    // Countertop slab is W + 20 (1220), H = 35, D = baseD + 25 (585)
    if (p.width === 1220 && p.height === 35 && p.depth === 585) {
      foundCounter = true;
    }
    // Plinth is W - 30 (1170), H = 100
    if (p.width === 1170 && p.height === 100) {
      foundPlinth = true;
    }
    // Legs have radius 18, height 100
    if (p.radiusTop === 18 && p.height === 100) {
      foundLegs = true;
    }
  }
  // Check for shutter hinges
  if (child.name && child.name.indexOf('ShutterHinge') !== -1) {
    foundShutters = true;
    if (child.position.y > 100) {
      console.log('✓ Shutter vertical position correctly elevated above plinth:', child.position.y);
    }
  }
});

console.log('Found Countertop:', foundCounter);
console.log('Found Plinth:', foundPlinth);
console.log('Found Legs:', foundLegs);
console.log('Found Shutters:', foundShutters);
if (!foundCounter || !foundPlinth || !foundLegs || !foundShutters) {
  throw new Error('Test 1 Failed: Missing countertop, legs, or shutters on base O/S unit');
}
console.log('✓ TEST 1 PASSED!\n');

console.log('--- TEST 2: Dado Tile Texture and Material Options ---');
if (!window.ORBIX_DADO_TEXTURES) throw new Error('ORBIX_DADO_TEXTURES missing');
if (!window.ORBIX_DADO_TEXTURES.rhombus_sage || !window.ORBIX_DADO_TEXTURES.rhombus_sage.startsWith('data:image/jpeg;base64,')) {
  throw new Error('Pattern 1 (rhombus_sage) missing or invalid data URI');
}
if (!window.ORBIX_DADO_TEXTURES.chevron_mono || !window.ORBIX_DADO_TEXTURES.chevron_mono.startsWith('data:image/jpeg;base64,')) {
  throw new Error('Pattern 2 (chevron_mono) missing or invalid data URI');
}
console.log('✓ Both uploaded image patterns exist as base64 textures in ORBIX_DADO_TEXTURES');

const matSage = arch.createDadoTileMaterial('rhombus_sage');
const matMono = arch.createDadoTileMaterial('chevron_mono');
const matSubway = arch.createDadoTileMaterial('subway_white');

if (!matSage || !matSage.map) throw new Error('Sage material creation failed');
if (!matMono || !matMono.map) throw new Error('Mono material creation failed');
if (!matSubway || !matSubway.map) throw new Error('Subway material creation failed');

console.log('✓ ArchitecturalRenderer successfully created materials for all 3 dado tile styles');
console.log('✓ TEST 2 PASSED!\n');

console.log('--- TEST 3: L-Shaped Corner Unit Snapping & Wall Overlap Prevention ---');
const ed = Object.create(PlanEditor.prototype);
ed.project = {
  plan: {
    walls: [
      { id: 'w1', start: { x: 0, y: 1000 }, end: { x: 4000, y: 1000 }, thickness: 150, height: 2800 }
    ],
    rooms: [
      { id: 'r1', polygon: [{ x: 0, y: 1000 }, { x: 4000, y: 1000 }, { x: 4000, y: 4000 }, { x: 0, y: 4000 }] }
    ],
    furniture: []
  }
};
ed.zoom = 0.5;

// Test L-shaped base unit (fbcm)
const fbcmUnit = {
  id: 'fbcm_test_1',
  catalogItemId: 'fbcm',
  name: 'L-SHAPED CORNER BASE UNIT (Cookscape)',
  dimensions: { W: 900, H: 720, D: 560 },
  pos: { x: 1500, y: 1200 },
  rotY: 0,
  unitConfig: {
    unitType: 'fbcm',
    geometryType: 'l_shaped_corner',
    corner: { enabled: true, legW: 900, legD: 900, depth: 560 }
  }
};

// Test L-shaped elevated wall unit (fbcm-1500)
const fbcm1500Unit = {
  id: 'fbcm_test_2',
  catalogItemId: 'fbcm-1500',
  name: 'L-SHAPED CORNER 1500 (Cookscape)',
  dimensions: { W: 900, H: 720, D: 560 },
  elevation: 1500,
  pos: { x: 2500, y: 1200 },
  rotY: 0,
  unitConfig: {
    unitType: 'fbcm',
    geometryType: 'l_shaped_corner',
    corner: { enabled: true, legW: 900, legD: 900, depth: 560 }
  }
};

// Snap fbcmUnit to w1 (horizontal wall at y = 1000)
const snapRes1 = ed.snapFurniture(fbcmUnit, { x: 1500, y: 1250 }, 0);
console.log('Snap Result 1 Pos:', snapRes1.pos);

// Wall centerline is at y = 1000. Wall thickness is 150 (halfT = 75).
// Room is at y > 1000, so inner face of wall is at y = 1075.
// For corner unit, legD = 900, halfD = 450.
// Expected center pos.y = 1000 + (75 + 450) = 1525!
const expectedY = 1000 + 75 + 450;
if (Math.abs(snapRes1.pos.y - expectedY) > 1) {
  throw new Error(`Test 3 Failed: L-unit snapped to y=${snapRes1.pos.y}, expected y=${expectedY}`);
}
console.log('✓ L-Corner Base Unit center placed at y =', snapRes1.pos.y);

// Update unit pos to snapped pos
fbcmUnit.pos = snapRes1.pos;
const jointPts1 = ed.getFurnitureJointPoints(fbcmUnit);
console.log('L-unit Joint Points count:', jointPts1.length);
if (jointPts1.length < 10) throw new Error('L-unit joint points has fewer than 10 points');

const poly1 = Core.getFurniturePolygon(fbcmUnit);
console.log('L-unit Polygon vertex count:', poly1.length);
if (poly1.length < 6) throw new Error('L-unit polygon has fewer than 6 vertices');

// Check that the top-most edge of the polygon sits EXACTLY at the inner face of the wall (y = 1075)
const minY = Math.min(...poly1.map(pt => pt.y));
console.log('L-unit minimum Y (back face closest to wall):', minY);
if (Math.abs(minY - 1075) > 1) {
  throw new Error(`Test 3 Failed: Back face is at y=${minY}, expected 1075 (inner wall surface)`);
}
console.log('✓ Back face sits flush at inner wall face y = 1075 (ZERO wall penetration)!');

// Now test fbcm-1500 unit
const snapRes2 = ed.snapFurniture(fbcm1500Unit, { x: 2500, y: 1250 }, 0);
console.log('Snap Result 2 Pos (fbcm-1500):', snapRes2.pos);
if (Math.abs(snapRes2.pos.y - expectedY) > 1) {
  throw new Error(`Test 3 Failed: fbcm-1500 snapped to y=${snapRes2.pos.y}, expected y=${expectedY}`);
}

fbcm1500Unit.pos = snapRes2.pos;
const poly2 = Core.getFurniturePolygon(fbcm1500Unit);
const minY2 = Math.min(...poly2.map(pt => pt.y));
console.log('fbcm-1500 minimum Y:', minY2);
if (Math.abs(minY2 - 1075) > 1) {
  throw new Error(`Test 3 Failed: fbcm-1500 back face is at y=${minY2}, expected 1075`);
}
console.log('✓ fbcm-1500 also sits flush at inner wall face with ZERO wall penetration!');

// Verify SAT collision test with wall polygon (touching contact is allowed, penetration > 5mm is blocked)
const wallObj = ed.project.plan.walls[0];
const wallPoly = Core.wallPolygon(wallObj);
const isPenetrating = Core.polygonsIntersect(poly1.slice(0, 6), wallPoly, 5);
console.log('Wall Core Penetration (>5mm):', isPenetrating);
if (isPenetrating) throw new Error('Test 3 Failed: L-unit penetrates into wall core!');
console.log('✓ Wall collision test confirmed: flush contact without core penetration');

console.log('✓ TEST 3 PASSED!\n');
console.log('=== ALL TESTS PASSED SUCCESSFULLY! ===');
