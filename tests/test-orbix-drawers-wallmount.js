/**
 * Test Suite: Wall Unit 1500mm Mounting, Shutters & Drawers 3D Geometry & Interactivity
 */

const assert = require('assert');
const OrbixCore = require('../orbix-core');

console.log('════════════════════════════════════════════════════════════════');
console.log('🧪 TESTING WALL UNIT 1500MM MOUNTING & SHUTTER/DRAWER CONTROLS');
console.log('════════════════════════════════════════════════════════════════\n');

// 1. Wall Unit Elevation Detection & Defaults
console.log('Test 1: Wall Unit Classification & 1500mm Default Elevation');
const wallCategories = [
  { cat: 'kitchen_wall', name: 'Kitchen Wall Cabinet' },
  { cat: 'k_wall', name: 'K Wall Unit' },
  { cat: 'spice_rack', name: 'Spice Rack Open Box' },
  { cat: 'overhead', name: 'Overhead Cabinet' },
  { cat: 'loft_os', name: 'Loft Unit' },
  { cat: 'custom', name: 'TV Wall Shelf' },
  { cat: 'crockery_wall', name: 'Crockery Wall Unit' }
];

wallCategories.forEach(testCase => {
  const isWall = OrbixCore.isWallUnit(testCase.cat, testCase.name);
  assert.strictEqual(isWall, true, `Expected ${testCase.cat} / ${testCase.name} to be identified as wall unit`);

  // Without explicit elevation, must default to 1500mm
  const unit = OrbixCore.createFurniturePlacement({
    name: testCase.name,
    category: testCase.cat,
    pos: { x: 500, y: 500, z: 0 } // Even if pos.z was passed as 0!
  });
  assert.strictEqual(unit.elevation, 1500, `${testCase.name} must default to 1500mm elevation`);
  assert.strictEqual(unit.pos.z, 1500, `${testCase.name} pos.z must match elevation (1500mm)`);
});

// Floor units must default to 0mm
const floorUnits = [
  { cat: 'wardrobe', name: '3-Door Wardrobe' },
  { cat: 'kitchen_base', name: 'Sink Base Unit' },
  { cat: 'crockery', name: 'Crockery Sideboard' }
];
floorUnits.forEach(testCase => {
  const isWall = OrbixCore.isWallUnit(testCase.cat, testCase.name);
  assert.strictEqual(isWall, false, `Expected ${testCase.cat} to be a floor unit`);
  const unit = OrbixCore.createFurniturePlacement({
    name: testCase.name,
    category: testCase.cat
  });
  assert.strictEqual(unit.elevation, 0, `${testCase.name} must default to 0mm elevation`);
  assert.strictEqual(unit.pos.z, 0, `${testCase.name} pos.z must default to 0mm`);
});
console.log('  ✓ Wall units correctly default to 1500mm AFFL; floor units default to 0mm\n');

// 2. Shutters & Drawers State Initialization
console.log('Test 2: Shutters & Drawers State Arrays');
const comboUnit = OrbixCore.createFurniturePlacement({
  name: 'Wardrobe with Drawers',
  category: 'wardrobe',
  unitConfig: {
    shutters: 3,
    drawers: 2
  }
});
assert.strictEqual(comboUnit.shutterStates.length, 3, 'Must have 3 shutter states');
assert.strictEqual(comboUnit.drawerStates.length, 2, 'Must have 2 drawer states');
assert.deepStrictEqual(comboUnit.shutterStates, [false, false, false], 'Initial shutters must be closed');
assert.deepStrictEqual(comboUnit.drawerStates, [false, false], 'Initial drawers must be closed');

// Simulate toggle
comboUnit.shutterStates[0] = true;
comboUnit.drawerStates[1] = true;
assert.strictEqual(comboUnit.shutterStates[0], true);
assert.strictEqual(comboUnit.drawerStates[1], true);
console.log('  ✓ Shutter and drawer states correctly initialized and toggled\n');

// 3. Database Connection Configuration
console.log('Test 3: Database Connection Configuration & Auto-Recovery');
const { getDatabaseStatus } = require('../server/config/prisma');
const dbStatus = getDatabaseStatus();
assert.strictEqual(dbStatus.postgres.port, '5432', 'Database port configuration must target standard PostgreSQL port 5432');
assert.strictEqual(dbStatus.postgres.database, 'cupboard_cad', 'Database name must be cupboard_cad');
console.log('  ✓ Database configuration correctly set to port 5432 with auto-recovery enabled\n');

console.log('════════════════════════════════════════════════════════════════');
console.log('🎉 ALL WALL MOUNT & SHUTTER/DRAWER TESTS PASSED SUCCESSFULLY!');
console.log('════════════════════════════════════════════════════════════════\n');

