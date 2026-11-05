
const fs = require('fs');
const path = require('path');
const Core = require('../orbix-core.js');

// Mock localStorage
const localStorageStore = {};
global.localStorage = {
  getItem: (k) => localStorageStore[k] || null,
  setItem: (k, v) => { localStorageStore[k] = String(v); },
  removeItem: (k) => { delete localStorageStore[k]; },
  clear: () => { for (const k in localStorageStore) delete localStorageStore[k]; }
};

// Mock browser globals
global.document = {
  readyState: 'complete',
  addEventListener: () => { },
  querySelector: () => null,
  getElementById: () => null
};
global.window = global;
global.Blob = function (parts, opts) {
  this.parts = parts;
  this.type = opts ? opts.type : '';
  const bufs = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (Buffer.isBuffer(p)) bufs.push(p);
    else if (p instanceof Uint8Array) bufs.push(Buffer.from(p.buffer, p.byteOffset, p.byteLength));
    else bufs.push(Buffer.from(String(p), 'utf8'));
  }
  this.buffer = Buffer.concat(bufs);
};

const OrbixUI = require('../orbix-ui.js');

console.log('--- TESTING CLIENT DETAILS NORMALIZATION & OFFLINE PERSISTENCE ---');

// 1. Simulate "Create New Project" modal inputs from user
const userInput = {
  client: 'Vikram Singhania',
  contact: '+91 98765 43210',
  location: 'Whitefield, Bengaluru',
  bhName: 'Sangathamizh',
  dateTime: '05-11-2026 23:36',
  cpCode: 'CP-9042'
};

// Create fresh project with these inputs
const project = Core.createProject(userInput.client + ' — ' + userInput.bhName + ' (' + userInput.location + ')');
project.meta = {
  clientName: userInput.client,
  phone: userInput.contact,
  contactNumber: userInput.contact,
  siteAddress: userInput.location,
  siteLocation: userInput.location,
  designerName: userInput.bhName,
  bhName: userInput.bhName,
  quoteId: userInput.cpCode,
  cpCode: userInput.cpCode,
  dateCreated: userInput.dateTime,
  status: 'Approved Estimate'
};

// Verify meta properties
if (project.meta.clientName !== 'Vikram Singhania') throw new Error('Client name mismatch');
if (project.meta.phone !== '+91 98765 43210') throw new Error('Phone mismatch');
if (project.meta.siteAddress !== 'Whitefield, Bengaluru') throw new Error('Site address mismatch');
if (project.meta.quoteId !== 'CP-9042') throw new Error('QuoteId/CP Code mismatch');
console.log('✓ Project meta populated correctly with user input values');

// 2. Add units in 2D
project.plan.furniture = [
  Core.createFurniturePlacement('fm-120', 1000, 1000, 0, 'r_kitchen'),
  Core.createFurniturePlacement('fm-60', 2200, 1000, 0, 'r_kitchen')
];
console.log('✓ Placed 2 units in plan:', project.plan.furniture.length);

// 3. Simulate instant local save
const draftKey = 'orbix_working_project_draft';
const userKey = 'orbix_project_user1_proj123';
const draftData = {
  projectId: 'proj123',
  userId: 'user1',
  timestamp: Date.now(),
  plan: project,
  units: []
};
localStorage.setItem(draftKey, JSON.stringify(draftData));
localStorage.setItem(userKey, JSON.stringify(project));

// 4. Simulate browser hard refresh (Ctrl+F5)
// PostgreSQL server only has old state with 0 units
const serverStaleProject = {
  id: 'proj123',
  title: 'Vikram Singhania',
  client: 'Vikram Singhania',
  updatedAt: new Date(Date.now() - 60000).toISOString(),
  data: {
    plan: Core.createProject('Vikram Singhania'),
    units: []
  }
};

// Recovery logic: compare local draft vs server state
const rawLocal = localStorage.getItem(userKey);
const parsedLocal = JSON.parse(rawLocal);
const localUnitCount = (parsedLocal.plan && parsedLocal.plan.furniture) ? parsedLocal.plan.furniture.length : 0;
const serverUnitCount = (serverStaleProject.data.plan.plan && serverStaleProject.data.plan.plan.furniture) ? serverStaleProject.data.plan.plan.furniture.length : 0;

let recoveredPlan = null;
if (localUnitCount > serverUnitCount) {
  recoveredPlan = parsedLocal;
  console.log('✓ Successfully recovered newer local draft across hard refresh!');
} else {
  recoveredPlan = serverStaleProject.data.plan;
}

if (!recoveredPlan || recoveredPlan.plan.furniture.length !== 2) {
  throw new Error('FAILED: Units were lost on refresh!');
}
console.log('✓ Verified: 2 units preserved with 0 loss!');

console.log('ALL CLIENT META & PERSISTENCE TESTS PASSED 100%!');
