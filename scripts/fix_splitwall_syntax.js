const fs = require('fs');
let s = fs.readFileSync('orbix-core.js', 'utf8');

const targetBlock = `    var w1 = createWall({
      start: Vec2.clone(w.start),
      end: Vec2.clone(proj.pt),
      thickness: w.thickness,
      height: w.height,`;

const replacement = `    var w1 = createWall({
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

    // Inherit wall paint, wallpaper, and finish styles
    w1.paintColor = w.paintColor;
    w1.wallpaper = w.wallpaper;
    w1.wallFinishType = w.wallFinishType;
    w2.paintColor = w.paintColor;
    w2.wallpaper = w.wallpaper;
    w2.wallFinishType = w.wallFinishType;`;

// Replace from targetBlock up to "// Re-assign openings"
const startIdx = s.indexOf(targetBlock);
const endIdx = s.indexOf('// Re-assign openings');
if (startIdx !== -1 && endIdx !== -1) {
  s = s.substring(0, startIdx) + replacement + '\n\n    ' + s.substring(endIdx);
  fs.writeFileSync('orbix-core.js', s, 'utf8');
  console.log('Fixed splitWall cleanly in orbix-core.js');
} else {
  console.error('Target not found:', startIdx, endIdx);
}

