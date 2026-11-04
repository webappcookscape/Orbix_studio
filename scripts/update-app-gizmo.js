const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');
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

// 1. Add setUnitOverlapVisual function before gizmoSet
const overlapVisualFunc = [
  '  /* ── 3D Unit Overlap & Collision Visual Feedback ── */',
  '  function setUnitOverlapVisual(furnGroup, isOverlapped){',
  '    if(!furnGroup) return;',
  '    if(isOverlapped){',
  '      if(furnGroup.userData.isOverlapped) return;',
  '      furnGroup.userData.isOverlapped = true;',
  '      var redMat = new THREE.MeshStandardMaterial({',
  '        color: 0xEF4444,',
  '        emissive: 0xDC2626,',
  '        emissiveIntensity: 0.35,',
  '        roughness: 0.35,',
  '        metalness: 0.05,',
  '        transparent: true,',
  '        opacity: 0.55,',
  '        side: THREE.DoubleSide',
  '      });',
  '      furnGroup.traverse(function(c){',
  '        if(c.isMesh && c.material && !c.userData.isGizmo){',
  '          if(!c.userData.origMat) c.userData.origMat = c.material;',
  '          c.material = redMat;',
  '        }',
  '      });',
  '      if(gizmoGroup && gizmoGroup.userData && gizmoGroup.userData.boxLines){',
  '        gizmoGroup.userData.boxLines.material.color.setHex(0xEF4444);',
  '      }',
  '      if(gizmoGroup && gizmoGroup.userData && gizmoGroup.userData.topLines){',
  '        gizmoGroup.userData.topLines.material.color.setHex(0xEF4444);',
  '      }',
  '    } else {',
  '      if(!furnGroup.userData.isOverlapped) return;',
  '      furnGroup.userData.isOverlapped = false;',
  '      furnGroup.traverse(function(c){',
  '        if(c.isMesh && c.userData.origMat){',
  '          c.material = c.userData.origMat;',
  '          delete c.userData.origMat;',
  '        }',
  '      });',
  '      if(gizmoGroup && gizmoGroup.userData && gizmoGroup.userData.boxLines){',
  '        gizmoGroup.userData.boxLines.material.color.setHex(0xF59E0B);',
  '      }',
  '      if(gizmoGroup && gizmoGroup.userData && gizmoGroup.userData.topLines){',
  '        gizmoGroup.userData.topLines.material.color.setHex(0x38BDF8);',
  '      }',
  '    }',
  '    render();',
  '  }',
  ''
].join(eol);

code = replaceNorm(code, '  function gizmoSet(furnObj, furnId){', overlapVisualFunc + '  function gizmoSet(furnObj, furnId){');

