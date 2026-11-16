with open('orbix-core.js', 'r', encoding='utf-8') as f:
    core_content = f.read()

# 1. Remove autoSplitWallAtJunctions from detectRooms in orbix-core.js
old_detect_rooms = """  function detectRooms(project) {
    if (!project || !project.plan) return [];
    if (typeof autoSplitWallAtJunctions === 'function') {
      try {
        autoSplitWallAtJunctions(project);
      } catch (e) {
        console.warn('autoSplitWallAtJunctions error:', e);
      }
    }
    var walls = project.plan.walls || [];"""

new_detect_rooms = """  function detectRooms(project) {
    if (!project || !project.plan) return [];
    var walls = project.plan.walls || [];"""

assert old_detect_rooms in core_content, "old_detect_rooms not found in orbix-core.js"
core_content = core_content.replace(old_detect_rooms, new_detect_rooms)
print("1. Removed autoSplitWallAtJunctions from detectRooms in orbix-core.js")

# 2. Add healCollinearWalls to orbix-core.js
heal_func = """  /* ─────────────────────────────────────────────────────────────────────────────
     Heal & Merge Collinear Walls (reunites straight wall segments that share orientation)
     ───────────────────────────────────────────────────────────────────────────── */
  function healCollinearWalls(project) {
    if (!project || !project.plan || !project.plan.walls || project.plan.walls.length < 2) return false;
    var walls = project.plan.walls;
    var furnList = project.plan.furniture || [];
    var changed = false;
    for (var pass = 0; pass < 6; pass++) {
      var didMerge = false;
      for (var i = 0; i < walls.length && !didMerge; i++) {
        var w1 = walls[i];
        if (!w1 || w1.isDivider) continue;
        var dir1 = wallDirection(w1);
        for (var j = 0; j < walls.length && !didMerge; j++) {
          if (i === j) continue;
          var w2 = walls[j];
          if (!w2 || w2.isDivider) continue;
          if (w1.thickness !== w2.thickness || w1.height !== w2.height) continue;
          if (w1.paintColor !== w2.paintColor || w1.wallpaper !== w2.wallpaper) continue;

          // Check if w1.end connects to w2.start
          var distEndStart = Math.hypot(w1.end.x - w2.start.x, w1.end.y - w2.start.y);
          if (distEndStart < 15) {
            var dir2 = wallDirection(w2);
            var dot = dir1.x * dir2.x + dir1.y * dir2.y;
            if (dot > 0.99) { // Collinear straight line
              // Do not merge if there is an intentional structural RCC column at the joint
              var hasRccPillar = furnList.some(function (f) {
                if (!f || !f.pos) return false;
                var isRcc = (f.category === 'structural' || f.category === 'civil' ||
                  /rcc|column|pillar|post/i.test(f.name || '') ||
                  /rcc|column|pillar|post/i.test(f.id || ''));
                return isRcc && Math.hypot(f.pos.x - w1.end.x, f.pos.y - w1.end.y) < 120;
              });
              if (!hasRccPillar) {
                var w1Len = wallLength(w1);
                w1.end.x = w2.end.x;
                w1.end.y = w2.end.y;
                if (project.plan.openings) {
                  project.plan.openings.forEach(function (op) {
                    if (op.wallId === w2.id) {
                      op.wallId = w1.id;
                      op.offset = (op.offset || 0) + w1Len;
                    }
                  });
                }
                walls.splice(j, 1);
                didMerge = true;
                changed = true;
              }
            }
          }
        }
      }
      if (!didMerge) break;
    }
    return changed;
  }

  function deserializeProject(jsonStr) {"""

old_deserialize = "  function deserializeProject(jsonStr) {"
assert old_deserialize in core_content, "old_deserialize not found in orbix-core.js"
core_content = core_content.replace(old_deserialize, heal_func, 1)

# In deserializeProject, call healCollinearWalls(data)
old_return_data = """    return data;
  }"""

new_return_data = """    try {
      healCollinearWalls(data);
    } catch (e) {
      console.warn('healCollinearWalls error:', e);
    }
    return data;
  }"""
assert old_return_data in core_content, "old_return_data not found in orbix-core.js"
core_content = core_content.replace(old_return_data, new_return_data, 1)

# Export healCollinearWalls
old_export = "    formatFeetInches: formatFeetInches,"
new_export = """    healCollinearWalls: healCollinearWalls,
    formatFeetInches: formatFeetInches,"""
assert old_export in core_content, "old_export not found in orbix-core.js"
core_content = core_content.replace(old_export, new_export, 1)

# 3. Update checkFurnitureCollision & checkPlacementOverlap in orbix-core.js
old_civil1 = "var isCivilOrLedge1 = (f.category === 'wall_paneling' || (f.name && /ledge|rcc|civil|panel/i.test(f.name)) || (f.id && /ledge|rcc|civil/i.test(f.id)));"
new_civil1 = "var isCivilOrLedge1 = (f.category === 'wall_paneling' || f.category === 'structural' || f.category === 'civil' || (f.name && /ledge|rcc|civil|panel|column|pillar|post|structural/i.test(f.name)) || (f.id && /ledge|rcc|civil|column|pillar|post|structural/i.test(f.id)));"

old_civil2 = "var isCivilOrLedge2 = (other.category === 'wall_paneling' || (other.name && /ledge|rcc|civil|panel/i.test(other.name)) || (other.id && /ledge|rcc|civil/i.test(other.id)));"
new_civil2 = "var isCivilOrLedge2 = (other.category === 'wall_paneling' || other.category === 'structural' || other.category === 'civil' || (other.name && /ledge|rcc|civil|panel|column|pillar|post|structural/i.test(other.name)) || (other.id && /ledge|rcc|civil|column|pillar|post|structural/i.test(other.id)));"

assert old_civil1 in core_content, "old_civil1 not found"
assert old_civil2 in core_content, "old_civil2 not found"
core_content = core_content.replace(old_civil1, new_civil1)
core_content = core_content.replace(old_civil2, new_civil2)

old_place_overlap = """    if (furnCol.collided) {
      return { hasOverlap: true, type: "furniture", target: furnCol.other };
    }"""

new_place_overlap = """    var isOtherCivil = furnCol.other && (
      furnCol.other.category === 'structural' || furnCol.other.category === 'civil' ||
      furnCol.other.category === 'wall_paneling' ||
      /ledge|rcc|civil|panel|column|pillar|post|structural/i.test(furnCol.other.name || '') ||
      /ledge|rcc|civil|panel|column|pillar|post|structural/i.test(furnCol.other.id || '')
    );
    if (furnCol.collided && !isOtherCivil) {
      return { hasOverlap: true, type: "furniture", target: furnCol.other };
    }"""
assert old_place_overlap in core_content, "old_place_overlap not found"
core_content = core_content.replace(old_place_overlap, new_place_overlap)

with open('orbix-core.js', 'w', encoding='utf-8') as f:
    f.write(core_content)
print("Updated orbix-core.js successfully!")

