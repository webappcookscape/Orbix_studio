const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
console.log('=== FIXING FLOOR GLITCH, PASTEL GROUND, RCC WALL SPLIT, WALLPAPER & COLOR ===\n');

// ─────────────────────────────────────────────────────────────────────────────
// 1. APP.JS: Soft Pastel Ground, Logarithmic Depth Buffer & Floor Elevation
// ─────────────────────────────────────────────────────────────────────────────
let appSrc = fs.readFileSync(path.join(rootDir, 'app.js'), 'utf8');

// A. Enable logarithmicDepthBuffer & improve camera near/far to eliminate floor glitch
appSrc = appSrc.replace(
  'try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" }); }',
  'try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance", logarithmicDepthBuffer: true }); }'
);
appSrc = appSrc.replace(
  'camera = new THREE.PerspectiveCamera(24, 1, 5, 1000000);',
  'camera = new THREE.PerspectiveCamera(24, 1, 15, 600000);'
);

// B. Update makeGrassGroundMat() to soft warm pastel (no green!)
const pastelMatCode = `    function makeGrassGroundMat() {
      if (matCache["sp|grassGround"]) return matCache["sp|grassGround"];
      var c = document.createElement("canvas"); c.width = c.height = 512;
      var g = c.getContext("2d");
      if (g) {
        // Architectural soft pastel warm ecru / linen ground base
        g.fillStyle = "#E6E2D8";
        g.fillRect(0, 0, 512, 512);

        // Subtle organic tone variations in warm pastel
        var pastelTones = ["#DFDBD0", "#E2DED4", "#E8E5DC", "#EDEAE2", "#D8DFD2", "#E4E0D6"];
        for (var i = 0; i < 450; i++) {
          var x = Math.random() * 512, y = Math.random() * 512, rad = 10 + Math.random() * 26;
          var grad = g.createRadialGradient(x, y, 0, x, y, rad);
          var col = pastelTones[Math.floor(Math.random() * pastelTones.length)];
          grad.addColorStop(0, col);
          grad.addColorStop(1, "rgba(230, 226, 216, 0)");
          g.fillStyle = grad;
          g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
        }

        // Fine stippled matte finish
        for (var b = 0; b < 2500; b++) {
          var bx = Math.random() * 512, by = Math.random() * 512;
          var bcol = (b % 3 === 0) ? "#D6D1C4" : ((b % 2 === 0) ? "#EAE6DE" : "#DFDBD0");
          g.fillStyle = bcol;
          g.fillRect(bx, by, 1.5, 1.5);
        }
      }

      var tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(120, 120);
      tex.encoding = THREE.sRGBEncoding;

      var m = new THREE.MeshStandardMaterial({
        map: tex,
        color: 0xE6E2D8, // Soft pastel exterior ground
        roughness: 0.94,
        metalness: 0.0,
        polygonOffset: true,
        polygonOffsetFactor: 2.0,
        polygonOffsetUnits: 2.0,
        side: THREE.DoubleSide
      });
      matCache["sp|grassGround"] = m;
      return m;
    }`;

// Replace makeGrassGroundMat in app.js
const mggmStart = appSrc.indexOf('function makeGrassGroundMat() {');
const mggmEnd = appSrc.indexOf('function makeNeutralGroundMat() {');
if (mggmStart !== -1 && mggmEnd !== -1) {
  appSrc = appSrc.substring(0, mggmStart) + pastelMatCode + '\n    ' + appSrc.substring(mggmEnd);
  console.log('✓ [app.js] makeGrassGroundMat updated to soft pastel stone/ecru (0xE6E2D8)');
}

// C. Replace HemisphereLight bounce color from 0x4E8A42 (green) to 0xE6E2D8 (pastel)
appSrc = appSrc.replace(
  'scene.add(new THREE.HemisphereLight(0x82C3EC, 0x4E8A42, 0.55));',
  'scene.add(new THREE.HemisphereLight(0x82C3EC, 0xE6E2D8, 0.55));'
);

// D. Position infinite floor below the 100mm concrete slab (y = -105 instead of y = -1)
appSrc = appSrc.replace(
  'floor.rotation.x = -Math.PI / 2; floor.position.y = -1; floor.receiveShadow = true; scene.add(floor);',
  'floor.rotation.x = -Math.PI / 2; floor.position.y = -105; floor.receiveShadow = true; scene.add(floor);'
);