// 2. Enhance gizmoSet with arrowLeft (-X), arrowUp (+Y vertical elevation), boxLines/topLines userData, and initial collision check
const targetGizmoBody = `    // 1. Orange 3D Bounding Box Lines (#F59E0B)
    var boxPts = [
      new THREE.Vector3(-hw, 1, -hd), new THREE.Vector3(hw, 1, -hd),
      new THREE.Vector3(hw, 1, -hd), new THREE.Vector3(hw, 1, hd),
      new THREE.Vector3(hw, 1, hd), new THREE.Vector3(-hw, 1, hd),
      new THREE.Vector3(-hw, 1, hd), new THREE.Vector3(-hw, 1, -hd),
      new THREE.Vector3(-hw, 1, -hd), new THREE.Vector3(-hw, hh, -hd),
      new THREE.Vector3(hw, 1, -hd), new THREE.Vector3(hw, hh, -hd),
      new THREE.Vector3(hw, 1, hd), new THREE.Vector3(hw, hh, hd),
      new THREE.Vector3(-hw, 1, hd), new THREE.Vector3(-hw, hh, hd)
    ];
    var boxGeo = new THREE.BufferGeometry().setFromPoints(boxPts);
    var boxLines = new THREE.LineSegments(boxGeo, new THREE.LineBasicMaterial({ color: 0xF59E0B, linewidth: 2, depthTest: false }));
    boxLines.renderOrder = 9998;
    gizmoGroup.add(boxLines);

    // 2. Cyan / Blue Top Face Border (#38BDF8)
    var topPts = [
      new THREE.Vector3(-hw, hh + 2, -hd), new THREE.Vector3(hw, hh + 2, -hd),
      new THREE.Vector3(hw, hh + 2, -hd), new THREE.Vector3(hw, hh + 2, hd),
      new THREE.Vector3(hw, hh + 2, hd), new THREE.Vector3(-hw, hh + 2, hd),
      new THREE.Vector3(-hw, hh + 2, hd), new THREE.Vector3(-hw, hh + 2, -hd)
    ];
    var topGeo = new THREE.BufferGeometry().setFromPoints(topPts);
    var topLines = new THREE.LineSegments(topGeo, new THREE.LineBasicMaterial({ color: 0x38BDF8, linewidth: 3, depthTest: false }));
    topLines.renderOrder = 9998;
    gizmoGroup.add(topLines);

    // 3. Flat Red Arrow (Right) - Translates unit along +X (width / along wall)
    var redArrow = makeFlatArrowMesh(0xF87171, 35, 110, 80, 80);
    redArrow.rotation.x = -Math.PI / 2;
    redArrow.rotation.z = -Math.PI / 2; // Points right along +X
    redArrow.position.set(hw + 25, 4, 0);
    redArrow.userData = { isGizmo: true, axis: 'x', dir: 1, name: 'arrowRight' };
    gizmoGroup.add(redArrow);
    gizmoMeshes.push(redArrow);

    // 4. Flat Blue Arrow (Front) - Pulls unit forward along +Z (depth / into room)
    var blueArrow = makeFlatArrowMesh(0x60A5FA, 35, 110, 80, 80);
    blueArrow.rotation.x = -Math.PI / 2; // Points forward along +Z
    blueArrow.position.set(0, 4, hd + 25);
    blueArrow.userData = { isGizmo: true, axis: 'z', dir: 1, name: 'arrowFront' };
    gizmoGroup.add(blueArrow);
    gizmoMeshes.push(blueArrow);

    // 5. Flat Green Arrow (Back) - On countertop, points backward along -Z (towards wall)
    var greenArrow = makeFlatArrowMesh(0x10B981, 35, 100, 75, 75);
    greenArrow.rotation.x = -Math.PI / 2;
    greenArrow.rotation.z = Math.PI; // Points backward along -Z
    greenArrow.position.set(0, hh + 4, -hd * 0.1);
    greenArrow.userData = { isGizmo: true, axis: 'z', dir: -1, name: 'arrowBack' };
    gizmoGroup.add(greenArrow);
    gizmoMeshes.push(greenArrow);

    // 6. Curved Green Rotation Arc Arrow - At front-right corner
    var rotArc = makeCurvedArrowMesh(0x34D399, 90, Math.PI / 2, 22);
    rotArc.rotation.x = -Math.PI / 2;
    rotArc.rotation.z = -Math.PI / 4;
    rotArc.position.set(hw + 25, 4, hd + 25);
    rotArc.userData = { isGizmo: true, axis: 'rot', name: 'arrowRotate' };
    gizmoGroup.add(rotArc);
    gizmoMeshes.push(rotArc);

    render();`;

