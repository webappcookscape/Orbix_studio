const assert = require('assert');
const OrbixCore = require('../orbix-core.js');

console.log('--- RUNNING ORBIX PHASE 3 AUTOMATED TESTS ---');

// 1. Verify Catalog
assert(Array.isArray(OrbixCore.FURNITURE_CATALOG), 'Catalog must be an array');
assert(OrbixCore.FURNITURE_CATALOG.length >= 10, 'Catalog should contain at least 10 modular units');
const wardrobeItem = OrbixCore.FURNITURE_CATALOG.find(i => i.id === 'w3d');
assert(wardrobeItem, '3-door wardrobe must exist in catalog');
console.log('✓ Furniture Catalog verified (' + OrbixCore.FURNITURE_CATALOG.length + ' items)');

// 2. Test Project with Placed Furniture
const proj = OrbixCore.createProject('Phase 3 Luxury Villa');

// Add 4 walls creating a 5000 x 4000 mm bedroom
const w1 = OrbixCore.createWall({ start: { x: 0, y: 0 }, end: { x: 5000, y: 0 } });
const w2 = OrbixCore.createWall({ start: { x: 5000, y: 0 }, end: { x: 5000, y: 4000 } });
const w3 = OrbixCore.createWall({ start: { x: 5000, y: 4000 }, end: { x: 0, y: 4000 } });
const w4 = OrbixCore.createWall({ start: { x: 0, y: 4000 }, end: { x: 0, y: 0 } });
proj.plan.walls = [w1, w2, w3, w4];

const rooms = OrbixCore.detectRooms(proj);
assert.strictEqual(rooms.length, 1);
rooms[0].name = 'Master Bedroom';

// Place 3-Door Wardrobe inside the room (pos: 2000, 500)
const placedWardrobe = OrbixCore.createFurniturePlacement({
  name: wardrobeItem.name,
  category: wardrobeItem.category,
  roomId: rooms[0].id,
  pos: { x: 2000, y: 500 },
  dimensions: Object.assign({}, wardrobeItem.dimensions),
  unitConfig: Object.assign({}, wardrobeItem.unitConfig)
});
proj.plan.furniture.push(placedWardrobe);

// Calculate initial quotation with default rate card (₹1700 / SFT)
const q1 = OrbixCore.generateFullQuotation(proj);
console.log('Initial Quote 1 (Rate: ₹1700/SFT):', {
  room: 'Master Bedroom',
  woodworkSubtotal: q1.subtotalWoodwork.toFixed(2),
  grandTotal: q1.grandTotal
});

// Area = 1350 * 2100 / 92903.04 = 30.51568 SFT
// Base = 30.51568 * 1700 = ₹51,876.67
const expectedBase1 = (1350 * 2100 / 92903.04) * 1700;
assert(Math.abs(q1.furnitureItems[0].baseAmount - expectedBase1) < 0.5);
console.log('✓ Initial wardrobe costing verified: ₹' + q1.furnitureItems[0].baseAmount.toFixed(2));

// 3. Test Live Rate Card Adjustment (Update to ₹1900 / SFT)
proj.rateCard.categories.wardrobe.baseRatePerSft = 1900;
const q2 = OrbixCore.generateFullQuotation(proj);
const expectedBase2 = (1350 * 2100 / 92903.04) * 1900;
assert(Math.abs(q2.furnitureItems[0].baseAmount - expectedBase2) < 0.5);
assert(q2.grandTotal > q1.grandTotal, 'Updated rate card must increase grand total');
console.log('✓ Live rate card update verified (₹1700 -> ₹1900): New Total = ₹' + q2.grandTotal);

// 4. Test Quotation Snapshot Locking & Versioning
const snapshot1 = OrbixCore.lockQuotationVersion(proj, 'Initial Client Estimate', 'Preliminary rate card');
assert.strictEqual(snapshot1.version, '1.0');
assert.strictEqual(snapshot1.label, 'Initial Client Estimate');
assert.strictEqual(snapshot1.quotation.grandTotal, q2.grandTotal);
assert.strictEqual(proj.quotationHistory.length, 1);
console.log('✓ Quotation snapshot v1.0 locked successfully with total ₹' + snapshot1.quotation.grandTotal);

// Modify active rate again (₹2100) and lock v2.0
proj.rateCard.categories.wardrobe.baseRatePerSft = 2100;
const snapshot2 = OrbixCore.lockQuotationVersion(proj, 'Revised Estimate with Premium Materials');
assert.strictEqual(snapshot2.version, '2.0');
assert.strictEqual(proj.quotationHistory.length, 2);

// Assert v1.0 remains immutable
assert.strictEqual(proj.quotationHistory[0].rateCardSnapshot.categories.wardrobe.baseRatePerSft, 1900);
assert.strictEqual(proj.quotationHistory[1].rateCardSnapshot.categories.wardrobe.baseRatePerSft, 2100);
console.log('✓ Immutable quotation history versioning verified (v1.0 locked at ₹1900, v2.0 at ₹2100)');

console.log('ALL ORBIX PHASE 3 TESTS PASSED SUCCESSFULLY!');
