/**
 * Test Suite: Orbix Commercial Estimate Summary & Zero Hardware Specifications
 */
const assert = require('assert');
const OrbixCore = require('../orbix-core');

console.log('--- RUNNING ORBIX COMMERCIAL CHARGES & ZERO HARDWARE TESTS ---');

// 1. Verify project with commercial charges
const proj = OrbixCore.createProject('Commercial Estimate Test');
const w1 = OrbixCore.createFurniturePlacement({
  name: 'Test Kitchen Base',
  category: 'kitchen_base',
  dimensions: { W: 600, H: 750, D: 550 },
  unitConfig: { shutters: 2, drawers: 1 }
});
proj.plan.furniture.push(w1);

// Configure commercial charges (the 15 fields)
proj.commercialCharges = {
  transport: 2500,
  designCharges: 5000,
  accessories: 1500,
  floorMat: 800,
  electrical: 3500,
  plumbing: 2000,
  wallpaper: 4500,
  falseCeiling: 12000,
  appliances: 25000,
  civilWorks: 8000,
  loadingUnloading: 1200,
  outstationTransport: 3000,
  discount: 2000,
  finalDiscount: 1000,
  gstPercent: 18
};

const quote = OrbixCore.generateFullQuotation(proj);
console.log('Woodwork Subtotal: ₹', quote.subtotalWoodwork);
console.log('Net Before Tax: ₹', quote.netBeforeTax);
console.log('GST Amount: ₹', quote.gstAmount);
console.log('Grand Total: ₹', quote.grandTotal);

// Expected additions: 2500 + 5000 + 1500 + 800 + 3500 + 2000 + 4500 + 12000 + 25000 + 8000 + 1200 + 3000 = 69000
// Expected deductions: 2000 + 1000 = 3000
// Net expected: Math.round(quote.subtotalWoodwork + 69000 - 3000) = Math.round(quote.subtotalWoodwork + 66000)
const expectedNet = Math.round(quote.subtotalWoodwork + 66000);
assert.strictEqual(quote.netBeforeTax, expectedNet, 'Net Taxable Value must equal Subtotal + Additions - Deductions');

const expectedGst = Math.round(expectedNet * 0.18);
assert.strictEqual(quote.gstAmount, expectedGst, 'GST must be 18% of Net Taxable Value');

const expectedGrand = expectedNet + expectedGst;
assert.strictEqual(quote.grandTotal, expectedGrand, 'Grand Total must equal Net Taxable + GST');
console.log('✓ Commercial charges 15-field calculation verified perfectly');

// Test serialization & persistence
const serialized = OrbixCore.serializeProject(proj);
const loaded = OrbixCore.deserializeProject(serialized);
assert.ok(loaded.commercialCharges, 'Deserialized project must contain commercialCharges');
assert.strictEqual(loaded.commercialCharges.designCharges, 5000, 'Persisted values must match');
assert.strictEqual(loaded.commercialCharges.finalDiscount, 1000, 'Final discount must match');
console.log('✓ Commercial charges serialization and persistence verified');

console.log('ALL COMMERCIAL CHARGES TESTS PASSED SUCCESSFULLY!\n');