const replaceGizmoBody = `    // 1. Orange 3D Bounding Box Lines (#F59E0B)
    var boxPts = [
      new THREE.Vector3(-hw, 1, -hd), new THREE.Vector3(hw, 1, -hd),
      new THREE.Vector3(hw, 1, -hd), new THREE.Vector3(hw, 1, hd),
      new THREE.Vector3(hw, 1, hd), new THREE.Vector3(-hw, 1, hd),
      new THREE.Vector3(-hw, 1, hd), new THREE.Vector3(-hw, 1, -hd),
      new THREE.Vector3(-hw, 1, -hd), new THREE.Vector3(-hw, hh, -hd),
      new THREE.Vector3(hw, 1, -hd), new THREE.Vector3(hw, hh, -hd),
      new THREE.Vector3(hw, 1, hd), new THREE.Vector3(hw, hh, hd),
      new THREE.Vector3(-hw, 1, hd), new THREE.Vector3(-hw, hh, hd)
    ];
    var boxGeo = new THREE.BufferGeometry().setFromPoints(boxPts);
    var boxLines = new THREE.LineSegments(boxGeo, new THREE.LineBasicMaterial({ color: 0xF59E0B, linewidth: 2, depthTest: false }));
    boxLines.renderOrder = 9998;
    gizmoGroup.add(boxLines);
    gizmoGroup.userData.boxLines = boxLines;

    // 2. Cyan / Blue Top Face Border (#38BDF8)
    var topPts = [
      new THREE.Vector3(-hw, hh + 2, -hd), new THREE.Vector3(hw, hh + 2, -hd),
      new THREE.Vector3(hw, hh + 2, -hd), new THREE.Vector3(hw, hh + 2, hd),
      new THREE.Vector3(hw, hh + 2, hd), new THREE.Vector3(-hw, hh + 2, hd),
      new THREE.Vector3(-hw, hh + 2, hd), new THREE.Vector3(-hw, hh + 2, -hd)
    ];
    var topGeo = new THREE.BufferGeometry().setFromPoints(topPts);
    var topLines = new THREE.LineSegments(topGeo, new THREE.LineBasicMaterial({ color: 0x38BDF8, linewidth: 3, depthTest: false }));
    topLines.renderOrder = 9998;
    gizmoGroup.add(topLines);
    gizmoGroup.userData.topLines = topLines;

    // 3. Flat Red Arrow (Right) - Translates unit along +X (width / along wall)
    var redArrow = makeFlatArrowMesh(0xF87171, 35, 110, 80, 80);
    redArrow.rotation.x = -Math.PI / 2;
    redArrow.rotation.z = -Math.PI / 2; // Points right along +X
    redArrow.position.set(hw + 25, 4, 0);
    redArrow.userData = { isGizmo: true, axis: 'x', dir: 1, name: 'arrowRight' };
    gizmoGroup.add(redArrow);
    gizmoMeshes.push(redArrow);

    // 4. Flat Red Arrow (Left) - Translates unit along -X
    var redArrowLeft = makeFlatArrowMesh(0xF87171, 35, 110, 80, 80);
    redArrowLeft.rotation.x = -Math.PI / 2;
    redArrowLeft.rotation.z = Math.PI / 2; // Points left along -X
    redArrowLeft.position.set(-hw - 25, 4, 0);
    redArrowLeft.userData = { isGizmo: true, axis: 'x', dir: -1, name: 'arrowLeft' };
    gizmoGroup.add(redArrowLeft);
    gizmoMeshes.push(redArrowLeft);

    // 5. Flat Blue Arrow (Front) - Pulls unit forward along +Z (depth / into room)
    var blueArrow = makeFlatArrowMesh(0x60A5FA, 35, 110, 80, 80);
    blueArrow.rotation.x = -Math.PI / 2; // Points forward along +Z
    blueArrow.position.set(0, 4, hd + 25);
    blueArrow.userData = { isGizmo: true, axis: 'z', dir: 1, name: 'arrowFront' };
    gizmoGroup.add(blueArrow);
    gizmoMeshes.push(blueArrow);

    // 6. Flat Green Arrow (Back) - On countertop, points backward along -Z (towards wall)
    var greenArrow = makeFlatArrowMesh(0x10B981, 35, 100, 75, 75);
    greenArrow.rotation.x = -Math.PI / 2;
    greenArrow.rotation.z = Math.PI; // Points backward along -Z
    greenArrow.position.set(0, hh + 4, -hd * 0.1);
    greenArrow.userData = { isGizmo: true, axis: 'z', dir: -1, name: 'arrowBack' };
    gizmoGroup.add(greenArrow);
    gizmoMeshes.push(greenArrow);

    // 7. Upward 3D Arrow (Elevation along +Y - Mounting Height AFFL)
    var yArrowGroup = new THREE.Group();
    var yShaftGeo = new THREE.CylinderGeometry(8, 8, 70, 16);
    var yHeadGeo = new THREE.ConeGeometry(22, 40, 16);
    var yMat = new THREE.MeshStandardMaterial({
      color: 0xEAB308,
      emissive: 0xCA8A04,
      emissiveIntensity: 0.35,
      roughness: 0.3,
      metalness: 0.2,
      depthTest: false,
      transparent: true,
      opacity: 0.95
    });
    var yShaftMesh = new THREE.Mesh(yShaftGeo, yMat);
    yShaftMesh.position.y = 35;
    yShaftMesh.renderOrder = 9999;
    var yHeadMesh = new THREE.Mesh(yHeadGeo, yMat);
    yHeadMesh.position.y = 70 + 20;
    yHeadMesh.renderOrder = 9999;
    yArrowGroup.add(yShaftMesh);
    yArrowGroup.add(yHeadMesh);
    yArrowGroup.position.set(0, hh + 2, 0);
    yArrowGroup.userData = { isGizmo: true, axis: 'y', dir: 1, name: 'arrowUp' };
    yShaftMesh.userData = { isGizmo: true, axis: 'y', dir: 1, name: 'arrowUp' };
    yHeadMesh.userData = { isGizmo: true, axis: 'y', dir: 1, name: 'arrowUp' };
    gizmoGroup.add(yArrowGroup);
    gizmoMeshes.push(yShaftMesh);
    gizmoMeshes.push(yHeadMesh);

    // 8. Curved Green Rotation Arc Arrow - At front-right corner
    var rotArc = makeCurvedArrowMesh(0x34D399, 90, Math.PI / 2, 22);
    rotArc.rotation.x = -Math.PI / 2;
    rotArc.rotation.z = -Math.PI / 4;
    rotArc.position.set(hw + 25, 4, hd + 25);
    rotArc.userData = { isGizmo: true, axis: 'rot', name: 'arrowRotate' };
    gizmoGroup.add(rotArc);
    gizmoMeshes.push(rotArc);

    // Initial check: if unit is already placed in collision, visually indicate it immediately
    if(window.OrbixCore && window.OrbixCore.checkPlacementOverlap && furn && plan){
      var initChk = window.OrbixCore.checkPlacementOverlap(furn, plan, furnId);
      setUnitOverlapVisual(furnObj, initChk.hasOverlap);
    } else {
      setUnitOverlapVisual(furnObj, false);
    }

    render();`;

