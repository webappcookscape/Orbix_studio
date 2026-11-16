const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

console.log('=== IMPLEMENTING AUTO REALISTIC STAIRCASE FEATURE ===\n');

// ═══════════════════════════════════════════════════════════════════════════
// 1. UPDATE ORBIX-CORE.JS
// ═══════════════════════════════════════════════════════════════════════════
console.log('1. Updating orbix-core.js...');
let coreSrc = fs.readFileSync(path.join(rootDir, 'orbix-core.js'), 'utf8');

// A. Insert createStaircasePlacement and getStaircasePolygon
const stairCoreFunctions = `  /* ─────────────────────────────────────────────────────────────────────────────
     Architectural Staircase Generation & Geometry Helpers
     Auto-calculates Start ➔ Turn (Landing) ➔ End (Ceiling Level) Steps
     ───────────────────────────────────────────────────────────────────────────── */
  function createStaircasePlacement(opts) {
    opts = opts || {};
    var type = opts.type || 'l_shape'; // 'l_shape' | 'u_shape' | 'straight'
    var turnDir = opts.turnDirection || 'right'; // 'right' | 'left'
    var width = opts.width || 900;
    var totalH = opts.totalHeight || 2800; // Ceiling level
    var riserCount = opts.riserCount || 16;
    var riserH = totalH / riserCount; // 175mm
    var treadD = opts.treadDepth || 250;
    var flight1 = opts.flight1Steps || (type === 'straight' ? riserCount : Math.floor(riserCount / 2));
    var flight2 = type === 'straight' ? 0 : (riserCount - flight1);
    var landingW = opts.landingWidth || width;
    var landingD = opts.landingDepth || (type === 'u_shape' ? width * 2 + 100 : width);

    return {
      id: opts.id || uid('stair'),
      type: type,
      turnDirection: turnDir,
      pos: opts.pos ? { x: opts.pos.x, y: opts.pos.y } : { x: 0, y: 0 },
      rotY: opts.rotY || 0,
      width: width,
      totalHeight: totalH,
      riserCount: riserCount,
      riserHeight: Math.round(riserH * 10) / 10,
      treadDepth: treadD,
      flight1Steps: flight1,
      flight2Steps: flight2,
      landingWidth: landingW,
      landingDepth: landingD,
      finish: opts.finish || 'marble', // 'marble' | 'wood' | 'concrete'
      railing: opts.railing || 'glass_steel', // 'glass_steel' | 'black_metal' | 'wood'
      stringer: opts.stringer !== undefined ? opts.stringer : true,
      elevation: opts.elevation || 0,
      roomId: opts.roomId || null,
      excludeFromPricing: true,
      isStaircase: true
    };
  }

  function getStaircasePolygon(stair) {
    if (!stair) return [];
    var pos = stair.pos || { x: 0, y: 0 };
    var rot = stair.rotY || 0;
    var W = stair.width || 900;
    var D = stair.treadDepth || 250;
    var f1 = stair.flight1Steps || 8;
    var f2 = stair.flight2Steps || 8;
    var type = stair.type || 'l_shape';
    var turnDir = stair.turnDirection || 'right';
    var sign = turnDir === 'left' ? -1 : 1;
    var lW = stair.landingWidth || W;
    var lD = stair.landingDepth || W;

    var pts = [];
    if (type === 'straight') {
      var totalL = f1 * D + (f2 > 0 ? f2 * D + lD : 0);
      pts = [
        { x: -W / 2, y: -totalL / 2 },
        { x: W / 2, y: -totalL / 2 },
        { x: W / 2, y: totalL / 2 },
        { x: -W / 2, y: totalL / 2 }
      ];
    } else if (type === 'u_shape') {
      var well = 100;
      var totalW = W * 2 + well;
      var totalL = Math.max(f1, f2) * D + lD;
      pts = [
        { x: -totalW / 2, y: -totalL / 2 },
        { x: totalW / 2, y: -totalL / 2 },
        { x: totalW / 2, y: totalL / 2 },
        { x: -totalW / 2, y: totalL / 2 }
      ];
    } else {
      // L-shape
      var f1L = f1 * D;
      var f2L = f2 * D;
      var bW = W + f2L;
      var bL = f1L + lD;
      if (sign === 1) { // right turn
        pts = [
          { x: -W / 2, y: -bL / 2 },
          { x: W / 2, y: -bL / 2 },
          { x: W / 2, y: bL / 2 - lD },
          { x: -W / 2 + bW, y: bL / 2 - lD },
          { x: -W / 2 + bW, y: bL / 2 },
          { x: -W / 2, y: bL / 2 }
        ];
      } else { // left turn
        pts = [
          { x: -W / 2, y: -bL / 2 },
          { x: W / 2, y: -bL / 2 },
          { x: W / 2, y: bL / 2 },
          { x: W / 2 - bW, y: bL / 2 },
          { x: W / 2 - bW, y: bL / 2 - lD },
          { x: -W / 2, y: bL / 2 - lD }
        ];
      }
    }

    var cosA = Math.cos(rot), sinA = Math.sin(rot);
    return pts.map(function (p) {
      return {
        x: pos.x + p.x * cosA - p.y * sinA,
        y: pos.y + p.x * sinA + p.y * cosA
      };
    });
  }

`;

