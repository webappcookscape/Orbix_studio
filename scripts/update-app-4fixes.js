const fs = require('fs');

let app = fs.readFileSync('app.js', 'utf8');
const isCRLF = app.includes('\r\n');
if (isCRLF) app = app.replace(/\r\n/g, '\n');

// 1. Fix setSunlightIntensity and setSpotlightIntensity in GL
const idxSun = app.indexOf('setSunlightIntensity: function (val) {');
const idxFloor = app.indexOf('makeGrassGroundMat: makeGrassGroundMat, makeNeutralGroundMat: makeGrassGroundMat, setFloorMaterial:', idxSun);

if (idxSun === -1 || idxFloor === -1) {
  console.error('Light functions not found in app.js');
  process.exit(1);
}

const replaceLights = `setSunlightIntensity: function (val) {
      val = parseFloat(val);
      if (!isFinite(val)) return;
      window.sunlightIntensity = val;
      if (keyL) keyL.intensity = val;
      if (scene) {
        scene.traverse(function (o) {
          if (o.isDirectionalLight && o !== keyL) o.intensity = val * 0.38;
          if (o.isHemisphereLight) o.intensity = Math.max(0.1, val * 0.42);
        });
      }
      render();
    },
    setSpotlightIntensity: function (val) {
      val = parseFloat(val);
      if (!isFinite(val)) return;
      window.spotlightIntensity = val;
      if (scene) {
        scene.traverse(function (o) {
          if (o.isSpotLight || (o.isLight && (o.userData.isSpotlight || o.userData.isDownlight || (o.name && o.name.indexOf('Spotlight') !== -1) || (o.parent && o.parent.name && o.parent.name.indexOf('RoomLighting') !== -1)))) {
            o.intensity = val * 0.9;
          } else if (o.isPointLight && (o.name === 'roomFillLight' || (o.parent && o.parent.name && o.parent.name.indexOf('RoomLighting') !== -1))) {
            o.intensity = val * 0.45;
          }
        });
      }
      render();
    },
    `;

app = app.slice(0, idxSun) + replaceLights + app.slice(idxFloor);

// 2. Export window.GL and window.setSunlightIntensity right after GL definition
const targetGLEnd = `  })();

  /* ═══════════════════════════════════════════════════════════════
     DESIGN CATALOGUE — styles × formats, per cupboard type.`;

const replaceGLEnd = `  })();

  window.GL = GL;
  window.setSunlightIntensity = GL.setSunlightIntensity;
  window.setSpotlightIntensity = GL.setSpotlightIntensity;

  /* ═══════════════════════════════════════════════════════════════
     DESIGN CATALOGUE — styles × formats, per cupboard type.`;

if (!app.includes(targetGLEnd)) {
  console.error('targetGLEnd not found in app.js');
  process.exit(1);
}
app = app.replace(targetGLEnd, replaceGLEnd);

