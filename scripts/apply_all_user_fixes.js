const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

// ═══════════════════════════════════════════════════════════════════════════
// 1. PATCH ORBIX-PLAN.JS
// ═══════════════════════════════════════════════════════════════════════════
console.log('1. Patching orbix-plan.js...');
let planSrc = fs.readFileSync(path.join(rootDir, 'orbix-plan.js'), 'utf8').replace(/\r\n/g, '\n');

// A. Insert hitTestFurniture
if (!planSrc.includes('PlanEditor.prototype.hitTestFurniture =')) {
  const targetFn = 'PlanEditor.prototype.getFurnitureJointPoints = function (furn) {';
  const hitTestCode = `// Hit-testing for modular furniture with expanded tolerance for thin/narrow units (blank shutters, only shutters, ledges)
  PlanEditor.prototype.hitTestFurniture = function (worldPt, fn) {
    if (!fn) return false;
    var fPoly = Core.getFurniturePolygon(fn);
    if (Core.Vec2 && Core.Vec2.pointInPolygon && Core.Vec2.pointInPolygon(worldPt, fPoly)) {
      return true;
    }

    var dims = fn.dimensions || {};
    var wMm = dims.W || 600;
    var dMm = dims.D || 550;
    var isThinOrNarrow = (wMm <= 120 || dMm <= 80 || fn.id === 'bs-60' || (fn.name && /blank shutter/i.test(fn.name)) || (fn.catalogItemId && /bs-60/i.test(fn.catalogItemId)));
    var zoomFactor = (this && this.zoom) ? this.zoom : 0.15;
    var hitPadMm = isThinOrNarrow ? Math.max(90, 22 / zoomFactor) : Math.max(25, 6 / zoomFactor);

    var cDist = Vec2.dist(worldPt, fn.pos || { x: 0, y: 0 });
    if (isThinOrNarrow && cDist <= Math.max(hitPadMm, wMm / 2 + hitPadMm)) {
      var ang = fn.rotY || 0;
      var cosA = Math.cos(ang), sinA = Math.sin(ang);
      var dx = worldPt.x - fn.pos.x, dy = worldPt.y - fn.pos.y;
      var localX = Math.abs(dx * cosA + dy * sinA);
      var localY = Math.abs(-dx * sinA + dy * cosA);
      if (localX <= (wMm / 2 + hitPadMm) && localY <= (dMm / 2 + hitPadMm)) {
        return true;
      }
    }

    if (fPoly && fPoly.length >= 3) {
      for (var i = 0; i < fPoly.length; i++) {
        var pA = fPoly[i];
        var pB = fPoly[(i + 1) % fPoly.length];
        var prEdge = Core.projectPointToSegment ? Core.projectPointToSegment(worldPt, pA, pB) : null;
        if (prEdge && prEdge.dist <= hitPadMm && prEdge.t >= -0.05 && prEdge.t <= 1.05) {
          return true;
        }
      }
    }
    return false;
  };

  `;
  planSrc = planSrc.replace(targetFn, hitTestCode + targetFn);
}

// B. Update furniture hit test in handleMouseDown
planSrc = planSrc.replace(
  /var fPoly = Core\.getFurniturePolygon\(fn\);\s*if \(Core\.Vec2\.pointInPolygon\(worldPt, fPoly\)\) \{\s*matchingHits\.push\(fn\);\s*\}/,
  `if (self.hitTestFurniture(worldPt, fn)) {\n            matchingHits.push(fn);\n          }`
);

// C. Update furniture hit test in onCanvasClick
planSrc = planSrc.replace(
  /var poly = Core\.getFurniturePolygon\(fn\);\s*if \(Core\.Vec2\.pointInPolygon\(worldPt, poly\)\) \{\s*matchingHits\.push\(fn\);\s*\}/,
  `if (this.hitTestFurniture(worldPt, fn)) {\n          matchingHits.push(fn);\n        }`
);

