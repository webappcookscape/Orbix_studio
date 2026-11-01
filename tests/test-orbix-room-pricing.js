const assert = require('assert');
const OrbixCore = require('../orbix-core.js');

console.log('--- RUNNING ORBIX 2D MULTI-ROOM & ROOM-WISE PRICING TESTS ---');

// 1. 2D Multi-Room Floor Plan (2BHK Apartment Layout)
const p2bhk = OrbixCore.createProject('2BHK Apartment Suite');
// Outer perimeter walls (10m x 8m)
const w1 = OrbixCore.createWall({ start: { x: 0, y: 0 }, end: { x: 10000, y: 0 } });
const w2 = OrbixCore.createWall({ start: { x: 10000, y: 0 }, end: { x: 10000, y: 8000 } });
const w3 = OrbixCore.createWall({ start: { x: 10000, y: 8000 }, end: { x: 0, y: 8000 } });
const w4 = OrbixCore.createWall({ start: { x: 0, y: 8000 }, end: { x: 0, y: 0 } });

// Interior dividing partition walls that meet at a cross-junction (5000, 4000) and 4 T-junctions
const w5 = OrbixCore.createWall({ start: { x: 5000, y: 0 }, end: { x: 5000, y: 8000 } });
const w6 = OrbixCore.createWall({ start: { x: 0, y: 4000 }, end: { x: 10000, y: 4000 } });
p2bhk.plan.walls = [w1, w2, w3, w4, w5, w6];

// Detect rooms via planar subdivision
const detectedRooms = OrbixCore.detectRooms(p2bhk);
console.log('Detected rooms count:', detectedRooms.length);
assert.strictEqual(detectedRooms.length, 4, 'Should detect exactly 4 rooms in a 2BHK layout');

detectedRooms.forEach((r, idx) => {
  console.log(`  Room ${idx + 1}: ${r.name} · ${r.areaSqM.toFixed(1)} m² (${Math.round(r.areaSqFt)} sq ft)`);
  assert(r.areaSqM >= 19.5 && r.areaSqM <= 20.5, 'Each room in 10x8 4-quadrant plan should be ~20m²');
});
console.log('✓ 2D Planar graph subdivision & 4-quadrant room detection verified');

// 2. Place Modular Units in Different Rooms & Test Auto-Association
// Unit in Room 1 (Living: 0..5000, 0..4000)
p2bhk.plan.furniture.push({
  id: 'tv-01',
  name: 'Living TV Entertainment Media Unit',
  pos: { x: 2500, y: 2000 },
  dimensions: { W: 2400, H: 1800, D: 450 },
  category: 'tv_unit'
});

// Unit in Room 2 (Master Bed: 5000..10000, 0..4000)
p2bhk.plan.furniture.push({
  id: 'wr-01',
  name: 'Master 3-Door Sliding Wardrobe',
  pos: { x: 7500, y: 2000 },
  dimensions: { W: 1800, H: 2100, D: 600 },
  category: 'wardrobe',
  unitConfig: { shutters: 3, drawers: 2 }
});

// Unit in Room 4 (Modular Kitchen: 0..5000, 4000..8000)
p2bhk.plan.furniture.push({
  id: 'k-01',
  name: 'Kitchen L-Base Modular Counter',
  pos: { x: 2500, y: 6000 },
  dimensions: { W: 3000, H: 850, D: 600 },
  category: 'kitchen_base',
  unitConfig: { shutters: 4, drawers: 3 }
});

// Re-run detectRooms to auto-associate units
OrbixCore.detectRooms(p2bhk);

const fLiving = p2bhk.plan.furniture.find(f => f.id === 'tv-01');
const fMaster = p2bhk.plan.furniture.find(f => f.id === 'wr-01');
const fKitchen = p2bhk.plan.furniture.find(f => f.id === 'k-01');

assert(fLiving.roomId, 'Living TV unit should have auto-associated roomId');
assert(fMaster.roomId, 'Master wardrobe should have auto-associated roomId');
assert(fKitchen.roomId, 'Kitchen counter should have auto-associated roomId');
assert.notStrictEqual(fLiving.roomId, fMaster.roomId, 'Living and Master rooms must have distinct IDs');
console.log('✓ Automatic unit-to-room polygon containment association verified');

// 3. Room-Wise Full Quotation: All Rooms
const qAll = OrbixCore.generateFullQuotation(p2bhk, ['all']);
console.log('\n--- All Rooms Quotation ---');
console.log('Total items:', qAll.furnitureItems.length);
console.log('Grand Total:', qAll.currencySymbol, qAll.grandTotal.toLocaleString('en-IN'));
assert.strictEqual(qAll.furnitureItems.length, 3, 'All rooms quote should contain all 3 placed units');
assert.strictEqual(qAll.allRoomsSummary.length, 4, 'allRoomsSummary should contain metrics for all 4 rooms');

// 4. Room-Wise Full Quotation: Filtered to Master Bedroom Only
const masterRoomId = fMaster.roomId;
const qMasterOnly = OrbixCore.generateFullQuotation(p2bhk, [masterRoomId]);
console.log('\n--- Master Bedroom Only Quotation ---');
console.log('Filtered items:', qMasterOnly.furnitureItems.length);
console.log('Master Unit Name:', qMasterOnly.furnitureItems[0].name);
console.log('Master Only Grand Total:', qMasterOnly.currencySymbol, qMasterOnly.grandTotal.toLocaleString('en-IN'));

assert.strictEqual(qMasterOnly.furnitureItems.length, 1, 'Master room filter should only contain 1 item');
assert.strictEqual(qMasterOnly.furnitureItems[0].id, 'wr-01');
assert(qMasterOnly.grandTotal < qAll.grandTotal, 'Master-only quote must be less than all-rooms quote');
console.log('✓ Single room filtering verified');

// 5. Room-Wise Full Quotation: Multi-Room Selection (Master Bed + Modular Kitchen)
const kitchenRoomId = fKitchen.roomId;
const qTwoRooms = OrbixCore.generateFullQuotation(p2bhk, [masterRoomId, kitchenRoomId]);
console.log('\n--- Master Bedroom + Kitchen Quotation ---');
console.log('Filtered items:', qTwoRooms.furnitureItems.length);
console.log('Two Rooms Grand Total:', qTwoRooms.currencySymbol, qTwoRooms.grandTotal.toLocaleString('en-IN'));

assert.strictEqual(qTwoRooms.furnitureItems.length, 2, 'Two rooms filter should contain exactly 2 units');
assert(qTwoRooms.grandTotal > qMasterOnly.grandTotal, 'Two rooms total must be greater than one room');
assert(qTwoRooms.grandTotal < qAll.grandTotal, 'Two rooms total must be less than all rooms');
console.log('✓ Multi-room arbitrary selection verified');

console.log('\nALL ORBIX 2D MULTI-ROOM & ROOM PRICING TESTS PASSED SUCCESSFULLY!');