if (!coreSrc.includes('function createStaircasePlacement')) {
  coreSrc = coreSrc.replace('  // Calculates corner angle in degrees', stairCoreFunctions + '  // Calculates corner angle in degrees');
}

// B. Ensure plan.stairs is in createProject
if (!coreSrc.includes('stairs: []')) {
  coreSrc = coreSrc.replace('furniture: []', 'furniture: [],\n        stairs: []');
}

// C. Ensure plan.stairs is initialized in deserializeProject
if (!coreSrc.includes('if (!data.plan.stairs) data.plan.stairs = [];')) {
  coreSrc = coreSrc.replace('if (!data.plan) data.plan = { walls: [], openings: [], rooms: [], furniture: [] };',
    'if (!data.plan) data.plan = { walls: [], openings: [], rooms: [], furniture: [], stairs: [] };\n    if (!data.plan.stairs) data.plan.stairs = [];');
}

// D. Export createStaircasePlacement and getStaircasePolygon
if (!coreSrc.includes('createStaircasePlacement: createStaircasePlacement')) {
  coreSrc = coreSrc.replace('createFurniturePlacement: createFurniturePlacement,',
    'createFurniturePlacement: createFurniturePlacement,\n    createStaircasePlacement: createStaircasePlacement,\n    getStaircasePolygon: getStaircasePolygon,');
}

fs.writeFileSync(path.join(rootDir, 'orbix-core.js'), coreSrc, 'utf8');
console.log('✓ orbix-core.js updated with Staircase placement & geometry model');

// ═══════════════════════════════════════════════════════════════════════════
// 2. UPDATE ORBIX-PLAN.JS (2D BLUEPRINT RENDERING & INTERACTION)
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n2. Updating orbix-plan.js...');
let planSrc = fs.readFileSync(path.join(rootDir, 'orbix-plan.js'), 'utf8');

