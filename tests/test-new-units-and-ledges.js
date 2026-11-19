const assert = require('assert');
const Core = require('../orbix-core.js');
const Icons = require('../orbix-unit-icons.js');
const PlanEditor = require('../orbix-plan.js');

function getCatalogItem(id) {
  return Core.FURNITURE_CATALOG.find(i => i.id === id || i.code === id);
}

console.log('=== TEST SUITE: New Units & Ledges Fixes ===\n');

// 1. Verify ctvb-60
console.log('1. Verifying ctvb-60 (TV / Crockery Base 600mm)...');
const ctvb60 = getCatalogItem('ctvb-60');
assert(ctvb60, 'ctvb-60 must exist in catalog');
assert.strictEqual(ctvb60.dimensions.W, 600, 'ctvb-60 width must be 600');
assert.strictEqual(ctvb60.dimensions.H, 750, 'ctvb-60 height must be 750');
assert.strictEqual(ctvb60.dimensions.D, 450, 'ctvb-60 depth must be 450');
assert.strictEqual(ctvb60.elevation, 0, 'ctvb-60 floor elevation must be 0');
assert.strictEqual(ctvb60.category, 'crockery', 'ctvb-60 category must be crockery');
console.log('✓ ctvb-60 verified successfully');

// 2. Verify tbm-90
console.log('2. Verifying tbm-90 (TBM 90 Tall Unit)...');
const tbm90 = getCatalogItem('tbm-90');
assert(tbm90, 'tbm-90 must exist in catalog');
assert.strictEqual(tbm90.dimensions.W, 900, 'tbm-90 width must be 900');
assert.strictEqual(tbm90.dimensions.H, 2100, 'tbm-90 height must be 2100');
assert.strictEqual(tbm90.dimensions.D, 550, 'tbm-90 depth must be 550');
assert.strictEqual(tbm90.elevation, 0, 'tbm-90 floor elevation must be 0');
assert.strictEqual(tbm90.unitConfig.shutters, 2, 'tbm-90 shutters must be 2');
assert.strictEqual(tbm90.unitConfig.shelves, 5, 'tbm-90 shelves must be 5');
assert.strictEqual(tbm90.category, 'kitchen_tall', 'tbm-90 category must be kitchen_tall');
console.log('✓ tbm-90 verified successfully');

// 3. Verify ctvw-wm-gl-75 and wm-gl-75
console.log('3. Verifying ctvw-wm-gl-75 (TV / Crockery Wall Glass 750mm)...');
const gl75 = getCatalogItem('ctvw-wm-gl-75') || getCatalogItem('wm-gl-75');
assert(gl75, 'ctvw-wm-gl-75 or wm-gl-75 must exist in catalog');
assert.strictEqual(gl75.dimensions.W, 750, 'gl75 width must be 750');
assert.strictEqual(gl75.dimensions.H, 600, 'gl75 height must be 600');
assert.strictEqual(gl75.dimensions.D, 300, 'gl75 depth must be 300');
assert.strictEqual(gl75.elevation, 1500, 'gl75 wall elevation must be 1500');
assert.strictEqual(gl75.unitConfig.shutters, 2, 'gl75 shutters must be 2');
assert.strictEqual(gl75.unitConfig.dstyle, 'glass', 'gl75 dstyle must be glass');
assert.strictEqual(gl75.category, 'crockery', 'gl75 category must be crockery');
console.log('✓ ctvw-wm-gl-75 verified successfully');

// 4. Verify ctvw-wm-gl-45 and wm-gl-45
console.log('4. Verifying ctvw-wm-gl-45 (TV / Crockery Wall Glass 450mm)...');
const gl45 = getCatalogItem('ctvw-wm-gl-45') || getCatalogItem('wm-gl-45');
assert(gl45, 'ctvw-wm-gl-45 or wm-gl-45 must exist in catalog');
assert.strictEqual(gl45.dimensions.W, 450, 'gl45 width must be 450');
assert.strictEqual(gl45.dimensions.H, 600, 'gl45 height must be 600');
assert.strictEqual(gl45.dimensions.D, 300, 'gl45 depth must be 300');
assert.strictEqual(gl45.elevation, 1500, 'gl45 wall elevation must be 1500');
assert.strictEqual(gl45.unitConfig.shutters, 1, 'gl45 shutters must be 1');
assert.strictEqual(gl45.unitConfig.dstyle, 'glass', 'gl45 dstyle must be glass');
assert.strictEqual(gl45.category, 'crockery', 'gl45 category must be crockery');
console.log('✓ ctvw-wm-gl-45 verified successfully');

// 5. Verify Unit Icon mappings
console.log('5. Verifying unit icons...');
assert(Icons.ICONS['ctvb-60'], 'ctvb-60 icon must exist');
assert(Icons.ICONS['tbm-90'], 'tbm-90 icon must exist');
assert(Icons.ICONS['ctvw-wm-gl-75'], 'ctvw-wm-gl-75 icon must exist');
assert(Icons.ICONS['wm-gl-75'], 'wm-gl-75 icon must exist');
assert(Icons.ICONS['ctvw-wm-gl-45'], 'ctvw-wm-gl-45 icon must exist');
assert(Icons.ICONS['wm-gl-45'], 'wm-gl-45 icon must exist');
console.log('✓ Unit icons verified successfully');

