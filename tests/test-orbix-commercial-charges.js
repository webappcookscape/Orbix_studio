/**
 * Test Suite: Orbix Commercial Estimate Summary & Zero Hardware Specifications
 */
const assert = require('assert');
const OrbixCore = require('../orbix-core');

console.log('--- RUNNING ORBIX COMMERCIAL CHARGES & ZERO HARDWARE TESTS ---');

// 1. Verify project with commercial charges (New 17-item commercial summary)
const proj = OrbixCore.createProject('Commercial Estimate Test');
const w1 = OrbixCore.createFurniturePlacement({
  name: 'Test Kitchen Base',
  category: 'kitchen_base',
  dimensions: { W: 600, H: 750, D: 550 },
  unitConfig: { shutters: 2, drawers: 1 }
});
proj.plan.furniture.push(w1);

// Configure commercial charges (new structure)
proj.commercialCharges = {
  additionalAccessories: 1500,
  appliances: 25000,
  designPercent: 9,
  freightPercent: 2.5,
  discountPercent: 5,
  adpPercent: 2,
  gstPercent: 18
};

const quote = OrbixCore.generateFullQuotation(proj);
console.log('Woodwork Subtotal: ₹', quote.subtotalWoodwork);
console.log('Net Value (Net Before Tax): ₹', quote.netBeforeTax);
console.log('GST Amount: ₹', quote.gstAmount);
console.log('Grand Total: ₹', quote.grandTotal);

// Expected calculations:
// Subtotal
const sub = quote.subtotalWoodwork;
const expectedDesign = Math.round(sub * 0.09);
const expectedFreight = Math.round(sub * 0.025);
const expectedDiscount = Math.round(sub * 0.05);
const expectedAdp = Math.round(sub * 0.02);
const additions = 1500 + 25000 + expectedDesign + expectedFreight;
const deductions = expectedDiscount + expectedAdp;
const expectedNet = Math.max(0, Math.round(sub + additions - deductions));
const expectedGst = Math.round(expectedNet * 0.18);
const expectedGrand = expectedNet + expectedGst;

assert.strictEqual(quote.netBeforeTax, expectedNet, 'Net Value must equal Subtotal + Additions - Deductions');
assert.strictEqual(quote.gstAmount, expectedGst, 'GST must be 18% of Net Value');
assert.strictEqual(quote.grandTotal, expectedGrand, 'Grand Total must equal Net Value + GST');
console.log('✓ Commercial charges new schema calculation verified perfectly');

// Test serialization & persistence
const serialized = OrbixCore.serializeProject(proj);
const loaded = OrbixCore.deserializeProject(serialized);
assert.ok(loaded.commercialCharges, 'Deserialized project must contain commercialCharges');
assert.strictEqual(loaded.commercialCharges.designPercent, 9, 'Persisted design percent must match');
assert.strictEqual(loaded.commercialCharges.freightPercent, 2.5, 'Persisted freight percent must match');
assert.strictEqual(loaded.commercialCharges.additionalAccessories, 1500, 'Persisted accessories must match');
assert.strictEqual(loaded.commercialCharges.appliances, 25000, 'Persisted appliances must match');
console.log('✓ Commercial charges serialization and persistence verified');

console.log('ALL COMMERCIAL CHARGES TESTS PASSED SUCCESSFULLY!\n');