// A. Insert renderStaircase and renderStairs methods
const renderStaircode = `  /* ─────────────────────────────────────────────────────────────────────────────
     Architectural 2D Staircase Rendering (Treads, Intermediate Landing, UP Arrow)
     ───────────────────────────────────────────────────────────────────────────── */
  PlanEditor.prototype.renderStaircase = function (ctx, stair, isSelected) {
    if (!stair) return;
    var pos = stair.pos || { x: 0, y: 0 };
    var rot = stair.rotY || 0;
    var W = stair.width || 900;
    var D = stair.treadDepth || 250;
    var f1 = stair.flight1Steps || 8;
    var f2 = stair.flight2Steps || 8;
    var type = stair.type || 'l_shape';
    var turnDir = stair.turnDirection || 'right';
    var sign = turnDir === 'left' ? -1 : 1;
    var lW = stair.landingWidth || W;
    var lD = stair.landingDepth || W;

    var sCenter = this.worldToScreen(pos);

    ctx.save();
    ctx.translate(sCenter.x, sCenter.y);
    ctx.rotate(rot);
    var scale = this.zoom;

    // Outer boundary fill & styling
    ctx.fillStyle = isSelected ? 'rgba(2, 132, 199, 0.08)' : 'rgba(248, 250, 252, 0.95)';
    ctx.strokeStyle = isSelected ? '#0284c7' : '#1e293b';
    ctx.lineWidth = isSelected ? 2.5 : 1.8;

    // Draw Flight 1 (Start to Landing)
    var f1L = f1 * D;
    var f2L = f2 * D;
    var bL = (type === 'straight') ? (f1L + (f2 > 0 ? f2L + lD : 0)) : (f1L + lD);
    var startY = -bL / 2;

    // Flight 1 Treads
    for (var i = 0; i < f1; i++) {
      var stepY = (startY + i * D) * scale;
      var stepH = D * scale;
      var stepW = W * scale;
      var stepX = (-W / 2) * scale;

      // Tread fill
      ctx.fillStyle = (i % 2 === 0) ? '#ffffff' : '#f8fafc';
      ctx.fillRect(stepX, stepY, stepW, stepH);
      ctx.strokeRect(stepX, stepY, stepW, stepH);

      // Step number
      if (this.zoom >= 0.06) {
        ctx.fillStyle = '#64748b';
        ctx.font = '600 ' + Math.max(8, Math.round(9 * scale * 10)) + 'px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), stepX + 6 * scale, stepY + stepH / 2);
      }
    }

    // Landing Platform (The Turn)
    var landY = (startY + f1L) * scale;
    var landH = lD * scale;
    var landW = (type === 'u_shape' ? (W * 2 + 100) : lW) * scale;
    var landX = (-W / 2) * scale;

    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(landX, landY, landW, landH);
    ctx.strokeRect(landX, landY, landW, landH);

    // Landing Label
    if (this.zoom >= 0.05) {
      ctx.fillStyle = '#334155';
      ctx.font = '700 ' + Math.max(9, Math.round(11 * scale * 10)) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('LANDING', landX + landW / 2, landY + landH / 2);
    }

    // Flight 2 Treads (Landing to End)
    if (f2 > 0) {
      if (type === 'l_shape') {
        for (var j = 0; j < f2; j++) {
          var sX = (sign === 1) ? (landX + W * scale + j * D * scale) : (landX - (j + 1) * D * scale);
          var sY = landY;
          var sWidth = D * scale;
          var sHeight = W * scale;

          // Above eye-level cut plane (dashed)
          ctx.setLineDash(j >= 3 ? [4, 4] : []);
          ctx.fillStyle = (j % 2 === 0) ? '#ffffff' : '#f8fafc';
          ctx.fillRect(sX, sY, sWidth, sHeight);
          ctx.strokeRect(sX, sY, sWidth, sHeight);
          ctx.setLineDash([]);

          if (this.zoom >= 0.06) {
            ctx.fillStyle = '#64748b';
            ctx.font = '600 ' + Math.max(8, Math.round(9 * scale * 10)) + 'px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(String(f1 + j + 1), sX + sWidth / 2, sY + sHeight / 2);
          }
        }
      } else if (type === 'u_shape') {
        // Return flight parallel in reverse
        for (var k = 0; k < f2; k++) {
          var uStepY = (startY + (f1 - 1 - k) * D) * scale;
          var uStepH = D * scale;
          var uStepW = W * scale;
          var uStepX = (W / 2 + 100 - W) * scale;

          ctx.setLineDash(k >= 3 ? [4, 4] : []);
          ctx.fillStyle = (k % 2 === 0) ? '#ffffff' : '#f8fafc';
          ctx.fillRect(uStepX, uStepY, uStepW, uStepH);
          ctx.strokeRect(uStepX, uStepY, uStepW, uStepH);
          ctx.setLineDash([]);

          if (this.zoom >= 0.06) {
            ctx.fillStyle = '#64748b';
            ctx.font = '600 ' + Math.max(8, Math.round(9 * scale * 10)) + 'px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(String(f1 + k + 1), uStepX + 6 * scale, uStepY + uStepH / 2);
          }
        }
      } else if (type === 'straight') {
        for (var s = 0; s < f2; s++) {
          var strStepY = (landY + landH + s * D * scale);
          var strStepH = D * scale;
          var strStepW = W * scale;
          var strStepX = (-W / 2) * scale;

          ctx.setLineDash(s >= 2 ? [4, 4] : []);
          ctx.fillStyle = (s % 2 === 0) ? '#ffffff' : '#f8fafc';
          ctx.fillRect(strStepX, strStepY, strStepW, strStepH);
          ctx.strokeRect(strStepX, strStepY, strStepW, strStepH);
          ctx.setLineDash([]);
        }
      }
    }

    // Architectural Break / Cut Line at mid Flight 1
    if (this.zoom >= 0.04) {
      var cutY = (startY + Math.min(f1 - 1, 5) * D + D / 2) * scale;
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo((-W / 2 - 15) * scale, cutY - 12 * scale);
      ctx.lineTo((-W / 2 + W / 3) * scale, cutY - 12 * scale);
      ctx.lineTo((-W / 2 + W / 2) * scale, cutY + 12 * scale);
      ctx.lineTo((W / 2 + 15) * scale, cutY + 12 * scale);
      ctx.stroke();
    }

    // Directional UP Walking Line & Arrow (Start ➔ Turn ➔ End)
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 2.2;
    ctx.fillStyle = '#0284c7';

    // Start point circle at step 1
    var arrowStartX = 0;
    var arrowStartY = (startY + D / 2) * scale;
    ctx.beginPath();
    ctx.arc(arrowStartX, arrowStartY, 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(arrowStartX, arrowStartY);
    // Line up Flight 1 into Landing (Turn)
    var arrowTurnY = (startY + f1L + lD / 2) * scale;
    ctx.lineTo(arrowStartX, arrowTurnY);

    if (f2 > 0 && type === 'l_shape') {
      var arrowEndX = (sign === 1) ? (arrowStartX + W * scale + f2L * scale) : (arrowStartX - W * scale - f2L * scale);
      ctx.lineTo(arrowEndX, arrowTurnY);
      ctx.stroke();

      // Arrowhead at End
      var arrowHeadSign = sign === 1 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(arrowEndX, arrowTurnY);
      ctx.lineTo(arrowEndX - 10 * arrowHeadSign, arrowTurnY - 6);
      ctx.lineTo(arrowEndX - 10 * arrowHeadSign, arrowTurnY + 6);
      ctx.closePath();
      ctx.fill();
    } else if (f2 > 0 && type === 'u_shape') {
      var uTurnX = (W / 2 + 50) * scale;
      ctx.lineTo(uTurnX, arrowTurnY);
      var arrowTopY = (startY + D / 2) * scale;
      ctx.lineTo(uTurnX, arrowTopY);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(uTurnX, arrowTopY);
      ctx.lineTo(uTurnX - 6, arrowTopY + 10);
      ctx.lineTo(uTurnX + 6, arrowTopY + 10);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.stroke();
      // Arrowhead straight
      ctx.beginPath();
      ctx.moveTo(arrowStartX, arrowTurnY);
      ctx.lineTo(arrowStartX - 6, arrowTurnY - 10);
      ctx.lineTo(arrowStartX + 6, arrowTurnY - 10);
      ctx.closePath();
      ctx.fill();
    }

    // "UP ➔" Tag & Riser Schedule Label
    if (this.zoom >= 0.05) {
      ctx.fillStyle = '#0369a1';
      ctx.font = '700 ' + Math.max(10, Math.round(12 * scale * 10)) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('UP ➔', arrowStartX + 28 * scale, arrowStartY + 45 * scale);

      ctx.fillStyle = isSelected ? '#0284c7' : '#475569';
      ctx.font = '600 ' + Math.max(9, Math.round(10 * scale * 10)) + 'px sans-serif';
      var stairTag = (stair.riserCount || 16) + ' Risers @ ' + (stair.riserHeight || 175) + 'mm';
      ctx.fillText(stairTag, arrowStartX, (startY - 14) * scale);
    }

    ctx.restore();
  };

  PlanEditor.prototype.renderStairs = function (ctx) {
    var stairs = (this.project && this.project.plan && this.project.plan.stairs) || [];
    for (var i = 0; i < stairs.length; i++) {
      var st = stairs[i];
      var isSel = this.selected && this.selected.some(function (s) { return s.type === 'stair' && s.id === st.id; });
      this.renderStaircase(ctx, st, isSel);
    }
  };

`;

