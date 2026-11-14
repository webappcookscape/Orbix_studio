const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');
const hasCRLF = code.includes('\r\n');
if (hasCRLF) {
  code = code.replace(/\r\n/g, '\n');
}

// 1. makeGrassGroundMat restoration with rich lush grass
const targetGrassMat = `    function makeGrassGroundMat() {
      if (matCache["sp|archStudioGround"]) return matCache["sp|archStudioGround"];
      var c = document.createElement("canvas"); c.width = c.height = 512;
      var g = c.getContext("2d");
      if (g) {
        // Subtle warm architectural studio ground plane
        g.fillStyle = "#EAE8E3";
        g.fillRect(0, 0, 512, 512);

        // Micro-fine architectural plaster / terrazzo noise
        for (var i = 0; i < 2000; i++) {
          var nx = Math.random() * 512, ny = Math.random() * 512;
          g.fillStyle = (i % 2 === 0) ? "rgba(255,255,255,0.4)" : "rgba(180,175,165,0.25)";
          g.fillRect(nx, ny, 1.5, 1.5);
        }
      }

      var tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(40, 40);
      tex.encoding = THREE.sRGBEncoding;

      var m = new THREE.MeshStandardMaterial({
        map: tex,
        color: 0xEDECE8,
        roughness: 0.94,
        metalness: 0.0,
        side: THREE.DoubleSide
      });
      matCache["sp|archStudioGround"] = m;
      return m;
    }`;

const replaceGrassMat = `    function makeGrassGroundMat() {
      if (matCache["sp|grassGround"]) return matCache["sp|grassGround"];
      var c = document.createElement("canvas"); c.width = c.height = 512;
      var g = c.getContext("2d");
      if (g) {
        // Rich natural lawn grass green base
        g.fillStyle = "#46813A";
        g.fillRect(0, 0, 512, 512);

        // Organic grass sod tone variations
        var lawnTones = ["#3D7333", "#4A883E", "#559947", "#3E7834", "#4F9042", "#5C9F4E"];
        for (var i = 0; i < 400; i++) {
          var x = Math.random() * 512, y = Math.random() * 512, rad = 8 + Math.random() * 24;
          var grad = g.createRadialGradient(x, y, 0, x, y, rad);
          var col = lawnTones[Math.floor(Math.random() * lawnTones.length)];
          grad.addColorStop(0, col);
          grad.addColorStop(1, "rgba(70, 129, 58, 0)");
          g.fillStyle = grad;
          g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
        }

        // Fine lawn grass blades
        for (var b = 0; b < 2500; b++) {
          var bx = Math.random() * 512, by = Math.random() * 512, blen = 3 + Math.random() * 7;
          var bcol = (b % 3 === 0) ? "#65AD55" : ((b % 3 === 1) ? "#3B6E32" : "#4B893F");
          g.strokeStyle = bcol; g.lineWidth = 1.0;
          g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + (Math.random() - 0.5) * 3, by - blen); g.stroke();
        }
      }

      var tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(160, 160);
      tex.encoding = THREE.sRGBEncoding;

      var m = new THREE.MeshStandardMaterial({
        map: tex,
        color: 0x4E8A42,
        roughness: 0.92,
        metalness: 0.0,
        side: THREE.DoubleSide
      });
      matCache["sp|grassGround"] = m;
      return m;
    }`;

if (!code.includes(targetGrassMat)) {
  console.error('Target 1 (GrassMat) not found');
  process.exit(1);
}
code = code.replace(targetGrassMat, replaceGrassMat);