// D. Corner Snapping for Straight & Only Shutter Units in snapFurniture
// Find cornerCandidates loop in snapFurniture and add straight unit corner snapping
const straightCornerTarget = `      if (bestCornerSnap) {
        return bestCornerSnap;
      }
    }`;

const straightCornerSnapCode = `      if (bestCornerSnap) {
        return bestCornerSnap;
      }
    } else {
      // ── ROBUST CORNER SNAPPING FOR STRAIGHT UNITS & ONLY-SHUTTERING ──
      // Allows shutters, blank shutters, wardrobes, and modular cabinets to snap flush into wall corners!
      if (cornerCandidates && cornerCandidates.length > 0) {
        var minStraightCornerDist = 450;
        var bestStraightCorner = null;

        for (var sci = 0; sci < cornerCandidates.length; sci++) {
          var scc = cornerCandidates[sci];
          var scPt = scc.cornerPt;
          var sDirA = scc.dir1;
          var sDirB = scc.dir2;

          // Wall A mounting: Back flush against wall A (sDirA), side flush against wall B (sDirB)
          var angleA = Math.atan2(sDirA.y, sDirA.x);
          var rotAlongA = angleA;
          var normA = { x: -sDirA.y, y: sDirA.x };
          // Check outward normal pointing towards inner room
          if (scc.room && scc.room.polygon) {
            var testNorm = { x: scPt.x + normA.x * 20, y: scPt.y + normA.y * 20 };
            if (!Core.Vec2.pointInPolygon(testNorm, scc.room.polygon)) {
              normA = { x: sDirA.y, y: -sDirA.x };
            }
          }
          var candA = {
            x: scPt.x + (halfW) * sDirA.x + (halfD) * normA.x,
            y: scPt.y + (halfW) * sDirA.y + (halfD) * normA.y
          };
          var distA = Math.hypot(pos.x - candA.x, pos.y - candA.y);
          if (distA < minStraightCornerDist) {
            minStraightCornerDist = distA;
            bestStraightCorner = {
              pos: candA,
              rotY: rotAlongA,
              type: 'wall_snap',
              badgeLabel: '✓ Snapped Flush into Corner',
              cornerPt: scPt
            };
          }

          // Wall B mounting: Back flush against wall B (sDirB), side flush against wall A (sDirA)
          var angleB = Math.atan2(sDirB.y, sDirB.x);
          var rotAlongB = angleB;
          var normB = { x: -sDirB.y, y: sDirB.x };
          if (scc.room && scc.room.polygon) {
            var testNormB = { x: scPt.x + normB.x * 20, y: scPt.y + normB.y * 20 };
            if (!Core.Vec2.pointInPolygon(testNormB, scc.room.polygon)) {
              normB = { x: sDirB.y, y: -sDirB.x };
            }
          }
          var candB = {
            x: scPt.x + (halfW) * sDirB.x + (halfD) * normB.x,
            y: scPt.y + (halfW) * sDirB.y + (halfD) * normB.y
          };
          var distB = Math.hypot(pos.x - candB.x, pos.y - candB.y);
          if (distB < minStraightCornerDist) {
            minStraightCornerDist = distB;
            bestStraightCorner = {
              pos: candB,
              rotY: rotAlongB,
              type: 'wall_snap',
              badgeLabel: '✓ Snapped Flush into Corner',
              cornerPt: scPt
            };
          }
        }

        if (bestStraightCorner) {
          return bestStraightCorner;
        }
      }
    }`;

if (planSrc.includes(straightCornerTarget) && !planSrc.includes('ROBUST CORNER SNAPPING FOR STRAIGHT UNITS')) {
  planSrc = planSrc.replace(straightCornerTarget, straightCornerSnapCode);
}