if (!planSrc.includes('PlanEditor.prototype.renderStaircase =')) {
  planSrc = planSrc.replace('PlanEditor.prototype.renderOpenings = function (ctx) {', renderStaircode + 'PlanEditor.prototype.renderOpenings = function (ctx) {');
}

// B. Call renderStairs in main render loop
if (!planSrc.includes('this.renderStairs(this.ctx);')) {
  planSrc = planSrc.replace('this.renderFurniture(this.ctx);', 'this.renderStairs(this.ctx);\n    this.renderFurniture(this.ctx);');
}

// C. Add stair selection hit-testing in handleMouseDown & onCanvasClick
const stairHitTestMouseDown = `      // Check if clicked directly on a staircase
      var stairsList = (self.project && self.project.plan && self.project.plan.stairs) || [];
      for (var si = stairsList.length - 1; si >= 0; si--) {
        var stObj = stairsList[si];
        var stPoly = Core.getStaircasePolygon ? Core.getStaircasePolygon(stObj) : [];
        if (Core.Vec2.pointInPolygon(worldPt, stPoly) || Vec2.dist(worldPt, stObj.pos) < (stObj.width || 900) / 2) {
          self.selected = [{ type: 'stair', id: stObj.id }];
          self.dragState = {
            type: 'move_stair',
            stair: stObj,
            startWorld: Vec2.clone(worldPt),
            origPos: Vec2.clone(stObj.pos),
            hasMoved: false
          };
          self.onSelectionChange(self.selected);
          self.render();
          return;
        }
      }
`;

if (!planSrc.includes("self.dragState = {\n            type: 'move_stair',")) {
  planSrc = planSrc.replace('var furnList = (self.project && self.project.plan && self.project.plan.furniture) || [];',
    stairHitTestMouseDown + '\n      var furnList = (self.project && self.project.plan && self.project.plan.furniture) || [];');
}

// D. Handle move_stair in mousemove and mouseup
const stairMouseMove = `      if (self.dragState && self.dragState.type === 'move_stair') {
        if (!self.dragState.hasMoved) {
          if (Vec2.dist(self.cursorWorld, self.dragState.startWorld) > 8) {
            self.dragState.hasMoved = true;
          } else {
            return;
          }
        }
        var dx = self.cursorWorld.x - self.dragState.startWorld.x;
        var dy = self.cursorWorld.y - self.dragState.startWorld.y;
        self.dragState.stair.pos.x = Math.round((self.dragState.origPos.x + dx) / 25) * 25;
        self.dragState.stair.pos.y = Math.round((self.dragState.origPos.y + dy) / 25) * 25;
        self.requestRender();
        return;
      }
`;

if (!planSrc.includes("self.dragState.type === 'move_stair'")) {
  planSrc = planSrc.replace("if (self.dragState && self.dragState.type === 'move_furniture') {",
    stairMouseMove + "\n      if (self.dragState && self.dragState.type === 'move_furniture') {");
}

// E. Handle placement when activeTool === 'stair'
const stairPlaceHandler = `      if (self.activeTool === 'stair') {
        var snapped = self.snapPoint(worldPt);
        var preset = self.stairPreset || { type: 'l_shape', turnDirection: 'right', width: 900, finish: 'marble', railing: 'glass_steel' };
        var newStair = Core.createStaircasePlacement({
          type: preset.type || 'l_shape',
          turnDirection: preset.turnDirection || 'right',
          width: preset.width || 900,
          finish: preset.finish || 'marble',
          railing: preset.railing || 'glass_steel',
          pos: { x: Math.round(snapped.pt.x / 25) * 25, y: Math.round(snapped.pt.y / 25) * 25 },
          rotY: self.stairRotY || 0
        });
        self.project.plan.stairs = self.project.plan.stairs || [];
        self.project.plan.stairs.push(newStair);
        self.pushHistory('Place Staircase', newStair);
        if (typeof self.setTool === 'function') self.setTool('select');
        else self.activeTool = 'select';
        self.selected = [{ type: 'stair', id: newStair.id }];
        self.onSelectionChange(self.selected);
        self.render();
        if (typeof window !== 'undefined' && window.OrbixUI && window.OrbixUI.render3DHome) {
          window.OrbixUI.render3DHome(true);
        }
        return;
      }
`;

