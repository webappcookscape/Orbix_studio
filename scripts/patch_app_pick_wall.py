with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add pickWall after pickFurniture
old_after_pickFurn = """      return null;
    }
    function frame(forceMode) {"""

new_after_pickFurn = """      return null;
    }
    function pickWall(clientX, clientY) {
      if (!ok || !scene) return null;
      if (!ray) { ray = new THREE.Raycaster(); ndc = new THREE.Vector2(); }
      var r = getCanvasNdcRect();
      if (!r || !r.width || !r.height) return null;
      ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);

      var homeObj = scene.getObjectByName('OrbixHome3D');
      if (!homeObj || !homeObj.children || homeObj.children.length === 0 || !isVisObj(homeObj, scene)) return null;

      var hits = ray.intersectObjects(homeObj.children, true);
      for (var i = 0; i < hits.length; i++) {
        var ho = hits[i].object;
        if (!ho || !ho.isMesh || !isVisObj(ho, scene)) continue;

        var cur = ho;
        var wallId = null;
        while (cur && cur !== homeObj) {
          if (cur.userData && cur.userData.wallId) {
            wallId = cur.userData.wallId;
            break;
          }
          if (cur.name && cur.name.indexOf('Wall_') === 0) {
            wallId = cur.name.replace('Wall_', '');
            break;
          }
          cur = cur.parent;
        }
        if (wallId) {
          return { object: ho, wallId: wallId, hitPoint: hits[i].point };
        }
      }
      return null;
    }
    function frame(forceMode) {"""

assert old_after_pickFurn in content, "old_after_pickFurn not found"
content = content.replace(old_after_pickFurn, new_after_pickFurn)
print("1. Added pickWall function")

# 2. Add pickWall to GL return object
old_return = "pickFurniture: pickFurniture, pickPanel: pickPanel,"
new_return = "pickFurniture: pickFurniture, pickWall: pickWall, pickPanel: pickPanel,"
assert old_return in content, "old_return not found"
content = content.replace(old_return, new_return)
print("2. Added pickWall to GL return object")

# 3. Add wall selection in pointerdown
old_ptdown = """          if (window.OrbixUI && typeof window.OrbixUI.selectFurnitureIn3DStudio === 'function') {
            window.OrbixUI.selectFurnitureIn3DStudio(fHit.id);
          }
          // Do NOT capture pointer or initiate drag: keeps units strictly fixed in 3D!
        }
      }"""

new_ptdown = """          if (window.OrbixUI && typeof window.OrbixUI.selectFurnitureIn3DStudio === 'function') {
            window.OrbixUI.selectFurnitureIn3DStudio(fHit.id);
          }
          // Do NOT capture pointer or initiate drag: keeps units strictly fixed in 3D!
        } else if (GL.pickWall) {
          var wHit = GL.pickWall(e.clientX, e.clientY);
          if (wHit && wHit.wallId) {
            if (window.OrbixUI && window.OrbixUI.editor) {
              window.OrbixUI.editor.selected = [{ type: 'wall', id: wHit.wallId }];
              if (window.OrbixUI.editor.render) window.OrbixUI.editor.render();
              if (window.OrbixUI.renderInspector) window.OrbixUI.renderInspector(window.OrbixUI.editor.selected);
            }
          }
        }
      }"""

assert old_ptdown in content, "old_ptdown not found"
content = content.replace(old_ptdown, new_ptdown)
print("3. Added wall selection in pointerdown")

# 4. Add wall selection in up(e)
old_up = """      if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 5 && Date.now() - downAt.t < 500) {
        GL.pick(e.clientX, e.clientY);
      }"""

new_up = """      if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 5 && Date.now() - downAt.t < 500) {
        var didPick = GL.pick(e.clientX, e.clientY);
        if (!didPick && GL.pickWall) {
          var wHit = GL.pickWall(e.clientX, e.clientY);
          if (wHit && wHit.wallId) {
            if (window.OrbixUI && window.OrbixUI.editor) {
              window.OrbixUI.editor.selected = [{ type: 'wall', id: wHit.wallId }];
              if (window.OrbixUI.editor.render) window.OrbixUI.editor.render();
              if (window.OrbixUI.renderInspector) window.OrbixUI.renderInspector(window.OrbixUI.editor.selected);
            }
          }
        }
      }"""

assert old_up in content, "old_up not found"
content = content.replace(old_up, new_up)
print("4. Added wall selection in up(e)")

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated app.js successfully!")

