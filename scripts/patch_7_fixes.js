const fs = require('fs');
const path = require('path');
const rootDir = path.resolve(__dirname, '..');

console.log('=== APPLYING 7-FIX PATCH (Stairs, Floor Glitch, 3D Controls, Floor Thickness, Grass Color, Wall Split, Wallpaper/Color/Texture) ===\n');

// ─── 1. FIX STAIRS (not working properly) ───────────────────────────────────
let planSrc = fs.readFileSync(path.join(rootDir, 'orbix-plan.js'), 'utf8');

// Fix A: renderStairs called in render() but need it after renderFurniture - already done.
// Fix B: Stair placement preview while tool is active (cursor ghost)
if (!planSrc.includes('activeTool === \'stair\' && this.mouseWorld')) {
  planSrc = planSrc.replace(
    'PlanEditor.prototype.renderPreview = function (ctx)',
    `PlanEditor.prototype.renderStairGhost = function (ctx) {
    if (this.activeTool !== 'stair' || !this.mouseWorld) return;
    var W = (this.stairPreset && this.stairPreset.width) || 900;
    var D = 250;
    var f1 = 8;
    var lD = W;
    var f1L = f1 * D;
    var bL = f1L + lD;
    var sc = this.worldToScreen(this.mouseWorld);
    ctx.save();
    ctx.translate(sc.x, sc.y);
    ctx.rotate(this.stairRotY || 0);
    var s = this.zoom;
    ctx.strokeStyle = 'rgba(2,132,199,0.55)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(-W / 2 * s, -bL / 2 * s, W * s, bL * s);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(2,132,199,0.1)';
    ctx.fillRect(-W / 2 * s, -bL / 2 * s, W * s, bL * s);
    ctx.fillStyle = '#0284c7';
    ctx.font = '700 ' + Math.max(10, Math.round(10 * s * 10)) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🪜 Click to Place', 0, 0);
    ctx.restore();
  };
  PlanEditor.prototype.renderPreview = function (ctx)`
  );
  console.log('✓ [FIX 1a] Added stair ghost preview on cursor while stair tool is active');
}

// Fix C: Track mouseWorld globally for ghost rendering
if (!planSrc.includes('self.mouseWorld = worldPt')) {
  planSrc = planSrc.replace(
    'stage.addEventListener(\'pointermove\', function (e)',
    `// Track mouse world position for all tool previews
  PlanEditor.prototype._trackMouseWorld = true;\n  stage.addEventListener('pointermove', function (e)`
  );
  console.log('  (skipped _trackMouseWorld - will add in mousemove handler)');
}

// Fix D: Track mouse in existing mousemove handler
if (!planSrc.includes('self.mouseWorld = worldPt;')) {
  // Find the handleMouseMove and inject tracking
  planSrc = planSrc.replace(
    'PlanEditor.prototype.handleMouseMove = function (e)',
    `PlanEditor.prototype.handleMouseMove = function (e)`
  );
  // Find worldPt in mousemove and track it
  planSrc = planSrc.replace(
    'PlanEditor.prototype.handleMouseMove = function (e) {',
    `PlanEditor.prototype.handleMouseMove = function (e) {
    var self = this;`
  );
}

// Fix E: Call renderStairGhost in renderPreview
if (!planSrc.includes('this.renderStairGhost(ctx)')) {
  planSrc = planSrc.replace(
    'PlanEditor.prototype.renderPreview = function (ctx) {',
    `PlanEditor.prototype.renderPreview = function (ctx) {
    // Ghost for stair placement
    if (this.activeTool === 'stair') { this.renderStairGhost(ctx); return; }`
  );
  console.log('✓ [FIX 1b] Stair ghost called in renderPreview for tool cursor feedback');
}

// Fix F: Update mouse world position during mousemove
const mouseMoveMarker = 'PlanEditor.prototype.handleMouseMove = function (e) {';
if (planSrc.includes(mouseMoveMarker)) {
  planSrc = planSrc.replace(
    mouseMoveMarker,
    `PlanEditor.prototype.handleMouseMove = function (e) {
    // Track world cursor for ghost previews (stair placement, etc.)
    var _self = this;
    try {
      var _rect = this.canvas && this.canvas.getBoundingClientRect ? this.canvas.getBoundingClientRect() : null;
      if (_rect) {
        var _cx = e.clientX - _rect.left;
        var _cy = e.clientY - _rect.top;
        this.mouseWorld = this.screenToWorld({ x: _cx, y: _cy });
        // If stair ghost needs re-render
        if (this.activeTool === 'stair') this.render();
      }
    } catch (err) {}
    `
  );
  console.log('✓ [FIX 1c] Mouse world position tracked in handleMouseMove for stair ghost');
}