fs.writeFileSync(path.join(rootDir, 'app.js'), appSrc, 'utf8');
console.log('✓ [app.js] Infinite ground positioned safely at y = -105 with logarithmic depth buffer');


// ─────────────────────────────────────────────────────────────────────────────
// 2. ORBIX-3D.JS: Wall Material (Color & Wallpaper) + Floor Material & Slab
// ─────────────────────────────────────────────────────────────────────────────
let threeDSrc = fs.readFileSync(path.join(rootDir, 'orbix-3d.js'), 'utf8');

// A. Update neutral_ground / grass in createFloorMaterial to 0xE6E2D8
threeDSrc = threeDSrc.replace(
  `    if (type === 'neutral_ground' || type === 'grass') {
      return new THREE.MeshStandardMaterial({
        color: 0x4E8A42, // Lush grass green
        roughness: 0.92,
        metalness: 0.0,
        side: THREE.DoubleSide
      });
    }`,
  `    if (type === 'neutral_ground' || type === 'grass') {
      return new THREE.MeshStandardMaterial({
        color: 0xE6E2D8, // Soft pastel exterior ground
        roughness: 0.94,
        metalness: 0.0,
        polygonOffset: true,
        polygonOffsetFactor: 2.0,
        polygonOffsetUnits: 2.0,
        side: THREE.DoubleSide
      });
    }`
);

// B. Position room floors so top is at y = 0.0 (or 0.3 for inner rooms) and slab extends down to -100
threeDSrc = threeDSrc.replace(
  'mesh.position.y = isInnerRoom ? (1.08 - floorDepth) : (1.0 - floorDepth);',
  'mesh.position.y = isInnerRoom ? (0.3 - floorDepth) : (0.0 - floorDepth);'
);

// C. Replace ALL occurrences of this.materials.wall in buildWallWithCutouts with wallMat
// First find buildWallWithCutouts
const bwwcStart = threeDSrc.indexOf('ArchitecturalRenderer.prototype.buildWallWithCutouts = function (wall, ops) {');
const bwwcEnd = threeDSrc.indexOf('ArchitecturalRenderer.prototype.buildDoor3D = function');
if (bwwcStart !== -1 && bwwcEnd !== -1) {
  let bwwcBody = threeDSrc.substring(bwwcStart, bwwcEnd);
  // Ensure var wallMat = this.createWallFinishMaterial(wall); is at start of buildWallWithCutouts
  if (!bwwcBody.includes('var wallMat = this.createWallFinishMaterial(wall);')) {
    bwwcBody = bwwcBody.replace(
      'var group = new THREE.Group();\n    group.name = \'Wall_\' + wall.id;',
      'var group = new THREE.Group();\n    group.name = \'Wall_\' + wall.id;\n    var wallMat = this.createWallFinishMaterial ? this.createWallFinishMaterial(wall) : this.materials.wall;'
    );
  }
  // Replace this.materials.wall with wallMat in all wall meshes
  bwwcBody = bwwcBody.replace(/new THREE\.Mesh\((geo|segGeo|sillGeo|lintelGeo|lastGeo),\s*this\.materials\.wall\)/g, 'new THREE.Mesh($1, wallMat)');
  threeDSrc = threeDSrc.substring(0, bwwcStart) + bwwcBody + threeDSrc.substring(bwwcEnd);
  console.log('✓ [orbix-3d.js] Replaced this.materials.wall with wallMat for all wall cutout meshes');
}