// 3. Remove 3D unit moving completely (furnDrag and gizmoDrag)
// Find pointerdown block
const targetPointerDown = `      // 0. Check 3D Gizmo translation arrows FIRST!
      // "on clicking unit it should show arrow like this then only it should be movable"
      if (GL.ok && GL.gizmoPick && e.button === 0) {
        var gHit = GL.gizmoPick(e.clientX, e.clientY);
        if (gHit) {
          var gObj = GL.getGizmoTarget();
          var gId = GL.getGizmoFurnId();
          if (gObj && gId) {
            var fp = GL.floorPoint(e.clientX, e.clientY) || { x: gObj.position.x, z: gObj.position.z };
            gizmoDrag = {
              axis: gHit.axis,
              id: gId,
              obj: gObj,
              dims: (gObj.userData && gObj.userData.dims) || { W: 1200, H: 850, D: 600 },
              startX: e.clientX,
              startY: e.clientY,
              startPos: { x: gObj.position.x, z: gObj.position.z },
              startPosY: gObj.position.y || 0,
              startRot: gObj.rotation.y || 0,
              startFloor: fp,
              moved: false
            };
            stage.setPointerCapture(e.pointerId);
            stage.classList.add("grab");
            e.stopImmediatePropagation();
            e.preventDefault();
            return;
          }
        }
      }

      // 1. Click unit: Show translation arrow gizmo and enable direct 3D floor drag
      if (GL.ok && GL.pickFurniture && e.button === 0) {
        var fHit = GL.pickFurniture(e.clientX, e.clientY);
        if (fHit) {
          var homeObj = (GL.getScene && GL.getScene()) ? GL.getScene().getObjectByName('OrbixHome3D') : null;
          var groupObj = fHit.object;
          while (groupObj && groupObj.parent && groupObj.parent !== homeObj && (!groupObj.userData || !groupObj.userData.isFurnitureGroup)) {
            groupObj = groupObj.parent;
          }
          if (!groupObj) groupObj = fHit.object;

          // Show Gizmo Arrows for this unit!
          GL.gizmoSet(groupObj, fHit.id);

          var fp = GL.floorPoint(e.clientX, e.clientY) || { x: groupObj.position.x, z: groupObj.position.z };
          furnDrag = {
            id: fHit.id,
            obj: groupObj,
            startX: e.clientX,
            startY: e.clientY,
            startPos: { x: groupObj.position.x, z: groupObj.position.z },
            offset: { x: groupObj.position.x - fp.x, z: groupObj.position.z - fp.z },
            dims: (groupObj.userData && groupObj.userData.dims) || { W: 1200, H: 850, D: 600 },
            moved: false
          };
          try { stage.setPointerCapture(e.pointerId); } catch (_) { }
          e.stopImmediatePropagation();
          e.preventDefault();

          if (window.OrbixUI && window.OrbixUI.editor) {
            window.OrbixUI.editor.selected = [{ type: 'furniture', id: fHit.id }];
            if (window.OrbixUI.editor.render) window.OrbixUI.editor.render();
            if (window.OrbixUI.renderInspector) window.OrbixUI.renderInspector(window.OrbixUI.editor.selected);
          }
          if (window.OrbixUI && typeof window.OrbixUI.selectFurnitureIn3DStudio === 'function') {
            window.OrbixUI.selectFurnitureIn3DStudio(fHit.id);
          }
          return;
        } else {
          // Clicked background: hide gizmo
          if (!hDrag && GL.gizmoSet) GL.gizmoSet(null);
        }
      }`;

const replacePointerDown = `      // 1. Click unit: Select furniture unit in inspector without moving it in 3D
      // Per user request: units do NOT move in 3D; mouse moves strictly orbit/pan the camera!
      if (GL.ok && GL.pickFurniture && e.button === 0) {
        var fHit = GL.pickFurniture(e.clientX, e.clientY);
        if (fHit) {
          if (window.OrbixUI && window.OrbixUI.editor) {
            window.OrbixUI.editor.selected = [{ type: 'furniture', id: fHit.id }];
            if (window.OrbixUI.editor.render) window.OrbixUI.editor.render();
            if (window.OrbixUI.renderInspector) window.OrbixUI.renderInspector(window.OrbixUI.editor.selected);
          }
          if (window.OrbixUI && typeof window.OrbixUI.selectFurnitureIn3DStudio === 'function') {
            window.OrbixUI.selectFurnitureIn3DStudio(fHit.id);
          }
          // Do NOT capture pointer or initiate drag: keeps units strictly fixed in 3D!
        }
      }`;

if (!app.includes(targetPointerDown)) {
  console.error('targetPointerDown not found in app.js');
  process.exit(1);
}
app = app.replace(targetPointerDown, replacePointerDown);

