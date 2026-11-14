const fs = require('fs');
let code = fs.readFileSync('orbix-plan.js', 'utf8');
const hasCRLF = code.includes('\r\n');
if (hasCRLF) {
  code = code.replace(/\r\n/g, '\n');
}

// 1. dblclick room selection
const targetDbl = `    this.canvas.addEventListener('dblclick', function () {
      if (self.wallChainStart) {
        self.wallChainStart = null;
        self.wallChainFirstPoint = null;
        self.numericInputBuffer = '';
        if (Core.detectRooms) Core.detectRooms(self.project);
        self.pushHistory('Finish Wall Chain');
        self.render();
      }
    });`;

const replaceDbl = `    this.canvas.addEventListener('dblclick', function (e) {
      if (self.wallChainStart) {
        self.wallChainStart = null;
        self.wallChainFirstPoint = null;
        self.numericInputBuffer = '';
        if (Core.detectRooms) Core.detectRooms(self.project);
        self.pushHistory('Finish Wall Chain');
        self.render();
        return;
      }
      var rect = self.canvas.getBoundingClientRect();
      var mouseScreen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      var worldPt = self.screenToWorld(mouseScreen);
      var rooms = (self.project && self.project.plan && self.project.plan.rooms) || [];
      var hitRooms = [];
      for (var r = 0; r < rooms.length; r++) {
        if (rooms[r].polygon && rooms[r].polygon.length >= 3 && Core.Vec2.pointInPolygon(worldPt, rooms[r].polygon)) {
          hitRooms.push(rooms[r]);
        }
      }
      if (hitRooms.length > 0) {
        hitRooms.sort(function (a, b) { return (a.areaSqM || 0) - (b.areaSqM || 0); });
        var targetRoom = hitRooms[0];
        self.selected = [{ type: 'room', id: targetRoom.id }];
        self.onSelectionChange(self.selected);
        self.render();
      }
    });`;

if (!code.includes(targetDbl)) {
  console.error('Target 1 (dblclick) not found');
  process.exit(1);
}
code = code.replace(targetDbl, replaceDbl);

// 2. mousedown: remove room selection on single click
const targetMousedownRoom = `    // Check if clicked inside a room polygon (Prioritizes inner rooms like Pooja room over outer enclosing rooms)
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
      if (isAlreadySelected) {`;

const replaceMousedownRoom = `    // Single-click inside a room polygon does NOT select room or open room edit tool (requires double-click)
    var rooms = (this.project && this.project.plan && this.project.plan.rooms) || [];
    var hitRooms = [];
    for (var r = 0; r < rooms.length; r++) {
      if (rooms[r].polygon && rooms[r].polygon.length >= 3 && Core.Vec2.pointInPolygon(worldPt, rooms[r].polygon)) {
        hitRooms.push(rooms[r]);
      }
    }
    if (hitRooms.length > 0) {
      hitRooms.sort(function (a, b) { return (a.areaSqM || 0) - (b.areaSqM || 0); });
      var targetRoom = hitRooms[0];
      var curSelRoomId = (this.selected && this.selected.length === 1 && this.selected[0].type === 'room') ? this.selected[0].id : null;
      var isAlreadySelected = (curSelRoomId === targetRoom.id);

      // Only if room was ALREADY selected via double-click, allow dragging
      if (isAlreadySelected) {`;

if (!code.includes(targetMousedownRoom)) {
  console.error('Target 2 (mousedown room) not found');
  process.exit(1);
}
code = code.replace(targetMousedownRoom, replaceMousedownRoom);

// Also update the else branch of isAlreadySelected so it clears/returns cleanly
const targetElseRoom = `      } else {
        this.dragState = null;
      }

      this.render();
      return;
    }`;

const replaceElseRoom = `      } else {
        this.dragState = null;
        if (!isShift) {
          this.selected = [];
          this.onSelectionChange(this.selected);
        }
      }

      this.render();
      return;
    }`;

if (!code.includes(targetElseRoom)) {
  console.error('Target 2b (else room) not found');
  process.exit(1);
}
code = code.replace(targetElseRoom, replaceElseRoom);

// 3. 2D Wall Color Dark Beige Poche
const targetWallPoche = `      ctx.fillStyle = isSelected ? '#2563eb' : '#334155';`;
const replaceWallPoche = `      ctx.fillStyle = isSelected ? '#2563eb' : '#8A735C'; // Rich Dark Beige Poche`;

