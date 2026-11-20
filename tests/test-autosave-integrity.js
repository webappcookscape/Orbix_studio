// ═══════════════════════════════════════════════════════════════════════════════
// Automated Regression Suite: Autosave & Wall/Unit Integrity
// Verifies all frontend + backend guards against vanishing walls/units & races
// ═══════════════════════════════════════════════════════════════════════════════

process.env.SKIP_POSTGRES = 'true';
process.env.USE_JSON_STORE = 'true';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const projectService = require('../server/services/projectService');
const liveSyncService = require('../server/services/liveSyncService');

function makeWall(id, x2) {
  return { id, start: { x: 0, y: 0 }, end: { x: x2 || 3000, y: 0 }, thickness: 150, height: 2800 };
}

function makeFurn(id, name) {
  return { id, name: name || 'Base Cabinet', category: 'kitchen_base', pos: { x: 500, y: 500, z: 0 }, dimensions: { w: 600, d: 600, h: 850 } };
}

function makePlan(projId, walls, furniture, lastModified) {
  return {
    schemaVersion: '1.0.0',
    id: projId,
    _projectId: projId,
    _lastModified: lastModified,
    meta: { id: projId, title: 'Test Project' },
    plan: {
      gridSize: 100,
      walls: walls || [],
      openings: [],
      rooms: [],
      furniture: furniture || [],
      stairs: [],
      activeFloor: 'ground',
      floors: [{ id: 'ground', name: 'Ground Floor', level: 0, elevation: 0 }],
      floorsData: {
        ground: {
          walls: walls || [],
          openings: [],
          rooms: [],
          furniture: furniture || [],
          stairs: []
        }
      }
    }
  };
}

