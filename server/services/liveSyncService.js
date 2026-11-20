// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — Real-Time WebSocket Multi-Device Collaboration Engine
// Enables simultaneous editing across multiple systems/devices with live sync
// ═══════════════════════════════════════════════════════════════════════════════

const WebSocket = require('ws');
const { prisma } = require('../config/prisma');

function normalizeSyncAction(action) {
  if (!action) return '';
  if (typeof action === 'object') {
    return String(action.actionName || action.type || '').trim();
  }
  return String(action).trim();
}

function isExplicitDestructiveAction(action) {
  const act = normalizeSyncAction(action).toLowerCase();
  if (!act) return false;
  return (
    act === 'clear_all' ||
    act === 'user_delete_all' ||
    act === 'clear plan' ||
    act === 'delete' ||
    act === 'delete_selected' ||
    act === 'delete_furniture' ||
    act === 'delete furniture' ||
    act === 'undo' ||
    act === 'redo' ||
    act === 'reset_project' ||
    act.indexOf('clear') !== -1 ||
    act.indexOf('delete') !== -1
  );
}

function countPlanElements(plan, units) {
  const inner = (plan && plan.plan && typeof plan.plan === 'object') ? plan.plan : (plan || {});
  let walls = Array.isArray(inner.walls) ? inner.walls.length : 0;
  let furniture = Array.isArray(inner.furniture) ? inner.furniture.length : 0;
  let openings = Array.isArray(inner.openings) ? inner.openings.length : 0;
  let stairs = Array.isArray(inner.stairs) ? inner.stairs.length : 0;
  if (inner.floorsData && typeof inner.floorsData === 'object') {
    let fw = 0, ff = 0, fo = 0, fs = 0;
    for (const k of Object.keys(inner.floorsData)) {
      const fd = inner.floorsData[k];
      if (!fd || typeof fd !== 'object') continue;
      if (Array.isArray(fd.walls)) fw += fd.walls.length;
      if (Array.isArray(fd.furniture)) ff += fd.furniture.length;
      if (Array.isArray(fd.openings)) fo += fd.openings.length;
      if (Array.isArray(fd.stairs)) fs += fd.stairs.length;
    }
    if (fw > walls) walls = fw;
    if (ff > furniture) furniture = ff;
    if (fo > openings) openings = fo;
    if (fs > stairs) stairs = fs;
  }
  if (furniture === 0 && Array.isArray(units) && units.length > 0) {
    furniture = units.length;
  }
  const lastModified = Number((plan && plan._lastModified) || (inner && inner._lastModified) || 0) || 0;
  return { walls, furniture, openings, stairs, total: walls + furniture + openings + stairs, lastModified };
}

