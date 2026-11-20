// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — Real-Time WebSocket Multi-Device Collaboration Engine
// Enables simultaneous editing across multiple systems/devices with live sync
// ═══════════════════════════════════════════════════════════════════════════════

const WebSocket = require('ws');
const { prisma } = require('../config/prisma');

class LiveSyncService {
  constructor() {
    this.wss = null;
    this.rooms = new Map(); // projectId -> Map<clientId, { ws, userId, userName, isAlive }>
    this.clientToProject = new Map(); // clientId -> projectId
    this.saveDebounceTimers = new Map(); // projectId -> setTimeout timer
  }

  init(server) {
    if (!server) return;

    this.wss = new WebSocket.Server({ server, path: '/ws' });
    console.log('[LiveSync] Real-time WebSocket Collaboration Hub initialized on path: /ws');

    this.wss.on('connection', (ws, req) => {
      let currentClientId = null;
      let currentProjectId = null;
      ws.isAlive = true;

      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('message', async (rawMessage) => {
        try {
          const msg = JSON.parse(rawMessage.toString());
          if (!msg || !msg.type) return;

          switch (msg.type) {
            case 'ping':
              ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
              break;

            case 'join_project': {
              const { projectId, clientId, user } = msg;
              if (!projectId || !clientId) return;

              currentClientId = clientId;
              currentProjectId = projectId;
              this.clientToProject.set(clientId, projectId);

              if (!this.rooms.has(projectId)) {
                this.rooms.set(projectId, new Map());
              }
              const room = this.rooms.get(projectId);
              room.set(clientId, {
                ws,
                userId: user ? user.id : 'anon',
                userName: user ? (user.name || user.username) : 'Collaborator',
                userRole: user ? user.role : 'user',
                joinedAt: Date.now()
              });

              // Gather peer list
              const peers = [];
              room.forEach((peer, pId) => {
                peers.push({
                  clientId: pId,
                  userId: peer.userId,
                  userName: peer.userName,
                  userRole: peer.userRole
                });
              });

              // Acknowledge join to the sender
              ws.send(JSON.stringify({
                type: 'joined_project',
                projectId,
                clientId,
                peerCount: room.size,
                peers
              }));

              // Notify all other peers in the room
              this.broadcastToRoom(projectId, {
                type: 'peer_joined',
                projectId,
                peer: {
                  clientId,
                  userId: user ? user.id : 'anon',
                  userName: user ? (user.name || user.username) : 'Collaborator',
                  userRole: user ? user.role : 'user'
                },
                peerCount: room.size
              }, clientId);

              console.log(`[LiveSync] Client ${clientId} joined project ${projectId} (${room.size} active peers)`);
              break;
            }

            case 'project_change': {
              const { projectId, clientId, action, plan, units, timestamp } = msg;
              if (!projectId || !clientId) return;

              // 1. Immediately broadcast changes to all other connected systems/devices
              const broadcastPayload = {
                type: 'remote_change',
                projectId,
                sourceClientId: clientId,
                action: action || 'plan_update',
                plan,
                units,
                timestamp: timestamp || Date.now()
              };
              const sentCount = this.broadcastToRoom(projectId, broadcastPayload, clientId);

              // 2. Debounced persistence to PostgreSQL/Prisma database
              this.scheduleDatabaseSave(projectId, plan, units);
              break;
            }

            case 'leave_project': {
              const { projectId, clientId } = msg;
              this.removeClientFromRoom(projectId, clientId);
              break;
            }

            default:
              break;
          }
        } catch (err) {
          console.warn('[LiveSync] Error handling message:', err.message);
        }
      });

      ws.on('close', () => {
        if (currentClientId && currentProjectId) {
          this.removeClientFromRoom(currentProjectId, currentClientId);
        }
      });

      ws.on('error', (err) => {
        console.warn('[LiveSync] Socket error:', err.message);
        if (currentClientId && currentProjectId) {
          this.removeClientFromRoom(currentProjectId, currentClientId);
        }
      });
    });

    // ── Keep-alive heartbeat every 25 seconds ──
    this.heartbeatInterval = setInterval(() => {
      if (!this.wss) return;
      this.wss.clients.forEach((ws) => {
        if (ws.isAlive === false) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
      });
    }, 25000);
  }

  broadcastToRoom(projectId, payload, excludeClientId = null) {
    if (!this.rooms.has(projectId)) return 0;
    const room = this.rooms.get(projectId);
    const dataStr = JSON.stringify(payload);
    let sentCount = 0;

    room.forEach((peer, clientId) => {
      if (clientId !== excludeClientId && peer.ws && peer.ws.readyState === WebSocket.OPEN) {
        try {
          peer.ws.send(dataStr);
          sentCount++;
        } catch (_) { }
      }
    });

    return sentCount;
  }

  removeClientFromRoom(projectId, clientId) {
    if (!projectId || !clientId) return;
    this.clientToProject.delete(clientId);

    if (this.rooms.has(projectId)) {
      const room = this.rooms.get(projectId);
      const peer = room.get(clientId);
      room.delete(clientId);

      const remainingCount = room.size;
      if (remainingCount === 0) {
        this.rooms.delete(projectId);
      } else {
        this.broadcastToRoom(projectId, {
          type: 'peer_left',
          projectId,
          clientId,
          userName: peer ? peer.userName : 'Collaborator',
          peerCount: remainingCount
        });
      }
      console.log(`[LiveSync] Client ${clientId} left project ${projectId} (${remainingCount} peers remaining)`);
    }
  }

  scheduleDatabaseSave(projectId, plan, units) {
    if (!projectId) return;

    if (this.saveDebounceTimers.has(projectId)) {
      clearTimeout(this.saveDebounceTimers.get(projectId));
    }

    const timer = setTimeout(async () => {
      this.saveDebounceTimers.delete(projectId);
      try {
        const uCount = (plan && plan.plan && Array.isArray(plan.plan.furniture))
          ? plan.plan.furniture.length
          : (Array.isArray(units) ? units.length : 0);

        await prisma.project.update({
          where: { id: projectId },
          data: {
            data: { plan, units },
            unitsCount: uCount,
            updatedAt: new Date()
          }
        });
        console.log(`[LiveSync] Auto-persisted real-time state for project ${projectId} to database (${uCount} units).`);
      } catch (err) {
        console.warn(`[LiveSync] Database persistence notice for ${projectId}:`, err.message);
      }
    }, 600);

    this.saveDebounceTimers.set(projectId, timer);
  }
}

const liveSyncService = new LiveSyncService();

module.exports = liveSyncService;

