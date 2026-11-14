const fs = require('fs');
const path = require('path');

function replaceExact(filePath, searchStr, replaceStr) {
  let content = fs.readFileSync(filePath, 'utf8');
  const isCRLF = content.includes('\r\n');
  const normContent = content.replace(/\r\n/g, '\n');
  const normSearch = searchStr.replace(/\r\n/g, '\n');
  const normReplace = replaceStr.replace(/\r\n/g, '\n');

  if (normContent.includes(normReplace)) {
    console.log(`- Already updated ${filePath}`);
    return;
  }
  if (!normContent.includes(normSearch)) {
    throw new Error(`Failed to find target string in ${filePath}:\n${normSearch.substring(0, 140)}...`);
  }
  const updatedNorm = normContent.replace(normSearch, normReplace);
  const finalContent = isCRLF ? updatedNorm.replace(/\n/g, '\r\n') : updatedNorm;
  fs.writeFileSync(filePath, finalContent, 'utf8');
  console.log(`✓ Updated ${filePath}`);
}

// 1. index.html - Add Pan View button to row 1, and Move Blueprint button to row 2
console.log('Updating index.html...');
const searchHtml_1 = `          <div class="plan-toolgroup">
            <button class="plan-tool-btn is-active" data-tool="select" title="Select & Move (S)">✋ Select</button>
            <button class="plan-tool-btn" data-tool="wall" title="Draw Wall (W)">🧱 + Wall</button>`;

const replaceHtml_1 = `          <div class="plan-toolgroup">
            <button class="plan-tool-btn is-active" data-tool="select" title="Select & Move (S)">✋ Select</button>
            <button class="plan-tool-btn" data-tool="pan" id="planPanBtn" title="Pan Floor Plan: Click and drag anywhere to pan and observe floor plan (Hotkey H or hold Spacebar / Middle Click)">✋ Pan View</button>
            <button class="plan-tool-btn" data-tool="wall" title="Draw Wall (W)">🧱 + Wall</button>`;

replaceExact('index.html', searchHtml_1, replaceHtml_1);

const searchHtml_2 = `            <div class="plan-toolgroup" id="planUnderlayControls" style="display:none;align-items:center;gap:6px;padding:2px 8px;background:#EEF5FB;border:1px solid #C2DBF0;border-radius:4px;">
              <span style="font-size:11px;font-weight:700;color:#1B4F72;">Blueprint:</span>
              <button class="plan-tool-btn" id="planCalibrateScaleBtn" style="padding:3px 7px;font-size:11px;background:#1B4F72;color:#fff;border-color:#1B4F72;" title="Calibrate Scale: Click 2 points on a known wall dimension">📏 Calibrate</button>`;

const replaceHtml_2 = `            <div class="plan-toolgroup" id="planUnderlayControls" style="display:none;align-items:center;gap:6px;padding:2px 8px;background:#EEF5FB;border:1px solid #C2DBF0;border-radius:4px;">
              <span style="font-size:11px;font-weight:700;color:#1B4F72;">Blueprint:</span>
              <button class="plan-tool-btn" id="planMoveUnderlayBtn" style="padding:3px 8px;font-size:11px;font-weight:600;display:inline-flex;align-items:center;gap:4px;" title="Move Blueprint: Click and drag anywhere to move & position blueprint under walls (Hotkey B or hold Alt while dragging)">✋ Move</button>
              <button class="plan-tool-btn" id="planCalibrateScaleBtn" style="padding:3px 7px;font-size:11px;background:#1B4F72;color:#fff;border-color:#1B4F72;" title="Calibrate Scale: Click 2 points on a known wall dimension">📏 Calibrate</button>`;

replaceExact('index.html', searchHtml_2, replaceHtml_2);

// 2. orbix-ui.js - Wire planMoveUnderlayBtn and ensure pan tool handles active state
console.log('Updating orbix-ui.js...');
const searchUi_1 = `      // ── Underlay Controls (Calibrate, Opacity, Toggle, Remove) ──
      var btnCalib = document.getElementById('planCalibrateScaleBtn');`;

