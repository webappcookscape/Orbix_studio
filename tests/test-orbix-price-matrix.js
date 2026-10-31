const assert = require('assert');
const OrbixCore = require('../orbix-core.js');

console.log('--- RUNNING ORBIX PRICE MATRIX & TIERS TESTS ---');

// 1. Verify Price Tiers
const expectedTiers = ['PRICE 1', 'PRICE 2', 'PRICE 3', 'PRICE 4', 'LIVE LANE', 'CC MATTE', 'CC GLOSSY', 'SURABHI', 'MR+'];
assert.deepStrictEqual(OrbixCore.PRICE_TIERS, expectedTiers, 'Price tiers list must match exactly');
console.log('✓ Price Tiers verified (9 tiers: ' + expectedTiers.join(', ') + ')');

// 2. Verify 12 Models and exact rates from the Excel sheet
const expectedRates = {
  kitchen_wm:    { 'PRICE 1': 1545, 'PRICE 2': 1696, 'PRICE 3': 1785, 'PRICE 4': 1950, 'LIVE LANE': 2034, 'CC MATTE': 2228, 'CC GLOSSY': 2422, 'SURABHI': 2616, 'MR+': 2929 },
  kitchen_fm:    { 'PRICE 1': 1796, 'PRICE 2': 1969, 'PRICE 3': 1975, 'PRICE 4': 2214, 'LIVE LANE': 2500, 'CC MATTE': 2906, 'CC GLOSSY': 3113, 'SURABHI': 3391, 'MR+': 3786 },
  kitchen_d2d3:  { 'PRICE 1': 1972, 'PRICE 2': 2196, 'PRICE 3': 2714, 'PRICE 4': 2527, 'LIVE LANE': 3600, 'CC MATTE': 3945, 'CC GLOSSY': 4172, 'SURABHI': 4369, 'MR+': 5127 },
  kitchen_os:    { 'PRICE 1': 895,  'PRICE 2': 984,  'PRICE 3': 1184, 'PRICE 4': 1236, 'LIVE LANE': 1196, 'CC MATTE': 1250, 'CC GLOSSY': 1567, 'SURABHI': 1786, 'MR+': 1984 },
  spice_rack:    { 'PRICE 1': 2272, 'PRICE 2': 2725, 'PRICE 3': 3996, 'PRICE 4': 4579, 'LIVE LANE': 4650, 'CC MATTE': 4969, 'CC GLOSSY': 5679, 'SURABHI': 5786, 'MR+': 6969 },
  wr_shelves:    { 'PRICE 1': 1545, 'PRICE 2': 1696, 'PRICE 3': 1872, 'PRICE 4': 1996, 'LIVE LANE': 1827, 'CC MATTE': 1984, 'CC GLOSSY': 2072, 'SURABHI': 2227, 'MR+': 2714 },
  wr_drawers:    { 'PRICE 1': 1740, 'PRICE 2': 1891, 'PRICE 3': 2067, 'PRICE 4': 2191, 'LIVE LANE': 2022, 'CC MATTE': 2179, 'CC GLOSSY': 2267, 'SURABHI': 2400, 'MR+': 2909 },
  wr_sliding:    { 'PRICE 1': 1795, 'PRICE 2': 1984, 'PRICE 3': 2195, 'PRICE 4': 2295, 'LIVE LANE': 2345, 'CC MATTE': 2575, 'CC GLOSSY': 2725, 'SURABHI': 2929, 'MR+': 3366 },
  loft_os:       { 'PRICE 1': 895,  'PRICE 2': 996,  'PRICE 3': 1069, 'PRICE 4': 1227, 'LIVE LANE': 996,  'CC MATTE': 1127, 'CC GLOSSY': 1269, 'SURABHI': 1369, 'MR+': 1567 },
  pooja_cnc:     { 'PRICE 1': 1969, 'PRICE 2': 2196, 'PRICE 3': 2725, 'PRICE 4': 3169, 'LIVE LANE': 2100, 'CC MATTE': 2260, 'CC GLOSSY': 2433, 'SURABHI': 2648, 'MR+': 2929 },
  tv_cabinet:    { 'PRICE 1': 1984, 'PRICE 2': 2724, 'PRICE 3': 2929, 'PRICE 4': 3786, 'LIVE LANE': 3600, 'CC MATTE': 4200, 'CC GLOSSY': 4359, 'SURABHI': 4844, 'MR+': 5679 },
  wall_paneling: { 'PRICE 1': 796,  'PRICE 2': 845,  'PRICE 3': 936,  'PRICE 4': 969,  'LIVE LANE': 960,  'CC MATTE': 1027, 'CC GLOSSY': 1196, 'SURABHI': 1247, 'MR+': 1427 }
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

// Calculate with PRICE 1
proj.rateCard.selectedTier = 'PRICE 1';
const qP1 = OrbixCore.generateFullQuotation(proj);
assert.strictEqual(qP1.furnitureItems[0].baseRate, 1545, 'Kitchen WM should be ₹1545 in PRICE 1');
assert.strictEqual(qP1.furnitureItems[1].baseRate, 1795, 'Sliding Wardrobe should be ₹1795 in PRICE 1');
console.log('✓ PRICE 1 quotation verified: Kitchen WM rate = ₹1545, Wardrobe sliding rate = ₹1795');

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

// Item level override
kWall.tierOverride = 'LIVE LANE';
const qOverride = OrbixCore.generateFullQuotation(proj);
assert.strictEqual(qOverride.furnitureItems[0].baseRate, 2034, 'Kitchen WM override to LIVE LANE should be ₹2034');
assert.strictEqual(qOverride.furnitureItems[1].baseRate, 3366, 'Sliding Wardrobe remains MR+ at ₹3366');
console.log('✓ Item-level tier override verified');

console.log('ALL PRICE MATRIX TESTS PASSED SUCCESSFULLY!');