code = replaceNorm(code, targetGizmoBody, replaceGizmoBody);

// 3. Update pointerdown gizmoDrag construction to include startPosY and startRot
const targetPDown = `          gizmoDrag = {
            axis: gHit.axis,
            id: gId,
            obj: gObj,
            startX: e.clientX,
            startY: e.clientY,
            startPos: { x: gObj.position.x, z: gObj.position.z },
            startFloor: fp,
            moved: false
          };`;

const replacePDown = `          gizmoDrag = {
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
          };`;

code = replaceNorm(code, targetPDown, replacePDown);

// 4. Update pointermove with Y-axis elevation dragging & real-time overlap check & hover cursor
const targetPMove = `  stage.addEventListener("pointermove", function(e){
    // 3D Gizmo Arrow Drag: move unit strictly along selected axis
    if(gizmoDrag){
      e.stopImmediatePropagation();
      e.preventDefault();
      var curF = GL.floorPoint(e.clientX, e.clientY);
      if(curF){
        var dx = curF.x - gizmoDrag.startFloor.x;
        var dz = curF.z - gizmoDrag.startFloor.z;
        if(Math.hypot(e.clientX - gizmoDrag.startX, e.clientY - gizmoDrag.startY) > 3){
          gizmoDrag.moved = true;
          stage.style.cursor = "grabbing";
        }
        var theta = (gizmoDrag.obj.rotation ? gizmoDrag.obj.rotation.y : 0);
        if(gizmoDrag.axis === 'x'){
          // Movement along local X (length / wall direction)
          var deltaLocalX = dx * Math.cos(theta) - dz * Math.sin(theta);
          gizmoDrag.obj.position.x = gizmoDrag.startPos.x + deltaLocalX * Math.cos(theta);
          gizmoDrag.obj.position.z = gizmoDrag.startPos.z - deltaLocalX * Math.sin(theta);
        } else if(gizmoDrag.axis === 'z'){
          // Movement along local Z (depth / perpendicular to wall)
          var deltaLocalZ = dx * Math.sin(theta) + dz * Math.cos(theta);
          gizmoDrag.obj.position.x = gizmoDrag.startPos.x + deltaLocalZ * Math.sin(theta);
          gizmoDrag.obj.position.z = gizmoDrag.startPos.z + deltaLocalZ * Math.cos(theta);
        } else if(gizmoDrag.axis === 'rot'){
          // Free rotation around vertical axis
          var cx = gizmoDrag.startPos.x, cz = gizmoDrag.startPos.z;
          var angle = Math.atan2(curF.x - cx, curF.z - cz);
          gizmoDrag.obj.rotation.y = angle;
        } else {
          gizmoDrag.obj.position.x = gizmoDrag.startPos.x + dx;
          gizmoDrag.obj.position.z = gizmoDrag.startPos.z + dz;
        }
        GL.gizmoSet(gizmoDrag.obj, gizmoDrag.id);
        GL.settle();
      }
      return;
    }`;