class LiveSyncService {
  constructor() {
    this.wss = null;
    this.rooms = new Map(); // projectId -> Map<clientId, { ws, userId, userName, isAlive }>
    this.clientToProject = new Map(); // clientId -> projectId
    this.saveDebounceTimers = new Map(); // projectId -> setTimeout timer
    this.lastTimestampByProject = new Map(); // projectId -> latest accepted timestamp
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

              // Leave any previous project room so this client never leaks across projects
              const prevProjectId = this.clientToProject.get(clientId);
              if (prevProjectId && String(prevProjectId) !== String(projectId)) {
                this.removeClientFromRoom(prevProjectId, clientId);
              }

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

              // Cross-project protection: reject if payload plan explicitly belongs to a different project
              const planProjId = plan && (plan._projectId || (plan.meta && plan.meta.id));
              if (planProjId && String(planProjId) !== String(projectId)) {
                console.warn(`[LiveSync] Rejected cross-project change from ${clientId}: plan ${planProjId} != room ${projectId}`);
                return;
              }

              const incomingTs = Number(timestamp || (plan && plan._lastModified) || 0) || Date.now();
              const prevTs = this.lastTimestampByProject.get(projectId) || 0;
              if (prevTs > 0 && incomingTs < prevTs) {
                console.warn(`[LiveSync] Ignored stale out-of-order change for ${projectId} (${incomingTs} < ${prevTs})`);
                return;
              }
              this.lastTimestampByProject.set(projectId, incomingTs);

              const normalizedAction = normalizeSyncAction(action) || 'plan_update';

              // 1. Immediately broadcast changes to all other connected systems/devices
              const broadcastPayload = {
                type: 'remote_change',
                projectId,
                sourceClientId: clientId,
                action: normalizedAction,
                plan,
                units,
                timestamp: incomingTs
              };
              this.broadcastToRoom(projectId, broadcastPayload, clientId);

              // 2. Debounced persistence to PostgreSQL/Prisma database
              this.scheduleDatabaseSave(projectId, plan, units, normalizedAction, incomingTs);
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

  scheduleDatabaseSave(projectId, plan, units, action = null, timestamp = null) {
    if (!projectId) return;

    if (this.saveDebounceTimers.has(projectId)) {
      clearTimeout(this.saveDebounceTimers.get(projectId));
    }

    const timer = setTimeout(async () => {
      this.saveDebounceTimers.delete(projectId);
      try {
        // Fetch existing project to safely merge metadata & details
        const existing = await prisma.project.findUnique({
          where: { id: projectId }
        });

        if (!existing) {
          return; // Project does not exist in DB, skip silent persistence
        }

        const existingData = (existing.data && typeof existing.data === 'object') ? existing.data : {};
        const existingStats = countPlanElements(existingData.plan, existingData.units);
        const incomingStats = countPlanElements(plan, units);
        const isExplicitClear = isExplicitDestructiveAction(action);

        // Stale-timestamp guard: never let an older WebSocket debounce overwrite a newer HTTP PUT save
        const incomingMod = incomingStats.lastModified || Number(timestamp || 0) || 0;
        if (existingStats.lastModified > 0 && incomingMod > 0 && incomingMod < existingStats.lastModified) {
          console.warn(`[LiveSync] Skipped stale DB save for ${projectId} (${incomingMod} < ${existingStats.lastModified}).`);
          return;
        }

        // ZERO-WALL / ZERO-UNIT PROTECT GUARD:
        // Never allow an accidental empty wall or empty unit snapshot to wipe an existing project!
        if (!isExplicitClear) {
          if (incomingStats.walls === 0 && existingStats.walls > 0) {
            console.warn(`[LiveSync] Rejected destructive 0-wall overwrite for project ${projectId} (DB retains ${existingStats.walls} walls).`);
            return;
          }
          if (incomingStats.furniture === 0 && (existingStats.furniture > 0 || (existing.unitsCount || 0) > 0)) {
            console.warn(`[LiveSync] Rejected destructive 0-unit overwrite for project ${projectId} (DB retains ${existingStats.furniture || existing.unitsCount} units).`);
            return;
          }
        }

        const stampedPlan = plan ? Object.assign({}, plan, {
          _projectId: String(projectId),
          _lastModified: Math.max(incomingMod || 0, existingStats.lastModified || 0, Date.now()),
          _serverSavedAt: Date.now()
        }) : existingData.plan;

        // Merge data while preserving details, rooms, etc.
        const mergedData = Object.assign({}, existingData, {
          plan: stampedPlan,
          units: (Array.isArray(units) && (units.length > 0 || isExplicitClear))
            ? units
            : (existingData.units || [])
        });

        await prisma.project.update({
          where: { id: projectId },
          data: {
            data: mergedData,
            unitsCount: incomingStats.furniture,
            updatedAt: new Date()
          }
        });
        console.log(`[LiveSync] Auto-persisted real-time state for project ${projectId} to database (${incomingStats.walls} walls, ${incomingStats.furniture} units).`);
      } catch (err) {
        console.warn(`[LiveSync] Database persistence notice for ${projectId}:`, err.message);
      }
    }, 800);

    this.saveDebounceTimers.set(projectId, timer);
  }
}

const liveSyncService = new LiveSyncService();

module.exports = liveSyncService;

