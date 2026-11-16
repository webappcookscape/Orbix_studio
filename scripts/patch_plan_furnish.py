with open('orbix-plan.js', 'r', encoding='utf-8') as f:
    plan_content = f.read()

# 1. Update snapFurniture in orbix-plan.js
old_snap_block = """      // Inner clear segment bounds
      var innerSeg = (Core.getWallInnerSegment ? Core.getWallInnerSegment(w, plan) : null);
      var startDed = (innerSeg && innerSeg.startDeduction ? innerSeg.startDeduction : halfT);
      var endDed = (innerSeg && innerSeg.endDeduction ? innerSeg.endDeduction : halfT);
      var startClear = (startDed + halfW) / wLen;
      var endClear = 1 - ((endDed + halfW) / wLen);
      if (startClear > endClear) {
        startClear = Math.max(0.04, Math.min(0.48, startDed / wLen));
        endClear = Math.min(0.96, Math.max(0.52, 1 - (endDed / wLen)));
      }

      // Project unit position onto wall segment
      var toCur = { x: pos.x - w.start.x, y: pos.y - w.start.y };
      var t = (toCur.x * wDir.x + toCur.y * wDir.y) / wLen;
      var tClamped = Math.max(startClear, Math.min(endClear, t));
      var proj = { x: w.start.x + tClamped * dx, y: w.start.y + tClamped * dy };

      var toCurProj = { x: pos.x - proj.x, y: pos.y - proj.y };
      var sDist = toCurProj.x * wNorm.x + toCurProj.y * wNorm.y;
      var sign = sDist >= 0 ? 1 : -1;
      var normOut = { x: sign * wNorm.x, y: sign * wNorm.y };

      // Room Interior Awareness: Lock orientation strictly to cursor's room on partition walls
      if (cursorRoom && cursorRoom.polygon) {
        var testPos = { x: proj.x + wNorm.x * (flushDist + 20), y: proj.y + wNorm.y * (flushDist + 20) };
        var testNeg = { x: proj.x - wNorm.x * (flushDist + 20), y: proj.y - wNorm.y * (flushDist + 20) };
        var posInCur = Core.Vec2.pointInPolygon(testPos, cursorRoom.polygon);
        var negInCur = Core.Vec2.pointInPolygon(testNeg, cursorRoom.polygon);
        if (posInCur && !negInCur) normOut = { x: wNorm.x, y: wNorm.y };
        else if (negInCur && !posInCur) normOut = { x: -wNorm.x, y: -wNorm.y };
      } else if (rooms.length > 0) {
        var testPos = { x: proj.x + wNorm.x * (flushDist + 20), y: proj.y + wNorm.y * (flushDist + 20) };
        var testNeg = { x: proj.x - wNorm.x * (flushDist + 20), y: proj.y - wNorm.y * (flushDist + 20) };
        var posInRoom = rooms.some(function (r) { return r.polygon && Core.Vec2.pointInPolygon(testPos, r.polygon); });
        var negInRoom = rooms.some(function (r) { return r.polygon && Core.Vec2.pointInPolygon(testNeg, r.polygon); });
        if (posInRoom && !negInRoom) normOut = { x: wNorm.x, y: wNorm.y };
        else if (negInRoom && !posInRoom) normOut = { x: -wNorm.x, y: -wNorm.y };
      }

      var perpDist = Math.abs(sDist);

      // Wall Snatching: when within magnetic snap distance of flush contact
      if (perpDist < flushDist + minWallDist && t >= -0.2 && t <= 1.2) {
        var snapDist = Math.abs(perpDist - flushDist);
        if (snapDist < minWallDist) {"""

