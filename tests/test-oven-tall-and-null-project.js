const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- Testing Oven Tall Unit, Null Project Guard & Material Properties ---');

// 1. Mock browser environment
global.window = { location: { search: '' }, addEventListener: function () { }, OrbixWallMode: 'single_auto' };
global.document = {
  createElement: function () {
    return {
      width: 0,
      height: 0,
      getContext: function () {
        return {
          fillStyle: '',
          fillRect: function () { },
          strokeStyle: '',
          lineWidth: 1,
          strokeRect: function () { },
          beginPath: function () { },
          moveTo: function () { },
          lineTo: function () { },
          stroke: function () { },
          arc: function () { },
          bezierCurveTo: function () { },
          fill: function () { },
          createLinearGradient: function () {
            return { addColorStop: function () { } };
          },
          createRadialGradient: function () {
            return { addColorStop: function () { } };
          },
          save: function () { },
          restore: function () { },
          getImageData: function () { return { data: new Uint8ClampedArray(256 * 256 * 4) }; },
          putImageData: function () { }
        };
      },
      style: {}
    };
  },
  getElementById: function () { return null; },
  querySelectorAll: function () { return []; }
};
global.localStorage = { getItem: function () { return null; }, setItem: function () { } };

// Mock THREE.js minimal stubs
global.THREE = {
  Group: function () { this.children = []; this.add = function (c) { this.children.push(c); }; this.position = { set: function () { } }; this.rotation = {}; this.userData = {}; this.traverse = function (fn) { fn(this); }; },
  Mesh: function (geo, mat) { this.geo = geo; this.mat = mat; this.position = { set: function () { } }; this.rotation = {}; this.userData = {}; this.traverse = function (fn) { fn(this); }; },
  BoxGeometry: function () { },
  CylinderGeometry: function () { },
  CanvasTexture: function () { this.wrapS = 1000; this.wrapT = 1000; this.repeat = { set: function () { } }; },
  MeshPhysicalMaterial: function (opts) {
    if (opts && 'specularIntensity' in opts) {
      throw new Error("specularIntensity is not a valid property of MeshPhysicalMaterial in Three.js r128!");
    }
    this.opts = opts;
  },
  MeshStandardMaterial: function (opts) { this.opts = opts; },
  Color: function () { this.setHex = function () { return this; }; this.getHexString = function () { return 'ffffff'; }; }
};

const Core = require('../orbix-core.js');

// 2. Test generateFullQuotation with null & undefined
const qNull = Core.generateFullQuotation(null);
assert(qNull, 'generateFullQuotation(null) must return a valid quotation object');
assert.strictEqual(qNull.furnitureItems.length, 0);
assert.strictEqual(qNull.grandTotal, 0);
console.log('✅ 1. generateFullQuotation(null) gracefully returns empty quotation without throwing TypeError.');

const qUndef = Core.generateFullQuotation(undefined);
assert(qUndef, 'generateFullQuotation(undefined) must return a valid quotation object');
console.log('✅ 2. generateFullQuotation(undefined) gracefully returns empty quotation.');

// 3. Test ArchitecturalRenderer with Oven Tall unit
const orbix3dSrc = fs.readFileSync(path.join(__dirname, '..', 'orbix-3d.js'), 'utf8');
assert(!orbix3dSrc.includes('matOpts.specularIntensity'), 'orbix-3d.js must not pass specularIntensity');
console.log('✅ 3. specularIntensity removed from orbix-3d.js to eliminate Three.js console warnings.');

// Require ArchitecturalRenderer
const rendererModule = require('../orbix-3d.js');
const renderer = new rendererModule();

const ovenTallFurn = Core.createFurniturePlacement({
  id: 'tbm_oven_test',
  name: 'TBM 60 Oven Tall Cabinet',
  category: 'kitchen_tall',
  modelType: 'kitchen_tall',
  dimensions: { W: 600, H: 2100, D: 600 }
});

const ovenMesh = renderer.buildFurnitureMesh(ovenTallFurn);
assert(ovenMesh, 'buildFurnitureMesh must return group for Oven Tall Unit');
console.log('✅ 4. Oven Tall Cabinet renders without ReferenceError (cat is defined)!');

console.log('\n🎉 ALL FIXES VERIFIED SUCCESSFULLY! 🎉');
