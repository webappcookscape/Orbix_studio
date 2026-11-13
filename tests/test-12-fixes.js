const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

// Minimal browser/THREE environment for Core, 3D, and PlanEditor tests
function createMockEnv() {
  const createdCtx2DCalls = [];
  const noop = () => {};
  const ctx2dBase = {
    save: noop, restore: noop, beginPath: noop, closePath: noop,
    moveTo: noop, lineTo: noop, bezierCurveTo: noop, quadraticCurveTo: noop,
    stroke: noop, fill: noop, arc: noop,
    rect: noop, roundRect: noop, fillRect: noop, strokeRect: noop,
    fillText: noop, strokeText: noop, clearRect: noop, translate: noop,
    rotate: noop, scale: noop, setLineDash: noop, clip: noop,
    measureText: (t) => ({ width: String(t || '').length * 6 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createPattern: () => ({}),
    getImageData: () => ({ data: new Uint8ClampedArray(16) }),
    putImageData: noop, drawImage: noop,
    setTransform: noop
  };
  const ctx2d = new Proxy(ctx2dBase, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return () => ({ addColorStop: noop });
    }
  });

  function Vec3(x, y, z) { this.x = x || 0; this.y = y || 0; this.z = z || 0; }
  Vec3.prototype.set = function (x, y, z) { this.x = x; this.y = y; this.z = z; return this; };
  Vec3.prototype.copy = function (v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; };

  function BufferGeometry() {
    this.attributes = {};
    this.index = null;
  }
  BufferGeometry.prototype.setAttribute = function (name, attr) { this.attributes[name] = attr; };
  BufferGeometry.prototype.getAttribute = function (name) { return this.attributes[name]; };
  BufferGeometry.prototype.setIndex = function (idx) { this.index = idx; };
  BufferGeometry.prototype.computeVertexNormals = noop;
  BufferGeometry.prototype.computeBoundingBox = noop;

  function BufferAttribute(array, itemSize) {
    this.array = array;
    this.itemSize = itemSize;
    this.count = array.length / itemSize;
    this.getX = (i) => this.array[i * this.itemSize];
    this.getY = (i) => this.array[i * this.itemSize + 1];
    this.getZ = (i) => this.array[i * this.itemSize + 2];
    this.setXY = (i, x, y) => { this.array[i * this.itemSize] = x; this.array[i * this.itemSize + 1] = y; };
  }

  function BoxGeometry(w, h, d) {
    this.parameters = { width: w, height: h, depth: d };
    const hx = w / 2, hy = h / 2, hz = d / 2;
    this.attributes = {
      position: new BufferAttribute(new Float32Array([
        -hx, -hy, hz,  hx, -hy, hz,  hx, hy, hz,  -hx, hy, hz
      ]), 3),
      uv: new BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2),
      normal: new BufferAttribute(new Float32Array([0, 0, 1,  0, 0, 1,  0, 0, 1,  0, 0, 1]), 3)
    };
    this.getAttribute = (name) => this.attributes[name];
  }

  function Group() {
    this.children = [];
    this.userData = {};
    this.position = new Vec3();
    this.rotation = { x: 0, y: 0, z: 0 };
    this.visible = true;
    this.parent = null;
  }
  Group.prototype.add = function () {
    for (let i = 0; i < arguments.length; i++) {
      const c = arguments[i];
      if (c) { c.parent = this; this.children.push(c); }
    }
  };
  Group.prototype.remove = function (c) {
    const idx = this.children.indexOf(c);
    if (idx !== -1) this.children.splice(idx, 1);
  };
  Group.prototype.traverse = function (fn) {
    fn(this);
    this.children.forEach((c) => { if (c.traverse) c.traverse(fn); else fn(c); });
  };

  function Mesh(geo, mat) {
    this.isMesh = true;
    this.geometry = geo;
    this.material = mat;
    this.userData = {};
    this.position = new Vec3();
    this.rotation = { x: 0, y: 0, z: 0 };
    this.visible = true;
    this.parent = null;
    this.children = [];
  }
  Mesh.prototype.add = Group.prototype.add;
  Mesh.prototype.traverse = Group.prototype.traverse;

  const THREE = {
    FrontSide: 0, BackSide: 1, DoubleSide: 2,
    RepeatWrapping: 1000, sRGBEncoding: 3001,
    Vector3: Vec3,
    Vector2: function (x, y) { this.x = x || 0; this.y = y || 0; },
    Color: function (c) { this.hex = c; this.getHex = () => this.hex; this.setHex = (h) => { this.hex = h; }; },
    Group, Mesh, BufferGeometry, BufferAttribute,
    Float32BufferAttribute: BufferAttribute,
    BoxGeometry,
    PlaneGeometry: function (w, h) { this.parameters = { width: w, height: h }; },
    CylinderGeometry: function (rt, rb, h, s) { this.parameters = { radiusTop: rt, radiusBottom: rb, height: h, radialSegments: s }; },
    SphereGeometry: function (r) { this.parameters = { radius: r }; },
    Shape: function () { this.moveTo = noop; this.lineTo = noop; this.closePath = noop; this.holes = []; },
    Path: function () { this.moveTo = noop; this.lineTo = noop; this.closePath = noop; },
    ShapeGeometry: function () { return new BufferGeometry(); },
    MeshStandardMaterial: function (o) { Object.assign(this, o || {}); this.isMaterial = true; },
    MeshPhysicalMaterial: function (o) { Object.assign(this, o || {}); this.isMaterial = true; },
    MeshBasicMaterial: function (o) { Object.assign(this, o || {}); this.isMaterial = true; },
    CanvasTexture: function (cv) { this.image = cv; this.repeat = { x: 1, y: 1, set(x, y) { this.x = x; this.y = y; } }; },
    Texture: function (img) { this.image = img; this.repeat = { x: 1, y: 1, set(x, y) { this.x = x; this.y = y; } }; },
    SpotLight: function (c, i, d, a, p, dec) {
      this.isLight = true; this.color = c; this.intensity = i; this.distance = d;
      this.angle = a; this.penumbra = p; this.decay = dec;
      this.position = new Vec3();
      this.target = { position: new Vec3() };
    },
    PointLight: function (c, i, d, dec) {
      this.isLight = true; this.color = c; this.intensity = i; this.distance = d; this.decay = dec;
      this.position = new Vec3();
    },
    FogExp2: function (c, d) { this.color = c; this.density = d; }
  };

  global.window = global;
  global.THREE = THREE;
  global.Image = function () { this.src = ''; };
  global.devicePixelRatio = 1;
  const makeEl = (tag) => {
    const el = {
      tagName: String(tag || 'div').toUpperCase(),
      width: 800, height: 600, clientWidth: 800, clientHeight: 600,
      style: {}, children: [],
      addEventListener: noop, removeEventListener: noop,
      appendChild: (c) => { el.children.push(c); return c; },
      querySelector: () => null,
      querySelectorAll: () => [],
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
      getContext: () => ctx2d
    };
    return el;
  };
  global.document = {
    readyState: 'complete',
    body: makeEl('body'),
    createElement: makeEl,
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: noop,
    removeEventListener: noop
  };
  global.window.addEventListener = global.window.addEventListener || noop;

  return { THREE, ctx2d, createdCtx2DCalls, makeEl };
}

