// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — Tests for Master Add-Ons Catalog & Down-After-Savings Quotation
// ═══════════════════════════════════════════════════════════════════════════════

const assert = require('assert');
const Core = require('../orbix-core');
const clientQuoteService = require('../server/services/clientQuoteService');

console.log('--- TEST: Cookscape Master Add-Ons Catalog ---');
const catalog = Core.getCookscapeAddonsCatalog();
assert(Array.isArray(catalog), 'Catalog must be an array');
assert.strictEqual(catalog.length, 69, `Catalog must have exactly 69 items, found ${catalog.length}`);

// Verify key catalog items
const magicCorner = catalog.find(i => i.id === 'magic_corner');
assert(magicCorner && magicCorner.rate === 41932.00, 'Magic Corner rate should be 41,932');

const pvcCutlery450 = catalog.find(i => i.id === 'pvc_cutlery_inlet_450');
assert(pvcCutlery450 && pvcCutlery450.rate === 1385.00, 'PVC Cutlery 450 rate should be 1,385');

console.log('✅ Master Catalog: 69 items verified.');

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

console.log('--- TEST: User Editable Rates & Custom Units (Meters) ---');
const gProfileItem = catalog.find(i => i.id === 'g_profile_handle_1m');
assert.ok(gProfileItem, 'G Profile Handle must exist in catalog');
assert.strictEqual(gProfileItem.unit, 'meter');
assert.strictEqual(gProfileItem.minRate, 950);
assert.strictEqual(gProfileItem.maxRate, 1850);
assert.strictEqual(gProfileItem.isCustom, true);

// Verify King Cot, Queen Cot, and Wallpaper were removed as requested
assert.strictEqual(catalog.find(i => i.id === 'king_size_cot_storage'), undefined, 'King Size Cot must be removed from accessories');
assert.strictEqual(catalog.find(i => i.id === 'queen_size_cot_storage'), undefined, 'Queen Size Cot must be removed from accessories');
assert.strictEqual(catalog.find(i => i.id === 'wallpaper_sqft'), undefined, 'Wallpaper must be removed from accessories');

// Test custom rate + custom measurements (5.5 meters)
const customAddons = [
  { id: 'g_profile_handle_1m', name: 'G PROFILE HANDLE 1 meter', customRate: 1450, rate: 1250, unit: 'meter', qty: 5.5, amount: Math.round(5.5 * 1450) }
];
const customSummary = Core.calculateAddonsSummary(customAddons, []);
assert.strictEqual(customSummary.addonsSubtotal, 7975, 'Custom addons subtotal must equal (5.5 * 1450) = 7,975');
console.log('✅ Custom rate and meter measurements verified successfully!');

console.log('--- TEST: Verification of Add-Ons list persistence in commercial service & templates ---');
const commWithCustomAddons = clientQuoteService.recalculateVariantCommercial(baseComm, {
  appliancesEnabled: true,
  appliances: 24000,
  selectedCustomAddons: [
    { id: 'wooden_panelling', name: 'WOODEN PANELLING', grade: 'premium', gradeName: 'Fluted Wooden Panelling', length: 8, width: 4, qty: 32, unit: 'sqft', rate: 1575, amount: 24000 }
  ]
});
assert(Array.isArray(commWithCustomAddons.selectedCustomAddons), 'selectedCustomAddons must be preserved in commercial summary');
assert.strictEqual(commWithCustomAddons.selectedCustomAddons.length, 1, 'Must have 1 custom add-on');
assert.strictEqual(commWithCustomAddons.selectedCustomAddons[0].name, 'WOODEN PANELLING');
console.log('✅ selectedCustomAddons persistence verified successfully in commercial calculation engine!');

console.log('--- TEST: Paired Custom Add-Ons Catalog (Regular vs Premium) ---');
const pairedCatalog = Core.getCookscapeCustomAddonsPairs();
assert(Array.isArray(pairedCatalog), 'Paired catalog must be an array');
assert(pairedCatalog.length >= 13, `Paired catalog must have at least 13 item pairs, found ${pairedCatalog.length}`);

const kingCotPair = pairedCatalog.find(i => i.id === 'king_size_cot_storage');
assert.ok(kingCotPair, 'King Size Cot must exist in paired catalog');
assert.strictEqual(kingCotPair.regular.rate, 59740.00, 'King Size Cot Regular rate must be 59,740');
assert.strictEqual(kingCotPair.premium.rate, 66920.00, 'King Size Cot Premium rate must be 66,920');

const panellingPair = pairedCatalog.find(i => i.id === 'wooden_panelling');
assert.ok(panellingPair, 'Wooden panelling must exist in paired catalog');
assert.strictEqual(panellingPair.regular.rate, 1150.00, 'Wooden panelling Regular rate must be 1,150');
assert.strictEqual(panellingPair.premium.rate, 1575.00, 'Wooden panelling Premium rate must be 1,575');
assert.strictEqual(panellingPair.hasDimensions, true, 'Wooden panelling must support dimensions (Length x Width)');

const ceilingPair = pairedCatalog.find(i => i.id === 'false_ceiling');
assert.ok(ceilingPair, 'False ceiling must exist in paired catalog');
assert.strictEqual(ceilingPair.regular.rate, 75.00, 'False ceiling Regular rate must be 75');
assert.strictEqual(ceilingPair.premium.rate, 95.00, 'False ceiling Premium rate must be 95');

const graniteSupply = pairedCatalog.find(i => i.id === 'granite_supply_installation');
assert.ok(graniteSupply, 'Granite supply must exist in paired catalog');
assert.strictEqual(graniteSupply.regular.rate, 680.00, 'Granite supply regular rate must be 680');
assert.strictEqual(graniteSupply.premium.rate, 680.00, 'Granite supply premium rate must be 680');

const texturePaint = pairedCatalog.find(i => i.id === 'texture_paint');
assert.ok(texturePaint, 'Texture paint must exist in paired catalog');
assert.strictEqual(texturePaint.regular.rate, 180.00, 'Texture paint regular rate must be 180');
assert.strictEqual(texturePaint.premium.rate, 245.00, 'Texture paint premium rate must be 245');

console.log('✅ Paired Custom Add-Ons Catalog (Regular vs Premium) verified successfully!');

console.log('🎉 ALL TESTS PASSED!');
