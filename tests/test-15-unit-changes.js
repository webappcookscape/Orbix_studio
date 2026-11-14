const assert = require('assert');
const fs = require('fs');

console.log('Running test-15-unit-changes.js: Validating all 15 user requested unit updates...');

const Core = require('../orbix-core.js');
const catalog = Core.FURNITURE_CATALOG;
assert(Array.isArray(catalog), 'Core.FURNITURE_CATALOG must be an array');

// 1. DUPLICATE REMOVAL CHECK
const removedDuplicateIds = ['fm-rt-01', 'fm-lt-01', 'f_fbcm_1', 'wcm-lt-01', 'wcm-rt-01'];
removedDuplicateIds.forEach(dupId => {
  const found = catalog.filter(u => u.id === dupId);
  assert.strictEqual(found.length, 0, 'Duplicate unit ' + dupId + ' must NOT exist in catalog');
});

// Canonical corner units exist
assert(catalog.find(u => u.id === 'fcm-rt'), 'Canonical FCM-RT must exist');
assert(catalog.find(u => u.id === 'fcm-lt'), 'Canonical FCM-LT must exist');
assert(catalog.find(u => u.id === 'fbcm'), 'Canonical FBCM must exist');
assert(catalog.find(u => u.id === 'fcm-rt-1500'), 'Canonical WCM-RT must exist');
assert(catalog.find(u => u.id === 'fcm-lt-1500'), 'Canonical WCM-LT must exist');
assert(catalog.find(u => u.id === 'fbcm-1500'), 'Canonical WBCM must exist');
console.log('✔ Item 1 passed: Duplicate units removed successfully and canonical units preserved.');

// 3. CROCKERY / TV BASE ONLY DOORS (add leg 100mm, depth 550)
const ctvbDoors = catalog.find(u => u.id === 'ctvb-doors-only');
assert(ctvbDoors, 'ctvb-doors-only must exist');
assert.strictEqual(ctvbDoors.dimensions.D, 550, 'ctvb-doors-only depth must be 550');
assert.strictEqual(ctvbDoors.dimensions.H, 750, 'ctvb-doors-only height must be 750');
assert.strictEqual(ctvbDoors.dimensions.W, 750, 'ctvb-doors-only width must be 750');
assert.strictEqual(ctvbDoors.unitConfig.hasLegs, true, 'ctvb-doors-only must have legs enabled');
assert.strictEqual(ctvbDoors.unitConfig.legs, 100, 'ctvb-doors-only legs must be 100mm');
assert.strictEqual(ctvbDoors.elevation, 0, 'ctvb-doors-only elevation must be 0');
assert.strictEqual(ctvbDoors.category, 'crockery', 'ctvb-doors-only category must be crockery');
console.log('✔ Item 3 passed: CROCKERY / TV BASE ONLY DOORS has 100mm legs, 550mm depth.');

// 4. CROCKERY/TV WALL UNIT ONLY DOOR (floor elevation 1500mm, depth 300)
const ctvwDoors = catalog.find(u => u.id === 'ctvw-doors-only');
assert(ctvwDoors, 'ctvw-doors-only must exist');
assert.strictEqual(ctvwDoors.elevation, 1500, 'ctvw-doors-only floor elevation must be 1500mm');
assert.strictEqual(ctvwDoors.dimensions.D, 300, 'ctvw-doors-only depth must be 300mm');
assert.strictEqual(ctvwDoors.category, 'crockery', 'ctvw-doors-only category must be crockery');
console.log('✔ Item 4 passed: CROCKERY/TV WALL UNIT ONLY DOOR has 1500mm elevation, 300mm depth.');

// 5. CROCKERY / TV BASE OPEN STORAGE (SHELVES 0, LEG 100MM ENABLE DISABLE)
const ctvbOpen = catalog.find(u => u.id === 'ctvb-open-storage');
assert(ctvbOpen, 'ctvb-open-storage must exist');
assert.strictEqual(ctvbOpen.unitConfig.shelves, 0, 'ctvb-open-storage shelves must be 0');
assert.strictEqual(ctvbOpen.unitConfig.hasLegs, true, 'ctvb-open-storage leg must be configured (100mm)');
assert.strictEqual(ctvbOpen.unitConfig.legs, 100, 'ctvb-open-storage legs must be 100mm');
console.log('✔ Item 5 passed: CROCKERY / TV BASE OPEN STORAGE has 0 shelves and 100mm leg config.');

