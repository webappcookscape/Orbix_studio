/**
 * Test Suite: VPS Cloud Sync, Refresh Resilience & 18-Member Team Colleague Copy
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Mock localStorage
const localStorageStore = {};
global.localStorage = {
  getItem: function (k) { return localStorageStore[k] || null; },
  setItem: function (k, v) { localStorageStore[k] = String(v); },
  removeItem: function (k) { delete localStorageStore[k]; },
  clear: function () { for (var k in localStorageStore) delete localStorageStore[k]; }
};

// Mock DOM
global.window = {
  location: {
    hostname: 'localhost',
    port: '5500',
    pathname: '/home',
    protocol: 'http:',
    origin: 'http://localhost:5500'
  },
  addEventListener: function () {}
};
global.document = {
  readyState: 'complete',
  location: global.window.location,
  body: {
    classList: {
      toggle: function () {},
      add: function () {},
      remove: function () {}
    }
  },
  getElementById: function (id) {
    return {
      id: id,
      value: '',
      innerHTML: '',
      textContent: '',
      style: {},
      classList: { add: function () {}, remove: function () {}, toggle: function () {} },
      querySelector: function () { return null; },
      querySelectorAll: function () { return []; },
      addEventListener: function () {}
    };
  },
  querySelector: function () { return null; },
  querySelectorAll: function () { return []; },
  addEventListener: function () {}
};
global.navigator = { onLine: true };

// Mock OrbixCore
global.window.OrbixCore = {
  createProject: function (title) {
    return {
      schemaVersion: '1.0.0',
      id: 'proj_' + Date.now().toString(36),
      meta: { title: title || 'Untitled Project' },
      plan: { gridSize: 100, walls: [], openings: [], rooms: [], furniture: [] }
    };
  }
};

// Mock OrbixUI
global.window.OrbixUI = {
  project: null,
  loadProject: function (p) { this.project = p; },
  resetProject: function (t) { this.project = global.window.OrbixCore.createProject(t); return this.project; },
  syncProjectUnitsTo3DStudio: function () {}
};

// Evaluate orbix-projects.js
const orbixProjectsCode = fs.readFileSync(path.join(__dirname, '../orbix-projects.js'), 'utf8');
eval(orbixProjectsCode);
const OrbixProjects = global.window.OrbixProjects;

console.log('\n--- TEST 1: VERIFY 18 TEAM MEMBERS (3 ADMINS + 15 USERS) ---');
assert.strictEqual(OrbixProjects.users.length, 18, `Expected 18 users, got ${OrbixProjects.users.length}`);

const admins = OrbixProjects.users.filter(u => u.role === 'admin');
const employees = OrbixProjects.users.filter(u => u.role === 'employee');

assert.strictEqual(admins.length, 3, `Expected 3 Admins, got ${admins.length}`);
assert.strictEqual(employees.length, 15, `Expected 15 Employees, got ${employees.length}`);

console.log('✓ 3 Admins verified:');
admins.forEach(a => console.log(`   - ${a.name} (${a.designation}) [${a.email}]`));
console.log('✓ 15 Employees / Modular Designers verified:');
employees.forEach(e => console.log(`   - ${e.name} (${e.designation}) [${e.email}]`));
console.log('✓ TEST 1 PASSED: Full 18-member team structure verified!');

console.log('\n--- TEST 2: VERIFY REFRESH RESILIENCE & ZERO PROJECT LOSS ---');
const adminUser = admins[0];
OrbixProjects.currentUser = adminUser;

// Create 2 test projects
const p1 = {
  id: 'proj_client_vikram',
  title: 'Vikram Singhania — Living Room',
  client: 'Vikram Singhania',
  createdBy: adminUser.id,
  owner_name: adminUser.name,
  owner_email: adminUser.email,
  units_count: 3,
  updatedAt: new Date().toISOString(),
  data: {
    plan: {
      meta: { title: 'Vikram Singhania — Living Room' },
      plan: { furniture: [{ id: 'f1' }, { id: 'f2' }, { id: 'f3' }] }
    }
  }
};

const p2 = {
  id: 'proj_client_ananya',
  title: 'Ananya Iyer — Kitchen Modular',
  client: 'Ananya Iyer',
  createdBy: adminUser.id,
  owner_name: adminUser.name,
  owner_email: adminUser.email,
  units_count: 5,
  updatedAt: new Date().toISOString(),
  data: {
    plan: {
      meta: { title: 'Ananya Iyer — Kitchen Modular' },
      plan: { furniture: [{ id: 'k1' }, { id: 'k2' }, { id: 'k3' }, { id: 'k4' }, { id: 'k5' }] }
    }
  }
};

// Save locally
OrbixProjects.projects = [p1, p2];
localStorage.setItem('orbix_local_projects_' + adminUser.id, JSON.stringify([p1, p2]));
localStorage.setItem('orbix_active_proj_' + adminUser.id, p1.id);

// Simulate Hard Refresh: Reset in-memory projects
OrbixProjects.projects = [];

// Mock API returning raw array of projects (simulating GET /api/projects from server)
let apiCalled = false;
OrbixProjects.apiFetch = function (url) {
  apiCalled = true;
  return Promise.resolve({
    ok: true,
    json: function () {
      // Server returns array directly or { success: true, projects }
      return Promise.resolve([p1, p2]);
    }
  });
};

OrbixProjects.fetchProjects(function () {
  assert.strictEqual(OrbixProjects.projects.length, 2, `Expected 2 projects retained, got ${OrbixProjects.projects.length}`);
  const hasP1 = OrbixProjects.projects.some(p => p.id === p1.id);
  const hasP2 = OrbixProjects.projects.some(p => p.id === p2.id);
  assert(hasP1, 'Project 1 must be retained');
  assert(hasP2, 'Project 2 must be retained');
  console.log('Projects after refresh:', OrbixProjects.projects.map(p => p.title));
  console.log('✓ TEST 2 PASSED: 100% of projects retained across refresh without wipe!');
});

console.log('\n--- TEST 3: VERIFY COLLEAGUE COPY-ON-SHARE ---');
const elakkiya = employees.find(e => e.id === 'usr_elakkiya');
assert(elakkiya, 'Elakkiya account must exist');

// Test colleague fork
const serverProjectService = require('../server/services/projectService');
serverProjectService.createProject(p1, adminUser).then(createdOriginal => {
  return serverProjectService.forkProject(createdOriginal.id, elakkiya, adminUser);
}).then(forked => {
  assert(forked, 'Forked project must exist');
  assert.strictEqual(forked.createdBy, elakkiya.id, 'Forked project owner must be Elakkiya');
  assert.strictEqual(forked.ownerName, elakkiya.name, 'Forked ownerName must be Elakkiya');
  assert(forked.title.includes('Copy from Cookscape Admin'), `Expected title to note copy from Cookscape Admin, got "${forked.title}"`);
  assert(forked.data.shareNotice, 'Forked project must have shareNotice attached');
  assert.strictEqual(forked.data.shareNotice.sharedByName, 'Cookscape Admin');
  
  console.log('✓ Colleague copy successfully created:');
  console.log(`   - New Project ID: ${forked.id}`);
  console.log(`   - Title: "${forked.title}"`);
  console.log(`   - Assigned To: ${forked.ownerName} (${forked.createdBy})`);
  console.log(`   - Share Notice: Shared by ${forked.data.shareNotice.sharedByName} (${forked.data.shareNotice.sharedByDesignation})`);
  console.log('✓ TEST 3 PASSED: Colleague Copy-on-Share functions with complete isolation and notice!');

  console.log('\n--- TEST 4: VERIFY VPS CLOUD TARGET RESOLUTION ---');
  // Running on port 5500: should target https://studio.orbixdesigns.com
  const vpsBase = OrbixProjects.getApiBase();
  assert.strictEqual(vpsBase, 'https://studio.orbixdesigns.com', `Expected VPS domain https://studio.orbixdesigns.com, got ${vpsBase}`);
  console.log('✓ getApiBase() on port 5500 correctly targets VPS:', vpsBase);

  // Running on production domain
  global.window.location.hostname = 'studio.orbixdesigns.com';
  const prodBase = OrbixProjects.getApiBase();
  assert.strictEqual(prodBase, '', `Expected relative base on studio.orbixdesigns.com, got "${prodBase}"`);
  console.log('✓ getApiBase() on studio.orbixdesigns.com uses relative base: ""');

  console.log('✓ TEST 4 PASSED: Intelligent VPS endpoint routing verified!\n');
  console.log('ALL VPS SYNC & MULTI-USER COPY TESTS PASSED 100%!\n');
  process.exit(0);
}).catch(err => {
  console.error('Fork test failed:', err);
  process.exit(1);
});