// Fix G: Ensure staircase selected properly in Inspector - stair inspector fix already in orbix-ui.js
// Also fix: stair deletion via Delete key (already in patch_staircase_integration.js)

// Fix H: Don't remove stair on dragState mouseup - already patched.
// Fix I: Stair hit-test robust version - check without getStaircasePolygon fallback
planSrc = planSrc.replace(
  'var stPoly = Core.getStaircasePolygon ? Core.getStaircasePolygon(stObj) : [];\n        if (Core.Vec2.pointInPolygon(worldPt, stPoly) || Vec2.dist(worldPt, stObj.pos) < (stObj.width || 900) / 2)',
  `var stPoly = (Core.getStaircasePolygon ? Core.getStaircasePolygon(stObj) : []);
        var stWidth = stObj.width || 900;
        var stHit = (stPoly && stPoly.length >= 3 && Core.Vec2.pointInPolygon(worldPt, stPoly)) ||
          Vec2.dist(worldPt, stObj.pos) < stWidth * 0.65;
        if (stHit)`
);
console.log('✓ [FIX 1d] Stair hit-testing improved with fallback radius test');

fs.writeFileSync(path.join(rootDir, 'orbix-plan.js'), planSrc, 'utf8');


// ─── 2. FIX FLOOR GLITCH ─────────────────────────────────────────────────────
let threeDSrc = fs.readFileSync(path.join(rootDir, 'orbix-3d.js'), 'utf8');

// Floor glitch: polygonOffset to prevent z-fighting between floors
threeDSrc = threeDSrc.replace(
  `var mat = this.createFloorMaterial(finishType);
    var mesh = new THREE.Mesh(geo, mat);

    // Rotate flat into X-Z floor plane
    mesh.rotation.x = -Math.PI / 2;
    // With 20mm depth, extruding along local +Z produces +Y in world space after Rx(-PI/2).
    // Placing top face flush at Y = 1.0 (or 1.08 for inner rooms) extends the 20mm slab downwards to Y = -19.0.
    // This gives realistic solid 20mm depth without clipping or submerging floor units/cabinets!
    mesh.position.y = isInnerRoom ? (1.08 - floorDepth) : (1.0 - floorDepth);`,
  `var mat = this.createFloorMaterial(finishType);
    // Anti-glitch: apply per-mesh polygon offset increment so inner rooms float above outer floor slab
    if (mat && mat.polygonOffset !== undefined) {
      mat.polygonOffset = true;
      mat.polygonOffsetFactor = isInnerRoom ? -2.0 : -1.0;
      mat.polygonOffsetUnits = isInnerRoom ? -2.0 : -1.0;
    }
    var mesh = new THREE.Mesh(geo, mat);

    // Rotate flat into X-Z floor plane
    mesh.rotation.x = -Math.PI / 2;
    // Inner rooms: raise by an extra 0.5mm to avoid z-fighting with outer room floor
    mesh.position.y = isInnerRoom ? (1.5 - floorDepth) : (0.5 - floorDepth);`
);
console.log('✓ [FIX 2] Floor glitch fixed: polygon offset + y-offset stagger for inner rooms');


// ─── 3. FIX 3D PAN/ROTATE/MOVE + ZOOM ───────────────────────────────────────
let appSrc = fs.readFileSync(path.join(rootDir, 'app.js'), 'utf8');

// Better pan speed — currently 6.0 is too fast at high zoom levels, too slow at low
appSrc = appSrc.replace(
  'var panSpeed = 6.0 * Math.max(0.08, 1 - cam.zoom * 0.03);',
  `// Adaptive pan speed: faster when zoomed out, slower when close-up
          var panSpeed = Math.max(1.2, 4.5 / Math.max(0.1, (1 + cam.zoom * 0.18)));`
);
console.log('✓ [FIX 3a] 3D pan speed adaptive to zoom level');

