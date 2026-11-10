const assert = require('assert');
const fs = require('fs');

console.log('Testing FCM-RT (Cookscape) 3D and CAD behavior...');

// 1. Check orbix-3d.js
const orbix3dSrc = fs.readFileSync('orbix-3d.js', 'utf8');
assert(orbix3dSrc.includes('hasFixedPanel'), 'orbix-3d.js must have hasFixedPanel');
assert(orbix3dSrc.includes('isFixedPanel: true'), 'orbix-3d.js must tag left fixed panel with isFixedPanel: true');
assert(orbix3dSrc.includes('ShutterHinge_Right'), 'orbix-3d.js must have ShutterHinge_Right for movable right shutter');
assert(orbix3dSrc.includes('Math.PI * 0.55'), 'orbix-3d.js must swing right shutter outward to the right');
assert(orbix3dSrc.includes('dividerX = isFcmUnit'), 'orbix-3d.js must have internal divider for FCM-RT');
console.log('✔ orbix-3d.js 3D door & carcass architecture verified');

// 2. Check app.js
const appSrc = fs.readFileSync('app.js', 'utf8');
assert(appSrc.includes('// FCM-RT (Cookscape): Left 600mm panel is 100% FIXED'), 'app.js must handle FCM-RT with fixed left panel');
assert(appSrc.includes('frontParts(u, ds, fixCx, 3, fixW - 3, u.H - 6, zF, SC, T, "front").forEach(function (p) { bx(p); });'), 'app.js must add static left panel without door binding');
assert(appSrc.includes('hinged(movCx, 3, movW, u.H - 6, zF, isHl, frontParts(u, ds, movCx, 3, movW, u.H - 6, zF, SC, T, "door"));'), 'app.js must add right shutter with hinged door binding');
assert(appSrc.includes('ShutterHinge_Right'), 'app.js must recognize ShutterHinge_Right');
assert(appSrc.includes('{ id: \'pull\', label: \'Pull Handle\''), 'app.js must include pull handle definition');
console.log('✔ app.js unit CAD & toggleDoor verified');

// 3. Check orbix-ui.js
const uiSrc = fs.readFileSync('orbix-ui.js', 'utf8');
assert(uiSrc.includes('isExistingFcm') || uiSrc.includes('isFcm'), 'orbix-ui.js must handle FCM-RT sync');
assert(uiSrc.includes('fixedPanel:'), 'orbix-ui.js must copy fixedPanel');
assert(uiSrc.includes('openShutter:'), 'orbix-ui.js must copy openShutter');
console.log('✔ orbix-ui.js state synchronization verified');

console.log('\nAll 3D & CAD tests passed successfully!');

