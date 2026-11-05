const assert = require('assert');
const fs = require('fs');

// Set up mock browser environment
const localStorageStore = {};
global.localStorage = {
  getItem: function(key) { return localStorageStore[key] || null; },
  setItem: function(key, val) { localStorageStore[key] = String(val); },
  removeItem: function(key) { delete localStorageStore[key]; },
  clear: function() { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]); }
};

global.window = {
  localStorage: global.localStorage,
  location: { pathname: '/2d-plan', hash: '' },
  addEventListener: function() {},
  history: { pushState: function() {}, replaceState: function() {} }
};

global.document = {
  readyState: 'loading',
  body: { classList: { toggle: function() {}, add: function() {}, remove: function() {}, contains: function() { return false; } } },
  getElementById: function(id) {
    return {
      classList: { toggle: function() {}, add: function() {}, remove: function() {}, contains: function() { return false; } },
      addEventListener: function() {},
      innerHTML: '',
      textContent: '',
      style: {}
    };
  },
  createElement: function(tag) {
    return {
      classList: { toggle: function() {}, add: function() {}, remove: function() {}, contains: function() { return false; } },
      addEventListener: function() {},
      appendChild: function() {},
      setAttribute: function() {},
      innerHTML: '',
      textContent: '',
      style: {}
    };
  },
  querySelector: function() { return null; },
  querySelectorAll: function() { return []; },
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
global.window.OrbixCore = Core;

// Load OrbixProjects and OrbixUI
const projectsCode = fs.readFileSync('orbix-projects.js', 'utf8');
eval(projectsCode);
const OrbixProjects = global.window.OrbixProjects;

console.log('--- TEST 1: VERIFY HARD REFRESH IMMUNITY (NO LOSS OF UNITS) ---');

// 1. Create a project and place 2 genuine units
const testProject = Core.createProject('Villa 402 Project');
testProject.id = 'proj_test_402';
const unit1 = Core.createFurniturePlacement({
  id: 'f_unit_1',
  name: 'FM 60',
  category: 'kitchen_base',
  dimensions: { W: 600, H: 750, D: 550 },
  unitConfig: { shutterCol: 'MDF 7701', carcass: 'MDF 1135', shutters: 1 }
});
const unit2 = Core.createFurniturePlacement({
  id: 'f_unit_2',
  name: 'SLIDING WARDROBE',
  category: 'wardrobe',
  dimensions: { W: 1800, H: 2100, D: 550 },
  unitConfig: { shutterCol: 'MDF 3410', carcass: 'MDF 1135', shutters: 2 }
});
testProject.plan.furniture = [unit1, unit2];

// Save to working draft in localStorage (what happens before a hard refresh)
localStorage.setItem('orbix_working_project_draft', JSON.stringify({
  projectId: 'proj_test_402',
  userId: 'usr_aravind',
  timestamp: Date.now(),
  plan: testProject,
  units: []
}));
localStorage.setItem('orbix_project_usr_aravind_proj_test_402', JSON.stringify(testProject));
localStorage.setItem('orbix_active_proj_usr_aravind', 'proj_test_402');
localStorage.setItem('orbix_active_project_id', 'proj_test_402');

// Mock an empty project returned by server (e.g. before auto-save completed)
const serverCopy = {
  id: 'proj_test_402',
  title: 'Villa 402 Project',
  client: 'Aravind K.',
  updatedAt: new Date(Date.now() - 60000).toISOString(),
  data: {
    plan: Core.createProject('Villa 402 Project') // 0 units on server!
  }
};

let loadedPlan = null;
global.window.OrbixUI = {
  project: null,
  loadProject: function(p) {
    loadedPlan = p;
    global.window.OrbixUI.project = p;
  },
  syncProjectUnitsTo3DStudio: function() {}
};

// Simulate _loadProjectIntoWorkspace executing on hard refresh
OrbixProjects.currentUser = { id: 'usr_aravind', name: 'Aravind', role: 'employee' };
OrbixProjects.activeProjectId = 'proj_test_402';
OrbixProjects._loadProjectIntoWorkspace(serverCopy, false);

assert(loadedPlan, 'Plan must be loaded');
const loadedUnits = (loadedPlan.plan && loadedPlan.plan.furniture) || loadedPlan.furniture || [];
console.log('Units loaded after simulated hard refresh:', loadedUnits.length);
assert.strictEqual(loadedUnits.length, 2, 'Hard refresh must NOT wipe units! Must retain all 2 units.');
assert.strictEqual(loadedUnits[0].name, 'FM 60');
assert.strictEqual(loadedUnits[1].name, 'SLIDING WARDROBE');
console.log('✓ TEST 1 PASSED: Hard refresh retains all placed units without losing data!\n');


console.log('--- TEST 2: VERIFY 3D UNIT EDIT PERSISTENCE ACROSS UNIT SWITCHING ---');

// Set up window.S
global.window.S = {
  units: [],
  active: 0
};

// Load orbix-ui code into environment
const uiCode = fs.readFileSync('orbix-ui.js', 'utf8');
eval(uiCode);
global.window.OrbixUI = global.OrbixUI;
const OrbixUI = global.OrbixUI;

// Load the 2 units into OrbixUI
OrbixUI.project = testProject;
OrbixUI.syncProjectUnitsTo3DStudio();

assert.strictEqual(window.S.units.length, 2, 'window.S.units must mirror the 2 placed units');
assert.strictEqual(window.S.units[0]._furnId, 'f_unit_1');
assert.strictEqual(window.S.units[1]._furnId, 'f_unit_2');

// User selects Unit 1 (active = 0) and edits laminate & door style in 3D
window.S.active = 0;
const u1 = window.S.units[0];
u1.shutterCol = 'MDF 6601'; // User changed to Gloss White
u1.dstyle = 'glass';        // User changed to Glass door style
u1.carcass = 'MDF 2204';    // User changed carcass to Oak

// User now switches to Unit 2 (clicking Unit 2)
OrbixUI.selectFurnitureIn3DStudio('f_unit_2');

assert.strictEqual(window.S.active, 1, 'Active unit must now be Unit 2');

// Now user switches BACK to Unit 1
OrbixUI.selectFurnitureIn3DStudio('f_unit_1');
assert.strictEqual(window.S.active, 0, 'Active unit must now be Unit 1');

const u1AfterSwitch = window.S.units[0];
console.log('Unit 1 properties after switching back:');
console.log('  shutterCol:', u1AfterSwitch.shutterCol, '(expected MDF 6601)');
console.log('  dstyle:    ', u1AfterSwitch.dstyle, '(expected glass)');
console.log('  carcass:   ', u1AfterSwitch.carcass, '(expected MDF 2204)');

assert.strictEqual(u1AfterSwitch.shutterCol, 'MDF 6601', 'Unit 1 shutterCol must retain its edit across unit switch!');
assert.strictEqual(u1AfterSwitch.dstyle, 'glass', 'Unit 1 dstyle must retain its edit across unit switch!');
assert.strictEqual(u1AfterSwitch.carcass, 'MDF 2204', 'Unit 1 carcass must retain its edit across unit switch!');

// Also verify that the 2D floor plan object received the edits
const pUnit1 = OrbixUI.project.plan.furniture.find(f => f.id === 'f_unit_1');
assert.strictEqual(pUnit1.unitConfig.shutterCol, 'MDF 6601', 'Floor plan unitConfig must reflect 3D edit');
assert.strictEqual(pUnit1.unitConfig.dstyle, 'glass', 'Floor plan unitConfig must reflect 3D dstyle edit');
assert.strictEqual(pUnit1.unitConfig.carcass, 'MDF 2204', 'Floor plan unitConfig must reflect 3D carcass edit');
console.log('✓ TEST 2 PASSED: 3D unit edits are 100% persisted and never reset to default!\n');


console.log('--- TEST 3: VERIFY NO DUMMY UNITS & CLEAN 1:1 MIRROR ---');

// If 2D plan has 0 units, 3D Studio must have 0 units (no dummy generic wardrobe!)
OrbixUI.project.plan.furniture = [];
OrbixUI.syncProjectUnitsTo3DStudio();

console.log('window.S.units when 2D has 0 units:', window.S.units.length);
assert.strictEqual(window.S.units.length, 0, 'Must have exactly 0 units in 3D when 2D plan is empty. No dummy units!');
console.log('✓ TEST 3 PASSED: No dummy units generated or orphaned in 3D Studio!\n');

console.log('ALL TESTS PASSED WITH 100% SUCCESS!');
process.exit(0);