// 2. Scene sky background, hemisphere light & fog in init()
const targetInitSky = `      scene = new THREE.Scene();
      scene.background = new THREE.Color(0xF1F5F9); // Clean architectural studio sky
      scene.fog = new THREE.FogExp2(0xE2E8F0, 0.000008); // Subtle studio atmospheric depth
      camera = new THREE.PerspectiveCamera(24, 1, 50, 1000000);
      target = new THREE.Vector3();
      pmrem = new THREE.PMREMGenerator(renderer);
      /* fromScene defaults to near/far 0.1–100: the light room is 9 m across, so pass real planes or it bakes black */
      scene.environment = pmrem.fromScene(makeRoomScene(), 0.04, 10, 30000).texture;
      if (EMBED) camera.far = 80000;
      keyL = new THREE.DirectionalLight(0xfffbf2, NEO ? 1.48 : 1.42);
      keyL.position.set(-3800, 7200, 5600); keyL.castShadow = true;
      keyL.shadow.mapSize.set(4096, 4096);
      var sc = keyL.shadow.camera; sc.left = -9500; sc.right = 9500; sc.top = 9500; sc.bottom = -9500; sc.near = 200; sc.far = 30000;
      keyL.shadow.bias = -0.0001; keyL.shadow.normalBias = 1.2; keyL.shadow.radius = 2.4;
      scene.add(keyL); scene.add(keyL.target);
      /* fill: lifts interiors and shaded faces */
      var fill = new THREE.DirectionalLight(0xedf4fc, 0.52); fill.position.set(2800, 2100, 5000); scene.add(fill);
      var rim = new THREE.DirectionalLight(0xf8fafc, 0.35); rim.position.set(2400, 1800, -2800); scene.add(rim);
      var bounceL = new THREE.DirectionalLight(0xfbf6ee, 0.38); bounceL.position.set(0, -1800, 1200); scene.add(bounceL);
      scene.add(new THREE.HemisphereLight(0xFAFBFD, 0xEFEAE1, 0.65)); // Crisp architectural sky radiance + warm interior floor bounce (no green!)`;

const replaceInitSky = `      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x82C3EC); // Crisp radiant daytime sky blue
      camera = new THREE.PerspectiveCamera(24, 1, 50, 1000000);
      target = new THREE.Vector3();
      pmrem = new THREE.PMREMGenerator(renderer);
      /* fromScene defaults to near/far 0.1–100: the light room is 9 m across, so pass real planes or it bakes black */
      scene.environment = pmrem.fromScene(makeRoomScene(), 0.04, 10, 30000).texture;
      if (EMBED) camera.far = 80000;
      keyL = new THREE.DirectionalLight(0xfffbf2, NEO ? 1.48 : 1.42);
      keyL.position.set(-3800, 7200, 5600); keyL.castShadow = true;
      keyL.shadow.mapSize.set(4096, 4096);
      var sc = keyL.shadow.camera; sc.left = -9500; sc.right = 9500; sc.top = 9500; sc.bottom = -9500; sc.near = 200; sc.far = 30000;
      keyL.shadow.bias = -0.0001; keyL.shadow.normalBias = 1.2; keyL.shadow.radius = 2.4;
      scene.add(keyL); scene.add(keyL.target);
      /* fill: lifts interiors and shaded faces */
      var fill = new THREE.DirectionalLight(0xedf4fc, 0.52); fill.position.set(2800, 2100, 5000); scene.add(fill);
      var rim = new THREE.DirectionalLight(0xf8fafc, 0.35); rim.position.set(2400, 1800, -2800); scene.add(rim);
      var bounceL = new THREE.DirectionalLight(0xfbf6ee, 0.38); bounceL.position.set(0, -1800, 1200); scene.add(bounceL);
      scene.add(new THREE.HemisphereLight(0x82C3EC, 0x4E8A42, 0.55)); // Sky blue overhead + natural lawn grass ground bounce`;

if (!code.includes(targetInitSky)) {
  console.error('Target 2 (InitSky) not found');
  process.exit(1);
}
code = code.replace(targetInitSky, replaceInitSky);

// 3. Wall material in special(kind)
const targetWallMat = `case "wall": m = new THREE.MeshStandardMaterial({ color: 0x9E836A, roughness: 0.90, metalness: 0 }); break;`;
const replaceWallMat = `case "wall": m = new THREE.MeshStandardMaterial({ color: 0xB89F82, roughness: 0.88, metalness: 0.01 }); break;`;

if (!code.includes(targetWallMat)) {
  console.error('Target 3 (WallMat) not found');
  process.exit(1);
}
code = code.replace(targetWallMat, replaceWallMat);

