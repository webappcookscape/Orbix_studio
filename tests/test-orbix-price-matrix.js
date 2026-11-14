const assert = require('assert');
const OrbixCore = require('../orbix-core.js');

console.log('--- RUNNING ORBIX PRICE MATRIX & TIERS TESTS ---');

// 1. Verify Price Tiers
const expectedTiers = [
  'zappo - el pearl', 'pot&cafe', 'homespace', 'livlame',
  'LL elite', 'CC MATTE', 'CC GLOSSY', 'SURABHI', 'MR+'
];
assert.deepStrictEqual(OrbixCore.PRICE_TIERS, expectedTiers, 'Price tiers list must match exactly');
console.log('✓ Price Tiers verified (9 tiers: ' + expectedTiers.join(', ') + ')');

// 2. Verify 12 Models and exact rates from the Excel sheet
const expectedRates = {
  kitchen_wm:    { 'zappo - el pearl': 1545, 'pot&cafe': 1696, 'homespace': 1785, 'livlame': 1950, 'LL elite': 2034, 'CC MATTE': 2228, 'CC GLOSSY': 2422, 'SURABHI': 2616, 'MR+': 2929 },
  kitchen_fm:    { 'zappo - el pearl': 1796, 'pot&cafe': 1969, 'homespace': 1975, 'livlame': 2214, 'LL elite': 2500, 'CC MATTE': 2906, 'CC GLOSSY': 3113, 'SURABHI': 3391, 'MR+': 3786 },
  kitchen_d2d3:  { 'zappo - el pearl': 1972, 'pot&cafe': 2196, 'homespace': 2714, 'livlame': 2527, 'LL elite': 3600, 'CC MATTE': 3945, 'CC GLOSSY': 4172, 'SURABHI': 4469, 'MR+': 5227 },
  kitchen_os:    { 'zappo - el pearl': 895,  'pot&cafe': 984,  'homespace': 1184, 'livlame': 1236, 'LL elite': 1196, 'CC MATTE': 1250, 'CC GLOSSY': 1567, 'SURABHI': 1786, 'MR+': 1984 },
  spice_rack:    { 'zappo - el pearl': 2272, 'pot&cafe': 2725, 'homespace': 3996, 'livlame': 4579, 'LL elite': 4650, 'CC MATTE': 4969, 'CC GLOSSY': 5679, 'SURABHI': 5786, 'MR+': 6969 },
  wr_shelves:    { 'zappo - el pearl': 1545, 'pot&cafe': 1696, 'homespace': 1872, 'livlame': 1996, 'LL elite': 1827, 'CC MATTE': 1984, 'CC GLOSSY': 2072, 'SURABHI': 2227, 'MR+': 2714 },
  wr_drawers:    { 'zappo - el pearl': 1740, 'pot&cafe': 1891, 'homespace': 2067, 'livlame': 2191, 'LL elite': 2022, 'CC MATTE': 2179, 'CC GLOSSY': 2267, 'SURABHI': 2600, 'MR+': 3109 },
  wr_sliding:    { 'zappo - el pearl': 1795, 'pot&cafe': 1984, 'homespace': 2195, 'livlame': 2295, 'LL elite': 2345, 'CC MATTE': 2575, 'CC GLOSSY': 2725, 'SURABHI': 2929, 'MR+': 3366 },
  loft_os:       { 'zappo - el pearl': 895,  'pot&cafe': 996,  'homespace': 1069, 'livlame': 1227, 'LL elite': 996,  'CC MATTE': 1127, 'CC GLOSSY': 1269, 'SURABHI': 1369, 'MR+': 1567 },
  pooja_cnc:     { 'zappo - el pearl': 1969, 'pot&cafe': 2196, 'homespace': 2725, 'livlame': 3169, 'LL elite': 2100, 'CC MATTE': 2260, 'CC GLOSSY': 2433, 'SURABHI': 2848, 'MR+': 3129 },
  tv_cabinet:    { 'zappo - el pearl': 1984, 'pot&cafe': 2724, 'homespace': 2929, 'livlame': 3786, 'LL elite': 3600, 'CC MATTE': 4200, 'CC GLOSSY': 4359, 'SURABHI': 4844, 'MR+': 5679 },
  wall_paneling: { 'zappo - el pearl': 796,  'pot&cafe': 845,  'homespace': 936,  'livlame': 969,  'LL elite': 960,  'CC MATTE': 1027, 'CC GLOSSY': 1196, 'SURABHI': 1247, 'MR+': 1427 }
};