const replaceUi_1 = `      // ── Underlay Controls (Move Blueprint, Calibrate, Opacity, Toggle, Remove) ──
      var btnMoveUnderlay = document.getElementById('planMoveUnderlayBtn');
      if (btnMoveUnderlay) {
        btnMoveUnderlay.addEventListener('click', function () {
          if (!self.editor.underlay || !self.editor.underlay.img) {
            alert('Please import a blueprint image first (click 🖼️ Import Blueprint).');
            return;
          }
          var isMoving = (self.editor.activeTool === 'move_underlay');
          if (isMoving) {
            self.editor.setTool('select');
            btnMoveUnderlay.classList.remove('is-active');
            btnMoveUnderlay.style.background = '';
            btnMoveUnderlay.style.color = '';
          } else {
            self.editor.setTool('move_underlay');
            var allToolBtns = document.querySelectorAll('.plan-tool-btn');
            allToolBtns.forEach(function (b) { b.classList.remove('is-active'); });
            btnMoveUnderlay.classList.add('is-active');
            btnMoveUnderlay.style.background = '#059669';
            btnMoveUnderlay.style.color = '#ffffff';
          }
          self.editor.render();
        });
      }

      var btnCalib = document.getElementById('planCalibrateScaleBtn');`;

replaceExact('orbix-ui.js', searchUi_1, replaceUi_1);

// 3. orbix-plan.js - Support move_underlay and pan tools, inner dimension conversion helper, and renderUnderlay UI
console.log('Updating orbix-plan.js...');

// Add getInnerLengthToCenterline method
const searchPlan_1 = `  // Parse user length input in either mm or imperial notation (e.g. 3000, 10', 10' 6", 120", 10ft)
  PlanEditor.prototype.parseDimInput = function (str) {
    if (!str) return 0;`;

const replacePlan_1 = `  // Converts target clear inner room dimension (mm) to wall centerline distance (mm) based on adjoining corner wall thicknesses
  PlanEditor.prototype.getInnerLengthToCenterline = function (targetInner, startPt, dirAngle, wallThickness) {
    wallThickness = wallThickness || (this.wallPreset && this.wallPreset.thickness) || 150;
    if (!targetInner || targetInner <= 0) return 0;

    var dedStart = 0;
    var dedEnd = 0;
    var walls = (this.project && this.project.plan && this.project.plan.walls) || [];

    if (startPt && walls.length > 0) {
      for (var wi = 0; wi < walls.length; wi++) {
        var ew = walls[wi];
        var oThick = ew.thickness || 150;
        if (Vec2.dist(startPt, ew.start) < 60 || Vec2.dist(startPt, ew.end) < 60) {
          var ewDir = Core.wallDirection(ew);
          var dotS = Math.abs(Math.cos(dirAngle) * ewDir.x + Math.sin(dirAngle) * ewDir.y);
          var sinS = Math.sqrt(Math.max(0.1, 1 - dotS * dotS));
          var dS = (oThick / 2.0) / sinS;
          if (dS > dedStart) dedStart = dS;
        }
      }
    }

    // If startPt has no connected wall yet (first wall of new room or chain):
    // Since a room/chain turns at corners meeting closing walls, assume standard corner deduction:
    if (dedStart === 0) {
      dedStart = wallThickness / 2.0;
    }

    // At end: in wall chain drawing, the next wall turns at a corner of wallThickness
    dedEnd = wallThickness / 2.0;

    return Math.round(targetInner + dedStart + dedEnd);
  };

  // Parse user length input in either mm or imperial notation (e.g. 3000, 10', 10' 6", 120", 10ft)
  PlanEditor.prototype.parseDimInput = function (str) {
    if (!str) return 0;`;

replaceExact('orbix-plan.js', searchPlan_1, replacePlan_1);

// Update snapPoint for inner dimension centerline conversion
const searchPlan_2 = `      var dx = worldPt.x - this.wallChainStart.x;
      var dy = worldPt.y - this.wallChainStart.y;
      var rawDist = Math.sqrt(dx * dx + dy * dy);
      var currentAngle = Math.atan2(dy, dx);
      var parsedTypedDist = this.parseDimInput(this.numericInputBuffer);
      var targetDist = (this.numericInputBuffer && parsedTypedDist > 0) ? parsedTypedDist : rawDist;`;

