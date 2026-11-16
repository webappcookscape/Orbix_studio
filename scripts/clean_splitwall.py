with open('orbix-core.js', 'rb') as f:
    content = f.read()

i1 = content.find(b'function splitWall(project, wallId, splitPt) {')
i2 = content.find(b'// Re-assign openings')

replacement = b'''function splitWall(project, wallId, splitPt) {
    var wIdx = -1;
    for (var i = 0; i < project.plan.walls.length; i++) {
      if (project.plan.walls[i].id === wallId) { wIdx = i; break; }
    }
    if (wIdx === -1) return null;
    var w = project.plan.walls[wIdx];
    var l = wallLength(w);
    var proj = Vec2.projectOnSegment(splitPt, w.start, w.end);
    var splitOffset = proj.t * l;

    if (splitOffset < 40 || splitOffset > l - 40) {
      // Too close to either endpoint, do not split
      return null;
    }

    var w1 = createWall({
      start: Vec2.clone(w.start),
      end: Vec2.clone(proj.pt),
      thickness: w.thickness,
      height: w.height,
      material: w.material
    });

    var w2 = createWall({
      start: Vec2.clone(proj.pt),
      end: Vec2.clone(w.end),
      thickness: w.thickness,
      height: w.height,
      material: w.material
    });

    // Inherit wall paint color, finish type, and wallpaper
    w1.paintColor = w.paintColor;
    w1.wallpaper = w.wallpaper;
    w1.wallFinishType = w.wallFinishType;
    w2.paintColor = w.paintColor;
    w2.wallpaper = w.wallpaper;
    w2.wallFinishType = w.wallFinishType;

    '''

new_content = content[:i1] + replacement + content[i2:]
with open('orbix-core.js', 'wb') as f:
    f.write(new_content)

print("Successfully replaced splitWall in orbix-core.js")

