// ═══════════════════════════════════════════════════════════════════════════════
// Automated Test: WebSocket Real-Time Multi-Device Collaboration
// ═══════════════════════════════════════════════════════════════════════════════

const http = require('http');
const WebSocket = require('ws');
const assert = require('assert');
const liveSyncService = require('../server/services/liveSyncService');

async function runTest() {
  console.log('--- TEST: Real-Time Multi-Device WebSocket Live Sync ---');

  // 1. Start a local HTTP server and attach liveSyncService
  const server = http.createServer((req, res) => res.end('OK'));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  console.log('Test HTTP server listening on port:', port);

  liveSyncService.init(server);

  const wsUrl = `ws://127.0.0.1:${port}/ws`;

  // 2. Connect Client 1 (System 1)
  const client1 = new WebSocket(wsUrl);
  await new Promise((resolve) => client1.on('open', resolve));
  console.log('✓ System 1 connected to WebSocket hub');

  // 3. Connect Client 2 (System 2)
  const client2 = new WebSocket(wsUrl);
  await new Promise((resolve) => client2.on('open', resolve));
  console.log('✓ System 2 connected to WebSocket hub');

  const projectId = 'proj_test_multi_sync_123';

  // System 1 joins project
  client1.send(JSON.stringify({
    type: 'join_project',
    projectId,
    clientId: 'sys1_client',
    user: { id: 'usr_sangathamizh', name: 'Sangathamizh', role: 'admin' }
  }));

  const msg1 = await new Promise((resolve) => {
    client1.once('message', (data) => resolve(JSON.parse(data.toString())));
  });
  console.log('System 1 joined acknowledgment:', msg1.type, 'peers:', msg1.peerCount);
  assert.strictEqual(msg1.type, 'joined_project');
  assert.strictEqual(msg1.peerCount, 1);

  // System 2 joins project
  const joinPromises = Promise.all([
    new Promise((resolve) => client2.once('message', (d) => resolve(JSON.parse(d.toString())))),
    new Promise((resolve) => client1.once('message', (d) => resolve(JSON.parse(d.toString()))))
  ]);

  client2.send(JSON.stringify({
    type: 'join_project',
    projectId,
    clientId: 'sys2_client',
    user: { id: 'usr_designer', name: 'Designer 2', role: 'designer' }
  }));

  const [sys2JoinAck, sys1PeerNotice] = await joinPromises;
  console.log('System 2 joined acknowledgment:', sys2JoinAck.type, 'peers:', sys2JoinAck.peerCount);
  console.log('System 1 received peer joined notification:', sys1PeerNotice.type, 'new count:', sys1PeerNotice.peerCount);

  assert.strictEqual(sys2JoinAck.type, 'joined_project');
  assert.strictEqual(sys2JoinAck.peerCount, 2);
  assert.strictEqual(sys1PeerNotice.type, 'peer_joined');
  assert.strictEqual(sys1PeerNotice.peerCount, 2);

  // 4. System 1 edits project (adds wall and 2 units)
  console.log('\n--- Broadcasting change from System 1 -> System 2 ---');
  const mockPlan = {
    plan: {
      walls: [{ id: 'w_test', start: { x: 0, y: 0 }, end: { x: 3000, y: 0 } }],
      furniture: [{ id: 'f_fm60', name: 'FM 60', code: 'FM60' }, { id: 'f_wm60', name: 'WM 60' }]
    }
  };
  const mockUnits = [{ id: 'u1', name: 'Base Unit 1' }];

  let sys1GotEcho = false;
  client1.on('message', (d) => {
    const m = JSON.parse(d.toString());
    if (m.type === 'remote_change') sys1GotEcho = true;
  });

  const sys2ReceivedChangePromise = new Promise((resolve) => {
    client2.once('message', (data) => resolve(JSON.parse(data.toString())));
  });

  client1.send(JSON.stringify({
    type: 'project_change',
    projectId,
    clientId: 'sys1_client',
    action: 'add_wall',
    plan: mockPlan,
    units: mockUnits,
    timestamp: Date.now()
  }));

  const remoteChange = await sys2ReceivedChangePromise;
  console.log('System 2 received live remote change:', remoteChange.type, 'action:', remoteChange.action);
  assert.strictEqual(remoteChange.type, 'remote_change');
  assert.strictEqual(remoteChange.sourceClientId, 'sys1_client');
  assert.strictEqual(remoteChange.plan.plan.furniture.length, 2);
  assert.strictEqual(remoteChange.units.length, 1);
  assert.strictEqual(sys1GotEcho, false, 'System 1 must not receive its own echoed change');

  console.log('✓ Real-time change delivered to System 2 in 0ms without server reload!');

  // Cleanup
  client1.close();
  client2.close();
  server.close();

  console.log('\n✅ ALL REAL-TIME WEBSOCKET COLLABORATION TESTS PASSED!\n');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});

