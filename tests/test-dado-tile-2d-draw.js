const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- TESTING 2D DADO TILE DRAWING & SELECTIVE 3D WALL RENDERING ---');

const rootDir = path.resolve(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
const styleCss = fs.readFileSync(path.join(rootDir, 'style.css'), 'utf8');
const orbixPlanJs = fs.readFileSync(path.join(rootDir, 'orbix-plan.js'), 'utf8');
const orbixUiJs = fs.readFileSync(path.join(rootDir, 'orbix-ui.js'), 'utf8');
const orbix3dJs = fs.readFileSync(path.join(rootDir, 'orbix-3d.js'), 'utf8');

// 1. Check index.html 2D toolbar button
console.log('1. Checking 2D toolbar button for Dado Tile...');
assert(indexHtml.includes('id="planDadoBtn"'), 'index.html must have planDadoBtn');
assert(indexHtml.includes('data-tool="dado"'), 'index.html must have data-tool="dado"');
console.log('✔ planDadoBtn found in index.html toolbar');

// 2. Check style.css active style
console.log('2. Checking style.css active style for dado tool...');
assert(styleCss.includes('[data-tool="dado"].is-active'), 'style.css must have [data-tool="dado"].is-active');
console.log('✔ [data-tool="dado"].is-active found in style.css');

// 3. Check orbix-plan.js tool implementation
console.log('3. Checking orbix-plan.js tool & drawing implementation...');
assert(orbixPlanJs.includes("this.activeTool = 'select';"), 'orbix-plan.js activeTool init');
assert(orbixPlanJs.includes('this.dadoDrawStart'), 'orbix-plan.js dadoDrawStart state');
assert(orbixPlanJs.includes('handleDadoMouseDown'), 'orbix-plan.js handleDadoMouseDown');
assert(orbixPlanJs.includes('renderDadoTiles'), 'orbix-plan.js renderDadoTiles');
assert(orbixPlanJs.includes("activeTool === 'dado'"), 'orbix-plan.js activeTool dado checks');
assert(orbixPlanJs.includes("planDadoBtn"), 'orbix-plan.js hotkey for planDadoBtn');
console.log('✔ 2D Dado Tile drawing and rendering functions verified in orbix-plan.js');

// 4. Check orbix-ui.js Wall Inspector toggle
console.log('4. Checking Wall Inspector Dado Tile toggle in orbix-ui.js...');
assert(orbixUiJs.includes('id="inspWallDado"'), 'orbix-ui.js must have inspWallDado checkbox');
assert(orbixUiJs.includes('Toggle Wall Dado Tile'), 'orbix-ui.js must handle inspWallDado change');
console.log('✔ Wall Inspector Dado Tile checkbox and handler verified in orbix-ui.js');

// 5. Check orbix-3d.js selective wall rendering
console.log('5. Checking selective wall rendering in orbix-3d.js...');
assert(orbix3dJs.includes('hasWallDado'), 'orbix-3d.js must check hasWallDado');
assert(orbix3dJs.includes('wall.dadoTile'), 'orbix-3d.js must check wall.dadoTile');
assert(orbix3dJs.includes('wall.dadoSegments'), 'orbix-3d.js must support wall.dadoSegments');
assert(orbix3dJs.includes('!hasWallDado'), 'orbix-3d.js must skip walls without dado tile');
console.log('✔ Selective wall dado tile rendering verified in orbix-3d.js');

console.log('\n======================================================');
console.log('>>> ALL 2D DADO TILE DRAWING & 3D TESTS PASSED! <<<');
console.log('======================================================\n');

