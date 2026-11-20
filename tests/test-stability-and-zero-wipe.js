const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('--- Testing Zero-Loss Architecture & System Stability ---');

// 1. Verify ProjectService Zero-Loss Overwrite Guard & Rolling Revisions
(async () => {
  try {
    const { checkDatabaseConnection, prisma } = require('../server/config/prisma');
    await checkDatabaseConnection();
    const projectService = require('../server/services/projectService');

    // Create a mock or real test project in DB
    const testProjId = 'test_zero_loss_' + Date.now();
    const mockData = {
      plan: {
        walls: [{ id: 'w1', x1: 0, y1: 0, x2: 3000, y2: 0 }],
        furniture: [
          { id: 'u1', name: 'Base Unit 600', x: 500, y: 100, rotation: 0 },
          { id: 'u2', name: 'Wall Unit 600', x: 1200, y: 100, rotation: 0 }
        ]
      },
      details: {
        clientName: 'Test Client',
        contactNumber: '9876543210',
        siteAddress: '123 Test Street',
        quoteId: 'ORB-TEST-01'
      }
    };

    const created = await prisma.project.create({
      data: {
        id: testProjId,
        title: 'Zero Loss Test',
        unitsCount: 2,
        data: mockData
      }
    });
    console.log('✓ Created initial project with 2 units:', created.id);

    // TEST A: Attempt accidental 0-unit overwrite
    const badUpdate = {
      data: {
        plan: {
          walls: [{ id: 'w1', x1: 0, y1: 0, x2: 3000, y2: 0 }],
          furniture: []
        }
      },
      units_count: 0
    };

    const afterBadUpdate = await projectService.updateProject(testProjId, badUpdate);
    const dbAfterBad = await prisma.project.findUnique({ where: { id: testProjId } });

    assert.strictEqual(dbAfterBad.unitsCount, 2, 'Units count must remain 2 after 0-unit wipe attempt');
    assert.strictEqual(dbAfterBad.data.plan.furniture.length, 2, 'Furniture array must retain 2 units');
    assert.strictEqual(dbAfterBad.data.details.clientName, 'Test Client', 'Client details must be preserved');
    console.log('✓ Zero-unit overwrite successfully blocked! Units and details preserved intact.');

    // TEST B: Verify metadata update merges without destroying units
    const metaUpdate = {
      title: 'Updated Test Title',
      data: {
        details: {
          clientName: 'Renamed Client'
        }
      }
    };
    await projectService.updateProject(testProjId, metaUpdate);
    const dbAfterMeta = await prisma.project.findUnique({ where: { id: testProjId } });
    assert.strictEqual(dbAfterMeta.title, 'Updated Test Title');
    assert.strictEqual(dbAfterMeta.data.details.clientName, 'Renamed Client');
    assert.strictEqual(dbAfterMeta.data.details.contactNumber, '9876543210', 'Phone number preserved');
    assert.strictEqual(dbAfterMeta.unitsCount, 2, 'Units preserved during metadata update');
    console.log('✓ Metadata safely merged without unit loss.');

    // TEST C: Verify rolling revisions
    const legitimateUpdate = {
      data: {
        plan: {
          walls: [{ id: 'w1', x1: 0, y1: 0, x2: 3000, y2: 0 }],
          furniture: [
            { id: 'u1', name: 'Base Unit 600', x: 500, y: 100, rotation: 0 },
            { id: 'u2', name: 'Wall Unit 600', x: 1200, y: 100, rotation: 0 },
            { id: 'u3', name: 'Tall Unit 600', x: 1800, y: 100, rotation: 0 }
          ]
        }
      },
      units_count: 3
    };
    await projectService.updateProject(testProjId, legitimateUpdate);
    const dbAfterLegit = await prisma.project.findUnique({ where: { id: testProjId } });
    assert.strictEqual(dbAfterLegit.unitsCount, 3);
    assert(Array.isArray(dbAfterLegit.data._revisions), '_revisions array must exist');
    assert(dbAfterLegit.data._revisions.length >= 1, '_revisions must have at least 1 snapshot');
    assert.strictEqual(dbAfterLegit.data._revisions[0].unitsCount, 2, 'Snapshot retains prior unit count');
    console.log('✓ Rolling revision snapshots verified! Snapshot history count:', dbAfterLegit.data._revisions.length);

    // TEST D: Verify explicit clear is honored
    const explicitClear = {
      action: 'clear_all',
      data: { plan: { walls: [], furniture: [] } },
      units_count: 0
    };
    await projectService.updateProject(testProjId, explicitClear);
    const dbAfterClear = await prisma.project.findUnique({ where: { id: testProjId } });
    assert.strictEqual(dbAfterClear.unitsCount, 0, 'Explicit clear should set unitsCount to 0');
    console.log('✓ Explicit clear_all action is honored when requested intentionally.');

    // Cleanup
    await prisma.project.delete({ where: { id: testProjId } });
    console.log('✓ Cleanup done.');

    // TEST E: Session non-blocking debounce check
    const ResilientSessionStore = require('../server/config/session');
    const store = new ResilientSessionStore();
    store.set('sess_test_1', { cookie: { maxAge: 100000 }, user: { id: 'u1' } }, () => {});
    assert(store._diskSaveDebounce !== null, 'Session disk write must be debounced and non-blocking');
    store.flushDiskCacheSync();
    console.log('✓ Session store debouncing and non-blocking disk persistence verified.');

    console.log('\n>>> ALL STABILITY & ZERO-DATA-LOSS TESTS PASSED SUCCESSFULLY! <<<');
    process.exit(0);
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  }
})();
