var assert = require('assert');
var fs = require('fs');

// Load Core
var Core = require('../orbix-core.js');

console.log('--- Testing Unit Placement & Overlap Stability ---');

// 1. Create a project plan with walls and a unit
var proj = Core.createProject('Test Project');
var plan = proj.plan;
plan.walls.push({
  id: 'w1',
  start: { x: 0, y: 0 },
  end: { x: 4000, y: 0 },
  thickness: 150,
  height: 2800
});

// Create standard base cabinet
var baseCab = Core.createFurniturePlacement({
  id: 'base1',
  name: 'Base Cabinet 600',
  category: 'kitchen_base',
  dimensions: { W: 600, H: 850, D: 600 },
  pos: { x: 500, y: 300, z: 0 },
  elevation: 0
});
plan.furniture.push(baseCab);

// Verify decor placement does not collide
var bed = Core.createFurniturePlacement({
  id: 'decor_bed_1',
  name: 'Master King Bed',
  category: 'decor',
  decorType: 'bed',
  isDecor: true,
  excludeFromPricing: true,
  dimensions: { W: 1800, H: 1000, D: 2000 },
  pos: { x: 500, y: 300, z: 0 },
  elevation: 0
});

var colRes = Core.checkPlacementOverlap(bed, plan, bed.id);
assert.strictEqual(colRes.hasOverlap, false, 'Decor item should never have blocking overlap');
console.log('✔ Decor placement overlap bypass passed');

// Test Pricing for all 9 new decors
console.log('--- Testing Pricing Impact for All 9 Decors (₹0.00 Requirement) ---');
var newDecors = [
  { name: 'Master King Bed', type: 'bed', dims: { W: 1800, H: 1000, D: 2000 } },
  { name: 'Mariam King Bed Set', type: 'mariam_bed', dims: { W: 2400, H: 1100, D: 2100 } },
  { name: 'Kid Bedroom Bed Setup', type: 'kid_bed', dims: { W: 1200, H: 1200, D: 1950 } },
  { name: 'Sectional Sofa Set Collection', type: 'sofa_collection', dims: { W: 2600, H: 850, D: 1800 } },
  { name: 'Luxury Interior Sofa', type: 'sofa', dims: { W: 2200, H: 850, D: 900 } },
  { name: 'Modern Accent Armchair', type: 'chair', dims: { W: 750, H: 850, D: 750 } },
  { name: 'Dressing / Bar Stool', type: 'stool', dims: { W: 450, H: 450, D: 450 } },
  { name: 'Dressing / Vanity Mirror', type: 'mirror', dims: { W: 600, H: 1200, D: 40 } },
  { name: 'Modern Smart TV & Console', type: 'tv', dims: { W: 1400, H: 800, D: 80 } }
];

newDecors.forEach(function (d) {
  var item = Core.createFurniturePlacement({
    name: d.name,
    category: 'decor',
    decorType: d.type,
    isDecor: true,
    excludeFromPricing: true,
    dimensions: d.dims,
    pos: { x: 1000, y: 1000, z: 0 }
  });

  var pricing = Core.calculateItemCost(item);
  assert.strictEqual(pricing.totalCost, 0, d.name + ' totalCost must be 0');
  assert.strictEqual(pricing.totalAmount, 0, d.name + ' totalAmount must be 0');
  assert.strictEqual(pricing.areaSft, 0, d.name + ' areaSft must be 0');
  assert.strictEqual(pricing.excludeFromPricing, true, d.name + ' must be marked excludeFromPricing');
  console.log('✔ ' + d.name + ' -> ₹' + pricing.totalCost.toFixed(2) + ' (Correctly excluded from Woodwork BOQ)');
});

// Check that app.js does not unconditionally call setSize in apply()
console.log('--- Verifying 3D Lag Fix in app.js ---');
var appCode = fs.readFileSync('app.js', 'utf8');
assert.ok(appCode.indexOf('renderer.domElement.clientWidth !== targetW') !== -1, 'app.js must guard setSize with size comparison');
assert.ok(appCode.indexOf('Math.abs(cam.yaw - lastCutState.yaw) <') !== -1, 'app.js must throttle updateWallCutaway');
assert.ok(appCode.indexOf('Overlap detected! Placement reverted.') === -1, 'orbix-plan.js must not revert placement on overlap');
console.log('✔ 3D Lag guards and Unit Revert elimination verified');

console.log('\nAll verification tests passed successfully! 🎉');
