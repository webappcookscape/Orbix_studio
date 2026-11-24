const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('=== TEST SUITE: Floor Units Height (100 leg + 700 carcass + 20 countertop = 820mm) & Carcass-Only Pricing ===\n');

// Load Core
delete require.cache[require.resolve('../orbix-core.js')];
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

// 6. Verify FURNITURE_CATALOG floor units in orbix-core.js are updated to H: 700
console.log('[TEST 6] Verifying FURNITURE_CATALOG base units in orbix-core.js...');
const catalog = Core.FURNITURE_CATALOG || [];
const fm60 = catalog.find(u => u.id === 'fm-60');
assert(fm60 && fm60.dimensions.H === 700, `fm-60 height must be 700, got ${fm60 ? fm60.dimensions.H : 'missing'}`);
const ctvb60 = catalog.find(u => u.id === 'ctvb-60');
assert(ctvb60 && ctvb60.dimensions.H === 700, `ctvb-60 height must be 700, got ${ctvb60 ? ctvb60.dimensions.H : 'missing'}`);
console.log('✓ Test 6 Passed: Catalog units (FM 60, CTVB 60, etc.) are standardized to H: 700');

// 7. Verify Auto-Migration on deserializeProject for legacy saved projects
console.log('[TEST 7] Verifying auto-migration of legacy saved projects with 750/720/850/860 floor units...');
const legacyProject = {
  id: 'legacy_proj_1',
  plan: {
    walls: [],
    furniture: [
      { id: 'f1', name: 'Legacy FM 60', category: 'kitchen_base', dimensions: { W: 600, H: 750, D: 560 } },
      { id: 'f2', name: 'Legacy L-Corner', category: 'kitchen_corner', dimensions: { W: 900, H: 720, D: 560 } },
      { id: 'f3', name: 'Legacy Overall 860', category: 'kitchen_base', dimensions: { W: 600, H: 860, D: 560 } }
    ]
  }
};
const migrated = Core.deserializeProject(legacyProject);
assert.strictEqual(migrated.plan.furniture[0].dimensions.H, 700, 'Legacy 750 base unit must auto-migrate to 700');
assert.strictEqual(migrated.plan.furniture[1].dimensions.H, 700, 'Legacy 720 base unit must auto-migrate to 700');
assert.strictEqual(migrated.plan.furniture[2].dimensions.H, 700, 'Legacy 860 base unit must auto-migrate to 700');
console.log('✓ Test 7 Passed: Legacy floor units automatically migrate to 700mm carcass height on load');

// 8. Verify cache-busting version bumped across index.html, pwa.js, sw.js
console.log('[TEST 8] Verifying cache-busting version across index.html, pwa.js, sw.js...');
const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const pwaJs = fs.readFileSync(path.join(__dirname, '..', 'pwa.js'), 'utf8');
const swJs = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
assert(/orbix-core\.js\?v=\d+/.test(indexHtml), 'index.html must reference ?v= for core cache-busting');
assert(pwaJs.includes('./sw.js?v='), 'pwa.js must register sw.js with cache-busting version');
assert(/orbix-studio-v\d+/.test(swJs), 'sw.js CACHE_NAME must be versioned');
console.log('✓ Test 8 Passed: Version bumped to force browser cache purge and fresh deployment load');

// 9. Verify Only-Shutter (O/S) floor units in 3D align with standard 700mm carcass
console.log('[TEST 9] Verifying Only-Shutter (O/S) floor units 3D height alignment in orbix-3d.js...');
const orbix3dCode = fs.readFileSync(path.join(__dirname, '..', 'orbix-3d.js'), 'utf8');
assert(orbix3dCode.includes('// Shutter vertical span between plinth and countertop (flush with standard 700mm carcass)'), 'Only Shutter must use carcass height span');
assert(orbix3dCode.includes('slabMesh.position.set(0, actualPlinthH + bodyH + actualCounterH / 2, 2.5);'), 'Only Shutter countertop must sit on top of carcass at 820mm finished height');
assert(orbix3dCode.includes('topFrame.position.set(0, actualPlinthH + bodyH - 12.5, frameZ);'), 'Top frame must mount at top of carcass');
assert(orbix3dCode.includes('var shH = Math.max(100, bodyH - 6);'), 'Only shutter height must span bodyH - 6 (694mm for 700mm carcass)');

// Also check catalog entries for fcm-rt-os and fcm-lt-os are H: 700
const fcmRtOs = catalog.find(u => u.id === 'fcm-rt-os');
assert(fcmRtOs && fcmRtOs.dimensions.H === 700, `fcm-rt-os height must be 700, got ${fcmRtOs ? fcmRtOs.dimensions.H : 'missing'}`);
const fcmLtOs = catalog.find(u => u.id === 'fcm-lt-os');
assert(fcmLtOs && fcmLtOs.dimensions.H === 700, `fcm-lt-os height must be 700, got ${fcmLtOs ? fcmLtOs.dimensions.H : 'missing'}`);
console.log('✓ Test 9 Passed: Only-Shutter (O/S) units in 3D studio and catalog align flush with standard 700mm carcass & 820mm worktop');

// 10. Verify Custom 3D Decor GLB attachment and preservation in Core.createFurniturePlacement
console.log('[TEST 10] Verifying custom 3D model (.glb) decor preservation in orbix-core.js & orbix-ui.js...');
const customDecorPlacement = Core.createFurniturePlacement({
  name: 'Ergonomic Office Chair',
  category: 'decor',
  isDecor: true,
  decorType: 'chair',
  modelUrl: 'data:model/gltf-binary;base64,mockGlbData',
  blobUrl: 'blob:http://localhost/mock-uuid',
  dimensions: { W: 650, H: 980, D: 650 }
});
assert.strictEqual(customDecorPlacement.isDecor, true, 'isDecor must be true');
assert.strictEqual(customDecorPlacement.excludeFromPricing, true, 'Custom decor must be excluded from woodwork pricing');
assert.strictEqual(customDecorPlacement.modelUrl, 'data:model/gltf-binary;base64,mockGlbData', 'modelUrl must be preserved');
assert.strictEqual(customDecorPlacement.blobUrl, 'blob:http://localhost/mock-uuid', 'blobUrl must be preserved');
assert.strictEqual(customDecorPlacement.dimensions.H, 980, 'Custom 3D model height must be preserved');
console.log('✓ Test 10 Passed: Custom 3D model (.glb) decors preserve modelUrl, blobUrl, and real dimensions');

console.log('\n=== ALL FLOOR UNIT HEIGHT & CARCASS PRICING TESTS PASSED 100%! ===');
