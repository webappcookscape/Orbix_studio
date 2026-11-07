const assert = require('assert');
const fs = require('fs');

console.log('=== TEST SUITE: TV & Crockery Units Unwanted Wall Removal ===\n');

function mockEl(id) {
  return {
    id: id || '',
    classList: { 
      toggle: function() {}, 
      add: function() {}, 
      remove: function() {}, 
      contains: function() { return false; } 
    },
    addEventListener: function() {},
    appendChild: function() {},
    removeChild: function() {},
    setAttribute: function() {},
    getAttribute: function() { return null; },
    querySelectorAll: function() { return []; },
    querySelector: function() { return null; },
    getBoundingClientRect: function() { return { left: 0, top: 0, width: 800, height: 600 }; },
    getContext: function() {
      return {
        createPattern: function() {},
        fillRect: function() {},
        strokeRect: function() {},
        clearRect: function() {},
        createImageData: function(w, h) { return { data: new Uint8Array((w || 64) * (h || 64) * 4) }; },
        putImageData: function() {},
        createLinearGradient: function() { return { addColorStop: function() {} }; },
        createRadialGradient: function() { return { addColorStop: function() {} }; },
        beginPath: function() {},
        closePath: function() {},
        fill: function() {},
        stroke: function() {},
        arc: function() {},
        save: function() {},
        restore: function() {},
        translate: function() {},
        rotate: function() {},
        scale: function() {},
        moveTo: function() {},
        lineTo: function() {},
        bezierCurveTo: function() {},
        measureText: function() { return { width: 50 }; },
        drawImage: function() {}
      };
    },
    toDataURL: function() { return ''; },
    innerHTML: '',
    textContent: '',
    value: '',
    options: [],
    style: {},
    dataset: {}
  };
}

const localStorageStore = {};
global.localStorage = {
  getItem: function(key) { return localStorageStore[key] || null; },
  setItem: function(key, val) { localStorageStore[key] = String(val); },
  removeItem: function(key) { delete localStorageStore[key]; },
  clear: function() { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]); }
};

global.window = global;
global.window.addEventListener = function() {};
global.location = { pathname: '/3d-studio', search: '', hash: '' };
global.document = {
  readyState: 'loading',
  head: mockEl('head'),
  body: mockEl('body'),
  getElementById: function(id) { return mockEl(id); },
  querySelector: function(sel) { return mockEl(sel); },
  querySelectorAll: function() { return []; },
  createElement: function(tag) { return mockEl(tag); },
  addEventListener: function() {}
};

global.PlanEditor = function() {
  return {
    render: function() {},
    on: function() {},
    setProject: function() {},
    getProject: function() { return global.window.OrbixUI ? global.window.OrbixUI.project : null; },
    selectFurniture: function() {}
  };
};

global.THREE = {
  Group: function() { this.children = []; this.add = function(c) { this.children.push(c); }; this.position = { set: function(x,y,z) { this.x=x; this.y=y; this.z=z; }, x:0, y:0, z:0 }; },
  Mesh: function() { this.position = { set: function(x,y,z) { this.x=x; this.y=y; this.z=z; }, x:0, y:0, z:0 }; this.rotation = { x:0, y:0, z:0 }; },
  BoxGeometry: function() {},
  CylinderGeometry: function() {},
  SphereGeometry: function() {},
  MeshStandardMaterial: function() {},
  Color: function(c) { this.set = function() {}; }
};

const Core = require('../orbix-core.js');
global.Core = Core;
global.OrbixCore = Core;

// Load orbix-projects
eval(fs.readFileSync('orbix-projects.js', 'utf8'));
global.OrbixProjects = global.window.OrbixProjects;

// Load orbix-ui
eval(fs.readFileSync('orbix-ui.js', 'utf8'));
global.OrbixUI = global.window.OrbixUI;

// Load app.js
global.S = { units: [], active: 0 };
eval(fs.readFileSync('app.js', 'utf8'));

console.log('✓ Environment loaded successfully.\n');

// Set up architectural project
const project = Core.createProject('Test TV Wall Fix');
global.OrbixUI.project = project;

