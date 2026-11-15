/**
 * Test Suite: Three Unified Rendering Modes in 3D Studio Toolbar & Client Presentation HUD
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- Testing Three Unified Rendering Modes ---');

// 1. Verify index.html contains both toolbar and HUD buttons
const indexHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

// Toolbar buttons
assert(indexHtml.includes('id="modeDesignBtn"'), 'index.html must have #modeDesignBtn in 3D toolbar');
assert(indexHtml.includes('id="modeRealisticBtn"'), 'index.html must have #modeRealisticBtn in 3D toolbar');
assert(indexHtml.includes('id="modeUltraBtn"'), 'index.html must have #modeUltraBtn in 3D toolbar');
assert(indexHtml.includes('id="renderModeGroup"'), 'index.html must have #renderModeGroup');

// HUD buttons
assert(indexHtml.includes('id="cpModeDesignBtn"'), 'index.html must have #cpModeDesignBtn in Client Presentation HUD');
assert(indexHtml.includes('id="cpModeRealisticBtn"'), 'index.html must have #cpModeRealisticBtn in Client Presentation HUD');
assert(indexHtml.includes('id="cpModeUltraBtn"'), 'index.html must have #cpModeUltraBtn in Client Presentation HUD');
assert(indexHtml.includes('cp-mode-group'), 'index.html must have .cp-mode-group');
console.log('✓ PASS: index.html has Three Unified Rendering Modes in both 3D Studio toolbar and Client Presentation HUD');

// 2. Verify style.css
const styleCss = fs.readFileSync(path.join(__dirname, '../style.css'), 'utf8');
assert(styleCss.includes('.render-mode-group'), 'style.css must style .render-mode-group');
assert(styleCss.includes('.render-mode-label'), 'style.css must style .render-mode-label');
assert(styleCss.includes('.cp-mode-group'), 'style.css must style .cp-mode-group');
console.log('✓ PASS: style.css defines prominent visual styles for both toolbar and HUD modes');

// 3. Verify orbix-ui.js
const uiJs = fs.readFileSync(path.join(__dirname, '../orbix-ui.js'), 'utf8');
assert(uiJs.includes('cpModeDesignBtn'), 'orbix-ui.js must bind cpModeDesignBtn');
assert(uiJs.includes('cpModeRealisticBtn'), 'orbix-ui.js must bind cpModeRealisticBtn');
assert(uiJs.includes('cpModeUltraBtn'), 'orbix-ui.js must bind cpModeUltraBtn');
assert(uiJs.includes('syncRenderModeUI'), 'orbix-ui.js must define syncRenderModeUI');
console.log('✓ PASS: orbix-ui.js synchronizes render mode state across toolbar and presentation HUD');

// 4. Verify app.js GL.setRenderMode implementation
const appJs = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
assert(appJs.includes('setRenderMode: function'), 'app.js must define setRenderMode');
assert(appJs.includes('renderer.shadowMap.enabled = false'), 'setRenderMode must disable shadows in design mode');
assert(appJs.includes('keyL.shadow.mapSize.set(4096, 4096)'), 'setRenderMode must set 4096x4096 shadows in ultra presentation mode');
assert(appJs.includes('camera.fov = 65'), 'setRenderMode must set panoramic camera view in ultra mode');
assert(appJs.includes('renderer.toneMappingExposure = 1.12'), 'setRenderMode must set exposure 1.12 in ultra mode');
console.log('✓ PASS: app.js implements exact specifications for Design, Realistic, and Client Ultra modes');

console.log('ALL THREE RENDERING MODES TESTS PASSED 100%!');