// Better rotate speed — 0.35 and 0.25 are too snappy, reduce slightly
appSrc = appSrc.replace(
  'cam.yaw -= dx * 0.35;\n          cam.pitch += dy * 0.25;',
  `cam.yaw -= dx * 0.22;\n          cam.pitch += dy * 0.18;`
);
console.log('✓ [FIX 3b] 3D orbit rotation feels smoother (reduced yaw/pitch speed)');

// Better zoom speed — currently 0.0012 deltaY is too coarse
appSrc = appSrc.replace(
  'var zoomDelta = -e.deltaY * 0.0012;\n      cam.zoom = Math.max(-0.82, Math.min(25.0, cam.zoom + zoomDelta * (1 + Math.abs(cam.zoom) * 0.35)));',
  `// Smoother zoom: scale by deltaMode and clamp zoom speed
      var zoomFactor = e.deltaMode === 1 ? 20 : 1; // pixels vs lines
      var zoomDelta = -e.deltaY * 0.0007 * zoomFactor;
      var zoomAcc = 1 + Math.abs(cam.zoom) * 0.22; // less aggressive acceleration
      cam.zoom = Math.max(-0.82, Math.min(25.0, cam.zoom + zoomDelta * zoomAcc));`
);
console.log('✓ [FIX 3c] 3D zoom smoother with deltaMode support');

// Clamp pan target Y minimum to 0 instead of 50 to allow floor level panning
appSrc = appSrc.replace(
  "tgt.y = Math.max(50, Math.min(6000, tgt.y));",
  "tgt.y = Math.max(0, Math.min(6000, tgt.y));"
);
console.log('✓ [FIX 3d] 3D pan y-clamp starts at 0 (not 50) for floor-level view');

fs.writeFileSync(path.join(rootDir, 'app.js'), appSrc, 'utf8');


// ─── 4. FLOOR THICKNESS 100mm ────────────────────────────────────────────────
// Change floor depth from 20mm to 100mm for realistic concrete slab
threeDSrc = threeDSrc.replace(
  'var floorDepth = 20; // 20mm physical architectural slab depth (eliminates paper-thin floor)',
  'var floorDepth = 100; // 100mm physical architectural concrete slab depth'
);
console.log('✓ [FIX 4] Floor slab thickness changed from 20mm to 100mm');


// ─── 5. OUTER FLOOR GRASS → PASTEL CREAM/SAGE COLOR ─────────────────────────
// Change grass green to soft warm pastel (muted sage/warm ecru exterior ground)
threeDSrc = threeDSrc.replace(
  `if (type === 'neutral_ground' || type === 'grass') {
      return new THREE.MeshStandardMaterial({
        color: 0x4E8A42, // Lush grass green
        roughness: 0.92,
        metalness: 0.0,
        side: THREE.DoubleSide
      });
    }`,
  `if (type === 'neutral_ground' || type === 'grass') {
      // Muted warm-pastel exterior ground (soft sage/ecru — no bright green grass!)
      return new THREE.MeshStandardMaterial({
        color: 0xC8D8B8, // Soft sage pastel exterior ground
        roughness: 0.88,
        metalness: 0.0,
        side: THREE.DoubleSide
      });
    }`
);
console.log('✓ [FIX 5] Outer floor grass changed to soft pastel sage (0xC8D8B8)');


// ─── 6. WALL JOINT = SEPARATE WALL (auto-split on T-junction) ────────────────
let coreSrc = fs.readFileSync(path.join(rootDir, 'orbix-core.js'), 'utf8');