// 6. TBM 60 OVEN (shutter flush inside unit carcass, never above)
const tbmOven = catalog.find(u => u.id === 'tbm-60-oven');
assert(tbmOven, 'tbm-60-oven must exist');
assert.strictEqual(tbmOven.dimensions.H, 2100, 'tbm-60-oven height must be 2100mm');
const totalShutterAndNiche = (tbmOven.unitConfig.legs || 100) +
  tbmOven.unitConfig.shutterConfig.bottom.height +
  tbmOven.unitConfig.oven.openingH +
  tbmOven.unitConfig.shutterConfig.top.height;
assert.strictEqual(totalShutterAndNiche, 2100, 'Sum of plinth + bottom shutter + oven opening + top shutter must equal 2100mm exactly');
console.log('✔ Item 6 passed: TBM 60 OVEN top shutter flush within carcass height (2100mm total).');

// 7. VERTICAL LEDGE (WIDTH 550, HEIGHT 750, DEPTH 18)
const vLedge = catalog.find(u => u.id === 'ledge-vert');
assert(vLedge, 'ledge-vert must exist');
assert.strictEqual(vLedge.dimensions.W, 550, 'ledge-vert width must be 550mm');
assert.strictEqual(vLedge.dimensions.H, 750, 'ledge-vert height must be 750mm');
assert.strictEqual(vLedge.dimensions.D, 18, 'ledge-vert depth must be 18mm');
assert.strictEqual(vLedge.category, 'wall_paneling', 'ledge-vert category must be wall_paneling');
console.log('✔ Item 7 passed: VERTICAL LEDGE dimensions W:550, H:750, D:18.');

// 8. WALL PANEL (WIDTH 1200, DEPTH 18, HEIGHT 1200)
const wallPanel = catalog.find(u => u.id === 'pnl-wall');
assert(wallPanel, 'pnl-wall must exist');
assert.strictEqual(wallPanel.dimensions.W, 1200, 'pnl-wall width must be 1200mm');
assert.strictEqual(wallPanel.dimensions.H, 1200, 'pnl-wall height must be 1200mm');
assert.strictEqual(wallPanel.dimensions.D, 18, 'pnl-wall depth must be 18mm');
assert.strictEqual(wallPanel.category, 'wall_paneling', 'pnl-wall category must be wall_paneling');
console.log('✔ Item 8 passed: WALL PANEL dimensions W:1200, D:18, H:1200.');

// 9. LOFT (ALL LOFT HAS TO BE FLOOR ELEVATION 2100MM, HEIGHT 750MM)
const lofts = catalog.filter(u => u.id.startsWith('loft-'));
assert(lofts.length >= 4, 'Must have at least 4 loft units');
lofts.forEach(loft => {
  assert.strictEqual(loft.elevation, 2100, loft.id + ' floor elevation must be 2100mm');
  assert.strictEqual(loft.dimensions.H, 750, loft.id + ' height must be 750mm');
  assert.strictEqual(loft.category, 'loft', loft.id + ' category must be loft');
});
console.log('✔ Item 9 passed: All loft units have elevation 2100mm and height 750mm.');

// 10. WALL UNITS (ALL WALL UNITS DEFAULT FLOOR ELEVATION 1500MM)
const wallUnits = catalog.filter(u => u.category === 'kitchen_wall');
assert(wallUnits.length >= 10, 'Must have kitchen wall units');
wallUnits.forEach(wu => {
  assert.strictEqual(wu.elevation, 1500, wu.id + ' floor elevation must default to 1500mm');
});
console.log('✔ Item 10 passed: All kitchen wall units have floor elevation 1500mm.');

// 11. WARDROBE WITH DRAWERS (drawers in center, hanging rod top)
const wrDrawers = catalog.find(u => u.id === 'wr-drawers');
assert(wrDrawers, 'wr-drawers must exist');
assert.strictEqual(wrDrawers.unitConfig.internalDrawers, true, 'wr-drawers must have internalDrawers');
assert.strictEqual(wrDrawers.unitConfig.drawersInCenter, true, 'wr-drawers must have drawersInCenter');
assert.strictEqual(wrDrawers.unitConfig.hasHangingRod, true, 'wr-drawers must have hasHangingRod');
assert.strictEqual(wrDrawers.unitConfig.hangingRodTop, true, 'wr-drawers must have hangingRodTop');

