// tests/test-11-crockery-woodgrain-and-8k-render.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- RUNNING TEST: 11 ITEMS (CROCKERY DEFAULTS, WOODGRAIN, 8K RENDER, CALIBRATE CROSSHAIR & DOUBLE CLICK FOCUS) ---');

// Mock browser environment for Three.js and modules
global.window = {
  __cc: {},
  innerWidth: 1920,
  innerHeight: 1080,
  document: {
    createElement: function (tag) {
      return {
        getContext: function () {
          return {
            createLinearGradient: function () { return { addColorStop: function () {} }; },
            fillRect: function () {},
            beginPath: function () {},
            moveTo: function () {},
            lineTo: function () {},
            bezierCurveTo: function () {},
            stroke: function () {},
            fillStyle: '',
            strokeStyle: '',
            lineWidth: 1
          };
        },
        width: 0,
        height: 0
      };
    }
  }
};
global.document = global.window.document;

// Mock THREE
global.THREE = {
  Color: function (hex) { this.hex = hex; },
  CanvasTexture: function (canvas) {
    this.canvas = canvas;
    this.wrapS = 0;
    this.wrapT = 0;
    this.repeat = { set: function () {} };
  },
  RepeatWrapping: 1000,
  MeshStandardMaterial: function (opts) {
    Object.assign(this, opts);
  },
  MeshPhysicalMaterial: function (opts) {
    Object.assign(this, opts);
  },
  Group: function () {
    this.children = [];
    this.position = { set: function (x, y, z) { this.x = x; this.y = y; this.z = z; } };
    this.rotation = { y: 0 };
    this.add = function (child) { this.children.push(child); };
    this.traverse = function (fn) { fn(this); this.children.forEach(c => c.traverse ? c.traverse(fn) : fn(c)); };
  },
  Mesh: function (geo, mat) {
    this.geometry = geo;
    this.material = mat;
    this.position = { set: function (x, y, z) { this.x = x; this.y = y; this.z = z; } };
    this.userData = {};
    this.traverse = function (fn) { fn(this); };
  },
  BoxGeometry: function (w, h, d) { this.w = w; this.h = h; this.d = d; }
};

// 1. Load orbix-core.js
const Core = require('../orbix-core.js');
assert(Core, 'Core must be defined');

console.log('Testing Items 6 - 11: Crockery / TV Base and Wall units catalog defaults...');
const catalog = Core.FURNITURE_CATALOG;
assert(Array.isArray(catalog), 'FURNITURE_CATALOG must be an array');

// Item 6: CROCKERY/TV BASE 1DOOR
const ctvb1d = catalog.find(i => i.id === 'ctvb-1d');
assert(ctvb1d, 'Item 6 (ctvb-1d) must exist');
const d6 = ctvb1d.dimensions || ctvb1d.dims;
assert.strictEqual(d6.W, 450, 'ctvb-1d W must be 450');
assert.strictEqual(d6.H, 750, 'ctvb-1d H must be 750');
assert.strictEqual(d6.D, 450, 'ctvb-1d D must be 450');
assert.strictEqual(ctvb1d.unitConfig.shutters, 1, 'ctvb-1d shutters must be 1');
assert.strictEqual(ctvb1d.unitConfig.drawers, 0, 'ctvb-1d drawers must be 0');
assert.strictEqual(ctvb1d.unitConfig.legs, 100, 'ctvb-1d legs must be 100mm');
console.log('  ✓ Item 6: CROCKERY/TV BASE 1DOOR verified');

// Item 7: CROCKERY/TV BASE 1DOOR 1 DRAWER
const ctvb1d1dr = catalog.find(i => i.id === 'ctvb-1d-1dr');
assert(ctvb1d1dr, 'Item 7 (ctvb-1d-1dr) must exist');
const d7 = ctvb1d1dr.dimensions || ctvb1d1dr.dims;
assert.strictEqual(d7.W, 450, 'ctvb-1d-1dr W must be 450');
assert.strictEqual(d7.H, 750, 'ctvb-1d-1dr H must be 750');
assert.strictEqual(d7.D, 450, 'ctvb-1d-1dr D must be 450');
assert.strictEqual(ctvb1d1dr.unitConfig.shutters, 1, 'ctvb-1d-1dr shutters must be 1');
assert.strictEqual(ctvb1d1dr.unitConfig.drawers, 1, 'ctvb-1d-1dr drawers must be 1');
assert.strictEqual(ctvb1d1dr.unitConfig.legs, 100, 'ctvb-1d-1dr legs must be 100mm');
assert.strictEqual(ctvb1d1dr.unitConfig.drawersOnTop, true, 'ctvb-1d-1dr drawer must be on top');
console.log('  ✓ Item 7: CROCKERY/TV BASE 1DOOR 1 DRAWER (drawer on top) verified');