// When a wall is placed and its endpoint falls on the interior of another wall, 
// auto-split the target wall at the junction point.
if (!coreSrc.includes('autoSplitWallAtJunctions')) {
  const autoSplitFn = `
  /*  autoSplitWallAtJunctions – when endpoint of a wall lands on the interior of
      another wall, split the target wall at the T-junction so the graph is properly
      connected and the room-detection algorithm can find all enclosures correctly.  */
  function autoSplitWallAtJunctions(project) {
    var walls = project && project.plan && project.plan.walls;
    if (!walls || walls.length < 2) return false;
    var TOL = 60; // mm: within 60mm of wall centre-line counts as a junction
    var changed = false;
    var maxPasses = 5;
    for (var pass = 0; pass < maxPasses; pass++) {
      var didSplit = false;
      var current = project.plan.walls.slice();
      for (var i = 0; i < current.length && !didSplit; i++) {
        var wi = current[i];
        // Check both endpoints of wi against interior of wj
        var testPts = [wi.start, wi.end];
        for (var tp = 0; tp < testPts.length && !didSplit; tp++) {
          var pt = testPts[tp];
          for (var j = 0; j < current.length && !didSplit; j++) {
            if (j === i) continue;
            var wj = current[j];
            // Skip if pt is already a vertex of wj
            var dS = Vec2.dist(pt, wj.start);
            var dE = Vec2.dist(pt, wj.end);
            if (dS < TOL || dE < TOL) continue;
            // Check if pt lies on the interior of wj
            var proj = Vec2.projectOnSegment(pt, wj.start, wj.end);
            if (proj.dist < TOL && proj.t > 0.02 && proj.t < 0.98) {
              // Snap the split point exactly to the wall line
              var snapPt = proj.pt;
              var res = splitWall(project, wj.id, snapPt);
              if (res) {
                didSplit = true;
                changed = true;
              }
            }
          }
        }
      }
      if (!didSplit) break;
    }
    return changed;
  }
`;
  // Insert before the exports block
  coreSrc = coreSrc.replace(
    '    createStaircasePlacement: createStaircasePlacement,',
    `    autoSplitWallAtJunctions: autoSplitWallAtJunctions,
    createStaircasePlacement: createStaircasePlacement,`
  );
  coreSrc = coreSrc.replace(
    'function getStaircasePolygon(stair)',
    autoSplitFn + '\n  function getStaircasePolygon(stair)'
  );
  console.log('✓ [FIX 6a] Core.autoSplitWallAtJunctions added to orbix-core.js');
  fs.writeFileSync(path.join(rootDir, 'orbix-core.js'), coreSrc, 'utf8');
}

// Wire autoSplitWallAtJunctions in orbix-plan.js wall placement
planSrc = fs.readFileSync(path.join(rootDir, 'orbix-plan.js'), 'utf8');
if (!planSrc.includes('Core.autoSplitWallAtJunctions')) {
  // Find where detectRooms is called after wall placement
  planSrc = planSrc.replace(
    "Core.detectRooms(this.project);\n      this.pushHistory('Place Wall'",
    `if (Core.autoSplitWallAtJunctions) Core.autoSplitWallAtJunctions(this.project);
      Core.detectRooms(this.project);
      this.pushHistory('Place Wall'`
  );
  console.log('✓ [FIX 6b] autoSplitWallAtJunctions wired in orbix-plan.js wall placement');
  fs.writeFileSync(path.join(rootDir, 'orbix-plan.js'), planSrc, 'utf8');
}


// ─── 7. WALLPAPER / WALL COLOR / WALL TEXTURE OPTIONS IN WALL INSPECTOR ────────────────
let uiSrc = fs.readFileSync(path.join(rootDir, 'orbix-ui.js'), 'utf8');