for (const modelKey in expectedRates) {
  const modelDef = OrbixCore.MODEL_RATES_MATRIX[modelKey];
  assert(modelDef, 'Model definition must exist: ' + modelKey);
  for (const tier of expectedTiers) {
    assert.strictEqual(
      modelDef.rates[tier],
      expectedRates[modelKey][tier],
      `Rate mismatch for ${modelKey} at tier ${tier}: expected ${expectedRates[modelKey][tier]}, got ${modelDef.rates[tier]}`
    );
  }
}
console.log('✓ All 12 models and 108 rate matrix cells verified against Excel specification');

// 3. Test calculation with Tier Selection
const proj = OrbixCore.createProject('Tier Matrix Test Villa');
const kWall = OrbixCore.createFurniturePlacement({
  name: 'Upper Kitchen Cabinets',
  category: 'kitchen_wall',
  modelType: 'kitchen_wm',
  dimensions: { W: 2400, H: 700, D: 350 }
});
const slidingWardrobe = OrbixCore.createFurniturePlacement({
  name: 'Master Sliding Wardrobe',
  category: 'wardrobe',
  modelType: 'wr_sliding',
  dimensions: { W: 1800, H: 2400, D: 600 }
});
proj.plan.furniture.push(kWall, slidingWardrobe);

// Calculate with new renamed tier 'zappo - el pearl' (p1)
proj.rateCard.selectedTier = 'zappo - el pearl';
const qZappo = OrbixCore.generateFullQuotation(proj);
assert.strictEqual(qZappo.furnitureItems[0].baseRate, 1545, 'Kitchen WM should be ₹1545 in zappo - el pearl');
assert.strictEqual(qZappo.furnitureItems[1].baseRate, 1795, 'Sliding Wardrobe should be ₹1795 in zappo - el pearl');
console.log('✓ zappo - el pearl (p1) quotation verified: Kitchen WM rate = ₹1545, Wardrobe sliding rate = ₹1795');

// Test backward-compatibility with PRICE 1 alias
proj.rateCard.selectedTier = 'PRICE 1';
const qP1 = OrbixCore.generateFullQuotation(proj);
assert.strictEqual(qP1.furnitureItems[0].baseRate, 1545, 'Kitchen WM should be ₹1545 in PRICE 1 alias');
assert.strictEqual(qP1.furnitureItems[1].baseRate, 1795, 'Sliding Wardrobe should be ₹1795 in PRICE 1 alias');
console.log('✓ PRICE 1 alias quotation verified: Kitchen WM rate = ₹1545, Wardrobe sliding rate = ₹1795');

// Switch to CC MATTE
proj.rateCard.selectedTier = 'CC MATTE';
const qCCM = OrbixCore.generateFullQuotation(proj);
assert.strictEqual(qCCM.furnitureItems[0].baseRate, 2228, 'Kitchen WM should be ₹2228 in CC MATTE');
assert.strictEqual(qCCM.furnitureItems[1].baseRate, 2575, 'Sliding Wardrobe should be ₹2575 in CC MATTE');
console.log('✓ CC MATTE quotation verified: Kitchen WM rate = ₹2228, Wardrobe sliding rate = ₹2575');

