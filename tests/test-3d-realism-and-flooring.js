// tests/test-3d-realism-and-flooring.js
// Verification of:
// 1. View buttons (Front, 3/4, Side, Open all, Present) and floating viewport camera HUD
// 2. Room flooring in 3D Studio (White Tile, Square Tile, Grey Tile, Wooden) and bounding floor
// 3. Realistic 3D rendering (Anti-cartoon lighting, warm beige wall with micro-bump, skirting boards)

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- Testing 3D Realism, View Controls & Room Flooring ---');

// Mock browser globals for Node test environment
class MockCanvas {
  constructor(w, h) {
    this.width = w || 512;
    this.height = h || 512;
  }
  getContext(type) {
    return {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      fillRect: () => {},
      strokeRect: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      bezierCurveTo: () => {},
      stroke: () => {},
      createLinearGradient: () => ({ addColorStop: () => {} }),
      createRadialGradient: () => ({ addColorStop: () => {} })
    };
  }
}

global.document = {
  createElement: (tag) => {
    if (tag === 'canvas') return new MockCanvas(512, 512);
    return { classList: { add: () => {}, remove: () => {}, contains: () => false }, style: {}, addEventListener: () => {} };
  },
  getElementById: () => null,
  querySelectorAll: () => []
};

global.window = {
  innerWidth: 1920,
  innerHeight: 1080,
  document: global.document,
  LAMINATES: []
};

global.THREE = {
  DoubleSide: 2,
  RepeatWrapping: 1000,
  sRGBEncoding: 3001,
  ACESFilmicToneMapping: 4,
  PCFSoftShadowMap: 2,
  CanvasTexture: function (canvas) {
    this.canvas = canvas;
    this.wrapS = 0;
    this.wrapT = 0;
    this.repeat = { set: (x, y) => { this.repeatX = x; this.repeatY = y; } };
    this.encoding = 0;
  },
  MeshStandardMaterial: function (params) {
    Object.assign(this, params);
  },
  MeshPhysicalMaterial: function (params) {
    Object.assign(this, params);
  },
  MeshBasicMaterial: function (params) {
    Object.assign(this, params);
  },
  Shape: function () {
    this.curves = [];
    this.moveTo = (x, y) => this.curves.push(['moveTo', x, y]);
    this.lineTo = (x, y) => this.curves.push(['lineTo', x, y]);
    this.closePath = () => this.curves.push(['closePath']);
  },
  ShapeGeometry: function (shape) {
    this.shape = shape;
    this.attributes = {
      position: { count: 4, getX: (i) => i * 100, getY: (i) => i * 100 },
      uv: { setXY: (i, u, v) => { this.uvs = this.uvs || []; this.uvs[i] = [u, v]; }, needsUpdate: false }
    };
  },
  BoxGeometry: function (w, h, d) {
    this.parameters = { width: w, height: h, depth: d };
  },
  Group: function () {
    this.children = [];
    this.position = { x: 0, y: 0, z: 0, set: function(x, y, z) { this.x = x; this.y = y; this.z = z; } };
    this.rotation = { x: 0, y: 0, z: 0 };
    this.add = (c) => this.children.push(c);
    this.traverse = function (fn) {
      fn(this);
      this.children.forEach(c => {
        if (c.traverse) c.traverse(fn);
        else fn(c);
      });
    };
  },
  Mesh: function (geo, mat) {
    this.geometry = geo;
    this.material = mat;
    this.position = { x: 0, y: 0, z: 0, set: function(x,y,z){ this.x=x; this.y=y; this.z=z; } };
    this.rotation = { x: 0, y: 0, z: 0 };
    this.userData = {};
  },
  Vector3: function (x, y, z) {
    this.x = x || 0; this.y = y || 0; this.z = z || 0;
  }
};

// Load Orbix modules
const OrbixCore = require('../orbix-core.js');
global.OrbixCore = OrbixCore;
const PlanModule = require('../orbix-plan.js');
const Arch3D = require('../orbix-3d.js');
global.Orbix3D = Arch3D;

const Core = OrbixCore;

// Test 1: Camera Controls & View Buttons Visibility
console.log('[Test 1] View Buttons & Floating Camera HUD');
const indexHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf-8');
const styleCss = fs.readFileSync(path.join(__dirname, '../style.css'), 'utf-8');

assert(indexHtml.includes('id="frontBtn"'), 'frontBtn must exist in index.html');
assert(indexHtml.includes('id="isoBtn"'), 'isoBtn must exist in index.html');
assert(indexHtml.includes('id="sideBtn"'), 'sideBtn must exist in index.html');
assert(indexHtml.includes('id="openBtn"'), 'openBtn must exist in index.html');
assert(indexHtml.includes('id="presentBtn"'), 'presentBtn must exist in index.html');

// Floating HUD elements
assert(indexHtml.includes('id="stageCamHud"'), 'stageCamHud container must exist in index.html');
assert(indexHtml.includes('id="hudFrontBtn"'), 'hudFrontBtn must exist in index.html');
assert(indexHtml.includes('id="hudIsoBtn"'), 'hudIsoBtn must exist in index.html');
assert(indexHtml.includes('id="hudSideBtn"'), 'hudSideBtn must exist in index.html');
assert(indexHtml.includes('id="hudOpenBtn"'), 'hudOpenBtn must exist in index.html');
assert(indexHtml.includes('id="hudPresentBtn"'), 'hudPresentBtn must exist in index.html');