// D. Make sure createWallFinishMaterial handles wallpapers and colors correctly with texture repeat
const robustWallFinishFn = `
  ArchitecturalRenderer.prototype.createWallFinishMaterial = function (wall) {
    if (typeof THREE === 'undefined') return this.materials.wall;
    if (!wall) return this.materials.wall;
    var wallpaper = wall.wallpaper || 'none';
    var finishType = wall.wallFinishType || 'paint';
    var paintHex = wall.paintColor || '#B89F82';
    var wLen = Core.wallLength(wall) || 3000;
    var wH = wall.height || 2800;

    function hexToInt(hex) {
      if (!hex) return 0xB89F82;
      var h = String(hex).replace('#', '');
      if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
      var val = parseInt(h, 16);
      return isNaN(val) ? 0xB89F82 : val;
    }

    if (wallpaper && wallpaper !== 'none') {
      var c = document.createElement ? document.createElement('canvas') : null;
      if (c) {
        c.width = 512; c.height = 512;
        var ctx2 = c.getContext('2d');
        if (ctx2) {
          if (wallpaper === 'floral_blush') {
            ctx2.fillStyle = '#fdf2f8'; ctx2.fillRect(0, 0, 512, 512);
            for (var r = 0; r < 4; r++) {
              for (var col = 0; col < 4; col++) {
                var cx = col * 128 + 64, cy = r * 128 + 64;
                ctx2.fillStyle = '#f472b6'; ctx2.beginPath(); ctx2.arc(cx, cy, 22, 0, Math.PI * 2); ctx2.fill();
                ctx2.fillStyle = '#fb7185'; ctx2.beginPath(); ctx2.arc(cx + 26, cy - 14, 14, 0, Math.PI * 2); ctx2.fill();
                ctx2.fillStyle = '#fef08a'; ctx2.beginPath(); ctx2.arc(cx, cy, 8, 0, Math.PI * 2); ctx2.fill();
              }
            }
          } else if (wallpaper === 'geometric_teal') {
            ctx2.fillStyle = '#f0fdfa'; ctx2.fillRect(0, 0, 512, 512);
            ctx2.strokeStyle = '#0f766e'; ctx2.lineWidth = 3.5;
            for (var i2 = 0; i2 <= 4; i2++) {
              for (var j2 = 0; j2 <= 4; j2++) {
                var gx = i2 * 128, gy = j2 * 128;
                ctx2.strokeRect(gx + 16, gy + 16, 96, 96);
                ctx2.strokeRect(gx + 36, gy + 36, 56, 56);
              }
            }
          } else if (wallpaper === 'stripe_gold') {
            ctx2.fillStyle = '#fefce8'; ctx2.fillRect(0, 0, 512, 512);
            ctx2.fillStyle = '#ca8a04';
            for (var s = 0; s < 8; s++) { ctx2.fillRect(s * 64 + 18, 0, 28, 512); }
          } else if (wallpaper === 'herringbone_grey') {
            ctx2.fillStyle = '#f8fafc'; ctx2.fillRect(0, 0, 512, 512);
            ctx2.strokeStyle = '#64748b'; ctx2.lineWidth = 3;
            for (var h = 0; h < 6; h++) {
              var hx = h * 90;
              ctx2.beginPath(); ctx2.moveTo(hx, 0); ctx2.lineTo(hx + 45, 128); ctx2.lineTo(hx + 90, 0); ctx2.stroke();
              ctx2.beginPath(); ctx2.moveTo(hx, 128); ctx2.lineTo(hx + 45, 256); ctx2.lineTo(hx + 90, 128); ctx2.stroke();
              ctx2.beginPath(); ctx2.moveTo(hx, 256); ctx2.lineTo(hx + 45, 384); ctx2.lineTo(hx + 90, 256); ctx2.stroke();
              ctx2.beginPath(); ctx2.moveTo(hx, 384); ctx2.lineTo(hx + 45, 512); ctx2.lineTo(hx + 90, 384); ctx2.stroke();
            }
          } else if (wallpaper === 'damask_cream') {
            ctx2.fillStyle = '#fffbeb'; ctx2.fillRect(0, 0, 512, 512);
            ctx2.fillStyle = '#d97706'; ctx2.font = 'bold 72px serif';
            ctx2.textAlign = 'center'; ctx2.textBaseline = 'middle';
            for (var dr = 0; dr < 3; dr++) {
              for (var dc = 0; dc < 3; dc++) {
                ctx2.fillText('✦', dc * 170 + 85, dr * 170 + 85);
              }
            }
          } else if (wallpaper === 'tropical_leaf') {
            ctx2.fillStyle = '#f0fdf4'; ctx2.fillRect(0, 0, 512, 512);
            ctx2.fillStyle = '#059669'; ctx2.font = '110px serif';
            ctx2.textAlign = 'center'; ctx2.textBaseline = 'middle';
            ctx2.fillText('🌿', 128, 128); ctx2.fillText('🍃', 384, 128);
            ctx2.fillText('🍃', 128, 384); ctx2.fillText('🌿', 384, 384);
          }
          var tex = new THREE.CanvasTexture(c);
          tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
          tex.repeat.set(Math.max(1, wLen / 1000), Math.max(1, wH / 1000));
          return new THREE.MeshStandardMaterial({
            map: tex,
            roughness: 0.85,
            metalness: 0.0
          });
        }
      }
    }

    var roughness = 0.88;
    var bump = ArchitecturalRenderer.createWallBumpTexture ? ArchitecturalRenderer.createWallBumpTexture() : null;
    if (finishType === 'concrete') roughness = 0.95;
    else if (finishType === 'brick') roughness = 0.95;
    else if (finishType === 'marble') roughness = 0.22;
    else if (finishType === 'texture') roughness = 0.92;

    var matParams = {
      color: hexToInt(paintHex),
      roughness: roughness,
      metalness: finishType === 'marble' ? 0.08 : 0.0
    };
    if (bump) {
      matParams.bumpMap = bump;
      matParams.bumpScale = finishType === 'texture' ? 0.09 : 0.035;
    }
    return new THREE.MeshStandardMaterial(matParams);
  };
`;

