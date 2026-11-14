const assert = require('assert');
const fs = require('fs');

// Mock browser environment for Three.js
global.window = {
  LAMINATES: [
    { code: 'MDF 7707', name: 'Navy Blue Matte', kind: 'matte' },
    { code: 'MDF 6601', name: 'Almond Beige Gloss', kind: 'gloss' },
    { code: '3410', name: 'American Walnut', kind: 'wood' }
  ],
  orbixRenderMode: 'realistic'
};

global.document = {
  createElement: function () {
    return {
      width: 0,
      height: 0,
      getContext: function () {
        return {
          fillStyle: '',
          fillRect: function () {},
          strokeStyle: '',
          lineWidth: 1,
          strokeRect: function () {},
          beginPath: function () {},
          moveTo: function () {},
          lineTo: function () {},
          stroke: function () {},
          arc: function () {},
          fill: function () {},
          createLinearGradient: function () {
            return { addColorStop: function () {} };
          },
          createRadialGradient: function () {
            return { addColorStop: function () {} };
          },
          save: function () {},
          restore: function () {}
        };
      }
    };
  }
};

global.THREE = {
  sRGBEncoding: 3001,
  RepeatWrapping: 1000,
  Color: function (hex) {
    this.hex = hex;
    this.setHex = function (h) { this.hex = h; };
  },
  Vector3: function (x, y, z) {
    this.x = x || 0; this.y = y || 0; this.z = z || 0;
    this.set = function (nx, ny, nz) { this.x = nx; this.y = ny; this.z = nz; };
    this.copy = function (v) { this.x = v.x; this.y = v.y; this.z = v.z; };
  },
  MeshStandardMaterial: function (opts) {
    Object.assign(this, opts);
    this.isMeshStandardMaterial = true;
  },
  MeshPhysicalMaterial: function (opts) {
    Object.assign(this, opts);
    this.isMeshPhysicalMaterial = true;
  },
  CanvasTexture: function () {
    this.repeat = { set: function () {} };
  },
  BoxGeometry: function (w, h, d) { this.w = w; this.h = h; this.d = d; },
  CylinderGeometry: function () {},
  Mesh: function (geo, mat) {
    this.isMesh = true;
    this.geometry = geo;
    this.material = mat;
    this.position = new global.THREE.Vector3();
    this.rotation = { x: 0, y: 0, z: 0 };
    this.userData = {};
  },
  Group: function () {
    this.children = [];
    this.add = function (c) { this.children.push(c); };
    this.traverse = function (fn) {
      fn(this);
      this.children.forEach(function (c) {
        if (c.traverse) c.traverse(fn);
        else fn(c);
      });
    };
  }
};

const ArchitecturalRenderer = require('../orbix-3d.js');

console.log('--- Testing Photorealistic Presentation Engine ---');

// 1. PBR Material Intelligence: Gloss Acrylic Clearcoat
const glossMat = ArchitecturalRenderer.resolveLaminateMaterial('MDF 6601', 0xF4F3EF, true);
assert(glossMat.isMeshPhysicalMaterial, 'Gloss material must be MeshPhysicalMaterial');
assert.strictEqual(glossMat.clearcoat, 1.0, 'Gloss clearcoat must be 1.0');
assert.strictEqual(glossMat.clearcoatRoughness, 0.04, 'Gloss clearcoatRoughness must be 0.04');
assert.strictEqual(glossMat.roughness, 0.05, 'Gloss base roughness must be 0.05');
console.log('✅ 1. Gloss Acrylic correctly produces PBR clearcoat reflection');

// 2. PBR Material Intelligence: Natural Wood Grain
const woodMat = ArchitecturalRenderer.resolveLaminateMaterial('3410 American Walnut', 0x4A3525);
assert(woodMat.isMeshPhysicalMaterial, 'Wood material must be MeshPhysicalMaterial');
assert(woodMat.bumpMap, 'Wood material must have bumpMap assigned');
assert.strictEqual(woodMat.bumpScale, 0.035, 'Wood bumpScale must be 0.035');
console.log('✅ 2. Natural Woodgrain correctly maps PBR timber pores & bump map');

// 3. PBR Material Intelligence: Velvety Architectural Matte
const matteMat = ArchitecturalRenderer.resolveLaminateMaterial('MDF 7707', 0x2E3F5C, false);
assert(matteMat.isMeshPhysicalMaterial, 'Matte material must be MeshPhysicalMaterial');
assert.strictEqual(matteMat.clearcoat, 0.0, 'Matte clearcoat must be 0.0');
assert.strictEqual(matteMat.roughness, 0.82, 'Matte roughness must be 0.82');
assert.strictEqual(matteMat.specularIntensity, 0.22, 'Matte specularIntensity must be 0.22');
console.log('✅ 3. Matte Laminate correctly produces non-reflective architectural finish');

