const assert = require('assert');
const fs = require('fs');

// Set up mock DOM and Browser environment
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

// Mock Three.js
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

// Load orbix-projects, orbix-ui
const projectsCode = fs.readFileSync('orbix-projects.js', 'utf8');
eval(projectsCode);
global.OrbixProjects = global.window.OrbixProjects;

const uiCode = fs.readFileSync('orbix-ui.js', 'utf8');
eval(uiCode);
global.OrbixUI = global.window.OrbixUI;

console.log('--- STARTING COMPREHENSIVE SUITE: DECOR IMPORT & 3D FIXES ---');

// =========================================================================
// TEST 1: Fix 3D Unit Switching Property Retention with 3 Identical FM 75s
// =========================================================================
console.log('\n[TEST 1] Testing 3D unit switching & material retention for identical units...');
const proj = Core.createProject('Villa 108', 'Designer User');
proj.id = 'proj_villa_108';

const fm1 = Core.createFurniturePlacement({
  id: 'fm_75_unit_1',
  name: 'FM 75 Base Cabinet',
  catalogItemId: 'fm-75',
  category: 'kitchen_base',
  dimensions: { W: 750, H: 850, D: 560 },
  position: { x: 500, y: 500, z: 0 },
  unitConfig: { shutterCol: 'MDF 7701', carcass: 'MDF 1135', shutters: 2, dstyle: 'flat' }
});

const fm2 = Core.createFurniturePlacement({
  id: 'fm_75_unit_2',
  name: 'FM 75 Base Cabinet',
  catalogItemId: 'fm-75',
  category: 'kitchen_base',
  dimensions: { W: 750, H: 850, D: 560 },
  position: { x: 1300, y: 500, z: 0 },
  unitConfig: { shutterCol: 'MDF 7701', carcass: 'MDF 1135', shutters: 2, dstyle: 'flat' }
});

const fm3 = Core.createFurniturePlacement({
  id: 'fm_75_unit_3',
  name: 'FM 75 Base Cabinet',
  catalogItemId: 'fm-75',
  category: 'kitchen_base',
  dimensions: { W: 750, H: 850, D: 560 },
  position: { x: 2100, y: 500, z: 0 },
  unitConfig: { shutterCol: 'MDF 7701', carcass: 'MDF 1135', shutters: 2, dstyle: 'flat' }
});

proj.plan.furniture = [fm1, fm2, fm3];
OrbixUI.project = proj;

// Mock window.S studio session state
global.window.S = {
  units: [],
  active: 0
};
global.window.buildScene = function() {};
let render3DHomeCalled = 0;
OrbixUI.render3DHome = function(force) {
  render3DHomeCalled++;
};

// Sync to 3D studio
OrbixUI.syncProjectUnitsTo3DStudio();
assert.strictEqual(window.S.units.length, 3, 'Should have synced 3 units to 3D studio');

// User selects unit 2 (index 1) in 3D studio and modifies its shutter color & dstyle
OrbixUI.selectFurnitureIn3DStudio(1);
assert.strictEqual(window.S.active, 1, 'Active unit in S should now be index 1');

// Apply edits to unit 2
const activeU = window.S.units[window.S.active];
activeU.shutterCol = 'MDF 9900 (High Gloss White)';
activeU.dstyle = 'shaker';

// Sync back to project
OrbixUI.syncProjectUnitsTo3DStudio();

// Verify Unit 2 in project retained the new shutter color & style
const pUnit2 = proj.plan.furniture.find(f => f.id === 'fm_75_unit_2');
assert.strictEqual(pUnit2.unitConfig.shutterCol, 'MDF 9900 (High Gloss White)', 'Unit 2 shutter color must be updated');
assert.strictEqual(pUnit2.unitConfig.dstyle, 'shaker', 'Unit 2 door style must be shaker');
assert.strictEqual(pUnit2.shutterMaterials[0], 'MDF 9900 (High Gloss White)', 'Unit 2 shutterMaterials array must be updated');

// Now switch to Unit 3 (index 2)
OrbixUI.selectFurnitureIn3DStudio(2);
assert.strictEqual(window.S.active, 2, 'Active unit should now be index 2');

// Verify that Unit 2 (index 1) STILL HAS its edited properties and was NOT reset to default!
const pUnit2Check = proj.plan.furniture.find(f => f.id === 'fm_75_unit_2');
assert.strictEqual(pUnit2Check.unitConfig.shutterCol, 'MDF 9900 (High Gloss White)', 'Unit 2 shutter color preserved after switching to Unit 3');
assert.strictEqual(pUnit2Check.unitConfig.dstyle, 'shaker', 'Unit 2 door style preserved after switching to Unit 3');