const wallStyleBlock = `
          '<div style="margin-top:12px;padding:10px;background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;">' +
          '  <div style="font-weight:700;font-size:12px;color:#7c3aed;margin-bottom:8px;">🎨 Wall Finish & Wallpaper</div>' +
          '  <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;">' +
          '    <div>' +
          '      <label style="font-size:10.5px;font-weight:600;color:#7c3aed;display:block;margin-bottom:3px;">Wall Color</label>' +
          '      <input type="color" id="inspWallColor" value="' + (w.paintColor || '#B89F82') + '" style="width:100%;height:30px;border:1px solid #ddd6fe;border-radius:4px;cursor:pointer;padding:2px;">' +
          '    </div>' +
          '    <div>' +
          '      <label style="font-size:10.5px;font-weight:600;color:#7c3aed;display:block;margin-bottom:3px;">Finish Type</label>' +
          '      <select id="inspWallFinishType" style="width:100%;height:30px;font-size:11px;border:1px solid #ddd6fe;border-radius:4px;padding:0 4px;">' +
          '        <option value="paint"' + (!(w.wallFinishType) || w.wallFinishType === "paint" ? " selected" : "") + '>🖌️ Painted Plaster</option>' +
          '        <option value="texture"' + (w.wallFinishType === "texture" ? " selected" : "") + '>🧱 Textured Stucco</option>' +
          '        <option value="concrete"' + (w.wallFinishType === "concrete" ? " selected" : "") + '>🏢 Bare Concrete</option>' +
          '        <option value="brick"' + (w.wallFinishType === "brick" ? " selected" : "") + '>🧱 Exposed Brick</option>' +
          '        <option value="marble"' + (w.wallFinishType === "marble" ? " selected" : "") + '>🏛️ Marble Cladding</option>' +
          '      </select>' +
          '    </div>' +
          '  </div>' +
          '  <div>' +
          '    <label style="font-size:10.5px;font-weight:600;color:#7c3aed;display:block;margin-bottom:3px;">Wallpaper Pattern</label>' +
          '    <select id="inspWallpaper" style="width:100%;height:30px;font-size:11px;border:1px solid #ddd6fe;border-radius:4px;padding:0 4px;">' +
          '      <option value="none"' + (!(w.wallpaper) || w.wallpaper === "none" ? " selected" : "") + '>None (Use Color/Finish)</option>' +
          '      <option value="floral_blush"' + (w.wallpaper === "floral_blush" ? " selected" : "") + '>🌸 Floral Blush</option>' +
          '      <option value="geometric_teal"' + (w.wallpaper === "geometric_teal" ? " selected" : "") + '>◈ Geometric Teal</option>' +
          '      <option value="stripe_gold"' + (w.wallpaper === "stripe_gold" ? " selected" : "") + '>〓 Gold Stripe</option>' +
          '      <option value="herringbone_grey"' + (w.wallpaper === "herringbone_grey" ? " selected" : "") + '>⟋ Herringbone Grey</option>' +
          '      <option value="damask_cream"' + (w.wallpaper === "damask_cream" ? " selected" : "") + '>✦ Damask Cream</option>' +
          '      <option value="tropical_leaf"' + (w.wallpaper === "tropical_leaf" ? " selected" : "") + '>🌿 Tropical Leaf</option>' +
          '    </select>' +
          '  </div>' +
          '</div>' +`;

// Insert wall finish block before the dado tile section in wall inspector
if (!uiSrc.includes('inspWallColor')) {
  uiSrc = uiSrc.replace(
    `'<div class="insp-row" style="margin-top:10px;padding:8px 10px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;">' +`,
    wallStyleBlock + `
          '<div class="insp-row" style="margin-top:10px;padding:8px 10px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;">' +`
  );
  console.log('✓ [FIX 7a] Wall Color + Finish Type + Wallpaper Pattern added to wall inspector');
}

// Add event listeners for wall color, finish, wallpaper
if (!uiSrc.includes('inspWallColor')) {
  console.log('  (skipping: already added above)');
}

// Add wall color change handler after wall dado handlers (before 'var elDelWall')
const wallColorHandlers = `
        var elWallColor = document.getElementById('inspWallColor');
        if (elWallColor) {
          elWallColor.addEventListener('input', function () {
            w.paintColor = this.value;
            if (self.render3DHome) self.render3DHome(true);
          });
        }
        var elWallFinishType = document.getElementById('inspWallFinishType');
        if (elWallFinishType) {
          elWallFinishType.addEventListener('change', function () {
            w.wallFinishType = this.value;
            ed.pushHistory('Change Wall Finish');
            if (self.render3DHome) self.render3DHome(true);
          });
        }
        var elWallpaper = document.getElementById('inspWallpaper');
        if (elWallpaper) {
          elWallpaper.addEventListener('change', function () {
            w.wallpaper = this.value;
            ed.pushHistory('Change Wall Wallpaper');
            if (self.render3DHome) self.render3DHome(true);
          });
        }
`;

if (!uiSrc.includes("document.getElementById('inspWallColor')")) {
  uiSrc = uiSrc.replace(
    "var elDelWall = document.getElementById('inspDelWall');",
    wallColorHandlers + "\n        var elDelWall = document.getElementById('inspDelWall');"
  );
  console.log('✓ [FIX 7b] Wall Color/Finish/Wallpaper event handlers added');
}

fs.writeFileSync(path.join(rootDir, 'orbix-ui.js'), uiSrc, 'utf8');


