const assert = require('assert');
const fs = require('fs');

console.log('Testing TBM 60 OVEN (tbm-60-oven) unit integration across Orbix Studio...');

// 1. Core catalog check
const Core = require('../orbix-core.js');
assert(Core.FURNITURE_CATALOG, 'Core.FURNITURE_CATALOG should exist');

const tbmCore = Core.FURNITURE_CATALOG.find(u => u.id === 'tbm-60-oven');
assert(tbmCore, 'tbm-60-oven must exist in Core.FURNITURE_CATALOG');
assert.strictEqual(tbmCore.name, 'TBM 60 OVEN');
assert.strictEqual(tbmCore.category, 'kitchen_tall');
assert.strictEqual(tbmCore.modelType, 'oven_tall_unit');
assert.deepStrictEqual(tbmCore.dimensions, { W: 600, H: 2100, D: 600 });
assert.strictEqual(tbmCore.unitConfig.geometryType, 'oven_tall');
assert.strictEqual(tbmCore.unitConfig.oven.enabled, true);
assert.strictEqual(tbmCore.unitConfig.oven.openingW, 564);
assert.strictEqual(tbmCore.unitConfig.oven.openingH, 600);
assert.strictEqual(tbmCore.unitConfig.oven.bottomElevation, 700);
assert.strictEqual(tbmCore.unitConfig.oven.backPanel, false);
assert.strictEqual(tbmCore.unitConfig.shutterConfig.bottom.height, 700);
assert.strictEqual(tbmCore.unitConfig.shutterConfig.top.height, 700);
console.log('✔ Core.FURNITURE_CATALOG tbm-60-oven verified');

// 2. units_data.json check
const unitsData = JSON.parse(fs.readFileSync('units_data.json', 'utf8'));
const tbmData = unitsData.find(u => u.id === 'tbm-60-oven');
assert(tbmData, 'tbm-60-oven must exist in units_data.json');
assert.strictEqual(tbmData.name, 'TBM 60 OVEN');
assert.strictEqual(tbmData.category, 'kitchen_tall');
assert.strictEqual(tbmData.dimensions.W, 600);
assert.strictEqual(tbmData.dimensions.H, 2100);
assert.strictEqual(tbmData.dimensions.D, 600);
assert.strictEqual(tbmData.unitConfig.geometryType, 'oven_tall');
assert.strictEqual(tbmData.unitConfig.oven.enabled, true);
console.log('✔ units_data.json verified');

// 3. units.csv check
const csv = fs.readFileSync('units.csv', 'utf8');
assert(csv.includes('tbm-60-oven,TBM 60 OVEN,oven_tall_unit,Kitchen - Tall Unit,600,2100,600'), 'units.csv must contain tbm-60-oven with updated specs');
console.log('✔ units.csv verified');

// 4. units_import_template.csv check
const csvTemplate = fs.readFileSync('units_import_template.csv', 'utf8');
assert(csvTemplate.includes('tbm-60-oven,TBM 60 OVEN,oven_tall_unit,Kitchen - Tall Unit,600,2100,600'), 'units_import_template.csv must contain tbm-60-oven');
console.log('✔ units_import_template.csv verified');

// 5. 3D Architectural Renderer check in orbix-3d.js
const orbix3dSrc = fs.readFileSync('orbix-3d.js', 'utf8');
assert(orbix3dSrc.includes('buildOvenTallCabinetMesh'), 'orbix-3d.js must implement buildOvenTallCabinetMesh');
assert(orbix3dSrc.includes('isOvenTall'), 'orbix-3d.js must detect isOvenTall units');
assert(orbix3dSrc.includes('BuiltInOvenAppliance'), 'orbix-3d.js must render BuiltInOvenAppliance');
assert(orbix3dSrc.includes('ShutterHinge_Bottom'), 'orbix-3d.js must render ShutterHinge_Bottom');
assert(orbix3dSrc.includes('ShutterHinge_Top'), 'orbix-3d.js must render ShutterHinge_Top');
assert(orbix3dSrc.includes('heat ventilation as specified in oven.backPanel: false'), 'orbix-3d.js must support open-back heat ventilation');
console.log('✔ 3D Architectural Renderer for oven tall cabinet verified');

console.log('\nAll TBM 60 OVEN tests passed 100% successfully!');