const replacePlan_2 = `      var dx = worldPt.x - this.wallChainStart.x;
      var dy = worldPt.y - this.wallChainStart.y;
      var rawDist = Math.sqrt(dx * dx + dy * dy);
      var currentAngle = Math.atan2(dy, dx);
      var parsedTypedDist = this.parseDimInput(this.numericInputBuffer);
      var targetCenterlineDist = (this.numericInputBuffer && parsedTypedDist > 0)
        ? this.getInnerLengthToCenterline(parsedTypedDist, this.wallChainStart, currentAngle, (this.wallPreset && this.wallPreset.thickness) || 150)
        : rawDist;
      var targetDist = targetCenterlineDist;`;

replaceExact('orbix-plan.js', searchPlan_2, replacePlan_2);

// In snapPoint angle & ortho handling
const searchPlan_3 = `        var distClean;
        if (this.numericInputBuffer && parsedTypedDist > 0) {
          distClean = parsedTypedDist;
          snapped.x = Math.round(this.wallChainStart.x + Math.cos(nearestOrtho) * distClean);
          snapped.y = Math.round(this.wallChainStart.y + Math.sin(nearestOrtho) * distClean);`;

const replacePlan_3 = `        var distClean;
        if (this.numericInputBuffer && parsedTypedDist > 0) {
          distClean = targetCenterlineDist;
          snapped.x = Math.round(this.wallChainStart.x + Math.cos(nearestOrtho) * distClean);
          snapped.y = Math.round(this.wallChainStart.y + Math.sin(nearestOrtho) * distClean);`;

replaceExact('orbix-plan.js', searchPlan_3, replacePlan_3);

const searchPlan_4 = `      // If numericInputBuffer is active on free angle:
      if (this.numericInputBuffer && parsedTypedDist > 0) {
        snapped.x = this.wallChainStart.x + Math.cos(currentAngle) * targetDist;
        snapped.y = this.wallChainStart.y + Math.sin(currentAngle) * targetDist;
        return { pt: snapped, type: 'typed', label: this.formatDim(targetDist) };
      }`;

const replacePlan_4 = `      // If numericInputBuffer is active on free angle:
      if (this.numericInputBuffer && parsedTypedDist > 0) {
        snapped.x = this.wallChainStart.x + Math.cos(currentAngle) * targetCenterlineDist;
        snapped.y = this.wallChainStart.y + Math.sin(currentAngle) * targetCenterlineDist;
        return { pt: snapped, type: 'typed', label: this.formatDim(parsedTypedDist) + ' [Inner]' };
      }`;

replaceExact('orbix-plan.js', searchPlan_4, replacePlan_4);

// In mousedown: support pan tool and move_underlay tool
const searchPlan_5 = `      // Middle mouse button or Spacebar held -> Pan
      if (e.button === 1 || e.spaceKey) {
        self.dragState = { type: 'pan', startScreen: mouseScreen, startPan: { x: self.pan.x, y: self.pan.y } };
        return;
      }

      if (e.button === 2) { // Right click cancels / finishes wall chain or divider
        if (self.dadoDrawStart) {
          self.dadoDrawStart = null;
          self.render();
          return;
        }
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
      }`;

const replacePlan_5 = `      // Middle mouse button, Spacebar held, or Pan View tool -> Pan
      if (e.button === 1 || e.spaceKey || self.activeTool === 'pan') {
        if (self.canvas) self.canvas.style.cursor = 'grabbing';
        self.dragState = { type: 'pan', startScreen: mouseScreen, startPan: { x: self.pan.x, y: self.pan.y } };
        return;
      }

      if (e.button === 2) { // Right click cancels / finishes wall chain or divider
        if (self.dadoDrawStart) {
          self.dadoDrawStart = null;
          self.render();
          return;
        }
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

      // Move Blueprint tool or Alt-drag -> Move Floor Plan Blueprint Image
      if ((self.activeTool === 'move_underlay' || e.altKey) && self.underlay && self.underlay.img) {
        if (self.canvas) self.canvas.style.cursor = 'grabbing';
        self.dragState = {
          type: 'move_underlay',
          startScreen: mouseScreen,
          origUnderlayPos: { x: self.underlay.x || 0, y: self.underlay.y || 0 }
        };
        return;
      }`;

replaceExact('orbix-plan.js', searchPlan_5, replacePlan_5);

// Reset cursor on mouseup
const searchPlan_6 = `        self.dragState = null;
        self.render();`;

const replacePlan_6 = `        self.dragState = null;
        if (self.canvas) {
          if (self.activeTool === 'pan' || self.activeTool === 'move_underlay') {
            self.canvas.style.cursor = 'grab';
          }
        }
        self.render();`;

