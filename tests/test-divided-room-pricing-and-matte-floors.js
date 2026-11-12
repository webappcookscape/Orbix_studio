const assert = require('assert');
const Core = require('../orbix-core.js');

console.log('=== TEST SUITE: DIVIDED ROOM PRICING, MATTE FLOORS & 2D ARCHITECTURAL UI ===\n');

// ─────────────────────────────────────────────────────────────────────────────
// Part 1: Divided Room Units Association in Pricing Page
// ─────────────────────────────────────────────────────────────────────────────
console.log('--- Part 1: Divided Room Units in Pricing Page ---');

const project = Core.createProject();
// 4 outer walls: 6000 x 4000 Living Room
project.plan.walls = [
  Core.createWall({ start: { x: 0, y: 0 }, end: { x: 6000, y: 0 } }),
  Core.createWall({ start: { x: 6000, y: 0 }, end: { x: 6000, y: 4000 } }),
  Core.createWall({ start: { x: 6000, y: 4000 }, end: { x: 0, y: 4000 } }),
  Core.createWall({ start: { x: 0, y: 4000 }, end: { x: 0, y: 0 } })
];

// Inner divided room: 1500 x 1500 mm Pooja Room at (1500, 1500) to (3000, 3000)
project.plan.walls.push(
  Core.createRoomDivider({ start: { x: 1500, y: 1500 }, end: { x: 3000, y: 1500 } }),
  Core.createRoomDivider({ start: { x: 3000, y: 1500 }, end: { x: 3000, y: 3000 } }),
  Core.createRoomDivider({ start: { x: 3000, y: 3000 }, end: { x: 1500, y: 3000 } }),
  Core.createRoomDivider({ start: { x: 1500, y: 3000 }, end: { x: 1500, y: 1500 } })
);

Core.detectRooms(project);
assert.strictEqual(project.plan.rooms.length, 2);
const livingRoom = project.plan.rooms.find(r => r.name.indexOf('Living') !== -1);
const poojaRoom = project.plan.rooms.find(r => r.name.indexOf('Pooja') !== -1);
assert(livingRoom, 'Living room must exist');
assert(poojaRoom, 'Pooja room must exist');

// Place Unit 1 in Living Room: pos = (5000, 2000)
const unitLiving = Core.createFurniturePlacement({
  name: 'TV Base 2 Door',
  category: 'base',
  pos: { x: 5000, y: 2000, z: 0 },
  dimensions: { W: 1200, H: 800, D: 560 }
});

// Place Unit 2 inside the Pooja Room: pos = (2000, 2000)
const unitPooja = Core.createFurniturePlacement({
  name: 'Pooja Mandir Unit',
  category: 'wardrobe',
  pos: { x: 2000, y: 2000, z: 0 },
  dimensions: { W: 900, H: 1800, D: 450 }
});

project.plan.furniture = [unitLiving, unitPooja];

// Generate quotation
const quote = Core.generateFullQuotation(project);

// Verify unit room assignment
assert.strictEqual(unitLiving.roomId, livingRoom.id, 'Living room unit must be assigned to Living Room');
assert.strictEqual(unitPooja.roomId, poojaRoom.id, 'Pooja room unit must be assigned to Pooja Room');
assert.strictEqual(unitPooja.roomName, poojaRoom.name);

// Verify room-wise summary in quotation
const poojaSummary = quote.allRoomsSummary.find(s => s.id === poojaRoom.id);
assert(poojaSummary, 'Pooja room must have its own room breakdown summary');
assert.strictEqual(poojaSummary.itemCount, 1, 'Pooja room summary must have 1 unit');
assert(poojaSummary.woodworkSubtotal > 0, 'Pooja room woodwork subtotal must be positive');

const livingSummary = quote.allRoomsSummary.find(s => s.id === livingRoom.id);
assert(livingSummary, 'Living room must have its own room breakdown summary');
assert.strictEqual(livingSummary.itemCount, 1, 'Living room summary must have 1 unit');

console.log('✓ Divided room units in pricing verified: Units placed in Pooja Room show as separate room units with own subtotal!');

// Test filtered quotation for Pooja Room only
const poojaFilteredQuote = Core.generateFullQuotation(project, [poojaRoom.id]);
assert.strictEqual(poojaFilteredQuote.furnitureItems.length, 1);
assert.strictEqual(poojaFilteredQuote.furnitureItems[0].name, 'Pooja Mandir Unit');
console.log('✓ Pricing page room filter verified: Filtering by Pooja Room selects only Pooja Room units!');

// ─────────────────────────────────────────────────────────────────────────────
// Part 2: Matte Floor Materials (No Glossy Finish)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Part 2: Matte Floor Materials (No Glossy Finish) ---');

