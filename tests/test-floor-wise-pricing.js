// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — Tests for Floor-Wise Pricing & Pure Modular Woodwork Guarantee
// ═══════════════════════════════════════════════════════════════════════════════

const assert = require('assert');
const Core = require('../orbix-core');

console.log('--- TEST SUITE: Floor-Wise Pricing & Pure Modular Woodwork ---');

// Mock Multi-Floor Project with Ground Floor and First Floor
const testProject = {
  id: 'proj_multi_floor',
  name: 'Luxury Villa Multi-Floor Project',
  plan: {
    walls: [
      { id: 'w1', start: { x: 0, y: 0 }, end: { x: 5000, y: 0 } },
      { id: 'w2', start: { x: 5000, y: 0 }, end: { x: 5000, y: 4000 } },
      { id: 'w3', start: { x: 5000, y: 4000 }, end: { x: 0, y: 4000 } },
      { id: 'w4', start: { x: 0, y: 4000 }, end: { x: 0, y: 0 } }
    ],
    rooms: [
      {
        id: 'rm_kitchen_gf',
        name: 'Kitchen (Ground)',
        type: 'kitchen',
        floorId: 'ground',
        polygon: [{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 4000 }, { x: 0, y: 4000 }],
        flooring: { enabled: true, material: 'Italian Marble', ratePerSft: 250 },
        ceiling: { enabled: true, type: 'POP Gypsum Cove', ratePerSft: 180 }
      },
      {
        id: 'rm_master_ff',
        name: 'Master Bedroom (First Floor)',
        type: 'bedroom',
        floorId: 'floor_1',
        polygon: [{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 4000 }, { x: 0, y: 4000 }],
        flooring: { enabled: true, material: 'Wooden Planks', ratePerSft: 300 },
        ceiling: { enabled: true, type: 'Wooden False Ceiling', ratePerSft: 220 }
      }
    ],
    floors: [
      { id: 'ground', name: 'Ground Floor', level: 0 },
      { id: 'floor_1', name: 'First Floor', level: 1 }
    ],
    activeFloorId: 'ground',
    // Units directly placed per floor
    floorsData: {
      ground: {
        furnitureUnits: [
          {
            id: 'unit_gf_1',
            name: 'Base 2-Door Cabinet (FM600)',
            modelType: 'FM600',
            category: 'Kitchen Base',
            width: 600,
            height: 870,
            depth: 560,
            x: 1000,
            y: 1000,
            floorId: 'ground',
            materials: {
              carcass: { material: 'BWP_18MM', finish: 'White' },
              shutter: { material: 'HDHMR_18MM', finish: 'Gloss Acrylic' }
            }
          },
          {
            id: 'unit_gf_2',
            name: 'Wall Glass Cabinet (WM600)',
            modelType: 'WM600',
            category: 'Kitchen Wall',
            width: 600,
            height: 720,
            depth: 350,
            x: 1800,
            y: 1000,
            floorId: 'ground',
            materials: {
              carcass: { material: 'BWP_18MM', finish: 'White' },
              shutter: { material: 'HDHMR_18MM', finish: 'Fluted Glass' }
            }
          }
        ]
      },
      floor_1: {
        furnitureUnits: [
          {
            id: 'unit_ff_1',
            name: 'Master Hinged Wardrobe 2D',
            modelType: 'WRB_2D',
            category: 'Wardrobe',
            width: 1200,
            height: 2100,
            depth: 600,
            x: 2000,
            y: 2000,
            floorId: 'floor_1',
            materials: {
              carcass: { material: 'BWP_18MM', finish: 'Linen Fabric' },
              shutter: { material: 'HDHMR_18MM', finish: 'Matt PU Sage Green' }
            }
          },
          {
            id: 'unit_ff_2',
            name: 'Floating Study Desk & Bookcase',
            modelType: 'STUDY_DESK_1200',
            category: 'Study Unit',
            width: 1200,
            height: 1800,
            depth: 450,
            x: 3500,
            y: 2000,
            floorId: 'floor_1',
            materials: {
              carcass: { material: 'BWP_18MM', finish: 'Oak Woodgrain' },
              shutter: { material: 'HDHMR_18MM', finish: 'Oak Woodgrain' }
            }
          }
        ]
      }
    }
  }
};

// ── TEST 1: Full Quotation Across All Floors ('all') ──
console.log('1. Testing Full Quotation across all floors (Whole Villa Scope)...');
const fullQuote = Core.generateFullQuotation(testProject, ['all'], 'all');

assert.ok(fullQuote, 'Quotation object must be generated');
assert.strictEqual(fullQuote.selectedFloorId, 'all', 'Selected floor ID must be "all"');
assert.strictEqual(fullQuote.isFloorFiltered, false, 'isFloorFiltered should be false for all floors');
assert.strictEqual(fullQuote.items.length, 4, 'Must aggregate exactly 4 modular units across both floors');

// Verify floor summary structure
assert.ok(Array.isArray(fullQuote.allFloorsSummary), 'allFloorsSummary must be an array');
assert.strictEqual(fullQuote.allFloorsSummary.length, 2, 'Must have summary entries for Ground Floor and First Floor');

const gfSummary = fullQuote.allFloorsSummary.find(f => f.id === 'ground');
const ffSummary = fullQuote.allFloorsSummary.find(f => f.id === 'floor_1');

