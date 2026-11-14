const fs = require('fs');
const path = require('path');

function replaceExact(filePath, searchStr, replaceStr) {
  let content = fs.readFileSync(filePath, 'utf8');
  const isCRLF = content.includes('\r\n');
  const normContent = content.replace(/\r\n/g, '\n');
  const normSearch = searchStr.replace(/\r\n/g, '\n');
  const normReplace = replaceStr.replace(/\r\n/g, '\n');

  if (normContent.includes(normReplace) && !normContent.includes(normSearch)) {
    console.log(`- Already updated ${filePath}`);
    return;
  }
  if (!normContent.includes(normSearch)) {
    throw new Error(`Failed to find target string in ${filePath}:\n${normSearch.substring(0, 140)}...`);
  }
  const updatedNorm = normContent.replace(normSearch, normReplace);
  const finalContent = isCRLF ? updatedNorm.replace(/\n/g, '\r\n') : updatedNorm;
  fs.writeFileSync(filePath, finalContent, 'utf8');
  console.log(`✓ Updated ${filePath}`);
}

// 1. Remove 2D Move tool handle (✥ MOVE) & Rotation Knob (↻) from orbix-plan.js
console.log('Updating orbix-plan.js...');
const searchPlan_1 = `      // Check rotation handle on currently selected furniture unit
      var furnList = (self.project && self.project.plan && self.project.plan.furniture) || [];
      if (self.activeTool === 'select' && self.selected && self.selected.length === 1 && self.selected[0].type === 'furniture') {
        var curSel = furnList.find(function (f) { return f.id === self.selected[0].id; });
        if (curSel && typeof self.getFurnitureRotationHandleWorld === 'function') {
          var rotHandlePos = self.getFurnitureRotationHandleWorld(curSel);
          var rotHitDist = 22 / Math.max(0.01, self.zoom);
          if (Vec2.dist(worldPt, rotHandlePos) < Math.max(180, rotHitDist)) {
            self.dragState = {
              type: 'rotate_furniture',
              furniture: curSel,
              startAngle: curSel.rotY || 0,
              startWorld: Vec2.clone(worldPt)
            };
            return;
          }
        }
      }

      // Check if clicked directly on any placed furniture unit (exact rotated/L-shape polygon, never oversized circle!)`;

const replacePlan_1 = `      var furnList = (self.project && self.project.plan && self.project.plan.furniture) || [];

      // Check if clicked directly on any placed furniture unit (exact rotated/L-shape polygon, never oversized circle!)`;

replaceExact('orbix-plan.js', searchPlan_1, replacePlan_1);

const searchPlan_2 = `        // Visual 4-Way Move Handle and Rotation Knob on Selected Unit
        if (!isActivelyMovingThis) {
          ctx.fillStyle = '#0f172a';
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.5;
          var pillW = 56, pillH = 18;
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(-pillW / 2, -pillH / 2, pillW, pillH, 9);
          else ctx.rect(-pillW / 2, -pillH / 2, pillW, pillH);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#38bdf8';
          ctx.font = '700 9px "IBM Plex Sans", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('✥ MOVE', 0, 0);

          var stemLen = 22;
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 2]);
          ctx.beginPath();
          ctx.moveTo(0, dPx / 2);
          ctx.lineTo(0, dPx / 2 + stemLen);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.arc(0, dPx / 2 + stemLen, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.fillStyle = '#0f172a';
          ctx.font = '700 8.5px sans-serif';
          ctx.fillText('↻', 0, dPx / 2 + stemLen + 0.5);
        }
      }`;

const replacePlan_2 = `      }`;

replaceExact('orbix-plan.js', searchPlan_2, replacePlan_2);

// 2. Update test-all-10-fixes.js
console.log('Updating tests/test-all-10-fixes.js...');
const searchTest = `// 6. Verify 2D Move & Rotate Handles
assert.ok(planJs.includes('getFurnitureRotationHandleWorld'), 'Must have rotation handle calculation');
assert.ok(planJs.includes('rotate_furniture'), 'Must support rotate_furniture drag mode');
assert.ok(planJs.includes('✥ MOVE') || planJs.includes('MOVE'), 'Must render visual 4-way move handle');
console.log('✔ Fix 6 Verified: 2D 4-way move handle & rotation handle');`;

const replaceTest = `// 6. Verify 2D Direct Unit Movement & Clean CAD View (Move/Rotate handle overlay removed per user request)
assert.ok(!planJs.includes('✥ MOVE'), 'Visual 4-way move handle overlay must be removed from 2D');
assert.ok(planJs.includes('move_furniture'), 'Direct 2D unit moving must remain fully supported');
console.log('✔ Fix 6 Verified: 2D direct unit moving active, 2D move/rotate overlay removed');`;

replaceExact('tests/test-all-10-fixes.js', searchTest, replaceTest);

console.log('Removal complete!');