const replacePMove = `  stage.addEventListener("pointermove", function(e){
    // 3D Gizmo Arrow Drag: move unit strictly along selected axis
    if(gizmoDrag){
      e.stopImmediatePropagation();
      e.preventDefault();
      if(gizmoDrag.axis === 'y'){
        // Vertical Y-axis drag (adjust mounting height / elevation AFFL)
        var screenDy = gizmoDrag.startY - e.clientY;
        if(Math.abs(screenDy) > 3){
          gizmoDrag.moved = true;
          stage.style.cursor = "ns-resize";
        }
        var newElev = Math.max(0, Math.min(3000, Math.round((gizmoDrag.startPosY + screenDy * 3.5) / 50) * 50));
        gizmoDrag.obj.position.y = newElev;
      } else {
        var curF = GL.floorPoint(e.clientX, e.clientY);
        if(curF){
          var dx = curF.x - gizmoDrag.startFloor.x;
          var dz = curF.z - gizmoDrag.startFloor.z;
          if(Math.hypot(e.clientX - gizmoDrag.startX, e.clientY - gizmoDrag.startY) > 3){
            gizmoDrag.moved = true;
            stage.style.cursor = "grabbing";
          }
          var theta = (gizmoDrag.obj.rotation ? gizmoDrag.obj.rotation.y : 0);
          if(gizmoDrag.axis === 'x'){
            // Movement along local X (length / wall direction)
            var deltaLocalX = dx * Math.cos(theta) - dz * Math.sin(theta);
            gizmoDrag.obj.position.x = gizmoDrag.startPos.x + deltaLocalX * Math.cos(theta);
            gizmoDrag.obj.position.z = gizmoDrag.startPos.z - deltaLocalX * Math.sin(theta);
          } else if(gizmoDrag.axis === 'z'){
            // Movement along local Z (depth / perpendicular to wall)
            var deltaLocalZ = dx * Math.sin(theta) + dz * Math.cos(theta);
            gizmoDrag.obj.position.x = gizmoDrag.startPos.x + deltaLocalZ * Math.sin(theta);
            gizmoDrag.obj.position.z = gizmoDrag.startPos.z + deltaLocalZ * Math.cos(theta);
          } else if(gizmoDrag.axis === 'rot'){
            // Free rotation around vertical axis
            var cx = gizmoDrag.startPos.x, cz = gizmoDrag.startPos.z;
            var angle = Math.atan2(curF.x - cx, curF.z - cz);
            gizmoDrag.obj.rotation.y = angle;
          } else {
            gizmoDrag.obj.position.x = gizmoDrag.startPos.x + dx;
            gizmoDrag.obj.position.z = gizmoDrag.startPos.z + dz;
          }
        }
      }

      // Live collision/overlap check against walls, corner intersections, and adjacent units
      var planM = (window.OrbixUI && typeof window.OrbixUI.getPlan === 'function') ? window.OrbixUI.getPlan() : (window.OrbixUI && window.OrbixUI.project && window.OrbixUI.project.plan);
      if(window.OrbixCore && window.OrbixCore.checkPlacementOverlap && planM){
        var testFurn = {
          id: gizmoDrag.id,
          pos: { x: gizmoDrag.obj.position.x, y: gizmoDrag.obj.position.z },
          elevation: gizmoDrag.obj.position.y || 0,
          rotY: -(gizmoDrag.obj.rotation.y || 0),
          dimensions: gizmoDrag.dims || { W: 1200, H: 850, D: 600 }
        };
        var chk = window.OrbixCore.checkPlacementOverlap(testFurn, planM, gizmoDrag.id);
        setUnitOverlapVisual(gizmoDrag.obj, chk.hasOverlap);
      }

      GL.gizmoSet(gizmoDrag.obj, gizmoDrag.id);
      GL.settle();
      return;
    }

    // Interactive cursor feedback on hovering Gizmo arrows
    if(!hDrag && !furnDrag && GL.ok && GL.gizmoPick){
      var hoverHit = GL.gizmoPick(e.clientX, e.clientY);
      if(hoverHit){
        if(hoverHit.axis === 'y') stage.style.cursor = "ns-resize";
        else if(hoverHit.axis === 'x') stage.style.cursor = "ew-resize";
        else if(hoverHit.axis === 'rot') stage.style.cursor = "crosshair";
        else stage.style.cursor = "pointer";
      } else {
        if(stage.style.cursor === "ns-resize" || stage.style.cursor === "ew-resize" || stage.style.cursor === "crosshair" || stage.style.cursor === "pointer"){
          stage.style.cursor = "";
        }
      }
    }`;

