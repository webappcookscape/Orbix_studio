const assert = require('assert');
const Core = require('../orbix-core.js');

console.log('--- TEST: Default Shutter 7707 and Carcass 6601 ---');

// 1. Catalog default finishes
Core.FURNITURE_CATALOG.forEach(unit => {
  if (unit.materials && unit.materials.shutter && unit.materials.shutter.finish !== 'none') {
    assert.strictEqual(unit.materials.shutter.finish, 'MDF 7707', `Unit ${unit.id} shutter finish must be MDF 7707`);
  }
  if (unit.materials && unit.materials.carcass && unit.materials.carcass.finish !== 'none') {
    assert.strictEqual(unit.materials.carcass.finish, 'MDF 6601', `Unit ${unit.id} carcass finish must be MDF 6601`);
  }
  if (unit.unitConfig) {
    if (unit.unitConfig.shutterCol && unit.unitConfig.shutterCol !== 'none') {
      assert.strictEqual(unit.unitConfig.shutterCol, 'MDF 7707', `Unit ${unit.id} unitConfig.shutterCol must be MDF 7707`);
    }
    if (unit.unitConfig.carcass && unit.unitConfig.carcass !== 'none') {
      assert.strictEqual(unit.unitConfig.carcass, 'MDF 6601', `Unit ${unit.id} unitConfig.carcass must be MDF 6601`);
    }
  }
});
console.log('✓ All catalog units have default Shutter: MDF 7707 and Carcass: MDF 6601');

// 2. Default furniture placement
const placed1 = Core.createFurniturePlacement({
  name: 'Base Unit Test',
  category: 'kitchen_base'
});
assert.strictEqual(placed1.materials.shutter.finish, 'MDF 7707');
assert.strictEqual(placed1.materials.carcass.finish, 'MDF 6601');
assert.strictEqual(placed1.unitConfig.shutterCol, 'MDF 7707');
assert.strictEqual(placed1.unitConfig.carcass, 'MDF 6601');
console.log('✓ createFurniturePlacement creates unit with MDF 7707 shutter and MDF 6601 carcass');

// 3. Color hex values
assert.strictEqual(Core.toValidHexColor('MDF 7707').toLowerCase(), '#2e3f5c');
assert.strictEqual(Core.toValidHexColor('Navy Blue Matte').toLowerCase(), '#2e3f5c');
assert.strictEqual(Core.toValidHexColor('MDF 6601').toLowerCase(), '#f4f3ef');
assert.strictEqual(Core.toValidHexColor('Gloss White').toLowerCase(), '#f4f3ef');
console.log('✓ toValidHexColor maps 7707 -> #2e3f5c and 6601 -> #f4f3ef');

console.log('🎉 ALL DEFAULT FINISH TESTS PASSED! 🎉');
