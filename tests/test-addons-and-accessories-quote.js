// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — Tests for Master Add-Ons Catalog & Down-After-Savings Quotation
// ═══════════════════════════════════════════════════════════════════════════════

const assert = require('assert');
const Core = require('../orbix-core');
const clientQuoteService = require('../server/services/clientQuoteService');

console.log('--- TEST: Cookscape Master Add-Ons Catalog ---');
const catalog = Core.getCookscapeAddonsCatalog();
assert(Array.isArray(catalog), 'Catalog must be an array');
assert.strictEqual(catalog.length, 58, `Catalog must have exactly 58 items, found ${catalog.length}`);

// Verify key catalog items
const magicCorner = catalog.find(i => i.id === 'magic_corner');
assert(magicCorner && magicCorner.rate === 40900, 'Magic Corner rate should be 40,900');

const pvcCutlery600 = catalog.find(i => i.id === 'pvc_cutlery_600');
assert(pvcCutlery600 && pvcCutlery600.rate === 1222, 'PVC Cutlery 600 rate should be 1,222');

const kingCot = catalog.find(i => i.id === 'king_size_cot_storage');
assert(kingCot && kingCot.rate === 52800, 'King Size Cot rate should be 52,800');

console.log('✅ Master Catalog: 58 items verified.');

console.log('--- TEST: Commercial Calculation Independence (Add-ons do NOT affect Core Grand Total) ---');

const baseComm = {
  woodworkSubtotal: 500000,
  surabhiDesignSlab: 'auto',
  designPercent: 9,
  freightEnabled: true,
  freightPercent: 2.5,
  discountPercent: 10,
  adpPercent: 60,
  gstEnabled: true,
  gstPercent: 18,
  accessoriesEnabled: false,
  additionalAccessories: 0,
  appliancesEnabled: false,
  appliances: 0,
  selectedAddons: []
};

// 1. Calculate commercial without add-ons
const commWithoutAddons = clientQuoteService.recalculateVariantCommercial(baseComm, {});

// 2. Calculate commercial WITH add-ons (e.g. Magic Corner + King Cot = ₹93,700)
const commWithAddons = clientQuoteService.recalculateVariantCommercial(baseComm, {
  accessoriesEnabled: true,
  additionalAccessories: 93700,
  selectedAddons: [
    { id: 'magic_corner', name: 'MAGIC CORNER', rate: 40900, qty: 1, amount: 40900 },
    { id: 'king_size_cot_storage', name: 'KING SIZE COT WITH STORAGE', rate: 52800, qty: 1, amount: 52800 }
  ]
});

console.log(`Core Grand Total Without Add-ons: ₹${commWithoutAddons.grandTotal.toLocaleString('en-IN')}`);
console.log(`Core Grand Total WITH Add-ons:    ₹${commWithAddons.grandTotal.toLocaleString('en-IN')}`);
console.log(`Add-ons Subtotal:                 ₹${commWithAddons.addonsTotal.toLocaleString('en-IN')}`);
console.log(`Total Project Investment:         ₹${commWithAddons.totalInvestmentWithAddons.toLocaleString('en-IN')}`);

// Core grand total MUST remain identical (unaffected by add-ons)
assert.strictEqual(
  commWithAddons.grandTotal,
  commWithoutAddons.grandTotal,
  'Core Grand Total (Final Discounted Value) must NOT be affected by Additional Accessories/Add-ons!'
);

// Add-ons total must be 93,700
assert.strictEqual(commWithAddons.addonsTotal, 93700, 'Add-ons total must equal 93,700');

// Total investment must be grandTotal + addonsTotal
assert.strictEqual(
  commWithAddons.totalInvestmentWithAddons,
  commWithAddons.grandTotal + 93700,
  'Total Project Investment must equal Core Grand Total + Add-ons Total'
);

// Selected Add-ons array must be preserved
assert.strictEqual(commWithAddons.selectedAddons.length, 2, 'Selected add-ons array must have 2 items');

console.log('✅ Commercial Independence verified: Add-ons sit below savings without affecting Core Proposal Total.');

console.log('--- TEST: calculateAddonsSummary Helper in Core ---');
const summary = Core.calculateAddonsSummary(commWithAddons.selectedAddons, [
  { name: 'Built-in Microwave', rate: 25000, qty: 1, amount: 25000 }
]);
assert.strictEqual(summary.addonsSubtotal, 93700, 'Addons subtotal should be 93,700');
assert.strictEqual(summary.appliancesSubtotal, 25000, 'Appliances subtotal should be 25,000');
assert.strictEqual(summary.grandAddonsTotal, 118700, 'Grand addons total should be 118,700');

console.log('✅ Core.calculateAddonsSummary verified.');

console.log('--- TEST: User Editable Rates & Custom Units (Meters & Sq.Ft) ---');
const gProfileItem = catalog.find(i => i.id === 'g_profile_handle');
assert.ok(gProfileItem, 'G Profile Handle must exist in catalog');
assert.strictEqual(gProfileItem.unit, 'meter');
assert.strictEqual(gProfileItem.minRate, 1350);
assert.strictEqual(gProfileItem.maxRate, 2050);
assert.strictEqual(gProfileItem.isCustom, true);

const wallpaperItem = catalog.find(i => i.id === 'wallpaper_sqft');
assert.ok(wallpaperItem, 'Wallpaper must exist in catalog');
assert.strictEqual(wallpaperItem.unit, 'sqft');
assert.strictEqual(wallpaperItem.minRate, 45);
assert.strictEqual(wallpaperItem.maxRate, 70);
assert.strictEqual(wallpaperItem.isCustom, true);

// Test custom rate + custom measurements (5.5 meters & 150 sq.ft)
const customAddons = [
  { id: 'g_profile_handle', name: 'G PROFILE HANDLE 1meter', customRate: 1850, rate: 1700, unit: 'meter', qty: 5.5, amount: Math.round(5.5 * 1850) },
  { id: 'wallpaper_sqft', name: 'WALLPAPER 1sq feet', customRate: 60, rate: 55, unit: 'sqft', qty: 150, amount: Math.round(150 * 60) }
];
const customSummary = Core.calculateAddonsSummary(customAddons, []);
assert.strictEqual(customSummary.addonsSubtotal, 10175 + 9000, 'Custom addons subtotal must equal (5.5 * 1850) + (150 * 60) = 19,175');
console.log('✅ Custom rate and meter/sq.ft measurements verified successfully!');

console.log('🎉 ALL TESTS PASSED!');
