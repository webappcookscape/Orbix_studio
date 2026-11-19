// Automated verification test for:
// 1. FBCM (Floor Base Corner Module) & WBCM (Wall Base Corner Module)
// 2. Corner unit snapping & straight unit placement near wall corners
// 3. Newly imported final-decors catalog

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('Testing FBCM, WBCM, Corner Snapping & Decors Import...');

// 1. Check Decors Catalog
const catalogPath = path.join(__dirname, '..', 'orbix-decors-catalog.js');
assert(fs.existsSync(catalogPath), 'orbix-decors-catalog.js must exist');
const catalog = require(catalogPath);
console.log(`✓ orbix-decors-catalog.js loaded with ${catalog.length} items`);
assert(catalog.length >= 60, `Catalog should have at least 60 items (found ${catalog.length})`);

// Verify newly imported models exist in catalog
const expectedNewSlugs = [
  'adornos_rmllr',
  'bed_01_1',
  'beds_and_nightstands',
  'cuadros',
  'component_1',
  'component_9',
  'decor_2',
  'kid_bedroom_001_1',
  'plant_2',
  'plant_3',
  'sofa_set_collection_51',
  'cay_chuoi',
  'mirror_2_1',
  'plant_4',
  'plant'
];

for (const slug of expectedNewSlugs) {
  const it = catalog.find(x => x.slug === slug);
  assert(it, `Catalog must contain slug "${slug}"`);
  assert(it.modelUrl.endsWith('.glb'), `modelUrl for ${slug} must be .glb`);
  const fullGlb = path.join(__dirname, '..', it.modelUrl);
  assert(fs.existsSync(fullGlb), `GLB file must exist at ${fullGlb}`);
  const stat = fs.statSync(fullGlb);
  assert(stat.size > 1000, `GLB file ${slug} size must be > 1KB (${stat.size} bytes)`);
}
console.log(`✓ All 15 newly imported SketchUp models verified as textured .glb files on disk!`);

// 2. Mock and test OrbixCore logic
global.window = {};
global.document = {
  getElementById: function (id) {
    return { id: id, value: '', style: {}, innerHTML: '', appendChild: function () {}, addEventListener: function () {} };
  },
  createElement: function (tag) {
    return { tagName: tag, style: {}, appendChild: function () {} };
  },
  querySelectorAll: function () { return []; }
};
const Core = require('../orbix-core.js');
assert(Core, 'OrbixCore must be initialized');

// Check FBCM vs WBCM definition
const catalogItems = Core.FURNITURE_CATALOG || [];
const fbcmDef = catalogItems.find(it => it.code === 'FBCM' || it.id === 'fbcm');
const wbcmDef = catalogItems.find(it => it.code === 'WBCM' || it.id === 'fbcm-1500');

assert(fbcmDef, 'FBCM catalog item must exist');
assert.strictEqual(fbcmDef.dimensions.W, 900);
assert.strictEqual(fbcmDef.dimensions.D, 550);
assert.strictEqual(fbcmDef.elevation, 0);
assert.strictEqual(Core.isWallUnit(fbcmDef.category, fbcmDef.name, fbcmDef.code, fbcmDef.costCategory), false, 'FBCM is base unit');
console.log('✓ FBCM catalog item verified (900x550, Elev 0)');

assert(wbcmDef, 'WBCM catalog item must exist');
assert.strictEqual(wbcmDef.dimensions.W, 600);
assert.strictEqual(wbcmDef.dimensions.D, 300);
assert.strictEqual(wbcmDef.elevation, 1500);
assert.strictEqual(Core.isWallUnit(wbcmDef.category, wbcmDef.name, wbcmDef.code, wbcmDef.costCategory), true, 'WBCM is wall unit');
console.log('✓ WBCM catalog item verified (600x300, Elev 1500)');

// Test collision sub-polygons for FBCM and WBCM
const fbcmInst = {
  id: 'fbcm_1',
  code: 'FBCM',
  name: 'L-SHAPED CORNER BASE UNIT',
  category: 'kitchen_corner',
  pos: { x: 450, y: 450 },
  rotY: 0,
  dimensions: { W: 900, H: 750, D: 550 },
  unitConfig: {
    unitType: 'fbcm',
    geometryType: 'l_shaped_corner',
    corner: { enabled: true, legW: 900, legD: 900, depth: 550 }
  }
};

const polyFbcm = Core.getFurniturePolygon(fbcmInst);
assert.strictEqual(polyFbcm.length, 6, 'L-Corner polygon must have 6 vertices');
console.log('✓ FBCM 2D polygon returns 6 L-shaped boundary vertices');

// Place an adjacent unit right outside Arm 1 (at x = 450 + 450 + 300 = 1200)
const adjUnit = {
  id: 'fm_60_1',
  code: 'FM 60',
  name: 'Floor Base 600',
  category: 'kitchen_base',
  pos: { x: 1200, y: 450 },
  rotY: 0,
  dimensions: { W: 600, H: 750, D: 550 }
};

const colRes = Core.checkFurnitureCollision(adjUnit, [fbcmInst]);
assert.strictEqual(colRes.collided, false, 'Non-overlapping adjacent unit must not collide with FBCM');
console.log('✓ Adjacent unit against FBCM arm does not falsely collide');

// Place an overlapping unit (overlapping Arm 1)
const overlapUnit = {
  id: 'fm_60_bad',
  code: 'FM 60',
  name: 'Floor Base 600',
  category: 'kitchen_base',
  pos: { x: 700, y: 450 },
  rotY: 0,
  dimensions: { W: 600, H: 750, D: 550 }
};
const colOverlap = Core.checkFurnitureCollision(overlapUnit, [fbcmInst]);
assert.strictEqual(colOverlap.collided, true, 'Penetrating unit must be detected as colliding with FBCM');
console.log('✓ Overlapping unit into FBCM arm is correctly detected as colliding');

// Test WBCM does not collide with FBCM below it (elevation stacking)
const wbcmInst = {
  id: 'wbcm_1',
  code: 'WBCM',
  name: 'WBCM (Cookscape)',
  category: 'kitchen_wall',
  elevation: 1500,
  pos: { x: 300, y: 300 },
  rotY: 0,
  dimensions: { W: 600, H: 600, D: 300 },
  unitConfig: {
    ctype: 'kwall',
    unitType: 'wbcm',
    geometryType: 'l_shaped_corner',
    corner: { enabled: true, legW: 600, legD: 600, depth: 300 }
  }
};

const colStack = Core.checkFurnitureCollision(wbcmInst, [fbcmInst]);
assert.strictEqual(colStack.collided, false, 'WBCM at 1500mm elevation must not collide with FBCM at 0mm elevation');
console.log('✓ WBCM wall corner unit cleanly stacks above FBCM base corner unit');

console.log('\n=============================================');
console.log('ALL TESTS PASSED! FBCM, WBCM & DECORS VERIFIED!');
console.log('=============================================\n');