// 6. Verify Ledge Dimensions & Elevations
console.log('6. Verifying Ledges (dimensions and elevations)...');
const ledgeVert = getCatalogItem('ledge-vert');
assert(ledgeVert, 'ledge-vert must exist in catalog');
assert.strictEqual(ledgeVert.dimensions.W, 18, 'ledge-vert W must be 18 (thickness along wall)');
assert.strictEqual(ledgeVert.dimensions.H, 750, 'ledge-vert H must be 750');
assert.strictEqual(ledgeVert.dimensions.D, 550, 'ledge-vert D must be 550 (depth extending into room)');
assert.strictEqual(ledgeVert.elevation, 0, 'ledge-vert elevation must be 0');

const ledgeStd = getCatalogItem('ledge-std');
assert(ledgeStd, 'ledge-std must exist in catalog');
assert.strictEqual(ledgeStd.dimensions.W, 1200, 'ledge-std W must be 1200');
assert.strictEqual(ledgeStd.dimensions.H, 18, 'ledge-std H must be 18');
assert.strictEqual(ledgeStd.dimensions.D, 200, 'ledge-std D must be 200');
assert.strictEqual(ledgeStd.elevation, 1200, 'ledge-std default elevation must be 1200 (wall shelf)');

const ledgeCtop = getCatalogItem('ledge-ctop');
assert(ledgeCtop, 'ledge-ctop must exist in catalog');
assert.strictEqual(ledgeCtop.dimensions.W, 900, 'ledge-ctop W must be 900');
assert.strictEqual(ledgeCtop.dimensions.H, 18, 'ledge-ctop H must be 18');
assert.strictEqual(ledgeCtop.dimensions.D, 550, 'ledge-ctop D must be 550');
assert.strictEqual(ledgeCtop.elevation, 850, 'ledge-ctop default elevation must be 850 (countertop level)');
console.log('✓ Ledge catalog items verified successfully');

// 7. Verify SnapFurniture with Ledges (no ReferenceError and no displacement)
console.log('7. Verifying PlanEditor snapFurniture with ledges...');
const mockEditor = Object.assign(Object.create(PlanEditor.prototype), {
  project: {
    plan: {
      walls: [
        { id: 'w1', start: { x: 0, y: 0 }, end: { x: 3000, y: 0 }, thickness: 150 }
      ],
      rooms: [
        { id: 'r1', polygon: [{ x: 0, y: 0 }, { x: 3000, y: 0 }, { x: 3000, y: 3000 }, { x: 0, y: 3000 }] }
      ],
      furniture: [
        // Existing base cabinet at x=1000, y=350 (flush with wall w1)
        {
          id: 'fm-60-1',
          name: 'FM 60',
          category: 'kitchen_base',
          dimensions: { W: 600, H: 850, D: 550 },
          pos: { x: 1000, y: 350 },
          rotY: 0,
          elevation: 0
        }
      ]
    }
  },
  isShiftDown: false,
  isAltDown: false,
  forceFreePlacement: false
});

// Test snapping ledge-std on the wall directly at x=1000 (centered over the base cabinet)
const candidateLedge = Core.createFurniturePlacement({
  catalogItemId: 'ledge-std',
  name: 'LEDGE',
  category: 'wall_paneling',
  dimensions: { W: 1200, H: 18, D: 200 },
  elevation: 1200,
  pos: { x: 1000, y: 200 }
});

const snapResult = PlanEditor.prototype.snapFurniture.call(
  mockEditor,
  candidateLedge,
  { x: 1000, y: 175 },
  0
);

assert(snapResult, 'snapResult must exist');
assert.strictEqual(snapResult.type, 'wall_snap', 'must snap to wall');
// Ledge center along wall was x=1000. It must NOT be displaced to the end of the wall by the base cabinet!
assert(Math.abs(snapResult.pos.x - 1000) < 5, 'Ledge must remain at x=1000 without being displaced: ' + snapResult.pos.x);
console.log('✓ Ledge snaps to wall without ReferenceError or collision displacement (x = ' + snapResult.pos.x + ')');

// Test placing base cabinet when a ledge exists on the wall
mockEditor.project.plan.furniture.push({
  id: 'ledge-std-1',
  name: 'LEDGE',
  category: 'wall_paneling',
  dimensions: { W: 1200, H: 18, D: 200 },
  pos: { x: 2000, y: 175 },
  rotY: 0,
  elevation: 1200
});

const candidateBase = Core.createFurniturePlacement({
  catalogItemId: 'fm-60',
  name: 'FM 60',
  category: 'kitchen_base',
  dimensions: { W: 600, H: 850, D: 550 },
  elevation: 0,
  pos: { x: 2000, y: 350 }
});

const snapBaseResult = PlanEditor.prototype.snapFurniture.call(
  mockEditor,
  candidateBase,
  { x: 2000, y: 350 },
  0
);

assert(snapBaseResult, 'snapBaseResult must exist');
assert.strictEqual(snapBaseResult.type, 'wall_snap', 'base unit must snap to wall');
assert(Math.abs(snapBaseResult.pos.x - 2000) < 5, 'Base unit must not be displaced by existing ledge: ' + snapBaseResult.pos.x);
console.log('✓ Base unit snaps to wall without being displaced by ledge (x = ' + snapBaseResult.pos.x + ')');

console.log('\n=== ALL TESTS PASSED SUCCESSFULLY! ===');