// Remove furnDrag and gizmoDrag blocks in pointermove
const targetFurnDragMove = `      // Furniture drag in 3D: direct floor translation + smart wall/adjacent unit snapping
      if (furnDrag) {
        e.stopImmediatePropagation();
        e.preventDefault();
        var p = GL.floorPoint(e.clientX, e.clientY);
        if (p) {
          if (Math.hypot(e.clientX - furnDrag.startX, e.clientY - furnDrag.startY) > 3) {
            furnDrag.moved = true;
            stage.style.cursor = "grabbing";
          }
          var targetX = p.x + furnDrag.offset.x;
          var targetZ = p.z + furnDrag.offset.z;

          // Live snap to wall / adjacent units in 3D if plan is available
          var planM = (window.OrbixUI && typeof window.OrbixUI.getPlan === 'function') ? window.OrbixUI.getPlan() : (window.OrbixUI && window.OrbixUI.project && window.OrbixUI.project.plan);
          if (window.OrbixCore && window.OrbixCore.snapFurniture && planM) {
            var candFurn = {
              id: furnDrag.id,
              pos: { x: targetX, y: targetZ },
              elevation: furnDrag.obj.position.y || 0,
              rotY: -(furnDrag.obj.rotation.y || 0),
              dimensions: furnDrag.dims
            };
            var snapped = window.OrbixCore.snapFurniture(candFurn, planM, furnDrag.id);
            if (snapped && snapped.pos) {
              targetX = snapped.pos.x;
              targetZ = snapped.pos.y;
              if (typeof snapped.rotY === 'number') {
                furnDrag.obj.rotation.y = -snapped.rotY;
              }
            }
          }

          furnDrag.obj.position.x = targetX;
          furnDrag.obj.position.z = targetZ;
          if (GL.gizmoSet) GL.gizmoSet(furnDrag.obj, furnDrag.id);
          GL.settle();
        }
        return;
      }`;

if (app.includes(targetFurnDragMove)) {
  app = app.replace(targetFurnDragMove, `      furnDrag = null;`);
} else {
  console.error('targetFurnDragMove not found');
  process.exit(1);
}

// Also disable gizmoDrag in pointermove
const targetGizmoDragMove = `      // 3D Gizmo Arrow Drag: move unit strictly along selected axis
      if (gizmoDrag) {
        e.stopImmediatePropagation();
        e.preventDefault();
        if (gizmoDrag.axis === 'y') {
          // Vertical Y-axis drag (adjust mounting height / elevation AFFL)
          var screenDy = gizmoDrag.startY - e.clientY;
          if (Math.abs(screenDy) > 3) {
            gizmoDrag.moved = true;
            stage.style.cursor = "ns-resize";
          }
          var newElev = Math.max(0, Math.min(3000, Math.round((gizmoDrag.startPosY + screenDy * 3.5) / 50) * 50));
          gizmoDrag.obj.position.y = newElev;
          if (GL.gizmoSet) GL.gizmoSet(gizmoDrag.obj, gizmoDrag.id);
          GL.settle();
        } else if (gizmoDrag.axis === 'rot') {
          // Continuous Yaw rotation
          var curPt = GL.floorPoint(e.clientX, e.clientY);
          if (curPt) {
            gizmoDrag.moved = true;
            stage.style.cursor = "crosshair";
            var angle = Math.atan2(curPt.x - gizmoDrag.startPos.x, curPt.z - gizmoDrag.startPos.z);
            // Snap to 15 degree increments
            var snappedAngle = Math.round(angle / (Math.PI / 12)) * (Math.PI / 12);
            gizmoDrag.obj.rotation.y = snappedAngle;
            if (GL.gizmoSet) GL.gizmoSet(gizmoDrag.obj, gizmoDrag.id);
            GL.settle();
          }
        } else {
          // Horizontal axis drag (x or z)
          var p = GL.floorPoint(e.clientX, e.clientY);
          if (p) {
            if (Math.hypot(e.clientX - gizmoDrag.startX, e.clientY - gizmoDrag.startY) > 3) {
              gizmoDrag.moved = true;
              stage.style.cursor = "ew-resize";
            }
            if (gizmoDrag.axis === 'x') {
              gizmoDrag.obj.position.x = p.x;
            } else if (gizmoDrag.axis === 'z') {
              gizmoDrag.obj.position.z = p.z;
            }
            if (GL.gizmoSet) GL.gizmoSet(gizmoDrag.obj, gizmoDrag.id);
            GL.settle();
          }
        }
        return;
      }`;

if (app.includes(targetGizmoDragMove)) {
  app = app.replace(targetGizmoDragMove, `      gizmoDrag = null;`);
}

if (isCRLF) app = app.replace(/\n/g, '\r\n');
fs.writeFileSync('app.js', app, 'utf8');
console.log('Successfully updated app.js!');
