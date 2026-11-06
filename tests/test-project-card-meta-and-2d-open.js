/**
 * test-project-card-meta-and-2d-open.js
 * Verification test suite for:
 * 1. Project metadata normalization in backend service (camelCase & snake_case)
 * 2. Card metadata rendering without 'undefined' or 'Invalid Date'
 * 3. 'Open 2D Plan' view switching & pushState safety on file:// origins
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- 1. Testing Backend formatProject Normalization ---');

// Mock Prisma formatProject function directly from projectService
const projectService = require('../server/services/projectService');

const mockPrismaProject = {
  id: 'proj_prisma_001',
  title: 'test demo — sdasdsd (chennai)',
  client: 'test demo',
  type: 'Interior CAD',
  status: 'Draft',
  createdBy: 'usr_sangathamizh',
  ownerName: 'Sangathamizh',
  ownerEmail: 'sangathamizh@cookscape.com',
  unitsCount: 3,
  boardsEst: 2,
  isShared: false,
  forkCount: 0,
  createdAt: new Date('2026-11-06T08:30:00.000Z'),
  updatedAt: new Date('2026-11-06T09:15:00.000Z'),
  data: {
    units: [],
    plan: { walls: [], furniture: [] },
    details: {
      clientName: 'test demo',
      contactNumber: '9876543210',
      location: 'chennai',
      bhName: 'sdasdsd'
    }
  }
};

// Test getProjectById formatting
// Mock prisma findUnique
const { prisma } = require('../server/config/prisma');
const origFindUnique = prisma.project.findUnique;
prisma.project.findUnique = async () => mockPrismaProject;

(async function runTests() {
  const formatted = await projectService.getProjectById('proj_prisma_001');

  assert.strictEqual(formatted.owner_name, 'Sangathamizh', 'owner_name must be mapped from ownerName');
  assert.strictEqual(formatted.owner_email, 'sangathamizh@cookscape.com', 'owner_email must be mapped');
  assert.strictEqual(formatted.created_by, 'usr_sangathamizh', 'created_by must be mapped from createdBy');
  assert.ok(formatted.created_at && !formatted.created_at.includes('undefined'), 'created_at must be valid string');
  assert.ok(formatted.updated_at && !formatted.updated_at.includes('undefined'), 'updated_at must be valid string');
  assert.strictEqual(formatted.contact_number, '9876543210', 'contact_number must be extracted from details');
  assert.strictEqual(formatted.location, 'chennai', 'location must be extracted');
  assert.strictEqual(formatted.bh_name, 'sdasdsd', 'bh_name must be extracted');
  assert.ok(formatted.date_time, 'date_time must be set');

  console.log('✓ Backend formatProject normalization PASSED');

  console.log('--- 2. Testing Frontend Project Card Rendering & Open 2D Plan ---');

  // Create lightweight browser DOM mock
  const domElements = {};
  function createElement(tag) {
    const el = {
      tagName: tag.toUpperCase(),
      classList: {
        _classes: new Set(),
        add: function (c) { this._classes.add(c); },
        remove: function (c) { this._classes.delete(c); },
        toggle: function (c, state) { if (state) this._classes.add(c); else this._classes.delete(c); },
        contains: function (c) { return this._classes.has(c); }
      },
      attributes: {},
      setAttribute: function (k, v) { this.attributes[k] = String(v); },
      getAttribute: function (k) { return this.attributes[k] || null; },
      dataset: {},
      style: {},
      innerHTML: '',
      textContent: '',
      addEventListener: function (evt, fn) {
        this._listeners = this._listeners || {};
        this._listeners[evt] = this._listeners[evt] || [];
        this._listeners[evt].push(fn);
      },
      dispatchEvent: function (evt) {
        if (this._listeners && this._listeners[evt.type]) {
          this._listeners[evt.type].forEach(fn => fn(evt));
        }
      },
      querySelectorAll: function (sel) {
        return [];
      },
      querySelector: function (sel) {
        return null;
      }
    };
    return el;
  }

  // Setup DOM global mocks
  global.window = {
    location: {
      protocol: 'file:',
      pathname: '/C:/Users/aravi/Desktop/Applications/cupboard-cad/cupboard-cad.html',
      hash: ''
    },
    addEventListener: function () { },
    removeEventListener: function () { },
    history: {
      pushState: function (state, title, url) {
        if (global.window.location.protocol === 'file:') {
          throw new Error('SecurityError: A history state object cannot be created in a document with origin null');
        }
      },
      replaceState: function (state, title, url) {
        if (global.window.location.protocol === 'file:') {
          throw new Error('SecurityError: A history state object cannot be created in a document with origin null');
        }
      }
    },
    localStorage: {
      _store: {},
      getItem: function (k) { return this._store[k] || null; },
      setItem: function (k, v) { this._store[k] = String(v); },
      removeItem: function (k) { delete this._store[k]; }
    },
    fetch: async () => ({ ok: false, status: 404 })
  };

  const gridEl = createElement('div');
  gridEl.id = 'projectsGrid';
  const countEl = createElement('span');
  countEl.id = 'projectCountLabel';
  const planViewEl = createElement('section');
  planViewEl.id = 'view-plan';
  const homeViewEl = createElement('section');
  homeViewEl.id = 'view-home';
  homeViewEl.classList.add('is-on');

  global.document = {
    getElementById: function (id) {
      if (id === 'projectsGrid') return gridEl;
      if (id === 'projectCountLabel') return countEl;
      if (id === 'view-plan') return planViewEl;
      if (id === 'view-home') return homeViewEl;
      return null;
    },
    querySelectorAll: function (sel) {
      if (sel === '.view') return [homeViewEl, planViewEl];
      if (sel === '.vtab') return [];
      if (sel === '.proj-card') return [];
      return [];
    },
    querySelector: function (sel) {
      return null;
    },
    addEventListener: function () { },
    removeEventListener: function () { },
    createElement: createElement
  };

  global.showToast = function (msg) {
    // console.log('Toast:', msg);
  };

  // Load orbix-projects.js in global context
  const orbixProjectsCode = fs.readFileSync(path.join(__dirname, '../orbix-projects.js'), 'utf8');
  eval(orbixProjectsCode);

  const OP = global.window.OrbixProjects;
  assert.ok(OP, 'OrbixProjects must be loaded');

  OP.currentUser = {
    id: 'usr_sangathamizh',
    name: 'Sangathamizh',
    email: 'sangathamizh@cookscape.com',
    role: 'employee'
  };

  // Project with camelCase fields directly as returned by Prisma findMany
  OP.projects = [
    {
      id: 'proj_test_demo',
      title: 'test demo — sdasdsd (chennai)',
      client: 'test demo',
      status: 'Draft',
      createdBy: 'usr_sangathamizh',
      ownerName: 'Sangathamizh',
      ownerEmail: 'sangathamizh@cookscape.com',
      createdAt: '2026-11-06T08:30:00.000Z',
      updatedAt: '2026-11-06T09:15:00.000Z',
      data: {
        units: [],
        plan: { walls: [], furniture: [] },
        details: {
          clientName: 'test demo',
          contactNumber: '9876543210',
          location: 'chennai',
          bhName: 'sdasdsd'
        }
      }
    }
  ];

  OP.renderProjectsList();

  const renderedHtml = gridEl.innerHTML;
  // Verify that the card does NOT contain "undefined" or "Invalid Date"
  assert.ok(!renderedHtml.includes('undefined'), 'Rendered project card MUST NOT contain "undefined"');
  assert.ok(!renderedHtml.includes('Invalid Date'), 'Rendered project card MUST NOT contain "Invalid Date"');
  assert.ok(renderedHtml.includes('test demo'), 'Card must include client name');
  assert.ok(renderedHtml.includes('Open 2D Plan'), 'Card must have Open 2D Plan button');
  assert.ok(renderedHtml.includes('You') || renderedHtml.includes('Sangathamizh'), 'Owner must be recognized');
  assert.ok(renderedHtml.includes('SA') || renderedHtml.includes('DK'), 'Avatar initials must exist');

  console.log('✓ Project card HTML metadata rendering PASSED (no undefined, no Invalid Date)');

  console.log('--- 3. Testing Open 2D Plan View Switch & PushState Resilience ---');

  let viewSwitchedTo = null;
  global.window.setView = function (v) {
    viewSwitchedTo = v;
    // Simulate what app.js setView does
    if (global.window.OrbixRouter && typeof global.window.OrbixRouter.updateUrl === 'function') {
      try {
        global.window.OrbixRouter.updateUrl(v, false);
      } catch (e) {
        // Safe catch
      }
    }
    homeViewEl.classList.toggle('is-on', v === 'home');
    planViewEl.classList.toggle('is-on', v === 'plan');
  };

  // Hook setView with router
  if (global.window.OrbixRouter && global.window.OrbixRouter.initRouter) {
    global.window.OrbixRouter.initRouter();
  }

  // User triggers openProject
  OP.openProject('proj_test_demo');

  assert.strictEqual(viewSwitchedTo, 'plan', 'Calling openProject must switch view to "plan"');
  assert.strictEqual(planViewEl.classList.contains('is-on'), true, 'view-plan section must have class "is-on"');
  assert.strictEqual(homeViewEl.classList.contains('is-on'), false, 'view-home section must not have class "is-on"');
  assert.strictEqual(global.window.location.hash, '#plan', 'On file:// protocol, hash should be updated to #plan safely without throwing');

  console.log('✓ Open 2D Plan view switch & pushState resilience PASSED');

  // Restore prisma mock
  prisma.project.findUnique = origFindUnique;

  console.log('\n========================================');
  console.log('ALL TESTS PASSED SUCCESSFULLY!');
  console.log('========================================');
  process.exit(0);
})();