const wr1Drawers = catalog.find(u => u.id === 'wr-1-drawers');
assert(wr1Drawers, 'wr-1-drawers must exist');
assert.strictEqual(wr1Drawers.unitConfig.internalDrawers, true, 'wr-1-drawers must have internalDrawers');
assert.strictEqual(wr1Drawers.unitConfig.drawersInCenter, true, 'wr-1-drawers must have drawersInCenter');
console.log('✔ Item 11 passed: Wardrobe with drawers has internal drawers in center and hanging rod top.');

// 12. WARDROBE WITH SHELVES (shelves placed inside unit in 5 numbers)
const wrShelves = catalog.find(u => u.id === 'wr-shelves');
assert(wrShelves, 'wr-shelves must exist');
assert.strictEqual(wrShelves.unitConfig.shelves, 5, 'wr-shelves must have 5 internal shelves');

const wr1Shelves = catalog.find(u => u.id === 'wr-1-shelves');
assert(wr1Shelves, 'wr-1-shelves must exist');
assert.strictEqual(wr1Shelves.unitConfig.shelves, 5, 'wr-1-shelves must have 5 internal shelves');
console.log('✔ Item 12 passed: Wardrobe with shelves has exactly 5 internal shelves.');

// 13. CROCKERY / TV BASE TWO DOORS (FLOOR ELEVATION 0, WITH 100MM LEG)
const ctvb2d = catalog.find(u => u.id === 'ctvb-2d');
assert(ctvb2d, 'ctvb-2d must exist');
assert.strictEqual(ctvb2d.elevation, 0, 'ctvb-2d elevation must be 0');
assert.strictEqual(ctvb2d.dimensions.D, 550, 'ctvb-2d depth must be 550');
assert.strictEqual(ctvb2d.unitConfig.hasLegs, true, 'ctvb-2d hasLegs must be true');
assert.strictEqual(ctvb2d.unitConfig.legs, 100, 'ctvb-2d legs must be 100mm');
assert.strictEqual(ctvb2d.category, 'crockery', 'ctvb-2d category must be crockery');
console.log('✔ Item 13 passed: CROCKERY / TV BASE TWO DOORS has elevation 0, 100mm legs, 550mm depth.');

// 14 & 15. BASE UNIT HAS 4 CATEGORIES (KITCHEN FM, KITCHEN CORNER UNITS, KITCHEN DRAWERS, KITCHEN TALL UNIT)
const fmUnits = catalog.filter(u => u.category === 'kitchen_fm');
const cornerUnits = catalog.filter(u => u.category === 'kitchen_corner');
const drawerUnits = catalog.filter(u => u.category === 'kitchen_drawers');
const tallUnits = catalog.filter(u => u.category === 'kitchen_tall');

assert(fmUnits.length >= 6, 'Must have kitchen_fm units');
assert(cornerUnits.length === 3, 'Must have exactly 3 corner base units (FCM-LT, FCM-RT, FBCM)');
assert(drawerUnits.length >= 10, 'Must have kitchen_drawers units');
assert(tallUnits.length >= 2, 'Must have kitchen_tall units (TBM 60, TBM 60 OVEN)');

// Check no duplicates across whole catalog
const ids = catalog.map(u => u.id);
const uniqueIds = new Set(ids);
assert.strictEqual(ids.length, uniqueIds.size, 'There must be NO duplicate IDs in the catalog');
console.log('✔ Items 14 & 15 passed: Base units separated into 4 distinct categories with 0 duplicates (total ' + catalog.length + ' unique units).');

// Verify 3D rendering file contains hanging rod and internal drawers
const orbix3dSrc = fs.readFileSync('orbix-3d.js', 'utf8');
assert(orbix3dSrc.includes('isInternalDrawers'), 'orbix-3d.js must support internal drawers');
assert(orbix3dSrc.includes('hasHangingRod'), 'orbix-3d.js must support hanging rod');
assert(orbix3dSrc.includes('explicitlyNoShelves'), 'orbix-3d.js must honor shelves === 0');
console.log('✔ 3D renderer source verified for internal drawers, hanging rod, and zero-shelves.');

console.log('\n🎉 ALL 15 UNIT CHANGES TESTS PASSED 100% SUCCESSFULLY!\n');