// 4. Snapshot sky & floor
const targetSnapBg = `        if (isAuto) {
          // Warm architectural interior studio tone for auto-placement wall & units shot
          scene.background = new THREE.Color(0xF1ECE6);
          renderer.setClearColor(0xF1ECE6, 1);
          if (floor && hasArchHome) floor.visible = false; // Exclude exterior ground plane
        } else {
          // Custom view retains current scene environment (sky 0x82C3EC or studio) and floor
          if (hasArchHome && !scene.background) {
            scene.background = new THREE.Color(0x82C3EC);
            if (floor) { floor.visible = true; }
            renderer.setClearColor(0x82C3EC, 1);
          }
        }`;

const replaceSnapBg = `        if (hasArchHome) {
          scene.background = new THREE.Color(0x82C3EC);
          renderer.setClearColor(0x82C3EC, 1);
          if (floor) { floor.material = makeGrassGroundMat(); floor.visible = true; }
        } else {
          scene.background = new THREE.Color(0x82C3EC);
          renderer.setClearColor(0x82C3EC, 1);
          if (floor) { floor.visible = true; }
        }`;

if (!code.includes(targetSnapBg)) {
  console.error('Target 4 (SnapBg) not found');
  process.exit(1);
}
code = code.replace(targetSnapBg, replaceSnapBg);

// 5. Remove 6 Option Groups in renderRail(): Door style, Shape, Shutters, Handle finish, Loft, Edge banding
// 5a. Door style
const targetDoorStyleGrp = `    if (u.ctype === "kitchen") u.ctype = (u.elev && u.elev >= 1000) ? "kwall" : "kbase";
    var gD = grp(r, "Door style");
    var dg = el("tgrid", gD);
    DSTYLES.forEach(function (s) {
      var b = el("tbtn" + ((u.dstyle || "slab") === s.id ? " is-on" : ""), dg, "button");
      b.textContent = s.label; b.setAttribute("aria-pressed", String((u.dstyle || "slab") === s.id));
      b.addEventListener("click", function () { u.dstyle = s.id; renderRail(); renderAll(); });
    });
    if ((u.dstyle || "") === "steel") {
      var pr = el("swgrid", gD); pr.style.marginTop = "8px";
      PAINTS.forEach(function (p) {
        var b = el("swb" + ((u.paint || "#5B6E7A") === p.id ? " is-on" : ""), pr, "button");
        b.style.background = p.id; b.title = p.label; b.setAttribute("aria-label", p.label);
        el(null, b, "i").textContent = p.label;
        b.addEventListener("click", function () { u.paint = p.id; renderRail(); renderAll(); });
      });
    }`;

const replaceDoorStyleGrp = `    if (u.ctype === "kitchen") u.ctype = (u.elev && u.elev >= 1000) ? "kwall" : "kbase";`;

if (!code.includes(targetDoorStyleGrp)) {
  console.error('Target 5a (Door style) not found');
  process.exit(1);
}
code = code.replace(targetDoorStyleGrp, replaceDoorStyleGrp);

// 5b. Shape & Shutters
const targetShapeShutters = `    if (!/^(kitchen|tv|crockery|dresser)$/.test(u.ctype || "")) {
      var gS = grp(r, "Shape");
      seg(gS, [{ l: "Straight", v: "straight" }, { l: "L-corner", v: "lcorner" }, { l: "Walk-in", v: "walkin" }], u.shape || "straight",
        function (v) { u.shape = v; renderRail(); renderAll(); });
      if (u.shape === "lcorner") {
        var rS = el("row", gS); rS.style.marginTop = "8px";
        fld(rS, "Run B width", u.W2 || 1200, function (v) { u.W2 = Math.max(400, num(v, u.W2)); softAll(true); });
      }

      var g2 = grp(r, "Shutters");
      seg(g2, [{ l: "Hinged", v: "hinged" }, { l: "Sliding", v: "sliding" }], u.type, function (v) { u.type = v; renderRail(); renderAll(); });
      var rD = el("row", g2); rD.style.marginTop = "8px";
      if (u.type === "hinged") fld(rD, "Shutters", u.shutters, function (v) { u.shutters = Math.max(1, num(v, u.shutters) | 0); softAll(true); });
      fld(rD, "Sections", u.sections, function (v) { u.sections = Math.max(1, num(v, u.sections) | 0); softAll(true); });

    }`;

const replaceShapeShutters = ``;