async function runBackendTests() {
  const adminUser = { id: 'usr_admin', name: 'Cookscape Admin', email: 'admin@cookscape.com', role: 'admin' };
  const pid = 'proj_autosave_test_' + Date.now().toString(36);
  const t1 = 1700000001000;
  const t2 = 1700000002000;
  const t3 = 1700000003000;
  const t4 = 1700000004000;

  const initialWalls = [makeWall('w1', 3000), makeWall('w2', 4000), makeWall('w3', 3000), makeWall('w4', 4000)];
  const initialFurn = [makeFurn('f1', 'Sink Base'), makeFurn('f2', 'Hob Base')];

  try {
    // Seed project with 4 walls + 2 units at timestamp t2
    const created = await projectService.createProject({
      id: pid,
      title: 'Autosave Integrity Test',
      client: 'Original Client',
      units_count: 2,
      data: {
        details: { clientName: 'Original Client', location: 'Chennai' },
        plan: makePlan(pid, initialWalls, initialFurn, t2),
        units: [{ _furnId: 'f1', label: 'Sink Base' }, { _furnId: 'f2', label: 'Hob Base' }]
      }
    }, adminUser);
    assert.strictEqual(created.id, pid);

    // Test A: Accidental empty-plan wipe (0 walls, 0 units, no allowEmptyPlan) MUST be blocked
    const resA = await projectService.updateProject(pid, {
      data: {
        plan: makePlan(pid, [], [], t3),
        units: []
      },
      units_count: 0
    }, adminUser);
    assert.strictEqual(resA._planPreserved, true, 'Empty overwrite should set _planPreserved');
    assert.strictEqual(resA.data.plan.plan.walls.length, 4, '4 walls must survive accidental empty PUT');
    assert.strictEqual(resA.data.plan.plan.furniture.length, 2, '2 units must survive accidental empty PUT');
    assert.strictEqual(resA.units_count, 2, 'units_count must not drop to 0');
    console.log('✓ Test A passed: Backend blocked accidental empty-plan overwrite');

    // Test B: Accidental 0-wall overwrite while units exist MUST be blocked
    const resB = await projectService.updateProject(pid, {
      data: {
        plan: makePlan(pid, [], initialFurn, t3),
        units: [{ _furnId: 'f1' }, { _furnId: 'f2' }]
      },
      units_count: 2
    }, adminUser);
    assert.strictEqual(resB._planPreserved, true, '0-wall overwrite should be blocked');
    assert.strictEqual(resB.data.plan.plan.walls.length, 4, '4 walls must survive 0-wall PUT');
    console.log('✓ Test B passed: Backend blocked accidental 0-wall overwrite');

    // Test C: Metadata-only update (data.details without data.plan) MUST preserve walls & units
    const resC = await projectService.updateProject(pid, {
      client: 'Updated Client',
      data: {
        details: { clientName: 'Updated Client' }
      }
    }, adminUser);
    assert.strictEqual(resC.data.details.clientName, 'Updated Client', 'Metadata update applied');
    assert.strictEqual(resC.data.details.location, 'Chennai', 'Existing detail fields merged');
    assert.strictEqual(resC.data.plan.plan.walls.length, 4, 'Walls preserved on metadata-only PUT');
    assert.strictEqual(resC.data.plan.plan.furniture.length, 2, 'Units preserved on metadata-only PUT');
    console.log('✓ Test C passed: Metadata-only update merged safely without wiping plan');

    // Test D: Out-of-order stale PUT (t1 < t2) MUST NOT overwrite newer snapshot
    const resD = await projectService.updateProject(pid, {
      data: {
        plan: makePlan(pid, [makeWall('w1', 1000)], [makeFurn('f1')], t1),
        units: [{ _furnId: 'f1' }]
      },
      units_count: 1
    }, adminUser);
    assert.strictEqual(resD._planPreserved, true, 'Stale timestamp PUT must be rejected');
    assert.strictEqual(resD.data.plan.plan.walls.length, 4, '4 walls preserved against stale PUT');
    assert.strictEqual(resD.data.plan.plan.furniture.length, 2, '2 units preserved against stale PUT');
    console.log('✓ Test D passed: Stale out-of-order PUT rejected');

    // Test E: Cross-project leak (plan._projectId !== pid) MUST be blocked
    const resE = await projectService.updateProject(pid, {
      data: {
        plan: makePlan('proj_OTHER_999', [makeWall('wx', 999)], [makeFurn('fx')], t3),
        units: [{ _furnId: 'fx' }]
      },
      units_count: 1
    }, adminUser);
    assert.strictEqual(resE._planPreserved, true, 'Cross-project plan mismatch must be blocked');
    assert.strictEqual(resE.data.plan.plan.walls.length, 4, 'Original 4 walls preserved');
    console.log('✓ Test E passed: Cross-project plan leak blocked');

    // Test F: Valid newer edit (t3 > t2, 5 walls + 3 units) MUST persist cleanly
    const fiveWalls = initialWalls.concat([makeWall('w5', 2500)]);
    const threeFurn = initialFurn.concat([makeFurn('f3', 'Tall Unit')]);
    const resF = await projectService.updateProject(pid, {
      data: {
        plan: makePlan(pid, fiveWalls, threeFurn, t3),
        units: [{ _furnId: 'f1' }, { _furnId: 'f2' }, { _furnId: 'f3' }]
      },
      units_count: 3
    }, adminUser);
    assert.strictEqual(resF._planPreserved, undefined, 'Valid newer edit must save normally');
    assert.strictEqual(resF.data.plan.plan.walls.length, 5, '5 walls saved');
    assert.strictEqual(resF.data.plan.plan.furniture.length, 3, '3 units saved');
    console.log('✓ Test F passed: Valid newer edit persisted cleanly');

    // Test G: LiveSync scheduleDatabaseSave MUST block 0-wall wipe AND stale timestamp overwrite
    liveSyncService.scheduleDatabaseSave(pid, makePlan(pid, [], threeFurn, t4), [], 'autosave', t4);
    await new Promise((r) => setTimeout(r, 950));
    const afterWsEmpty = await projectService.getProjectById(pid, adminUser);
    assert.strictEqual(afterWsEmpty.data.plan.plan.walls.length, 5, 'LiveSync must NOT wipe 5 walls');
    assert.strictEqual(afterWsEmpty.data.plan.plan.furniture.length, 3, 'LiveSync must NOT wipe 3 units');
    console.log('✓ Test G passed: LiveSync DB save blocked 0-wall wipe');

    // Test H: Explicit user Clear Plan (allowEmptyPlan / changeAction: 'Clear Plan') MUST succeed
    const resH = await projectService.updateProject(pid, {
      data: {
        plan: makePlan(pid, [], [], t4),
        units: []
      },
      units_count: 0,
      changeAction: 'Clear Plan',
      allowEmptyPlan: true
    }, adminUser);
    assert.strictEqual(resH.data.plan.plan.walls.length, 0, 'Explicit Clear Plan clears walls');
    assert.strictEqual(resH.data.plan.plan.furniture.length, 0, 'Explicit Clear Plan clears units');
    console.log('✓ Test H passed: Explicit user Clear Plan succeeded');
  } finally {
    try { await projectService.deleteProject(pid, adminUser); } catch (_) { }
  }
}