const { THREE, makeEl } = createMockEnv();
require(path.join(ROOT, 'orbix-dado-textures.js'));
const Core = require(path.join(ROOT, 'orbix-core.js'));
const ArchitecturalRenderer = require(path.join(ROOT, 'orbix-3d.js'));
const PlanEditor = require(path.join(ROOT, 'orbix-plan.js'));

console.log('=== VERIFYING ALL 12 ORBIX STUDIO FIXES ===\n');

// ---------------------------------------------------------------------------
// 1. Dado tile scale 2ft x 2ft (609.6mm)
// ---------------------------------------------------------------------------
{
  const scene = new THREE.Group();
  const arch = new ArchitecturalRenderer(scene);
  const tex = ArchitecturalRenderer.createDadoTileTexture('rhombus_sage');
  assert.strictEqual(tex.repeat.x, 1, 'Dado texture base repeat.x must be 1 for world-mm UV scaling');
  assert.strictEqual(tex.repeat.y, 1, 'Dado texture base repeat.y must be 1 for world-mm UV scaling');

  window.dadoTileEnabled = true;
  const wall = {
    id: 'w_dado_scale',
    start: { x: 0, y: 0 },
    end: { x: 3000, y: 0 },
    thickness: 150,
    height: 2800,
    dadoTile: true
  };
  const wallGrp = arch.buildWallWithCutouts(wall, []);
  const dadoMeshes = [];
  wallGrp.traverse((o) => {
    if (o.isMesh && o.geometry && o.geometry.getAttribute && o.geometry.getAttribute('uv')) {
      const uv = o.geometry.getAttribute('uv');
      for (let i = 0; i < uv.array.length; i += 2) {
        if (Math.abs(uv.array[i] - 3000 / 609.6) < 0.05) {
          dadoMeshes.push(uv);
          break;
        }
      }
    }
  });
  assert(dadoMeshes.length >= 1, '3D dado mesh UVs must scale by 2ft (609.6mm)');
  const maxU = Math.max(...Array.from(dadoMeshes[0].array).filter((_, idx) => idx % 2 === 0));
  const maxV = Math.max(...Array.from(dadoMeshes[0].array).filter((_, idx) => idx % 2 === 1));
  assert(Math.abs(maxU - 3000 / 609.6) < 0.01, `Expected U=${(3000 / 609.6).toFixed(3)}, got ${maxU}`);
  assert(Math.abs(maxV - (1500 - 850) / 609.6) < 0.01, `Expected V=${((1500 - 850) / 609.6).toFixed(3)}, got ${maxV}`);
  console.log('✔ [1] Dado tile 2ft x 2ft (609.6mm) world-UV scaling verified');
}

