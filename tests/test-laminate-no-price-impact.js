const assert = require('assert');
const Core = require('../orbix-core.js');

console.log('=== TEST SUITE: Laminate Selection Has Zero Price Impact ===\n');

// [TEST 1] Testing exact User scenario: C13 vs C14 with different laminates
console.log('[TEST 1] Testing Unit C13 (MDF 1101) vs Unit C14 (MDF 7701)...');

const unitC13 = {
  id: 'C13',
  name: 'FCM-RT (Cookscape)',
  category: 'kitchen_base',
  dimensions: { W: 1200, H: 720, D: 560 },
  unitConfig: {
    shutterCol: 'MDF 1101',
    carcass: 'MDF 7701'
  },
  pricingOverrides: { baseRate: 1796 }
};

const unitC14 = {
  id: 'C14',
  name: 'FCM-RT (Cookscape) (Copy)',
  category: 'kitchen_base',
  dimensions: { W: 1200, H: 720, D: 560 },
  unitConfig: {
    shutterCol: 'MDF 7701',
    carcass: 'MDF 1135'
  },
  pricingOverrides: { baseRate: 1796 }
};

const cost13 = Core.calculateItemCost(unitC13);
const cost14 = Core.calculateItemCost(unitC14);

console.log(`C13 Total Cost: ₹${cost13.totalAmount.toFixed(2)} (matCharge: ₹${cost13.matCharge})`);
console.log(`C14 Total Cost: ₹${cost14.totalAmount.toFixed(2)} (matCharge: ₹${cost14.matCharge})`);

assert.strictEqual(cost13.matCharge, 0, 'C13 material charge must be 0');
assert.strictEqual(cost14.matCharge, 0, 'C14 material charge must be 0');
assert.strictEqual(cost13.totalAmount, cost14.totalAmount, 'Both units must have identical cost regardless of laminate choice');
console.log('✓ TEST 1 PASSED: C13 and C14 have 100% identical cost (Zero laminate surcharge).\n');

// [TEST 2] Testing across all laminate catalogue codes
console.log('[TEST 2] Testing across all catalogue laminates...');
const laminates = [
  'MDF 1101',
  'MDF 1135',
  'MDF 3410',
  'MDF 2204',
  'MDF 6601',
  'MDF 7701',
  'MDF 7707',
  'MDF 8801',
  'Custom Woodgrain 9999'
];

laminates.forEach(lam => {
  const testUnit = {
    name: 'Wardrobe Unit',
    category: 'wardrobe',
    dimensions: { W: 1200, H: 2100, D: 600 },
    unitConfig: {
      shutterCol: lam,
      carcass: lam
    }
  };
  const cost = Core.calculateItemCost(testUnit);
  assert.strictEqual(cost.matCharge, 0, `Laminate ${lam} must have ₹0 surcharge`);
});
console.log('✓ TEST 2 PASSED: All 9 laminates tested have ₹0 surcharge.\n');

// [TEST 3] Verify Project Quotation consistency
console.log('[TEST 3] Testing Project Quotation calculation...');
const proj = Core.createProject('Kitchen Quote Test');
proj.plan.furniture = [unitC13, unitC14];

const quote = Core.generateFullQuotation(proj);
const qItem1 = quote.furnitureItems.find(it => it.id === 'C13');
const qItem2 = quote.furnitureItems.find(it => it.id === 'C14');

assert.strictEqual(qItem1.totalAmount, qItem2.totalAmount, 'Quotation items C13 and C14 must have identical amounts');
console.log(`✓ TEST 3 PASSED: Quotation total for both units is equal: ₹${qItem1.totalAmount.toFixed(2)} each.\n`);

console.log('======================================================================');
console.log('ALL LAMINATE PRICE IMPACT TESTS PASSED 100%!');
console.log('======================================================================');