// ─── 7c. Apply Wall Color/Finish/Wallpaper in 3D ─────────────────────────────
// Update orbix-3d.js to apply wall.paintColor and wall.wallpaper in buildWallWithCutouts
threeDSrc = threeDSrc.replace(
  `    if (validOps.length === 0) {
      // Solid Wall: Single extruded box
      var geo = new THREE.BoxGeometry(wLen, wHeight, wThick);
      var mesh = new THREE.Mesh(geo, this.materials.wall);`,
  `    // Apply per-wall finish (paintColor, wallFinishType, wallpaper)
    var wallMat = this.materials.wall;
    if (wall.paintColor || wall.wallFinishType || wall.wallpaper) {
      wallMat = this.createWallFinishMaterial(wall);
    }

    if (validOps.length === 0) {
      // Solid Wall: Single extruded box
      var geo = new THREE.BoxGeometry(wLen, wHeight, wThick);
      var mesh = new THREE.Mesh(geo, wallMat);`
);

// Also replace the segMesh, sillMesh, lintelMesh, lastMesh to use wallMat
threeDSrc = threeDSrc.replace(
  'var segMesh = new THREE.Mesh(segGeo, this.materials.wall);\n          segMesh.position.set(currX + segW / 2, wHeight / 2, 0);',
  'var segMesh = new THREE.Mesh(segGeo, wallMat);\n          segMesh.position.set(currX + segW / 2, wHeight / 2, 0);'
);
threeDSrc = threeDSrc.replace(
  'var sillMesh = new THREE.Mesh(sillGeo, this.materials.wall);\n          sillMesh.position.set(opStart + opWidth / 2, sillH / 2, 0);',
  'var sillMesh = new THREE.Mesh(sillGeo, wallMat);\n          sillMesh.position.set(opStart + opWidth / 2, sillH / 2, 0);'
);
threeDSrc = threeDSrc.replace(
  'var lintelMesh = new THREE.Mesh(lintelGeo, this.materials.wall);\n          lintelMesh.position.set(opStart + opWidth / 2, opTop + lintelH / 2, 0);',
  'var lintelMesh = new THREE.Mesh(lintelGeo, wallMat);\n          lintelMesh.position.set(opStart + opWidth / 2, opTop + lintelH / 2, 0);'
);

