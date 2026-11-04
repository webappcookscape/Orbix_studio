/**
 * Test Suite: 3D Unit Carcass, Shutter Materials, and Handle Configurations
 */

const assert = require('assert');

// Minimal THREE mock to run orbix-3d in Node.js
global.THREE = {
  Group: function () {
    this.children = [];
    this.position = { x: 0, y: 0, z: 0, set: function (x, y, z) { this.x = x; this.y = y; this.z = z; } };
    this.rotation = { x: 0, y: 0, z: 0 };
    this.add = function (child) { this.children.push(child); };
    this.traverse = function (fn) {
      fn(this);
      this.children.forEach(c => { if (c.traverse) c.traverse(fn); else fn(c); });
    };
  },
  Mesh: function (geo, mat) {
    this.geometry = geo;
    this.material = mat;
    this.position = { x: 0, y: 0, z: 0, set: function (x, y, z) { this.x = x; this.y = y; this.z = z; } };
    this.rotation = { x: 0, y: 0, z: 0 };
    this.isMesh = true;
  },
  BoxGeometry: function (w, h, d) { this.parameters = { width: w, height: h, depth: d }; },
  CylinderGeometry: function (rt, rb, h, s) { this.parameters = { radiusTop: rt, radiusBottom: rb, height: h, radialSegments: s }; },
  MeshStandardMaterial: function (params) {
    Object.assign(this, params);
  },
  MeshPhysicalMaterial: function (params) {
    Object.assign(this, params);
  },
  Color: function (hex) {
    this.hex = hex;
    this.getHex = function () { return this.hex; };
    this.setHex = function (h) { this.hex = h; };
  },
  Vector2: function (x, y) { this.x = x; this.y = y; },
  Vector3: function (x, y, z) { this.x = x; this.y = y; this.z = z; },
  Shape: function () { this.moveTo = function () {}; this.lineTo = function () {}; }
};

global.window = {
  OrbixCore: require('../orbix-core.js'),
  LAMINATES: [
    { code: 'MDF 1135', name: 'White', hex: '#EDEBE4' },
    { code: 'MDF 3410', name: 'Walnut', hex: '#6E4E35' },
    { code: 'MDF 2204', name: 'Sonoma Oak', hex: '#C4A173' },
    { code: 'MDF 7701', name: 'Sage Green matte', hex: '#8E9C86' },
    { code: 'MDF 3411', name: 'Dark Wenge', hex: '#4A3A2E' }
  ]
};

// Load orbix-3d
const ArchitecturalRenderer = require('../orbix-3d.js');
global.window.Orbix3D = ArchitecturalRenderer;

console.log('════════════════════════════════════════════════════════════════');
console.log('🧪 TESTING 3D UNIT CARCASS, SHUTTERS & HANDLES');
console.log('════════════════════════════════════════════════════════════════\n');

// 1. Finish & Color Resolution Tests
console.log('Test 1: Finish & Color Resolution (Hex, Laminate Code, Finish Names)');
assert.strictEqual(ArchitecturalRenderer.resolveFinishColor('#EDEBE4'), 0xEDEBE4);
assert.strictEqual(ArchitecturalRenderer.resolveFinishColor('MDF 3410'), 0x6E4E35);
assert.strictEqual(ArchitecturalRenderer.resolveFinishColor('MDF 2204'), 0xC4A173);
assert.strictEqual(ArchitecturalRenderer.resolveFinishColor('Brazilian Horizontal Walnut'), 0x6E4E35);
assert.strictEqual(ArchitecturalRenderer.resolveFinishColor('Sonoma Oak'), 0xC4A173);
assert.strictEqual(ArchitecturalRenderer.resolveFinishColor('Sage Green Matte'), 0x8E9C86);
assert.strictEqual(ArchitecturalRenderer.resolveFinishColor('Dark Wenge'), 0x4A3A2E);
assert.strictEqual(ArchitecturalRenderer.resolveFinishColor('Absolute White'), 0xEDEBE4);
console.log('  ✓ Color and laminate codes correctly resolved\n');

// 2. Handle Material Resolution Tests
console.log('Test 2: Handle Materials & Finishes (Chrome, Nickel, Brass, Black, Rose Gold)');
const matBlack = ArchitecturalRenderer.getHandleMaterial('black');
assert.strictEqual(matBlack.color, 0x1A1A1A);
assert.strictEqual(matBlack.roughness, 0.4);

const matChrome = ArchitecturalRenderer.getHandleMaterial('chrome');
assert.strictEqual(matChrome.color, 0xE2E8F0);
assert.strictEqual(matChrome.metalness, 0.95);

const matBrass = ArchitecturalRenderer.getHandleMaterial('brass');
assert.strictEqual(matBrass.color, 0xD4AF37);
assert.strictEqual(matBrass.metalness, 0.9);