// Item 8: CROCKERY/TV BASE 1 DRAWER
const ctvb1dr = catalog.find(i => i.id === 'ctvb-1dr');
assert(ctvb1dr, 'Item 8 (ctvb-1dr) must exist');
const d8 = ctvb1dr.dimensions || ctvb1dr.dims;
assert.strictEqual(d8.W, 450, 'ctvb-1dr W must be 450');
assert.strictEqual(d8.H, 200, 'ctvb-1dr H must be 200');
assert.strictEqual(d8.D, 450, 'ctvb-1dr D must be 450');
assert.strictEqual(ctvb1dr.unitConfig.shutters, 0, 'ctvb-1dr shutters must be 0');
assert.strictEqual(ctvb1dr.unitConfig.drawers, 1, 'ctvb-1dr drawers must be 1');
assert.strictEqual(ctvb1dr.unitConfig.mountType, 'floating', 'ctvb-1dr must be floating');
assert.strictEqual(ctvb1dr.unitConfig.hasLegs, false, 'ctvb-1dr hasLegs must be false');
console.log('  ✓ Item 8: CROCKERY/TV BASE 1 DRAWER (Floating 200mm) verified');

// Item 9: CROCKERY/TV BASE 2 DOOR 2 DRAWER
const ctvb2d2dr = catalog.find(i => i.id === 'ctvb-2d-2dr');
assert(ctvb2d2dr, 'Item 9 (ctvb-2d-2dr) must exist');
const d9 = ctvb2d2dr.dimensions || ctvb2d2dr.dims;
assert.strictEqual(d9.W, 900, 'ctvb-2d-2dr W must be 900');
assert.strictEqual(d9.H, 750, 'ctvb-2d-2dr H must be 750');
assert.strictEqual(d9.D, 450, 'ctvb-2d-2dr D must be 450');
assert.strictEqual(ctvb2d2dr.unitConfig.shutters, 2, 'ctvb-2d-2dr shutters must be 2');
assert.strictEqual(ctvb2d2dr.unitConfig.drawers, 2, 'ctvb-2d-2dr drawers must be 2');
assert.strictEqual(ctvb2d2dr.unitConfig.drawersOnTop, true, 'ctvb-2d-2dr drawers must be on top');
assert.strictEqual(ctvb2d2dr.unitConfig.drawersSideBySide, true, 'ctvb-2d-2dr drawers must be side-by-side');
console.log('  ✓ Item 9: CROCKERY/TV BASE 2 DOOR 2 DRAWER (side-by-side on top) verified');

// Item 10: CROCKERY/TV BASE 2 DRAWER
const ctvb2dr = catalog.find(i => i.id === 'ctvb-2dr');
assert(ctvb2dr, 'Item 10 (ctvb-2dr) must exist');
const d10 = ctvb2dr.dimensions || ctvb2dr.dims;
assert.strictEqual(d10.W, 450, 'ctvb-2dr W must be 450');
assert.strictEqual(d10.H, 500, 'ctvb-2dr H must be 500');
assert.strictEqual(d10.D, 450, 'ctvb-2dr D must be 450');
assert.strictEqual(ctvb2dr.unitConfig.shutters, 0, 'ctvb-2dr shutters must be 0');
assert.strictEqual(ctvb2dr.unitConfig.drawers, 2, 'ctvb-2dr drawers must be 2');
console.log('  ✓ Item 10: CROCKERY/TV BASE 2 DRAWER verified');