code = replaceNorm(code, targetPMove, replacePMove);

// 5. Update pointerup with revert on overlap, 90° rotation check, and Y-axis elevation saving
const targetPUp = `      if(gd.axis === 'rot' && !gd.moved){
        // Clicking rotation arc directly turns 90 degrees
        gd.obj.rotation.y = ((gd.obj.rotation.y || 0) + Math.PI / 2) % (Math.PI * 2);
        GL.gizmoSet(gd.obj, gd.id);
        GL.settle();
        var planR = (window.OrbixUI && typeof window.OrbixUI.getPlan === 'function') ? window.OrbixUI.getPlan() : (window.OrbixUI && window.OrbixUI.project && window.OrbixUI.project.plan);
        if(planR && planR.furniture){
          var fR = planR.furniture.find(function(it){ return it.id === gd.id; });
          if(fR){
            fR.rotY = gd.obj.rotation.y;
            if(window.OrbixUI.editor) window.OrbixUI.editor.pushHistory('Rotate Furniture (Gizmo)');
            if(window.OrbixUI.saveToLocalStorage) window.OrbixUI.saveToLocalStorage();
            if(window.OrbixProjects && window.OrbixProjects.saveActiveProject) window.OrbixProjects.saveActiveProject();
          }
        }
      } else if(gd.moved){
        var finalX = Math.round(gd.obj.position.x / 50) * 50;
        var finalZ = Math.round(gd.obj.position.z / 50) * 50;
        gd.obj.position.x = finalX;
        gd.obj.position.z = finalZ;
        GL.gizmoSet(gd.obj, gd.id);
        GL.settle();

        var plan = (window.OrbixUI && typeof window.OrbixUI.getPlan === 'function') ? window.OrbixUI.getPlan() : (window.OrbixUI && window.OrbixUI.project && window.OrbixUI.project.plan);
        if(plan){
          var list = plan.furniture || [];
          for(var i = 0; i < list.length; i++){
            if(list[i].id === gd.id){
              list[i].pos.x = finalX;
              list[i].pos.y = finalZ;
              var rms = plan.rooms || [];
              for(var r = 0; r < rms.length; r++){
                if(window.OrbixCore && window.OrbixCore.Vec2 && window.OrbixCore.Vec2.pointInPolygon(list[i].pos, rms[r].polygon)){
                  list[i].roomId = rms[r].id;
                  break;
                }
              }
              break;
            }
          }
          if(window.OrbixUI && window.OrbixUI.saveToLocalStorage) window.OrbixUI.saveToLocalStorage();
          if(window.OrbixProjects && window.OrbixProjects.saveActiveProject) window.OrbixProjects.saveActiveProject();
          if(window.OrbixUI && window.OrbixUI.editor){
            window.OrbixUI.editor.pushHistory('Move Furniture (3D Gizmo)');
            window.OrbixUI.editor.render();
          }
          if(window.OrbixUI && window.OrbixUI.renderBOQ) window.OrbixUI.renderBOQ();
          if(window.OrbixUI && window.OrbixUI.renderInspector) window.OrbixUI.renderInspector([{ type: 'furniture', id: gd.id }]);
        }
      }`;

