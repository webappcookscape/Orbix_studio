const assert = require('assert');
const fs = require('fs');

console.log('Testing FCM-RT (Cookscape) unit integration across Orbix Studio...');

// 1. Core catalog check
const Core = require('../orbix-core.js');
assert(Core.FURNITURE_CATALOG, 'Core.FURNITURE_CATALOG should exist');

const fcmCore = Core.FURNITURE_CATALOG.find(u => u.id === 'fcm-rt');
assert(fcmCore, 'fcm-rt must exist in Core.FURNITURE_CATALOG');
assert.strictEqual(fcmCore.name, 'FCM-RT (Cookscape)');
assert.deepStrictEqual(fcmCore.dimensions, { W: 1200, H: 720, D: 560 });
assert.strictEqual(fcmCore.unitConfig.fixedPanel.enabled, true);
assert.strictEqual(fcmCore.unitConfig.fixedPanel.width, 600);
assert.strictEqual(fcmCore.unitConfig.openShutter.enabled, true);
assert.strictEqual(fcmCore.unitConfig.openShutter.width, 600);
assert.strictEqual(fcmCore.unitConfig.openShutter.opening, 'right');
assert.strictEqual(fcmCore.unitConfig.handle, 'pull');
console.log('✔ Core.FURNITURE_CATALOG fcm-rt verified');

const fmRtCore = Core.FURNITURE_CATALOG.find(u => u.id === 'fm-rt-01');
assert(fmRtCore, 'fm-rt-01 must exist in Core.FURNITURE_CATALOG');
assert.strictEqual(fmRtCore.name, 'FCM-RT (Cookscape)');
assert.deepStrictEqual(fmRtCore.dimensions, { W: 1200, H: 720, D: 560 });
assert.strictEqual(fmRtCore.unitConfig.openShutter.opening, 'right');
assert.strictEqual(fmRtCore.unitConfig.handle, 'pull');
console.log('✔ Core.FURNITURE_CATALOG fm-rt-01 verified');

// 2. units_data.json check
const unitsData = JSON.parse(fs.readFileSync('units_data.json', 'utf8'));
const fcmData = unitsData.find(u => u.id === 'fcm-rt');
assert(fcmData, 'fcm-rt must exist in units_data.json');
assert.strictEqual(fcmData.name, 'FCM-RT (Cookscape)');
assert.strictEqual(fcmData.dimensions.W, 1200);
assert.strictEqual(fcmData.dimensions.H, 720);
assert.strictEqual(fcmData.dimensions.D, 560);
console.log('✔ units_data.json verified');

// 3. units.csv check
const csv = fs.readFileSync('units.csv', 'utf8');
assert(csv.includes('fcm-rt,FCM-RT (Cookscape)'), 'units.csv must contain fcm-rt with FCM-RT (Cookscape)');
assert(csv.includes('fm-rt-01,FCM-RT (Cookscape)'), 'units.csv must contain fm-rt-01 with FCM-RT (Cookscape)');
console.log('✔ units.csv verified');

// 4. orbix-unit-icons check
const Icons = require('../orbix-unit-icons.js');
const iconSrc = Icons.getIcon({ id: 'fcm-rt' });
assert(iconSrc && iconSrc.length > 0, 'Icons.getIcon must return valid icon for fcm-rt');
console.log('✔ orbix-unit-icons.js verified');

// 5. index.html spotlight and select option check
const html = fs.readFileSync('index.html', 'utf8');
assert(html.includes('value="fcm-rt"'), 'index.html must have select option for fcm-rt');
assert(html.includes('FCM-RT (Cookscape)'), 'index.html must reference FCM-RT (Cookscape)');
console.log('✔ index.html verified');

console.log('\nAll FCM-RT (Cookscape) tests passed successfully!');
