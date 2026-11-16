with open('orbix-plan.js', 'r', encoding='utf-8') as f:
    content = f.read()

old_block = """    // 4. Check if clicked a wall (direct click selection for individual separate wall segments!)
    var near = this.findNearestWall(worldPt, 220);
    if (near && near.dist <= Math.max(120, (near.wall.thickness || 150) / 2 + 60)) {"""

new_block = """    // 4. Check if clicked a wall -> ONLY when Shift key is held (Shift + Click)!
    if (isShift) {
      var near = this.findNearestWall(worldPt, 250);
      if (near) {"""

assert old_block in content, "old_block not found"
content = content.replace(old_block, new_block)

old_end_block = """        this.render();
        return;
      }

    // Single-click inside a room polygon does NOT select room or open room edit tool (requires double-click)"""

new_end_block = """        this.render();
        return;
      }
    }

    // Single-click inside a room polygon does NOT select room or open room edit tool (requires double-click)"""

assert old_end_block in content, "old_end_block not found"
content = content.replace(old_end_block, new_end_block)

with open('orbix-plan.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Restored Shift + Click for wall selection in orbix-plan.js successfully!")

