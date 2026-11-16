const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

// 1. Patch orbix-plan.js
let planSrc = fs.readFileSync(path.join(rootDir, 'orbix-plan.js'), 'utf8');

// A. Add this.renderStairs(ctx) in render()
if (!planSrc.includes('this.renderStairs(ctx)')) {
  planSrc = planSrc.replace(
    'this.renderFurniture(ctx);',
    'this.renderFurniture(ctx);\n\n    // 5a. Staircases (Treads, Intermediate Landing, UP Arrow)\n    this.renderStairs(ctx);'
  );
  console.log('✓ Added this.renderStairs(ctx) to PlanEditor.render');
}

// B. Add this.renderStairs(oCtx) in 2D export plan
if (!planSrc.includes('this.renderStairs(oCtx)')) {
  planSrc = planSrc.replace(
    'this.renderFurniture(oCtx);',
    'this.renderFurniture(oCtx);\n      this.renderStairs(oCtx);'
  );
  console.log('✓ Added this.renderStairs(oCtx) to 2D Plan Export');
}

// C. Add stair deletion to PlanEditor.prototype.deleteSelected
if (!planSrc.includes("item.type === 'stair'")) {
  planSrc = planSrc.replace(
    "} else if (item.type === 'dimension') {",
    `} else if (item.type === 'stair') {
        this.project.plan.stairs = (this.project.plan.stairs || []).filter(function (st) { return st.id !== item.id; });
        deletedSomething = true;
      } else if (item.type === 'dimension') {`
  );
  console.log('✓ Added stair handling to deleteSelected');
}

// D. Add stair movement cleanup to mouseup handler
if (!planSrc.includes("self.dragState.type === 'move_stair'")) {
  planSrc = planSrc.replace(
    "} else if (self.dragState.type === 'move_furniture') {",
    `} else if (self.dragState.type === 'move_stair') {
          self.pushHistory('Move Staircase');
          if (typeof window !== 'undefined' && window.OrbixUI && window.OrbixUI.render3DHome) {
            window.OrbixUI.render3DHome(true);
          }
        } else if (self.dragState.type === 'move_furniture') {`
  );
  console.log('✓ Added move_stair completion in mouseup');
}

// E. Add hotkey 'k' to select stair tool and rotation for stair
if (!planSrc.includes("stairObj.rotY = ((stairObj.rotY || 0) + Math.PI / 2)")) {
  planSrc = planSrc.replace(
    "if (!rotated && (e.key === 'r' || e.key === 'R')) {",
    `// Staircase rotation
        for (var sIdx = 0; sIdx < self.selected.length; sIdx++) {
          if (self.selected[sIdx].type === 'stair') {
            var stObj = (self.project.plan.stairs || []).find(function (st) { return st.id === self.selected[sIdx].id; });
            if (stObj) {
              stObj.rotY = ((stObj.rotY || 0) + Math.PI / 2) % (Math.PI * 2);
              rotated = true;
            }
          }
        }
        if (!rotated && (e.key === 'r' || e.key === 'R')) {`
  );
  console.log('✓ Added stair rotation on Space / R key');
}

if (!planSrc.includes("e.key.toLowerCase() === 'k'")) {
  planSrc = planSrc.replace(
    "if (e.key.toLowerCase() === 't' && !e.ctrlKey && !e.metaKey) {",
    `if (e.key.toLowerCase() === 'k' && !e.ctrlKey && !e.metaKey) {
        var stBtn = document.getElementById('planStairBtn');
        if (stBtn) stBtn.click();
        return;
      }
      if (e.key.toLowerCase() === 't' && !e.ctrlKey && !e.metaKey) {`
  );
  console.log('✓ Added hotkey K for staircase tool');
}

fs.writeFileSync(path.join(rootDir, 'orbix-plan.js'), planSrc, 'utf8');

// 2. Patch orbix-ui.js to show Staircase Inspector
let uiSrc = fs.readFileSync(path.join(rootDir, 'orbix-ui.js'), 'utf8');