if (!code.includes(targetWallPoche)) {
  console.error('Target 3 (Wall Poche) not found');
  process.exit(1);
}
code = code.replace(targetWallPoche, replaceWallPoche);

const targetWallOutline = `      ctx.strokeStyle = isSelK ? '#3b82f6' : '#0f172a';`;
const replaceWallOutline = `      ctx.strokeStyle = isSelK ? '#3b82f6' : '#5C4A38'; // Dark Beige Wall Outline`;

if (!code.includes(targetWallOutline)) {
  console.error('Target 3b (Wall Outline) not found');
  process.exit(1);
}
code = code.replace(targetWallOutline, replaceWallOutline);

// 4. RCC Column within wall width
const targetRCC = `    var colSizeMm = 220; // Authentic 220mm structural RCC column
    var colSizePx = colSizeMm * this.zoom;
    if (colSizePx >= 4) {
      ctx.fillStyle = '#0f172a'; // Deep architectural black
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      for (var cpi = 0; cpi < columnPts.length; cpi++) {
        var sCol = this.worldToScreen(columnPts[cpi]);
        ctx.fillRect(sCol.x - colSizePx / 2, sCol.y - colSizePx / 2, colSizePx, colSizePx);
        ctx.strokeRect(sCol.x - colSizePx / 2, sCol.y - colSizePx / 2, colSizePx, colSizePx);
      }
    }`;

const replaceRCC = `    for (var cpi = 0; cpi < columnPts.length; cpi++) {
      var colPt = columnPts[cpi];
      var meetingWalls = walls.filter(function (w) {
        if (w.isDivider || w.thickness === 0) return false;
        return (w.start && Vec2.dist(colPt, w.start) < 40) || (w.end && Vec2.dist(colPt, w.end) < 40);
      });
      var wallThick = meetingWalls.length > 0 ? (meetingWalls[0].thickness || 150) : 150;
      var colSizeMm = Math.min(wallThick, 150); // RCC Column stays strictly WITHIN the wall width!
      var colSizePx = colSizeMm * this.zoom;
      if (colSizePx >= 3) {
        var sCol = this.worldToScreen(colPt);
        ctx.save();
        ctx.fillStyle = '#1e293b'; // Deep architectural graphite poche
        ctx.strokeStyle = '#090d16';
        ctx.lineWidth = 1;
        ctx.fillRect(sCol.x - colSizePx / 2, sCol.y - colSizePx / 2, colSizePx, colSizePx);
        ctx.strokeRect(sCol.x - colSizePx / 2, sCol.y - colSizePx / 2, colSizePx, colSizePx);
        if (colSizePx >= 12) {
          ctx.strokeStyle = 'rgba(255,255,255,0.22)';
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(sCol.x - colSizePx / 2, sCol.y - colSizePx / 2);
          ctx.lineTo(sCol.x + colSizePx / 2, sCol.y + colSizePx / 2);
          ctx.moveTo(sCol.x + colSizePx / 2, sCol.y - colSizePx / 2);
          ctx.lineTo(sCol.x - colSizePx / 2, sCol.y + colSizePx / 2);
          ctx.stroke();
        }
        ctx.restore();
      }
    }`;

if (!code.includes(targetRCC)) {
  console.error('Target 4 (RCC) not found');
  process.exit(1);
}
code = code.replace(targetRCC, replaceRCC);

// 5. Only Shutter in 2D
const targetFurnD = `      var wMm = (f.dimensions && f.dimensions.W) || 1200;
      var dMm = (f.dimensions && f.dimensions.D) || 600;`;

const replaceFurnD = `      var wMm = (f.dimensions && f.dimensions.W) || 1200;
      var isOS = !!((f.unitConfig && f.unitConfig.isOnlyShutter) || (f.name && /\\bo\\/?s\\b/i.test(f.name)) || (f.costCategory && f.costCategory.indexOf('O/S') !== -1));
      var dMm = isOS ? 18 : ((f.dimensions && f.dimensions.D) || 600);`;

if (!code.includes(targetFurnD)) {
  console.error('Target 5 (Furn D) not found');
  process.exit(1);
}
code = code.replace(targetFurnD, replaceFurnD);

if (hasCRLF) {
  code = code.replace(/\n/g, '\r\n');
}

fs.writeFileSync('orbix-plan.js', code, 'utf8');
console.log('Successfully updated orbix-plan.js');
