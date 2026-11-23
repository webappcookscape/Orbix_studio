const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('=== TEST SUITE: Floor Units Height (100 leg + 700 carcass + 20 countertop = 820mm) & Carcass-Only Pricing ===\n');

// Load Core
const Core = require('../orbix-core.js');

// 1. Verify Pricing Engine calculates strictly on 700mm Carcass Height in Front Area SFT pricing
console.log('[TEST 1] Testing BOQ / Pricing Engine with floor unit (W: 600, H: 700, D: 550)...');
const floorUnit700 = {
  id: 'unit_test_base_1',
  name: 'Base Unit 600',
  category: 'crockery', // SFT based category
  modelType: 'kitchen_fm',
  tierOverride: 'zappo - el pearl',
  dimensions: { W: 600, H: 700, D: 550 }
};

const cost700 = Core.calculateItemCost(floorUnit700);
const expectedSft = (600 * 700) / 92903.04; // 4.520846...
assert(Math.abs(cost700.areaSft - expectedSft) < 0.001, `Area SFT must be based on 700mm carcass (${expectedSft.toFixed(2)} SFT), got ${cost700.areaSft}`);
assert(cost700.formulaDescription.includes('700 mm'), 'Formula description must state 700 mm Carcass height');
console.log(`✓ Test 1 Passed: Base unit area = ${cost700.areaSft.toFixed(2)} SFT based strictly on 700mm carcass`);

// 2. Verify unit specified with 820mm total height also calculates strictly on 700mm carcass
console.log('[TEST 2] Testing BOQ with floor unit having total finished height H: 820mm...');
const floorUnit820 = {
  id: 'unit_test_base_2',
  name: 'Base Unit 600 (Overall 820)',
  category: 'base',
  tierOverride: 'zappo - el pearl',
  dimensions: { W: 600, H: 820, D: 550 }
};

const cost820 = Core.calculateItemCost(floorUnit820);
assert(Math.abs(cost820.areaSft - expectedSft) < 0.001, `Even with H:820, pricing must deduct legs and stone to use 700mm carcass, got ${cost820.areaSft}`);
console.log(`✓ Test 2 Passed: Unit with H:820mm correctly charges for 700mm carcass only (${cost820.areaSft.toFixed(2)} SFT)`);

// 3. Verify orbix-3d.js parameters (counterH = 20, plinthH = 100, bodyH = 700, total = 820mm)
console.log('[TEST 3] Verifying 3D Engine parameters in orbix-3d.js...');
const orbix3dJs = fs.readFileSync(path.join(__dirname, '..', 'orbix-3d.js'), 'utf8');
assert(orbix3dJs.includes('counterH = (isBase && counterColorName !== \'none\') ? 20 : 0;'), 'Countertop stone thickness must be 20mm');
assert(orbix3dJs.includes('Countertop Stone (20mm Stone, counterH = 20)'), 'L-corner countertop must be 20mm');
assert(orbix3dJs.includes('// Floor unit: Carcass height is 700mm. Total finished height = 100mm leg + 700mm carcass + 20mm countertop = 820mm'), '3D engine must document 100+700+20=820mm stack');
console.log('✓ Test 3 Passed: orbix-3d.js configures 20mm countertop and 820mm finished worktop elevation');

// 4. Verify app.js parameters
console.log('[TEST 4] Verifying app.js countertop & default base height...');
const appJs = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
assert(appJs.includes('{ id: "kbase", label: "Kitchen base run", set: { type: "hinged", H: 700'), 'kbase default carcass height must be 700');
assert(appJs.includes('h: 20, d: u.D + 30, mat: "stone:"'), 'app.js countertop box height must be 20');
console.log('✓ Test 4 Passed: app.js uses 700mm carcass height and 20mm stone thickness');

// 5. Verify orbix-ui.js defaults
console.log('[TEST 5] Verifying orbix-ui.js defaults...');
const uiJs = fs.readFileSync(path.join(__dirname, '..', 'orbix-ui.js'), 'utf8');
assert(uiJs.includes('isWall ? 600 : isKitchen ? 700'), 'Kitchen base unit default height must be 700');
assert(uiJs.includes('Counter (820 mm)'), 'Countertop preset button must display 820 mm');
assert(uiJs.includes('fn.elevation = 820;'), 'Countertop preset click sets elevation to 820mm');
console.log('✓ Test 5 Passed: orbix-ui.js defaults floor cabinets to 700mm carcass and counter elevation to 820mm');

console.log('\n=== ALL FLOOR UNIT HEIGHT & CARCASS PRICING TESTS PASSED 100%! ===');
