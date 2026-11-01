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

    // History for Undo/Redo
    this.history = [];
    this.historyIndex = -1;

    this.initDOM();
    this.bindEvents();
    this.pushHistory('Init');
    this.resize();
    this.render();
  }

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

  // Snapping logic: Vertex Snap -> Alignment Guides -> Grid Snap
  PlanEditor.prototype.snapPoint = function (worldPt, ignoreWallId) {
    var snapDistMm = 200; // snapping radius in mm
    var snapped = Vec2.clone(worldPt);
    var snapInfo = { snapped: false, type: null, targetPt: null };

    // 1. Vertex snapping to existing wall endpoints
    var walls = this.project.plan.walls;
    for (var i = 0; i < walls.length; i++) {
      var w = walls[i];
      if (w.id === ignoreWallId) continue;
      if (Vec2.dist(worldPt, w.start) < snapDistMm) {
        return { pt: Vec2.clone(w.start), type: 'vertex', target: w.start };
      }
      if (Vec2.dist(worldPt, w.end) < snapDistMm) {
        return { pt: Vec2.clone(w.end), type: 'vertex', target: w.end };
      }
    }

    // 2. Angle constraint snapping (0°, 45°, 90°, 135°, 180°, etc.) from chain start
    if (this.wallChainStart) {
      var dx = worldPt.x - this.wallChainStart.x;
      var dy = worldPt.y - this.wallChainStart.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var angle = Math.atan2(dy, dx);
      var snapStep = Math.PI / 4; // 45 degrees
      var nearestAngle = Math.round(angle / snapStep) * snapStep;
      if (Math.abs(angle - nearestAngle) < 0.15) { // within ~8.5 degrees
        snapped.x = this.wallChainStart.x + Math.cos(nearestAngle) * dist;
        snapped.y = this.wallChainStart.y + Math.sin(nearestAngle) * dist;
        snapInfo = { snapped: true, type: 'angle', angleDeg: Math.round(nearestAngle * 180 / Math.PI) };
      }
    }

    // 3. Grid snap (100 mm grid)
    if (!snapInfo.snapped && this.project.plan.snapToGrid) {
      var grid = this.project.plan.gridSize || 100;
      snapped.x = Math.round(snapped.x / grid) * grid;
      snapped.y = Math.round(snapped.y / grid) * grid;
    }

    return { pt: snapped, type: snapInfo.type || 'grid' };
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
      }
    });

    window.addEventListener('mousemove', function (e) {
      var rect = self.canvas.getBoundingClientRect();
      var mouseScreen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      self.cursorWorld = self.screenToWorld(mouseScreen);

      if (self.dragState && self.dragState.type === 'pan') {
        self.pan.x = self.dragState.startPan.x + (mouseScreen.x - self.dragState.startScreen.x);
        self.pan.y = self.dragState.startPan.y + (mouseScreen.y - self.dragState.startScreen.y);
        self.render();
        return;
      }

      if (self.dragState && self.dragState.type === 'move_vertex') {
        var snapped = self.snapPoint(self.cursorWorld, self.dragState.wallId);
        self.dragState.vertexRef.x = snapped.pt.x;
        self.dragState.vertexRef.y = snapped.pt.y;
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
        self.render();
        return;
      }

      if (self.dragState && self.dragState.type === 'move_opening') {
        var w = self.dragState.wall;
        var op = self.dragState.opening;
        var wLen = Core.wallLength(w);
        var proj = Core.projectPointToSegment(worldPt, w.start, w.end);
        var minO = Math.round(op.width / 2);
        var maxO = Math.max(minO, Math.round(wLen - op.width / 2));
        op.offset = Math.max(minO, Math.min(maxO, Math.round(proj.t * wLen)));
        self.render();
        self.onSelectionChange(self.selected);
        return;
      }

      // Live drawing render
      if (self.activeTool === 'wall' || self.activeTool === 'door' || self.activeTool === 'window' || self.activeTool === 'furniture' || self.wallChainStart) {
        self.render();
      }
    });

    window.addEventListener('mouseup', function () {
      if (self.dragState) {
        if (self.dragState.type === 'move_vertex' || self.dragState.type === 'move_wall' || self.dragState.type === 'move_furniture' || self.dragState.type === 'move_opening') {
          self.pushHistory('Move ' + (self.dragState.type === 'move_furniture' ? 'Furniture' : 'Wall'));
        }
        self.dragState = null;
        self.render();
      }
    });

    // Keyboard shortcuts (Undo, Redo, Delete, Escape, Number Input)
    window.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

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
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        self.deleteSelected();
        return;
      }
      if (e.key === 'r' || e.key === 'R') {
        for (var s = 0; s < self.selected.length; s++) {
          if (self.selected[s].type === 'furniture') {
            for (var f = 0; f < self.project.plan.furniture.length; f++) {
              if (self.project.plan.furniture[f].id === self.selected[s].id) {
                self.project.plan.furniture[f].rotY = ((self.project.plan.furniture[f].rotY || 0) + Math.PI / 2) % (Math.PI * 2);
                self.pushHistory('Rotate Furniture');
                self.render();
                if (typeof window !== 'undefined' && window.OrbixUI && window.OrbixUI.render3DHome) {
                  window.OrbixUI.render3DHome();
                }
                return;
              }
            }
          }
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
                if (window.OrbixUI && window.OrbixUI.render3DHome) {
                  window.OrbixUI.render3DHome();
                }
                return;
              }
            }
          }
        }
      }
      if (e.key === 'Escape') {
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
            this.dragState = { type: 'move_vertex', wallId: w.id, vertexRef: w.start };
            return;
          }
          if (Vec2.dist(worldPt, w.end) < 200) {
            this.dragState = { type: 'move_vertex', wallId: w.id, vertexRef: w.end };
            return;
          }
        }
      }
    }

    // Check if clicked an opening
    var openings = this.project.plan.openings;
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

    // Check if clicked a furniture unit
    var furnList = this.project.plan.furniture || [];
    for (var f = 0; f < furnList.length; f++) {
      var fn = furnList[f];
      var halfW = (fn.dimensions.W || 1200) / 2;
      var halfD = (fn.dimensions.D || 600) / 2;
      if (Math.abs(worldPt.x - fn.pos.x) < halfW && Math.abs(worldPt.y - fn.pos.y) < halfD) {
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
      this.dragState = {
        type: 'move_wall',
        wall: near.wall,
        startWorld: Vec2.clone(worldPt),
        origStart: Vec2.clone(near.wall.start),
        origEnd: Vec2.clone(near.wall.end)
      };
      this.onSelectionChange(this.selected);
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
    var snapped = this.snapPoint(worldPt);
    if (!this.wallChainStart) {
      this.wallChainStart = Vec2.clone(snapped.pt);
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

    var furn = Core.createFurniturePlacement({
      name: this.furniturePreset.name,
      category: this.furniturePreset.category,
      roomId: matchedRoomId,
      pos: { x: snapped.pt.x, y: snapped.pt.y, z: 0 },
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

  PlanEditor.prototype.getWall = function (id) {
    var walls = this.project.plan.walls;
    for (var i = 0; i < walls.length; i++) {
      if (walls[i].id === id) return walls[i];
    }
    return null;
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

    // 1. Grid Lines
    this.renderGrid(ctx);

    // 2. Room floor fills & area tags
    this.renderRooms(ctx);

    // 3. Walls
    this.renderWalls(ctx);

    // 4. Openings (Doors & Windows)
    this.renderOpenings(ctx);

    // 5. Furniture Units (2D footprints)
    this.renderFurniture(ctx);

    // 6. Active Tool / Drawing Preview
    this.renderPreview(ctx);
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

      // Floor Fill
      ctx.fillStyle = 'rgba(232, 241, 245, 0.45)';
      ctx.beginPath();
      var p0 = this.worldToScreen(r.polygon[0]);
      ctx.moveTo(p0.x, p0.y);
      for (var j = 1; j < r.polygon.length; j++) {
        var pj = this.worldToScreen(r.polygon[j]);
        ctx.lineTo(pj.x, pj.y);
      }
      ctx.closePath();
      ctx.fill();

      // Room Center Label
      var centroid = Core.Vec2.polygonCentroid(r.polygon);
      var cScreen = this.worldToScreen(centroid);

      ctx.fillStyle = '#23211E';
      ctx.font = '600 13px "IBM Plex Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(r.name, cScreen.x, cScreen.y - 8);

      ctx.fillStyle = '#6C6862';
      ctx.font = '500 11px "IBM Plex Mono", monospace';
      var areaTxt = r.areaSqM.toFixed(1) + ' m²  ·  ' + Math.round(r.areaSqFt) + ' sq ft';
      ctx.fillText(areaTxt, cScreen.x, cScreen.y + 10);
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

      // Architectural Dimension line along wall
      var lMm = Core.wallLength(w);
      if (lMm > 150 && this.zoom > 0.03) {
        var norm = Core.wallNormal(w);
        var halfT = (w.thickness || 150) / 2;
        var dimOffset = halfT + 220; // offset in world mm from wall center

        var dsWorld = { x: w.start.x + norm.x * dimOffset, y: w.start.y + norm.y * dimOffset };
        var deWorld = { x: w.end.x + norm.x * dimOffset, y: w.end.y + norm.y * dimOffset };

        var sDs = this.worldToScreen(dsWorld);
        var sDe = this.worldToScreen(deWorld);

        // Extension witness lines
        var wsOff = this.worldToScreen({ x: w.start.x + norm.x * (halfT + 30), y: w.start.y + norm.y * (halfT + 30) });
        var weOff = this.worldToScreen({ x: w.end.x + norm.x * (halfT + 30), y: w.end.y + norm.y * (halfT + 30) });
        var dsExt = this.worldToScreen({ x: dsWorld.x + norm.x * 50, y: dsWorld.y + norm.y * 50 });
        var deExt = this.worldToScreen({ x: deWorld.x + norm.x * 50, y: deWorld.y + norm.y * 50 });

        ctx.strokeStyle = isSelected ? '#1B4F72' : 'rgba(108, 104, 98, 0.65)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(wsOff.x, wsOff.y); ctx.lineTo(dsExt.x, dsExt.y);
        ctx.moveTo(weOff.x, weOff.y); ctx.lineTo(deExt.x, deExt.y);
        ctx.stroke();

        // Main dimension line
        ctx.strokeStyle = isSelected ? '#1B4F72' : '#8C857B';
        ctx.lineWidth = isSelected ? 1.5 : 1;
        ctx.beginPath();
        ctx.moveTo(sDs.x, sDs.y);
        ctx.lineTo(sDe.x, sDe.y);
        ctx.stroke();

        // Architectural 45-degree ticks
        var wallAngle = Math.atan2(w.end.y - w.start.y, w.end.x - w.start.x);
        var tickAngle = wallAngle + Math.PI / 4;
        var tickLen = 6;
        ctx.strokeStyle = isSelected ? '#1B4F72' : '#33302B';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sDs.x - Math.cos(tickAngle) * tickLen, sDs.y - Math.sin(tickAngle) * tickLen);
        ctx.lineTo(sDs.x + Math.cos(tickAngle) * tickLen, sDs.y + Math.sin(tickAngle) * tickLen);
        ctx.moveTo(sDe.x - Math.cos(tickAngle) * tickLen, sDe.y - Math.sin(tickAngle) * tickLen);
        ctx.lineTo(sDe.x + Math.cos(tickAngle) * tickLen, sDe.y + Math.sin(tickAngle) * tickLen);
        ctx.stroke();

        // Dimension text pill badge
        var midX = (sDs.x + sDe.x) / 2;
        var midY = (sDs.y + sDe.y) / 2;
        var textAngle = wallAngle;
        if (textAngle > Math.PI / 2) textAngle -= Math.PI;
        else if (textAngle < -Math.PI / 2) textAngle += Math.PI;

        ctx.save();
        ctx.translate(midX, midY);
        ctx.rotate(textAngle);

        var dimText = Math.round(lMm).toLocaleString() + ' mm';
        ctx.font = isSelected ? '700 11px "IBM Plex Mono", monospace' : '600 10.5px "IBM Plex Mono", monospace';
        var tw = ctx.measureText(dimText).width;
        var th = 16;

        ctx.fillStyle = isSelected ? '#1B4F72' : '#FFFFFF';
        ctx.strokeStyle = isSelected ? '#2E7BB5' : '#8C857B';
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(-tw / 2 - 5, -th / 2, tw + 10, th, 3);
        else ctx.rect(-tw / 2 - 5, -th / 2, tw + 10, th);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isSelected ? '#FFFFFF' : '#1A1816';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(dimText, 0, 0);
        ctx.restore();
      }

      // If selected, draw handles at endpoints
      if (isSelected) {
        this.renderHandle(ctx, w.start);
        this.renderHandle(ctx, w.end);
      }
    }
  };

  PlanEditor.prototype.renderOpenings = function (ctx) {
    var openings = this.project.plan.openings;
    for (var i = 0; i < openings.length; i++) {
      var op = openings[i];
      var w = this.getWall(op.wallId);
      if (!w) continue;

      var isSelected = this.isSelected('opening', op.id);
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

        ctx.strokeStyle = isSelected ? '#1B4F72' : '#2E7BB5';
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
        ctx.strokeStyle = isSelected ? '#1B4F72' : '#2E7BB5';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sStart.x, sStart.y); ctx.lineTo(sEnd.x, sEnd.y);
        ctx.stroke();

        var g1 = this.worldToScreen({ x: opStart.x + wNorm.x * (halfT / 2), y: opStart.y + wNorm.y * (halfT / 2) });
        var g2 = this.worldToScreen({ x: opEnd.x + wNorm.x * (halfT / 2), y: opEnd.y + wNorm.y * (halfT / 2) });
        ctx.strokeStyle = '#8EADC4';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(g1.x, g1.y); ctx.lineTo(g2.x, g2.y);
        ctx.stroke();
      }

      // Label
      ctx.fillStyle = '#1B4F72';
      ctx.font = '600 10px "IBM Plex Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText((op.type === 'door' ? 'D ' : 'W ') + Math.round(op.width), sCenter.x, sCenter.y - 12);
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

      ctx.save();
      ctx.translate(sPos.x, sPos.y);
      ctx.rotate(f.rotY || 0);

      // Furniture body boundary
      ctx.fillStyle = isSelected ? 'rgba(46, 123, 181, 0.22)' : 'rgba(110, 78, 53, 0.12)';
      ctx.fillRect(-wPx / 2, -dPx / 2, wPx, dPx);

      ctx.strokeStyle = isSelected ? '#1B4F72' : '#6E4E35';
      ctx.lineWidth = isSelected ? 2 : 1.2;
      ctx.strokeRect(-wPx / 2, -dPx / 2, wPx, dPx);

      // Shutter dividers
      var numShutters = (f.unitConfig && f.unitConfig.shutters) || (wMm > 1200 ? 3 : wMm > 600 ? 2 : 1);
      if (numShutters > 1) {
        ctx.strokeStyle = isSelected ? 'rgba(27, 79, 114, 0.35)' : 'rgba(110, 78, 53, 0.25)';
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
      ctx.strokeStyle = isSelected ? '#2563eb' : '#92400e';
      ctx.lineWidth = isSelected ? 3.5 : 2.5;
      ctx.beginPath();
      ctx.moveTo(-wPx / 2, dPx / 2);
      ctx.lineTo(wPx / 2, dPx / 2);
      ctx.stroke();

      // Front handle pill indicator
      ctx.fillStyle = isSelected ? '#1d4ed8' : '#1f2937';
      ctx.fillRect(-10, dPx / 2 - 2, 20, 4);

      // Labels: Name + Size
      ctx.fillStyle = isSelected ? '#1e3a8a' : '#23211E';
      ctx.font = '600 10.5px "IBM Plex Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(f.name, 0, -6);

      ctx.fillStyle = isSelected ? '#1d4ed8' : '#78716c';
      ctx.font = '500 9px "IBM Plex Mono", monospace';
      ctx.fillText(Math.round(wMm) + ' × ' + Math.round(dMm) + ' mm', 0, 8);

      ctx.restore();
    }
  };

  PlanEditor.prototype.renderPreview = function (ctx) {
    // 1. Wall drawing preview line
    if (this.wallChainStart) {
      var snapped = this.snapPoint(this.cursorWorld);
      var sStart = this.worldToScreen(this.wallChainStart);
      var sEnd = this.worldToScreen(snapped.pt);
      var distMm = Math.round(Vec2.dist(this.wallChainStart, snapped.pt));

      ctx.strokeStyle = '#1B4F72';
      ctx.lineWidth = Math.max(2, this.wallPreset.thickness * this.zoom);
      ctx.beginPath();
      ctx.moveTo(sStart.x, sStart.y);
      ctx.lineTo(sEnd.x, sEnd.y);
      ctx.stroke();

      // Dimension badge at cursor
      ctx.fillStyle = '#1B4F72';
      ctx.beginPath();
      ctx.arc(sEnd.x, sEnd.y, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      var midX = (sStart.x + sEnd.x) / 2;
      var midY = (sStart.y + sEnd.y) / 2 - 15;
      ctx.font = '600 12px "IBM Plex Mono", monospace';
      var text = distMm + ' mm';
      var tw = ctx.measureText(text).width;
      ctx.fillStyle = 'rgba(27, 79, 114, 0.9)';
      ctx.fillRect(midX - tw / 2 - 4, midY - 10, tw + 8, 18);
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, midX, midY - 1);
    }

    // 2. Snapping circle indicator
    if (this.activeTool === 'wall' || this.activeTool === 'select') {
      var snap = this.snapPoint(this.cursorWorld);
      if (snap.type === 'vertex') {
        var sSnap = this.worldToScreen(snap.pt);
        ctx.strokeStyle = '#00B4D8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sSnap.x, sSnap.y, 7, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // 3. Opening hover placement preview
    if (this.activeTool === 'door' || this.activeTool === 'window') {
      var near = this.findNearestWall(this.cursorWorld, 400);
      if (near) {
        var w = near.wall;
        var opWidth = this.activeTool === 'door' ? this.doorPreset.width : this.windowPreset.width;
        var sProj = this.worldToScreen(near.proj.pt);

        ctx.strokeStyle = '#00B4D8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sProj.x, sProj.y, (opWidth / 2) * this.zoom, 0, Math.PI * 2);
        ctx.stroke();
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