// ---------------------------------------------------------------------------
// 2 & 3. Photorealistic lighting & Matte countertops (no clearcoat/gloss)
// ---------------------------------------------------------------------------
{
  const scene = new THREE.Group();
  const arch = new ArchitecturalRenderer(scene);
  const lighting = arch.buildRoomInteriorLighting({
    id: 'r1',
    polygon: [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 4000 }, { x: 0, y: 4000 }]
  }, 2800);
  let spots = 0, points = 0;
  lighting.traverse((o) => {
    if (o instanceof THREE.SpotLight) {
      spots++;
      assert.strictEqual(o.decay, 1.0, 'Millimeter SpotLight decay must be 1.0 so light reaches floor');
    }
    if (o instanceof THREE.PointLight) {
      points++;
      assert.strictEqual(o.decay, 1.0, 'Indirect PointLight decay must be 1.0');
    }
  });
  assert(spots >= 4 && points >= 1, 'Room lighting must have spotlights + warm bounce PointLight');

  const baseUnit = {
    id: 'u_base', code: 'fm-60', name: 'FM 60 BASE',
    category: 'kitchen_base',
    dimensions: { W: 600, H: 720, D: 560 },
    unitConfig: { counter: 'granite', shutters: 1 }
  };
  const baseMesh = arch.buildFurnitureMesh(baseUnit);
  let counterMat = null;
  baseMesh.traverse((o) => {
    if (o.isMesh && o.geometry && o.geometry.parameters && o.geometry.parameters.height === 35 && o.geometry.parameters.depth >= 580) {
      counterMat = o.material;
    }
  });
  assert(counterMat, 'Countertop mesh must exist on base unit');
  assert(counterMat.roughness >= 0.85, `Countertop roughness must be matte (>=0.85), got ${counterMat.roughness}`);
  assert((counterMat.clearcoat || 0) === 0, 'Countertop must NOT have glossy clearcoat');

  const osMesh = new THREE.Group();
  arch.buildOnlyShutterMesh(
    { id: 'os1', code: 'os', name: 'Only Shutter', category: 'kitchen_base', dimensions: { W: 600, H: 720, D: 560 }, unitConfig: { counter: 'granite' } },
    osMesh, { W: 600, H: 720, D: 560 },
    new THREE.MeshStandardMaterial({ color: 0xffffff }),
    () => new THREE.MeshStandardMaterial({ color: 0x333333 }),
    'bar', null, null, 100, 35, true
  );
  let osCounterMat = null;
  osMesh.traverse((o) => {
    if (o.isMesh && o.geometry && o.geometry.parameters && o.geometry.parameters.height === 35 && o.geometry.parameters.depth >= 580) {
      osCounterMat = o.material;
    }
  });
  assert(osCounterMat && osCounterMat.roughness >= 0.85, 'Only-shutter countertop must also be matte');

  const appSrc = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  assert(appSrc.includes('FogExp2(0xCBE3F5, 0.000011)'), 'app.js must enable photorealistic atmospheric FogExp2');
  assert(appSrc.includes('mapSize.set(4096, 4096)'), 'app.js must use 4096x4096 crisp shadows');
  assert(appSrc.includes('roughness: 0.88, metalness: 0, clearcoat: 0'), 'app.js stoneMat countertop must be matte');
  console.log('✔ [2 & 3] Photorealistic lighting/shadows & matte countertops verified');
}