if (!planSrc.includes("self.activeTool === 'stair'")) {
  planSrc = planSrc.replace("if (self.activeTool === 'furniture') {",
    stairPlaceHandler + "\n      if (self.activeTool === 'furniture') {");
}

fs.writeFileSync(path.join(rootDir, 'orbix-plan.js'), planSrc, 'utf8');
console.log('✓ orbix-plan.js updated with 2D Staircase blueprint rendering & controls');

// ═══════════════════════════════════════════════════════════════════════════
// 3. UPDATE ORBIX-3D.JS (PHOTOREALISTIC 3D STAIRCASE MODELING)
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n3. Updating orbix-3d.js...');
let d3Src = fs.readFileSync(path.join(rootDir, 'orbix-3d.js'), 'utf8');

// Insert buildStaircaseMesh into ArchitecturalRenderer
const stair3DCode = `  /* ─────────────────────────────────────────────────────────────────────────────
     Build Photorealistic 3D Staircase (Treads, Riser Steps, Landing Slab & Railing)
     Ascends seamlessly from floor Y=0 to ceiling level Y=2800
     ───────────────────────────────────────────────────────────────────────────── */
  ArchitecturalRenderer.prototype.buildStaircaseMesh = function (stair) {
    if (!stair) return null;
    var sg = new THREE.Group();
    sg.name = 'Staircase_' + stair.id;

    var type = stair.type || 'l_shape';
    var turnDir = stair.turnDirection || 'right';
    var sign = turnDir === 'left' ? -1 : 1;
    var W = stair.width || 900;
    var D = stair.treadDepth || 250;
    var totalH = stair.totalHeight || 2800;
    var riserCount = stair.riserCount || 16;
    var riserH = totalH / riserCount; // 175mm
    var f1 = stair.flight1Steps || 8;
    var f2 = stair.flight2Steps || 8;
    var lW = stair.landingWidth || W;
    var lD = stair.landingDepth || W;

    // Materials based on stair.finish
    var finish = stair.finish || 'marble';
    var treadColor = 0xF5F3EE; // Statuario white marble
    var treadRoughness = 0.25;
    if (finish === 'wood') {
      treadColor = 0x8C5E3B; // Warm Teak Wood
      treadRoughness = 0.55;
    } else if (finish === 'concrete') {
      treadColor = 0x94A3B8; // Architectural Grey Basalt Stone
      treadRoughness = 0.8;
    }
    var treadMat = new THREE.MeshStandardMaterial({
      color: treadColor,
      roughness: treadRoughness,
      metalness: 0.05
    });

    // Riser / underbody material
    var riserMat = new THREE.MeshStandardMaterial({
      color: 0xE2E8F0,
      roughness: 0.6,
      metalness: 0.02
    });

    // Stainless steel handrail material
    var railMat = new THREE.MeshStandardMaterial({
      color: 0xCBD5E1,
      metalness: 0.85,
      roughness: 0.2
    });

    // Balustrade tempered glass material
    var glassMat = (typeof THREE.MeshPhysicalMaterial === 'function') ?
      new THREE.MeshPhysicalMaterial({
        color: 0xE0F2FE,
        transparent: true,
        opacity: 0.45,
        roughness: 0.05,
        transmission: 0.85,
        ior: 1.5
      }) :
      new THREE.MeshStandardMaterial({
        color: 0xBAE6FD,
        transparent: true,
        opacity: 0.4
      });

    // Flight 1 Steps (Ascending from Y=0 to landing at Y=f1*riserH)
    var f1L = f1 * D;
    var f2L = f2 * D;
    var bL = (type === 'straight') ? (f1L + (f2 > 0 ? f2L + lD : 0)) : (f1L + lD);
    var startZ = -bL / 2;

    for (var i = 0; i < f1; i++) {
      var curY = i * riserH;
      var curZ = startZ + i * D;

      // Solid step box
      var stepGeo = new THREE.BoxGeometry(W, riserH, D + 20); // 20mm bullnose overhang
      var stepMesh = new THREE.Mesh(stepGeo, treadMat);
      stepMesh.position.set(0, curY + riserH / 2, curZ + D / 2);
      stepMesh.castShadow = true;
      stepMesh.receiveShadow = true;
      sg.add(stepMesh);

      // Solid riser under step
      if (curY > 0) {
        var baseGeo = new THREE.BoxGeometry(W - 10, curY, D);
        var baseMesh = new THREE.Mesh(baseGeo, riserMat);
        baseMesh.position.set(0, curY / 2, curZ + D / 2);
        baseMesh.castShadow = true;
        baseMesh.receiveShadow = true;
        sg.add(baseMesh);
      }
    }

    // Mid Landing Platform (The Turn) at Y = f1 * riserH (1400mm)
    var landY = f1 * riserH;
    var landZ = startZ + f1L;
    var landWidth = (type === 'u_shape' ? (W * 2 + 100) : lW);
    var landX = (type === 'u_shape' ? 50 : 0);

    var landingGeo = new THREE.BoxGeometry(landWidth, riserH, lD);
    var landingMesh = new THREE.Mesh(landingGeo, treadMat);
    landingMesh.position.set(landX, landY - riserH / 2, landZ + lD / 2);
    landingMesh.castShadow = true;
    landingMesh.receiveShadow = true;
    sg.add(landingMesh);

    // Landing solid support base
    var landBaseGeo = new THREE.BoxGeometry(landWidth - 10, landY - riserH, lD - 10);
    var landBaseMesh = new THREE.Mesh(landBaseGeo, riserMat);
    landBaseMesh.position.set(landX, (landY - riserH) / 2, landZ + lD / 2);
    landBaseMesh.castShadow = true;
    landBaseMesh.receiveShadow = true;
    sg.add(landBaseMesh);

    // Flight 2 Steps (Ascending from landing Y=1400 to ceiling Y=2800)
    if (f2 > 0) {
      if (type === 'l_shape') {
        for (var j = 0; j < f2; j++) {
          var step2Y = landY + j * riserH;
          var step2X = (sign === 1) ? (W / 2 + j * D) : (-W / 2 - j * D);
          var step2Z = landZ + lD / 2;

          var f2Geo = new THREE.BoxGeometry(D + 20, riserH, W);
          var f2Mesh = new THREE.Mesh(f2Geo, treadMat);
          f2Mesh.position.set(step2X + (sign === 1 ? D / 2 : -D / 2), step2Y + riserH / 2, step2Z);
          f2Mesh.castShadow = true;
          f2Mesh.receiveShadow = true;
          sg.add(f2Mesh);

          // Support riser under flight 2
          var f2BaseGeo = new THREE.BoxGeometry(D, step2Y, W - 10);
          var f2BaseMesh = new THREE.Mesh(f2BaseGeo, riserMat);
          f2BaseMesh.position.set(step2X + (sign === 1 ? D / 2 : -D / 2), step2Y / 2, step2Z);
          f2BaseMesh.castShadow = true;
          f2BaseMesh.receiveShadow = true;
          sg.add(f2BaseMesh);
        }
      } else if (type === 'u_shape') {
        for (var k = 0; k < f2; k++) {
          var uStepY = landY + k * riserH;
          var uStepZ = landZ - k * D;
          var uStepX = W + 100 / 2;

          var uGeo = new THREE.BoxGeometry(W, riserH, D + 20);
          var uMesh = new THREE.Mesh(uGeo, treadMat);
          uMesh.position.set(uStepX, uStepY + riserH / 2, uStepZ - D / 2);
          uMesh.castShadow = true;
          uMesh.receiveShadow = true;
          sg.add(uMesh);
        }
      } else if (type === 'straight') {
        for (var s = 0; s < f2; s++) {
          var strY = landY + s * riserH;
          var strZ = landZ + lD + s * D;

          var strGeo = new THREE.BoxGeometry(W, riserH, D + 20);
          var strMesh = new THREE.Mesh(strGeo, treadMat);
          strMesh.position.set(0, strY + riserH / 2, strZ + D / 2);
          strMesh.castShadow = true;
          strMesh.receiveShadow = true;
          sg.add(strMesh);
        }
      }
    }

    // Modern Balustrades & Stainless Steel Handrails
    var railH = 900; // mm handrail height above treads
    var railT = 40; // mm handrail diameter / width

    // Flight 1 Handrail (Angled sloping rail)
    var f1Angle = Math.atan2(landY, f1L);
    var f1SlopeLen = Math.hypot(landY, f1L);
    var rail1Geo = new THREE.BoxGeometry(railT, railT, f1SlopeLen);
    var rail1Mesh = new THREE.Mesh(rail1Geo, railMat);
    rail1Mesh.position.set(-W / 2 + railT / 2, landY / 2 + railH, startZ + f1L / 2);
    rail1Mesh.rotation.x = f1Angle;
    rail1Mesh.castShadow = true;
    sg.add(rail1Mesh);

    // Flight 1 Glass Balustrade Panel
    var glass1Geo = new THREE.BoxGeometry(12, railH - 100, f1SlopeLen - 60);
    var glass1Mesh = new THREE.Mesh(glass1Geo, glassMat);
    glass1Mesh.position.set(-W / 2 + railT / 2, landY / 2 + railH / 2, startZ + f1L / 2);
    glass1Mesh.rotation.x = f1Angle;
    sg.add(glass1Mesh);

    // Newel Posts at bottom and landing
    var postGeo = new THREE.CylinderGeometry(20, 20, railH, 16);
    var post1 = new THREE.Mesh(postGeo, railMat);
    post1.position.set(-W / 2 + railT / 2, railH / 2, startZ + D / 2);
    sg.add(post1);

    var post2 = new THREE.Mesh(postGeo, railMat);
    post2.position.set(-W / 2 + railT / 2, landY + railH / 2, landZ);
    sg.add(post2);

    // Set position and rotation in Three.js world
    sg.position.set(stair.pos.x, stair.elevation || 0, stair.pos.y);
    sg.rotation.y = -(stair.rotY || 0);

    sg.userData = {
      isStaircase: true,
      isFurniture: true,
      isFurnitureGroup: true,
      stairId: stair.id,
      stair: stair
    };

    return sg;
  };

`;

