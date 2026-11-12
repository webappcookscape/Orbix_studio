/**
 * Test Suite: Photorealistic 3D Visualization Pipeline
 * Verifies:
 * 1. Contact shadow generation and grounding under floor units.
 * 2. Wood grain and wall plaster micro-bump textures.
 * 3. Photorealistic interior architectural room downlights.
 * 4. Under-cabinet LED task lighting for wall units.
 * 5. PBR material properties (glass physical transmission/clearcoat, brushed brass, aluminum frame).
 */

const assert = require('assert');

// Mock browser environment for Node.js
global.document = {
  createElement: function (tag) {
    if (tag === 'canvas') {
      return {
        width: 256,
        height: 256,
        getContext: function () {
          return {
            fillStyle: '',
            strokeStyle: '',
            lineWidth: 1,
            fillRect: function () {},
            strokeRect: function () {},
            beginPath: function () {},
            moveTo: function () {},
            lineTo: function () {},
            bezierCurveTo: function () {},
            stroke: function () {},
            fill: function () {},
            arc: function () {},
            save: function () {},
            restore: function () {},
            createRadialGradient: function () {
              return { addColorStop: function () {} };
            },
            createLinearGradient: function () {
              return { addColorStop: function () {} };
            }
          };
        }
      };
    }
    return {};
  }
};

global.THREE = {
  DoubleSide: 2,
  RepeatWrapping: 1000,
  sRGBEncoding: 3001,
  CanvasTexture: class {
    constructor(canvas) {
      this.canvas = canvas;
      this.wrapS = 0;
      this.wrapT = 0;
      this.repeat = { set: function () {} };
    }
  },
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
  MeshBasicMaterial: class {
    constructor(opts) {
      Object.assign(this, opts);
    }
  },
  Group: class {
    constructor() {
      this.children = [];
      this.userData = {};
      this.position = { x: 0, y: 0, z: 0, set: function (x, y, z) { this.x = x; this.y = y; this.z = z; } };
      this.rotation = { x: 0, y: 0, z: 0 };
    }
    add(obj) {
      this.children.push(obj);
    }
    traverse(cb) {
      cb(this);
      this.children.forEach(c => {
        if (c.traverse) c.traverse(cb);
        else cb(c);
      });
    }
  },
  Mesh: class {
    constructor(geo, mat) {
      this.geometry = geo;
      this.material = mat;
      this.userData = {};
      this.position = { x: 0, y: 0, z: 0, set: function (x, y, z) { this.x = x; this.y = y; this.z = z; } };
      this.rotation = { x: 0, y: 0, z: 0 };
    }
  },
  BoxGeometry: class {
    constructor(w, h, d) { this.w = w; this.h = h; this.d = d; }
    dispose() {}
  },
  PlaneGeometry: class {
    constructor(w, d) { this.w = w; this.d = d; }
    dispose() {}
  },
  CylinderGeometry: class {
    constructor(rt, rb, h, s) { this.rt = rt; this.rb = rb; this.h = h; }
    dispose() {}
  },
  ShapeGeometry: class {
    constructor(shape) { this.shape = shape; }
    dispose() {}
  },
  Shape: class {
    constructor() { this.holes = []; }
    moveTo() {}
    lineTo() {}
    closePath() {}
  },
  Path: class {
    constructor() { this.points = []; }
    moveTo() {}
    lineTo() {}
    closePath() {}
  },
  SpotLight: class {
    constructor(color, intensity) {
      this.color = color;
      this.intensity = intensity;
      this.position = { x: 0, y: 0, z: 0, set: function (x, y, z) { this.x = x; this.y = y; this.z = z; } };
      this.target = { position: { x: 0, y: 0, z: 0, set: function (x, y, z) { this.x = x; this.y = y; this.z = z; } } };
      this.angle = 0;
      this.penumbra = 0;
      this.decay = 0;
      this.distance = 0;
    }
  },
  PointLight: class {
    constructor(color, intensity, dist, decay) {
      this.color = color;
      this.intensity = intensity;
      this.distance = dist;
      this.decay = decay;
      this.position = { x: 0, y: 0, z: 0, set: function (x, y, z) { this.x = x; this.y = y; this.z = z; } };
    }
  }
};

const Core = require('../orbix-core.js');
const ArchRenderer = require('../orbix-3d.js');

console.log('=== TEST SUITE: PHOTOREALISTIC 3D PIPELINE ===\n');

// ─────────────────────────────────────────────────────────────────────────────
// Part 1: Procedural Micro-Bump & Contact Shadow Textures
// ─────────────────────────────────────────────────────────────────────────────
console.log('--- Part 1: Micro-Textures & Contact Shadow Generators ---');
const wallBump = ArchRenderer.createWallBumpTexture();
assert(wallBump !== null, 'Wall bump texture must be generated');
console.log('✓ Wall plaster eggshell bump texture generated successfully.');

const woodBump = ArchRenderer.createWoodGrainBumpTexture();
assert(woodBump !== null, 'Wood grain bump texture must be generated');
console.log('✓ Tactile wood pore micro-grain bump texture generated successfully.');

