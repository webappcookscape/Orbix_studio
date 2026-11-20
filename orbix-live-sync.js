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
      self.activeProjectId = String(projectId);

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

    broadcastChange: function (action) {
      var self = this;
      if (self.isApplyingRemoteChange) return; // Don't echo back changes received from peer!
      if (root.OrbixUI && root.OrbixUI._isProjectLoading) return; // Do not broadcast intermediate states while loading a project!

      if (!self.activeProjectId) {
        if (root.OrbixProjects && root.OrbixProjects.activeProjectId) {
          self.activeProjectId = String(root.OrbixProjects.activeProjectId);
        }
      }
      if (!self.activeProjectId) return;
      if (!self.socket || self.socket.readyState !== WebSocket.OPEN) return;

      clearTimeout(self.broadcastDebounceTimer);
      self.broadcastDebounceTimer = setTimeout(function () {
        if (root.OrbixUI && root.OrbixUI._isProjectLoading) return;

        var currentPlan = (root.OrbixUI && root.OrbixUI.project) ? root.OrbixUI.project : null;
        var currentUnits = (root.S && Array.isArray(root.S.units)) ? root.S.units : [];
        if (!currentPlan && !currentUnits) return;

        // If currentUnits is empty but currentPlan has furniture, sync first to avoid broadcasting 0 units
        var fCount = (currentPlan && currentPlan.plan && Array.isArray(currentPlan.plan.furniture))
          ? currentPlan.plan.furniture.length : 0;
        if (fCount > 0 && currentUnits.length === 0 && root.OrbixUI && typeof root.OrbixUI.syncProjectUnitsTo3DStudio === 'function') {
          try { root.OrbixUI.syncProjectUnitsTo3DStudio(); } catch (_) { }
          currentUnits = (root.S && Array.isArray(root.S.units)) ? root.S.units : [];
        }

        try {
          self.socket.send(JSON.stringify({
            type: 'project_change',
            projectId: self.activeProjectId,
            clientId: self.clientId,
            action: action || 'plan_change',
            plan: currentPlan,
            units: currentUnits,
            timestamp: Date.now()
          }));
        } catch (e) {
          console.warn('[LiveSync] Broadcast error:', e);
        }
      }, 100);
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

        var localFurnCount = 0;
        if (root.OrbixUI && root.OrbixUI.project && root.OrbixUI.project.plan && Array.isArray(root.OrbixUI.project.plan.furniture)) {
          localFurnCount = root.OrbixUI.project.plan.furniture.length;
        } else if (root.S && Array.isArray(root.S.units)) {
          localFurnCount = root.S.units.length;
        }

        var remoteFurnCount = 0;
        if (remotePlan && remotePlan.plan && Array.isArray(remotePlan.plan.furniture)) {
          remoteFurnCount = remotePlan.plan.furniture.length;
        } else if (Array.isArray(remoteUnits)) {
          remoteFurnCount = remoteUnits.length;
        }

        var isDel = msg.action === 'clear_all' || msg.action === 'delete_selected' || msg.action === 'delete_furniture';
        // GUARD: If incoming remote has 0 units, but local project has active units, and action was NOT deliberate deletion,
        // do not wipe local units!
        if (remoteFurnCount === 0 && localFurnCount > 0 && !isDel) {
          console.warn('[LiveSync] Discarded empty remote change to protect active units.');
          self.isApplyingRemoteChange = false;
          return;
        }

        if (remotePlan && root.OrbixUI) {
          root.OrbixUI.project = remotePlan;
          if (root.OrbixUI.editor) {
            root.OrbixUI.editor.project = remotePlan;
          }
        }

        if (Array.isArray(remoteUnits) && root.S && (remoteUnits.length > 0 || isDel)) {
          root.S.units = remoteUnits;
        }

        // Save in-memory update to local cache so page refresh retains latest remote work
        if (root.OrbixProjects && self.activeProjectId) {
          var uId = root.OrbixProjects.currentUser ? root.OrbixProjects.currentUser.id : 'anon';
          try {
            if (remotePlan) {
              localStorage.setItem('orbix_project_' + uId + '_' + self.activeProjectId, JSON.stringify(remotePlan));
              localStorage.setItem('orbix_working_project_draft', JSON.stringify({
                projectId: self.activeProjectId,
                plan: remotePlan,
                savedAt: Date.now()
              }));
            }
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