if (!d3Src.includes('ArchitecturalRenderer.prototype.buildStaircaseMesh =')) {
  d3Src = d3Src.replace('ArchitecturalRenderer.prototype.buildFurnitureMesh = function (furn) {',
    stair3DCode + 'ArchitecturalRenderer.prototype.buildFurnitureMesh = function (furn) {');
}

// B. Render stairs in 3D buildScene
if (!d3Src.includes('// 2b. Build Architectural Staircases')) {
  const stair3DSceneInsert = `    // 2b. Build Architectural Staircases in 3D
    var stairs = (plan && plan.stairs) || [];
    for (var sIdx = 0; sIdx < stairs.length; sIdx++) {
      var stairObj = stairs[sIdx];
      var stairMeshGroup = this.buildStaircaseMesh(stairObj);
      if (stairMeshGroup) {
        this.group.add(stairMeshGroup);
      }
    }
`;
  d3Src = d3Src.replace('// 3. Build Placed Furniture Units in 3D', stair3DSceneInsert + '\n    // 3. Build Placed Furniture Units in 3D');
}

fs.writeFileSync(path.join(rootDir, 'orbix-3d.js'), d3Src, 'utf8');
console.log('✓ orbix-3d.js updated with 3D physical staircase builder');

// ═══════════════════════════════════════════════════════════════════════════
// 4. UPDATE INDEX.HTML & ORBIX-UI.JS (TOOLBAR BUTTON & INSPECTOR)
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n4. Updating index.html & orbix-ui.js...');
let htmlSrc = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');