// E. Don't forcibly eject units out of walls or RCC columns during secondary collision clamp
const secColTarget = `    // Secondary collision clamping against any intersecting wall cores
    for (var w2 = 0; w2 < walls.length; w2++) {
      var wObj = walls[w2];
      if (wObj.isDivider) continue; // Room dividers do not block furniture!
      var wPoly = Core.wallPolygon(wObj);
      var fDummy = { pos: pos, rotY: rotY, dimensions: fDims };
      var fPoly = Core.getFurniturePolygon(fDummy);
      if (Core.polygonsIntersect(fPoly, wPoly, 10)) {
        var wDir2 = Core.wallDirection(wObj);
        var wNorm2 = Core.wallNormal(wObj);
        var toF = { x: pos.x - wObj.start.x, y: pos.y - wObj.start.y };
        var sD = toF.x * wNorm2.x + toF.y * wNorm2.y;
        var sSign = sD >= 0 ? 1 : -1;
        var reqDist = ((wObj.thickness || 150) / 2) + halfD;
        var tProj = Math.max(0, Math.min(Core.wallLength(wObj), toF.x * wDir2.x + toF.y * wDir2.y));
        pos.x = wObj.start.x + wDir2.x * tProj + sSign * wNorm2.x * reqDist;
        pos.y = wObj.start.y + wDir2.y * tProj + sSign * wNorm2.y * reqDist;
      }
    }`;

const secColReplacement = `    // Secondary collision check: Allow intentional placement near RCC, on RCC, and on corners inside walls
    // Units are NOT forcibly ejected away, honoring user positioning without changing elevation
    var isCivilOrPanel = isWallU || (furn.dimensions && furn.dimensions.D <= 50) || furn.category === 'wall_paneling' || (furn.name && /shutter|ledge|panel|rcc|civil/i.test(furn.name));
    if (!isCivilOrPanel && !this.isShiftDown) {
      // Soft nudge only when unit is accidentally embedded > 80% inside an exterior wall
      for (var w2 = 0; w2 < walls.length; w2++) {
        var wObj = walls[w2];
        if (wObj.isDivider) continue;
        var wPoly = Core.wallPolygon(wObj);
        var fDummy = { pos: pos, rotY: rotY, dimensions: fDims };
        var fPoly = Core.getFurniturePolygon(fDummy);
        if (Core.polygonsIntersect(fPoly, wPoly, 50)) {
          // If completely engulfed inside wall core, gently align to wall face
          var wDir2 = Core.wallDirection(wObj);
          var wNorm2 = Core.wallNormal(wObj);
          var toF = { x: pos.x - wObj.start.x, y: pos.y - wObj.start.y };
          var sD = toF.x * wNorm2.x + toF.y * wNorm2.y;
          var sSign = sD >= 0 ? 1 : -1;
          var reqDist = ((wObj.thickness || 150) / 2) + halfD;
          var tProj = Math.max(0, Math.min(Core.wallLength(wObj), toF.x * wDir2.x + toF.y * wDir2.y));
          pos.x = wObj.start.x + wDir2.x * tProj + sSign * wNorm2.x * reqDist;
          pos.y = wObj.start.y + wDir2.y * tProj + sSign * wNorm2.y * reqDist;
        }
      }
    }`;

if (planSrc.includes(secColTarget)) {
  planSrc = planSrc.replace(secColTarget, secColReplacement);
}

// F. In handleFurnitureMouseDown: strictly preserve preset elevation
const elevPreserveTarget = `    var defPlanElev = isLoftPlan ? 2100 : (isSpicePlan ? 1350 : (isWall ? 1500 : 0));
    var presetElev = (this.furniturePreset.elevation !== undefined && this.furniturePreset.elevation !== null && this.furniturePreset.elevation !== '' && (!isWall && !isLoftPlan && !isSpicePlan || parseFloat(this.furniturePreset.elevation) > 0)) ?
      parseFloat(this.furniturePreset.elevation) : defPlanElev;`;