console.log('[TEST 1] Placing "CROCKERY/TV BASE 1 DRAWER" into floor plan');
const catalogItem = Core.FURNITURE_CATALOG.find(c => c.name === 'CROCKERY/TV BASE 1 DRAWER');
assert(catalogItem, 'Catalog item CROCKERY/TV BASE 1 DRAWER must exist');

const furn1 = Core.createFurniturePlacement(catalogItem, { x: 1000, y: 1000 }, 0);
project.plan.furniture.push(furn1);

global.OrbixUI.syncProjectUnitsTo3DStudio(furn1.id);

const u1 = global.S.units.find(u => u._furnId === furn1.id);
assert(u1, 'Unit must exist in S.units');
console.log('Placed Unit 1 ctype:', u1.ctype);
assert.strictEqual(u1.ctype, 'kbase', 'Unit 1 ctype must be modular "kbase", got ' + u1.ctype);

// Verify sceneLayouts for u1
const lays1 = global.__cc.layouts(u1);
const allBoxes1 = [];
lays1.forEach(l => { allBoxes1.push(...l.boxes); });

const wallBoxes1 = allBoxes1.filter(b => b.mat === 'wall');
const floorBoxes1 = allBoxes1.filter(b => b.mat === 'floor');
const featurePanels1 = allBoxes1.filter(b => b.role === 'back' && b.h > 1000);
const tvScreens1 = allBoxes1.filter(b => b.mat === 'hob');

console.log('Unit 1 boxes count:', allBoxes1.length);
console.log('Unit 1 wall boxes:', wallBoxes1.length);
console.log('Unit 1 floor boxes:', floorBoxes1.length);
console.log('Unit 1 feature panels (h>1000):', featurePanels1.length);
console.log('Unit 1 TV screens:', tvScreens1.length);

assert.strictEqual(wallBoxes1.length, 0, 'Placing CROCKERY/TV BASE 1 DRAWER must NOT generate any wall boxes');
assert.strictEqual(floorBoxes1.length, 0, 'Placing CROCKERY/TV BASE 1 DRAWER must NOT generate any synthetic floor boxes');
assert.strictEqual(featurePanels1.length, 0, 'Placing CROCKERY/TV BASE 1 DRAWER must NOT generate a 2400mm feature wall panel');
assert.strictEqual(tvScreens1.length, 0, 'Placing CROCKERY/TV BASE 1 DRAWER must NOT generate a floating TV screen');
console.log('✓ TEST 1 PASSED: Zero unwanted walls, floors, or feature panels on initial placement.\n');

console.log('[TEST 2] Duplicating "CROCKERY/TV BASE 1 DRAWER (Copy)"');
const furn2 = JSON.parse(JSON.stringify(furn1));
furn2.id = Core.uid();
furn2.name = 'CROCKERY/TV BASE 1 DRAWER (Copy)';
furn2.pos = { x: 1650, y: 1000 };
project.plan.furniture.push(furn2);

global.OrbixUI.syncProjectUnitsTo3DStudio(furn2.id);

const u2 = global.S.units.find(u => u._furnId === furn2.id);
assert(u2, 'Unit 2 (Copy) must exist in S.units');
console.log('Copy 1 ctype:', u2.ctype);
assert.strictEqual(u2.ctype, 'kbase', 'Copy 1 ctype must be modular "kbase", got ' + u2.ctype);

const lays2 = global.__cc.layouts(u2);
const allBoxes2 = [];
lays2.forEach(l => { allBoxes2.push(...l.boxes); });
const wallBoxes2 = allBoxes2.filter(b => b.mat === 'wall');
const floorBoxes2 = allBoxes2.filter(b => b.mat === 'floor');

assert.strictEqual(wallBoxes2.length, 0, 'Copy 1 must NOT generate any wall boxes');
assert.strictEqual(floorBoxes2.length, 0, 'Copy 1 must NOT generate any synthetic floor boxes');
console.log('✓ TEST 2 PASSED: Zero unwanted walls on first duplicate copy.\n');

