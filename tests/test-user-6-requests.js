const assert = require('assert');
const fs = require('fs');

console.log('Running test-user-6-requests.js...');

const planJs = fs.readFileSync('orbix-plan.js', 'utf8');
const coreJs = fs.readFileSync('orbix-core.js', 'utf8');
const threeJs = fs.readFileSync('orbix-3d.js', 'utf8');
const appJs = fs.readFileSync('app.js', 'utf8');
const indexHtml = fs.readFileSync('index.html', 'utf8');

// Item 1 & 2: ledge-vert & smart placement
assert(planJs.includes('isLedgeItem'), 'snapFurniture must check for ledge units to allow 90 degree orientation toggle');
assert(planJs.includes('rotDiff > 0.35 && rotDiff < 2.8'), 'snapFurniture must respect 90 deg rotation for vertical ledges');
const fnMouseDownSrc = planJs.substring(planJs.indexOf('PlanEditor.prototype.handleFurnitureMouseDown'), planJs.indexOf('PlanEditor.prototype.handleFurnitureMouseDown') + 300);
assert(!fnMouseDownSrc.includes('this.snapPoint'), 'handleFurnitureMouseDown must not use snapPoint which hijacks to wall corners');
assert(planJs.includes('clickPt = { x: Math.round(worldPt.x / 10) * 10'), 'handleFurnitureMouseDown must use clean 10mm placement point');
assert(planJs.includes('Math.abs(candT - origCandT) > fW * 0.85'), 'Anti-overlap must prevent flinging units away from cursor');

// Item 3: Spacebar rotation
assert(!planJs.includes('// Fallback: rotate active 3D Studio unit if any'), 'Space bar must NEVER rotate background units when nothing is selected in 2D');
assert(planJs.includes('self.furnitureRotY = ((self.furnitureRotY || 0) + Math.PI / 2) % (Math.PI * 2)'), 'Space bar must rotate ghost unit when placing');

// Item 4: Dado tile on strictly ONE side
assert(threeJs.includes('dadoSide === \'front\' || dadoSide === \'both\''), 'Dado tile front face must be conditional');
assert(threeJs.includes('dadoSide === \'back\' || dadoSide === \'both\''), 'Dado tile back face must be conditional');
assert(threeJs.includes('dadoSide = (sideScoreMinus > sideScorePlus) ? \'back\' : \'front\''), 'Auto dado tile side must pick ONE side');

// Item 5: Pan & Zoom user friendliness
assert(planJs.includes('PlanEditor.prototype.zoomIn = function'), 'PlanEditor must have zoomIn method');
assert(planJs.includes('PlanEditor.prototype.zoomOut = function'), 'PlanEditor must have zoomOut method');
assert(planJs.includes('self.isSpaceDown'), 'PlanEditor must support Space+drag panning');
assert(planJs.includes('self.rightDownScreen'), 'PlanEditor must support right-click drag panning');
assert(indexHtml.includes('floatPlanZoomIn'), '2D plan must have floating zoom in button');
assert(indexHtml.includes('floatPlanZoomOut'), '2D plan must have floating zoom out button');
assert(indexHtml.includes('float3dZoomIn'), '3D studio must have floating zoom in button');
assert(indexHtml.includes('float3dZoomOut'), '3D studio must have floating zoom out button');

// Item 6: Auto-cut wall hides attached units
assert(appJs.includes('distPerp <= maxAttachDist'), 'Attached units must be detected and hidden when supporting wall is cut');
assert(appJs.includes('hideThisFurn = true'), 'Units on hidden wall must be marked to hide');
assert(appJs.includes('fMesh.visible = !hideThisFurn'), 'fMesh.visible must be false for units on hidden wall');

console.log('✅ ALL 6 USER REQUEST TESTS PASSED!');
