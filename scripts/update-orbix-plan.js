const fs = require('fs');
let code = fs.readFileSync('orbix-plan.js', 'utf8');
const eol = code.includes('\r\n') ? '\r\n' : '\n';

function replaceNorm(src, oldText, newText) {
  const normOld = oldText.replace(/\r\n/g, '\n');
  const normSrc = src.replace(/\r\n/g, '\n');
  if (!normSrc.includes(normOld)) {
    throw new Error('Could not find match in source');
  }
  const normNew = newText.replace(/\r\n/g, eol);
  return normSrc.replace(normOld, normNew).replace(/\n/g, eol);
}

const target = `        // Collision check with other furniture units (SAT OBB + Elevation)
        var colCheck = Core.checkFurnitureCollision(self.dragState.furniture, self.project.plan.furniture, self.dragState.furniture.id);
        self.dragState.hasCollision = colCheck.collided;
        self.dragState.collidedWith = colCheck.other;`;

const replacement = `        // Comprehensive overlap check against adjacent furniture, wall cores, and openings
        var colCheck = Core.checkPlacementOverlap ?
          Core.checkPlacementOverlap(self.dragState.furniture, self.project.plan, self.dragState.furniture.id) :
          Core.checkFurnitureCollision(self.dragState.furniture, self.project.plan.furniture, self.dragState.furniture.id);
        self.dragState.hasCollision = colCheck.hasOverlap !== undefined ? colCheck.hasOverlap : colCheck.collided;
        self.dragState.collidedWith = colCheck.target || colCheck.other;`;

code = replaceNorm(code, target, replacement);
fs.writeFileSync('orbix-plan.js', code, 'utf8');
console.log('Successfully updated orbix-plan.js with checkPlacementOverlap!');