// Replace createWallFinishMaterial in orbix-3d.js
if (threeDSrc.includes('ArchitecturalRenderer.prototype.createWallFinishMaterial =')) {
  const cwfmStart = threeDSrc.indexOf('ArchitecturalRenderer.prototype.createWallFinishMaterial =');
  const cwfmEnd = threeDSrc.indexOf('ArchitecturalRenderer.prototype.buildWallWithCutouts =');
  threeDSrc = threeDSrc.substring(0, cwfmStart) + robustWallFinishFn + '\n  ' + threeDSrc.substring(cwfmEnd);
  console.log('✓ [orbix-3d.js] createWallFinishMaterial upgraded with full texture repeats and patterns');
}

fs.writeFileSync(path.join(rootDir, 'orbix-3d.js'), threeDSrc, 'utf8');


// ─────────────────────────────────────────────────────────────────────────────
// 3. ORBIX-PLAN.JS: 2D Wall Color & Wallpaper Preview + Auto-split on draw
// ─────────────────────────────────────────────────────────────────────────────
let planSrc = fs.readFileSync(path.join(rootDir, 'orbix-plan.js'), 'utf8');

// A. In renderWalls: use w.paintColor and render wallpaper pattern stripe in 2D blueprint!
const renderWallFillTarget = `      ctx.fillStyle = isSelected ? '#2563eb' : '#8A735C'; // Rich Dark Beige Poche
      ctx.beginPath();
      var sp0 = this.worldToScreen(poly[0]);
      ctx.moveTo(sp0.x, sp0.y);
      for (var p = 1; p < poly.length; p++) {
        var sp = this.worldToScreen(poly[p]);
        ctx.lineTo(sp.x, sp.y);
      }
      ctx.closePath();
      ctx.fill();`;

const renderWallFillReplacement = `      // Wall Color / Wallpaper Fill in 2D Blueprint
      var wallFillColor = isSelected ? '#2563eb' : (w.paintColor || '#8A735C');
      if (!isSelected && w.wallpaper && w.wallpaper !== 'none') {
        if (w.wallpaper === 'floral_blush') wallFillColor = '#f472b6';
        else if (w.wallpaper === 'geometric_teal') wallFillColor = '#0d9488';
        else if (w.wallpaper === 'stripe_gold') wallFillColor = '#d97706';
        else if (w.wallpaper === 'herringbone_grey') wallFillColor = '#64748b';
        else if (w.wallpaper === 'damask_cream') wallFillColor = '#b45309';
        else if (w.wallpaper === 'tropical_leaf') wallFillColor = '#059669';
      }
      ctx.fillStyle = wallFillColor;
      ctx.beginPath();
      var sp0 = this.worldToScreen(poly[0]);
      ctx.moveTo(sp0.x, sp0.y);
      for (var p = 1; p < poly.length; p++) {
        var sp = this.worldToScreen(poly[p]);
        ctx.lineTo(sp.x, sp.y);
      }
      ctx.closePath();
      ctx.fill();

      // If wallpaper pattern is active, render a decorative center dashed line
      if (!isSelected && w.wallpaper && w.wallpaper !== 'none') {
        var spStart = this.worldToScreen(w.start);
        var spEnd = this.worldToScreen(w.end);
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.lineWidth = Math.max(1, 2 * this.zoom);
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(spStart.x, spStart.y); ctx.lineTo(spEnd.x, spEnd.y); ctx.stroke();
        ctx.restore();
      }`;

