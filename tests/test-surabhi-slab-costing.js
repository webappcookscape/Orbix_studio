const assert = require('assert');
const Core = require('../orbix-core');
const clientQuoteService = require('../server/services/clientQuoteService');

console.log('=== TEST SUITE: ELEGANT SURABHI DESIGN FEE SLABS ===\n');

// Test 1: Slabs structure validation
console.log('--- Test 1: Validate Slabs Structure ---');
const slabs = Core.SURABHI_DESIGN_FEE_SLABS;
assert.ok(Array.isArray(slabs), 'Slabs must be an array');
assert.strictEqual(slabs.length, 12, 'Must contain all 12 slabs');

slabs.forEach(slab => {
  assert.ok(slab.id, 'Slab must have an id');
  assert.ok(slab.label, 'Slab must have a label');
  assert.ok(slab.fullDesignCharges > 0, 'Full design charges must be > 0');
  assert.ok(slab.discountedCharges > 0, 'Discounted charges must be > 0');
  assert.strictEqual(slab.discountPercent, 60, 'Discount percent must be 60%');
  
  // Verify 60% discount calculation: discounted = 40% of full
  const expectedPayable = Math.round(slab.fullDesignCharges * 0.40);
  assert.strictEqual(slab.discountedCharges, expectedPayable, `Discounted charges for ${slab.label} must be 40% of full fee`);
});
console.log('✓ All 12 slabs verified with exact 60% discount (40% payable)!');

// Test 2: Auto-Detection across all value brackets
console.log('\n--- Test 2: Auto-Detection of Slabs Based on Elegant Surabhi Costing ---');
const testCases = [
  { value: 250000, expectedId: '2_to_3', expectedFull: 24465, expectedDisc: 9786 },
  { value: 450000, expectedId: '4_to_5', expectedFull: 35280, expectedDisc: 14112 },
  { value: 520000, expectedId: '5_to_7_entry', expectedFull: 42780, expectedDisc: 17112 },
  { value: 600000, expectedId: '5_to_7_mid', expectedFull: 47780, expectedDisc: 19112 },
  { value: 680000, expectedId: '5_to_7_upper', expectedFull: 60280, expectedDisc: 24112 },
  { value: 750000, expectedId: '7_to_8', expectedFull: 72780, expectedDisc: 29112 },
  { value: 950000, expectedId: '9_to_10', expectedFull: 85280, expectedDisc: 34112 },
  { value: 1050000, expectedId: '10_to_11', expectedFull: 97780, expectedDisc: 39112 },
  { value: 1300000, expectedId: '12_to_15', expectedFull: 112780, expectedDisc: 45112 },
  { value: 1800000, expectedId: '15_to_20', expectedFull: 147780, expectedDisc: 59112 },
  { value: 2200000, expectedId: '20_to_25', expectedFull: 195280, expectedDisc: 78112 },
  { value: 2800000, expectedId: '25_to_30', expectedFull: 222780, expectedDisc: 89112 }
];

testCases.forEach(tc => {
  const slab = Core.getSurabhiDesignFeeSlab(tc.value, 'auto');
  assert.ok(slab, `Slab must be found for value ₹${tc.value}`);
  assert.strictEqual(slab.id, tc.expectedId, `Value ₹${tc.value} should map to ${tc.expectedId}`);
  assert.strictEqual(slab.fullDesignCharges, tc.expectedFull, `Full fee must match ${tc.expectedFull}`);
  assert.strictEqual(slab.discountedCharges, tc.expectedDisc, `Discounted fee must match ${tc.expectedDisc}`);
  console.log(`✓ ₹${(tc.value/100000).toFixed(1)} Lakhs -> ${slab.label}: Full ₹${slab.fullDesignCharges} | Client Pays ₹${slab.discountedCharges}`);
});

// Test 3: Dropdown Override Feature
console.log('\n--- Test 3: Dropdown Manual Override ---');
// When woodwork is 5 Lakhs, but designer selects '10_to_11' dropdown
const overriddenSlab = Core.getSurabhiDesignFeeSlab(500000, '10_to_11');
assert.strictEqual(overriddenSlab.id, '10_to_11');
assert.strictEqual(overriddenSlab.fullDesignCharges, 97780);
assert.strictEqual(overriddenSlab.discountedCharges, 39112);
console.log('✓ Dropdown override successfully honored: 10 to 11 Lakhs (₹97,780 -> ₹39,112)');

// When designer chooses 'custom'
const customSlab = Core.getSurabhiDesignFeeSlab(500000, 'custom');
assert.strictEqual(customSlab, null, 'Custom option disables slab constraints');
console.log('✓ Custom option returns null to permit manual percentage editing');

// Test 4: Commercial Calculation Engine Integration
console.log('\n--- Test 4: Commercial Calculation Engine Integration ---');
const commAuto = clientQuoteService.recalculateVariantCommercial(
  { woodworkSubtotal: 600000, freightEnabled: true, gstEnabled: true },
  { surabhiDesignSlab: 'auto', surabhiWoodworkSubtotal: 600000 }
);

assert.strictEqual(commAuto.designAmount, 47780, 'Auto slab for 6 Lakhs must have 47,780 design fee');
assert.strictEqual(commAuto.adpPercent, 60, 'ADP discount must be 60%');
assert.strictEqual(commAuto.adpAmount, Math.round(47780 * 0.60), 'ADP discount amount must be 28,668');
assert.strictEqual(commAuto.designAfterDiscount, 19112, 'Client pays exact slab discounted fee 19,112');
console.log('✓ Commercial summary computed auto slab correctly: Design ₹47,780, Net Design ₹19,112');

// Overridden via dropdown in commercial charges
const commDropdown = clientQuoteService.recalculateVariantCommercial(
  { woodworkSubtotal: 600000, freightEnabled: true, gstEnabled: true },
  { surabhiDesignSlab: '9_to_10', surabhiWoodworkSubtotal: 600000 }
);
assert.strictEqual(commDropdown.designAmount, 85280, 'Dropdown slab 9 to 10 must apply 85,280 design fee');
assert.strictEqual(commDropdown.adpPercent, 60, 'ADP discount must be 60%');
assert.strictEqual(commDropdown.designAfterDiscount, 34112, 'Client pays exact slab discounted fee 34,112');
console.log('✓ Commercial summary dropdown override verified: Design ₹85,280, Net Design ₹34,112');

console.log('\n🎉 ALL ELEGANT SURABHI SLAB COSTING TESTS PASSED PERFECTLY! 🚀');