// CSS Flex Wrapping & layout
assert(styleCss.includes('.viewbtns{margin-left:auto;display:flex;align-items:center;gap:5px;flex-wrap:wrap;max-width:100%}'), '.viewbtns must have flex-wrap:wrap');
assert(styleCss.includes('.stage-cam-hud'), '.stage-cam-hud styles must exist in style.css');
console.log('✓ View buttons & floating camera HUD verified.');

// Test 2: 3D Room Flooring System
console.log('[Test 2] 3D Studio Room Flooring System');
const dummyScene = new THREE.Group();
const renderer = new Arch3D(dummyScene);

// Verify all 4 floor textures
const floorFinishes = ['white_tile', 'square_tile', 'grey_tile', 'wooden'];
floorFinishes.forEach(finish => {
  const tex = Arch3D.createFloorTexture(finish);
  assert(tex, `Floor texture for ${finish} must generate successfully`);
  const mat = renderer.createFloorMaterial(finish);
  assert(mat, `Floor material for ${finish} must generate successfully`);
  assert(mat.map, `Floor material for ${finish} must have a map`);
});

// Test building room floor mesh
const testRoom = {
  id: 'rm_1',
  name: 'Living Room',
  type: 'living',
  floorFinish: 'marble',
  polygon: [
    { x: 0, y: 0 },
    { x: 4000, y: 0 },
    { x: 4000, y: 3500 },
    { x: 0, y: 3500 }
  ]
};

const floorMesh = renderer.buildRoomFloor(testRoom);
assert(floorMesh, 'buildRoomFloor must return a valid floor mesh');
assert.strictEqual(floorMesh.name, 'Floor_Living Room');
assert.strictEqual(floorMesh.userData.isFloorMesh, true);
assert.strictEqual(floorMesh.userData.floorFinish, 'white_tile', 'marble must map to white_tile');
assert(Math.abs(floorMesh.rotation.x - (-Math.PI / 2)) < 0.001, 'Floor mesh must rotate flat with normal facing UP');

// Test Bounding Floor Fallback (when no rooms closed yet)
const testWalls = [
  { id: 'w1', start: { x: 0, y: 0 }, end: { x: 3000, y: 0 }, height: 2800, thickness: 150 },
  { id: 'w2', start: { x: 3000, y: 0 }, end: { x: 3000, y: 2000 }, height: 2800, thickness: 150 }
];
const boundingFloor = renderer.buildBoundingFloor(testWalls, []);
assert(boundingFloor, 'buildBoundingFloor must return floor mesh under walls');
assert(boundingFloor.userData.isFloorMesh, true);

// Test dynamic setFloorMaterial update
const homeGroup = renderer.buildHome({ walls: testWalls, rooms: [testRoom], furniture: [] });
assert(homeGroup, 'buildHome must generate 3D group');
let floorFound = false;
homeGroup.traverse(o => {
  if (o.userData && o.userData.isFloorMesh) floorFound = true;
});
assert(floorFound, 'Floor mesh must be added to homeGroup');

renderer.setFloorMaterial('wooden');
assert.strictEqual(renderer.selectedFloorType, 'wooden');
console.log('✓ 3D room flooring system & bounding fallback verified.');

// Test 3: Realistic 3D Styling (Anti-Cartoon)
console.log('[Test 3] Realistic 3D Rendering (Anti-Cartoon)');

// Check stage background vignette in style.css
assert(styleCss.includes('radial-gradient(circle at 50% 45%, #FAF9F5 0%, #EBE7DE 58%, #DCD6CA 100%)'), 'Stage must use photographic architectural studio gradient');

// Check warm architectural beige wall & bump
assert.strictEqual(renderer.materials.wall.color, 0xEDE5D8, 'Wall color must be warm architectural beige');
assert(renderer.materials.wall.bumpMap, 'Wall material must have procedural micro-bump texture');
assert.strictEqual(renderer.materials.wall.roughness, 0.90, 'Wall roughness must be 0.90');

// Check skirting boards
assert(renderer.materials.skirting, 'Skirting board material must be initialized');
let skirtingFound = false;
homeGroup.traverse(o => {
  if (o.geometry && o.geometry.parameters && o.geometry.parameters.height === 75) {
    skirtingFound = true;
  }
});
assert(skirtingFound, 'Skirting boards must be generated at wall bases');

// Check app.js lighting and tone mapping
const appJs = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf-8');
assert(appJs.includes('renderer.toneMapping = THREE.ACESFilmicToneMapping'), 'app.js must use ACESFilmicToneMapping');
assert(appJs.includes('renderer.shadowMap.type = THREE.PCFSoftShadowMap'), 'app.js must use PCFSoftShadowMap');
assert(appJs.includes('new THREE.DirectionalLight(0xfffaec'), 'app.js must use warm sunlight key light');
assert(appJs.includes('new THREE.DirectionalLight(0xdde9f8'), 'app.js must use cool skylight fill');
assert(appJs.includes('new THREE.DirectionalLight(0xf4ece0'), 'app.js must use warm floor bounce light');

console.log('✓ Realistic 3D rendering (lighting, materials, skirting) verified.');

console.log('\nALL 3D REALISM, VIEW CONTROLS & ROOM FLOORING TESTS PASSED PERFECTLY!');
