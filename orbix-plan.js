/* ═══════════════════════════════════════════════════════════════════════════════
   ORBIX STUDIO — 2D Architectural Plan Editor Component
   Interactive Canvas Editor for Drawing Residential Floor Plans
   ═══════════════════════════════════════════════════════════════════════════════ */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    var coreLib;
    try { coreLib = require('./orbix-core.js'); } catch (_) { coreLib = require('../orbix-core.js'); }
    module.exports = factory(coreLib);
  } else {
    root.OrbixPlan = factory(root.OrbixCore);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Core) {
  'use strict';

  var Vec2 = Core.Vec2;

  function PlanEditor(container, opts) {
    opts = opts || {};
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.project = opts.project || Core.createProject();
    this.onProjectChange = opts.onProjectChange || function () {};
    this.onSelectionChange = opts.onSelectionChange || function () {};

    // Tool state: 'select' | 'wall' | 'door' | 'window' | 'room' | 'split' | 'measure'
    this.activeTool = 'select';
    this.doorPreset = { width: 900, height: 2100, swing: 'in-left' };
    this.windowPreset = { width: 1200, height: 1200, sillHeight: 900 };
    this.wallPreset = { thickness: 150, height: 2800 };
    this.furniturePreset = (Core.FURNITURE_CATALOG && Core.FURNITURE_CATALOG[0]) || null;
    this.furnitureRotY = 0;

    // Viewport transform (world mm to canvas px)
    this.pan = { x: 400, y: 350 };
    this.zoom = 0.12; // 120 px per 1000 mm (1m)

    // Selection & interaction
    this.selected = []; // array of { type: 'wall'|'opening'|'room', id: string }
    this.hovered = null; // { type, id, part }
    this.dragState = null;
    this.wallChainStart = null;
    this.wallChainFirstPoint = null;
    this.isShiftDown = false;
    this.cursorWorld = { x: 0, y: 0 };
    this.numericInputBuffer = '';
    this.clipboard = [];
    this.pasteCount = 0;

    // 2D Measurement Unit System: 'mm' | 'imperial' (feet & inches)
    this.unitSystem = 'mm';

    // Underlay Floor Plan Image (Blueprint tracing)
    this.underlay = {
      img: null,
      x: 0,
      y: 0,
      scale: 10, // mm per image pixel (e.g. 1000px image = 10,000mm home)
      opacity: 0.45,
      visible: true,
      width: 0,
      height: 0,
      calibPoints: []
    };
    this.onCalibrateRequest = opts.onCalibrateRequest || null;

    // History for Undo/Redo
    this.history = [];
    this.historyIndex = -1;

    this.initDOM();
    this.bindEvents();
    this.pushHistory('Init');
    this.resize();
    this.render();
  }

  // 2D Unit Formatting: mm or ft & in
  PlanEditor.prototype.formatDim = function (mm) {
    if (this.unitSystem === 'imperial') {
      var totalInches = mm / 25.4;
      var feet = Math.floor(totalInches / 12);
      var remInches = Math.round(totalInches % 12);
      if (remInches === 12) {
        feet += 1;
        remInches = 0;
      }
      if (feet === 0) return remInches + '"';
      if (remInches === 0) return feet + '\'';
      return feet + '\' ' + remInches + '"';
    }
    return Math.round(mm).toLocaleString() + ' mm';
  };

  // Comprehensive dimension formatter: millimeters (mm), centimeters (cm), and feet & inches (ft-in)
  PlanEditor.prototype.formatAllDims = function (mm) {
    var mmVal = Math.round(mm);
    var cmVal = (mm / 10).toFixed(1).replace(/\.0$/, '');
    var totalInches = mm / 25.4;
    var feet = Math.floor(totalInches / 12);
    var remInches = Math.round(totalInches % 12);
    if (remInches === 12) { feet += 1; remInches = 0; }
    var ftInVal = (feet === 0) ? (remInches + '"') : (remInches === 0 ? (feet + "'") : (feet + "' " + remInches + '"'));

    return {
      mm: mmVal + ' mm',
      cm: cmVal + ' cm',
      ftIn: ftInVal,
      combined: mmVal + ' mm · ' + cmVal + ' cm · ' + ftInVal
    };
  };

  // Parse user length input in either mm or imperial notation (e.g. 3000, 10', 10' 6", 120", 10ft)
  PlanEditor.prototype.parseDimInput = function (str) {
    if (!str) return 0;
    str = String(str).trim();
    // Feet & Inches e.g. 10' 6", 10ft 6in, 10'6", 10'
    var ftInRegex = /^(\d+(?:\.\d+)?)\s*(?:'|ft)\s*(?:(\d+(?:\.\d+)?)\s*(?:"|in)?)?$/i;
    var match = str.match(ftInRegex);
    if (match) {
      var feet = parseFloat(match[1]) || 0;
      var inches = parseFloat(match[2]) || 0;
      return Math.round((feet * 12 + inches) * 25.4);
    }
    // Pure inches e.g. 120", 120in
    var inRegex = /^(\d+(?:\.\d+)?)\s*(?:"|in)$/i;
    var inMatch = str.match(inRegex);
    if (inMatch) {
      return Math.round(parseFloat(inMatch[1]) * 25.4);
    }
    // Clean numeric or with mm
    var clean = str.replace(/mm/i, '').trim();
    var val = parseFloat(clean);
    if (isNaN(val) || val <= 0) return 0;
    // If in imperial mode and entered a small number without units (< 50), interpret as feet
    if (this.unitSystem === 'imperial' && !str.toLowerCase().includes('mm') && val < 50) {
      return Math.round(val * 304.8);
    }
    return Math.round(val);
  };

  PlanEditor.prototype.initDOM = function () {
    var existingTray = this.container ? this.container.querySelector('#furnishBottomTray') : null;
    if (existingTray && this.container.parentElement) {
      this.container.parentElement.appendChild(existingTray);
    }
    this.container.innerHTML = '';
    this.container.style.position = 'relative';
    this.container.style.overflow = 'hidden';
    this.container.style.userSelect = 'none';

    // Canvas
    this.canvas = document.createElement('canvas');
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.cursor = 'crosshair';
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    // On-screen Length Input Overlay (for typing exact mm)
    this.numInputEl = document.createElement('div');
    this.numInputEl.className = 'orbix-num-input';
    this.numInputEl.style.position = 'absolute';
    this.numInputEl.style.display = 'none';
    this.numInputEl.style.padding = '4px 8px';
    this.numInputEl.style.background = '#1B4F72';
    this.numInputEl.style.color = '#FFFFFF';
    this.numInputEl.style.borderRadius = '4px';
    this.numInputEl.style.fontFamily = 'monospace';
    this.numInputEl.style.fontSize = '12px';
    this.numInputEl.style.pointerEvents = 'none';
    this.numInputEl.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
    this.container.appendChild(this.numInputEl);
  };

  // World to Screen and Screen to World
  PlanEditor.prototype.worldToScreen = function (pt) {
    return {
      x: pt.x * this.zoom + this.pan.x,
      y: pt.y * this.zoom + this.pan.y
    };
  };

  PlanEditor.prototype.screenToWorld = function (pt) {
    return {
      x: (pt.x - this.pan.x) / this.zoom,
      y: (pt.y - this.pan.y) / this.zoom
    };
  };

  // Helper: Cast ray from origin along dir vector to find first intersecting opposite wall
  PlanEditor.prototype.findOppositeWallIntersection = function (origin, dir, ignoreWallId) {
    var walls = (this.project && this.project.plan && this.project.plan.walls) || [];
    var best = null;
    for (var i = 0; i < walls.length; i++) {
      var w = walls[i];
      if (w.id === ignoreWallId) continue;
      var p1 = w.start, p2 = w.end;
      // Skip walls touching origin
      if (Vec2.dist(origin, p1) < 50 || Vec2.dist(origin, p2) < 50) continue;
      var pr0 = Vec2.projectOnSegment(origin, p1, p2);
      if (pr0.dist < 40 && pr0.t >= 0 && pr0.t <= 1) continue;

      var dxw = p2.x - p1.x, dyw = p2.y - p1.y;
      var denom = dir.x * dyw - dir.y * dxw;
      if (Math.abs(denom) < 1e-6) continue;
      var t = ((p1.x - origin.x) * dyw - (p1.y - origin.y) * dxw) / denom;
      var u = ((p1.x - origin.x) * dir.y - (p1.y - origin.y) * dir.x) / denom;
      if (t > 80 && u >= -0.01 && u <= 1.01) {
        var clampedU = Math.max(0, Math.min(1, u));
        var hitPt = { x: p1.x + clampedU * dxw, y: p1.y + clampedU * dyw };
        if (!best || t < best.t) {
          best = { t: t, u: clampedU, pt: hitPt, wall: w };
        }
      }
    }
    return best;
  };

  // Snapping logic: Room Close Loop -> Joint Snap -> On-Wall Snap -> Ortho/Angle Guides -> Grid Snap
  PlanEditor.prototype.snapPoint = function (worldPt, ignoreWallId) {
    var snapDistMm = 200; // snapping radius in mm
    var snapped = Vec2.clone(worldPt);
    var walls = (this.project && this.project.plan && this.project.plan.walls) || [];

    // 0a. Room Divider Special Auto-Snapping & Wall-to-Wall Locking
    if (this.activeTool === 'divider') {
      if (this.wallChainStart) {
        var S = this.wallChainStart;
        var cdx = worldPt.x - S.x, cdy = worldPt.y - S.y;
        var curDist = Math.hypot(cdx, cdy);
        var curAngle = Math.atan2(cdy, cdx);

        // Check nearest orthogonal direction (0, 90, 180, 270)
        var orthoStep = Math.PI / 2;
        var nearestOrthoAng = Math.round(curAngle / orthoStep) * orthoStep;
        var diffOrtho = Math.abs(Math.atan2(Math.sin(curAngle - nearestOrthoAng), Math.cos(curAngle - nearestOrthoAng)));

        // Find starting wall if S is on one
        var startWall = null;
        for (var swi = 0; swi < walls.length; swi++) {
          var prSw = Vec2.projectOnSegment(S, walls[swi].start, walls[swi].end);
          if (prSw.dist < 60 && prSw.t >= -0.05 && prSw.t <= 1.05) {
            startWall = walls[swi];
            break;
          }
        }

        var candidateAngles = [nearestOrthoAng];
        if (startWall) {
          var wNorm = Core.wallNormal(startWall);
          var perpAng1 = Math.atan2(wNorm.y, wNorm.x);
          var perpAng2 = Math.atan2(-wNorm.y, -wNorm.x);
          candidateAngles.push(perpAng1, perpAng2);
        }
        if (diffOrtho > 0.18) {
          candidateAngles.push(curAngle);
        }

        var bestHit = null;
        var minAngDiff = Infinity;
        for (var ca = 0; ca < candidateAngles.length; ca++) {
          var a = candidateAngles[ca];
          var dirV = { x: Math.cos(a), y: Math.sin(a) };
          var hit = this.findOppositeWallIntersection(S, dirV, startWall ? startWall.id : null);
          if (hit) {
            var aDiff = Math.abs(Math.atan2(Math.sin(curAngle - a), Math.cos(curAngle - a)));
            var distToHit = Math.hypot(worldPt.x - hit.pt.x, worldPt.y - hit.pt.y);
            if (distToHit < 480 || (aDiff < 0.38 && curDist > 120)) {
              if (aDiff < minAngDiff) {
                minAngDiff = aDiff;
                bestHit = { hit: hit, angle: a };
              }
            }
          }
        }

        if (bestHit) {
          var h = bestHit.hit;
          var degSnap = Math.round(((bestHit.angle * 180 / Math.PI) % 360 + 360) % 360);
          return {
            pt: Vec2.clone(h.pt),
            type: 'divider_wall_snap',
            target: h.wall,
            label: '✂ Snap Wall to Wall (' + Math.round(h.t) + ' mm)',
            angleDeg: degSnap,
            distMm: Math.round(h.t),
            isOppositeWall: true
          };
        }
      } else {
        // Step 1: Picking start point of divider -> snap onto nearest wall face within 280mm
        for (var w0 = 0; w0 < walls.length; w0++) {
          var wCandidate = walls[w0];
          var pr0 = Vec2.projectOnSegment(worldPt, wCandidate.start, wCandidate.end);
          if (pr0 && pr0.dist < 280 && pr0.t >= 0 && pr0.t <= 1) {
            return {
              pt: Vec2.clone(pr0.pt),
              type: 'divider_start_snap',
              target: wCandidate,
              label: '✂ Start on Wall'
            };
          }
        }
      }
    }

    // 0. Close room loop priority: snapping back to the starting point of the current wall chain
    if (this.wallChainStart && this.wallChainFirstPoint) {
      if (Vec2.dist(worldPt, this.wallChainFirstPoint) < snapDistMm && Vec2.dist(this.wallChainStart, this.wallChainFirstPoint) > 120) {
        return {
          pt: Vec2.clone(this.wallChainFirstPoint),
          type: 'joint',
          isChainClose: true,
          target: this.wallChainFirstPoint,
          label: 'Close Room Loop'
        };
      }
    }

    // 1. Vertex magnetic snap to existing wall endpoints / joints
    for (var i = 0; i < walls.length; i++) {
      var w = walls[i];
      if (w.id === ignoreWallId) continue;
      if (Vec2.dist(worldPt, w.start) < snapDistMm) {
        return { pt: Vec2.clone(w.start), type: 'joint', target: w.start, label: 'Wall Corner' };
      }
      if (Vec2.dist(worldPt, w.end) < snapDistMm) {
        return { pt: Vec2.clone(w.end), type: 'joint', target: w.end, label: 'Wall Corner' };
      }
    }

    // 1b. Magnetic snap to points along existing wall faces (T-Junctions / On-Wall Snap)
    for (var wi = 0; wi < walls.length; wi++) {
      var wObj = walls[wi];
      if (wObj.id === ignoreWallId) continue;
      var projW = Core.projectPointToSegment ? Core.projectPointToSegment(worldPt, wObj.start, wObj.end) :
                  (Core.Vec2 && Core.Vec2.projectOnSegment ? Core.Vec2.projectOnSegment(worldPt, wObj.start, wObj.end) :
                  (Vec2 && Vec2.projectOnSegment ? Vec2.projectOnSegment(worldPt, wObj.start, wObj.end) : null));
      if (projW && projW.t > 0.04 && projW.t < 0.96) {
        var pDist = Math.hypot(worldPt.x - projW.pt.x, worldPt.y - projW.pt.y);
        if (pDist < snapDistMm * 0.75) {
          return { pt: Vec2.clone(projW.pt), type: 'wall_segment', target: wObj, label: 'On Wall' };
        }
      }
    }

    // 1c. Magnetic snap to furniture corner joint points
    var furnList = (this.project && this.project.plan && this.project.plan.furniture) || [];
    for (var fi = 0; fi < furnList.length; fi++) {
      var fJoints = this.getFurnitureJointPoints(furnList[fi]);
      for (var fji = 0; fji < fJoints.length; fji++) {
        if (Vec2.dist(worldPt, fJoints[fji]) < snapDistMm) {
          return { pt: { x: fJoints[fji].x, y: fJoints[fji].y }, type: 'joint', target: fJoints[fji], label: 'Unit Joint' };
        }
      }
    }

    // 2. When drawing a wall (wallChainStart active), check angle guides:
    if (this.wallChainStart) {
      var dx = worldPt.x - this.wallChainStart.x;
      var dy = worldPt.y - this.wallChainStart.y;
      var rawDist = Math.sqrt(dx * dx + dy * dy);
      var currentAngle = Math.atan2(dy, dx);
      var parsedTypedDist = this.parseDimInput(this.numericInputBuffer);
      var targetDist = (this.numericInputBuffer && parsedTypedDist > 0) ? parsedTypedDist : rawDist;

      // Collect all candidate reference vertices for dual-axis tracking (Object Snap Tracking)
      var refVertices = [];
      if (this.wallChainFirstPoint && Vec2.dist(this.wallChainFirstPoint, this.wallChainStart) > 60) {
        refVertices.push(this.wallChainFirstPoint);
      }
      for (var vi = 0; vi < walls.length; vi++) {
        var vw = walls[vi];
        if (vw.id === ignoreWallId) continue;
        if (Vec2.dist(vw.start, this.wallChainStart) > 60) refVertices.push(vw.start);
        if (Vec2.dist(vw.end, this.wallChainStart) > 60) refVertices.push(vw.end);
      }

      // 2a. Perpendicular & Parallel guides relative to existing walls
      for (var j = 0; j < walls.length; j++) {
        var ew = walls[j];
        if (ew.id === ignoreWallId) continue;
        var ewAngle = Math.atan2(ew.end.y - ew.start.y, ew.end.x - ew.start.x);

        // Parallel angles: ewAngle, ewAngle + PI, ewAngle - PI
        var parAngles = [ewAngle, ewAngle + Math.PI, ewAngle - Math.PI];
        for (var p = 0; p < parAngles.length; p++) {
          var diffP = Math.atan2(Math.sin(currentAngle - parAngles[p]), Math.cos(currentAngle - parAngles[p]));
          if (Math.abs(diffP) < 0.14) { // within ~8 degrees
            var snapAngle = parAngles[p];
            var dirU = { x: Math.cos(snapAngle), y: Math.sin(snapAngle) };

            // Check if projecting along dirU aligns with any reference vertex (Dual-Axis Alignment)
            var bestAlignV = null;
            var bestAlignDist = Infinity;
            var snapTol = snapDistMm || 200;

            for (var rvi = 0; rvi < refVertices.length; rvi++) {
              var rv = refVertices[rvi];
              var projLen = (rv.x - this.wallChainStart.x) * dirU.x + (rv.y - this.wallChainStart.y) * dirU.y;
              if (projLen > 60) {
                var dLen = Math.abs(targetDist - projLen);
                if (dLen < snapTol && dLen < bestAlignDist) {
                  bestAlignDist = dLen;
                  bestAlignV = { pt: rv, len: Math.round(projLen) };
                }
              }
            }

            // Also check matching the length of ew itself
            var ewLen = Core.wallLength(ew);
            if (ewLen > 60 && Math.abs(targetDist - ewLen) < snapTol && Math.abs(targetDist - ewLen) < bestAlignDist) {
              var oppPt = (Vec2.dist(ew.start, this.wallChainStart) < Vec2.dist(ew.end, this.wallChainStart)) ? ew.end : ew.start;
              bestAlignV = { pt: oppPt, len: Math.round(ewLen) };
            }

            var distCleanP = (this.numericInputBuffer && parsedTypedDist > 0) ? parsedTypedDist :
              (bestAlignV ? bestAlignV.len : (this.project.plan.snapToGrid ? Math.round(targetDist / 50) * 50 : targetDist));

            snapped.x = Math.round(this.wallChainStart.x + dirU.x * distCleanP);
            snapped.y = Math.round(this.wallChainStart.y + dirU.y * distCleanP);

            var retParallel = {
              pt: snapped,
              type: 'parallel',
              target: ew,
              label: bestAlignV ? '✛ Dual-Axis Aligned (X & Y)' : '∥ Parallel',
              angleDeg: Math.round(((snapAngle * 180 / Math.PI) % 360 + 360) % 360),
              distMm: distCleanP
            };
            if (bestAlignV) {
              retParallel.alignedVertex = bestAlignV.pt;
              retParallel.isDualAxis = true;
            }
            return retParallel;
          }
        }

        // Perpendicular angles: ewAngle + PI/2, ewAngle - PI/2
        var perpAngles = [ewAngle + Math.PI / 2, ewAngle - Math.PI / 2];
        for (var q = 0; q < perpAngles.length; q++) {
          var diffQ = Math.atan2(Math.sin(currentAngle - perpAngles[q]), Math.cos(currentAngle - perpAngles[q]));
          if (Math.abs(diffQ) < 0.14) {
            var snapAnglePerp = perpAngles[q];
            var dirUPerp = { x: Math.cos(snapAnglePerp), y: Math.sin(snapAnglePerp) };

            var bestAlignVPerp = null;
            var bestAlignDistPerp = Infinity;
            var snapTolP = snapDistMm || 200;

            for (var rvp = 0; rvp < refVertices.length; rvp++) {
              var rvpPt = refVertices[rvp];
              var projLenP = (rvpPt.x - this.wallChainStart.x) * dirUPerp.x + (rvpPt.y - this.wallChainStart.y) * dirUPerp.y;
              if (projLenP > 60) {
                var dLenP = Math.abs(targetDist - projLenP);
                if (dLenP < snapTolP && dLenP < bestAlignDistPerp) {
                  bestAlignDistPerp = dLenP;
                  bestAlignVPerp = { pt: rvpPt, len: Math.round(projLenP) };
                }
              }
            }

            var distCleanPerp = (this.numericInputBuffer && parsedTypedDist > 0) ? parsedTypedDist :
              (bestAlignVPerp ? bestAlignVPerp.len : (this.project.plan.snapToGrid ? Math.round(targetDist / 50) * 50 : targetDist));

            snapped.x = Math.round(this.wallChainStart.x + dirUPerp.x * distCleanPerp);
            snapped.y = Math.round(this.wallChainStart.y + dirUPerp.y * distCleanPerp);

            var retPerp = {
              pt: snapped,
              type: 'perpendicular',
              target: ew,
              label: bestAlignVPerp ? '✛ Dual-Axis Aligned (X & Y)' : '⊥ 90° Perpendicular',
              angleDeg: Math.round(((snapAnglePerp * 180 / Math.PI) % 360 + 360) % 360),
              distMm: distCleanPerp
            };
            if (bestAlignVPerp) {
              retPerp.alignedVertex = bestAlignVPerp.pt;
              retPerp.isDualAxis = true;
            }
            return retPerp;
          }
        }
      }

      // 2b. Strong Orthogonal Snapping (0°, 90°, 180°, 270°) with 16° magnetic pull or Shift-lock
      var isShift = !!this.isShiftDown;
      var orthoStep = Math.PI / 2; // Strict 90 degree increments
      var nearestOrtho = Math.round(currentAngle / orthoStep) * orthoStep;
      var diffOrtho = Math.abs(currentAngle - nearestOrtho);
      if (isShift || diffOrtho < 0.28) { // within ~16 degrees or shift held
        var deg = Math.round(((nearestOrtho * 180 / Math.PI) % 360 + 360) % 360);
        var isHoriz = (deg === 0 || deg === 180 || deg === 360);
        var isVert = (deg === 90 || deg === 270);
        var snapTolOrtho = snapDistMm || 220;

        var orthoAlignV = null;
        var minDiffCoord = Infinity;

        if (isHoriz) {
          // Drawing horizontally: Y locked to wallChainStart.y. Magnetically snap X to aligned vertex!
          for (var rvh = 0; rvh < refVertices.length; rvh++) {
            var vh = refVertices[rvh];
            var diffX = Math.abs(worldPt.x - vh.x);
            var isCorrectDir = (deg === 0 && vh.x > this.wallChainStart.x) || (deg === 180 && vh.x < this.wallChainStart.x);
            if (isCorrectDir && diffX < snapTolOrtho && diffX < minDiffCoord) {
              minDiffCoord = diffX;
              orthoAlignV = vh;
            }
          }
        } else if (isVert) {
          // Drawing vertically: X locked to wallChainStart.x. Magnetically snap Y to aligned vertex!
          for (var rvv = 0; rvv < refVertices.length; rvv++) {
            var vv = refVertices[rvv];
            var diffY = Math.abs(worldPt.y - vv.y);
            var isCorrectDirV = (deg === 90 && vv.y > this.wallChainStart.y) || (deg === 270 && vv.y < this.wallChainStart.y);
            if (isCorrectDirV && diffY < snapTolOrtho && diffY < minDiffCoord) {
              minDiffCoord = diffY;
              orthoAlignV = vv;
            }
          }
        }

        var distClean;
        if (this.numericInputBuffer && parsedTypedDist > 0) {
          distClean = parsedTypedDist;
          snapped.x = Math.round(this.wallChainStart.x + Math.cos(nearestOrtho) * distClean);
          snapped.y = Math.round(this.wallChainStart.y + Math.sin(nearestOrtho) * distClean);
        } else if (orthoAlignV) {
          if (isHoriz) {
            snapped.x = orthoAlignV.x;
            snapped.y = this.wallChainStart.y;
            distClean = Math.round(Math.abs(orthoAlignV.x - this.wallChainStart.x));
          } else {
            snapped.x = this.wallChainStart.x;
            snapped.y = orthoAlignV.y;
            distClean = Math.round(Math.abs(orthoAlignV.y - this.wallChainStart.y));
          }
        } else {
          distClean = (this.project.plan.snapToGrid ? Math.round(targetDist / 50) * 50 : targetDist);
          snapped.x = Math.round(this.wallChainStart.x + Math.cos(nearestOrtho) * distClean);
          snapped.y = Math.round(this.wallChainStart.y + Math.sin(nearestOrtho) * distClean);
        }

        var orthoLabel = isHoriz ? '↔ Horizontal' : '↕ Vertical';
        var retOrtho = {
          pt: snapped,
          type: 'ortho',
          label: orthoAlignV ? '✛ Dual-Axis Aligned (X & Y)' : orthoLabel,
          angleDeg: deg,
          distMm: distClean
        };
        if (orthoAlignV) {
          retOrtho.alignedVertex = orthoAlignV;
          retOrtho.isDualAxis = true;
          retOrtho.alignedAxis = isHoriz ? 'x' : 'y';
        }
        return retOrtho;
      }

      // 2c. 45° Diagonal increments
      var snapStep = Math.PI / 4; // 45 degrees
      var nearestAngle = Math.round(currentAngle / snapStep) * snapStep;
      if (Math.abs(currentAngle - nearestAngle) < 0.14) { // within ~8 degrees
        var degD = Math.round(((nearestAngle * 180 / Math.PI) % 360 + 360) % 360);
        var distCleanD = (this.numericInputBuffer && parsedTypedDist > 0) ? parsedTypedDist :
          (this.project.plan.snapToGrid ? Math.round(targetDist / 50) * 50 : targetDist);
        snapped.x = Math.round(this.wallChainStart.x + Math.cos(nearestAngle) * distCleanD);
        snapped.y = Math.round(this.wallChainStart.y + Math.sin(nearestAngle) * distCleanD);
        return {
          pt: snapped,
          type: 'angle',
          label: '∡ ' + degD + '° Angle',
          angleDeg: degD,
          distMm: distCleanD
        };
      }

      // If numericInputBuffer is active on free angle:
      if (this.numericInputBuffer && parsedTypedDist > 0) {
        snapped.x = this.wallChainStart.x + Math.cos(currentAngle) * targetDist;
        snapped.y = this.wallChainStart.y + Math.sin(currentAngle) * targetDist;
        return { pt: snapped, type: 'typed', label: this.formatDim(targetDist) };
      }
    }

    // 3. Grid snap (100 mm grid)
    if (this.project.plan.snapToGrid) {
      var grid = this.project.plan.gridSize || 100;
      snapped.x = Math.round(snapped.x / grid) * grid;
      snapped.y = Math.round(snapped.y / grid) * grid;
    }

    return { pt: snapped, type: 'grid', label: 'Grid' };
  };

  // Find wall and projection nearest to world point
  PlanEditor.prototype.findNearestWall = function (worldPt, maxDistMm) {
    maxDistMm = maxDistMm || 300;
    var walls = this.project.plan.walls;
    var best = null;
    for (var i = 0; i < walls.length; i++) {
      var w = walls[i];
      var proj = Vec2.projectOnSegment(worldPt, w.start, w.end);
      if (proj.dist < maxDistMm) {
        if (!best || proj.dist < best.dist) {
          best = { wall: w, proj: proj, dist: proj.dist };
        }
      }
    }
    return best;
  };

  PlanEditor.prototype.pushHistory = function (actionName) {
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    this.history.push({
      action: actionName || 'Edit',
      data: Core.serializeProject(this.project)
    });
    this.historyIndex++;
    if (this.history.length > 30) {
      this.history.shift();
      this.historyIndex--;
    }
    // Update rooms and notify listener
    Core.detectRooms(this.project);
    this.onProjectChange(this.project);
  };

  PlanEditor.prototype.undo = function () {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.project = Core.deserializeProject(this.history[this.historyIndex].data);
      Core.detectRooms(this.project);
      this.selected = [];
      this.onProjectChange(this.project);
      this.render();
    }
  };

  PlanEditor.prototype.redo = function () {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.project = Core.deserializeProject(this.history[this.historyIndex].data);
      Core.detectRooms(this.project);
      this.selected = [];
      this.onProjectChange(this.project);
      this.render();
    }
  };

  PlanEditor.prototype.deleteSelected = function () {
    if (!this.selected.length) return;
    var walls = this.project.plan.walls;
    var openings = this.project.plan.openings;
    var furniture = this.project.plan.furniture;

    var deletedSomething = false;
    for (var s = 0; s < this.selected.length; s++) {
      var item = this.selected[s];
      if (item.type === 'wall') {
        this.project.plan.walls = this.project.plan.walls.filter(function (w) { return w.id !== item.id; });
        // Also remove openings on this wall
        this.project.plan.openings = this.project.plan.openings.filter(function (op) { return op.wallId !== item.id; });
        deletedSomething = true;
      } else if (item.type === 'opening') {
        this.project.plan.openings = this.project.plan.openings.filter(function (op) { return op.id !== item.id; });
        deletedSomething = true;
      } else if (item.type === 'furniture') {
        this.project.plan.furniture = this.project.plan.furniture.filter(function (f) { return f.id !== item.id; });
        deletedSomething = true;
      } else if (item.type === 'dimension') {
        this.project.plan.dimensions = (this.project.plan.dimensions || []).filter(function (d) { return d.id !== item.id; });
        deletedSomething = true;
      } else if (item.type === 'room') {
        var targetRoomId = item.id;
        var rObj = null;
        var curRooms = this.project.plan.rooms || [];
        for (var cr = 0; cr < curRooms.length; cr++) {
          if (curRooms[cr].id === targetRoomId) { rObj = curRooms[cr]; break; }
        }
        if (rObj) {
          // Identify and delete associated divider walls (e.g. Pooja room boundaries or room split divider)
          var delDividerIds = [];
          var pWalls = this.project.plan.walls || [];
          for (var pwi = 0; pwi < pWalls.length; pwi++) {
            var pwItem = pWalls[pwi];
            if (!pwItem || !pwItem.isDivider) continue;
            var isRoomWall = (rObj.wallIds && rObj.wallIds.indexOf(pwItem.id) !== -1);
            if (isRoomWall) {
              delDividerIds.push(pwItem.id);
            } else if (rObj.polygon) {
              var isNear = Core.Vec2.pointInPolygon(pwItem.start, rObj.polygon) && Core.Vec2.pointInPolygon(pwItem.end, rObj.polygon);
              if (isNear) delDividerIds.push(pwItem.id);
            }
          }
          if (delDividerIds.length > 0) {
            this.project.plan.walls = this.project.plan.walls.filter(function (w) {
              return delDividerIds.indexOf(w.id) === -1;
            });
            this.project.plan.openings = (this.project.plan.openings || []).filter(function (op) {
              return delDividerIds.indexOf(op.wallId) === -1;
            });
          }
          this.project.plan.rooms = this.project.plan.rooms.filter(function (r) { return r.id !== targetRoomId; });
          deletedSomething = true;
          if (typeof window !== 'undefined' && window.OrbixUI && window.OrbixUI.showToast) {
            window.OrbixUI.showToast((rObj.name || 'Room') + ' and divider walls deleted', 'info');
          }
        }
      }
    }

    if (deletedSomething) {
      if (typeof Core !== 'undefined' && typeof Core.detectRooms === 'function') {
        Core.detectRooms(this.project);
      }
      this.selected = [];
      this.onSelectionChange(this.selected);
      this.pushHistory('Delete');
      this.render();
      if (typeof window !== 'undefined' && window.OrbixUI && window.OrbixUI.render3DHome) {
        window.OrbixUI.render3DHome();
      }
    }
  };

  // Event bindings
  PlanEditor.prototype.bindEvents = function () {
    var self = this;

    window.addEventListener('resize', function () {
      self.resize();
      self.render();
    });

    this.canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      var rect = self.canvas.getBoundingClientRect();
      var mouseScreen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      var mouseWorldBefore = self.screenToWorld(mouseScreen);

      var zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      self.zoom = Math.max(0.01, Math.min(10.0, self.zoom * zoomFactor));

      var mouseScreenAfter = self.worldToScreen(mouseWorldBefore);
      self.pan.x += (mouseScreen.x - mouseScreenAfter.x);
      self.pan.y += (mouseScreen.y - mouseScreenAfter.y);
      self.render();
    }, { passive: false });

    this.canvas.addEventListener('dblclick', function () {
      if (self.wallChainStart) {
        self.wallChainStart = null;
        self.wallChainFirstPoint = null;
        self.numericInputBuffer = '';
        if (Core.detectRooms) Core.detectRooms(self.project);
        self.pushHistory('Finish Wall Chain');
        self.render();
      }
    });

    this.canvas.addEventListener('contextmenu', function (e) {
      if (self.wallChainStart || self.activeTool === 'divider') {
        e.preventDefault();
        var wasDiv = (self.activeTool === 'divider');
        self.wallChainStart = null;
        self.wallChainFirstPoint = null;
        self.numericInputBuffer = '';
        if (wasDiv) self.setTool('select');
        if (Core.detectRooms) Core.detectRooms(self.project);
        self.render();
      }
    });

    this.canvas.addEventListener('mousedown', function (e) {
      var rect = self.canvas.getBoundingClientRect();
      var mouseScreen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      self.lastMouseScreen = mouseScreen;
      var worldPt = self.screenToWorld(mouseScreen);

      // Middle mouse button or Spacebar held -> Pan
      if (e.button === 1 || e.spaceKey) {
        self.dragState = { type: 'pan', startScreen: mouseScreen, startPan: { x: self.pan.x, y: self.pan.y } };
        return;
      }

      if (e.button === 2) { // Right click cancels / finishes wall chain or divider
        if (self.wallChainStart || self.activeTool === 'divider') {
          var wasDiv2 = (self.activeTool === 'divider');
          self.wallChainStart = null;
          self.wallChainFirstPoint = null;
          self.numericInputBuffer = '';
          if (wasDiv2) self.setTool('select');
          if (Core.detectRooms) Core.detectRooms(self.project);
          self.pushHistory(wasDiv2 ? 'Cancel Room Divider' : 'Finish Wall Chain');
          self.render();
        }
        return;
      }

      if (e.button !== 0) return; // Only left-click from here

      // Alt-drag moves floor plan underlay image
      if (e.altKey && self.underlay && self.underlay.img) {
        self.dragState = {
          type: 'move_underlay',
          startScreen: mouseScreen,
          origUnderlayPos: { x: self.underlay.x || 0, y: self.underlay.y || 0 }
        };
        return;
      }

      // Check if clicked directly on any placed furniture unit
      var furnList = (self.project && self.project.plan && self.project.plan.furniture) || [];
      var matchingHits = [];
      for (var fi = furnList.length - 1; fi >= 0; fi--) {
        var fn = furnList[fi];
        var fPoly = Core.getFurniturePolygon(fn);
        if (Core.Vec2.pointInPolygon(worldPt, fPoly) || Vec2.dist(worldPt, fn.pos) < Math.max(100, (fn.dimensions ? fn.dimensions.W : 600) / 2)) {
          matchingHits.push(fn);
        }
      }

      // When in select tool, clicking a placed furniture unit selects and allows moving it
      if (matchingHits.length > 0 && self.activeTool === 'select') {
        // Priority to higher elevation units (wall units AFFL 1500/2100 over base units AFFL 0)
        var getUnitElevation = function (f) {
          if (f.elevation !== undefined && f.elevation !== null) return parseFloat(f.elevation) || 0;
          if (f.pos && f.pos.z !== undefined && f.pos.z !== null) return parseFloat(f.pos.z) || 0;
          var cat = (f.category || '').toLowerCase();
          var name = (f.name || '').toLowerCase();
          if (cat.indexOf('loft') !== -1 || name.indexOf('loft') !== -1) return 2100;
          if (cat.indexOf('wall') !== -1 || name.indexOf('wall') !== -1 || /(^|\b|_|-)(wm|wcm)($|\b|_|-|\d+)/i.test(name)) return 1500;
          return 0;
        };
        matchingHits.sort(function (a, b) {
          return getUnitElevation(b) - getUnitElevation(a);
        });

        var curSelId = (self.selected && self.selected.length === 1 && self.selected[0].type === 'furniture') ? self.selected[0].id : null;
        var isAlreadySelected = curSelId && matchingHits.some(function (h) { return h.id === curSelId; });

        var hitFurn;
        if (isAlreadySelected) {
          // If a unit is already selected, KEEP that selected unit so moving it never switches to unit underneath!
          hitFurn = matchingHits.find(function (h) { return h.id === curSelId; });
        } else {
          // If clicking an unselected unit, select the topmost unit (wall unit over base unit)
          hitFurn = matchingHits[0];
        }

        if (typeof self.setTool === 'function') self.setTool('select');
        else self.activeTool = 'select';
        self.selected = [{ type: 'furniture', id: hitFurn.id }];

        // Click-before-move: Only initiate drag if the unit was ALREADY clicked and selected before!
        if (isAlreadySelected) {
          self.dragState = {
            type: 'move_furniture',
            furniture: hitFurn,
            startWorld: Vec2.clone(worldPt),
            origPos: Vec2.clone(hitFurn.pos),
            origRotY: hitFurn.rotY || 0,
            hasMoved: false,
            matchingHits: matchingHits
          };
        } else {
          self.dragState = null;
        }

        self.onSelectionChange(self.selected);
        self.render();
        return;
      }

      if (self.activeTool === 'select') {
        self.handleSelectMouseDown(worldPt, e.shiftKey);
      } else if (self.activeTool === 'divider') {
        // Room divider: supports click-and-drag box to create a dedicated room/zone (e.g. Pooja room)!
        if (self.wallChainStart) {
          self.handleWallMouseDown(worldPt);
        } else {
          self.dragState = {
            type: 'draw_divider_box',
            startWorld: Vec2.clone(worldPt),
            currentWorld: Vec2.clone(worldPt),
            hasMoved: false
          };
          self.render();
        }
      } else if (self.activeTool === 'wall') {
        self.handleWallMouseDown(worldPt);
      } else if (self.activeTool === 'door' || self.activeTool === 'window') {
        self.handleOpeningMouseDown(worldPt, self.activeTool);
      } else if (self.activeTool === 'furniture') {
        self.handleFurnitureMouseDown(worldPt);
      } else if (self.activeTool === 'split') {
        self.handleSplitMouseDown(worldPt);
      } else if (self.activeTool === 'calibrate') {
        self.handleCalibrateMouseDown(worldPt);
      } else if (self.activeTool === 'dimension') {
        self.handleDimensionMouseDown(worldPt);
      }
    });

    window.addEventListener('mousemove', function (e) {
      var rect = self.canvas.getBoundingClientRect();
      var mouseScreen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      self.lastMouseScreen = mouseScreen;
      self.cursorWorld = self.screenToWorld(mouseScreen);
      self.isShiftDown = !!e.shiftKey;

      if (self.dragState && self.dragState.type === 'move_underlay') {
        var dxS = mouseScreen.x - self.dragState.startScreen.x;
        var dyS = mouseScreen.y - self.dragState.startScreen.y;
        self.underlay.x = self.dragState.origUnderlayPos.x + dxS / self.zoom;
        self.underlay.y = self.dragState.origUnderlayPos.y + dyS / self.zoom;
        self.render();
        return;
      }

      if (self.dragState && self.dragState.type === 'pan') {
        self.pan.x = self.dragState.startPan.x + (mouseScreen.x - self.dragState.startScreen.x);
        self.pan.y = self.dragState.startPan.y + (mouseScreen.y - self.dragState.startScreen.y);
        self.render();
        return;
      }

      if (self.dragState && self.dragState.type === 'draw_divider_box') {
        self.dragState.currentWorld = Vec2.clone(self.cursorWorld);
        if (!self.dragState.hasMoved && Vec2.dist(self.cursorWorld, self.dragState.startWorld) > 10) {
          self.dragState.hasMoved = true;
        }
        self.render();
        return;
      }

      if (self.dragState && self.dragState.type === 'move_wall') {
        var ds = self.dragState;
        var rawDx = self.cursorWorld.x - ds.startWorld.x;
        var rawDy = self.cursorWorld.y - ds.startWorld.y;

        if (!ds.hasMoved && Math.hypot(rawDx, rawDy) > 6) {
          ds.hasMoved = true;
        }

        // Strict straight parallel & perpendicular movement — ZERO angle shift!
        // A horizontal wall stays 100% horizontal (start.y === end.y) and translates laterally in Y (dispX = 0).
        // Connected vertical walls stretch along Y keeping their X strictly fixed.
        // A vertical wall stays 100% vertical (start.x === end.x) and translates laterally in X (dispY = 0).
        // Connected horizontal walls stretch along X keeping their Y strictly fixed.
        var isHoriz = Math.abs(ds.origEnd.y - ds.origStart.y) <= Math.abs(ds.origEnd.x - ds.origStart.x);
        var hasConnected = (ds.connectedStart.length > 0 || ds.connectedEnd.length > 0);

        var dispX = 0, dispY = 0;
        if (isHoriz) {
          // Horizontal wall: lateral displacement along Y (room resize)
          if (!hasConnected && Math.abs(rawDx) > Math.abs(rawDy)) {
            // Free-standing wall sliding along X
            dispX = Math.round(rawDx / 25) * 25;
            dispY = 0;
          } else {
            dispX = 0;
            dispY = Math.round(rawDy / 25) * 25;
          }

          var targetY = Math.round(ds.origStart.y + dispY);
          ds.wall.start.x = Math.round(ds.origStart.x + dispX);
          ds.wall.start.y = targetY;
          ds.wall.end.x = Math.round(ds.origEnd.x + dispX);
          ds.wall.end.y = targetY; // Enforce identical Y to guarantee ZERO angle shift!

          // Connected walls at start:
          for (var cs = 0; cs < ds.connectedStart.length; cs++) {
            var connS = ds.connectedStart[cs];
            var isConnVert = Math.abs(connS.wall.end.x - connS.wall.start.x) <= Math.abs(connS.wall.end.y - connS.wall.start.y);
            if (isConnVert) {
              connS.wall[connS.endpoint].x = connS.orig.x; // Keep X constant so wall stays vertical!
              connS.wall[connS.endpoint].y = targetY;
            } else {
              connS.wall[connS.endpoint].x = Math.round(connS.orig.x + dispX);
              connS.wall[connS.endpoint].y = targetY;
            }
          }
          // Connected walls at end:
          for (var ce = 0; ce < ds.connectedEnd.length; ce++) {
            var connE = ds.connectedEnd[ce];
            var isConnVertE = Math.abs(connE.wall.end.x - connE.wall.start.x) <= Math.abs(connE.wall.end.y - connE.wall.start.y);
            if (isConnVertE) {
              connE.wall[connE.endpoint].x = connE.orig.x; // Keep X constant so wall stays vertical!
              connE.wall[connE.endpoint].y = targetY;
            } else {
              connE.wall[connE.endpoint].x = Math.round(connE.orig.x + dispX);
              connE.wall[connE.endpoint].y = targetY;
            }
          }
        } else {
          // Vertical wall: lateral displacement along X (room resize)
          if (!hasConnected && Math.abs(rawDy) > Math.abs(rawDx)) {
            // Free-standing wall sliding along Y
            dispX = 0;
            dispY = Math.round(rawDy / 25) * 25;
          } else {
            dispX = Math.round(rawDx / 25) * 25;
            dispY = 0;
          }

          var targetX = Math.round(ds.origStart.x + dispX);
          ds.wall.start.x = targetX;
          ds.wall.start.y = Math.round(ds.origStart.y + dispY);
          ds.wall.end.x = targetX; // Enforce identical X to guarantee ZERO angle shift!
          ds.wall.end.y = Math.round(ds.origEnd.y + dispY);

          // Connected walls at start:
          for (var cs2 = 0; cs2 < ds.connectedStart.length; cs2++) {
            var connS2 = ds.connectedStart[cs2];
            var isConnHoriz = Math.abs(connS2.wall.end.y - connS2.wall.start.y) <= Math.abs(connS2.wall.end.x - connS2.wall.start.x);
            if (isConnHoriz) {
              connS2.wall[connS2.endpoint].x = targetX;
              connS2.wall[connS2.endpoint].y = connS2.orig.y; // Keep Y constant so wall stays horizontal!
            } else {
              connS2.wall[connS2.endpoint].x = targetX;
              connS2.wall[connS2.endpoint].y = Math.round(connS2.orig.y + dispY);
            }
          }
          // Connected walls at end:
          for (var ce2 = 0; ce2 < ds.connectedEnd.length; ce2++) {
            var connE2 = ds.connectedEnd[ce2];
            var isConnHorizE = Math.abs(connE2.wall.end.y - connE2.wall.start.y) <= Math.abs(connE2.wall.end.x - connE2.wall.start.x);
            if (isConnHorizE) {
              connE2.wall[connE2.endpoint].x = targetX;
              connE2.wall[connE2.endpoint].y = connE2.orig.y; // Keep Y constant so wall stays horizontal!
            } else {
              connE2.wall[connE2.endpoint].x = targetX;
              connE2.wall[connE2.endpoint].y = Math.round(connE2.orig.y + dispY);
            }
          }
        }

        self.render();
        return;
      }

      if (self.dragState && self.dragState.type === 'move_room') {
        var rds = self.dragState;
        var rRawDx = self.cursorWorld.x - rds.startWorld.x;
        var rRawDy = self.cursorWorld.y - rds.startWorld.y;

        if (!rds.hasMoved && Math.hypot(rRawDx, rRawDy) > 6) {
          rds.hasMoved = true;
        }

        // Strictly parallel & perpendicular straight movement (lock to dominant axis snapped to 25mm)
        var rDispX = 0, rDispY = 0;
        if (Math.abs(rRawDx) >= Math.abs(rRawDy)) {
          rDispX = Math.round(rRawDx / 25) * 25;
          rDispY = 0;
        } else {
          rDispX = 0;
          rDispY = Math.round(rRawDy / 25) * 25;
        }

        // 1. Move room polygon
        if (rds.room && rds.room.polygon && rds.origPolygon) {
          for (var rpi = 0; rpi < rds.origPolygon.length; rpi++) {
            rds.room.polygon[rpi].x = Math.round(rds.origPolygon[rpi].x + rDispX);
            rds.room.polygon[rpi].y = Math.round(rds.origPolygon[rpi].y + rDispY);
          }
        }

        // 2. Move all associated boundary divider walls
        if (rds.dividerWalls) {
          for (var dwi = 0; dwi < rds.dividerWalls.length; dwi++) {
            var dwItem = rds.dividerWalls[dwi];
            dwItem.wall.start.x = Math.round(dwItem.origStart.x + rDispX);
            dwItem.wall.start.y = Math.round(dwItem.origStart.y + rDispY);
            dwItem.wall.end.x = Math.round(dwItem.origEnd.x + rDispX);
            dwItem.wall.end.y = Math.round(dwItem.origEnd.y + rDispY);
          }
        }

        // 3. Move all enclosed furniture inside the room
        if (rds.enclosedFurniture) {
          for (var efi = 0; efi < rds.enclosedFurniture.length; efi++) {
            var efItem = rds.enclosedFurniture[efi];
            efItem.furn.pos.x = Math.round(efItem.origPos.x + rDispX);
            efItem.furn.pos.y = Math.round(efItem.origPos.y + rDispY);
          }
        }

        self.render();
        return;
      }

      if (self.dragState && self.dragState.type === 'move_vertex') {
        var vds = self.dragState;
        var vRawDx = self.cursorWorld.x - vds.startWorld.x;
        var vRawDy = self.cursorWorld.y - vds.startWorld.y;

        if (!vds.hasMoved && Math.hypot(vRawDx, vRawDy) > 6) {
          vds.hasMoved = true;
        }

        var vSnap = self.snapPoint(self.cursorWorld);
        var vNewPt = vSnap.pt || self.cursorWorld;

        for (var vr = 0; vr < vds.connectedRefs.length; vr++) {
          var vRef = vds.connectedRefs[vr];
          vRef.wall[vRef.endpoint].x = Math.round(vNewPt.x / 25) * 25;
          vRef.wall[vRef.endpoint].y = Math.round(vNewPt.y / 25) * 25;
        }

        self.render();
        return;
      }

      if (self.dragState && self.dragState.type === 'move_furniture') {
        if (!self.dragState.hasMoved && Vec2.dist(self.cursorWorld, self.dragState.startWorld) > 8) {
          self.dragState.hasMoved = true;
        }
        var dx = self.cursorWorld.x - self.dragState.startWorld.x;
        var dy = self.cursorWorld.y - self.dragState.startWorld.y;
        var newX = Math.round((self.dragState.origPos.x + dx) / 25) * 25;
        var newY = Math.round((self.dragState.origPos.y + dy) / 25) * 25;
        var currentRot = self.dragState.origRotY !== undefined ? self.dragState.origRotY : (self.dragState.furniture.rotY || 0);

        // Smart snap to adjacent units (jointing) & walls (snatching + overlap prevention)
        var snapRes = self.snapFurniture(self.dragState.furniture, { x: newX, y: newY }, currentRot);
        self.dragState.furniture.pos.x = snapRes.pos.x;
        self.dragState.furniture.pos.y = snapRes.pos.y;
        if (snapRes.rotY !== undefined) {
          self.dragState.furniture.rotY = snapRes.rotY;
        }
        self.dragState.snapInfo = snapRes;

        var rooms = self.project.plan.rooms || [];
        for (var rm = 0; rm < rooms.length; rm++) {
          if (Core.Vec2.pointInPolygon(self.dragState.furniture.pos, rooms[rm].polygon)) {
            self.dragState.furniture.roomId = rooms[rm].id;
            break;
          }
        }
        // Comprehensive overlap check against adjacent furniture, wall cores, and openings
        var colCheck = Core.checkPlacementOverlap ?
          Core.checkPlacementOverlap(self.dragState.furniture, self.project.plan, self.dragState.furniture.id) :
          Core.checkFurnitureCollision(self.dragState.furniture, self.project.plan.furniture, self.dragState.furniture.id);

        if (snapRes.type === 'unit_joint') {
          self.dragState.hasCollision = false;
          self.dragState.collidedWith = null;
        } else {
          self.dragState.hasCollision = colCheck.hasOverlap !== undefined ? colCheck.hasOverlap : colCheck.collided;
          self.dragState.collidedWith = colCheck.target || colCheck.other;
        }
        self.render();
        return;
      }

      if (self.dragState && self.dragState.type === 'move_opening') {
        var w = self.dragState.wall;
        var op = self.dragState.opening;
        var wLen = Core.wallLength(w);
        var proj = Core.projectPointToSegment(self.cursorWorld, w.start, w.end);
        var minO = Math.round(op.width / 2);
        var maxO = Math.max(minO, Math.round(wLen - op.width / 2));
        op.offset = Math.max(minO, Math.min(maxO, Math.round(proj.t * wLen)));
        self.render();
        self.onSelectionChange(self.selected);
        return;
      }

      // Check hover over corner lock badges of selected walls
      var overLockBadge = false;
      if (!self.dragState && self.selected && self.selected.length > 0) {
        for (var sIdx = 0; sIdx < self.selected.length; sIdx++) {
          if (self.selected[sIdx].type === 'wall') {
            var sw = self.getWall(self.selected[sIdx].id);
            if (sw && sw._badgeBounds) {
              if (sw._badgeBounds['A'] && Math.hypot(mouseScreen.x - sw._badgeBounds['A'].x, mouseScreen.y - sw._badgeBounds['A'].y) < 24) {
                overLockBadge = true; break;
              }
              if (sw._badgeBounds['B'] && Math.hypot(mouseScreen.x - sw._badgeBounds['B'].x, mouseScreen.y - sw._badgeBounds['B'].y) < 24) {
                overLockBadge = true; break;
              }
            }
          }
        }
      }
      if (overLockBadge) {
        self.canvas.style.cursor = 'pointer';
      } else if (self.activeTool === 'wall' || self.activeTool === 'divider' || self.wallChainStart || self.activeTool === 'dimension') {
        self.canvas.style.cursor = 'crosshair';
      } else if (self.dragState) {
        self.canvas.style.cursor = 'grabbing';
      } else if (!self.dragState && self.activeTool === 'select') {
        self.canvas.style.cursor = 'default';
      }

      // Live drawing render
      if (self.activeTool === 'wall' || self.activeTool === 'divider' || self.activeTool === 'door' || self.activeTool === 'window' || self.activeTool === 'furniture' || self.activeTool === 'calibrate' || self.wallChainStart) {
        self.render();
      }
    });

    window.addEventListener('mouseup', function () {
      if (self.dragState) {
        if (self.dragState.type === 'draw_divider_box') {
          var dsBox = self.dragState;
          var p1 = dsBox.startWorld;
          var p2 = self.cursorWorld;
          var minX = Math.round(Math.min(p1.x, p2.x) / 25) * 25;
          var maxX = Math.round(Math.max(p1.x, p2.x) / 25) * 25;
          var minY = Math.round(Math.min(p1.y, p2.y) / 25) * 25;
          var maxY = Math.round(Math.max(p1.y, p2.y) / 25) * 25;
          var wMm = maxX - minX;
          var hMm = maxY - minY;

          self.dragState = null;

          if (wMm >= 250 && hMm >= 250) {
            // Dragged a box: create 4 room divider boundary walls enclosing Pooja Room zone!
            var dTop = Core.createRoomDivider({ start: { x: minX, y: minY }, end: { x: maxX, y: minY } });
            var dRight = Core.createRoomDivider({ start: { x: maxX, y: minY }, end: { x: maxX, y: maxY } });
            var dBottom = Core.createRoomDivider({ start: { x: maxX, y: maxY }, end: { x: minX, y: maxY } });
            var dLeft = Core.createRoomDivider({ start: { x: minX, y: maxY }, end: { x: minX, y: minY } });

            self.project.plan.walls.push(dTop, dRight, dBottom, dLeft);

            if (Core.detectRooms) Core.detectRooms(self.project);

            // Find the room enclosing this center point
            var centerPt = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
            var foundRoom = null;
            var rooms = self.project.plan.rooms || [];
            for (var ri = 0; ri < rooms.length; ri++) {
              if (rooms[ri].polygon && Core.Vec2.pointInPolygon(centerPt, rooms[ri].polygon)) {
                if (!foundRoom || (rooms[ri].areaSqM && foundRoom.areaSqM && rooms[ri].areaSqM < foundRoom.areaSqM)) {
                  foundRoom = rooms[ri];
                }
              }
            }

            if (foundRoom) {
              foundRoom.name = 'Pooja Room';
              self.selected = [{ type: 'room', id: foundRoom.id }];
            } else {
              self.selected = [{ type: 'wall', id: dTop.id }];
            }

            self.pushHistory('Create Pooja Room Area');
            if (typeof self.setTool === 'function') self.setTool('select');
            else self.activeTool = 'select';

            self.onSelectionChange(self.selected);
            self.render();
            if (typeof window !== 'undefined' && window.OrbixUI && window.OrbixUI.showToast) {
              window.OrbixUI.showToast('Pooja Room area created successfully!', 'success');
            }
            if (typeof window !== 'undefined' && window.OrbixUI) {
              if (window.OrbixUI.render3DHome) window.OrbixUI.render3DHome(true);
              if (window.OrbixUI.syncProjectUnitsTo3DStudio) window.OrbixUI.syncProjectUnitsTo3DStudio();
            }
            return;
          } else {
            // Simple click without dragging: initiate point-to-point drawing!
            self.handleWallMouseDown(dsBox.startWorld);
            self.render();
            return;
          }
        }

        if (self.dragState.type === 'move_furniture') {
          if (!self.dragState.hasMoved && self.dragState.matchingHits && self.dragState.matchingHits.length > 1) {
            // User performed a stationary click on stacked units (e.g. wall unit above floor unit):
            // cycle to the next unit underneath!
            var hits = self.dragState.matchingHits;
            var curId = self.dragState.furniture.id;
            var curIdx = hits.findIndex(function (h) { return h.id === curId; });
            if (curIdx !== -1) {
              var nextUnit = hits[(curIdx + 1) % hits.length];
              self.selected = [{ type: 'furniture', id: nextUnit.id }];
              self.onSelectionChange(self.selected);
            }
          }
          if (self.dragState.hasCollision) {
            // Revert invalid overlapping placement!
            self.dragState.furniture.pos.x = self.dragState.origPos.x;
            self.dragState.furniture.pos.y = self.dragState.origPos.y;
            self.dragState.hasCollision = false;
            self.dragState = null;
            self.render();
            if (typeof window !== 'undefined' && window.OrbixUI && window.OrbixUI.showToast) {
              window.OrbixUI.showToast('Overlap detected! Placement reverted.', 'warning');
            }
            return;
          }
          self.pushHistory('Move Furniture');
        } else if (self.dragState.type === 'move_opening') {
          Core.detectRooms(self.project);
          self.pushHistory('Move Opening');
        } else if (self.dragState.type === 'move_wall' || self.dragState.type === 'move_vertex') {
          if (self.dragState.hasMoved) {
            if (Core.detectRooms) Core.detectRooms(self.project);
            self.pushHistory(self.dragState.type === 'move_wall' ? 'Move Wall' : 'Move Vertex');
          }
        } else if (self.dragState.type === 'move_room') {
          if (self.dragState.hasMoved) {
            if (Core.detectRooms) Core.detectRooms(self.project);
            self.pushHistory('Move Room');
          }
        }
        self.dragState = null;
        self.render();
        if (typeof window !== 'undefined' && window.OrbixUI) {
          if (window.OrbixUI.syncProjectUnitsTo3DStudio) window.OrbixUI.syncProjectUnitsTo3DStudio();
          if (window.OrbixUI.render3DHome) window.OrbixUI.render3DHome(true);
        }
      }
    });

    window.addEventListener('keyup', function (e) {
      if (e.key === 'Shift') {
        self.isShiftDown = false;
        if (self.wallChainStart) self.render();
      }
    });

    // Keyboard shortcuts (Undo, Redo, Delete, Escape, Number Input)
    window.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'Shift') {
        self.isShiftDown = true;
        if (self.wallChainStart) self.render();
      }

      if (e.key === 'Escape') {
        if (self.activeTool === 'dimension') {
          self.dimensionStart = null;
          self.render();
          return;
        }
        if (self.activeTool === 'calibrate') {
          self.activeTool = 'select';
          if (self.underlay) self.underlay.calibPoints = [];
          self.render();
          return;
        }
        if (self.wallChainStart) {
          self.wallChainStart = null;
          self.wallChainFirstPoint = null;
          self.numericInputBuffer = '';
          if (Core.detectRooms) Core.detectRooms(self.project);
          self.pushHistory('Finish Wall Chain');
          self.render();
          return;
        }
      }

      if (e.key.toLowerCase() === 'm' && !e.ctrlKey && !e.metaKey) {
        var dimBtn = document.getElementById('planDimensionBtn');
        if (dimBtn) dimBtn.click();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) self.redo(); else self.undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        self.redo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        self.copySelected();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        self.pasteClipboard();
        return;
      }
      // 1. Numeric and Imperial typing for exact wall length (when drawing wall)
      if (self.wallChainStart) {
        var validKey = (e.key >= '0' && e.key <= '9') || e.key === '.' || e.key === '\'' || e.key === '"' || e.key === ' ' ||
          e.key.toLowerCase() === 'f' || e.key.toLowerCase() === 't' || e.key.toLowerCase() === 'i' || e.key.toLowerCase() === 'n' || e.key.toLowerCase() === 'm';
        if (validKey) {
          e.preventDefault();
          self.numericInputBuffer = (self.numericInputBuffer || '') + e.key;
          self.render();
          return;
        }
        if (e.key === 'Backspace' && self.numericInputBuffer && self.numericInputBuffer.length > 0) {
          e.preventDefault();
          self.numericInputBuffer = self.numericInputBuffer.slice(0, -1);
          self.render();
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          if (!self.numericInputBuffer || self.numericInputBuffer.trim().length === 0) {
            // Enter finishes wall drawing cleanly!
            self.wallChainStart = null;
            self.wallChainFirstPoint = null;
            self.numericInputBuffer = '';
            if (Core.detectRooms) Core.detectRooms(self.project);
            self.pushHistory('Finish Wall Chain');
            self.render();
            return;
          }
          var targetL = self.parseDimInput(self.numericInputBuffer);
          if (targetL > 50) {
            var snappedEnd = self.snapPoint(self.cursorWorld);
            var dx = snappedEnd.pt.x - self.wallChainStart.x;
            var dy = snappedEnd.pt.y - self.wallChainStart.y;
            var ang = Math.atan2(dy, dx);
            var exactEndPt = {
              x: Math.round(self.wallChainStart.x + Math.cos(ang) * targetL),
              y: Math.round(self.wallChainStart.y + Math.sin(ang) * targetL)
            };
            if (Vec2.dist(self.wallChainStart, exactEndPt) > 50) {
              var newW = Core.createWall({
                start: self.wallChainStart,
                end: exactEndPt,
                thickness: self.wallPreset.thickness,
                height: self.wallPreset.height
              });
              self.project.plan.walls.push(newW);
              self.pushHistory('Draw Wall (' + self.formatDim(targetL) + ')');
              self.wallChainStart = Vec2.clone(exactEndPt);
              self.numericInputBuffer = '';
              self.render();
              return;
            }
          }
        }
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        self.deleteSelected();
        return;
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.code === 'Space' || e.key === ' ' || e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        var rotated = false;
        for (var s = 0; s < self.selected.length; s++) {
          if (self.selected[s].type === 'furniture') {
            var fn = self.getFurniture ? self.getFurniture(self.selected[s].id) : null;
            if (!fn) {
              for (var f = 0; f < self.project.plan.furniture.length; f++) {
                if (self.project.plan.furniture[f].id === self.selected[s].id) { fn = self.project.plan.furniture[f]; break; }
              }
            }
            if (fn) {
              fn.rotY = ((fn.rotY || 0) + Math.PI / 2) % (Math.PI * 2);
              rotated = true;
            }
          }
        }
        if (rotated) {
          self.pushHistory('Rotate Furniture');
          self.render();
          if (typeof window !== 'undefined' && window.OrbixUI) {
            if (window.OrbixUI.syncProjectUnitsTo3DStudio) window.OrbixUI.syncProjectUnitsTo3DStudio();
            if (window.OrbixUI.render3DHome) window.OrbixUI.render3DHome(true);
          }
          return;
        }
        // Fallback: rotate active 3D Studio unit if any
        if (typeof window !== 'undefined' && window.S && window.S.units && window.S.units[window.S.active]) {
          var actU = window.S.units[window.S.active];
          if (actU && actU._furnId && self.project.plan.furniture) {
            for (var f2 = 0; f2 < self.project.plan.furniture.length; f2++) {
              if (self.project.plan.furniture[f2].id === actU._furnId) {
                self.project.plan.furniture[f2].rotY = ((self.project.plan.furniture[f2].rotY || 0) + Math.PI / 2) % (Math.PI * 2);
                self.pushHistory('Rotate Furniture');
                self.render();
                if (window.OrbixUI) {
                  if (window.OrbixUI.syncProjectUnitsTo3DStudio) window.OrbixUI.syncProjectUnitsTo3DStudio();
                  if (window.OrbixUI.render3DHome) window.OrbixUI.render3DHome(true);
                }
                return;
              }
            }
          }
        }
        if (!rotated && (e.key === 'r' || e.key === 'R')) {
          self.setTool('divider');
          return;
        }
      }
      if (e.key === 'Escape') {
        if (self.numericInputBuffer) {
          self.numericInputBuffer = '';
          self.render();
          return;
        }
        self.wallChainStart = null;
        self.selected = [];
        self.activeTool = 'select';
        self.render();
        return;
      }
    });
  };

  PlanEditor.prototype.setTool = function (tool) {
    this.activeTool = tool;
    if (tool !== 'wall' && tool !== 'divider') {
      this.wallChainStart = null;
      this.wallChainFirstPoint = null;
      this.numericInputBuffer = '';
    }
    if (this.canvas) {
      if (tool === 'wall' || tool === 'divider' || tool === 'dimension') {
        this.canvas.style.cursor = 'crosshair';
      } else {
        this.canvas.style.cursor = 'default';
      }
    }
    if (typeof document !== 'undefined') {
      var toolBtns = document.querySelectorAll('.plan-tool-btn');
      if (toolBtns && toolBtns.length) {
        toolBtns.forEach(function (b) {
          if (b.dataset.tool === tool) b.classList.add('is-active');
          else b.classList.remove('is-active');
        });
      }
    }
  };

  PlanEditor.prototype.handleSelectMouseDown = function (worldPt, isShift) {
    // 1. Check if clicked an opening
    var openings = this.project.plan.openings || [];
    for (var o = 0; o < openings.length; o++) {
      var op = openings[o];
      var ow = this.getWall(op.wallId);
      if (ow) {
        var wDir = Core.wallDirection(ow);
        var opCenter = {
          x: ow.start.x + wDir.x * op.offset,
          y: ow.start.y + wDir.y * op.offset
        };
        if (Vec2.dist(worldPt, opCenter) < op.width / 2 + 100) {
          this.selected = [{ type: 'opening', id: op.id }];
          this.dragState = {
            type: 'move_opening',
            opening: op,
            wall: ow
          };
          this.onSelectionChange(this.selected);
          this.render();
          return;
        }
      }
    }

    // 2. Check if clicked a furniture unit (Supports rotated OBBs and cycling between overlapping units!)
    var furnList = this.project.plan.furniture || [];
    var matchingHits = [];
    for (var f = furnList.length - 1; f >= 0; f--) {
      var fn = furnList[f];
      var poly = Core.getFurniturePolygon(fn);
      if (Core.Vec2.pointInPolygon(worldPt, poly)) {
        matchingHits.push(fn);
      }
    }
    if (matchingHits.length > 0) {
      var curSelId = (this.selected && this.selected.length === 1 && this.selected[0].type === 'furniture') ? this.selected[0].id : null;
      var hitFurn = matchingHits[0];
      if (curSelId && matchingHits.length > 1) {
        var curIdx = matchingHits.findIndex(function (h) { return h.id === curSelId; });
        if (curIdx !== -1) {
          hitFurn = matchingHits[(curIdx + 1) % matchingHits.length];
        }
      }
      this.selected = [{ type: 'furniture', id: hitFurn.id }];
      this.dragState = {
        type: 'move_furniture',
        furniture: hitFurn,
        startWorld: Vec2.clone(worldPt),
        origPos: Vec2.clone(hitFurn.pos),
        origRotY: hitFurn.rotY || 0
      };
      this.onSelectionChange(this.selected);
      this.render();
      return;
    }

    // 3. Check if clicked a dimension line
    var dims = (this.project && this.project.plan && this.project.plan.dimensions) || [];
    for (var di = dims.length - 1; di >= 0; di--) {
      var dm = dims[di];
      var dProj = Core.projectPointToSegment(worldPt, dm.p1, dm.p2);
      if (dProj && dProj.t >= 0 && dProj.t <= 1) {
        var dDist = Math.hypot(worldPt.x - dProj.pt.x, worldPt.y - dProj.pt.y);
        if (dDist < 150) {
          this.selected = [{ type: 'dimension', id: dm.id }];
          this.onSelectionChange(this.selected);
          this.render();
          return;
        }
      }
    }

    // 4. Check if clicked a wall -> Select first, or move parallel/perpendicular if already selected
    var near = this.findNearestWall(worldPt, 250);
    if (near) {
      var w = near.wall;
      var curSelWallId = (this.selected && this.selected.length === 1 && this.selected[0].type === 'wall') ? this.selected[0].id : null;
      var isAlreadySelected = (curSelWallId === w.id);

      if (!isShift) this.selected = [];
      this.selected.push({ type: 'wall', id: w.id });
      this.onSelectionChange(this.selected);

      // Move wall: Enabled! Moves parallel and perpendicular only, with connected walls moving along!
      if (isAlreadySelected) {
        var allWalls = this.project.plan.walls || [];
        var connectedStart = [];
        var connectedEnd = [];
        for (var cw = 0; cw < allWalls.length; cw++) {
          var other = allWalls[cw];
          if (!other || other.id === w.id) continue;
          if (other.start && Vec2.dist(w.start, other.start) < 60) {
            connectedStart.push({ wall: other, endpoint: 'start', orig: Vec2.clone(other.start) });
          } else if (other.end && Vec2.dist(w.start, other.end) < 60) {
            connectedStart.push({ wall: other, endpoint: 'end', orig: Vec2.clone(other.end) });
          }
          if (other.start && Vec2.dist(w.end, other.start) < 60) {
            connectedEnd.push({ wall: other, endpoint: 'start', orig: Vec2.clone(other.start) });
          } else if (other.end && Vec2.dist(w.end, other.end) < 60) {
            connectedEnd.push({ wall: other, endpoint: 'end', orig: Vec2.clone(other.end) });
          }
        }

        this.dragState = {
          type: 'move_wall',
          wall: w,
          startWorld: Vec2.clone(worldPt),
          origStart: Vec2.clone(w.start),
          origEnd: Vec2.clone(w.end),
          origDir: Core.wallDirection(w),
          origNorm: Core.wallNormal(w),
          connectedStart: connectedStart,
          connectedEnd: connectedEnd,
          hasMoved: false
        };
      } else {
        this.dragState = null;
      }

      this.render();
      return;
    }

    // Check if clicked inside a room polygon (Prioritizes inner rooms like Pooja room over outer enclosing rooms)
    var rooms = (this.project && this.project.plan && this.project.plan.rooms) || [];
    var hitRooms = [];
    for (var r = 0; r < rooms.length; r++) {
      if (rooms[r].polygon && rooms[r].polygon.length >= 3 && Core.Vec2.pointInPolygon(worldPt, rooms[r].polygon)) {
        hitRooms.push(rooms[r]);
      }
    }
    if (hitRooms.length > 0) {
      // Sort ascending by area so inner rooms (e.g. Pooja room) take selection priority over enclosing rooms
      hitRooms.sort(function (a, b) { return (a.areaSqM || 0) - (b.areaSqM || 0); });
      var targetRoom = hitRooms[0];

      var curSelRoomId = (this.selected && this.selected.length === 1 && this.selected[0].type === 'room') ? this.selected[0].id : null;
      var isAlreadySelected = (curSelRoomId === targetRoom.id);

      if (!isShift) this.selected = [];
      this.selected.push({ type: 'room', id: targetRoom.id });
      this.onSelectionChange(this.selected);

      // "when moving a unit it have to clicked before move"
      // If already selected, allow moving the room and its divider boundaries straight parallel & perpendicular!
      if (isAlreadySelected) {
        var allWalls = this.project.plan.walls || [];
        var roomDividerWalls = [];
        for (var rw = 0; rw < allWalls.length; rw++) {
          var wCandidate = allWalls[rw];
          if (!wCandidate || !wCandidate.isDivider) continue;
          var inWallIds = (targetRoom.wallIds && targetRoom.wallIds.indexOf(wCandidate.id) !== -1);
          var nearPoly = false;
          if (!inWallIds && targetRoom.polygon) {
            var dS = Core.Vec2.pointInPolygon(wCandidate.start, targetRoom.polygon);
            var dE = Core.Vec2.pointInPolygon(wCandidate.end, targetRoom.polygon);
            if (dS && dE) nearPoly = true;
          }
          if (inWallIds || nearPoly) {
            roomDividerWalls.push({
              wall: wCandidate,
              origStart: Vec2.clone(wCandidate.start),
              origEnd: Vec2.clone(wCandidate.end)
            });
          }
        }

        // Collect furniture inside room
        var allFurn = this.project.plan.furniture || [];
        var roomFurn = [];
        if (targetRoom.polygon) {
          for (var rf = 0; rf < allFurn.length; rf++) {
            if (allFurn[rf].pos && Core.Vec2.pointInPolygon(allFurn[rf].pos, targetRoom.polygon)) {
              roomFurn.push({
                furn: allFurn[rf],
                origPos: Vec2.clone(allFurn[rf].pos)
              });
            }
          }
        }

        this.dragState = {
          type: 'move_room',
          room: targetRoom,
          startWorld: Vec2.clone(worldPt),
          origPolygon: targetRoom.polygon.map(function (p) { return Vec2.clone(p); }),
          dividerWalls: roomDividerWalls,
          enclosedFurniture: roomFurn,
          hasMoved: false
        };
      } else {
        this.dragState = null;
      }

      this.render();
      return;
    }

    // Clicked empty space -> clear selection
    if (!isShift) {
      this.selected = [];
      this.onSelectionChange(this.selected);
      this.render();
    }
  };

  PlanEditor.prototype.handleWallMouseDown = function (worldPt) {
    var isDivider = (this.activeTool === 'divider');
    var snapped = this.snapPoint(worldPt);
    if (!this.wallChainStart) {
      this.wallChainStart = Vec2.clone(snapped.pt);
      this.wallChainFirstPoint = Vec2.clone(snapped.pt);
      this.numericInputBuffer = '';
    } else {
      var endPt = Vec2.clone(snapped.pt);
      var segDist = Vec2.dist(this.wallChainStart, endPt);
      if (segDist < 40) {
        // Clicking same point finishes the chain!
        this.wallChainStart = null;
        this.wallChainFirstPoint = null;
        this.numericInputBuffer = '';
        if (Core.detectRooms) Core.detectRooms(this.project);
        this.pushHistory(isDivider ? 'Finish Room Divider' : 'Finish Wall Chain');
        this.render();
        return;
      }
      if (segDist > 60) {
        var finalEndPt = endPt;
        var isEndOnWall = false;
        if (isDivider) {
          var allWalls = (this.project && this.project.plan && this.project.plan.walls) || [];
          for (var wi = 0; wi < allWalls.length; wi++) {
            var pr = Vec2.projectOnSegment(endPt, allWalls[wi].start, allWalls[wi].end);
            if (pr && pr.dist <= 120 && pr.t >= -0.05 && pr.t <= 1.05) {
              finalEndPt = Vec2.clone(pr.pt);
              isEndOnWall = true;
              break;
            }
          }
        }

        var newW = isDivider
          ? Core.createRoomDivider({
              start: this.wallChainStart,
              end: finalEndPt
            })
          : Core.createWall({
              start: this.wallChainStart,
              end: endPt,
              thickness: this.wallPreset.thickness,
              height: this.wallPreset.height
            });
        this.project.plan.walls.push(newW);
        this.pushHistory(isDivider ? 'Draw Room Divider' : 'Draw Wall');

        // Check if loop closed (connected back to start of chain)
        var isLoopClosed = (this.wallChainFirstPoint && Vec2.dist(endPt, this.wallChainFirstPoint) < 60) ||
                           (snapped && snapped.isChainClose);

        if (isLoopClosed) {
          // Loop closed! Terminate chain and run room detection
          this.wallChainStart = null;
          this.wallChainFirstPoint = null;
          this.numericInputBuffer = '';
          if (Core.detectRooms) Core.detectRooms(this.project);
          if (isDivider) this.setTool('select');
        } else if (isDivider && isEndOnWall) {
          // Divider connected to an existing wall: finish divider and detect rooms
          this.wallChainStart = null;
          this.wallChainFirstPoint = null;
          this.numericInputBuffer = '';
          if (Core.detectRooms) Core.detectRooms(this.project);
          this.setTool('select');
        } else {
          // Continue chain to next point (enables free multi-segment divider enclosures & boxes without joining walls!)
          this.wallChainStart = Vec2.clone(endPt);
          this.numericInputBuffer = '';
        }
      }
    }
    this.render();
  };

  PlanEditor.prototype.handleOpeningMouseDown = function (worldPt, type) {
    var near = this.findNearestWall(worldPt, 400);
    if (near) {
      var w = near.wall;
      var wLen = Core.wallLength(w);
      var opWidth = type === 'door' ? this.doorPreset.width : this.windowPreset.width;
      var offset = Math.max(opWidth / 2 + 50, Math.min(wLen - opWidth / 2 - 50, near.proj.t * wLen));

      var op = Core.createOpening({
        type: type,
        wallId: w.id,
        offset: offset,
        width: opWidth,
        height: type === 'door' ? this.doorPreset.height : this.windowPreset.height,
        sillHeight: type === 'door' ? 0 : this.windowPreset.sillHeight,
        swing: this.doorPreset.swing
      });
      this.project.plan.openings.push(op);
      this.pushHistory('Place ' + type);
      this.selected = [{ type: 'opening', id: op.id }];
      this.onSelectionChange(this.selected);
      this.render();
    }
  };

  // Computes the 8 connection points (4 corners + 4 edge midpoints) of a modular furniture unit
  PlanEditor.prototype.getFurnitureJointPoints = function (furn) {
    if (!furn) return [];
    var pos = furn.pos || { x: 0, y: 0 };
    var theta = furn.rotY || 0;
    var u = { x: Math.cos(theta), y: Math.sin(theta) };
    var v = { x: -Math.sin(theta), y: Math.cos(theta) };
    var dims = furn.dimensions || { W: 1200, D: 600 };

    var isLCorner = !!(
      (furn.unitConfig && (furn.unitConfig.geometryType === 'l_shaped_corner' || furn.unitConfig.unitType === 'fbcm' || (furn.unitConfig.corner && furn.unitConfig.corner.enabled))) ||
      furn.catalogItemId === 'fbcm' || furn.id === 'fbcm' || furn.id === 'f_fbcm_1' ||
      (furn.id && /fbcm/i.test(furn.id)) ||
      (furn.catalogItemId && /fbcm/i.test(furn.catalogItemId)) ||
      (furn.name && /l[-_ ]*shaped.*corner/i.test(furn.name))
    );

    if (isLCorner) {
      var cW = (furn.unitConfig && furn.unitConfig.corner && furn.unitConfig.corner.legW) || 900;
      var cD = (furn.unitConfig && furn.unitConfig.corner && furn.unitConfig.corner.legD) || 900;
      var cDepth = (furn.unitConfig && furn.unitConfig.corner && furn.unitConfig.corner.depth) || 560;

      function toWorld(lx, ly, name) {
        return {
          name: name,
          x: pos.x + lx * u.x + ly * v.x,
          y: pos.y + lx * u.y + ly * v.y,
          isCorner: true
        };
      }

      return [
        toWorld(-cW / 2, -cD / 2, 'Wall Corner'),
        toWorld(cW / 2, -cD / 2, 'Arm 1 Wall End'),
        toWorld(cW / 2, -cD / 2 + cDepth, 'Arm 1 Front End'),
        toWorld(-cW / 2 + cDepth, -cD / 2 + cDepth, 'Inside Corner'),
        toWorld(-cW / 2 + cDepth, cD / 2, 'Arm 2 Front End'),
        toWorld(-cW / 2, cD / 2, 'Arm 2 Wall End'),
        { name: 'Arm 1 Joint', x: pos.x + (cW / 2) * u.x + (-cD / 2 + cDepth / 2) * v.x, y: pos.y + (cW / 2) * u.y + (-cD / 2 + cDepth / 2) * v.y, isMid: true },
        { name: 'Arm 2 Joint', x: pos.x + (-cW / 2 + cDepth / 2) * u.x + (cD / 2) * v.x, y: pos.y + (-cW / 2 + cDepth / 2) * u.y + (cD / 2) * v.y, isMid: true }
      ];
    }

    var halfW = (dims.W || 1200) / 2;
    var halfD = (dims.D || 600) / 2;

    return [
      // 4 Corners:
      { name: 'BL', x: pos.x - halfW * u.x - halfD * v.x, y: pos.y - halfW * u.y - halfD * v.y, isCorner: true },
      { name: 'BR', x: pos.x + halfW * u.x - halfD * v.x, y: pos.y + halfW * u.y - halfD * v.y, isCorner: true },
      { name: 'FR', x: pos.x + halfW * u.x + halfD * v.x, y: pos.y + halfW * u.y + halfD * v.y, isCorner: true },
      { name: 'FL', x: pos.x - halfW * u.x + halfD * v.x, y: pos.y - halfW * u.y + halfD * v.y, isCorner: true },
      // 4 Midpoints:
      { name: 'BM', x: pos.x - halfD * v.x, y: pos.y - halfD * v.y, isMid: true },
      { name: 'FM', x: pos.x + halfD * v.x, y: pos.y + halfD * v.y, isMid: true },
      { name: 'LM', x: pos.x - halfW * u.x, y: pos.y - halfW * u.y, isMid: true },
      { name: 'RM', x: pos.x + halfW * u.x, y: pos.y + halfW * u.y, isMid: true }
    ];
  };

  // Smart Modular Snapping: 1) Adjacent Unit Jointing, 2) Plumb Stacking, 3) Wall Snatching & Overlap Prevention
  PlanEditor.prototype.snapFurniture = function (furn, candidatePos, candidateRotY) {
    var pos = { x: candidatePos.x, y: candidatePos.y };
    var rotY = candidateRotY !== undefined ? candidateRotY : (furn.rotY || 0);
    var fDims = furn.dimensions || { W: 1200, D: 600, H: 2100 };
    var fW = fDims.W || 1200;
    var fD = fDims.D || 600;
    var plan = this.project && this.project.plan;
    if (!plan) return { pos: pos, rotY: rotY };

    var furnList = plan.furniture || [];
    var activeId = furn.id;

    // Shift key temporarily disables all snapping for pixel-precision free positioning
    if (this.isShiftDown) {
      return { pos: pos, rotY: rotY, type: 'free_placement' };
    }

    // Decor & appliance items (sinks, gas hobs, dishwashers, dining tables, plants, etc.)
    // must NOT snap/snatch to adjacent unit points or edges, allowing free centering between units
    var isDecorF = !!(furn.isDecor || furn.excludeFromPricing || furn.category === 'decor' || (furn.decorType && furn.decorType !== 'general'));

    var isWallU = Core.isWallUnit ? Core.isWallUnit(furn.category, furn.name, furn.code || furn.catalogItemId, furn.costCategory) : false;
    var fElev = (furn.elevation !== undefined && furn.elevation !== null && furn.elevation !== '') ?
      parseFloat(furn.elevation) :
      ((furn.pos && furn.pos.z !== undefined && furn.pos.z !== null && furn.pos.z !== 0) ?
        parseFloat(furn.pos.z) : (isWallU ? 1500 : 0));
    var fH = (furn.dimensions && furn.dimensions.H) ? parseFloat(furn.dimensions.H) : (isWallU ? 600 : 850);
    var fTop = fElev + fH;

    var bestJoint = null;
    var minJointDist = 180; // mm magnetic snap threshold

    // Unit-to-unit jointing & multi-point magnetic snapping is only evaluated for regular woodwork cabinets
    if (!isDecorF) {
      for (var i = 0; i < furnList.length; i++) {
        var other = furnList[i];
        if (activeId && other.id === activeId) continue;
        var oDims = other.dimensions || { W: 1200, D: 600, H: 2100 };
        var oW = oDims.W || 1200;
        var oD = oDims.D || 600;
        var oRot = other.rotY || 0;
        var oPos = other.pos || { x: 0, y: 0 };

        var isWallO = Core.isWallUnit ? Core.isWallUnit(other.category, other.name, other.code || other.catalogItemId, other.costCategory) : false;
        var oElev = (other.elevation !== undefined && other.elevation !== null && other.elevation !== '') ?
          parseFloat(other.elevation) :
          ((other.pos && other.pos.z !== undefined && other.pos.z !== null && other.pos.z !== 0) ?
          parseFloat(other.pos.z) : (isWallO ? 1500 : 0));
      var oH = (other.dimensions && other.dimensions.H) ? parseFloat(other.dimensions.H) : (isWallO ? 600 : 850);
      var oTop = oElev + oH;

      var isDifferentBand = (fTop <= oElev + 5 || oTop <= fElev + 5);

      var uO = { x: Math.cos(oRot), y: Math.sin(oRot) };
      var vO = { x: -Math.sin(oRot), y: Math.cos(oRot) };

      if (isDifferentBand) {
        // ─── PLUMB STACKING (Wall unit above base unit, or base unit below wall unit) ───
        // In 2D, back face should be flush with other's back face against the wall:
        var backFlushPos = {
          x: oPos.x - ((oD - fD) / 2) * vO.x,
          y: oPos.y - ((oD - fD) / 2) * vO.y
        };

        // 1. Center aligned plumb
        var plumbCenterPos = backFlushPos;
        var dPlumbCenter = Math.hypot(pos.x - plumbCenterPos.x, pos.y - plumbCenterPos.y);
        if (dPlumbCenter < minJointDist + 60 && dPlumbCenter < (bestJoint ? bestJoint.dist : 9999)) {
          bestJoint = {
            pos: plumbCenterPos,
            rotY: oRot,
            type: 'unit_joint',
            snapMode: 'plumb',
            align: 'center',
            target: other,
            dist: dPlumbCenter,
            badgeLabel: isWallU ? '✓ Plumb Aligned above Base Unit (Center)' : '✓ Plumb Aligned below Wall Unit (Center)',
            snapPoint: plumbCenterPos
          };
        }

        // 2. Left-flush plumb
        var plumbLeftPos = {
          x: backFlushPos.x - ((oW - fW) / 2) * uO.x,
          y: backFlushPos.y - ((oW - fW) / 2) * uO.y
        };
        var dPlumbLeft = Math.hypot(pos.x - plumbLeftPos.x, pos.y - plumbLeftPos.y);
        if (dPlumbLeft < minJointDist + 60 && dPlumbLeft < (bestJoint ? bestJoint.dist : 9999)) {
          bestJoint = {
            pos: plumbLeftPos,
            rotY: oRot,
            type: 'unit_joint',
            snapMode: 'plumb',
            align: 'left',
            target: other,
            dist: dPlumbLeft,
            badgeLabel: isWallU ? '✓ Plumb Aligned above Base Unit (Left)' : '✓ Plumb Aligned below Wall Unit (Left)',
            snapPoint: plumbLeftPos
          };
        }

        // 3. Right-flush plumb
        var plumbRightPos = {
          x: backFlushPos.x + ((oW - fW) / 2) * uO.x,
          y: backFlushPos.y + ((oW - fW) / 2) * uO.y
        };
        var dPlumbRight = Math.hypot(pos.x - plumbRightPos.x, pos.y - plumbRightPos.y);
        if (dPlumbRight < minJointDist + 60 && dPlumbRight < (bestJoint ? bestJoint.dist : 9999)) {
          bestJoint = {
            pos: plumbRightPos,
            rotY: oRot,
            type: 'unit_joint',
            snapMode: 'plumb',
            align: 'right',
            target: other,
            dist: dPlumbRight,
            badgeLabel: isWallU ? '✓ Plumb Aligned above Base Unit (Right)' : '✓ Plumb Aligned below Wall Unit (Right)',
            snapPoint: plumbRightPos
          };
        }
      } else {
        // ─── SAME ELEVATION BAND JOINTING ───

        // Check angle orientation: parallel vs perpendicular
        var angleDiff = Math.abs((rotY - oRot + Math.PI * 4) % (Math.PI * 2));
        var isPerp = (Math.abs(angleDiff - Math.PI / 2) < 0.45 || Math.abs(angleDiff - 3 * Math.PI / 2) < 0.45);

        var otherIsLCorner = !!(
          (other.unitConfig && (other.unitConfig.geometryType === 'l_shaped_corner' || other.unitConfig.unitType === 'fbcm' || (other.unitConfig.corner && other.unitConfig.corner.enabled))) ||
          other.catalogItemId === 'fbcm' || other.id === 'fbcm' || other.id === 'f_fbcm_1' ||
          (other.id && /fbcm/i.test(other.id)) ||
          (other.name && /l[-_ ]*shaped.*corner/i.test(other.name))
        );

        if (otherIsLCorner) {
          var cW = (other.unitConfig && other.unitConfig.corner && other.unitConfig.corner.legW) || 900;
          var cD = (other.unitConfig && other.unitConfig.corner && other.unitConfig.corner.legD) || 900;
          var cDepth = (other.unitConfig && other.unitConfig.corner && other.unitConfig.corner.depth) || 560;

          // 1. Arm 1 face (along +uO at local X = +cW/2, Y = -cD/2 + cDepth/2)
          var arm1FaceCenter = {
            x: oPos.x + (cW / 2) * uO.x + (-cD / 2 + cDepth / 2) * vO.x,
            y: oPos.y + (cW / 2) * uO.y + (-cD / 2 + cDepth / 2) * vO.y
          };
          var targetPosArm1 = {
            x: arm1FaceCenter.x + (fW / 2) * uO.x - ((cDepth - fD) / 2) * vO.x,
            y: arm1FaceCenter.y + (fW / 2) * uO.y - ((cDepth - fD) / 2) * vO.y
          };
          var dArm1 = Math.hypot(pos.x - targetPosArm1.x, pos.y - targetPosArm1.y);
          if (dArm1 < minJointDist + 80 && dArm1 < (bestJoint ? bestJoint.dist : 9999)) {
            bestJoint = {
              pos: targetPosArm1,
              rotY: oRot,
              type: 'unit_joint',
              side: 'arm1',
              target: other,
              dist: dArm1,
              badgeLabel: '✓ Jointed to Corner Arm 1',
              snapPoint: arm1FaceCenter
            };
          }

          // 2. Arm 2 face (along +vO at local X = -cW/2 + cDepth/2, Y = +cD/2)
          var arm2FaceCenter = {
            x: oPos.x + (-cW / 2 + cDepth / 2) * uO.x + (cD / 2) * vO.x,
            y: oPos.y + (-cW / 2 + cDepth / 2) * uO.y + (cD / 2) * vO.y
          };
          var rotArm2 = (oRot + Math.PI / 2) % (Math.PI * 2);
          var uArm2 = { x: Math.cos(rotArm2), y: Math.sin(rotArm2) };
          var vArm2 = { x: -Math.sin(rotArm2), y: Math.cos(rotArm2) };
          var targetPosArm2 = {
            x: arm2FaceCenter.x + (fW / 2) * uArm2.x - ((cDepth - fD) / 2) * vArm2.x,
            y: arm2FaceCenter.y + (fW / 2) * uArm2.y - ((cDepth - fD) / 2) * vArm2.y
          };
          var dArm2 = Math.hypot(pos.x - targetPosArm2.x, pos.y - targetPosArm2.y);
          if (dArm2 < minJointDist + 80 && dArm2 < (bestJoint ? bestJoint.dist : 9999)) {
            bestJoint = {
              pos: targetPosArm2,
              rotY: rotArm2,
              type: 'unit_joint',
              side: 'arm2',
              target: other,
              dist: dArm2,
              badgeLabel: '✓ Jointed to Corner Arm 2',
              snapPoint: arm2FaceCenter
            };
          }
        }

        if (!isPerp) {
          // A. Parallel Side-by-Side: Active unit Left joints to Other unit Right (Back flush)
          var rightJointPos = {
            x: oPos.x + ((oW + fW) / 2) * uO.x - ((oD - fD) / 2) * vO.x,
            y: oPos.y + ((oW + fW) / 2) * uO.y - ((oD - fD) / 2) * vO.y
          };
          var dRight = Math.hypot(pos.x - rightJointPos.x, pos.y - rightJointPos.y);
          if (dRight < minJointDist && dRight < (bestJoint ? bestJoint.dist : 9999)) {
            bestJoint = {
              pos: rightJointPos,
              rotY: oRot,
              type: 'unit_joint',
              side: 'right',
              target: other,
              dist: dRight,
              badgeLabel: '✓ Jointed Side-by-Side',
              snapPoint: { x: oPos.x + (oW / 2) * uO.x, y: oPos.y + (oW / 2) * uO.y }
            };
          }

          // B. Parallel Side-by-Side: Active unit Right joints to Other unit Left (Back flush)
          var leftJointPos = {
            x: oPos.x - ((oW + fW) / 2) * uO.x - ((oD - fD) / 2) * vO.x,
            y: oPos.y - ((oW + fW) / 2) * uO.y - ((oD - fD) / 2) * vO.y
          };
          var dLeft = Math.hypot(pos.x - leftJointPos.x, pos.y - leftJointPos.y);
          if (dLeft < minJointDist && dLeft < (bestJoint ? bestJoint.dist : 9999)) {
            bestJoint = {
              pos: leftJointPos,
              rotY: oRot,
              type: 'unit_joint',
              side: 'left',
              target: other,
              dist: dLeft,
              badgeLabel: '✓ Jointed Side-by-Side',
              snapPoint: { x: oPos.x - (oW / 2) * uO.x, y: oPos.y - (oW / 2) * uO.y }
            };
          }

          // C. Back-to-Back Island Joint
          var backJointPos = {
            x: oPos.x - ((oD + fD) / 2) * vO.x,
            y: oPos.y - ((oD + fD) / 2) * vO.y
          };
          var dBack = Math.hypot(pos.x - backJointPos.x, pos.y - backJointPos.y);
          if (dBack < minJointDist && dBack < (bestJoint ? bestJoint.dist : 9999)) {
            bestJoint = {
              pos: backJointPos,
              rotY: (oRot + Math.PI) % (Math.PI * 2),
              type: 'unit_joint',
              side: 'back',
              target: other,
              dist: dBack,
              badgeLabel: '✓ Back-to-Back Island Joint',
              snapPoint: backJointPos
            };
          }
        } else {
          // Perpendicular L-Corner Jointing
          var perpRot = Math.abs(angleDiff - Math.PI / 2) < 0.45 ? (oRot + Math.PI / 2) : (oRot - Math.PI / 2);

          // Right L-corner (Right side of other unit)
          var lCornerRight = {
            x: oPos.x + (oW / 2 - fD / 2) * uO.x + (oD / 2 + fW / 2) * vO.x,
            y: oPos.y + (oW / 2 - fD / 2) * uO.y + (oD / 2 + fW / 2) * vO.y
          };
          var dLRight = Math.hypot(pos.x - lCornerRight.x, pos.y - lCornerRight.y);
          if (dLRight < minJointDist && dLRight < (bestJoint ? bestJoint.dist : 9999)) {
            bestJoint = {
              pos: lCornerRight,
              rotY: perpRot,
              type: 'unit_joint',
              side: 'l_corner_right',
              target: other,
              dist: dLRight,
              badgeLabel: '✓ L-Corner Jointed',
              snapPoint: lCornerRight
            };
          }

          // Left L-corner (Left side of other unit)
          var lCornerLeft = {
            x: oPos.x - (oW / 2 - fD / 2) * uO.x + (oD / 2 + fW / 2) * vO.x,
            y: oPos.y - (oW / 2 - fD / 2) * uO.y + (oD / 2 + fW / 2) * vO.y
          };
          var dLLeft = Math.hypot(pos.x - lCornerLeft.x, pos.y - lCornerLeft.y);
          if (dLLeft < minJointDist && dLLeft < (bestJoint ? bestJoint.dist : 9999)) {
            bestJoint = {
              pos: lCornerLeft,
              rotY: perpRot,
              type: 'unit_joint',
              side: 'l_corner_left',
              target: other,
              dist: dLLeft,
              badgeLabel: '✓ L-Corner Jointed',
              snapPoint: lCornerLeft
            };
          }
        }

        // Multi-point corner-to-corner & midpoint magnetic snapping (4 corners + 4 midpoints)
        var otherPts = this.getFurnitureJointPoints(other);
        var actTest = { pos: pos, rotY: rotY, dimensions: fDims };
        var actPts = this.getFurnitureJointPoints(actTest);

        for (var ap = 0; ap < actPts.length; ap++) {
          for (var op = 0; op < otherPts.length; op++) {
            var pDist = Math.hypot(actPts[ap].x - otherPts[op].x, actPts[ap].y - otherPts[op].y);
            if (pDist < minJointDist && pDist < (bestJoint ? bestJoint.dist : 9999)) {
              var shiftX = otherPts[op].x - actPts[ap].x;
              var shiftY = otherPts[op].y - actPts[ap].y;
              var testSnappedPos = { x: pos.x + shiftX, y: pos.y + shiftY };

              // Verify non-penetration
              var dummyF = { pos: testSnappedPos, rotY: rotY, dimensions: fDims };
              var polyF = Core.getFurniturePolygon(dummyF);
              var polyO = Core.getFurniturePolygon(other);
              if (!Core.polygonsIntersect(polyF, polyO, 5)) {
                bestJoint = {
                  pos: testSnappedPos,
                  rotY: rotY,
                  type: 'unit_joint',
                  side: 'point_snap',
                  target: other,
                  dist: pDist,
                  badgeLabel: '✓ Point Snapped (' + actPts[ap].name + ' to ' + otherPts[op].name + ')',
                  snapPoint: { x: otherPts[op].x, y: otherPts[op].y }
                };
              }
            }
          }
        }
      }
    }
  }

    if (bestJoint) {
      return bestJoint;
    }

    // 2. WALL SNATCHING (FLUSH SNAP TO WALL FACE) & WALL OVERLAP PREVENTION
    var walls = plan.walls || [];
    var rooms = plan.rooms || [];
    var bestWallSnap = null;
    var minWallDist = 280; // snap zone (mm)
    var halfD = fD / 2;
    var halfW = fW / 2;

    var furnIsLCorner = !!(
      (furn.unitConfig && (furn.unitConfig.geometryType === 'l_shaped_corner' || furn.unitConfig.unitType === 'fbcm' || (furn.unitConfig.corner && furn.unitConfig.corner.enabled))) ||
      furn.catalogItemId === 'fbcm' || furn.id === 'fbcm' || furn.id === 'f_fbcm_1' ||
      (furn.id && /fbcm/i.test(furn.id)) ||
      (furn.name && /l[-_ ]*shaped.*corner/i.test(furn.name))
    );

    if (furnIsLCorner) {
      // Magnetic 90° corner snapping for L-shaped corner base unit
      var cW = (furn.unitConfig && furn.unitConfig.corner && furn.unitConfig.corner.legW) || 900;
      var cD = (furn.unitConfig && furn.unitConfig.corner && furn.unitConfig.corner.legD) || 900;
      for (var wa = 0; wa < walls.length; wa++) {
        var wA = walls[wa];
        for (var wb = wa + 1; wb < walls.length; wb++) {
          var wB = walls[wb];
          var sharedPt = null, endA = null, endB = null;
          if (Vec2.dist(wA.start, wB.start) < 20) { sharedPt = wA.start; endA = wA.end; endB = wB.end; }
          else if (Vec2.dist(wA.start, wB.end) < 20) { sharedPt = wA.start; endA = wA.end; endB = wB.start; }
          else if (Vec2.dist(wA.end, wB.start) < 20) { sharedPt = wA.end; endA = wA.start; endB = wB.end; }
          else if (Vec2.dist(wA.end, wB.end) < 20) { sharedPt = wA.end; endA = wA.start; endB = wB.start; }

          if (sharedPt) {
            var vA = { x: endA.x - sharedPt.x, y: endA.y - sharedPt.y };
            var vB = { x: endB.x - sharedPt.x, y: endB.y - sharedPt.y };
            var lenA = Math.hypot(vA.x, vA.y);
            var lenB = Math.hypot(vB.x, vB.y);
            if (lenA > 100 && lenB > 100) {
              var uA = { x: vA.x / lenA, y: vA.y / lenA };
              var uB = { x: vB.x / lenB, y: vB.y / lenB };
              var dotAB = uA.x * uB.x + uA.y * uB.y;
              if (Math.abs(dotAB) < 0.25) {
                var halfTA = (wA.thickness || 150) / 2;
                var halfTB = (wB.thickness || 150) / 2;
                var cornerCenter = {
                  x: sharedPt.x + (halfTA + cW / 2) * uA.x + (halfTB + cD / 2) * uB.x,
                  y: sharedPt.y + (halfTA + cW / 2) * uA.y + (halfTB + cD / 2) * uB.y
                };
                var distCorner = Math.hypot(pos.x - cornerCenter.x, pos.y - cornerCenter.y);
                if (distCorner < 350) {
                  var rotAngle = Math.atan2(uA.y, uA.x);
                  return {
                    pos: cornerCenter,
                    rotY: rotAngle,
                    type: 'wall_snap',
                    badgeLabel: '✓ Snapped Flush into Room Corner (90°)'
                  };
                }
              }
            }
          }
        }
      }
    }

    for (var wIdx = 0; wIdx < walls.length; wIdx++) {
      var w = walls[wIdx];
      var dx = w.end.x - w.start.x;
      var dy = w.end.y - w.start.y;
      var wLen = Math.hypot(dx, dy);
      if (wLen < 1) continue;
      var wDir = { x: dx / wLen, y: dy / wLen };
      var wNorm = { x: -wDir.y, y: wDir.x };
      var halfT = (w.thickness || 150) / 2;
      var flushDist = halfT + halfD;

      // Inner clear segment bounds
      var innerSeg = (Core.getWallInnerSegment ? Core.getWallInnerSegment(w, plan) : null);
      var startClear = ((innerSeg && innerSeg.startDeduction ? innerSeg.startDeduction : halfT) + halfW) / wLen;
      var endClear = 1 - (((innerSeg && innerSeg.endDeduction ? innerSeg.endDeduction : halfT) + halfW) / wLen);
      if (startClear > endClear) { startClear = 0.05; endClear = 0.95; }

      // Project unit position onto wall segment
      var toCur = { x: pos.x - w.start.x, y: pos.y - w.start.y };
      var t = (toCur.x * wDir.x + toCur.y * wDir.y) / wLen;
      var tClamped = Math.max(startClear, Math.min(endClear, t));
      var proj = { x: w.start.x + tClamped * dx, y: w.start.y + tClamped * dy };

      var toCurProj = { x: pos.x - proj.x, y: pos.y - proj.y };
      var sDist = toCurProj.x * wNorm.x + toCurProj.y * wNorm.y;
      var sign = sDist >= 0 ? 1 : -1;
      var normOut = { x: sign * wNorm.x, y: sign * wNorm.y };

      // Room Interior Awareness: if one side is inside a room, orient front into that room
      if (rooms.length > 0) {
        var testPos = { x: proj.x + wNorm.x * (flushDist + 20), y: proj.y + wNorm.y * (flushDist + 20) };
        var testNeg = { x: proj.x - wNorm.x * (flushDist + 20), y: proj.y - wNorm.y * (flushDist + 20) };
        var posInRoom = rooms.some(function (r) { return r.polygon && Core.Vec2.pointInPolygon(testPos, r.polygon); });
        var negInRoom = rooms.some(function (r) { return r.polygon && Core.Vec2.pointInPolygon(testNeg, r.polygon); });
        if (posInRoom && !negInRoom) normOut = { x: wNorm.x, y: wNorm.y };
        else if (negInRoom && !posInRoom) normOut = { x: -wNorm.x, y: -wNorm.y };
      }

      var perpDist = Math.abs(sDist);

      // Wall Snatching: when within 280mm of flush contact
      if (perpDist < flushDist + minWallDist && t >= -0.15 && t <= 1.15) {
        var snapDist = Math.abs(perpDist - flushDist);
        if (snapDist < minWallDist) {
          minWallDist = snapDist;
          var wallSnapPos = {
            x: proj.x + normOut.x * flushDist,
            y: proj.y + normOut.y * flushDist
          };
          var normAngle = Math.atan2(normOut.y, normOut.x);
          var cabinetRotY = normAngle - Math.PI / 2;

          bestWallSnap = {
            pos: wallSnapPos,
            rotY: cabinetRotY,
            type: 'wall_snap',
            wall: w,
            proj: proj,
            norm: normOut,
            badgeLabel: '✓ Snapped Flush to Wall'
          };
        }
      } else if (perpDist < flushDist && t >= 0 && t <= 1) {
        // Overlap Prevention: clamp strictly outward so units never overlap walls
        pos.x = proj.x + normOut.x * flushDist;
        pos.y = proj.y + normOut.y * flushDist;
      }
    }

    if (bestWallSnap) {
      return bestWallSnap;
    }

    // Secondary collision clamping against any intersecting wall cores
    for (var w2 = 0; w2 < walls.length; w2++) {
      var wObj = walls[w2];
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
    }

    return { pos: pos, rotY: rotY };
  };

  PlanEditor.prototype.handleFurnitureMouseDown = function (worldPt) {
    if (!this.furniturePreset) return;
    var snapped = this.snapPoint(worldPt);

    // Apply smart snapping (jointing to adjacent units or snatching to wall face)
    var snapRes = this.snapFurniture(this.furniturePreset, snapped.pt, this.furnitureRotY || 0);
    var finalPos = snapRes.pos;
    var finalRotY = snapRes.rotY !== undefined ? snapRes.rotY : (this.furnitureRotY || 0);

    var matchedRoomId = null;
    var rooms = this.project.plan.rooms || [];
    for (var r = 0; r < rooms.length; r++) {
      if (Core.Vec2.pointInPolygon(finalPos, rooms[r].polygon)) {
        matchedRoomId = rooms[r].id;
        break;
      }
    }

    var isWall = (Core.isWallUnit) ?
      Core.isWallUnit(this.furniturePreset.category, this.furniturePreset.name, this.furniturePreset.code || this.furniturePreset.catalogItemId, this.furniturePreset.costCategory) :
      false;
    var catPlan = (this.furniturePreset.category || '').toLowerCase();
    var nmPlan = (this.furniturePreset.name || '').toLowerCase();
    var isLoftPlan = (catPlan.indexOf('loft') !== -1 || nmPlan.indexOf('loft') !== -1);
    var defPlanElev = isLoftPlan ? 2100 : (isWall ? 1500 : 0);
    var presetElev = (this.furniturePreset.elevation !== undefined && this.furniturePreset.elevation !== null && this.furniturePreset.elevation !== '') ?
      parseFloat(this.furniturePreset.elevation) : defPlanElev;

    var furn = Core.createFurniturePlacement({
      name: this.furniturePreset.name,
      category: this.furniturePreset.category,
      code: this.furniturePreset.code,
      costCategory: this.furniturePreset.costCategory,
      roomId: matchedRoomId,
      elevation: presetElev,
      pos: { x: finalPos.x, y: finalPos.y, z: presetElev },
      rotY: finalRotY,
      dimensions: Object.assign({}, this.furniturePreset.dimensions),
      unitConfig: Object.assign({}, this.furniturePreset.unitConfig || {})
    });

    this.project.plan.furniture.push(furn);
    this.pushHistory('Place ' + furn.name);
    if (typeof this.setTool === 'function') this.setTool('select');
    else this.activeTool = 'select';
    this.selected = [{ type: 'furniture', id: furn.id }];
    this.onSelectionChange(this.selected);
    this.render();
  };

  PlanEditor.prototype.handleSplitMouseDown = function (worldPt) {
    var near = this.findNearestWall(worldPt, 250);
    if (near) {
      var res = Core.splitWall(this.project, near.wall.id, near.proj.pt);
      if (res) {
        this.pushHistory('Split Wall');
        this.render();
      }
    }
  };

  PlanEditor.prototype.handleCalibrateMouseDown = function (worldPt) {
    if (!this.underlay || !this.underlay.img) {
      this.activeTool = 'select';
      this.render();
      return;
    }
    this.underlay.calibPoints = this.underlay.calibPoints || [];
    this.underlay.calibPoints.push(Vec2.clone(worldPt));

    if (this.underlay.calibPoints.length === 2) {
      var p1 = this.underlay.calibPoints[0];
      var p2 = this.underlay.calibPoints[1];
      var worldDist = Vec2.dist(p1, p2);
      var pixelDist = Math.max(1, Math.round(worldDist / this.underlay.scale));
      if (typeof this.onCalibrateRequest === 'function') {
        this.onCalibrateRequest(pixelDist, worldDist);
      }
    }
    this.render();
  };

  PlanEditor.prototype.handleDimensionMouseDown = function (worldPt) {
    var snapped = this.snapPoint(worldPt);
    var pt = snapped.pt;

    if (!this.dimensionStart) {
      this.dimensionStart = { x: pt.x, y: pt.y };
      this.render();
      return;
    }

    var p1 = this.dimensionStart;
    var p2 = { x: pt.x, y: pt.y };
    var dist = Math.round(Math.hypot(p2.x - p1.x, p2.y - p1.y));

    if (dist >= 10) {
      if (!this.project.plan.dimensions) this.project.plan.dimensions = [];
      var newDim = {
        id: 'dim-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        p1: p1,
        p2: p2,
        distMm: dist
      };
      this.project.plan.dimensions.push(newDim);
      this.pushHistory('Measure Dimension (' + dist + ' mm)');
    }

    this.dimensionStart = null;
    this.render();
  };

  PlanEditor.prototype.getWall = function (id) {
    var walls = this.project.plan.walls;
    for (var i = 0; i < walls.length; i++) {
      if (walls[i].id === id) return walls[i];
    }
    return null;
  };

  PlanEditor.prototype.getFurniture = function (id) {
    var list = (this.project && this.project.plan && this.project.plan.furniture) || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  };

  PlanEditor.prototype.copySelected = function () {
    if (!this.selected || this.selected.length === 0) return;
    this.clipboard = [];
    this.pasteCount = 0;
    for (var s = 0; s < this.selected.length; s++) {
      var item = this.selected[s];
      if (item.type === 'furniture') {
        var fn = this.getFurniture(item.id);
        if (fn) {
          this.clipboard.push({ type: 'furniture', data: JSON.parse(JSON.stringify(fn)) });
        }
      }
    }
  };

  PlanEditor.prototype.pasteClipboard = function () {
    if (!this.clipboard || this.clipboard.length === 0) return;
    this.pasteCount = (this.pasteCount || 0) + 1;
    var offsetDist = 120 * this.pasteCount;
    var newSelected = [];

    for (var i = 0; i < this.clipboard.length; i++) {
      var entry = this.clipboard[i];
      if (entry.type === 'furniture') {
        var orig = entry.data;
        var newId = 'furn_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
        var newFurn = JSON.parse(JSON.stringify(orig));
        newFurn.id = newId;
        newFurn.name = (orig.name || 'Unit') + ' (Copy)';
        var isWall = (Core.isWallUnit) ?
          Core.isWallUnit(orig.category, orig.name, orig.code || orig.catalogItemId, orig.costCategory) :
          ((orig.category && orig.category.toLowerCase().indexOf('wall') !== -1) ||
           (orig.name && orig.name.toLowerCase().indexOf('wall') !== -1) ||
           /(^|\b|_|-)(wm|wcm)($|\b|_|-|\d+)/i.test(orig.name));
        var origElev = (orig.elevation !== undefined && orig.elevation !== null) ?
          orig.elevation : ((orig.pos && orig.pos.z !== 0) ? orig.pos.z : (isWall ? 1500 : 0));
        newFurn.elevation = origElev;
        newFurn.pos = {
          x: Math.round((orig.pos.x + offsetDist) / 50) * 50,
          y: Math.round((orig.pos.y + offsetDist) / 50) * 50,
          z: origElev
        };
        newFurn.shutterStates = orig.shutterStates ? orig.shutterStates.slice() : [];
        newFurn.drawerStates = orig.drawerStates ? orig.drawerStates.slice() : [];
        var rooms = (this.project && this.project.plan && this.project.plan.rooms) || [];
        for (var rm = 0; rm < rooms.length; rm++) {
          if (rooms[rm].polygon && Core.Vec2.pointInPolygon(newFurn.pos, rooms[rm].polygon)) {
            newFurn.roomId = rooms[rm].id;
            break;
          }
        }
        if (!this.project.plan.furniture) this.project.plan.furniture = [];
        this.project.plan.furniture.push(newFurn);
        newSelected.push({ type: 'furniture', id: newId });
      }
    }

    if (newSelected.length > 0) {
      this.selected = newSelected;
      this.pushHistory('Paste Object(s)');
      this.onSelectionChange(this.selected);
      this.render();
      if (typeof window !== 'undefined' && window.OrbixUI) {
        if (window.OrbixUI.syncProjectUnitsTo3DStudio) window.OrbixUI.syncProjectUnitsTo3DStudio();
        if (window.OrbixUI.render3DHome) window.OrbixUI.render3DHome(true);
      }
    }
  };

  PlanEditor.prototype.resize = function () {
    var dpr = window.devicePixelRatio || 1;
    var w = this.container.clientWidth || 800;
    var h = this.container.clientHeight || 600;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.ctx.scale(dpr, dpr);
    this.width = w;
    this.height = h;
  };

  // Center & fit entire plan in view
  PlanEditor.prototype.zoomFit = function () {
    var walls = this.project.plan.walls;
    if (!walls.length) {
      if (this.underlay && this.underlay.img) {
        var uW = (this.underlay.width || this.underlay.img.naturalWidth || 1000) * (this.underlay.scale || 10);
        var uH = (this.underlay.height || this.underlay.img.naturalHeight || 1000) * (this.underlay.scale || 10);
        var sX = (this.width - 120) / uW;
        var sY = (this.height - 120) / uH;
        this.zoom = Math.max(0.02, Math.min(0.8, Math.min(sX, sY)));
        this.pan.x = this.width / 2 - (this.underlay.x || 0) * this.zoom;
        this.pan.y = this.height / 2 - (this.underlay.y || 0) * this.zoom;
        this.render();
        return;
      }
      this.pan = { x: this.width / 2, y: this.height / 2 };
      this.zoom = 0.12;
      this.render();
      return;
    }
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var i = 0; i < walls.length; i++) {
      var w = walls[i];
      minX = Math.min(minX, w.start.x, w.end.x);
      minY = Math.min(minY, w.start.y, w.end.y);
      maxX = Math.max(maxX, w.start.x, w.end.x);
      maxY = Math.max(maxY, w.start.y, w.end.y);
    }
    var planW = maxX - minX + 1500;
    var planH = maxY - minY + 1500;
    var scaleX = this.width / planW;
    var scaleY = this.height / planH;
    this.zoom = Math.max(0.04, Math.min(0.6, Math.min(scaleX, scaleY)));
    this.pan.x = this.width / 2 - ((minX + maxX) / 2) * this.zoom;
    this.pan.y = this.height / 2 - ((minY + maxY) / 2) * this.zoom;
    this.render();
  };

  /* ─────────────────────────────────────────────────────────────────────────────
     2D Rendering Loop
     ───────────────────────────────────────────────────────────────────────────── */
  PlanEditor.prototype.render = function () {
    var ctx = this.ctx;
    var w = this.width, h = this.height;
    ctx.clearRect(0, 0, w, h);

    // Background paper
    ctx.fillStyle = '#FBFAF8';
    ctx.fillRect(0, 0, w, h);

    // 0. Floor Plan Underlay Image (tracing overlay)
    this.renderUnderlay(ctx);

    // 1. Grid Lines
    this.renderGrid(ctx);

    // 2. Room floor fills & area tags
    this.renderRooms(ctx);

    // 3. Walls
    this.renderWalls(ctx);

    // 4. Openings (Doors & Windows)
    this.renderOpenings(ctx);

    // 4b. Architectural Segmented Dimensions & Witness Lines (A, B, 1, 2)
    this.renderAllWallDimensions(ctx);

    // 4c. Wall Corner Angles (90°, 45°, 135°, arbitrary)
    this.renderCornerAngles(ctx);

    // 5. Furniture Units (2D footprints)
    this.renderFurniture(ctx);

    // 5b. Placed CAD Dimension Lines (mm / cm / ft & in)
    this.renderDimensions(ctx);

    // 6. Active Tool / Drawing Preview
    this.renderPreview(ctx);
  };

  PlanEditor.prototype.renderUnderlay = function (ctx) {
    if (!this.underlay || !this.underlay.img || !this.underlay.visible) return;
    var u = this.underlay;
    var wMm = (u.width || u.img.naturalWidth || 1000) * (u.scale || 10);
    var hMm = (u.height || u.img.naturalHeight || 1000) * (u.scale || 10);
    var halfWMm = wMm / 2;
    var halfHMm = hMm / 2;

    var topLeft = this.worldToScreen({ x: (u.x || 0) - halfWMm, y: (u.y || 0) - halfHMm });
    var wPx = wMm * this.zoom;
    var hPx = hMm * this.zoom;

    ctx.save();
    ctx.globalAlpha = (u.opacity !== undefined) ? u.opacity : 0.45;
    try {
      ctx.drawImage(u.img, topLeft.x, topLeft.y, wPx, hPx);
    } catch (e) {}

    // Subtle dashed blueprint boundary
    ctx.strokeStyle = 'rgba(27, 79, 114, 0.45)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(topLeft.x, topLeft.y, wPx, hPx);
    ctx.restore();
  };

  PlanEditor.prototype.renderGrid = function (ctx) {
    var minorGridMm = 100;
    var majorGridMm = 1000;
    var minorPx = minorGridMm * this.zoom;
    var majorPx = majorGridMm * this.zoom;

    if (majorPx < 20) return; // grid too dense, skip minor

    var startWorld = this.screenToWorld({ x: 0, y: 0 });
    var endWorld = this.screenToWorld({ x: this.width, y: this.height });

    var xStart = Math.floor(startWorld.x / majorGridMm) * majorGridMm;
    var yStart = Math.floor(startWorld.y / majorGridMm) * majorGridMm;

    // Draw Major Grid Lines
    ctx.strokeStyle = '#EAE7E1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var x = xStart; x <= endWorld.x; x += majorGridMm) {
      var sX = this.worldToScreen({ x: x, y: 0 }).x;
      ctx.moveTo(sX, 0);
      ctx.lineTo(sX, this.height);
    }
    for (var y = yStart; y <= endWorld.y; y += majorGridMm) {
      var sY = this.worldToScreen({ x: 0, y: y }).y;
      ctx.moveTo(0, sY);
      ctx.lineTo(this.width, sY);
    }
    ctx.stroke();

    // Coordinate origin crosshair
    var origin = this.worldToScreen({ x: 0, y: 0 });
    ctx.strokeStyle = '#D6D2CB';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(origin.x - 15, origin.y); ctx.lineTo(origin.x + 15, origin.y);
    ctx.moveTo(origin.x, origin.y - 15); ctx.lineTo(origin.x, origin.y + 15);
    ctx.stroke();
  };

  PlanEditor.prototype.renderRooms = function (ctx) {
    var rooms = this.project.plan.rooms || [];
    for (var i = 0; i < rooms.length; i++) {
      var r = rooms[i];
      if (!r.polygon || r.polygon.length < 3) continue;

      var isSelected = this.isSelected('room', r.id);

      // Floor Fill
      ctx.fillStyle = isSelected ? 'rgba(37, 99, 235, 0.16)' : 'rgba(232, 241, 245, 0.45)';
      ctx.beginPath();
      var p0 = this.worldToScreen(r.polygon[0]);
      ctx.moveTo(p0.x, p0.y);
      for (var j = 1; j < r.polygon.length; j++) {
        var pj = this.worldToScreen(r.polygon[j]);
        ctx.lineTo(pj.x, pj.y);
      }
      ctx.closePath();
      ctx.fill();

      if (isSelected) {
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Room Center Label (guaranteed strictly within inner walls)
      var interiorPt = (Core.Vec2 && typeof Core.Vec2.interiorVisualCenter === 'function')
        ? Core.Vec2.interiorVisualCenter(r.polygon)
        : Core.Vec2.polygonCentroid(r.polygon);
      var cScreen = this.worldToScreen(interiorPt);

      var nameTxt = r.name || ('Room ' + (i + 1));
      var areaTxt = (r.areaSqM || 0).toFixed(1) + ' m²  ·  ' + Math.round(r.areaSqFt || 0) + ' sq ft';

      // Badge pill
      ctx.font = '600 13px "IBM Plex Sans", sans-serif';
      var nw = ctx.measureText(nameTxt).width;
      ctx.font = '500 11px "IBM Plex Mono", monospace';
      var aw = ctx.measureText(areaTxt).width;
      var bw = Math.max(nw, aw) + 24;
      var bh = 42;

      ctx.fillStyle = isSelected ? '#1e3a8a' : 'rgba(255, 255, 255, 0.94)';
      ctx.strokeStyle = isSelected ? '#3b82f6' : '#d1d5db';
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(cScreen.x - bw / 2, cScreen.y - bh / 2, bw, bh, 6);
      else ctx.rect(cScreen.x - bw / 2, cScreen.y - bh / 2, bw, bh);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isSelected ? '#ffffff' : '#1f2937';
      ctx.font = '700 13px "IBM Plex Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(nameTxt, cScreen.x, cScreen.y - 9);

      ctx.fillStyle = isSelected ? '#93c5fd' : '#4b5563';
      ctx.font = '500 10.5px "IBM Plex Mono", monospace';
      ctx.fillText(areaTxt, cScreen.x, cScreen.y + 9);
    }
  };

  PlanEditor.prototype.renderWalls = function (ctx) {
    var walls = this.project.plan.walls || [];
    var self = this;

    // Helper: find connected walls at a point (ignores virtual room dividers)
    var getConnected = function (pt, excludeId) {
      var res = [];
      if (!pt) return res;
      for (var j = 0; j < walls.length; j++) {
        var ow = walls[j];
        if (!ow || ow.id === excludeId) continue;
        if (ow.isDivider || ow.thickness === 0) continue;
        if (ow.start && Vec2.dist(pt, ow.start) < 60) res.push({ wall: ow, endpoint: 'start', pt: ow.start });
        else if (ow.end && Vec2.dist(pt, ow.end) < 60) res.push({ wall: ow, endpoint: 'end', pt: ow.end });
      }
      return res;
    };

    // ── PASS 1: Fill all wall polygons and corner junction quads (Architectural Slate Poche) ──
    for (var i = 0; i < walls.length; i++) {
      var w = walls[i];
      if (w.isDivider || w.thickness === 0) continue;
      var isSelected = this.isSelected('wall', w.id);
      var poly = Core.wallPolygon(w);
      if (!poly || poly.length < 4) continue;

      ctx.fillStyle = isSelected ? '#2563eb' : '#334155';
      ctx.beginPath();
      var sp0 = this.worldToScreen(poly[0]);
      ctx.moveTo(sp0.x, sp0.y);
      for (var p = 1; p < poly.length; p++) {
        var sp = this.worldToScreen(poly[p]);
        ctx.lineTo(sp.x, sp.y);
      }
      ctx.closePath();
      ctx.fill();

      // Fill L-corner junction miter quads where two walls meet
      var startConns = getConnected(w.start, w.id);
      for (var sc = 0; sc < startConns.length; sc++) {
        var otherW = startConns[sc].wall;
        if (otherW.isDivider || otherW.thickness === 0) continue;
        var oPoly = Core.wallPolygon(otherW);
        if (!oPoly || oPoly.length < 4) continue;
        var halfTW = (w.thickness || 150) / 2;
        var halfTO = (otherW.thickness || 150) / 2;
        var junctionPoly = [
          poly[0], poly[3],
          startConns[sc].endpoint === 'start' ? oPoly[3] : oPoly[2],
          startConns[sc].endpoint === 'start' ? oPoly[0] : oPoly[1]
        ];
        ctx.beginPath();
        var j0 = this.worldToScreen(junctionPoly[0]);
        ctx.moveTo(j0.x, j0.y);
        for (var jp = 1; jp < junctionPoly.length; jp++) {
          var jPt = this.worldToScreen(junctionPoly[jp]);
          ctx.lineTo(jPt.x, jPt.y);
        }
        ctx.closePath();
        ctx.fill();
      }
    }

    // ── PASS 2: Stroke Wall Outlines (Crisp Architectural Contours) ──
    for (var k = 0; k < walls.length; k++) {
      var wk = walls[k];
      if (wk.isDivider || wk.thickness === 0) continue;
      var isSelK = this.isSelected('wall', wk.id);
      var polyK = Core.wallPolygon(wk);
      if (!polyK || polyK.length < 4) continue;
      var startConnsK = getConnected(wk.start, wk.id);
      var endConnsK = getConnected(wk.end, wk.id);

      ctx.strokeStyle = isSelK ? '#3b82f6' : '#0f172a';
      ctx.lineWidth = isSelK ? 2.5 : 1.5;

      // Stroke Longitudinal Side 1 (p0 to p1)
      ctx.beginPath();
      var spK0 = this.worldToScreen(polyK[0]);
      var spK1 = this.worldToScreen(polyK[1]);
      ctx.moveTo(spK0.x, spK0.y);
      ctx.lineTo(spK1.x, spK1.y);
      ctx.stroke();

      // Stroke Longitudinal Side 2 (p2 to p3)
      ctx.beginPath();
      var spK2 = this.worldToScreen(polyK[2]);
      var spK3 = this.worldToScreen(polyK[3]);
      ctx.moveTo(spK2.x, spK2.y);
      ctx.lineTo(spK3.x, spK3.y);
      ctx.stroke();

      // End-Cap B (p1 to p2): ONLY stroke if this end is free/unconnected
      // If connected to another wall, suppressing the stroke links corners into a seamless L-joint!
      if (endConnsK.length === 0) {
        ctx.beginPath();
        ctx.moveTo(spK1.x, spK1.y);
        ctx.lineTo(spK2.x, spK2.y);
        ctx.stroke();
      } else {
        // Connect outer and inner corner lines across junction
        for (var ec = 0; ec < endConnsK.length; ec++) {
          var eW = endConnsK[ec].wall;
          if (!eW || eW.isDivider || eW.thickness === 0) continue;
          var ePoly = Core.wallPolygon(eW);
          if (!ePoly || ePoly.length < 4) continue;
          var eCornerA = (endConnsK[ec].endpoint === 'start') ? ePoly[0] : ePoly[1];
          var eCornerB = (endConnsK[ec].endpoint === 'start') ? ePoly[3] : ePoly[2];
          if (!eCornerA || !eCornerB) continue;

          // Connect closest outer pair and inner pair
          var d1 = Vec2.dist(polyK[1], eCornerA);
          var d2 = Vec2.dist(polyK[1], eCornerB);
          var pOuter = d1 < d2 ? eCornerA : eCornerB;
          var pInner = d1 < d2 ? eCornerB : eCornerA;

          ctx.beginPath();
          var spOuter = this.worldToScreen(pOuter);
          ctx.moveTo(spK1.x, spK1.y);
          ctx.lineTo(spOuter.x, spOuter.y);
          ctx.stroke();

          ctx.beginPath();
          var spInner = this.worldToScreen(pInner);
          ctx.moveTo(spK2.x, spK2.y);
          ctx.lineTo(spInner.x, spInner.y);
          ctx.stroke();
        }
      }

      // End-Cap A (p3 to p0): ONLY stroke if this start is free/unconnected
      if (startConnsK.length === 0) {
        ctx.beginPath();
        ctx.moveTo(spK3.x, spK3.y);
        ctx.lineTo(spK0.x, spK0.y);
        ctx.stroke();
      }

      // If selected or hovered, draw distance to parallel walls
      if (isSelK || (this.hoveredWallId === wk.id && (!this.selected || !this.selected.some(function(s){ return s.type === 'wall'; })))) {
        this.renderParallelWallDimensions(ctx, wk);
      }

      // If selected, draw handles at endpoints
      if (isSelK) {
        this.renderHandle(ctx, wk.start);
        this.renderHandle(ctx, wk.end);
      }
    }

    // ── PASS 3: Render Room Dividers (Architectural Dash-Dot Line with Purple Badges) ──
    for (var d = 0; d < walls.length; d++) {
      var div = walls[d];
      if (!div.isDivider) continue;
      var isDivSel = this.isSelected('wall', div.id);
      var pStart = this.worldToScreen(div.start);
      var pEnd = this.worldToScreen(div.end);

      ctx.save();
      if (isDivSel) {
        ctx.shadowColor = 'rgba(124, 58, 237, 0.45)';
        ctx.shadowBlur = 8;
      }
      ctx.beginPath();
      ctx.setLineDash([8, 5, 2, 5]); // Architectural dash-dot standard
      ctx.strokeStyle = isDivSel ? '#6D28D9' : '#8B5CF6';
      ctx.lineWidth = isDivSel ? 3.5 : 2;
      ctx.moveTo(pStart.x, pStart.y);
      ctx.lineTo(pEnd.x, pEnd.y);
      ctx.stroke();

      // End-point circle nodes
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;
      ctx.fillStyle = isDivSel ? '#6D28D9' : '#8B5CF6';
      ctx.beginPath();
      ctx.arc(pStart.x, pStart.y, isDivSel ? 4.5 : 3.5, 0, Math.PI * 2);
      ctx.arc(pEnd.x, pEnd.y, isDivSel ? 4.5 : 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Midpoint badge "✂ ROOM DIVIDER"
      var midX = (pStart.x + pEnd.x) / 2;
      var midY = (pStart.y + pEnd.y) / 2;
      var angle = Math.atan2(pEnd.y - pStart.y, pEnd.x - pStart.x);
      if (angle > Math.PI / 2 || angle < -Math.PI / 2) angle += Math.PI;

      ctx.translate(midX, midY);
      ctx.rotate(angle);
      var badgeText = '✂ ROOM DIVIDER';
      ctx.font = '700 9.5px "IBM Plex Sans", -apple-system, sans-serif';
      var tw = ctx.measureText(badgeText).width;
      ctx.fillStyle = isDivSel ? '#6D28D9' : '#7C3AED';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-tw / 2 - 7, -9, tw + 14, 18, 4);
      else ctx.rect(-tw / 2 - 7, -9, tw + 14, 18);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, 0, 0);

      ctx.restore();

      // If selected, draw handles at endpoints
      if (isDivSel) {
        this.renderHandle(ctx, div.start);
        this.renderHandle(ctx, div.end);
      }
    }
  };

  PlanEditor.prototype.renderLockBadge = function (ctx, w, cornerLabel) {
    var dir = Core.wallDirection(w);
    var baseNorm = Core.wallNormal(w);
    var halfT = (w.thickness || 150) / 2;

    // Detect exterior normal away from room interior so badge sits outside
    var extNorm = baseNorm;
    var rooms = (this.project && this.project.plan && this.project.plan.rooms) || [];
    if (rooms.length > 0) {
      var midW = { x: (w.start.x + w.end.x) / 2, y: (w.start.y + w.end.y) / 2 };
      var testPos = { x: midW.x + baseNorm.x * 120, y: midW.y + baseNorm.y * 120 };
      var inside = false;
      for (var r = 0; r < rooms.length; r++) {
        if (rooms[r].polygon && Core.Vec2.pointInPolygon(testPos, rooms[r].polygon)) {
          inside = true;
          break;
        }
      }
      if (inside) extNorm = { x: -baseNorm.x, y: -baseNorm.y };
    }

    var isCornerA = (cornerLabel === 'A');
    var isLocked = isCornerA ? (w.startLocked !== false) : (w.endLocked !== false);
    var pt = isCornerA ? w.start : w.end;
    var alongSign = isCornerA ? -1 : 1;

    // Screen-space placement offset so badge stays readable and clear of vertex handle at any zoom
    var sPt = this.worldToScreen(pt);
    var badgeScreenX = sPt.x + extNorm.x * 32 + alongSign * dir.x * 12;
    var badgeScreenY = sPt.y + extNorm.y * 32 + alongSign * dir.y * 12;
    var badgeWorld = this.screenToWorld({ x: badgeScreenX, y: badgeScreenY });

    w._badgeBounds = w._badgeBounds || {};
    var isHovered = false;
    if (this.lastMouseScreen) {
      isHovered = (Math.hypot(this.lastMouseScreen.x - badgeScreenX, this.lastMouseScreen.y - badgeScreenY) < 24);
    }
    w._badgeBounds[cornerLabel] = {
      x: badgeScreenX,
      y: badgeScreenY,
      world: badgeWorld,
      r: 22,
      isLocked: isLocked,
      isHovered: isHovered
    };

    ctx.save();
    var bw = 46, bh = 24;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(badgeScreenX - bw / 2, badgeScreenY - bh / 2, bw, bh, 12);
    else ctx.rect(badgeScreenX - bw / 2, badgeScreenY - bh / 2, bw, bh);

    if (isHovered) {
      ctx.fillStyle = isLocked ? '#dbeafe' : '#ffe4e6';
      ctx.strokeStyle = isLocked ? '#1d4ed8' : '#be123c';
      ctx.lineWidth = 2;
    } else {
      ctx.fillStyle = isLocked ? '#ffffff' : '#fff1f2';
      ctx.strokeStyle = isLocked ? '#64748b' : '#f43f5e';
      ctx.lineWidth = 1.5;
    }
    ctx.fill();
    ctx.stroke();

    // Vector CAD Padlock at (badgeScreenX - 9, badgeScreenY)
    var lcx = badgeScreenX - 9;
    var lcy = badgeScreenY + 1;
    var bodyW = 11, bodyH = 8;
    var shackleW = 7, shackleH = 6;
    var lockStroke = isLocked ? (isHovered ? '#1d4ed8' : '#334155') : (isHovered ? '#be123c' : '#e11d48');
    var lockFill = isLocked ? (isHovered ? '#2563eb' : '#475569') : (isHovered ? '#dc2626' : '#ef4444');

    // Draw Shackle
    ctx.strokeStyle = lockStroke;
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (isLocked) {
      // Closed arched shackle
      var lx = lcx - shackleW / 2;
      var rx = lcx + shackleW / 2;
      var by = lcy - bodyH / 2;
      var ty = by - shackleH;
      ctx.moveTo(lx, by);
      ctx.lineTo(lx, ty + 3);
      ctx.arc(lcx, ty + 3, shackleW / 2, Math.PI, 0, false);
      ctx.lineTo(rx, by);
    } else {
      // Open shackle swinging open to the left (matching CAD reference)
      var rx2 = lcx + shackleW / 2;
      var by2 = lcy - bodyH / 2;
      var ty2 = by2 - shackleH - 1;
      ctx.moveTo(rx2, by2);
      ctx.lineTo(rx2, ty2 + 3);
      ctx.arc(lcx + 1.5, ty2 + 3, shackleW / 2, 0, Math.PI, true);
      ctx.lineTo(lcx - shackleW / 2 - 3, ty2);
    }
    ctx.stroke();

    // Draw Lock Body
    ctx.fillStyle = lockFill;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(lcx - bodyW / 2, lcy - bodyH / 2, bodyW, bodyH, 2);
    else ctx.rect(lcx - bodyW / 2, lcy - bodyH / 2, bodyW, bodyH);
    ctx.fill();

    // Keyhole
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(lcx, lcy - 1, 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(lcx - 0.5, lcy - 1, 1, 2.5);

    // Letter A or B
    ctx.font = '700 13px "IBM Plex Sans", -apple-system, sans-serif';
    ctx.fillStyle = isLocked ? (isHovered ? '#1d4ed8' : '#0f172a') : (isHovered ? '#be123c' : '#9f1239');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cornerLabel, badgeScreenX + 11, badgeScreenY);
    ctx.restore();
  };

  PlanEditor.prototype.renderParallelWallDimensions = function (ctx, w) {
    var allWalls = (this.project && this.project.plan && this.project.plan.walls) || [];
    if (allWalls.length < 2 || this.zoom < 0.03) return;

    var wDir = Core.wallDirection(w);
    var wNorm = Core.wallNormal(w);
    var wLen = Core.wallLength(w);
    var halfT = (w.thickness || 150) / 2;

    var candidatesPos = [];
    var candidatesNeg = [];

    for (var i = 0; i < allWalls.length; i++) {
      var ow = allWalls[i];
      if (ow.id === w.id) continue;

      var owDir = Core.wallDirection(ow);
      // Parallel cross product check
      var cross = Math.abs(wDir.x * owDir.y - wDir.y * owDir.x);
      if (cross > 0.08) continue;

      // Project ow onto wDir
      var tStart = (ow.start.x - w.start.x) * wDir.x + (ow.start.y - w.start.y) * wDir.y;
      var tEnd = (ow.end.x - w.start.x) * wDir.x + (ow.end.y - w.start.y) * wDir.y;
      var tMin = Math.min(tStart, tEnd);
      var tMax = Math.max(tStart, tEnd);

      var overlapStart = Math.max(0, tMin);
      var overlapEnd = Math.min(wLen, tMax);
      if (overlapEnd - overlapStart < 80) continue;

      // Perpendicular signed distance
      var perp = (ow.start.x - w.start.x) * wNorm.x + (ow.start.y - w.start.y) * wNorm.y;
      if (Math.abs(perp) < 25) continue;

      var owHalfT = (ow.thickness || 150) / 2;
      var clearDist = Math.abs(perp) - halfT - owHalfT;
      if (clearDist < 10) continue;

      var item = {
        wall: ow,
        perp: perp,
        clearDist: clearDist,
        overlapStart: overlapStart,
        overlapEnd: overlapEnd
      };

      if (perp > 0) candidatesPos.push(item);
      else candidatesNeg.push(item);
    }

    var targets = [];
    if (candidatesPos.length > 0) {
      candidatesPos.sort(function (a, b) { return a.clearDist - b.clearDist; });
      targets.push(candidatesPos[0]);
    }
    if (candidatesNeg.length > 0) {
      candidatesNeg.sort(function (a, b) { return a.clearDist - b.clearDist; });
      targets.push(candidatesNeg[0]);
    }

    for (var t = 0; t < targets.length; t++) {
      var cand = targets[t];
      var sideSign = cand.perp > 0 ? 1 : -1;
      var midT = (cand.overlapStart + cand.overlapEnd) / 2;

      var pStartWorld = {
        x: w.start.x + wDir.x * midT + wNorm.x * (sideSign * halfT),
        y: w.start.y + wDir.y * midT + wNorm.y * (sideSign * halfT)
      };
      var pEndWorld = {
        x: pStartWorld.x + wNorm.x * (sideSign * cand.clearDist),
        y: pStartWorld.y + wNorm.y * (sideSign * cand.clearDist)
      };

      var sStart = this.worldToScreen(pStartWorld);
      var sEnd = this.worldToScreen(pEndWorld);

      ctx.save();
      // Perpendicular dimension line
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sStart.x, sStart.y);
      ctx.lineTo(sEnd.x, sEnd.y);
      ctx.stroke();

      // Circular terminal dots on wall faces
      ctx.fillStyle = '#1d4ed8';
      ctx.beginPath();
      ctx.arc(sStart.x, sStart.y, 4, 0, Math.PI * 2);
      ctx.arc(sEnd.x, sEnd.y, 4, 0, Math.PI * 2);
      ctx.fill();

      // Dimension text pill
      var midScreen = { x: (sStart.x + sEnd.x) / 2, y: (sStart.y + sEnd.y) / 2 };
      var distText = Math.round(cand.clearDist).toString();
      var angle = Math.atan2(sEnd.y - sStart.y, sEnd.x - sStart.x);
      if (angle > Math.PI / 2) angle -= Math.PI;
      else if (angle < -Math.PI / 2) angle += Math.PI;

      ctx.translate(midScreen.x, midScreen.y);
      ctx.rotate(angle);
      ctx.font = '700 12px "IBM Plex Mono", monospace';
      var tw = ctx.measureText(distText).width;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-tw / 2 - 5, -9, tw + 10, 18);
      ctx.fillStyle = '#1d4ed8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(distText, 0, 0);
      ctx.restore();
    }
  };

  PlanEditor.prototype.renderCornerAngles = function (ctx) {
    var walls = (this.project && this.project.plan && this.project.plan.walls) || [];
    if (walls.length < 2 || this.zoom < 0.03) return;

    // Only render corner angle arcs when actively drawing walls or when a wall is selected or hovered
    var isDrawingWall = (this.activeTool === 'wall' || this.isDrawing || !!this.wallChainStart);
    var isAnyWallSelected = (this.selected && this.selected.some(function (s) { return s.type === 'wall'; }));
    var isWallHovered = !!this.hoveredWallId;
    if (!isDrawingWall && !isAnyWallSelected && !isWallHovered) return;

    var joints = [];
    for (var i = 0; i < walls.length; i++) {
      var w = walls[i];
      var ends = [w.start, w.end];
      for (var e = 0; e < 2; e++) {
        var pt = ends[e];
        var found = null;
        for (var j = 0; j < joints.length; j++) {
          if (Vec2.dist(pt, joints[j].pt) < 30) {
            found = joints[j];
            break;
          }
        }
        if (!found) {
          found = { pt: pt, walls: [] };
          joints.push(found);
        }
        if (found.walls.indexOf(w) === -1) {
          found.walls.push(w);
        }
      }
    }

    for (var k = 0; k < joints.length; k++) {
      var jnt = joints[k];
      if (jnt.walls.length >= 2) {
        for (var a = 0; a < jnt.walls.length; a++) {
          for (var b = a + 1; b < jnt.walls.length; b++) {
            var w1 = jnt.walls[a];
            var w2 = jnt.walls[b];
            var deg = Core.calculateCornerAngle(w1, w2, jnt.pt);
            if (deg >= 20 && deg <= 165) {
              this.renderCornerAngleBadge(ctx, w1, w2, jnt.pt, deg);
            }
          }
        }
      }
    }
  };

  PlanEditor.prototype.renderCornerAngleBadge = function (ctx, w1, w2, jointPt, deg) {
    var sJnt = this.worldToScreen(jointPt);

    var d1s = Vec2.dist(w1.start, jointPt);
    var p1 = d1s < 25 ? w1.end : w1.start;
    var v1 = { x: p1.x - jointPt.x, y: p1.y - jointPt.y };
    var l1 = Math.hypot(v1.x, v1.y) || 1;
    v1.x /= l1; v1.y /= l1;

    var d2s = Vec2.dist(w2.start, jointPt);
    var p2 = d2s < 25 ? w2.end : w2.start;
    var v2 = { x: p2.x - jointPt.x, y: p2.y - jointPt.y };
    var l2 = Math.hypot(v2.x, v2.y) || 1;
    v2.x /= l2; v2.y /= l2;

    var a1 = Math.atan2(v1.y, v1.x);
    var a2 = Math.atan2(v2.y, v2.x);

    var midV = { x: v1.x + v2.x, y: v1.y + v2.y };
    var midL = Math.hypot(midV.x, midV.y);
    if (midL > 1e-4) {
      midV.x /= midL; midV.y /= midL;
    } else {
      midV = { x: -v1.y, y: v1.x };
    }

    ctx.save();
    var arcR = Math.max(16, 260 * this.zoom);

    // Terminal dots on the wall inner faces
    var pDot1 = { x: sJnt.x + v1.x * arcR, y: sJnt.y + v1.y * arcR };
    var pDot2 = { x: sJnt.x + v2.x * arcR, y: sJnt.y + v2.y * arcR };

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(pDot1.x, pDot1.y, 2.5, 0, Math.PI * 2);
    ctx.arc(pDot2.x, pDot2.y, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Arc connecting the dots
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    var diff = a2 - a1;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    ctx.arc(sJnt.x, sJnt.y, arcR, a1, a2, diff < 0);
    ctx.stroke();

    var badgeDist = arcR * 0.72 + 8;
    var sBadge = { x: sJnt.x + midV.x * badgeDist, y: sJnt.y + midV.y * badgeDist };
    var degTxt = deg + '°';
    ctx.font = '700 11px "IBM Plex Sans", monospace';
    ctx.fillStyle = '#1e3a8a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(degTxt, sBadge.x, sBadge.y);
    ctx.restore();
  };

  PlanEditor.prototype.renderSingleOpening = function (ctx, op, w, isGhost) {
    var isSelected = !isGhost && this.isSelected('opening', op.id);
    var wDir = Core.wallDirection(w);
    var wNorm = Core.wallNormal(w);
    var halfW = op.width / 2;

    var wLen = Core.wallLength(w);
    var safeOffset = Math.max(halfW, Math.min(wLen - halfW, op.offset));
    var centerPt = { x: w.start.x + wDir.x * safeOffset, y: w.start.y + wDir.y * safeOffset };
    var opStart = { x: centerPt.x - wDir.x * halfW, y: centerPt.y - wDir.y * halfW };
    var opEnd = { x: centerPt.x + wDir.x * halfW, y: centerPt.y + wDir.y * halfW };

    var sStart = this.worldToScreen(opStart);
    var sEnd = this.worldToScreen(opEnd);
    var sCenter = this.worldToScreen(centerPt);

    // Clear the wall thickness cutout for opening
    ctx.fillStyle = '#FBFAF8';
    var halfT = (w.thickness || 150) / 2;
    var c1 = this.worldToScreen({ x: opStart.x + wNorm.x * halfT, y: opStart.y + wNorm.y * halfT });
    var c2 = this.worldToScreen({ x: opEnd.x + wNorm.x * halfT, y: opEnd.y + wNorm.y * halfT });
    var c3 = this.worldToScreen({ x: opEnd.x - wNorm.x * halfT, y: opEnd.y - wNorm.y * halfT });
    var c4 = this.worldToScreen({ x: opStart.x - wNorm.x * halfT, y: opStart.y - wNorm.y * halfT });

    ctx.beginPath();
    ctx.moveTo(c1.x, c1.y); ctx.lineTo(c2.x, c2.y); ctx.lineTo(c3.x, c3.y); ctx.lineTo(c4.x, c4.y);
    ctx.closePath();
    ctx.fill();

    if (isGhost) {
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    if (op.type === 'door') {
      // Draw Door Swing Arc (Inward Left, Inward Right, Outward Left, Outward Right)
      var swing = op.swing || 'in-left';
      var isRight = swing.indexOf('right') !== -1;
      var isOut = swing.indexOf('out') !== -1;

      var hingePt = isRight ? opEnd : opStart;
      var sHinge = isRight ? sEnd : sStart;
      var swingRadiusPx = op.width * this.zoom;

      var normDir = isOut ? { x: -wNorm.x, y: -wNorm.y } : { x: wNorm.x, y: wNorm.y };
      var leafDir = isRight ? { x: -wDir.x, y: -wDir.y } : { x: wDir.x, y: wDir.y };

      var leafEndWorld = { x: hingePt.x + normDir.x * op.width, y: hingePt.y + normDir.y * op.width };
      var sLeaf = this.worldToScreen(leafEndWorld);

      ctx.strokeStyle = isSelected ? '#1B4F72' : (isGhost ? '#0284c7' : '#2E7BB5');
      ctx.lineWidth = isSelected ? 2 : 1.5;

      // Swing leaf line (door slab)
      ctx.beginPath();
      ctx.moveTo(sHinge.x, sHinge.y);
      ctx.lineTo(sLeaf.x, sLeaf.y);
      ctx.stroke();

      // Dotted quarter arc from closed position along wall to open leaf
      var startAngle = Math.atan2(leafDir.y, leafDir.x);
      var endAngle = Math.atan2(normDir.y, normDir.x);
      var diff = endAngle - startAngle;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;

      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(sHinge.x, sHinge.y, swingRadiusPx, startAngle, endAngle, diff < 0);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      // Draw Window Double Line Symbol
      ctx.strokeStyle = isSelected ? '#1B4F72' : (isGhost ? '#0284c7' : '#2E7BB5');
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sStart.x, sStart.y); ctx.lineTo(sEnd.x, sEnd.y);
      ctx.stroke();

      var g1 = this.worldToScreen({ x: opStart.x + wNorm.x * (halfT / 2), y: opStart.y + wNorm.y * (halfT / 2) });
      var g2 = this.worldToScreen({ x: opEnd.x + wNorm.x * (halfT / 2), y: opEnd.y + wNorm.y * (halfT / 2) });
      ctx.strokeStyle = isGhost ? '#0284c7' : '#8EADC4';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(g1.x, g1.y); ctx.lineTo(g2.x, g2.y);
      ctx.stroke();
    }

    // Label
    ctx.fillStyle = isSelected ? '#1B4F72' : (isGhost ? '#0284c7' : '#2E7BB5');
    ctx.font = '600 10px "IBM Plex Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText((op.type === 'door' ? 'D ' : 'W ') + this.formatDim(op.width), sCenter.x, sCenter.y - 12);
  };

  PlanEditor.prototype.renderOpenings = function (ctx) {
    var openings = this.project.plan.openings || [];
    for (var i = 0; i < openings.length; i++) {
      var op = openings[i];
      var w = this.getWall(op.wallId);
      if (!w) continue;
      this.renderSingleOpening(ctx, op, w, false);
    }
  };

  // Architectural Segmented Dimensions & Extension Witness Lines (Corners A & B, Direction Arrows 1 & 2)
  PlanEditor.prototype.renderWallDimensions = function (ctx, w, isSelected, options) {
    options = options || {};
    var lMm = Core.wallLength(w);
    if (lMm < 150) return;

    var wallOpenings = [];
    var allOpenings = (this.project && this.project.plan && this.project.plan.openings) || [];
    for (var oi = 0; oi < allOpenings.length; oi++) {
      if (allOpenings[oi].wallId === w.id) {
        if (options.previewOpening && options.previewOpening.id === allOpenings[oi].id) {
          wallOpenings.push(options.previewOpening);
        } else {
          wallOpenings.push(allOpenings[oi]);
        }
      }
    }
    if (options.previewOpening && (!options.previewOpening.id || !wallOpenings.some(function (o) { return o.id === options.previewOpening.id; }))) {
      wallOpenings.push(options.previewOpening);
    }

    var hasSelectedOpening = false;
    for (var so = 0; so < wallOpenings.length; so++) {
      if (this.isSelected('opening', wallOpenings[so].id) || (options.activeOpeningId === wallOpenings[so].id)) {
        hasSelectedOpening = true;
        break;
      }
    }
    var isActive = isSelected || hasSelectedOpening || !!options.previewOpening;

    // Zoom LOD (Level of Detail):
    // When zoomed out (< 0.055), hide dimension pills, lines and witness lines for unselected walls to keep plan clean & uncluttered!
    if (this.zoom < 0.055 && !isActive) return;

    var wDir = Core.wallDirection(w);
    var baseNorm = Core.wallNormal(w);
    var norm = baseNorm;

    // Detect exterior normal side away from room interior so dimensions sit outside
    var rooms = (this.project && this.project.plan && this.project.plan.rooms) || [];
    if (rooms.length > 0) {
      var midW = { x: (w.start.x + w.end.x) / 2, y: (w.start.y + w.end.y) / 2 };
      var testPos = { x: midW.x + baseNorm.x * 120, y: midW.y + baseNorm.y * 120 };
      var testNeg = { x: midW.x - baseNorm.x * 120, y: midW.y - baseNorm.y * 120 };
      var posInside = false, negInside = false;
      for (var r = 0; r < rooms.length; r++) {
        if (rooms[r].polygon && Core.Vec2.pointInPolygon(testPos, rooms[r].polygon)) posInside = true;
        if (rooms[r].polygon && Core.Vec2.pointInPolygon(testNeg, rooms[r].polygon)) negInside = true;
      }
      if (posInside && !negInside) {
        norm = { x: -baseNorm.x, y: -baseNorm.y };
      }
    }

    var halfT = (w.thickness || 150) / 2;
    var dimOffset = halfT + 220; // offset in world mm from wall center

    var wallAngle = Math.atan2(w.end.y - w.start.y, w.end.x - w.start.x);
    var textAngle = wallAngle;
    if (textAngle > Math.PI / 2) textAngle -= Math.PI;
    else if (textAngle < -Math.PI / 2) textAngle += Math.PI;

    var strokeColor = isActive ? '#2563eb' : '#64748b';
    var textColor = isActive ? '#1d4ed8' : '#0f172a';
    var dotColor = isActive ? '#1d4ed8' : '#64748b';

    var self = this;

    // Helper: Draw bold endpoint letter A or B near corners
    var drawCornerLabel = function (worldPt, label, alongSign) {
      var sPos = self.worldToScreen({
        x: worldPt.x + alongSign * wDir.x * 60 + norm.x * (halfT + 40),
        y: worldPt.y + alongSign * wDir.y * 60 + norm.y * (halfT + 40)
      });
      ctx.save();
      ctx.font = '700 15px "IBM Plex Sans", -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
      ctx.strokeText(label, sPos.x, sPos.y);
      ctx.fillStyle = '#1e3a8a';
      ctx.fillText(label, sPos.x, sPos.y);
      ctx.restore();
    };

    // Helper: Draw directional arrow inside wall core with segment digit 1 or 2
    var drawCoreArrow = function (startT, endT, dirToward, digitLabel) {
      var segLen = Math.abs(endT - startT);
      if (segLen < 160) return;
      var midT = (startT + endT) / 2;
      var midW = { x: w.start.x + wDir.x * midT, y: w.start.y + wDir.y * midT };

      var ax = dirToward === 'A' ? -wDir.x : wDir.x;
      var ay = dirToward === 'A' ? -wDir.y : wDir.y;
      var anX = -ay, anY = ax;

      ctx.save();
      var pStart = self.worldToScreen({ x: midW.x - ax * 60, y: midW.y - ay * 60 });
      var pTip = self.worldToScreen({ x: midW.x + ax * 60, y: midW.y + ay * 60 });
      ctx.strokeStyle = isActive ? '#2563eb' : 'rgba(100, 116, 139, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(pStart.x, pStart.y);
      ctx.lineTo(pTip.x, pTip.y);
      ctx.stroke();

      var arrowHeadSize = 8;
      ctx.fillStyle = isActive ? '#2563eb' : '#64748b';
      ctx.beginPath();
      ctx.moveTo(pTip.x, pTip.y);
      ctx.lineTo(pTip.x - ax * arrowHeadSize + anX * (arrowHeadSize * 0.6), pTip.y - ay * arrowHeadSize + anY * (arrowHeadSize * 0.6));
      ctx.lineTo(pTip.x - ax * (arrowHeadSize * 0.6), pTip.y - ay * (arrowHeadSize * 0.6));
      ctx.lineTo(pTip.x - ax * arrowHeadSize - anX * (arrowHeadSize * 0.6), pTip.y - ay * arrowHeadSize - anY * (arrowHeadSize * 0.6));
      ctx.closePath();
      ctx.fill();

      var digitScreen = self.worldToScreen({ x: midW.x - ax * 20, y: midW.y - ay * 20 });
      ctx.font = '700 13px "IBM Plex Sans", -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
      ctx.strokeText(digitLabel, digitScreen.x, digitScreen.y);
      ctx.fillStyle = '#1e3a8a';
      ctx.fillText(digitLabel, digitScreen.x, digitScreen.y);
      ctx.restore();
    };

    // Helper: Draw dimension text pill on screen with crisp, high-contrast typography
    var drawDimPill = function (midX, midY, text) {
      ctx.save();
      ctx.translate(midX, midY);
      ctx.rotate(textAngle);
      ctx.font = isActive ? '700 12.5px "IBM Plex Sans", -apple-system, sans-serif' : '700 11.5px "IBM Plex Sans", -apple-system, sans-serif';
      var tw = ctx.measureText(text).width;
      var th = 20;
      var pw = tw + 16;
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = isActive ? '#2563eb' : '#64748b';
      ctx.lineWidth = isActive ? 1.5 : 1.2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-pw / 2, -th / 2, pw, th, 4);
      else ctx.rect(-pw / 2, -th / 2, pw, th);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = textColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 0, 0);
      ctx.restore();
    };

    // Case 1: Wall with NO openings
    if (wallOpenings.length === 0) {
      // Calculate clear inner dimension between adjoining plaster faces
      var planObj = this.project && this.project.plan;
      var innerMm = (Core.getWallInnerLength ? Core.getWallInnerLength(w, planObj) : lMm);
      var innerSeg = (Core.getWallInnerSegment ? Core.getWallInnerSegment(w, planObj) : null);
      var hasAdjoining = innerSeg && (innerSeg.startDeduction > 10 || innerSeg.endDeduction > 10);
      var ptStart = hasAdjoining ? innerSeg.start : w.start;
      var ptEnd = hasAdjoining ? innerSeg.end : w.end;

      var dsWorld = { x: ptStart.x + norm.x * dimOffset, y: ptStart.y + norm.y * dimOffset };
      var deWorld = { x: ptEnd.x + norm.x * dimOffset, y: ptEnd.y + norm.y * dimOffset };
      var sDs = this.worldToScreen(dsWorld);
      var sDe = this.worldToScreen(deWorld);

      // Extension witness lines originating directly from inner plaster corner faces
      var wsOff = this.worldToScreen({ x: ptStart.x + norm.x * (halfT + 15), y: ptStart.y + norm.y * (halfT + 15) });
      var weOff = this.worldToScreen({ x: ptEnd.x + norm.x * (halfT + 15), y: ptEnd.y + norm.y * (halfT + 15) });
      var dsExt = this.worldToScreen({ x: dsWorld.x + norm.x * 45, y: dsWorld.y + norm.y * 45 });
      var deExt = this.worldToScreen({ x: deWorld.x + norm.x * 45, y: deWorld.y + norm.y * 45 });

      ctx.save();
      ctx.strokeStyle = isActive ? '#2563eb' : 'rgba(100, 116, 139, 0.6)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(wsOff.x, wsOff.y); ctx.lineTo(dsExt.x, dsExt.y);
      ctx.moveTo(weOff.x, weOff.y); ctx.lineTo(deExt.x, deExt.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Main dimension line
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = isActive ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(sDs.x, sDs.y);
      ctx.lineTo(sDe.x, sDe.y);
      ctx.stroke();

      // Circular dots at endpoints
      ctx.fillStyle = dotColor;
      ctx.beginPath();
      ctx.arc(sDs.x, sDs.y, 3.5, 0, Math.PI * 2);
      ctx.arc(sDe.x, sDe.y, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Dimension text pill - Displays Clear Inner Span (e.g. 5'-0" [Inner])
      var midX = (sDs.x + sDe.x) / 2;
      var midY = (sDs.y + sDe.y) / 2;
      var dimText = hasAdjoining ?
        (this.formatDim(innerMm) + ' [Inner]') :
        this.formatDim(lMm);
      drawDimPill(midX, midY, dimText);

      // If opening is actively placed or selected on this wall, show Corner A, Corner B, and Arrow 1
      if (hasSelectedOpening || !!options.previewOpening) {
        drawCornerLabel(w.start, 'A', -1);
        drawCornerLabel(w.end, 'B', 1);
        drawCoreArrow(0, lMm, 'A', '1');
      }
      ctx.restore();
      return;
    }

    // Case 2: Wall WITH openings — Segmented architectural dimension chain
    wallOpenings.sort(function (a, b) { return a.offset - b.offset; });

    // Build ordered list of division offsets: 0 (Corner A), [start, end for each opening], lMm (Corner B)
    var divs = [0];
    for (var o = 0; o < wallOpenings.length; o++) {
      var op = wallOpenings[o];
      var halfW = op.width / 2;
      var safeOff = Math.max(halfW, Math.min(lMm - halfW, op.offset));
      var tStart = Math.max(0, safeOff - halfW);
      var tEnd = Math.min(lMm, safeOff + halfW);
      divs.push(tStart);
      divs.push(tEnd);
    }
    divs.push(lMm);

    // Sort and remove duplicates / near duplicates
    divs.sort(function (a, b) { return a - b; });
    var cleanDivs = [divs[0]];
    for (var d = 1; d < divs.length; d++) {
      if (divs[d] - cleanDivs[cleanDivs.length - 1] > 1) {
        cleanDivs.push(divs[d]);
      }
    }

    ctx.save();

    // 1. Extension lines and dimension points
    var sDimPts = [];
    ctx.strokeStyle = isActive ? '#2563eb' : 'rgba(100, 116, 139, 0.6)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();

    for (var i = 0; i < cleanDivs.length; i++) {
      var t = cleanDivs[i];
      var ptWall = { x: w.start.x + wDir.x * t, y: w.start.y + wDir.y * t };
      var ptDim = { x: ptWall.x + norm.x * dimOffset, y: ptWall.y + norm.y * dimOffset };
      var ptExtStart = { x: ptWall.x + norm.x * (halfT + 15), y: ptWall.y + norm.y * (halfT + 15) };
      var ptExtEnd = { x: ptDim.x + norm.x * 45, y: ptDim.y + norm.y * 45 };

      var sStart = this.worldToScreen(ptExtStart);
      var sEnd = this.worldToScreen(ptExtEnd);
      var sDim = this.worldToScreen(ptDim);
      sDimPts.push(sDim);

      ctx.moveTo(sStart.x, sStart.y);
      ctx.lineTo(sEnd.x, sEnd.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // 2. Continuous dimension line connecting all points
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = isActive ? 1.5 : 1;
    ctx.beginPath();
    ctx.moveTo(sDimPts[0].x, sDimPts[0].y);
    for (var j = 1; j < sDimPts.length; j++) {
      ctx.lineTo(sDimPts[j].x, sDimPts[j].y);
    }
    ctx.stroke();

    // 3. Circular dots at all witness intersections
    ctx.fillStyle = dotColor;
    ctx.beginPath();
    for (var k = 0; k < sDimPts.length; k++) {
      ctx.moveTo(sDimPts[k].x + 3.5, sDimPts[k].y);
      ctx.arc(sDimPts[k].x, sDimPts[k].y, 3.5, 0, Math.PI * 2);
    }
    ctx.fill();

    // 4. Segment dimension numbers
    for (var s = 0; s < cleanDivs.length - 1; s++) {
      var segLen = cleanDivs[s + 1] - cleanDivs[s];
      if (segLen > 40) {
        var p1 = sDimPts[s];
        var p2 = sDimPts[s + 1];
        var segMidX = (p1.x + p2.x) / 2;
        var segMidY = (p1.y + p2.y) / 2;
        var segText = (this.unitSystem === 'imperial') ? this.formatDim(segLen) : String(Math.round(segLen));
        drawDimPill(segMidX, segMidY, segText);
      }
    }

    // 5. Corner Labels A and B, plus Direction Arrows 1 and 2 ONLY when editing openings
    if (hasSelectedOpening || !!options.previewOpening) {
      drawCornerLabel(w.start, 'A', -1);
      drawCornerLabel(w.end, 'B', 1);
      // Direction arrow 1 in Segment 1 (start to first opening start)
      var firstOpStartT = cleanDivs.length > 2 ? cleanDivs[1] : 0;
      drawCoreArrow(0, firstOpStartT, 'A', '1');

      // Direction arrow 2 in Segment 2 (last opening end to end B)
      var lastOpEndT = cleanDivs.length > 2 ? cleanDivs[cleanDivs.length - 2] : lMm;
      drawCoreArrow(lastOpEndT, lMm, 'B', '2');
    }

    ctx.restore();
  };

  PlanEditor.prototype.renderAllWallDimensions = function (ctx) {
    var walls = this.project.plan.walls || [];
    for (var i = 0; i < walls.length; i++) {
      var w = walls[i];
      var isSelected = this.isSelected('wall', w.id);
      this.renderWallDimensions(ctx, w, isSelected);
    }
  };

  PlanEditor.prototype.renderFurniture = function (ctx) {
    var furnList = this.project.plan.furniture || [];
    for (var i = 0; i < furnList.length; i++) {
      var f = furnList[i];
      var isSelected = this.isSelected('furniture', f.id);
      var wMm = (f.dimensions && f.dimensions.W) || 1200;
      var dMm = (f.dimensions && f.dimensions.D) || 600;
      var wPx = wMm * this.zoom;
      var dPx = dMm * this.zoom;
      var sPos = this.worldToScreen(f.pos);

      var isColliding = (this.dragState && this.dragState.type === 'move_furniture' && this.dragState.hasCollision &&
        (this.dragState.furniture.id === f.id || (this.dragState.collidedWith && this.dragState.collidedWith.id === f.id)));

      ctx.save();
      ctx.translate(sPos.x, sPos.y);
      ctx.rotate(f.rotY || 0);

      // Check if L-shaped corner base unit
      var isLCorner = !!(
        (f.unitConfig && (f.unitConfig.geometryType === 'l_shaped_corner' || f.unitConfig.unitType === 'fbcm' || (f.unitConfig.corner && f.unitConfig.corner.enabled))) ||
        f.catalogItemId === 'fbcm' || f.id === 'fbcm' || f.id === 'f_fbcm_1' ||
        (f.id && /fbcm/i.test(f.id)) ||
        (f.name && /l[-_ ]*shaped.*corner/i.test(f.name))
      );

      // Furniture body boundary (Red if colliding!)
      var isDecor = !!(f.isDecor || f.excludeFromPricing || f.category === 'decor' || f.category === 'appliance_decor');

      if (isLCorner) {
        var cW = (f.unitConfig && f.unitConfig.corner && f.unitConfig.corner.legW) || 900;
        var cD = (f.unitConfig && f.unitConfig.corner && f.unitConfig.corner.legD) || 900;
        var cDepth = (f.unitConfig && f.unitConfig.corner && f.unitConfig.corner.depth) || 560;
        var cwPx = cW * this.zoom;
        var cdPx = cD * this.zoom;
        var depthPx = cDepth * this.zoom;

        if (isColliding) {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
          ctx.strokeStyle = '#dc2626';
          ctx.lineWidth = 2.5;
        } else {
          ctx.fillStyle = isSelected ? 'rgba(46, 123, 181, 0.22)' : 'rgba(110, 78, 53, 0.12)';
          ctx.strokeStyle = isSelected ? '#1B4F72' : '#6E4E35';
          ctx.lineWidth = isSelected ? 2 : 1.2;
        }

        // 6-vertex L-shaped polygon
        ctx.beginPath();
        ctx.moveTo(-cwPx / 2, -cdPx / 2);
        ctx.lineTo(cwPx / 2, -cdPx / 2);
        ctx.lineTo(cwPx / 2, cdPx / 2);
        ctx.lineTo(cwPx / 2 - depthPx, cdPx / 2);
        ctx.lineTo(cwPx / 2 - depthPx, -cdPx / 2 + depthPx);
        ctx.lineTo(-cwPx / 2, -cdPx / 2 + depthPx);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Inside corner shutter front edges (Door 1 & Door 2)
        ctx.strokeStyle = isColliding ? '#dc2626' : (isSelected ? '#2563eb' : '#92400e');
        ctx.lineWidth = isSelected || isColliding ? 3.5 : 2.5;
        ctx.beginPath();
        ctx.moveTo(-cwPx / 2, -cdPx / 2 + depthPx);
        ctx.lineTo(cwPx / 2 - depthPx, -cdPx / 2 + depthPx);
        ctx.lineTo(cwPx / 2 - depthPx, cdPx / 2);
        ctx.stroke();

        // Handle indicator pill at inside corner junction
        ctx.fillStyle = isColliding ? '#dc2626' : (isSelected ? '#1d4ed8' : '#1f2937');
        ctx.fillRect(cwPx / 2 - depthPx - 5, -cdPx / 2 + depthPx - 5, 10, 10);
      } else if (isColliding) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
        ctx.fillRect(-wPx / 2, -dPx / 2, wPx, dPx);
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(-wPx / 2, -dPx / 2, wPx, dPx);
      } else if (isDecor) {
        ctx.fillStyle = isSelected ? 'rgba(16, 185, 129, 0.28)' : 'rgba(240, 253, 244, 0.95)';
        ctx.fillRect(-wPx / 2, -dPx / 2, wPx, dPx);
        ctx.strokeStyle = isSelected ? '#047857' : '#059669';
        ctx.lineWidth = isSelected ? 2.5 : 1.6;
        ctx.strokeRect(-wPx / 2, -dPx / 2, wPx, dPx);
      } else {
        var isWallUnitItem = Core.isWallUnit ? Core.isWallUnit(f.category, f.name, f.code || f.catalogItemId, f.costCategory) : false;
        if (isWallUnitItem) {
          // Wall unit: Distinctive clean architectural cyan/blue border with corner ticks
          ctx.fillStyle = isSelected ? 'rgba(2, 132, 199, 0.25)' : 'rgba(240, 249, 255, 0.95)';
          ctx.fillRect(-wPx / 2, -dPx / 2, wPx, dPx);
          ctx.strokeStyle = isSelected ? '#0284c7' : '#0369a1';
          ctx.lineWidth = isSelected ? 2.5 : 1.6;
          ctx.strokeRect(-wPx / 2, -dPx / 2, wPx, dPx);
          ctx.strokeStyle = 'rgba(2, 132, 199, 0.4)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(-wPx / 2, -dPx / 2 + 10); ctx.lineTo(-wPx / 2 + 10, -dPx / 2);
          ctx.moveTo(wPx / 2 - 10, -dPx / 2); ctx.lineTo(wPx / 2, -dPx / 2 + 10);
          ctx.stroke();
        } else {
          // Base / Tall unit: Crisp architectural white card with elegant dark slate border
          ctx.fillStyle = isSelected ? 'rgba(37, 99, 235, 0.16)' : 'rgba(255, 255, 255, 0.96)';
          ctx.fillRect(-wPx / 2, -dPx / 2, wPx, dPx);
          ctx.strokeStyle = isSelected ? '#2563eb' : '#334155';
          ctx.lineWidth = isSelected ? 2.5 : 1.6;
          ctx.strokeRect(-wPx / 2, -dPx / 2, wPx, dPx);
        }
      }

      if (isDecor) {
        var dType = f.decorType || (
          (f.name.toLowerCase().indexOf('sink') !== -1) ? 'sink' :
          (f.name.toLowerCase().indexOf('hob') !== -1 || f.name.toLowerCase().indexOf('stove') !== -1 || f.name.toLowerCase().indexOf('burner') !== -1 || f.name.toLowerCase().indexOf('component_2') !== -1) ? 'gas_hob' :
          (f.name.toLowerCase().indexOf('dish') !== -1) ? 'dishwasher' :
          (f.name.toLowerCase().indexOf('washing') !== -1 || f.name.toLowerCase().indexOf('aeg') !== -1) ? 'washing_machine' :
          (f.name.toLowerCase().indexOf('ro') !== -1 || f.name.toLowerCase().indexOf('purifier') !== -1 || f.name.toLowerCase().indexOf('kent') !== -1) ? 'ro_purifier' :
          (f.name.toLowerCase().indexOf('dining') !== -1 || f.name.toLowerCase().indexOf('1ewt') !== -1 || (f.name.toLowerCase().indexOf('table') !== -1 && f.name.toLowerCase().indexOf('top') === -1)) ? 'dining_table' :
          (f.name.toLowerCase().indexOf('plant') !== -1) ? 'plant' : 'general'
        );

        ctx.strokeStyle = isSelected ? '#047857' : '#059669';
        ctx.fillStyle = isSelected ? '#047857' : '#059669';
        ctx.lineWidth = 1.2;

        if (dType === 'sink') {
          // Basin cutout & drain
          var bW = wPx * 0.52, bD = dPx * 0.74, bX = -wPx * 0.2;
          ctx.strokeRect(bX - bW / 2, -bD / 2, bW, bD);
          ctx.beginPath(); ctx.arc(bX, 0, Math.min(bW, bD) * 0.16, 0, Math.PI * 2); ctx.stroke();
          // Faucet
          ctx.beginPath(); ctx.arc(bX, -bD / 2 + 6, 4, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.moveTo(bX, -bD / 2 + 6); ctx.lineTo(bX, -bD / 2 + 16); ctx.stroke();
          // Drainboard ribs
          var dbW = wPx * 0.36, dbX = wPx * 0.26;
          for (var r = -2; r <= 2; r++) {
            ctx.beginPath(); ctx.moveTo(dbX - dbW / 2 + 4, r * (bD / 6)); ctx.lineTo(dbX + dbW / 2 - 4, r * (bD / 6)); ctx.stroke();
          }
        } else if (dType === 'gas_hob') {
          // 2 Burners with crosshairs
          [-wPx * 0.25, wPx * 0.25].forEach(function (bx) {
            ctx.beginPath(); ctx.arc(bx, -dPx * 0.05, Math.min(wPx, dPx) * 0.22, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.arc(bx, -dPx * 0.05, Math.min(wPx, dPx) * 0.11, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.moveTo(bx - Math.min(wPx, dPx) * 0.26, -dPx * 0.05); ctx.lineTo(bx + Math.min(wPx, dPx) * 0.26, -dPx * 0.05); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(bx, -dPx * 0.05 - Math.min(wPx, dPx) * 0.26); ctx.lineTo(bx, -dPx * 0.05 + Math.min(wPx, dPx) * 0.26); ctx.stroke();
          });
          // 2 Knobs at front
          [-wPx * 0.14, wPx * 0.14].forEach(function (kx) {
            ctx.beginPath(); ctx.arc(kx, dPx / 2 - 6, 3, 0, Math.PI * 2); ctx.fill();
          });
        } else if (dType === 'washing_machine') {
          // Outer circular door & inner drum
          ctx.beginPath(); ctx.arc(0, 0, Math.min(wPx, dPx) * 0.36, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.arc(0, 0, Math.min(wPx, dPx) * 0.24, 0, Math.PI * 2); ctx.stroke();
          // Detergent drawer
          ctx.strokeRect(-wPx / 2 + 4, -dPx / 2 + 4, wPx * 0.26, dPx * 0.2);
        } else if (dType === 'dining_table') {
          // 4 chair outlines around table
          var chW = wPx * 0.3, chD = 8;
          ctx.strokeRect(-wPx * 0.35, dPx / 2 + 2, chW, chD);
          ctx.strokeRect(wPx * 0.05, dPx / 2 + 2, chW, chD);
          ctx.strokeRect(-wPx * 0.35, -dPx / 2 - 10, chW, chD);
          ctx.strokeRect(wPx * 0.05, -dPx / 2 - 10, chW, chD);
        } else if (dType === 'plant') {
          ctx.beginPath(); ctx.arc(0, 0, Math.min(wPx, dPx) * 0.35, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-wPx * 0.25, 0); ctx.lineTo(wPx * 0.25, 0); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(0, -dPx * 0.25); ctx.lineTo(0, dPx * 0.25); ctx.stroke();
        } else {
          // Subtle inner border for general decor
          ctx.strokeRect(-wPx / 2 + 4, -dPx / 2 + 4, wPx - 8, dPx - 8);
        }
      } else if (!isLCorner) {
        // Shutter dividers
        var numShutters = (f.unitConfig && f.unitConfig.shutters) || (wMm > 1200 ? 3 : wMm > 600 ? 2 : 1);
        if (numShutters > 1) {
          ctx.strokeStyle = isColliding ? '#dc2626' : (isSelected ? 'rgba(27, 79, 114, 0.35)' : 'rgba(110, 78, 53, 0.25)');
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (var s = 1; s < numShutters; s++) {
            var sx = -wPx / 2 + s * (wPx / numShutters);
            ctx.moveTo(sx, -dPx / 2);
            ctx.lineTo(sx, dPx / 2);
          }
          ctx.stroke();
        }

        // Front Shutter / Door edge (at +dPx/2) - clearly distinguishes front from back
        ctx.strokeStyle = isColliding ? '#dc2626' : (isSelected ? '#2563eb' : '#92400e');
        ctx.lineWidth = isSelected || isColliding ? 3.5 : 2.5;
        ctx.beginPath();
        ctx.moveTo(-wPx / 2, dPx / 2);
        ctx.lineTo(wPx / 2, dPx / 2);
        ctx.stroke();

        // Front handle pill indicator
        ctx.fillStyle = isColliding ? '#dc2626' : (isSelected ? '#1d4ed8' : '#1f2937');
        ctx.fillRect(-10, dPx / 2 - 2, 20, 4);
      }

      // Labels: Name + Size (Clean LOD: only show detailed labels when zoomed in or selected)
      var showUnitDetails = isSelected || (this.zoom >= 0.055 && wPx >= 35 && dPx >= 25);
      if (showUnitDetails) {
        ctx.fillStyle = isColliding ? '#991b1b' : (isDecor ? '#065f46' : (isSelected ? '#1e3a8a' : '#0f172a'));
        ctx.font = '700 11px "IBM Plex Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(f.name + (isDecor ? ' (₹0)' : ''), 0, -6);

        ctx.fillStyle = isColliding ? '#dc2626' : (isDecor ? '#047857' : (isSelected ? '#1d4ed8' : '#475569'));
        ctx.font = '600 9.5px "IBM Plex Mono", monospace';
        ctx.fillText(Math.round(wMm) + ' × ' + Math.round(dMm) + ' mm', 0, 8);

        // Elevation badge if wall mounted or elevated (Elevation > 0)
        var elevMm = f.elevation !== undefined ? f.elevation : ((f.pos && f.pos.z) || 0);
        if (elevMm > 0) {
          ctx.fillStyle = isDecor ? '#059669' : '#0284c7';
          ctx.font = '700 8.5px "IBM Plex Mono", monospace';
          ctx.fillText('▲ ' + Math.round(elevMm) + ' mm AFFL', 0, 21);
        }
      }

      // If colliding, draw prominent Overlap Detected warning pill badge
      if (isColliding) {
        var warnTxt = '⚠️ Overlap Detected';
        ctx.font = '700 10.5px "IBM Plex Sans", sans-serif';
        var tw = ctx.measureText(warnTxt).width;
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(-tw / 2 - 6, -dPx / 2 - 22, tw + 12, 17, 4);
        else ctx.rect(-tw / 2 - 6, -dPx / 2 - 22, tw + 12, 17);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillText(warnTxt, 0, -dPx / 2 - 13);
      }

      // 8 Jointing & Connection Points (4 corners + 4 edge midpoints) - ONLY rendered on active selection or drag!
      var isActivelyMovingThis = !!(this.dragState && this.dragState.type === 'move_furniture' && this.dragState.furniture && this.dragState.furniture.id === f.id);
      if (isSelected || isActivelyMovingThis) {
        var isWallF = (Core.isWallUnit) ?
          Core.isWallUnit(f.category, f.name, f.code || f.catalogItemId, f.costCategory) : false;
        var pointColor = isWallF ? '#0284c7' : '#10b981';
        var activeCornerColor = isSelected ? '#f59e0b' : pointColor;

        var connectionPts = [
          // 4 Corners (Primary snaps)
          { x: -wPx / 2, y: -dPx / 2, r: 4, corner: true },
          { x: wPx / 2, y: -dPx / 2, r: 4, corner: true },
          { x: wPx / 2, y: dPx / 2, r: 4, corner: true },
          { x: -wPx / 2, y: dPx / 2, r: 4, corner: true },
          // 4 Midpoints (Secondary snaps)
          { x: 0, y: -dPx / 2, r: 2.5, corner: false },
          { x: 0, y: dPx / 2, r: 2.5, corner: false },
          { x: -wPx / 2, y: 0, r: 2.5, corner: false },
          { x: wPx / 2, y: 0, r: 2.5, corner: false }
        ];
        for (var cpi = 0; cpi < connectionPts.length; cpi++) {
          var cp = connectionPts[cpi];
          ctx.fillStyle = cp.corner ? activeCornerColor : pointColor;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(cp.x, cp.y, cp.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }

      // If actively dragging and snapped/jointed, display snap feedback badge
      if (this.dragState && this.dragState.type === 'move_furniture' && this.dragState.furniture.id === f.id && this.dragState.snapInfo) {
        var sInfo = this.dragState.snapInfo;
        if (sInfo.type === 'unit_joint') {
          var jTxt = sInfo.badgeLabel || '✓ Jointed with Unit';
          ctx.font = '700 10.5px "IBM Plex Sans", sans-serif';
          var jw = ctx.measureText(jTxt).width;
          ctx.fillStyle = '#059669';
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(-jw / 2 - 8, -dPx / 2 - 24, jw + 16, 18, 5);
          else ctx.rect(-jw / 2 - 8, -dPx / 2 - 24, jw + 16, 18);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.fillText(jTxt, 0, -dPx / 2 - 14);
        } else if (sInfo.type === 'wall_snap') {
          var wTxt = sInfo.badgeLabel || '✓ Snapped Flush to Wall';
          ctx.font = '700 10.5px "IBM Plex Sans", sans-serif';
          var ww = ctx.measureText(wTxt).width;
          ctx.fillStyle = '#0284c7';
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(-ww / 2 - 8, -dPx / 2 - 24, ww + 16, 18, 5);
          else ctx.rect(-ww / 2 - 8, -dPx / 2 - 24, ww + 16, 18);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.fillText(wTxt, 0, -dPx / 2 - 14);
        }
      }

      ctx.restore();
    }
  };

  // Render placed CAD Dimension lines (mm / cm / feet & inches)
  PlanEditor.prototype.renderDimensions = function (ctx) {
    var dims = (this.project && this.project.plan && this.project.plan.dimensions) || [];
    if (!dims.length) return;

    for (var i = 0; i < dims.length; i++) {
      var d = dims[i];
      var isSelected = this.isSelected('dimension', d.id);
      var hideTextOnZoomOut = (this.zoom < 0.055 && !isSelected);

      var sP1 = this.worldToScreen(d.p1);
      var sP2 = this.worldToScreen(d.p2);
      var dx = sP2.x - sP1.x;
      var dy = sP2.y - sP1.y;
      var len = Math.hypot(dx, dy);
      if (len < 4) continue;

      var ux = dx / len;
      var uy = dy / len;
      var nx = -uy;
      var ny = ux;

      var distMm = d.distMm || Math.round(Vec2.dist(d.p1, d.p2));
      var dimsFmt = this.formatAllDims(distMm);

      ctx.save();
      // Dimension main line
      ctx.strokeStyle = isSelected ? '#2563EB' : '#475569';
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.moveTo(sP1.x, sP1.y);
      ctx.lineTo(sP2.x, sP2.y);
      ctx.stroke();

      // CAD Architectural 45-degree ticks at both ends
      var tickLen = 6;
      [sP1, sP2].forEach(function (pt) {
        ctx.beginPath();
        ctx.moveTo(pt.x - (ux + nx) * tickLen, pt.y - (uy + ny) * tickLen);
        ctx.lineTo(pt.x + (ux + nx) * tickLen, pt.y + (uy + ny) * tickLen);
        ctx.stroke();

        // Terminal dot
        ctx.fillStyle = isSelected ? '#1D4ED8' : '#334155';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      });

      if (!hideTextOnZoomOut) {
        // Dimension text pill centered at midpoint with crisp, high-contrast readable typography
        var midX = (sP1.x + sP2.x) / 2;
        var midY = (sP1.y + sP2.y) / 2;
        var txt = dimsFmt.combined; // e.g. "1200 mm · 120 cm · 3' 11\""
        ctx.font = isSelected ? '700 12px "IBM Plex Sans", -apple-system, sans-serif' : '700 11px "IBM Plex Sans", -apple-system, sans-serif';
        var tw = ctx.measureText(txt).width;

        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = isSelected ? '#2563EB' : '#64748B';
        ctx.lineWidth = isSelected ? 1.5 : 1.2;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(midX - tw / 2 - 8, midY - 10, tw + 16, 20, 4);
        else ctx.rect(midX - tw / 2 - 8, midY - 10, tw + 16, 20);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isSelected ? '#1D4ED8' : '#0F172A';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(txt, midX, midY);
      }

      ctx.restore();
    }
  };

  // Precision CAD Crosshair Reticle (+) with center aperture, pinpoint dot, and floating tooltip badge
  PlanEditor.prototype.renderCrosshairReticle = function (ctx, snapPt, snapInfo, isDrawingWall) {
    if (!snapPt) return;
    var s = this.worldToScreen(snapPt);
    ctx.save();

    // Determine theme color and tooltip badge text based on snapping state
    var themeColor = '#06b6d4'; // Vibrant Cyan
    var badgeBg = 'rgba(15, 23, 42, 0.92)'; // Dark Slate
    var badgeText = '+ Click to start wall';
    var isJoint = snapInfo && (snapInfo.type === 'joint' || snapInfo.isChainClose);
    var isWallSeg = snapInfo && (snapInfo.type === 'wall_segment');

    if (this.activeTool === 'divider') {
      themeColor = '#8b5cf6'; // Violet
      badgeBg = 'rgba(109, 40, 217, 0.96)';
      badgeText = '✂ Drag box for Pooja Room / Zone, or click to start divider';

      if (isDrawingWall) {
        if (snapInfo && (snapInfo.type === 'divider_wall_snap' || snapInfo.isOppositeWall)) {
          themeColor = '#10b981'; // Emerald
          badgeBg = 'rgba(6, 95, 70, 0.96)';
          badgeText = '🔒 Wall-to-Wall Connected · ' + this.formatDim(snapInfo.distMm || 0) + ' (Click to Divide)';
        } else if (snapInfo && (snapInfo.type === 'wall_segment' || snapInfo.type === 'joint')) {
          themeColor = '#10b981';
          badgeBg = 'rgba(6, 95, 70, 0.96)';
          badgeText = '✂ Connect to ' + (snapInfo.label || 'Wall') + ' · ' + this.formatDim(snapInfo.distMm || 0);
        } else if (snapInfo && snapInfo.type === 'ortho') {
          var degD = snapInfo.angleDeg || 0;
          var isHD = (degD === 0 || degD === 180 || degD === 360);
          badgeText = '✂ ' + (isHD ? '↔ Horizontal' : '↕ Vertical') + ' · ' + this.formatDim(snapInfo.distMm || 0);
        } else {
          badgeText = '✂ Click next corner (or click start to close Pooja Room loop)';
        }
      } else {
        if (snapInfo && (snapInfo.type === 'divider_start_snap' || snapInfo.type === 'wall_segment' || snapInfo.type === 'joint')) {
          themeColor = '#10b981';
          badgeBg = 'rgba(6, 95, 70, 0.96)';
          badgeText = '✂ Drag box for Pooja Room, or click to start on wall';
        }
      }
    } else if (isDrawingWall) {
      if (snapInfo && (snapInfo.isDualAxis || snapInfo.alignedVertex)) {
        themeColor = '#10b981';
        badgeBg = 'rgba(15, 23, 42, 0.92)';
        badgeText = 'Specify end point';
      } else if (snapInfo && snapInfo.isChainClose) {
        themeColor = '#10b981'; // Vibrant Emerald
        badgeBg = 'rgba(6, 95, 70, 0.96)';
        badgeText = '⮌ Close Room Loop [Click to Finish]';
      } else if (snapInfo && snapInfo.type === 'perpendicular') {
        themeColor = '#10b981';
        badgeBg = 'rgba(6, 95, 70, 0.96)';
        badgeText = '⊥ 90° Perpendicular (' + this.formatDim(snapInfo.distMm || 0) + ')';
      } else if (snapInfo && snapInfo.type === 'parallel') {
        themeColor = '#2563eb';
        badgeBg = 'rgba(30, 64, 175, 0.96)';
        badgeText = '∥ Parallel (' + this.formatDim(snapInfo.distMm || 0) + ')';
      } else if (snapInfo && snapInfo.type === 'ortho') {
        var deg = snapInfo.angleDeg || 0;
        var isH = (deg === 0 || deg === 180 || deg === 360);
        themeColor = isH ? '#f59e0b' : '#06b6d4';
        badgeBg = isH ? 'rgba(180, 83, 9, 0.96)' : 'rgba(14, 116, 144, 0.96)';
        badgeText = (isH ? '↔ Horizontal' : '↕ Vertical') + ' · ' + this.formatDim(snapInfo.distMm || 0);
      } else if (snapInfo && snapInfo.type === 'joint') {
        themeColor = '#06b6d4';
        badgeBg = 'rgba(14, 116, 144, 0.96)';
        badgeText = '● Snap: ' + (snapInfo.label || 'Wall Corner');
      } else if (snapInfo && snapInfo.type === 'wall_segment') {
        themeColor = '#0284c7';
        badgeBg = 'rgba(3, 105, 161, 0.96)';
        badgeText = '⊥ On Wall Face (T-Junction)';
      } else {
        themeColor = '#2563eb';
        badgeBg = 'rgba(15, 23, 42, 0.92)';
        badgeText = '+ Next Wall Corner (Double-click or ↵ to finish)';
      }
    } else {
      // Prior to drawing first wall
      if (isJoint) {
        themeColor = '#10b981';
        badgeBg = 'rgba(6, 95, 70, 0.96)';
        badgeText = '● Snap: ' + (snapInfo.label || 'Wall Corner') + ' [Click to Start]';
      } else if (isWallSeg) {
        themeColor = '#0284c7';
        badgeBg = 'rgba(3, 105, 161, 0.96)';
        badgeText = '⊥ On Wall Face [Click for T-Junction]';
      } else {
        themeColor = '#06b6d4';
        badgeBg = 'rgba(15, 23, 42, 0.92)';
        badgeText = '+ Click to start wall';
      }
    }

    var r = isJoint ? 9 : 7;
    var armLen = 18;
    var gap = r + 2;

    // Layer 1: Outer High-Contrast White Halo (Visible on dark wood, tiles, or black background)
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    // North
    ctx.moveTo(s.x, s.y - gap); ctx.lineTo(s.x, s.y - gap - armLen);
    // South
    ctx.moveTo(s.x, s.y + gap); ctx.lineTo(s.x, s.y + gap + armLen);
    // West
    ctx.moveTo(s.x - gap, s.y); ctx.lineTo(s.x - gap - armLen, s.y);
    // East
    ctx.moveTo(s.x + gap, s.y); ctx.lineTo(s.x + gap + armLen, s.y);
    ctx.stroke();

    // Layer 2: Colored Core Line (+)
    ctx.strokeStyle = themeColor;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(s.x, s.y - gap); ctx.lineTo(s.x, s.y - gap - armLen);
    ctx.moveTo(s.x, s.y + gap); ctx.lineTo(s.x, s.y + gap + armLen);
    ctx.moveTo(s.x - gap, s.y); ctx.lineTo(s.x - gap - armLen, s.y);
    ctx.moveTo(s.x + gap, s.y); ctx.lineTo(s.x + gap + armLen, s.y);
    ctx.stroke();

    // Center precision pinpoint dot
    ctx.fillStyle = themeColor;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Floating CAD Tooltip Badge
    ctx.font = '700 11px "IBM Plex Sans", -apple-system, sans-serif';
    var tw = ctx.measureText(badgeText).width;
    var bx = s.x + 18;
    var by = s.y - 12;

    if (this.width && bx + tw + 20 > this.width) {
      bx = s.x - tw - 24;
    }
    if (by - 12 < 0) {
      by = s.y + 24;
    }

    ctx.fillStyle = badgeBg;
    ctx.strokeStyle = themeColor;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx, by - 11, tw + 16, 22, 5);
    else ctx.rect(bx, by - 11, tw + 16, 22);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, bx + 8, by);

    ctx.restore();
  };

  PlanEditor.prototype.renderPreview = function (ctx) {
    // 0. Dragging Room Divider Area Box (e.g. Pooja Room)
    if (this.dragState && this.dragState.type === 'draw_divider_box') {
      var p1 = this.dragState.startWorld;
      var p2 = this.cursorWorld;
      var minX = Math.round(Math.min(p1.x, p2.x) / 25) * 25;
      var maxX = Math.round(Math.max(p1.x, p2.x) / 25) * 25;
      var minY = Math.round(Math.min(p1.y, p2.y) / 25) * 25;
      var maxY = Math.round(Math.max(p1.y, p2.y) / 25) * 25;
      var wMm = maxX - minX;
      var hMm = maxY - minY;
      var areaSqM = ((wMm * hMm) / 1000000).toFixed(2);
      var areaSqFt = ((wMm * hMm) / 92903.04).toFixed(1);

      var sp1 = this.worldToScreen({ x: minX, y: minY });
      var sp2 = this.worldToScreen({ x: maxX, y: maxY });
      var sW = sp2.x - sp1.x;
      var sH = sp2.y - sp1.y;

      ctx.save();
      // Violet semi-transparent room zone fill
      ctx.fillStyle = 'rgba(124, 58, 237, 0.14)';
      ctx.fillRect(sp1.x, sp1.y, sW, sH);

      // Dash-dot architectural divider boundary line
      ctx.strokeStyle = '#7C3AED';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([8, 5, 2, 5]);
      ctx.strokeRect(sp1.x, sp1.y, sW, sH);
      ctx.setLineDash([]);

      // Corner accent dots
      ctx.fillStyle = '#6D28D9';
      [ {x: sp1.x, y: sp1.y}, {x: sp2.x, y: sp1.y}, {x: sp2.x, y: sp2.y}, {x: sp1.x, y: sp2.y} ].forEach(function (pt) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
        ctx.fill();
      });

      // Center floating badge: "✂ POOJA ROOM: 1200 × 1200 mm · 1.44 m²"
      var midX = (sp1.x + sp2.x) / 2;
      var midY = (sp1.y + sp2.y) / 2;
      var label = '✂ POOJA ROOM: ' + wMm + ' × ' + hMm + ' mm (' + areaSqM + ' m² / ' + areaSqFt + ' sq ft)';
      ctx.font = '700 11.5px "IBM Plex Sans", -apple-system, sans-serif';
      var tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(109, 40, 217, 0.95)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(midX - tw / 2 - 10, midY - 12, tw + 20, 24, 6);
      else ctx.rect(midX - tw / 2 - 10, midY - 12, tw + 20, 24);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, midX, midY);

      ctx.restore();
    }

    // 1. Wall drawing preview line & dynamic guidelines
    if (this.wallChainStart) {
      var snap = this.snapPoint(this.cursorWorld);
      var sStart = this.worldToScreen(this.wallChainStart);
      var sEnd = this.worldToScreen(snap.pt);
      var distMm = Math.round(Vec2.dist(this.wallChainStart, snap.pt));

      // Failsafe: check if snapped point aligns with any existing corner on either X or Y within 35mm
      if (!snap.alignedVertex && distMm > 60) {
        var pWalls = (this.project && this.project.plan && this.project.plan.walls) || [];
        for (var fsi = 0; fsi < pWalls.length; fsi++) {
          var fsw = pWalls[fsi];
          if (Vec2.dist(fsw.start, this.wallChainStart) > 60) {
            if (Math.abs(fsw.start.x - snap.pt.x) < 35 || Math.abs(fsw.start.y - snap.pt.y) < 35) {
              snap.alignedVertex = fsw.start;
              snap.isDualAxis = true;
              break;
            }
          }
          if (Vec2.dist(fsw.end, this.wallChainStart) > 60) {
            if (Math.abs(fsw.end.x - snap.pt.x) < 35 || Math.abs(fsw.end.y - snap.pt.y) < 35) {
              snap.alignedVertex = fsw.end;
              snap.isDualAxis = true;
              break;
            }
          }
        }
      }

      // 1a. Draw alignment guide lines with vibrant color coding
      if (snap.isDualAxis || snap.alignedVertex) {
        // Dual Axis Guidelines: Both X-Axis and Y-Axis displayed simultaneously (AutoCAD standard)
        var vAlign = snap.alignedVertex;
        var sAlign = vAlign ? this.worldToScreen(vAlign) : null;
        var ext = Math.max(this.width || 3000, this.height || 3000) * 1.5;

        var gDx = sEnd.x - sStart.x, gDy = sEnd.y - sStart.y;
        var gLen = Math.hypot(gDx, gDy) || 1;
        var isHoriz = Math.abs(gDy) < Math.abs(gDx) * 0.2 || (snap.angleDeg === 0 || snap.angleDeg === 180 || snap.angleDeg === 360);
        var isVert = Math.abs(gDx) < Math.abs(gDy) * 0.2 || (snap.angleDeg === 90 || snap.angleDeg === 270);

        ctx.save();
        ctx.strokeStyle = '#10b981'; // Crisp CAD Emerald Green (matching sample image 2)
        ctx.lineWidth = 1.8;
        ctx.setLineDash([5, 4]);

        // Axis 1: Along the current wall line (passes through sStart and sEnd, extending full canvas)
        ctx.beginPath();
        if (isHoriz) {
          ctx.moveTo(-1000, sEnd.y);
          ctx.lineTo((this.width || 3000) + 1000, sEnd.y);
        } else if (isVert) {
          ctx.moveTo(sEnd.x, -1000);
          ctx.lineTo(sEnd.x, (this.height || 3000) + 1000);
        } else {
          ctx.moveTo(sStart.x - (gDx / gLen) * ext, sStart.y - (gDy / gLen) * ext);
          ctx.lineTo(sEnd.x + (gDx / gLen) * ext, sEnd.y + (gDy / gLen) * ext);
        }
        ctx.stroke();

        // Axis 2: Alignment Tracking Axis (passes through sEnd and sAlign, extending full canvas)
        ctx.beginPath();
        if (isHoriz) {
          ctx.moveTo(sEnd.x, -1000);
          ctx.lineTo(sEnd.x, (this.height || 3000) + 1000);
        } else if (isVert) {
          ctx.moveTo(-1000, sEnd.y);
          ctx.lineTo((this.width || 3000) + 1000, sEnd.y);
        } else if (sAlign) {
          var nX = -gDy / gLen, nY = gDx / gLen;
          ctx.moveTo(sEnd.x - nX * ext, sEnd.y - nY * ext);
          ctx.lineTo(sEnd.x + nX * ext, sEnd.y + nY * ext);
        }
        ctx.stroke();
        ctx.restore();

        // Corner Crosshair Markers (+) at corners (exactly like sample image 2)
        var drawCornerPlus = function (ctx, cx, cy) {
          var arm = 14;
          ctx.save();
          // White high-contrast outline
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.moveTo(cx - arm, cy); ctx.lineTo(cx + arm, cy);
          ctx.moveTo(cx, cy - arm); ctx.lineTo(cx, cy + arm);
          ctx.stroke();
          // Vivid Green Core
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(cx - arm, cy); ctx.lineTo(cx + arm, cy);
          ctx.moveTo(cx, cy - arm); ctx.lineTo(cx, cy + arm);
          ctx.stroke();
          ctx.restore();
        };

        if (sAlign) drawCornerPlus(ctx, sAlign.x, sAlign.y);
        drawCornerPlus(ctx, sStart.x, sStart.y);
        drawCornerPlus(ctx, sEnd.x, sEnd.y);

        // Connected previous corners in this wall chain (e.g. top-right in U-shape)
        var pWallsRef = (this.project && this.project.plan && this.project.plan.walls) || [];
        for (var wi = 0; wi < pWallsRef.length; wi++) {
          var pw = pWallsRef[wi];
          var ss = this.worldToScreen(pw.start);
          var se = this.worldToScreen(pw.end);
          if (Vec2.dist(pw.end, this.wallChainStart) < 60 && (!vAlign || Vec2.dist(pw.start, vAlign) > 60)) {
            drawCornerPlus(ctx, ss.x, ss.y);
          }
          if (Vec2.dist(pw.start, this.wallChainStart) < 60 && (!vAlign || Vec2.dist(pw.end, vAlign) > 60)) {
            drawCornerPlus(ctx, se.x, se.y);
          }
        }

        // Dual-Axis Pill Badge
        var gMidX = (sStart.x + sEnd.x) / 2;
        var gMidY = (sStart.y + sEnd.y) / 2 - 38;
        ctx.save();
        ctx.font = '700 11px "IBM Plex Sans", sans-serif';
        var gText = '✛ Dual-Axis Aligned (X & Y Axis)';
        var gtw = ctx.measureText(gText).width;
        ctx.fillStyle = '#065f46';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(gMidX - gtw / 2 - 8, gMidY - 10, gtw + 16, 20, 4);
        else ctx.rect(gMidX - gtw / 2 - 8, gMidY - 10, gtw + 16, 20);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(gText, gMidX, gMidY);
        ctx.restore();
      } else if (snap.type === 'perpendicular' || snap.type === 'parallel') {
        var isPerp = (snap.type === 'perpendicular');
        ctx.save();
        ctx.strokeStyle = isPerp ? '#10b981' : '#2563eb'; // Emerald green (perp) or Royal Blue (parallel)
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);

        var gDx = sEnd.x - sStart.x, gDy = sEnd.y - sStart.y;
        var gLen = Math.hypot(gDx, gDy) || 1;
        var ext = 2200;
        ctx.beginPath();
        ctx.moveTo(sStart.x - (gDx / gLen) * ext, sStart.y - (gDy / gLen) * ext);
        ctx.lineTo(sEnd.x + (gDx / gLen) * ext, sEnd.y + (gDy / gLen) * ext);
        ctx.stroke();
        ctx.restore();

        // Guide Pill Badge near midpoint
        var gMidX = (sStart.x + sEnd.x) / 2;
        var gMidY = (sStart.y + sEnd.y) / 2 - 38;
        ctx.save();
        ctx.font = '700 11px "IBM Plex Sans", sans-serif';
        var gText = (isPerp ? '⊥ 90° Perpendicular' : '∥ Parallel') + (snap.target && snap.target.id ? ' to Wall' : '');
        var gtw = ctx.measureText(gText).width;
        ctx.fillStyle = isPerp ? '#065f46' : '#1e40af';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(gMidX - gtw / 2 - 8, gMidY - 10, gtw + 16, 20, 4);
        else ctx.rect(gMidX - gtw / 2 - 8, gMidY - 10, gtw + 16, 20);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(gText, gMidX, gMidY);
        ctx.restore();
      } else if (snap.type === 'ortho' || snap.type === 'angle') {
        // Distinct color by alignment angle: Amber for Horizontal, Cyan for Vertical, Purple for 45°
        var deg = snap.angleDeg || 0;
        var isH = (deg === 0 || deg === 180 || deg === 360);
        var isV = (deg === 90 || deg === 270);
        var guideCol = isH ? '#f59e0b' : (isV ? '#06b6d4' : '#a855f7');
        var badgeBg = isH ? '#d97706' : (isV ? '#0891b2' : '#7e22ce');
        var aLabel = isH ? ('↔ ' + deg + '° Horizontal') : (isV ? ('↕ ' + deg + '° Vertical') : ('∡ ' + deg + '° Angle'));

        ctx.save();
        ctx.strokeStyle = guideCol;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);
        var gDx2 = sEnd.x - sStart.x, gDy2 = sEnd.y - sStart.y;
        var gLen2 = Math.hypot(gDx2, gDy2) || 1;
        ctx.beginPath();
        ctx.moveTo(sStart.x - (gDx2 / gLen2) * 1600, sStart.y - (gDy2 / gLen2) * 1600);
        ctx.lineTo(sEnd.x + (gDx2 / gLen2) * 1600, sEnd.y + (gDy2 / gLen2) * 1600);
        ctx.stroke();
        ctx.restore();

        // Angle Pill Badge
        var gMidX2 = (sStart.x + sEnd.x) / 2;
        var gMidY2 = (sStart.y + sEnd.y) / 2 - 38;
        ctx.save();
        ctx.font = '700 11px "IBM Plex Mono", monospace';
        var atw = ctx.measureText(aLabel).width;
        ctx.fillStyle = badgeBg;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(gMidX2 - atw / 2 - 8, gMidY2 - 10, atw + 16, 20, 4);
        else ctx.rect(gMidX2 - atw / 2 - 8, gMidY2 - 10, atw + 16, 20);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(aLabel, gMidX2, gMidY2);
        ctx.restore();
      }

      // Draw ghost wall line or ghost divider
      if (this.activeTool === 'divider') {
        ctx.save();
        ctx.strokeStyle = '#8B5CF6';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([8, 5, 2, 5]);
        ctx.beginPath();
        ctx.moveTo(sStart.x, sStart.y);
        ctx.lineTo(sEnd.x, sEnd.y);
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.strokeStyle = '#1B4F72';
        ctx.lineWidth = Math.max(2, this.wallPreset.thickness * this.zoom);
        ctx.beginPath();
        ctx.moveTo(sStart.x, sStart.y);
        ctx.lineTo(sEnd.x, sEnd.y);
        ctx.stroke();
      }

      // Corner A & B labels and parallel dimension line with witness lines
      if (distMm > 60) {
        var gDx = snap.pt.x - this.wallChainStart.x;
        var gDy = snap.pt.y - this.wallChainStart.y;
        var gLen = Math.hypot(gDx, gDy) || 1;
        var gDirX = gDx / gLen, gDirY = gDy / gLen;
        var gNormX = -gDirY, gNormY = gDirX;
        var gDimOff = (this.wallPreset.thickness / 2) + 220;

        var gDsWorld = { x: this.wallChainStart.x + gNormX * gDimOff, y: this.wallChainStart.y + gNormY * gDimOff };
        var gDeWorld = { x: snap.pt.x + gNormX * gDimOff, y: snap.pt.y + gNormY * gDimOff };
        var sGDs = this.worldToScreen(gDsWorld);
        var sGDe = this.worldToScreen(gDeWorld);

        // Witness lines
        var sExtS = this.worldToScreen({ x: this.wallChainStart.x + gNormX * (this.wallPreset.thickness / 2 + 15), y: this.wallChainStart.y + gNormY * (this.wallPreset.thickness / 2 + 15) });
        var sExtE = this.worldToScreen({ x: snap.pt.x + gNormX * (this.wallPreset.thickness / 2 + 15), y: snap.pt.y + gNormY * (this.wallPreset.thickness / 2 + 15) });
        var sExtSTip = this.worldToScreen({ x: gDsWorld.x + gNormX * 45, y: gDsWorld.y + gNormY * 45 });
        var sExtETip = this.worldToScreen({ x: gDeWorld.x + gNormX * 45, y: gDeWorld.y + gNormY * 45 });

        ctx.save();
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(sExtS.x, sExtS.y); ctx.lineTo(sExtSTip.x, sExtSTip.y);
        ctx.moveTo(sExtE.x, sExtE.y); ctx.lineTo(sExtETip.x, sExtETip.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Main dimension line
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sGDs.x, sGDs.y); ctx.lineTo(sGDe.x, sGDe.y);
        ctx.stroke();

        // Dots at endpoints
        ctx.fillStyle = '#1d4ed8';
        ctx.beginPath();
        ctx.arc(sGDs.x, sGDs.y, 3.5, 0, Math.PI * 2);
        ctx.arc(sGDe.x, sGDe.y, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Direction arrow 1 inside ghost wall pointing towards Corner A
        var sGMidX = (sStart.x + sEnd.x) / 2;
        var sGMidY = (sStart.y + sEnd.y) / 2;
        var ax = -gDirX, ay = -gDirY;
        var anX = -ay, anY = ax;
        ctx.fillStyle = '#2563eb';
        ctx.beginPath();
        ctx.moveTo(sGMidX + ax * 12, sGMidY + ay * 12);
        ctx.lineTo(sGMidX + ax * 3 + anX * 5, sGMidY + ay * 3 + anY * 5);
        ctx.lineTo(sGMidX + ax * 3 - anX * 5, sGMidY + ay * 3 - anY * 5);
        ctx.closePath();
        ctx.fill();

        ctx.font = '700 13px "IBM Plex Sans", -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#ffffff';
        ctx.strokeText('1', sGMidX - ax * 14, sGMidY - ay * 14);
        ctx.fillStyle = '#1e3a8a';
        ctx.fillText('1', sGMidX - ax * 14, sGMidY - ay * 14);

        // Corner A label
        var sALabel = this.worldToScreen({
          x: this.wallChainStart.x - gDirX * 50 + gNormX * (this.wallPreset.thickness / 2 + 35),
          y: this.wallChainStart.y - gDirY * 50 + gNormY * (this.wallPreset.thickness / 2 + 35)
        });
        ctx.font = '700 15px "IBM Plex Sans", -apple-system, sans-serif';
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#ffffff';
        ctx.strokeText('A', sALabel.x, sALabel.y);
        ctx.fillStyle = '#1e3a8a';
        ctx.fillText('A', sALabel.x, sALabel.y);

        // Corner B label
        var sBLabel = this.worldToScreen({
          x: snap.pt.x + gDirX * 50 + gNormX * (this.wallPreset.thickness / 2 + 35),
          y: snap.pt.y + gDirY * 50 + gNormY * (this.wallPreset.thickness / 2 + 35)
        });
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#ffffff';
        ctx.strokeText('B', sBLabel.x, sBLabel.y);
        ctx.fillStyle = '#1e3a8a';
        ctx.fillText('B', sBLabel.x, sBLabel.y);
        ctx.restore();
      }

      // Dimension & Typing HUD Pill
      var midX = (sStart.x + sEnd.x) / 2;
      var midY = (sStart.y + sEnd.y) / 2 - 14;

      if (this.numericInputBuffer) {
        // Floating keyboard input HUD
        ctx.save();
        ctx.font = '700 13px "IBM Plex Mono", monospace';
        var parsedLen = this.parseDimInput(this.numericInputBuffer);
        var previewFormatted = parsedLen > 0 ? (' = ' + this.formatDim(parsedLen)) : '';
        var hudText = '⌨ Length: [ ' + this.numericInputBuffer + ' ]' + previewFormatted + '  (↵ Enter to draw)';
        var htw = ctx.measureText(hudText).width;
        ctx.fillStyle = '#1e3a8a';
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(midX - htw / 2 - 10, midY - 12, htw + 20, 24, 5);
        else ctx.rect(midX - htw / 2 - 10, midY - 12, htw + 20, 24);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(hudText, midX, midY);
        ctx.restore();
      } else {
        // Standard dimension indicator with Clear Inner Span
        ctx.save();
        ctx.font = '600 12px "IBM Plex Mono", monospace';
        var pWalls = (this.project && this.project.plan && this.project.plan.walls) || [];
        var sConnW = null, eConnW = null;
        for (var pi = 0; pi < pWalls.length; pi++) {
          if (!sConnW && (Vec2.dist(this.wallChainStart, pWalls[pi].start) < 60 || Vec2.dist(this.wallChainStart, pWalls[pi].end) < 60)) sConnW = pWalls[pi];
          if (!eConnW && (Vec2.dist(snap.pt, pWalls[pi].start) < 60 || Vec2.dist(snap.pt, pWalls[pi].end) < 60)) eConnW = pWalls[pi];
        }
        var sDed = sConnW ? ((sConnW.thickness || 150) / 2) : 0;
        var eDed = eConnW ? ((eConnW.thickness || 150) / 2) : 0;
        var innerPrev = Math.max(0, distMm - (sDed + eDed));

        var dText = (sDed > 0 || eDed > 0) ?
          (this.formatDim(innerPrev) + ' [Inner] · ' + this.formatDim(distMm)) :
          this.formatDim(distMm);
        var dtw = ctx.measureText(dText).width;
        ctx.fillStyle = 'rgba(27, 79, 114, 0.95)';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(midX - dtw / 2 - 8, midY - 10, dtw + 16, 20, 4);
        else ctx.rect(midX - dtw / 2 - 8, midY - 10, dtw + 16, 20);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(dText, midX, midY);
        ctx.restore();
      }

      // 1b. Render precision CAD crosshair reticle (+) at wall tip while drawing chain
      this.renderCrosshairReticle(ctx, snap.pt, snap, true);
    } else if (this.activeTool === 'wall' || this.activeTool === 'divider') {
      // 1c. Render precision CAD crosshair reticle (+) before starting first wall or divider
      var snap0 = this.snapPoint(this.cursorWorld);
      this.renderCrosshairReticle(ctx, snap0.pt, snap0, false);
    }

    // 2. Snapping circle indicator (Magnetic Joint snap for select tool)
    if (this.activeTool === 'select') {
      var snap2 = this.snapPoint(this.cursorWorld);
      if (snap2.type === 'joint' || snap2.type === 'vertex') {
        var sSnap = this.worldToScreen(snap2.pt);
        ctx.save();
        ctx.strokeStyle = '#06b6d4'; // Bright cyan
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(sSnap.x, sSnap.y, 9, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = 'rgba(6, 182, 212, 0.3)';
        ctx.beginPath();
        ctx.arc(sSnap.x, sSnap.y, 4, 0, Math.PI * 2);
        ctx.fill();

        // Joint badge
        ctx.font = '700 10.5px "IBM Plex Sans", sans-serif';
        var jText = '● Joint Snap';
        var jtw = ctx.measureText(jText).width;
        ctx.fillStyle = '#0891b2';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(sSnap.x + 12, sSnap.y - 9, jtw + 10, 18, 3);
        else ctx.rect(sSnap.x + 12, sSnap.y - 9, jtw + 10, 18);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(jText, sSnap.x + 17, sSnap.y);
        ctx.restore();
      }
    }

    // 3. Opening hover placement preview with live segmented architectural dimensions
    if (this.activeTool === 'door' || this.activeTool === 'window') {
      var near = this.findNearestWall(this.cursorWorld, 400);
      if (near) {
        var w = near.wall;
        var wLen = Core.wallLength(w);
        var opWidth = this.activeTool === 'door' ? this.doorPreset.width : this.windowPreset.width;
        var halfW = opWidth / 2;
        var safeOffset = Math.max(halfW + 30, Math.min(wLen - halfW - 30, near.proj.t * wLen));

        var ghostOp = {
          id: '__preview_opening__',
          wallId: w.id,
          type: this.activeTool,
          width: opWidth,
          height: this.activeTool === 'door' ? this.doorPreset.height : this.windowPreset.height,
          sillHeight: this.windowPreset.sillHeight,
          offset: safeOffset,
          swing: this.doorPreset.swing
        };

        // Render ghost opening on wall
        this.renderSingleOpening(ctx, ghostOp, w, true);

        // Render live segmented dimensions with Corners A & B, Direction Arrows 1 & 2!
        this.renderWallDimensions(ctx, w, true, { previewOpening: ghostOp, activeOpeningId: '__preview_opening__' });
      }
    }

    // 4. Furniture placement ghost preview (with live snapping to walls & jointing to adjacent units)
    if (this.activeTool === 'furniture' && this.furniturePreset) {
      var candidatePos = this.cursorWorld;
      var snapRes = this.snapFurniture(this.furniturePreset, candidatePos, this.furnitureRotY || 0);
      var gPos = snapRes.pos;
      var gRot = snapRes.rotY !== undefined ? snapRes.rotY : (this.furnitureRotY || 0);

      var fW = (this.furniturePreset.dimensions.W || 1200) * this.zoom;
      var fD = (this.furniturePreset.dimensions.D || 600) * this.zoom;
      var sGhost = this.worldToScreen(gPos);

      ctx.save();
      ctx.translate(sGhost.x, sGhost.y);
      ctx.rotate(gRot);

      var isSnap = (snapRes.type === 'unit_joint' || snapRes.type === 'wall_snap');
      ctx.strokeStyle = (snapRes.type === 'unit_joint') ? '#10b981' : ((snapRes.type === 'wall_snap') ? '#0284c7' : '#2E7BB5');
      ctx.lineWidth = isSnap ? 2.2 : 1.5;
      ctx.setLineDash(isSnap ? [] : [4, 4]);
      ctx.fillStyle = (snapRes.type === 'unit_joint') ? 'rgba(16, 185, 129, 0.2)' : ((snapRes.type === 'wall_snap') ? 'rgba(2, 132, 199, 0.2)' : 'rgba(46, 123, 181, 0.15)');
      ctx.fillRect(-fW / 2, -fD / 2, fW, fD);
      ctx.strokeRect(-fW / 2, -fD / 2, fW, fD);
      ctx.setLineDash([]);

      // 8 Jointing Points on Ghost (4 corners + 4 midpoints)
      var isWallG = (Core.isWallUnit) ?
        Core.isWallUnit(this.furniturePreset.category, this.furniturePreset.name, this.furniturePreset.code || this.furniturePreset.catalogItemId, this.furniturePreset.costCategory) : false;
      var ghostPointColor = isWallG ? '#0284c7' : '#10b981';

      var gCorners = [
        { x: -fW / 2, y: -fD / 2, r: 3.5 },
        { x: fW / 2, y: -fD / 2, r: 3.5 },
        { x: fW / 2, y: fD / 2, r: 3.5 },
        { x: -fW / 2, y: fD / 2, r: 3.5 },
        { x: 0, y: -fD / 2, r: 2.2 },
        { x: 0, y: fD / 2, r: 2.2 },
        { x: -fW / 2, y: 0, r: 2.2 },
        { x: fW / 2, y: 0, r: 2.2 }
      ];
      for (var gci = 0; gci < gCorners.length; gci++) {
        ctx.fillStyle = ghostPointColor;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(gCorners[gci].x, gCorners[gci].y, gCorners[gci].r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // Shutter front edge indicator
      ctx.strokeStyle = (snapRes.type === 'unit_joint') ? '#059669' : '#0369a1';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-fW / 2, fD / 2);
      ctx.lineTo(fW / 2, fD / 2);
      ctx.stroke();

      ctx.fillStyle = (snapRes.type === 'unit_joint') ? '#065f46' : '#1B4F72';
      ctx.font = '600 11px "IBM Plex Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.furniturePreset.name, 0, -6);

      // Snap feedback text badge
      if (snapRes.badgeLabel) {
        ctx.fillStyle = (snapRes.type === 'unit_joint') ? '#10b981' : '#0284c7';
        ctx.font = '700 9.5px "IBM Plex Sans", sans-serif';
        ctx.fillText(snapRes.badgeLabel, 0, 9);
      } else if (snapRes.type === 'unit_joint') {
        ctx.fillStyle = '#10b981';
        ctx.font = '700 9.5px "IBM Plex Sans", sans-serif';
        ctx.fillText('✓ Snapped & Jointed to Unit', 0, 9);
      } else if (snapRes.type === 'wall_snap') {
        ctx.fillStyle = '#0284c7';
        ctx.font = '700 9.5px "IBM Plex Sans", sans-serif';
        ctx.fillText('✓ Snapped Flush to Wall', 0, 9);
      }

      ctx.restore();
    }

    // 5. Calibration Tool preview (2-point reference line & pins)
    if (this.activeTool === 'calibrate') {
      var sCur = this.worldToScreen(this.cursorWorld);
      var pts = (this.underlay && this.underlay.calibPoints) || [];

      if (pts.length >= 1) {
        var sP1 = this.worldToScreen(pts[0]);
        // Point 1 pin
        ctx.save();
        ctx.strokeStyle = '#dc2626';
        ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(sP1.x, sP1.y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(sP1.x - 14, sP1.y); ctx.lineTo(sP1.x + 14, sP1.y);
        ctx.moveTo(sP1.x, sP1.y - 14); ctx.lineTo(sP1.x, sP1.y + 14);
        ctx.stroke();

        // Rubberband line to cursor
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(sP1.x, sP1.y);
        ctx.lineTo(sCur.x, sCur.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Live span badge
        var liveDistWorld = Vec2.dist(pts[0], this.cursorWorld);
        var liveBadgeText = 'Span: ' + this.formatDim(liveDistWorld) + ' (Click Point 2 to Calibrate)';
        ctx.font = '700 12px "IBM Plex Sans", sans-serif';
        var lbw = ctx.measureText(liveBadgeText).width;
        var mx = (sP1.x + sCur.x) / 2;
        var my = (sP1.y + sCur.y) / 2 - 20;
        ctx.fillStyle = '#b91c1c';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(mx - lbw / 2 - 10, my - 11, lbw + 20, 22, 4);
        else ctx.rect(mx - lbw / 2 - 10, my - 11, lbw + 20, 22);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(liveBadgeText, mx, my);
        ctx.restore();
      } else {
        // Point 1 guide badge near cursor
        ctx.save();
        ctx.font = '700 12px "IBM Plex Sans", sans-serif';
        var guideTxt = '📏 Calibration: Click Point 1 on a known wall dimension';
        var gbw = ctx.measureText(guideTxt).width;
        ctx.fillStyle = '#1e3a8a';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(sCur.x + 16, sCur.y - 12, gbw + 18, 24, 4);
        else ctx.rect(sCur.x + 16, sCur.y - 12, gbw + 18, 24);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(guideTxt, sCur.x + 25, sCur.y);
        ctx.restore();
      }
    }

    // 6. Dimension Tool live rubberband preview
    if (this.activeTool === 'dimension') {
      var sCur = this.worldToScreen(this.cursorWorld);
      var snapped = this.snapPoint(this.cursorWorld);
      var sSnap = this.worldToScreen(snapped.pt);

      if (this.dimensionStart) {
        var sP1 = this.worldToScreen(this.dimensionStart);
        var sP2 = sSnap;
        var distMm = Math.round(Vec2.dist(this.dimensionStart, snapped.pt));
        var dimsFmt = this.formatAllDims(distMm);

        ctx.save();
        // Rubberband line
        ctx.strokeStyle = '#2563EB';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(sP1.x, sP1.y);
        ctx.lineTo(sP2.x, sP2.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Crosshairs at points
        [sP1, sP2].forEach(function (pt) {
          ctx.strokeStyle = '#1D4ED8';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
          ctx.fillStyle = '#FFFFFF';
          ctx.fill();
          ctx.stroke();
        });

        // Midpoint measurement badge showing mm, cm, and feet & inches
        var midX = (sP1.x + sP2.x) / 2;
        var midY = (sP1.y + sP2.y) / 2 - 14;
        var badgeText = dimsFmt.combined;
        ctx.font = '700 11px "IBM Plex Mono", monospace';
        var tw = ctx.measureText(badgeText).width;
        ctx.fillStyle = '#0F172A';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(midX - tw / 2 - 8, midY - 10, tw + 16, 20, 4);
        else ctx.rect(midX - tw / 2 - 8, midY - 10, tw + 16, 20);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, midX, midY);
        ctx.restore();
      } else {
        // Draw crosshair cursor indicator
        ctx.save();
        ctx.strokeStyle = '#2563EB';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(sSnap.x, sSnap.y, 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sSnap.x - 12, sSnap.y); ctx.lineTo(sSnap.x + 12, sSnap.y);
        ctx.moveTo(sSnap.x, sSnap.y - 12); ctx.lineTo(sSnap.x, sSnap.y + 12);
        ctx.stroke();

        ctx.font = '600 11px "IBM Plex Sans", sans-serif';
        var tipTxt = '📏 Click point 1 to measure (mm / cm / ft-in)';
        var ttw = ctx.measureText(tipTxt).width;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(sSnap.x + 14, sSnap.y - 12, ttw + 16, 22, 4);
        else ctx.rect(sSnap.x + 14, sSnap.y - 12, ttw + 16, 22);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(tipTxt, sSnap.x + 22, sSnap.y);
        ctx.restore();
      }
    }
  };

  PlanEditor.prototype.renderHandle = function (ctx, pt) {
    var s = this.worldToScreen(pt);
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#1B4F72';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  };

  PlanEditor.prototype.isSelected = function (type, id) {
    for (var i = 0; i < this.selected.length; i++) {
      if (this.selected[i].type === type && this.selected[i].id === id) return true;
    }
    return false;
  };

  return PlanEditor;
});
