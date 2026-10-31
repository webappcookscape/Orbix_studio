const assert = require('assert');
const OrbixCore = require('../orbix-core.js');

console.log('--- RUNNING ORBIX CORE UNIT TESTS ---');

// 1. Test Project Creation
const project = OrbixCore.createProject('Luxury 2BHK Apartment');
assert.strictEqual(project.meta.title, 'Luxury 2BHK Apartment');
assert.strictEqual(project.schemaVersion, '1.0.0');
console.log('✓ Project creation passed');

// 2. Test Prompt Wardrobe Formula
// 1200 x 2000 x 550 at ₹1700/sq. ft.
const testWardrobe = OrbixCore.createFurniturePlacement({
  name: 'Master Bed Wardrobe',
  category: 'wardrobe',
  dimensions: { W: 1200, H: 2000, D: 550 }
});
const cost = OrbixCore.calculateItemCost(testWardrobe, project.rateCard);
console.log('Wardrobe cost calculation:', {
  areaSft: cost.areaSft.toFixed(4),
  baseAmount: cost.baseAmount.toFixed(2),
  formula: cost.formulaDescription
});

// Check that depth did not multiply the formula
assert(Math.abs(cost.baseAmount - 43916.75) < 1.0, 'Base amount should be approximately ₹43,916.67');
assert.strictEqual(cost.extraDepthCharge, 0, 'Standard depth <= 600mm has no extra depth charge');
console.log('✓ Wardrobe pricing formula matches user specification (~₹43,916.67)');

// 3. Test Room Boundary Detection
// Build a 4m x 3m (4000mm x 3000mm) room
const w1 = OrbixCore.createWall({ start: { x: 0, y: 0 }, end: { x: 4000, y: 0 } });
const w2 = OrbixCore.createWall({ start: { x: 4000, y: 0 }, end: { x: 4000, y: 3000 } });
const w3 = OrbixCore.createWall({ start: { x: 4000, y: 3000 }, end: { x: 0, y: 3000 } });
const w4 = OrbixCore.createWall({ start: { x: 0, y: 3000 }, end: { x: 0, y: 0 } });

project.plan.walls = [w1, w2, w3, w4];

const rooms = OrbixCore.detectRooms(project);
console.log('Detected rooms count:', rooms.length);
assert.strictEqual(rooms.length, 1, 'Should detect exactly 1 closed room');

const detectedRoom = rooms[0];
console.log('Room metrics:', {
  areaSqM: detectedRoom.areaSqM.toFixed(2),
  areaSqFt: detectedRoom.areaSqFt.toFixed(2)
});

// 4m x 3m = 12 m²
assert(Math.abs(detectedRoom.areaSqM - 12.0) < 0.1, 'Room area should be 12 sq meters');
// 12 m² = 12 * 10.7639 ≈ 129.17 sq ft
assert(Math.abs(detectedRoom.areaSqFt - 129.17) < 0.5, 'Room area should be ~129.17 sq ft');
console.log('✓ Room detection & area calculation passed');

// 4. Test Door/Window Placement on Wall
const door = OrbixCore.createOpening({
  type: 'door',
  wallId: w1.id,
  offset: 1000,
  width: 900,
  height: 2100,
  swing: 'in-left'
});
project.plan.openings.push(door);
assert.strictEqual(project.plan.openings.length, 1);
assert.strictEqual(project.plan.openings[0].width, 900);
console.log('✓ Door placement on wall passed');

// 5. Test Wall Splitting
const splitRes = OrbixCore.splitWall(project, w2.id, { x: 4000, y: 1500 });
assert(splitRes !== null, 'Wall should be split into two walls');
assert.strictEqual(project.plan.walls.length, 5, 'Should now have 5 wall segments');
console.log('✓ Wall splitting passed');

// 6. Test Full Quotation Generation
project.plan.furniture.push(testWardrobe);
const quote = OrbixCore.generateFullQuotation(project);
console.log('Quotation summary:', {
  subtotalWoodwork: quote.subtotalWoodwork.toFixed(2),
  laborTotal: quote.laborTotal.toFixed(2),
  netBeforeTax: quote.netBeforeTax.toFixed(2),
  gstAmount: quote.gstAmount.toFixed(2),
  grandTotal: quote.grandTotal
});
assert(quote.grandTotal > 0, 'Grand total must be positive');
console.log('✓ Full quotation engine passed');

// 7. Test Serialization & Deserialization
const jsonStr = OrbixCore.serializeProject(project);
const loadedProj = OrbixCore.deserializeProject(jsonStr);
assert.strictEqual(loadedProj.plan.walls.length, 5);
assert.strictEqual(loadedProj.plan.furniture.length, 1);
console.log('✓ Project serialization and deserialization passed');

console.log('ALL ORBIX CORE TESTS PASSED SUCCESSFULLY!');