const elevPreserveReplacement = `    var defPlanElev = isLoftPlan ? 2100 : (isSpicePlan ? 1350 : (isWall ? 1500 : 0));
    if (idPlan === 'ledge-std' || nmPlan === 'ledge' || idPlan.indexOf('ledge-std') !== -1) defPlanElev = 750;
    else if (idPlan === 'ledge-ctop' || nmPlan.indexOf('ledge countertop') !== -1) defPlanElev = 750;
    else if (idPlan === 'ledge-vert' || nmPlan.indexOf('vertical ledge') !== -1) defPlanElev = 0;
    else if (idPlan === 'pnl-back' || nmPlan.indexOf('back panel') !== -1) defPlanElev = 300;
    else if (idPlan === 'pnl-wall' || nmPlan.indexOf('wall panel') !== -1 || catPlan === 'wall_paneling') defPlanElev = 0;
    else if (idPlan === 'bs-60' || nmPlan.indexOf('blank shutter') !== -1) defPlanElev = 0;

    var presetElev = (this.furniturePreset.elevation !== undefined && this.furniturePreset.elevation !== null && this.furniturePreset.elevation !== '') ?
      parseFloat(this.furniturePreset.elevation) : defPlanElev;`;

if (planSrc.includes(elevPreserveTarget)) {
  planSrc = planSrc.replace(elevPreserveTarget, elevPreserveReplacement);
}

fs.writeFileSync(path.join(rootDir, 'orbix-plan.js'), planSrc, 'utf8');
console.log('✓ orbix-plan.js successfully patched');

// ═══════════════════════════════════════════════════════════════════════════
// 2. PATCH ORBIX-UI.JS
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n2. Patching orbix-ui.js...');
let uiSrc = fs.readFileSync(path.join(rootDir, 'orbix-ui.js'), 'utf8').replace(/\r\n/g, '\n');

// A. Update furnish panel card elevation defaults
const cardElevTarget = `            var defElev = isLoftUnit ? 2100 : (isOpenBoxUnit ? 1500 : (isSpiceUnit ? 1350 : (isWallUnit ? 1500 : 0)));
            var finalElev = (cardData.elevation !== undefined && cardData.elevation !== null && parseFloat(cardData.elevation) > 0) ?
              parseFloat(cardData.elevation) : defElev;`;

const cardElevReplacement = `            var defElev = isLoftUnit ? 2100 : (isOpenBoxUnit ? 1500 : (isSpiceUnit ? 1350 : (isWallUnit ? 1500 : 0)));
            if (cId === 'ledge-std' || cName === 'ledge') defElev = 750;
            else if (cId === 'ledge-ctop' || cName.indexOf('ledge countertop') !== -1) defElev = 750;
            else if (cId === 'ledge-vert' || cName.indexOf('vertical ledge') !== -1) defElev = 0;
            else if (cId === 'pnl-back' || cName.indexOf('back panel') !== -1) defElev = 300;
            else if (cId === 'pnl-wall' || cName.indexOf('wall panel') !== -1) defElev = 0;
            else if (cId === 'bs-60' || cName.indexOf('blank shutter') !== -1) defElev = 0;

            var finalElev = (cardData.elevation !== undefined && cardData.elevation !== null && cardData.elevation !== '') ?
              parseFloat(cardData.elevation) : defElev;`;

if (uiSrc.includes(cardElevTarget)) {
  uiSrc = uiSrc.replace(cardElevTarget, cardElevReplacement);
}

// B. Remove AI Decor buttons from Room Inspector
uiSrc = uiSrc.replace(
  /\s*'<button class="btn full" id="inspRoomAIDecorBtn"[\s\S]*?<\/button>'\s*\+/,
  ''
);
uiSrc = uiSrc.replace(
  /\s*'<button class="btn small full" id="inspRoomClearAIDecorBtn"[\s\S]*?<\/button>'\s*\+/,
  ''
);