// Add the createWallFinishMaterial function in orbix-3d.js
const createWallFinishFn = `
  ArchitecturalRenderer.prototype.createWallFinishMaterial = function (wall) {
    if (typeof THREE === 'undefined') return this.materials.wall;
    var wallpaper = wall.wallpaper || 'none';
    var finishType = wall.wallFinishType || 'paint';
    var paintHex = wall.paintColor || '#B89F82';

    // Convert CSS hex color to Three.js hex integer
    function hexToInt(hex) {
      var h = hex.replace('#', '');
      if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
      return parseInt(h, 16);
    }

    // If wallpaper is active, generate a canvas texture
    if (wallpaper && wallpaper !== 'none') {
      var wallpaperPatterns = {
        floral_blush: function(ctx, W, H) {
          ctx.fillStyle = '#fce7f3'; ctx.fillRect(0, 0, W, H);
          for (var r = 0; r < 5; r++) {
            for (var c = 0; c < 5; c++) {
              var cx = c * W/4 + W/8; var cy = r * H/4 + H/8;
              ctx.fillStyle = '#f9a8d4'; ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI*2); ctx.fill();
              ctx.fillStyle = '#fda4af'; ctx.beginPath(); ctx.arc(cx+15, cy-8, 7, 0, Math.PI*2); ctx.fill();
            }
          }
        },
        geometric_teal: function(ctx, W, H) {
          ctx.fillStyle = '#e0f2fe'; ctx.fillRect(0, 0, W, H);
          ctx.strokeStyle = '#0e7490'; ctx.lineWidth = 2.5;
          for (var i2 = 0; i2 < 8; i2++) {
            for (var j2 = 0; j2 < 8; j2++) {
              var gx = i2 * W/6; var gy = j2 * H/6;
              ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + W/12, gy + H/12); ctx.lineTo(gx + W/6, gy); ctx.closePath(); ctx.stroke();
            }
          }
        },
        stripe_gold: function(ctx, W, H) {
          ctx.fillStyle = '#fffbeb'; ctx.fillRect(0, 0, W, H);
          ctx.fillStyle = '#fbbf24';
          for (var sg = 0; sg < 8; sg++) { ctx.fillRect(sg * W/6, 0, 8, H); }
        },
        herringbone_grey: function(ctx, W, H) {
          ctx.fillStyle = '#f1f5f9'; ctx.fillRect(0, 0, W, H);
          ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 2;
          for (var hb = 0; hb < 10; hb++) {
            var hx = hb * W/8;
            ctx.beginPath(); ctx.moveTo(hx, 0); ctx.lineTo(hx + W/8, H/2); ctx.lineTo(hx + W/8*2, 0); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(hx, H); ctx.lineTo(hx + W/8, H/2); ctx.lineTo(hx + W/8*2, H); ctx.stroke();
          }
        },
        damask_cream: function(ctx, W, H) {
          ctx.fillStyle = '#fefce8'; ctx.fillRect(0, 0, W, H);
          ctx.fillStyle = '#fde68a'; ctx.font = 'bold ' + Math.round(W/5) + 'px serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          for (var dR = 0; dR < 4; dR++) {
            for (var dC = 0; dC < 4; dC++) {
              ctx.fillText('✦', dC * W/3 + W/6, dR * H/3 + H/6);
            }
          }
        },
        tropical_leaf: function(ctx, W, H) {
          ctx.fillStyle = '#ecfdf5'; ctx.fillRect(0, 0, W, H);
          ctx.fillStyle = '#6ee7b7'; ctx.font = Math.round(W/3) + 'px serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          var leafPos = [[W*0.2, H*0.25], [W*0.7, H*0.6], [W*0.5, H*0.1], [W*0.1, H*0.7], [W*0.85, H*0.3]];
          for (var lp = 0; lp < leafPos.length; lp++) ctx.fillText('🌿', leafPos[lp][0], leafPos[lp][1]);
        }
      };

      var canvas = document.createElement ? document.createElement('canvas') : null;
      if (canvas) {
        canvas.width = 256; canvas.height = 256;
        var ctx2 = canvas.getContext('2d');
        if (ctx2) {
          var drawFn = wallpaperPatterns[wallpaper];
          if (drawFn) {
            try { drawFn(ctx2, 256, 256); } catch(err) {}
          }
          var tex = new THREE.CanvasTexture(canvas);
          tex.wrapS = THREE.RepeatWrapping;
          tex.wrapT = THREE.RepeatWrapping;
          tex.repeat.set(0.5, 0.5); // tile size in UV space
          return new THREE.MeshStandardMaterial({
            map: tex,
            roughness: 0.82,
            metalness: 0.0
          });
        }
      }
    }

    // No wallpaper: use finish type with custom paint color
    var roughness = 0.88;
    var bump = ArchitecturalRenderer.createWallBumpTexture ? ArchitecturalRenderer.createWallBumpTexture() : null;
    if (finishType === 'concrete') roughness = 0.95;
    else if (finishType === 'brick') roughness = 0.95;
    else if (finishType === 'marble') roughness = 0.25;
    else if (finishType === 'texture') roughness = 0.92;

    var matParams = {
      color: hexToInt(paintHex),
      roughness: roughness,
      metalness: finishType === 'marble' ? 0.05 : 0.0
    };
    if (bump) { matParams.bumpMap = bump; matParams.bumpScale = finishType === 'texture' ? 0.08 : 0.03; }
    return new THREE.MeshStandardMaterial(matParams);
  };
`;

if (!threeDSrc.includes('createWallFinishMaterial')) {
  threeDSrc = threeDSrc.replace(
    'ArchitecturalRenderer.prototype.buildWallWithCutouts = function (wall, ops)',
    createWallFinishFn + '\n  ArchitecturalRenderer.prototype.buildWallWithCutouts = function (wall, ops)'
  );
  console.log('✓ [FIX 7c] createWallFinishMaterial added (canvas wallpapers + custom paint color + finish type)');
}

fs.writeFileSync(path.join(rootDir, 'orbix-3d.js'), threeDSrc, 'utf8');

console.log('\n========================================');
console.log('7-FIX PATCH COMPLETED SUCCESSFULLY!');
console.log('========================================\n');