// Mock THREE for 3D tests
global.THREE = {
  DoubleSide: 2,
  MeshStandardMaterial: class {
    constructor(opts) {
      Object.assign(this, opts);
      this.color = { setHex: (hex) => { this._hex = hex; } };
    }
  },
  MeshPhysicalMaterial: class {
    constructor(opts) {
      Object.assign(this, opts);
      this.color = { setHex: (hex) => { this._hex = hex; } };
    }
  },
  Shape: class {
    constructor() {
      this.holes = [];
      this.points = [];
    }
    moveTo(x, y) { this.points.push({ x, y }); }
    lineTo(x, y) { this.points.push({ x, y }); }
    closePath() {}
  },
  Path: class {
    constructor() { this.points = []; }
    moveTo(x, y) { this.points.push({ x, y }); }
    lineTo(x, y) { this.points.push({ x, y }); }
    closePath() {}
  },
  ShapeGeometry: class {
    constructor(shape) {
      this.shape = shape;
      this.attributes = {
        position: {
          count: 4,
          getX: (i) => i * 100,
          getY: (i) => i * 100
        },
        uv: {
          setXY: () => {},
          needsUpdate: false
        }
      };
    }
    computeVertexNormals() {}
  },
  Mesh: class {
    constructor(geo, mat) {
      this.geometry = geo;
      this.material = mat;
      this.rotation = { x: 0, y: 0, z: 0 };
      this.position = { x: 0, y: 0, z: 0 };
      this.userData = {};
    }
  },
  Texture: class {
    constructor() { this.wrapS = 0; this.wrapT = 0; this.repeat = { set: () => {} }; }
  },
  CanvasTexture: class {
    constructor() { this.wrapS = 0; this.wrapT = 0; this.repeat = { set: () => {} }; }
  },
  RepeatWrapping: 1000
};

// Mock canvas for procedural floor texture
global.document = global.document || {};
global.document.createElement = (tag) => {
  if (tag === 'canvas') {
    return {
      width: 512, height: 512,
      getContext: () => ({
        fillStyle: '', strokeStyle: '', lineWidth: 1,
        fillRect: () => {}, strokeRect: () => {}, beginPath: () => {},
        moveTo: () => {}, lineTo: () => {}, stroke: () => {}, fill: () => {},
        arc: () => {}, save: () => {}, restore: () => {}, createLinearGradient: () => ({ addColorStop: () => {} }),
        bezierCurveTo: () => {},
        measureText: () => ({ width: 30 }), fillText: () => {}
      })
    };
  }
  return {};
};

const ArchRenderer = require('../orbix-3d.js');
const renderer = new ArchRenderer({ appendChild: () => {} });

// Check white tile floor material roughness (matte, non-glossy)
const whiteTileMat = renderer.createFloorMaterial('white_tile');
assert(whiteTileMat.roughness >= 0.78, 'Floor material roughness must be >= 0.78 for matte finish');
assert.strictEqual(whiteTileMat.metalness, 0.0, 'Floor material metalness must be 0.0 to prevent metallic reflections');
assert.strictEqual(whiteTileMat.polygonOffset, true, 'polygonOffset must be enabled to prevent z-fighting');

// Check wooden floor material roughness
const woodMat = renderer.createFloorMaterial('wooden');
assert(woodMat.roughness >= 0.75, 'Wooden floor material roughness must be >= 0.75 for satin wood');
assert.strictEqual(woodMat.metalness, 0.0);

console.log('✓ Matte floor finish verified: Roughness set to matte/satin (0.78 - 0.82) with 0.0 metalness (zero gloss/glare)!');

// ─────────────────────────────────────────────────────────────────────────────
// Part 3: Divided Room Floor Mesh Hole Cutout & Elevation (Glitch Fix)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Part 3: Divided Room Floor Mesh Glitch Fix ---');

// Build floor mesh for Living Room (with Pooja Room inside it)
const livingMesh = renderer.buildRoomFloor(livingRoom, project.plan.rooms);
assert(livingMesh, 'Living room floor mesh must be built');
assert(livingMesh.geometry.shape.holes.length === 1, 'Living room floor shape must have 1 hole for the inner Pooja Room');
assert.strictEqual(livingMesh.position.y, 1.0, 'Outer floor mesh sits at base Y = 1.0');
console.log('✓ Outer room floor hole verified: Living room has clean hole cutout matching Pooja Room geometry.');

// Build floor mesh for Pooja Room
const poojaMesh = renderer.buildRoomFloor(poojaRoom, project.plan.rooms);
assert(poojaMesh, 'Pooja room floor mesh must be built');
assert.strictEqual(poojaMesh.geometry.shape.holes.length, 0, 'Pooja room itself has no inner holes');
assert.strictEqual(poojaMesh.position.y, 1.08, 'Inner divided room floor is elevated to 1.08 to prevent coplanar z-fighting');
console.log('✓ Inner divided room elevation verified: Pooja room mesh elevated by 0.08mm + polygonOffset to eliminate floor glitches.');

console.log('\nALL 3 PARTS PASSED SUCCESSFULLY! 🚀');