assert.ok(gfSummary, 'Ground Floor summary must exist');
assert.ok(ffSummary, 'First Floor summary must exist');
assert.strictEqual(gfSummary.itemCount, 2, 'Ground Floor must have 2 modular units');
assert.strictEqual(ffSummary.itemCount, 2, 'First Floor must have 2 modular units');
assert.ok(gfSummary.woodworkSubtotal > 0, 'Ground Floor woodwork subtotal must be greater than 0');
assert.ok(ffSummary.woodworkSubtotal > 0, 'First Floor woodwork subtotal must be greater than 0');

// Verify math integrity
const sumOfFloors = gfSummary.woodworkSubtotal + ffSummary.woodworkSubtotal;
assert.strictEqual(Math.round(fullQuote.subtotalWoodwork), Math.round(sumOfFloors), 'subtotalWoodwork must equal sum of floor woodwork subtotals');
console.log(`✓ Whole Villa Modular Woodwork Subtotal: ₹${Math.round(fullQuote.subtotalWoodwork).toLocaleString('en-IN')}`);
console.log(`  - Ground Floor: ₹${Math.round(gfSummary.woodworkSubtotal).toLocaleString('en-IN')} (${gfSummary.percentShare}%)`);
console.log(`  - First Floor: ₹${Math.round(ffSummary.woodworkSubtotal).toLocaleString('en-IN')} (${ffSummary.percentShare}%)`);

// ── TEST 2: Pure Modular Woodwork Guarantee (Zero Civil Work Surcharges) ──
console.log('\n2. Testing Pure Modular Woodwork Guarantee (Zero Civil Work Impact)...');
// Both rooms had enabled flooring (Italian Marble / Wooden Planks) and POP false ceiling
// Verify that civil items may exist in metadata/civilItems but DO NOT add a single rupee to woodwork subtotal or commercial subtotal
if (fullQuote.civilItems) {
  fullQuote.civilItems.forEach(civ => {
    assert.strictEqual(civ.totalAmount, 0, 'Civil items totalAmount must strictly be ₹0');
  });
}
assert.strictEqual(fullQuote.subtotalWoodwork, fullQuote.subtotal, 'Quote subtotal must strictly equal subtotalWoodwork (100% pure modular woodwork, zero civil additions)');
console.log('✓ Pure modular woodwork guarantee validated: Civil works add ₹0 to pricing totals!');

// ── TEST 3: Ground Floor Isolation ('ground') ──
console.log('\n3. Testing Floor Filter Isolation: Ground Floor Only...');
const gfQuote = Core.generateFullQuotation(testProject, ['all'], 'ground');

assert.strictEqual(gfQuote.selectedFloorId, 'ground');
assert.strictEqual(gfQuote.isFloorFiltered, true);
assert.strictEqual(gfQuote.items.length, 2, 'Ground Floor quote must contain exactly 2 units');
assert.strictEqual(Math.round(gfQuote.subtotalWoodwork), Math.round(gfSummary.woodworkSubtotal), 'Isolated Ground Floor subtotal must match Ground Floor summary subtotal');
gfQuote.items.forEach(it => {
  assert.strictEqual(it.floorId, 'ground', 'All items in Ground Floor quote must have floorId = ground');
  assert.strictEqual(it.floorName, 'Ground Floor', 'Item floorName must be Ground Floor');
});
console.log(`✓ Ground Floor isolated correctly with ₹${Math.round(gfQuote.subtotalWoodwork).toLocaleString('en-IN')}`);

// ── TEST 4: First Floor Isolation ('floor_1') ──
console.log('\n4. Testing Floor Filter Isolation: First Floor Only...');
const ffQuote = Core.generateFullQuotation(testProject, ['all'], 'floor_1');

assert.strictEqual(ffQuote.selectedFloorId, 'floor_1');
assert.strictEqual(ffQuote.isFloorFiltered, true);
assert.strictEqual(ffQuote.items.length, 2, 'First Floor quote must contain exactly 2 units');
assert.strictEqual(Math.round(ffQuote.subtotalWoodwork), Math.round(ffSummary.woodworkSubtotal), 'Isolated First Floor subtotal must match First Floor summary subtotal');
ffQuote.items.forEach(it => {
  assert.strictEqual(it.floorId, 'floor_1', 'All items in First Floor quote must have floorId = floor_1');
  assert.strictEqual(it.floorName, 'First Floor', 'Item floorName must be First Floor');
});
console.log(`✓ First Floor isolated correctly with ₹${Math.round(ffQuote.subtotalWoodwork).toLocaleString('en-IN')}`);

// ── TEST 5: Backward Compatibility (Default Parameter) ──
console.log('\n5. Testing Backward Compatibility (no floor argument provided)...');
const legacyCallQuote = Core.generateFullQuotation(testProject, ['all']);
assert.strictEqual(legacyCallQuote.selectedFloorId, 'all');
assert.strictEqual(legacyCallQuote.items.length, 4);
assert.strictEqual(Math.round(legacyCallQuote.subtotalWoodwork), Math.round(fullQuote.subtotalWoodwork));
console.log('✓ Legacy function calls without selectedFloorId default seamlessly to "all".');

console.log('\n================================================================');
console.log('🎉 ALL FLOOR-WISE PRICING & PURE MODULAR WOODWORK TESTS PASSED!');
console.log('================================================================');