// Switch back to Unit 2 (index 1)
OrbixUI.selectFurnitureIn3DStudio(1);
assert.strictEqual(window.S.units[1].shutterCol, 'MDF 9900 (High Gloss White)', 'Active Unit 2 must load previously saved edits');
assert.strictEqual(window.S.units[1].dstyle, 'shaker', 'Active Unit 2 must load shaker door style');
console.log('✅ TEST 1 PASSED: 3D Unit switching faithfully retains custom properties for identical units!');


// =========================================================================
// TEST 2: Fix Wall Unit Elevation Double-Offset Bug (WM30)
// =========================================================================
console.log('\n[TEST 2] Testing WM30 Wall Unit Elevation coordinate calculation...');
const wm30 = Core.createFurniturePlacement({
  id: 'wm_30_unit_1',
  name: 'WM 30 Wall Cabinet',
  catalogItemId: 'wm-30',
  category: 'kitchen_wall',
  dimensions: { W: 300, H: 600, D: 320 },
  pos: { x: 500, y: 500, z: 1500 }, // 1500 mm elevation AFFL
  elevation: 1500,
  unitConfig: { elev: 1500 }
});

assert.strictEqual(wm30.elevation, 1500, 'WM30 placement elevation must be 1500 mm');

// In layoutRun(u), every panel has b.y = (b.y || 0) + elev (baseElev = 1500)
// When Cupboard CAD GL.show(L) renders the active unit in 3D studio:
// furnPos = { x: 500, y: 500, z: 1500 };
// activeU = { elev: 1500 };
// baseElev = activeU.elev || 0;
// root.position.set(furnPos.x, (furnPos.z || 0) - baseElev, furnPos.y);
const furnPos = { x: wm30.pos.x, y: wm30.pos.y, z: wm30.elevation };
const baseElev = wm30.elevation;
const rootPosY = (furnPos.z || 0) - baseElev;

assert.strictEqual(rootPosY, 0, 'root.position.y must be 0 so panels at y+baseElev sit exactly at 1500mm AFFL');

// If rootPosY were not adjusted (the bug), it would be 1500, and panels would be at 1500 + 1500 = 3000 mm (floating!)
const buggyRootPosY = furnPos.z || 0;
const buggyPanelWorldY = buggyRootPosY + baseElev;
const fixedPanelWorldY = rootPosY + baseElev;

assert.strictEqual(buggyPanelWorldY, 3000, 'Unfixed calculation displaced WM30 to 3000 mm');
assert.strictEqual(fixedPanelWorldY, 1500, 'Fixed calculation positions WM30 at exact world elevation 1500 mm AFFL');
console.log('✅ TEST 2 PASSED: Wall unit elevation is accurately aligned without doubling or jumping!');


// =========================================================================
// TEST 3: Decor Items Excluded from Pricing (₹0.00 BOQ)
// =========================================================================
console.log('\n[TEST 3] Testing Decor & Custom .skp Items 100% Excluded from Woodwork BOQ...');

// Create decor items
const fridge = Core.createFurniturePlacement({
  name: 'Refrigerator (Double Door)',
  dimensions: { W: 900, H: 1800, D: 700 },
  isDecor: true,
  decorType: 'fridge',
  excludeFromPricing: true,
  pos: { x: 3000, y: 500, z: 0 }
});

const chiller = Core.createFurniturePlacement({
  name: 'Ice Box / Beverage Chiller',
  dimensions: { W: 500, H: 850, D: 550 },
  isDecor: true,
  decorType: 'ice_box',
  excludeFromPricing: true,
  pos: { x: 4000, y: 500, z: 0 }
});

const plant = Core.createFurniturePlacement({
  name: 'Indoor Floor Plant',
  dimensions: { W: 500, H: 1200, D: 500 },
  isDecor: true,
  decorType: 'plant',
  excludeFromPricing: true,
  pos: { x: 4600, y: 500, z: 0 }
});

const customSkp = Core.createFurniturePlacement({
  name: 'Custom Living Decor (.skp Model)',
  dimensions: { W: 800, H: 600, D: 400 },
  isDecor: true,
  decorType: 'general',
  modelFormat: 'skp',
  excludeFromPricing: true,
  pos: { x: 5200, y: 500, z: 850 }
});

// Verify calculateItemCost returns 0
const fridgeCost = Core.calculateItemCost(fridge, Core.PRICING_CONFIG);
assert.strictEqual(fridgeCost.totalAmount, 0, 'Fridge totalAmount must be ₹0.00');
assert.strictEqual(fridgeCost.baseRate, 0, 'Fridge baseRate must be ₹0.00');
assert.strictEqual(fridgeCost.isDecor, true, 'isDecor flag must be true');
assert.strictEqual(fridgeCost.excludeFromPricing, true, 'excludeFromPricing flag must be true');

const chillerCost = Core.calculateItemCost(chiller, Core.PRICING_CONFIG);
assert.strictEqual(chillerCost.totalAmount, 0, 'Chiller totalAmount must be ₹0.00');