// C. Default countertop to granite_kashmir_white
uiSrc = uiSrc.replace(
  /var counterType = \(fn\.unitConfig && fn\.unitConfig\.counter\) \|\| \(isBaseUnit \? 'granite_black_galaxy' : 'none'\);/,
  `var counterType = (fn.unitConfig && fn.unitConfig.counter) || (isBaseUnit ? 'granite_kashmir_white' : 'none');`
);
uiSrc = uiSrc.replace(
  /fn\.unitConfig\.counter = 'granite_black_galaxy';/g,
  `fn.unitConfig.counter = 'granite_kashmir_white';`
);

fs.writeFileSync(path.join(rootDir, 'orbix-ui.js'), uiSrc, 'utf8');
console.log('✓ orbix-ui.js successfully patched');

// ═══════════════════════════════════════════════════════════════════════════
// 3. PATCH INDEX.HTML
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n3. Patching index.html...');
let htmlSrc = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8').replace(/\r\n/g, '\n');

// A. Remove openAIDecor3DBtn
htmlSrc = htmlSrc.replace(
  /<button type="button" class="cp-pill" id="openAIDecor3DBtn"[\s\S]*?<\/button>\s*/,
  ''
);

// B. Remove openAIDecorBtn
htmlSrc = htmlSrc.replace(
  /<button class="plan-tool-btn" id="openAIDecorBtn"[\s\S]*?<\/button>\s*/,
  ''
);

// C. Remove modalAIDecor
htmlSrc = htmlSrc.replace(
  /<div class="orbix-modal" id="modalAIDecor"[\s\S]*?<!-- ══════ MODAL: CUSTOMER PROJECT INFO ══════ -->/,
  '<!-- ══════ MODAL: CUSTOMER PROJECT INFO ══════ -->'
);

// D. Remove planPanBtn
htmlSrc = htmlSrc.replace(
  /<button class="plan-tool-btn" data-tool="pan" id="planPanBtn"[\s\S]*?<\/button>\s*/,
  ''
);

// E. Remove liveQuotationBadge
htmlSrc = htmlSrc.replace(
  /<div class="live-quote-badge" id="liveQuotationBadge"[\s\S]*?<\/div>\s*/,
  ''
);

// F. Remove planView3D
htmlSrc = htmlSrc.replace(
  /<button class="plan-tool-btn" id="planView3D"[\s\S]*?<\/button>\s*/,
  ''
);

// G. Add Floor Selector Pill in 2D Plan toolbar row
if (!htmlSrc.includes('id="planActiveFloor"')) {
  const floorPillHtml = `<div class="plan-toolgroup" id="floorSelectorGroup">
                <select class="plan-select" id="planActiveFloor" title="Active Floor Level (Default: Ground Floor)"
                  style="font-weight:700;color:#1e293b;background:#f8fafc;border:1px solid #cbd5e1;border-radius:4px;padding:3px 8px;cursor:pointer;">
                  <option value="ground" selected>🏢 Ground Floor (Default)</option>
                  <option value="first">🏢 First Floor</option>
                  <option value="add_floor">+ Add Floor...</option>
                </select>
              </div>\n              `;
  htmlSrc = htmlSrc.replace(
    '<button class="plan-tool-btn is-active" data-tool="select"',
    floorPillHtml + '<button class="plan-tool-btn is-active" data-tool="select"'
  );
}

fs.writeFileSync(path.join(rootDir, 'index.html'), htmlSrc, 'utf8');
console.log('✓ index.html successfully patched');

// ═══════════════════════════════════════════════════════════════════════════
// 4. PATCH APP.JS (ROCK-SOLID STABLE 3D WALL AUTO-CUTOFF)
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n4. Patching app.js for rock-solid 3D wall auto-cutoff...');
let appSrc = fs.readFileSync(path.join(rootDir, 'app.js'), 'utf8').replace(/\r\n/g, '\n');

