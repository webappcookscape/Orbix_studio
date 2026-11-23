/* ═══════════════════════════════════════════════════════════════════════════════
   ORBIX STUDIO — Real-Time WebSocket Multi-Device Collaboration Client
   Synchronizes 2D plans and 3D studio live across simultaneous screens & devices
   ═══════════════════════════════════════════════════════════════════════════════ */

(function (root) {
  'use strict';

  var OrbixLiveSync = {
    socket: null,
    clientId: null,
    activeProjectId: null,
    peerCount: 1,
    peers: [],
    reconnectAttempts: 0,
    reconnectTimer: null,
    broadcastDebounceTimer: null,
    isApplyingRemoteChange: false,

    init: function () {
      var self = this;
      self.clientId = self.resolveClientId();
      self.connect();

      // Hook into window online/offline
      window.addEventListener('online', function () {
        self.reconnectAttempts = 0;
        self.connect();
      });

      // Hook into visibility/focus to immediately verify room sync
      window.addEventListener('focus', function () {
        if (self.socket && self.socket.readyState === WebSocket.OPEN && self.activeProjectId) {
          self.joinProject(self.activeProjectId);
        } else {
          self.connect();
        }
      });
    },

    resolveClientId: function () {
      var id = null;
      try {
        id = sessionStorage.getItem('orbix_live_client_id');
        if (!id) {
          id = 'cli_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
          sessionStorage.setItem('orbix_live_client_id', id);
        }
      } catch (_) {
        id = 'cli_' + Math.random().toString(36).substring(2, 10);
      }
      return id;
    },

    connect: function () {
      var self = this;
      if (typeof WebSocket === 'undefined') return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        self.scheduleReconnect();
        return;
      }
      if (self.socket && (self.socket.readyState === WebSocket.OPEN || self.socket.readyState === WebSocket.CONNECTING)) {
        return;
      }

      var protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      var host = window.location.host;
      if (!host) return;
      var wsUrl = protocol + '//' + host + '/ws';

      try {
        self.socket = new WebSocket(wsUrl);

        self.socket.onopen = function () {
          console.log('[LiveSync] Connected to real-time collaboration server.');
          self.reconnectAttempts = 0;
          self.updatePresenceUI();

          // If we already have an active project open, join it immediately
          var currProjId = self.activeProjectId || (root.OrbixProjects ? root.OrbixProjects.activeProjectId : null);
          if (currProjId) {
            self.joinProject(currProjId);
          }
        };

        self.socket.onmessage = function (event) {
          try {
            var msg = JSON.parse(event.data);
            self.handleMessage(msg);
          } catch (e) {
            console.warn('[LiveSync] Invalid message:', e);
          }
        };

        self.socket.onclose = function () {
          self.updatePresenceUI(0);
          self.scheduleReconnect();
        };

        self.socket.onerror = function () {
          try { self.socket.close(); } catch (_) { }
        };
      } catch (err) {
        console.warn('[LiveSync] Connection failed:', err);
        self.scheduleReconnect();
      }
    },

    scheduleReconnect: function () {
      var self = this;
      if (self.reconnectTimer) clearTimeout(self.reconnectTimer);
      var delay = Math.min(10000, 1000 * Math.pow(1.5, self.reconnectAttempts || 0));
      self.reconnectAttempts = (self.reconnectAttempts || 0) + 1;
      self.reconnectTimer = setTimeout(function () {
        self.connect();
      }, delay);
    },

    joinProject: function (projectId) {
      var self = this;
      if (!projectId) return;
      var nextId = String(projectId);
      var prevId = self.activeProjectId ? String(self.activeProjectId) : null;

      // Cancel any pending debounced broadcast from the previous project
      if (prevId && prevId !== nextId) {
        if (self.broadcastDebounceTimer) {
          clearTimeout(self.broadcastDebounceTimer);
          self.broadcastDebounceTimer = null;
        }
        if (self.socket && self.socket.readyState === WebSocket.OPEN) {
          try {
            self.socket.send(JSON.stringify({
              type: 'leave_project',
              projectId: prevId,
              clientId: self.clientId
            }));
          } catch (_) { }
        }
      }

      self.activeProjectId = nextId;

      if (self.socket && self.socket.readyState === WebSocket.OPEN) {
        var user = (root.OrbixProjects && root.OrbixProjects.currentUser) ? root.OrbixProjects.currentUser : null;
        self.socket.send(JSON.stringify({
          type: 'join_project',
          projectId: self.activeProjectId,
          clientId: self.clientId,
          user: user
        }));
      }
    },

    _normalizeActionName: function (action) {
      if (!action) return 'plan_change';
      if (typeof action === 'object') {
        return String(action.actionName || action.type || 'plan_change');
      }
      return String(action);
    },

    _isDestructiveAction: function (action) {
      var act = this._normalizeActionName(action).toLowerCase().trim();
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
    },

    _countPlanParts: function (planObj, unitsArr) {
      var inner = (planObj && planObj.plan && typeof planObj.plan === 'object') ? planObj.plan : (planObj || {});
      var walls = Array.isArray(inner.walls) ? inner.walls.length : 0;
      var furn = Array.isArray(inner.furniture) ? inner.furniture.length : 0;
      var openings = Array.isArray(inner.openings) ? inner.openings.length : 0;
      var stairs = Array.isArray(inner.stairs) ? inner.stairs.length : 0;
      if (inner.floorsData && typeof inner.floorsData === 'object') {
        var fw = 0, ff = 0, fo = 0, fs = 0;
        for (var fk in inner.floorsData) {
          if (!Object.prototype.hasOwnProperty.call(inner.floorsData, fk)) continue;
          var fd = inner.floorsData[fk];
          if (!fd || typeof fd !== 'object') continue;
          if (Array.isArray(fd.walls)) fw += fd.walls.length;
          if (Array.isArray(fd.furniture)) ff += fd.furniture.length;
          if (Array.isArray(fd.openings)) fo += fd.openings.length;
          if (Array.isArray(fd.stairs)) fs += fd.stairs.length;
        }
        if (fw > walls) walls = fw;
        if (ff > furn) furn = ff;
        if (fo > openings) openings = fo;
        if (fs > stairs) stairs = fs;
      }
      if (furn === 0 && Array.isArray(unitsArr) && unitsArr.length > 0) {
        furn = unitsArr.length;
      }
      return { walls: walls, furniture: furn, openings: openings, stairs: stairs, total: walls + furn + openings + stairs };
    },

    broadcastChange: function (action) {
      var self = this;
      if (self.isApplyingRemoteChange) return; // Don't echo back changes received from peer!
      if (root.OrbixUI && root.OrbixUI._isProjectLoading) return; // Do not broadcast intermediate states while loading a project!
      if (root.OrbixProjects && root.OrbixProjects._isAwaitingHydration) return; // Do not broadcast unhydrated skeleton!

      if (!self.activeProjectId) {
        if (root.OrbixProjects && root.OrbixProjects.activeProjectId) {
          self.activeProjectId = String(root.OrbixProjects.activeProjectId);
        }
      }
      if (!self.activeProjectId) return;
      if (!self.socket || self.socket.readyState !== WebSocket.OPEN) return;

      var targetProjectId = String(self.activeProjectId);
      var normalizedAction = self._normalizeActionName(action);
      var actLower = normalizedAction.toLowerCase();
      var isImmediate = self._isDestructiveAction(normalizedAction) ||
        actLower.indexOf('place') !== -1 ||
        actLower.indexOf('delete') !== -1 ||
        actLower.indexOf('add') !== -1 ||
        actLower.indexOf('drop') !== -1 ||
        actLower.indexOf('switch') !== -1;
      var debounceMs = isImmediate ? 250 : 800;

      clearTimeout(self.broadcastDebounceTimer);
      self.broadcastDebounceTimer = setTimeout(function () {
        self.broadcastDebounceTimer = null;
        if (root.OrbixUI && root.OrbixUI._isProjectLoading) return;
        if (root.OrbixProjects && root.OrbixProjects._isAwaitingHydration) return;
        if (String(self.activeProjectId) !== targetProjectId) return; // User switched projects during debounce!

        if (root.OrbixUI && typeof root.OrbixUI.syncActiveFloorData === 'function') {
          try { root.OrbixUI.syncActiveFloorData(); } catch (_) { }
        }
        var currentPlan = (root.OrbixUI && root.OrbixUI.project) ? root.OrbixUI.project : null;
        var currentUnits = (root.S && Array.isArray(root.S.units)) ? root.S.units : [];
        if (!currentPlan && !currentUnits) return;

        // Cross-project safety check: ensure plan belongs to targetProjectId
        var planId = currentPlan ? String(currentPlan._projectId || (currentPlan.meta && currentPlan.meta.id) || '') : '';
        if (planId && planId !== targetProjectId) return;

        // If currentUnits is empty but currentPlan has furniture, sync first to avoid broadcasting 0 units
        var fCount = (currentPlan && currentPlan.plan && Array.isArray(currentPlan.plan.furniture))
          ? currentPlan.plan.furniture.length : 0;
        if (fCount > 0 && currentUnits.length === 0 && root.OrbixUI && typeof root.OrbixUI.syncProjectUnitsTo3DStudio === 'function') {
          try { root.OrbixUI.syncProjectUnitsTo3DStudio(); } catch (_) { }
          currentUnits = (root.S && Array.isArray(root.S.units)) ? root.S.units : [];
        }

        var ts = (currentPlan && currentPlan._lastModified) ? Number(currentPlan._lastModified) : Date.now();
        if (currentPlan && !currentPlan._lastModified) currentPlan._lastModified = ts;

        var broadcastPlan = (root.OrbixProjects && typeof root.OrbixProjects._stripHeavyLocalData === 'function')
          ? root.OrbixProjects._stripHeavyLocalData(currentPlan)
          : currentPlan;

        try {
          self.socket.send(JSON.stringify({
            type: 'project_change',
            projectId: targetProjectId,
            clientId: self.clientId,
            action: normalizedAction,
            plan: broadcastPlan,
            units: currentUnits,
            timestamp: ts
          }));
        } catch (e) {
          console.warn('[LiveSync] Broadcast error:', e);
        }
      }, debounceMs);
    },

    handleMessage: function (msg) {
      var self = this;
      if (!msg || !msg.type) return;

      switch (msg.type) {
        case 'joined_project':
          self.peerCount = msg.peerCount || 1;
          self.peers = msg.peers || [];
          self.updatePresenceUI(self.peerCount);
          break;

        case 'peer_joined':
          self.peerCount = msg.peerCount || (self.peerCount + 1);
          self.updatePresenceUI(self.peerCount);
          self.showLiveToast('🟢 ' + (msg.peer && msg.peer.userName ? msg.peer.userName : 'Collaborator') + ' connected live.');
          break;

        case 'peer_left':
          self.peerCount = Math.max(1, (msg.peerCount !== undefined ? msg.peerCount : (self.peerCount - 1)));
          self.updatePresenceUI(self.peerCount);
          break;

        case 'remote_change':
          if (msg.sourceClientId === self.clientId) return; // Ignore own changes
          if (String(msg.projectId) !== String(self.activeProjectId)) return;

          self.applyRemoteChange(msg);
          break;

        default:
          break;
      }
    },

    applyRemoteChange: function (msg) {
      var self = this;
      self.isApplyingRemoteChange = true;

      try {
        var remotePlan = msg.plan;
        var remoteUnits = msg.units;
        var localPlan = (root.OrbixUI && root.OrbixUI.project) ? root.OrbixUI.project : null;

        // Cross-project guard
        var remotePlanId = remotePlan ? String(remotePlan._projectId || (remotePlan.meta && remotePlan.meta.id) || '') : '';
        if (remotePlanId && self.activeProjectId && remotePlanId !== String(self.activeProjectId)) {
          console.warn('[LiveSync] Discarded mismatched remote plan (' + remotePlanId + ' != ' + self.activeProjectId + ').');
          self.isApplyingRemoteChange = false;
          return;
        }

        // Stale timestamp guard: do not let an older out-of-order broadcast roll back newer local edits
        var localLastMod = Number((localPlan && localPlan._lastModified) || 0) || 0;
        var remoteTs = Number((remotePlan && remotePlan._lastModified) || msg.timestamp || 0) || 0;
        if (localLastMod > 0 && remoteTs > 0 && remoteTs < localLastMod) {
          console.warn('[LiveSync] Discarded stale remote change (' + remoteTs + ' < ' + localLastMod + ').');
          self.isApplyingRemoteChange = false;
          return;
        }

        var localStats = self._countPlanParts(localPlan, root.S && root.S.units);
        var remoteStats = self._countPlanParts(remotePlan, remoteUnits);
        var isDel = self._isDestructiveAction(msg.action);

        // GUARD: Protect BOTH active walls AND active units against accidental empty remote overwrites!
        if (!isDel) {
          if (remoteStats.walls === 0 && localStats.walls > 0) {
            console.warn('[LiveSync] Discarded empty-wall remote change to protect ' + localStats.walls + ' active walls.');
            self.isApplyingRemoteChange = false;
            return;
          }
          if (remoteStats.furniture === 0 && localStats.furniture > 0) {
            console.warn('[LiveSync] Discarded empty-unit remote change to protect ' + localStats.furniture + ' active units.');
            self.isApplyingRemoteChange = false;
            return;
          }
        }

        if (remotePlan && root.OrbixUI) {
          if (self.activeProjectId) {
            remotePlan._projectId = String(self.activeProjectId);
          }
          remotePlan._lastModified = Math.max(remoteTs || 0, Date.now());
          root.OrbixUI.project = remotePlan;
          if (root.OrbixUI.editor) {
            root.OrbixUI.editor.project = remotePlan;
          }
        }

        if (Array.isArray(remoteUnits) && root.S && (remoteUnits.length > 0 || isDel)) {
          root.S.units = remoteUnits;
        }

        // Save lightweight in-memory update to local cache so page refresh retains latest remote work
        if (root.OrbixProjects && self.activeProjectId && remotePlan) {
          var uId = root.OrbixProjects.currentUser ? root.OrbixProjects.currentUser.id : 'anon';
          var lightPlan = (typeof root.OrbixProjects._stripHeavyLocalData === 'function')
            ? root.OrbixProjects._stripHeavyLocalData(remotePlan)
            : remotePlan;
          var saveFn = (typeof root.OrbixProjects._safeLocalSet === 'function')
            ? root.OrbixProjects._safeLocalSet.bind(root.OrbixProjects)
            : function (k, v) { localStorage.setItem(k, v); };
          try {
            saveFn('orbix_project_' + uId + '_' + self.activeProjectId, JSON.stringify(lightPlan));
            saveFn('orbix_working_project_draft', JSON.stringify({
              projectId: String(self.activeProjectId),
              userId: uId,
              timestamp: remotePlan._lastModified || Date.now(),
              plan: lightPlan,
              units: Array.isArray(remoteUnits) ? remoteUnits : []
            }));
          } catch (_) { }
        }

        // Re-render 2D canvas
        if (root.OrbixUI && root.OrbixUI.editor && typeof root.OrbixUI.editor.render === 'function') {
          root.OrbixUI.editor.render();
        }

        // Re-render 3D Studio
        if (root.OrbixUI && typeof root.OrbixUI.render3DHome === 'function') {
          root.OrbixUI.render3DHome(true);
        } else if (typeof root.buildScene === 'function') {
          root.buildScene();
        }

        // Re-render inspector if open
        if (root.OrbixUI && typeof root.OrbixUI.renderInspector === 'function' && root.OrbixUI.editor) {
          root.OrbixUI.renderInspector(root.OrbixUI.editor.selected || []);
        }

        // Update live status feedback
        var uCount = (remotePlan && remotePlan.plan && Array.isArray(remotePlan.plan.furniture))
          ? remotePlan.plan.furniture.length
          : (Array.isArray(remoteUnits) ? remoteUnits.length : 0);

        self.showLiveToast('⚡ Synced changes from second device (' + uCount + ' units)');
      } catch (err) {
        console.warn('[LiveSync] Failed to apply remote change:', err);
      } finally {
        setTimeout(function () {
          self.isApplyingRemoteChange = false;
        }, 150);
      }
    },

    updatePresenceUI: function (count) {
      var el = document.getElementById('liveSyncPresencePill');
      var txt = document.getElementById('liveSyncPresenceText');
      if (!el || !txt) return;

      var n = count !== undefined ? count : this.peerCount;
      if (n > 1) {
        el.style.display = 'inline-flex';
        txt.textContent = n + ' devices live';
        el.title = n + ' screens/devices currently collaborating on this project simultaneously';
      } else if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        el.style.display = 'inline-flex';
        txt.textContent = 'Live Sync Ready';
        el.title = 'Real-time WebSocket sync connected and ready';
      } else {
        el.style.display = 'none';
      }
    },

    showLiveToast: function (text) {
      if (typeof window !== 'undefined' && window.OrbixUI && typeof window.OrbixUI.showToast === 'function') {
        window.OrbixUI.showToast(text, 'info');
      } else if (typeof window.toast === 'function') {
        window.toast(text);
      }
    }
  };

  root.OrbixLiveSync = OrbixLiveSync;

  // Auto-initialize once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { OrbixLiveSync.init(); });
  } else {
    OrbixLiveSync.init();
  }
})(typeof window !== 'undefined' ? window : this);