replaceExact('orbix-plan.js', searchPlan_6, replacePlan_6);

// In handleKeyDown on Enter: calculate exact centerline for target inner length
const searchPlan_7 = `          var targetL = self.parseDimInput(self.numericInputBuffer);
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
          }`;

const replacePlan_7 = `          var targetInner = self.parseDimInput(self.numericInputBuffer);
          if (targetInner > 50) {
            var snappedEnd = self.snapPoint(self.cursorWorld);
            var dx = snappedEnd.pt.x - self.wallChainStart.x;
            var dy = snappedEnd.pt.y - self.wallChainStart.y;
            var ang = Math.atan2(dy, dx);
            var targetCenterline = self.getInnerLengthToCenterline(targetInner, self.wallChainStart, ang, self.wallPreset.thickness);
            var exactEndPt = {
              x: Math.round(self.wallChainStart.x + Math.cos(ang) * targetCenterline),
              y: Math.round(self.wallChainStart.y + Math.sin(ang) * targetCenterline)
            };
            if (Vec2.dist(self.wallChainStart, exactEndPt) > 50) {
              var newW = Core.createWall({
                start: self.wallChainStart,
                end: exactEndPt,
                thickness: self.wallPreset.thickness,
                height: self.wallPreset.height
              });
              self.project.plan.walls.push(newW);
              self.pushHistory('Draw Wall (' + self.formatDim(targetInner) + ' Inner)');
              self.wallChainStart = Vec2.clone(exactEndPt);
              self.numericInputBuffer = '';
              if (Core.detectRooms) Core.detectRooms(self.project);
              self.render();
              return;
            }
          }`;

replaceExact('orbix-plan.js', searchPlan_7, replacePlan_7);

// In setTool: cursor management for pan and move_underlay
const searchPlan_8 = `    if (this.canvas) {
      if (tool === 'wall' || tool === 'divider' || tool === 'dimension' || tool === 'dado') {
        this.canvas.style.cursor = 'crosshair';
      } else {
        this.canvas.style.cursor = 'default';
      }
    }`;

const replacePlan_8 = `    if (this.canvas) {
      if (tool === 'wall' || tool === 'divider' || tool === 'dimension' || tool === 'dado') {
        this.canvas.style.cursor = 'crosshair';
      } else if (tool === 'pan' || tool === 'move_underlay') {
        this.canvas.style.cursor = 'grab';
      } else {
        this.canvas.style.cursor = 'default';
      }
    }`;

replaceExact('orbix-plan.js', searchPlan_8, replacePlan_8);

// In renderUnderlay: highlight and UI guidance in move_underlay mode
const searchPlan_9 = `    // Subtle dashed blueprint boundary
    ctx.strokeStyle = 'rgba(27, 79, 114, 0.45)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(topLeft.x, topLeft.y, wPx, hPx);
    ctx.restore();`;

const replacePlan_9 = `    var isMoving = (this.activeTool === 'move_underlay');
    if (isMoving) {
      // Prominent green/cyan dashed border and corner handles when moving blueprint
      ctx.strokeStyle = '#059669';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([8, 5]);
      ctx.strokeRect(topLeft.x, topLeft.y, wPx, hPx);
      ctx.setLineDash([]);

      // Corner handles
      var corners = [
        { x: topLeft.x, y: topLeft.y },
        { x: topLeft.x + wPx, y: topLeft.y },
        { x: topLeft.x + wPx, y: topLeft.y + hPx },
        { x: topLeft.x, y: topLeft.y + hPx }
      ];
      ctx.fillStyle = '#059669';
      corners.forEach(function (c) {
        ctx.fillRect(c.x - 5, c.y - 5, 10, 10);
      });

      // Top notification badge
      var badgeText = '✋ Move Blueprint Active: Drag anywhere to align blueprint under walls (Press Esc to finish)';
      ctx.font = '700 12px "IBM Plex Sans", sans-serif';
      var tw = ctx.measureText(badgeText).width;
      var bx = topLeft.x + wPx / 2;
      var by = Math.max(25, topLeft.y - 15);
      ctx.fillStyle = 'rgba(5, 150, 105, 0.95)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx - tw / 2 - 12, by - 12, tw + 24, 24, 6);
      else ctx.rect(bx - tw / 2 - 12, by - 12, tw + 24, 24);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, bx, by);
    } else {
      // Subtle dashed blueprint boundary
      ctx.strokeStyle = 'rgba(27, 79, 114, 0.45)';
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(topLeft.x, topLeft.y, wPx, hPx);
    }
    ctx.restore();`;

