/**
 * Test Stale Project 404 Purging and openProject Deduplication
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- Testing Stale Project 404 Purging and Deduplication ---');

// Mock localStorage
const storage = {};
global.localStorage = {
  getItem: (k) => (k in storage ? storage[k] : null),
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: (k) => { delete storage[k]; },
  get length() { return Object.keys(storage).length; },
  key: (i) => Object.keys(storage)[i] || null,
  clear: () => { Object.keys(storage).forEach(k => delete storage[k]); }
};

global.window = {
  localStorage: global.localStorage,
  addEventListener: () => {},
  removeEventListener: () => {},
  location: { pathname: '/home', hash: '' }
};
global.document = {
  querySelectorAll: () => [],
  querySelector: () => null,
  getElementById: () => null,
  body: { classList: { toggle: () => {} } },
  addEventListener: () => {}
};

// Load orbix-projects.js in simulated browser environment
const orbixProjectsCode = fs.readFileSync(path.join(__dirname, '../orbix-projects.js'), 'utf8');
const runCode = new Function('window', 'document', 'localStorage', orbixProjectsCode + '\nreturn window.OrbixProjects;');
const OrbixProjects = runCode(global.window, global.document, global.localStorage);

assert(OrbixProjects, 'OrbixProjects must be instantiated');

// 1. Verify _purgeStaleProjectId cleans up all traces of a 404 stale project ID
localStorage.setItem('orbix_active_project_id', 'proj_stale_123');
localStorage.setItem('orbix_active_proj_anon', 'proj_stale_123');
localStorage.setItem('orbix_active_proj_usr_1', 'proj_stale_123');
localStorage.setItem('orbix_working_project_draft', JSON.stringify({
  projectId: 'proj_stale_123',
  plan: { walls: [1, 2], furniture: [1] }
}));

OrbixProjects.currentUser = { id: 'usr_1' };
OrbixProjects._purgeStaleProjectId('proj_stale_123');

assert.strictEqual(localStorage.getItem('orbix_active_project_id'), null, 'orbix_active_project_id must be removed');
assert.strictEqual(localStorage.getItem('orbix_active_proj_anon'), null, 'orbix_active_proj_anon must be removed');
assert.strictEqual(localStorage.getItem('orbix_active_proj_usr_1'), null, 'orbix_active_proj_usr_1 must be removed');

const draft = JSON.parse(localStorage.getItem('orbix_working_project_draft'));
assert.strictEqual(draft.projectId, '', 'stale projectId in working draft must be cleared to prevent repeated 404 PUTs');
assert(draft.plan && draft.plan.walls.length === 2, 'working draft plan data must remain intact');
console.log('✓ Stale project 404 purge verified cleanly.');

// 2. Verify openProject early returns when same project is already active and hydrated in memory
let viewSwitched = false;
global.window.setView = (v) => { viewSwitched = (v === 'plan'); };
global.window.OrbixUI = {
  project: { _projectId: 'proj_active_999', plan: { walls: [1], furniture: [] }, meta: { id: 'proj_active_999', title: 'Active' } }
};
OrbixProjects.activeProjectId = 'proj_active_999';
OrbixProjects._isAwaitingHydration = false;

let loadWorkspaceCalled = false;
const origLoad = OrbixProjects._loadProjectIntoWorkspace;
OrbixProjects._loadProjectIntoWorkspace = () => { loadWorkspaceCalled = true; };

OrbixProjects.openProject('proj_active_999', true);

assert.strictEqual(loadWorkspaceCalled, false, 'openProject must NOT re-run workspace load when project is already active in memory');
assert.strictEqual(viewSwitched, true, 'openProject must cleanly switch view to plan');
console.log('✓ openProject deduplication verified (avoids redundant scene re-renders and re-fetches).');

console.log('>>> ALL PURGE & DEDUP CHECKS PASSED SUCCESSFULLY! <<<');
