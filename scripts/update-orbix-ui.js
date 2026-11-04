const fs = require('fs');
let code = fs.readFileSync('orbix-ui.js', 'utf8');
const eol = code.includes('\r\n') ? '\r\n' : '\n';

function replaceNorm(src, oldText, newText) {
  const normOld = oldText.replace(/\r\n/g, '\n');
  const normSrc = src.replace(/\r\n/g, '\n');
  if (!normSrc.includes(normOld)) {
    throw new Error('Could not find match in source:\n' + normOld.slice(0, 150));
  }
  const normNew = newText.replace(/\r\n/g, eol);
  return normSrc.replace(normOld, normNew).replace(/\n/g, eol);
}

const targetHL = `    highlight3DFurniture: function (furnId) {
      if (!window.__cc || !window.__cc.gl) return;
      var gl = window.__cc.gl;
      var scene = gl.getScene ? gl.getScene() : null;
      var homeObj = scene ? scene.getObjectByName('OrbixHome3D') : null;
      if (homeObj) {
        homeObj.traverse(function (obj) {
          if (obj.userData && obj.userData.isFurnitureGroup) {
            var isSel = (obj.userData.furnitureId === furnId);
            // Hide the selected unit inside OrbixHome3D when in unit mode so root's live parametric model is displayed
            if (isSel) {
              obj.visible = (window.Orbix3DViewMode === 'home');
            } else {
              obj.visible = true;
            }
          }
        });
      }
      if (gl.settle) gl.settle();
    },`;

const replaceHL = `    highlight3DFurniture: function (furnId) {
      if (!window.__cc || !window.__cc.gl) return;
      var gl = window.__cc.gl;
      var scene = gl.getScene ? gl.getScene() : null;
      var homeObj = scene ? scene.getObjectByName('OrbixHome3D') : null;
      if (homeObj) {
        var selGroup = null;
        homeObj.traverse(function (obj) {
          if (obj.userData && obj.userData.isFurnitureGroup) {
            obj.visible = true;
            if (obj.userData.furnitureId === furnId) {
              selGroup = obj;
            }
          }
        });
        if (gl.gizmoSet && furnId && selGroup) {
          gl.gizmoSet(selGroup, furnId);
        }
      }
      if (gl.settle) gl.settle();
    },`;

code = replaceNorm(code, targetHL, replaceHL);

const targetRender3D = `      if (this.archRenderer) {
        var proj = this.project || (this.editor && this.editor.project);
        this.archRenderer.buildHome(proj);
        if (!keepCamera && gl.frame) gl.frame();
        if (gl.apply) gl.apply();
        if (gl.settle) gl.settle();
      }`;

const replaceRender3D = `      if (this.archRenderer) {
        var proj = this.project || (this.editor && this.editor.project);
        this.archRenderer.buildHome(proj);
        var homeObj = scene.getObjectByName('OrbixHome3D');
        var selFurnId = null;
        if (this.editor && this.editor.selected && this.editor.selected.length > 0) {
          var selItem = this.editor.selected.find(function (it) { return it.type === 'furniture'; });
          if (selItem) selFurnId = selItem.id;
        } else if (gl.getGizmoFurnId) {
          selFurnId = gl.getGizmoFurnId();
        }
        if (selFurnId && homeObj && gl.gizmoSet) {
          var foundMesh = null;
          homeObj.traverse(function (c) {
            if (c.userData && c.userData.isFurnitureGroup && c.userData.furnitureId === selFurnId) {
              foundMesh = c;
            }
          });
          if (foundMesh) {
            gl.gizmoSet(foundMesh, selFurnId);
          }
        }
        if (!keepCamera && gl.frame) gl.frame();
        if (gl.apply) gl.apply();
        if (gl.settle) gl.settle();
      }`;

code = replaceNorm(code, targetRender3D, replaceRender3D);

fs.writeFileSync('orbix-ui.js', code, 'utf8');
console.log('Successfully updated orbix-ui.js with gizmo reattachment!');