console.log('[TEST 3] Duplicating second copy "CROCKERY/TV BASE 1 DRAWER (Copy)"');
const furn3 = JSON.parse(JSON.stringify(furn2));
furn3.id = Core.uid();
furn3.name = 'CROCKERY/TV BASE 1 DRAWER (Copy)';
furn3.pos = { x: 2300, y: 1000 };
project.plan.furniture.push(furn3);

global.OrbixUI.syncProjectUnitsTo3DStudio(furn3.id);

const u3 = global.S.units.find(u => u._furnId === furn3.id);
assert(u3, 'Unit 3 (Copy) must exist in S.units');
console.log('Copy 2 ctype:', u3.ctype);
assert.strictEqual(u3.ctype, 'kbase', 'Copy 2 ctype must be modular "kbase", got ' + u3.ctype);

const lays3 = global.__cc.layouts(u3);
const allBoxes3 = [];
lays3.forEach(l => { allBoxes3.push(...l.boxes); });
const wallBoxes3 = allBoxes3.filter(b => b.mat === 'wall');
const floorBoxes3 = allBoxes3.filter(b => b.mat === 'floor');

assert.strictEqual(wallBoxes3.length, 0, 'Copy 2 must NOT generate any wall boxes');
assert.strictEqual(floorBoxes3.length, 0, 'Copy 2 must NOT generate any synthetic floor boxes');
console.log('✓ TEST 3 PASSED: Zero unwanted walls on second duplicate copy.\n');

console.log('[TEST 4] Direct invocation of layoutTv with architectural project active');
// Even if ctype is explicitly "tv", layoutTv must never push synthetic walls when inside an architectural project
const directTvUnit = {
  label: 'Direct TV Unit',
  ctype: 'tv',
  _furnId: 'direct-tv-id',
  W: 1200, H: 450, D: 450, T: 18
};
const tvDirectLays = global.__cc.layouts(directTvUnit);
const tvDirectBoxes = [];
tvDirectLays.forEach(l => { tvDirectBoxes.push(...l.boxes); });
const tvDirectWallBoxes = tvDirectBoxes.filter(b => b.mat === 'wall');
const tvDirectFloorBoxes = tvDirectBoxes.filter(b => b.mat === 'floor');

console.log('layoutTv with arch project wall boxes count:', tvDirectWallBoxes.length);
console.log('layoutTv with arch project floor boxes count:', tvDirectFloorBoxes.length);
assert.strictEqual(tvDirectWallBoxes.length, 0, 'layoutTv must not generate 16-meter wall boxes when inside architectural project');
assert.strictEqual(tvDirectFloorBoxes.length, 0, 'layoutTv must not generate 16-meter floor boxes when inside architectural project');
console.log('✓ TEST 4 PASSED: layoutTv safely suppressed synthetic walls and floors.\n');

console.log('[TEST 5] Direct invocation of layoutCrockery with architectural project active');
const directCrUnit = {
  label: 'Direct Crockery Unit',
  ctype: 'crockery',
  _furnId: 'direct-cr-id',
  W: 1200, H: 2100, D: 450, T: 18
};
const crDirectLays = global.__cc.layouts(directCrUnit);
const crDirectBoxes = [];
crDirectLays.forEach(l => { crDirectBoxes.push(...l.boxes); });
const crDirectWallBoxes = crDirectBoxes.filter(b => b.mat === 'wall');
const crDirectFloorBoxes = crDirectBoxes.filter(b => b.mat === 'floor');

console.log('layoutCrockery with arch project wall boxes count:', crDirectWallBoxes.length);
console.log('layoutCrockery with arch project floor boxes count:', crDirectFloorBoxes.length);
assert.strictEqual(crDirectWallBoxes.length, 0, 'layoutCrockery must not generate 16-meter wall boxes when inside architectural project');
assert.strictEqual(crDirectFloorBoxes.length, 0, 'layoutCrockery must not generate 16-meter floor boxes when inside architectural project');
console.log('✓ TEST 5 PASSED: layoutCrockery safely suppressed synthetic walls and floors.\n');

console.log('======================================================================');
console.log('ALL TESTS PASSED: Unwanted walls for TV & Crockery units 100% resolved!');
console.log('======================================================================');
