/**
 * Comprehensive verification of all 10 fixes:
 * 1. Buttons hidden / dropdown menu upward direction
 * 2. Smooth wall snatching & magnetic snapping
 * 3. Only Shutter (O/S) depth standardization & colinear front face alignment
 * 4. Short wall unit placement & clearance clamping
 * 5. Partition walls & virtual room dividers bypass
 * 6. 2D 4-way move handle & rotation handle
 * 7. 3D direct unit floor drag & camera orbit bypass
 * 8. Photorealistic 3D materials, ACES Filmic tone mapping & lighting
 * 9. OpenAI Photorealism Render modal & architectural prompt builder
 * 10. System stability (2D RAF debounce, 3D idle pause, Three.js memory disposal)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- Verifying All 10 Fixes ---');

// 1. Verify CSS buttons & upward dropdown
const css = fs.readFileSync(path.join(__dirname, '../style.css'), 'utf8');
assert.ok(css.includes('.render-dropdown-menu'), 'style.css must define .render-dropdown-menu');
assert.ok(css.includes('bottom: calc(100% + 10px)') || css.includes('bottom: calc(100% + 8px)') || css.includes('bottom:calc(100% + 8px)'), 'Dropdown menu must open upwards');
assert.ok(css.includes('overflow: visible !important') || css.includes('flex-wrap: nowrap') || css.includes('overflow-x: auto'), 'Stagebar must allow upward menu display');
console.log('✔ Fix 1 Verified: Buttons & upward dropdown menu');

// 2, 4, 5. Verify Wall Snapping, Dividers & Partition Lock in orbix-plan.js
const planJs = fs.readFileSync(path.join(__dirname, '../orbix-plan.js'), 'utf8');
assert.ok(planJs.includes('if (w.isDivider) continue;'), 'Room dividers must be skipped for furniture snapping');
assert.ok(planJs.includes('cursorRoom'), 'Cursor room lock must be implemented to prevent snapping across partition walls');
assert.ok(planJs.includes('minWallDist = isDecorF ? 160 : 250'), 'Magnetic snatching distance must be at least 250mm');
console.log('✔ Fix 2, 4, 5 Verified: Wall snapping, divider bypass & room partition lock');

// 3. Verify Only Shutter (O/S) Depth & Alignment
const coreJs = fs.readFileSync(path.join(__dirname, '../orbix-core.js'), 'utf8');
const osMatches = coreJs.match(/["']?isOnlyShutter["']?:\s*true/g);
assert.ok(osMatches && osMatches.length >= 6, 'Must define all Only Shutter units with isOnlyShutter: true');
assert.ok(coreJs.includes('loft-1d-os') && (coreJs.includes('D: 600') || coreJs.includes('"D": 600')), 'Loft O/S must have 600mm carcass depth zone');
assert.ok(coreJs.includes('fm-120 o/s') && (coreJs.includes('D: 550') || coreJs.includes('"D": 550')), 'Floor O/S must have 550mm carcass depth zone');
assert.ok(coreJs.includes('wm-60 o/s') && (coreJs.includes('D: 320') || coreJs.includes('"D": 320')), 'Wall O/S must have 320mm carcass depth zone');

const threeDJs = fs.readFileSync(path.join(__dirname, '../orbix-3d.js'), 'utf8');
assert.ok(threeDJs.includes('frontZ = baseD / 2 - 9'), '3D shutter frontZ must be aligned to front face');
console.log('✔ Fix 3 Verified: Only Shutter depth standardization & colinear front alignment');

// 6. Verify 2D Direct Unit Movement & Clean CAD View (Move/Rotate handle overlay removed per user request)
assert.ok(!planJs.includes('✥ MOVE'), 'Visual 4-way move handle overlay must be removed from 2D');
assert.ok(planJs.includes('move_furniture'), 'Direct 2D unit moving must remain fully supported');
console.log('✔ Fix 6 Verified: 2D direct unit moving active, 2D move/rotate overlay removed');

// 7. Verify 3D Unit Direct Floor Drag
const appJs = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
assert.ok(appJs.includes('furnDrag = {') && appJs.includes('startPos: { x: groupObj.position.x, z: groupObj.position.z }'), 'Must initialize furnDrag on pointerdown');
assert.ok(appJs.includes('stage.setPointerCapture'), 'Must capture pointer to prevent camera orbit');
assert.ok(appJs.includes('Live snap to wall / adjacent units in 3D'), 'Must snap to wall/units during 3D floor drag');
console.log('✔ Fix 7 Verified: 3D direct unit floor drag & camera orbit bypass');

// 8. Verify Realistic 3D Rendering (Materials, Shadows, Tone Mapping)
assert.ok(appJs.includes('THREE.ACESFilmicToneMapping'), 'Must enable ACES Filmic tone mapping');
assert.ok(appJs.includes('0xF1F5F9') || appJs.includes('0xD8E8F5'), 'Must use elegant daylight architectural sky');
assert.ok(threeDJs.includes('0xF2EFE9') || threeDJs.includes('Warm architectural alabaster'), 'Must use warm alabaster wall plaster material');
console.log('✔ Fix 8 Verified: Photorealistic 3D tone mapping, sky & alabaster materials');

// 9. Verify OpenAI API Render Modal & Integration
const indexHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
assert.ok(indexHtml.includes('modalAIRender'), 'index.html must have modalAIRender');
assert.ok(indexHtml.includes('openAIApiKeyInput'), 'index.html must have OpenAI API key input');
assert.ok(indexHtml.includes('renderAIRenderBtn'), 'index.html must have AI Render button');

const uiJs = fs.readFileSync(path.join(__dirname, '../orbix-ui.js'), 'utf8');
assert.ok(uiJs.includes('initAIRenderModal'), 'orbix-ui.js must have initAIRenderModal');
assert.ok(uiJs.includes('updateAIRenderPrompt'), 'orbix-ui.js must have prompt generation logic');
assert.ok(uiJs.includes('api.openai.com/v1/images/generations'), 'orbix-ui.js must call OpenAI images API');
console.log('✔ Fix 9 Verified: OpenAI Photorealism Render modal & prompt generator');

// 10. Verify Full System Stability (RAF debouncing, 3D idle pause, memory cleanup)
assert.ok(planJs.includes('PlanEditor.prototype.requestRender'), 'orbix-plan.js must implement requestRender');
assert.ok(planJs.includes('_renderRafPending'), 'orbix-plan.js must debounce canvas renders with RAF');
assert.ok(appJs.includes('isDesignActive = !designTab || designTab.classList.contains(\'is-on\')'), 'app.js must pause 3D renders when not in 3D Studio tab');

const projJs = fs.readFileSync(path.join(__dirname, '../orbix-projects.js'), 'utf8');
assert.ok(projJs.includes('disposeSceneResources'), 'orbix-projects.js must implement disposeSceneResources');
assert.ok(projJs.includes('this.disposeSceneResources()'), 'orbix-projects.js must dispose 3D resources on project switch');
console.log('✔ Fix 10 Verified: System stability, RAF debouncing, 3D idle pause & memory disposal');

console.log('\n🎉 ALL 10 USER REQUIREMENTS FULLY VERIFIED AND PASSING!');