const replacePUp = `      var plan = (window.OrbixUI && typeof window.OrbixUI.getPlan === 'function') ? window.OrbixUI.getPlan() : (window.OrbixUI && window.OrbixUI.project && window.OrbixUI.project.plan);

      if(gd.axis === 'rot' && !gd.moved){
        // Clicking rotation arc directly turns 90 degrees
        var candRotY = ((gd.obj.rotation.y || 0) - Math.PI / 2) % (Math.PI * 2);
        var candFurnR = {
          id: gd.id,
          pos: { x: gd.obj.position.x, y: gd.obj.position.z },
          elevation: gd.obj.position.y || 0,
          rotY: -candRotY,
          dimensions: gd.dims
        };
        var chkR = (window.OrbixCore && window.OrbixCore.checkPlacementOverlap && plan) ?
          window.OrbixCore.checkPlacementOverlap(candFurnR, plan, gd.id) : { hasOverlap: false };

        if(chkR.hasOverlap){
          setUnitOverlapVisual(gd.obj, false);
          if(typeof toast === 'function') toast("⚠️ Cannot rotate: Unit collides with wall or adjacent unit!");
        } else {
          gd.obj.rotation.y = candRotY;
          GL.gizmoSet(gd.obj, gd.id);
          GL.settle();
          if(plan && plan.furniture){
            var fR = plan.furniture.find(function(it){ return it.id === gd.id; });
            if(fR){
              fR.rotY = -candRotY;
              if(window.OrbixUI.editor) window.OrbixUI.editor.pushHistory('Rotate Furniture (Gizmo)');
              if(window.OrbixUI.saveToLocalStorage) window.OrbixUI.saveToLocalStorage();
              if(window.OrbixProjects && window.OrbixProjects.saveActiveProject) window.OrbixProjects.saveActiveProject();
              if(typeof toast === 'function') toast("Rotated 90°");
            }
          }
        }
      } else if(gd.moved){
        // Check collision on drop: if invalid placement, revert to previous position!
        if(gd.obj.userData.isOverlapped){
          gd.obj.position.x = gd.startPos.x;
          gd.obj.position.z = gd.startPos.z;
          gd.obj.position.y = gd.startPosY;
          gd.obj.rotation.y = gd.startRot || 0;
          setUnitOverlapVisual(gd.obj, false);
          GL.gizmoSet(gd.obj, gd.id);
          GL.settle();
          if(typeof toast === 'function') toast("⚠️ Invalid placement: Unit penetrates wall or overlaps adjacent unit! Placement reverted.");
          return;
        }

        var finalX = Math.round(gd.obj.position.x / 50) * 50;
        var finalZ = Math.round(gd.obj.position.z / 50) * 50;
        var finalY = Math.max(0, Math.min(3000, Math.round(gd.obj.position.y / 50) * 50));
        gd.obj.position.x = finalX;
        gd.obj.position.z = finalZ;
        gd.obj.position.y = finalY;
        GL.gizmoSet(gd.obj, gd.id);
        GL.settle();

        if(plan){
          var list = plan.furniture || [];
          for(var i = 0; i < list.length; i++){
            if(list[i].id === gd.id){
              list[i].pos.x = finalX;
              list[i].pos.y = finalZ;
              list[i].pos.z = finalY;
              list[i].elevation = finalY;
              list[i].rotY = -(gd.obj.rotation.y || 0);
              var rms = plan.rooms || [];
              for(var r = 0; r < rms.length; r++){
                if(window.OrbixCore && window.OrbixCore.Vec2 && window.OrbixCore.Vec2.pointInPolygon(list[i].pos, rms[r].polygon)){
                  list[i].roomId = rms[r].id;
                  break;
                }
              }
              break;
            }
          }
          if(window.OrbixUI && window.OrbixUI.saveToLocalStorage) window.OrbixUI.saveToLocalStorage();
          if(window.OrbixProjects && window.OrbixProjects.saveActiveProject) window.OrbixProjects.saveActiveProject();
          if(window.OrbixUI && window.OrbixUI.editor){
            window.OrbixUI.editor.pushHistory('Move Furniture (3D Gizmo)');
            window.OrbixUI.editor.render();
          }
          if(window.OrbixUI && window.OrbixUI.renderBOQ) window.OrbixUI.renderBOQ();
          if(window.OrbixUI && window.OrbixUI.renderInspector) window.OrbixUI.renderInspector([{ type: 'furniture', id: gd.id }]);
          if(gd.axis === 'y' && typeof toast === 'function'){
            toast("Unit elevation set to " + finalY + " mm AFFL");
          }
        }
      }`;