if (!code.includes(targetShapeShutters)) {
  console.error('Target 5b (Shape/Shutters) not found');
  process.exit(1);
}
code = code.replace(targetShapeShutters, replaceShapeShutters);

// 5c. Handle finish
const targetHFinish = `    var gF = grp(r, "Handle finish");
    seg(gF, HFINISH.map(function (f) { return { l: f.label, v: f.id }; }), u.hfinish || "chrome", function (v) { u.hfinish = v; renderRail(); renderAll(); });`;

const replaceHFinish = ``;

if (!code.includes(targetHFinish)) {
  console.error('Target 5c (Handle finish) not found');
  process.exit(1);
}
code = code.replace(targetHFinish, replaceHFinish);

// 5d. Loft
const targetLoft = `      var g4 = grp(r, "Loft");
      seg(g4, [{ l: "With loft", v: true }, { l: "No loft", v: false }], u.loft, function (v) { u.loft = v; renderRail(); renderAll(); });
      if (u.loft) {
        var rG = el("row", g4); rG.style.marginTop = "8px";
        fld(rG, "Loft ht", u.loftH, function (v) { u.loftH = Math.max(150, num(v, u.loftH)); softAll(true); });
        fld(rG, "Loft shutters", u.loftShutters, function (v) { u.loftShutters = Math.max(1, num(v, u.loftShutters) | 0); softAll(true); });
      }`;

const replaceLoft = ``;

if (!code.includes(targetLoft)) {
  console.error('Target 5d (Loft) not found');
  process.exit(1);
}
code = code.replace(targetLoft, replaceLoft);

// 5e. Edge banding (in standard unit & in imported unit)
const targetEB = `    var g9 = grp(r, "Edge banding");
    seg(g9, [{ l: "Exposed edges", v: "exposed" }, { l: "All 4 edges", v: "all" }], RATES.ebMode, function (v) { RATES.ebMode = v; renderRail(); renderAll(); });
    var rH = el("row", g9); rH.style.marginTop = "8px";
    fld(rH, "Tape size", RATES.ebSize, function (v) { RATES.ebSize = v; softAll(); }, "text");`;

const replaceEB = ``;

if (!code.includes(targetEB)) {
  console.error('Target 5e (Edge banding) not found');
  process.exit(1);
}
code = code.replace(targetEB, replaceEB);

const targetEBi = `      var g9i = grp(r, "Edge banding");
      seg(g9i, [{ l: "Exposed edges", v: "exposed" }, { l: "All 4 edges", v: "all" }], RATES.ebMode, function (v) { RATES.ebMode = v; renderRail(); renderAll(); });`;

if (code.includes(targetEBi)) {
  code = code.replace(targetEBi, '');
}

// 6. Export setSunlightIntensity and setSpotlightIntensity in GL API
const targetExport = `makeGrassGroundMat: makeGrassGroundMat, makeNeutralGroundMat: makeGrassGroundMat, setFloorMaterial:`;
const replaceExport = `setSunlightIntensity: function (val) {
      val = parseFloat(val);
      if (!isFinite(val)) return;
      window.sunlightIntensity = val;
      if (keyL) keyL.intensity = val;
      if (scene) {
        scene.traverse(function (o) {
          if (o.isDirectionalLight && o !== keyL) o.intensity = val * 0.35;
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
          if (o.isSpotLight || (o.isLight && (o.userData.isSpotlight || o.userData.isDownlight || (o.parent && o.parent.name && o.parent.name.indexOf('RoomLighting') !== -1)))) {
            o.intensity = val;
          } else if (o.isPointLight && o.parent && o.parent.name && o.parent.name.indexOf('RoomLighting') !== -1) {
            o.intensity = val * 0.45;
          }
        });
      }
      render();
    },
    makeGrassGroundMat: makeGrassGroundMat, makeNeutralGroundMat: makeGrassGroundMat, setFloorMaterial:`;

if (!code.includes(targetExport)) {
  console.error('Target 6 (Export) not found');
  process.exit(1);
}
code = code.replace(targetExport, replaceExport);

if (hasCRLF) {
  code = code.replace(/\n/g, '\r\n');
}

fs.writeFileSync('app.js', code, 'utf8');
console.log('Successfully updated app.js');