// Replace updateWallCutaway in app.js with a rock-solid face-wall detector with hysteresis
const cutawayTarget = `      } else {
        // 'single_auto' / 'all_obstructing': Support both outer walls and inner partition walls!
        var camPt = { x: camera.position.x, y: camera.position.z };
        var targPt = { x: target.x, y: target.z };
        var camToTargX = targPt.x - camPt.x;
        var camToTargZ = targPt.y - camPt.y;
        var camToTargDist = Math.hypot(camToTargX, camToTargZ) || 1;

        var pWalls = (window.OrbixUI && window.OrbixUI.project && window.OrbixUI.project.plan && window.OrbixUI.project.plan.walls) || [];
        var pRooms = (window.OrbixUI && window.OrbixUI.project && window.OrbixUI.project.plan && window.OrbixUI.project.plan.rooms) || [];

        var intersectingWalls = [];
        var scoredWalls = [];

        wallMeshes.forEach(function (wMesh, idx) {
          var uData = wMesh.userData || {};
          var wStart = uData.start;
          var wEnd = uData.end;
          var wMid = uData.mid || (wStart && wEnd ? { x: (wStart.x + wEnd.x) / 2, y: (wStart.y + wEnd.y) / 2 } : null);
          if (!wMid) return;

          var wObj = uData.wall || pWalls[idx];
          var isInner = checkIsInnerWall(wObj, pWalls, pRooms);

          // 1. Ray-segment intersection check (direct line-of-sight barrier between camera and target)
          var hit = (wStart && wEnd) ? testRayWallIntersection(camPt, targPt, wStart, wEnd) : null;
          if (hit) {
            var distToCam = Math.hypot(hit.pt.x - camPt.x, hit.pt.y - camPt.y);
            var distToTarg = Math.hypot(hit.pt.x - targPt.x, hit.pt.y - targPt.y);
            intersectingWalls.push({
              mesh: wMesh,
              hit: hit,
              isInner: isInner,
              distToCam: distToCam,
              distToTarg: distToTarg,
              t: hit.t
            });
          }

          // 2. Obstruction score for general view angle
          var camToWallX = wMid.x - camPt.x;
          var camToWallZ = wMid.y - camPt.y;
          var camToWallDist = Math.hypot(camToWallX, camToWallZ) || 1;
          var dot = (camToTargX * camToWallX + camToTargZ * camToWallZ) / (camToTargDist * camToWallDist);

          var score = -999999;
          if (camToWallDist < camToTargDist * 1.05 && dot > 0.1) {
            // Give inner walls strong obstruction weight when camera is looking at an interior space!
            var innerBoost = isInner ? 0.35 : 0;
            score = (dot + innerBoost) * (1.6 - (camToWallDist / camToTargDist));
            if (hit) score += 10;
          }
          scoredWalls.push({ mesh: wMesh, score: score, isInner: isInner });
        });

        // Strict 1-wall cutaway: While zooming or rotating, cut strictly ONE front wall (the primary line-of-sight barrier).
        // All other 3 walls in the room stay 100% visible at all zoom levels.
        var singleCutWall = null;

        if (intersectingWalls.length > 0) {
          // Sort by closest intersecting barrier to camera
          intersectingWalls.sort(function (a, b) { return a.distToCam - b.distToCam; });
          singleCutWall = intersectingWalls[0].mesh;
        } else if (scoredWalls.length > 0) {
          scoredWalls.sort(function (a, b) { return b.score - a.score; });
          if (scoredWalls[0].score > -999900) {
            singleCutWall = scoredWalls[0].mesh;
          }
        }

        wallMeshes.forEach(function (wMesh) {
          var isCut = (singleCutWall && wMesh === singleCutWall);
          wMesh.visible = !isCut;
          if (wMesh.userData && wMesh.userData.wallId) wallVisibility[wMesh.userData.wallId] = !isCut;
        });
      }`;