replaceExact('orbix-plan.js', searchPlan_9, replacePlan_9);

// In renderWallDimensions: Ensure active chain walls show inner dimension immediately
const searchPlan_10 = `      var planObj = this.project && this.project.plan;
      var innerMm = (Core.getWallInnerLength ? Core.getWallInnerLength(w, planObj) : lMm);
      var innerSeg = (Core.getWallInnerSegment ? Core.getWallInnerSegment(w, planObj) : null);
      var hasAdjoining = innerSeg && (innerSeg.startDeduction > 10 || innerSeg.endDeduction > 10);
      var ptStart = hasAdjoining ? innerSeg.start : w.start;
      var ptEnd = hasAdjoining ? innerSeg.end : w.end;`;

const replacePlan_10 = `      var planObj = this.project && this.project.plan;
      var innerMm = (Core.getWallInnerLength ? Core.getWallInnerLength(w, planObj) : lMm);
      var innerSeg = (Core.getWallInnerSegment ? Core.getWallInnerSegment(w, planObj) : null);
      var isChainActive = (this.wallChainStart && (Vec2.dist(w.end, this.wallChainStart) < 10 || Vec2.dist(w.start, this.wallChainStart) < 10));
      var hasAdjoining = (innerSeg && (innerSeg.startDeduction > 10 || innerSeg.endDeduction > 10)) || isChainActive;
      if (isChainActive && (!innerSeg || (innerSeg.startDeduction <= 10 && innerSeg.endDeduction <= 10))) {
        innerMm = Math.max(0, lMm - (w.thickness || 150));
      }
      var ptStart = (innerSeg && innerSeg.startDeduction > 10) ? innerSeg.start : w.start;
      var ptEnd = (innerSeg && innerSeg.endDeduction > 10) ? innerSeg.end : w.end;`;

replaceExact('orbix-plan.js', searchPlan_10, replacePlan_10);

// In typing HUD & dimension indicator: show Inner dimension label
const searchPlan_11 = `        var parsedLen = this.parseDimInput(this.numericInputBuffer);
        var previewFormatted = parsedLen > 0 ? (' = ' + this.formatDim(parsedLen)) : '';
        var hudText = '⌨ Length: [ ' + this.numericInputBuffer + ' ]' + previewFormatted + '  (↵ Enter to draw)';`;

const replacePlan_11 = `        var parsedLen = this.parseDimInput(this.numericInputBuffer);
        var previewFormatted = parsedLen > 0 ? (' = ' + this.formatDim(parsedLen) + ' [Inner]') : '';
        var hudText = '⌨ Inner: [ ' + this.numericInputBuffer + ' ]' + previewFormatted + '  (↵ Enter to draw)';`;

replaceExact('orbix-plan.js', searchPlan_11, replacePlan_11);

const searchPlan_12 = `        var sDed = sConnW ? ((sConnW.thickness || 150) / 2) : 0;
        var eDed = eConnW ? ((eConnW.thickness || 150) / 2) : 0;
        var innerPrev = Math.max(0, distMm - (sDed + eDed));

        var dText = (sDed > 0 || eDed > 0) ?
          (this.formatDim(innerPrev) + ' [Inner] · ' + this.formatDim(distMm)) :
          this.formatDim(distMm);`;

const replacePlan_12 = `        var sDed = sConnW ? ((sConnW.thickness || 150) / 2) : 75;
        var eDed = eConnW ? ((eConnW.thickness || 150) / 2) : 75;
        var innerPrev = Math.max(0, distMm - (sDed + eDed));

        var dText = (this.numericInputBuffer && parsedLen > 0)
          ? (this.formatDim(parsedLen) + ' [Inner]')
          : ((sDed > 0 || eDed > 0)
            ? (this.formatDim(innerPrev) + ' [Inner]')
            : this.formatDim(distMm));`;

replaceExact('orbix-plan.js', searchPlan_12, replacePlan_12);

console.log('All blueprint & inner dimension updates applied cleanly!');