async function runFrontendVmTests() {
  const store = new Map();
  const localStorageMock = {
    get length() { return store.size; },
    key(i) { return Array.from(store.keys())[i] || null; },
    getItem(k) { return store.has(k) ? store.get(k) : null; },
    setItem(k, v) { store.set(String(k), String(v)); },
    removeItem(k) { store.delete(String(k)); },
    clear() { store.clear(); }
  };

  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Date,
    Math,
    JSON,
    Object,
    Array,
    String,
    Number,
    Boolean,
    RegExp,
    Error,
    Promise,
    localStorage: localStorageMock,
    sessionStorage: localStorageMock,
    navigator: { onLine: true },
    document: {
      readyState: 'complete',
      visibilityState: 'visible',
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {},
      body: { classList: { add: () => {}, remove: () => {}, toggle: () => {} } }
    },
    fetch: () => Promise.resolve({ ok: true, status: 200, json: async () => ({ authenticated: true, user: { id: 'usr_tester', name: 'Tester', role: 'employee' }, projects: [], users: [] }) }),
    location: { protocol: 'http:', host: 'localhost:4180', hostname: 'localhost', port: '4180', pathname: '/2d-plan', hash: '' },
    history: { replaceState: () => {}, pushState: () => {} },
    addEventListener: () => {},
    WebSocket: undefined,
    S: { units: [], active: 0 },
    OrbixUI: {
      project: null,
      _isProjectLoading: false,
      editor: { project: null, render: () => {}, resize: () => {}, zoomFit: () => {}, selected: [] },
      syncActiveFloorData: () => {},
      syncProjectUnitsTo3DStudio: () => {},
      loadProject: function (p) { this.project = p; this.editor.project = p; },
      render3DHome: () => {},
      renderInspector: () => {}
    }
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;

  const ctx = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'orbix-projects.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'orbix-live-sync.js'), 'utf8'), ctx);

  const OP = sandbox.OrbixProjects;
  const LS = sandbox.OrbixLiveSync;
  OP.currentUser = { id: 'usr_tester', name: 'Tester', role: 'employee' };

  // Test I: Serialized save queue (second save MUST wait for first in-flight PUT to finish!)
  const putLog = [];
  let inFlightCount = 0;
  let maxConcurrent = 0;
  OP.apiFetch = function (url, opts) {
    if (opts && opts.method === 'PUT') {
      inFlightCount++;
      if (inFlightCount > maxConcurrent) maxConcurrent = inFlightCount;
      const parsed = JSON.parse(opts.body);
      const wallCount = parsed.data.plan.plan.walls.length;
      putLog.push({ url, wallCount, keepalive: !!opts.keepalive });
      return new Promise((resolve) => {
        setTimeout(() => {
          inFlightCount--;
          resolve({ ok: true, status: 200, json: async () => ({ success: true }) });
        }, 60);
      });
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
  };

  const pA = makePlan('proj_A', [makeWall('w1', 1000)], [], Date.now());
  OP.projects = [{ id: 'proj_A', title: 'Proj A', data: { plan: pA, units: [] } }];
  OP.activeProjectId = 'proj_A';
  sandbox.OrbixUI.project = pA;

  // Dispatch save 1 immediately (1 wall), then while in flight mutate to 3 walls & save 2 immediately
  OP.saveActiveProject({ plan: pA, immediate: true });
  pA.plan.walls.push(makeWall('w2', 2000), makeWall('w3', 3000));
  OP.saveActiveProject({ plan: pA, immediate: true });
  await new Promise((r) => setTimeout(r, 220));

  assert.strictEqual(maxConcurrent, 1, 'Serialized save queue must never allow >1 concurrent PUT');
  assert.strictEqual(putLog.length, 2, 'Both queued saves must complete sequentially');
  assert.strictEqual(putLog[0].wallCount, 1, 'First PUT sent 1 wall');
  assert.strictEqual(putLog[1].wallCount, 3, 'Second PUT sent 3 walls AFTER first completed');
  console.log('✓ Test I passed: Frontend save queue strictly serialized (max concurrent PUTs = 1)');

  // Test J: Lightweight localStorage strips huge base64 underlay (>32KB) so QuotaExceededError cannot happen
  const bigUnderlay = 'data:image/png;base64,' + 'A'.repeat(60000);
  pA.plan.underlay = { dataUrl: bigUnderlay, width: 1000, height: 1000, opacity: 0.5 };
  OP.saveActiveProject({ plan: pA, immediate: true });
  await new Promise((r) => setTimeout(r, 120));
  const storedDraft = JSON.parse(localStorageMock.getItem('orbix_working_project_draft'));
  assert.strictEqual(storedDraft.plan.plan.underlay.dataUrl, '', 'Huge base64 underlay must be stripped from localStorage draft');
  assert.strictEqual(storedDraft.plan.plan.underlay._storedInIDB, true, 'Underlay marked as storedInIDB');
  assert.strictEqual(storedDraft.plan.plan.walls.length, 3, 'All 3 walls retained in lightweight draft');
  console.log('✓ Test J passed: Lightweight localStorage strips huge base64 underlays cleanly');

  // Test K: openProject race guard — user draws walls during slow GET /api/projects/:id -> MUST NOT be wiped!
  const emptyServerProj = { id: 'proj_race', title: 'Race Project', updatedAt: new Date(Date.now() - 5000).toISOString(), data: { plan: makePlan('proj_race', [], [], Date.now() - 5000), units: [] } };
  OP.projects.push(emptyServerProj);
  let resolveSlowGet = null;
  OP.apiFetch = function (url, opts) {
    if (!opts || !opts.method || opts.method === 'GET') {
      return new Promise((resolve) => {
        resolveSlowGet = () => resolve({ ok: true, status: 200, json: async () => emptyServerProj });
      });
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({ success: true }) });
  };

  OP.openProject('proj_race', false);
  // Simulate user drawing 2 walls immediately while GET is still in flight
  sandbox.OrbixUI.project.plan.walls.push(makeWall('new_w1', 3000), makeWall('new_w2', 3000));
  sandbox.OrbixUI.project._lastModified = Date.now();
  OP.markProjectDirty('proj_race');
  // Now slow GET returns old empty server snapshot
  resolveSlowGet();
  await new Promise((r) => setTimeout(r, 80));
  assert.strictEqual(sandbox.OrbixUI.project.plan.walls.length, 2, 'Slow GET response must NOT wipe walls drawn while loading');
  console.log('✓ Test K passed: openProject preserved walls drawn during in-flight GET');

  // Test L: flushImmediateSave fires keepalive PUT on beforeunload/pagehide when edits are pending
  let keepaliveUsed = false;
  OP.currentUser = { id: 'usr_tester', name: 'Tester', role: 'employee' };
  OP.apiFetch = function (url, opts) {
    if (opts && opts.method === 'PUT' && opts.keepalive === true) {
      keepaliveUsed = true;
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({ success: true }) });
  };
  OP._isAwaitingHydration = false;
  OP._hasUnsavedChanges = true;
  OP.flushImmediateSave();
  assert.strictEqual(keepaliveUsed, true, 'flushImmediateSave must send keepalive PUT for pending unsaved edits');
  console.log('✓ Test L passed: flushImmediateSave dispatches keepalive PUT on unload');

  // Test M: OrbixLiveSync.applyRemoteChange blocks 0-wall wipe, 0-unit wipe, and stale timestamp
  LS.activeProjectId = 'proj_sync';
  const localSyncPlan = makePlan('proj_sync', [makeWall('w1', 2000), makeWall('w2', 2000)], [makeFurn('f1')], 2000000);
  sandbox.OrbixUI.project = localSyncPlan;
  sandbox.OrbixUI.editor.project = localSyncPlan;

  // M1: 0-wall remote wipe blocked
  LS.applyRemoteChange({
    projectId: 'proj_sync',
    sourceClientId: 'other_cli',
    action: 'autosave',
    plan: makePlan('proj_sync', [], [makeFurn('f1')], 2000500),
    units: [{ _furnId: 'f1' }],
    timestamp: 2000500
  });
  assert.strictEqual(sandbox.OrbixUI.project.plan.walls.length, 2, 'LiveSync must block 0-wall remote wipe');

  // M2: Stale timestamp remote snapshot blocked
  LS.applyRemoteChange({
    projectId: 'proj_sync',
    sourceClientId: 'other_cli',
    action: 'plan_change',
    plan: makePlan('proj_sync', [makeWall('w1', 2000)], [makeFurn('f1')], 1999000),
    units: [{ _furnId: 'f1' }],
    timestamp: 1999000
  });
  assert.strictEqual(sandbox.OrbixUI.project.plan.walls.length, 2, 'LiveSync must block stale timestamp overwrite');

  // M3: Explicit Clear Plan action allowed
  LS.applyRemoteChange({
    projectId: 'proj_sync',
    sourceClientId: 'other_cli',
    action: 'Clear Plan',
    plan: makePlan('proj_sync', [], [], 2001000),
    units: [],
    timestamp: 2001000
  });
  assert.strictEqual(sandbox.OrbixUI.project.plan.walls.length, 0, 'LiveSync must allow explicit Clear Plan');
  assert.strictEqual(sandbox.OrbixUI.project.plan.furniture.length, 0, 'LiveSync must allow explicit Clear Plan for units');
  console.log('✓ Test M passed: OrbixLiveSync guards protect walls, units, and timestamps');
}

(async () => {
  try {
    await runBackendTests();
    await runFrontendVmTests();
    console.log('\n✅ ALL AUTOSAVE & WALL/UNIT INTEGRITY TESTS PASSED!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ AUTOSAVE INTEGRITY TEST FAILED:', err);
    process.exit(1);
  }
})();
