const assert = require('assert');
const fs = require('fs');

// Set up mock DOM and Browser environment
function mockEl(id) {
  return {
    id: id || '',
    classList: { toggle: function() {}, add: function() {}, remove: function() {}, contains: function() { return false; } },
    addEventListener: function() {},
    appendChild: function() {},
    setAttribute: function() {},
    querySelectorAll: function() { return []; },
    getBoundingClientRect: function() { return { left: 0, top: 0, width: 800, height: 600 }; },
    getContext: function() {
      return {
        createPattern: function() {},
        fillRect: function() {},
        createImageData: function(w, h) { return { data: new Uint8Array((w || 64) * (h || 64) * 4) }; },
        putImageData: function() {},
        createLinearGradient: function() { return { addColorStop: function() {} }; },
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
        lineTo: function() {}
      };
    },
    toDataURL: function() { return ''; },
    innerHTML: '',
    textContent: '',
    style: {}
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

const Core = require('../orbix-core.js');
global.Core = Core;
global.OrbixCore = Core;

// 1. Load orbix-projects, orbix-ui, app.js
const projectsCode = fs.readFileSync('orbix-projects.js', 'utf8');
eval(projectsCode);
global.OrbixProjects = global.window.OrbixProjects;

const uiCode = fs.readFileSync('orbix-ui.js', 'utf8');
eval(uiCode);
global.OrbixUI = global.window.OrbixUI;

// 2. Create project with 2 Cookscape units
const proj = Core.createProject('Penthouse 501', 'Aravind');
proj.id = 'proj_501';

const unit1 = Core.createFurniturePlacement({
  id: 'f_unit_1',
  name: 'FM 120',
  category: 'kitchen_base',
  dimensions: { W: 1200, H: 750, D: 550 },
  unitConfig: { shutterCol: 'MDF 7701', carcass: 'MDF 1135', shutters: 2 }
});
const unit2 = Core.createFurniturePlacement({
  id: 'f_unit_2',
  name: 'SLIDING WARDROBE',
  category: 'wardrobe',
  dimensions: { W: 1800, H: 2100, D: 600 },
  unitConfig: { shutterCol: 'MDF 3410', carcass: 'MDF 1135', shutters: 2 }
});
proj.plan.furniture = [unit1, unit2];

OrbixUI.project = proj;
OrbixUI.syncProjectUnitsTo3DStudio();

const appCode = fs.readFileSync('app.js', 'utf8');
eval(appCode);

console.log('--- TEST 1: VERIFY WINDOW EXPORTS FOR 3D ENGINE ---');
assert.strictEqual(typeof window.renderRail, 'function', 'window.renderRail must be exposed');
assert.strictEqual(typeof window.renderAll, 'function', 'window.renderAll must be exposed');
assert.strictEqual(typeof window.softAll, 'function', 'window.softAll must be exposed');
assert.strictEqual(typeof window.buildScene, 'function', 'window.buildScene must be exposed');
console.log('✓ TEST 1 PASSED: All 3D engine functions properly exposed on window!\n');

console.log('--- TEST 2: VERIFY REAL-TIME 3D UNIT EDITING ---');
assert.strictEqual(window.S.units.length, 2, 'Must have 2 units in 3D');
window.S.active = 0;
const u = window.U();
assert.strictEqual(u.label, 'FM 120');

// Edit dimensions
u.W = 1500;
u.H = 850;
u.D = 650;

// Edit style and colours
u.dstyle = 'glass';
u.shutterCol = 'MDF 6601'; // Gloss White
u.carcass = 'MDF 2204';    // Oak
u.handle = 'bar224';
u.shutters = 3;
u.drawers = 2;

// Trigger real engine update
window.renderAll();

// Verify that plan.furniture received all edits
const pMatch = OrbixUI.project.plan.furniture.find(f => f.id === 'f_unit_1');
assert.strictEqual(pMatch.dimensions.W, 1500, 'Dimensions W must update in project');
assert.strictEqual(pMatch.dimensions.H, 850, 'Dimensions H must update in project');
assert.strictEqual(pMatch.dimensions.D, 650, 'Dimensions D must update in project');
assert.strictEqual(pMatch.unitConfig.dstyle, 'glass', 'dstyle must update in project');
assert.strictEqual(pMatch.unitConfig.shutterCol, 'MDF 6601', 'shutterCol must update in project');
assert.strictEqual(pMatch.unitConfig.carcass, 'MDF 2204', 'carcass must update in project');
assert.strictEqual(pMatch.unitConfig.handle, 'bar224', 'handle must update in project');
assert.strictEqual(pMatch.unitConfig.shutters, 3, 'shutters count must update in project');
assert.strictEqual(pMatch.unitConfig.drawers, 2, 'drawers count must update in project');
console.log('✓ TEST 2 PASSED: 3D unit edits immediately apply and persist to project!\n');

console.log('--- TEST 3: VERIFY UNIT SWITCHING AND PERSISTENCE IN 3D ---');
// Switch to Unit 2
OrbixUI.selectFurnitureIn3DStudio('f_unit_2');
assert.strictEqual(window.S.active, 1, 'Active unit must now be Unit 2');
const u2 = window.U();
assert.strictEqual(u2.label, 'SLIDING WARDROBE');

// Switch BACK to Unit 1
OrbixUI.selectFurnitureIn3DStudio('f_unit_1');
assert.strictEqual(window.S.active, 0, 'Active unit must now be Unit 1');
const u1Again = window.U();

assert.strictEqual(u1Again.W, 1500, 'Unit 1 W must remain 1500');
assert.strictEqual(u1Again.H, 850, 'Unit 1 H must remain 850');
assert.strictEqual(u1Again.D, 650, 'Unit 1 D must remain 650');
assert.strictEqual(u1Again.dstyle, 'glass', 'Unit 1 dstyle must remain glass');
assert.strictEqual(u1Again.shutterCol, 'MDF 6601', 'Unit 1 shutterCol must remain MDF 6601');
assert.strictEqual(u1Again.carcass, 'MDF 2204', 'Unit 1 carcass must remain MDF 2204');
assert.strictEqual(u1Again.handle, 'bar224', 'Unit 1 handle must remain bar224');
assert.strictEqual(u1Again.shutters, 3, 'Unit 1 shutters must remain 3');
assert.strictEqual(u1Again.drawers, 2, 'Unit 1 drawers must remain 2');
console.log('✓ TEST 3 PASSED: Switching units in 3D retains 100% of all applied edits without resetting!\n');

console.log('ALL 3D UNIT EDITING TESTS PASSED 100%!');
process.exit(0);