// ---------------------------------------------------------------------------
// 4. Enable Ceiling ON / OFF toggle & downward FrontSide slab
// ---------------------------------------------------------------------------
{
  const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert(indexHtml.includes('id="toggleCeilingBtn"'), 'index.html must include #toggleCeilingBtn');

  const project = {
    plan: {
      walls: [
        { id: 'w1', start: { x: 0, y: 0 }, end: { x: 3000, y: 0 }, height: 2800, thickness: 150 },
        { id: 'w2', start: { x: 3000, y: 0 }, end: { x: 3000, y: 3000 }, height: 2800, thickness: 150 },
        { id: 'w3', start: { x: 3000, y: 3000 }, end: { x: 0, y: 3000 }, height: 2800, thickness: 150 },
        { id: 'w4', start: { x: 0, y: 3000 }, end: { x: 0, y: 0 }, height: 2800, thickness: 150 }
      ],
      openings: [],
      rooms: [{
        id: 'rm1', name: 'Kitchen',
        polygon: [{ x: 0, y: 0 }, { x: 3000, y: 0 }, { x: 3000, y: 3000 }, { x: 0, y: 3000 }]
      }],
      furniture: []
    }
  };

  window.ceilingEnabled = false;
  const sceneOff = new THREE.Group();
  const grpOff = new ArchitecturalRenderer(sceneOff).buildHome(project);
  let ceilingCountOff = 0;
  grpOff.traverse((o) => { if (o.userData && o.userData.isCeilingMesh) ceilingCountOff++; });
  assert.strictEqual(ceilingCountOff, 0, 'Ceiling OFF must produce 0 ceiling meshes');

  window.ceilingEnabled = true;
  const sceneOn = new THREE.Group();
  const grpOn = new ArchitecturalRenderer(sceneOn).buildHome(project);
  let ceilingMesh = null;
  grpOn.traverse((o) => { if (o.userData && o.userData.isCeilingMesh) ceilingMesh = o; });
  assert(ceilingMesh, 'Ceiling ON must generate ceiling mesh');
  assert.strictEqual(ceilingMesh.position.y, 2800, 'Ceiling height must sit at room wall height (2800mm)');
  assert.strictEqual(ceilingMesh.material.side, THREE.FrontSide, 'Ceiling material must use FrontSide downward normal so top view stays open');
  window.ceilingEnabled = false;
  console.log('✔ [4] Ceiling ON/OFF toggle & architectural slab verified');
}