const stairInspectorBlock = `      } else if (sel.type === 'stair') {
        var stairId = sel.id;
        var planTarget = (this.project && this.project.plan) || (this.editor && this.editor.project && this.editor.project.plan);
        var stair = (planTarget && planTarget.stairs ? planTarget.stairs : []).find(function (st) { return st.id === stairId; });
        if (!stair) {
          panel.innerHTML = '<div style="padding:16px;color:#64748b;font-size:12px;">Staircase not found</div>';
          return;
        }

        var inspHtml = '<div style="padding:16px;">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">' +
          '<span style="font-weight:700;font-size:14px;color:#0f172a;">🪜 Architectural Staircase</span>' +
          '<span style="font-size:11px;font-weight:700;background:#e0f2fe;color:#0369a1;padding:2px 8px;border-radius:10px;">' +
          (stair.type || 'l_shape').toUpperCase() + '</span>' +
          '</div>' +

          '<div class="form-group" style="margin-bottom:10px;">' +
          '<label class="form-label" style="font-size:11px;font-weight:600;color:#475569;">Staircase Layout</label>' +
          '<select class="form-select" id="inspStairType" style="font-size:12px;padding:6px;width:100%;">' +
          '<option value="l_shape"' + (stair.type === 'l_shape' ? ' selected' : '') + '>L-Shape (Quarter Turn 90°)</option>' +
          '<option value="u_shape"' + (stair.type === 'u_shape' ? ' selected' : '') + '>U-Shape (Half Turn 180° Dogleg)</option>' +
          '<option value="straight"' + (stair.type === 'straight' ? ' selected' : '') + '>Straight Flight Run</option>' +
          '</select>' +
          '</div>' +

          '<div class="form-group" style="margin-bottom:10px;">' +
          '<label class="form-label" style="font-size:11px;font-weight:600;color:#475569;">Turn Direction</label>' +
          '<div style="display:flex;gap:6px;">' +
          '<button type="button" class="btn small full ' + (stair.turnDirection === 'right' ? 'primary' : '') + '" id="inspStairTurnRight" style="' + (stair.turnDirection === 'right' ? 'background:#0284c7;color:#fff;' : '') + '">Turn Right ↱</button>' +
          '<button type="button" class="btn small full ' + (stair.turnDirection === 'left' ? 'primary' : '') + '" id="inspStairTurnLeft" style="' + (stair.turnDirection === 'left' ? 'background:#0284c7;color:#fff;' : '') + '">Turn Left ↰</button>' +
          '</div>' +
          '</div>' +

          '<div class="form-group" style="margin-bottom:10px;">' +
          '<label class="form-label" style="font-size:11px;font-weight:600;color:#475569;">Flight Width: <b id="stairWidthVal">' + stair.width + ' mm</b></label>' +
          '<input type="range" id="inspStairWidth" min="750" max="1300" step="50" value="' + stair.width + '" style="width:100%;">' +
          '</div>' +

          '<div class="form-group" style="margin-bottom:10px;">' +
          '<label class="form-label" style="font-size:11px;font-weight:600;color:#475569;">Tread Finish</label>' +
          '<select class="form-select" id="inspStairFinish" style="font-size:12px;padding:6px;width:100%;">' +
          '<option value="marble"' + (stair.finish === 'marble' ? ' selected' : '') + '>🏛️ Statuario White Marble</option>' +
          '<option value="wood"' + (stair.finish === 'wood' ? ' selected' : '') + '>🪵 Warm Teak Hardwood</option>' +
          '<option value="concrete"' + (stair.finish === 'concrete' ? ' selected' : '') + '>🏢 Modern Basalt Stone / Concrete</option>' +
          '</select>' +
          '</div>' +

          '<div class="form-group" style="margin-bottom:14px;">' +
          '<label class="form-label" style="font-size:11px;font-weight:600;color:#475569;">Balustrade & Railing Style</label>' +
          '<select class="form-select" id="inspStairRailing" style="font-size:12px;padding:6px;width:100%;">' +
          '<option value="glass_steel"' + (stair.railing === 'glass_steel' ? ' selected' : '') + '>✨ Tempered Glass & Stainless Steel</option>' +
          '<option value="black_metal"' + (stair.railing === 'black_metal' ? ' selected' : '') + '>⬛ Matte Black Metal Spindles</option>' +
          '</select>' +
          '</div>' +

          '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px;margin-bottom:14px;font-size:11px;color:#475569;line-height:1.5;">' +
          '<div>📐 <b>Total Rise:</b> ' + (stair.totalHeight || 2800) + ' mm (Ceiling Level)</div>' +
          '<div>🪜 <b>Steps:</b> ' + (stair.riserCount || 16) + ' Risers @ ' + (stair.riserHeight || 175) + ' mm</div>' +
          '<div>🦶 <b>Tread Going:</b> ' + (stair.treadDepth || 250) + ' mm</div>' +
          '</div>' +

          '<div style="display:flex;gap:6px;margin-bottom:10px;">' +
          '<button type="button" class="btn small full" id="inspStairRotate90">↻ Rotate 90°</button>' +
          '<button type="button" class="btn small danger full" id="inspStairDelete" style="background:#dc2626;color:#fff;">🗑️ Delete</button>' +
          '</div>' +
          '</div>';

        panel.innerHTML = inspHtml;

        // Event listeners
        var selfUi = this;
        var typeSel = document.getElementById('inspStairType');
        if (typeSel) {
          typeSel.addEventListener('change', function () {
            stair.type = this.value;
            selfUi.editor.render();
            if (selfUi.render3DHome) selfUi.render3DHome(true);
            selfUi.renderInspector(selfUi.editor.selected);
          });
        }
        var btnTurnR = document.getElementById('inspStairTurnRight');
        if (btnTurnR) {
          btnTurnR.addEventListener('click', function () {
            stair.turnDirection = 'right';
            selfUi.editor.render();
            if (selfUi.render3DHome) selfUi.render3DHome(true);
            selfUi.renderInspector(selfUi.editor.selected);
          });
        }
        var btnTurnL = document.getElementById('inspStairTurnLeft');
        if (btnTurnL) {
          btnTurnL.addEventListener('click', function () {
            stair.turnDirection = 'left';
            selfUi.editor.render();
            if (selfUi.render3DHome) selfUi.render3DHome(true);
            selfUi.renderInspector(selfUi.editor.selected);
          });
        }
        var widthSlider = document.getElementById('inspStairWidth');
        if (widthSlider) {
          widthSlider.addEventListener('input', function () {
            stair.width = parseInt(this.value, 10);
            stair.landingWidth = stair.width;
            var wVal = document.getElementById('stairWidthVal');
            if (wVal) wVal.textContent = stair.width + ' mm';
            selfUi.editor.render();
            if (selfUi.render3DHome) selfUi.render3DHome(true);
          });
        }
        var finishSel = document.getElementById('inspStairFinish');
        if (finishSel) {
          finishSel.addEventListener('change', function () {
            stair.finish = this.value;
            selfUi.editor.render();
            if (selfUi.render3DHome) selfUi.render3DHome(true);
          });
        }
        var railSel = document.getElementById('inspStairRailing');
        if (railSel) {
          railSel.addEventListener('change', function () {
            stair.railing = this.value;
            selfUi.editor.render();
            if (selfUi.render3DHome) selfUi.render3DHome(true);
          });
        }
        var btnRot = document.getElementById('inspStairRotate90');
        if (btnRot) {
          btnRot.addEventListener('click', function () {
            stair.rotY = ((stair.rotY || 0) + Math.PI / 2) % (Math.PI * 2);
            selfUi.editor.render();
            if (selfUi.render3DHome) selfUi.render3DHome(true);
          });
        }
        var btnDel = document.getElementById('inspStairDelete');
        if (btnDel) {
          btnDel.addEventListener('click', function () {
            var targetPlan = (selfUi.project && selfUi.project.plan) || (selfUi.editor && selfUi.editor.project && selfUi.editor.project.plan);
            if (targetPlan && targetPlan.stairs) {
              targetPlan.stairs = targetPlan.stairs.filter(function (st) { return st.id !== stair.id; });
            }
            selfUi.editor.selected = [];
            selfUi.editor.render();
            if (selfUi.render3DHome) selfUi.render3DHome(true);
            selfUi.renderInspector(null);
          });
        }
        return;`;

if (!uiSrc.includes("sel.type === 'stair'")) {
  uiSrc = uiSrc.replace(
    "} else if (sel.type === 'opening') {",
    stairInspectorBlock + "\n      } else if (sel.type === 'opening') {"
  );
  fs.writeFileSync(path.join(rootDir, 'orbix-ui.js'), uiSrc, 'utf8');
  console.log('✓ orbix-ui.js updated with sel.type === stair Inspector panel');
} else {
  console.log('• orbix-ui.js already has sel.type === stair Inspector');
}

console.log('All staircase integration patches applied successfully!');