if (planSrc.includes(renderWallFillTarget)) {
  planSrc = planSrc.replace(renderWallFillTarget, renderWallFillReplacement);
  console.log('✓ [orbix-plan.js] 2D Blueprint walls now display custom wall color & wallpaper pattern');
}

fs.writeFileSync(path.join(rootDir, 'orbix-plan.js'), planSrc, 'utf8');


// ─────────────────────────────────────────────────────────────────────────────
// 4. ORBIX-CORE.JS: Comprehensive Wall Auto-Split (T-Joint, X-Joint, RCC Column)
// ─────────────────────────────────────────────────────────────────────────────
let coreSrc = fs.readFileSync(path.join(rootDir, 'orbix-core.js'), 'utf8');

// A. Improve splitWall to allow splits up to 40mm from endpoints (for RCC columns)
coreSrc = coreSrc.replace(
  'if (splitOffset < 200 || splitOffset > l - 200) {',
  'if (splitOffset < 40 || splitOffset > l - 40) {'
);

// Ensure properties carry over to w1 and w2
coreSrc = coreSrc.replace(
  'var w2 = createWall({\n      start: Vec2.clone(proj.pt),\n      end: Vec2.clone(w.end),\n      thickness: w.thickness,\n      height: w.height,\n      material: w.material\n    });',
  `var w2 = createWall({
      start: Vec2.clone(proj.pt),
      end: Vec2.clone(w.end),
      thickness: w.thickness,
      height: w.height,
      material: w.material
    });
    // Inherit wall paint, wallpaper, and finish styles
    w1.paintColor = w.paintColor;
    w1.wallpaper = w.wallpaper;
    w1.wallFinishType = w.wallFinishType;
    w2.paintColor = w.paintColor;
    w2.wallpaper = w.wallpaper;
    w2.wallFinishType = w.wallFinishType;`
);

// B. Comprehensive autoSplitWallAtJunctions covering:
// 1. T-Junctions (endpoint on interior of another wall)
// 2. Cross X-Junctions (walls intersecting each other)
// 3. RCC Joint Columns / Pillars (structural furniture or column points on a straight wall)
const fullAutoSplitFn = `
  /*  Comprehensive autoSplitWallAtJunctions:
      1. T-Junctions: Wall endpoint touching interior of straight wall -> split wall
      2. X-Junctions: Crossing walls -> split at intersection
      3. RCC Joint Columns: Structural RCC pillars / columns along straight wall -> split wall into separate walls
  */
  function autoSplitWallAtJunctions(project) {
    var walls = project && project.plan && project.plan.walls;
    if (!walls || walls.length === 0) return false;
    var changed = false;

    // ── 1. Split walls at RCC Columns / Structural Pillars on straight walls ──
    var furnList = (project.plan && project.plan.furniture) || [];
    var rccItems = furnList.filter(function (f) {
      return f && (f.category === 'structural' || f.category === 'civil' ||
        (f.name && /rcc|column|pillar|post/i.test(f.name)) ||
        (f.id && /rcc|column|pillar|post/i.test(f.id)) ||
        (f.catalogItemId && /rcc|column|pillar|post/i.test(f.catalogItemId)));
    });

    for (var ri = 0; ri < rccItems.length; ri++) {
      var rcc = rccItems[ri];
      if (!rcc.pos) continue;
      for (var wi = 0; wi < project.plan.walls.length; wi++) {
        var wObj = project.plan.walls[wi];
        if (wObj.isDivider) continue;
        var pRcc = Vec2.projectOnSegment(rcc.pos, wObj.start, wObj.end);
        var wL = wallLength(wObj);
        var distEnds = Math.min(pRcc.t * wL, (1 - pRcc.t) * wL);
        // If RCC column is within wall thickness distance and not at the very endpoints:
        if (pRcc.dist <= Math.max(80, (wObj.thickness || 150) / 2 + 50) && distEnds >= 50) {
          var resRcc = splitWall(project, wObj.id, pRcc.pt);
          if (resRcc) {
            changed = true;
            break;
          }
        }
      }
    }

    // ── 2. Split walls at T-Junctions & Crossing X-Junctions ──
    var TOL = 80; // mm
    for (var pass = 0; pass < 6; pass++) {
      var didSplit = false;
      var curWalls = project.plan.walls.slice();
      for (var i = 0; i < curWalls.length && !didSplit; i++) {
        var wi = curWalls[i];
        // Test endpoints of wi against interior of wj (T-joint)
        var testPts = [wi.start, wi.end];
        for (var tp = 0; tp < testPts.length && !didSplit; tp++) {
          var pt = testPts[tp];
          for (var j = 0; j < curWalls.length && !didSplit; j++) {
            if (j === i) continue;
            var wj = curWalls[j];
            var dS = Vec2.dist(pt, wj.start);
            var dE = Vec2.dist(pt, wj.end);
            if (dS < TOL || dE < TOL) continue;
            var proj = Vec2.projectOnSegment(pt, wj.start, wj.end);
            var wjLen = wallLength(wj);
            var distEndWj = Math.min(proj.t * wjLen, (1 - proj.t) * wjLen);
            if (proj.dist < TOL && distEndWj >= 50) {
              var resT = splitWall(project, wj.id, proj.pt);
              if (resT) {
                didSplit = true;
                changed = true;
              }
            }
          }
        }
        // Test crossing intersection between wi and wj (X-joint)
        for (var j2 = i + 1; j2 < curWalls.length && !didSplit; j2++) {
          var wj2 = curWalls[j2];
          var inter = segmentIntersection(wi.start, wi.end, wj2.start, wj2.end);
          if (inter && inter.t1 > 0.05 && inter.t1 < 0.95 && inter.t2 > 0.05 && inter.t2 < 0.95) {
            var resX = splitWall(project, wi.id, inter.pt);
            if (resX) {
              splitWall(project, wj2.id, inter.pt);
              didSplit = true;
              changed = true;
            }
          }
        }
      }
      if (!didSplit) break;
    }
    return changed;
  }
`;