code = replaceNorm(code, targetPUp, replacePUp);

// 6. Export setUnitOverlapVisual on GL
code = replaceNorm(code, 'gizmoPick:gizmoPick,', 'gizmoPick:gizmoPick,setUnitOverlapVisual:setUnitOverlapVisual,');

// 7. In setView('design') ensure root.visible = false so floating workbench model at (0,0,0) is hidden
const targetSetView = `  if(v==="design"){
    if(window.OrbixUI && typeof window.OrbixUI.syncProjectUnitsTo3DStudio === 'function'){
      window.OrbixUI.syncProjectUnitsTo3DStudio();
    }
    if(typeof buildScene === 'function') buildScene();
    if(window.OrbixUI && typeof window.OrbixUI.render3DHome === 'function') window.OrbixUI.render3DHome(true);`;

const replaceSetView = `  if(v==="design"){
    if(window.OrbixUI && typeof window.OrbixUI.syncProjectUnitsTo3DStudio === 'function'){
      window.OrbixUI.syncProjectUnitsTo3DStudio();
    }
    if(typeof buildScene === 'function') buildScene();
    if(window.OrbixUI && typeof window.OrbixUI.render3DHome === 'function') window.OrbixUI.render3DHome(true);
    if(root) root.visible = false; // Placed units inside OrbixHome3D take center stage`;

code = replaceNorm(code, targetSetView, replaceSetView);

fs.writeFileSync('app.js', code, 'utf8');
console.log('Successfully updated app.js with CAD 3D Gizmo (X, Y, Z, Rot) and Collision Overlap!');