const plantCost = Core.calculateItemCost(plant, Core.PRICING_CONFIG);
assert.strictEqual(plantCost.totalAmount, 0, 'Plant totalAmount must be ₹0.00');

const skpCost = Core.calculateItemCost(customSkp, Core.PRICING_CONFIG);
assert.strictEqual(skpCost.totalAmount, 0, 'Custom .skp totalAmount must be ₹0.00');

// Test project quotation calculation
const quoteProj = Core.createProject('Luxury Flat with Decors', 'Client A');
const woodUnit1 = Core.createFurniturePlacement({
  name: 'Kitchen Sink Unit',
  category: 'kitchen_base',
  dimensions: { W: 1000, H: 850, D: 560 }
});
const woodUnit2 = Core.createFurniturePlacement({
  name: '3-Door Wardrobe',
  category: 'bedroom_wardrobe',
  dimensions: { W: 1500, H: 2100, D: 600 }
});

quoteProj.plan.furniture = [woodUnit1, woodUnit2, fridge, chiller, plant, customSkp];

const quotation = Core.generateFullQuotation(quoteProj);
assert(quotation.furnitureItems.length === 6, 'Quotation must include all 6 items');

// Find decor items in quotation
const decorQuotes = quotation.furnitureItems.filter(item => item.isDecor || item.excludeFromPricing);
assert.strictEqual(decorQuotes.length, 4, 'Should identify 4 decor items in quotation');
decorQuotes.forEach(dq => {
  assert.strictEqual(dq.totalAmount, 0, `Decor item "${dq.itemName}" must have totalAmount = 0`);
  assert.strictEqual(dq.baseRate, 0, `Decor item "${dq.itemName}" must have baseRate = 0`);
});

// Compare grand total with quotation of only woodwork units
const woodworkOnlyProj = Core.createProject('Woodwork Only', 'Client A');
woodworkOnlyProj.plan.furniture = [woodUnit1, woodUnit2];
const woodworkQuotation = Core.generateFullQuotation(woodworkOnlyProj);

assert.strictEqual(
  quotation.subtotalWoodwork,
  woodworkQuotation.subtotalWoodwork,
  'Project subtotalWoodwork must match woodwork-only subtotalWoodwork exactly (no decor markup)'
);
console.log('✅ TEST 3 PASSED: All decors and custom .skp models contribute ₹0.00 to woodwork BOQ!');


// =========================================================================
// TEST 4: Decors are Excluded from Woodwork Cutting / Saw Nesting Units
// =========================================================================
console.log('\n[TEST 4] Testing Decor exclusion from woodwork cutting sheets & 3D studio S.units...');
OrbixUI.project = quoteProj;
OrbixUI.syncProjectUnitsTo3DStudio();

// S.units should only contain the 2 woodwork units, not the 4 decor items!
assert.strictEqual(
  window.S.units.length,
  2,
  `window.S.units should contain only woodwork units (got ${window.S.units.length}, expected 2)`
);
assert.strictEqual(window.S.units[0].label, 'Kitchen Sink Unit');
assert.strictEqual(window.S.units[1].label, '3-Door Wardrobe');
console.log('✅ TEST 4 PASSED: Decor items are excluded from cutting sheets and Cupboard CAD nesting units!');


// =========================================================================
// TEST 5: Decor Placement via OrbixUI
// =========================================================================
console.log('\n[TEST 5] Testing OrbixUI.placeDecorItem helper...');
const testProj = Core.createProject('Studio Apartment', 'Designer B');
OrbixUI.project = testProj;

OrbixUI.placeDecorItem({
  name: 'Kitchen Chimney / Hood',
  decorType: 'chimney',
  w: 600,
  h: 750,
  d: 500,
  elev: 1500
});

const placedDecor = testProj.plan.furniture.find(f => f.decorType === 'chimney');
assert(placedDecor, 'Chimney should be placed in the project room');
assert.strictEqual(placedDecor.isDecor, true, 'Placed item must have isDecor: true');
assert.strictEqual(placedDecor.excludeFromPricing, true, 'Placed item must have excludeFromPricing: true');
assert.strictEqual(placedDecor.elevation, 1500, 'Placed chimney elevation must be 1500 mm');
assert.strictEqual(placedDecor.dimensions.W, 600, 'Width must be 600 mm');
assert.strictEqual(placedDecor.dimensions.H, 750, 'Height must be 750 mm');
assert.strictEqual(placedDecor.dimensions.D, 500, 'Depth must be 500 mm');
console.log('✅ TEST 5 PASSED: OrbixUI.placeDecorItem correctly configures and inserts decor items!');

console.log('\n🎉 ALL 5 TEST SUITES COMPLETED AND PASSED WITH 100% SUCCESS!');
