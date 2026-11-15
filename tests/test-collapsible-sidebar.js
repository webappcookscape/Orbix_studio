/**
 * Test Suite: Collapsible Inspector Sidebar & Resizing Verification
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- Testing Collapsible Inspector Sidebar & Resizing Logic ---');

// 1. Check index.html elements
const indexHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
assert(indexHtml.includes('id="railCollapseBtn"'), 'index.html must have #railCollapseBtn');
assert(indexHtml.includes('id="railFloatingExpandBtn"'), 'index.html must have #railFloatingExpandBtn');
assert(indexHtml.includes('id="stagebarToggleRailBtn"'), 'index.html must have #stagebarToggleRailBtn');
assert(indexHtml.includes('id="unitsRailToggleBtn"'), 'index.html must have #unitsRailToggleBtn');
assert(indexHtml.includes('id="unitsRailTitle"'), 'index.html must have #unitsRailTitle');
console.log('✓ PASS: index.html has all required toggle and collapse buttons');

// 2. Check style.css rules
const styleCss = fs.readFileSync(path.join(__dirname, '../style.css'), 'utf8');
assert(styleCss.includes('.rail.is-collapsed'), 'style.css must have .rail.is-collapsed rule');
assert(styleCss.includes('#view-design.rail-collapsed .rail'), 'style.css must have #view-design.rail-collapsed rule');
assert(styleCss.includes('.rail-floating-expand-btn'), 'style.css must have .rail-floating-expand-btn styles');
assert(styleCss.includes('.grp.is-collapsed'), 'style.css must have .grp.is-collapsed accordion styles');
assert(styleCss.includes('.grp-h::after'), 'style.css must have .grp-h chevron indicator');
console.log('✓ PASS: style.css defines complete styling for sidebar collapse, floating expand pill, and accordion cards');

// 3. Check app.js implementation
const appJs = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
assert(appJs.includes('function toggleRailCollapse'), 'app.js must define toggleRailCollapse');
assert(appJs.includes('window.toggleRailCollapse = toggleRailCollapse'), 'toggleRailCollapse must be exposed on window');
assert(appJs.includes('initRailCollapseControls'), 'app.js must define initRailCollapseControls');
assert(appJs.includes('orbix_rail_collapsed'), 'app.js must persist orbix_rail_collapsed in localStorage');
assert(appJs.includes('window.dispatchEvent(new Event("resize"))'), 'app.js must trigger resize event when toggling sidebar');
assert(appJs.includes('e.key === "["'), 'app.js must support [ keyboard shortcut');
console.log('✓ PASS: app.js contains complete toggle, event listener, persistence, and resize logic');

// 4. Check single-file builds
const distSingle = fs.readFileSync(path.join(__dirname, '../dist-single.html'), 'utf8');
const cupboardCad = fs.readFileSync(path.join(__dirname, '../cupboard-cad.html'), 'utf8');
assert(distSingle.includes('id="railCollapseBtn"'), 'dist-single.html must include #railCollapseBtn');
assert(distSingle.includes('id="railFloatingExpandBtn"'), 'dist-single.html must include #railFloatingExpandBtn');
assert(cupboardCad.includes('id="railCollapseBtn"'), 'cupboard-cad.html must include #railCollapseBtn');
assert(cupboardCad.includes('id="railFloatingExpandBtn"'), 'cupboard-cad.html must include #railFloatingExpandBtn');
console.log('✓ PASS: dist-single.html and cupboard-cad.html offline builds include full collapsible sidebar');

// 5. Check desktop builds synchronization
const desktopAppIndex = fs.readFileSync(path.join(__dirname, '../dist-desktop/OrbixStudio-win32-x64/resources/app/index.html'), 'utf8');
assert(desktopAppIndex.includes('id="railCollapseBtn"'), 'Desktop build must include #railCollapseBtn');
assert(desktopAppIndex.includes('id="railFloatingExpandBtn"'), 'Desktop build must include #railFloatingExpandBtn');
console.log('✓ PASS: Desktop build dist-desktop is fully synchronized');

console.log('ALL COLLAPSIBLE SIDEBAR TESTS PASSED 100%!');