// Replace autoSplitWallAtJunctions in orbix-core.js
const aswStart = coreSrc.indexOf('function autoSplitWallAtJunctions(project) {');
const aswEnd = coreSrc.indexOf('function getStaircasePolygon(stair)');
if (aswStart !== -1 && aswEnd !== -1) {
  coreSrc = coreSrc.substring(0, aswStart) + fullAutoSplitFn + '\n  ' + coreSrc.substring(aswEnd);
  console.log('✓ [orbix-core.js] autoSplitWallAtJunctions upgraded to handle T-joints, X-crossings & RCC Column joints');
}

fs.writeFileSync(path.join(rootDir, 'orbix-core.js'), coreSrc, 'utf8');


// ─────────────────────────────────────────────────────────────────────────────
// 5. ORBIX-UI.JS: Wall Inspector "➕ Insert RCC Joint" & Color/Wallpaper Handlers
// ─────────────────────────────────────────────────────────────────────────────
let uiSrc = fs.readFileSync(path.join(rootDir, 'orbix-ui.js'), 'utf8');

// Ensure infinite ground in render3DHome is placed below the 100mm slab (y = -105) with pastel color (0xE6E2D8)
uiSrc = uiSrc.replace(
  `scene.children.forEach(function (c) {
        if (c.isMesh && c.geometry && c.geometry.type === 'PlaneGeometry' && c.geometry.parameters && c.geometry.parameters.width >= 100000) {
          if (typeof gl.makeGrassGroundMat === 'function') {
            c.material = gl.makeGrassGroundMat();
          } else if (typeof gl.makeNeutralGroundMat === 'function') {
            c.material = gl.makeNeutralGroundMat();
          } else if (c.material) {
            c.material.map = null;
            if (c.material.color) c.material.color.setHex(0xEDECE8);
            c.material.needsUpdate = true;
          }
        }
      });`,
  `scene.children.forEach(function (c) {
        if (c.isMesh && c.geometry && c.geometry.type === 'PlaneGeometry' && c.geometry.parameters && c.geometry.parameters.width >= 100000) {
          c.position.y = -105; // Safely below 100mm physical concrete slab
          if (typeof gl.makeGrassGroundMat === 'function') {
            c.material = gl.makeGrassGroundMat();
          } else if (typeof gl.makeNeutralGroundMat === 'function') {
            c.material = gl.makeNeutralGroundMat();
          } else if (c.material) {
            c.material.map = null;
            if (c.material.color) c.material.color.setHex(0xE6E2D8);
            c.material.needsUpdate = true;
          }
        }
      });`
);