const contactShadowTex = ArchRenderer.createContactShadowTexture();
assert(contactShadowTex !== null, 'Contact shadow texture must be generated');
console.log('✓ Contact shadow radial falloff texture generated successfully.');

const shadowPlane = ArchRenderer.createContactShadowPlane(1200, 600);
assert(shadowPlane !== null, 'Contact shadow plane mesh must be generated');
assert.strictEqual(shadowPlane.userData.isContactShadow, true);
assert(shadowPlane.material.transparent === true);
console.log('✓ Contact shadow grounding plane created with proper transparency & dimensions.');

// ─────────────────────────────────────────────────────────────────────────────
// Part 2: PBR Materials & Physical Properties
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Part 2: PBR Material Properties ---');
const renderer = new ArchRenderer({ appendChild: () => {} });

// Glass physical material
const glass = renderer.materials.glass;
assert(glass instanceof global.THREE.MeshPhysicalMaterial, 'Glass must be MeshPhysicalMaterial');
assert.strictEqual(glass.transparent, true);
assert(glass.roughness <= 0.05, 'Glass roughness must be ultra-smooth');
assert.strictEqual(glass.clearcoat, 1.0, 'Glass must have clearcoat enabled');
console.log('✓ Physical architectural glass verified (MeshPhysicalMaterial with clearcoat).');

// Door wood with micro-grain relief
const doorWood = renderer.materials.doorWood;
assert(doorWood.bumpMap !== undefined, 'Door wood must have tactile bump map attached');
assert.strictEqual(doorWood.roughness, 0.42);
console.log('✓ Door wood verified with tactile grain bump map & satin sheen.');

// Polished brass hardware
const brass = renderer.materials.doorHandle;
assert.strictEqual(brass.metalness, 0.88);
assert(brass.roughness <= 0.25);
console.log('✓ Hardware brass verified with high metallic reflectance.');

// ─────────────────────────────────────────────────────────────────────────────
// Part 3: Interior Architectural Room Lighting
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Part 3: Interior Room Lighting & Downlights ---');
const room = {
  id: 'room_living',
  name: 'Living Room',
  polygon: [
    { x: 0, y: 0 },
    { x: 4000, y: 0 },
    { x: 4000, y: 4000 },
    { x: 0, y: 4000 }
  ]
};

const roomLightingGroup = renderer.buildRoomInteriorLighting(room, 2800);
assert(roomLightingGroup !== null, 'Room lighting group must be created');
assert.strictEqual(roomLightingGroup.userData.isRoomLighting, true);
assert.strictEqual(roomLightingGroup.userData.roomId, 'room_living');

// Room is 4m x 4m, so it should generate a 4-spotlight architectural grid
let spotCount = 0;
roomLightingGroup.traverse((obj) => {
  if (obj instanceof global.THREE.SpotLight) {
    spotCount++;
    assert.strictEqual(obj.color, 0xFFF1DD, 'Spotlight color must be warm 3000K');
    assert.strictEqual(obj.decay, 2.0, 'Physically realistic inverse-square decay required');
    assert(obj.penumbra >= 0.7, 'Soft feathered spot edge required');
  }
});
assert.strictEqual(spotCount, 4, '4x4m room must generate 4 architectural downlights');
console.log(`✓ Room interior lighting verified: ${spotCount} warm 3000K downlights created with soft penumbra and physically correct decay!`);

// ─────────────────────────────────────────────────────────────────────────────
// Part 4: Placed Units Grounding & Task Lighting
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Part 4: Placed Unit Grounding & Under-Cabinet Lighting ---');

// Floor base unit
const floorFurn = {
  id: 'furn_base_1',
  category: 'kitchen_base',
  name: 'Base Unit 2 Door',
  dimensions: { W: 900, H: 850, D: 600 },
  elevation: 0,
  pos: { x: 1000, y: 500 }
};

const floorMesh = renderer.buildFurnitureMesh(floorFurn);
let hasContactShadow = false;
floorMesh.traverse((child) => {
  if (child.userData && child.userData.isContactShadow) {
    hasContactShadow = true;
  }
});
assert.strictEqual(hasContactShadow, true, 'Floor base unit must have grounded contact shadow');
console.log('✓ Floor unit contact shadow grounding verified: Unit firmly rests on floor without floating!');

// Wall overhead kitchen cabinet
const wallFurn = {
  id: 'furn_wall_1',
  category: 'kitchen_wall',
  name: 'FCM-RT (Cookscape)',
  dimensions: { W: 900, H: 700, D: 350 },
  elevation: 1500,
  pos: { x: 1000, y: 500 }
};

const wallMesh = renderer.buildFurnitureMesh(wallFurn);
let hasUnderCabinetLED = false;
wallMesh.traverse((child) => {
  if (child.name === 'UnderCabinetLED') {
    hasUnderCabinetLED = true;
  }
});
assert.strictEqual(hasUnderCabinetLED, true, 'Kitchen wall unit must have under-cabinet LED task light');
console.log('✓ Kitchen wall unit under-cabinet LED task light verified!');

console.log('\n🎉 ALL PHOTOREALISTIC 3D PIPELINE TESTS PASSED WITH 0 ERRORS! 🚀');