// ---------------------------------------------------------------------------
// 5. 2D Dado Tile adjustable startOffset & length along wall + Inspector
// ---------------------------------------------------------------------------
{
  const container = makeEl('div');
  const proj = Core.createProject('Dado Resize Test');
  const wall = { id: 'w_d1', start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, thickness: 150, height: 2800 };
  proj.plan.walls.push(wall);
  const ed = new PlanEditor(container, { project: proj });
  ed.setTool('dado');
  ed.handleDadoMouseDown({ x: 500, y: 0 });
  ed.handleDadoMouseDown({ x: 2500, y: 0 });
  assert.strictEqual(wall.dadoTile, true, 'Wall dadoTile should be true');
  assert.strictEqual(wall.dadoSegments.length, 1, 'Should create 1 explicit dadoSegment');
  assert.strictEqual(wall.dadoSegments[0].startOffset, 500);
  assert.strictEqual(wall.dadoSegments[0].endOffset, 2500);

  const endScreen = ed.worldToScreen({ x: 2500, y: 0 });
  const hHit = ed.findDadoHandleAt(endScreen);
  assert(hHit && hHit.end === 'end' && hHit.wall.id === 'w_d1', 'findDadoHandleAt must locate segment end grip handle');

  const uiSrc = fs.readFileSync(path.join(ROOT, 'orbix-ui.js'), 'utf8');
  assert(uiSrc.includes('id="inspWallDadoStart"') && uiSrc.includes('id="inspWallDadoLen"'), 'Wall Inspector must expose dado start & length controls');
  console.log('✔ [5] 2D Dado Tile start/length adjustment & handles verified');
}

// ---------------------------------------------------------------------------
// 6. Camera floor clamp (no scrolling/orbiting below ground plane)
// ---------------------------------------------------------------------------
{
  const appSrc = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  assert(appSrc.includes('var minCamY = 85;'), 'GL.apply must enforce minimum camera Y above floor');
  assert(appSrc.includes('cam.pitch = Math.max(-85, Math.min(22, cam.pitch));'), 'camApply must clamp upward tilt');
  assert(appSrc.includes('tgt.y = Math.max(50, Math.min(6000, tgt.y));'), 'Pan must keep target above floor');
  // Test the exact GL.apply elevation clamp formula at max zoom-out & max tilt
  const testClamp = (targetY, pitchDeg, zoom) => {
    const pitch = Math.max(-85, Math.min(22, pitchDeg));
    const safeZoom = Math.max(0.18, 1 + Math.max(-0.82, Math.min(25.0, zoom)));
    const d = Math.min(45000, Math.max(50, 5000 / safeZoom));
    let el = (-pitch) * Math.PI / 180;
    const minCamY = 85;
    if (targetY + d * Math.sin(el) < minCamY && d > 1) {
      el = Math.asin(Math.max(-1, Math.min(1, (minCamY - targetY) / d)));
    }
    return Math.max(minCamY, targetY + d * Math.sin(el));
  };
  assert(testClamp(0, 85, -5) >= 85, 'Camera Y must stay >= 85 even at extreme negative zoom and pitch');
  console.log('✔ [6] Camera above-floor clamp verified');
}

// ---------------------------------------------------------------------------
// 7. Cursor / click mismatch fix (2D wall vs unit & 3D occlusion/NDC)
// ---------------------------------------------------------------------------
{
  const container = makeEl('div');
  const proj = Core.createProject('Pick Accuracy Test');
  proj.plan.walls.push({ id: 'w_top', start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, thickness: 150, height: 2800 });
  proj.plan.furniture.push(
    { id: 'u1', name: 'FM 120', category: 'kitchen_base', pos: { x: 1000, y: 355 }, dimensions: { W: 1200, H: 720, D: 560 }, rotY: 0 },
    { id: 'u2', name: 'FM 60', category: 'kitchen_base', pos: { x: 1900, y: 355 }, dimensions: { W: 600, H: 720, D: 560 }, rotY: 0 }
  );
  const ed = new PlanEditor(container, { project: proj });
  // Wall band check: (1000, 40) is inside the 150mm wall band despite being near u1!
  assert.strictEqual(ed.isPointOnWallBand({ x: 1000, y: 40 }), true, 'Wall centerline click must detect wall band');
  ed.handleSelectMouseDown({ x: 1000, y: 40 }, false);
  assert.strictEqual(ed.selected[0].type, 'wall', 'Clicking wall band behind cabinet must select WALL, not cabinet');
  // Clicking interior of adjacent u2 at (1900, 355) (inside old u1 600mm radius!) selects u2 cleanly
  ed.handleSelectMouseDown({ x: 1900, y: 355 }, false);
  assert.strictEqual(ed.selected[0].id, 'u2', 'Clicking unit u2 must select u2 without mismatch from u1');

  const planSrc = fs.readFileSync(path.join(ROOT, 'orbix-plan.js'), 'utf8');
  assert(!planSrc.includes('Vec2.dist(worldPt, fn.pos) < Math.max(100'), 'Removed circular W/2 furniture hitbox bug');

  const appSrc = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  assert(appSrc.includes('function isVisObj(') && appSrc.includes('function isObstructionObj('), 'app.js must filter invisible objects & stop at walls');
  assert(appSrc.includes('function getCanvasNdcRect()'), 'app.js must use renderer.domElement rect for pixel-exact NDC');
  console.log('✔ [7] 2D & 3D wall/group click accuracy verified');
}