// Add "➕ Insert RCC Joint / Split Wall" button in Wall Inspector
const rccButtonHtml = `
          '<div style="margin-top:10px;padding:8px 10px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;">' +
          '  <label style="font-size:11px;font-weight:700;color:#1e293b;display:block;margin-bottom:4px;">🧱 RCC Column Joint (Separate Wall)</label>' +
          '  <div style="font-size:10.5px;color:#64748b;margin-bottom:6px;">Split this straight wall into separate walls at an RCC joint:</div>' +
          '  <div style="display:flex;gap:6px;">' +
          '    <button type="button" class="btn small full" id="inspWallSplitMid" style="background:#0f172a;color:#ffffff;font-size:11px;">➕ RCC Joint at Midpoint (' + Math.round(lenMm / 2) + 'mm)</button>' +
          '  </div>' +
          '</div>' +`;

if (!uiSrc.includes('inspWallSplitMid')) {
  uiSrc = uiSrc.replace(
    '<button class="btn danger full" id="inspDelWall" style="margin-top:12px">Delete Wall</button>',
    rccButtonHtml + '\n          <button class="btn danger full" id="inspDelWall" style="margin-top:12px">Delete Wall</button>'
  );
  console.log('✓ [orbix-ui.js] Added ➕ RCC Joint / Split Wall button in Wall Inspector');
}

// Add event listener for inspWallSplitMid
const rccSplitHandler = `
        var elSplitMid = document.getElementById('inspWallSplitMid');
        if (elSplitMid) {
          elSplitMid.addEventListener('click', function () {
            var midPt = { x: (w.start.x + w.end.x) / 2, y: (w.start.y + w.end.y) / 2 };
            var res = Core.splitWall(ed.project, w.id, midPt);
            if (res) {
              if (Core.detectRooms) Core.detectRooms(ed.project);
              ed.pushHistory('Insert RCC Column Joint');
              ed.selected = [{ type: 'wall', id: res.wall1.id }];
              ed.render();
              self.renderInspector(ed.selected);
              if (self.render3DHome) self.render3DHome(true);
              if (typeof window.toast === 'function') {
                window.toast('🧱 RCC Joint inserted: Wall separated into two individual walls');
              }
            }
          });
        }
`;

if (!uiSrc.includes("document.getElementById('inspWallSplitMid')")) {
  uiSrc = uiSrc.replace(
    "var elDelWall = document.getElementById('inspDelWall');",
    rccSplitHandler + "\n        var elDelWall = document.getElementById('inspDelWall');"
  );
  console.log('✓ [orbix-ui.js] Added inspWallSplitMid event listener');
}

// Make sure wall color & wallpaper listeners call ed.render() so 2D updates instantly!
uiSrc = uiSrc.replace(
  `        var elWallColor = document.getElementById('inspWallColor');
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
        }`,
  `        var elWallColor = document.getElementById('inspWallColor');
        if (elWallColor) {
          elWallColor.addEventListener('input', function () {
            w.paintColor = this.value;
            ed.render();
            if (self.render3DHome) self.render3DHome(true);
          });
          elWallColor.addEventListener('change', function () {
            ed.pushHistory('Change Wall Color');
            if (self.saveToLocalStorage) self.saveToLocalStorage();
          });
        }
        var elWallFinishType = document.getElementById('inspWallFinishType');
        if (elWallFinishType) {
          elWallFinishType.addEventListener('change', function () {
            w.wallFinishType = this.value;
            ed.pushHistory('Change Wall Finish');
            ed.render();
            if (self.render3DHome) self.render3DHome(true);
            if (self.saveToLocalStorage) self.saveToLocalStorage();
          });
        }
        var elWallpaper = document.getElementById('inspWallpaper');
        if (elWallpaper) {
          elWallpaper.addEventListener('change', function () {
            w.wallpaper = this.value;
            ed.pushHistory('Change Wall Wallpaper');
            ed.render();
            if (self.render3DHome) self.render3DHome(true);
            if (self.saveToLocalStorage) self.saveToLocalStorage();
          });
        }`
);

fs.writeFileSync(path.join(rootDir, 'orbix-ui.js'), uiSrc, 'utf8');

console.log('\n================================================================');
console.log('ALL FIXES FOR FLOOR GLITCH, PASTEL GROUND, RCC WALL SPLIT, WALLPAPER & COLOR APPLIED!');
console.log('================================================================\n');

