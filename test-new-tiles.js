// Test suite for new dado and floor tile texture integrations
const fs = require('fs');

// Mock browser environment for Node.js
global.window = global;
global.document = {
  createElement: () => ({
    width: 512, height: 512,
    getContext: () => new Proxy({}, { get: () => () => ({ addColorStop: () => {} }) })
  }),
  getElementById: () => null
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
    this.position = { set: () => {} };
    this.rotation = { y: 0 };
    this.traverse = function (fn) { fn(this); };
  },
  BoxGeometry: function (w, h, d) { this.parameters = { width: w, height: h, depth: d }; },
  MeshStandardMaterial: function (opts) { Object.assign(this, opts); },
  MeshPhysicalMaterial: function (opts) { Object.assign(this, opts); },
  CanvasTexture: function () { this.repeat = { set: () => {} }; },
  Texture: function (img) { this.image = img; this.repeat = { set: () => {} }; },
  Mesh: function (geo, mat) {
    this.geometry = geo;
    this.material = mat;
    this.position = { set: () => {} };
    this.rotation = { x: 0, y: 0, z: 0 };
    this.userData = {};
  },
  RepeatWrapping: 1000
};

// 1. Load textures
require('./orbix-dado-textures.js');
require('./orbix-floor-textures.js');
const ArchitecturalRenderer = require('./orbix-3d.js');

console.log('--- TEST: Dado Tile Textures ---');
if (!window.ORBIX_DADO_TEXTURES) throw new Error('ORBIX_DADO_TEXTURES missing');
for (let i = 1; i <= 5; i++) {
  const k = `dado_${i}`;
  if (!window.ORBIX_DADO_TEXTURES[k] || !window.ORBIX_DADO_TEXTURES[k].startsWith('data:image/jpeg;base64,')) {
    throw new Error(`Missing or invalid dado tile: ${k}`);
  }
  console.log(`✓ Dado tile ${k} loaded (${window.ORBIX_DADO_TEXTURES[k].length} bytes)`);
}

const arch = new ArchitecturalRenderer();
for (let i = 1; i <= 5; i++) {
  const mat = arch.createDadoTileMaterial(`dado_${i}`);
  if (!mat || !mat.map) throw new Error(`Failed to create material for dado_${i}`);
  console.log(`✓ Architectural material created for dado_${i}`);
}

console.log('\n--- TEST: Floor Tile Textures ---');
if (!window.ORBIX_FLOOR_TEXTURES) throw new Error('ORBIX_FLOOR_TEXTURES missing');
for (let i = 1; i <= 3; i++) {
  const k = `tile_${i}`;
  if (!window.ORBIX_FLOOR_TEXTURES[k] || !window.ORBIX_FLOOR_TEXTURES[k].startsWith('data:image/jpeg;base64,')) {
    throw new Error(`Missing or invalid floor tile: ${k}`);
  }
  console.log(`✓ Floor tile ${k} loaded (${window.ORBIX_FLOOR_TEXTURES[k].length} bytes)`);
}

for (let i = 1; i <= 3; i++) {
  const mat = arch.createFloorMaterial(`tile_${i}`);
  if (!mat || !mat.map) throw new Error(`Failed to create floor material for tile_${i}`);
  const color = ArchitecturalRenderer.getFloorTileColor(`tile_${i}`);
  console.log(`✓ Architectural floor material created for tile_${i}, baseColor = 0x${color.toString(16).toUpperCase()}`);
}

console.log('\n✓ ALL TILE TESTS PASSED WITH 100% SUCCESS!');