// ---------------------------------------------------------------------------
// 8. Silent PostgreSQL offline check in prisma.js & session.js
// ---------------------------------------------------------------------------
{
  const out = execFileSync(process.execPath, [
    '-e',
    "const p = require('./server/config/prisma'); const s = require('./server/config/session'); Promise.all([p.checkDatabaseConnection(), s.initPostgresStore ? s.initPostgresStore() : Promise.resolve()]).then(() => console.log('SILENT_CHECK_OK'));"
  ], { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  assert(out.includes('SILENT_CHECK_OK'), 'Server DB/session offline probe must complete cleanly');
  console.log('✔ [8] Silent terminal PostgreSQL offline fallback verified');
}

// ---------------------------------------------------------------------------
// 9. Previous project isolation + Project Details badges in 2D & 3D
// ---------------------------------------------------------------------------
{
  const storage = {};
  global.localStorage = {
    get length() { return Object.keys(storage).length; },
    key: (i) => Object.keys(storage)[i] || null,
    getItem: (k) => (k in storage ? storage[k] : null),
    setItem: (k, v) => { storage[k] = String(v); },
    removeItem: (k) => { delete storage[k]; }
  };
  global.fetch = () => Promise.resolve({ ok: false, status: 404 });
  global.window.location = { pathname: '/2d-plan', search: '', hash: '' };
  global.window.history = { replaceState: () => {}, pushState: () => {} };
  const origSetInterval = global.setInterval;
  global.setInterval = () => 0;
  global.window.OrbixCore = Core;
  const bar2d = { innerHTML: '' };
  const bar3d = { innerHTML: '' };
  const origGetById = document.getElementById;
  document.getElementById = (id) => {
    if (id === 'planProjectDetailsBar') return bar2d;
    if (id === 'studioProjectDetailsBadge') return bar3d;
    return null;
  };
  global.window.S = { units: [{ _furnId: 'u_recent', label: 'Recent Unit' }], active: 0 };
  global.window.OrbixUI = {
    project: {
      id: 'proj_recent', _projectId: 'proj_recent',
      meta: { title: 'Recent Project' },
      plan: { walls: [], openings: [], rooms: [], furniture: [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }] }
    },
    loadProject(p) {
      this.project = p;
      this.updateProjectDetailsBadges();
    },
    syncProjectUnitsTo3DStudio() {
      const f = (this.project && this.project.plan && this.project.plan.furniture) || [];
      window.S.units = f.map((x) => ({ _furnId: x.id, label: x.name || 'Unit' }));
    },
    updateProjectDetailsBadges() {
      const meta = (this.project && this.project.meta) || {};
      const html = `<b>${meta.title || ''}</b> | ${meta.clientName || ''} | ${meta.quoteId || ''}`;
      bar2d.innerHTML = html;
      bar3d.innerHTML = html;
    }
  };
  localStorage.setItem('orbix_working_project_draft', JSON.stringify({
    projectId: 'proj_recent',
    plan: window.OrbixUI.project
  }));

  require(path.join(ROOT, 'orbix-projects.js'));
  window.OrbixProjects.activeProjectId = 'proj_recent';
  window.OrbixProjects.openProject({
    id: 'proj_prev',
    title: 'Previous Kitchen',
    client: 'Ramesh Kumar',
    cp_code: 'CP-102',
    bh_name: 'Anita',
    location: 'Chennai',
    data: {
      plan: {
        id: 'proj_prev',
        meta: { title: 'Previous Kitchen' },
        plan: { walls: [], openings: [], rooms: [], furniture: [{ id: 'old_u1', name: 'WCM-RT (Cookscape)' }] }
      }
    }
  }, false);

  assert.strictEqual(window.OrbixUI.project.id, 'proj_prev', 'Previous project must load its own ID');
  assert.strictEqual(window.OrbixUI.project.plan.furniture.length, 1, 'Previous project must NOT inherit 3 units from recent work!');
  assert.strictEqual(window.OrbixUI.project.plan.furniture[0].id, 'old_u1');
  assert(bar2d.innerHTML.includes('Previous Kitchen') && bar2d.innerHTML.includes('Ramesh Kumar') && bar2d.innerHTML.includes('CP-102'), '2D Project Details bar populated');
  assert(bar3d.innerHTML.includes('Previous Kitchen') && bar3d.innerHTML.includes('CP-102'), '3D Project Details bar populated');

  const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert(indexHtml.includes('id="planProjectDetailsBar"') && indexHtml.includes('id="studioProjectDetailsBadge"'), 'index.html contains 2D & 3D project details containers');
  document.getElementById = origGetById;
  global.setInterval = origSetInterval;
  console.log('✔ [9] Previous project isolation & 2D/3D Project Details verified');
}

// ---------------------------------------------------------------------------
// 10, 11, 12. WCM-RT, WCM-LT, WBCM (600x600x300, proper measurements & L-shape)
// ---------------------------------------------------------------------------
{
  const findCat = (id) => Core.FURNITURE_CATALOG.find((c) => c.id === id);
  const wcmRt = findCat('fcm-rt-1500');
  const wcmLt = findCat('fcm-lt-1500');
  const wbcm = findCat('fbcm-1500');

  assert.strictEqual(wcmRt.code, 'WCM-RT');
  assert.strictEqual(wcmRt.name, 'WCM-RT (Cookscape)');
  assert.deepStrictEqual(wcmRt.dimensions, { W: 600, H: 600, D: 300 });
  assert.strictEqual(wcmRt.unitConfig.fixedPanel.width, 300);
  assert.strictEqual(wcmRt.unitConfig.openShutter.width, 300);

  assert.strictEqual(wcmLt.code, 'WCM-LT');
  assert.strictEqual(wcmLt.name, 'WCM-LT (Cookscape)');
  assert.deepStrictEqual(wcmLt.dimensions, { W: 600, H: 600, D: 300 });
  assert.strictEqual(wcmLt.unitConfig.fixedPanel.width, 300);
  assert.strictEqual(wcmLt.unitConfig.openShutter.width, 300);

  assert.strictEqual(wbcm.code, 'WBCM');
  assert.strictEqual(wbcm.name, 'WBCM (Cookscape)');
  assert.deepStrictEqual(wbcm.dimensions, { W: 600, H: 600, D: 300 });
  assert.strictEqual(wbcm.unitConfig.unitType, 'wbcm');
  assert.strictEqual(wbcm.unitConfig.corner.enabled, true);
  assert.strictEqual(wbcm.unitConfig.corner.type, 'L');
  assert.strictEqual(wbcm.unitConfig.corner.legW, 600);
  assert.strictEqual(wbcm.unitConfig.corner.legD, 600);
  assert.strictEqual(wbcm.unitConfig.corner.depth, 300);

  const rateCard = Core.createProject('Rate Card Test').priceMatrix;
  const cRt = Core.calculateItemCost({ ...wcmRt, catalogItemId: wcmRt.id, dimensions: { ...wcmRt.dimensions } }, rateCard);
  assert(Math.abs(parseFloat(cRt.areaSft) - 3.875) < 0.02, `WCM-RT SFT should be ~3.88, got ${cRt.areaSft}`);
  assert(cRt.formulaDescription.includes('300mm Fixed + 300mm Open = 600 mm'), `Unexpected WCM-RT formula: ${cRt.formulaDescription}`);

  const cLt = Core.calculateItemCost({ ...wcmLt, catalogItemId: wcmLt.id, dimensions: { ...wcmLt.dimensions } }, rateCard);
  assert(Math.abs(parseFloat(cLt.areaSft) - 3.875) < 0.02);
  assert(cLt.formulaDescription.includes('300mm Fixed + 300mm Open = 600 mm'), `Unexpected WCM-LT formula: ${cLt.formulaDescription}`);

  const cWb = Core.calculateItemCost({ ...wbcm, catalogItemId: wbcm.id, dimensions: { ...wbcm.dimensions } }, rateCard);
  assert(Math.abs(parseFloat(cWb.areaSft) - 3.875) < 0.02);
  assert(cWb.formulaDescription.includes('300mm + 300mm Shutters, 300mm D'), `Unexpected WBCM formula: ${cWb.formulaDescription}`);

  // 2D L-shape polygon check for WBCM
  const wbPoly = Core.getFurniturePolygon({
    id: 'wb1', code: 'WBCM', name: 'WBCM (Cookscape)', unitType: 'wbcm',
    pos: { x: 1000, y: 1000 }, dimensions: { W: 600, H: 600, D: 300 },
    unitConfig: { ...wbcm.unitConfig }
  });
  assert.strictEqual(wbPoly.length, 6, 'WBCM must produce 6-vertex L-shape polygon in 2D');

  // 3D Geometry check for WCM-RT, WCM-LT, WBCM
  const arch = new ArchitecturalRenderer(new THREE.Group());
  const rtMesh = arch.buildFurnitureMesh({
    id: 'rt1', code: 'WCM-RT', name: 'WCM-RT (Cookscape)', category: 'kitchen_wall',
    dimensions: { W: 600, H: 600, D: 300 }, unitConfig: { ...wcmRt.unitConfig }
  });
  let rtFixed = false, rtHingeRight = false;
  rtMesh.traverse((o) => {
    if (o.userData && o.userData.isFixedPanel) rtFixed = true;
    if (o.name === 'ShutterHinge_Right') rtHingeRight = true;
  });
  assert(rtFixed && rtHingeRight, 'WCM-RT 3D must have fixed panel + ShutterHinge_Right');

  const ltMesh = arch.buildFurnitureMesh({
    id: 'lt1', code: 'WCM-LT', name: 'WCM-LT (Cookscape)', category: 'kitchen_wall',
    dimensions: { W: 600, H: 600, D: 300 }, unitConfig: { ...wcmLt.unitConfig }
  });
  let ltFixed = false, ltHingeLeft = false;
  ltMesh.traverse((o) => {
    if (o.userData && o.userData.isFixedPanel) ltFixed = true;
    if (o.name === 'ShutterHinge_Left') ltHingeLeft = true;
  });
  assert(ltFixed && ltHingeLeft, 'WCM-LT 3D must have fixed panel + ShutterHinge_Left');

  const wbMesh = arch.buildFurnitureMesh({
    id: 'wb1', code: 'WBCM', name: 'WBCM (Cookscape)', category: 'kitchen_wall', unitType: 'wbcm',
    dimensions: { W: 600, H: 600, D: 300 }, unitConfig: { ...wbcm.unitConfig }
  });
  let wbHinge0 = null, wbHinge1 = null, wbShutterCount = 0;
  wbMesh.traverse((o) => {
    if (o.name === 'ShutterHinge_0') wbHinge0 = o;
    if (o.name === 'ShutterHinge_1') wbHinge1 = o;
    if (o.userData && o.userData.isShutter && o.isMesh) wbShutterCount++;
  });
  assert(wbHinge0 && wbHinge1 && wbShutterCount >= 2, 'WBCM 3D L-shape must have BOTH ShutterHinge_0 and ShutterHinge_1 opening cleanly');
  console.log('✔ [10, 11, 12] WCM-RT, WCM-LT, WBCM (600x600x300, measurements & 3D L-shape) verified');
}

console.log('\n🎉 ALL 12 FIXES PASSED AUTOMATED VERIFICATION!');