// Item 11: CROCKERY/TV WALL OPEN BOX STORAGE 2
const ctvwobs02 = catalog.find(i => i.id === 'ctvw-obs-02');
assert(ctvwobs02, 'Item 11 (ctvw-obs-02) must exist');
const d11 = ctvwobs02.dimensions || ctvwobs02.dims;
assert.strictEqual(d11.W, 900, 'ctvw-obs-02 W must be 900');
assert.strictEqual(d11.H, 300, 'ctvw-obs-02 H must be 300');
assert.strictEqual(d11.D, 200, 'ctvw-obs-02 D must be 200');
assert.strictEqual(ctvwobs02.unitConfig.shelves, 0, 'ctvw-obs-02 shelves must be 0');
assert.strictEqual(ctvwobs02.unitConfig.sections, 0, 'ctvw-obs-02 sections must be 0');
console.log('  ✓ Item 11: CROCKERY/TV WALL OPEN BOX STORAGE 2 (W:900 H:300 D:200) verified');

// 2. Load orbix-3d.js
const ArchitecturalRenderer = require('../orbix-3d.js');
assert(ArchitecturalRenderer, 'ArchitecturalRenderer must be defined');

console.log('Testing Item 1: Wood Grain Procedural Textures & Materials...');
assert(typeof ArchitecturalRenderer.createWoodLaminateTexture === 'function', 'createWoodLaminateTexture must exist');
const woodTex = ArchitecturalRenderer.createWoodLaminateTexture(0x8B5A2B, 'teak');
assert(woodTex && woodTex.canvas, 'createWoodLaminateTexture must return canvas texture');

const woodMat = ArchitecturalRenderer.resolveLaminateMaterial({ finish: 'wood_grain', woodType: 'oak' }, 0x8B5A2B);
assert(woodMat, 'resolveLaminateMaterial must return material');
assert(woodMat.map, 'woodMat must have map');
assert(woodMat.bumpMap, 'woodMat must have bumpMap');
console.log('  ✓ Item 1: Procedural wood grain canvas and bump maps verified');

// 3. Verify orbix-plan.js Straight Calibrate & Crosshair
console.log('Testing Item 4: 2D Calibrate Tool Straight Only & Crosshair + Icon...');
const planCode = fs.readFileSync(path.join(__dirname, '../orbix-plan.js'), 'utf8');
assert(planCode.includes('handleCalibrateMouseDown'), 'handleCalibrateMouseDown must exist');
assert(planCode.includes('Math.abs(worldPt.x - p1.x) >= Math.abs(worldPt.y - p1.y)'), 'Orthogonal constraint must exist in handleCalibrateMouseDown');
assert(planCode.includes("High-precision CAD crosshair '+' icon"), "Crosshair + icon must be drawn in plan renderer");
console.log('  ✓ Item 4: Straight-only 2D calibration and precision CAD crosshair verified');

// 4. Verify app.js Double-click Focus & 8K Snapshot
console.log('Testing Item 5: 3D Double Click Unit Focus...');
const appCode = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
assert(appCode.includes('stage.addEventListener("dblclick"'), 'Double click listener must be in app.js');
assert(appCode.includes('GL.setTarget(center.x, center.y, center.z)'), 'setTarget must be called on double clicked unit');
assert(appCode.includes('cam.zoom = Math.max(cam.zoom, 1.8)'), 'Camera must zoom into focused unit');
console.log('  ✓ Item 5: 3D double click unit focus verified');

console.log('Testing Items 2 & 3: 8K Snapshot & Sky/Ground Retention...');
assert(appCode.includes('0x82C3EC'), 'scene.background sky blue must be retained in snapshot');
assert(appCode.includes('floor.visible = true'), 'Outer floor must remain visible during snapshot');
assert(appCode.includes('maxTextureSize'), 'Resolution must check maxTextureSize clamp');

const uiCode = fs.readFileSync(path.join(__dirname, '../orbix-ui.js'), 'utf8');
assert(uiCode.includes('gl.snapshot(7680, 4320'), 'capturePhotorealisticRender must attempt 8K resolution');
const htmlCode = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
assert(htmlCode.includes('id="photoRenderBtn"'), 'photoRenderBtn must exist');
assert(htmlCode.includes('📸 8K Render'), 'photoRenderBtn must display 8K Render');
console.log('  ✓ Items 2 & 3: 8K snapshot with sky/ground capture verified');

console.log('ALL 11 CHECKS PASSED PERFECTLY!');