// Insert + Stairs button in 2D Plan toolbar row
if (!htmlSrc.includes('id="planStairBtn"')) {
  const stairBtnHtml = `<button class="plan-tool-btn" data-tool="stair" id="planStairBtn"
                title="Place Architectural Staircase: L-Shape, U-Shape or Straight (Hotkey K)">🪜 + Stairs</button>\n              `;
  htmlSrc = htmlSrc.replace('<button class="plan-tool-btn" data-tool="door"',
    stairBtnHtml + '<button class="plan-tool-btn" data-tool="door"');
}

fs.writeFileSync(path.join(rootDir, 'index.html'), htmlSrc, 'utf8');
console.log('✓ index.html updated with + Stairs button');

// Update orbix-ui.js for staircase inspector & toolbar button click
let uiSrc = fs.readFileSync(path.join(rootDir, 'orbix-ui.js'), 'utf8');

// A. Insert Stair Inspector rendering
const stairInspectorCode = `      // Staircase Inspector Panel
      if (selType === 'stair') {
        var stairId = this.editor.selected[0].id;
        var stair = (this.project.plan.stairs || []).find(function (st) { return st.id === stairId; });
        if (!stair) {
          inspContent.innerHTML = '<div style="padding:16px;color:#64748b;font-size:12px;">Staircase not found</div>';
          return;
        }

        var inspHtml = '<div style="padding:16px;">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">' +
          '<span style="font-weight:700;font-size:14px;color:#0f172a;">🪜 Architectural Staircase</span>' +
          '<span style="font-size:11px;font-weight:700;background:#e0f2fe;color:#0369a1;padding:2px 8px;border-radius:10px;">' +
          stair.type.toUpperCase() + '</span>' +
          '</div>' +

          '<div class="form-group" style="margin-bottom:10px;">' +
          '<label class="form-label" style="font-size:11px;font-weight:600;color:#475569;">Staircase Layout</label>' +
          '<select class="form-select" id="inspStairType" style="font-size:12px;padding:6px;">' +
          '<option value="l_shape"' + (stair.type === 'l_shape' ? ' selected' : '') + '>L-Shape (Quarter Turn 90°)</option>' +
          '<option value="u_shape"' + (stair.type === 'u_shape' ? ' selected' : '') + '>U-Shape (Half Turn 180° Dogleg)</option>' +
          '<option value="straight"' + (stair.type === 'straight' ? ' selected' : '') + '>Straight Flight Run</option>' +
          '</select>' +
          '</div>' +

          '<div class="form-group" style="margin-bottom:10px;">' +
          '<label class="form-label" style="font-size:11px;font-weight:600;color:#475569;">Turn Direction</label>' +
          '<div style="display:flex;gap:6px;">' +
          '<button type="button" class="btn small full ' + (stair.turnDirection === 'right' ? 'primary' : '') + '" id="inspStairTurnRight">Turn Right ↱</button>' +
          '<button type="button" class="btn small full ' + (stair.turnDirection === 'left' ? 'primary' : '') + '" id="inspStairTurnLeft">Turn Left ↰</button>' +
          '</div>' +
          '</div>' +

          '<div class="form-group" style="margin-bottom:10px;">' +
          '<label class="form-label" style="font-size:11px;font-weight:600;color:#475569;">Flight Width: <b id="stairWidthVal">' + stair.width + ' mm</b></label>' +
          '<input type="range" id="inspStairWidth" min="750" max="1300" step="50" value="' + stair.width + '" style="width:100%;">' +
          '</div>' +

          '<div class="form-group" style="margin-bottom:10px;">' +
          '<label class="form-label" style="font-size:11px;font-weight:600;color:#475569;">Tread Finish</label>' +
          '<select class="form-select" id="inspStairFinish" style="font-size:12px;padding:6px;">' +
          '<option value="marble"' + (stair.finish === 'marble' ? ' selected' : '') + '>🏛️ Statuario White Marble</option>' +
          '<option value="wood"' + (stair.finish === 'wood' ? ' selected' : '') + '>🪵 Warm Teak Hardwood</option>' +
          '<option value="concrete"' + (stair.finish === 'concrete' ? ' selected' : '') + '>🏢 Modern Basalt Stone / Concrete</option>' +
          '</select>' +
          '</div>' +

          '<div class="form-group" style="margin-bottom:14px;">' +
          '<label class="form-label" style="font-size:11px;font-weight:600;color:#475569;">Balustrade & Railing Style</label>' +
          '<select class="form-select" id="inspStairRailing" style="font-size:12px;padding:6px;">' +
          '<option value="glass_steel"' + (stair.railing === 'glass_steel' ? ' selected' : '') + '>✨ Tempered Glass & Stainless Steel</option>' +
          '<option value="black_metal"' + (stair.railing === 'black_metal' ? ' selected' : '') + '>⬛ Matte Black Metal Spindles</option>' +
          '</select>' +
          '</div>' +

          '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px;margin-bottom:14px;font-size:11px;color:#475569;line-height:1.5;">' +
          '<div>📐 <b>Total Rise:</b> ' + (stair.totalHeight || 2800) + ' mm (Ceiling Level)</div>' +
          '<div>🪜 <b>Steps:</b> ' + (stair.riserCount || 16) + ' Risers @ ' + (stair.riserHeight || 175) + ' mm</div>' +
          '<div>🦶 <b>Tread Going:</b> ' + (stair.treadDepth || 250) + ' mm</div>' +
          '</div>' +

          '<div style="display:flex;gap:6px;margin-bottom:10px;">' +
          '<button type="button" class="btn small full" id="inspStairRotate90">↻ Rotate 90°</button>' +
          '<button type="button" class="btn small danger full" id="inspStairDelete">🗑️ Delete</button>' +
          '</div>' +
          '</div>';

        inspContent.innerHTML = inspHtml;

        // Event listeners
        var selfUi = this;
        var typeSel = document.getElementById('inspStairType');
        if (typeSel) {
          typeSel.addEventListener('change', function () {
            stair.type = this.value;
            selfUi.editor.render();
            if (selfUi.render3DHome) selfUi.render3DHome(true);
            selfUi.updateInspector();
          });
        }
        var btnTurnR = document.getElementById('inspStairTurnRight');
        if (btnTurnR) {
          btnTurnR.addEventListener('click', function () {
            stair.turnDirection = 'right';
            selfUi.editor.render();
            if (selfUi.render3DHome) selfUi.render3DHome(true);
            selfUi.updateInspector();
          });
        }
        var btnTurnL = document.getElementById('inspStairTurnLeft');
        if (btnTurnL) {
          btnTurnL.addEventListener('click', function () {
            stair.turnDirection = 'left';
            selfUi.editor.render();
            if (selfUi.render3DHome) selfUi.render3DHome(true);
            selfUi.updateInspector();
          });
        }
        var widthSlider = document.getElementById('inspStairWidth');
        if (widthSlider) {
          widthSlider.addEventListener('input', function () {
            stair.width = parseInt(this.value, 10);
            stair.landingWidth = stair.width;
            var wVal = document.getElementById('stairWidthVal');
            if (wVal) wVal.textContent = stair.width + ' mm';
            selfUi.editor.render();
            if (selfUi.render3DHome) selfUi.render3DHome(true);
          });
        }
        var finishSel = document.getElementById('inspStairFinish');
        if (finishSel) {
          finishSel.addEventListener('change', function () {
            stair.finish = this.value;
            selfUi.editor.render();
            if (selfUi.render3DHome) selfUi.render3DHome(true);
          });
        }
        var railSel = document.getElementById('inspStairRailing');
        if (railSel) {
          railSel.addEventListener('change', function () {
            stair.railing = this.value;
            selfUi.editor.render();
            if (selfUi.render3DHome) selfUi.render3DHome(true);
          });
        }
        var btnRot = document.getElementById('inspStairRotate90');
        if (btnRot) {
          btnRot.addEventListener('click', function () {
            stair.rotY = ((stair.rotY || 0) + Math.PI / 2) % (Math.PI * 2);
            selfUi.editor.render();
            if (selfUi.render3DHome) selfUi.render3DHome(true);
          });
        }
        var btnDel = document.getElementById('inspStairDelete');
        if (btnDel) {
          btnDel.addEventListener('click', function () {
            selfUi.project.plan.stairs = (selfUi.project.plan.stairs || []).filter(function (st) { return st.id !== stair.id; });
            selfUi.editor.selected = [];
            selfUi.editor.render();
            if (selfUi.render3DHome) selfUi.render3DHome(true);
            selfUi.updateInspector();
          });
        }
        return;
      }
`;

if (!uiSrc.includes("if (selType === 'stair') {")) {
  uiSrc = uiSrc.replace("if (selType === 'opening') {",
    stairInspectorCode + "\n      if (selType === 'opening') {");
}

fs.writeFileSync(path.join(rootDir, 'orbix-ui.js'), uiSrc, 'utf8');
console.log('✓ orbix-ui.js updated with Staircase Inspector panel');

console.log('\n========================================');
console.log('STAIRCASE FEATURE IMPLEMENTED SUCCESSFULLY!');
console.log('========================================');