new_snap_block = """      // Project unit position onto wall segment (freely allows placing right up to corner and RCC points!)
      var toCur = { x: pos.x - w.start.x, y: pos.y - w.start.y };
      var t = (toCur.x * wDir.x + toCur.y * wDir.y) / wLen;
      var tClamped = Math.max(0, Math.min(1, t));
      var proj = { x: w.start.x + tClamped * dx, y: w.start.y + tClamped * dy };

      var toCurProj = { x: pos.x - proj.x, y: pos.y - proj.y };
      var sDist = toCurProj.x * wNorm.x + toCurProj.y * wNorm.y;
      var sign = sDist >= 0 ? 1 : -1;
      var normOut = { x: sign * wNorm.x, y: sign * wNorm.y };

      // Room Interior Awareness: Lock orientation strictly to cursor's room on partition walls
      if (cursorRoom && cursorRoom.polygon) {
        var testPos = { x: proj.x + wNorm.x * (flushDist + 20), y: proj.y + wNorm.y * (flushDist + 20) };
        var testNeg = { x: proj.x - wNorm.x * (flushDist + 20), y: proj.y - wNorm.y * (flushDist + 20) };
        var posInCur = Core.Vec2.pointInPolygon(testPos, cursorRoom.polygon);
        var negInCur = Core.Vec2.pointInPolygon(testNeg, cursorRoom.polygon);
        if (posInCur && !negInCur) normOut = { x: wNorm.x, y: wNorm.y };
        else if (negInCur && !posInCur) normOut = { x: -wNorm.x, y: -wNorm.y };
      } else if (rooms.length > 0) {
        var testPos = { x: proj.x + wNorm.x * (flushDist + 20), y: proj.y + wNorm.y * (flushDist + 20) };
        var testNeg = { x: proj.x - wNorm.x * (flushDist + 20), y: proj.y - wNorm.y * (flushDist + 20) };
        var posInRoom = rooms.some(function (r) { return r.polygon && Core.Vec2.pointInPolygon(testPos, r.polygon); });
        var negInRoom = rooms.some(function (r) { return r.polygon && Core.Vec2.pointInPolygon(testNeg, r.polygon); });
        if (posInRoom && !negInRoom) normOut = { x: wNorm.x, y: wNorm.y };
        else if (negInRoom && !posInRoom) normOut = { x: -wNorm.x, y: -wNorm.y };
      }

      var perpDist = Math.abs(sDist);

      // Distance beyond endpoints along the wall line (0 when cursor is within the wall span)
      var longDist = 0;
      if (t < 0) longDist = -t * wLen;
      else if (t > 1) longDist = (t - 1) * wLen;

      // Combined distance: prioritizing whichever segment the cursor is directly opposite
      var snapDist = Math.hypot(Math.abs(perpDist - flushDist), longDist);

      // Wall Snatching: when within magnetic snap distance of flush contact
      if (perpDist < flushDist + minWallDist && t >= -0.3 && t <= 1.3) {
        if (snapDist < minWallDist) {"""

assert old_snap_block in plan_content, "old_snap_block not found in orbix-plan.js"
plan_content = plan_content.replace(old_snap_block, new_snap_block)
print("1. Updated snapFurniture in orbix-plan.js")

# 2. Update collision check in handleSelectMouseMove
old_col_check = """        if (snapRes.type === 'unit_joint' || (snapRes.type === 'wall_snap' && colCheck.type === 'wall')) {
          self.dragState.hasCollision = false;
          self.dragState.collidedWith = null;
        } else {
          self.dragState.hasCollision = colCheck.hasOverlap !== undefined ? colCheck.hasOverlap : colCheck.collided;
          self.dragState.collidedWith = colCheck.target || colCheck.other;
        }"""

new_col_check = """        if (snapRes.type === 'unit_joint' || (snapRes.type === 'wall_snap' && colCheck.type === 'wall')) {
          self.dragState.hasCollision = false;
          self.dragState.collidedWith = null;
        } else {
          var isCollidedRcc = colCheck.other && (
            colCheck.other.category === 'structural' || colCheck.other.category === 'civil' ||
            colCheck.other.category === 'wall_paneling' ||
            /rcc|column|pillar|post|structural/i.test(colCheck.other.name || '') ||
            /rcc|column|pillar|post|structural/i.test(colCheck.other.id || '')
          );
          if (isCollidedRcc) {
            self.dragState.hasCollision = false;
            self.dragState.collidedWith = null;
          } else {
            self.dragState.hasCollision = colCheck.hasOverlap !== undefined ? colCheck.hasOverlap : colCheck.collided;
            self.dragState.collidedWith = colCheck.target || colCheck.other;
          }
        }"""

assert old_col_check in plan_content, "old_col_check not found in orbix-plan.js"
plan_content = plan_content.replace(old_col_check, new_col_check)
print("2. Updated collision handling in handleSelectMouseMove")

# 3. Remove autoSplitWallAtJunctions in handleWallMouseDown
old_draw_wall = """        this.project.plan.walls.push(newW);
        if (Core.autoSplitWallAtJunctions) Core.autoSplitWallAtJunctions(this.project);
        this.pushHistory(isDivider ? 'Draw Room Divider' : 'Draw Wall');"""

new_draw_wall = """        this.project.plan.walls.push(newW);
        this.pushHistory(isDivider ? 'Draw Room Divider' : 'Draw Wall');"""

assert old_draw_wall in plan_content, "old_draw_wall not found in orbix-plan.js"
plan_content = plan_content.replace(old_draw_wall, new_draw_wall)
print("3. Removed drawing auto-split in handleWallMouseDown")

with open('orbix-plan.js', 'w', encoding='utf-8') as f:
    f.write(plan_content)
print("Updated orbix-plan.js successfully!")

