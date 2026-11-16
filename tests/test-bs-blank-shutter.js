const assert = require('assert');
const Core = require('../orbix-core.js');

console.log('Testing BS (Blank Shutter) in Ledges / Wall Paneling...');

// 1. Locate BS in FURNITURE_CATALOG
const bs = Core.FURNITURE_CATALOG.find(it => it.id === 'bs-60' || (it.name && it.name.includes('BLANK SHUTTER')));
assert(bs, 'BS (Blank Shutter) must exist in Core.FURNITURE_CATALOG');

console.log('Found Unit:', bs.name, 'ID:', bs.id);
assert.strictEqual(bs.id, 'bs-60');
assert.strictEqual(bs.category, 'wall_paneling');
assert.strictEqual(bs.dimensions.W, 600, 'Width must be 600mm (60)');
assert.strictEqual(bs.dimensions.H, 750, 'Height must be 750mm');
assert.strictEqual(bs.dimensions.D, 18, 'Depth must be 18mm');

console.log('✓ Catalog dimensions: W = 600mm, H = 750mm, D = 18mm');

// 2. Create placement instance
const placed = Core.createFurniturePlacement('bs-60');
assert(placed, 'Must create furniture placement for bs-60');
assert.strictEqual(placed.name, 'BS (BLANK SHUTTER)');
assert.strictEqual(placed.dimensions.W, 600);
assert.strictEqual(placed.dimensions.H, 750);
assert.strictEqual(placed.dimensions.D, 18);

console.log('✓ createFurniturePlacement creates authentic BS unit instance!');

// 3. Test 2D footprint polygon
const poly = Core.getFurniturePolygon(placed);
assert.strictEqual(poly.length, 4, 'Must have 4-vertex rectangle polygon');
const width2d = Math.hypot(poly[1].x - poly[0].x, poly[1].y - poly[0].y);
const depth2d = Math.hypot(poly[2].x - poly[1].x, poly[2].y - poly[1].y);
assert(Math.abs(width2d - 600) < 1, `2D Width must be 600mm, got ${width2d}`);
assert(Math.abs(depth2d - 18) < 1, `2D Depth must be 18mm, got ${depth2d}`);

console.log('✓ 2D polygon footprint is accurately 600mm x 18mm!');

// 4. Test Icon resolution
const icon = Core.getUnitIcon(bs);
assert(icon, 'Unit must have an icon');
console.log('✓ Unit icon resolved cleanly:', typeof icon === 'string');

console.log('\nALL BS (BLANK SHUTTER) TESTS PASSED SUCCESSFULLY!');

