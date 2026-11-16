import re

with open('orbix-plan.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Double-click on canvas: wall split
old_dblclick = """    this.canvas.addEventListener('dblclick', function (e) {
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
      var rooms = (self.project && self.project.plan && self.project.plan.rooms) || [];"""

new_dblclick = """    this.canvas.addEventListener('dblclick', function (e) {
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

      // Check if double-clicked a wall to split into separate walls at joint!
      var nearWall = self.findNearestWall(worldPt, 220);
      if (nearWall && nearWall.dist <= Math.max(120, (nearWall.wall.thickness || 150) / 2 + 50)) {
        var w = nearWall.wall;
        var splitPt = nearWall.proj.pt;
        var distS = Vec2.dist(w.start, splitPt);
        var distE = Vec2.dist(w.end, splitPt);
        if (distS > 100 && distE > 100) {
          if (Core.splitWall) {
            var res = Core.splitWall(self.project, w.id, splitPt);
            if (res && res.wall1 && res.wall2) {
              if (Core.detectRooms) Core.detectRooms(self.project);
              self.selected = [{ type: 'wall', id: res.wall2.id }];
              self.onSelectionChange(self.selected);
              self.pushHistory('Split Wall at Joint');
              self.render();
              if (typeof window !== 'undefined' && typeof window.toast === 'function') {
                window.toast('🧱 Wall split into separate walls at joint (' + Math.round(distS) + 'mm)');
              }
              return;
            }
          }
        }
      }

      var rooms = (self.project && self.project.plan && self.project.plan.rooms) || [];"""

assert old_dblclick in content, "old_dblclick not found"
content = content.replace(old_dblclick, new_dblclick)
print("1. Applied dblclick wall split")

# 2. Single-click wall selection (remove isShift gate)
old_sel_start = "    // 4. Check if clicked a wall -> ONLY when Shift key is held (Shift + Click)!\n    if (isShift) {\n      var near = this.findNearestWall(worldPt, 250);\n      if (near) {"
new_sel_start = "    // 4. Check if clicked a wall (direct click selection for individual separate wall segments!)\n    var near = this.findNearestWall(worldPt, 220);\n    if (near && near.dist <= Math.max(120, (near.wall.thickness || 150) / 2 + 60)) {"

assert old_sel_start in content, "old_sel_start not found"
content = content.replace(old_sel_start, new_sel_start)

# Now we need to remove the extra closing brace from `if (isShift) { ... }`
# The end of that block before was:
old_sel_end = """        this.render();
        return;
      }
    }

    // Single-click inside a room polygon does NOT select room"""

new_sel_end = """        this.render();
        return;
      }
    }

    // Single-click inside a room polygon does NOT select room"""
# Note: previously there were TWO closing braces: one for `if (near) {` and one for `if (isShift) {`.
# Now `if (near ...)` has one closing brace.
old_sel_end_actual = """        this.render();
        return;
      }
    }

    // Single-click inside a room polygon does NOT select room or open room edit tool (requires double-click)"""

new_sel_end_actual = """        this.render();
        return;
      }

    // Single-click inside a room polygon does NOT select room or open room edit tool (requires double-click)"""

assert old_sel_end_actual in content, "old_sel_end_actual not found"
content = content.replace(old_sel_end_actual, new_sel_end_actual)
print("2. Applied direct single-click wall selection")

# 3. In handleWallMouseDown, auto-split on wall creation
old_draw_wall = """        this.project.plan.walls.push(newW);
        this.pushHistory(isDivider ? 'Draw Room Divider' : 'Draw Wall');"""

new_draw_wall = """        this.project.plan.walls.push(newW);
        if (Core.autoSplitWallAtJunctions) Core.autoSplitWallAtJunctions(this.project);
        this.pushHistory(isDivider ? 'Draw Room Divider' : 'Draw Wall');"""

assert old_draw_wall in content, "old_draw_wall not found"
content = content.replace(old_draw_wall, new_draw_wall)
print("3. Applied auto-split in handleWallMouseDown")

# 4. In handleSelectMouseUp, detect RCC column move
old_up_furn = """          if (self.dragState.hasCollision) {
            // Keep user placement stable without abrupt reverts
            self.dragState.hasCollision = false;
            if (typeof window !== 'undefined' && window.OrbixUI && window.OrbixUI.showToast) {
              window.OrbixUI.showToast('Note: Unit placed near adjacent element', 'info');
            }
          }
          self.pushHistory('Move Furniture');"""

new_up_furn = """          if (self.dragState.hasCollision) {
            // Keep user placement stable without abrupt reverts
            self.dragState.hasCollision = false;
            if (typeof window !== 'undefined' && window.OrbixUI && window.OrbixUI.showToast) {
              window.OrbixUI.showToast('Note: Unit placed near adjacent element', 'info');
            }
          }
          if (self.dragState.furniture) {
            var isRcc = self.dragState.furniture.category === 'structural' ||
                        self.dragState.furniture.category === 'civil' ||
                        /rcc|column|pillar|post/i.test(self.dragState.furniture.name || '') ||
                        /rcc|column|pillar|post/i.test(self.dragState.furniture.id || '');
            if (isRcc && Core.detectRooms) {
              Core.detectRooms(self.project);
            }
          }
          self.pushHistory('Move Furniture');"""

assert old_up_furn in content, "old_up_furn not found"
content = content.replace(old_up_furn, new_up_furn)
print("4. Applied RCC column move trigger in handleSelectMouseUp")

with open('orbix-plan.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("orbix-plan.js updated successfully!")