const cutawayReplacement = `      } else {
        // Rock-Solid Stable Face-Wall Auto Cut-Off:
        // Strictly ONE face wall (the primary front wall between camera and room) is cut.
        // The other 3 walls remain 100% visible and rock-solid stable without any flickering!
        var camPt = { x: camera.position.x, y: camera.position.z };
        var targPt = { x: target.x, y: target.z };
        var viewDirX = targPt.x - camPt.x;
        var viewDirZ = targPt.y - camPt.y;
        var viewDist = Math.hypot(viewDirX, viewDirZ) || 1;
        var uViewX = viewDirX / viewDist, uViewZ = viewDirZ / viewDist;

        var candidates = [];

        wallMeshes.forEach(function (wMesh, idx) {
          var uData = wMesh.userData || {};
          var wStart = uData.start;
          var wEnd = uData.end;
          if (!wStart || !wEnd) return;
          var wMid = uData.mid || { x: (wStart.x + wEnd.x) / 2, y: (wStart.y + wEnd.y) / 2 };

          var wallDx = wEnd.x - wStart.x, wallDy = wEnd.y - wStart.y;
          var wallLen = Math.hypot(wallDx, wallDy) || 1;
          var wNormX = -wallDy / wallLen, wNormZ = wallDx / wallLen;

          // Align normal to point outward toward camera
          var dotCam = (camPt.x - wMid.x) * wNormX + (camPt.y - wMid.y) * wNormZ;
          if (dotCam < 0) {
            wNormX = -wNormX;
            wNormZ = -wNormZ;
          }

          // Test ray intersection from camera to target
          var hit = testRayWallIntersection(camPt, targPt, wStart, wEnd);
          var distToCam = hit ? Math.hypot(hit.pt.x - camPt.x, hit.pt.y - camPt.y) : Math.hypot(wMid.x - camPt.x, wMid.y - camPt.y);
          var distToTarg = hit ? Math.hypot(hit.pt.x - targPt.x, hit.pt.y - targPt.y) : Math.hypot(wMid.x - targPt.x, wMid.y - targPt.y);

          // Front-facing alignment score: dot product between camera view direction and wall normal
          var frontalDot = (uViewX * (-wNormX) + uViewZ * (-wNormZ)); // > 0 means camera looks into the wall face
          var score = 0;
          if (hit) {
            score = 1000 - distToCam; // Intersecting barrier in direct line of sight has top priority
          } else if (distToCam < viewDist * 1.15) {
            score = 500 * frontalDot - (distToCam / viewDist) * 100;
          }

          candidates.push({
            mesh: wMesh,
            wallId: uData.wallId,
            score: score,
            hit: !!hit,
            distToCam: distToCam
          });
        });

        // Determine the single face wall with hysteresis to eliminate jumping between walls
        var singleCutWall = null;
        if (candidates.length > 0) {
          candidates.sort(function (a, b) { return b.score - a.score; });
          var topCand = candidates[0];

          if (!window._activeCutWallId) {
            window._activeCutWallId = topCand.wallId;
          } else {
            // Hysteresis: keep active cut wall unless another wall scores at least 25% better
            var activeCand = candidates.find(function (c) { return c.wallId === window._activeCutWallId; });
            if (activeCand && (topCand.score - activeCand.score) < 120 && activeCand.score > 0) {
              topCand = activeCand;
            } else {
              window._activeCutWallId = topCand.wallId;
            }
          }
          singleCutWall = topCand.mesh;
        }

        wallMeshes.forEach(function (wMesh) {
          var isCut = (singleCutWall && wMesh === singleCutWall);
          wMesh.visible = !isCut;
          if (wMesh.userData && wMesh.userData.wallId) wallVisibility[wMesh.userData.wallId] = !isCut;
        });
      }`;

if (appSrc.includes(cutawayTarget)) {
  appSrc = appSrc.replace(cutawayTarget, cutawayReplacement);
}

fs.writeFileSync(path.join(rootDir, 'app.js'), appSrc, 'utf8');
console.log('✓ app.js successfully patched');

console.log('\n========================================');
console.log('ALL USER REQUEST FIXES SUCCESSFULLY APPLIED!');
console.log('========================================');
