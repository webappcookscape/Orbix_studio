with open('orbix-ui.js', 'r', encoding='utf-8') as f:
    content = f.read()

old_html = """          '<div style="margin-top:10px;padding:8px 10px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;">' +
          '  <label style="font-size:11px;font-weight:700;color:#1e293b;display:block;margin-bottom:4px;">🧱 RCC Column Joint (Separate Wall)</label>' +
          '  <div style="font-size:10.5px;color:#64748b;margin-bottom:6px;">Split this straight wall into separate walls at an RCC joint:</div>' +
          '  <div style="display:flex;gap:6px;">' +
          '    <button type="button" class="btn small full" id="inspWallSplitMid" style="background:#0f172a;color:#ffffff;font-size:11px;">➕ RCC Joint at Midpoint (' + Math.round(lenMm / 2) + 'mm)</button>' +
          '  </div>' +
          '</div>' +"""

new_html = """          '<div style="margin-top:10px;padding:8px 10px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;">' +
          '  <label style="font-size:11px;font-weight:700;color:#1e293b;display:block;margin-bottom:4px;">🧱 RCC Column Joint (Separate Wall)</label>' +
          '  <div style="font-size:10.5px;color:#64748b;margin-bottom:6px;">Split this straight wall into separate walls at an RCC joint:</div>' +
          '  <div style="display:flex;gap:6px;">' +
          '    <button type="button" class="btn small full" id="inspWallSplitMid" style="background:#0f172a;color:#ffffff;font-size:11px;">➕ RCC Joint at Midpoint (' + Math.round(lenMm / 2) + 'mm)</button>' +
          '  </div>' +
          '  <div style="display:flex;gap:6px;margin-top:6px;align-items:center;">' +
          '    <input type="number" id="inspWallSplitDist" class="input small" placeholder="Offset mm" style="width:105px;height:26px;font-size:11px;padding:0 5px;" value="' + Math.round(lenMm / 2) + '" min="100" max="' + Math.max(100, Math.round(lenMm) - 100) + '">' +
          '    <button type="button" class="btn small" id="inspWallSplitCustom" style="background:#2563eb;color:#ffffff;font-size:11px;flex:1;height:26px;padding:0 6px;">➕ Split at Offset</button>' +
          '  </div>' +
          '</div>' +"""

assert old_html in content, "old_html not found"
content = content.replace(old_html, new_html)

old_listener = """        var elSplitMid = document.getElementById('inspWallSplitMid');
        if (elSplitMid) {
          elSplitMid.addEventListener('click', function () {
            var midPt = { x: (w.start.x + w.end.x) / 2, y: (w.start.y + w.end.y) / 2 };
            var res = Core.splitWall(ed.project, w.id, midPt);
            if (res) {
              if (Core.detectRooms) Core.detectRooms(ed.project);
              ed.pushHistory('Insert RCC Column Joint');
              ed.selected = [{ type: 'wall', id: res.wall1.id }];
              ed.render();
              self.renderInspector(ed.selected);
              if (self.render3DHome) self.render3DHome(true);
              if (typeof window.toast === 'function') {
                window.toast('🧱 RCC Joint inserted: Wall separated into two individual walls');
              }
            }
          });
        }"""

new_listener = """        var elSplitMid = document.getElementById('inspWallSplitMid');
        if (elSplitMid) {
          elSplitMid.addEventListener('click', function () {
            var midPt = { x: (w.start.x + w.end.x) / 2, y: (w.start.y + w.end.y) / 2 };
            var res = Core.splitWall(ed.project, w.id, midPt);
            if (res) {
              if (Core.detectRooms) Core.detectRooms(ed.project);
              ed.pushHistory('Insert RCC Column Joint');
              ed.selected = [{ type: 'wall', id: res.wall1.id }];
              ed.render();
              self.renderInspector(ed.selected);
              if (self.render3DHome) self.render3DHome(true);
              if (typeof window.toast === 'function') {
                window.toast('🧱 RCC Joint inserted: Wall separated into two individual walls');
              }
            }
          });
        }

        var elSplitCustom = document.getElementById('inspWallSplitCustom');
        var elSplitDist = document.getElementById('inspWallSplitDist');
        if (elSplitCustom && elSplitDist) {
          elSplitCustom.addEventListener('click', function () {
            var dist = parseFloat(elSplitDist.value);
            if (!isNaN(dist) && dist > 50 && dist < lenMm - 50) {
              var dir = Core.wallDirection(w);
              var splitPt = { x: w.start.x + dir.x * dist, y: w.start.y + dir.y * dist };
              var res = Core.splitWall(ed.project, w.id, splitPt);
              if (res) {
                if (Core.detectRooms) Core.detectRooms(ed.project);
                ed.pushHistory('Insert RCC Column Joint');
                ed.selected = [{ type: 'wall', id: res.wall1.id }];
                ed.render();
                self.renderInspector(ed.selected);
                if (self.render3DHome) self.render3DHome(true);
                if (typeof window.toast === 'function') {
                  window.toast('🧱 Wall separated into two individual walls at ' + Math.round(dist) + 'mm');
                }
              }
            }
          });
        }"""

assert old_listener in content, "old_listener not found"
content = content.replace(old_listener, new_listener)

with open('orbix-ui.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated orbix-ui.js successfully!")

