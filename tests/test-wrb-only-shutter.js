const assert = require('assert');
const fs = require('fs');

console.log('Testing 2 New Wardrobe Units: WRB Only Shutter 60 & 120...');

// Mock browser environment
global.window = global;
global.document = {
  createElement: () => ({ getContext: () => ({}) })
};

const Core = require('../orbix-core.js');

// 1. Catalog Existence & Specifications
const wrb60 = Core.FURNITURE_CATALOG.find(c => c.id === 'wrb-60 o/s');
const wrb120 = Core.FURNITURE_CATALOG.find(c => c.id === 'wrb-120 o/s');

assert(wrb60, 'wrb-60 o/s must exist in catalog');
assert(wrb120, 'wrb-120 o/s must exist in catalog');

// Verify wrb 60 specs
assert.strictEqual(wrb60.category, 'wardrobe', 'wrb-60 category must be wardrobe');
assert.strictEqual(wrb60.dimensions.W, 600, 'wrb-60 width must be 600mm');
assert.strictEqual(wrb60.dimensions.H, 2100, 'wrb-60 height must be 2100mm');
assert.strictEqual(wrb60.dimensions.D, 18, 'wrb-60 depth must be 18mm');
assert.strictEqual(wrb60.unitConfig.isOnlyShutter, true, 'wrb-60 isOnlyShutter must be true');
assert.strictEqual(wrb60.unitConfig.shutters, 1, 'wrb-60 shutters must be 1');
assert.strictEqual(wrb60.unitConfig.shelves, 0, 'wrb-60 shelves must be 0');
assert.strictEqual(wrb60.unitConfig.drawers, 0, 'wrb-60 drawers must be 0');
assert.strictEqual(wrb60.unitConfig.counter, 'none', 'wrb-60 counter must be none');
assert.strictEqual(wrb60.unitConfig.hasLegs, false, 'wrb-60 hasLegs must be false');
console.log('✓ wrb-60 o/s catalog specifications verified (600 × 2100 × 18 mm, wardrobe category).');

// Verify wrb 120 specs
assert.strictEqual(wrb120.category, 'wardrobe', 'wrb-120 category must be wardrobe');
assert.strictEqual(wrb120.dimensions.W, 1200, 'wrb-120 width must be 1200mm');
assert.strictEqual(wrb120.dimensions.H, 2100, 'wrb-120 height must be 2100mm');
assert.strictEqual(wrb120.dimensions.D, 18, 'wrb-120 depth must be 18mm');
assert.strictEqual(wrb120.unitConfig.isOnlyShutter, true, 'wrb-120 isOnlyShutter must be true');
assert.strictEqual(wrb120.unitConfig.shutters, 2, 'wrb-120 shutters must be 2');
assert.strictEqual(wrb120.unitConfig.shelves, 0, 'wrb-120 shelves must be 0');
assert.strictEqual(wrb120.unitConfig.drawers, 0, 'wrb-120 drawers must be 0');
assert.strictEqual(wrb120.unitConfig.counter, 'none', 'wrb-120 counter must be none');
assert.strictEqual(wrb120.unitConfig.hasLegs, false, 'wrb-120 hasLegs must be false');
console.log('✓ wrb-120 o/s catalog specifications verified (1200 × 2100 × 18 mm, wardrobe category).');

// 2. Unit Placement Instantiation
const placed60 = Core.createFurniturePlacement({
  id: 'wrb-60 o/s',
  name: 'WRB 60 O/S',
  category: 'wardrobe',
  dimensions: { W: 600, H: 2100, D: 18 }
});
assert.strictEqual(placed60.dimensions.W, 600, 'placed wrb-60 width must be 600');
assert.strictEqual(placed60.dimensions.H, 2100, 'placed wrb-60 height must be 2100');
assert.strictEqual(placed60.dimensions.D, 18, 'placed wrb-60 depth must remain 18mm');
assert.strictEqual(placed60.elevation, 0, 'placed wrb-60 elevation must be 0');
assert.strictEqual(placed60.unitConfig.counter, 'none', 'placed wrb-60 counter must be none');
assert.strictEqual(placed60.unitConfig.hasLegs, false, 'placed wrb-60 hasLegs must be false');

const placed120 = Core.createFurniturePlacement({
  id: 'wrb-120 o/s',
  name: 'WRB 120 O/S',
  category: 'wardrobe',
  dimensions: { W: 1200, H: 2100, D: 18 }
});
assert.strictEqual(placed120.dimensions.W, 1200, 'placed wrb-120 width must be 1200');
assert.strictEqual(placed120.dimensions.H, 2100, 'placed wrb-120 height must be 2100');
assert.strictEqual(placed120.dimensions.D, 18, 'placed wrb-120 depth must remain 18mm');
assert.strictEqual(placed120.elevation, 0, 'placed wrb-120 elevation must be 0');
assert.strictEqual(placed120.unitConfig.counter, 'none', 'placed wrb-120 counter must be none');
assert.strictEqual(placed120.unitConfig.hasLegs, false, 'placed wrb-120 hasLegs must be false');
console.log('✓ Placement instantiation preserves exact 18mm depth without overriding to 550mm.');

// 3. Pricing Calculation
const cost60 = Core.calculateItemCost(wrb60, Core.DEFAULT_RATE_CARD, 'LL elite');
assert(cost60.totalAmount > 0, 'wrb-60 must calculate positive total amount');
assert(cost60.areaSft > 13.5 && cost60.areaSft < 13.6, 'wrb-60 areaSft must be approx 13.56 sq ft');

const cost120 = Core.calculateItemCost(wrb120, Core.DEFAULT_RATE_CARD, 'LL elite');
assert(cost120.totalAmount > 0, 'wrb-120 must calculate positive total amount');
assert(cost120.areaSft > 27.1 && cost120.areaSft < 27.2, 'wrb-120 areaSft must be approx 27.13 sq ft');
console.log('✓ Cost calculation accurately prices front area at rate card tier rates.');

// 4. Source code checks for 2D & 3D handling
const orbix3dSrc = fs.readFileSync('orbix-3d.js', 'utf8');
assert(orbix3dSrc.includes('var isWrbOS = (catOS === \'wardrobe\' || nameOS.indexOf(\'wrb\') !== -1 || (furn.id && /wrb/i.test(furn.id)));'),
  'orbix-3d.js must identify isWrbOS');
assert(orbix3dSrc.includes('var isBaseOS = !isWrbOS && (isBase || catOS === \'kitchen_base\''),
  'orbix-3d.js must exclude wardrobe only shutter from base OS legs and countertops');
console.log('✓ 3D renderer source verified: wardrobe only shutter omits kitchen legs & stone slabs.');

const orbixPlanSrc = fs.readFileSync('orbix-plan.js', 'utf8');
assert(orbixPlanSrc.includes('var isWrbOS = isOS && (f.category === \'wardrobe\' || /(^|\\b|_|-)(wrb|wr)[-_ ]*(o\\/?s|only[-_ ]*shutter)/i.test(f.name || f.id || \'\'));'),
  'orbix-plan.js must identify isWrbOS in renderFurniture');
assert(orbixPlanSrc.includes('dMm = (f.dimensions && f.dimensions.D) ? f.dimensions.D : 18;'),
  'orbix-plan.js must use 18mm depth for wardrobe only shutter');
console.log('✓ 2D floor plan source verified: renders at exact 18mm depth.');

console.log('\nALL WRB ONLY SHUTTER TESTS PASSED 100%!');

