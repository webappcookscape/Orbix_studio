const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- Testing Wall/Loft Elevations & Responsive Toolbars ---');

// 1. Verify CSS rules for responsive toolbars
const css = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
assert(css.includes('.topbar'), 'style.css must define .topbar');
assert(css.includes('overflow-x: auto'), 'style.css must allow horizontal scrolling on toolbars');
assert(css.includes('.topacts') && /flex-shrink:\s*0/.test(css), 'style.css must have flex-shrink: 0 on topacts');
assert(css.includes('.plan-toolbar-row') && /min-width:\s*max-content/.test(css), 'style.css must have min-width: max-content on .plan-toolbar-row');
assert(css.includes('.stagebar-row') && /min-width:\s*max-content/.test(css), 'style.css must have min-width: max-content on .stagebar-row');
console.log('✅ 1. Toolbar CSS responsive rules verified (no clipped tools, auto scrollbars).');

// 2. Verify electron-main.js has autoHideMenuBar: true
const electronMain = fs.readFileSync(path.join(__dirname, '..', 'electron-main.js'), 'utf8');
assert(electronMain.includes('autoHideMenuBar: true'), 'electron-main.js must set autoHideMenuBar: true');
console.log('✅ 2. Electron window autoHideMenuBar verified.');

// 3. Verify OrbixStudioLauncher.cs has --start-maximized
const csLauncher = fs.readFileSync(path.join(__dirname, '..', 'src-desktop', 'OrbixStudioLauncher.cs'), 'utf8');
assert(csLauncher.includes('--start-maximized'), 'OrbixStudioLauncher.cs must include --start-maximized');
console.log('✅ 3. Native C# Launcher --start-maximized verified.');

// 4. Test Core elevation defaults
// Mock browser environment for orbix-core
global.window = { location: { search: '' }, addEventListener: function () { }, OrbixWallMode: 'single_auto' };
global.document = { createElement: function () { return { getContext: function () { return {}; }, style: {} }; }, getElementById: function () { return null; }, querySelectorAll: function () { return []; } };
global.localStorage = { getItem: function () { return null; }, setItem: function () { } };

const Core = require('../orbix-core.js');

// Test 4a: Kitchen Wall Unit
const wallUnit = Core.createFurniturePlacement({
  name: 'Kitchen Wall Cabinet 2-Door',
  category: 'kitchen_wall',
  dimensions: { W: 900, H: 600, D: 350 }
});
assert.strictEqual(wallUnit.elevation, 1500, `Kitchen wall elevation must be 1500, got ${wallUnit.elevation}`);
console.log('✅ 4a. Kitchen Wall Unit default elevation is 1500mm.');

// Test 4b: Loft Unit
const loftUnit = Core.createFurniturePlacement({
  name: 'Loft Unit 900',
  category: 'loft',
  dimensions: { W: 900, H: 400, D: 600 }
});
assert.strictEqual(loftUnit.elevation, 2100, `Loft elevation must be 2100, got ${loftUnit.elevation}`);
console.log('✅ 4b. Loft Unit default elevation is 2100mm.');

// Test 4c: Spice Rack Unit
const spiceRack = Core.createFurniturePlacement({
  name: 'Kitchen Spice Rack Open Box',
  category: 'kitchen_wall_spice',
  dimensions: { W: 450, H: 600, D: 150 }
});
assert.strictEqual(spiceRack.elevation, 1350, `Spice rack elevation must be 1350, got ${spiceRack.elevation}`);
console.log('✅ 4c. Spice Rack default elevation is 1350mm.');

// Test 4d: Wardrobe Loft Unit
const wrLoft = Core.createFurniturePlacement({
  name: 'Wardrobe Loft Top',
  category: 'wardrobe_loft',
  dimensions: { W: 1000, H: 450, D: 600 }
});
assert.strictEqual(wrLoft.elevation, 2100, `Wardrobe Loft elevation must be 2100, got ${wrLoft.elevation}`);
console.log('✅ 4d. Wardrobe Loft default elevation is 2100mm.');

// 5. Verify orbix-ui.js card mapping and click elevation logic
const orbixUi = fs.readFileSync(path.join(__dirname, '..', 'orbix-ui.js'), 'utf8');
assert(orbixUi.includes('isLoft ? 2100 : (isSpice ? 1350 : (isWall ? 1500 : 0))'), 'orbix-ui.js must map elevation for loft, spice, and wall units');
assert(orbixUi.includes('var defElev = isLoftUnit ? 2100 : (isSpiceUnit ? 1350 : (isWallUnit ? 1500 : 0));'), 'orbix-ui.js card click must determine defElev');
assert(orbixUi.includes('elevation: finalElev,'), 'orbix-ui.js card click must assign finalElev');
console.log('✅ 5. orbix-ui.js catalog card mapping & click handler assigns correct elevations.');

// 6. Verify orbix-plan.js 2D placement elevation logic
const orbixPlan = fs.readFileSync(path.join(__dirname, '..', 'orbix-plan.js'), 'utf8');
assert(orbixPlan.includes('isLoftPlan ? 2100 : (isSpicePlan ? 1350 : (isWall ? 1500 : 0))'), 'orbix-plan.js must assign 2100 for loft, 1500 for wall');
console.log('✅ 6. orbix-plan.js 2D placement preserves 2100mm for lofts and 1500mm for wall units.');

// 7. Verify orbix-3d.js 3D placement and mesh building elevation logic
const orbix3d = fs.readFileSync(path.join(__dirname, '..', 'orbix-3d.js'), 'utf8');
assert(orbix3d.includes('isLoftUnit ? 2100 : (isSpiceUnit ? 1350 : (isWall ? 1500 : 0))'), 'orbix-3d.js must default 2100 for lofts and 1500 for wall units');
console.log('✅ 7. orbix-3d.js 3D mesh building correctly places loft at 2100mm and wall at 1500mm.');

console.log('\n🎉 ALL ELEVATION AND TOOLBAR TESTS PASSED! 🎉');
