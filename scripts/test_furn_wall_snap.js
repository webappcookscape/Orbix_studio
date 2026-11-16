const Core = require('../orbix-core.js');

// Test healing collinear walls
let p = Core.createProject();
p.plan.walls = [
  Core.createWall({ start: { x: 0, y: 0 }, end: { x: 0, y: 1916 }, thickness: 150, height: 2800 }),
  Core.createWall({ start: { x: 0, y: 1916 }, end: { x: 0, y: 4000 }, thickness: 150, height: 2800 })
];

console.log('Before heal walls count:', p.plan.walls.length);

function healCollinearWalls(project) {
  if (!project || !project.plan || !project.plan.walls) return false;
  var walls = project.plan.walls;
  var changed = false;
  for (var pass = 0; pass < 5; pass++) {
    var didMerge = false;
    for (var i = 0; i < walls.length && !didMerge; i++) {
      var w1 = walls[i];
      if (w1.isDivider) continue;
      var dir1 = Core.wallDirection(w1);
      for (var j = 0; j < walls.length && !didMerge; j++) {
        if (i === j) continue;
        var w2 = walls[j];
        if (w2.isDivider) continue;
        if (w1.thickness !== w2.thickness || w1.height !== w2.height) continue;
        if (w1.paintColor !== w2.paintColor || w1.wallpaper !== w2.wallpaper) continue;

        // Check if w1.end connects to w2.start with same direction
        var distEndStart = Math.hypot(w1.end.x - w2.start.x, w1.end.y - w2.start.y);
        if (distEndStart < 5) {
          var dir2 = Core.wallDirection(w2);
          var dot = dir1.x * dir2.x + dir1.y * dir2.y;
          if (dot > 0.999) { // perfectly collinear!
            // Merge w2 into w1
            var w1Len = Core.wallLength(w1);
            w1.end.x = w2.end.x;
            w1.end.y = w2.end.y;
            // Move openings from w2 to w1
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
    if (!didMerge) break;
  }
  return changed;
}

healCollinearWalls(p);
console.log('After heal walls count:', p.plan.walls.length);
p.plan.walls.forEach((w, i) => {
  console.log('Wall ' + i + ': (' + w.start.x + ',' + w.start.y + ') -> (' + w.end.x + ',' + w.end.y + ') len=' + Core.wallLength(w));
});

