/**
 * test-user-floor-tiles.js
 * Verification of the two user floor tiles from Downloads:
 * - textures/tile-floor-1.jpeg (Crema Marfil warm alabaster marble)
 * - textures/tile-floor-2.jpeg (Mocha Breccia rich onyx marble)
 * - Base64 embedding in orbix-floor-textures.js
 * - 3D material & texture creation in orbix-3d.js
 * - 3D floor switcher & room inspector integration in index.html & orbix-ui.js
 * - Single-file bundle integration in build.py (dist-single.html & cupboard-cad.html)
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- Starting Floor Tile Verification Test Suite ---\n');

// 1. Verify Image Files
console.log('1. Checking floor tile image files...');
const img1 = path.join(__dirname, '..', 'textures', 'tile-floor-1.jpeg');
const img2 = path.join(__dirname, '..', 'textures', 'tile-floor-2.jpeg');
assert(fs.existsSync(img1), 'tile-floor-1.jpeg must exist');
assert(fs.existsSync(img2), 'tile-floor-2.jpeg must exist');
assert(fs.statSync(img1).size > 100000, 'tile-floor-1.jpeg size must be > 100KB');
assert(fs.statSync(img2).size > 100000, 'tile-floor-2.jpeg size must be > 100KB');
console.log('   ✓ Both tile images exist with high resolution (' + fs.statSync(img1).size + ' bytes, ' + fs.statSync(img2).size + ' bytes)');

// 2. Verify Base64 Module
console.log('\n2. Checking orbix-floor-textures.js...');
const floorTexModule = require('../orbix-floor-textures.js');
assert(floorTexModule.tile_1, 'tile_1 must be defined in orbix-floor-textures.js');
assert(floorTexModule.tile_2, 'tile_2 must be defined in orbix-floor-textures.js');
assert(floorTexModule.tile_1.startsWith('data:image/jpeg;base64,'), 'tile_1 must be a jpeg data URI');
assert(floorTexModule.tile_2.startsWith('data:image/jpeg;base64,'), 'tile_2 must be a jpeg data URI');
console.log('   ✓ orbix-floor-textures.js exports valid data URIs for tile_1 and tile_2');

// 3. Verify HTML & UI Selectors
console.log('\n3. Checking index.html and orbix-ui.js...');
const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const uiJs = fs.readFileSync(path.join(__dirname, '..', 'orbix-ui.js'), 'utf8');

assert(indexHtml.includes('data-floor="tile_1"'), 'index.html must have button with data-floor="tile_1"');
assert(indexHtml.includes('data-floor="tile_2"'), 'index.html must have button with data-floor="tile_2"');
assert(indexHtml.includes('<script src="orbix-floor-textures.js"></script>'), 'index.html must load orbix-floor-textures.js');

assert(uiJs.includes('value="tile_1"'), 'orbix-ui.js must have option value="tile_1"');
assert(uiJs.includes('value="tile_2"'), 'orbix-ui.js must have option value="tile_2"');
assert(uiJs.includes("fType === 'tile_1'"), 'orbix-ui.js must handle fType === tile_1');
assert(uiJs.includes("fType === 'tile_2'"), 'orbix-ui.js must handle fType === tile_2');
console.log('   ✓ index.html has 3D floor switcher buttons and script tag');
console.log('   ✓ orbix-ui.js has room inspector dropdown options and event handler');

// 4. Verify 3D Architectural Renderer Materials & Textures
console.log('\n4. Checking orbix-3d.js texture & material creation...');
const orbix3dSrc = fs.readFileSync(path.join(__dirname, '..', 'orbix-3d.js'), 'utf8');

// Mock browser / Three.js environment
global.window = {
  ORBIX_FLOOR_TEXTURES: floorTexModule
};
global.document = {
  createElement: function (tag) {
    return {
      width: 512,
      height: 512,
      getContext: function () {
        return {
          fillStyle: '',
          fillRect: function () {},
          createLinearGradient: function () {
            return { addColorStop: function () {} };
          },
          strokeStyle: '',
          lineWidth: 1,
          beginPath: function () {},
          moveTo: function () {},
          lineTo: function () {},
          bezierCurveTo: function () {},
          stroke: function () {},
          strokeRect: function () {}
        };
      }
    };
  }
};

global.THREE = {
  RepeatWrapping: 1000,
  sRGBEncoding: 3001,
  DoubleSide: 2,
  FrontSide: 0,
  CanvasTexture: function (canvas) {
    this.canvas = canvas;
    this.wrapS = 0;
    this.wrapT = 0;
    this.repeat = { set: function () {} };
    this.encoding = 0;
  },
  Texture: function (img) {
    this.img = img;
    this.wrapS = 0;
    this.wrapT = 0;
    this.repeat = { set: function () {} };
    this.encoding = 0;
  },
  MeshStandardMaterial: function (params) {
    this.map = params.map;
    this.roughness = params.roughness;
    this.metalness = params.metalness;
    this.polygonOffset = params.polygonOffset;
    this.side = params.side;
  },
  MeshPhysicalMaterial: function (params) {
    this.map = params ? params.map : null;
    this.roughness = params ? params.roughness : 0.5;
    this.metalness = params ? params.metalness : 0.5;
  },
  Group: function () {
    this.children = [];
    this.add = function (c) { this.children.push(c); };
    this.traverse = function (fn) { this.children.forEach(fn); };
  }
};

// Evaluate mock ArchitecturalRenderer
const dummyCore = {
  Vec2: { pointInPolygon: function () { return false; }, polygonCentroid: function () { return {x:0, y:0}; } }
};
const sandbox = {
  window: global.window,
  document: global.document,
  THREE: global.THREE,
  OrbixCore: dummyCore,
  Core: dummyCore
};
global.window.OrbixCore = dummyCore;
const vm = require('vm');
vm.createContext(sandbox);

// Load orbix-3d.js into vm context
vm.runInContext(orbix3dSrc, sandbox);
const ArchRenderer = sandbox.window.Orbix3D || sandbox.Orbix3D;
assert(ArchRenderer, 'Orbix3D must be defined');

// Test colors
const c1 = ArchRenderer.getFloorTileColor('tile_1');
const c2 = ArchRenderer.getFloorTileColor('tile_2');
assert.strictEqual(c1, 0xE8DFD5, 'tile_1 skirting color must match warm Crema Marfil (0xE8DFD5)');
assert.strictEqual(c2, 0xBFAEA0, 'tile_2 skirting color must match warm Mocha Breccia (0xBFAEA0)');
console.log('   ✓ Skirting base colors match: tile_1=0x' + c1.toString(16) + ', tile_2=0x' + c2.toString(16));

// Test procedural textures fallback
const tex1 = ArchRenderer.createFloorTexture('tile_1');
const tex2 = ArchRenderer.createFloorTexture('tile_2');
assert(tex1, 'tile_1 texture must be generated');
assert(tex2, 'tile_2 texture must be generated');
console.log('   ✓ Floor textures generated successfully');

// Test materials
const rendererInstance = new ArchRenderer({});
const mat1 = rendererInstance.createFloorMaterial('tile_1');
const mat2 = rendererInstance.createFloorMaterial('tile_2');
assert(mat1, 'tile_1 material must be created');
assert(mat2, 'tile_2 material must be created');
assert.strictEqual(mat1.roughness, 0.76, 'tile_1 roughness must be 0.76 (luxury satin matte)');
assert.strictEqual(mat1.metalness, 0.0, 'tile_1 metalness must be 0.0');
assert.strictEqual(mat2.roughness, 0.76, 'tile_2 roughness must be 0.76 (luxury satin matte)');
assert.strictEqual(mat2.metalness, 0.0, 'tile_2 metalness must be 0.0');
console.log('   ✓ PBR materials created with authentic satin matte finish (roughness=0.76, metalness=0.0)');

// 5. Verify Single-File Bundles
console.log('\n5. Checking single-file bundles (dist-single.html & cupboard-cad.html)...');
const distSingle = fs.readFileSync(path.join(__dirname, '..', 'dist-single.html'), 'utf8');
const cupboardCad = fs.readFileSync(path.join(__dirname, '..', 'cupboard-cad.html'), 'utf8');

assert(distSingle.includes('window.ORBIX_FLOOR_TEXTURES'), 'dist-single.html must include window.ORBIX_FLOOR_TEXTURES');
assert(cupboardCad.includes('window.ORBIX_FLOOR_TEXTURES'), 'cupboard-cad.html must include window.ORBIX_FLOOR_TEXTURES');
assert(distSingle.includes('data-floor="tile_1"'), 'dist-single.html must include tile_1 button');
assert(cupboardCad.includes('data-floor="tile_1"'), 'cupboard-cad.html must include tile_1 button');
assert(distSingle.includes('data-floor="tile_2"'), 'dist-single.html must include tile_2 button');
assert(cupboardCad.includes('data-floor="tile_2"'), 'cupboard-cad.html must include tile_2 button');
console.log('   ✓ Single-file bundles contain embedded floor textures and UI buttons');

console.log('\n======================================================');
console.log('ALL FLOOR TILE TESTS PASSED SUCCESSFULLY! (100% OK)');
console.log('======================================================\n');
