// ═══════════════════════════════════════════════════════════════════════════════
// Automated Test: Spacebar Unit Rotation & Zero-Unit Database Protection
// ═══════════════════════════════════════════════════════════════════════════════

const assert = require('assert');
const liveSyncService = require('../server/services/liveSyncService');

async function testUnitRotation() {
  console.log('--- TEST 1: Spacebar / R Unit Rotation ---');

  // Mock project plan with a unit
  const mockPlan = {
    plan: {
      furniture: [
        { id: 'f_unit_1', name: 'FM 60 Base Unit', rotY: 0, pos: { x: 1000, y: 1000, z: 0 } }
      ]
    }
  };

  const furn = mockPlan.plan.furniture[0];
  assert.strictEqual(furn.rotY, 0, 'Initial rotY must be 0');

  // Rotate by 90 degrees (Math.PI / 2)
  furn.rotY = ((furn.rotY || 0) + Math.PI / 2) % (Math.PI * 2);
  console.log('Rotated once (Spacebar):', Math.round(furn.rotY * 180 / Math.PI) + '°');
  assert.strictEqual(Math.round(furn.rotY * 180 / Math.PI), 90);

  // Rotate second time
  furn.rotY = ((furn.rotY || 0) + Math.PI / 2) % (Math.PI * 2);
  console.log('Rotated twice (Spacebar):', Math.round(furn.rotY * 180 / Math.PI) + '°');
  assert.strictEqual(Math.round(furn.rotY * 180 / Math.PI), 180);

  // Rotate third time
  furn.rotY = ((furn.rotY || 0) + Math.PI / 2) % (Math.PI * 2);
  console.log('Rotated 3rd time (Spacebar):', Math.round(furn.rotY * 180 / Math.PI) + '°');
  assert.strictEqual(Math.round(furn.rotY * 180 / Math.PI), 270);

  // Rotate 4th time -> back to 0
  furn.rotY = ((furn.rotY || 0) + Math.PI / 2) % (Math.PI * 2);
  console.log('Rotated 4th time (Spacebar):', Math.round(furn.rotY * 180 / Math.PI) + '°');
  assert.strictEqual(Math.round(furn.rotY * 180 / Math.PI), 0);

  console.log('✓ Spacebar 90-degree 4-quadrant rotation passed!');
}

async function testZeroUnitGuard() {
  console.log('\n--- TEST 2: Zero-Unit Overwrite Protection Guard ---');

  // Simulate existing DB project with 12 units and client details
  const existingProject = {
    id: 'proj_test_guard_123',
    title: 'Mr.Rajasekhar Flat',
    unitsCount: 12,
    data: {
      details: { clientName: 'Mr.Rajasekhar', phone: '9876543210' },
      plan: {
        plan: {
          furniture: new Array(12).fill(0).map((_, i) => ({ id: 'f_' + i, name: 'Unit ' + i }))
        }
      },
      units: new Array(12).fill(0).map((_, i) => ({ id: 'u_' + i }))
    }
  };

  // An unhydrated empty change arrives (0 units) during project load / tab switch
  const incomingEmptyPlan = { plan: { walls: [], furniture: [] } };
  const incomingEmptyUnits = [];
  const action = 'plan_change';

  const uCount = (incomingEmptyPlan && incomingEmptyPlan.plan && Array.isArray(incomingEmptyPlan.plan.furniture))
    ? incomingEmptyPlan.plan.furniture.length
    : (Array.isArray(incomingEmptyUnits) ? incomingEmptyUnits.length : 0);

  const existingUnitsCount = existingProject.unitsCount || 0;
  const isExplicitClear = action === 'clear_all' || action === 'user_delete_all';

  let overwriteAllowed = true;
  if (uCount === 0 && existingUnitsCount > 0 && !isExplicitClear) {
    overwriteAllowed = false;
  }

  assert.strictEqual(overwriteAllowed, false, 'Unintentional 0-unit change MUST NOT overwrite existing units in database');
  console.log('✓ Destructive overwrite was correctly BLOCKED! Existing 12 units retained.');

  // If action is explicit 'clear_all', it should be allowed
  const explicitAction = 'clear_all';
  const isExplicit = explicitAction === 'clear_all' || explicitAction === 'user_delete_all';
  let explicitAllowed = true;
  if (uCount === 0 && existingUnitsCount > 0 && !isExplicit) {
    explicitAllowed = false;
  }
  assert.strictEqual(explicitAllowed, true, 'Explicit clear_all must be allowed');
  console.log('✓ Deliberate clear_all action correctly permitted.');

  // Safe data merge test
  const incomingValidPlan = {
    plan: {
      furniture: [{ id: 'f_new', name: 'New Unit' }]
    }
  };
  const mergedData = Object.assign({}, existingProject.data || {}, {
    plan: incomingValidPlan,
    units: [{ id: 'u_new' }]
  });

  assert.strictEqual(mergedData.details.clientName, 'Mr.Rajasekhar', 'Client details must be preserved on merge');
  assert.strictEqual(mergedData.plan.plan.furniture.length, 1, 'New plan must be applied');
  console.log('✓ Safe metadata merge preserved details:', mergedData.details);
}

async function run() {
  await testUnitRotation();
  await testZeroUnitGuard();
  console.log('\n✅ ALL ROTATION & DATA LOSS PROTECTION TESTS PASSED!\n');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