// 4. Hardware Finishes (Handles)
const chromeH = ArchitecturalRenderer.getHandleMaterial('chrome');
assert(chromeH.isMeshPhysicalMaterial, 'Chrome handle must be MeshPhysicalMaterial');
assert.strictEqual(chromeH.metalness, 0.96);
assert.strictEqual(chromeH.clearcoat, 1.0);

const brassH = ArchitecturalRenderer.getHandleMaterial('brass');
assert(brassH.isMeshPhysicalMaterial, 'Brass handle must be MeshPhysicalMaterial');
assert.strictEqual(brassH.metalness, 0.92);
assert.strictEqual(brassH.clearcoat, 0.65);

const blackH = ArchitecturalRenderer.getHandleMaterial('black');
assert(blackH.isMeshPhysicalMaterial, 'Matte black handle must be MeshPhysicalMaterial');
assert.strictEqual(blackH.roughness, 0.65);
console.log('✅ 4. Hardware handles feature physical metallic clearcoat finishes');

// 5. Fast Design Mode fallback
window.orbixRenderMode = 'design';
const designMat = ArchitecturalRenderer.resolveLaminateMaterial('MDF 7707', 0x2E3F5C);
assert(designMat.isMeshStandardMaterial, 'Design mode must produce lightweight MeshStandardMaterial');
window.orbixRenderMode = 'realistic';
console.log('✅ 5. Fast Design Mode provides high-FPS drafting performance');

// 6. Before / After Material Comparison Engine
const testGroup = new global.THREE.Group();
const testShutter = new global.THREE.Mesh(new global.THREE.BoxGeometry(600, 720, 18), matteMat);
testShutter.userData.isShutter = true;
testGroup.add(testShutter);

const testCarcass = new global.THREE.Mesh(new global.THREE.BoxGeometry(600, 720, 560), glossMat);
testCarcass.userData.isFurniturePart = true;
testGroup.add(testCarcass);

// Switch to Option B (Luxury comparison)
ArchitecturalRenderer.applyMaterialComparison(testGroup, 'B');
assert.notStrictEqual(testShutter.material, matteMat, 'Option B must swap shutter material');
assert.strictEqual(testShutter.userData._origMaterial, matteMat, 'Option B must preserve original material');

// Switch back to Option A (Original)
ArchitecturalRenderer.applyMaterialComparison(testGroup, 'A');
assert.strictEqual(testShutter.material, matteMat, 'Option A must restore original shutter material');
console.log('✅ 6. Before/After material comparison swaps finishes non-destructively');

// 7. HTML and UI Integration Check
const indexHtml = fs.readFileSync('index.html', 'utf8');
assert(indexHtml.includes('id="modeDesignBtn"'), 'HTML must include modeDesignBtn');
assert(indexHtml.includes('id="modeRealisticBtn"'), 'HTML must include modeRealisticBtn');
assert(indexHtml.includes('id="modeUltraBtn"'), 'HTML must include modeUltraBtn');
assert(indexHtml.includes('id="todDayBtn"'), 'HTML must include todDayBtn');
assert(indexHtml.includes('id="todEveBtn"'), 'HTML must include todEveBtn');
assert(indexHtml.includes('id="todNightBtn"'), 'HTML must include todNightBtn');
assert(indexHtml.includes('id="clientPresentationHud"'), 'HTML must include clientPresentationHud');
assert(indexHtml.includes('id="cpOptABtn"'), 'HTML must include Option A compare button');
assert(indexHtml.includes('id="cpOptBBtn"'), 'HTML must include Option B compare button');
assert(indexHtml.includes('id="cpExport4KBtn"'), 'HTML must include 4K Export button');
console.log('✅ 7. HTML interface elements for Presentation HUD, Modes & Time-of-Day verified');

// 8. Desktop App Configuration Check
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
assert(pkg.scripts['start:desktop'], 'package.json must contain start:desktop script');
assert(pkg.scripts['dist:win'], 'package.json must contain dist:win script');
assert(fs.existsSync('electron-main.js'), 'electron-main.js must exist');
console.log('✅ 8. Electron Windows Desktop architecture & build scripts verified');

console.log('\n🎉 ALL PHOTOREALISTIC ENGINE TESTS PASSED WITH 100% SUCCESS! 🎉\n');