// Switch to MR+
proj.rateCard.selectedTier = 'MR+';
const qMR = OrbixCore.generateFullQuotation(proj);
assert.strictEqual(qMR.furnitureItems[0].baseRate, 2929, 'Kitchen WM should be ₹2929 in MR+');
assert.strictEqual(qMR.furnitureItems[1].baseRate, 3366, 'Sliding Wardrobe should be ₹3366 in MR+');
console.log('✓ MR+ quotation verified: Kitchen WM rate = ₹2929, Wardrobe sliding rate = ₹3366');

// Item level override with new renamed tier 'LL elite' (livelane)
kWall.tierOverride = 'LL elite';
const qOverride = OrbixCore.generateFullQuotation(proj);
assert.strictEqual(qOverride.furnitureItems[0].baseRate, 2034, 'Kitchen WM override to LL elite should be ₹2034');
assert.strictEqual(qOverride.furnitureItems[1].baseRate, 3366, 'Sliding Wardrobe remains MR+ at ₹3366');
console.log('✓ Item-level tier override with LL elite verified');

// Item level override with legacy 'LIVE LANE' alias
kWall.tierOverride = 'LIVE LANE';
const qOverrideLegacy = OrbixCore.generateFullQuotation(proj);
assert.strictEqual(qOverrideLegacy.furnitureItems[0].baseRate, 2034, 'Kitchen WM override to LIVE LANE should be ₹2034');
console.log('✓ Item-level tier override with LIVE LANE alias verified');

// 4. Verify Factory Tier Specifications & Bill of Materials
console.log('\n--- Verifying Factory Tier Specifications & BOM ---');
const llSpec = OrbixCore.getTierSpecifications('LL ELITE');
assert(llSpec, 'LL ELITE specification must exist');
assert.strictEqual(llSpec.hardwareBrand, 'Tyrox');
assert.strictEqual(llSpec.handleFinish, 'Nickel Brush');
console.log('✓ LL ELITE specification verified (Tyrox hardware & Nickel Brush handles)');

const ccmSpec = OrbixCore.getTierSpecifications('CC MATTE');
assert(ccmSpec, 'CC MATTE specification must exist');
assert.strictEqual(ccmSpec.kitchenAccessories, 'SLEEK BRAND');
assert.strictEqual(ccmSpec.productionTimeline, '4 Weeks from Color Drawing Physical Sign Off');
console.log('✓ CC MATTE specification verified (Sleek kitchen accessories & 4 weeks timeline)');

const ccgSpec = OrbixCore.getTierSpecifications('CAPRICOST GLOSSY');
assert(ccgSpec, 'CAPRICOST GLOSSY specification must exist');
assert.strictEqual(ccgSpec.kitchenAccessories, 'EBCO BRAND');
assert.strictEqual(ccgSpec.primaryHinges, 'EBCO (12 kg)');
console.log('✓ CAPRICOST GLOSSY specification verified (Ebco kitchen accessories & 12kg hinges)');

const surSpec = OrbixCore.getTierSpecifications('ELEGANT SURABHI');
assert(surSpec, 'ELEGANT SURABHI specification must exist');
assert.strictEqual(surSpec.kitchenAccessories, 'HETTICH Brand');
assert.strictEqual(surSpec.productionTimeline, '6 to 8 Weeks from Color Drawing Physical Sign Off');
console.log('✓ ELEGANT SURABHI specification verified (Hettich accessories & 6-8 weeks timeline)');

const tuffSpec = OrbixCore.getTierSpecifications('4X TUFF GLOSS');
assert(tuffSpec, '4X TUFF GLOSS specification must exist');
assert.strictEqual(tuffSpec.kitchenAccessories, 'HETTICH Brand');
assert(tuffSpec.shutterFinish.includes('4X TG / MR+'));
assert.strictEqual(tuffSpec.productionTimeline, '6 to 8 Weeks from Color Drawing Physical Sign Off');
console.log('✓ 4X TUFF GLOSS specification verified (Hettich accessories, 4X TG finish & 6-8 weeks timeline)');

console.log('ALL PRICE MATRIX & FACTORY SPECIFICATIONS TESTS PASSED SUCCESSFULLY!');
