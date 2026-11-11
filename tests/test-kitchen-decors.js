const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('🧪 Starting Kitchen Decors & Units Rail Test Suite...\n');

// 1. Verify decor files exist in assets/decors
const requiredFiles = [
  'CHIMNE (1).skp',
  'chimne_1_thumb.png',
  'Component_2 (1).skp',
  'component_2_1_thumb.png',
  'dishwasher.skp',
  'dishwasher_thumb.png',
  'Fridge (1).skp',
  'fridge.skp',
  'fridge_thumb.png',
  'KENT+RO (1).skp',
  'kent_ro_1_thumb.png',
  'SINK.skp',
  'sink_thumb.png',
  'Washing+Machine+AEG.skp',
  'washing_machine_aeg_thumb.png',
  '1EWTGRETGRES.skp',
  '1ewtgretgres_thumb.png'
];

const decorDir = path.join(__dirname, '..', 'assets', 'decors');
for (const f of requiredFiles) {
  const p = path.join(decorDir, f);
  assert.ok(fs.existsSync(p), `Missing required asset file: ${f}`);
}
console.log('✅ All 17 decor files and thumbnails verified in assets/decors.');

// 2. Verify Pricing is strictly ₹0
// Mock minimal OrbixCore environment
const coreCode = fs.readFileSync(path.join(__dirname, '..', 'orbix-core.js'), 'utf8');
const vm = require('vm');
const sandbox = { console, Math, Date, Object, Array, parseFloat, parseInt, isNaN };
vm.createContext(sandbox);
vm.runInContext(coreCode, sandbox);

const OrbixCore = sandbox.OrbixCore;
assert.ok(OrbixCore, 'OrbixCore loaded');

const decorTypes = ['sink', 'gas_hob', 'dishwasher', 'washing_machine', 'ro_purifier', 'dining_table', 'fridge', 'chimney'];
for (const dt of decorTypes) {
  const item = OrbixCore.createFurniturePlacement({
    name: 'Test ' + dt,
    category: 'decor',
    isDecor: true,
    excludeFromPricing: true,
    decorType: dt,
    dimensions: { W: 800, H: 800, D: 600 }
  });

  const cost = OrbixCore.calculateItemCost(item, OrbixCore.DEFAULT_RATE_CARD);
  assert.strictEqual(cost.baseAmount, 0, `${dt} baseAmount should be 0`);
  assert.strictEqual(cost.totalAmount, 0, `${dt} totalAmount should be 0`);
  assert.strictEqual(cost.areaSft, 0, `${dt} areaSft should be 0`);
}
console.log('✅ Pricing test passed: All decor types evaluate to strictly ₹0.00 in BOQ.');

// 3. Verify full quotation remains unchanged when decors are added
const regularUnit = OrbixCore.createFurniturePlacement({
  name: 'TBM 60',
  category: 'base',
  isDecor: false,
  dimensions: { W: 600, H: 720, D: 560 },
  unitConfig: { shutters: 1 }
});

const testProject1 = {
  plan: {
    furniture: [regularUnit]
  }
};

const quote1 = OrbixCore.generateFullQuotation(testProject1);
const baseTotal = quote1.grandTotal;
assert.ok(baseTotal > 0, 'Regular unit has positive cost');

// Add all 8 decor items alongside the regular unit
const mixedItems = [regularUnit];
for (const dt of decorTypes) {
  mixedItems.push(OrbixCore.createFurniturePlacement({
    name: 'Decor ' + dt,
    category: 'decor',
    isDecor: true,
    excludeFromPricing: true,
    decorType: dt
  }));
}

const testProject2 = {
  plan: {
    furniture: mixedItems
  }
};

const quote2 = OrbixCore.generateFullQuotation(testProject2);
assert.strictEqual(quote2.grandTotal, baseTotal, 'Total quotation with decors must equal base unit alone');
console.log(`✅ Total quotation test passed: Base unit = ₹${baseTotal.toFixed(2)}, Mixed with 8 decors = ₹${quote2.grandTotal.toFixed(2)} (Zero pricing impact)`);

// 4. Verify 3D Renderer buildDecorMesh
const threeCode = fs.readFileSync(path.join(__dirname, '..', 'orbix-3d.js'), 'utf8');
assert.ok(threeCode.includes("decorType === 'sink'"), 'orbix-3d.js includes sink mesh');
assert.ok(threeCode.includes("decorType === 'gas_hob'"), 'orbix-3d.js includes gas_hob mesh');
assert.ok(threeCode.includes("decorType === 'dishwasher'"), 'orbix-3d.js includes dishwasher mesh');
assert.ok(threeCode.includes("decorType === 'washing_machine'"), 'orbix-3d.js includes washing_machine mesh');
assert.ok(threeCode.includes("decorType === 'ro_purifier'"), 'orbix-3d.js includes ro_purifier mesh');
assert.ok(threeCode.includes("decorType === 'dining_table'"), 'orbix-3d.js includes dining_table mesh');
console.log('✅ 3D Architectural Renderer: All 6 new 3D meshes implemented and wired.');

// 5. Verify 2D Plan CAD Symbols
const planCode = fs.readFileSync(path.join(__dirname, '..', 'orbix-plan.js'), 'utf8');
assert.ok(planCode.includes("dType === 'sink'"), 'orbix-plan.js includes sink CAD symbol');
assert.ok(planCode.includes("dType === 'gas_hob'"), 'orbix-plan.js includes gas_hob CAD symbol');
assert.ok(planCode.includes("dType === 'washing_machine'"), 'orbix-plan.js includes washing_machine CAD symbol');
assert.ok(planCode.includes("dType === 'dining_table'"), 'orbix-plan.js includes dining_table CAD symbol');
console.log('✅ 2D Floor Plan: CAD symbols implemented for decor types.');

// 6. Verify Collapsible Units Bar in index.html, style.css, app.js
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
const appJs = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

assert.ok(html.includes('id="unitsRailHeader"'), 'index.html includes unitsRailHeader');
assert.ok(html.includes('id="unitsRailToggleBtn"'), 'index.html includes unitsRailToggleBtn');
assert.ok(css.includes('.units.is-collapsed'), 'style.css includes .units.is-collapsed');
assert.ok(appJs.includes('updateUnitsRailHeader'), 'app.js includes updateUnitsRailHeader');
console.log('✅ Collapsible Units Bar: Header, CSS, and toggle listener verified.');

console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!');
