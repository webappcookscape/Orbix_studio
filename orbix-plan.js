/* ═══════════════════════════════════════════════════════════════════════════════
   ORBIX STUDIO — 2D Architectural Plan Editor Component
   Interactive Canvas Editor for Drawing Residential Floor Plans
   ═══════════════════════════════════════════════════════════════════════════════ */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./orbix-core.js'));
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

  // Snapping logic: Joint Snap -> Perpendicular/Parallel -> Orthogonal -> Grid Snap
  PlanEditor.prototype.snapPoint = function (worldPt, ignoreWallId) {
    var snapDistMm = 200; // snapping radius in mm
    var snapped = Vec2.clone(worldPt);
    var walls = (this.project && this.project.plan && this.project.plan.walls) || [];

    // 1. Vertex magnetic snap to existing wall endpoints / joints
    for (var i = 0; i < walls.length; i++) {
      var w = walls[i];
      if (w.id === ignoreWallId) continue;
      if (Vec2.dist(worldPt, w.start) < snapDistMm) {
        return { pt: Vec2.clone(w.start), type: 'joint', target: w.start, label: 'Wall Joint' };
      }
      if (Vec2.dist(worldPt, w.end) < snapDistMm) {
        return { pt: Vec2.clone(w.end), type: 'joint', target: w.end, label: 'Wall Joint' };
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

      // 2a. Perpendicular & Parallel guides relative to existing walls
      for (var j = 0; j < walls.length; j++) {
        var ew = walls[j];
        if (ew.id === ignoreWallId) continue;
        var ewAngle = Math.atan2(ew.end.y - ew.start.y, ew.end.x - ew.start.x);

        // Parallel angles: ewAngle, ewAngle + PI, ewAngle - PI
        var parAngles = [ewAngle, ewAngle + Math.PI, ewAngle - Math.PI];
        for (var p = 0; p < parAngles.length; p++) {
          var diffP = Math.atan2(Math.sin(currentAngle - parAngles[p]), Math.cos(currentAngle - parAngles[p]));
          if (Math.abs(diffP) < 0.12) { // within ~7 degrees
            var snapAngle = parAngles[p];
            snapped.x = this.wallChainStart.x + Math.cos(snapAngle) * targetDist;
            snapped.y = this.wallChainStart.y + Math.sin(snapAngle) * targetDist;
            return {
              pt: snapped,
              type: 'parallel',
              target: ew,
              label: '∥ Parallel',
              angleDeg: Math.round(((snapAngle * 180 / Math.PI) % 360 + 360) % 360)
            };
          }
        }

        // Perpendicular angles: ewAngle + PI/2, ewAngle - PI/2
        var perpAngles = [ewAngle + Math.PI / 2, ewAngle - Math.PI / 2];
        for (var q = 0; q < perpAngles.length; q++) {
          var diffQ = Math.atan2(Math.sin(currentAngle - perpAngles[q]), Math.cos(currentAngle - perpAngles[q]));
          if (Math.abs(diffQ) < 0.12) {
            var snapAnglePerp = perpAngles[q];
            snapped.x = this.wallChainStart.x + Math.cos(snapAnglePerp) * targetDist;
            snapped.y = this.wallChainStart.y + Math.sin(snapAnglePerp) * targetDist;
            return {
              pt: snapped,
              type: 'perpendicular',
              target: ew,
              label: '⊥ 90° Perpendicular',
              angleDeg: Math.round(((snapAnglePerp * 180 / Math.PI) % 360 + 360) % 360)
            };
          }
        }
      }

      // 2b. Orthogonal snapping: 0°, 90°, 180°, 270° (or 45° increments)
      var snapStep = Math.PI / 4; // 45 degrees
      var nearestAngle = Math.round(currentAngle / snapStep) * snapStep;
      if (Math.abs(currentAngle - nearestAngle) < 0.15) { // within ~8.5 degrees
        snapped.x = this.wallChainStart.x + Math.cos(nearestAngle) * targetDist;
        snapped.y = this.wallChainStart.y + Math.sin(nearestAngle) * targetDist;
        var deg = Math.round(((nearestAngle * 180 / Math.PI) % 360 + 360) % 360);
        var orthoLabel = (deg === 0 || deg === 180) ? '180° Straight' : (deg === 90 || deg === 270) ? '90° Orthogonal' : deg + '° Angle';
        return {
          pt: snapped,
          type: (deg % 90 === 0) ? 'ortho' : 'angle',
          label: orthoLabel,
          angleDeg: deg
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

    return { pt: snapped, type: 'grid' };
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
        this.project.plan.walls = walls.filter(function (w) { return w.id !== item.id; });
        // Also remove openings on this wall
        this.project.plan.openings = openings.filter(function (op) { return op.wallId !== item.id; });
        deletedSomething = true;
      } else if (item.type === 'opening') {
        this.project.plan.openings = openings.filter(function (op) { return op.id !== item.id; });
        deletedSomething = true;
      } else if (item.type === 'furniture') {
        this.project.plan.furniture = furniture.filter(function (f) { return f.id !== item.id; });
        deletedSomething = true;
      }
    }

    if (deletedSomething) {
      this.selected = [];
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
      self.zoom = Math.max(0.02, Math.min(2.5, self.zoom * zoomFactor));

      var mouseScreenAfter = self.worldToScreen(mouseWorldBefore);
      self.pan.x += (mouseScreen.x - mouseScreenAfter.x);
      self.pan.y += (mouseScreen.y - mouseScreenAfter.y);
      self.render();
    }, { passive: false });

    this.canvas.addEventListener('mousedown', function (e) {
      var rect = self.canvas.getBoundingClientRect();
      var mouseScreen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      var worldPt = self.screenToWorld(mouseScreen);

      // Middle mouse button or Spacebar held -> Pan
      if (e.button === 1 || e.spaceKey) {
        self.dragState = { type: 'pan', startScreen: mouseScreen, startPan: { x: self.pan.x, y: self.pan.y } };
        return;
      }

      if (e.button === 2) { // Right click cancels wall chain
        if (self.wallChainStart) {
          self.wallChainStart = null;
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

      if (self.activeTool === 'select') {
        self.handleSelectMouseDown(worldPt, e.shiftKey);
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
      }
    });

    window.addEventListener('mousemove', function (e) {
      var rect = self.canvas.getBoundingClientRect();
      var mouseScreen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      self.cursorWorld = self.screenToWorld(mouseScreen);

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

      if (self.dragState && self.dragState.type === 'move_vertex') {
        var snapped = self.snapPoint(self.cursorWorld, self.dragState.wallId);
        var refs = self.dragState.connectedRefs || [self.dragState.vertexRef];
        for (var cr = 0; cr < refs.length; cr++) {
          refs[cr].x = snapped.pt.x;
          refs[cr].y = snapped.pt.y;
        }
        self.render();
        return;
      }

      if (self.dragState && self.dragState.type === 'move_wall') {
        var dx = self.cursorWorld.x - self.dragState.startWorld.x;
        var dy = self.cursorWorld.y - self.dragState.startWorld.y;
        self.dragState.wall.start.x = self.dragState.origStart.x + dx;
        self.dragState.wall.start.y = self.dragState.origStart.y + dy;
        self.dragState.wall.end.x = self.dragState.origEnd.x + dx;
        self.dragState.wall.end.y = self.dragState.origEnd.y + dy;
        if (self.dragState.connectedStart) {
          for (var cs = 0; cs < self.dragState.connectedStart.length; cs++) {
            self.dragState.connectedStart[cs].ref.x = self.dragState.connectedStart[cs].orig.x + dx;
            self.dragState.connectedStart[cs].ref.y = self.dragState.connectedStart[cs].orig.y + dy;
          }
        }
        if (self.dragState.connectedEnd) {
          for (var ce = 0; ce < self.dragState.connectedEnd.length; ce++) {
            self.dragState.connectedEnd[ce].ref.x = self.dragState.connectedEnd[ce].orig.x + dx;
            self.dragState.connectedEnd[ce].ref.y = self.dragState.connectedEnd[ce].orig.y + dy;
          }
        }
        self.render();
        return;
      }

      if (self.dragState && self.dragState.type === 'move_furniture') {
        var dx = self.cursorWorld.x - self.dragState.startWorld.x;
        var dy = self.cursorWorld.y - self.dragState.startWorld.y;
        var newX = Math.round((self.dragState.origPos.x + dx) / 50) * 50;
        var newY = Math.round((self.dragState.origPos.y + dy) / 50) * 50;
        self.dragState.furniture.pos.x = newX;
        self.dragState.furniture.pos.y = newY;
        var rooms = self.project.plan.rooms || [];
        for (var rm = 0; rm < rooms.length; rm++) {
          if (Core.Vec2.pointInPolygon(self.dragState.furniture.pos, rooms[rm].polygon)) {
            self.dragState.furniture.roomId = rooms[rm].id;
            break;
          }
        }
        // Collision check with other furniture units (SAT OBB + Elevation)
        var colCheck = Core.checkFurnitureCollision(self.dragState.furniture, self.project.plan.furniture, self.dragState.furniture.id);
        self.dragState.hasCollision = colCheck.collided;
        self.dragState.collidedWith = colCheck.other;
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

      // Live drawing render
      if (self.activeTool === 'wall' || self.activeTool === 'door' || self.activeTool === 'window' || self.activeTool === 'furniture' || self.activeTool === 'calibrate' || self.wallChainStart) {
        self.render();
      }
    });

    window.addEventListener('mouseup', function () {
      if (self.dragState) {
        if (self.dragState.type === 'move_furniture') {
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
        } else if (self.dragState.type === 'move_vertex' || self.dragState.type === 'move_wall' || self.dragState.type === 'move_opening') {
          self.pushHistory('Move Wall');
        }
        self.dragState = null;
        self.render();
        if (typeof window !== 'undefined' && window.OrbixUI) {
          if (window.OrbixUI.syncProjectUnitsTo3DStudio) window.OrbixUI.syncProjectUnitsTo3DStudio();
          if (window.OrbixUI.render3DHome) window.OrbixUI.render3DHome(true);
        }
      }
    });

    // Keyboard shortcuts (Undo, Redo, Delete, Escape, Number Input)
    window.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'Escape') {
        if (self.activeTool === 'calibrate') {
          self.activeTool = 'select';
          if (self.underlay) self.underlay.calibPoints = [];
          self.render();
          return;
        }
        if (self.wallChainStart) {
          self.wallChainStart = null;
          self.numericInputBuffer = '';
          self.render();
          return;
        }
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
      if (e.code === 'Space' || e.key === ' ' || e.key === 'r' || e.key === 'R') {
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

  PlanEditor.prototype.handleSelectMouseDown = function (worldPt, isShift) {
    // Check if clicked an endpoint handle of a selected wall
    for (var s = 0; s < this.selected.length; s++) {
      if (this.selected[s].type === 'wall') {
        var w = this.getWall(this.selected[s].id);
        if (w) {
          if (Vec2.dist(worldPt, w.start) < 200) {
            var connected = [w.start];
            if (w.startLocked !== false) {
              var allW = (this.project && this.project.plan && this.project.plan.walls) || [];
              for (var ci = 0; ci < allW.length; ci++) {
                var ow = allW[ci];
                if (ow.id === w.id) continue;
                if (Vec2.dist(ow.start, w.start) < 30 && ow.startLocked !== false) connected.push(ow.start);
                if (Vec2.dist(ow.end, w.start) < 30 && ow.endLocked !== false) connected.push(ow.end);
              }
            }
            this.dragState = {
              type: 'move_vertex',
              wallId: w.id,
              vertexRef: w.start,
              connectedRefs: connected
            };
            return;
          }
          if (Vec2.dist(worldPt, w.end) < 200) {
            var connected = [w.end];
            if (w.endLocked !== false) {
              var allW = (this.project && this.project.plan && this.project.plan.walls) || [];
              for (var ci2 = 0; ci2 < allW.length; ci2++) {
                var ow2 = allW[ci2];
                if (ow2.id === w.id) continue;
                if (Vec2.dist(ow2.start, w.end) < 30 && ow2.startLocked !== false) connected.push(ow2.start);
                if (Vec2.dist(ow2.end, w.end) < 30 && ow2.endLocked !== false) connected.push(ow2.end);
              }
            }
            this.dragState = {
              type: 'move_vertex',
              wallId: w.id,
              vertexRef: w.end,
              connectedRefs: connected
            };
            return;
          }
        }
      }
    }

    // Check if clicked an opening
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

    // Check if clicked a furniture unit (Supports rotated OBBs!)
    var furnList = this.project.plan.furniture || [];
    for (var f = furnList.length - 1; f >= 0; f--) {
      var fn = furnList[f];
      var poly = Core.getFurniturePolygon(fn);
      if (Core.Vec2.pointInPolygon(worldPt, poly)) {
        this.selected = [{ type: 'furniture', id: fn.id }];
        this.dragState = {
          type: 'move_furniture',
          furniture: fn,
          startWorld: Vec2.clone(worldPt),
          origPos: Vec2.clone(fn.pos)
        };
        this.onSelectionChange(this.selected);
        this.render();
        return;
      }
    }

    // Check if clicked a wall
    var near = this.findNearestWall(worldPt, 250);
    if (near) {
      if (!isShift) this.selected = [];
      this.selected.push({ type: 'wall', id: near.wall.id });
      var connStart = [];
      var connEnd = [];
      var allWalls = (this.project && this.project.plan && this.project.plan.walls) || [];
      if (near.wall.startLocked !== false) {
        for (var i = 0; i < allWalls.length; i++) {
          var cw = allWalls[i];
          if (cw.id === near.wall.id) continue;
          if (Vec2.dist(cw.start, near.wall.start) < 30 && cw.startLocked !== false) {
            connStart.push({ ref: cw.start, orig: Vec2.clone(cw.start) });
          }
          if (Vec2.dist(cw.end, near.wall.start) < 30 && cw.endLocked !== false) {
            connStart.push({ ref: cw.end, orig: Vec2.clone(cw.end) });
          }
        }
      }
      if (near.wall.endLocked !== false) {
        for (var j = 0; j < allWalls.length; j++) {
          var dw = allWalls[j];
          if (dw.id === near.wall.id) continue;
          if (Vec2.dist(dw.start, near.wall.end) < 30 && dw.startLocked !== false) {
            connEnd.push({ ref: dw.start, orig: Vec2.clone(dw.start) });
          }
          if (Vec2.dist(dw.end, near.wall.end) < 30 && dw.endLocked !== false) {
            connEnd.push({ ref: dw.end, orig: Vec2.clone(dw.end) });
          }
        }
      }
      this.dragState = {
        type: 'move_wall',
        wall: near.wall,
        startWorld: Vec2.clone(worldPt),
        origStart: Vec2.clone(near.wall.start),
        origEnd: Vec2.clone(near.wall.end),
        connectedStart: connStart,
        connectedEnd: connEnd
      };
      this.onSelectionChange(this.selected);
      this.render();
      return;
    }

    // Check if clicked inside a room polygon
    var rooms = (this.project && this.project.plan && this.project.plan.rooms) || [];
    for (var r = 0; r < rooms.length; r++) {
      if (rooms[r].polygon && rooms[r].polygon.length >= 3 && Core.Vec2.pointInPolygon(worldPt, rooms[r].polygon)) {
        if (!isShift) this.selected = [];
        this.selected.push({ type: 'room', id: rooms[r].id });
        this.onSelectionChange(this.selected);
        this.render();
        return;
      }
    }

    // Clicked empty space -> clear selection
    if (!isShift) {
      this.selected = [];
      this.onSelectionChange(this.selected);
      this.render();
    }
  };

  PlanEditor.prototype.handleWallMouseDown = function (worldPt) {
    var snapped = this.snapPoint(worldPt);
    if (!this.wallChainStart) {
      this.wallChainStart = Vec2.clone(snapped.pt);
      this.numericInputBuffer = '';
    } else {
      var endPt = Vec2.clone(snapped.pt);
      if (Vec2.dist(this.wallChainStart, endPt) > 100) {
        var newW = Core.createWall({
          start: this.wallChainStart,
          end: endPt,
          thickness: this.wallPreset.thickness,
          height: this.wallPreset.height
        });
        this.project.plan.walls.push(newW);
        this.pushHistory('Draw Wall');
        // Chain to the next wall
        this.wallChainStart = Vec2.clone(endPt);
        this.numericInputBuffer = '';
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

  PlanEditor.prototype.handleFurnitureMouseDown = function (worldPt) {
    if (!this.furniturePreset) return;
    var snapped = this.snapPoint(worldPt);

    var matchedRoomId = null;
    var rooms = this.project.plan.rooms || [];
    for (var r = 0; r < rooms.length; r++) {
      if (Core.Vec2.pointInPolygon(snapped.pt, rooms[r].polygon)) {
        matchedRoomId = rooms[r].id;
        break;
      }
    }

    var isWall = (Core.isWallUnit) ?
      Core.isWallUnit(this.furniturePreset.category, this.furniturePreset.name) :
      ((this.furniturePreset.category && this.furniturePreset.category.toLowerCase().indexOf('wall') !== -1) ||
       (this.furniturePreset.name && this.furniturePreset.name.toLowerCase().indexOf('wall') !== -1));
    var presetElev = (this.furniturePreset.elevation !== undefined && this.furniturePreset.elevation !== null) ?
      this.furniturePreset.elevation : (isWall ? 1500 : 0);

    var furn = Core.createFurniturePlacement({
      name: this.furniturePreset.name,
      category: this.furniturePreset.category,
      roomId: matchedRoomId,
      elevation: presetElev,
      pos: { x: snapped.pt.x, y: snapped.pt.y, z: presetElev },
      rotY: this.furnitureRotY || 0,
      dimensions: Object.assign({}, this.furniturePreset.dimensions),
      unitConfig: Object.assign({}, this.furniturePreset.unitConfig || {})
    });

    this.project.plan.furniture.push(furn);
    this.pushHistory('Place ' + furn.name);
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
          Core.isWallUnit(orig.category, orig.name) :
          ((orig.category && orig.category.toLowerCase().indexOf('wall') !== -1) ||
           (orig.name && orig.name.toLowerCase().indexOf('wall') !== -1));
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

      // Room Center Label
      var centroid = Core.Vec2.polygonCentroid(r.polygon);
      var cScreen = this.worldToScreen(centroid);

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
    var walls = this.project.plan.walls;
    for (var i = 0; i < walls.length; i++) {
      var w = walls[i];
      var isSelected = this.isSelected('wall', w.id);
      var poly = Core.wallPolygon(w);

      // Fill wall thickness
      ctx.fillStyle = isSelected ? '#1B4F72' : '#33302B';
      ctx.beginPath();
      var sp0 = this.worldToScreen(poly[0]);
      ctx.moveTo(sp0.x, sp0.y);
      for (var p = 1; p < poly.length; p++) {
        var sp = this.worldToScreen(poly[p]);
        ctx.lineTo(sp.x, sp.y);
      }
      ctx.closePath();
      ctx.fill();

      // Outer outline
      ctx.strokeStyle = isSelected ? '#2E7BB5' : '#1A1816';
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.stroke();

      // If selected, draw handles at endpoints and joint locks
      if (isSelected) {
        this.renderHandle(ctx, w.start);
        this.renderHandle(ctx, w.end);
        this.renderLockBadge(ctx, w.start, w.startLocked !== false);
        this.renderLockBadge(ctx, w.end, w.endLocked !== false);
      }
    }
  };

  PlanEditor.prototype.renderLockBadge = function (ctx, pt, isLocked) {
    var s = this.worldToScreen(pt);
    ctx.save();
    ctx.font = '12px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isLocked ? '#eff6ff' : '#fef2f2';
    ctx.strokeStyle = isLocked ? '#2563eb' : '#dc2626';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isLocked ? '#1e40af' : '#b91c1c';
    ctx.fillText(isLocked ? '🔒' : '🔓', s.x, s.y);
    ctx.restore();
  };

  PlanEditor.prototype.renderCornerAngles = function (ctx) {
    var walls = (this.project && this.project.plan && this.project.plan.walls) || [];
    if (walls.length < 2 || this.zoom < 0.03) return;

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
    var arcR = Math.max(16, 280 * this.zoom);

    if (Math.abs(deg - 90) <= 2) {
      var sqSize = Math.max(12, 180 * this.zoom);
      var sP1 = { x: sJnt.x + v1.x * sqSize, y: sJnt.y + v1.y * sqSize };
      var sP2 = { x: sJnt.x + (v1.x + v2.x) * sqSize, y: sJnt.y + (v1.y + v2.y) * sqSize };
      var sP3 = { x: sJnt.x + v2.x * sqSize, y: sJnt.y + v2.y * sqSize };
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sP1.x, sP1.y);
      ctx.lineTo(sP2.x, sP2.y);
      ctx.lineTo(sP3.x, sP3.y);
      ctx.stroke();
    } else {
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      var diff = a2 - a1;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      ctx.arc(sJnt.x, sJnt.y, arcR, a1, a2, diff < 0);
      ctx.stroke();
    }

    var badgeDist = arcR + 14;
    var sBadge = { x: sJnt.x + midV.x * badgeDist, y: sJnt.y + midV.y * badgeDist };
    var degTxt = deg + '°';
    ctx.font = '700 10.5px "IBM Plex Sans", monospace';
    var tw = ctx.measureText(degTxt).width;
    ctx.fillStyle = '#eff6ff';
    ctx.strokeStyle = '#bfdbfe';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(sBadge.x - tw / 2 - 4, sBadge.y - 7, tw + 8, 14, 3);
    else ctx.rect(sBadge.x - tw / 2 - 4, sBadge.y - 7, tw + 8, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#1e40af';
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
    if (lMm < 150 || this.zoom < 0.03) return;

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

    // Collect openings on this wall
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

    var halfT = (w.thickness || 150) / 2;
    var dimOffset = halfT + 220; // offset in world mm from wall center

    var wallAngle = Math.atan2(w.end.y - w.start.y, w.end.x - w.start.x);
    var textAngle = wallAngle;
    if (textAngle > Math.PI / 2) textAngle -= Math.PI;
    else if (textAngle < -Math.PI / 2) textAngle += Math.PI;

    var strokeColor = isActive ? '#2563eb' : '#64748b';
    var textColor = isActive ? '#1d4ed8' : '#334155';
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

      // Unit direction along wall: toward A (-wDir) or toward B (+wDir)
      var ax = dirToward === 'A' ? -wDir.x : wDir.x;
      var ay = dirToward === 'A' ? -wDir.y : wDir.y;
      var anX = -ay, anY = ax;

      ctx.save();
      // Arrow centerline along wall core
      var pStart = self.worldToScreen({ x: midW.x - ax * 60, y: midW.y - ay * 60 });
      var pTip = self.worldToScreen({ x: midW.x + ax * 60, y: midW.y + ay * 60 });
      ctx.strokeStyle = isActive ? '#2563eb' : 'rgba(100, 116, 139, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(pStart.x, pStart.y);
      ctx.lineTo(pTip.x, pTip.y);
      ctx.stroke();

      // Arrowhead at pTip
      var arrowHeadSize = 8;
      ctx.fillStyle = isActive ? '#2563eb' : '#64748b';
      ctx.beginPath();
      ctx.moveTo(pTip.x, pTip.y);
      ctx.lineTo(pTip.x - ax * arrowHeadSize + anX * (arrowHeadSize * 0.6), pTip.y - ay * arrowHeadSize + anY * (arrowHeadSize * 0.6));
      ctx.lineTo(pTip.x - ax * (arrowHeadSize * 0.6), pTip.y - ay * (arrowHeadSize * 0.6));
      ctx.lineTo(pTip.x - ax * arrowHeadSize - anX * (arrowHeadSize * 0.6), pTip.y - ay * arrowHeadSize - anY * (arrowHeadSize * 0.6));
      ctx.closePath();
      ctx.fill();

      // Digit label (1 or 2)
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

    // Helper: Draw dimension text pill on screen
    var drawDimPill = function (midX, midY, text) {
      ctx.save();
      ctx.translate(midX, midY);
      ctx.rotate(textAngle);
      ctx.font = isActive ? '700 11px "IBM Plex Mono", monospace' : '600 10.5px "IBM Plex Mono", monospace';
      var tw = ctx.measureText(text).width;
      var th = 16;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-tw / 2 - 4, -th / 2, tw + 8, th);
      ctx.fillStyle = textColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 0, 0);
      ctx.restore();
    };

    // Case 1: Wall with NO openings
    if (wallOpenings.length === 0) {
      var dsWorld = { x: w.start.x + norm.x * dimOffset, y: w.start.y + norm.y * dimOffset };
      var deWorld = { x: w.end.x + norm.x * dimOffset, y: w.end.y + norm.y * dimOffset };
      var sDs = this.worldToScreen(dsWorld);
      var sDe = this.worldToScreen(deWorld);

      // Extension witness lines
      var wsOff = this.worldToScreen({ x: w.start.x + norm.x * (halfT + 15), y: w.start.y + norm.y * (halfT + 15) });
      var weOff = this.worldToScreen({ x: w.end.x + norm.x * (halfT + 15), y: w.end.y + norm.y * (halfT + 15) });
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

      // Dimension text pill
      var midX = (sDs.x + sDe.x) / 2;
      var midY = (sDs.y + sDe.y) / 2;
      var dimText = this.formatDim(lMm);
      drawDimPill(midX, midY, dimText);

      // If active, show Corner A, Corner B, and Arrow 1
      if (isActive) {
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

    // 5. Corner Labels A and B, plus Direction Arrows 1 and 2
    drawCornerLabel(w.start, 'A', -1);
    drawCornerLabel(w.end, 'B', 1);

    // Direction arrow 1 in Segment 1 (start to first opening start)
    var firstOpStartT = cleanDivs.length > 2 ? cleanDivs[1] : 0;
    drawCoreArrow(0, firstOpStartT, 'A', '1');

    // Direction arrow 2 in Segment 2 (last opening end to end B)
    var lastOpEndT = cleanDivs.length > 2 ? cleanDivs[cleanDivs.length - 2] : lMm;
    drawCoreArrow(lastOpEndT, lMm, 'B', '2');

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

      // Furniture body boundary (Red if colliding!)
      if (isColliding) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
        ctx.fillRect(-wPx / 2, -dPx / 2, wPx, dPx);
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(-wPx / 2, -dPx / 2, wPx, dPx);
      } else {
        ctx.fillStyle = isSelected ? 'rgba(46, 123, 181, 0.22)' : 'rgba(110, 78, 53, 0.12)';
        ctx.fillRect(-wPx / 2, -dPx / 2, wPx, dPx);
        ctx.strokeStyle = isSelected ? '#1B4F72' : '#6E4E35';
        ctx.lineWidth = isSelected ? 2 : 1.2;
        ctx.strokeRect(-wPx / 2, -dPx / 2, wPx, dPx);
      }

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

      // Labels: Name + Size
      ctx.fillStyle = isColliding ? '#991b1b' : (isSelected ? '#1e3a8a' : '#23211E');
      ctx.font = '600 10.5px "IBM Plex Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(f.name, 0, -6);

      ctx.fillStyle = isColliding ? '#dc2626' : (isSelected ? '#1d4ed8' : '#78716c');
      ctx.font = '500 9px "IBM Plex Mono", monospace';
      ctx.fillText(Math.round(wMm) + ' × ' + Math.round(dMm) + ' mm', 0, 8);

      // Elevation badge if wall mounted (Elevation > 0)
      var elevMm = f.elevation !== undefined ? f.elevation : ((f.pos && f.pos.z) || 0);
      if (elevMm > 0) {
        ctx.fillStyle = '#0284c7';
        ctx.font = '700 8.5px "IBM Plex Mono", monospace';
        ctx.fillText('▲ ' + Math.round(elevMm) + ' mm AFFL', 0, 21);
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

      ctx.restore();
    }
  };

  PlanEditor.prototype.renderPreview = function (ctx) {
    // 1. Wall drawing preview line & dynamic guidelines
    if (this.wallChainStart) {
      var snap = this.snapPoint(this.cursorWorld);
      var sStart = this.worldToScreen(this.wallChainStart);
      var sEnd = this.worldToScreen(snap.pt);
      var distMm = Math.round(Vec2.dist(this.wallChainStart, snap.pt));

      // 1a. Draw alignment guide lines if snapped to perpendicular, parallel, or orthogonal
      if (snap.type === 'perpendicular' || snap.type === 'parallel') {
        var isPerp = (snap.type === 'perpendicular');
        ctx.save();
        ctx.strokeStyle = isPerp ? '#10b981' : '#059669'; // Emerald green
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);

        var gDx = sEnd.x - sStart.x, gDy = sEnd.y - sStart.y;
        var gLen = Math.hypot(gDx, gDy) || 1;
        var ext = 1800;
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
        ctx.fillStyle = isPerp ? '#065f46' : '#047857';
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
        ctx.save();
        ctx.strokeStyle = '#0284c7'; // Sky blue
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        var gDx2 = sEnd.x - sStart.x, gDy2 = sEnd.y - sStart.y;
        var gLen2 = Math.hypot(gDx2, gDy2) || 1;
        ctx.beginPath();
        ctx.moveTo(sStart.x - (gDx2 / gLen2) * 1200, sStart.y - (gDy2 / gLen2) * 1200);
        ctx.lineTo(sEnd.x + (gDx2 / gLen2) * 1200, sEnd.y + (gDy2 / gLen2) * 1200);
        ctx.stroke();
        ctx.restore();

        // Angle Pill Badge
        var gMidX2 = (sStart.x + sEnd.x) / 2;
        var gMidY2 = (sStart.y + sEnd.y) / 2 - 38;
        ctx.save();
        ctx.font = '700 11px "IBM Plex Mono", monospace';
        var aText = (snap.label || (snap.angleDeg + '°'));
        var atw = ctx.measureText(aText).width;
        ctx.fillStyle = '#0369a1';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(gMidX2 - atw / 2 - 8, gMidY2 - 10, atw + 16, 20, 4);
        else ctx.rect(gMidX2 - atw / 2 - 8, gMidY2 - 10, atw + 16, 20);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(aText, gMidX2, gMidY2);
        ctx.restore();
      }

      // Draw ghost wall line
      ctx.strokeStyle = '#1B4F72';
      ctx.lineWidth = Math.max(2, this.wallPreset.thickness * this.zoom);
      ctx.beginPath();
      ctx.moveTo(sStart.x, sStart.y);
      ctx.lineTo(sEnd.x, sEnd.y);
      ctx.stroke();

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
        // Standard dimension indicator
        ctx.save();
        ctx.font = '600 12px "IBM Plex Mono", monospace';
        var dText = this.formatDim(distMm);
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
    }

    // 2. Snapping circle indicator (Magnetic Joint snap)
    if (this.activeTool === 'wall' || this.activeTool === 'select' || this.wallChainStart) {
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

    // 4. Furniture placement ghost preview
    if (this.activeTool === 'furniture' && this.furniturePreset) {
      var fW = (this.furniturePreset.dimensions.W || 1200) * this.zoom;
      var fD = (this.furniturePreset.dimensions.D || 600) * this.zoom;
      var sCursor = this.worldToScreen(this.cursorWorld);

      ctx.save();
      ctx.translate(sCursor.x, sCursor.y);
      ctx.rotate(this.furnitureRotY || 0);

      ctx.strokeStyle = '#2E7BB5';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.fillStyle = 'rgba(46, 123, 181, 0.15)';
      ctx.fillRect(-fW / 2, -fD / 2, fW, fD);
      ctx.strokeRect(-fW / 2, -fD / 2, fW, fD);
      ctx.setLineDash([]);

      ctx.fillStyle = '#1B4F72';
      ctx.font = '600 11px "IBM Plex Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.furniturePreset.name, 0, 0);

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
