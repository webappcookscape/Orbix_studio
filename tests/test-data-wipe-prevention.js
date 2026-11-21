const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Test data wipe prevention and auto-upsert
async function runTests() {
  console.log('=== Running Data Wipe Prevention & Upsert Tests ===\n');

  const { checkDatabaseConnection, prisma } = require('../server/config/prisma');
  await checkDatabaseConnection();
  const projectService = require('../server/services/projectService');

  const testUser = {
    id: 'usr_aravind',
    name: 'Aravind',
    email: 'webapp.cookscape@gmail.com',
    role: 'admin'
  };

  // Test 1: Zero-Loss Upsert on updateProject for a non-existent ID
  console.log('Test 1: Auto-upsert when updating non-existent project ID');
  const nonExistentId = 'proj_test_upsert_' + Date.now().toString(36);
  const upsertData = {
    title: 'Mr. Rajasekhar Villa CAD',
    client: 'Mr. Rajasekhar',
    contact_number: '+91 99887 76655',
    location: 'Indiranagar, Bengaluru',
    bh_name: 'Aravind',
    cp_code: 'CP-7788',
    data: {
      plan: {
        schemaVersion: '1.0.0',
        walls: [{ id: 'w1', x1: 0, y1: 0, x2: 4000, y2: 0, thickness: 150 }],
        furniture: [{ id: 'u1', type: 'base_2d', x: 500, y: 500 }],
        openings: [],
        rooms: []
      },
      details: {
        clientName: 'Mr. Rajasekhar',
        contactNumber: '+91 99887 76655',
        location: 'Indiranagar, Bengaluru',
        bhName: 'Aravind',
        cpCode: 'CP-7788'
      }
    },
    units_count: 1
  };

  const created = await projectService.updateProject(nonExistentId, upsertData, testUser);
  assert.ok(created, 'Created project should be returned');
  assert.strictEqual(created.id, nonExistentId, 'Project ID should match');
  assert.strictEqual(created.client, 'Mr. Rajasekhar', 'Client name should match');
  assert.strictEqual(created.contact_number, '+91 99887 76655', 'Contact number should match');
  assert.strictEqual(created.location, 'Indiranagar, Bengaluru', 'Location should match');
  assert.strictEqual(created.bh_name, 'Aravind', 'BH Name should match');
  assert.strictEqual(created.cp_code, 'CP-7788', 'CP Code should match');
  assert.strictEqual(created.units_count, 1, 'Units count should match');
  console.log('✓ Passed: Non-existent project ID was successfully auto-upserted without 404.');

  // Test 2: Updating metadata does not wipe existing plan and units
  console.log('Test 2: Metadata-only update retains existing walls and units');
  const metadataUpdate = {
    client: 'Mr. Rajasekhar & Family',
    contact_number: '+91 99887 76600',
    data: {
      details: {
        clientName: 'Mr. Rajasekhar & Family',
        contactNumber: '+91 99887 76600'
      }
    }
  };
  const updated = await projectService.updateProject(nonExistentId, metadataUpdate, testUser);
  assert.strictEqual(updated.client, 'Mr. Rajasekhar & Family', 'Updated client name preserved');
  assert.strictEqual(updated.contact_number, '+91 99887 76600', 'Updated contact number preserved');
  assert.strictEqual(updated.location, 'Indiranagar, Bengaluru', 'Location retained from previous save');
  assert.ok(updated.data.plan, 'Plan was preserved');
  assert.strictEqual(updated.data.plan.walls.length, 1, 'Walls array preserved');
  assert.strictEqual(updated.data.plan.furniture.length, 1, 'Furniture array preserved');
  console.log('✓ Passed: Metadata update preserved existing plan architecture and details.');

  // Test 3: Plan elements count & integrity
  console.log('Test 3: Plan elements count and integrity verify');
  const fetched = await projectService.getProjectById(nonExistentId, testUser);
  assert.ok(fetched, 'Fetched project exists');
  assert.strictEqual(fetched.data.plan.walls.length, 1, 'Wall persists across read');
  assert.strictEqual(fetched.data.plan.meta.clientName, 'Mr. Rajasekhar & Family', 'plan.meta synced with client');
  console.log('✓ Passed: Project retrieved and plan.meta correctly synchronized.');

  // Cleanup test project
  await projectService.deleteProject(nonExistentId, testUser);
  console.log('✓ Cleaned up test project.');

  console.log('\n=== ALL DATA WIPE PREVENTION TESTS PASSED! ===');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