const matNickel = ArchitecturalRenderer.getHandleMaterial('nickel');
assert.strictEqual(matNickel.color, 0xCBD5E1);
console.log('  ✓ Handle materials and metalness/roughness correctly configured\n');

// 3. Handle Geometry & Style Tests
console.log('Test 3: Handle Style Generation (None, Knob, T-bar, Edge, Gola, Bar)');
assert.strictEqual(ArchitecturalRenderer.createHandleMesh('none', matBlack, true, 160), null, 'None produces null handle');

const hKnob = ArchitecturalRenderer.createHandleMesh('knob', matBrass, true, 160);
assert(hKnob && hKnob.children.length > 0, 'Knob produces 3D knob geometry');

const hTbar = ArchitecturalRenderer.createHandleMesh('tbar', matChrome, true, 160);
assert(hTbar && hTbar.children.length > 0, 'T-bar produces cylindrical T-bar geometry');

const hEdge = ArchitecturalRenderer.createHandleMesh('edge', matBlack, true, 160);
assert(hEdge && hEdge.children.length > 0, 'Edge produces lip edge pull geometry');

const hGprof = ArchitecturalRenderer.createHandleMesh('gprof', matBlack, true, 160);
assert(hGprof && hGprof.children.length > 0, 'G-profile produces recessed profile geometry');

const hBar = ArchitecturalRenderer.createHandleMesh('bar', matNickel, true, 160);
assert(hBar && hBar.children.length >= 3, 'Bar produces main bar with standoff feet');
console.log('  ✓ All handle geometries correctly created\n');

// 4. Unit 3D Mesh Generation & Full Customization
console.log('Test 4: Unit 3D Mesh Generation with Custom Carcass, Shutters, and Handles');
const renderer = new ArchitecturalRenderer({ add: function () {} });

// Create a unit with Walnut Carcass, Sage Green Shutters, and Brass T-Bar handles
const unit = {
  id: 'unit_custom_1',
  name: 'Custom 2-Door Wardrobe',
  category: 'wardrobe',
  dimensions: { W: 900, H: 2100, D: 600 },
  pos: { x: 1000, y: 1000, z: 0 },
  unitConfig: {
    shutters: 2,
    drawers: 1,
    carcass: 'MDF 3410', // Walnut
    shutterCol: 'MDF 7701', // Sage Green
    handle: 'tbar',
    hfinish: 'brass'
  }
};

const meshGroup = renderer.buildFurnitureMesh(unit);
assert(meshGroup, 'Mesh group created');

// Check carcass panel color
let foundCarcass = false;
let foundShutter = false;
let foundHandle = false;

meshGroup.traverse(obj => {
  if (obj.isMesh && obj.material) {
    if (obj.material.color === 0x6E4E35) foundCarcass = true; // Walnut color
    if (obj.material.color === 0x8E9C86) foundShutter = true; // Sage Green color
    if (obj.material.color === 0xD4AF37) foundHandle = true;  // Brass color
  }
});

assert(foundCarcass, 'Carcass panels must use Walnut color (0x6E4E35)');
assert(foundShutter, 'Shutter facias must use Sage Green color (0x8E9C86)');
assert(foundHandle, 'Handles must use Brass material (0xD4AF37)');
console.log('  ✓ 3D Mesh accurately adopted Walnut Carcass, Sage Green Shutters, and Brass T-bar handles\n');

// Test 5: Switch unit to White Carcass, Sonoma Oak Shutters, and Handleless (none)
console.log('Test 5: Dynamic Material Switching to White Carcass, Oak Shutters, and Handleless');
unit.unitConfig.carcass = 'MDF 1135'; // White
unit.unitConfig.shutterCol = 'MDF 2204'; // Sonoma Oak
unit.unitConfig.handle = 'none';

const meshGroup2 = renderer.buildFurnitureMesh(unit);
let foundWhiteCarcass = false;
let foundOakShutter = false;
let foundAnyHandle = false;

meshGroup2.traverse(obj => {
  if (obj.isMesh && obj.material) {
    if (obj.material.color === 0xEDEBE4) foundWhiteCarcass = true; // White
    if (obj.material.color === 0xC4A173) foundOakShutter = true;   // Sonoma Oak
    if (obj.material.color === 0xD4AF37 || obj.material.color === 0x1A1A1A) foundAnyHandle = true;
  }
});

assert(foundWhiteCarcass, 'Carcass panels must update to White (0xEDEBE4)');
assert(foundOakShutter, 'Shutters must update to Sonoma Oak (0xC4A173)');
assert(!foundAnyHandle, 'Handleless unit must not contain handle meshes');
console.log('  ✓ 3D Mesh dynamically re-rendered with White Carcass, Sonoma Oak Shutters, and No Handles\n');

console.log('════════════════════════════════════════════════════════════════');
console.log('🎉 ALL 3D CARCASS, SHUTTERS & HANDLES TESTS PASSED SUCCESSFULLY!');
console.log('════════════════════════════════════════════════════════════════\n');
