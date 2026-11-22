/* ═══════════════════════════════════════════════════════════════════════════════
   ORBIX STUDIO — UI Integration, Plan Controller & BOQ Quotation Manager
   ═══════════════════════════════════════════════════════════════════════════════ */

(function (root) {
  'use strict';

  var Core = root.OrbixCore;
  var PlanEditor = root.OrbixPlan;

  var toValidHexColor = (Core && Core.toValidHexColor) || function (val, fallback) {
    var fb = (typeof fallback === 'string' && /^#[0-9a-fA-F]{6}$/.test(fallback)) ? fallback : '#edebe4';
    if (!val || typeof val !== 'string') return fb;
    var str = val.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(str)) return str;
    if (/^#[0-9a-fA-F]{3}$/.test(str)) {
      return '#' + str[1] + str[1] + str[2] + str[2] + str[3] + str[3];
    }
    if (/^[0-9a-fA-F]{6}$/.test(str)) return '#' + str;

    var lower = str.toLowerCase();
    if (lower.indexOf('1135') !== -1 || lower.indexOf('white') !== -1 || lower.indexOf('frost') !== -1) return '#edebe4';
    if (lower.indexOf('3410') !== -1 || lower.indexOf('walnut') !== -1) return '#6e4e35';
    if (lower.indexOf('3411') !== -1 || lower.indexOf('wenge') !== -1) return '#4a3a2e';
    if (lower.indexOf('1101') !== -1 || lower.indexOf('ivory') !== -1 || lower.indexOf('cream') !== -1) return '#e4dcc8';
    if (lower.indexOf('2204') !== -1 || lower.indexOf('oak') !== -1) return '#c4a173';
    if (lower.indexOf('2210') !== -1 || lower.indexOf('teak') !== -1) return '#a9743f';
    if (lower.indexOf('4402') !== -1 || lower.indexOf('grey oak') !== -1) return '#9c9891';
    if (lower.indexOf('5501') !== -1 || lower.indexOf('graphite') !== -1) return '#585b5e';
    if (lower.indexOf('6601') !== -1 || lower.indexOf('gloss white') !== -1) return '#f4f3ef';
    if (lower.indexOf('6620') !== -1 || lower.indexOf('gloss grey') !== -1) return '#8d9296';
    if (lower.indexOf('6630') !== -1 || lower.indexOf('gloss red') !== -1 || lower.indexOf('red') !== -1) return '#b2231f';
    if (lower.indexOf('6640') !== -1 || lower.indexOf('gloss black') !== -1 || lower === 'black') return '#1c1c1e';
    if (lower.indexOf('7701') !== -1 || lower.indexOf('sage') !== -1) return '#8e9c86';
    if (lower.indexOf('7702') !== -1 || lower.indexOf('charcoal') !== -1) return '#3b3d40';
    if (lower.indexOf('7703') !== -1 || lower.indexOf('sand') !== -1 || lower.indexOf('beige') !== -1) return '#d3c4a9';
    if (lower.indexOf('7704') !== -1 || lower.indexOf('taupe') !== -1) return '#9a9188';
    if (lower.indexOf('7706') !== -1 || lower.indexOf('coffee') !== -1 || lower.indexOf('brown') !== -1) return '#5a4232';
    if (lower.indexOf('7707') !== -1 || lower.indexOf('navy') !== -1 || lower.indexOf('blue') !== -1) return '#2e3f5c';
    if (lower.indexOf('7708') !== -1 || lower.indexOf('terracotta') !== -1) return '#b5654a';
    if (lower.indexOf('7709') !== -1 || lower.indexOf('olive') !== -1) return '#6b6e45';
    if (lower.indexOf('8801') !== -1 || lower.indexOf('concrete') !== -1) return '#a8a5a0';
    if (lower.indexOf('7710') !== -1 || lower.indexOf('powder') !== -1) return '#a9bed2';
    if (lower.indexOf('7711') !== -1 || lower.indexOf('blush') !== -1) return '#d9b4a6';
    if (lower.indexOf('grey') !== -1 || lower.indexOf('gray') !== -1) return '#8d9296';
    if (lower.indexOf('green') !== -1) return '#7a8875';

    return fb;
  };

  // IndexedDB Persistence for Blueprint Underlays (avoids LocalStorage 5MB quota)
  var OrbixUnderlayDB = (function () {
    var DB_NAME = 'orbix_underlays_db';
    var STORE_NAME = 'underlays';
    var dbPromise = null;

    function getDB() {
      if (dbPromise) return dbPromise;
      if (typeof indexedDB === 'undefined') return Promise.resolve(null);
      dbPromise = new Promise(function (resolve) {
        try {
          var req = indexedDB.open(DB_NAME, 1);
          req.onupgradeneeded = function (e) {
            var db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
              db.createObjectStore(STORE_NAME, { keyPath: 'projectId' });
            }
          };
          req.onsuccess = function (e) { resolve(e.target.result); };
          req.onerror = function () { resolve(null); };
        } catch (_) { resolve(null); }
      });
      return dbPromise;
    }

    return {
      save: function (projectId, underlayData) {
        if (!projectId || !underlayData) return;
        getDB().then(function (db) {
          if (!db) return;
          try {
            var tx = db.transaction([STORE_NAME], 'readwrite');
            var store = tx.objectStore(STORE_NAME);
            store.put({ projectId: String(projectId), data: underlayData, timestamp: Date.now() });
          } catch (_) {}
        });
      },
      get: function (projectId, callback) {
        if (!projectId) { if (callback) callback(null); return; }
        getDB().then(function (db) {
          if (!db) { if (callback) callback(null); return; }
          try {
            var tx = db.transaction([STORE_NAME], 'readonly');
            var store = tx.objectStore(STORE_NAME);
            var req = store.get(String(projectId));
            req.onsuccess = function () {
              var res = req.result ? req.result.data : null;
              if (callback) callback(res);
            };
            req.onerror = function () { if (callback) callback(null); };
          } catch (_) { if (callback) callback(null); }
        });
      },
      remove: function (projectId) {
        if (!projectId) return;
        getDB().then(function (db) {
          if (!db) return;
          try {
            var tx = db.transaction([STORE_NAME], 'readwrite');
            var store = tx.objectStore(STORE_NAME);
            store.delete(String(projectId));
          } catch (_) {}
        });
      }
    };
  })();
  if (typeof window !== 'undefined') window.OrbixUnderlayDB = OrbixUnderlayDB;

  var OrbixUI = {
    editor: null,
    project: null,
    toValidHexColor: toValidHexColor,

    formatDisplayDate: function (dStr, includeTime) {
      if (!dStr) return '';
      if (/^\d{2}[-/]\d{2}[-/]\d{4}/.test(dStr)) return dStr;
      var d = new Date(dStr);
      if (isNaN(d.getTime())) return dStr;
      var day = ('0' + d.getDate()).slice(-2);
      var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      var month = months[d.getMonth()];
      var year = d.getFullYear();
      if (includeTime) {
        var hours = ('0' + d.getHours()).slice(-2);
        var mins = ('0' + d.getMinutes()).slice(-2);
        return day + '-' + month + '-' + year + ' ' + hours + ':' + mins;
      }
      return day + '-' + month + '-' + year;
    },

    init: function () {
      var planContainer = document.getElementById('planCanvasContainer');
      if (!planContainer) return;

      // Restore from local draft immediately if available so units are NEVER lost on refresh or offline
      var restored = false;
      try {
        var draftRaw = localStorage.getItem('orbix_working_project_draft');
        if (draftRaw) {
          var draftObj = JSON.parse(draftRaw);
          var draftPlan = draftObj.plan || draftObj;
          if (draftPlan && (draftPlan.plan || draftPlan.walls || draftPlan.furniture || draftPlan.meta)) {
            if (draftObj.projectId && !draftPlan._projectId) {
              draftPlan._projectId = String(draftObj.projectId);
            }
            this.project = draftPlan;
            restored = true;
            if (draftObj.units && window.S) {
              window.S.units = draftObj.units;
            }
          }
        }
        if (!restored) {
          var activeId = localStorage.getItem('orbix_active_proj_default') || localStorage.getItem('orbix_active_proj_anon');
          if (!activeId) {
            for (var k = 0; k < localStorage.length; k++) {
              var key = localStorage.key(k);
              if (key && key.indexOf('orbix_active_proj_') === 0) {
                activeId = localStorage.getItem(key);
                break;
              }
            }
          }
          if (activeId) {
            for (var k2 = 0; k2 < localStorage.length; k2++) {
              var key2 = localStorage.key(k2);
              if (key2 && key2.indexOf('orbix_project_') === 0 && key2.indexOf('_' + activeId) !== -1) {
                var pRaw = localStorage.getItem(key2);
                if (pRaw) {
                  this.project = JSON.parse(pRaw);
                  restored = true;
                  break;
                }
              }
            }
          }
        }
      } catch (e) {
        console.warn('Failed restoring local project draft on init:', e);
      }
      if (!restored || !this.project) {
        this.project = Core.createProject('Untitled Project');
      } else {
        // Sanitize and detect clean room boundaries for restored working project
        if (typeof Core !== 'undefined' && typeof Core.detectRooms === 'function') {
          try { Core.detectRooms(this.project); } catch (e) { console.warn('[Orbix UI] detectRooms on init:', e); }
        }
      }

      var self = this;
      this.editor = new PlanEditor(planContainer, {
        project: this.project,
        onProjectChange: function (proj, changeContext) {
          self.project = proj;
          if (self._isProjectLoading) return;
          if (root.OrbixProjects) {
            root.OrbixProjects._isAwaitingHydration = false;
            if (typeof root.OrbixProjects.markProjectDirty === 'function') {
              root.OrbixProjects.markProjectDirty();
            }
          }
          var actionName = (changeContext && typeof changeContext === 'object')
            ? (changeContext.actionName || 'project_change')
            : (typeof changeContext === 'string' ? changeContext : 'project_change');
          self.queueAutoSave(undefined, actionName);
          if (typeof window !== 'undefined' && window.OrbixLiveSync && typeof window.OrbixLiveSync.broadcastChange === 'function') {
            window.OrbixLiveSync.broadcastChange(actionName);
          }
          self.updateUI();

          // Lazy BOQ: only compute & build quotation table if BOQ view is currently visible
          var isBoqActive = document.getElementById('view-boq') && document.getElementById('view-boq').classList.contains('is-on');
          if (isBoqActive) {
            self.renderBOQ();
            self._boqDirty = false;
          } else {
            self._boqDirty = true;
          }

          if (self.syncProjectUnitsTo3DStudio) self.syncProjectUnitsTo3DStudio();

          // Lazy / Incremental 3D: only update if 3D Studio is currently visible
          var isDesignActive = document.getElementById('view-design') && document.getElementById('view-design').classList.contains('is-on');
          if (isDesignActive) {
            var targetFurn = changeContext && changeContext.targetFurn;
            if (targetFurn && self.archRenderer && self.archRenderer.group && typeof self.archRenderer.addOrUpdateFurnitureMesh === 'function') {
              self.archRenderer.addOrUpdateFurnitureMesh(targetFurn);
            } else if (self.render3DHome) {
              self.render3DHome(true);
            }
            self._3dDirty = false;
          } else {
            self._3dDirty = true;
          }
        },
        onSelectionChange: function (selected) {
          self.renderInspector(selected);
        },
        onCalibrateRequest: function (pixelDist, worldDist) {
          self.openCalibrateModal(pixelDist, worldDist);
        }
      });

      this.bindToolbar();
      this.initFloorSwitcher();
      this.updateFloorSwitcherUI();
      this.updateUI();
      this.renderBOQ();
      this.restoreUnderlay(this.project);
      this.initGlobalShortcuts();

      window.addEventListener('beforeunload', function () {
        if (root.OrbixProjects && typeof root.OrbixProjects.flushImmediateSave === 'function') {
          root.OrbixProjects.flushImmediateSave();
        } else if (self.flushAutoSave) {
          self.flushAutoSave();
        }
      });
    },

    initGlobalShortcuts: function () {
      var self = this;
      if (this._globalShortcutsInitialized) return;
      this._globalShortcutsInitialized = true;

      window.addEventListener('keydown', function (e) {
        var tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target && e.target.isContentEditable)) return;

        // Elevation Tier Shortcuts: Alt + F (Floor), Alt + W (Wall), Alt + L (Loft), Alt + A (All) & Hard Refresh: Alt + R
        if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
          var k = e.key.toLowerCase();
          if (k === 'r') {
            e.preventDefault();
            if (typeof self.hardRefresh3D === 'function') {
              self.hardRefresh3D();
            }
            return;
          }
          if (k === 'f') {
            e.preventDefault();
            if (self.editor && typeof self.editor.setUnitTierFilter === 'function') {
              self.editor.setUnitTierFilter('floor');
            }
            if (typeof window.toast === 'function') {
              window.toast('Tier Filter: Floor Units (Alt+F)');
            }
            return;
          }
          if (k === 'w') {
            e.preventDefault();
            if (self.editor && typeof self.editor.setUnitTierFilter === 'function') {
              self.editor.setUnitTierFilter('wall');
            }
            if (typeof window.toast === 'function') {
              window.toast('Tier Filter: Wall Units (Alt+W)');
            }
            return;
          }
          if (k === 'l') {
            e.preventDefault();
            if (self.editor && typeof self.editor.setUnitTierFilter === 'function') {
              self.editor.setUnitTierFilter('loft');
            }
            if (typeof window.toast === 'function') {
              window.toast('Tier Filter: Loft Units (Alt+L)');
            }
            return;
          }
          if (k === 'a') {
            e.preventDefault();
            if (self.editor && typeof self.editor.setUnitTierFilter === 'function') {
              self.editor.setUnitTierFilter('all');
            }
            if (typeof window.toast === 'function') {
              window.toast('Tier Filter: All Units (Alt+A)');
            }
            return;
          }
        }

        // Ctrl + F / Cmd + F shortcut -> open Furnish toolbar!
        if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'f' || e.key === 'F' || e.code === 'KeyF')) {
          e.preventDefault();
          if (typeof window.toggleFurnishMenu === 'function') {
            var viewPlan = document.getElementById('view-plan');
            if (viewPlan && !viewPlan.classList.contains('is-on')) {
              if (window.OrbixRouter && typeof window.OrbixRouter.navigateTo === 'function') {
                window.OrbixRouter.navigateTo('plan', false);
              } else if (typeof window.setView === 'function') {
                window.setView('plan');
              }
            }
            window.toggleFurnishMenu();
            if (typeof window.toast === 'function') {
              window.toast('🪑 Furnish Toolbar (Ctrl+F)');
            }
          }
          return;
        }

        // Spacebar or R / r to rotate active unit in 3D Studio (in 2D Plan view, PlanEditor owns rotation)
        if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.code === 'Space' || e.key === ' ' || e.key === 'r' || e.key === 'R')) {
          if (e.repeat || e._orbixRotated) {
            e.preventDefault();
            return;
          }
          var viewPlan = document.getElementById('view-plan');
          if (viewPlan && viewPlan.classList.contains('is-on')) {
            // Plan view rotation is handled by PlanEditor listener; avoid double rotation!
            return;
          }
          var didRotate = self.rotateActiveUnit();
          if (didRotate) {
            e._orbixRotated = true;
            e.preventDefault();
            if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
            return;
          }
          if ((e.key === 'r' || e.key === 'R') && !e.repeat) {
            if (typeof window !== 'undefined' && window.OrbixRouter && typeof window.OrbixRouter.navigateTo === 'function') {
              window.OrbixRouter.navigateTo('plan', false);
            } else if (typeof window !== 'undefined' && typeof window.setView === 'function') {
              window.setView('plan');
            }
            if (self.editor && typeof self.editor.setTool === 'function') {
              self.editor.setTool('divider');
            }
          }
        }
      });
    },

    rotateActiveUnit: function () {
      var self = this;
      var rotated = false;
      var plan = self.getPlan();
      var furnList = (plan && plan.furniture) || [];

      // 1. Check if 2D editor has an explicitly selected unit (highest priority)
      if (self.editor && self.editor.selected && self.editor.selected.length > 0) {
        for (var i = 0; i < self.editor.selected.length; i++) {
          var sel = self.editor.selected[i];
          if (sel.type === 'furniture') {
            var fn = furnList.find(function (f) { return f.id === sel.id; });
            if (fn) {
              fn.rotY = ((fn.rotY || 0) + Math.PI / 2) % (Math.PI * 2);
              rotated = true;
            }
          } else if (sel.type === 'stair') {
            var stObj = (plan.stairs || []).find(function (st) { return st.id === sel.id; });
            if (stObj) {
              stObj.rotY = ((stObj.rotY || 0) + Math.PI / 2) % (Math.PI * 2);
              rotated = true;
            }
          }
        }
      }

      // 2. Check if 3D Studio active unit is selected
      if (!rotated && window.S && window.S.units && window.S.active >= 0 && window.S.units[window.S.active]) {
        var activeU = window.S.units[window.S.active];
        var fMatch = furnList.find(function (f) {
          return (activeU._furnId && f.id === activeU._furnId) || (activeU.label && f.name === activeU.label);
        });
        if (fMatch) {
          fMatch.rotY = ((fMatch.rotY || 0) + Math.PI / 2) % (Math.PI * 2);
          if (self.editor) self.editor.selected = [{ type: 'furniture', id: fMatch.id }];
          rotated = true;
        }
      }

      if (rotated) {
        if (self.editor) {
          self.editor.pushHistory('Rotate Element');
          self.editor.render();
        }
        self.saveToLocalStorage();
        if (self.syncProjectUnitsTo3DStudio) self.syncProjectUnitsTo3DStudio();
        if (self.render3DHome) self.render3DHome(true);
        if (typeof buildScene === 'function') buildScene();
        if (self.editor && self.renderInspector) self.renderInspector(self.editor.selected);
        if (typeof window.toast === 'function') {
          window.toast('↻ Unit rotated 90° (Spacebar)');
        }
        return true;
      }

      // 3. If currently placing a new unit from catalog, rotate preview
      if (self.editor && self.editor.activeTool === 'furniture' && self.editor.furniturePreset) {
        self.editor.furnitureRotY = ((self.editor.furnitureRotY || 0) + Math.PI / 2) % (Math.PI * 2);
        self.editor.render();
        if (typeof window.toast === 'function') {
          window.toast('↻ Preview rotated 90° (Spacebar)');
        }
        return true;
      }
      if (self.editor && self.editor.activeTool === 'stair') {
        self.editor.stairRotY = ((self.editor.stairRotY || 0) + Math.PI / 2) % (Math.PI * 2);
        self.editor.render();
        if (typeof window.toast === 'function') {
          window.toast('↻ Stair preview rotated 90° (Spacebar)');
        }
        return true;
      }
      return false;
    },

    loadProject: function (proj, opts) {
      if (!proj) return;
      var self = this;
      var loadOpts = opts || {};
      this._isProjectLoading = true;
      try {
        var prevProjId = (this.project && (this.project._projectId || (this.project.meta && this.project.meta.id) || this.project.id)) || '';
        var nextProjId = proj._projectId || (proj.meta && proj.meta.id) || proj.id || '';
        if (nextProjId) proj._projectId = String(nextProjId);
        if (window.S && (!prevProjId || !nextProjId || String(prevProjId) !== String(nextProjId))) {
          window.S.units = [];
          window.S.active = 0;
        }
        this.project = proj;
        if (proj && proj.plan) {
          if (!proj.plan.floors || !proj.plan.floors.length) {
            proj.plan.floors = [
              { id: 'ground', name: 'Ground Floor', level: 0, elevation: 0, isDefault: true }
            ];
          }
          if (!proj.plan.activeFloor) {
            proj.plan.activeFloor = proj.plan.floors[0].id || 'ground';
          }
          if (!proj.plan.floorsData) {
            proj.plan.floorsData = {};
          }
          // Recovery guard: if active floor arrays are empty but floorsData[activeFloor] has walls/furniture, restore them!
          var curFloorData = proj.plan.floorsData[proj.plan.activeFloor];
          if (curFloorData && typeof curFloorData === 'object') {
            var topWalls = Array.isArray(proj.plan.walls) ? proj.plan.walls.length : 0;
            var topFurn = Array.isArray(proj.plan.furniture) ? proj.plan.furniture.length : 0;
            var fdWalls = Array.isArray(curFloorData.walls) ? curFloorData.walls.length : 0;
            var fdFurn = Array.isArray(curFloorData.furniture) ? curFloorData.furniture.length : 0;
            if ((topWalls === 0 && fdWalls > 0) || (topFurn === 0 && fdFurn > 0)) {
              if (topWalls === 0 && fdWalls > 0) proj.plan.walls = JSON.parse(JSON.stringify(curFloorData.walls));
              if (topFurn === 0 && fdFurn > 0) proj.plan.furniture = JSON.parse(JSON.stringify(curFloorData.furniture));
              if ((!proj.plan.openings || !proj.plan.openings.length) && Array.isArray(curFloorData.openings) && curFloorData.openings.length) {
                proj.plan.openings = JSON.parse(JSON.stringify(curFloorData.openings));
              }
              if ((!proj.plan.rooms || !proj.plan.rooms.length) && Array.isArray(curFloorData.rooms) && curFloorData.rooms.length) {
                proj.plan.rooms = JSON.parse(JSON.stringify(curFloorData.rooms));
              }
              if ((!proj.plan.stairs || !proj.plan.stairs.length) && Array.isArray(curFloorData.stairs) && curFloorData.stairs.length) {
                proj.plan.stairs = JSON.parse(JSON.stringify(curFloorData.stairs));
              }
            }
          }
          if (typeof this.updateFloorSwitcherUI === 'function') {
            this.updateFloorSwitcherUI();
          }
        }
        if (typeof Core !== 'undefined' && typeof Core.healCollinearWalls === 'function') {
          try { Core.healCollinearWalls(this.project); } catch (e) { }
        }
        if (typeof Core !== 'undefined' && typeof Core.detectRooms === 'function') {
          try { Core.detectRooms(this.project); } catch (e) { console.warn('[Orbix UI] detectRooms on load:', e); }
        }
        this.syncProjectUnitsTo3DStudio(); // Synchronize units FIRST so window.S.units reflects project
        // Only persist locally/remotely if this load is NOT a passive open/hydration read
        if (!loadOpts.skipLocalSave) {
          this.saveToLocalStorage({ preserveTimestamp: true });
        }
        if (!loadOpts.skipAutoSave && root.OrbixProjects && typeof root.OrbixProjects.saveActiveProject === 'function') {
          root.OrbixProjects.saveActiveProject({ plan: this.project, changeAction: loadOpts.changeAction || 'load_project', allowEmptyPlan: !!loadOpts.allowEmptyPlan });
        }
        if (this.editor) {
          this.editor.project = proj;
          this.editor.selected = [];
          this.editor.wallChainStart = null;
          this.editor.history = [];
          this.editor.historyIndex = -1;
          this.editor.pushHistory('Open Project');
          this.editor.resize();
          this.editor.render();
          if (typeof this.editor.zoomFit === 'function') {
            this.editor.zoomFit();
          }
          this.restoreUnderlay(proj);
        }
        this.updateUI();
        this.renderBOQ();
        if (typeof window.buildScene === 'function') window.buildScene();
        if (typeof this.render3DHome === 'function') this.render3DHome();
        if (typeof window.fit === 'function') window.fit();
        if (typeof window.camApply === 'function') window.camApply();
      } finally {
        setTimeout(function () {
          self._isProjectLoading = false;
        }, 350);
      }
    },

    createNewProject: function (title, clientName) {
      var fresh = Core.createProject(title || 'New Project');
      if (clientName && fresh.meta) fresh.meta.clientName = clientName;
      this.loadProject(fresh, { skipAutoSave: true });
      return fresh;
    },

    resetProject: function (title) {
      var fresh = Core.createProject(title || 'Untitled Project');
      this.loadProject(fresh, { changeAction: 'reset_project', allowEmptyPlan: true });
      return fresh;
    },

    queueAutoSave: function (delayMs, changeAction) {
      var self = this;
      if (this._isProjectLoading) return;
      if (changeAction) {
        self._pendingChangeAction = changeAction;
      }
      if (this._autoSaveTimer) {
        clearTimeout(this._autoSaveTimer);
      }
      this._autoSaveTimer = setTimeout(function () {
        self._autoSaveTimer = null;
        if (self._isProjectLoading) return;
        var act = self._pendingChangeAction || 'autosave';
        self._pendingChangeAction = null;
        self.saveToLocalStorage();
        if (root.OrbixProjects && typeof root.OrbixProjects.saveActiveProject === 'function') {
          var isDestructive = !!(typeof root.OrbixProjects._isExplicitDestructiveAction === 'function' && root.OrbixProjects._isExplicitDestructiveAction(act));
          root.OrbixProjects.saveActiveProject({
            plan: self.project,
            units: window.S ? window.S.units : [],
            changeAction: act,
            allowEmptyPlan: isDestructive
          });
        }
        if (typeof window !== 'undefined' && window.OrbixLiveSync && typeof window.OrbixLiveSync.broadcastChange === 'function') {
          window.OrbixLiveSync.broadcastChange(act);
        }
      }, delayMs !== undefined ? delayMs : 250);
    },

    flushAutoSave: function () {
      var act = this._pendingChangeAction || 'flush_autosave';
      this._pendingChangeAction = null;
      if (this._autoSaveTimer) {
        clearTimeout(this._autoSaveTimer);
        this._autoSaveTimer = null;
      }
      this.saveToLocalStorage();
      if (root.OrbixProjects && typeof root.OrbixProjects.flushImmediateSave === 'function') {
        root.OrbixProjects.flushImmediateSave();
      } else if (root.OrbixProjects && typeof root.OrbixProjects.saveActiveProject === 'function') {
        var isDestructive = !!(typeof root.OrbixProjects._isExplicitDestructiveAction === 'function' && root.OrbixProjects._isExplicitDestructiveAction(act));
        root.OrbixProjects.saveActiveProject({
          plan: this.project,
          units: window.S ? window.S.units : [],
          changeAction: act,
          allowEmptyPlan: isDestructive
        });
      }
    },

    saveToLocalStorage: function (opts) {
      if (!this.project) return;
      var saveOpts = opts || {};
      try {
        if (typeof this.syncActiveFloorData === 'function') {
          this.syncActiveFloorData();
        }
        var now = Date.now();
        if (!saveOpts.preserveTimestamp || !this.project._lastModified) {
          this.project._lastModified = now;
        }
        var currentUnits = (window.S && window.S.units) ? window.S.units : [];
        var activeId = (window.OrbixProjects && window.OrbixProjects.activeProjectId) ||
                       localStorage.getItem('orbix_active_project_id') ||
                       (this.project && this.project._projectId) ||
                       (this.project && this.project.meta && this.project.meta.id) ||
                       (this.project && this.project.id) || '';
        if (activeId && !this.project._projectId) {
          this.project._projectId = String(activeId);
        }
        var uId = (window.OrbixProjects && window.OrbixProjects.currentUser) ? window.OrbixProjects.currentUser.id : 'anon';

        // Strip large base64 underlay images before localStorage write (OrbixUnderlayDB IndexedDB already stores them)
        // so localStorage never silently fails with QuotaExceededError!
        var lightPlan = (window.OrbixProjects && typeof window.OrbixProjects._stripHeavyLocalData === 'function')
          ? window.OrbixProjects._stripHeavyLocalData(this.project)
          : this.project;
        var safeSet = (window.OrbixProjects && typeof window.OrbixProjects._safeLocalSet === 'function')
          ? window.OrbixProjects._safeLocalSet.bind(window.OrbixProjects)
          : function (k, v) { localStorage.setItem(k, v); };

        // 1. Synchronously persist full working draft (guarantees survival across hard refresh & network drop)
        safeSet('orbix_working_project_draft', JSON.stringify({
          projectId: activeId ? String(activeId) : '',
          userId: uId,
          timestamp: this.project._lastModified || now,
          plan: lightPlan,
          units: currentUnits
        }));

        // 2. Persist to active project key if ID is known
        if (activeId) {
          var key = 'orbix_project_' + uId + '_' + activeId;
          var serialized = (Core && typeof Core.serializeProject === 'function') ? Core.serializeProject(lightPlan) : JSON.stringify(lightPlan);
          safeSet(key, serialized);
          safeSet('orbix_active_proj_' + uId, String(activeId));
          safeSet('orbix_active_project_id', String(activeId));
        }
      } catch (e) {
        console.warn('[OrbixUI] saveToLocalStorage notice:', e && e.message ? e.message : e);
      }
    },

    persistUnderlay: function () {
      if (!this.editor || !this.editor.underlay) return;
      var u = this.editor.underlay;
      var pId = (this.project && (this.project.id || this.project._projectId || (this.project.meta && this.project.meta.id))) || '';
      var uData = null;
      if (u.img && (u.dataUrl || u.img.src)) {
        uData = {
          dataUrl: u.dataUrl || u.img.src,
          width: u.width || u.img.naturalWidth || 1000,
          height: u.height || u.img.naturalHeight || 1000,
          scale: u.scale || 10,
          x: u.x || 0,
          y: u.y || 0,
          visible: u.visible !== false,
          opacity: u.opacity !== undefined ? u.opacity : 0.45
        };
      }
      if (this.project && this.project.plan) {
        this.project.plan.underlay = uData;
      }
      if (this.editor && this.editor.project && this.editor.project.plan) {
        this.editor.project.plan.underlay = uData;
      }
      if (pId) {
        if (uData) {
          try {
            localStorage.setItem('orbix_underlay_' + pId, JSON.stringify(uData));
          } catch (_) {}
          if (window.OrbixUnderlayDB) {
            window.OrbixUnderlayDB.save(pId, uData);
          }
        } else {
          try {
            localStorage.removeItem('orbix_underlay_' + pId);
          } catch (_) {}
          if (window.OrbixUnderlayDB) {
            window.OrbixUnderlayDB.remove(pId);
          }
        }
      }
      if (typeof this.queueAutoSave === 'function') {
        this.queueAutoSave();
      }
    },

    restoreUnderlay: function (proj) {
      var self = this;
      if (!self.editor) return;
      proj = proj || self.project;
      if (!proj) return;
      var pId = proj.id || proj._projectId || (proj.meta && proj.meta.id) || '';

      function applyUnderlayData(uData) {
        if (!uData || (!uData.dataUrl && !uData.imgSrc)) {
          self.editor.underlay = { img: null, calibPoints: [] };
          var ctrl = document.getElementById('planUnderlayControls');
          if (ctrl) ctrl.style.display = 'none';
          self.editor.render();
          return;
        }
        var src = uData.dataUrl || uData.imgSrc;
        var img = new Image();
        img.onload = function () {
          self.editor.underlay = {
            img: img,
            dataUrl: src,
            width: uData.width || img.naturalWidth,
            height: uData.height || img.naturalHeight,
            scale: uData.scale || 10,
            x: uData.x || 0,
            y: uData.y || 0,
            visible: uData.visible !== false,
            opacity: uData.opacity !== undefined ? uData.opacity : 0.45,
            calibPoints: []
          };
          var controls = document.getElementById('planUnderlayControls');
          if (controls) controls.style.display = 'inline-flex';
          var opSlider = document.getElementById('planUnderlayOpacity');
          if (opSlider) opSlider.value = String(self.editor.underlay.opacity);
          var btnToggle = document.getElementById('planToggleUnderlayBtn');
          if (btnToggle) btnToggle.textContent = self.editor.underlay.visible ? '👁 Show' : '👁‍🗨 Hide';
          self.editor.render();
        };
        img.src = src;
      }

      // 1. Check in-project plan underlay
      var uPlan = proj.plan && proj.plan.underlay;
      if (uPlan && (uPlan.dataUrl || uPlan.imgSrc)) {
        applyUnderlayData(uPlan);
        return;
      }

      // 2. Check localStorage cached underlay
      if (pId) {
        try {
          var cached = localStorage.getItem('orbix_underlay_' + pId);
          if (cached) {
            var parsed = JSON.parse(cached);
            if (parsed && (parsed.dataUrl || parsed.imgSrc)) {
              if (proj.plan) proj.plan.underlay = parsed;
              applyUnderlayData(parsed);
              return;
            }
          }
        } catch (_) {}

        // 3. Check IndexedDB fallback (handles 10MB+ images without quota limit)
        if (window.OrbixUnderlayDB) {
          window.OrbixUnderlayDB.get(pId, function (dbData) {
            if (dbData && (dbData.dataUrl || dbData.imgSrc)) {
              if (proj.plan) proj.plan.underlay = dbData;
              applyUnderlayData(dbData);
            }
          });
        }
      }
    },

    bindToolbar: function () {
      var self = this;

      // Tool buttons (excluding #planFurnitureBtn which toggles the Furnish Drawer without arming tool)
      var toolBtns = document.querySelectorAll('.plan-tool-btn:not(#planFurnitureBtn)');
      toolBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          toolBtns.forEach(function (b) { b.classList.remove('is-active'); });
          btn.classList.add('is-active');
          var tool = btn.dataset.tool;
          if (typeof self.editor.setTool === 'function') {
            self.editor.setTool(tool);
          } else {
            self.editor.activeTool = tool;
            if (tool !== 'wall' && tool !== 'divider') self.editor.wallChainStart = null;
          }
          self.editor.render();
        });
      });

      // Actions
      var btnUndo = document.getElementById('planUndo');
      if (btnUndo) btnUndo.addEventListener('click', function () { self.editor.undo(); });

      var btnRedo = document.getElementById('planRedo');
      if (btnRedo) btnRedo.addEventListener('click', function () { self.editor.redo(); });

      var btnDelete = document.getElementById('planDelete');
      if (btnDelete) btnDelete.addEventListener('click', function () { self.editor.deleteSelected(); });

      var btnZoomIn = document.getElementById('planZoomIn');
      var floatZoomIn = document.getElementById('floatPlanZoomIn');
      function doZoomIn() { if (self.editor && self.editor.zoomIn) self.editor.zoomIn(); }
      if (btnZoomIn) btnZoomIn.addEventListener('click', doZoomIn);
      if (floatZoomIn) floatZoomIn.addEventListener('click', doZoomIn);

      var btnZoomOut = document.getElementById('planZoomOut');
      var floatZoomOut = document.getElementById('floatPlanZoomOut');
      function doZoomOut() { if (self.editor && self.editor.zoomOut) self.editor.zoomOut(); }
      if (btnZoomOut) btnZoomOut.addEventListener('click', doZoomOut);
      if (floatZoomOut) floatZoomOut.addEventListener('click', doZoomOut);

      var btnZoomFit = document.getElementById('planZoomFit');
      var floatZoomFit = document.getElementById('floatPlanZoomFit');
      function doZoomFit() { if (self.editor && self.editor.zoomFit) self.editor.zoomFit(); }
      if (btnZoomFit) btnZoomFit.addEventListener('click', doZoomFit);
      if (floatZoomFit) floatZoomFit.addEventListener('click', doZoomFit);

      var btnPanTool = document.getElementById('planPanToolBtn');
      var floatPan = document.getElementById('floatPlanPan');
      function doTogglePan() {
        if (!self.editor) return;
        var nextTool = (self.editor.activeTool === 'pan') ? 'select' : 'pan';
        self.editor.setTool(nextTool);
        if (floatPan) floatPan.classList.toggle('is-active', nextTool === 'pan');
        if (btnPanTool) btnPanTool.classList.toggle('is-active', nextTool === 'pan');
      }
      if (btnPanTool) btnPanTool.addEventListener('click', doTogglePan);
      if (floatPan) floatPan.addEventListener('click', doTogglePan);

      var btnDownload2D = document.getElementById('planDownload2DPlanBtn');
      if (btnDownload2D) {
        btnDownload2D.addEventListener('click', function () {
          if (self.editor && typeof self.editor.exportDetailed2DPlan === 'function') {
            self.editor.exportDetailed2DPlan();
          }
        });
      }

      var btnOpenAIDecor = document.getElementById('openAIDecorBtn');
      if (btnOpenAIDecor) {
        btnOpenAIDecor.addEventListener('click', function () {
          self.openAIDecorModal();
        });
      }

      var btnOpenAIDecor3D = document.getElementById('openAIDecor3DBtn');
      if (btnOpenAIDecor3D) {
        btnOpenAIDecor3D.addEventListener('click', function () {
          self.openAIDecorModal();
        });
      }

      var btnClear = document.getElementById('planClear');
      if (btnClear) {
        btnClear.addEventListener('click', function () {
          if (confirm('Are you sure you want to clear the entire floor plan?')) {
            self.project.plan.walls = [];
            self.project.plan.openings = [];
            self.project.plan.rooms = [];
            self.project.plan.furniture = [];
            self.editor.selected = [];
            self.editor.wallChainStart = null;
            self.editor.pushHistory('Clear Plan');
            self.editor.render();
          }
        });
      }

      var btnSample = document.getElementById('planSampleHome');
      if (btnSample) {
        btnSample.addEventListener('click', function () {
          if (confirm('Load sample 2BHK apartment floor plan? This will replace current unsaved walls.')) {
            self.loadSampleHome();
          }
        });
      }

      var btnPlace3D = document.getElementById('placeUnit3DBtn');
      if (btnPlace3D) {
        btnPlace3D.addEventListener('click', function () {
          self.openPlaceUnitModal3D();
        });
      }

      var handleExportSkp = function () {
        self.exportSketchUp();
      };
      var btnExportSkp = document.getElementById('exportSkpBtn');
      if (btnExportSkp) {
        btnExportSkp.addEventListener('click', handleExportSkp);
      }
      var btnExportSkpTop = document.getElementById('exportSkpTopBtn');
      if (btnExportSkpTop) {
        btnExportSkpTop.addEventListener('click', handleExportSkp);
      }

      // 3D Floor Finish Switcher buttons
      var floorGroup = document.getElementById('floorFinishGroup');
      if (floorGroup) {
        var floorBtns = floorGroup.querySelectorAll('button[data-floor]');
        floorBtns.forEach(function (btn) {
          btn.addEventListener('click', function () {
            var floorType = btn.getAttribute('data-floor');
            floorBtns.forEach(function (b) { b.classList.remove('is-on'); });
            btn.classList.add('is-on');

            var proj = self.project || (self.editor && self.editor.project);
            if (proj && proj.plan && proj.plan.rooms) {
              if (self.currentIsolatedRoomId) {
                var rMatch = proj.plan.rooms.find(function (r) { return r.id === self.currentIsolatedRoomId; });
                if (rMatch) rMatch.floorFinish = floorType;
              } else {
                proj.plan.rooms.forEach(function (r) {
                  r.floorFinish = floorType;
                });
              }
            }

            if (self.archRenderer && typeof self.archRenderer.setFloorMaterial === 'function') {
              self.archRenderer.setFloorMaterial(floorType, self.currentIsolatedRoomId);
            }
            if (window.__cc && window.__cc.gl && typeof window.__cc.gl.setFloorMaterial === 'function') {
              window.__cc.gl.setFloorMaterial(floorType);
            }
            if (typeof self.render3DHome === 'function') {
              self.render3DHome(true);
            }
            if (typeof self.saveToLocalStorage === 'function') {
              self.saveToLocalStorage();
            }
            if (typeof window.toast === 'function') {
              window.toast('Floor Finish: ' + (btn.title || floorType));
            }
          });
        });
      }

      // 3D Dado Tile Option Toggle (Backsplash wall tiling)
      var dadoBtn = document.getElementById('toggleDadoTileBtn');
      var dadoStatus = document.getElementById('dadoTileStatus');
      if (dadoBtn) {
        if (window.dadoTileEnabled === undefined) window.dadoTileEnabled = true;
        dadoBtn.addEventListener('click', function () {
          window.dadoTileEnabled = !window.dadoTileEnabled;
          if (dadoStatus) dadoStatus.textContent = window.dadoTileEnabled ? 'ON' : 'OFF';
          dadoBtn.classList.toggle('is-on', window.dadoTileEnabled);
          dadoBtn.style.background = window.dadoTileEnabled ? '#059669' : '#f1f5f9';
          dadoBtn.style.color = window.dadoTileEnabled ? '#ffffff' : '#334155';
          dadoBtn.style.borderColor = window.dadoTileEnabled ? '#047857' : '#cbd5e1';

          if (self.archRenderer) {
            self.archRenderer.dadoTileEnabled = window.dadoTileEnabled;
          }
          if (typeof self.render3DHome === 'function') {
            self.render3DHome(true);
          }
          if (typeof window.toast === 'function') {
            window.toast(window.dadoTileEnabled ? '🧱 Dado Tiles Enabled (Backsplash ON)' : '🧱 Dado Tiles Disabled (Backsplash OFF)');
          }
        });
      }

      // 3D Architectural Ceiling Toggle (ON / OFF)
      var ceilBtn = document.getElementById('toggleCeilingBtn');
      var ceilStatus = document.getElementById('ceilingStatus');
      if (ceilBtn) {
        if (window.ceilingEnabled === undefined) window.ceilingEnabled = false;
        var syncCeilBtn = function () {
          if (ceilStatus) ceilStatus.textContent = window.ceilingEnabled ? 'ON' : 'OFF';
          ceilBtn.classList.toggle('is-on', !!window.ceilingEnabled);
          ceilBtn.style.background = window.ceilingEnabled ? '#059669' : '#f1f5f9';
          ceilBtn.style.color = window.ceilingEnabled ? '#ffffff' : '#334155';
          ceilBtn.style.borderColor = window.ceilingEnabled ? '#047857' : '#cbd5e1';
        };
        syncCeilBtn();
        ceilBtn.addEventListener('click', function () {
          window.ceilingEnabled = !window.ceilingEnabled;
          syncCeilBtn();
          if (self.archRenderer) {
            self.archRenderer.ceilingEnabled = window.ceilingEnabled;
          }
          if (typeof self.render3DHome === 'function') {
            self.render3DHome(true);
          }
          if (typeof window.toast === 'function') {
            window.toast(window.ceilingEnabled ? '🏠 Ceiling Enabled (ON)' : '🏠 Ceiling Disabled (OFF)');
          }
        });
      }

      var dadoStyleSel = document.getElementById('dadoTileStyleSelect');
      if (dadoStyleSel) {
        if (!window.dadoTileStyle) window.dadoTileStyle = 'dado_1';
        dadoStyleSel.value = window.dadoTileStyle;
        dadoStyleSel.addEventListener('change', function () {
          window.dadoTileStyle = dadoStyleSel.value;
          if (self.archRenderer) {
            self.archRenderer.dadoTileStyle = window.dadoTileStyle;
          }
          if (typeof self.render3DHome === 'function') {
            self.render3DHome(true);
          }
          if (typeof window.toast === 'function') {
            var optName = dadoStyleSel.options[dadoStyleSel.selectedIndex].text;
            window.toast('🧱 Dado Tile Pattern: ' + optName);
          }
        });
      }

      // 3D Studio Room Selector
      var studioRoomSel = document.getElementById('studioRoomSelect');
      if (studioRoomSel) {
        studioRoomSel.addEventListener('change', function () {
          var roomId = studioRoomSel.value;
          self.render3DHome(false, roomId);
          if (typeof window.toast === 'function') {
            var selOpt = studioRoomSel.options[studioRoomSel.selectedIndex];
            window.toast('3D Studio: Viewing ' + (selOpt ? selOpt.textContent : roomId));
          }
        });
      }

      // Sunlight & Spotlight intensity sliders
      var sunSlider = document.getElementById('sunlightSlider');
      var sunLabel = document.getElementById('sunlightValLabel');
      if (sunSlider) {
        sunSlider.addEventListener('input', function () {
          var v = parseFloat(sunSlider.value);
          if (sunLabel) sunLabel.textContent = v.toFixed(1);
          window.sunlightIntensity = v;
          var gl = window.GL || (window.__cc && window.__cc.gl);
          if (gl && gl.setSunlightIntensity) gl.setSunlightIntensity(v);
          else if (typeof window.setSunlightIntensity === 'function') window.setSunlightIntensity(v);
        });
      }
      var spotSlider = document.getElementById('spotlightSlider');
      var spotLabel = document.getElementById('spotlightValLabel');
      if (spotSlider) {
        spotSlider.addEventListener('input', function () {
          var v = parseFloat(spotSlider.value);
          if (spotLabel) spotLabel.textContent = v.toFixed(1);
          window.spotlightIntensity = v;
          var gl = window.GL || (window.__cc && window.__cc.gl);
          if (gl && gl.setSpotlightIntensity) gl.setSpotlightIntensity(v);
          else if (typeof window.setSpotlightIntensity === 'function') window.setSpotlightIntensity(v);
        });
      }

      // 3D Studio Photorealistic HD Render Button & Mode Selector
      var photoRenderBtn = document.getElementById('photoRenderBtn');
      var photoRenderMenu = document.getElementById('photoRenderMenu');
      var renderAutoPlacementBtn = document.getElementById('renderAutoPlacementBtn');
      var renderCustomViewBtn = document.getElementById('renderCustomViewBtn');
      var photoRenderCaret = document.getElementById('photoRenderCaret');

      function closePhotoRenderMenu() {
        if (photoRenderMenu) {
          photoRenderMenu.classList.remove('is-open');
          photoRenderMenu.style.display = 'none';
        }
        if (photoRenderCaret) photoRenderCaret.style.transform = 'rotate(0deg)';
      }

      if (photoRenderBtn && photoRenderMenu) {
        photoRenderBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          var isOpen = photoRenderMenu.classList.contains('is-open') || photoRenderMenu.style.display === 'block';
          if (isOpen) {
            closePhotoRenderMenu();
          } else {
            photoRenderMenu.classList.add('is-open');
            photoRenderMenu.style.display = 'block';
            if (photoRenderCaret) photoRenderCaret.style.transform = 'rotate(180deg)';
          }
        });

        document.addEventListener('click', function (e) {
          if (!photoRenderMenu.contains(e.target) && e.target !== photoRenderBtn && !photoRenderBtn.contains(e.target)) {
            closePhotoRenderMenu();
          }
        });
      } else if (photoRenderBtn) {
        photoRenderBtn.addEventListener('click', function () {
          self.capturePhotorealisticRender({ mode: 'auto' });
        });
      }

      if (renderAutoPlacementBtn) {
        renderAutoPlacementBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          closePhotoRenderMenu();
          self.capturePhotorealisticRender({ mode: 'auto' });
        });
      }

      if (renderCustomViewBtn) {
        renderCustomViewBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          closePhotoRenderMenu();
          self.capturePhotorealisticRender({ mode: 'custom' });
        });
      }

      var renderAIRenderBtn = document.getElementById('renderAIRenderBtn');
      if (renderAIRenderBtn) {
        renderAIRenderBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          closePhotoRenderMenu();
          if (typeof self.openAIRenderModal === 'function') {
            self.openAIRenderModal();
          }
        });
      }

      // ══════════ PHOTOREALISTIC RENDERING ENGINE & CLIENT PRESENTATION ══════════
      var modeDesignBtn = document.getElementById('modeDesignBtn');
      var modeRealisticBtn = document.getElementById('modeRealisticBtn');
      var modeUltraBtn = document.getElementById('modeUltraBtn');
      var cpModeDesignBtn = document.getElementById('cpModeDesignBtn');
      var cpModeRealisticBtn = document.getElementById('cpModeRealisticBtn');
      var cpModeUltraBtn = document.getElementById('cpModeUltraBtn');
      var todDayBtn = document.getElementById('todDayBtn');
      var todEveBtn = document.getElementById('todEveBtn');
      var todNightBtn = document.getElementById('todNightBtn');
      var cpHud = document.getElementById('clientPresentationHud');

      function syncRenderModeUI(mode) {
        mode = (mode || 'realistic').toLowerCase();
        if (mode === 'ultra') mode = 'presentation';

        [modeDesignBtn, modeRealisticBtn, modeUltraBtn, cpModeDesignBtn, cpModeRealisticBtn, cpModeUltraBtn].forEach(function (btn) {
          if (btn) btn.classList.remove('is-on');
        });

        if (mode === 'design') {
          if (modeDesignBtn) modeDesignBtn.classList.add('is-on');
          if (cpModeDesignBtn) cpModeDesignBtn.classList.add('is-on');
        } else if (mode === 'presentation') {
          if (modeUltraBtn) modeUltraBtn.classList.add('is-on');
          if (cpModeUltraBtn) cpModeUltraBtn.classList.add('is-on');
        } else {
          // realistic
          if (modeRealisticBtn) modeRealisticBtn.classList.add('is-on');
          if (cpModeRealisticBtn) cpModeRealisticBtn.classList.add('is-on');
        }
      }

      function setRenderMode(mode) {
        mode = (mode || 'realistic').toLowerCase();
        if (mode === 'ultra') mode = 'presentation';
        var gl = window.GL || (window.__cc && window.__cc.gl);
        if (gl && gl.setRenderMode) gl.setRenderMode(mode);
        else if (typeof window.setRenderMode === 'function') window.setRenderMode(mode);
        syncRenderModeUI(mode);

        if (mode === 'presentation') {
          openClientPresentation();
          if (typeof window.toast === 'function') {
            window.toast('🌟 Client Ultra Mode: High-res PCF soft shadow maps (4096×4096), ACES Filmic (1.12), panoramic view & HUD');
          }
        } else if (mode === 'design') {
          var viewDesign = document.getElementById('view-design');
          if (viewDesign && viewDesign.classList.contains('present')) {
            closeClientPresentation();
          }
          if (typeof window.toast === 'function') {
            window.toast('⚡ Design Mode: Lightweight standard materials, shadows disabled, maximum 60 FPS');
          }
        } else {
          // realistic
          if (typeof window.toast === 'function') {
            window.toast('✨ Realistic Mode: Real-time PBR preview, MeshPhysicalMaterial, PCF soft contact shadows & HDRI reflections');
          }
        }
      }

      if (modeDesignBtn) {
        modeDesignBtn.addEventListener('click', function () { setRenderMode('design'); });
      }
      if (cpModeDesignBtn) {
        cpModeDesignBtn.addEventListener('click', function () { setRenderMode('design'); });
      }

      if (modeRealisticBtn) {
        modeRealisticBtn.addEventListener('click', function () { setRenderMode('realistic'); });
      }
      if (cpModeRealisticBtn) {
        cpModeRealisticBtn.addEventListener('click', function () { setRenderMode('realistic'); });
      }

      if (modeUltraBtn) {
        modeUltraBtn.addEventListener('click', function () { setRenderMode('presentation'); });
      }
      if (cpModeUltraBtn) {
        cpModeUltraBtn.addEventListener('click', function () { setRenderMode('presentation'); });
      }

      function syncTimeOfDayUI(tod) {
        [todDayBtn, todEveBtn, todNightBtn].forEach(function (btn) {
          if (btn) btn.classList.remove('is-on');
        });
        var cpDay = document.getElementById('cpTodDayBtn');
        var cpEve = document.getElementById('cpTodEveBtn');
        var cpNight = document.getElementById('cpTodNightBtn');
        [cpDay, cpEve, cpNight].forEach(function (btn) {
          if (btn) btn.classList.remove('is-on');
        });

        if (tod === 'evening') {
          if (todEveBtn) todEveBtn.classList.add('is-on');
          if (cpEve) cpEve.classList.add('is-on');
        } else if (tod === 'night') {
          if (todNightBtn) todNightBtn.classList.add('is-on');
          if (cpNight) cpNight.classList.add('is-on');
        } else {
          if (todDayBtn) todDayBtn.classList.add('is-on');
          if (cpDay) cpDay.classList.add('is-on');
        }
      }

      function setTimeOfDay(tod) {
        var gl = window.GL || (window.__cc && window.__cc.gl);
        if (gl && gl.setTimeOfDay) gl.setTimeOfDay(tod);
        else if (typeof window.setTimeOfDay === 'function') window.setTimeOfDay(tod);
        syncTimeOfDayUI(tod);
      }

      if (todDayBtn) todDayBtn.addEventListener('click', function () { setTimeOfDay('day'); });
      if (todEveBtn) todEveBtn.addEventListener('click', function () { setTimeOfDay('evening'); });
      if (todNightBtn) todNightBtn.addEventListener('click', function () { setTimeOfDay('night'); });

      // Client Presentation Open / Close
      function openClientPresentation() {
        var viewDesign = document.getElementById('view-design');
        if (viewDesign) viewDesign.classList.add('present');
        if (cpHud) cpHud.style.display = 'flex';
        var cpHudTitle = document.getElementById('cpHudTitle');
        if (cpHudTitle && self.project && self.project.meta) {
          cpHudTitle.textContent = (self.project.meta.title || 'Modular Cupboard Design') + (self.project.meta.clientName ? ' — ' + self.project.meta.clientName : '');
        }
        var pBtn = document.getElementById('presentBtn');
        if (pBtn) {
          pBtn.textContent = 'Exit present';
          pBtn.setAttribute('aria-pressed', 'true');
        }
        syncRenderModeUI('presentation');
        var gl = window.GL || (window.__cc && window.__cc.gl);
        if (gl && gl.setRenderMode) gl.setRenderMode('presentation');
        if (gl && gl.apply) gl.apply(true);
      }

      function closeClientPresentation() {
        var viewDesign = document.getElementById('view-design');
        if (viewDesign) viewDesign.classList.remove('present');
        if (cpHud) cpHud.style.display = 'none';
        var pBtn = document.getElementById('presentBtn');
        if (pBtn) {
          pBtn.textContent = '⛶ Present';
          pBtn.setAttribute('aria-pressed', 'false');
        }
        var currentMode = (window.orbixRenderMode === 'design') ? 'design' : 'realistic';
        syncRenderModeUI(currentMode);
        var gl = window.GL || (window.__cc && window.__cc.gl);
        if (gl && gl.setRenderMode) gl.setRenderMode(currentMode);
        if (gl && gl.apply) gl.apply(true);
      }

      var presentBtn = document.getElementById('presentBtn');
      if (presentBtn) {
        presentBtn.addEventListener('click', function () {
          var viewDesign = document.getElementById('view-design');
          var isPresenting = viewDesign && viewDesign.classList.contains('present');
          if (isPresenting) {
            openClientPresentation();
          } else {
            closeClientPresentation();
          }
        });
      }

      var cpExitBtn = document.getElementById('cpExitBtn');
      if (cpExitBtn) {
        cpExitBtn.addEventListener('click', function () {
          closeClientPresentation();
        });
      }

      var cpFsToggleBtn = document.getElementById('cpFsToggleBtn');
      if (cpFsToggleBtn) {
        cpFsToggleBtn.addEventListener('click', function () {
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(function () {});
            cpFsToggleBtn.textContent = '✕ Windowed';
          } else {
            if (document.exitFullscreen) document.exitFullscreen();
            cpFsToggleBtn.textContent = '⛶ Fullscreen';
          }
        });
      }

      // HUD Camera Presets
      var cpCamBtns = document.querySelectorAll('#clientPresentationHud [data-cam]');
      cpCamBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          cpCamBtns.forEach(function (b) { b.classList.remove('is-on'); });
          btn.classList.add('is-on');
          var camPreset = btn.getAttribute('data-cam');
          var gl = window.GL || (window.__cc && window.__cc.gl);
          if (gl && gl.setCameraPreset) gl.setCameraPreset(camPreset);
          else if (typeof window.setCameraPreset === 'function') window.setCameraPreset(camPreset);
        });
      });

      // HUD Atmosphere (Time of Day)
      var cpHudTodBtns = document.querySelectorAll('#clientPresentationHud [data-tod]');
      cpHudTodBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var tod = btn.getAttribute('data-tod');
          setTimeOfDay(tod);
        });
      });

      // HUD Material Comparison (Option A vs Option B)
      var cpOptABtn = document.getElementById('cpOptABtn');
      var cpOptBBtn = document.getElementById('cpOptBBtn');
      if (cpOptABtn && cpOptBBtn) {
        cpOptABtn.addEventListener('click', function () {
          cpOptABtn.classList.add('is-on');
          cpOptBBtn.classList.remove('is-on');
          var gl = window.GL || (window.__cc && window.__cc.gl);
          if (gl && gl.applyMaterialComparison) gl.applyMaterialComparison('A');
          else if (typeof window.applyMaterialComparison === 'function') window.applyMaterialComparison('A');
          if (typeof window.toast === 'function') window.toast('Switched to Finish Option A (Current)');
        });

        cpOptBBtn.addEventListener('click', function () {
          cpOptBBtn.classList.add('is-on');
          cpOptABtn.classList.remove('is-on');
          var gl = window.GL || (window.__cc && window.__cc.gl);
          if (gl && gl.applyMaterialComparison) gl.applyMaterialComparison('B');
          else if (typeof window.applyMaterialComparison === 'function') window.applyMaterialComparison('B');
          if (typeof window.toast === 'function') window.toast('Switched to Finish Option B (Luxury Compare)');
        });
      }

      // 4K Ultra Render Export from HUD
      var cpExport4KBtn = document.getElementById('cpExport4KBtn');
      if (cpExport4KBtn) {
        cpExport4KBtn.addEventListener('click', function () {
          self.capturePhotorealisticRender({ mode: 'custom', targetWidth: 3840, targetHeight: 2160, label: '4k_ultra' });
        });
      }

      var btnExportJson = document.getElementById('planExportJson');
      if (btnExportJson) {
        btnExportJson.addEventListener('click', function () {
          var str = Core.serializeProject(self.project);
          var blob = new Blob([str], { type: 'application/json' });
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = (self.project.meta.title || 'orbix-home').toLowerCase().replace(/\s+/g, '-') + '.orbix.json';
          a.click();
        });
      }

      var btnImportJson = document.getElementById('planImportJson');
      var fileIn = document.getElementById('planFileInput');
      if (btnImportJson && fileIn) {
        btnImportJson.addEventListener('click', function () { fileIn.click(); });
        fileIn.addEventListener('change', function () {
          var file = fileIn.files[0];
          if (!file) return;
          var reader = new FileReader();
          reader.onload = function (e) {
            try {
              self.project = Core.deserializeProject(e.target.result);
              self.editor.project = self.project;
              self.editor.selected = [];
              self.editor.wallChainStart = null;
              Core.detectRooms(self.project);
              self.editor.pushHistory('Import Project');
              self.editor.zoomFit();
              self.updateUI();
              self.renderBOQ();
            } catch (err) {
              alert('Error reading project file: ' + err.message);
            }
          };
          reader.readAsText(file);
          fileIn.value = '';
        });
      }

      var btnView3D = document.getElementById('planView3D');
      if (btnView3D) {
        btnView3D.addEventListener('click', function () {
          var vtab3D = document.querySelector('.vtab[data-view="design"]');
          if (vtab3D) vtab3D.click();
        });
      }

      // Presets change
      var wallThickSel = document.getElementById('planWallThickness');
      if (wallThickSel) {
        wallThickSel.addEventListener('change', function () {
          self.editor.wallPreset.thickness = parseFloat(wallThickSel.value);
        });
      }

      var doorWidthSel = document.getElementById('planDoorWidth');
      if (doorWidthSel) {
        doorWidthSel.addEventListener('change', function () {
          self.editor.doorPreset.width = parseFloat(doorWidthSel.value);
        });
      }

      var windowWidthSel = document.getElementById('planWindowWidth');
      if (windowWidthSel) {
        windowWidthSel.addEventListener('change', function () {
          self.editor.windowPreset.width = parseFloat(windowWidthSel.value);
        });
      }

      var furnSel = document.getElementById('planFurnSelect');
      function syncFurnDropdown() {
        if (!furnSel || !Core.FURNITURE_CATALOG) return;
        var currentVal = furnSel.value;
        furnSel.innerHTML = '';

        var group = document.createElement('optgroup');
        group.label = 'Cookscape Modular Units (' + Core.FURNITURE_CATALOG.length + ' Units)';

        for (var i = 0; i < Core.FURNITURE_CATALOG.length; i++) {
          var item = Core.FURNITURE_CATALOG[i];
          var opt = document.createElement('option');
          opt.value = item.id;
          var dimsText = item.dimensions ? (' (' + item.dimensions.W + '×' + item.dimensions.H + ')') : '';
          opt.textContent = (item.icon ? item.icon + ' ' : '') + item.name + dimsText;
          group.appendChild(opt);
        }
        furnSel.appendChild(group);

        if (currentVal && furnSel.querySelector('option[value="' + currentVal + '"]')) {
          furnSel.value = currentVal;
        } else if (furnSel.options.length > 0) {
          furnSel.selectedIndex = 0;
        }
      }

      syncFurnDropdown();
      self.initFurnitureCatalogModal();
      if (typeof self.initDecorModal === 'function') self.initDecorModal();
      if (typeof self.initAIDecorModal === 'function') self.initAIDecorModal();
      if (typeof self.initAIRenderModal === 'function') self.initAIRenderModal();
      if (typeof self.initFurnishUI === 'function') self.initFurnishUI();

      if (furnSel && Core.FURNITURE_CATALOG) {
        furnSel.addEventListener('change', function () {
          var fId = furnSel.value;
          for (var i = 0; i < Core.FURNITURE_CATALOG.length; i++) {
            if (Core.FURNITURE_CATALOG[i].id === fId) {
              self.editor.furniturePreset = Core.FURNITURE_CATALOG[i];
              var imgEl = document.getElementById('planFurnActiveImg');
              var nameEl = document.getElementById('planFurnActiveName');
              var dimsEl = document.getElementById('planFurnActiveDims');
              var catEl = document.getElementById('planFurnActiveCat');
              if (imgEl) imgEl.src = Core.getUnitIcon ? Core.getUnitIcon(Core.FURNITURE_CATALOG[i]) : 'icon-cookscape-unit.png';
              if (nameEl) nameEl.textContent = Core.FURNITURE_CATALOG[i].name;
              if (dimsEl && Core.FURNITURE_CATALOG[i].dimensions) dimsEl.textContent = Core.FURNITURE_CATALOG[i].dimensions.W + '×' + Core.FURNITURE_CATALOG[i].dimensions.H;
              if (catEl) catEl.textContent = 'Cookscape Units';
              break;
            }
          }
          var fBtn = document.querySelector('.plan-tool-btn[data-tool="furniture"]');
          if (fBtn) fBtn.click();
        });
      }

      var importUnitsBtn = document.getElementById('planImportUnitsBtn');
      var unitsCsvInput = document.getElementById('planUnitsCsvInput');
      if (importUnitsBtn && unitsCsvInput) {
        importUnitsBtn.addEventListener('click', function () {
          unitsCsvInput.click();
        });
        unitsCsvInput.addEventListener('change', function (e) {
          var file = e.target.files && e.target.files[0];
          if (!file) return;
          var reader = new FileReader();
          reader.onload = function (ev) {
            try {
              var res = Core.importUnitsFromCSV(ev.target.result);
              syncFurnDropdown();
              if (res.items.length > 0) {
                furnSel.value = res.items[0].id;
                self.editor.furniturePreset = res.items[0];
              }
              alert('Successfully imported ' + res.added + ' modular units from CSV into catalog!');
            } catch (err) {
              alert('Error importing CSV: ' + err.message);
            }
          };
          reader.readAsText(file);
          unitsCsvInput.value = '';
        });
      }

      // ── Wall Snapping vs Free Placement Toggle ──
      var btnSnapToggle = document.getElementById('planSnapToggleBtn');
      if (btnSnapToggle) {
        btnSnapToggle.addEventListener('click', function () {
          self.editor.forceFreePlacement = !self.editor.forceFreePlacement;
          if (self.editor.forceFreePlacement) {
            btnSnapToggle.innerHTML = '🔓 Free: No Wall Snap';
            btnSnapToggle.style.color = '#b45309';
            btnSnapToggle.style.borderColor = '#d97706';
            btnSnapToggle.style.background = '#fef3c7';
            if (self.showToast) self.showToast('Free Placement active: units place anywhere without wall snapping', 'info');
          } else {
            btnSnapToggle.innerHTML = '🧲 Snap: Wall Flush';
            btnSnapToggle.style.color = '#0369a1';
            btnSnapToggle.style.borderColor = '#0284c7';
            btnSnapToggle.style.background = '#f0f9ff';
            if (self.showToast) self.showToast('Wall Snap active: units snap flush to wall faces', 'info');
          }
        });
      }

      // ── 2D Unit System Switch (mm ⇄ ft & in) ──
      var btnUnitToggle = document.getElementById('planUnitToggleBtn');
      if (btnUnitToggle) {
        btnUnitToggle.addEventListener('click', function () {
          if (self.editor.unitSystem === 'mm') {
            self.editor.unitSystem = 'imperial';
            btnUnitToggle.innerHTML = '📐 Unit: ft & in';
            btnUnitToggle.style.color = '#0284c7';
            btnUnitToggle.style.borderColor = '#0284c7';
          } else {
            self.editor.unitSystem = 'mm';
            btnUnitToggle.innerHTML = '📐 Unit: mm';
            btnUnitToggle.style.color = '#1B4F72';
            btnUnitToggle.style.borderColor = '#1B4F72';
          }
          self.editor.render();
          self.renderInspector(self.editor.selected);
        });
      }

      // ── Import Floor Plan Image Underlay ──
      var btnImportImg = document.getElementById('planImportImageBtn');
      var planImgInput = document.getElementById('planImageFileInput');
      if (btnImportImg && planImgInput) {
        btnImportImg.addEventListener('click', function () {
          planImgInput.click();
        });
        planImgInput.addEventListener('change', function (e) {
          var file = e.target.files && e.target.files[0];
          if (!file) return;
          var reader = new FileReader();
          reader.onload = function (ev) {
            var dataUrl = ev.target.result;
            var img = new Image();
            img.onload = function () {
              self.editor.underlay.img = img;
              self.editor.underlay.dataUrl = dataUrl;
              self.editor.underlay.width = img.naturalWidth;
              self.editor.underlay.height = img.naturalHeight;
              self.editor.underlay.scale = 10; // Default: 10 mm per pixel (1000px = 10m)
              self.editor.underlay.x = 0;
              self.editor.underlay.y = 0;
              self.editor.underlay.visible = true;
              self.editor.underlay.opacity = 0.45;
              self.editor.underlay.calibPoints = [];

              self.persistUnderlay();

              var controls = document.getElementById('planUnderlayControls');
              if (controls) controls.style.display = 'inline-flex';

              var opSlider = document.getElementById('planUnderlayOpacity');
              if (opSlider) opSlider.value = '0.45';

              self.editor.zoomFit();
              self.editor.render();
            };
            img.src = dataUrl;
          };
          reader.readAsDataURL(file);
          planImgInput.value = '';
        });
      }

      // ── Underlay Controls (Move Blueprint, Calibrate, Opacity, Toggle, Remove) ──
      var btnMoveUnderlay = document.getElementById('planMoveUnderlayBtn');
      if (btnMoveUnderlay) {
        btnMoveUnderlay.addEventListener('click', function () {
          if (!self.editor.underlay || !self.editor.underlay.img) {
            alert('Please import a blueprint image first (click 🖼️ Import Blueprint).');
            return;
          }
          var isMoving = (self.editor.activeTool === 'move_underlay');
          if (isMoving) {
            self.editor.setTool('select');
            btnMoveUnderlay.classList.remove('is-active');
            btnMoveUnderlay.style.background = '';
            btnMoveUnderlay.style.color = '';
            self.persistUnderlay();
          } else {
            self.editor.setTool('move_underlay');
            var allToolBtns = document.querySelectorAll('.plan-tool-btn');
            allToolBtns.forEach(function (b) { b.classList.remove('is-active'); });
            btnMoveUnderlay.classList.add('is-active');
            btnMoveUnderlay.style.background = '#059669';
            btnMoveUnderlay.style.color = '#ffffff';
          }
          self.editor.render();
        });
      }

      var btnCalib = document.getElementById('planCalibrateScaleBtn');
      if (btnCalib) {
        btnCalib.addEventListener('click', function () {
          if (!self.editor.underlay || !self.editor.underlay.img) {
            alert('Please import a floor plan image first before calibrating.');
            return;
          }
          self.editor.activeTool = 'calibrate';
          self.editor.underlay.calibPoints = [];
          var toolBtns = document.querySelectorAll('.plan-tool-btn');
          toolBtns.forEach(function (b) { b.classList.remove('is-active'); });
          btnCalib.classList.add('is-active');
          self.editor.render();
        });
      }

      var opSlider = document.getElementById('planUnderlayOpacity');
      if (opSlider) {
        opSlider.addEventListener('input', function (e) {
          if (self.editor.underlay) {
            self.editor.underlay.opacity = parseFloat(e.target.value);
            self.persistUnderlay();
            self.editor.render();
          }
        });
      }

      var btnToggleUnderlay = document.getElementById('planToggleUnderlayBtn');
      if (btnToggleUnderlay) {
        btnToggleUnderlay.addEventListener('click', function () {
          if (self.editor.underlay) {
            self.editor.underlay.visible = !self.editor.underlay.visible;
            btnToggleUnderlay.textContent = self.editor.underlay.visible ? '👁 Show' : '👁‍🗨 Hide';
            self.persistUnderlay();
            self.editor.render();
          }
        });
      }

      var btnRemoveUnderlay = document.getElementById('planRemoveUnderlayBtn');
      if (btnRemoveUnderlay) {
        btnRemoveUnderlay.addEventListener('click', function () {
          if (confirm('Remove the imported floor plan background image?')) {
            if (self.editor.underlay) {
              self.editor.underlay.img = null;
              self.editor.underlay.dataUrl = null;
              self.editor.underlay.calibPoints = [];
            }
            if (self.editor.activeTool === 'calibrate') {
              self.editor.activeTool = 'select';
              var selBtn = document.querySelector('.plan-tool-btn[data-tool="select"]');
              if (selBtn) {
                document.querySelectorAll('.plan-tool-btn').forEach(function (b) { b.classList.remove('is-active'); });
                selBtn.classList.add('is-active');
              }
            }
            self.persistUnderlay();
            var controls = document.getElementById('planUnderlayControls');
            if (controls) controls.style.display = 'none';
            self.editor.render();
          }
        });
      }

      // ── Calibrate Scale Modal Form Submission ──
      var calibForm = document.getElementById('calibrateScaleForm');
      if (calibForm) {
        calibForm.addEventListener('submit', function (e) {
          e.preventDefault();
          var input = document.getElementById('calibrateRealDistInput');
          var realMm = self.editor.parseDimInput(input.value);
          var pxSpan = document.getElementById('calibratePixelDistSpan');
          var pixelDist = parseFloat(pxSpan ? pxSpan.textContent : '0');

          if (realMm > 50 && pixelDist > 0) {
            var newScale = realMm / pixelDist;
            self.editor.underlay.scale = newScale;
            self.persistUnderlay();
            self.closeCalibrateModal();
            self.editor.zoomFit();
            self.editor.render();
          } else {
            alert('Please enter a valid real dimension (e.g. 3000 mm or 10\').');
          }
        });
      }

      var closeCalibBtn = document.getElementById('closeCalibrateScaleModal');
      var cancelCalibBtn = document.getElementById('cancelCalibrateScaleBtn');
      if (closeCalibBtn) closeCalibBtn.addEventListener('click', function () { self.closeCalibrateModal(); });
      if (cancelCalibBtn) cancelCalibBtn.addEventListener('click', function () { self.closeCalibrateModal(); });
    },

    openCalibrateModal: function (pixelDist, worldDist) {
      var modal = document.getElementById('modalCalibrateScale');
      if (!modal) return;
      var pxSpan = document.getElementById('calibratePixelDistSpan');
      if (pxSpan) pxSpan.textContent = pixelDist;
      var worldSpan = document.getElementById('calibrateCurrentWorldDistSpan');
      if (worldSpan) worldSpan.textContent = this.editor.formatDim(worldDist);

      var input = document.getElementById('calibrateRealDistInput');
      if (input) {
        input.value = this.editor.unitSystem === 'imperial' ? '10\'' : Math.round(worldDist || 3000);
        setTimeout(function () { input.select(); }, 50);
      }
      modal.classList.add('is-open');
    },

    closeCalibrateModal: function () {
      var modal = document.getElementById('modalCalibrateScale');
      if (modal) modal.classList.remove('is-open');
      if (this.editor.activeTool === 'calibrate') {
        this.editor.activeTool = 'select';
        if (this.editor.underlay) this.editor.underlay.calibPoints = [];
        var selBtn = document.querySelector('.plan-tool-btn[data-tool="select"]');
        if (selBtn) {
          document.querySelectorAll('.plan-tool-btn').forEach(function (b) { b.classList.remove('is-active'); });
          selBtn.classList.add('is-active');
        }
        this.editor.render();
      }
    },

    loadSampleHome: function () {
      var p = Core.createProject('Modern 2BHK Apartment');
      // Living Room: 5000 x 4000
      var w1 = Core.createWall({ start: { x: 0, y: 0 }, end: { x: 5000, y: 0 }, thickness: 200 });
      var w2 = Core.createWall({ start: { x: 5000, y: 0 }, end: { x: 5000, y: 4000 }, thickness: 200 });
      var w3 = Core.createWall({ start: { x: 5000, y: 4000 }, end: { x: 0, y: 4000 }, thickness: 150 });
      var w4 = Core.createWall({ start: { x: 0, y: 4000 }, end: { x: 0, y: 0 }, thickness: 200 });

      // Master Bedroom: 4200 x 4000 (adjacent right)
      var w5 = Core.createWall({ start: { x: 5000, y: 0 }, end: { x: 9200, y: 0 }, thickness: 200 });
      var w6 = Core.createWall({ start: { x: 9200, y: 0 }, end: { x: 9200, y: 4000 }, thickness: 200 });
      var w7 = Core.createWall({ start: { x: 9200, y: 4000 }, end: { x: 5000, y: 4000 }, thickness: 200 });

      // Modular Kitchen: 3500 x 3000 (below living)
      var w8 = Core.createWall({ start: { x: 0, y: 4000 }, end: { x: 0, y: 7000 }, thickness: 200 });
      var w9 = Core.createWall({ start: { x: 0, y: 7000 }, end: { x: 3500, y: 7000 }, thickness: 200 });
      var w10 = Core.createWall({ start: { x: 3500, y: 7000 }, end: { x: 3500, y: 4000 }, thickness: 150 });

      p.plan.walls = [w1, w2, w3, w4, w5, w6, w7, w8, w9, w10];

      // Main Entrance Door (w1)
      p.plan.openings.push(Core.createOpening({
        type: 'door', wallId: w1.id, offset: 1200, width: 1000, height: 2100, label: 'Main Door'
      }));

      // Bedroom Door (w2)
      p.plan.openings.push(Core.createOpening({
        type: 'door', wallId: w2.id, offset: 1500, width: 900, height: 2100, label: 'Bed Door'
      }));

      // Bedroom Window (w6)
      p.plan.openings.push(Core.createOpening({
        type: 'window', wallId: w6.id, offset: 2000, width: 1500, height: 1400, label: 'Bed Window'
      }));

      // Kitchen Window (w9)
      p.plan.openings.push(Core.createOpening({
        type: 'window', wallId: w9.id, offset: 1800, width: 1200, height: 1000, label: 'Kitchen Window'
      }));

      p.meta = {
        title: 'Residential Interior Estimation',
        clientName: 'Aravind K.',
        phone: '+91 98450 12345',
        email: 'aravind@example.com',
        siteAddress: 'Flat 402, Skyline Residency, Bangalore',
        quoteId: 'ORB-2026-089',
        designerName: 'Orbix Studio',
        dateCreated: new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }),
        validUntil: new Date(Date.now() + 30 * 86400000).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }),
        status: 'approved'
      };

      var defaultMats = {
        shutter: { material: 'HDHMR_18MM', finish: 'MDF 7707' },
        carcass: { material: 'BWP_18MM', finish: 'MDF 6601' }
      };

      // 1. Master Bedroom Wardrobe (1800 x 2100 x 600 mm)
      p.plan.furniture.push(Core.createFurniturePlacement({
        name: 'Master Bed 3-Door Wardrobe',
        category: 'wardrobe',
        pos: { x: 7000, y: 500 },
        dimensions: { W: 1800, H: 2100, D: 600 },
        unitConfig: { shutterCol: 'MDF 7707', carcass: 'MDF 6601', shutters: 3 },
        materials: defaultMats
      }));

      // 2. Living Room TV Media Wall (2400 x 1800 x 400 mm)
      p.plan.furniture.push(Core.createFurniturePlacement({
        name: 'Living TV Entertainment Unit',
        category: 'tv_unit',
        pos: { x: 2500, y: 3600 },
        dimensions: { W: 2400, H: 1800, D: 400 },
        unitConfig: { shutterCol: 'MDF 7707', carcass: 'MDF 6601' },
        materials: defaultMats
      }));

      // 3. Kitchen Base & Wall Modular Runs
      p.plan.furniture.push(Core.createFurniturePlacement({
        name: 'Kitchen L-Run Base Cabinets',
        category: 'kitchen_base',
        pos: { x: 1800, y: 6600 },
        dimensions: { W: 3000, H: 850, D: 600 },
        unitConfig: { shutterCol: 'MDF 7707', carcass: 'MDF 6601' },
        materials: defaultMats
      }));

      p.plan.furniture.push(Core.createFurniturePlacement({
        name: 'Kitchen Wall Cabinets',
        category: 'kitchen_wall',
        pos: { x: 1800, y: 6600 },
        dimensions: { W: 3000, H: 700, D: 350 },
        unitConfig: { shutterCol: 'MDF 7707', carcass: 'MDF 6601' },
        materials: defaultMats
      }));

      // 4. Kitchen FM 60 Modular Base Unit
      p.plan.furniture.push(Core.createFurniturePlacement({
        id: 'fm-60',
        name: 'FM 60',
        category: 'kitchen_base',
        modelType: 'kitchen_fm',
        refCode: 'fm-60',
        pos: { x: 2400, y: 6600 },
        dimensions: { W: 600, H: 750, D: 550 },
        unitConfig: { shutterCol: 'MDF 7707', carcass: 'MDF 6601', shutters: 1, handle: 'gprof' },
        materials: {
          shutter: { material: 'HDHMR_18MM', finish: 'MDF 7707' },
          carcass: { material: 'BWP_18MM', finish: 'MDF 6601' }
        }
      }));

      Core.detectRooms(p);
      if (p.plan.rooms[0]) p.plan.rooms[0].name = 'Living Room';
      if (p.plan.rooms[1]) p.plan.rooms[1].name = 'Master Bedroom';
      if (p.plan.rooms[2]) p.plan.rooms[2].name = 'Modular Kitchen';

      this.project = p;
      this.editor.project = p;
      this.editor.pushHistory('Sample 2BHK Home');
      this.editor.zoomFit();
      this.updateUI();
      this.renderBOQ();
    },

    updateUI: function () {
      var rooms = this.project.plan.rooms || [];
      var totalAreaSqFt = 0;
      var totalAreaSqM = 0;
      for (var r = 0; r < rooms.length; r++) {
        totalAreaSqFt += rooms[r].areaSqFt;
        totalAreaSqM += rooms[r].areaSqM;
      }

      var statEl = document.getElementById('planStats');
      if (statEl) {
        statEl.innerHTML = '<b>' + rooms.length + '</b> Rooms &nbsp;·&nbsp; <b>' +
          Math.round(totalAreaSqFt) + '</b> sq ft (' + totalAreaSqM.toFixed(1) + ' m²) &nbsp;·&nbsp; <b>' +
          this.project.plan.walls.length + '</b> Walls &nbsp;·&nbsp; <b>' +
          (this.project.plan.furniture || []).length + '</b> Modular Units';
      }

      // Update Live Cost Header Badge
      var quote = Core.generateFullQuotation(this.project);
      var badge = document.getElementById('liveQuotationBadge');
      if (badge) {
        badge.innerHTML = '<span class="badge-label">Estimated Total:</span> <span class="badge-amount">' +
          quote.currencySymbol + ' ' + quote.grandTotal.toLocaleString('en-IN') + '</span>';
      }

      this.update3DStudioRoomOptions();
      this.updateProjectDetailsBadges();
    },

    updateProjectDetailsBadges: function () {
      var proj = this.project || (this.editor && this.editor.project);
      var meta = (proj && proj.meta) || {};
      var plan = (proj && proj.plan) || {};
      var rooms = plan.rooms || [];
      var units = plan.furniture || [];
      var activeProj = null;
      if (window.OrbixProjects && window.OrbixProjects.activeProjectId && Array.isArray(window.OrbixProjects.projects)) {
        activeProj = window.OrbixProjects.projects.find(function (p) {
          return String(p.id) === String(window.OrbixProjects.activeProjectId);
        });
      }
      var title = (activeProj && (activeProj.title || activeProj.name)) || meta.title || 'Untitled Project';
      var client = (activeProj && activeProj.client) || meta.clientName || '';
      var phone = (activeProj && activeProj.contact_number) || meta.phone || meta.contactNumber || '';
      var code = (activeProj && activeProj.cp_code) || meta.cpCode || meta.quoteId || '';
      var designer = (activeProj && activeProj.bh_name) || meta.designerName || meta.bhName || '';
      var location = (activeProj && activeProj.location) || meta.siteAddress || meta.siteLocation || '';
      var status = (activeProj && activeProj.status) || meta.status || 'Active Design';

      var esc = function (v) {
        return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      };

      var leftParts = ['<span style="font-weight:700;color:#0f172a;">📋 ' + esc(title) + '</span>'];
      if (code) leftParts.push('<span style="background:#dbeafe;color:#1e40af;padding:1px 7px;border-radius:10px;font-weight:700;font-size:10.5px;">' + esc(code) + '</span>');
      if (client) leftParts.push('<span style="color:#334155;">👤 <b>' + esc(client) + '</b>' + (phone ? ' (' + esc(phone) + ')' : '') + '</span>');
      if (location) leftParts.push('<span style="color:#475569;">📍 ' + esc(location) + '</span>');
      if (designer) leftParts.push('<span style="color:#475569;">🎨 BH: <b>' + esc(designer) + '</b></span>');

      var totalSqFt = 0;
      for (var ri = 0; ri < rooms.length; ri++) totalSqFt += (rooms[ri].areaSqFt || 0);
      var rightHtml =
        '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;color:#475569;font-size:11px;">' +
        '<span><b>' + rooms.length + '</b> Rooms</span>' +
        '<span>· <b>' + units.length + '</b> Units</span>' +
        (totalSqFt > 0 ? '<span>· <b>' + Math.round(totalSqFt) + '</b> sq ft</span>' : '') +
        '<span style="background:#dcfce7;color:#166534;padding:1px 7px;border-radius:10px;font-weight:600;font-size:10.5px;">' + esc(status) + '</span>' +
        '</div>';

      var fullHtml = '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">' + leftParts.join('') + '</div>' + rightHtml;

      var bar2D = document.getElementById('planProjectDetailsBar');
      if (bar2D) bar2D.innerHTML = fullHtml;

      var bar3D = document.getElementById('studioProjectDetailsBadge');
      if (bar3D) bar3D.innerHTML = fullHtml;
    },

    update3DStudioRoomOptions: function () {
      var studioRoomSel = document.getElementById('studioRoomSelect');
      if (!studioRoomSel) return;
      var curVal = studioRoomSel.value || 'all';
      var plan = this.getPlan();
      var rooms = (plan && plan.rooms) ? plan.rooms : [];
      var html = '<option value="all">🏠 All Rooms</option>';
      rooms.forEach(function (rm, idx) {
        var rName = rm.name || ('Room ' + (idx + 1));
        var rType = rm.type ? (' (' + rm.type + ')') : '';
        html += '<option value="' + rm.id + '">' + rName + rType + '</option>';
      });
      studioRoomSel.innerHTML = html;
      if (rooms.some(function (r) { return r.id === curVal; })) {
        studioRoomSel.value = curVal;
      } else {
        studioRoomSel.value = 'all';
      }
    },

    renderInspector: function (selected) {
      var panel = document.getElementById('planInspectorContent');
      if (!panel) return;
      var self = this;

      if (!selected) {
        panel.innerHTML = '<div class="insp-empty">Select a wall, door, window, or room to inspect and edit exact dimensions.</div>';
        return;
      }

      var sel = Array.isArray(selected) ? selected[0] : selected;
      if (!sel || !sel.type) {
        panel.innerHTML = '<div class="insp-empty">Select a wall, door, window, or room to inspect and edit exact dimensions.</div>';
        return;
      }
      var ed = this.editor || (self && self.editor) || (window.OrbixUI && window.OrbixUI.editor);
      if (!ed) return;

      if (sel.type === 'wall') {
        if (typeof ed.getWall !== 'function') return;
        var w = ed.getWall(sel.id);
        if (!w) return;
        var lenMm = Math.round(Core.wallLength(w));
        var lenDisplay = (ed.formatDim ? ed.formatDim(lenMm) : (lenMm + ' mm'));

        if (w.isDivider) {
          var planObj = ed.project && ed.project.plan;
          var divRooms = (planObj && planObj.rooms || []).filter(function (r) {
            return r.wallIds && r.wallIds.indexOf(w.id) !== -1;
          });
          var roomsInfo = divRooms.length > 0
            ? divRooms.map(function (r) { return r.name || 'Room'; }).join(' ⟷ ')
            : 'Boundary Divider';

          panel.innerHTML =
            '<div class="insp-title" style="color:#7C3AED;">✂ Room Divider</div>' +
            '<div style="font-size:12px;color:#64748B;margin-bottom:12px;line-height:1.4;">Divides open space into independent rooms with custom 3D flooring without building solid physical walls.</div>' +
            '<div class="insp-row"><label>Divided Spaces</label><div style="font-size:12px;color:#1E293B;font-weight:700;padding:3px 0;">' + roomsInfo + '</div></div>' +
            '<div class="insp-row"><label>Divider Span Length</label><input type="text" id="inspDivLen" value="' + (ed.unitSystem === 'imperial' ? lenDisplay : lenMm) + '" readonly style="background:#F8FAFC;font-weight:600;color:#1E293B;">' +
            '<span style="font-size:11px;color:#7C3AED;font-weight:600;">Length: ' + lenDisplay + ' (' + lenMm + ' mm)</span></div>' +
            '<div class="insp-row"><label>3D Architectural Strip</label><div style="font-size:11.5px;color:#334155;padding:4px 0;font-weight:500;">Flush Brushed Brass Threshold (30mm)</div></div>' +
            '<button class="btn danger full" id="inspDelWall" style="margin-top:14px;background:#DC2626;">🗑️ Delete Room Divider</button>';

          var btnDelDiv = document.getElementById('inspDelWall');
          if (btnDelDiv) {
            btnDelDiv.addEventListener('click', function () {
              ed.deleteSelected();
            });
          }
          return;
        }

        var planObj = ed.project && ed.project.plan;
        var innerMm = Math.round(Core.getWallInnerLength ? Core.getWallInnerLength(w, planObj) : lenMm);
        var innerDisplay = (ed.formatDim ? ed.formatDim(innerMm) : (innerMm + ' mm'));
        var hasDado = !!(w.dadoTile || (w.dadoSegments && w.dadoSegments.length > 0));
        var dSeg0 = (w.dadoSegments && w.dadoSegments.length > 0) ? w.dadoSegments[0] : { startOffset: 0, endOffset: Math.round(lenMm) };
        var dStartOff = Math.max(0, Math.round(dSeg0.startOffset || 0));
        var dEndOff = Math.min(Math.round(lenMm), Math.round(dSeg0.endOffset !== undefined ? dSeg0.endOffset : lenMm));
        var dLenMm = Math.max(100, dEndOff - dStartOff);
        panel.innerHTML =
          '<div class="insp-title">Wall Properties</div>' +
          '<div class="insp-row"><label>Clear Inner Length ' + (ed.unitSystem === 'imperial' ? '(e.g. 5ft or mm)' : '(mm)') + '</label><input type="text" id="inspWallInnerLen" value="' + (ed.unitSystem === 'imperial' ? innerDisplay : innerMm) + '">' +
          '<span style="font-size:11px;color:#0284c7;font-weight:600;">Clear Inner: ' + innerDisplay + ' (' + innerMm + ' mm)</span></div>' +
          '<div class="insp-row"><label>Centerline Length</label><input type="text" id="inspWallLen" value="' + (ed.unitSystem === 'imperial' ? lenDisplay : lenMm) + '">' +
          '<span style="font-size:11px;color:#64748B;">Centerline: ' + lenDisplay + ' (' + lenMm + ' mm)</span></div>' +
          '<div class="insp-row"><label>Thickness (mm)</label><input type="number" id="inspWallThick" value="' + (w.thickness || 150) + '" step="10"></div>' +
          '<div class="insp-row"><label>Height (mm)</label><input type="number" id="inspWallH" value="' + (w.height || 2800) + '" step="50"></div>' +
          
          '<div style="margin-top:12px;padding:10px;background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;">' +
          '  <div style="font-weight:700;font-size:12px;color:#7c3aed;margin-bottom:8px;">🎨 Wall Finish & Wallpaper</div>' +
          '  <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;">' +
          '    <div>' +
          '      <label style="font-size:10.5px;font-weight:600;color:#7c3aed;display:block;margin-bottom:3px;">Wall Color</label>' +
          '      <input type="color" id="inspWallColor" value="' + (w.paintColor || '#B89F82') + '" style="width:100%;height:30px;border:1px solid #ddd6fe;border-radius:4px;cursor:pointer;padding:2px;">' +
          '    </div>' +
          '    <div>' +
          '      <label style="font-size:10.5px;font-weight:600;color:#7c3aed;display:block;margin-bottom:3px;">Finish Type</label>' +
          '      <select id="inspWallFinishType" style="width:100%;height:30px;font-size:11px;border:1px solid #ddd6fe;border-radius:4px;padding:0 4px;">' +
          '        <option value="paint"' + (!(w.wallFinishType) || w.wallFinishType === "paint" ? " selected" : "") + '>🖌️ Painted Plaster</option>' +
          '        <option value="texture"' + (w.wallFinishType === "texture" ? " selected" : "") + '>🧱 Textured Stucco</option>' +
          '        <option value="concrete"' + (w.wallFinishType === "concrete" ? " selected" : "") + '>🏢 Bare Concrete</option>' +
          '        <option value="brick"' + (w.wallFinishType === "brick" ? " selected" : "") + '>🧱 Exposed Brick</option>' +
          '        <option value="marble"' + (w.wallFinishType === "marble" ? " selected" : "") + '>🏛️ Marble Cladding</option>' +
          '      </select>' +
          '    </div>' +
          '  </div>' +
          '  <div>' +
          '    <label style="font-size:10.5px;font-weight:600;color:#7c3aed;display:block;margin-bottom:3px;">Wallpaper Pattern</label>' +
          '    <select id="inspWallpaper" style="width:100%;height:30px;font-size:11px;border:1px solid #ddd6fe;border-radius:4px;padding:0 4px;">' +
          '      <option value="none"' + (!(w.wallpaper) || w.wallpaper === "none" ? " selected" : "") + '>None (Use Color/Finish)</option>' +
          '      <option value="floral_blush"' + (w.wallpaper === "floral_blush" ? " selected" : "") + '>🌸 Floral Blush</option>' +
          '      <option value="geometric_teal"' + (w.wallpaper === "geometric_teal" ? " selected" : "") + '>◈ Geometric Teal</option>' +
          '      <option value="stripe_gold"' + (w.wallpaper === "stripe_gold" ? " selected" : "") + '>〓 Gold Stripe</option>' +
          '      <option value="herringbone_grey"' + (w.wallpaper === "herringbone_grey" ? " selected" : "") + '>⟋ Herringbone Grey</option>' +
          '      <option value="damask_cream"' + (w.wallpaper === "damask_cream" ? " selected" : "") + '>✦ Damask Cream</option>' +
          '      <option value="tropical_leaf"' + (w.wallpaper === "tropical_leaf" ? " selected" : "") + '>🌿 Tropical Leaf</option>' +
          '    </select>' +
          '  </div>' +
          '</div>' +
          '<div class="insp-row" style="margin-top:10px;padding:8px 10px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;">' +
          '  <label style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;margin:0;font-weight:600;color:#166534;">' +
          '    <span>🧱 Dado Tile (Backsplash)</span>' +
          '    <input type="checkbox" id="inspWallDado" ' + (hasDado ? 'checked' : '') + ' style="width:18px;height:18px;cursor:pointer;">' +
          '  </label>' +
          '  <div style="font-size:11px;color:#15803d;margin-top:4px;">' +
          (hasDado ? '✓ Length: ' + dLenMm + ' mm (850–1500mm H). Drag green handles in 2D or edit below.' : 'No dado tile on this wall. Check to enable backsplash.') +
          '  </div>' +
          (hasDado ? (
          '  <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px;">' +
          '    <div>' +
          '      <label style="font-size:10.5px;font-weight:600;color:#166534;display:block;margin-bottom:2px;">Start Offset (mm)</label>' +
          '      <input type="number" id="inspWallDadoStart" value="' + dStartOff + '" min="0" max="' + Math.max(0, Math.round(lenMm) - 100) + '" step="50" style="width:100%;height:26px;font-size:11.5px;padding:0 5px;">' +
          '    </div>' +
          '    <div>' +
          '      <label style="font-size:10.5px;font-weight:600;color:#166534;display:block;margin-bottom:2px;">Tile Length (mm)</label>' +
          '      <input type="number" id="inspWallDadoLen" value="' + dLenMm + '" min="100" max="' + Math.max(100, Math.round(lenMm) - dStartOff) + '" step="50" style="width:100%;height:26px;font-size:11.5px;padding:0 5px;">' +
          '    </div>' +
          '  </div>' +
          '  <div style="display:flex;gap:6px;margin-top:6px;align-items:center;">' +
          '    <button type="button" id="inspWallDadoFull" style="padding:3px 8px;font-size:10.5px;font-weight:600;border:1px solid #86efac;background:#dcfce7;color:#166534;border-radius:4px;cursor:pointer;">Reset Full Wall</button>' +
          '    <button type="button" id="inspWallDadoFlip" style="padding:3px 8px;font-size:10.5px;font-weight:600;border:1px solid #93c5fd;background:#eff6ff;color:#1d4ed8;border-radius:4px;cursor:pointer;" title="Flip dado tile to other side of wall">⇄ Flip Side (' + (w.dadoSide === 'back' ? 'Back' : (w.dadoSide === 'front' ? 'Front' : 'Auto')) + ')</button>' +
          '    <span style="font-size:10px;color:#15803d;margin-left:auto;">Max ' + Math.round(lenMm) + ' mm</span>' +
          '  </div>' +
          '  <div style="margin-top:8px;">' +
          '    <label style="font-size:11px;font-weight:600;color:#166534;display:block;margin-bottom:3px;">Tile Pattern</label>' +
          '    <select id="inspWallDadoStyle" style="width:100%;height:26px;font-size:11px;border:1px solid #bbf7d0;border-radius:4px;background:#ffffff;padding:0 4px;">' +
          '      <option value="dado_1"' + ((w.dadoTileStyle || window.dadoTileStyle || 'dado_1') === 'dado_1' ? ' selected' : '') + '>Dado 1: Modern Geo Stone</option>' +
          '      <option value="dado_2"' + ((w.dadoTileStyle || window.dadoTileStyle) === 'dado_2' ? ' selected' : '') + '>Dado 2: Sage Green Mosaic</option>' +
          '      <option value="dado_3"' + ((w.dadoTileStyle || window.dadoTileStyle) === 'dado_3' ? ' selected' : '') + '>Dado 3: Classic Ceramic Motif</option>' +
          '      <option value="dado_4"' + ((w.dadoTileStyle || window.dadoTileStyle) === 'dado_4' ? ' selected' : '') + '>Dado 4: Carrara Subway Glaze</option>' +
          '      <option value="dado_5"' + ((w.dadoTileStyle || window.dadoTileStyle) === 'dado_5' ? ' selected' : '') + '>Dado 5: Warm Calacatta Marble</option>' +
          '      <option value="rhombus_sage"' + ((w.dadoTileStyle || window.dadoTileStyle) === 'rhombus_sage' ? ' selected' : '') + '>Pattern: Sage Diamond</option>' +
          '      <option value="chevron_mono"' + ((w.dadoTileStyle || window.dadoTileStyle) === 'chevron_mono' ? ' selected' : '') + '>Pattern: Mono Chevron</option>' +
          '      <option value="subway_white"' + ((w.dadoTileStyle || window.dadoTileStyle) === 'subway_white' ? ' selected' : '') + '>Pattern: White Subway</option>' +
          '    </select>' +
          '  </div>') : '') +
                    '</div>' +
          '<div style="margin-top:10px;padding:8px 10px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;">' +
          '  <label style="font-size:11px;font-weight:700;color:#1e293b;display:block;margin-bottom:4px;">🧱 RCC Column Joint (Separate Wall)</label>' +
          '  <div style="font-size:10.5px;color:#64748b;margin-bottom:6px;">Split this straight wall into separate walls at an RCC joint:</div>' +
          '  <div style="display:flex;gap:6px;">' +
          '    <button type="button" class="btn small full" id="inspWallSplitMid" style="background:#0f172a;color:#ffffff;font-size:11px;">➕ RCC Joint at Midpoint (' + Math.round(lenMm / 2) + 'mm)</button>' +
          '  </div>' +
          '  <div style="display:flex;gap:6px;margin-top:6px;align-items:center;">' +
          '    <input type="number" id="inspWallSplitDist" class="input small" placeholder="Offset mm" style="width:105px;height:26px;font-size:11px;padding:0 5px;" value="' + Math.round(lenMm / 2) + '" min="100" max="' + Math.max(100, Math.round(lenMm) - 100) + '">' +
          '    <button type="button" class="btn small" id="inspWallSplitCustom" style="background:#2563eb;color:#ffffff;font-size:11px;flex:1;height:26px;padding:0 6px;">➕ Split at Offset</button>' +
          '  </div>' +
          '</div>' +
          '<button class="btn danger full" id="inspDelWall" style="margin-top:12px">Delete Wall</button>'

        var elInner = document.getElementById('inspWallInnerLen');
        if (elInner) {
          elInner.addEventListener('change', function (e) {
            var targetInner = ed.parseDimInput(e.target.value);
            if (targetInner > 50) {
              var anchor = (w.startLocked === false && w.endLocked !== false) ? 'end' : 'start';
              if (Core.setWallInnerLength) {
                Core.setWallInnerLength(w, targetInner, ed.project && ed.project.plan, anchor);
              }
              Core.detectRooms(ed.project);
              ed.pushHistory('Resize Wall Inner Length');
              ed.render();
              self.renderInspector(ed.selected);
              if (self.render3DHome) self.render3DHome(true);
            }
          });
        }

        var elWallLen = document.getElementById('inspWallLen');
        if (elWallLen) {
          elWallLen.addEventListener('change', function (e) {
            var targetL = ed.parseDimInput(e.target.value);
            if (targetL > 100) {
              var dir = Core.wallDirection(w);
              var anchor = (w.startLocked === false && w.endLocked !== false) ? 'end' : 'start';
              var oldPt = (anchor === 'end') ? { x: w.start.x, y: w.start.y } : { x: w.end.x, y: w.end.y };
              var newPt;
              if (anchor === 'end') {
                // Corner B is locked, Corner A released: resize wall anchored from Corner B
                w.start.x = w.end.x - dir.x * targetL;
                w.start.y = w.end.y - dir.y * targetL;
                newPt = w.start;
              } else {
                // Corner A is locked (or both locked): resize wall anchored from Corner A
                w.end.x = w.start.x + dir.x * targetL;
                w.end.y = w.start.y + dir.y * targetL;
                newPt = w.end;
              }
              // Move connected adjoining walls meeting at this junction
              if (ed.project && ed.project.plan && ed.project.plan.walls) {
                ed.project.plan.walls.forEach(function (other) {
                  if (!other || !other.start || !other.end || other.id === w.id) return;
                  if (Core.Vec2.dist(other.start, oldPt) < 60) {
                    other.start.x = newPt.x; other.start.y = newPt.y;
                  } else if (Core.Vec2.dist(other.end, oldPt) < 60) {
                    other.end.x = newPt.x; other.end.y = newPt.y;
                  }
                });
              }
              Core.detectRooms(ed.project);
              ed.pushHistory('Resize Wall');
              ed.render();
              self.renderInspector(ed.selected);
              if (self.render3DHome) self.render3DHome(true);
            }
          });
        }
        var elWallThick = document.getElementById('inspWallThick');
        if (elWallThick) {
          elWallThick.addEventListener('change', function (e) {
            w.thickness = parseFloat(e.target.value);
            ed.pushHistory('Change Wall Thickness');
            ed.render();
          });
        }
        var elWallH = document.getElementById('inspWallH');
        if (elWallH) {
          elWallH.addEventListener('change', function (e) {
            w.height = parseFloat(e.target.value);
            ed.pushHistory('Change Wall Height');
            ed.render();
          });
        }
        var elWallDado = document.getElementById('inspWallDado');
        if (elWallDado) {
          elWallDado.addEventListener('change', function (e) {
            w.dadoTile = e.target.checked;
            if (w.dadoTile) {
              if (!w.dadoSegments || !w.dadoSegments.length) {
                w.dadoSegments = [{ startOffset: 0, endOffset: Math.max(100, Math.round(lenMm)) }];
              }
            } else {
              delete w.dadoSegments;
            }
            ed.pushHistory('Toggle Wall Dado Tile');
            ed.render();
            self.renderInspector(ed.selected);
            if (self.saveToLocalStorage) self.saveToLocalStorage();
            if (self.render3DHome) self.render3DHome(true);
            if (typeof window.toast === 'function') {
              window.toast(w.dadoTile ? '🧱 Dado Tile Enabled (drag green handles or adjust length in Inspector)' : '🧱 Dado Tile Removed from Wall');
            }
          });
        }
        var elWallDadoStart = document.getElementById('inspWallDadoStart');
        var elWallDadoLen = document.getElementById('inspWallDadoLen');
        var elWallDadoFull = document.getElementById('inspWallDadoFull');
        var applyWallDadoInputs = function (changedStart) {
          var maxW = Math.max(100, Math.round(lenMm));
          var sVal = elWallDadoStart ? (parseFloat(elWallDadoStart.value) || 0) : dStartOff;
          var lVal = elWallDadoLen ? (parseFloat(elWallDadoLen.value) || dLenMm) : dLenMm;
          if (changedStart) {
            sVal = Math.max(0, Math.min(maxW - 100, Math.round(sVal)));
            lVal = Math.max(100, Math.min(maxW - sVal, Math.round(lVal)));
          } else {
            sVal = Math.max(0, Math.min(maxW - 100, Math.round(dStartOff)));
            lVal = Math.max(100, Math.min(maxW - sVal, Math.round(lVal)));
          }
          w.dadoTile = true;
          w.dadoSegments = [{ startOffset: sVal, endOffset: Math.min(maxW, sVal + lVal) }];
          ed.pushHistory('Resize Wall Dado Tile');
          ed.render();
          self.renderInspector(ed.selected);
          if (self.saveToLocalStorage) self.saveToLocalStorage();
          if (self.render3DHome) self.render3DHome(true);
        };
        if (elWallDadoStart) {
          elWallDadoStart.addEventListener('change', function () { applyWallDadoInputs(true); });
        }
        if (elWallDadoLen) {
          elWallDadoLen.addEventListener('change', function () { applyWallDadoInputs(false); });
        }
        if (elWallDadoFull) {
          elWallDadoFull.addEventListener('click', function () {
            w.dadoTile = true;
            w.dadoSegments = [{ startOffset: 0, endOffset: Math.max(100, Math.round(lenMm)) }];
            ed.pushHistory('Reset Wall Dado Full Length');
            ed.render();
            self.renderInspector(ed.selected);
            if (self.saveToLocalStorage) self.saveToLocalStorage();
            if (self.render3DHome) self.render3DHome(true);
          });
        }
        var elWallDadoFlip = document.getElementById('inspWallDadoFlip');
        if (elWallDadoFlip) {
          elWallDadoFlip.addEventListener('click', function () {
            var curSide = w.dadoSide || 'front';
            w.dadoSide = (curSide === 'front' ? 'back' : 'front');
            ed.pushHistory('Flip Wall Dado Side');
            self.renderInspector(ed.selected);
            if (self.saveToLocalStorage) self.saveToLocalStorage();
            if (self.render3DHome) self.render3DHome(true);
            if (typeof window.toast === 'function') {
              window.toast('🧱 Dado Tile Flipped to ' + (w.dadoSide === 'front' ? 'Front' : 'Back') + ' Face');
            }
          });
        }
        var elWallDadoStyle = document.getElementById('inspWallDadoStyle');
        if (elWallDadoStyle) {
          elWallDadoStyle.addEventListener('change', function (e) {
            w.dadoTileStyle = e.target.value;
            ed.pushHistory('Change Wall Dado Style');
            if (self.render3DHome) self.render3DHome(true);
            if (typeof window.toast === 'function') {
              var selOpt = elWallDadoStyle.options[elWallDadoStyle.selectedIndex];
              window.toast('🧱 Wall Dado Tile: ' + (selOpt ? selOpt.textContent : w.dadoTileStyle));
            }
          });
        }
        
        var elWallColor = document.getElementById('inspWallColor');
        if (elWallColor) {
          elWallColor.addEventListener('input', function () {
            w.paintColor = this.value;
            ed.render();
            if (self.render3DHome) self.render3DHome(true);
          });
          elWallColor.addEventListener('change', function () {
            ed.pushHistory('Change Wall Color');
            if (self.saveToLocalStorage) self.saveToLocalStorage();
          });
        }
        var elWallFinishType = document.getElementById('inspWallFinishType');
        if (elWallFinishType) {
          elWallFinishType.addEventListener('change', function () {
            w.wallFinishType = this.value;
            ed.pushHistory('Change Wall Finish');
            ed.render();
            if (self.render3DHome) self.render3DHome(true);
            if (self.saveToLocalStorage) self.saveToLocalStorage();
          });
        }
        var elWallpaper = document.getElementById('inspWallpaper');
        if (elWallpaper) {
          elWallpaper.addEventListener('change', function () {
            w.wallpaper = this.value;
            ed.pushHistory('Change Wall Wallpaper');
            ed.render();
            if (self.render3DHome) self.render3DHome(true);
            if (self.saveToLocalStorage) self.saveToLocalStorage();
          });
        }

        
        var elSplitMid = document.getElementById('inspWallSplitMid');
        if (elSplitMid) {
          elSplitMid.addEventListener('click', function () {
            var midPt = { x: (w.start.x + w.end.x) / 2, y: (w.start.y + w.end.y) / 2 };
            var res = Core.splitWall(ed.project, w.id, midPt);
            if (res) {
              if (Core.detectRooms) Core.detectRooms(ed.project);
              ed.pushHistory('Insert RCC Column Joint');
              ed.selected = [{ type: 'wall', id: res.wall1.id }];
              ed.render();
              self.renderInspector(ed.selected);
              if (self.render3DHome) self.render3DHome(true);
              if (typeof window.toast === 'function') {
                window.toast('🧱 RCC Joint inserted: Wall separated into two individual walls');
              }
            }
          });
        }

        var elSplitCustom = document.getElementById('inspWallSplitCustom');
        var elSplitDist = document.getElementById('inspWallSplitDist');
        if (elSplitCustom && elSplitDist) {
          elSplitCustom.addEventListener('click', function () {
            var dist = parseFloat(elSplitDist.value);
            if (!isNaN(dist) && dist > 50 && dist < lenMm - 50) {
              var dir = Core.wallDirection(w);
              var splitPt = { x: w.start.x + dir.x * dist, y: w.start.y + dir.y * dist };
              var res = Core.splitWall(ed.project, w.id, splitPt);
              if (res) {
                if (Core.detectRooms) Core.detectRooms(ed.project);
                ed.pushHistory('Insert RCC Column Joint');
                ed.selected = [{ type: 'wall', id: res.wall1.id }];
                ed.render();
                self.renderInspector(ed.selected);
                if (self.render3DHome) self.render3DHome(true);
                if (typeof window.toast === 'function') {
                  window.toast('🧱 Wall separated into two individual walls at ' + Math.round(dist) + 'mm');
                }
              }
            }
          });
        }

        var elDelWall = document.getElementById('inspDelWall');
        if (elDelWall) {
          elDelWall.addEventListener('click', function () {
            ed.deleteSelected();
          });
        }
            } else if (sel.type === 'stair') {
        var stairId = sel.id;
        var planTarget = (this.project && this.project.plan) || (this.editor && this.editor.project && this.editor.project.plan);
        var stair = (planTarget && planTarget.stairs ? planTarget.stairs : []).find(function (st) { return st.id === stairId; });
        if (!stair) {
          panel.innerHTML = '<div style="padding:16px;color:#64748b;font-size:12px;">Staircase not found</div>';
          return;
        }

        var inspHtml = '<div style="padding:16px;">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">' +
          '<span style="font-weight:700;font-size:14px;color:#0f172a;">🪜 Architectural Staircase</span>' +
          '<span style="font-size:11px;font-weight:700;background:#e0f2fe;color:#0369a1;padding:2px 8px;border-radius:10px;">' +
          (stair.type || 'l_shape').toUpperCase() + '</span>' +
          '</div>' +

          '<div class="form-group" style="margin-bottom:10px;">' +
          '<label class="form-label" style="font-size:11px;font-weight:600;color:#475569;">Staircase Layout</label>' +
          '<select class="form-select" id="inspStairType" style="font-size:12px;padding:6px;width:100%;">' +
          '<option value="l_shape"' + (stair.type === 'l_shape' ? ' selected' : '') + '>L-Shape (Quarter Turn 90°)</option>' +
          '<option value="u_shape"' + (stair.type === 'u_shape' ? ' selected' : '') + '>U-Shape (Half Turn 180° Dogleg)</option>' +
          '<option value="straight"' + (stair.type === 'straight' ? ' selected' : '') + '>Straight Flight Run</option>' +
          '</select>' +
          '</div>' +

          '<div class="form-group" style="margin-bottom:10px;">' +
          '<label class="form-label" style="font-size:11px;font-weight:600;color:#475569;">Turn Direction</label>' +
          '<div style="display:flex;gap:6px;">' +
          '<button type="button" class="btn small full ' + (stair.turnDirection === 'right' ? 'primary' : '') + '" id="inspStairTurnRight" style="' + (stair.turnDirection === 'right' ? 'background:#0284c7;color:#fff;' : '') + '">Turn Right ↱</button>' +
          '<button type="button" class="btn small full ' + (stair.turnDirection === 'left' ? 'primary' : '') + '" id="inspStairTurnLeft" style="' + (stair.turnDirection === 'left' ? 'background:#0284c7;color:#fff;' : '') + '">Turn Left ↰</button>' +
          '</div>' +
          '</div>' +

          '<div class="form-group" style="margin-bottom:10px;">' +
          '<label class="form-label" style="font-size:11px;font-weight:600;color:#475569;">Flight Width: <b id="stairWidthVal">' + stair.width + ' mm</b></label>' +
          '<input type="range" id="inspStairWidth" min="750" max="1300" step="50" value="' + stair.width + '" style="width:100%;">' +
          '</div>' +

          '<div class="form-group" style="margin-bottom:10px;">' +
          '<label class="form-label" style="font-size:11px;font-weight:600;color:#475569;">Tread Finish</label>' +
          '<select class="form-select" id="inspStairFinish" style="font-size:12px;padding:6px;width:100%;">' +
          '<option value="marble"' + (stair.finish === 'marble' ? ' selected' : '') + '>🏛️ Statuario White Marble</option>' +
          '<option value="wood"' + (stair.finish === 'wood' ? ' selected' : '') + '>🪵 Warm Teak Hardwood</option>' +
          '<option value="concrete"' + (stair.finish === 'concrete' ? ' selected' : '') + '>🏢 Modern Basalt Stone / Concrete</option>' +
          '</select>' +
          '</div>' +

          '<div class="form-group" style="margin-bottom:14px;">' +
          '<label class="form-label" style="font-size:11px;font-weight:600;color:#475569;">Balustrade & Railing Style</label>' +
          '<select class="form-select" id="inspStairRailing" style="font-size:12px;padding:6px;width:100%;">' +
          '<option value="glass_steel"' + (stair.railing === 'glass_steel' ? ' selected' : '') + '>✨ Tempered Glass & Stainless Steel</option>' +
          '<option value="black_metal"' + (stair.railing === 'black_metal' ? ' selected' : '') + '>⬛ Matte Black Metal Spindles</option>' +
          '</select>' +
          '</div>' +

          '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px;margin-bottom:14px;font-size:11px;color:#475569;line-height:1.5;">' +
          '<div>📐 <b>Total Rise:</b> ' + (stair.totalHeight || 2800) + ' mm (Ceiling Level)</div>' +
          '<div>🪜 <b>Steps:</b> ' + (stair.riserCount || 16) + ' Risers @ ' + (stair.riserHeight || 175) + ' mm</div>' +
          '<div>🦶 <b>Tread Going:</b> ' + (stair.treadDepth || 250) + ' mm</div>' +
          '</div>' +

          '<div style="display:flex;gap:6px;margin-bottom:10px;">' +
          '<button type="button" class="btn small full" id="inspStairRotate90">↻ Rotate 90°</button>' +
          '<button type="button" class="btn small danger full" id="inspStairDelete" style="background:#dc2626;color:#fff;">🗑️ Delete</button>' +
          '</div>' +
          '</div>';

        panel.innerHTML = inspHtml;

        // Event listeners
        var selfUi = this;
        var typeSel = document.getElementById('inspStairType');
        if (typeSel) {
          typeSel.addEventListener('change', function () {
            stair.type = this.value;
            selfUi.editor.render();
            if (selfUi.render3DHome) selfUi.render3DHome(true);
            selfUi.renderInspector(selfUi.editor.selected);
          });
        }
        var btnTurnR = document.getElementById('inspStairTurnRight');
        if (btnTurnR) {
          btnTurnR.addEventListener('click', function () {
            stair.turnDirection = 'right';
            selfUi.editor.render();
            if (selfUi.render3DHome) selfUi.render3DHome(true);
            selfUi.renderInspector(selfUi.editor.selected);
          });
        }
        var btnTurnL = document.getElementById('inspStairTurnLeft');
        if (btnTurnL) {
          btnTurnL.addEventListener('click', function () {
            stair.turnDirection = 'left';
            selfUi.editor.render();
            if (selfUi.render3DHome) selfUi.render3DHome(true);
            selfUi.renderInspector(selfUi.editor.selected);
          });
        }
        var widthSlider = document.getElementById('inspStairWidth');
        if (widthSlider) {
          widthSlider.addEventListener('input', function () {
            stair.width = parseInt(this.value, 10);
            stair.landingWidth = stair.width;
            var wVal = document.getElementById('stairWidthVal');
            if (wVal) wVal.textContent = stair.width + ' mm';
            selfUi.editor.render();
            if (selfUi.render3DHome) selfUi.render3DHome(true);
          });
        }
        var finishSel = document.getElementById('inspStairFinish');
        if (finishSel) {
          finishSel.addEventListener('change', function () {
            stair.finish = this.value;
            selfUi.editor.render();
            if (selfUi.render3DHome) selfUi.render3DHome(true);
          });
        }
        var railSel = document.getElementById('inspStairRailing');
        if (railSel) {
          railSel.addEventListener('change', function () {
            stair.railing = this.value;
            selfUi.editor.render();
            if (selfUi.render3DHome) selfUi.render3DHome(true);
          });
        }
        var btnRot = document.getElementById('inspStairRotate90');
        if (btnRot) {
          btnRot.addEventListener('click', function () {
            stair.rotY = ((stair.rotY || 0) + Math.PI / 2) % (Math.PI * 2);
            selfUi.editor.render();
            if (selfUi.render3DHome) selfUi.render3DHome(true);
          });
        }
        var btnDel = document.getElementById('inspStairDelete');
        if (btnDel) {
          btnDel.addEventListener('click', function () {
            var targetPlan = (selfUi.project && selfUi.project.plan) || (selfUi.editor && selfUi.editor.project && selfUi.editor.project.plan);
            if (targetPlan && targetPlan.stairs) {
              targetPlan.stairs = targetPlan.stairs.filter(function (st) { return st.id !== stair.id; });
            }
            selfUi.editor.selected = [];
            selfUi.editor.render();
            if (selfUi.render3DHome) selfUi.render3DHome(true);
            selfUi.renderInspector(null);
          });
        }
        return;
      } else if (sel.type === 'opening') {
        var op = null;
        for (var i = 0; i < this.project.plan.openings.length; i++) {
          if (this.project.plan.openings[i].id === sel.id) { op = this.project.plan.openings[i]; break; }
        }
        if (!op) return;

        var wall = this.editor.getWall(op.wallId);
        var wallL = wall ? Math.round(Core.wallLength(wall)) : 5000;
        var minOff = Math.round(op.width / 2);
        var maxOff = Math.max(minOff, Math.round(wallL - op.width / 2));

        if (op.offset < minOff || op.offset > maxOff) {
          op.offset = Math.max(minOff, Math.min(maxOff, op.offset));
        }

        var distA = Math.round(op.offset - op.width / 2);
        var distB = Math.round(wallL - (op.offset + op.width / 2));

        panel.innerHTML =
          '<div class="insp-title">' + (op.type === 'door' ? 'Door' : 'Window') + ' Properties</div>' +
          '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:8px 10px;margin-bottom:12px;font-size:11px;font-family:monospace;color:#1e40af;line-height:1.4;">' +
          '<div style="font-weight:700;margin-bottom:4px;color:#1e3a8a;">📐 Segmented Measurements</div>' +
          '<div class="insp-op-banner" style="display:flex;justify-content:space-between;align-items:center;">' +
          '<span id="inspOpBannerA"><b>Corner A (1):</b> ' + distA + ' mm</span>' +
          '<span id="inspOpBannerW"><b>Width:</b> ' + Math.round(op.width) + ' mm</span>' +
          '<span id="inspOpBannerB"><b>(2) Corner B:</b> ' + distB + ' mm</span>' +
          '</div></div>' +
          '<div class="insp-row"><label>Distance from Corner A (1) [mm]</label><input type="number" id="inspOpDistA" value="' + distA + '" min="0" max="' + (wallL - op.width) + '" step="10"></div>' +
          '<div class="insp-row"><label>Opening Width (mm)</label><input type="number" id="inspOpW" value="' + Math.round(op.width) + '" min="400" max="3000" step="50"></div>' +
          '<div class="insp-row"><label>Distance to Corner B (2) [mm]</label><input type="number" id="inspOpDistB" value="' + distB + '" min="0" max="' + (wallL - op.width) + '" step="10"></div>' +
          '<div class="insp-row"><label>Height (mm)</label><input type="number" id="inspOpH" value="' + op.height + '" min="500" max="3500" step="50"></div>' +
          '<div class="insp-row"><label>Offset along wall (mm)</label><input type="number" id="inspOpOff" value="' + Math.round(op.offset) + '" min="' + minOff + '" max="' + maxOff + '" step="50"></div>' +
          '<div style="font-size:10.5px;color:#64748B;margin:-4px 0 10px 0;">Total Wall Length: ' + wallL + ' mm</div>' +
          (op.type === 'door' ?
            '<div class="insp-row"><label>Door Subtype</label><select id="inspOpDoorType">' +
            '<option value="single_closed"' + ((op.doorType || 'single_closed') === 'single_closed' ? ' selected' : '') + '>Single Door (Closed)</option>' +
            '<option value="double"' + (op.doorType === 'double' ? ' selected' : '') + '>Double Door</option>' +
            '<option value="sliding"' + (op.doorType === 'sliding' ? ' selected' : '') + '>Sliding Door</option>' +
            '<option value="frame_only"' + (op.doorType === 'frame_only' ? ' selected' : '') + '>Only Door Frame (Cased)</option>' +
            '</select></div>' +
            '<div class="insp-row"><label>Hinge / Handle Side</label><select id="inspOpSwing">' +
            '<option value="in-left"' + ((op.swing || 'in-left') === 'in-left' ? ' selected' : '') + '>Left Hinge / Right Handle</option>' +
            '<option value="in-right"' + (op.swing === 'in-right' ? ' selected' : '') + '>Right Hinge / Left Handle</option>' +
            '</select></div>' :
            '<div class="insp-row"><label>Window Subtype</label><select id="inspOpWindowType">' +
            '<option value="sliding"' + ((op.windowType || 'sliding') === 'sliding' ? ' selected' : '') + '>Sliding Window (Bypass)</option>' +
            '<option value="flapup"' + (op.windowType === 'flapup' ? ' selected' : '') + '>Flap-up (Awning/Hopper)</option>' +
            '<option value="standard"' + (op.windowType === 'standard' ? ' selected' : '') + '>Standard / Fixed</option>' +
            '</select></div>' +
            '<div class="insp-row"><label>Sill Height (mm)</label><input type="number" id="inspOpSill" value="' + (op.sillHeight || 900) + '" min="0" max="2500" step="50"></div>'
          ) +
          '<button class="btn danger full" id="inspDelOp" style="margin-top:12px">Delete ' + (op.type === 'door' ? 'Door' : 'Window') + '</button>';

        var updateOp = function (skipOffsetRead) {
          var wVal = parseFloat(document.getElementById('inspOpW').value);
          var hVal = parseFloat(document.getElementById('inspOpH').value);
          if (!isNaN(wVal) && wVal >= 200) op.width = wVal;
          if (!isNaN(hVal) && hVal >= 200) op.height = hVal;

          var curWall = self.editor.getWall(op.wallId);
          var curWallL = curWall ? Core.wallLength(curWall) : wallL;
          var curMin = Math.round(op.width / 2);
          var curMax = Math.max(curMin, Math.round(curWallL - op.width / 2));

          if (!skipOffsetRead) {
            var offEl = document.getElementById('inspOpOff');
            var offVal = offEl ? parseFloat(offEl.value) : NaN;
            if (!isNaN(offVal)) {
              op.offset = Math.max(curMin, Math.min(curMax, offVal));
            }
          } else {
            op.offset = Math.max(curMin, Math.min(curMax, op.offset));
          }

          var liveDistA = Math.max(0, Math.round(op.offset - op.width / 2));
          var liveDistB = Math.max(0, Math.round(curWallL - (op.offset + op.width / 2)));

          // Synchronize input fields if not currently being typed into
          var elA = document.getElementById('inspOpDistA');
          var elB = document.getElementById('inspOpDistB');
          var elO = document.getElementById('inspOpOff');
          var elWInput = document.getElementById('inspOpW');

          if (elA && document.activeElement !== elA) elA.value = liveDistA;
          if (elB && document.activeElement !== elB) elB.value = liveDistB;
          if (elO && document.activeElement !== elO) elO.value = Math.round(op.offset);
          if (elWInput && document.activeElement !== elWInput) elWInput.value = Math.round(op.width);

          // Update banner in real time
          var bA = document.getElementById('inspOpBannerA');
          var bW = document.getElementById('inspOpBannerW');
          var bB = document.getElementById('inspOpBannerB');
          if (bA) bA.innerHTML = '<b>Corner A (1):</b> ' + liveDistA + ' mm';
          if (bW) bW.innerHTML = '<b>Width:</b> ' + Math.round(op.width) + ' mm';
          if (bB) bB.innerHTML = '<b>(2) Corner B:</b> ' + liveDistB + ' mm';

          var dTypeEl = document.getElementById('inspOpDoorType');
          if (dTypeEl) op.doorType = dTypeEl.value;
          var wTypeEl = document.getElementById('inspOpWindowType');
          if (wTypeEl) op.windowType = wTypeEl.value;
          var swingEl = document.getElementById('inspOpSwing');
          if (swingEl) op.swing = swingEl.value;
          var sillEl = document.getElementById('inspOpSill');
          if (sillEl) {
            var sVal = parseFloat(sillEl.value);
            if (!isNaN(sVal)) op.sillHeight = sVal;
          }

          self.editor.pushHistory('Edit ' + (op.type === 'door' ? 'Door' : 'Window'));
          self.saveToLocalStorage();
          if (window.OrbixProjects && window.OrbixProjects.saveActiveProject) {
            window.OrbixProjects.saveActiveProject({ plan: self.project });
          }
          self.editor.render();
          if (typeof self.render3DHome === 'function') {
            self.render3DHome();
          }
        };

        var handleDistA = function () {
          var val = parseFloat(document.getElementById('inspOpDistA').value);
          if (!isNaN(val)) {
            var curW = op.width || 800;
            var curWall = self.editor.getWall(op.wallId);
            var curWallL = curWall ? Core.wallLength(curWall) : wallL;
            var curMin = Math.round(curW / 2);
            var curMax = Math.max(curMin, Math.round(curWallL - curW / 2));
            op.offset = Math.max(curMin, Math.min(curMax, Math.round(val + curW / 2)));
            updateOp(true);
          }
        };

        var handleDistB = function () {
          var val = parseFloat(document.getElementById('inspOpDistB').value);
          if (!isNaN(val)) {
            var curW = op.width || 800;
            var curWall = self.editor.getWall(op.wallId);
            var curWallL = curWall ? Core.wallLength(curWall) : wallL;
            var curMin = Math.round(curW / 2);
            var curMax = Math.max(curMin, Math.round(curWallL - curW / 2));
            op.offset = Math.max(curMin, Math.min(curMax, Math.round(curWallL - val - curW / 2)));
            updateOp(true);
          }
        };

        var handleWidth = function () {
          var val = parseFloat(document.getElementById('inspOpW').value);
          if (!isNaN(val) && val >= 200) {
            var prevDistA = Math.max(0, Math.round(op.offset - op.width / 2));
            op.width = val;
            var curWall = self.editor.getWall(op.wallId);
            var curWallL = curWall ? Core.wallLength(curWall) : wallL;
            var curMin = Math.round(op.width / 2);
            var curMax = Math.max(curMin, Math.round(curWallL - op.width / 2));
            op.offset = Math.max(curMin, Math.min(curMax, Math.round(prevDistA + op.width / 2)));
            updateOp(true);
          }
        };

        var elDistA = document.getElementById('inspOpDistA');
        if (elDistA) {
          elDistA.addEventListener('input', handleDistA);
          elDistA.addEventListener('change', handleDistA);
        }
        var elDistB = document.getElementById('inspOpDistB');
        if (elDistB) {
          elDistB.addEventListener('input', handleDistB);
          elDistB.addEventListener('change', handleDistB);
        }
        var elW = document.getElementById('inspOpW');
        if (elW) {
          elW.addEventListener('input', handleWidth);
          elW.addEventListener('change', handleWidth);
        }

        ['input', 'change'].forEach(function (evt) {
          var elH = document.getElementById('inspOpH');
          if (elH) elH.addEventListener(evt, function () { updateOp(false); });
          var elOff = document.getElementById('inspOpOff');
          if (elOff) elOff.addEventListener(evt, function () { updateOp(false); });
          var elDT = document.getElementById('inspOpDoorType');
          if (elDT) elDT.addEventListener(evt, function () { updateOp(false); });
          var elWT = document.getElementById('inspOpWindowType');
          if (elWT) elWT.addEventListener(evt, function () { updateOp(false); });
          var elSw = document.getElementById('inspOpSwing');
          if (elSw) elSw.addEventListener(evt, function () { updateOp(false); });
          var elSi = document.getElementById('inspOpSill');
          if (elSi) elSi.addEventListener(evt, function () { updateOp(false); });
        });

        var elDelOp = document.getElementById('inspDelOp');
        if (elDelOp) {
          elDelOp.addEventListener('click', function () {
            self.editor.deleteSelected();
            self.saveToLocalStorage();
            if (window.OrbixProjects && window.OrbixProjects.saveActiveProject) {
              window.OrbixProjects.saveActiveProject({ plan: self.project });
            }
            if (typeof self.render3DHome === 'function') {
              self.render3DHome();
            }
          });
        }
      } else if (sel.type === 'furniture') {
        var fn = null;
        for (var f = 0; f < this.project.plan.furniture.length; f++) {
          if (this.project.plan.furniture[f].id === sel.id) { fn = this.project.plan.furniture[f]; break; }
        }
        if (!fn) return;

        var rooms = this.project.plan.rooms || [];
        var roomOptions = '<option value="">(None / General)</option>';
        for (var r = 0; r < rooms.length; r++) {
          roomOptions += '<option value="' + rooms[r].id + '"' + (fn.roomId === rooms[r].id ? ' selected' : '') + '>' + rooms[r].name + '</option>';
        }

        var shutterFinish = (fn.materials && fn.materials.shutter && fn.materials.shutter.finish) ||
                            (fn.unitConfig && fn.unitConfig.shutterCol) || 'Navy Blue Matte';
        var carcassFinish = (fn.materials && fn.materials.carcass && fn.materials.carcass.finish) ||
                            (fn.unitConfig && fn.unitConfig.carcass) || 'Gloss White';
        var curHandle = (fn.unitConfig && fn.unitConfig.handle) || fn.handleType || 'bar';
        var curHFinish = (fn.unitConfig && (fn.unitConfig.hfinish || fn.unitConfig.handleFinish)) || fn.handleFinish || 'black';
        var shuttersCount = (fn.unitConfig && fn.unitConfig.shutters !== undefined) ? fn.unitConfig.shutters : (fn.dimensions.W > 1200 ? 3 : fn.dimensions.W > 600 ? 2 : 1);
        var drawersCount = (fn.unitConfig && fn.unitConfig.drawers !== undefined) ? fn.unitConfig.drawers : 0;
        var isGLUnit = /(^|\b|_|-|\s)gl(\b|_|-|\s|\d+|$)/i.test(String(fn.name || '') + ' ' + String(fn.code || '') + ' ' + String(fn.id || ''));
        var doorStyle = (fn.unitConfig && fn.unitConfig.dstyle) || (isGLUnit ? 'glass' : 'slab');
        if (isGLUnit && (!doorStyle || doorStyle === 'slab')) doorStyle = 'glass';
        var handleType = (fn.unitConfig && fn.unitConfig.handle) || 'gprof';
        var isWall = (window.OrbixCore && window.OrbixCore.isWallUnit) ?
          window.OrbixCore.isWallUnit(fn.category, fn.name, fn.code || fn.catalogItemId, fn.costCategory) :
          ((fn.category && fn.category.toLowerCase().indexOf('wall') !== -1) ||
           (fn.name && fn.name.toLowerCase().indexOf('wall') !== -1) ||
           fn.category === 'kitchen_wall' ||
           /(^|\b|_|-)(wm|wcm)($|\b|_|-|\d+)/i.test(fn.name));

        var isKitchenBase = !isWall && (
          fn.category === 'kitchen_base' || fn.category === 'kitchen_fm' || fn.category === 'kitchen_corner' || fn.category === 'kitchen_drawers' ||
          /(^|\b|_|-)(fm|fcm|fbcm)($|\b|_|-|\d+)/i.test(fn.name) ||
          (fn.id && /(^|\b|_|-)(fm|fcm|fbcm)($|\b|_|-|\d+)/i.test(fn.id)) ||
          (fn.catalogItemId && /(^|\b|_|-)(fm|fcm|fbcm)($|\b|_|-|\d+)/i.test(fn.catalogItemId)) ||
          (fn.costCategory && (fn.costCategory.indexOf('FM') !== -1 || fn.costCategory.indexOf('Base') !== -1 || fn.costCategory.indexOf('D2/D3') !== -1))
        );
        var isBaseUnit = !isWall && (isKitchenBase || fn.category === 'kitchen_base' || fn.category === 'kitchen_fm' || fn.category === 'kitchen_corner' || fn.category === 'kitchen_drawers' || fn.category === 'crockery' || fn.category === 'vanity' || fn.category === 'tv_unit' || (fn.category && fn.category.indexOf('base') !== -1) || (fn.name && fn.name.toLowerCase().indexOf('base') !== -1));
        var isTvOrVanity = (fn.category === 'tv_unit' || fn.category === 'vanity' || (fn.name && (fn.name.toLowerCase().indexOf('tv') !== -1 || fn.name.toLowerCase().indexOf('vanity') !== -1)));
        var isWardrobeOrTall = (fn.category === 'wardrobe' || fn.category === 'kitchen_tall' || (fn.name && (fn.name.toLowerCase().indexOf('wardrobe') !== -1 || fn.name.toLowerCase().indexOf('tall') !== -1 || fn.name.toLowerCase().indexOf('tbm') !== -1)));
        var counterType = (fn.unitConfig && fn.unitConfig.counter) || (isBaseUnit ? 'granite_kashmir_white' : 'none');
        if (counterType === 'BLUE' || counterType === 'black' || counterType === 'galaxy') counterType = 'granite_black_galaxy';
        var hasHob = !!(fn.unitConfig && (fn.unitConfig.appliance === 'hob' || fn.unitConfig.hasHob));
        var hasSink = !!(fn.unitConfig && (fn.unitConfig.appliance === 'sink' || fn.unitConfig.hasSink));

        if (!fn.shutterColors) fn.shutterColors = [];
        if (!fn.shutterMaterials) fn.shutterMaterials = [];
        if (!fn.shutterStates) fn.shutterStates = [];

        var catInsp = (fn.category || '').toLowerCase();
        var nmInsp = (fn.name || '').toLowerCase();
        var idInsp = (fn.id || '').toLowerCase();
        var cdInsp = (fn.code || fn.catalogItemId || '').toLowerCase();
        var isLoftInsp = (catInsp.indexOf('loft') !== -1 || nmInsp.indexOf('loft') !== -1 || idInsp.indexOf('loft') !== -1 || cdInsp.indexOf('loft') !== -1);
        var isOpenBoxInsp = (nmInsp.indexOf('open box') !== -1 || nmInsp.indexOf('open_box') !== -1 || idInsp.indexOf('ob-') === 0 || idInsp.indexOf('open-box') !== -1 || cdInsp.indexOf('ob-') === 0);
        var isSpiceInsp = !isOpenBoxInsp && (catInsp.indexOf('spice') !== -1 || nmInsp.indexOf('spice') !== -1 || idInsp.indexOf('spice') !== -1 || idInsp.indexOf('sr-') === 0);
        var isRollingInsp = !!(
          idInsp === 'wfm60-roll' || cdInsp === 'wfm60-roll' || /rolling\s*shutter|wfm.*roll/i.test(nmInsp + ' ' + idInsp) ||
          (fn.unitConfig && (fn.unitConfig.isRollingShutter || fn.unitConfig.shutterType === 'rolling_shutter'))
        );
        var isWallInsp = !isLoftInsp && !isRollingInsp && isWall;
        var defInspElev = isRollingInsp ? 750 : (isLoftInsp ? 2100 : (isOpenBoxInsp ? 1500 : (isSpiceInsp ? 1350 : (isWallInsp ? 1500 : 0))));

        var curElev = (fn.elevation !== undefined && fn.elevation !== null && fn.elevation !== '' && (!isWallInsp && !isLoftInsp && !isSpiceInsp && !isOpenBoxInsp && !isRollingInsp || parseFloat(fn.elevation) > 0)) ?
          parseFloat(fn.elevation) :
          ((fn.pos && fn.pos.z !== undefined && fn.pos.z !== null && (!isWallInsp && !isLoftInsp && !isSpiceInsp && !isOpenBoxInsp && !isRollingInsp || parseFloat(fn.pos.z) > 0)) ? parseFloat(fn.pos.z) : defInspElev);

        var hasLegs = false;
        if (!isWall) {
          if (fn.unitConfig && fn.unitConfig.hasLegs !== undefined) {
            hasLegs = !!fn.unitConfig.hasLegs;
          } else if (fn.unitConfig && fn.unitConfig.mountType !== undefined) {
            hasLegs = (fn.unitConfig.mountType !== 'floating');
          } else if (isTvOrVanity) {
            hasLegs = (parseFloat(curElev) <= 50);
          } else if (isWardrobeOrTall || isBaseUnit) {
            hasLegs = true;
          }
        }

        var shutterItemsHtml = '';
        for (var s = 0; s < shuttersCount; s++) {
          var rawCol = (fn.shutterColors && fn.shutterColors[s]);
          var fallbackHex = (shutterFinish.indexOf('White') !== -1 ? '#edebe4' : shutterFinish.indexOf('Sage') !== -1 ? '#7a8875' : shutterFinish.indexOf('Oak') !== -1 ? '#c8b293' : '#6e4e35');
          var sColor = toValidHexColor(rawCol, toValidHexColor(shutterFinish, fallbackHex));
          var sMat = (fn.shutterMaterials && fn.shutterMaterials[s]) || shutterFinish;
          var sOpen = !!(fn.shutterStates && fn.shutterStates[s]);

          shutterItemsHtml +=
            '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:6px 8px;margin-bottom:6px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">' +
            '<span style="font-weight:600;font-size:11px;color:#334155;">Shutter ' + (s + 1) + ' (' + (s % 2 === 0 ? 'Left' : 'Right') + ')</span>' +
            '<button class="btn small inspShutterToggle" data-sidx="' + s + '" style="font-size:10px;padding:2px 8px;background:' + (sOpen ? '#10b981' : '#f1f5f9') + ';color:' + (sOpen ? '#ffffff' : '#334155') + ';border-color:' + (sOpen ? '#059669' : '#cbd5e1') + '">' + (sOpen ? 'Open 🚪' : 'Closed') + '</button>' +
            '</div>' +
            '<div style="display:flex;gap:6px;align-items:center;">' +
            '<input type="color" class="inspShutterColorInput" data-sidx="' + s + '" value="' + sColor + '" style="width:28px;height:24px;padding:0;border:1px solid #cbd5e1;border-radius:4px;cursor:pointer;">' +
            '<select class="inspShutterMatSelect" data-sidx="' + s + '" style="flex:1;font-size:11px;padding:3px 4px;border:1px solid #cbd5e1;border-radius:4px;">' +
            '<option value="Brazilian Horizontal Walnut"' + (sMat.indexOf('Walnut') !== -1 ? ' selected' : '') + '>Brazilian Walnut</option>' +
            '<option value="Absolute White"' + (sMat.indexOf('White') !== -1 || sMat.indexOf('Gloss') !== -1 ? ' selected' : '') + '>Absolute White Gloss</option>' +
            '<option value="Sage Green Matte"' + (sMat.indexOf('Sage') !== -1 ? ' selected' : '') + '>Sage Green Matte</option>' +
            '<option value="Sonoma Oak"' + (sMat.indexOf('Oak') !== -1 ? ' selected' : '') + '>Sonoma Oak</option>' +
            '<option value="Concrete Look"' + (sMat.indexOf('Concrete') !== -1 ? ' selected' : '') + '>Concrete Look</option>' +
            '</select>' +
            '</div>' +
            '</div>';
        }

        var drawerItemsHtml = '';
        if (drawersCount > 0) {
          if (!fn.drawerStates) fn.drawerStates = [];
          for (var d = 0; d < drawersCount; d++) {
            var dOpen = !!(fn.drawerStates && fn.drawerStates[d]);
            drawerItemsHtml +=
              '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:6px 8px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;">' +
              '<span style="font-weight:600;font-size:11px;color:#334155;">Drawer ' + (d + 1) + '</span>' +
              '<button class="btn small inspDrawerToggle" data-didx="' + d + '" style="font-size:10px;padding:2px 8px;background:' + (dOpen ? '#10b981' : '#f1f5f9') + ';color:' + (dOpen ? '#ffffff' : '#334155') + ';border-color:' + (dOpen ? '#059669' : '#cbd5e1') + '">' + (dOpen ? 'Open 🗄' : 'Closed') + '</button>' +
              '</div>';
          }
        }

        var drawerSectionHtml = '';
        if (drawersCount > 0) {
          drawerSectionHtml =
            '<div style="margin:8px 0 8px 0;padding:8px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
            '<span style="font-weight:700;font-size:11.5px;color:#166534;">🗄 Drawers</span>' +
            '<div style="display:flex;gap:4px;">' +
            '<button class="btn small" id="inspDrawerOpenAll" style="font-size:10px;padding:2px 6px;">Open All</button>' +
            '<button class="btn small" id="inspDrawerCloseAll" style="font-size:10px;padding:2px 6px;">Close All</button>' +
            '</div></div>' +
            drawerItemsHtml +
            '</div>';
        }

        var isSliding = (fn.unitConfig && (fn.unitConfig.doorType === "sliding" || fn.unitConfig.type === "sliding")) ||
                        fn.doorType === "sliding" ||
                        fn.type === "sliding" ||
                        (fn.modelType && /sliding/i.test(fn.modelType)) ||
                        (fn.name && /sliding/i.test(fn.name));

        var isLCornerUnit = !!(
          (fn.unitConfig && (fn.unitConfig.geometryType === 'l_shaped_corner' || fn.unitConfig.unitType === 'fbcm' || fn.unitConfig.unitType === 'wbcm' || (fn.unitConfig.corner && fn.unitConfig.corner.enabled))) ||
          fn.catalogItemId === 'fbcm' || fn.id === 'fbcm' || fn.id === 'f_fbcm_1' || fn.catalogItemId === 'fbcm-1500' || fn.catalogItemId === 'wbcm' ||
          (fn.id && /fbcm|wbcm/i.test(fn.id)) ||
          (fn.catalogItemId && /fbcm|wbcm/i.test(fn.catalogItemId)) ||
          (fn.code && /fbcm|wbcm/i.test(fn.code)) ||
          (fn.name && /l[-_ ]*shaped.*corner|\bwbcm\b|\bfbcm\b/i.test(fn.name))
        );
        var isWallCornerU = Core.isWallUnit ? Core.isWallUnit(fn.category, fn.name, fn.code || fn.catalogItemId, fn.costCategory) : (fn.elevation >= 1000 || (fn.unitConfig && fn.unitConfig.ctype === 'kwall'));
        var defCornerLeg = isWallCornerU ? 600 : 900;
        var defCornerD = isWallCornerU ? 300 : 550;
        var curLegW = (fn.unitConfig && fn.unitConfig.corner && fn.unitConfig.corner.legW) || fn.dimensions.W || defCornerLeg;
        var curLegD = (fn.unitConfig && fn.unitConfig.corner && fn.unitConfig.corner.legD) || (fn.dimensions.D && fn.dimensions.D >= 500 ? fn.dimensions.D : (fn.dimensions.W || defCornerLeg));
        var curCornerDepth = (fn.unitConfig && fn.unitConfig.corner && fn.unitConfig.corner.depth) || (fn.dimensions.D && fn.dimensions.D < curLegW ? fn.dimensions.D : defCornerD);
        var curShutterA = Math.max(0, Math.round(curLegW - curCornerDepth));
        var curShutterB = Math.max(0, Math.round(curLegD - curCornerDepth));
        var fbcmHtml = !isLCornerUnit ? '' : (
          '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px;margin-bottom:10px;box-shadow:0 1px 2px rgba(0,0,0,0.03);">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
              '<span style="font-size:11px;font-weight:700;color:#1e40af;text-transform:uppercase;letter-spacing:0.5px;">📐 L-Corner Both Sides & Shutters</span>' +
              '<span style="font-size:10px;color:#3b82f6;font-weight:600;">Independent Wings</span>' +
            '</div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;">' +
              '<div>' +
                '<label style="font-size:10px;font-weight:700;color:#1e3a8a;display:block;margin-bottom:2px;">Side 1 (Arm A) Length</label>' +
                '<input type="number" id="inspFbcmLegW" value="' + curLegW + '" step="50" style="width:100%;font-size:11.5px;padding:4px 6px;border:1px solid #93c5fd;border-radius:4px;font-weight:600;color:#1e3a8a;">' +
              '</div>' +
              '<div>' +
                '<label style="font-size:10px;font-weight:700;color:#1e3a8a;display:block;margin-bottom:2px;">Shutter 1 (Arm A)</label>' +
                '<input type="number" id="inspFbcmShutterA" value="' + curShutterA + '" step="50" style="width:100%;font-size:11.5px;padding:4px 6px;border:1px solid #93c5fd;border-radius:4px;font-weight:600;color:#1d4ed8;">' +
              '</div>' +
            '</div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;">' +
              '<div>' +
                '<label style="font-size:10px;font-weight:700;color:#1e3a8a;display:block;margin-bottom:2px;">Side 2 (Arm B) Length</label>' +
                '<input type="number" id="inspFbcmLegD" value="' + curLegD + '" step="50" style="width:100%;font-size:11.5px;padding:4px 6px;border:1px solid #93c5fd;border-radius:4px;font-weight:600;color:#1e3a8a;">' +
              '</div>' +
              '<div>' +
                '<label style="font-size:10px;font-weight:700;color:#1e3a8a;display:block;margin-bottom:2px;">Shutter 2 (Arm B)</label>' +
                '<input type="number" id="inspFbcmShutterB" value="' + curShutterB + '" step="50" style="width:100%;font-size:11.5px;padding:4px 6px;border:1px solid #93c5fd;border-radius:4px;font-weight:600;color:#1d4ed8;">' +
              '</div>' +
            '</div>' +
            '<div class="insp-row" style="margin-bottom:0;">' +
              '<label style="color:#1e3a8a;font-weight:600;">Corner Carcass Depth</label>' +
              '<input type="number" id="inspFbcmDepth" value="' + curCornerDepth + '" step="10" style="border:1px solid #93c5fd;border-radius:4px;">' +
            '</div>' +
          '</div>'
        );

        panel.innerHTML =
          '<div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e2e8f0;padding-bottom:8px;margin-bottom:12px;">' +
            '<div><div style="font-size:13px;font-weight:700;color:#0f172a;">Unit Properties</div><div style="font-size:11px;color:#64748b;">' + (fn.name || "Modular Cabinet") + '</div></div>' +
            '<span style="font-size:10.5px;font-weight:600;background:' + (isRollingInsp ? "#ecfdf5;color:#047857;border:1px solid #a7f3d0;" : (isWall ? "#fef3c7;color:#b45309;border:1px solid #fde68a;" : isSliding ? "#f3e8ff;color:#7e22ce;border:1px solid #e9d5ff;" : "#e0f2fe;color:#0369a1;border:1px solid #bae6fd;")) + ';padding:2px 8px;border-radius:12px;">' +
              (isRollingInsp ? "Countertop Rolling Shutter (750mm)" : (isWall ? "Wall-Mounted (1500mm)" : isSliding ? "Sliding Wardrobe" : "Floor Unit (0mm)")) + '</span>' +
          '</div>' +

          // ── Card 1: Identity & Room ──
          '<div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:10px;margin-bottom:10px;box-shadow:0 1px 2px rgba(0,0,0,0.03);">' +
            '<div style="font-size:11px;font-weight:700;color:#475569;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">🏷️ Identity & Room</div>' +
            '<div class="insp-row" style="margin-bottom:6px;"><label>Item Name</label><input type="text" id="inspFurnName" value="' + fn.name + '"></div>' +
            '<div class="insp-row"><label>Room Assignment</label><select id="inspFurnRoom">' + roomOptions + '</select></div>' +
          '</div>' +

          // ── Card 2: Dimensions & Mounting Elevation ──
          '<div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:10px;margin-bottom:10px;box-shadow:0 1px 2px rgba(0,0,0,0.03);">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
              '<span style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.5px;">📐 Dimensions (mm)</span>' +
              '<span style="font-size:10px;color:#94a3b8;">W × H × D</span>' +
            '</div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:8px;">' +
              '<div><label style="font-size:10px;font-weight:600;color:#64748b;display:block;margin-bottom:2px;">Width</label><input type="number" id="inspFurnW" value="' + fn.dimensions.W + '" step="50" style="width:100%;font-size:11.5px;padding:4px 6px;"></div>' +
              '<div><label style="font-size:10px;font-weight:600;color:#64748b;display:block;margin-bottom:2px;">Height</label><input type="number" id="inspFurnH" value="' + fn.dimensions.H + '" step="50" style="width:100%;font-size:11.5px;padding:4px 6px;"></div>' +
              '<div><label style="font-size:10px;font-weight:600;color:#64748b;display:block;margin-bottom:2px;">Depth</label><input type="number" id="inspFurnD" value="' + fn.dimensions.D + '" step="50" style="width:100%;font-size:11.5px;padding:4px 6px;"></div>' +
            '</div>' +
            '<div class="insp-row" style="margin-bottom:4px;"><label>Floor Elevation (AFFL)</label><input type="number" id="inspFurnElev" value="' + curElev + '" step="50" min="0" max="3000"></div>' +
            '<div style="display:flex;gap:4px;margin-top:6px;">' +
              '<button type="button" class="btn small" id="btnPresetFloor" style="flex:1;font-size:10px;padding:3px;background:#f8fafc;border:1px solid #cbd5e1;">Floor (0 mm)</button>' +
              '<button type="button" class="btn small" id="btnPresetCounter" style="flex:1;font-size:10px;padding:3px;background:#ecfdf5;border:1px solid #a7f3d0;color:#047857;">Counter (750 mm)</button>' +
              '<button type="button" class="btn small" id="btnPresetWall" style="flex:1;font-size:10px;padding:3px;background:#fef3c7;border:1px solid #fde68a;color:#92400e;">Wall (1500 mm)</button>' +
              '<button type="button" class="btn small" id="btnPresetLoft" style="flex:1;font-size:10px;padding:3px;background:#ede9fe;border:1px solid #ddd6fe;color:#5b21b6;">Loft (2100 mm)</button>' +
            '</div>' +
            '<div style="margin-top:6px;">' +
              '<button type="button" class="btn small full" id="inspFocusUnitBtn3D" style="font-size:11px;padding:4px;background:#059669;color:#ffffff;border:none;border-radius:4px;cursor:pointer;font-weight:600;">🎯 Zoom / Focus Unit in 3D</button>' +
            '</div>' +
          '</div>' +

          fbcmHtml +

          // ── Card 3: Door Style & Mechanisms ──
          '<div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:10px;margin-bottom:10px;box-shadow:0 1px 2px rgba(0,0,0,0.03);">' +
            '<div style="font-size:11px;font-weight:700;color:#475569;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">🚪 Doors & Mechanism</div>' +
            '<div class="insp-row" style="margin-bottom:6px;"><label>Mechanism</label><select id="inspFurnDoorMech">' +
              '<option value="hinged"' + (!isSliding ? " selected" : "") + '>Hinged Doors (Pivot Swing)</option>' +
              '<option value="sliding"' + (isSliding ? " selected" : "") + '>Sliding Doors (Dual Track)</option>' +
            '</select></div>' +
            '<div class="insp-row" style="margin-bottom:6px;"><label>Door Style</label><select id="inspFurnDoorStyle">' +
              '<option value="slab"' + (doorStyle === "slab" ? " selected" : "") + '>Slab · Flat</option>' +
              '<option value="shaker"' + (doorStyle === "shaker" ? " selected" : "") + '>Shaker · Frame</option>' +
              '<option value="aluglass"' + (doorStyle === "aluglass" ? " selected" : "") + '>Aluminium Profile Glass</option>' +
              '<option value="fluted"' + (doorStyle === "fluted" ? " selected" : "") + '>Fluted / Reeded</option>' +
              '<option value="louvered"' + (doorStyle === "louvered" ? " selected" : "") + '>Louvered Slats</option>' +
              '<option value="cane"' + (doorStyle === "cane" ? " selected" : "") + '>Cane / Rattan</option>' +
              '<option value="glass"' + (doorStyle === "glass" ? " selected" : "") + '>Glass Frame</option>' +
              '<option value="mirror"' + (doorStyle === "mirror" ? " selected" : "") + '>Mirror Front</option>' +
            '</select></div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px;">' +
              '<div><label style="font-size:10px;font-weight:600;color:#64748b;display:block;margin-bottom:2px;">Shutters</label><input type="number" id="inspFurnShutters" value="' + shuttersCount + '" min="0" max="8" style="width:100%;font-size:11.5px;padding:4px 6px;"></div>' +
              '<div><label style="font-size:10px;font-weight:600;color:#64748b;display:block;margin-bottom:2px;">Drawers</label><input type="number" id="inspFurnDrawers" value="' + drawersCount + '" min="0" max="6" style="width:100%;font-size:11.5px;padding:4px 6px;"></div>' +
            '</div>' +
            (isBaseUnit ? ('<div class="insp-row" style="margin-bottom:6px;"><label>Countertop Slab</label><select id="inspFurnCounter">' +
              '<option value="granite_black_galaxy"' + (counterType === "granite_black_galaxy" || counterType === "black" || counterType === "galaxy" ? " selected" : "") + '>Realistic Granite 1: Black Galaxy (Polished)</option>' +
              '<option value="granite_kashmir_white"' + (counterType === "granite_kashmir_white" || counterType === "kashmir_white" || counterType === "river_white" ? " selected" : "") + '>Realistic Granite 2: Kashmir White (Polished)</option>' +
              '<option value="granite_tan_brown"' + (counterType === "granite_tan_brown" || counterType === "tan_brown" ? " selected" : "") + '>Realistic Granite 3: Tan Brown (Polished)</option>' +
              '<option value="quartz"' + (counterType === "quartz" ? " selected" : "") + '>Pure White Quartz</option>' +
              '<option value="white"' + (counterType === "white" || counterType === "marble" ? " selected" : "") + '>White Italian Marble</option>' +
              '<option value="greyq"' + (counterType === "greyq" ? " selected" : "") + '>Grey Quartz</option>' +
              '<option value="beige"' + (counterType === "beige" ? " selected" : "") + '>Beige Marble</option>' +
              '<option value="green"' + (counterType === "green" ? " selected" : "") + '>Green Granite</option>' +
              '<option value="none"' + (counterType === "none" ? " selected" : "") + '>None (Carcass Top)</option>' +
            '</select></div>' +
            '<div style="margin-top:8px;padding:8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;">' +
              '<div style="font-size:10.5px;font-weight:700;color:#334155;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">🍳 Built-in Countertop Appliances</div>' +
              '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">' +
                '<button type="button" class="btn small" id="inspToggleHobBtn" style="font-size:11px;padding:5px 8px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:4px;' + (hasHob ? 'background:#d97706;color:#ffffff;border-color:#b45309;' : 'background:#ffffff;color:#334155;border-color:#cbd5e1;') + '">' +
                  '<span>🔥 Built-in HOB</span>' + (hasHob ? ' ✓' : '') +
                '</button>' +
                '<button type="button" class="btn small" id="inspToggleSinkBtn" style="font-size:11px;padding:5px 8px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:4px;' + (hasSink ? 'background:#0284c7;color:#ffffff;border-color:#0369a1;' : 'background:#ffffff;color:#334155;border-color:#cbd5e1;') + '">' +
                  '<span>🚰 Kitchen Sink</span>' + (hasSink ? ' ✓' : '') +
                '</button>' +
              '</div>' +
            '</div>') : "") +
            (!isWall ? ('<div class="insp-row" style="margin-top:6px;"><label>Base & Legs</label><select id="inspFurnLegs">' +
              '<option value="legs"' + (hasLegs ? " selected" : "") + '>Floor Standing (100mm Legs / Plinth)</option>' +
              '<option value="floating"' + (!hasLegs ? " selected" : "") + '>Floating / Wall-Hung (No Legs)</option>' +
            '</select></div>') : "") +
          '</div>' +

          // ── Card 4: Materials & Laminate Finishes ──
          '<div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:10px;margin-bottom:10px;box-shadow:0 1px 2px rgba(0,0,0,0.03);">' +
            '<div style="font-size:11px;font-weight:700;color:#475569;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">🎨 Materials & Finishes</div>' +
            '<div class="insp-row" style="margin-bottom:6px;"><label>Carcass</label><select id="inspFurnCarcass">' +
              '<option value="MDF 6601"' + (carcassFinish.indexOf("Gloss") !== -1 || carcassFinish.indexOf("6601") !== -1 ? " selected" : "") + '>Gloss White (MDF 6601)</option>' +
              '<option value="Absolute White"' + (carcassFinish.indexOf("White") !== -1 && carcassFinish.indexOf("Gloss") === -1 && carcassFinish.indexOf("6601") === -1 || carcassFinish === "MDF 1135" ? " selected" : "") + '>Absolute White (MDF 1135)</option>' +
              '<option value="Brazilian Horizontal Walnut"' + (carcassFinish.indexOf("Walnut") !== -1 || carcassFinish === "MDF 3410" ? " selected" : "") + '>Walnut Woodgrain (MDF 3410)</option>' +
              '<option value="Sonoma Oak"' + (carcassFinish.indexOf("Oak") !== -1 || carcassFinish === "MDF 2204" ? " selected" : "") + '>Sonoma Oak (MDF 2204)</option>' +
              '<option value="Dark Wenge"' + (carcassFinish.indexOf("Wenge") !== -1 || carcassFinish === "MDF 3411" ? " selected" : "") + '>Dark Wenge (MDF 3411)</option>' +
              '<option value="Natural Teak"' + (carcassFinish.indexOf("Teak") !== -1 || carcassFinish === "MDF 2210" ? " selected" : "") + '>Natural Teak (MDF 2210)</option>' +
              '<option value="Grey Oak Scandi"' + (carcassFinish.indexOf("Grey") !== -1 || carcassFinish === "MDF 4402" ? " selected" : "") + '>Grey Oak (MDF 4402)</option>' +
              '<option value="Graphite Grey"' + (carcassFinish.indexOf("Graphite") !== -1 || carcassFinish === "MDF 5501" ? " selected" : "") + '>Graphite Grey (MDF 5501)</option>' +
              '<option value="Sage Green Matte"' + (carcassFinish.indexOf("Sage") !== -1 || carcassFinish === "MDF 7701" ? " selected" : "") + '>Sage Green Matte (MDF 7701)</option>' +
              '<option value="Charcoal Matte"' + (carcassFinish.indexOf("Charcoal") !== -1 || carcassFinish === "MDF 7702" ? " selected" : "") + '>Charcoal Matte (MDF 7702)</option>' +
              '<option value="Concrete Look"' + (carcassFinish.indexOf("Concrete") !== -1 || carcassFinish === "MDF 8801" ? " selected" : "") + '>Concrete Look (MDF 8801)</option>' +
              '<option value="Ivory Cream"' + (carcassFinish.indexOf("Ivory") !== -1 || carcassFinish === "MDF 1101" ? " selected" : "") + '>Ivory Cream (MDF 1101)</option>' +
            '</select></div>' +
            '<div class="insp-row"><label>Shutter Finish</label><select id="inspFurnShutter">' +
              '<option value="MDF 7707"' + (shutterFinish.indexOf("Navy") !== -1 || shutterFinish.indexOf("7707") !== -1 || shutterFinish === "BLUE" ? " selected" : "") + '>Navy Blue Matte (MDF 7707)</option>' +
              '<option value="Brazilian Horizontal Walnut"' + (shutterFinish.indexOf("Walnut") !== -1 || shutterFinish === "MDF 3410" ? " selected" : "") + '>Brazilian Walnut (MDF 3410)</option>' +
              '<option value="Absolute White Gloss"' + (shutterFinish.indexOf("Gloss") !== -1 || shutterFinish === "MDF 6601" ? " selected" : "") + '>Absolute White Gloss (MDF 6601)</option>' +
              '<option value="Absolute White Matte"' + (shutterFinish.indexOf("White") !== -1 && shutterFinish.indexOf("Gloss") === -1 && shutterFinish.indexOf("Navy") === -1 || shutterFinish === "MDF 1135" ? " selected" : "") + '>White Matte (MDF 1135)</option>' +
              '<option value="Sonoma Oak"' + (shutterFinish.indexOf("Oak") !== -1 || shutterFinish === "MDF 2204" ? " selected" : "") + '>Sonoma Oak (MDF 2204)</option>' +
              '<option value="Sage Green Matte"' + (shutterFinish.indexOf("Sage") !== -1 || shutterFinish === "MDF 7701" ? " selected" : "") + '>Sage Green Matte (MDF 7701)</option>' +
              '<option value="Dark Wenge"' + (shutterFinish.indexOf("Wenge") !== -1 || shutterFinish === "MDF 3411" ? " selected" : "") + '>Dark Wenge (MDF 3411)</option>' +
              '<option value="Natural Teak"' + (shutterFinish.indexOf("Teak") !== -1 || shutterFinish === "MDF 2210" ? " selected" : "") + '>Natural Teak (MDF 2210)</option>' +
              '<option value="Grey Oak Scandi"' + (shutterFinish.indexOf("Grey Oak") !== -1 || shutterFinish === "MDF 4402" ? " selected" : "") + '>Grey Oak (MDF 4402)</option>' +
              '<option value="Graphite Grey"' + (shutterFinish.indexOf("Graphite") !== -1 || shutterFinish === "MDF 5501" ? " selected" : "") + '>Graphite Grey (MDF 5501)</option>' +
              '<option value="Charcoal Matte"' + (shutterFinish.indexOf("Charcoal") !== -1 || shutterFinish === "MDF 7702" ? " selected" : "") + '>Charcoal Matte (MDF 7702)</option>' +
              '<option value="Concrete Look"' + (shutterFinish.indexOf("Concrete") !== -1 || shutterFinish === "MDF 8801" ? " selected" : "") + '>Concrete Look (MDF 8801)</option>' +
            '</select></div>' +
          '</div>' +

          // ── Card 5: Handles & Hardware ──
          '<div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:10px;margin-bottom:10px;box-shadow:0 1px 2px rgba(0,0,0,0.03);">' +
            '<div style="font-size:11px;font-weight:700;color:#475569;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">✨ Handles & Hardware</div>' +
            '<div class="insp-row" style="margin-bottom:6px;"><label>Handle Style</label><select id="inspFurnHandle">' +
              '<option value="bar"' + (curHandle === "bar" || curHandle === "bar128" || curHandle === "bar224" ? " selected" : "") + '>Bar Pull (Straight)</option>' +
              '<option value="ibh10"' + (curHandle === "ibh10" ? " selected" : "") + '>Indian Bow Handle 10" (IBH)</option>' +
              '<option value="ibh8"' + (curHandle === "ibh8" ? " selected" : "") + '>Indian Bow Handle 8" (IBH)</option>' +
              '<option value="tbar"' + (curHandle === "tbar" ? " selected" : "") + '>T-Bar Modern</option>' +
              '<option value="knob"' + (curHandle === "knob" ? " selected" : "") + '>Round Knob</option>' +
              '<option value="edge"' + (curHandle === "edge" ? " selected" : "") + '>Edge Lip Pull</option>' +
              '<option value="cup"' + (curHandle === "cup" ? " selected" : "") + '>Cup Pull (Traditional)</option>' +
              '<option value="gprof"' + (curHandle === "gprof" ? " selected" : "") + '>Gola Profile (Recessed)</option>' +
              '<option value="jprof"' + (curHandle === "jprof" ? " selected" : "") + '>J Profile Channel</option>' +
              '<option value="none"' + (curHandle === "none" ? " selected" : "") + '>Handleless / Push-to-Open</option>' +
            '</select></div>' +
            '<div class="insp-row"><label>Handle Finish</label><select id="inspFurnHFinish">' +
              '<option value="black"' + (curHFinish === "black" ? " selected" : "") + '>Matte Black</option>' +
              '<option value="chrome"' + (curHFinish === "chrome" ? " selected" : "") + '>Polished Chrome</option>' +
              '<option value="nickel"' + (curHFinish === "nickel" ? " selected" : "") + '>Satin Nickel / Steel</option>' +
              '<option value="brass"' + (curHFinish === "brass" ? " selected" : "") + '>Warm Brass / Gold</option>' +
              '<option value="rose_gold"' + (curHFinish === "rose_gold" ? " selected" : "") + '>Rose Gold / Copper</option>' +
            '</select></div>' +
          '</div>' +

          // ── Card 6: Interactive 3D Open / Close Controls ──
          '<div style="margin:12px 0 8px 0;padding:10px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
              '<span style="font-weight:700;font-size:11.5px;color:#166534;">🎛️ Interactive 3D Controls</span>' +
              '<div style="display:flex;gap:4px;">' +
                '<button class="btn small" id="inspShutterOpenAll" style="font-size:10px;padding:2px 8px;">Open All 🚪</button>' +
                '<button class="btn small" id="inspShutterCloseAll" style="font-size:10px;padding:2px 8px;">Close All</button>' +
              '</div>' +
            '</div>' +
            drawerSectionHtml +
            '<div style="font-size:11px;font-weight:600;color:#334155;margin:8px 0 4px 0;">Individual Shutters:</div>' +
            shutterItemsHtml +
          '</div>' +

          '<button class="btn primary full" id="inspOpen3DStudio" style="margin-top:8px">📐 Open &amp; Customize in 3D Studio</button>' +
          '<button class="btn full" id="inspRotateFurn" style="margin-top:8px">Rotate 90° (Space)</button>' +
          '<button class="btn danger full" id="inspDelFurn" style="margin-top:8px">Delete Unit</button>';

        function syncInspectorTo3D() {
          if (window.S && window.S.units) {
            for (var u = 0; u < window.S.units.length; u++) {
              if (window.S.units[u]._furnId === fn.id) {
                var eu = window.S.units[u];
                eu.label = fn.name;
                eu.W = fn.dimensions.W;
                eu.H = fn.dimensions.H;
                eu.D = fn.dimensions.D;
                eu.elev = (fn.elevation !== undefined && fn.elevation !== null) ? parseFloat(fn.elevation) : 0;
                if (fn.unitConfig) {
                  if (fn.unitConfig.shutters !== undefined) eu.shutters = fn.unitConfig.shutters;
                  if (fn.unitConfig.drawers !== undefined) eu.drawers = fn.unitConfig.drawers;
                  if (fn.unitConfig.dstyle) eu.dstyle = fn.unitConfig.dstyle;
                  if (fn.unitConfig.handle) eu.handle = fn.unitConfig.handle;
                  if (fn.unitConfig.counter) eu.counter = fn.unitConfig.counter;
                  if (fn.unitConfig.shutterCol) eu.shutterCol = fn.unitConfig.shutterCol;
                  if (fn.unitConfig.carcass) eu.carcass = fn.unitConfig.carcass;
                  if (fn.unitConfig.hfinish) eu.hfinish = fn.unitConfig.hfinish;
                  if (fn.unitConfig.fixedPanel) eu.fixedPanel = Object.assign({}, fn.unitConfig.fixedPanel);
                  if (fn.unitConfig.openShutter) eu.openShutter = Object.assign({}, fn.unitConfig.openShutter);
                  if (fn.unitConfig.corner) eu.corner = Object.assign({}, fn.unitConfig.corner);
                }
                break;
              }
            }
          }
          if (typeof window.renderRail === 'function') window.renderRail();
          if (typeof window.renderAll === 'function') window.renderAll();
        }

        var elFurnName = document.getElementById('inspFurnName');
        if (elFurnName) {
          elFurnName.addEventListener('change', function (e) {
            fn.name = e.target.value;
            syncInspectorTo3D();
            self.saveToLocalStorage();
            self.renderBOQ();
            self.editor.render();
          });
        }
        var elFurnRoom = document.getElementById('inspFurnRoom');
        if (elFurnRoom) {
          elFurnRoom.addEventListener('change', function (e) {
            fn.roomId = e.target.value || null;
            self.saveToLocalStorage();
            self.renderBOQ();
            self.editor.render();
          });
        }
        var elElev = document.getElementById('inspFurnElev');
        if (elElev) {
          var onElevInput = function (e) {
            var val = parseFloat(e.target.value);
            if (isNaN(val)) val = 0;
            fn.elevation = val;
            if (fn.pos) fn.pos.z = val;
            syncInspectorTo3D();
            self.editor.pushHistory('Change Unit Elevation');
            self.saveToLocalStorage();
            self.editor.render();
            if (self.render3DHome) self.render3DHome(true);
          };
          elElev.addEventListener('input', onElevInput);
          elElev.addEventListener('change', onElevInput);
        }
        var elFurnW = document.getElementById('inspFurnW');
        if (elFurnW) {
          elFurnW.addEventListener('change', function (e) {
            var newW = parseFloat(e.target.value);
            if (!(newW > 0)) return;
            var oldW = fn.dimensions.W || 600;
            fn.dimensions.W = newW;

            // Automatically update unit name and code for width (e.g. FM 60 -> FM 45 when width changed to 450mm)
            if (Core.updateUnitNameForWidth) {
              Core.updateUnitNameForWidth(fn, oldW, newW);
              var inspTitleEl = document.querySelector('.insp-title') || document.getElementById('inspTitle');
              if (inspTitleEl && fn.name) {
                inspTitleEl.textContent = fn.name;
              }
            }

            if (fn.unitConfig && fn.unitConfig.fixedPanel && fn.unitConfig.fixedPanel.enabled) {
              var halfW = Math.round(newW / 2);
              fn.unitConfig.fixedPanel.width = halfW;
              if (fn.unitConfig.openShutter) fn.unitConfig.openShutter.width = Math.max(0, newW - halfW);
            }
            if (fn.unitConfig && fn.unitConfig.corner && fn.unitConfig.corner.enabled) {
              fn.unitConfig.corner.legW = newW;
            }
            if (typeof updateFbcmInputs === 'function') updateFbcmInputs();
            syncInspectorTo3D();
            self.editor.pushHistory('Resize Furniture');
            self.saveToLocalStorage();
            self.renderBOQ();
            self.editor.render();
            if (self.render3DHome) self.render3DHome(true);
          });
        }
        var elFurnH = document.getElementById('inspFurnH');
        if (elFurnH) {
          elFurnH.addEventListener('change', function (e) {
            fn.dimensions.H = parseFloat(e.target.value);
            syncInspectorTo3D();
            self.editor.pushHistory('Resize Furniture');
            self.saveToLocalStorage();
            self.renderBOQ();
            self.editor.render();
            if (self.render3DHome) self.render3DHome(true);
          });
        }
        var elFurnD = document.getElementById('inspFurnD');
        if (elFurnD) {
          elFurnD.addEventListener('change', function (e) {
            var newD = parseFloat(e.target.value);
            if (!(newD > 0)) return;
            fn.dimensions.D = newD;
            if (fn.unitConfig && fn.unitConfig.corner && fn.unitConfig.corner.enabled) {
              fn.unitConfig.corner.depth = newD;
            }
            if (typeof updateFbcmInputs === 'function') updateFbcmInputs();
            syncInspectorTo3D();
            self.editor.pushHistory('Resize Furniture');
            self.saveToLocalStorage();
            self.renderBOQ();
            self.editor.render();
            if (self.render3DHome) self.render3DHome(true);
          });
        }

        // ─── FBCM / L-CORNER DUAL-ARM & SHUTTERS CONTROLS ───
        var elFbcmLegW = document.getElementById('inspFbcmLegW');
        var elFbcmShA = document.getElementById('inspFbcmShutterA');
        var elFbcmLegD = document.getElementById('inspFbcmLegD');
        var elFbcmShB = document.getElementById('inspFbcmShutterB');
        var elFbcmDepth = document.getElementById('inspFbcmDepth');

        var updateFbcmInputs = null;
        if (elFbcmLegW || elFbcmShA || elFbcmLegD || elFbcmShB || elFbcmDepth) {
          if (!fn.unitConfig) fn.unitConfig = {};
          if (!fn.unitConfig.corner) fn.unitConfig.corner = { enabled: true };

          updateFbcmInputs = function () {
            var isWallCornerU = Core.isWallUnit ? Core.isWallUnit(fn.category, fn.name, fn.code || fn.catalogItemId, fn.costCategory) : (fn.elevation >= 1000 || (fn.unitConfig && fn.unitConfig.ctype === 'kwall'));
            var defCornerLeg = isWallCornerU ? 600 : 900;
            var defCornerD = isWallCornerU ? 300 : 550;
            var cW = fn.unitConfig.corner.legW || fn.dimensions.W || defCornerLeg;
            var cD = fn.unitConfig.corner.legD || (fn.dimensions.D && fn.dimensions.D >= 500 ? fn.dimensions.D : (fn.dimensions.W || defCornerLeg));
            var cDepth = fn.unitConfig.corner.depth || (fn.dimensions.D && fn.dimensions.D < cW ? fn.dimensions.D : defCornerD);
            if (elFbcmLegW) elFbcmLegW.value = cW;
            if (elFbcmLegD) elFbcmLegD.value = cD;
            if (elFbcmDepth) elFbcmDepth.value = cDepth;
            if (elFbcmShA) elFbcmShA.value = Math.max(0, Math.round(cW - cDepth));
            if (elFbcmShB) elFbcmShB.value = Math.max(0, Math.round(cD - cDepth));
            if (elFurnW) elFurnW.value = cW;
            if (elFurnD) elFurnD.value = cDepth;
          };

          if (elFbcmLegW) {
            elFbcmLegW.addEventListener('change', function (e) {
              var val = parseFloat(e.target.value);
              if (!(val > 0)) return;
              fn.unitConfig.corner.legW = val;
              fn.dimensions.W = val;
              updateFbcmInputs();
              syncInspectorTo3D();
              self.editor.pushHistory('Resize Corner Side 1');
              self.saveToLocalStorage();
              self.renderBOQ();
              self.editor.render();
              if (self.render3DHome) self.render3DHome(true);
            });
          }

          if (elFbcmShA) {
            elFbcmShA.addEventListener('change', function (e) {
              var shVal = parseFloat(e.target.value);
              if (!(shVal >= 0)) return;
              var cDepth = fn.unitConfig.corner.depth || fn.dimensions.D || 560;
              var newLegW = Math.round(shVal + cDepth);
              fn.unitConfig.corner.legW = newLegW;
              fn.dimensions.W = newLegW;
              updateFbcmInputs();
              syncInspectorTo3D();
              self.editor.pushHistory('Resize Corner Shutter 1');
              self.saveToLocalStorage();
              self.renderBOQ();
              self.editor.render();
              if (self.render3DHome) self.render3DHome(true);
            });
          }

          if (elFbcmLegD) {
            elFbcmLegD.addEventListener('change', function (e) {
              var val = parseFloat(e.target.value);
              if (!(val > 0)) return;
              fn.unitConfig.corner.legD = val;
              updateFbcmInputs();
              syncInspectorTo3D();
              self.editor.pushHistory('Resize Corner Side 2');
              self.saveToLocalStorage();
              self.renderBOQ();
              self.editor.render();
              if (self.render3DHome) self.render3DHome(true);
            });
          }

          if (elFbcmShB) {
            elFbcmShB.addEventListener('change', function (e) {
              var shVal = parseFloat(e.target.value);
              if (!(shVal >= 0)) return;
              var cDepth = fn.unitConfig.corner.depth || fn.dimensions.D || 560;
              var newLegD = Math.round(shVal + cDepth);
              fn.unitConfig.corner.legD = newLegD;
              updateFbcmInputs();
              syncInspectorTo3D();
              self.editor.pushHistory('Resize Corner Shutter 2');
              self.saveToLocalStorage();
              self.renderBOQ();
              self.editor.render();
              if (self.render3DHome) self.render3DHome(true);
            });
          }

          if (elFbcmDepth) {
            elFbcmDepth.addEventListener('change', function (e) {
              var val = parseFloat(e.target.value);
              if (!(val > 0)) return;
              fn.unitConfig.corner.depth = val;
              fn.dimensions.D = val;
              updateFbcmInputs();
              syncInspectorTo3D();
              self.editor.pushHistory('Resize Corner Depth');
              self.saveToLocalStorage();
              self.renderBOQ();
              self.editor.render();
              if (self.render3DHome) self.render3DHome(true);
            });
          }
        }
        var elFurnShutters = document.getElementById('inspFurnShutters');
        if (elFurnShutters) {
          elFurnShutters.addEventListener('change', function (e) {
            if (!fn.unitConfig) fn.unitConfig = {};
            fn.unitConfig.shutters = parseInt(e.target.value) || 0;
            if (!fn.shutterStates) fn.shutterStates = [];
            while (fn.shutterStates.length < fn.unitConfig.shutters) fn.shutterStates.push(false);
            syncInspectorTo3D();
            self.editor.pushHistory('Edit Shutters Count');
            self.saveToLocalStorage();
            self.renderBOQ();
            self.editor.render();
            self.renderInspector(self.editor.selected);
            if (self.render3DHome) self.render3DHome(true);
          });
        }
        var elFurnDrawers = document.getElementById('inspFurnDrawers');
        if (elFurnDrawers) {
          elFurnDrawers.addEventListener('change', function (e) {
            if (!fn.unitConfig) fn.unitConfig = {};
            fn.unitConfig.drawers = parseInt(e.target.value) || 0;
            if (!fn.drawerStates) fn.drawerStates = [];
            while (fn.drawerStates.length < fn.unitConfig.drawers) fn.drawerStates.push(false);
            syncInspectorTo3D();
            self.editor.pushHistory('Edit Drawers Count');
            self.saveToLocalStorage();
            self.renderBOQ();
            self.editor.render();
            self.renderInspector(self.editor.selected);
            if (self.render3DHome) self.render3DHome(true);
          });
        }
        var doorStyleSelect = document.getElementById('inspFurnDoorStyle');
        if (doorStyleSelect) {
          doorStyleSelect.addEventListener('change', function (e) {
            if (!fn.unitConfig) fn.unitConfig = {};
            fn.unitConfig.dstyle = e.target.value;
            syncInspectorTo3D();
            self.editor.pushHistory('Change Door Style');
            self.saveToLocalStorage();
            self.renderBOQ();
            self.editor.render();
            if (self.render3DHome) self.render3DHome(true);
          });
        }
        var handleSelect = document.getElementById('inspFurnHandle');
        if (handleSelect) {
          handleSelect.addEventListener('change', function (e) {
            if (!fn.unitConfig) fn.unitConfig = {};
            fn.unitConfig.handle = e.target.value;
            syncInspectorTo3D();
            self.editor.pushHistory('Change Handle');
            self.saveToLocalStorage();
            self.renderBOQ();
            self.editor.render();
            if (self.render3DHome) self.render3DHome(true);
          });
        }
        var counterSelect = document.getElementById('inspFurnCounter');
        if (counterSelect) {
          counterSelect.addEventListener('change', function (e) {
            if (!fn.unitConfig) fn.unitConfig = {};
            fn.unitConfig.counter = e.target.value;
            syncInspectorTo3D();
            self.editor.pushHistory('Change Countertop');
            self.saveToLocalStorage();
            self.renderBOQ();
            self.editor.render();
            if (self.render3DHome) self.render3DHome(true);
          });
        }
        var hobBtn = document.getElementById('inspToggleHobBtn');
        if (hobBtn) {
          hobBtn.addEventListener('click', function () {
            if (!fn.unitConfig) fn.unitConfig = {};
            var currentlyHasHob = !!(fn.unitConfig.appliance === 'hob' || fn.unitConfig.hasHob);
            if (currentlyHasHob) {
              fn.unitConfig.appliance = 'none';
              fn.unitConfig.hasHob = false;
            } else {
              fn.unitConfig.appliance = 'hob';
              fn.unitConfig.hasHob = true;
              fn.unitConfig.hasSink = false;
              if (fn.unitConfig.counter === 'none') {
                fn.unitConfig.counter = 'granite_kashmir_white';
              }
            }
            syncInspectorTo3D();
            self.editor.pushHistory('Toggle Built-in HOB');
            self.saveToLocalStorage();
            self.renderBOQ();
            self.editor.render();
            self.renderInspector(self.editor.selected);
            if (self.render3DHome) self.render3DHome(true);
          });
        }
        var sinkBtn = document.getElementById('inspToggleSinkBtn');
        if (sinkBtn) {
          sinkBtn.addEventListener('click', function () {
            if (!fn.unitConfig) fn.unitConfig = {};
            var currentlyHasSink = !!(fn.unitConfig.appliance === 'sink' || fn.unitConfig.hasSink);
            if (currentlyHasSink) {
              fn.unitConfig.appliance = 'none';
              fn.unitConfig.hasSink = false;
            } else {
              fn.unitConfig.appliance = 'sink';
              fn.unitConfig.hasSink = true;
              fn.unitConfig.hasHob = false;
              if (fn.unitConfig.counter === 'none') {
                fn.unitConfig.counter = 'granite_kashmir_white';
              }
            }
            syncInspectorTo3D();
            self.editor.pushHistory('Toggle Kitchen Sink');
            self.saveToLocalStorage();
            self.renderBOQ();
            self.editor.render();
            self.renderInspector(self.editor.selected);
            if (self.render3DHome) self.render3DHome(true);
          });
        }
        var legsSelect = document.getElementById('inspFurnLegs');
        if (legsSelect) {
          legsSelect.addEventListener('change', function (e) {
            var val = e.target.value;
            if (!fn.unitConfig) fn.unitConfig = {};
            fn.unitConfig.hasLegs = (val === 'legs');
            fn.unitConfig.mountType = (val === 'legs' ? 'floor' : 'floating');
            if (val === 'floating' && (!fn.elevation || parseFloat(fn.elevation) === 0)) {
              fn.elevation = 250;
              if (fn.pos) fn.pos.z = 250;
            } else if (val === 'legs' && parseFloat(fn.elevation) <= 250) {
              fn.elevation = 0;
              if (fn.pos) fn.pos.z = 0;
            }
            syncInspectorTo3D();
            self.editor.pushHistory('Toggle Unit Legs / Plinth');
            self.saveToLocalStorage();
            self.renderBOQ();
            self.editor.render();
            if (self.render3DHome) self.render3DHome(true);
            self.renderInspector(self.editor.selected);
          });
        }
        var elShutterCol = document.getElementById('inspFurnShutterCol');
        if (elShutterCol) {
          elShutterCol.addEventListener('change', function (e) {
            if (!fn.materials) fn.materials = {};
            if (!fn.materials.shutter) fn.materials.shutter = { material: 'HDHMR_18MM' };
            fn.materials.shutter.finish = e.target.value;
            if (!fn.unitConfig) fn.unitConfig = {};
            fn.unitConfig.shutterCol = e.target.value;
            syncInspectorTo3D();
            self.editor.pushHistory('Change Shutter Finish');
            self.saveToLocalStorage();
            self.renderBOQ();
            self.editor.render();
            if (self.render3DHome) self.render3DHome(true);
          });
        }

        // Bulk Shutter Controls
        // Elevation Presets
        var btnFloor = document.getElementById('btnPresetFloor');
        if (btnFloor) {
          btnFloor.addEventListener('click', function () {
            fn.elevation = 0;
            if (fn.pos) fn.pos.z = 0;
            var elevEl = document.getElementById('inspFurnElev');
            if (elevEl) elevEl.value = 0;
            syncInspectorTo3D();
            self.editor.pushHistory('Set Elevation: 0mm (Floor)');
            self.saveToLocalStorage();
            if (self.render3DHome) self.render3DHome(true);
            self.renderInspector(self.editor.selected);
          });
        }
        var btnCounter = document.getElementById('btnPresetCounter');
        if (btnCounter) {
          btnCounter.addEventListener('click', function () {
            fn.elevation = 750;
            if (fn.pos) fn.pos.z = 750;
            var elevElC = document.getElementById('inspFurnElev');
            if (elevElC) elevElC.value = 750;
            syncInspectorTo3D();
            self.editor.pushHistory('Set Elevation: 750mm (Countertop)');
            self.saveToLocalStorage();
            if (self.render3DHome) self.render3DHome(true);
            self.renderInspector(self.editor.selected);
          });
        }
        var btnWall = document.getElementById('btnPresetWall');
        if (btnWall) {
          btnWall.addEventListener('click', function () {
            fn.elevation = 1500;
            if (fn.pos) fn.pos.z = 1500;
            var elevEl2 = document.getElementById('inspFurnElev');
            if (elevEl2) elevEl2.value = 1500;
            syncInspectorTo3D();
            self.editor.pushHistory('Set Elevation: 1500mm (Wall)');
            self.saveToLocalStorage();
            if (self.render3DHome) self.render3DHome(true);
            self.renderInspector(self.editor.selected);
          });
        }
        var btnLoft = document.getElementById('btnPresetLoft');
        if (btnLoft) {
          btnLoft.addEventListener('click', function () {
            fn.elevation = 2100;
            if (fn.pos) fn.pos.z = 2100;
            var elevEl3 = document.getElementById('inspFurnElev');
            if (elevEl3) elevEl3.value = 2100;
            syncInspectorTo3D();
            self.editor.pushHistory('Set Elevation: 2100mm (Loft)');
            self.saveToLocalStorage();
            if (self.render3DHome) self.render3DHome(true);
            self.renderInspector(self.editor.selected);
          });
        }
        var btnFocus3D = document.getElementById('inspFocusUnitBtn3D');
        if (btnFocus3D) {
          btnFocus3D.addEventListener('click', function () {
            self.zoomToFurnitureIn3D(fn.id);
          });
        }

        // Door Mechanism Toggle (Hinged vs Sliding)
        var elMech = document.getElementById('inspFurnDoorMech');
        if (elMech) {
          elMech.addEventListener('change', function (e) {
            if (!fn.unitConfig) fn.unitConfig = {};
            fn.unitConfig.doorType = e.target.value;
            fn.unitConfig.type = e.target.value;
            fn.doorType = e.target.value;
            fn.type = e.target.value;
            syncInspectorTo3D();
            self.editor.pushHistory('Change Door Mechanism: ' + e.target.value);
            self.saveToLocalStorage();
            if (self.render3DHome) self.render3DHome(true);
            self.renderInspector(self.editor.selected);
          });
        }

        var btnOpenAll = document.getElementById('inspShutterOpenAll');
        if (btnOpenAll) {
          btnOpenAll.addEventListener('click', function () {
            if (!fn.shutterStates) fn.shutterStates = [];
            for (var i = 0; i < shuttersCount; i++) fn.shutterStates[i] = true;
            self.editor.pushHistory('Open All Shutters');
            self.saveToLocalStorage();
            self.renderInspector(self.editor.selected);
            if (self.render3DHome) self.render3DHome(true);
          });
        }
        var btnCloseAll = document.getElementById('inspShutterCloseAll');
        if (btnCloseAll) {
          btnCloseAll.addEventListener('click', function () {
            if (!fn.shutterStates) fn.shutterStates = [];
            for (var i = 0; i < shuttersCount; i++) fn.shutterStates[i] = false;
            self.editor.pushHistory('Close All Shutters');
            self.saveToLocalStorage();
            self.renderInspector(self.editor.selected);
            if (self.render3DHome) self.render3DHome(true);
          });
        }
        var btnApplyAll = document.getElementById('inspShutterApplyAll');
        if (btnApplyAll) {
          btnApplyAll.addEventListener('click', function () {
            var col0 = toValidHexColor((fn.shutterColors && fn.shutterColors[0]), '#6e4e35');
            var mat0 = (fn.shutterMaterials && fn.shutterMaterials[0]) || shutterFinish;
            if (!fn.shutterColors) fn.shutterColors = [];
            if (!fn.shutterMaterials) fn.shutterMaterials = [];
            for (var i = 0; i < shuttersCount; i++) {
              fn.shutterColors[i] = col0;
              fn.shutterMaterials[i] = mat0;
            }
            if (!fn.materials) fn.materials = {};
            if (!fn.materials.shutter) fn.materials.shutter = {};
            fn.materials.shutter.finish = mat0;
            if (!fn.unitConfig) fn.unitConfig = {};
            fn.unitConfig.shutterCol = mat0;
            syncInspectorTo3D();
            self.editor.pushHistory('Apply Shutter Style to All');
            self.saveToLocalStorage();
            self.renderInspector(self.editor.selected);
            if (self.render3DHome) self.render3DHome(true);
          });
        }

        // Bulk & Individual Drawer Controls
        var btnDrawerOpenAll = document.getElementById('inspDrawerOpenAll');
        if (btnDrawerOpenAll) {
          btnDrawerOpenAll.addEventListener('click', function () {
            if (!fn.drawerStates) fn.drawerStates = [];
            for (var i = 0; i < drawersCount; i++) fn.drawerStates[i] = true;
            self.editor.pushHistory('Open All Drawers');
            self.saveToLocalStorage();
            self.renderInspector(self.editor.selected);
            if (self.render3DHome) self.render3DHome(true);
          });
        }
        var btnDrawerCloseAll = document.getElementById('inspDrawerCloseAll');
        if (btnDrawerCloseAll) {
          btnDrawerCloseAll.addEventListener('click', function () {
            if (!fn.drawerStates) fn.drawerStates = [];
            for (var i = 0; i < drawersCount; i++) fn.drawerStates[i] = false;
            self.editor.pushHistory('Close All Drawers');
            self.saveToLocalStorage();
            self.renderInspector(self.editor.selected);
            if (self.render3DHome) self.render3DHome(true);
          });
        }

        var drawerToggles = panel.querySelectorAll('.inspDrawerToggle');
        drawerToggles.forEach(function (btn) {
          btn.addEventListener('click', function () {
            var idx = parseInt(btn.getAttribute('data-didx'));
            if (!fn.drawerStates) fn.drawerStates = [];
            fn.drawerStates[idx] = !fn.drawerStates[idx];
            self.editor.pushHistory('Toggle Drawer ' + (idx + 1));
            self.saveToLocalStorage();
            self.renderInspector(self.editor.selected);
            if (self.render3DHome) self.render3DHome(true);
          });
        });

        // Individual Shutter Controls
        var toggles = panel.querySelectorAll('.inspShutterToggle');
        toggles.forEach(function (btn) {
          btn.addEventListener('click', function () {
            var idx = parseInt(btn.getAttribute('data-sidx'));
            if (!fn.shutterStates) fn.shutterStates = [];
            fn.shutterStates[idx] = !fn.shutterStates[idx];
            self.editor.pushHistory('Toggle Shutter ' + (idx + 1));
            self.saveToLocalStorage();
            self.renderInspector(self.editor.selected);
            if (self.render3DHome) self.render3DHome(true);
          });
        });

        var colorInputs = panel.querySelectorAll('.inspShutterColorInput');
        colorInputs.forEach(function (inp) {
          inp.addEventListener('change', function () {
            var idx = parseInt(inp.getAttribute('data-sidx'));
            if (!fn.shutterColors) fn.shutterColors = [];
            fn.shutterColors[idx] = inp.value;
            if (!fn.unitConfig) fn.unitConfig = {};
            fn.unitConfig.shutterCol = inp.value;
            syncInspectorTo3D();
            self.editor.pushHistory('Change Shutter ' + (idx + 1) + ' Color');
            self.saveToLocalStorage();
            if (self.render3DHome) self.render3DHome(true);
          });
        });

        var matSelects = panel.querySelectorAll('.inspShutterMatSelect');
        matSelects.forEach(function (sel) {
          sel.addEventListener('change', function () {
            var idx = parseInt(sel.getAttribute('data-sidx'));
            if (!fn.shutterMaterials) fn.shutterMaterials = [];
            fn.shutterMaterials[idx] = sel.value;
            if (!fn.unitConfig) fn.unitConfig = {};
            fn.unitConfig.shutterCol = sel.value;
            syncInspectorTo3D();
            self.editor.pushHistory('Change Shutter ' + (idx + 1) + ' Material');
            self.saveToLocalStorage();
            if (self.render3DHome) self.render3DHome(true);
          });
        });
        var elFurnCarcass = document.getElementById('inspFurnCarcass');
        if (elFurnCarcass) {
          elFurnCarcass.addEventListener('change', function (e) {
            if (!fn.materials) fn.materials = {};
            if (!fn.materials.carcass) fn.materials.carcass = { material: 'BWP_18MM' };
            fn.materials.carcass.finish = e.target.value;
            if (!fn.unitConfig) fn.unitConfig = {};
            fn.unitConfig.carcass = e.target.value;
            syncInspectorTo3D();
            self.editor.pushHistory('Change Carcass Finish');
            self.saveToLocalStorage();
            self.renderBOQ();
            self.editor.render();
            if (self.render3DHome) self.render3DHome(true);
          });
        }

        var elFurnShutter = document.getElementById('inspFurnShutter');
        if (elFurnShutter) {
          elFurnShutter.addEventListener('change', function (e) {
            if (!fn.materials) fn.materials = {};
            if (!fn.materials.shutter) fn.materials.shutter = { material: 'HDHMR_18MM' };
            fn.materials.shutter.finish = e.target.value;
            if (!fn.unitConfig) fn.unitConfig = {};
            fn.unitConfig.shutterCol = e.target.value;
            if (!fn.shutterMaterials) fn.shutterMaterials = [];
            for (var sm = 0; sm < shuttersCount; sm++) {
              fn.shutterMaterials[sm] = e.target.value;
            }
            if (!fn.shutterColors) fn.shutterColors = [];
            var hexVal = toValidHexColor(e.target.value, '#edebe4');
            for (var sc = 0; sc < shuttersCount; sc++) {
              fn.shutterColors[sc] = hexVal;
            }
            syncInspectorTo3D();
            self.editor.pushHistory('Change Shutter Finish');
            self.saveToLocalStorage();
            self.renderBOQ();
            self.renderInspector(self.editor.selected);
            if (self.render3DHome) self.render3DHome(true);
          });
        }

        var elFurnHandle = document.getElementById('inspFurnHandle');
        if (elFurnHandle) {
          elFurnHandle.addEventListener('change', function (e) {
            if (!fn.unitConfig) fn.unitConfig = {};
            fn.unitConfig.handle = e.target.value;
            fn.handleType = e.target.value;
            syncInspectorTo3D();
            self.editor.pushHistory('Change Handle Style');
            self.saveToLocalStorage();
            self.renderBOQ();
            if (self.render3DHome) self.render3DHome(true);
          });
        }

        var elFurnHFinish = document.getElementById('inspFurnHFinish');
        if (elFurnHFinish) {
          elFurnHFinish.addEventListener('change', function (e) {
            if (!fn.unitConfig) fn.unitConfig = {};
            fn.unitConfig.hfinish = e.target.value;
            fn.handleFinish = e.target.value;
            syncInspectorTo3D();
            self.editor.pushHistory('Change Handle Finish');
            self.saveToLocalStorage();
            self.renderBOQ();
            if (self.render3DHome) self.render3DHome(true);
          });
        }

        var elOpen3DStudio = document.getElementById('inspOpen3DStudio');
        if (elOpen3DStudio) {
          elOpen3DStudio.addEventListener('click', function () {
            if (window.S && window.S.units) {
              var existingIdx = -1;
              for (var u = 0; u < window.S.units.length; u++) {
                if (window.S.units[u].label === fn.name || window.S.units[u]._furnId === fn.id) {
                  existingIdx = u;
                  break;
                }
              }
              if (existingIdx !== -1) {
                window.S.active = existingIdx;
                var activeUnit = window.S.units[existingIdx];
                var isFbcm = !!(
                  (fn.unitConfig && (fn.unitConfig.geometryType === 'l_shaped_corner' || fn.unitConfig.unitType === 'fbcm' || fn.unitConfig.unitType === 'wbcm' || (fn.unitConfig.corner && fn.unitConfig.corner.enabled))) ||
                  (fn.id && /fbcm|wbcm/i.test(fn.id)) ||
                  (fn.catalogItemId && /fbcm|wbcm/i.test(fn.catalogItemId)) ||
                  (fn.code && /fbcm|wbcm/i.test(fn.code)) ||
                  (fn.name && /l[-_ ]*shaped.*corner|\bwbcm\b/i.test(fn.name)) ||
                  fn.id === 'fbcm' || fn.catalogItemId === 'fbcm' ||
                  fn.id === 'f_fbcm_1' || fn.catalogItemId === 'f_fbcm_1'
                );
                var isFcm = !isFbcm && !!(
                  (fn.unitConfig && fn.unitConfig.fixedPanel && fn.unitConfig.fixedPanel.enabled) ||
                  (fn.unitConfig && (fn.unitConfig.unitType === 'fcm-rt' || fn.unitConfig.unitType === 'fcm-lt' || fn.unitConfig.unitType === 'wcm-rt' || fn.unitConfig.unitType === 'wcm-lt')) ||
                  (fn.id && /fcm[-_ ]*(rt|lt)/i.test(fn.id)) ||
                  (fn.catalogItemId && /fcm[-_ ]*(rt|lt)/i.test(fn.catalogItemId)) ||
                  (fn.name && /(fcm[-_ ]*(rt|lt)|wcm[-_ ]*(rt|lt)\s*\(cookscape\))/i.test(fn.name)) ||
                  fn.id === 'fcm-rt' || fn.catalogItemId === 'fcm-rt' ||
                  fn.id === 'fm-rt-01' || fn.catalogItemId === 'fm-rt-01' ||
                  fn.id === 'fcm-lt' || fn.catalogItemId === 'fcm-lt' ||
                  fn.id === 'fm-lt-01' || fn.catalogItemId === 'fm-lt-01'
                );
                var isLt = !!(
                  (fn.unitConfig && (fn.unitConfig.unitType === 'fcm-lt' || fn.unitConfig.unitType === 'wcm-lt' || (fn.unitConfig.openShutter && fn.unitConfig.openShutter.opening === 'left'))) ||
                  (fn.id && /fcm[-_ ]*lt/i.test(fn.id)) ||
                  (fn.catalogItemId && /fcm[-_ ]*lt/i.test(fn.catalogItemId)) ||
                  (fn.name && /(fcm[-_ ]*lt|wcm[-_ ]*lt\s*\(cookscape\))/i.test(fn.name)) ||
                  fn.id === 'fcm-lt' || fn.catalogItemId === 'fcm-lt' ||
                  fn.id === 'fm-lt-01' || fn.catalogItemId === 'fm-lt-01'
                );
                activeUnit.label = fn.name;
                activeUnit.W = fn.dimensions.W;
                activeUnit.H = fn.dimensions.H;
                activeUnit.D = fn.dimensions.D;
                if (fn.unitConfig) {
                  activeUnit.unitConfig = Object.assign({}, fn.unitConfig);
                  if (fn.unitConfig.unitType) activeUnit.unitType = fn.unitConfig.unitType;
                  else if (isFbcm) activeUnit.unitType = 'fbcm';
                  else if (isFcm) activeUnit.unitType = isLt ? 'fcm-lt' : 'fcm-rt';
                  if (fn.unitConfig.geometryType) activeUnit.geometryType = fn.unitConfig.geometryType;
                  else if (isFbcm) activeUnit.geometryType = 'l_shaped_corner';
                  if (fn.unitConfig.corner) activeUnit.corner = fn.unitConfig.corner;
                  if (fn.unitConfig.fixedPanel) activeUnit.fixedPanel = fn.unitConfig.fixedPanel;
                  if (fn.unitConfig.openShutter) activeUnit.openShutter = fn.unitConfig.openShutter;
                  if (fn.unitConfig.shutters !== undefined) activeUnit.shutters = fn.unitConfig.shutters;
                  else if (isFbcm) activeUnit.shutters = 2;
                  else if (isFcm) activeUnit.shutters = 1;
                  if (fn.unitConfig.sections !== undefined) activeUnit.sections = fn.unitConfig.sections;
                  else if (isFbcm) activeUnit.sections = 1;
                  else if (isFcm) activeUnit.sections = 2;
                  if (fn.unitConfig.shelves !== undefined) activeUnit.shelves = fn.unitConfig.shelves;
                  else if (isFbcm) activeUnit.shelves = 2;
                  else if (isFcm) activeUnit.shelves = 1;
                  if (fn.unitConfig.drawers !== undefined) activeUnit.drawers = fn.unitConfig.drawers;
                  if (fn.unitConfig.dstyle) activeUnit.dstyle = fn.unitConfig.dstyle;
                  if (fn.unitConfig.handle) activeUnit.handle = fn.unitConfig.handle;
                  else if (isFbcm) activeUnit.handle = 'standard';
                  else if (isFcm) activeUnit.handle = 'pull';
                  if (fn.unitConfig.hfinish) activeUnit.hfinish = fn.unitConfig.hfinish;
                  else if (isFbcm || isFcm) activeUnit.hfinish = 'black';
                  if (fn.unitConfig.counter) activeUnit.counter = fn.unitConfig.counter;
                  else if (isFbcm) activeUnit.counter = 'black';
                  if (fn.unitConfig.shutterCol) activeUnit.shutterCol = fn.unitConfig.shutterCol;
                  else if (fn.materials && fn.materials.shutter && fn.materials.shutter.finish) activeUnit.shutterCol = fn.materials.shutter.finish;
                  if (fn.unitConfig.carcass) activeUnit.carcass = fn.unitConfig.carcass;
                  else if (fn.materials && fn.materials.carcass && fn.materials.carcass.finish) activeUnit.carcass = fn.materials.carcass.finish;
                }
              } else {
                var isFcm = !!(
                  (fn.unitConfig && fn.unitConfig.fixedPanel && fn.unitConfig.fixedPanel.enabled) ||
                  (fn.unitConfig && (fn.unitConfig.unitType === 'fcm-rt' || fn.unitConfig.unitType === 'fcm-lt' || fn.unitConfig.unitType === 'wcm-rt' || fn.unitConfig.unitType === 'wcm-lt')) ||
                  (fn.id && /fcm[-_ ]*(rt|lt)/i.test(fn.id)) ||
                  (fn.catalogItemId && /fcm[-_ ]*(rt|lt)/i.test(fn.catalogItemId)) ||
                  (fn.name && /(fcm[-_ ]*(rt|lt)|wcm[-_ ]*(rt|lt)\s*\(cookscape\))/i.test(fn.name)) ||
                  fn.id === 'fcm-rt' || fn.catalogItemId === 'fcm-rt' ||
                  fn.id === 'fm-rt-01' || fn.catalogItemId === 'fm-rt-01' ||
                  fn.id === 'fcm-lt' || fn.catalogItemId === 'fcm-lt' ||
                  fn.id === 'fm-lt-01' || fn.catalogItemId === 'fm-lt-01'
                );
                var isLt = !!(
                  (fn.unitConfig && (fn.unitConfig.unitType === 'fcm-lt' || fn.unitConfig.unitType === 'wcm-lt' || (fn.unitConfig.openShutter && fn.unitConfig.openShutter.opening === 'left'))) ||
                  (fn.id && /fcm[-_ ]*lt/i.test(fn.id)) ||
                  (fn.catalogItemId && /fcm[-_ ]*lt/i.test(fn.catalogItemId)) ||
                  (fn.name && /(fcm[-_ ]*lt|wcm[-_ ]*lt\s*\(cookscape\))/i.test(fn.name)) ||
                  fn.id === 'fcm-lt' || fn.catalogItemId === 'fcm-lt' ||
                  fn.id === 'fm-lt-01' || fn.catalogItemId === 'fm-lt-01'
                );
                var isWall = (window.OrbixCore && window.OrbixCore.isWallUnit) ?
                  window.OrbixCore.isWallUnit(fn.category, fn.name, fn.code || fn.id, fn.costCategory) :
                  (fn.category === 'kitchen_wall' || (fn.name && fn.name.toLowerCase().indexOf('wall') !== -1));
                var isKitchen = (fn.category && fn.category.indexOf('kitchen') !== -1);
                var isBase = !isWall && (isKitchen || fn.category === 'crockery' || fn.category === 'tv_unit' || (fn.name && fn.name.indexOf('BASE') !== -1) || isFcm);
                var sFinish = (fn.unitConfig && fn.unitConfig.shutterCol) || (fn.materials && fn.materials.shutter && fn.materials.shutter.finish) || 'MDF 7707';
                var cFinish = (fn.unitConfig && fn.unitConfig.carcass) || (fn.materials && fn.materials.carcass && fn.materials.carcass.finish) || 'MDF 6601';
                var newU = {
                  label: fn.name,
                  ctype: isWall ? 'kwall' : (isBase ? 'kbase' : 'wardrobe'),
                  _furnId: fn.id,
                  unitType: (fn.unitConfig && fn.unitConfig.unitType) || fn.catalogItemId || (isFcm ? (isLt ? 'fcm-lt' : 'fcm-rt') : undefined),
                  catalogItemId: fn.catalogItemId || fn.id,
                  fixedPanel: fn.unitConfig && fn.unitConfig.fixedPanel,
                  openShutter: fn.unitConfig && fn.unitConfig.openShutter,
                  unitConfig: fn.unitConfig ? Object.assign({}, fn.unitConfig) : undefined,
                  W: fn.dimensions.W,
                  H: fn.dimensions.H,
                  D: fn.dimensions.D,
                  T: 18,
                  type: (fn.unitConfig && (fn.unitConfig.type || fn.unitConfig.doorType)) || 'hinged',
                  shutters: (fn.unitConfig && fn.unitConfig.shutters !== undefined) ? fn.unitConfig.shutters : (isFcm ? 1 : (fn.dimensions.W > 1200 ? 3 : fn.dimensions.W > 600 ? 2 : 1)),
                  sections: (fn.unitConfig && fn.unitConfig.sections) || (isFcm ? 2 : (fn.dimensions.W > 1200 ? 2 : 1)),
                  shelves: (fn.unitConfig && fn.unitConfig.shelves) || (isFcm ? 1 : (isKitchen ? 1 : 3)),
                  drawers: (fn.unitConfig && fn.unitConfig.drawers) || 0,
                  drawerH: 180,
                  loft: (fn.unitConfig && fn.unitConfig.loft) || false,
                  loftH: 600,
                  loftShutters: 2,
                  back: 18,
                  dstyle: (fn.unitConfig && fn.unitConfig.dstyle) || 'slab',
                  handle: (fn.unitConfig && fn.unitConfig.handle) || (isFcm ? 'pull' : 'gprof'),
                  hfinish: (fn.unitConfig && fn.unitConfig.hfinish) || 'black',
                  counter: (fn.unitConfig && fn.unitConfig.counter) || (isBase ? (fn.unitConfig && fn.unitConfig.counter ? fn.unitConfig.counter : 'black') : 'none'),
                  carcass: cFinish,
                  shutterCol: sFinish,
                  tvBack: 'none',
                  tvShow: false,
                  tvFloat: false
                };
                window.S.units.push(newU);
                window.S.active = window.S.units.length - 1;
              }
              if (typeof window.renderRail === 'function') window.renderRail();
              if (typeof window.renderAll === 'function') window.renderAll();
              var vtab = document.querySelector('.vtab[data-view="design"]');
              if (vtab) vtab.click();
            }
          });
        }

        var elRotateFurn = document.getElementById('inspRotateFurn');
        if (elRotateFurn) {
          elRotateFurn.addEventListener('click', function () {
            if (self.editor && typeof self.editor.rotateSelectedElement === 'function') {
              self.editor.rotateSelectedElement();
            } else {
              fn.rotY = ((fn.rotY || 0) + Math.PI / 2) % (Math.PI * 2);
              self.editor.pushHistory('Rotate Furniture');
              self.saveToLocalStorage();
              self.editor.render();
              if (self.render3DHome) self.render3DHome(true);
            }
          });
        }

        var elDelFurn = document.getElementById('inspDelFurn');
        if (elDelFurn) {
          elDelFurn.addEventListener('click', function () {
            self.editor.deleteSelected();
            if (window.S && window.S.units) {
              window.S.units = window.S.units.filter(function (u) { return u._furnId !== fn.id; });
              window.S.active = Math.max(0, window.S.units.length - 1);
              if (typeof window.renderRail === 'function') window.renderRail();
            }
            if (self.render3DHome) self.render3DHome(true);
          });
        }
      } else if (sel.type === 'room') {
        var rm = null;
        var rooms = this.project.plan.rooms || [];
        for (var r = 0; r < rooms.length; r++) {
          if (rooms[r].id === sel.id) { rm = rooms[r]; break; }
        }
        if (!rm) return;

        var areaSqM = (rm.areaSqM || 0).toFixed(2);
        var areaSqFt = Math.round(rm.areaSqFt || 0);

        panel.innerHTML =
          '<div class="insp-title">Room Properties</div>' +
          '<div class="insp-row"><label>Room Name</label><input type="text" id="inspRoomName" value="' + (rm.name || 'Room') + '"></div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px;">' +
            ['Master Bed', 'Guest Bed', 'Living Room', 'Modular Kitchen', 'Dining', 'Wardrobe Room', 'Kids Bed', 'Pantry'].map(function (preset) {
              return '<button class="minibtn insp-room-chip" data-name="' + preset + '" style="font-size:11px;padding:3px 7px;">' + preset + '</button>';
            }).join('') +
          '</div>' +
          '<div class="insp-row"><label>Floor Finish</label><select id="inspRoomFloor">' +
            '<option value="wood"' + ((rm.floorFinish === 'wood') ? ' selected' : '') + '>Wooden Parquet Flooring</option>' +
            '<option value="marble"' + ((rm.floorFinish === 'marble') ? ' selected' : '') + '>Italian White Marble</option>' +
            '<option value="tile"' + ((rm.floorFinish === 'tile' || !rm.floorFinish) ? ' selected' : '') + '>Vitrified Light Tiles</option>' +
            '<option value="concrete"' + ((rm.floorFinish === 'concrete') ? ' selected' : '') + '>Polished Concrete</option>' +
            '<option value="tile_1"' + ((rm.floorFinish === 'tile_1' || rm.floorFinish === 'designer_tile_1' || rm.floorFinish === 'floor_tile_1') ? ' selected' : '') + '>Floor Tile 1 (Statuario White Marble)</option>' +
            '<option value="tile_2"' + ((rm.floorFinish === 'tile_2' || rm.floorFinish === 'designer_tile_2' || rm.floorFinish === 'floor_tile_2') ? ' selected' : '') + '>Floor Tile 2 (Grey Basalt Slate)</option>' +
            '<option value="tile_3"' + ((rm.floorFinish === 'tile_3' || rm.floorFinish === 'designer_tile_3' || rm.floorFinish === 'floor_tile_3') ? ' selected' : '') + '>Floor Tile 3 (Teak Wood Plank Tile)</option>' +
          '</select></div>' +
          '<div class="insp-row"><label>Ceiling Ht (mm)</label><input type="number" id="inspRoomHeight" value="' + (rm.ceilingHeight || 2800) + '" step="100"></div>' +
          '<div class="insp-row"><label>Area (sq.ft)</label><input type="text" value="' + areaSqFt + ' sq ft (' + areaSqM + ' m²)" readonly style="background:var(--rule-2,#f3f4f6)"></div>' +
          '<div class="insp-row"><label>Perimeter (mm)</label><input type="text" value="' + Math.round(rm.perimeter || 0).toLocaleString() + ' mm" readonly style="background:var(--rule-2,#f3f4f6)"></div>' +
          '<div class="insp-row" style="margin-top:6px;"><label style="font-size:12px;cursor:pointer;display:flex;align-items:center;gap:6px;"><input type="checkbox" id="inspRoomFlooringQuote"' + (rm.includeFlooring ? ' checked' : '') + '> Include Civil Flooring in Quote (₹' + (self.project && self.project.rateCard && self.project.rateCard.categories && self.project.rateCard.categories.flooring ? self.project.rateCard.categories.flooring.baseRatePerSft : 140) + '/SFT)</label></div>' +
          '<button class="btn primary full" id="inspFocusRoom3D" style="margin-top:8px">👁 View Room in 3D Studio</button>' +
          '<button class="btn danger full" id="inspDelRoom" style="margin-top:8px">🗑️ Delete Room & Dividers</button>';

        var nameInput = document.getElementById('inspRoomName');
        if (nameInput) {
          nameInput.addEventListener('input', function (e) {
            rm.name = e.target.value;
            self.editor.render();
            self.saveToLocalStorage();
            if (self.update3DStudioRoomOptions) self.update3DStudioRoomOptions();
          });
        }

        document.querySelectorAll('.insp-room-chip').forEach(function (btn) {
          btn.addEventListener('click', function () {
            rm.name = btn.dataset.name;
            if (nameInput) nameInput.value = btn.dataset.name;
            self.editor.pushHistory('Rename Room');
            self.editor.render();
            self.saveToLocalStorage();
            if (self.update3DStudioRoomOptions) self.update3DStudioRoomOptions();
            if (self.render3DHome) self.render3DHome(true);
          });
        });

        var floorSel = document.getElementById('inspRoomFloor');
        if (floorSel) {
          floorSel.addEventListener('change', function (e) {
            rm.floorFinish = e.target.value;
            self.editor.pushHistory('Change Floor Finish');
            self.saveToLocalStorage();
            var fType = rm.floorFinish;
            if (fType === 'wood') fType = 'wooden';
            else if (fType === 'marble') fType = 'white_tile';
            else if (fType === 'tile') fType = 'square_tile';
            else if (fType === 'concrete') fType = 'grey_tile';
            else if (fType === 'tile_1' || fType === 'designer_tile_1' || fType === 'floor_tile_1') fType = 'tile_1';
            else if (fType === 'tile_2' || fType === 'designer_tile_2' || fType === 'floor_tile_2') fType = 'tile_2';
            else if (fType === 'tile_3' || fType === 'designer_tile_3' || fType === 'floor_tile_3') fType = 'tile_3';
            if (self.archRenderer && typeof self.archRenderer.setFloorMaterial === 'function') {
              self.archRenderer.setFloorMaterial(fType, rm.id);
            }
            if (self.render3DHome) self.render3DHome(true);
          });
        }

        var floorQuoteChk = document.getElementById('inspRoomFlooringQuote');
        if (floorQuoteChk) {
          floorQuoteChk.addEventListener('change', function (e) {
            rm.includeFlooring = e.target.checked;
            self.editor.pushHistory('Toggle Room Flooring in Quote');
            self.saveToLocalStorage();
            if (self.renderBOQ) self.renderBOQ();
            self.updateUI();
          });
        }

        var htInput = document.getElementById('inspRoomHeight');
        if (htInput) {
          htInput.addEventListener('change', function (e) {
            rm.ceilingHeight = parseFloat(e.target.value) || 2800;
            self.editor.pushHistory('Change Ceiling Height');
            self.saveToLocalStorage();
            if (self.render3DHome) self.render3DHome(true);
          });
        }

        var roomAIBtn = document.getElementById('inspRoomAIDecorBtn');
        if (roomAIBtn) {
          roomAIBtn.addEventListener('click', function () {
            self.applyAIDecor(rm.id, rm.name);
          });
        }

        var roomClearAIBtn = document.getElementById('inspRoomClearAIDecorBtn');
        if (roomClearAIBtn) {
          roomClearAIBtn.addEventListener('click', function () {
            self.clearAIDecors(rm.id);
          });
        }

        var focusBtn = document.getElementById('inspFocusRoom3D');
        if (focusBtn) {
          focusBtn.addEventListener('click', function () {
            var vtab = document.querySelector('.vtab[data-view="design"]');
            if (vtab) vtab.click();
          });
        }

        var delRoomBtn = document.getElementById('inspDelRoom');
        if (delRoomBtn) {
          delRoomBtn.addEventListener('click', function () {
            self.editor.deleteSelected();
            if (self.update3DStudioRoomOptions) self.update3DStudioRoomOptions();
            if (self.render3DHome) self.render3DHome(true);
          });
        }
      }
    },

    getPlan: function (proj) {
      var p = proj || this.project;
      if (!p && this.editor) p = this.editor.project;
      if (!p && root.OrbixProjects && root.OrbixProjects.currentUser && root.OrbixProjects.activeProjectId) {
        var curP = (root.OrbixProjects.projects || []).find(function (item) { return item.id === root.OrbixProjects.activeProjectId; });
        if (curP && curP.data) p = curP.data.plan || curP.data;
      }
      if (!p) return { walls: [], openings: [], rooms: [], furniture: [] };
      var target = p;
      while (target && target.plan && (target.plan.walls || target.plan.furniture || target.plan.rooms || target.plan.plan)) {
        target = target.plan;
      }
      // If furniture list is missing from this target but present in editor.project, use editor.project
      if ((!target.furniture || !target.furniture.length) && this.editor && this.editor.project && this.editor.project !== p) {
        var ep = this.editor.project;
        while (ep && ep.plan && (ep.plan.walls || ep.plan.furniture || ep.plan.rooms || ep.plan.plan)) ep = ep.plan;
        if (ep && ep.furniture && ep.furniture.length) return ep;
      }
      return target;
    },

    syncProjectUnitsTo3DStudio: function (selectFurnId) {
      if (this.sync3DStudioUnits && window.S && window.S.units && window.S.units.length > 0) {
        this.sync3DStudioUnits();
      }
      var plan = this.getPlan();
      var furnList = (plan && plan.furniture) || [];

      window.S = window.S || {};

      // If no furniture is placed on the 2D floor plan, check if 3D Studio or project.data has units before clearing!
      if (!furnList.length) {
        if (window.S.units && Array.isArray(window.S.units) && window.S.units.length > 0) {
          furnList = plan.furniture = plan.furniture || [];
          for (var fi = 0; fi < window.S.units.length; fi++) {
            var su = window.S.units[fi];
            var fId = su._furnId || ('furn_' + (su.id || fi) + '_' + Date.now());
            su._furnId = fId;
            furnList.push({
              id: fId,
              name: su.label || ('Unit ' + (fi + 1)),
              category: su.ctype || 'wardrobe',
              dimensions: { W: su.W || 900, H: su.H || 2100, D: su.D || 600 },
              elevation: su.elev || 0,
              pos: su.pos || { x: (fi % 6) * 1100 + 600, y: Math.floor(fi / 6) * 1100 + 600, z: su.elev || 0 },
              rotY: su.rotY || 0,
              unitConfig: Object.assign({}, su)
            });
          }
        } else if (this.project && this.project.data && Array.isArray(this.project.data.units) && this.project.data.units.length > 0) {
          window.S.units = JSON.parse(JSON.stringify(this.project.data.units));
          furnList = plan.furniture = plan.furniture || [];
          for (var fj = 0; fj < window.S.units.length; fj++) {
            var su2 = window.S.units[fj];
            var fId2 = su2._furnId || ('furn_' + (su2.id || fj) + '_' + Date.now());
            su2._furnId = fId2;
            furnList.push({
              id: fId2,
              name: su2.label || ('Unit ' + (fj + 1)),
              category: su2.ctype || 'wardrobe',
              dimensions: { W: su2.W || 900, H: su2.H || 2100, D: su2.D || 600 },
              elevation: su2.elev || 0,
              pos: su2.pos || { x: (fj % 6) * 1100 + 600, y: Math.floor(fj / 6) * 1100 + 600, z: su2.elev || 0 },
              rotY: su2.rotY || 0,
              unitConfig: Object.assign({}, su2)
            });
          }
        } else {
          window.S.units = [];
          window.S.active = 0;
          if (typeof window.renderRail === 'function') window.renderRail();
          if (typeof window.renderLegend === 'function') window.renderLegend();
          if (typeof window.renderFoot === 'function') window.renderFoot();
          return;
        }
      }

      window.S.units = window.S.units || [];

      // Map existing units by _furnId
      var existingMap = {};
      window.S.units.forEach(function (u) {
        if (u._furnId) existingMap[u._furnId] = u;
      });

      var newUnits = [];
      for (var f = 0; f < furnList.length; f++) {
        var fn = furnList[f];
        // Exclude decor and appliance styling items from modular woodwork cutting list!
        if (fn.isDecor || fn.excludeFromPricing || fn.category === 'decor' || fn.category === 'appliance_decor') {
          continue;
        }
        var isKitchen = (fn.category && fn.category.indexOf('kitchen') !== -1);
        var existing = existingMap[fn.id];

        var isWall = (window.OrbixCore && window.OrbixCore.isWallUnit) ?
          window.OrbixCore.isWallUnit(fn.category, fn.name, fn.code || fn.catalogItemId, fn.costCategory) :
          (fn.category === 'kitchen_wall' || (fn.category && fn.category.indexOf('wall') !== -1) || (fn.name && fn.name.toLowerCase().indexOf('wall') !== -1));
        var isBase = !isWall && (isKitchen || fn.category === 'crockery' || fn.category === 'tv_unit' || (fn.name && fn.name.indexOf('BASE') !== -1));
        var isRolling = !!(
          (fn.id && /wfm60[-_ ]*roll/i.test(fn.id)) ||
          (fn.catalogItemId && /wfm60[-_ ]*roll/i.test(fn.catalogItemId)) ||
          (fn.code && /wfm60[-_ ]*roll/i.test(fn.code)) ||
          (fn.unitConfig && (fn.unitConfig.isRollingShutter || fn.unitConfig.shutterType === 'rolling_shutter')) ||
          /rolling\s*shutter/i.test(fn.name || '')
        );
        var defUnitElev = isRolling ? 750 : (isWall ? 1500 : 0);
        var unitElev = (fn.elevation !== undefined && fn.elevation !== null && fn.elevation !== '') ?
          parseFloat(fn.elevation) : ((fn.pos && fn.pos.z !== undefined && fn.pos.z !== null && fn.pos.z !== 0) ? parseFloat(fn.pos.z) : defUnitElev);

        if (existing) {
          if (fn.name) existing.label = fn.name;
          existing.elev = unitElev;
          
          // Bidirectional preservation: project unit fn is primary source of truth
          if (fn.unitConfig && fn.unitConfig.shutterCol) {
            existing.shutterCol = fn.unitConfig.shutterCol;
          } else if (fn.materials && fn.materials.shutter && fn.materials.shutter.finish) {
            existing.shutterCol = fn.materials.shutter.finish;
          } else if (existing.shutterCol) {
            fn.unitConfig = fn.unitConfig || {};
            fn.unitConfig.shutterCol = existing.shutterCol;
            fn.materials = fn.materials || {};
            fn.materials.shutter = fn.materials.shutter || {};
            fn.materials.shutter.finish = existing.shutterCol;
          }

          // Preserve per-shutter colors array without blowing away individual shutter edits
          var activeFinish = (fn.unitConfig && fn.unitConfig.shutterCol) || (existing && existing.shutterCol) || '#6e4e35';
          var sCnt = (fn.unitConfig && fn.unitConfig.shutters) || 2;
          fn.shutterColors = fn.shutterColors || [];
          fn.shutterMaterials = fn.shutterMaterials || [];
          for (var sc = 0; sc < sCnt; sc++) {
            if (!fn.shutterColors[sc]) fn.shutterColors[sc] = toValidHexColor(activeFinish, '#6e4e35');
            if (!fn.shutterMaterials[sc]) fn.shutterMaterials[sc] = activeFinish;
          }

          if (fn.unitConfig && fn.unitConfig.carcass) {
            existing.carcass = fn.unitConfig.carcass;
          } else if (fn.materials && fn.materials.carcass && fn.materials.carcass.finish) {
            existing.carcass = fn.materials.carcass.finish;
          } else if (existing.carcass) {
            fn.unitConfig = fn.unitConfig || {};
            fn.unitConfig.carcass = existing.carcass;
            fn.materials = fn.materials || {};
            fn.materials.carcass = fn.materials.carcass || {};
            fn.materials.carcass.finish = existing.carcass;
          }

          if (fn.unitConfig && fn.unitConfig.dstyle) {
            existing.dstyle = fn.unitConfig.dstyle;
          } else if (existing.dstyle) {
            fn.unitConfig = fn.unitConfig || {};
            fn.unitConfig.dstyle = existing.dstyle;
          }

          if (existing.handle) {
            fn.unitConfig = fn.unitConfig || {};
            fn.unitConfig.handle = existing.handle;
          } else if (fn.unitConfig && fn.unitConfig.handle) {
            existing.handle = fn.unitConfig.handle;
          }

          if (existing.hfinish) {
            fn.unitConfig = fn.unitConfig || {};
            fn.unitConfig.hfinish = existing.hfinish;
          } else if (fn.unitConfig && fn.unitConfig.hfinish) {
            existing.hfinish = fn.unitConfig.hfinish;
          }

          if (existing.type) {
            fn.unitConfig = fn.unitConfig || {};
            fn.unitConfig.type = existing.type;
          } else if (fn.unitConfig && fn.unitConfig.type) {
            existing.type = fn.unitConfig.type;
          }

          if (existing.shutters !== undefined) {
            fn.unitConfig = fn.unitConfig || {};
            fn.unitConfig.shutters = existing.shutters;
          } else if (fn.unitConfig && fn.unitConfig.shutters !== undefined) {
            existing.shutters = fn.unitConfig.shutters;
          }

          if (existing.drawers !== undefined) {
            fn.unitConfig = fn.unitConfig || {};
            fn.unitConfig.drawers = existing.drawers;
          } else if (fn.unitConfig && fn.unitConfig.drawers !== undefined) {
            existing.drawers = fn.unitConfig.drawers;
          }

          if (existing.shelves !== undefined) {
            fn.unitConfig = fn.unitConfig || {};
            fn.unitConfig.shelves = existing.shelves;
          } else if (fn.unitConfig && fn.unitConfig.shelves !== undefined) {
            existing.shelves = fn.unitConfig.shelves;
          }

          if (existing.loft !== undefined) {
            fn.unitConfig = fn.unitConfig || {};
            fn.unitConfig.loft = existing.loft;
          } else if (fn.unitConfig && fn.unitConfig.loft !== undefined) {
            existing.loft = fn.unitConfig.loft;
          }

          if (existing.loftH !== undefined) {
            fn.unitConfig = fn.unitConfig || {};
            fn.unitConfig.loftH = existing.loftH;
          } else if (fn.unitConfig && fn.unitConfig.loftH !== undefined) {
            existing.loftH = fn.unitConfig.loftH;
          }

          if (existing.W) {
            fn.dimensions = fn.dimensions || {};
            fn.dimensions.W = existing.W;
          } else if (fn.dimensions && fn.dimensions.W) {
            existing.W = fn.dimensions.W;
          }
          if (existing.H) {
            fn.dimensions = fn.dimensions || {};
            fn.dimensions.H = existing.H;
          } else if (fn.dimensions && fn.dimensions.H) {
            existing.H = fn.dimensions.H;
          }
          if (existing.D) {
            fn.dimensions = fn.dimensions || {};
            fn.dimensions.D = existing.D;
          } else if (fn.dimensions && fn.dimensions.D) {
            existing.D = fn.dimensions.D;
          }

          if (existing.ctype === 'kitchen') existing.ctype = isWall ? 'kwall' : 'kbase';
          if (existing.ctype === 'tv' || existing.ctype === 'crockery') existing.ctype = isWall ? 'kwall' : (isBase ? 'kbase' : 'wardrobe');
          if (existing.ctype) {
            fn.unitConfig = fn.unitConfig || {};
            fn.unitConfig.ctype = existing.ctype;
          } else if (fn.unitConfig && fn.unitConfig.ctype) {
            if (fn.unitConfig.ctype === 'kitchen') fn.unitConfig.ctype = isWall ? 'kwall' : 'kbase';
            if (fn.unitConfig.ctype === 'tv' || fn.unitConfig.ctype === 'crockery') fn.unitConfig.ctype = isWall ? 'kwall' : (isBase ? 'kbase' : 'wardrobe');
            existing.ctype = fn.unitConfig.ctype;
          }

          if (existing.counter) {
            fn.unitConfig = fn.unitConfig || {};
            fn.unitConfig.counter = existing.counter;
          } else if (fn.unitConfig && fn.unitConfig.counter) {
            existing.counter = fn.unitConfig.counter;
          }

          if (existing.sections !== undefined) {
            fn.unitConfig = fn.unitConfig || {};
            fn.unitConfig.sections = existing.sections;
          } else if (fn.unitConfig && fn.unitConfig.sections !== undefined) {
            existing.sections = fn.unitConfig.sections;
          }

          if (existing.back !== undefined) {
            fn.unitConfig = fn.unitConfig || {};
            fn.unitConfig.back = existing.back;
          } else if (fn.unitConfig && fn.unitConfig.back !== undefined) {
            existing.back = fn.unitConfig.back;
          }

          if (existing.drawerH !== undefined) {
            fn.unitConfig = fn.unitConfig || {};
            fn.unitConfig.drawerH = existing.drawerH;
          } else if (fn.unitConfig && fn.unitConfig.drawerH !== undefined) {
            existing.drawerH = fn.unitConfig.drawerH;
          }

          if (existing.loftShutters !== undefined) {
            fn.unitConfig = fn.unitConfig || {};
            fn.unitConfig.loftShutters = existing.loftShutters;
          } else if (fn.unitConfig && fn.unitConfig.loftShutters !== undefined) {
            existing.loftShutters = fn.unitConfig.loftShutters;
          }

          var isExistingFbcm = !!(
            (fn.unitConfig && (fn.unitConfig.geometryType === 'l_shaped_corner' || fn.unitConfig.unitType === 'fbcm' || fn.unitConfig.unitType === 'wbcm' || (fn.unitConfig.corner && fn.unitConfig.corner.enabled))) ||
            fn.id === 'fbcm' || fn.catalogItemId === 'fbcm' ||
            fn.id === 'f_fbcm_1' || fn.catalogItemId === 'f_fbcm_1' ||
            (fn.id && /fbcm|wbcm/i.test(fn.id)) ||
            (fn.catalogItemId && /fbcm|wbcm/i.test(fn.catalogItemId)) ||
            (fn.code && /fbcm|wbcm/i.test(fn.code)) ||
            (fn.name && /l[-_ ]*shaped.*corner|\bwbcm\b/i.test(fn.name))
          );
          var isExistingFcmLt = !isExistingFbcm && !!(
            (fn.unitConfig && (fn.unitConfig.unitType === 'fcm-lt' || fn.unitConfig.unitType === 'wcm-lt' || (fn.unitConfig.openShutter && fn.unitConfig.openShutter.opening === 'left'))) ||
            (fn.id && /fcm[-_ ]*lt/i.test(fn.id)) ||
            (fn.catalogItemId && /fcm[-_ ]*lt/i.test(fn.catalogItemId)) ||
            (fn.name && /(fcm[-_ ]*lt|wcm[-_ ]*lt\s*\(cookscape\))/i.test(fn.name)) ||
            fn.id === 'fcm-lt' || fn.catalogItemId === 'fcm-lt' ||
            fn.id === 'fm-lt-01' || fn.catalogItemId === 'fm-lt-01'
          );
          var isExistingFcm = !isExistingFbcm && !!(
            (fn.unitConfig && fn.unitConfig.fixedPanel && fn.unitConfig.fixedPanel.enabled) ||
            isExistingFcmLt ||
            (fn.unitConfig && (fn.unitConfig.unitType === 'fcm-rt' || fn.unitConfig.unitType === 'fcm-lt' || fn.unitConfig.unitType === 'wcm-rt' || fn.unitConfig.unitType === 'wcm-lt')) ||
            (fn.id && /fcm[-_ ]*(rt|lt)/i.test(fn.id)) ||
            (fn.catalogItemId && /fcm[-_ ]*(rt|lt)/i.test(fn.catalogItemId)) ||
            (fn.name && /(fcm[-_ ]*(rt|lt)|wcm[-_ ]*(rt|lt)\s*\(cookscape\))/i.test(fn.name)) ||
            fn.id === 'fcm-rt' || fn.catalogItemId === 'fcm-rt' ||
            fn.id === 'fm-rt-01' || fn.catalogItemId === 'fm-rt-01' ||
            fn.id === 'fcm-lt' || fn.catalogItemId === 'fcm-lt' ||
            fn.id === 'fm-lt-01' || fn.catalogItemId === 'fm-lt-01'
          );
          if (isExistingFbcm) {
            existing.unitType = (fn.unitConfig && fn.unitConfig.unitType) || (isWall ? 'wbcm' : 'fbcm');
            existing.geometryType = 'l_shaped_corner';
            existing.shutters = 2;
            existing.sections = 1;
            existing.shelves = 2;
            existing.handle = (fn.unitConfig && fn.unitConfig.handle) || 'standard';
            existing.hfinish = (fn.unitConfig && fn.unitConfig.hfinish) || 'black';
            existing.counter = (fn.unitConfig && fn.unitConfig.counter) || (isWall ? 'none' : 'black');
          } else if (isExistingFcm) {
            var exHalfW = Math.round(((fn.dimensions && fn.dimensions.W) || existing.W || 600) / 2);
            existing.unitType = isExistingFcmLt ? 'fcm-lt' : 'fcm-rt';
            existing.fixedPanel = (fn.unitConfig && fn.unitConfig.fixedPanel) || { enabled: true, width: exHalfW, type: 'fixed' };
            existing.openShutter = (fn.unitConfig && fn.unitConfig.openShutter) || { enabled: true, width: (((fn.dimensions && fn.dimensions.W) || existing.W || 600) - exHalfW), type: 'shutter', count: 1, opening: isExistingFcmLt ? 'left' : 'right' };
            existing.shutters = 1;
            existing.sections = 2;
            existing.shelves = 1;
            existing.handle = (fn.unitConfig && fn.unitConfig.handle) || 'pull';
            existing.hfinish = (fn.unitConfig && fn.unitConfig.hfinish) || 'black';
            if (isWall) existing.counter = 'none';
          }
          if (fn.unitConfig) existing.unitConfig = Object.assign({}, fn.unitConfig);
          if (fn.catalogItemId) existing.catalogItemId = fn.catalogItemId;

          newUnits.push(existing);
        } else {
          var isFbcmNew = !!(
            (fn.unitConfig && (fn.unitConfig.geometryType === 'l_shaped_corner' || fn.unitConfig.unitType === 'fbcm' || fn.unitConfig.unitType === 'wbcm' || (fn.unitConfig.corner && fn.unitConfig.corner.enabled))) ||
            fn.id === 'fbcm' || fn.catalogItemId === 'fbcm' ||
            fn.id === 'f_fbcm_1' || fn.catalogItemId === 'f_fbcm_1' ||
            (fn.id && /fbcm|wbcm/i.test(fn.id)) ||
            (fn.catalogItemId && /fbcm|wbcm/i.test(fn.catalogItemId)) ||
            (fn.code && /fbcm|wbcm/i.test(fn.code)) ||
            (fn.name && /l[-_ ]*shaped.*corner|\bwbcm\b/i.test(fn.name))
          );
          var isFcmLtNew = !isFbcmNew && !!(
            (fn.unitConfig && (fn.unitConfig.unitType === 'fcm-lt' || fn.unitConfig.unitType === 'wcm-lt' || (fn.unitConfig.openShutter && fn.unitConfig.openShutter.opening === 'left'))) ||
            (fn.id && /fcm[-_ ]*lt/i.test(fn.id)) ||
            (fn.catalogItemId && /fcm[-_ ]*lt/i.test(fn.catalogItemId)) ||
            (fn.name && /(fcm[-_ ]*lt|wcm[-_ ]*lt\s*\(cookscape\))/i.test(fn.name)) ||
            fn.id === 'fcm-lt' || fn.catalogItemId === 'fcm-lt' ||
            fn.id === 'fm-lt-01' || fn.catalogItemId === 'fm-lt-01'
          );
          var isFcmNew = !isFbcmNew && !!(
            (fn.unitConfig && fn.unitConfig.fixedPanel && fn.unitConfig.fixedPanel.enabled) ||
            isFcmLtNew ||
            (fn.unitConfig && (fn.unitConfig.unitType === 'fcm-rt' || fn.unitConfig.unitType === 'fcm-lt' || fn.unitConfig.unitType === 'wcm-rt' || fn.unitConfig.unitType === 'wcm-lt')) ||
            (fn.id && /fcm[-_ ]*(rt|lt)/i.test(fn.id)) ||
            (fn.catalogItemId && /fcm[-_ ]*(rt|lt)/i.test(fn.catalogItemId)) ||
            (fn.name && /(fcm[-_ ]*(rt|lt)|wcm[-_ ]*(rt|lt)\s*\(cookscape\))/i.test(fn.name)) ||
            fn.id === 'fcm-rt' || fn.catalogItemId === 'fcm-rt' ||
            fn.id === 'fm-rt-01' || fn.catalogItemId === 'fm-rt-01' ||
            fn.id === 'fcm-lt' || fn.catalogItemId === 'fcm-lt' ||
            fn.id === 'fm-lt-01' || fn.catalogItemId === 'fm-lt-01'
          );
          var defH = (fn.dimensions && fn.dimensions.H) || (isWall ? 600 : isKitchen ? 750 : (fn.category === 'tv_unit' ? 450 : 2100));
          var defW = (fn.dimensions && fn.dimensions.W) || (isKitchen ? 600 : 1200);
          var defD = (fn.dimensions && fn.dimensions.D) || (isWall ? 350 : isKitchen ? 550 : 450);
          var sColNew = (fn.unitConfig && fn.unitConfig.shutterCol) || (fn.materials && fn.materials.shutter && fn.materials.shutter.finish) || 'MDF 7707';
          var cColNew = (fn.unitConfig && fn.unitConfig.carcass) || (fn.materials && fn.materials.carcass && fn.materials.carcass.finish) || 'MDF 6601';
          var u = {
            label: fn.name,
            ctype: isWall ? 'kwall' : (isBase ? 'kbase' : 'wardrobe'),
            _furnId: fn.id,
            unitType: (fn.unitConfig && fn.unitConfig.unitType) || fn.catalogItemId || (isFbcmNew ? (isWall ? 'wbcm' : 'fbcm') : (isFcmNew ? (isFcmLtNew ? 'fcm-lt' : 'fcm-rt') : undefined)),
            geometryType: (fn.unitConfig && fn.unitConfig.geometryType) || (isFbcmNew ? 'l_shaped_corner' : undefined),
            catalogItemId: fn.catalogItemId || fn.id,
            fixedPanel: (fn.unitConfig && fn.unitConfig.fixedPanel) || (isFcmNew ? { enabled: true, width: Math.round(defW / 2), type: 'fixed' } : undefined),
            openShutter: (fn.unitConfig && fn.unitConfig.openShutter) || (isFcmNew ? { enabled: true, width: defW - Math.round(defW / 2), type: 'shutter', count: 1, opening: isFcmLtNew ? 'left' : 'right' } : undefined),
            unitConfig: fn.unitConfig ? Object.assign({}, fn.unitConfig) : undefined,
            elev: unitElev,
            W: (fn.dimensions && fn.dimensions.W) || defW,
            H: (fn.dimensions && fn.dimensions.H) || defH,
            D: (fn.dimensions && fn.dimensions.D) || defD,
            T: 18,
            type: (fn.unitConfig && (fn.unitConfig.type || fn.unitConfig.doorType)) || 'hinged',
            shutters: (fn.unitConfig && fn.unitConfig.shutters !== undefined) ? fn.unitConfig.shutters : (isFbcmNew ? 2 : (isFcmNew ? 1 : (defW > 1200 ? 3 : defW > 600 ? 2 : 1))),
            sections: (fn.unitConfig && fn.unitConfig.sections) || (isFbcmNew ? 1 : (isFcmNew ? 2 : (defW > 1200 ? 2 : 1))),
            shelves: (fn.unitConfig && fn.unitConfig.shelves) || (isFbcmNew ? 2 : (isFcmNew ? 1 : (isKitchen ? 1 : 3))),
            drawers: (fn.unitConfig && fn.unitConfig.drawers) || 0,
            drawerH: 180,
            loft: (fn.unitConfig && fn.unitConfig.loft) || false,
            loftH: 600,
            loftShutters: 2,
            back: 18,
            dstyle: (fn.unitConfig && fn.unitConfig.dstyle) || 'slab',
            handle: (fn.unitConfig && fn.unitConfig.handle) || (isFcmNew ? 'pull' : 'gprof'),
            hfinish: (fn.unitConfig && fn.unitConfig.hfinish) || 'black',
            counter: (fn.unitConfig && fn.unitConfig.counter) || (isBase ? (fn.unitConfig && fn.unitConfig.counter ? fn.unitConfig.counter : 'black') : 'none'),
            carcass: cColNew,
            shutterCol: sColNew,
            tvBack: 'none',
            tvShow: false,
            tvFloat: false
          };
          newUnits.push(u);
        }
      }

      window.S.units = newUnits;

      // Select specific unit, current active, or first unit
      var targetIdx = 0;
      if (selectFurnId) {
        for (var i = 0; i < window.S.units.length; i++) {
          if (window.S.units[i]._furnId === selectFurnId) {
            targetIdx = i;
            break;
          }
        }
      } else if (this.editor && this.editor.selected && this.editor.selected.length) {
        var selId = this.editor.selected[0].id;
        for (var j = 0; j < window.S.units.length; j++) {
          if (window.S.units[j]._furnId === selId) {
            targetIdx = j;
            break;
          }
        }
      } else if (typeof window.S.active === 'number' && window.S.active >= 0 && window.S.active < window.S.units.length) {
        targetIdx = window.S.active;
      }
      window.S.active = targetIdx;
      var isDesignActive = (typeof document !== 'undefined') && document.getElementById('view-design') && document.getElementById('view-design').classList.contains('is-on');
      if (isDesignActive) {
        if (typeof window.renderRail === 'function') window.renderRail();
        if (typeof window.renderLegend === 'function') window.renderLegend();
        if (typeof window.renderFoot === 'function') window.renderFoot();
      }
    },

    selectFurnitureIn3DStudio: function (furnId) {
      if (furnId === undefined || furnId === null) return;
      if (typeof furnId === 'number' && window.S && window.S.units && window.S.units[furnId]) {
        furnId = window.S.units[furnId]._furnId || furnId;
      }
      if (!furnId && typeof furnId !== 'number') return;
      if (typeof this.sync3DStudioUnits === 'function') {
        this.sync3DStudioUnits();
      }
      this.syncProjectUnitsTo3DStudio(furnId);
      for (var i = 0; i < window.S.units.length; i++) {
        if (window.S.units[i]._furnId === furnId || (typeof furnId === 'number' && i === furnId)) {
          window.S.active = i;
          break;
        }
      }
      if (typeof window.renderRail === 'function') window.renderRail();
      if (typeof window.renderLegend === 'function') window.renderLegend();
      if (typeof window.renderFoot === 'function') window.renderFoot();
      if (typeof window.buildScene === 'function') window.buildScene();

      // Unit selection in 3D preserves camera angle and position perfectly (no unwanted teleport)
      this.highlight3DFurniture(furnId);
    },

    zoomToFurnitureIn3D: function (furnId) {
      if (!furnId || !window.__cc || !window.__cc.gl) return;
      var gl = window.__cc.gl;
      var scene = gl.getScene ? gl.getScene() : null;
      var homeObj = scene ? scene.getObjectByName('OrbixHome3D') : null;
      if (!homeObj) return;

      var targetMesh = null;
      homeObj.traverse(function (obj) {
        if (obj.userData && obj.userData.isFurnitureGroup && obj.userData.furnitureId === furnId) {
          targetMesh = obj;
        }
      });

      if (targetMesh) {
        targetMesh.updateMatrixWorld(true);
        var box = new THREE.Box3().setFromObject(targetMesh);
        if (!box.isEmpty()) {
          var center = box.getCenter(new THREE.Vector3());
          var size = box.getSize(new THREE.Vector3());
          var tgt = gl.getTarget ? gl.getTarget() : null;
          if (tgt) {
            tgt.copy(center);
          }
          var plan = this.getPlan();
          var f = plan && plan.furniture ? plan.furniture.find(function (it) { return it.id === furnId; }) : null;
          if (window.cam) {
            var rot = f ? (f.rotY || 0) : 0;
            window.cam.yaw = -(rot * 180 / Math.PI) - 20;
            window.cam.pitch = -10;
            window.cam.zoom = 1.2;
          }
          if (typeof window.camApply === 'function') window.camApply();
          if (gl.settle) gl.settle();
          if (typeof toast === 'function') toast("🎯 Focused on " + ((f && f.name) || 'Unit'));
        }
      }
    },

    highlight3DFurniture: function (furnId) {
      if (!window.__cc || !window.__cc.gl) return;
      var gl = window.__cc.gl;
      var scene = gl.getScene ? gl.getScene() : null;
      var homeObj = scene ? scene.getObjectByName('OrbixHome3D') : null;
      if (homeObj) {
        var selGroup = null;
        homeObj.traverse(function (obj) {
          if (obj.userData && obj.userData.isFurnitureGroup) {
            obj.visible = true;
            if (furnId && obj.userData.furnitureId === furnId) {
              selGroup = obj;
            }
          }
        });
        if (gl.gizmoSet && furnId && selGroup) {
          gl.gizmoSet(selGroup, furnId);
        }
      }
      if (gl.settle) gl.settle();
    },

    sync3DStudioUnits: function () {
      if (!window.S || !window.S.units) return;
      var plan = this.getPlan();
      if (!plan) return;
      var furnList = plan.furniture = plan.furniture || [];

      for (var uIdx = 0; uIdx < window.S.units.length; uIdx++) {
        var u = window.S.units[uIdx];
        if (!u || !u._furnId) continue;
        var match = null;

        for (var f = 0; f < furnList.length; f++) {
          if (furnList[f].id === u._furnId) {
            match = furnList[f];
            break;
          }
        }

        if (match) {
          if (u.label) match.name = u.label;
          match.dimensions = { W: u.W || match.dimensions.W, H: u.H || match.dimensions.H, D: u.D || match.dimensions.D };
          match.unitConfig = match.unitConfig || {};
          if (u.shutters !== undefined) match.unitConfig.shutters = u.shutters;
          if (u.handle) match.unitConfig.handle = u.handle;
          if (u.dstyle) match.unitConfig.dstyle = u.dstyle;
          if (u.drawers !== undefined) match.unitConfig.drawers = u.drawers;
          if (u.shelves !== undefined) match.unitConfig.shelves = u.shelves;
          if (u.ctype) match.unitConfig.ctype = u.ctype;
          if (u.type) match.unitConfig.type = u.type;
          if (u.counter) match.unitConfig.counter = u.counter;
          if (u.loft !== undefined) match.unitConfig.loft = u.loft;
          if (u.loftH !== undefined) match.unitConfig.loftH = u.loftH;
          if (u.back !== undefined) match.unitConfig.back = u.back;
          if (u.hfinish) match.unitConfig.hfinish = u.hfinish;
          if (match.elevation !== undefined && match.elevation !== null && match.elevation !== '') {
            u.elev = parseFloat(match.elevation);
            if (match.pos) match.pos.z = parseFloat(match.elevation);
          } else if (u.elev !== undefined) {
            match.elevation = u.elev;
            if (match.pos) match.pos.z = u.elev;
          }
          if (u.drawers !== undefined) {
            match.unitConfig.drawers = u.drawers;
            match.drawerStates = match.drawerStates || [];
            while (match.drawerStates.length < u.drawers) match.drawerStates.push(false);
          }
          if (u.shutters !== undefined) {
            match.unitConfig.shutters = u.shutters;
            match.shutterStates = match.shutterStates || [];
            while (match.shutterStates.length < u.shutters) match.shutterStates.push(false);
          }
          if (u.shutterCol) {
            match.unitConfig.shutterCol = u.shutterCol;
            match.materials = match.materials || {};
            match.materials.shutter = match.materials.shutter || {};
            match.materials.shutter.finish = u.shutterCol;
            match.shutterColors = [];
            match.shutterMaterials = [];
            var scCount = match.unitConfig.shutters || 2;
            for (var sc = 0; sc < scCount; sc++) {
              match.shutterMaterials[sc] = u.shutterCol;
              match.shutterColors[sc] = toValidHexColor(u.shutterCol, '#6e4e35');
            }
          }
          if (u.carcass) {
            match.unitConfig.carcass = u.carcass;
            match.materials = match.materials || {};
            match.materials.carcass = match.materials.carcass || {};
            match.materials.carcass.finish = u.carcass;
          }
        }
      }
      if (this.project) this.project.units_count = furnList.length;
      this.saveToLocalStorage();
      if (root.OrbixProjects && typeof root.OrbixProjects.saveActiveProject === 'function') {
        root.OrbixProjects.saveActiveProject({ plan: this.project });
      }
      if (this.editor) this.editor.render();
      if (this.render3DHome) this.render3DHome(true);
      if (window.S && window.S.units && window.S.units[window.S.active]) {
        var curU = window.S.units[window.S.active];
        if (curU && curU._furnId) this.highlight3DFurniture(curU._furnId);
      }
    },

    placeModularUnitIn3D: function (preset) {
      var plan = this.getPlan();
      if (!plan) return;
      plan.furniture = plan.furniture || [];

      preset = preset || {
        name: 'Master Bed Wardrobe',
        category: 'wardrobe',
        dimensions: { W: 1200, H: 2100, D: 600 },
        unitConfig: { shutters: 2, handle: 'bar', shelves: 3, drawers: 0, dstyle: 'slab' },
        materials: { shutter: { finish: 'Brazilian Horizontal Walnut' }, carcass: { finish: 'Absolute White' } }
      };

      var fId = 'f_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
      var cX = 2000, cY = 2000;
      var matchedRoomId = null;

      if (plan.rooms && plan.rooms.length > 0) {
        var rm = plan.rooms[0];
        if (root.OrbixCore && root.OrbixCore.Vec2 && rm.polygon && rm.polygon.length >= 3) {
          var cent = root.OrbixCore.Vec2.polygonCentroid(rm.polygon);
          cX = cent.x;
          cY = cent.y;
          matchedRoomId = rm.id;
        }
      } else if (plan.walls && plan.walls.length > 0) {
        var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        plan.walls.forEach(function (w) {
          minX = Math.min(minX, w.start.x, w.end.x);
          maxX = Math.max(maxX, w.start.x, w.end.x);
          minY = Math.min(minY, w.start.y, w.end.y);
          maxY = Math.max(maxY, w.start.y, w.end.y);
        });
        cX = (minX + maxX) / 2;
        cY = (minY + maxY) / 2;
      }

      // Offset if units already exist so they don't stack
      if (plan.furniture.length > 0) {
        var offsetCount = plan.furniture.length % 5;
        cX += (offsetCount * 300);
      }

      var pCat = (preset.category || '').toLowerCase();
      var pNm = (preset.name || '').toLowerCase();
      var pId = String(preset.id || '').toLowerCase();
      var isLoft = (pCat.indexOf('loft') !== -1 || pNm.indexOf('loft') !== -1 || pId.indexOf('loft') !== -1);
      var isOpenBox = (pNm.indexOf('open box') !== -1 || pNm.indexOf('open_box') !== -1 || pId.indexOf('ob-') === 0 || pId.indexOf('open-box') !== -1);
      var isSpice = !isOpenBox && (pCat.indexOf('spice') !== -1 || pNm.indexOf('spice') !== -1 || pId.indexOf('spice') !== -1 || pId.indexOf('sr-') === 0);
      var isWall = !isLoft && ((window.OrbixCore && window.OrbixCore.isWallUnit) ?
        window.OrbixCore.isWallUnit(preset.category, preset.name, preset.code || preset.catalogItemId, preset.costCategory) :
        (pCat.indexOf('wall') !== -1 || pNm.indexOf('wall') !== -1 || /(^|\b|_|-)(wm|wcm)($|\b|_|-|\d+)/i.test(pNm)));
      var defElev = isLoft ? 2100 : (isOpenBox ? 1500 : (isSpice ? 1350 : (isWall ? 1500 : 0)));
      var initElev = (preset.elevation !== undefined && preset.elevation !== null && parseFloat(preset.elevation) > 0) ?
        parseFloat(preset.elevation) : defElev;

      var newFurn = Core.createFurniturePlacement({
        id: fId,
        name: preset.name || 'Modular Unit',
        category: preset.category || (isLoft ? 'loft' : (isWall ? 'kitchen_wall' : 'wardrobe')),
        catalogItemId: preset.id || preset.code || null,
        modelType: preset.modelType || null,
        costCategory: preset.costCategory || null,
        roomId: matchedRoomId,
        elevation: initElev,
        pos: { x: cX, y: cY, z: initElev },
        rotY: 0,
        dimensions: Object.assign({ W: 1200, H: isLoft ? 400 : (isWall ? 600 : 2100), D: isWall ? 350 : 600 }, preset.dimensions || {}),
        unitConfig: Object.assign({
          shutters: isWall ? 2 : 2,
          handle: 'bar',
          dstyle: 'slab',
          shelves: isWall ? 1 : 3,
          drawers: 0,
          carcass: 'Absolute White',
          shutterCol: 'Brazilian Horizontal Walnut'
        }, preset.unitConfig || {}),
        materials: Object.assign({
          shutter: { material: 'HDHMR_18mm', finish: 'Brazilian Horizontal Walnut' },
          carcass: { material: 'BWP_18mm', finish: 'Absolute White' }
        }, preset.materials || {})
      });

      plan.furniture.push(newFurn);
      this.project.units_count = plan.furniture.length;
      this.queueAutoSave();

      if (this.editor) {
        this.editor.selected = [{ type: 'furniture', id: fId }];
        this.editor.render();
      }
      this.selectFurnitureIn3DStudio(fId);

      // Fast incremental 3D addition (< 1ms instant responsiveness)
      if (this.archRenderer && this.archRenderer.group && typeof this.archRenderer.addOrUpdateFurnitureMesh === 'function') {
        this.archRenderer.addOrUpdateFurnitureMesh(newFurn);
      } else if (this.render3DHome) {
        this.render3DHome(true, undefined, fId);
      }
      this.highlight3DFurniture(fId);

      if (typeof window.showToast === 'function') {
        window.showToast('Placed ' + newFurn.name + ' in 3D room');
      }
    },

    openPlaceUnitModal3D: function () {
      this.openFurnitureCatalogModal();
    },

    openFurnitureCatalogModal: function () {
      var modal = document.getElementById('modalFurnitureCatalog');
      if (modal) {
        modal.classList.add('is-open');
        if (typeof this._renderFurnCatalog === 'function') {
          this._renderFurnCatalog();
        }
        var searchInput = document.getElementById('furnCatalogSearch');
        if (searchInput) {
          setTimeout(function () { searchInput.focus(); }, 120);
        }
      }
    },

    openAIDecorModal: function () {
      var modal = document.getElementById('modalAIDecor');
      if (modal) {
        modal.classList.add('is-open');
        modal.style.display = 'flex';
      }
    },

    closeAIDecorModal: function () {
      var modal = document.getElementById('modalAIDecor');
      if (modal) {
        modal.classList.remove('is-open');
        modal.style.display = 'none';
      }
      if (this.editor) {
        this.editor.resize();
        this.editor.render();
      }
    },

    initAIDecorModal: function () {
      var self = this;
      var modal = document.getElementById('modalAIDecor');
      var openBtn = document.getElementById('openAIDecorBtn');
      var open3DBtn = document.getElementById('openAIDecor3DBtn');
      if (!modal) return;

      if (openBtn) {
        openBtn.addEventListener('click', function () {
          self.openAIDecorModal();
        });
      }
      if (open3DBtn) {
        open3DBtn.addEventListener('click', function () {
          self.openAIDecorModal();
        });
      }

      modal.querySelectorAll('.modal-close-btn, .modal-backdrop, #closeAIDecorModalBtn').forEach(function (b) {
        b.addEventListener('click', function () {
          self.closeAIDecorModal();
        });
      });

      var btnLiving = document.getElementById('btnAIDecorLiving');
      if (btnLiving) {
        btnLiving.addEventListener('click', function () {
          self.applyAIDecor(null, 'living');
          self.closeAIDecorModal();
        });
      }

      var btnKitchen = document.getElementById('btnAIDecorKitchen');
      if (btnKitchen) {
        btnKitchen.addEventListener('click', function () {
          self.applyAIDecor(null, 'kitchen');
          self.closeAIDecorModal();
        });
      }

      var btnBed = document.getElementById('btnAIDecorBedroom');
      if (btnBed) {
        btnBed.addEventListener('click', function () {
          self.applyAIDecor(null, 'bedroom');
          self.closeAIDecorModal();
        });
      }

      var btnAll = document.getElementById('btnAIDecorAllRooms');
      if (btnAll) {
        btnAll.addEventListener('click', function () {
          self.applyAIDecor(null, null);
          self.closeAIDecorModal();
        });
      }

      var btnClear = document.getElementById('btnAIClearAllDecors');
      if (btnClear) {
        btnClear.addEventListener('click', function () {
          self.clearAIDecors(null);
          self.closeAIDecorModal();
        });
      }
    },

    applyAIDecor: function (targetRoomId, explicitCategory) {
      var self = this;
      var plan = (this.project && this.project.plan) || {};
      var rooms = plan.rooms || [];
      if (!rooms.length && typeof Core !== 'undefined' && typeof Core.detectRooms === 'function') {
        try { Core.detectRooms(this.project); } catch (_) {}
        rooms = plan.rooms || [];
      }

      var targetRoom = null;
      if (targetRoomId) {
        targetRoom = rooms.find(function (r) { return r.id === targetRoomId; });
      } else if (this.editor && this.editor.selected && this.editor.selected.length === 1 && this.editor.selected[0].type === 'room') {
        targetRoom = rooms.find(function (r) { return r.id === self.editor.selected[0].id; });
      }

      if (!targetRoom && explicitCategory && rooms.length > 0) {
        targetRoom = rooms.find(function (r) {
          var n = (r.name || '').toLowerCase();
          if (explicitCategory === 'kitchen') return n.indexOf('kitchen') !== -1 || n.indexOf('cook') !== -1 || n.indexOf('pantry') !== -1;
          if (explicitCategory === 'bedroom') return n.indexOf('bed') !== -1 || n.indexOf('master') !== -1 || n.indexOf('guest') !== -1 || n.indexOf('kids') !== -1;
          if (explicitCategory === 'living') return n.indexOf('living') !== -1 || n.indexOf('hall') !== -1 || n.indexOf('drawing') !== -1 || n.indexOf('lounge') !== -1;
          return false;
        });
      }

      if (!targetRoom && rooms.length > 0) {
        targetRoom = rooms[0];
      }

      // Fallback if no rooms detected yet but walls exist
      if (!targetRoom && (!rooms || !rooms.length) && plan.walls && plan.walls.length >= 3) {
        var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        plan.walls.forEach(function (w) {
          if (w.start && w.end) {
            minX = Math.min(minX, w.start.x, w.end.x);
            maxX = Math.max(maxX, w.start.x, w.end.x);
            minY = Math.min(minY, w.start.y, w.end.y);
            maxY = Math.max(maxY, w.start.y, w.end.y);
          }
        });
        if (isFinite(minX) && isFinite(maxX) && maxX > minX + 500) {
          targetRoom = {
            id: 'room_auto_decor_' + Date.now(),
            name: explicitCategory ? (explicitCategory.toUpperCase() + ' ROOM') : 'LIVING ROOM',
            polygon: [
              { x: minX + 200, y: minY + 200 },
              { x: maxX - 200, y: minY + 200 },
              { x: maxX - 200, y: maxY - 200 },
              { x: minX + 200, y: maxY - 200 }
            ]
          };
          rooms = [targetRoom];
        }
      }

      // If still no room or walls, open AI Decor modal so user can pick when ready
      if (!targetRoom && !explicitCategory) {
        this.openAIDecorModal();
        return;
      }

      var decorsCatalog = (typeof window !== 'undefined' && window.ORBIX_DECORS_CATALOG) || [];
      function findCatalogItem(id) {
        return decorsCatalog.find(function (it) { return it.id === id || it.slug === id; });
      }

      var roomsToDecorate = targetRoom ? [targetRoom] : rooms;
      var totalAdded = 0;

      roomsToDecorate.forEach(function (rm) {
        var rName = (rm.name || '').toLowerCase();
        var category = explicitCategory || (
          (rName.indexOf('kitchen') !== -1 || rName.indexOf('cook') !== -1 || rName.indexOf('pantry') !== -1) ? 'kitchen' :
          (rName.indexOf('bed') !== -1 || rName.indexOf('master') !== -1 || rName.indexOf('guest') !== -1 || rName.indexOf('kids') !== -1) ? 'bedroom' :
          'living'
        );

        var poly = rm.polygon || [];
        if (!poly.length || poly.length < 3) return;

        var centroid = (typeof Vec2 !== 'undefined' && Vec2.polygonCentroid) ? Vec2.polygonCentroid(poly) : { x: 0, y: 0 };
        var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        poly.forEach(function (pt) {
          minX = Math.min(minX, pt.x); maxX = Math.max(maxX, pt.x);
          minY = Math.min(minY, pt.y); maxY = Math.max(maxY, pt.y);
        });
        var rWidth = maxX - minX;
        var rDepth = maxY - minY;

        // Find longest wall in this room
        var walls = plan.walls || [];
        var roomWalls = walls.filter(function (w) {
          return rm.wallIds && rm.wallIds.indexOf(w.id) !== -1 && !w.isDivider;
        });
        if (!roomWalls.length) roomWalls = walls;
        roomWalls.sort(function (a, b) {
          var lenA = Math.hypot(a.end.x - a.start.x, a.end.y - a.start.y);
          var lenB = Math.hypot(b.end.x - b.start.x, b.end.y - b.start.y);
          return lenB - lenA;
        });
        var primaryWall = roomWalls[0] || { start: { x: minX, y: minY }, end: { x: maxX, y: minY } };

        // Wall vector, tangent & inward normal towards centroid
        var dx = primaryWall.end.x - primaryWall.start.x;
        var dy = primaryWall.end.y - primaryWall.start.y;
        var wLen = Math.hypot(dx, dy) || 1;
        var tx = dx / wLen, ty = dy / wLen;
        var nx = -ty, ny = tx;
        var wallMid = { x: (primaryWall.start.x + primaryWall.end.x) / 2, y: (primaryWall.start.y + primaryWall.end.y) / 2 };
        var toCenter = { x: centroid.x - wallMid.x, y: centroid.y - wallMid.y };
        if (nx * toCenter.x + ny * toCenter.y < 0) { nx = -nx; ny = -ny; }
        var wallAngle = Math.atan2(ty, tx);

        // Remove previous AI-generated decors from this room
        plan.furniture = (plan.furniture || []).filter(function (f) {
          return !(f.aiGenerated && (f.roomId === rm.id || Vec2.pointInPolygon(f.pos || { x: 0, y: 0 }, poly)));
        });

        if (category === 'living') {
          // 1. TV (Xiaomi 65" 4K Smart TV mounted at 950mm AFFL against wall)
          var tvItem = findCatalogItem('decor_7_mi_tv') || {
            id: 'decor_7_mi_tv', name: 'Xiaomi Mi 65" Smart 4K TV',
            dimensions: { W: 1450, H: 860, D: 65 }, modelUrl: 'assets/decors/7_mi_tv.glb'
          };
          var tvPos = { x: wallMid.x + nx * 80, y: wallMid.y + ny * 80, z: 950 };
          plan.furniture.push(Core.createFurniturePlacement({
            id: 'ai_tv_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            name: tvItem.name,
            category: 'decor',
            decorType: 'tv',
            isDecor: true,
            excludeFromPricing: true,
            aiGenerated: true,
            roomId: rm.id,
            modelUrl: tvItem.modelUrl,
            dimensions: tvItem.dimensions,
            pos: tvPos,
            elevation: 950,
            rotY: wallAngle
          }));

          // 2. 3-Seater Sofa (Ashley Padova facing the TV)
          var sofaItem = findCatalogItem('decor_ashley_padova_3_seater_sofa') || {
            id: 'decor_ashley_padova_3_seater_sofa', name: 'Ashley Padova 3-Seater Sofa',
            dimensions: { W: 2400, H: 980, D: 1020 }, modelUrl: 'assets/decors/ashley_padova_3_seater_sofa.glb'
          };
          var sofaDist = Math.min(Math.max(1800, rDepth * 0.45), 2600);
          var sofaPos = { x: wallMid.x + nx * sofaDist, y: wallMid.y + ny * sofaDist, z: 0 };
          plan.furniture.push(Core.createFurniturePlacement({
            id: 'ai_sofa_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            name: sofaItem.name,
            category: 'decor',
            decorType: 'sofa',
            isDecor: true,
            excludeFromPricing: true,
            aiGenerated: true,
            roomId: rm.id,
            modelUrl: sofaItem.modelUrl,
            dimensions: sofaItem.dimensions,
            pos: sofaPos,
            elevation: 0,
            rotY: wallAngle + Math.PI // Faces toward the TV
          }));

          // 3. Tall Fiddle Fig Tree Planter
          var plantItem = findCatalogItem('decor_flower_pot_12') || findCatalogItem('decor_conc_flower_pot') || {
            id: 'decor_flower_pot_12', name: 'Tall Indoor Fiddle Fig Tree',
            dimensions: { W: 680, H: 1750, D: 680 }, modelUrl: 'assets/decors/flower_pot_12.glb'
          };
          var plantPos = { x: wallMid.x - tx * Math.min(wLen * 0.38, 1400) + nx * 500, y: wallMid.y - ty * Math.min(wLen * 0.38, 1400) + ny * 500, z: 0 };
          plan.furniture.push(Core.createFurniturePlacement({
            id: 'ai_plant_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            name: plantItem.name,
            category: 'decor',
            decorType: 'plant',
            isDecor: true,
            excludeFromPricing: true,
            aiGenerated: true,
            roomId: rm.id,
            modelUrl: plantItem.modelUrl,
            dimensions: plantItem.dimensions,
            pos: plantPos,
            elevation: 0,
            rotY: 0
          }));

          // 4. Contemporary Accent Armchair
          var chairItem = findCatalogItem('decor_ai_2049_100r1');
          if (chairItem) {
            var chairPos = { x: sofaPos.x + tx * 1500 - nx * 200, y: sofaPos.y + ty * 1500 - ny * 200, z: 0 };
            plan.furniture.push(Core.createFurniturePlacement({
              id: 'ai_chair_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
              name: chairItem.name,
              category: 'decor',
              decorType: 'chair',
              isDecor: true,
              excludeFromPricing: true,
              aiGenerated: true,
              roomId: rm.id,
              modelUrl: chairItem.modelUrl,
              dimensions: chairItem.dimensions,
              pos: chairPos,
              elevation: 0,
              rotY: wallAngle + Math.PI * 0.75
            }));
          }
          totalAdded += 4;

        } else if (category === 'kitchen') {
          var kitchenBaseUnits = (plan.furniture || []).filter(function (f) {
            if (f.isDecor || f.excludeFromPricing) return false;
            var fRoomId = f.roomId;
            var isInRoom = (fRoomId === rm.id) || (f.pos && Vec2.pointInPolygon(f.pos, poly));
            var isBase = /(^|\b|_|-)(fm|fcm|fbcm)($|\b|_|-|\d+)/i.test(f.name || f.id || f.catalogItemId || '') ||
              (f.category === 'kitchen_base' || f.category === 'kitchen_fm' || f.costCategory === 'Base');
            return isInRoom && isBase;
          });

          var cutleryItem = findCatalogItem('decor_cutlery') || {
            id: 'decor_cutlery', name: 'Countertop Cutlery Organizer',
            dimensions: { W: 170, H: 290, D: 160 }, modelUrl: 'assets/decors/cutlery.glb'
          };
          var vegItem = findCatalogItem('decor_vegetables') || {
            id: 'decor_vegetables', name: 'Fresh Harvest Kitchen Vegetable Bowl',
            dimensions: { W: 320, H: 180, D: 320 }, modelUrl: 'assets/decors/vegetables.glb'
          };
          var spiceItem = findCatalogItem('decor_glass_apothecary_jar') || {
            id: 'decor_glass_apothecary_jar', name: 'Glass Apothecary Canisters (Spice Jars)',
            dimensions: { W: 280, H: 240, D: 140 }, modelUrl: 'assets/decors/glass_apothecary_jar.glb'
          };
          var dishrackItem = findCatalogItem('decor_cuttlery_dishrack') || {
            id: 'decor_cuttlery_dishrack', name: 'Cutlery & Dish Drying Rack',
            dimensions: { W: 420, H: 300, D: 320 }, modelUrl: 'assets/decors/cuttlery_dishrack.glb'
          };

          if (kitchenBaseUnits.length > 0) {
            var u0 = kitchenBaseUnits[0];
            var u1 = kitchenBaseUnits[1] || kitchenBaseUnits[0];
            var u2 = kitchenBaseUnits[2] || kitchenBaseUnits[kitchenBaseUnits.length - 1];

            plan.furniture.push(Core.createFurniturePlacement({
              id: 'ai_cutlery_' + Date.now(),
              name: cutleryItem.name,
              category: 'decor', decorType: 'kitchen_decor',
              isDecor: true, excludeFromPricing: true, aiGenerated: true,
              roomId: rm.id, modelUrl: cutleryItem.modelUrl, dimensions: cutleryItem.dimensions,
              pos: { x: u0.pos.x - 120, y: u0.pos.y, z: 850 }, elevation: 850, rotY: u0.rotY || 0
            }));

            plan.furniture.push(Core.createFurniturePlacement({
              id: 'ai_veg_' + Date.now(),
              name: vegItem.name,
              category: 'decor', decorType: 'kitchen_decor',
              isDecor: true, excludeFromPricing: true, aiGenerated: true,
              roomId: rm.id, modelUrl: vegItem.modelUrl, dimensions: vegItem.dimensions,
              pos: { x: u1.pos.x + 80, y: u1.pos.y, z: 850 }, elevation: 850, rotY: u1.rotY || 0
            }));

            plan.furniture.push(Core.createFurniturePlacement({
              id: 'ai_spice_' + Date.now(),
              name: spiceItem.name,
              category: 'decor', decorType: 'kitchen_decor',
              isDecor: true, excludeFromPricing: true, aiGenerated: true,
              roomId: rm.id, modelUrl: spiceItem.modelUrl, dimensions: spiceItem.dimensions,
              pos: { x: u2.pos.x - 60, y: u2.pos.y, z: 850 }, elevation: 850, rotY: u2.rotY || 0
            }));

            plan.furniture.push(Core.createFurniturePlacement({
              id: 'ai_dishrack_' + Date.now(),
              name: dishrackItem.name,
              category: 'decor', decorType: 'kitchen_decor',
              isDecor: true, excludeFromPricing: true, aiGenerated: true,
              roomId: rm.id, modelUrl: dishrackItem.modelUrl, dimensions: dishrackItem.dimensions,
              pos: { x: u0.pos.x + 140, y: u0.pos.y, z: 850 }, elevation: 850, rotY: u0.rotY || 0
            }));
            totalAdded += 4;
          } else {
            var cPos = { x: wallMid.x + nx * 400, y: wallMid.y + ny * 400, z: 850 };
            plan.furniture.push(Core.createFurniturePlacement({
              id: 'ai_cutlery_' + Date.now(),
              name: cutleryItem.name,
              category: 'decor', decorType: 'kitchen_decor',
              isDecor: true, excludeFromPricing: true, aiGenerated: true,
              roomId: rm.id, modelUrl: cutleryItem.modelUrl, dimensions: cutleryItem.dimensions,
              pos: { x: cPos.x - 300, y: cPos.y, z: 850 }, elevation: 850, rotY: wallAngle
            }));
            plan.furniture.push(Core.createFurniturePlacement({
              id: 'ai_veg_' + Date.now(),
              name: vegItem.name,
              category: 'decor', decorType: 'kitchen_decor',
              isDecor: true, excludeFromPricing: true, aiGenerated: true,
              roomId: rm.id, modelUrl: vegItem.modelUrl, dimensions: vegItem.dimensions,
              pos: { x: cPos.x, y: cPos.y, z: 850 }, elevation: 850, rotY: wallAngle
            }));
            plan.furniture.push(Core.createFurniturePlacement({
              id: 'ai_spice_' + Date.now(),
              name: spiceItem.name,
              category: 'decor', decorType: 'kitchen_decor',
              isDecor: true, excludeFromPricing: true, aiGenerated: true,
              roomId: rm.id, modelUrl: spiceItem.modelUrl, dimensions: spiceItem.dimensions,
              pos: { x: cPos.x + 320, y: cPos.y, z: 850 }, elevation: 850, rotY: wallAngle
            }));
            totalAdded += 3;
          }

        } else if (category === 'bedroom') {
          var bedItem = findCatalogItem('decor_023') || findCatalogItem('decor_cama_3') || {
            id: 'decor_023', name: 'Master Suite Bed & Nightstands 023',
            dimensions: { W: 2400, H: 1050, D: 2150 }, modelUrl: 'assets/decors/023.glb'
          };
          var bedDist = bedItem.dimensions.D / 2 + 100;
          var bedPos = { x: wallMid.x + nx * bedDist, y: wallMid.y + ny * bedDist, z: 0 };
          plan.furniture.push(Core.createFurniturePlacement({
            id: 'ai_bed_' + Date.now(),
            name: bedItem.name,
            category: 'decor',
            decorType: 'bed',
            isDecor: true,
            excludeFromPricing: true,
            aiGenerated: true,
            roomId: rm.id,
            modelUrl: bedItem.modelUrl,
            dimensions: bedItem.dimensions,
            pos: bedPos,
            elevation: 0,
            rotY: wallAngle + Math.PI
          }));

          var lampItem = findCatalogItem('decor_floor_lamp') || {
            id: 'decor_floor_lamp', name: 'Nordic Curved Arc Floor Lamp',
            dimensions: { W: 550, H: 1850, D: 550 }, modelUrl: 'assets/decors/floor_lamp.glb'
          };
          var lampPos = { x: wallMid.x - tx * 1500 + nx * 400, y: wallMid.y - ty * 1500 + ny * 400, z: 0 };
          plan.furniture.push(Core.createFurniturePlacement({
            id: 'ai_lamp_' + Date.now(),
            name: lampItem.name,
            category: 'decor',
            decorType: 'floor_lamp',
            isDecor: true,
            excludeFromPricing: true,
            aiGenerated: true,
            roomId: rm.id,
            modelUrl: lampItem.modelUrl,
            dimensions: lampItem.dimensions,
            pos: lampPos,
            elevation: 0,
            rotY: 0
          }));

          var planterItem = findCatalogItem('decor_component_3');
          if (planterItem) {
            var planterPos = { x: wallMid.x + tx * 1450 + nx * 350, y: wallMid.y + ty * 1450 + ny * 350, z: 500 };
            plan.furniture.push(Core.createFurniturePlacement({
              id: 'ai_planter_' + Date.now(),
              name: planterItem.name,
              category: 'decor',
              decorType: 'plant',
              isDecor: true,
              excludeFromPricing: true,
              aiGenerated: true,
              roomId: rm.id,
              modelUrl: planterItem.modelUrl,
              dimensions: planterItem.dimensions,
              pos: planterPos,
              elevation: 500,
              rotY: 0
            }));
          }
          totalAdded += 3;
        }
      });

      if (this.editor && this.editor.project && this.editor.project.plan) {
        this.editor.project.plan.furniture = plan.furniture;
      }
      this.syncProjectUnitsTo3DStudio();
      this.saveToLocalStorage();
      if (this.editor) {
        this.editor.resize();
        this.editor.pushHistory('AI Decor - ' + (targetRoom ? targetRoom.name : 'All Rooms'));
        this.editor.render();
      }
      this.renderBOQ();
      if (this.render3DHome) this.render3DHome(true);

      var roomMsg = targetRoom ? ('in ' + targetRoom.name) : 'across entire home';
      if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
        window.showToast('✨ AI Decor placed ' + totalAdded + ' items ' + roomMsg + '!');
      }
    },

    clearAIDecors: function (roomId) {
      var plan = (this.project && this.project.plan) || {};
      var countBefore = (plan.furniture || []).length;
      plan.furniture = (plan.furniture || []).filter(function (f) {
        if (!f.aiGenerated) return true;
        if (roomId && f.roomId !== roomId) return true;
        return false;
      });
      var removed = countBefore - plan.furniture.length;
      if (this.editor && this.editor.project && this.editor.project.plan) {
        this.editor.project.plan.furniture = plan.furniture;
      }
      this.syncProjectUnitsTo3DStudio();
      this.saveToLocalStorage();
      if (this.editor) {
        this.editor.pushHistory('Clear AI Decors');
        this.editor.render();
      }
      this.renderBOQ();
      if (this.render3DHome) this.render3DHome(true);
      if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
        window.showToast('🗑️ Cleared ' + removed + ' AI-placed decor items.');
      }
    },

    openDecorModal: function () {
      var modal = document.getElementById('modalImportDecor');
      if (modal) {
        modal.classList.add('is-open');
        modal.style.display = 'flex';
        if (typeof this._refreshDecorGrid === 'function') {
          this._refreshDecorGrid();
        }
      }
    },

    closeDecorModal: function () {
      var modal = document.getElementById('modalImportDecor');
      if (modal) {
        modal.classList.remove('is-open');
        modal.style.display = 'none';
      }
    },

    placeDecorItem: function (preset) {
      var plan = this.getPlan();
      if (!plan) return;
      plan.furniture = plan.furniture || [];

      preset = preset || {
        name: 'Refrigerator Double Door',
        category: 'decor',
        decorType: 'fridge',
        dimensions: { W: 900, H: 1800, D: 700 },
        elevation: 0
      };

      var fId = 'decor_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
      var cX = 2200, cY = 2200;

      // Center in room or canvas
      var planRooms = plan.rooms || (this.editor && this.editor.project && this.editor.project.plan && this.editor.project.plan.rooms) || [];
      if (planRooms.length > 0) {
        var firstRoom = planRooms[0];
        if (firstRoom.polygon && firstRoom.polygon.length > 0) {
          var pts = firstRoom.polygon;
          var sx = 0, sy = 0;
          for (var p = 0; p < pts.length; p++) { sx += pts[p].x; sy += pts[p].y; }
          cX = Math.round((sx / pts.length) / 50) * 50;
          cY = Math.round((sy / pts.length) / 50) * 50;
        }
      }

      var Core = window.OrbixCore || root.OrbixCore;
      var initElev = (preset.elevation !== undefined && preset.elevation !== null) ? parseFloat(preset.elevation) :
                     ((preset.elev !== undefined && preset.elev !== null) ? parseFloat(preset.elev) : 0);

      // If a modular unit is selected or hovered, position decor directly on top of that unit
      var selItem = this.editor && this.editor.selected && this.editor.selected.find(function (s) { return s.type === 'furniture'; });
      var selUnit = selItem ? (plan.furniture || []).find(function (u) { return u.id === selItem.id; }) : null;
      if (selUnit && !selUnit.isDecor && selUnit.category !== 'decor') {
        if (selUnit.pos) {
          cX = selUnit.pos.x;
          cY = selUnit.pos.y;
        }
        var topZ = (selUnit.elevation !== undefined && selUnit.elevation !== null ? parseFloat(selUnit.elevation) : 0) +
                   (selUnit.dimensions && selUnit.dimensions.H ? parseFloat(selUnit.dimensions.H) : 850);
        if (topZ > 0) {
          initElev = topZ;
        }
      } else {
        // Auto-detect if center falls inside any underlying unit
        var allUnits = plan.furniture || [];
        var maxTopZ = 0;
        for (var ui = 0; ui < allUnits.length; ui++) {
          var un = allUnits[ui];
          if (un.isDecor || un.category === 'decor' || un.category === 'appliance_decor') continue;
          if (Core && Core.Vec2 && Core.getFurniturePolygon && Core.Vec2.pointInPolygon({ x: cX, y: cY }, Core.getFurniturePolygon(un))) {
            var tz = (un.elevation !== undefined && un.elevation !== null ? parseFloat(un.elevation) : 0) +
                     (un.dimensions && un.dimensions.H ? parseFloat(un.dimensions.H) : 850);
            if (tz > maxTopZ) maxTopZ = tz;
          }
        }
        if (maxTopZ > 0) initElev = maxTopZ;
      }

      var dims = Object.assign({ W: 900, H: 1800, D: 700 }, preset.dimensions || {});
      if (preset.w !== undefined) dims.W = parseFloat(preset.w);
      if (preset.h !== undefined) dims.H = parseFloat(preset.h);
      if (preset.d !== undefined) dims.D = parseFloat(preset.d);

      var newDecor = Core.createFurniturePlacement({
        id: fId,
        slug: preset.slug || null,
        name: preset.name || 'Decor Item',
        category: 'decor',
        isDecor: true,
        excludeFromPricing: true,
        decorType: preset.decorType || 'general',
        modelUrl: preset.modelUrl || null,
        thumbnailUrl: preset.thumbnailUrl || null,
        modelFormat: preset.modelFormat || (preset.modelUrl && /\.glb$/i.test(preset.modelUrl) ? 'glb' : null),
        elevation: initElev,
        pos: { x: cX, y: cY, z: initElev },
        rotY: 0,
        dimensions: dims,
        unitConfig: { shutters: 0, drawers: 0, dstyle: 'none', handle: 'none' }
      });

      plan.furniture.push(newDecor);
      // Ensure all plan references (editor.project, this.project) stay synchronized
      if (this.editor && this.editor.project && this.editor.project.plan) {
        this.editor.project.plan.furniture = this.editor.project.plan.furniture || [];
        if (!this.editor.project.plan.furniture.find(function (it) { return it.id === fId; })) {
          this.editor.project.plan.furniture.push(newDecor);
        }
      }
      if (this.project && this.project.plan && this.project.plan.furniture) {
        if (!this.project.plan.furniture.find(function (it) { return it.id === fId; })) {
          this.project.plan.furniture.push(newDecor);
        }
      }

      this.queueAutoSave();

      if (this.editor) {
        if (typeof this.editor.setTool === 'function') {
          this.editor.setTool('select');
        } else {
          this.editor.activeTool = 'select';
        }
        this.editor.furniturePreset = null;
        this.editor.selected = [{ type: 'furniture', id: fId }];
        if (typeof this.editor.onSelectionChange === 'function') {
          this.editor.onSelectionChange(this.editor.selected);
        }
        this.editor.render();
      }
      document.querySelectorAll('.plan-tool-btn').forEach(function (b) {
        b.classList.toggle('is-active', b.dataset.tool === 'select');
      });

      var isDesignActive = (typeof document !== 'undefined') && document.getElementById('view-design') && document.getElementById('view-design').classList.contains('is-on');
      if (isDesignActive) {
        if (this.archRenderer && this.archRenderer.group && typeof this.archRenderer.addOrUpdateFurnitureMesh === 'function') {
          this.archRenderer.addOrUpdateFurnitureMesh(newDecor);
        } else if (this.render3DHome) {
          this.render3DHome(true, undefined, fId);
        }
        this.highlight3DFurniture(fId);
      } else {
        this._3dDirty = true;
      }

      if (typeof window.showToast === 'function') {
        window.showToast('🌿 Placed ' + newDecor.name + ' (Excluded from Woodwork Pricing)');
      }
    },

    // ─────────────────────────────────────────────────────────────────────────────
    // Multi-Floor Project Architecture (2D Plan & 3D Stacked Building)
    // ─────────────────────────────────────────────────────────────────────────────
    syncActiveFloorData: function () {
      var proj = this.project || (this.editor && this.editor.project);
      if (!proj || !proj.plan) return;
      var plan = proj.plan;
      plan.floors = plan.floors || [
        { id: 'ground', name: 'Ground Floor', level: 0, elevation: 0, isDefault: true }
      ];
      plan.activeFloor = plan.activeFloor || 'ground';
      plan.floorsData = plan.floorsData || {};

      plan.floorsData[plan.activeFloor] = {
        walls: JSON.parse(JSON.stringify(plan.walls || [])),
        openings: JSON.parse(JSON.stringify(plan.openings || [])),
        rooms: JSON.parse(JSON.stringify(plan.rooms || [])),
        furniture: JSON.parse(JSON.stringify(plan.furniture || [])),
        stairs: JSON.parse(JSON.stringify(plan.stairs || [])),
        dimensions: JSON.parse(JSON.stringify(plan.dimensions || [])),
        underlay: plan.underlay ? JSON.parse(JSON.stringify(plan.underlay)) : null
      };
    },

    switchFloor: function (floorId) {
      if (!floorId) return;
      var proj = this.project || (this.editor && this.editor.project);
      if (!proj || !proj.plan) return;
      var plan = proj.plan;
      plan.floors = plan.floors || [
        { id: 'ground', name: 'Ground Floor', level: 0, elevation: 0, isDefault: true }
      ];
      plan.floorsData = plan.floorsData || {};

      if (plan.activeFloor === floorId && plan.floorsData[floorId]) {
        this.updateFloorSwitcherUI();
        return;
      }

      // 1. Sync current active floor first
      this.syncActiveFloorData();

      // 2. Switch to target floor
      plan.activeFloor = floorId;

      // 3. Load target floor data (or initialize if empty)
      var targetData = plan.floorsData[floorId] || {
        walls: [],
        openings: [],
        rooms: [],
        furniture: [],
        stairs: [],
        dimensions: [],
        underlay: null
      };

      plan.walls = JSON.parse(JSON.stringify(targetData.walls || []));
      plan.openings = JSON.parse(JSON.stringify(targetData.openings || []));
      plan.rooms = JSON.parse(JSON.stringify(targetData.rooms || []));
      plan.furniture = JSON.parse(JSON.stringify(targetData.furniture || []));
      plan.stairs = JSON.parse(JSON.stringify(targetData.stairs || []));
      plan.dimensions = JSON.parse(JSON.stringify(targetData.dimensions || []));
      plan.underlay = targetData.underlay ? JSON.parse(JSON.stringify(targetData.underlay)) : null;

      // Update 2D editor state
      if (this.editor) {
        this.editor.project = proj;
        this.editor.underlay = plan.underlay;
        this.editor.selected = [];
        this.editor.wallChainStart = null;
        this.editor.dadoDrawStart = null;
        this.editor.dimensionStart = null;
        var Core = window.OrbixCore || root.OrbixCore;
        if (Core && typeof Core.detectRooms === 'function') {
          Core.detectRooms(proj);
        }
        this.editor.render();
      }

      // Update 3D studio
      this.syncProjectUnitsTo3DStudio();
      if (typeof this.render3DHome === 'function') {
        this.render3DHome(true);
      }
      this.renderBOQ();
      this.updateFloorSwitcherUI();

      var floorObj = plan.floors.find(function (f) { return f.id === floorId; });
      var fName = floorObj ? floorObj.name : floorId;
      if (typeof window.showToast === 'function') {
        window.showToast('🏢 Switched to ' + fName);
      }
      this.queueAutoSave();
    },

    addFloor: function (name, copyPerimeterWalls) {
      var proj = this.project || (this.editor && this.editor.project);
      if (!proj || !proj.plan) return;
      var plan = proj.plan;
      plan.floors = plan.floors || [
        { id: 'ground', name: 'Ground Floor', level: 0, elevation: 0, isDefault: true }
      ];
      plan.floorsData = plan.floorsData || {};

      this.syncActiveFloorData();

      var nextLevel = plan.floors.length;
      var floorName = name || (nextLevel === 1 ? 'First Floor' : (nextLevel === 2 ? 'Second Floor' : ('Floor ' + nextLevel)));
      var floorId = 'floor_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
      var floorElevation = nextLevel * 2800; // mm

      var newWalls = [];
      var Core = window.OrbixCore || root.OrbixCore;
      if (copyPerimeterWalls) {
        var groundWalls = (plan.floorsData['ground'] && plan.floorsData['ground'].walls) || plan.walls || [];
        groundWalls.forEach(function (w) {
          if (w.isDivider) return;
          var newId = (Core && Core.uid ? Core.uid('wall') : ('w_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4)));
          var wCopy = JSON.parse(JSON.stringify(w));
          wCopy.id = newId;
          newWalls.push(wCopy);
        });
      }

      var newFloor = {
        id: floorId,
        name: floorName,
        level: nextLevel,
        elevation: floorElevation
      };
      plan.floors.push(newFloor);

      plan.floorsData[floorId] = {
        walls: newWalls,
        openings: [],
        rooms: [],
        furniture: [],
        stairs: [],
        dimensions: [],
        underlay: null
      };

      this.switchFloor(floorId);

      if (typeof window.showToast === 'function') {
        window.showToast('🏢 Created ' + floorName + ' (Level ' + nextLevel + ')');
      }
      this.queueAutoSave();
    },

    openAddFloorModal: function () {
      var modal = document.getElementById('modalAddFloor');
      if (!modal) return;
      var plan = this.getPlan();
      var count = (plan && plan.floors && plan.floors.length) || 1;
      var nameInp = document.getElementById('addFloorNameInput');
      if (nameInp) {
        nameInp.value = count === 1 ? 'First Floor' : (count === 2 ? 'Second Floor' : ('Floor ' + count));
      }
      modal.style.display = 'flex';
    },

    closeAddFloorModal: function () {
      var modal = document.getElementById('modalAddFloor');
      if (!modal) return;
      modal.style.display = 'none';
      this.updateFloorSwitcherUI();
    },

    initFloorSwitcher: function () {
      var self = this;
      var sel2D = document.getElementById('planActiveFloor');
      if (sel2D) {
        sel2D.addEventListener('change', function () {
          var val = sel2D.value;
          if (val === 'add_floor') {
            self.openAddFloorModal();
          } else {
            self.switchFloor(val);
          }
        });
      }

      var sel3D = document.getElementById('studioFloorSelect');
      if (sel3D) {
        sel3D.addEventListener('change', function () {
          var val = sel3D.value;
          self.studioFloorMode = val;
          if (self.archRenderer) {
            self.archRenderer.viewFloorMode = val;
          }
          window.studioFloorMode = val;
          if (typeof self.render3DHome === 'function') {
            self.render3DHome(true);
          }
        });
      }

      var closeBtn = document.getElementById('closeAddFloorModalBtn');
      var cancelBtn = document.getElementById('cancelAddFloorBtn');
      var confirmBtn = document.getElementById('confirmAddFloorBtn');

      if (closeBtn) closeBtn.addEventListener('click', function () { self.closeAddFloorModal(); });
      if (cancelBtn) cancelBtn.addEventListener('click', function () { self.closeAddFloorModal(); });
      if (confirmBtn) {
        confirmBtn.addEventListener('click', function () {
          var nameInp = document.getElementById('addFloorNameInput');
          var copyCheck = document.getElementById('addFloorCopyWallsCheck');
          var fName = nameInp ? nameInp.value.trim() : '';
          var copyWalls = copyCheck ? copyCheck.checked : true;
          self.addFloor(fName, copyWalls);
          self.closeAddFloorModal();
        });
      }
    },

    updateFloorSwitcherUI: function () {
      var proj = this.project || (this.editor && this.editor.project);
      if (!proj || !proj.plan) return;
      var plan = proj.plan;
      var floors = plan.floors || [
        { id: 'ground', name: 'Ground Floor', level: 0, elevation: 0, isDefault: true }
      ];
      var activeId = plan.activeFloor || 'ground';

      // 1. 2D Plan Floor Selector
      var sel2D = document.getElementById('planActiveFloor');
      if (sel2D) {
        sel2D.innerHTML = '';
        floors.forEach(function (fl) {
          var opt = document.createElement('option');
          opt.value = fl.id;
          opt.textContent = '🏢 ' + fl.name + (fl.isDefault ? ' (Default)' : (' · Level ' + fl.level));
          if (fl.id === activeId) opt.selected = true;
          sel2D.appendChild(opt);
        });
        var addOpt = document.createElement('option');
        addOpt.value = 'add_floor';
        addOpt.textContent = '➕ Add New Floor...';
        sel2D.appendChild(addOpt);
      }

      // 2. 3D Studio Floor Selector
      var sel3D = document.getElementById('studioFloorSelect');
      if (sel3D) {
        sel3D.innerHTML = '';
        var allOpt = document.createElement('option');
        allOpt.value = 'all';
        allOpt.textContent = '🏛️ All Floors (Stacked Building)';
        if (!this.studioFloorMode || this.studioFloorMode === 'all') allOpt.selected = true;
        sel3D.appendChild(allOpt);

        floors.forEach(function (fl) {
          var opt = document.createElement('option');
          opt.value = fl.id;
          opt.textContent = '🏢 ' + fl.name + (fl.id === activeId ? ' (Active)' : '');
          if (this.studioFloorMode === fl.id) opt.selected = true;
          sel3D.appendChild(opt);
        }.bind(this));
      }
    },

    initDecorModal: function () {
      var self = this;
      var modal = document.getElementById('modalImportDecor');
      var openBtn = document.getElementById('openDecorModalBtn');
      var open3DBtn = document.getElementById('placeDecor3DBtn');
      if (!modal) return;

      if (openBtn) {
        openBtn.addEventListener('click', function () {
          self.openDecorModal();
        });
      }
      if (open3DBtn) {
        open3DBtn.addEventListener('click', function () {
          self.openDecorModal();
        });
      }

      modal.querySelectorAll('.modal-close-btn, .modal-backdrop, #closeDecorModalBtn').forEach(function (b) {
        b.addEventListener('click', function () {
          self.closeDecorModal();
        });
      });

      // Tab switching: Built-in Catalog vs Custom 3D Model
      var tabBtns = modal.querySelectorAll('.decor-tab-btn');
      tabBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          tabBtns.forEach(function (t) { t.classList.remove('is-active'); });
          btn.classList.add('is-active');
          var targetTab = btn.getAttribute('data-tab');
          var tabPresets = document.getElementById('decorTabPresets');
          var tabCustom = document.getElementById('decorTabCustom');
          if (targetTab === 'presets') {
            if (tabPresets) tabPresets.style.display = 'block';
            if (tabCustom) tabCustom.style.display = 'none';
          } else {
            if (tabPresets) tabPresets.style.display = 'none';
            if (tabCustom) tabCustom.style.display = 'block';
          }
        });
      });

      // Dynamic 46 SketchUp Decor Catalog Rendering with Search & Category Filtering
      var activeFilter = 'all';
      var searchQuery = '';

      function renderGrid() {
        var grid = document.getElementById('decorPresetGrid');
        if (!grid) return;
        var catalog = window.ORBIX_DECORS_CATALOG || [];
        var filtered = catalog.filter(function (it) {
          var matchCat = (activeFilter === 'all' || it.subCategory === activeFilter);
          var matchQuery = true;
          if (searchQuery) {
            var q = searchQuery.toLowerCase();
            var text = ((it.name || '') + ' ' + (it.subCategory || '') + ' ' + (it.original_filename || '')).toLowerCase();
            matchQuery = text.indexOf(q) !== -1;
          }
          return matchCat && matchQuery;
        });

        if (filtered.length === 0) {
          grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#94a3b8;font-size:13px;">No 3D models match your search.</div>';
          return;
        }

        grid.innerHTML = filtered.map(function (it) {
          var dims = it.dimensions || { W: 900, H: 800, D: 600 };
          var thumbHtml = it.thumbnailUrl
            ? '<img src="' + it.thumbnailUrl + '" alt="' + it.name + '" style="width:100%;height:120px;object-fit:cover;display:block;">'
            : '<div style="font-size:42px;">' + (it.icon || '✨') + '</div>';
          return '<div class="decor-preset-card" data-slug="' + it.slug + '" style="cursor:pointer;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;transition:all 0.18s ease;display:flex;flex-direction:column;box-shadow:0 1px 3px rgba(0,0,0,0.05);">'
            + '<div style="height:120px;background:#f8fafc;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;border-bottom:1px solid #f1f5f9;">'
            + thumbHtml
            + '<span style="position:absolute;top:6px;right:6px;font-size:10px;background:rgba(255,255,255,0.92);padding:2px 7px;border-radius:4px;font-weight:700;color:#334155;border:1px solid rgba(226,232,240,0.8);">' + it.subCategory + '</span>'
            + '</div>'
            + '<div style="padding:10px 12px;flex:1;display:flex;flex-direction:column;">'
            + '<div style="font-weight:700;font-size:12.5px;color:#0f172a;margin-bottom:4px;line-height:1.25;">' + it.name + '</div>'
            + '<div style="font-size:11px;font-family:monospace;color:#64748b;margin-bottom:6px;">' + Math.round(dims.W) + ' × ' + Math.round(dims.H) + ' × ' + Math.round(dims.D) + ' mm</div>'
            + '<div style="margin-top:auto;display:flex;justify-content:space-between;align-items:center;padding-top:6px;border-top:1px dashed #f1f5f9;">'
            + '<span style="font-size:10.5px;color:#15803d;font-weight:600;">' + (it.elevation > 0 ? ('▲ ' + it.elevation + ' mm') : 'Floor 0 mm') + '</span>'
            + '<span class="decor-card-badge" style="font-size:11px;font-weight:700;background:#dcfce7;color:#15803d;padding:3px 9px;border-radius:4px;border:1px solid #86efac;">Place ➔</span>'
            + '</div>'
            + '</div>'
            + '</div>';
        }).join('');

        // Attach click handlers to place
        grid.querySelectorAll('.decor-preset-card').forEach(function (card) {
          card.addEventListener('click', function () {
            var slug = card.getAttribute('data-slug');
            var item = (window.ORBIX_DECORS_CATALOG || []).find(function (d) { return d.slug === slug; });
            if (!item) return;

            self.placeDecorItem({
              id: item.id,
              slug: item.slug,
              name: item.name,
              category: 'decor',
              decorType: item.decorType,
              dimensions: item.dimensions,
              elevation: item.elevation,
              modelUrl: item.modelUrl,
              thumbnailUrl: item.thumbnailUrl
            });
            self.closeDecorModal();
          });
        });
      }

      self._refreshDecorGrid = renderGrid;

      var searchInp = document.getElementById('decorSearchInput');
      if (searchInp) {
        searchInp.addEventListener('input', function () {
          searchQuery = searchInp.value.trim();
          renderGrid();
        });
      }

      var catFilter = document.getElementById('decorCategoryFilter');
      if (catFilter) {
        catFilter.querySelectorAll('.decor-cat-pill').forEach(function (pill) {
          pill.addEventListener('click', function () {
            catFilter.querySelectorAll('.decor-cat-pill').forEach(function (p) {
              p.classList.remove('is-active');
              p.style.background = '#f1f5f9';
              p.style.color = '#334155';
              p.style.border = '1px solid #cbd5e1';
            });
            pill.classList.add('is-active');
            pill.style.background = '#15803d';
            pill.style.color = '#ffffff';
            pill.style.border = 'none';
            activeFilter = pill.getAttribute('data-cat') || 'all';
            renderGrid();
          });
        });
      }

      // Initial populate
      renderGrid();

      // Elevation presets in custom tab
      modal.querySelectorAll('.decor-elev-preset-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var val = btn.getAttribute('data-elev');
          var inp = document.getElementById('customDecorElev');
          if (inp) inp.value = val;
          modal.querySelectorAll('.decor-elev-preset-btn').forEach(function (b) { b.classList.remove('is-active'); });
          btn.classList.add('is-active');
        });
      });

      // Custom file input & drop zone
      var fileInput = document.getElementById('customDecorFileInput');
      var dropZone = document.getElementById('customDecorDropZone');
      var nameInput = document.getElementById('customDecorName');
      var wInput = document.getElementById('customDecorW');
      var hInput = document.getElementById('customDecorH');
      var dInput = document.getElementById('customDecorD');
      var elevInput = document.getElementById('customDecorElev');
      var typeSelect = document.getElementById('customDecorType');

      function handleFiles(files) {
        if (!files || !files.length) return;
        var file = files[0];
        var fileName = file.name;
        var ext = fileName.split('.').pop().toLowerCase();

        if (nameInput) {
          nameInput.value = fileName.replace(/\.[^/.]+$/, "");
        }

        var lower = fileName.toLowerCase();
        if (typeSelect) {
          if (lower.indexOf('sink') !== -1) {
            typeSelect.value = 'sink';
            if (wInput) wInput.value = 800; if (hInput) hInput.value = 400; if (dInput) dInput.value = 500;
            if (elevInput) elevInput.value = 850;
          } else if (lower.indexOf('hob') !== -1 || lower.indexOf('stove') !== -1 || lower.indexOf('burner') !== -1 || lower.indexOf('component_2') !== -1) {
            typeSelect.value = 'gas_hob';
            if (wInput) wInput.value = 750; if (hInput) hInput.value = 120; if (dInput) dInput.value = 500;
            if (elevInput) elevInput.value = 850;
          } else if (lower.indexOf('dish') !== -1) {
            typeSelect.value = 'dishwasher';
            if (wInput) wInput.value = 600; if (hInput) hInput.value = 820; if (dInput) dInput.value = 600;
            if (elevInput) elevInput.value = 0;
          } else if (lower.indexOf('washing') !== -1 || lower.indexOf('aeg') !== -1 || lower.indexOf('laundry') !== -1) {
            typeSelect.value = 'washing_machine';
            if (wInput) wInput.value = 600; if (hInput) hInput.value = 850; if (dInput) dInput.value = 600;
            if (elevInput) elevInput.value = 0;
          } else if (lower.indexOf('kent') !== -1 || lower.indexOf('ro') !== -1 || lower.indexOf('purifier') !== -1) {
            typeSelect.value = 'ro_purifier';
            if (wInput) wInput.value = 400; if (hInput) hInput.value = 520; if (dInput) dInput.value = 260;
            if (elevInput) elevInput.value = 1200;
          } else if (lower.indexOf('dining') !== -1 || lower.indexOf('1ewt') !== -1 || (lower.indexOf('table') !== -1 && lower.indexOf('top') === -1)) {
            typeSelect.value = 'dining_table';
            if (wInput) wInput.value = 1200; if (hInput) hInput.value = 760; if (dInput) dInput.value = 800;
            if (elevInput) elevInput.value = 0;
          } else if (lower.indexOf('fridge') !== -1 || lower.indexOf('refrigerator') !== -1) {
            typeSelect.value = 'fridge';
            if (wInput) wInput.value = 900; if (hInput) hInput.value = 1800; if (dInput) dInput.value = 700;
          } else if (lower.indexOf('ice') !== -1 || lower.indexOf('chiller') !== -1 || lower.indexOf('side') !== -1) {
            typeSelect.value = 'ice_box';
            if (wInput) wInput.value = 500; if (hInput) hInput.value = 850; if (dInput) dInput.value = 550;
          } else if (lower.indexOf('plant') !== -1 || lower.indexOf('pot') !== -1 || lower.indexOf('tree') !== -1) {
            typeSelect.value = 'plant';
            if (wInput) wInput.value = 500; if (hInput) hInput.value = 1200; if (dInput) dInput.value = 500;
          } else if (lower.indexOf('microwave') !== -1 || lower.indexOf('oven') !== -1) {
            typeSelect.value = 'microwave';
            if (wInput) wInput.value = 600; if (hInput) hInput.value = 450; if (dInput) dInput.value = 500;
            if (elevInput) elevInput.value = 850;
          } else if (lower.indexOf('chimney') !== -1 || lower.indexOf('hood') !== -1) {
            typeSelect.value = 'chimney';
            if (wInput) wInput.value = 600; if (hInput) hInput.value = 750; if (dInput) dInput.value = 500;
            if (elevInput) elevInput.value = 1500;
          } else if (lower.indexOf('tv') !== -1) {
            typeSelect.value = 'tv';
            if (wInput) wInput.value = 1200; if (hInput) hInput.value = 720; if (dInput) dInput.value = 80;
            if (elevInput) elevInput.value = 1100;
          } else if (lower.indexOf('sofa') !== -1 || lower.indexOf('couch') !== -1) {
            typeSelect.value = 'sofa';
            if (wInput) wInput.value = 1800; if (hInput) hInput.value = 850; if (dInput) dInput.value = 850;
          } else if (lower.indexOf('bed') !== -1 || lower.indexOf('mariam') !== -1 || lower.indexOf('mattress') !== -1) {
            var isMariamSet = (lower.indexOf('mariam') !== -1 || lower.indexOf('set') !== -1);
            typeSelect.value = isMariamSet ? 'mariam_bed' : 'bed';
            if (wInput) wInput.value = isMariamSet ? 2400 : 1800;
            if (hInput) hInput.value = 1000;
            if (dInput) dInput.value = 2050;
            if (elevInput) elevInput.value = 0;
          }
        }

        var statusEl = document.getElementById('customDecorFileStatus');
        if (statusEl) {
          statusEl.innerHTML = '✅ Loaded <b>' + fileName + '</b> (' + (ext.toUpperCase()) + ') — Dimensions and elevation configured!';
          statusEl.style.display = 'block';
        }
      }

      if (fileInput) {
        fileInput.addEventListener('change', function () {
          handleFiles(fileInput.files);
        });
      }

      if (dropZone) {
        dropZone.addEventListener('dragover', function (e) {
          e.preventDefault();
          dropZone.classList.add('is-dragover');
        });
        dropZone.addEventListener('dragleave', function () {
          dropZone.classList.remove('is-dragover');
        });
        dropZone.addEventListener('drop', function (e) {
          e.preventDefault();
          dropZone.classList.remove('is-dragover');
          handleFiles(e.dataTransfer.files);
        });
        dropZone.addEventListener('click', function () {
          if (fileInput) fileInput.click();
        });
      }

      var submitCustomBtn = document.getElementById('customDecorPlaceBtn');
      if (submitCustomBtn) {
        submitCustomBtn.addEventListener('click', function () {
          var name = (nameInput && nameInput.value.trim()) || 'Custom 3D Decor';
          var w = parseFloat(wInput ? wInput.value : 900) || 900;
          var h = parseFloat(hInput ? hInput.value : 1800) || 1800;
          var d = parseFloat(dInput ? dInput.value : 700) || 700;
          var elev = parseFloat(elevInput ? elevInput.value : 0) || 0;
          var decType = (typeSelect && typeSelect.value) || 'general';

          self.placeDecorItem({
            name: name,
            decorType: decType,
            dimensions: { W: w, H: h, D: d },
            elevation: elev
          });
          self.closeDecorModal();
        });
      }
    },

    _getFallbackOpenAIKey: function () {
      return '';
    },

    openAIRenderModal: function () {
      var modal = document.getElementById('modalAIRender');
      if (!modal) return;
      modal.style.display = 'flex';
      modal.classList.add('is-open');

      var self = this;
      if (typeof fetch === 'function' && !self._serverAIKeyConfigured && window.OrbixProjects && window.OrbixProjects.currentUser) {
        fetch('/api/ai/config', { credentials: 'include' }).then(function (res) {
          if (res.ok) return res.json();
        }).then(function (data) {
          if (data && data.configured) {
            self._serverAIKeyConfigured = true;
            self.updateAIKeyStatusUI();
          }
        }).catch(function () {});
      }

      var keyInput = document.getElementById('openAIApiKeyInput');
      var k = this.getOpenAIKey();
      if (keyInput) {
        keyInput.value = k;
      }
      this.updateAIKeyStatusUI(k);
      this.updateAIRenderPrompt();
    },

    updateAIKeyStatusUI: function (keyVal) {
      var k = (keyVal !== undefined) ? keyVal : this.getOpenAIKey();
      var hasKey = !!(k && k.trim().length > 10);
      var hasServerKey = !!this._serverAIKeyConfigured;
      var badge = document.getElementById('aiKeyStatusBadge');
      if (badge) {
        if (hasKey) {
          badge.textContent = '● Key Connected (' + k.slice(0, 7) + '...)';
          badge.style.background = '#dcfce7';
          badge.style.color = '#15803d';
        } else if (hasServerKey) {
          badge.textContent = '● Server AI Ready';
          badge.style.background = '#dcfce7';
          badge.style.color = '#15803d';
        } else {
          badge.textContent = '○ Key Not Set (Required)';
          badge.style.background = '#fee2e2';
          badge.style.color = '#b91c1c';
        }
      }
      var topStatus = document.getElementById('topAIKeyStatus');
      if (topStatus) {
        if (hasKey || hasServerKey) {
          topStatus.textContent = hasKey ? 'Active' : 'Server Ready';
          topStatus.style.color = '#15803d';
        } else {
          topStatus.textContent = 'Not Set';
          topStatus.style.color = '#dc2626';
        }
      }
    },

    setOpenAIKey: function (k) {
      if (k) {
        try {
          localStorage.setItem('orbix_openai_key', k.trim());
          localStorage.setItem('orbix_openai_api_key', k.trim());
        } catch (_) {}
        this.updateAIKeyStatusUI(k.trim());
        var keyInput = document.getElementById('openAIApiKeyInput');
        if (keyInput) keyInput.value = k.trim();
        if (typeof window.toast === 'function') window.toast('✅ OpenAI API Key Saved!');
      }
    },

    getOpenAIKey: function () {
      var saved = '';
      try {
        saved = localStorage.getItem('orbix_openai_key') || localStorage.getItem('orbix_openai_api_key') || '';
      } catch (_) {}
      return (saved && saved.trim()) ? saved.trim() : '';
    },

    closeAIRenderModal: function () {
      var modal = document.getElementById('modalAIRender');
      if (!modal) return;
      modal.style.display = 'none';
      modal.classList.remove('is-open');
    },

    updateAIRenderPrompt: function () {
      var promptEl = document.getElementById('aiRenderPromptText');
      if (!promptEl) return;
      var styleEl = document.getElementById('aiRenderStyle');
      var lightEl = document.getElementById('aiRenderLighting');
      var style = styleEl ? styleEl.value : 'luxury_architectural';
      var lighting = lightEl ? lightEl.value : 'natural_daylight';

      var plan = this.project && this.project.plan;
      var furn = (plan && plan.furniture) || [];
      var unitNames = [];
      var roomTitle = 'luxury contemporary interior';
      if (this.project && this.project.meta && this.project.meta.title) {
        roomTitle = this.project.meta.title;
      }
      furn.slice(0, 8).forEach(function (f) {
        var n = (f.name || f.code || '').trim();
        if (n && unitNames.indexOf(n) === -1) unitNames.push(n);
      });

      var styleDesc = 'ultra-photorealistic architectural interior photograph, Architectural Digest luxury aesthetic, 8K resolution, octane render quality';
      if (style === 'modern_minimalist') styleDesc = 'warm minimalist interior architecture, natural wood and stone textures, clean lines, calm Zen aesthetic, 8K architectural photo';
      else if (style === 'contemporary_indian') styleDesc = 'luxury contemporary Indian home interior design, premium modular woodwork, elegant brass detailing, rich textures, 8k architectural photography';
      else if (style === 'cinematic_warm') styleDesc = 'cinematic golden hour interior lighting, warm amber sun rays, soft atmospheric depth of field, luxury editorial architectural render';
      else if (style === 'nordic_scandi') styleDesc = 'Scandinavian modern interior, natural white oak and matte white cabinetry, airy bright aesthetic, high-end architectural photo';

      var lightDesc = 'natural daylight streaming through large windows, soft diffused ambient fill, subtle LED under-cabinet strip illumination, realistic contact shadows';
      if (lighting === 'evening_ambient') lightDesc = 'cozy evening interior ambiance, 3000K warm architectural cove lighting, illuminated glass display shelves, soft shadow gradients';
      else if (lighting === 'bright_studio') lightDesc = 'bright professional interior studio lighting, high color rendering index, crisp reflections on polished stone and metallic handles';

      var prompt = 'Professional ' + styleDesc + ' of an Indian ' + roomTitle + ' space';
      if (unitNames.length > 0) {
        prompt += ', featuring ' + unitNames.join(', ');
      }
      prompt += '. Premium modular cabinetry with seamless edge-banding, polished countertops with subtle reflections, vitrified floor tiles, ' + lightDesc + ', highly detailed, realistic materials and physics.';

      promptEl.value = prompt;
    },

    initAIRenderModal: function () {
      var self = this;
      var modal = document.getElementById('modalAIRender');
      var openBtn = document.getElementById('renderAIRenderBtn');
      if (!modal) return;

      // Check server AI configuration when authenticated without fetching or persisting raw API keys
      if (typeof fetch === 'function' && window.OrbixProjects && window.OrbixProjects.currentUser) {
        fetch('/api/ai/config', { credentials: 'include' }).then(function (res) {
          if (res.ok) return res.json();
        }).then(function (data) {
          if (data && data.configured) {
            self._serverAIKeyConfigured = true;
            self.updateAIKeyStatusUI();
          }
        }).catch(function () {});
      }

      var keyInput = document.getElementById('openAIApiKeyInput');
      if (keyInput && !keyInput.value) {
        keyInput.value = self.getOpenAIKey();
      }

      self.updateAIKeyStatusUI();

      var topKeyBtn = document.getElementById('openAIKeyTopBtn');
      if (topKeyBtn) {
        topKeyBtn.addEventListener('click', function () {
          self.openAIRenderModal();
        });
      }

      if (openBtn) {
        openBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          var menu = document.getElementById('photoRenderMenu');
          if (menu) { menu.style.display = 'none'; menu.classList.remove('is-open'); }
          self.openAIRenderModal();
        });
      }

      modal.querySelectorAll('#closeAIRenderBtn, #closeAIRenderBackdrop, #cancelAIRenderBtn').forEach(function (b) {
        b.addEventListener('click', function () { self.closeAIRenderModal(); });
      });

      var saveKeyBtn = document.getElementById('saveOpenAIKeyBtn');
      var toggleVisBtn = document.getElementById('toggleAIKeyVisBtn');
      var clearKeyBtn = document.getElementById('clearOpenAIKeyBtn');

      if (toggleVisBtn && keyInput) {
        toggleVisBtn.addEventListener('click', function () {
          keyInput.type = (keyInput.type === 'password') ? 'text' : 'password';
        });
      }

      if (clearKeyBtn && keyInput) {
        clearKeyBtn.addEventListener('click', function () {
          keyInput.value = '';
          try {
            localStorage.removeItem('orbix_openai_key');
            localStorage.removeItem('orbix_openai_api_key');
          } catch (_) {}
          self.updateAIKeyStatusUI('');
          if (typeof window.toast === 'function') window.toast('OpenAI API Key cleared.');
        });
      }

      if (saveKeyBtn && keyInput) {
        saveKeyBtn.addEventListener('click', function () {
          var k = keyInput.value.trim();
          if (k) {
            try {
              localStorage.setItem('orbix_openai_key', k);
              localStorage.setItem('orbix_openai_api_key', k);
            } catch (_) {}
            self.updateAIKeyStatusUI(k);
            if (typeof window.toast === 'function') window.toast('✅ OpenAI API Key Saved Securely in Browser!');
          } else {
            try {
              localStorage.removeItem('orbix_openai_key');
              localStorage.removeItem('orbix_openai_api_key');
            } catch (_) {}
            self.updateAIKeyStatusUI('');
            if (typeof window.toast === 'function') window.toast('OpenAI API Key cleared.');
          }
        });
      }

      var styleEl = document.getElementById('aiRenderStyle');
      var lightEl = document.getElementById('aiRenderLighting');
      var refreshBtn = document.getElementById('refreshAIPromptBtn');
      if (styleEl) styleEl.addEventListener('change', function () { self.updateAIRenderPrompt(); });
      if (lightEl) lightEl.addEventListener('change', function () { self.updateAIRenderPrompt(); });
      if (refreshBtn) refreshBtn.addEventListener('click', function () { self.updateAIRenderPrompt(); });

      var startBtn = document.getElementById('startAIRenderBtn');
      var downloadBtn = document.getElementById('downloadAIRenderBtn');
      var progressCont = document.getElementById('aiRenderProgressContainer');
      var resultCont = document.getElementById('aiRenderResultContainer');
      var srcImg = document.getElementById('aiRenderSourceImg');
      var outImg = document.getElementById('aiRenderOutputImg');

      if (startBtn) {
        startBtn.addEventListener('click', async function () {
          var apiKey = (keyInput && keyInput.value.trim()) || self.getOpenAIKey();
          var promptText = (document.getElementById('aiRenderPromptText') && document.getElementById('aiRenderPromptText').value.trim()) || 'Luxury architectural interior photograph';

          var gl = window.__cc && window.__cc.gl;
          if (!gl || typeof gl.snapshot !== 'function') {
            if (typeof window.toast === 'function') window.toast('3D Studio is not active.');
            return;
          }

          // 1. Capture Current 3D View as visual base
          var cadSnip = gl.snapshot(1920, 1080, { mode: 'custom', quality: 0.95 });
          if (!cadSnip) {
            if (typeof window.toast === 'function') window.toast('Failed to capture 3D snip.');
            return;
          }

          if (srcImg) srcImg.src = cadSnip;
          if (progressCont) progressCont.style.display = 'block';
          if (resultCont) resultCont.style.display = 'none';
          if (downloadBtn) downloadBtn.style.display = 'none';
          startBtn.disabled = true;

          try {
            if (!apiKey && !self._serverAIKeyConfigured) {
              if (progressCont) progressCont.style.display = 'none';
              startBtn.disabled = false;
              alert('Please enter your OpenAI API key above (or configure OPENAI_API_KEY on the server) to generate live AI renders.');
              if (keyInput) keyInput.focus();
              return;
            }

            // Prefer authenticated server-side AI proxy so server keys never leave the backend
            var data = null;
            var srvRes = await fetch('/api/ai/render', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                apiKey: apiKey || undefined,
                prompt: promptText.slice(0, 1000)
              })
            });
            if (srvRes.ok) {
              data = await srvRes.json();
            } else if (apiKey) {
              var response = await fetch('https://api.openai.com/v1/images/generations', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': 'Bearer ' + apiKey
                },
                body: JSON.stringify({
                  model: 'dall-e-3',
                  prompt: promptText.slice(0, 1000),
                  n: 1,
                  size: '1792x1024',
                  quality: 'hd',
                  style: 'natural'
                })
              });
              data = await response.json();
            } else {
              var errPayload = await srvRes.json().catch(function () { return {}; });
              throw new Error((errPayload.error && errPayload.error.message) || errPayload.error || ('Server returned ' + srvRes.status));
            }

            if (data && data.error) {
              throw new Error(data.error.message || 'OpenAI API Error');
            }

            var aiUrl = data.data && data.data[0] && (data.data[0].url || data.data[0].b64_json);
            if (!aiUrl) throw new Error('No image returned by OpenAI');

            if (outImg) {
              outImg.src = aiUrl;
              outImg.onclick = function () { window.open(aiUrl, '_blank'); };
            }
            if (resultCont) resultCont.style.display = 'block';
            if (downloadBtn) {
              downloadBtn.style.display = 'inline-flex';
              downloadBtn.onclick = function () {
                var a = document.createElement('a');
                a.href = aiUrl;
                a.target = '_blank';
                a.download = 'orbix-ai-photorealistic-render.png';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              };
            }
            if (typeof window.toast === 'function') window.toast('✨ AI Photorealistic Render Generated Successfully!');
          } catch (err) {
            alert('AI Render generation error: ' + err.message);
          } finally {
            if (progressCont) progressCont.style.display = 'none';
            startBtn.disabled = false;
          }
        });
      }
    },

    initFurnitureCatalogModal: function () {
      var self = this;
      var modal = document.getElementById('modalFurnitureCatalog');
      var openBtn = document.getElementById('openFurnCatalogBtn');
      var planFurnBtn = document.getElementById('planFurnitureBtn');
      var closeBtn = document.getElementById('closeFurnCatalogModal');
      var closeFootBtn = document.getElementById('closeFurnCatalogFootBtn');
      var backdrop = modal ? modal.querySelector('.modal-backdrop') : null;
      var searchInput = document.getElementById('furnCatalogSearch');
      var clearSearchBtn = document.getElementById('furnSearchClearBtn');
      var grid = document.getElementById('furnCatalogGrid');
      var pills = document.querySelectorAll('.furn-cat-pill');
      var spotlightBtn = document.getElementById('spotlightSelectFCMBtn');

      if (!modal || !grid) return;

      var currentCat = 'all';
      var currentSearch = '';

      function openModal() {
        modal.classList.add('is-open');
        renderCatalog();
        if (searchInput) {
          setTimeout(function () { searchInput.focus(); }, 120);
        }
      }

      function closeModal() {
        modal.classList.remove('is-open');
      }

      if (openBtn) openBtn.addEventListener('click', openModal);
      if (closeBtn) closeBtn.addEventListener('click', closeModal);
      if (closeFootBtn) closeFootBtn.addEventListener('click', closeModal);
      if (backdrop) backdrop.addEventListener('click', closeModal);

      // ESC key to close
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && modal.classList.contains('is-open')) {
          closeModal();
        }
      });

      function updateCategoryCounts() {
        var catalog = Core.FURNITURE_CATALOG || [];
        var counts = {
          all: catalog.length,
          kitchen_base: 0,
          kitchen_fm: 0,
          kitchen_corner: 0,
          kitchen_drawers: 0,
          kitchen_tall: 0,
          kitchen_wall: 0,
          wardrobe: 0,
          loft: 0,
          tv_unit: 0,
          crockery: 0,
          wall_paneling: 0,
          vanity: 0,
          bed: 0
        };
        catalog.forEach(function (it) {
          var cat = (it.category || '').toLowerCase();
          if (cat === 'kitchen_fm') { counts.kitchen_fm++; counts.kitchen_base++; }
          else if (cat === 'kitchen_corner') { counts.kitchen_corner++; counts.kitchen_base++; }
          else if (cat === 'kitchen_drawers') { counts.kitchen_drawers++; counts.kitchen_base++; }
          else if (cat === 'kitchen_tall') { counts.kitchen_tall++; counts.kitchen_base++; }
          else if (cat === 'kitchen_base') { counts.kitchen_base++; }
          else if (cat === 'kitchen_wall') counts.kitchen_wall++;
          else if (cat === 'loft') counts.loft++;
          else if (cat.indexOf('wardrobe') !== -1) counts.wardrobe++;
          else if (cat.indexOf('crockery') !== -1 || cat.indexOf('tv') !== -1) { counts.crockery++; counts.tv_unit++; }
          else if (cat === 'wall_paneling') counts.wall_paneling++;
          else if (cat.indexOf('vanity') !== -1 || cat.indexOf('shoe') !== -1 || cat.indexOf('dresser') !== -1) counts.vanity++;
          else if (cat.indexOf('bed') !== -1) counts.bed++;
        });
        var elAll = document.getElementById('furnCountAll'); if (elAll) elAll.textContent = counts.all;
        var elKb = document.getElementById('furnCountKBase'); if (elKb) elKb.textContent = counts.kitchen_base;
        var elKfm = document.getElementById('furnCountKFm'); if (elKfm) elKfm.textContent = counts.kitchen_fm;
        var elKcn = document.getElementById('furnCountKCorner'); if (elKcn) elKcn.textContent = counts.kitchen_corner;
        var elKdr = document.getElementById('furnCountKDrawers'); if (elKdr) elKdr.textContent = counts.kitchen_drawers;
        var elKtl = document.getElementById('furnCountKTall'); if (elKtl) elKtl.textContent = counts.kitchen_tall;
        var elKw = document.getElementById('furnCountKWall'); if (elKw) elKw.textContent = counts.kitchen_wall;
        var elWr = document.getElementById('furnCountWardrobe'); if (elWr) elWr.textContent = counts.wardrobe;
        var elLf = document.getElementById('furnCountLoft'); if (elLf) elLf.textContent = counts.loft;
        var elTv = document.getElementById('furnCountTV'); if (elTv) elTv.textContent = counts.tv_unit;
        var elCr = document.getElementById('furnCountCrockery'); if (elCr) elCr.textContent = counts.crockery;
        var elWp = document.getElementById('furnCountWallPanel'); if (elWp) elWp.textContent = counts.wall_paneling;
        var elVn = document.getElementById('furnCountVanity'); if (elVn) elVn.textContent = counts.vanity;
        var elBd = document.getElementById('furnCountBed'); if (elBd) elBd.textContent = counts.bed;
      }

      function selectUnitPreset(item) {
        if (!item) return;
        if (self.editor) {
          self.editor.furniturePreset = item;
          self.editor.activeTool = 'furniture';
        }

        // Update toolbar widget active status
        var widget = document.getElementById('furnPickerWidget');
        if (widget) widget.classList.add('is-tool-active');
        document.querySelectorAll('.plan-tool-btn').forEach(function (b) {
          b.classList.toggle('is-active', b.dataset.tool === 'furniture');
        });

        // Update active badge display in toolbar
        var imgEl = document.getElementById('planFurnActiveImg');
        var nameEl = document.getElementById('planFurnActiveName');
        var dimsEl = document.getElementById('planFurnActiveDims');
        var catEl = document.getElementById('planFurnActiveCat');
        if (imgEl) imgEl.src = Core.getUnitIcon ? Core.getUnitIcon(item) : 'icon-cookscape-unit.png';
        if (nameEl) nameEl.textContent = item.name;
        if (dimsEl && item.dimensions) dimsEl.textContent = item.dimensions.W + '×' + item.dimensions.H;
        if (catEl) catEl.textContent = 'Cookscape Units';

        // Sync hidden select
        var furnSel = document.getElementById('planFurnSelect');
        if (furnSel) furnSel.value = item.id;

        closeModal();

        // Check if currently viewing 3D Studio
        var is3DView = document.getElementById('view-design') && document.getElementById('view-design').classList.contains('is-on');
        if (is3DView && typeof self.placeModularUnitIn3D === 'function') {
          self.placeModularUnitIn3D({
            name: item.name,
            category: item.category,
            dimensions: item.dimensions,
            unitConfig: Object.assign({}, item.unitConfig || {})
          });
        } else {
          if (typeof window.toast === 'function') {
            window.toast('Ready to place: ' + item.name + ' (' + (item.dimensions ? item.dimensions.W + '×' + item.dimensions.H : '') + '). Click floor plan to position.');
          }
          if (self.editor && self.editor.render) self.editor.render();
        }
      }

      if (spotlightBtn) {
        spotlightBtn.addEventListener('click', function () {
          var catalog = Core.FURNITURE_CATALOG || [];
          var fcm = catalog.find(function (it) { return it.id === 'fcm-rt'; }) || catalog[0];
          selectUnitPreset(fcm);
        });
      }

      function renderCatalog() {
        updateCategoryCounts();
        var catalog = Core.FURNITURE_CATALOG || [];
        var activePresetId = (self.editor && self.editor.furniturePreset && self.editor.furniturePreset.id) || 'fcm-rt';

        var query = currentSearch.trim().toLowerCase();
        var filtered = catalog.filter(function (it) {
          // Category filter
          if (currentCat !== 'all') {
            var c = (it.category || '').toLowerCase();
            if (currentCat === 'kitchen_base' && c !== 'kitchen_base' && c !== 'kitchen_fm' && c !== 'kitchen_corner' && c !== 'kitchen_drawers' && c !== 'kitchen_tall') return false;
            if (currentCat === 'kitchen_fm' && c !== 'kitchen_fm') return false;
            if (currentCat === 'kitchen_corner' && c !== 'kitchen_corner') return false;
            if (currentCat === 'kitchen_drawers' && c !== 'kitchen_drawers') return false;
            if (currentCat === 'kitchen_tall' && c !== 'kitchen_tall') return false;
            if (currentCat === 'kitchen_wall' && c !== 'kitchen_wall') return false;
            if (currentCat === 'wardrobe' && c.indexOf('wardrobe') === -1) return false;
            if (currentCat === 'loft' && c.indexOf('loft') === -1) return false;
            if (currentCat === 'tv_unit' && c.indexOf('tv') === -1 && c.indexOf('crockery') === -1) return false;
            if (currentCat === 'crockery' && c.indexOf('crockery') === -1 && c.indexOf('tv') === -1) return false;
            if (currentCat === 'wall_paneling' && c.indexOf('wall_paneling') === -1 && c.indexOf('ledge') === -1 && c.indexOf('panel') === -1) return false;
            if (currentCat === 'vanity' && c.indexOf('vanity') === -1 && c.indexOf('shoe') === -1 && c.indexOf('dresser') === -1) return false;
            if (currentCat === 'bed' && c.indexOf('bed') === -1) return false;
          }

          // Search query filter
          if (!query) return true;
          var nameMatch = (it.name || '').toLowerCase().indexOf(query) !== -1;
          var codeMatch = (it.code || it.id || '').toLowerCase().indexOf(query) !== -1;
          var catMatch = (it.category || '').toLowerCase().indexOf(query) !== -1;
          var dimsMatch = it.dimensions ? (String(it.dimensions.W).indexOf(query) !== -1 || String(it.dimensions.H).indexOf(query) !== -1 || String(it.dimensions.D).indexOf(query) !== -1) : false;
          var matMatch = (it.materials && it.materials.shutter && it.materials.shutter.finish && it.materials.shutter.finish.toLowerCase().indexOf(query) !== -1);
          var descMatch = (it.description || '').toLowerCase().indexOf(query) !== -1 || (it.costCategory || '').toLowerCase().indexOf(query) !== -1;
          return nameMatch || codeMatch || catMatch || dimsMatch || matMatch || descMatch;
        });

        var countEl = document.getElementById('furnShowingCount');
        if (countEl) countEl.textContent = filtered.length;

        var emptyEl = document.getElementById('furnEmptyState');
        var termSpan = document.getElementById('furnSearchQueryTerm');
        if (emptyEl) {
          if (filtered.length === 0) {
            emptyEl.style.display = 'flex';
            grid.style.display = 'none';
            if (termSpan) termSpan.textContent = query;
          } else {
            emptyEl.style.display = 'none';
            grid.style.display = 'grid';
          }
        }

        grid.innerHTML = '';
        filtered.forEach(function (item) {
          var isSelected = (item.id === activePresetId);
          var card = document.createElement('div');
          card.className = 'furn-unit-card' + (isSelected ? ' is-selected' : '');

          var dims = item.dimensions || { W: 1200, H: 2100, D: 600 };
          var catLabel = (item.category || 'Unit').replace('_', ' ');
          var rateText = item.customRate ? ('₹ ' + Number(item.customRate).toLocaleString('en-IN')) : (item.pricingOverrides && item.pricingOverrides.baseRate ? ('₹ ' + Number(item.pricingOverrides.baseRate).toLocaleString('en-IN')) : '');

          var shutterText = (item.unitConfig && item.unitConfig.shutters !== undefined) ? (item.unitConfig.shutters + ' Shutter' + (item.unitConfig.shutters !== 1 ? 's' : '')) : '';
          var doorStyle = (item.unitConfig && item.unitConfig.dstyle) ? item.unitConfig.dstyle.toUpperCase() : 'SLAB';
          var handleText = (item.unitConfig && item.unitConfig.handle) ? (' · ' + item.unitConfig.handle) : '';
          var specLine = (shutterText ? (shutterText + ' · ' + doorStyle) : doorStyle) + handleText;

          var isWardrobeItem = (item.category === 'wardrobe' || (item.name && item.name.toLowerCase().indexOf('wardrobe') !== -1));
          var cardImgSrc = Core.getUnitIcon ? Core.getUnitIcon(item) : (isWardrobeItem ? 'icon-furniture.png' : 'icon-cookscape-unit.png');
          var cardIconHtml = '<img src="' + cardImgSrc + '" alt="' + item.name + '" class="furn-card-img-thumb">';

          card.innerHTML =
            '<div class="furn-card-top">' +
              '<div class="furn-card-icon-title">' +
                '<div class="furn-card-icon" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:6px;padding:3px;display:flex;align-items:center;justify-content:center;">' + cardIconHtml + '</div>' +
                '<div class="furn-card-name-wrap">' +
                  '<div class="furn-card-name">' + item.name + '</div>' +
                  '<div class="furn-card-code">code: ' + (item.code || item.id) + '</div>' +
                '</div>' +
              '</div>' +
              '<span class="furn-card-category-pill">' + (isSelected ? '✓ Active' : catLabel) + '</span>' +
            '</div>' +
            '<div class="furn-card-mid">' +
              '<div class="furn-card-dims-row">' +
                '<span class="dim-chip"><b>W</b> ' + dims.W + '</span>' +
                '<span class="dim-chip"><b>H</b> ' + dims.H + '</span>' +
                '<span class="dim-chip"><b>D</b> ' + dims.D + ' mm</span>' +
              '</div>' +
              '<div class="furn-card-specs">' + specLine + '</div>' +
            '</div>' +
            '<div class="furn-card-bottom">' +
              '<div class="furn-card-price">' + (rateText || '—') + '</div>' +
              '<button type="button" class="furn-card-select-btn">' + (isSelected ? '✓ Selected' : 'Select & Place ➔') + '</button>' +
            '</div>';

          card.addEventListener('click', function () {
            selectUnitPreset(item);
          });

          grid.appendChild(card);
        });
      }

      self._renderFurnCatalog = renderCatalog;

      // Search event
      if (searchInput) {
        searchInput.addEventListener('input', function (e) {
          currentSearch = e.target.value;
          if (clearSearchBtn) {
            clearSearchBtn.style.display = currentSearch.length > 0 ? 'flex' : 'none';
          }
          renderCatalog();
        });
      }
      if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', function () {
          currentSearch = '';
          if (searchInput) { searchInput.value = ''; searchInput.focus(); }
          clearSearchBtn.style.display = 'none';
          renderCatalog();
        });
      }

      var resetBtn = document.getElementById('furnResetSearchBtn');
      if (resetBtn) {
        resetBtn.addEventListener('click', function () {
          currentSearch = '';
          currentCat = 'all';
          if (searchInput) { searchInput.value = ''; }
          if (clearSearchBtn) clearSearchBtn.style.display = 'none';
          pills.forEach(function (p) {
            p.classList.toggle('is-active', p.dataset.cat === 'all');
          });
          renderCatalog();
        });
      }

      // Category filter pills
      pills.forEach(function (pill) {
        pill.addEventListener('click', function () {
          pills.forEach(function (p) { p.classList.remove('is-active'); });
          pill.classList.add('is-active');
          currentCat = pill.dataset.cat || 'all';
          renderCatalog();
        });
      });

      // Update initial active badge to Cookscape Units: CROCKERY/TV BASE 1DOOR 1 DRAWER
      var defaultItem = Core.FURNITURE_CATALOG && Core.FURNITURE_CATALOG[0];
      if (defaultItem) {
        var imgEl = document.getElementById('planFurnActiveImg');
        var nameEl = document.getElementById('planFurnActiveName');
        var dimsEl = document.getElementById('planFurnActiveDims');
        var catEl = document.getElementById('planFurnActiveCat');
        if (imgEl) imgEl.src = Core.getUnitIcon ? Core.getUnitIcon(defaultItem) : 'icon-cookscape-unit.png';
        if (nameEl) nameEl.textContent = defaultItem.name;
        if (dimsEl && defaultItem.dimensions) dimsEl.textContent = defaultItem.dimensions.W + '×' + defaultItem.dimensions.H;
        if (catEl) catEl.textContent = 'Cookscape Units';
        if (self.editor) self.editor.furniturePreset = defaultItem;
      }
    },

    initFurnishUI: function () {
      var self = this;
      var sidePanel = document.getElementById('furnishSidePanel');
      var bottomTray = document.getElementById('furnishBottomTray');
      var planFurnBtn = document.getElementById('planFurnitureBtn');
      var openCatalogBtn = document.getElementById('openFurnCatalogBtn');
      var sideSearchBtn = document.getElementById('furnSideSearchBtn');
      var sideSearchLink = document.getElementById('furnSideSearchLink');
      var sideQuickSearch = document.getElementById('furnSideQuickSearch');
      var catList = document.getElementById('furnSideCatList');
      var catItems = catList ? catList.querySelectorAll('.furn-side-cat-item') : [];
      var trayCatPill = document.getElementById('furnTrayCatPill');
      var trayCatTitle = document.getElementById('furnTrayCatTitle');
      var traySearchInput = document.getElementById('furnTraySearchInput');
      var traySearchClear = document.getElementById('furnTraySearchClear');
      var traySearchIcon = document.getElementById('furnTraySearchIcon');
      var trayTabs = document.getElementById('furnTrayTabs');
      var trayCards = document.getElementById('furnTrayCards');
      var trayMinBtn = document.getElementById('furnTrayMinBtn');
      var trayCloseBtn = document.getElementById('furnTrayCloseBtn');
      var trayFilterBtn = document.getElementById('furnTrayFilterBtn');
      var currentSearchQuery = '';

      function esc(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      }

      if (!sidePanel || !bottomTray) return;

      var Core = (typeof window !== 'undefined' && window.OrbixCore) ? window.OrbixCore : ((typeof root !== 'undefined' && root.OrbixCore) ? root.OrbixCore : {});
      var currentCat = 'kitchen';
      var currentTab = 'kitchen_fm';
      var isCollapsed = false;
      var isFurnishMenuOpen = false;

      var TABS_DATA = {
        all: [
          { id: 'all_units', label: 'All Units & Cabinets', count: '180+' }
        ],
        kitchen: [
          { id: 'kitchen_fm', label: 'KITCHEN FM', count: '8' },
          { id: 'kitchen_corner', label: 'KITCHEN CORNER', count: '3' },
          { id: 'kitchen_drawers', label: 'KITCHEN DRAWERS', count: '11' },
          { id: 'kitchen_tall', label: 'KITCHEN TALL UNITS', count: '2' },
          { id: 'kitchen_wall_spice', label: 'KITCHEN WALL UNITS (SPICE RACK)', count: '22' }
        ],
        tv_crockery: [
          { id: 'tv_crockery_base', label: 'BASE', count: '8' },
          { id: 'tv_crockery_wall', label: 'WALL', count: '5' },
          { id: 'tv_crockery_drawers', label: 'DRAWERS', count: '6' },
          { id: 'tv_crockery_openbox', label: 'OPENBOX', count: '4' }
        ],
        wardrobe: [
          { id: 'wardrobe_all', label: 'WARDROBES ALL', count: '34' }
        ],
        loft: [
          { id: 'loft_all', label: 'ALL LOFT', count: '15' }
        ],
        wall_paneling: [
          { id: 'panel_back', label: 'BACK PANEL', count: '6' },
          { id: 'panel_ledges', label: 'LEDGES', count: '4' }
        ]
      };

      function mapItemToCard(it) {
        var w = (it.dimensions && it.dimensions.W) || 600;
        var h = (it.dimensions && it.dimensions.H) || 750;
        var d = (it.dimensions && it.dimensions.D) || 560;
        var variants = [w];
        if (w === 600) variants = [450, 500, 600, 800, 900];
        else if (w === 900) variants = [600, 750, 900, 1050, 1200];
        else if (w === 1200) variants = [900, 1050, 1200, 1500];
        else if (w === 450) variants = [300, 400, 450, 500, 600];
        else if (w === 300) variants = [300, 350, 400, 450];
        else if (w === 1000) variants = [700, 750, 800, 900, 1000, 1050, 1100, 1200];
        else if (w === 1800) variants = [1500, 1800, 2100, 2400];
        var code = it.code || (it.id ? it.id.toUpperCase() : 'UNIT');
        var name = it.name || code;
        var cat = (it.category || '').toLowerCase();
        var n = name.toLowerCase();
        var id = (it.id || '').toLowerCase();
        var cd = String(code).toLowerCase();
        var isLoft = (cat.indexOf('loft') !== -1 || n.indexOf('loft') !== -1 || id.indexOf('loft') !== -1 || cd.indexOf('loft') !== -1);
        var isOpenBox = (n.indexOf('open box') !== -1 || n.indexOf('open_box') !== -1 || id.indexOf('ob-') === 0 || id.indexOf('open-box') !== -1 || cd.indexOf('ob-') === 0);
        var isSpice = !isOpenBox && (cat.indexOf('spice') !== -1 || n.indexOf('spice') !== -1 || id.indexOf('spice') !== -1 || id.indexOf('sr-') === 0);
        var isWall = !isLoft && (
          cat === 'kitchen_wall' || cat === 'wall_unit' || cat.indexOf('wall') !== -1 ||
          n.indexOf('wm') !== -1 || n.indexOf('wall') !== -1 || id.indexOf('wm-') === 0 || id.indexOf('wcm-') === 0 || cd.indexOf('wm-') === 0
        );
        var defElev = isLoft ? 2100 : (isOpenBox ? 1500 : (isSpice ? 1350 : (isWall ? 1500 : 0)));
        var elev = (it.elevation !== undefined && it.elevation !== null && parseFloat(it.elevation) > 0) ?
          parseFloat(it.elevation) : defElev;

        return {
          id: it.id,
          code: code,
          name: name,
          badge: String(variants.length),
          selectedLabel: code || name,
          dimensions: { W: w, H: h, D: d },
          category: it.category || (isWall ? 'kitchen_wall' : (isLoft ? 'loft' : 'base_unit')),
          elevation: elev,
          unitConfig: it.unitConfig || {},
          materials: it.materials || {},
          variants: variants
        };
      }

      function getCardsForTab(cat, tabId) {
        var curCore = (typeof window !== 'undefined' && window.OrbixCore) ? window.OrbixCore : Core;
        var catalog = (curCore && curCore.FURNITURE_CATALOG) || [];
        var res = [];

        if (cat === 'all' || tabId === 'all_units') {
          res = catalog.map(mapItemToCard);
        } else if (cat === 'kitchen') {
          if (tabId === 'kitchen_fm') {
            res = catalog.filter(function (it) {
              return it.category === 'kitchen_fm' || (it.id && it.id.indexOf('fm') === 0 && it.category !== 'kitchen_corner' && it.category !== 'kitchen_drawers');
            });
          } else if (tabId === 'kitchen_corner') {
            res = catalog.filter(function (it) {
              return it.category === 'kitchen_corner' || (it.id && /(fcm|fbcm)/i.test(it.id)) || (it.name && /(corner|fcm|fbcm)/i.test(it.name));
            });
          } else if (tabId === 'kitchen_drawers') {
            res = catalog.filter(function (it) {
              return it.category === 'kitchen_drawers' || (it.id && /(d2|d3|ds)/i.test(it.id)) || (it.name && /drawer/i.test(it.name) && it.category && it.category.indexOf('kitchen') !== -1);
            });
          } else if (tabId === 'kitchen_tall') {
            res = catalog.filter(function (it) {
              return it.category === 'kitchen_tall' || (it.name && /(tall|tbm|oven)/i.test(it.name));
            });
          } else if (tabId === 'kitchen_wall_spice') {
            res = catalog.filter(function (it) {
              var c = (it.category || '').toLowerCase();
              var n = (it.name || '').toLowerCase();
              var id = (it.id || '').toLowerCase();
              // Remove crockery units from kitchen wm
              if (c === 'crockery' || c.indexOf('crockery') !== -1 || n.indexOf('crockery') !== -1 || id.indexOf('crockery') !== -1 || id.indexOf('ctv') !== -1 || (it.category && it.category.indexOf('tv') !== -1)) {
                return false;
              }
              // Exclude non-kitchen wardrobes / lofts
              if (c === 'wardrobe' || c === 'loft' || n.indexOf('wardrobe') !== -1 || n.indexOf('loft') !== -1) {
                return false;
              }
              return c === 'kitchen_wall' || c === 'spice_rack' || n.indexOf('wm') !== -1 || n.indexOf('spice') !== -1;
            });
          } else {
            res = catalog.filter(function (it) {
              var c = (it.category || '').toLowerCase();
              var n = (it.name || '').toLowerCase();
              var id = (it.id || '').toLowerCase();
              if (c === 'crockery' || n.indexOf('crockery') !== -1 || id.indexOf('ctv') !== -1) return false;
              return (it.category || '').indexOf('kitchen') !== -1 || c === 'spice_rack';
            });
          }
          res = res.map(mapItemToCard);
        } else if (cat === 'tv_crockery') {
          if (tabId === 'tv_crockery_base') {
            res = catalog.filter(function (it) {
              var n = (it.name + ' ' + it.id + ' ' + (it.category || '')).toLowerCase();
              return (n.indexOf('crockery') !== -1 || n.indexOf('tv') !== -1) && (n.indexOf('base') !== -1 || (!it.elevation || it.elevation === 0));
            });
          } else if (tabId === 'tv_crockery_wall') {
            res = catalog.filter(function (it) {
              var n = (it.name + ' ' + it.id + ' ' + (it.category || '')).toLowerCase();
              return (n.indexOf('crockery') !== -1 || n.indexOf('tv') !== -1) && (n.indexOf('wall') !== -1 || (it.elevation && it.elevation >= 1000));
            });
          } else if (tabId === 'tv_crockery_drawers') {
            res = catalog.filter(function (it) {
              var n = (it.name + ' ' + it.id + ' ' + (it.category || '')).toLowerCase();
              return (n.indexOf('crockery') !== -1 || n.indexOf('tv') !== -1) && (n.indexOf('drawer') !== -1 || (it.unitConfig && it.unitConfig.drawers > 0));
            });
          } else if (tabId === 'tv_crockery_openbox') {
            res = catalog.filter(function (it) {
              var n = (it.name + ' ' + it.id + ' ' + (it.category || '')).toLowerCase();
              return (n.indexOf('crockery') !== -1 || n.indexOf('tv') !== -1) && (n.indexOf('open') !== -1 || n.indexOf('box') !== -1 || n.indexOf('niche') !== -1 || (it.unitConfig && it.unitConfig.doorType === 'open'));
            });
          } else {
            res = catalog.filter(function (it) {
              var n = (it.name + ' ' + it.id + ' ' + (it.category || '')).toLowerCase();
              return n.indexOf('crockery') !== -1 || n.indexOf('tv') !== -1;
            });
          }
          res = res.map(mapItemToCard);
        } else if (cat === 'wardrobe') {
          res = catalog.filter(function (it) {
            var c = (it.category || '').toLowerCase();
            var n = (it.name || '').toLowerCase();
            return (c === 'wardrobe' || n.indexOf('wardrobe') !== -1 || n.indexOf('wr') !== -1 || n.indexOf('sliding') !== -1) && n.indexOf('loft') === -1 && c.indexOf('loft') === -1;
          }).map(mapItemToCard);
        } else if (cat === 'loft') {
          res = catalog.filter(function (it) {
            var c = (it.category || '').toLowerCase();
            var n = (it.name || '').toLowerCase();
            return c.indexOf('loft') !== -1 || n.indexOf('loft') !== -1;
          }).map(mapItemToCard);
        } else if (cat === 'wall_paneling') {
          if (tabId === 'panel_ledges') {
            res = catalog.filter(function (it) {
              var n = (it.name || '').toLowerCase();
              return n.indexOf('ledge') !== -1 || n.indexOf('shelf') !== -1 || n.indexOf('blank shutter') !== -1 || n.indexOf('bs') !== -1 || it.id === 'bs-60';
            });
          } else {
            res = catalog.filter(function (it) {
              var c = (it.category || '').toLowerCase();
              var n = (it.name || '').toLowerCase();
              return c === 'wall_paneling' || it.id === 'pnl-back' || n.indexOf('back panel') !== -1 || n.indexOf('wall panel') !== -1;
            });
          }
          res = res.map(mapItemToCard);
        } else {
          res = catalog.map(mapItemToCard);
        }

        return res.length ? res : catalog.map(mapItemToCard);
      }

      function renderTabs(cat) {
        trayTabs.innerHTML = '';
        var tabList = TABS_DATA[cat] || TABS_DATA.all;
        currentTab = tabList[0] ? tabList[0].id : 'default';

        tabList.forEach(function (t, idx) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'furn-tray-tab' + (idx === 0 ? ' is-active' : '');
          btn.dataset.tabId = t.id;
          btn.innerHTML = '<span>' + t.label + '</span>' + (t.count ? '<span class="furn-tray-tab-count">' + t.count + '</span>' : '');
          btn.addEventListener('click', function () {
            trayTabs.querySelectorAll('.furn-tray-tab').forEach(function (b) { b.classList.remove('is-active'); });
            btn.classList.add('is-active');
            currentTab = t.id;
            renderCards(cat, currentTab, currentSearchQuery);
          });
          trayTabs.appendChild(btn);
        });
      }

      function renderCards(cat, tabId, searchQuery) {
        trayCards.innerHTML = '';
        var cards = getCardsForTab(cat, tabId);
        var activePresetId = (self.editor && self.editor.furniturePreset && self.editor.furniturePreset.id) || '';

        var q = (searchQuery !== undefined && searchQuery !== null) ? String(searchQuery).trim().toLowerCase() : currentSearchQuery;
        if (q) {
          cards = cards.filter(function (cardData) {
            var n = (cardData.name || '').toLowerCase();
            var c = (cardData.code || '').toLowerCase();
            var id = (cardData.id || '').toLowerCase();
            var l = (cardData.selectedLabel || '').toLowerCase();
            var dims = cardData.dimensions ? (cardData.dimensions.W + ' ' + cardData.dimensions.H + ' ' + cardData.dimensions.D) : '';
            return n.indexOf(q) !== -1 || c.indexOf(q) !== -1 || id.indexOf(q) !== -1 || l.indexOf(q) !== -1 || dims.indexOf(q) !== -1;
          });
        }

        if (!cards.length) {
          var catName = (trayCatTitle && trayCatTitle.textContent) || 'this category';
          trayCards.innerHTML = '<div class="furn-empty-state"><div style="font-size:24px;margin-bottom:6px;">🔍</div>No units found matching "<b>' + esc(q) + '</b>" in ' + esc(catName) + '</div>';
          return;
        }

        cards.forEach(function (cardData) {
          var card = document.createElement('div');
          var isSel = (cardData.id === activePresetId);
          card.className = 'furn-card' + (isSel ? ' is-active' : '');
          card.dataset.unitId = cardData.id;

          // Thumbnail
          var curCore = (typeof window !== 'undefined' && window.OrbixCore) ? window.OrbixCore : Core;
          var getIconFn = (curCore && curCore.getUnitIcon) || (typeof OrbixUnitIcons !== 'undefined' && OrbixUnitIcons.getIcon);
          var thumbUrl = getIconFn ? getIconFn(cardData) : (cardData.thumbnailUrl || 'icon-cookscape-unit.png');

          var topHtml = '<div class="furn-card-top">' +
            '<div class="furn-card-thumb"><img src="' + thumbUrl + '" alt="' + cardData.code + '" loading="lazy"></div>' +
            '<div class="furn-card-info">' +
            '<span class="furn-card-badge">' + cardData.badge + '</span>' +
            '<span class="furn-card-code" title="' + cardData.name + '">' + cardData.code + '</span>' +
            '</div></div>';

          var bottomHtml = '<div class="furn-card-bottom" title="Select variant / place unit">' +
            '<span class="furn-card-title-text">' + cardData.selectedLabel + '</span>' +
            '<span class="furn-card-chevron">▾</span>' +
            '</div>';

          card.innerHTML = topHtml + bottomHtml;

          // Click handler to select and place
          card.addEventListener('click', function (e) {
            trayCards.querySelectorAll('.furn-card').forEach(function (c) { c.classList.remove('is-active'); });
            card.classList.add('is-active');

            var cId = (cardData.id || '').toLowerCase();
            var cName = (cardData.name || '').toLowerCase();
            var cCat = (cardData.category || '').toLowerCase();
            var isLoftUnit = (cCat.indexOf('loft') !== -1 || cName.indexOf('loft') !== -1 || cId.indexOf('loft') !== -1 || cat === 'loft');
            var isOpenBoxUnit = (cName.indexOf('open box') !== -1 || cName.indexOf('open_box') !== -1 || cId.indexOf('ob-') === 0 || cId.indexOf('open-box') !== -1);
            var isSpiceUnit = !isOpenBoxUnit && (cCat.indexOf('spice') !== -1 || cName.indexOf('spice') !== -1 || cId.indexOf('spice') !== -1 || cId.indexOf('sr-') === 0);
            var isPanelOrLedge = (cCat === 'wall_paneling' || cCat === 'ledges' || cId === 'bs-60' || cId.indexOf('bs-') === 0 || cName.indexOf('blank shutter') !== -1 || cName.indexOf('ledge') !== -1 || cName.indexOf('panel') !== -1);
            var isWallUnit = !isLoftUnit && !isPanelOrLedge && (
              cCat === 'kitchen_wall' || cCat === 'wall_unit' || cCat.indexOf('wall') !== -1 ||
              cName.indexOf('wm') !== -1 || cName.indexOf('wall') !== -1 || cId.indexOf('wm-') === 0 || cId.indexOf('wcm-') === 0 ||
              cat === 'wall_unit' || currentTab === 'kitchen_wall_spice'
            );
            var defElev = isLoftUnit ? 2100 : (isOpenBoxUnit ? 1500 : (isSpiceUnit ? 1350 : (isWallUnit ? 1500 : 0)));
            if (cId === 'ledge-std' || cName === 'ledge') defElev = 750;
            else if (cId === 'ledge-ctop' || cName.indexOf('ledge countertop') !== -1) defElev = 750;
            else if (cId === 'ledge-vert' || cName.indexOf('vertical ledge') !== -1) defElev = 0;
            else if (cId === 'pnl-back' || cName.indexOf('back panel') !== -1) defElev = 300;
            else if (cId === 'pnl-wall' || cName.indexOf('wall panel') !== -1) defElev = 0;
            else if (cId === 'bs-60' || cName.indexOf('blank shutter') !== -1) defElev = 0;

            var finalElev = (cardData.elevation !== undefined && cardData.elevation !== null && cardData.elevation !== '') ?
              parseFloat(cardData.elevation) : defElev;

            var itemToPlace = {
              id: cardData.id,
              name: cardData.name,
              category: cardData.category || (isPanelOrLedge ? 'wall_paneling' : (isWallUnit ? 'kitchen_wall' : (isLoftUnit ? 'loft' : (cat === 'base_unit' ? 'kitchen_base' : cat)))),
              dimensions: Object.assign({}, cardData.dimensions || { W: 900, H: (isLoftUnit ? 400 : (isWallUnit ? 600 : 750)), D: (isWallUnit ? 350 : 560) }),
              elevation: finalElev,
              unitConfig: Object.assign({}, cardData.unitConfig || {})
            };
            if (cardData.isDecor) {
              itemToPlace.isDecor = true;
              itemToPlace.decorType = cardData.decorType || 'decor';
              itemToPlace.elevation = cardData.elevation || 0;
            }

            if (self.editor) {
              self.editor.furniturePreset = itemToPlace;
              self.editor.activeTool = 'furniture';
            }

            // Sync top toolbar button active state
            document.querySelectorAll('.plan-tool-btn').forEach(function (b) {
              b.classList.toggle('is-active', b.dataset.tool === 'furniture');
            });
            var widget = document.getElementById('furnPickerWidget');
            if (widget) widget.classList.add('is-tool-active');

            // Sync top toolbar badge
            var nameEl = document.getElementById('planFurnActiveName');
            var dimsEl = document.getElementById('planFurnActiveDims');
            var imgEl = document.getElementById('planFurnActiveImg');
            if (nameEl) nameEl.textContent = itemToPlace.name;
            if (dimsEl && itemToPlace.dimensions) dimsEl.textContent = itemToPlace.dimensions.W + '×' + itemToPlace.dimensions.H;
            if (imgEl) imgEl.src = thumbUrl;

            // Check if 3D Studio active
            var is3D = document.getElementById('view-design') && document.getElementById('view-design').classList.contains('is-on');
            if (is3D && typeof self.placeModularUnitIn3D === 'function') {
              self.placeModularUnitIn3D(itemToPlace);
            } else {
              if (typeof window.toast === 'function') {
                window.toast('Ready to place: ' + itemToPlace.name + ' (' + itemToPlace.dimensions.W + '×' + itemToPlace.dimensions.H + '). Click on floor plan to position.');
              }
            }
          });

          trayCards.appendChild(card);
        });
      }

      function switchCategory(catKey, catLabel) {
        currentCat = catKey;
        if (trayCatTitle) trayCatTitle.textContent = catLabel;
        if (traySearchInput) {
          traySearchInput.placeholder = 'Search units in ' + catLabel + '...';
        }
        catItems.forEach(function (item) {
          item.classList.toggle('is-active', item.dataset.cat === catKey);
        });
        renderTabs(catKey);
        renderCards(catKey, currentTab, currentSearchQuery);
      }

      // Wire Category Item Clicks in Left Panel: "on clicking the menu all the option like in model should open down"
      catItems.forEach(function (item) {
        item.onclick = function (e) {
          if (e && e.stopPropagation) e.stopPropagation();
          var catKey = item.dataset.cat || 'all';
          var catLabel = item.textContent.trim();
          switchCategory(catKey, catLabel);

          // Open the bottom options drawer down at the bottom
          bottomTray.style.display = 'flex';
          bottomTray.classList.remove('is-collapsed');
          if (trayMinBtn) {
            trayMinBtn.textContent = '➖';
            trayMinBtn.title = 'Minimize Tray';
          }
          if (self.editor && self.editor.resize) {
            setTimeout(function () { self.editor.resize(); }, 150);
          }
        };
      });

      // Wire Minimize / Expand button on bottom tray
      if (trayMinBtn) {
        trayMinBtn.onclick = function (e) {
          if (e && e.stopPropagation) e.stopPropagation();
          isCollapsed = !isCollapsed;
          bottomTray.classList.toggle('is-collapsed', isCollapsed);
          trayMinBtn.textContent = isCollapsed ? '➕' : '➖';
          trayMinBtn.title = isCollapsed ? 'Expand Tray' : 'Minimize Tray';
          if (self.editor && self.editor.resize) {
            setTimeout(function () { self.editor.resize(); }, 220);
          }
        };
      }

      // Wire Close button on bottom tray
      if (trayCloseBtn) {
        trayCloseBtn.onclick = function (e) {
          if (e && e.stopPropagation) e.stopPropagation();
          bottomTray.style.display = 'none';
          if (self.editor && self.editor.resize) {
            setTimeout(function () { self.editor.resize(); }, 150);
          }
        };
      }

      // Wire Search Input & Clear Button for Bottom Unit Tray
      if (traySearchInput) {
        traySearchInput.addEventListener('input', function () {
          currentSearchQuery = traySearchInput.value.trim().toLowerCase();
          if (traySearchClear) traySearchClear.style.display = currentSearchQuery ? 'inline-block' : 'none';
          renderCards(currentCat, currentTab, currentSearchQuery);
        });
        traySearchInput.addEventListener('keydown', function (e) {
          if (e.key === 'Escape') {
            traySearchInput.value = '';
            currentSearchQuery = '';
            if (traySearchClear) traySearchClear.style.display = 'none';
            renderCards(currentCat, currentTab, '');
          }
        });
      }
      if (traySearchClear) {
        traySearchClear.addEventListener('click', function () {
          if (traySearchInput) {
            traySearchInput.value = '';
            traySearchInput.focus();
          }
          currentSearchQuery = '';
          traySearchClear.style.display = 'none';
          renderCards(currentCat, currentTab, '');
        });
      }
      if (trayCatPill) {
        trayCatPill.addEventListener('click', function () {
          if (traySearchInput) {
            traySearchInput.focus();
            traySearchInput.select();
          }
        });
      }
      if (traySearchIcon) {
        traySearchIcon.addEventListener('click', function () {
          if (traySearchInput) {
            traySearchInput.focus();
            traySearchInput.select();
          }
        });
      }

      // Wire Top Toolbar "Furnish" button toggle:
      // "when i click furnish side menu should open and on another it should get close"
      window.toggleFurnishMenu = function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
        var sp = document.getElementById('furnishSidePanel');
        var bt = document.getElementById('furnishBottomTray');
        var pBtn = document.getElementById('planFurnitureBtn');
        if (!sp) return;

        var isVisible = (sp.style.display === 'flex' || sp.style.display === 'block');
        if (!isVisible) {
          // Closed -> OPEN both side menu and bottom units drawer so units show immediately
          sp.style.display = 'flex';
          if (bt) {
            bt.style.display = 'flex';
            bt.classList.remove('is-collapsed');
          }
          document.querySelectorAll('.plan-tool-btn').forEach(function (b) { b.classList.remove('is-active'); });
          if (pBtn) pBtn.classList.add('is-active');
          // Crucial: keep tool as 'select' until user specifically clicks a unit card to place!
          if (self.editor) {
            self.editor.furniturePreset = null;
            self.editor.activeTool = 'select';
          }
          switchCategory(currentCat || 'base_unit', trayCatTitle ? trayCatTitle.textContent : 'Base Unit');
        } else {
          // Already open -> toggle CLOSE
          sp.style.display = 'none';
          if (bt) bt.style.display = 'none';
          if (pBtn) pBtn.classList.remove('is-active');
          if (self.editor) {
            self.editor.activeTool = 'select';
            self.editor.furniturePreset = null;
          }
          var selectBtn = document.querySelector ? document.querySelector('.plan-tool-btn[data-tool="select"]') : null;
          if (selectBtn) selectBtn.classList.add('is-active');
        }
        if (self.editor) {
          if (self.editor.resize) self.editor.resize();
          if (self.editor.render) self.editor.render();
          setTimeout(function () {
            if (self.editor.resize) self.editor.resize();
            if (self.editor.render) self.editor.render();
          }, 80);
        }
      };

      if (planFurnBtn) {
        planFurnBtn.onclick = window.toggleFurnishMenu;
      }

      // Initial pre-render of Base Unit so tabs and cards are ready
      switchCategory('base_unit', 'Base Unit');

      // Close Furnish panels when selecting any other drawing tool
      var otherToolBtns = document.querySelectorAll('.plan-tool-btn:not(#planFurnitureBtn)');
      otherToolBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (btn.dataset.tool !== 'furniture') {
            isFurnishMenuOpen = false;
            sidePanel.style.display = 'none';
            bottomTray.style.display = 'none';
            if (self.editor && self.editor.resize) {
              setTimeout(function () { self.editor.resize(); }, 120);
            }
          }
        });
      });

      // Wire Search Catalog link to open full catalog modal
      if (sideSearchLink) {
        sideSearchLink.onclick = function (e) {
          if (e && e.preventDefault) e.preventDefault();
          if (typeof self.openFurnitureCatalogModal === 'function') {
            self.openFurnitureCatalogModal();
          }
        };
      }

      // Wire Search icon button to toggle quick filter input
      if (sideSearchBtn && sideQuickSearch) {
        sideSearchBtn.onclick = function (e) {
          if (e && e.stopPropagation) e.stopPropagation();
          var isHidden = (sideQuickSearch.style.display === 'none');
          sideQuickSearch.style.display = isHidden ? 'block' : 'none';
          if (isHidden) sideQuickSearch.focus();
        };

        sideQuickSearch.addEventListener('input', function (e) {
          var q = (e.target.value || '').trim().toLowerCase();
          catItems.forEach(function (ci) {
            var text = ci.textContent.toLowerCase();
            ci.style.display = (!q || text.indexOf(q) !== -1) ? 'block' : 'none';
          });
        });
      }

      // Initial state: Closed until user clicks "Furnish"
      sidePanel.style.display = 'none';
      bottomTray.style.display = 'none';
      isFurnishMenuOpen = false;
      try { switchCategory('base_unit', 'Base Unit'); } catch (_) {}
    },

    exportSketchUp: function (format) {
      format = format || 'dae';
      var self = this;
      var scene = (window.__cc && window.__cc.gl && window.__cc.gl.getScene) ? window.__cc.gl.getScene() : null;

      if (!this.archRenderer && root.Orbix3D) {
        this.archRenderer = new root.Orbix3D(scene);
      }

      var res;
      try {
        if (this.archRenderer && typeof this.archRenderer.exportToSketchUpCollada === 'function') {
          res = this.archRenderer.exportToSketchUpCollada(this.project, scene);
        } else if (root.Orbix3D && typeof root.Orbix3D.exportSketchUp === 'function') {
          res = root.Orbix3D.exportSketchUp(this.project, scene);
        }
      } catch (err) {
        console.error('SketchUp export error:', err);
        alert('Could not export to SketchUp: ' + err.message);
        return;
      }

      if (!res || !res.colladaXml) {
        alert('No 3D geometry available to export. Please add walls or modular units first.');
        return;
      }

      var filename = (format === 'skp') ? res.skpFilename : res.filename;
      var mimeType = (format === 'skp') ? 'application/octet-stream' : 'model/vnd.collada+xml';

      // Deliver file download to browser
      var blob = new Blob([res.colladaXml], { type: mimeType });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);

      if (typeof window.showToast === 'function') {
        window.showToast('✨ Exported whole 3D project for Trimble SketchUp (' + filename + ')! In SketchUp: File ➔ Import to open.');
      }

      // Show SketchUp modal with stats and direct instructions
      this.openExportSkpModal(res);
    },

    openExportSkpModal: function (res) {
      var modal = document.getElementById('modalExportSkp');
      if (!modal) return;

      var statsEl = document.getElementById('skpExportStats');
      if (statsEl && res && res.stats) {
        var s = res.stats;
        statsEl.innerHTML =
          '<span style="background:#EEF2F6;padding:4px 8px;border-radius:4px;">🧱 <b>' + s.walls + '</b> Walls &amp; Cutouts</span>' +
          '<span style="background:#EEF2F6;padding:4px 8px;border-radius:4px;">🚪 <b>' + s.openings + '</b> Openings</span>' +
          '<span style="background:#EEF2F6;padding:4px 8px;border-radius:4px;">🪵 <b>' + s.furniture + '</b> Modular Units</span>' +
          '<span style="background:#EEF2F6;padding:4px 8px;border-radius:4px;">📐 <b>' + (s.triangleCount ? s.triangleCount.toLocaleString() : 'Geometry') + '</b> 3D Triangles</span>' +
          '<span style="background:#E0F2FE;color:#0284C7;padding:4px 8px;border-radius:4px;font-weight:600;">✅ 1:1 mm Scale</span>';
      }

      var self = this;
      var btnDae = document.getElementById('skpDownloadDaeBtn');
      if (btnDae) {
        btnDae.onclick = function () {
          self.exportSketchUp('dae');
        };
      }
      var btnSkp = document.getElementById('skpDownloadSkpBtn');
      if (btnSkp) {
        btnSkp.onclick = function () {
          self.exportSketchUp('skp');
        };
      }

      modal.classList.add('is-open');
      modal.style.display = 'flex';

      function closeModal() {
        modal.classList.remove('is-open');
        modal.style.display = 'none';
      }

      modal.querySelectorAll('.modal-close-btn, #cancelExportSkpBtn, #backdropExportSkp, #closeExportSkpModal').forEach(function (b) {
        b.onclick = closeModal;
      });
    },

    COMMERCIAL_FIELDS: [
      { key: 'additionalAccessories', label: 'Additional Accessories', type: 'amount', isDeduction: false },
      { key: 'appliances', label: 'Appliances', type: 'amount', isDeduction: false },
      { key: 'designCharges', label: 'Design Charges', type: 'percent', defaultPercent: 9, isDeduction: false },
      { key: 'freightCharges', label: 'Freight Charges', type: 'percent', defaultPercent: 2.5, isDeduction: false },
      { key: 'loadingUnloading', label: 'Loading and unloading (material)', type: 'select', options: ['Additional', 'Included'], defaultVal: 'Additional' },
      { key: 'floorMat', label: 'Floor protective mat', type: 'select', options: ['Not Included in Quote', 'Included'], defaultVal: 'Not Included in Quote' },
      { key: 'civilWorks', label: 'Civil works', type: 'select', options: ['As per actuals', 'Included'], defaultVal: 'As per actuals' },
      { key: 'electricalPlumbing', label: 'Electrical & Plumbing Works', type: 'select', options: ['Additional', 'Included'], defaultVal: 'Additional' },
      { key: 'falseCeiling', label: 'False ceiling', type: 'select', options: ['Not Included', 'Included'], defaultVal: 'Not Included' },
      { key: 'wallpaper', label: 'Wallpaper', type: 'select', options: ['Complementary', 'Not Included'], defaultVal: 'Complementary' },
      { key: 'discount', label: 'Discount on Wood Work', type: 'percent', isDeduction: true },
      { key: 'adp', label: 'Discount on Design Charge', type: 'percent', isDeduction: true }
    ],

    getCommercialCharges: function () {
      if (!this.project) return {};
      if (!this.project.commercialCharges) {
        this.project.commercialCharges = {
          additionalAccessories: 0,
          accessoriesEnabled: true,
          appliances: 0,
          appliancesEnabled: true,
          designPercent: 9,
          freightPercent: 2.5,
          freightEnabled: true,
          loadingUnloadingStatus: 'Additional',
          floorMatStatus: 'Not Included in Quote',
          civilWorksStatus: 'As per actuals',
          electricalPlumbingStatus: 'Additional',
          falseCeilingStatus: 'Not Included',
          wallpaperStatus: 'Complementary',
          discountPercent: 0,
          adpPercent: 0,
          gstPercent: 18,
          gstEnabled: true
        };
      }
      var c = this.project.commercialCharges;
      if (c.accessories && !c.additionalAccessories) c.additionalAccessories = c.accessories;
      if (c.discount && !c.discountPercent) c.discountPercent = c.discount;
      if (c.accessoriesEnabled === undefined) c.accessoriesEnabled = true;
      if (c.appliancesEnabled === undefined) c.appliancesEnabled = true;
      if (c.designPercent === undefined) c.designPercent = 9;
      if (c.freightPercent === undefined) c.freightPercent = 2.5;
      if (c.freightEnabled === undefined) c.freightEnabled = true;
      if (!c.loadingUnloadingStatus) c.loadingUnloadingStatus = 'Additional';
      if (!c.floorMatStatus) c.floorMatStatus = 'Not Included in Quote';
      if (!c.civilWorksStatus) c.civilWorksStatus = 'As per actuals';
      if (!c.electricalPlumbingStatus) c.electricalPlumbingStatus = 'Additional';
      if (!c.falseCeilingStatus) c.falseCeilingStatus = 'Not Included';
      if (!c.wallpaperStatus) c.wallpaperStatus = 'Complementary';
      if (c.discountPercent === undefined) c.discountPercent = 0;
      if (c.adpPercent === undefined) c.adpPercent = 0;
      if (c.gstPercent === undefined) c.gstPercent = 18;
      if (c.gstEnabled === undefined) c.gstEnabled = true;
      if (!c.surabhiDesignSlab) c.surabhiDesignSlab = 'auto';
      return this.project.commercialCharges;
    },

    getSurabhiWoodworkSubtotal: function () {
      if (!this.project) return 0;
      try {
        var baseRateCard = (this.project && this.project.rateCard) || (typeof Core !== 'undefined' ? Core.DEFAULT_RATE_CARD : {});
        var surabhiRateCard = Object.assign({}, baseRateCard, { selectedTier: 'SURABHI', roomTiers: {} });
        var surabhiProj = {
          plan: this.project.plan || this.project,
          rateCard: surabhiRateCard
        };
        var q = (typeof Core !== 'undefined' && Core.generateFullQuotation)
          ? Core.generateFullQuotation(surabhiProj, this.selectedBOQRooms || ['all'])
          : null;
        return q && q.subtotalWoodwork ? q.subtotalWoodwork : 0;
      } catch (_) {
        return 0;
      }
    },

    computeCommercialSummary: function (woodworkSubtotal, commCharges) {
      var charges = commCharges || this.getCommercialCharges();
      var accessoriesEnabled = charges.accessoriesEnabled !== false;
      var appliancesEnabled = charges.appliancesEnabled !== false;
      var freightEnabled = charges.freightEnabled !== false;
      var gstEnabled = charges.gstEnabled !== false;

      var addAccessories = accessoriesEnabled ? (parseFloat(charges.additionalAccessories || charges.accessories) || 0) : 0;
      var appliances = appliancesEnabled ? (parseFloat(charges.appliances) || 0) : 0;

      // Elegant Surabhi Costing Benchmark & Slab Lookup
      var slabId = charges.surabhiDesignSlab || 'auto';
      var surabhiWoodwork = (charges.surabhiWoodworkSubtotal !== undefined)
        ? Number(charges.surabhiWoodworkSubtotal)
        : (this.getSurabhiWoodworkSubtotal ? this.getSurabhiWoodworkSubtotal() : woodworkSubtotal);
      if (!surabhiWoodwork || isNaN(surabhiWoodwork)) surabhiWoodwork = woodworkSubtotal;

      var activeSlab = (typeof Core !== 'undefined' && Core.getSurabhiDesignFeeSlab)
        ? Core.getSurabhiDesignFeeSlab(surabhiWoodwork, slabId)
        : null;

      var designPercent = 9;
      var designAmount = 0;
      var adpPercent = 0;
      var adpAmount = 0;

      if (activeSlab && slabId !== 'custom') {
        designAmount = activeSlab.fullDesignCharges;
        adpPercent = activeSlab.discountPercent || 60;
        adpAmount = Math.round(designAmount * (adpPercent / 100));
        designPercent = (woodworkSubtotal > 0) ? (Math.round((designAmount / woodworkSubtotal) * 1000) / 10) : 9;
      } else {
        designPercent = (charges.designPercent !== undefined && charges.designPercent !== null && charges.designPercent !== '') ? parseFloat(charges.designPercent) : 9;
        if (isNaN(designPercent)) designPercent = 9;
        designAmount = Math.round(woodworkSubtotal * (designPercent / 100));

        adpPercent = parseFloat(charges.adpPercent || charges.adp) || 0;
        adpAmount = Math.round(designAmount * (adpPercent / 100));
      }

      var freightPercent = (charges.freightPercent !== undefined && charges.freightPercent !== null && charges.freightPercent !== '') ? parseFloat(charges.freightPercent) : 2.5;
      if (isNaN(freightPercent)) freightPercent = 2.5;
      var freightAmount = freightEnabled ? Math.round(woodworkSubtotal * (freightPercent / 100)) : 0;

      var discountPercent = parseFloat(charges.discountPercent || charges.discount) || 0;
      var discountAmount = Math.round(woodworkSubtotal * (discountPercent / 100));

      var totalDeductions = discountAmount + adpAmount;
      var grossAdditions = designAmount + freightAmount;

      // Core proposal total (excludes Add-ons / Accessories & Appliances so they do not affect Final Discounted Value)
      var coreNetBeforeTax = Math.max(0, Math.round(woodworkSubtotal + grossAdditions - totalDeductions));
      var gstPercent = (charges.gstPercent !== undefined && charges.gstPercent !== null && charges.gstPercent !== '') ? parseFloat(charges.gstPercent) : 18;
      if (isNaN(gstPercent)) gstPercent = 18;
      var coreGstAmount = gstEnabled ? Math.round(coreNetBeforeTax * (gstPercent / 100)) : 0;
      var coreGrandTotal = coreNetBeforeTax + coreGstAmount;

      var selectedAddons = Array.isArray(charges.selectedAddons) ? charges.selectedAddons : [];
      var appliancesList = Array.isArray(charges.appliancesList) ? charges.appliancesList : [];
      var addonsTotal = addAccessories + appliances;
      var totalInvestmentWithAddons = coreGrandTotal + addonsTotal;

      var netValue = coreNetBeforeTax;
      var gstAmount = coreGstAmount;
      var grandTotal = coreGrandTotal;

      return {
        woodworkSubtotal: Math.round(woodworkSubtotal),
        surabhiWoodworkSubtotal: Math.round(surabhiWoodwork),
        surabhiDesignSlab: slabId,
        activeSlab: activeSlab,
        accessoriesEnabled: accessoriesEnabled,
        additionalAccessories: addAccessories,
        appliancesEnabled: appliancesEnabled,
        appliances: appliances,
        selectedAddons: selectedAddons,
        appliancesList: appliancesList,
        addonsTotal: addonsTotal,
        totalInvestmentWithAddons: totalInvestmentWithAddons,
        coreNetBeforeTax: coreNetBeforeTax,
        coreGrandTotal: coreGrandTotal,
        designPercent: designPercent,
        designAmount: designAmount,
        freightEnabled: freightEnabled,
        freightPercent: freightPercent,
        freightAmount: freightAmount,
        loadingUnloadingStatus: charges.loadingUnloadingStatus || 'Additional',
        floorMatStatus: charges.floorMatStatus || 'Not Included in Quote',
        civilWorksStatus: charges.civilWorksStatus || 'As per actuals',
        electricalPlumbingStatus: charges.electricalPlumbingStatus || 'Additional',
        falseCeilingStatus: charges.falseCeilingStatus || 'Not Included',
        wallpaperStatus: charges.wallpaperStatus || 'Complementary',
        discountPercent: discountPercent,
        discountAmount: discountAmount,
        adpPercent: adpPercent,
        adpAmount: adpAmount,
        totalSavings: totalDeductions,
        grossAdditions: grossAdditions,
        totalDeductions: totalDeductions,
        netValue: netValue,
        netTaxable: netValue,
        gstEnabled: gstEnabled,
        gstPercent: gstPercent,
        gstAmount: gstAmount,
        grandTotal: grandTotal
      };
    },

    renderBOQ: function (force) {
      var boqView = document.getElementById('view-boq');
      var isBoqActive = boqView && boqView.classList.contains('is-on');
      if (!isBoqActive && !force) {
        this._boqDirty = true;
        return;
      }
      this._boqDirty = false;
      var boqEl = document.getElementById('orbixBOQTable');
      if (!boqEl) return;

      this.project = this.project || (this.editor && this.editor.project) || (typeof Core !== 'undefined' ? Core.createProject('New Project') : { plan: { furniture: [], walls: [], rooms: [] } });
      this.sync3DStudioUnits();
      if (!this.selectedBOQRooms) {
        this.selectedBOQRooms = ['all'];
      }
      if (!this.selectedBOQFloor) {
        this.selectedBOQFloor = 'all';
      }

      var quote = Core.generateFullQuotation(this.project, this.selectedBOQRooms, this.selectedBOQFloor);
      var sym = quote.currencySymbol;
      var rateCard = (this.project && this.project.rateCard) || Core.DEFAULT_RATE_CARD;
      var self = this;
      var commCharges = this.getCommercialCharges();
      var commSummary = this.computeCommercialSummary(quote.subtotalWoodwork, commCharges);

      if (!rateCard.selectedTier) {
        rateCard.selectedTier = 'zappo - el pearl';
        this.project.rateCard = rateCard;
      }
      var currentTier = (Core.normalizeTierName ? Core.normalizeTierName(rateCard.selectedTier) : rateCard.selectedTier) || 'zappo - el pearl';
      var tiers = Core.PRICE_TIERS || [];

      var html = '<div class="boq-sheet">' +
        '<div class="boq-actions no-print">' +
        '<button class="btn" id="boqXlsxBtn" style="background:#107C41;color:#fff;border-color:#107C41;font-weight:600">📊 Download Excel (.xlsx)</button>' +
        '<button class="btn" id="boqShareQuoteBtn" style="background:linear-gradient(135deg,#D90429,#9F021E);color:#fff;border-color:#9F021E;font-weight:700">🔐 Share Client Quote</button>' +
        '<button class="btn" id="boqEditDetailsBtn" style="font-weight:600;border-color:#2563EB;color:#2563EB">✏️ Edit Client Details</button>' +
        '<button class="btn" id="boqLockVersionBtn">Issue Quotation Snapshot</button>' +
        '<button class="btn" id="boqToggleRateCardBtn">Configure Company Rates</button>' +
        '</div>';

      // ── FLOOR PRICING SCOPE & FILTER BAR ──
      var allFloors = quote.allFloorsSummary || [];
      var isAllFloors = (!this.selectedBOQFloor || this.selectedBOQFloor === 'all');
      var totalFloorsWoodwork = allFloors.reduce(function (acc, f) { return acc + (f.woodworkSubtotal || 0); }, 0);
      var totalFloorsUnits = allFloors.reduce(function (acc, f) { return acc + (f.itemCount || 0); }, 0);

      html += '<div class="boq-floor-filter-bar no-print" style="margin-bottom:12px;padding:10px 14px;background:#F1F5F9;border:1px solid #CBD5E1;border-radius:6px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">' +
        '<div class="boq-floor-filter-label" style="font-size:13px;font-weight:700;color:#0F172A;display:flex;align-items:center;gap:6px;">' +
        '<span class="floor-icon">🏢</span> <b>Floor Pricing Scope:</b>' +
        '</div>' +
        '<div class="floor-pill-group" style="display:flex;gap:8px;flex-wrap:wrap;">' +
        '<button class="btn small floor-filter-pill' + (isAllFloors ? ' primary' : '') + '" data-floor="all" style="font-weight:700;padding:5px 12px;border-radius:20px;' + (isAllFloors ? 'background:#08231B;color:#FFF;' : 'background:#FFF;color:#334155;border:1px solid #CBD5E1;') + '">' +
        '🏛️ All Floors (Total Home) <span style="margin-left:6px;font-size:11px;opacity:0.85;padding:1px 6px;border-radius:10px;background:' + (isAllFloors ? '#1E3A8A' : '#E2E8F0') + ';color:' + (isAllFloors ? '#FFF' : '#0F172A') + '">' + totalFloorsUnits + ' units · ₹ ' + Math.round(totalFloorsWoodwork).toLocaleString('en-IN') + '</span>' +
        '</button>';

      for (var flIdx = 0; flIdx < allFloors.length; flIdx++) {
        var fObj = allFloors[flIdx];
        var isThisFloorActive = !isAllFloors && self.selectedBOQFloor === fObj.id;
        html += '<button class="btn small floor-filter-pill' + (isThisFloorActive ? ' primary' : '') + '" data-floor="' + fObj.id + '" style="font-weight:700;padding:5px 12px;border-radius:20px;' + (isThisFloorActive ? 'background:#08231B;color:#FFF;' : 'background:#FFF;color:#334155;border:1px solid #CBD5E1;') + '">' +
          '🏢 ' + fObj.name + ' <span style="margin-left:6px;font-size:11px;opacity:0.85;padding:1px 6px;border-radius:10px;background:' + (isThisFloorActive ? '#1E3A8A' : '#E2E8F0') + ';color:' + (isThisFloorActive ? '#FFF' : '#0F172A') + '">' + fObj.itemCount + ' units · ₹ ' + Math.round(fObj.woodworkSubtotal).toLocaleString('en-IN') + '</span>' +
          '</button>';
      }
      html += '</div></div>';

      // ── FLOOR-WISE PURE MODULAR WOODWORK BREAKDOWN TABLE ──
      if (allFloors.length > 0) {
        html += '<div class="boq-floor-summary-card no-print" style="margin-bottom:16px;padding:14px 18px;background:#FFFFFF;border:1px solid #CBD5E1;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px;">' +
          '<h4 style="margin:0;font-size:14px;font-weight:800;color:#0F172A;text-transform:uppercase;letter-spacing:0.04em;">🏢 Floor-Wise Pure Modular Woodwork Breakdown</h4>' +
          '<span style="font-size:11px;font-weight:700;color:#16A34A;background:#DCFCE7;padding:3px 8px;border-radius:4px;">100% Pure Cabinetry (Zero Civil Work)</span>' +
          '</div>' +
          '<div style="overflow-x:auto;">' +
          '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
          '<thead><tr style="background:#F8FAFC;border-bottom:2px solid #CBD5E1;text-align:left;">' +
          '<th style="padding:8px 12px;">Floor Level</th>' +
          '<th style="padding:8px 12px;text-align:center;">Cabinet Units</th>' +
          '<th style="padding:8px 12px;text-align:right;">Modular Woodwork Total</th>' +
          '<th style="padding:8px 12px;text-align:center;">% Share</th>' +
          '<th style="padding:8px 12px;text-align:center;">Scope Filter</th>' +
          '</tr></thead><tbody>';

        for (var fls = 0; fls < allFloors.length; fls++) {
          var fRow = allFloors[fls];
          var isRowActive = !isAllFloors && self.selectedBOQFloor === fRow.id;
          html += '<tr style="border-bottom:1px solid #E2E8F0;' + (isRowActive ? 'background:#EFF6FF;' : '') + '">' +
            '<td style="padding:8px 12px;font-weight:700;color:#0F172A;">🏢 ' + fRow.name + '</td>' +
            '<td style="padding:8px 12px;text-align:center;font-weight:600;color:#475569;">' + fRow.itemCount + ' units</td>' +
            '<td style="padding:8px 12px;text-align:right;font-family:var(--mono);font-weight:700;color:#1E3A8A;">₹ ' + Math.round(fRow.woodworkSubtotal).toLocaleString('en-IN') + '.00</td>' +
            '<td style="padding:8px 12px;text-align:center;font-weight:700;color:#16A34A;">' + fRow.percentShare + '%</td>' +
            '<td style="padding:8px 12px;text-align:center;">' +
            '<button class="btn small floor-filter-pill" data-floor="' + fRow.id + '" style="font-size:11px;padding:3px 8px;' + (isRowActive ? 'background:#2563EB;color:#FFF;' : '') + '">' +
            (isRowActive ? '✓ Active' : 'Filter Floor') +
            '</button>' +
            '</td>' +
            '</tr>';
        }

        html += '<tr style="background:#F1F5F9;font-weight:800;border-top:2px solid #0F172A;">' +
          '<td style="padding:10px 12px;color:#0F172A;">🏛️ Entire Residence (Combined Total)</td>' +
          '<td style="padding:10px 12px;text-align:center;">' + totalFloorsUnits + ' units</td>' +
          '<td style="padding:10px 12px;text-align:right;font-family:var(--mono);color:#08231B;">₹ ' + Math.round(totalFloorsWoodwork).toLocaleString('en-IN') + '.00</td>' +
          '<td style="padding:10px 12px;text-align:center;color:#16A34A;">100%</td>' +
          '<td style="padding:10px 12px;text-align:center;">' +
          '<button class="btn small floor-filter-pill" data-floor="all" style="font-size:11px;padding:3px 8px;' + (isAllFloors ? 'background:#08231B;color:#FFF;' : '') + '">View All</button>' +
          '</td>' +
          '</tr></tbody></table></div></div>';
      }

      // ── Room Scope & Filter Bar ──
      html += '<div class="boq-room-filter-bar no-print">' +
        '<div class="boq-room-filter-label"><span class="room-icon">🏠</span> <b>Room Pricing Scope:</b></div>' +
        '<div class="room-pill-group">';

      var isAllRooms = (!this.selectedBOQRooms || this.selectedBOQRooms.indexOf('all') !== -1);
      var totalProjectUnits = quote.allRoomsSummary ? quote.allRoomsSummary.reduce(function (acc, item) { return acc + item.itemCount; }, 0) : quote.furnitureItems.length;

      html += '<button class="room-filter-pill' + (isAllRooms ? ' is-active' : '') + '" data-room="all">' +
        '✨ All Rooms <span class="room-pill-badge">' + totalProjectUnits + ' units</span>' +
        '</button>';

      var projectRooms = (this.project.plan && this.project.plan.rooms) || [];
      for (var prm = 0; prm < projectRooms.length; prm++) {
        var rObj = projectRooms[prm];
        var isThisRoomActive = !isAllRooms && self.selectedBOQRooms.indexOf(rObj.id) !== -1;
        var rSummary = (quote.allRoomsSummary || []).filter(function (s) { return s.id === rObj.id; })[0];
        var rUnitsCount = rSummary ? rSummary.itemCount : 0;
        var rSubtotalStr = rSummary && rSummary.roomSubtotal > 0 ? (' · ₹' + Math.round(rSummary.roomSubtotal).toLocaleString('en-IN')) : '';

        var rIcon = rObj.name.indexOf('Bed') !== -1 ? '🛏️ ' :
                    rObj.name.indexOf('Kitchen') !== -1 ? '🍳 ' :
                    rObj.name.indexOf('Living') !== -1 ? '🛋️ ' :
                    rObj.name.indexOf('Dining') !== -1 ? '🍽️ ' :
                    (rObj.name.indexOf('Pooja') !== -1 || rObj.name.indexOf('Prayer') !== -1) ? '🪔 ' :
                    (rObj.name.indexOf('Toilet') !== -1 || rObj.name.indexOf('Bath') !== -1) ? '🚿 ' :
                    (rObj.name.indexOf('Dress') !== -1 || rObj.name.indexOf('Wardrobe') !== -1) ? '👔 ' :
                    (rObj.name.indexOf('Store') !== -1 || rObj.name.indexOf('Pantry') !== -1) ? '📦 ' :
                    (rObj.name.indexOf('Sitout') !== -1 || rObj.name.indexOf('Balcony') !== -1) ? '🌿 ' : '🚪 ';

        html += '<button class="room-filter-pill' + (isThisRoomActive ? ' is-active' : '') + '" data-room="' + rObj.id + '">' +
          rIcon + rObj.name + ' <span class="room-pill-badge">' + rUnitsCount + ' units' + rSubtotalStr + '</span>' +
          '</button>';
      }

      var genSummary = (quote.allRoomsSummary || []).filter(function (s) { return s.id === '_general'; })[0];
      if (genSummary && genSummary.itemCount > 0) {
        var isGenActive = !isAllRooms && self.selectedBOQRooms.indexOf('_general') !== -1;
        html += '<button class="room-filter-pill' + (isGenActive ? ' is-active' : '') + '" data-room="_general">' +
          '📦 General / Unassigned <span class="room-pill-badge">' + genSummary.itemCount + ' units</span>' +
          '</button>';
      }

      html += '</div></div>' +

        // ── Room-Wise Cost Contribution & Breakdown Cards ──
        (quote.allRoomsSummary && quote.allRoomsSummary.length > 0 ? (
          '<div class="boq-room-summary-card no-print">' +
          '<div class="boq-room-card-head">' +
          '<h4>🏠 Room-Wise Cost Contribution & Area Breakdown</h4>' +
          '<span class="boq-room-badge">' + (quote.isFiltered ? ('Filtered: ' + self.selectedBOQRooms.length + ' room(s) selected') : 'Full Home Scope') + '</span>' +
          '</div>' +
          '<div class="boq-room-grid">' +
          quote.allRoomsSummary.map(function (rs) {
            var isCardSelected = (!quote.isFiltered) || (self.selectedBOQRooms && self.selectedBOQRooms.indexOf(rs.id) !== -1);
            var rsTier = rs.variant || (rateCard.roomTiers && rateCard.roomTiers[rs.id]) || currentTier;
            return '<div class="boq-room-stat-card' + (isCardSelected ? ' is-selected' : '') + '">' +
              '<div class="boq-room-stat-title">' + rs.name + '</div>' +
              '<div class="boq-room-stat-area">' + (rs.areaSqFt > 0 ? (Math.round(rs.areaSqFt) + ' sq ft (' + (rs.areaSqM != null ? rs.areaSqM.toFixed(1) : '0.0') + ' m²)') : 'Modular Units Only') + '</div>' +
              '<div class="boq-room-stat-cost">₹ ' + Math.round(rs.roomSubtotal).toLocaleString('en-IN') + '.00</div>' +
              '<div class="boq-room-stat-items">' + rs.itemCount + ' unit' + (rs.itemCount === 1 ? '' : 's') + ' · ' + rs.percentShare + '% share</div>' +
              '<div style="display:flex;align-items:center;justify-content:space-between;margin:6px 0 4px 0;gap:4px;">' +
              '<span style="font-size:10px;color:#64748B;font-weight:700;text-transform:uppercase;">Variant:</span>' +
              '<select class="room-tier-select no-print" data-room-id="' + rs.id + '" style="font-size:11px;font-weight:700;padding:2px 4px;border-radius:4px;border:1px solid #CBD5E1;background:#FFFFFF;color:#1E3A8A;cursor:pointer;flex:1;">' +
              tiers.map(function (t) { return '<option value="' + t + '"' + (rsTier === t ? ' selected' : '') + '>' + t + '</option>'; }).join('') +
              '</select>' +
              '</div>' +
              '<div class="boq-room-bar"><div class="boq-room-bar-fill" style="width:' + Math.min(100, Math.max(5, rs.percentShare)) + '%"></div></div>' +
              '<button class="btn small boq-room-select-btn" data-room="' + rs.id + '" style="margin-top:6px;width:100%;font-size:11px;padding:3px 6px;">' +
              (isCardSelected && quote.isFiltered ? '✓ Active in Quote' : 'Filter this Room') +
              '</button>' +
              '</div>';
          }).join('') +
          '</div></div>'
        ) : '') +

        // ── Finish Tier Selector Bar ──
        '<div class="boq-tier-bar no-print">' +
        '<div class="boq-tier-label"><span class="tier-icon">🏷️</span> <b>Global Price Variant &amp; Finish Tier:</b></div>' +
        '<div class="tier-pill-group">';

      for (var t = 0; t < tiers.length; t++) {
        var tr = tiers[t];
        html += '<button class="tier-pill' + (currentTier === tr ? ' is-active' : '') + '" data-tier="' + tr + '">' + tr + '</button>';
      }

      html += '</div>' +
        '<button class="btn small" id="boqViewMatrixBtn" style="margin-left:auto">📊 12×9 Rate Matrix</button>' +
        '</div>' +

        '<div class="rate-card-drawer" id="rateCardDrawer" style="display:none;margin-bottom:24px;padding:16px;background:#F6F5F2;border:1px solid var(--rule);border-radius:4px">' +
        '<h4 style="font-family:var(--cond);font-size:14px;font-weight:600;text-transform:uppercase;color:var(--blue);margin-bottom:12px">Company Pricing & Rate Card Configuration</h4>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">' +
        '<div class="insp-row"><label>Wardrobe (₹/SFT)</label><input type="number" id="rc_wardrobe" value="' + (rateCard.categories.wardrobe.baseRatePerSft || 1700) + '"></div>' +
        '<div class="insp-row"><label>Loft (₹/SFT)</label><input type="number" id="rc_loft" value="' + (rateCard.categories.wardrobe.loftRatePerSft || 1450) + '"></div>' +
        '<div class="insp-row"><label>Kitchen Base (₹/Rft)</label><input type="number" id="rc_kbase" value="' + (rateCard.categories.kitchen_base.baseRatePerRft || 2800) + '"></div>' +
        '<div class="insp-row"><label>Kitchen Wall (₹/Rft)</label><input type="number" id="rc_kwall" value="' + (rateCard.categories.kitchen_wall.baseRatePerRft || 2100) + '"></div>' +
        '<div class="insp-row"><label>TV Media Wall (₹/SFT)</label><input type="number" id="rc_tv" value="' + (rateCard.categories.tv_unit.baseRatePerSft || 1650) + '"></div>' +
        '<div class="insp-row"><label>Flooring (₹/SFT)</label><input type="number" id="rc_floor" value="' + (rateCard.categories.flooring.baseRatePerSft || 140) + '"></div>' +
        '<div class="insp-row"><label>Installation (₹/SFT)</label><input type="number" id="rc_install" value="' + (rateCard.laborRates && rateCard.laborRates.installationPerSft !== undefined ? rateCard.laborRates.installationPerSft : 0) + '"></div>' +
        '<div class="insp-row"><label>Company Margin (%)</label><input type="number" id="rc_margin" value="' + (rateCard.marginPercent || 15) + '"></div>' +
        '<div class="insp-row"><label>GST (%)</label><input type="number" id="rc_gst" value="' + (rateCard.gstPercent || 18) + '"></div>' +
        '</div>' +
        '<button class="btn primary" id="rc_saveBtn" style="margin-top:12px">Update Rates & Recalculate</button>' +

        '<div class="matrix-card" id="fullMatrixCard" style="display:none;margin-top:20px;overflow-x:auto">' +
        '<h5 style="font-family:var(--cond);font-size:13px;text-transform:uppercase;color:var(--blue);margin-bottom:8px">Factory Price Variants Matrix — Click any column to apply tier</h5>' +
        '<table class="matrix-table"><thead><tr><th>Model / Item Type</th>';
      for (var th = 0; th < tiers.length; th++) {
        var isHCol = (currentTier === tiers[th]);
        html += '<th class="' + (isHCol ? 'tier-col-active' : '') + '"><button class="matrix-th-btn' + (isHCol ? ' is-active' : '') + '" data-tier="' + tiers[th] + '">' + tiers[th] + '</button></th>';
      }
      html += '</tr></thead><tbody>';
      var mRates = Core.MODEL_RATES_MATRIX || {};
      for (var mKey in mRates) {
        var mDef = mRates[mKey];
        html += '<tr><td><b>' + mDef.label + '</b></td>';
        for (var tc = 0; tc < tiers.length; tc++) {
          var trName = tiers[tc];
          var isCol = (currentTier === trName);
          html += '<td class="r' + (isCol ? ' tier-col-active' : '') + '">₹ ' + (mDef.rates[trName] || '-') + '</td>';
        }
        html += '</tr>';
      }
      html += '</tbody></table></div>' +
        '</div>' +

        '<div class="quote-sheet-single">';

      // Format clean Quotation Date
      var formattedDate = self.formatDisplayDate(this.project.meta && (this.project.meta.dateTime || this.project.meta.dateCreated), true);
      if (!formattedDate) formattedDate = '05-Nov-2026 23:36';

      var meta = this.project.meta || {};
      var clientDisp = meta.clientName || 'Client';
      var contactDisp = meta.phone || meta.contactNumber || '—';
      var locDisp = meta.siteAddress || meta.siteLocation || meta.location || '—';
      var bhDisp = meta.bhName || meta.designerName || 'Designer';
      var cpDisp = meta.cpCode || meta.quoteId || (this.project.id ? 'CP-' + String(this.project.id).slice(-4).toUpperCase() : 'CP-REF');

      html += '<div class="quote-header-split">' +
        '<div class="qh-left">' +
        '<div class="qh-row"><span class="qh-lbl">CP Code / Quote Ref</span><span class="qh-val bold" style="color:#2563EB;">' + cpDisp + '</span></div>' +
        '<div class="qh-row"><span class="qh-lbl">Client Name</span><span class="qh-val bold">' + clientDisp + '</span></div>' +
        '<div class="qh-row"><span class="qh-lbl">Contact Number</span><span class="qh-val">' + contactDisp + '</span></div>' +
        '<div class="qh-row"><span class="qh-lbl">Location</span><span class="qh-val">' + locDisp + '</span></div>' +
        '<div class="qh-row"><span class="qh-lbl">BH Name</span><span class="qh-val">' + bhDisp + '</span></div>' +
        '<div class="qh-row"><span class="qh-lbl">Scope</span><span class="qh-val">' + (quote.isFiltered ? ('Selected Rooms: ' + quote.furnitureItems.map(function (it) { return it.roomName; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(', ')) : (meta.scope || 'All Rooms (Entire Home)')) + '</span></div>' +
        '</div>' +
        '<div class="qh-right">' +
        '<div class="qh-row"><span class="qh-lbl">Quotation Date</span><span class="qh-val">' + formattedDate + '</span></div>' +
        '<div class="qh-row"><span class="qh-lbl">Status</span><span class="qh-val" style="color:#16A34A;font-weight:700;">' + (meta.status || 'Approved Estimate') + '</span></div>' +
        '<div class="qh-row"><span class="qh-lbl">Price Variant</span><span class="qh-val bold" id="boqHeaderVariant" style="color:#2563EB;font-weight:700;">' + currentTier + '</span></div>' +
        '<div class="qh-row"><span class="qh-lbl">Total No. of Items</span><span class="qh-val">' + quote.furnitureItems.length + (quote.isFiltered ? ' (Filtered Scope)' : '') + '</span></div>' +
        '<div class="qh-row total"><span class="qh-lbl">Total Amount</span><span class="qh-val" id="boqHeaderTotalAmount">INR ' + commSummary.grandTotal.toLocaleString('en-IN') + '.00</span></div>' +
        '</div>' +
        '</div>' +

        '<table class="quote-page-table">' +
        '<thead>' +
        '<tr>' +
        '<th style="width:40px;text-align:center">Sr. No</th>' +
        '<th style="width:70px;text-align:center">Reference</th>' +
        '<th style="width:70px;text-align:center">Preview</th>' +
        '<th style="min-width:140px">Item</th>' +
        '<th style="min-width:110px">Dimensions<br>(mm)</th>' +
        '<th style="width:80px;text-align:center">Category</th>' +
        '<th style="min-width:170px">Finishes</th>' +
        '<th style="min-width:100px">Accessories</th>' +
        '<th style="width:90px;text-align:right">Unit Price<br>(INR)</th>' +
        '<th style="width:90px;text-align:right">Quantity</th>' +
        '<th style="width:100px;text-align:right">Price<br>(INR)</th>' +
        '</tr>' +
        '<tr class="sec-bar-row"><td colspan="11"><b>Products &amp; Modular Woodwork (' + (quote.isFiltered ? 'Filtered Room Selection' : 'All Rooms') + ')</b></td></tr>' +
        '</thead>' +
        '<tbody>';

      if (quote.furnitureItems.length === 0) {
        html += '<tr><td colspan="11" style="text-align:center;padding:32px 16px;color:#64748B;font-size:13px;">' +
          'No modular furniture units placed in the currently selected room scope. ' +
          '<button class="btn small" style="margin-left:8px;" id="boqResetFilterBtn">Show All Rooms</button>' +
          '</td></tr>';
      } else {
        // Group items by Room Name
        var itemsByRoom = {};
        var roomNamesOrder = [];
        for (var f = 0; f < quote.furnitureItems.length; f++) {
          var it = quote.furnitureItems[f];
          var rmName = it.roomName || 'General';
          if (!itemsByRoom[rmName]) {
            itemsByRoom[rmName] = [];
            roomNamesOrder.push(rmName);
          }
          itemsByRoom[rmName].push(it);
        }

        var globalItemIndex = 0;
        for (var rOrd = 0; rOrd < roomNamesOrder.length; rOrd++) {
          var rName = roomNamesOrder[rOrd];
          var rItems = itemsByRoom[rName];
          var rSubtotal = 0;
          for (var ri = 0; ri < rItems.length; ri++) {
            rSubtotal += rItems[ri].totalAmount;
          }

          var rFound = (self.project.plan.rooms || []).filter(function (rm) { return rm.name === rName || rm.id === (rItems[0] && rItems[0].roomId); })[0];
          var rAreaStr = rFound && rFound.areaSqFt > 0 ? (Math.round(rFound.areaSqFt) + ' sq ft · ' + (rFound.areaSqM != null ? rFound.areaSqM.toFixed(1) : '0.0') + ' m²') : '';
          var rRoomId = (rFound ? rFound.id : (rItems[0] && rItems[0].roomId) || '_general');
          var rActiveTier = (rateCard.roomTiers && rateCard.roomTiers[rRoomId]) || (rFound && rFound.variant) || currentTier;

          html += '<tr class="room-sec-row"><td colspan="11">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">' +
            '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
            '<span style="font-size:15px">🏠</span><b>Room: ' + rName + '</b>' +
            (rItems[0] && rItems[0].floorName ? (' &nbsp;<span style="background:#E2E8F0;color:#0F172A;font-size:11px;font-weight:700;padding:2px 7px;border-radius:4px;">🏢 ' + rItems[0].floorName + '</span>') : '') +
            (rAreaStr ? (' &nbsp;<span style="color:#64748B;font-size:11px">(' + rAreaStr + ')</span>') : '') +
            ' &nbsp;·&nbsp; <span style="color:#2563EB;font-weight:600">' + rItems.length + ' Unit' + (rItems.length === 1 ? '' : 's') + '</span>' +
            ' &nbsp;·&nbsp; <span style="font-size:12px;color:#475569;font-weight:600;">Variant:</span>' +
            '<select class="room-tier-select no-print" data-room-id="' + rRoomId + '" style="font-size:11px;font-weight:700;padding:2px 6px;border-radius:4px;border:1px solid #CBD5E1;background:#FFFFFF;color:#1E3A8A;cursor:pointer;">' +
            tiers.map(function (t) {
              return '<option value="' + t + '"' + (rActiveTier === t ? ' selected' : '') + '>' + t + '</option>';
            }).join('') +
            '</select>' +
            '</div>' +
            '<div>Room Subtotal: <b style="font-family:var(--mono);color:#1E3A8A">₹ ' + Math.round(rSubtotal).toLocaleString('en-IN') + '.00</b></div>' +
            '</div></td></tr>';

          for (var fItem = 0; fItem < rItems.length; fItem++) {
            var item = rItems[fItem];
            globalItemIndex++;
            var d = item.dimensions || { W: 1200, H: 2100, D: 600 };
            var codePrefix = item.category === 'wardrobe' ? 'W' : item.category.indexOf('kitchen') !== -1 ? 'K' : item.category.indexOf('bed') !== -1 ? 'B' : item.category === 'tv_unit' ? 'TV' : 'U';
            var refCode = item.refCode || ('C' + (12 + globalItemIndex));
            var svgThumb = self.getUnitSVG(item);

            var smat = (item.materials && item.materials.shutter) ? item.materials.shutter : { material: 'HDHMR_18MM', finish: 'Brazilian Horizontal Walnut' };
            var cmat = (item.materials && item.materials.carcass) ? item.materials.carcass : { material: 'BWP_18MM', finish: 'Absolute White' };

            html += '<tr>' +
              '<td class="c-center">' + globalItemIndex + '</td>' +
              '<td class="c-center bold">' + refCode + '</td>' +
              '<td class="c-center p-0">' + svgThumb + '</td>' +
              '<td>' +
              '<div class="item-name">' + item.name + '</div>' +
              (item.floorName ? ('<div style="font-size:11px;font-weight:700;color:#2563EB;margin:1px 0;">🏢 ' + item.floorName + '</div>') : '') +
              '<div class="item-sub">Group: ' + (item.modelLabel || item.modelType || 'WR 2 DOOR SHELF') + '</div>' +
              '<div class="item-sub">Model: ' + item.name + '</div>' +
              '</td>' +
              '<td class="dim-cell">' +
              '<div>Width: ' + d.W + '</div>' +
              '<div>Depth: ' + d.D + '</div>' +
              '<div>Height: ' + d.H + '</div>' +
              '</td>' +
              '<td class="c-center">' + (item.categoryName || 'Wardrobe') + '</td>' +
              '<td class="fin-cell">' +
              '<div class="fin-block">' +
              '<div class="fin-title">Shutter</div>' +
              '<div>Material : ' + smat.material + '</div>' +
              '<div>Finish : ' + smat.finish + '</div>' +
              '</div>' +
              '<div class="fin-block" style="margin-top:4px">' +
              '<div class="fin-title">Carcass</div>' +
              '<div>Material : ' + cmat.material + '</div>' +
              '<div>Finish : ' + cmat.finish + '</div>' +
              '</div>' +
              '</td>' +
              '<td class="acc-cell">' +
              '<div>Auto Soft-Close Hinges</div>' +
              '<div>Cam Connectors</div>' +
              '</td>' +
              '<td class="c-num">' + (item.baseRate != null ? item.baseRate.toLocaleString('en-IN') : '0') + '</td>' +
              '<td class="c-num">' + (item.areaSft != null ? item.areaSft.toFixed(2) : '0.00') + ' sq foot</td>' +
              '<td class="c-num bold">' + Math.round(item.totalAmount || 0).toLocaleString('en-IN') + '.00</td>' +
              '</tr>';
          }
        }
      }

      html += '<tr class="subtotal-bar"><td colspan="10" style="text-align:right;padding-right:12px;font-weight:700">SUBTOTAL PRODUCTS (' + (quote.isFiltered ? 'SELECTED SCOPE' : 'ALL ROOMS') + ')</td><td class="c-num bold">' + Math.round(quote.subtotalWoodwork).toLocaleString('en-IN') + '.00</td></tr>';

      // Dynamic Hardware Calculation based on actual placed units
      var totalHinges = 0;
      var totalDrawers = 0;
      var totalHandles = 0;
      var totalWardrobeRails = 0;
      var totalLocks = 0;

      for (var fi = 0; fi < quote.furnitureItems.length; fi++) {
        var uItem = quote.furnitureItems[fi];
        var uCfg = uItem.unitConfig || {};
        var uDims = uItem.dimensions || {};
        var isWardrobe = (uItem.category === 'wardrobe');
        var isSliding = (uItem.modelType === 'wr_sliding' || (uItem.name && uItem.name.toLowerCase().indexOf('sliding') !== -1));

        var numShutters = (uCfg.shutters !== undefined) ? uCfg.shutters : 1;
        var numDrawers = uCfg.drawers || 0;

        if (!isSliding && numShutters > 0) {
          // 2 hinges per shutter door (3 if height > 1500mm, 4 if > 2100mm)
          var hPerShutter = (uDims.H > 2100) ? 4 : (uDims.H > 1500) ? 3 : 2;
          totalHinges += numShutters * hPerShutter;
        }

        totalDrawers += numDrawers;
        totalHandles += (numShutters + numDrawers);

        if (isWardrobe) {
          totalWardrobeRails += Math.max(1, Math.round((uDims.W || 1200) / 900));
          if (numDrawers > 0) totalLocks += 1;
        }
      }

      var hwItems = [];
      if (totalHinges > 0) {
        hwItems.push({ code: 'H-01', name: 'Auto Soft-Close Hinges', spec: 'Stainless Steel 304', qty: totalHinges, unit: 'nos', rate: 0, type: 'hinge' });
      }
      if (totalDrawers > 0) {
        hwItems.push({ code: 'H-02', name: 'Telescopic Drawer Channels', spec: 'Triple Extension Heavy-Duty', qty: totalDrawers, unit: 'pair', rate: 0, type: 'runner' });
      }
      if (totalHandles > 0) {
        hwItems.push({ code: 'H-03', name: 'Designer Edge Profile Handles', spec: 'Matte Charcoal Aluminum', qty: totalHandles, unit: 'nos', rate: 0, type: 'handle' });
      }
      if (totalWardrobeRails > 0) {
        hwItems.push({ code: 'H-04', name: 'Wardrobe Hanging Oval Rails', spec: 'Chrome Plated Oval Rail', qty: totalWardrobeRails, unit: 'nos', rate: 0, type: 'rod' });
      }
      if (totalLocks > 0) {
        hwItems.push({ code: 'H-05', name: 'Precision Cam Locks', spec: 'Brass Core with Dimple Keys', qty: totalLocks, unit: 'nos', rate: 0, type: 'lock' });
      }

      var totalHw = 0;
      if (hwItems.length > 0) {
        html += '<tr class="sec-bar-row"><td colspan="11"><b>Hardware &amp; Functional Fittings Specifications</b></td></tr>';
        for (var h = 0; h < hwItems.length; h++) {
          var hw = hwItems[h];
          var hwAmt = hw.qty * hw.rate;
          totalHw += hwAmt;
          html += '<tr>' +
            '<td class="c-center">' + (quote.furnitureItems.length + h + 1) + '</td>' +
            '<td class="c-center bold">' + hw.code + '</td>' +
            '<td class="c-center p-0">' + self.getHardwareSVG(hw.type) + '</td>' +
            '<td><b>' + hw.name + '</b></td>' +
            '<td class="dim-cell" style="color:#64748B">Standard Fit</td>' +
            '<td class="c-center">Hardware</td>' +
            '<td class="fin-cell"><div>Material : ' + hw.spec + '</div></td>' +
            '<td class="acc-cell">System Pack</td>' +
            '<td class="c-num">0.00</td>' +
            '<td class="c-num">' + hw.qty + ' ' + hw.unit + '</td>' +
            '<td class="c-num bold">0.00</td>' +
            '</tr>';
        }
        html += '<tr class="subtotal-bar"><td colspan="10" style="text-align:right;padding-right:12px;font-weight:700">SUBTOTAL HARDWARE &amp; FITTINGS</td><td class="c-num bold">0.00</td></tr>';
      }

      html += '<tr class="sec-bar-row"><td colspan="11"><b>Commercial Estimate Summary (' + (quote.isFiltered ? 'Active Scope' : 'Entire Home') + ')</b></td></tr>' +
        '<tr><td colspan="4"></td><td colspan="4" class="bold">Modular Woodwork Subtotal</td><td colspan="3" class="c-num bold">₹ ' + commSummary.woodworkSubtotal.toLocaleString('en-IN') + '.00</td></tr>' +
        '<tr><td colspan="4"></td><td colspan="4" class="bold" style="color:#64748B">Hardware &amp; Functional Fittings Subtotal</td><td colspan="3" class="c-num" style="color:#64748B">₹ 0.00</td></tr>' +

        // Additional Accessories (Enable/Disable + amount + catalog selector button)
        '<tr class="comm-charge-row" id="commRowAccessories" style="' + (commSummary.accessoriesEnabled ? '' : 'opacity:0.55;') + '">' +
        '<td colspan="4"></td>' +
        '<td colspan="4" class="bold">' +
        '<div style="display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
        '<label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;"><input type="checkbox" class="comm-toggle" data-toggle="accessoriesEnabled"' + (commSummary.accessoriesEnabled ? ' checked' : '') + '> Additional Accessories</label>' +
        '<button type="button" class="btn btn-sm" id="btnOpenAddonsPicker" style="background:#08231B;color:#fff;border-radius:5px;font-size:11px;font-weight:700;padding:2px 8px;cursor:pointer;">🛍️ Select Add-Ons Catalog (58 Items)</button>' +
        (commCharges.selectedAddons && commCharges.selectedAddons.length ? ('<span id="commAddonsCountBadge" style="font-size:11px;color:#166534;font-weight:700;">(' + commCharges.selectedAddons.length + ' items selected)</span>') : '<span id="commAddonsCountBadge" style="display:none;font-size:11px;color:#166534;font-weight:700;"></span>') +
        '</div></td>' +
        '<td colspan="3" style="text-align:right;white-space:nowrap">' +
        '<div style="display:inline-flex;align-items:center;justify-content:flex-end;gap:4px">' +
        '<span style="font-size:11px;color:#64748B;font-weight:600">₹</span>' +
        '<input type="number" min="0" step="any" class="comm-input" data-key="additionalAccessories" value="' + (commCharges.additionalAccessories || '') + '" placeholder="enter amount"' + (commSummary.accessoriesEnabled ? '' : ' disabled') + '>' +
        '<span style="font-size:11px;color:#94A3B8">.00</span>' +
        '</div></td></tr>' +

        // Appliances (Enable/Disable + amount)
        '<tr class="comm-charge-row" id="commRowAppliances" style="' + (commSummary.appliancesEnabled ? '' : 'opacity:0.55;') + '">' +
        '<td colspan="4"></td>' +
        '<td colspan="4" class="bold"><label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;"><input type="checkbox" class="comm-toggle" data-toggle="appliancesEnabled"' + (commSummary.appliancesEnabled ? ' checked' : '') + '> Appliances</label></td>' +
        '<td colspan="3" style="text-align:right;white-space:nowrap">' +
        '<div style="display:inline-flex;align-items:center;justify-content:flex-end;gap:4px">' +
        '<span style="font-size:11px;color:#64748B;font-weight:600">₹</span>' +
        '<input type="number" min="0" step="any" class="comm-input" data-key="appliances" value="' + (commCharges.appliances || '') + '" placeholder="enter amount"' + (commSummary.appliancesEnabled ? '' : ' disabled') + '>' +
        '<span style="font-size:11px;color:#94A3B8">.00</span>' +
        '</div></td></tr>' +

        // Design Fee Slab Selector (Auto-applied by Elegant Surabhi costing benchmark & changeable by dropdown)
        '<tr class="comm-charge-row" style="background:#F8FAFC;border-top:1px solid #E2E8F0;">' +
        '<td colspan="4"></td>' +
        '<td colspan="4" class="bold" style="color:#1E3A8A;font-size:12px;">' +
        '<div style="display:inline-flex;align-items:center;gap:6px;">' +
        '<span>🏷️ Design Fee Slab <small style="color:#64748B;font-weight:normal;">(Elegant Surabhi benchmark)</small>:</span>' +
        '</div></td>' +
        '<td colspan="3" style="text-align:right">' +
        '<select class="comm-status-select" data-key="surabhiDesignSlab" id="commSurabhiSlabSelect" style="max-width:280px;font-size:11px;font-weight:600;padding:3px 6px;border-radius:5px;border:1px solid #94A3B8;background:#fff;color:#0F172A;">' +
        '<option value="auto"' + (commSummary.surabhiDesignSlab === 'auto' ? ' selected' : '') + '>✨ Auto: ' + (commSummary.activeSlab ? (commSummary.activeSlab.label + ' (₹' + commSummary.activeSlab.fullDesignCharges.toLocaleString('en-IN') + ' → ₹' + commSummary.activeSlab.discountedCharges.toLocaleString('en-IN') + ')') : '2 to 3 Lakhs') + '</option>' +
        '<option value="2_to_3"' + (commSummary.surabhiDesignSlab === '2_to_3' ? ' selected' : '') + '>2 to 3 Lakhs (₹24,465 → ₹9,786)</option>' +
        '<option value="4_to_5"' + (commSummary.surabhiDesignSlab === '4_to_5' ? ' selected' : '') + '>4 to 5 Lakhs (₹35,280 → ₹14,112)</option>' +
        '<option value="5_to_7_entry"' + (commSummary.surabhiDesignSlab === '5_to_7_entry' ? ' selected' : '') + '>5 to 7 Lakhs - Entry (₹42,780 → ₹17,112)</option>' +
        '<option value="5_to_7_mid"' + (commSummary.surabhiDesignSlab === '5_to_7_mid' ? ' selected' : '') + '>5 to 7 Lakhs - Mid (₹47,780 → ₹19,112)</option>' +
        '<option value="5_to_7_upper"' + (commSummary.surabhiDesignSlab === '5_to_7_upper' ? ' selected' : '') + '>5 to 7 Lakhs - Upper (₹60,280 → ₹24,112)</option>' +
        '<option value="7_to_8"' + (commSummary.surabhiDesignSlab === '7_to_8' ? ' selected' : '') + '>7 to 8 Lakhs (₹72,780 → ₹29,112)</option>' +
        '<option value="9_to_10"' + (commSummary.surabhiDesignSlab === '9_to_10' ? ' selected' : '') + '>9 to 10 Lakhs (₹85,280 → ₹34,112)</option>' +
        '<option value="10_to_11"' + (commSummary.surabhiDesignSlab === '10_to_11' ? ' selected' : '') + '>10 to 11 Lakhs (₹97,780 → ₹39,112)</option>' +
        '<option value="12_to_15"' + (commSummary.surabhiDesignSlab === '12_to_15' ? ' selected' : '') + '>12 to 15 Lakhs (₹1,12,780 → ₹45,112)</option>' +
        '<option value="15_to_20"' + (commSummary.surabhiDesignSlab === '15_to_20' ? ' selected' : '') + '>15 to 20 Lakhs (₹1,47,780 → ₹59,112)</option>' +
        '<option value="20_to_25"' + (commSummary.surabhiDesignSlab === '20_to_25' ? ' selected' : '') + '>20 to 25 Lakhs (₹1,95,280 → ₹78,112)</option>' +
        '<option value="25_to_30"' + (commSummary.surabhiDesignSlab === '25_to_30' ? ' selected' : '') + '>25 to 30 Lakhs (₹2,22,780 → ₹89,112)</option>' +
        '<option value="custom"' + (commSummary.surabhiDesignSlab === 'custom' ? ' selected' : '') + '>✏️ Manual / Percentage %</option>' +
        '</select>' +
        '</td></tr>' +

        // Design Charges (editable %, 9% default)
        '<tr class="comm-charge-row">' +
        '<td colspan="4"></td>' +
        '<td colspan="4" class="bold">Design Charges</td>' +
        '<td colspan="3" style="text-align:right;white-space:nowrap">' +
        '<div style="display:inline-flex;align-items:center;justify-content:flex-end;gap:6px">' +
        '<input type="number" min="0" max="100" step="any" class="comm-input" data-key="designPercent" value="' + commSummary.designPercent + '" style="width:55px" placeholder="9">' +
        '<span style="font-size:11px;color:#64748B;font-weight:600">% &nbsp;=&nbsp; ₹</span>' +
        '<span id="commDesignAmount" class="bold" style="font-family:var(--mono);font-size:12px;display:inline-block;min-width:70px">' + commSummary.designAmount.toLocaleString('en-IN') + '.00</span>' +
        '</div></td></tr>' +

        // Freight Charges (2.5% + Enable/Disable)
        '<tr class="comm-charge-row" id="commRowFreight" style="' + (commSummary.freightEnabled ? '' : 'opacity:0.55;') + '">' +
        '<td colspan="4"></td>' +
        '<td colspan="4" class="bold"><label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;"><input type="checkbox" class="comm-toggle" data-toggle="freightEnabled"' + (commSummary.freightEnabled ? ' checked' : '') + '> Freight Charges</label></td>' +
        '<td colspan="3" style="text-align:right;white-space:nowrap">' +
        '<div style="display:inline-flex;align-items:center;justify-content:flex-end;gap:6px">' +
        '<input type="number" min="0" max="100" step="any" class="comm-input" data-key="freightPercent" value="' + commSummary.freightPercent + '" style="width:55px" placeholder="2.5"' + (commSummary.freightEnabled ? '' : ' disabled') + '>' +
        '<span style="font-size:11px;color:#64748B;font-weight:600">% &nbsp;=&nbsp; ₹</span>' +
        '<span id="commFreightAmount" class="bold" style="font-family:var(--mono);font-size:12px;display:inline-block;min-width:70px">' + commSummary.freightAmount.toLocaleString('en-IN') + '.00</span>' +
        '</div></td></tr>' +

        // 7. Loading and unloading (material) [Additional / Included]
        '<tr class="comm-charge-row">' +
        '<td colspan="4"></td><td colspan="4" class="bold">Loading and unloading (material)</td>' +
        '<td colspan="3" style="text-align:right">' +
        '<select class="comm-status-select' + (commSummary.loadingUnloadingStatus === 'Included' ? ' is-included' : '') + '" data-key="loadingUnloadingStatus">' +
        '<option value="Additional"' + (commSummary.loadingUnloadingStatus === 'Additional' ? ' selected' : '') + '>Additional</option>' +
        '<option value="Included"' + (commSummary.loadingUnloadingStatus === 'Included' ? ' selected' : '') + '>Included</option>' +
        '</select></td></tr>' +

        // 8. Floor protective mat [Included / Not Included]
        '<tr class="comm-charge-row">' +
        '<td colspan="4"></td><td colspan="4" class="bold">Floor protective mat</td>' +
        '<td colspan="3" style="text-align:right">' +
        '<select class="comm-status-select' + (commSummary.floorMatStatus === 'Included' ? ' is-included' : '') + '" data-key="floorMatStatus">' +
        '<option value="Not Included in Quote"' + (commSummary.floorMatStatus !== 'Included' ? ' selected' : '') + '>Not Included in Quote</option>' +
        '<option value="Included"' + (commSummary.floorMatStatus === 'Included' ? ' selected' : '') + '>Included</option>' +
        '</select></td></tr>' +

        // 9. Civil works [As per actuals / Included]
        '<tr class="comm-charge-row">' +
        '<td colspan="4"></td><td colspan="4" class="bold">Civil works</td>' +
        '<td colspan="3" style="text-align:right">' +
        '<select class="comm-status-select' + (commSummary.civilWorksStatus === 'Included' ? ' is-included' : '') + '" data-key="civilWorksStatus">' +
        '<option value="As per actuals"' + (commSummary.civilWorksStatus !== 'Included' ? ' selected' : '') + '>As per actuals</option>' +
        '<option value="Included"' + (commSummary.civilWorksStatus === 'Included' ? ' selected' : '') + '>Included</option>' +
        '</select></td></tr>' +

        // 10. Electrical & Plumbing Works [Additional / Included]
        '<tr class="comm-charge-row">' +
        '<td colspan="4"></td><td colspan="4" class="bold">Electrical &amp; Plumbing Works</td>' +
        '<td colspan="3" style="text-align:right">' +
        '<select class="comm-status-select' + (commSummary.electricalPlumbingStatus === 'Included' ? ' is-included' : '') + '" data-key="electricalPlumbingStatus">' +
        '<option value="Additional"' + (commSummary.electricalPlumbingStatus !== 'Included' ? ' selected' : '') + '>Additional</option>' +
        '<option value="Included"' + (commSummary.electricalPlumbingStatus === 'Included' ? ' selected' : '') + '>Included</option>' +
        '</select></td></tr>' +

        // 11. False ceiling [Not Included / Included]
        '<tr class="comm-charge-row">' +
        '<td colspan="4"></td><td colspan="4" class="bold">False ceiling</td>' +
        '<td colspan="3" style="text-align:right">' +
        '<select class="comm-status-select' + (commSummary.falseCeilingStatus === 'Included' ? ' is-included' : '') + '" data-key="falseCeilingStatus">' +
        '<option value="Not Included"' + (commSummary.falseCeilingStatus !== 'Included' ? ' selected' : '') + '>Not Included</option>' +
        '<option value="Included"' + (commSummary.falseCeilingStatus === 'Included' ? ' selected' : '') + '>Included</option>' +
        '</select></td></tr>' +

        // 12. Wallpaper [Complementary / Not Included]
        '<tr class="comm-charge-row">' +
        '<td colspan="4"></td><td colspan="4" class="bold">Wallpaper</td>' +
        '<td colspan="3" style="text-align:right">' +
        '<select class="comm-status-select' + (commSummary.wallpaperStatus === 'Complementary' ? ' is-complementary' : '') + '" data-key="wallpaperStatus">' +
        '<option value="Complementary"' + (commSummary.wallpaperStatus !== 'Not Included' ? ' selected' : '') + '>Complementary</option>' +
        '<option value="Not Included"' + (commSummary.wallpaperStatus === 'Not Included' ? ' selected' : '') + '>Not Included</option>' +
        '</select></td></tr>' +

        // Discount on Wood Work (replaces Promotional Discount)
        '<tr class="comm-charge-row">' +
        '<td colspan="4"></td>' +
        '<td colspan="4" class="bold text-red">Discount on Wood Work</td>' +
        '<td colspan="3" style="text-align:right;white-space:nowrap">' +
        '<div style="display:inline-flex;align-items:center;justify-content:flex-end;gap:6px">' +
        '<span style="font-size:11px;color:#DC2626;font-weight:600">(-)</span>' +
        '<input type="number" min="0" max="100" step="any" class="comm-input is-discount" data-key="discountPercent" value="' + (commSummary.discountPercent || '') + '" style="width:55px" placeholder="enter %">' +
        '<span style="font-size:11px;color:#DC2626;font-weight:600">% &nbsp;=&nbsp; (-) ₹</span>' +
        '<span id="commDiscountAmount" class="bold text-red" style="font-family:var(--mono);font-size:12px;display:inline-block;min-width:70px">' + commSummary.discountAmount.toLocaleString('en-IN') + '.00</span>' +
        '</div></td></tr>' +

        // Discount on Design Charge (replaces ADP)
        '<tr class="comm-charge-row">' +
        '<td colspan="4"></td>' +
        '<td colspan="4" class="bold text-red">Discount on Design Charge</td>' +
        '<td colspan="3" style="text-align:right;white-space:nowrap">' +
        '<div style="display:inline-flex;align-items:center;justify-content:flex-end;gap:6px">' +
        '<span style="font-size:11px;color:#DC2626;font-weight:600">(-)</span>' +
        '<input type="number" min="0" max="100" step="any" class="comm-input is-discount" data-key="adpPercent" value="' + (commSummary.adpPercent || '') + '" style="width:55px" placeholder="enter %">' +
        '<span style="font-size:11px;color:#DC2626;font-weight:600">% &nbsp;=&nbsp; (-) ₹</span>' +
        '<span id="commAdpAmount" class="bold text-red" style="font-family:var(--mono);font-size:12px;display:inline-block;min-width:70px">' + commSummary.adpAmount.toLocaleString('en-IN') + '.00</span>' +
        '</div></td></tr>' +

        // GRAND TOTAL (WITHOUT GST)
        '<tr class="taxable-row">' +
        '<td colspan="4"></td>' +
        '<td colspan="4" class="bold" style="font-size:12px">GRAND TOTAL (WITHOUT GST)</td>' +
        '<td colspan="3" class="c-num bold" id="commNetTaxable" style="font-size:13px;color:#1E3A8A">₹ ' + commSummary.netValue.toLocaleString('en-IN') + '.00</td>' +
        '</tr>' +

        // GST (Enable/Disable)
        '<tr class="comm-charge-row" id="commRowGst" style="background:#F8FAFC;' + (commSummary.gstEnabled ? '' : 'opacity:0.55;') + '">' +
        '<td colspan="4"></td>' +
        '<td colspan="4" class="bold"><label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;"><input type="checkbox" class="comm-toggle" data-toggle="gstEnabled"' + (commSummary.gstEnabled ? ' checked' : '') + '> GST</label></td>' +
        '<td colspan="3" style="text-align:right;white-space:nowrap">' +
        '<div style="display:inline-flex;align-items:center;justify-content:flex-end;gap:6px">' +
        '<span style="font-size:11px;color:#64748B">Rate:</span>' +
        '<input type="number" min="0" max="100" step="any" class="comm-input" data-key="gstPercent" value="' + commSummary.gstPercent + '" style="width:55px" placeholder="18"' + (commSummary.gstEnabled ? '' : ' disabled') + '>' +
        '<span style="font-size:11px;color:#64748B;font-weight:600">% &nbsp;=&nbsp; ₹</span>' +
        '<span id="commGstAmount" class="bold" style="font-family:var(--mono);font-size:12px;display:inline-block;min-width:70px">' + commSummary.gstAmount.toLocaleString('en-IN') + '.00</span>' +
        '</div></td></tr>' +

        // FINAL TOTAL (WITH GST)
        '<tr class="grand-row">' +
        '<td colspan="4"></td>' +
        '<td colspan="4" class="bold grand-lbl" id="commFinalLabel" style="font-size:13px">' + (commSummary.gstEnabled ? 'FINAL TOTAL (WITH GST)' : 'FINAL TOTAL') + '</td>' +
        '<td colspan="3" class="c-num bold grand-val" id="commFinalTotal" style="font-size:14px">INR ' + commSummary.grandTotal.toLocaleString('en-IN') + '.00</td>' +
        '</tr>' +
        // YOUR SAVINGS
        '<tr style="background:#ECFDF5;">' +
        '<td colspan="4"></td>' +
        '<td colspan="4" class="bold" style="font-size:12.5px;color:#166534;">YOUR SAVINGS</td>' +
        '<td colspan="3" class="c-num bold" id="commTotalSavings" style="font-size:13.5px;color:#166534;">₹ ' + (commSummary.totalSavings || 0).toLocaleString('en-IN') + '.00</td>' +
        '</tr>' +

        // ── ADD-ONS & TOTAL INVESTMENT (DOWN AFTER SAVINGS) ──
        '<tr class="sec-bar-row" style="background:#08231B;color:#fff;"><td colspan="11"><b>Add-Ons, Accessories &amp; Appliances (Down After Savings)</b></td></tr>' +
        '<tr>' +
        '<td colspan="4"></td>' +
        '<td colspan="4" class="bold">Add-ons &amp; Accessories Subtotal</td>' +
        '<td colspan="3" class="c-num bold" id="commAddonsSubtotal">₹ ' + (commSummary.addonsTotal || 0).toLocaleString('en-IN') + '.00</td>' +
        '</tr>' +
        '<tr style="background:#ECFDF5;border-top:1.5px solid #16A34A;">' +
        '<td colspan="4"></td>' +
        '<td colspan="4" class="bold" style="font-size:13px;color:#08231B;">TOTAL PROJECT INVESTMENT (PROPOSAL + ADD-ONS)</td>' +
        '<td colspan="3" class="c-num bold" id="commTotalInvestment" style="font-size:14px;color:#166534;">INR ' + (commSummary.totalInvestmentWithAddons || 0).toLocaleString('en-IN') + '.00</td>' +
        '</tr>' +
        '</tbody></table></div>';

      // History Snapshots if available
      if (this.project.quotationHistory && this.project.quotationHistory.length > 0) {
        html += '<h3 class="boq-sec-title" style="margin-top:24px">Issued Quotation History</h3>' +
          '<table class="boq-table">' +
          '<thead><tr><th>Version</th><th>Label / Note</th><th>Date Issued</th><th class="r">Locked Total (' + sym + ')</th></tr></thead>' +
          '<tbody>';
        for (var h = 0; h < this.project.quotationHistory.length; h++) {
          var qh = this.project.quotationHistory[h];
          html += '<tr>' +
            '<td><b>v' + qh.version + '</b></td>' +
            '<td>' + qh.label + (qh.notes ? ' (' + qh.notes + ')' : '') + '</td>' +
            '<td>' + new Date(qh.dateLocked).toLocaleString() + '</td>' +
            '<td class="r bold">' + qh.quotation.grandTotal.toLocaleString('en-IN') + '</td>' +
            '</tr>';
        }
        html += '</tbody></table>';
      }

      html += '</div>';
      boqEl.innerHTML = html;

      function refreshCommercialDom() {
        var summary = self.computeCommercialSummary(quote.subtotalWoodwork, self.project.commercialCharges);
        var designAmtEl = document.getElementById('commDesignAmount');
        if (designAmtEl) designAmtEl.textContent = summary.designAmount.toLocaleString('en-IN') + '.00';
        var designInp = boqEl.querySelector('.comm-input[data-key="designPercent"]');
        if (designInp && summary.surabhiDesignSlab !== 'custom') {
          designInp.value = summary.designPercent;
        }
        var adpInp = boqEl.querySelector('.comm-input[data-key="adpPercent"]');
        if (adpInp && summary.surabhiDesignSlab !== 'custom') {
          adpInp.value = summary.adpPercent;
        }
        var freightAmtEl = document.getElementById('commFreightAmount');
        if (freightAmtEl) freightAmtEl.textContent = summary.freightAmount.toLocaleString('en-IN') + '.00';
        var discAmtEl = document.getElementById('commDiscountAmount');
        if (discAmtEl) discAmtEl.textContent = summary.discountAmount.toLocaleString('en-IN') + '.00';
        var adpAmtEl = document.getElementById('commAdpAmount');
        if (adpAmtEl) adpAmtEl.textContent = summary.adpAmount.toLocaleString('en-IN') + '.00';
        var netEl = document.getElementById('commNetTaxable');
        if (netEl) netEl.textContent = '₹ ' + summary.netValue.toLocaleString('en-IN') + '.00';
        var gstAmtEl = document.getElementById('commGstAmount');
        if (gstAmtEl) gstAmtEl.textContent = summary.gstAmount.toLocaleString('en-IN') + '.00';
        var finalLblEl = document.getElementById('commFinalLabel');
        if (finalLblEl) finalLblEl.textContent = summary.gstEnabled ? 'FINAL TOTAL (WITH GST)' : 'FINAL TOTAL';
        var finalEl = document.getElementById('commFinalTotal');
        if (finalEl) finalEl.textContent = 'INR ' + summary.grandTotal.toLocaleString('en-IN') + '.00';
        var savEl = document.getElementById('commTotalSavings');
        if (savEl) savEl.textContent = '₹ ' + (summary.totalSavings || 0).toLocaleString('en-IN') + '.00';
        var addSubEl = document.getElementById('commAddonsSubtotal');
        if (addSubEl) addSubEl.textContent = '₹ ' + (summary.addonsTotal || 0).toLocaleString('en-IN') + '.00';
        var totInvEl = document.getElementById('commTotalInvestment');
        if (totInvEl) totInvEl.textContent = 'INR ' + (summary.totalInvestmentWithAddons || 0).toLocaleString('en-IN') + '.00';
        var badgeEl = document.getElementById('commAddonsCountBadge');
        if (badgeEl) {
          var selCount = (self.project.commercialCharges && self.project.commercialCharges.selectedAddons) ? self.project.commercialCharges.selectedAddons.length : 0;
          if (selCount > 0) {
            badgeEl.textContent = '(' + selCount + ' items selected)';
            badgeEl.style.display = 'inline';
          } else {
            badgeEl.style.display = 'none';
          }
        }
        var headerTotalEl = document.getElementById('boqHeaderTotalAmount');
        if (headerTotalEl) headerTotalEl.textContent = 'INR ' + summary.grandTotal.toLocaleString('en-IN') + '.00';

        var autoOpt = boqEl.querySelector('#commSurabhiSlabSelect option[value="auto"]');
        if (autoOpt && typeof Core !== 'undefined' && Core.getSurabhiDesignFeeSlab) {
          var autoS = Core.getSurabhiDesignFeeSlab(summary.surabhiWoodworkSubtotal, 'auto');
          if (autoS) {
            autoOpt.textContent = '✨ Auto: ' + autoS.label + ' (₹' + autoS.fullDesignCharges.toLocaleString('en-IN') + ' → ₹' + autoS.discountedCharges.toLocaleString('en-IN') + ')';
          }
        }
      }

      // Commercial Charges live input bindings
      var commInputs = boqEl.querySelectorAll('.comm-input');
      commInputs.forEach(function (inp) {
        inp.addEventListener('input', function () {
          var key = inp.getAttribute('data-key');
          if (!key) return;
          var val = parseFloat(inp.value);
          if (isNaN(val)) val = 0;

          self.project.commercialCharges = self.project.commercialCharges || {};
          self.project.commercialCharges[key] = val;
          if (key === 'designPercent' || key === 'adpPercent') {
            self.project.commercialCharges.surabhiDesignSlab = 'custom';
            var slabSel = boqEl.querySelector('#commSurabhiSlabSelect');
            if (slabSel) slabSel.value = 'custom';
          }
          refreshCommercialDom();
          self.saveToLocalStorage();
        });
      });

      // Enable / Disable toggles for Accessories, Appliances, Freight & GST
      var commToggles = boqEl.querySelectorAll('.comm-toggle');
      commToggles.forEach(function (chk) {
        chk.addEventListener('change', function () {
          var tKey = chk.getAttribute('data-toggle');
          if (!tKey) return;
          self.project.commercialCharges = self.project.commercialCharges || {};
          self.project.commercialCharges[tKey] = !!chk.checked;
          var tr = chk.closest('tr');
          if (tr) {
            tr.style.opacity = chk.checked ? '' : '0.55';
            tr.querySelectorAll('.comm-input').forEach(function (el) { el.disabled = !chk.checked; });
          }
          refreshCommercialDom();
          self.saveToLocalStorage();
        });
      });

      // Commercial Status dropdown bindings (Rows 7-12)
      var commStatusSelects = boqEl.querySelectorAll('.comm-status-select');
      commStatusSelects.forEach(function (sel) {
        sel.addEventListener('change', function () {
          var key = sel.getAttribute('data-key');
          if (!key) return;
          self.project.commercialCharges = self.project.commercialCharges || {};
          self.project.commercialCharges[key] = sel.value;
          if (key === 'surabhiDesignSlab') {
            refreshCommercialDom();
            self.saveToLocalStorage();
            return;
          }
          if (sel.value === 'Included') {
            sel.className = 'comm-status-select is-included';
          } else if (sel.value === 'Complementary') {
            sel.className = 'comm-status-select is-complementary';
          } else {
            sel.className = 'comm-status-select';
          }
          self.saveToLocalStorage();
        });
      });

      var btnAddonsPicker = boqEl.querySelector('#btnOpenAddonsPicker');
      if (btnAddonsPicker) {
        btnAddonsPicker.addEventListener('click', function () {
          self.openAddonsPickerModal(function () {
            refreshCommercialDom();
            var accInp = boqEl.querySelector('.comm-input[data-key="additionalAccessories"]');
            if (accInp) accInp.value = self.project.commercialCharges.additionalAccessories || 0;
            self.saveToLocalStorage();
          });
        });
      }

      // Event bindings for BOQ
      var printBtn = document.getElementById('boqPrintBtn');
      if (printBtn) {
        printBtn.addEventListener('click', function () {
          self.downloadPDF();
        });
      }

      var xlsxBtn = document.getElementById('boqXlsxBtn');
      if (xlsxBtn) {
        xlsxBtn.addEventListener('click', function () {
          self.exportXLSX();
        });
      }

      var shareQuoteBtn = document.getElementById('boqShareQuoteBtn');
      if (shareQuoteBtn && window.OrbixClientQuote) {
        shareQuoteBtn.addEventListener('click', function () {
          window.OrbixClientQuote.openModal(self);
        });
      }

      var editDetailsBtn = document.getElementById('boqEditDetailsBtn');
      if (editDetailsBtn) {
        editDetailsBtn.addEventListener('click', function () {
          var modal = document.getElementById('editProjectMetaModal');
          if (!modal) return;
          var m = self.project.meta || {};
          var clientInput = document.getElementById('editProjClient');
          var contactInput = document.getElementById('editProjContact');
          var locInput = document.getElementById('editProjLocation');
          var bhSelect = document.getElementById('editProjBhName');
          var dtInput = document.getElementById('editProjDateTime');
          var cpInput = document.getElementById('editProjCpCode');

          if (clientInput) clientInput.value = m.clientName || '';
          if (contactInput) contactInput.value = m.phone || m.contactNumber || '';
          if (locInput) locInput.value = m.siteAddress || m.siteLocation || m.location || '';
          if (bhSelect) {
            var existingBh = m.bhName || m.designerName || '';
            if (window.OrbixProjects && typeof window.OrbixProjects.populateBhDropdown === 'function') {
              window.OrbixProjects.populateBhDropdown(existingBh);
            }
            if (existingBh) bhSelect.value = existingBh;
          }
          if (dtInput) dtInput.value = m.dateTime || (m.dateCreated ? self.formatDisplayDate(m.dateCreated, true) : '');
          if (cpInput) cpInput.value = m.cpCode || m.quoteId || '';

          modal.classList.add('is-open');
        });
      }

      var editForm = document.getElementById('editProjectMetaForm');
      if (editForm && !editForm._hasBoundListener) {
        editForm._hasBoundListener = true;
        editForm.onsubmit = function (e) {
          e.preventDefault();
          var clientVal = (document.getElementById('editProjClient').value || '').trim();
          var contactVal = (document.getElementById('editProjContact').value || '').trim();
          var locVal = (document.getElementById('editProjLocation').value || '').trim();
          var bhVal = (document.getElementById('editProjBhName').value || '').trim();
          var dtVal = (document.getElementById('editProjDateTime').value || '').trim();
          var cpVal = (document.getElementById('editProjCpCode').value || '').trim();

          self.project.meta = self.project.meta || {};
          self.project.meta.clientName = clientVal;
          self.project.meta.phone = contactVal;
          self.project.meta.contactNumber = contactVal;
          self.project.meta.siteAddress = locVal;
          self.project.meta.siteLocation = locVal;
          self.project.meta.location = locVal;
          self.project.meta.bhName = bhVal;
          self.project.meta.designerName = bhVal;
          self.project.meta.dateTime = dtVal;
          self.project.meta.dateCreated = dtVal;
          self.project.meta.cpCode = cpVal;
          self.project.meta.quoteId = cpVal || self.project.meta.quoteId || 'CP-9042';

          // Sync with active project in OrbixProjects
          if (window.OrbixProjects) {
            var actId = window.OrbixProjects.activeProjectId;
            var curProj = (window.OrbixProjects.projects || []).find(function (p) { return p.id === actId; });
            if (curProj) {
              curProj.client = clientVal;
              curProj.contact_number = contactVal;
              curProj.location = locVal;
              curProj.bh_name = bhVal;
              curProj.date_time = dtVal;
              curProj.cp_code = cpVal;
              curProj.data = curProj.data || {};
              curProj.data.details = {
                clientName: clientVal,
                contactNumber: contactVal,
                phone: contactVal,
                location: locVal,
                siteAddress: locVal,
                bhName: bhVal,
                designerName: bhVal,
                dateTime: dtVal,
                dateCreated: dtVal,
                cpCode: cpVal,
                quoteId: cpVal
              };
            }
            window.OrbixProjects.saveActiveProject({
              plan: self.project,
              units: window.S ? window.S.units : []
            });
          }

          self.saveToLocalStorage();
          self.renderBOQ();
          var modal = document.getElementById('editProjectMetaModal');
          if (modal) modal.classList.remove('is-open');
          if (window.OrbixProjects && window.OrbixProjects.showToast) {
            window.OrbixProjects.showToast('Client details updated & saved!', 'success');
          }
        };
      }

      var resetFilterBtn = document.getElementById('boqResetFilterBtn');
      if (resetFilterBtn) {
        resetFilterBtn.addEventListener('click', function () {
          self.selectedBOQRooms = ['all'];
          self.renderBOQ();
        });
      }

      // Floor filter pill clicks
      var floorFilterBtns = boqEl.querySelectorAll('.floor-filter-pill');
      floorFilterBtns.forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var fTarget = btn.getAttribute('data-floor') || 'all';
          self.selectedBOQFloor = fTarget;
          self.renderBOQ();
        });
      });

      // Room filter pill clicks & Stat card clicks
      var roomFilterBtns = boqEl.querySelectorAll('.room-filter-pill, .boq-room-select-btn');
      roomFilterBtns.forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var rTarget = btn.getAttribute('data-room');
          if (!rTarget || rTarget === 'all') {
            self.selectedBOQRooms = ['all'];
          } else {
            if (!self.selectedBOQRooms || self.selectedBOQRooms.indexOf('all') !== -1) {
              self.selectedBOQRooms = [rTarget];
            } else {
              var pos = self.selectedBOQRooms.indexOf(rTarget);
              if (pos !== -1) {
                self.selectedBOQRooms.splice(pos, 1);
                if (self.selectedBOQRooms.length === 0) {
                  self.selectedBOQRooms = ['all'];
                }
              } else {
                self.selectedBOQRooms.push(rTarget);
              }
            }
          }
          self.renderBOQ();
        });
      });

      var toggleRcBtn = document.getElementById('boqToggleRateCardBtn');
      var rcDrawer = document.getElementById('rateCardDrawer');
      if (toggleRcBtn && rcDrawer) {
        toggleRcBtn.addEventListener('click', function () {
          rcDrawer.style.display = rcDrawer.style.display === 'none' ? 'block' : 'none';
        });
      }

      var matrixBtn = document.getElementById('boqViewMatrixBtn');
      if (matrixBtn) {
        matrixBtn.addEventListener('click', function () {
          var rcD = document.getElementById('rateCardDrawer');
          var mCard = document.getElementById('fullMatrixCard');
          if (rcD) rcD.style.display = 'block';
          if (mCard) mCard.style.display = mCard.style.display === 'none' ? 'block' : 'none';
        });
      }

      // Tier selector button clicks (Global Working: synchronizes all rooms)
      var pills = boqEl.querySelectorAll('.tier-pill, .matrix-th-btn');
      pills.forEach(function (pill) {
        pill.addEventListener('click', function () {
          var t = pill.getAttribute('data-tier') || 'zappo - el pearl';
          self.project.rateCard = self.project.rateCard || Core.DEFAULT_RATE_CARD;
          self.project.rateCard.selectedTier = t;
          self.project.rateCard.roomTiers = self.project.rateCard.roomTiers || {};
          var pRooms = (self.project.plan && self.project.plan.rooms) || [];
          for (var pr = 0; pr < pRooms.length; pr++) {
            self.project.rateCard.roomTiers[pRooms[pr].id] = t;
            pRooms[pr].variant = t;
          }
          self.project.rateCard.roomTiers['_general'] = t;
          self.saveToLocalStorage();
          self.renderBOQ();
          self.updateUI();
        });
      });

      // Room-wise tier dropdown change
      var roomTierSelects = boqEl.querySelectorAll('.room-tier-select');
      roomTierSelects.forEach(function (sel) {
        sel.addEventListener('change', function (e) {
          e.stopPropagation();
          var rId = sel.getAttribute('data-room-id');
          var chosenTier = sel.value;
          self.project.rateCard = self.project.rateCard || Core.DEFAULT_RATE_CARD;
          self.project.rateCard.roomTiers = self.project.rateCard.roomTiers || {};
          self.project.rateCard.roomTiers[rId] = chosenTier;
          var pRooms = (self.project.plan && self.project.plan.rooms) || [];
          for (var pr = 0; pr < pRooms.length; pr++) {
            if (pRooms[pr].id === rId) {
              pRooms[pr].variant = chosenTier;
              break;
            }
          }
          self.saveToLocalStorage();
          self.renderBOQ();
          self.updateUI();
        });
      });

      var rcSaveBtn = document.getElementById('rc_saveBtn');
      if (rcSaveBtn) {
        rcSaveBtn.addEventListener('click', function () {
          var rc = self.project.rateCard || Core.DEFAULT_RATE_CARD;
          rc.categories.wardrobe.baseRatePerSft = parseFloat(document.getElementById('rc_wardrobe').value) || 1700;
          rc.categories.wardrobe.loftRatePerSft = parseFloat(document.getElementById('rc_loft').value) || 1450;
          rc.categories.kitchen_base.baseRatePerRft = parseFloat(document.getElementById('rc_kbase').value) || 2800;
          rc.categories.kitchen_wall.baseRatePerRft = parseFloat(document.getElementById('rc_kwall').value) || 2100;
          rc.categories.tv_unit.baseRatePerSft = parseFloat(document.getElementById('rc_tv').value) || 1650;
          rc.categories.flooring.baseRatePerSft = parseFloat(document.getElementById('rc_floor').value) || 140;
          rc.laborRates.installationPerSft = parseFloat(document.getElementById('rc_install').value) || 0;
          rc.marginPercent = parseFloat(document.getElementById('rc_margin').value) || 15;
          rc.gstPercent = parseFloat(document.getElementById('rc_gst').value) || 18;

          self.project.rateCard = rc;
          self.saveToLocalStorage();
          self.renderBOQ();
          self.updateUI();
        });
      }

      var lockBtn = document.getElementById('boqLockVersionBtn');
      if (lockBtn) {
        lockBtn.addEventListener('click', function () {
          var label = prompt('Enter a label for this issued quotation snapshot (e.g. Initial Client Meeting, Final Approved):', 'Official Quote v' + ((self.project.quotationHistory || []).length + 1) + '.0');
          if (label) {
            Core.lockQuotationVersion(self.project, label);
            self.saveToLocalStorage();
            self.renderBOQ();
          }
        });
      }
    },

    syncFurnitureWith3DStudio: function () {
      // Safe non-destructive wrapper
      if (!window.S || !this.project || !this.project.plan) return;
      this.syncProjectUnitsTo3DStudio();
    },

    render3DHome: function (keepCamera, isolatedRoomId, targetFurnId, forceHardRefresh) {
      if (typeof THREE === 'undefined' || !window.__cc || !window.__cc.gl) return;
      var gl = window.__cc.gl;
      var scene = gl.getScene ? gl.getScene() : null;
      if (!scene) return;

      var isDesignActive = (typeof document !== 'undefined') && document.getElementById('view-design') && document.getElementById('view-design').classList.contains('is-on');
      if (!isDesignActive) {
        this._3dDirty = true;
        return;
      }

      // Ensure sky is daytime radiant sky blue and outer ground is lush lawn grass
      if (!scene.background || !(scene.background instanceof THREE.Color) || scene.background.getHex() !== 0x82C3EC) {
        scene.background = new THREE.Color(0x82C3EC);
      }
      if (!scene.fog && THREE.FogExp2) {
        scene.fog = new THREE.FogExp2(0xE2E8F0, 0.000008);
      }
      scene.children.forEach(function (c) {
        if (c.isMesh && c.geometry && c.geometry.type === 'PlaneGeometry' && c.geometry.parameters && c.geometry.parameters.width >= 100000) {
          c.position.y = -105; // Safely below 100mm physical concrete slab
          if (typeof gl.makeGrassGroundMat === 'function') {
            c.material = gl.makeGrassGroundMat();
          } else if (typeof gl.makeNeutralGroundMat === 'function') {
            c.material = gl.makeNeutralGroundMat();
          } else if (c.material) {
            c.material.map = null;
            if (c.material.color) c.material.color.setHex(0x4E8A42);
            c.material.needsUpdate = true;
          }
        }
      });

      if (!this.archRenderer && root.Orbix3D) {
        this.archRenderer = new root.Orbix3D(scene);
      }
      if (this.archRenderer) {
        var proj = this.project || (this.editor && this.editor.project);
        var homeObj = scene.getObjectByName('OrbixHome3D');
        var curProjId = proj ? String(proj.id || proj._projectId || '') : '';

        // Instant Fast-Path: Only if NOT hard-refreshing, NOT dirty, 3D home already built, and same project!
        if (!forceHardRefresh && !this._3dDirty && homeObj && this.archRenderer.group && this._lastRendered3DProjId === curProjId && isolatedRoomId === undefined) {
          if (gl.apply) gl.apply();
          if (gl.settle) gl.settle();
          return;
        }
        this._3dDirty = false;
        this._lastRendered3DProjId = curProjId;

        // Fast-path: If single furniture/decor item placed or modified and 3D home exists, use instant incremental mesh addition!
        if (targetFurnId && homeObj && this.archRenderer.group && typeof this.archRenderer.addOrUpdateFurnitureMesh === 'function') {
          var plan = this.getPlan();
          var targetFurn = plan && plan.furniture && plan.furniture.find(function (it) { return it.id === targetFurnId; });
          if (targetFurn) {
            this.archRenderer.addOrUpdateFurnitureMesh(targetFurn);
            if (typeof this.updateProjectDetailsBadges === 'function') this.updateProjectDetailsBadges();
            if (gl.apply) gl.apply();
            if (gl.settle) gl.settle();
            return;
          }
        }

        if (isolatedRoomId !== undefined) {
          this.currentIsolatedRoomId = (isolatedRoomId === 'all' || !isolatedRoomId) ? null : isolatedRoomId;
        }
        try {
          this.archRenderer.buildHome(proj, this.currentIsolatedRoomId);
        } catch (homeErr) {
          console.error('[Orbix UI] Error building 3D home:', homeErr);
        }
        var homeObj = scene.getObjectByName('OrbixHome3D');
        var selFurnId = null;
        if (window.S && window.S.units && window.S.units[window.S.active]) {
          selFurnId = window.S.units[window.S.active]._furnId;
        } else if (this.editor && this.editor.selected && this.editor.selected.length > 0) {
          var selItem = this.editor.selected.find(function (it) { return it.type === 'furniture'; });
          if (selItem) selFurnId = selItem.id;
        } else if (gl.getGizmoFurnId) {
          selFurnId = gl.getGizmoFurnId();
        }
        if (homeObj) {
          var foundMesh = null;
          homeObj.traverse(function (c) {
            if (c.userData && c.userData.isFurnitureGroup) {
              c.visible = true;
              if (selFurnId && c.userData.furnitureId === selFurnId) {
                foundMesh = c;
              }
            }
          });
          if (foundMesh && gl.gizmoSet && selFurnId) {
            gl.gizmoSet(foundMesh, selFurnId);
          }
        }
        if (!keepCamera && gl.frame) gl.frame();
        if (gl.apply) gl.apply();
        if (gl.settle) gl.settle();
        if (gl.updateWallCutaway) gl.updateWallCutaway(true);
      }
      if (typeof this.updateProjectDetailsBadges === 'function') {
        this.updateProjectDetailsBadges();
      }
    },

    hardRefresh3D: function (opts) {
      opts = opts || {};
      this._3dDirty = true;
      if (typeof this.update3DStudioRoomOptions === 'function') {
        this.update3DStudioRoomOptions();
      }
      if (typeof this.syncProjectUnitsTo3DStudio === 'function') {
        this.syncProjectUnitsTo3DStudio();
      }
      this.render3DHome(opts.keepCamera !== false, undefined, undefined, true);
      if (window.__cc && window.__cc.gl) {
        if (window.__cc.gl.frame && opts.keepCamera === false) window.__cc.gl.frame();
        if (window.__cc.gl.apply) window.__cc.gl.apply();
        if (window.__cc.gl.settle) window.__cc.gl.settle();
        if (window.__cc.gl.updateWallCutaway) window.__cc.gl.updateWallCutaway(true);
      }
      if (typeof window.showToast === 'function' && opts.silent !== true) {
        window.showToast('🔄 3D Studio hard-refreshed from latest 2D floor plan');
      }
    },

    capturePhotorealisticRender: function (options) {
      var gl = window.__cc && window.__cc.gl;
      if (!gl || typeof gl.snapshot !== 'function') {
        if (typeof window.toast === 'function') window.toast('3D Studio is not active.');
        return;
      }
      options = options || { mode: 'auto' };
      var isAuto = (options.mode === 'auto' || options.mode === 'focused');
      var modeTitle = isAuto ? 'Auto-Placement' : 'Custom View';
      if (typeof window.toast === 'function') {
        window.toast('📸 Rendering 8K Photorealistic Snapshot (' + modeTitle + ')...');
      }
      setTimeout(function () {
        var snapOpts = { format: 'png', quality: 1.0, mode: isAuto ? 'auto' : 'custom' };
        var dataUrl = gl.snapshot(7680, 4320, snapOpts);
        var resLabel = '8k';
        if (!dataUrl) {
          dataUrl = gl.snapshot(3840, 2160, snapOpts);
          resLabel = '4k';
        }
        if (!dataUrl) {
          dataUrl = gl.snapshot(1920, 1080, snapOpts);
          resLabel = 'hd';
        }
        if (dataUrl) {
          var a = document.createElement('a');
          a.href = dataUrl;
          var projTitle = (window.OrbixUI && window.OrbixUI.project && window.OrbixUI.project.meta && window.OrbixUI.project.meta.title) || 'orbix-studio';
          var modeSlug = isAuto ? 'auto-placement' : 'custom-view';
          var isJpg = dataUrl.indexOf('data:image/jpeg') === 0;
          var ext = isJpg ? '.jpg' : '.png';
          a.download = projTitle.toLowerCase().replace(/\s+/g, '-') + '-' + modeSlug + '-' + resLabel + '-render' + ext;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          if (typeof window.toast === 'function') {
            window.toast('✨ ' + resLabel.toUpperCase() + ' ' + modeTitle + ' Render Downloaded!');
          }
        } else {
          if (typeof window.toast === 'function') {
            window.toast('⚠️ Snapshot could not be generated on this device.');
          }
        }
      }, 80);
    },

    getUnitSVG: function (itemOrCat) {
      var item = itemOrCat;
      var cat = '';
      if (typeof itemOrCat === 'string') {
        cat = itemOrCat.toLowerCase();
        item = { category: cat, name: cat };
      } else if (itemOrCat && typeof itemOrCat === 'object') {
        cat = (itemOrCat.category || '').toLowerCase();
      } else {
        item = {};
      }

      // 1. Try to match exact catalog item from Core.FURNITURE_CATALOG
      var catalogItem = null;
      var catalog = (typeof Core !== 'undefined' && Core.FURNITURE_CATALOG) ? Core.FURNITURE_CATALOG : [];
      var targetId = (item.catalogId || item.id || item.code || '').toLowerCase();
      var targetName = (item.name || '').trim().toLowerCase();

      // Direct ID / code match
      if (targetId) {
        for (var i = 0; i < catalog.length; i++) {
          var cId = (catalog[i].id || '').toLowerCase();
          var cCode = (catalog[i].code || '').toLowerCase();
          if (cId === targetId || cCode === targetId) {
            catalogItem = catalog[i];
            break;
          }
        }
      }

      // Exact name match
      if (!catalogItem && targetName) {
        for (var j = 0; j < catalog.length; j++) {
          if ((catalog[j].name || '').trim().toLowerCase() === targetName) {
            catalogItem = catalog[j];
            break;
          }
        }
      }

      // Flexible normalized name matching (e.g. "FM 120" matches id "fm-120")
      if (!catalogItem && targetName) {
        var normTarget = targetName.replace(/[\s\-_]+/g, '');
        for (var k = 0; k < catalog.length; k++) {
          var normCatName = (catalog[k].name || '').toLowerCase().replace(/[\s\-_]+/g, '');
          var normCatId = (catalog[k].id || '').toLowerCase().replace(/[\s\-_]+/g, '');
          if (normCatName === normTarget || normCatId === normTarget ||
              normCatName.indexOf(normTarget) !== -1 || normTarget.indexOf(normCatName) !== -1) {
            catalogItem = catalog[k];
            break;
          }
        }
      }

      var matchedItem = catalogItem || item;

      // 2. Resolve unique high-res 2.5D illustration
      var iconSrc = '';
      if (typeof Core !== 'undefined' && typeof Core.getUnitIcon === 'function') {
        iconSrc = Core.getUnitIcon(matchedItem);
      } else if (typeof OrbixUnitIcons !== 'undefined' && typeof OrbixUnitIcons.getIcon === 'function') {
        iconSrc = OrbixUnitIcons.getIcon(matchedItem);
      }

      if (iconSrc) {
        return '<img src="' + iconSrc + '" alt="' + (matchedItem.name || 'Unit') + '" class="quote-iso-thumb" style="width:58px;height:58px;object-fit:contain;display:block;margin:0 auto;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.08));">';
      }

      var svg = '<svg width="68" height="68" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" class="quote-iso-thumb">';
      if (cat.indexOf('wardrobe') !== -1 || cat === 'w2d' || cat === 'w3d' || cat === 'w4d' || cat === 'w_slide') {
        svg += '<polygon points="50,14 84,27 84,82 50,69" fill="#5EBAAA" stroke="#2F756B" stroke-width="1.5"/>';
        svg += '<polygon points="16,27 50,14 50,69 16,82" fill="#8CE1D2" stroke="#2F756B" stroke-width="1.5"/>';
        svg += '<polygon points="50,14 84,27 50,40 16,27" fill="#E8FAF6" stroke="#2F756B" stroke-width="1.5"/>';
        svg += '<line x1="33" y1="21" x2="33" y2="76" stroke="#26645B" stroke-width="1.2"/>';
        svg += '<line x1="31" y1="46" x2="31" y2="56" stroke="#163E38" stroke-width="2" stroke-linecap="round"/>';
        svg += '<line x1="35" y1="46" x2="35" y2="56" stroke="#163E38" stroke-width="2" stroke-linecap="round"/>';
      } else if (cat.indexOf('kitchen') !== -1 || cat === 'k_base' || cat === 'k_wall' || cat === 'k_tall' || cat === 'k_island') {
        svg += '<polygon points="50,24 88,38 88,72 50,58" fill="#5EBAAA" stroke="#2F756B" stroke-width="1.5"/>';
        svg += '<polygon points="12,38 50,24 50,58 12,72" fill="#8CE1D2" stroke="#2F756B" stroke-width="1.5"/>';
        svg += '<polygon points="50,24 88,38 50,50 12,38" fill="#F0FAF8" stroke="#2F756B" stroke-width="1.5"/>';
        svg += '<line x1="12" y1="52" x2="50" y2="39" stroke="#26645B" stroke-width="1.2"/>';
        svg += '<line x1="28" y1="44" x2="35" y2="41" stroke="#163E38" stroke-width="2" stroke-linecap="round"/>';
        svg += '<line x1="28" y1="60" x2="35" y2="57" stroke="#163E38" stroke-width="2" stroke-linecap="round"/>';
      } else if (cat.indexOf('bed') !== -1) {
        svg += '<polygon points="50,26 88,42 88,62 50,47" fill="#C4B8A8" stroke="#877D70" stroke-width="1.5"/>';
        svg += '<polygon points="12,42 50,26 50,47 12,62" fill="#DFD7CB" stroke="#877D70" stroke-width="1.5"/>';
        svg += '<polygon points="50,26 88,42 50,56 12,42" fill="#FFFFFF" stroke="#877D70" stroke-width="1.5"/>';
        svg += '<polygon points="46,14 84,30 84,42 46,26" fill="#5EBAAA" stroke="#2F756B" stroke-width="1.5"/>';
      } else if (cat.indexOf('tv') !== -1) {
        svg += '<polygon points="18,12 50,3 82,12 82,38 50,28 18,38" fill="#F4EEE4" stroke="#9A9287" stroke-width="1"/>';
        svg += '<polygon points="50,32 90,44 90,66 50,55" fill="#5EBAAA" stroke="#2F756B" stroke-width="1.5"/>';
        svg += '<polygon points="10,44 50,32 50,55 10,66" fill="#8CE1D2" stroke="#2F756B" stroke-width="1.5"/>';
        svg += '<polygon points="50,32 90,44 50,54 10,44" fill="#E8F9F5" stroke="#2F756B" stroke-width="1.5"/>';
      } else {
        svg += '<polygon points="50,18 86,31 86,75 50,64" fill="#5EBAAA" stroke="#2F756B" stroke-width="1.5"/>';
        svg += '<polygon points="14,31 50,18 50,64 14,75" fill="#8CE1D2" stroke="#2F756B" stroke-width="1.5"/>';
        svg += '<polygon points="50,18 86,31 50,43 14,31" fill="#E8FAF6" stroke="#2F756B" stroke-width="1.5"/>';
        svg += '<line x1="32" y1="46" x2="32" y2="56" stroke="#163E38" stroke-width="2" stroke-linecap="round"/>';
      }
      svg += '</svg>';
      return svg;
    },

    getHardwareSVG: function (type) {
      if (type === 'hinge') {
        return '<svg width="28" height="28" viewBox="0 0 32 32" fill="none"><rect x="6" y="8" width="8" height="16" rx="2" fill="#A0AEC0"/><circle cx="22" cy="16" r="6" fill="#718096"/><circle cx="22" cy="16" r="2.5" fill="#4A5568"/><line x1="14" y1="16" x2="16" y2="16" stroke="#2D3748" stroke-width="2"/></svg>';
      } else if (type === 'runner') {
        return '<svg width="28" height="28" viewBox="0 0 32 32" fill="none"><rect x="4" y="10" width="24" height="4" rx="1" fill="#718096"/><rect x="8" y="18" width="20" height="4" rx="1" fill="#A0AEC0"/><circle cx="10" cy="12" r="1" fill="#2D3748"/><circle cx="22" cy="12" r="1" fill="#2D3748"/></svg>';
      } else if (type === 'handle') {
        return '<svg width="28" height="28" viewBox="0 0 32 32" fill="none"><rect x="14" y="4" width="4" height="24" rx="2" fill="#2D3748"/><circle cx="16" cy="8" r="1.5" fill="#CBD5E0"/><circle cx="16" cy="24" r="1.5" fill="#CBD5E0"/></svg>';
      } else if (type === 'rod') {
        return '<svg width="28" height="28" viewBox="0 0 32 32" fill="none"><rect x="4" y="14" width="24" height="4" rx="2" fill="#CBD5E0" stroke="#718096"/><circle cx="5" cy="16" r="3" fill="#A0AEC0"/><circle cx="27" cy="16" r="3" fill="#A0AEC0"/></svg>';
      } else {
        return '<svg width="28" height="28" viewBox="0 0 32 32" fill="none"><rect x="8" y="14" width="16" height="12" rx="2" fill="#D69E2E"/><path d="M12 14V10a4 4 0 0 1 8 0v4" stroke="#D69E2E" stroke-width="2.5" fill="none"/><circle cx="16" cy="20" r="1.5" fill="#744210"/></svg>';
      }
    },

    openAddonsPickerModal: function (onApply) {
      var self = this;
      var catalog = (typeof Core !== 'undefined' && Core.getCookscapeAddonsCatalog)
        ? Core.getCookscapeAddonsCatalog()
        : [];
      if (!catalog.length) return;

      var currentCharges = this.getCommercialCharges();
      var selectedMap = {};
      (currentCharges.selectedAddons || []).forEach(function (it) {
        selectedMap[it.id] = Math.max(0, Number(it.qty || 1));
      });

      var modalId = 'orbixAddonsModal';
      var modal = document.getElementById(modalId);
      if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;display:flex;align-items:center;justify-content:center;';
        document.body.appendChild(modal);
      }

      var categories = ['All'];
      catalog.forEach(function (it) {
        if (it.category && categories.indexOf(it.category) === -1) {
          categories.push(it.category);
        }
      });

      var activeCategory = 'All';
      var searchQuery = '';

      function renderModalContent() {
        var filtered = catalog.filter(function (it) {
          var matchCat = (activeCategory === 'All') || (it.category === activeCategory);
          var matchSearch = !searchQuery || (it.name.toLowerCase().indexOf(searchQuery.toLowerCase()) !== -1) || (it.category.toLowerCase().indexOf(searchQuery.toLowerCase()) !== -1);
          return matchCat && matchSearch;
        });

        var selectedCount = 0;
        var selectedTotal = 0;
        catalog.forEach(function (it) {
          var q = selectedMap[it.id] || 0;
          if (q > 0) {
            selectedCount += q;
            selectedTotal += q * (it.rate || 0);
          }
        });

        modal.innerHTML =
          '<div class="addons-backdrop" style="position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(8,35,27,0.65);backdrop-filter:blur(3px);"></div>' +
          '<div class="addons-dialog" style="position:relative;background:#FFF;border-radius:12px;width:min(900px, 94vw);max-height:88vh;display:flex;flex-direction:column;box-shadow:0 20px 50px rgba(0,0,0,0.3);overflow:hidden;border:1px solid #E2E8F0;font-family:\'Segoe UI\',system-ui,sans-serif;">' +

          // Header
          '  <div style="background:#08231B;color:#FFF;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;">' +
          '    <div>' +
          '      <h3 style="margin:0;font-size:16px;font-weight:700;display:flex;align-items:center;gap:8px;">🛍️ Cookscape Master Add-Ons &amp; Accessories Catalog</h3>' +
          '      <div style="font-size:11.5px;color:#A7F3D0;margin-top:2px;">58 Master Hardware Items &bull; Will appear below Your Savings in the Client Proposal</div>' +
          '    </div>' +
          '    <button type="button" class="addons-close-btn" style="background:transparent;border:none;color:#FFF;font-size:22px;cursor:pointer;padding:0 4px;line-height:1;">&times;</button>' +
          '  </div>' +

          // Search & Category Filters
          '  <div style="background:#FAF6F0;padding:12px 20px;border-bottom:1px solid #E2D5C3;display:flex;flex-direction:column;gap:10px;">' +
          '    <input type="text" id="addonsSearchInput" value="' + searchQuery.replace(/"/g, '&quot;') + '" placeholder="🔍 Search by name or category (e.g. Magic Corner, Pantry, Basket, Cot, Shutter)..." style="width:100%;padding:8px 12px;border:1.5px solid #CBD5E1;border-radius:7px;font-size:13px;outline:none;background:#FFF;">' +
          '    <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:2px;" id="addonsCatPills">' +
          categories.map(function (cat) {
            var isSel = cat === activeCategory;
            return '<button type="button" class="addons-cat-btn" data-cat="' + cat.replace(/"/g, '&quot;') + '" style="padding:4px 10px;border-radius:20px;font-size:11.5px;font-weight:700;cursor:pointer;white-space:nowrap;border:1px solid ' + (isSel ? '#08231B' : '#CBD5E1') + ';background:' + (isSel ? '#08231B' : '#FFF') + ';color:' + (isSel ? '#FFF' : '#334155') + ';">' + cat + '</button>';
          }).join('') +
          '    </div>' +
          '  </div>' +

          // Item List Body
          '  <div style="flex:1;overflow-y:auto;padding:12px 20px;" id="addonsItemList">' +
          '    <table style="width:100%;border-collapse:collapse;font-size:12.5px;">' +
          '      <thead>' +
          '        <tr style="border-bottom:2px solid #E2E8F0;color:#64748B;font-size:11px;text-align:left;">' +
          '          <th style="padding:6px 8px;">ITEM NAME &amp; CATEGORY</th>' +
          '          <th style="padding:6px 8px;text-align:right;">UNIT RATE</th>' +
          '          <th style="padding:6px 8px;text-align:center;width:130px;">QUANTITY</th>' +
          '          <th style="padding:6px 8px;text-align:right;width:110px;">SUBTOTAL</th>' +
          '        </tr>' +
          '      </thead>' +
          '      <tbody>' +
          (filtered.length ? filtered.map(function (it) {
            var q = selectedMap[it.id] || 0;
            var sub = q * (it.rate || 0);
            var isCustom = it.isCustom;
            var customRange = isCustom ? (' (' + (it.minRate || 0) + '-' + (it.maxRate || 0) + '/' + (it.unit || '') + ')') : '';
            return '<tr style="border-bottom:1px solid #F1F5F9;' + (q > 0 ? 'background:#F0FDF4;' : '') + '">' +
              '<td style="padding:8px;">' +
              '  <div style="font-weight:700;color:#08231B;">' + it.name + '</div>' +
              '  <div style="font-size:11px;color:#64748B;">' + it.category + customRange + '</div>' +
              '</td>' +
              '<td style="padding:8px;text-align:right;font-family:monospace;font-weight:600;color:#08231B;">₹ ' + (it.rate || 0).toLocaleString('en-IN') + '</td>' +
              '<td style="padding:8px;text-align:center;">' +
              '  <div style="display:inline-flex;align-items:center;border:1px solid #CBD5E1;border-radius:6px;overflow:hidden;background:#FFF;">' +
              '    <button type="button" class="addons-qty-btn" data-id="' + it.id + '" data-delta="-1" style="width:28px;height:26px;border:none;background:#F8FAFC;cursor:pointer;font-weight:700;color:#334155;">-</button>' +
              '    <input type="number" min="0" class="addons-qty-inp" data-id="' + it.id + '" value="' + q + '" style="width:42px;height:26px;border:none;border-left:1px solid #E2E8F0;border-right:1px solid #E2E8F0;text-align:center;font-weight:700;font-size:12px;">' +
              '    <button type="button" class="addons-qty-btn" data-id="' + it.id + '" data-delta="1" style="width:28px;height:26px;border:none;background:#F8FAFC;cursor:pointer;font-weight:700;color:#334155;">+</button>' +
              '  </div>' +
              '</td>' +
              '<td style="padding:8px;text-align:right;font-family:monospace;font-weight:700;color:' + (q > 0 ? '#166534' : '#94A3B8') + ';">₹ ' + sub.toLocaleString('en-IN') + '</td>' +
              '</tr>';
          }).join('') : '<tr><td colspan="4" style="text-align:center;padding:30px;color:#64748B;">No add-on items found matching search.</td></tr>') +
          '      </tbody>' +
          '    </table>' +
          '  </div>' +

          // Sticky Footer
          '  <div style="background:#FAF6F0;border-top:1px solid #E2D5C3;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;">' +
          '    <div>' +
          '      <span style="font-size:12px;color:#475569;font-weight:600;">Selected Add-Ons: </span>' +
          '      <b style="color:#08231B;font-size:13px;">' + selectedCount + ' items</b> &bull; ' +
          '      <span style="font-size:12px;color:#475569;font-weight:600;">Subtotal: </span>' +
          '      <b style="color:#166534;font-size:15px;font-family:monospace;">₹ ' + selectedTotal.toLocaleString('en-IN') + '</b>' +
          '    </div>' +
          '    <div style="display:flex;gap:10px;">' +
          '      <button type="button" class="addons-close-btn btn" style="background:#E2E8F0;color:#1E293B;border-radius:6px;padding:7px 14px;font-size:12.5px;font-weight:700;border:none;cursor:pointer;">Cancel</button>' +
          '      <button type="button" id="addonsApplyBtn" class="btn" style="background:#08231B;color:#FFF;border-radius:6px;padding:7px 18px;font-size:12.5px;font-weight:700;border:none;cursor:pointer;">✅ Apply to Quotation</button>' +
          '    </div>' +
          '  </div>' +
          '</div>';

        // Bind events inside modal
        modal.querySelectorAll('.addons-close-btn, .addons-backdrop').forEach(function (el) {
          el.addEventListener('click', function () {
            modal.style.display = 'none';
          });
        });

        var sInp = modal.querySelector('#addonsSearchInput');
        if (sInp) {
          sInp.addEventListener('input', function () {
            searchQuery = sInp.value;
            renderModalContent();
            var restored = modal.querySelector('#addonsSearchInput');
            if (restored) {
              restored.focus();
              restored.setSelectionRange(restored.value.length, restored.value.length);
            }
          });
        }

        modal.querySelectorAll('.addons-cat-btn').forEach(function (btn) {
          btn.addEventListener('click', function () {
            activeCategory = btn.getAttribute('data-cat');
            renderModalContent();
          });
        });

        modal.querySelectorAll('.addons-qty-btn').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var id = btn.getAttribute('data-id');
            var delta = Number(btn.getAttribute('data-delta')) || 0;
            var cur = selectedMap[id] || 0;
            var next = Math.max(0, cur + delta);
            if (next === 0) delete selectedMap[id];
            else selectedMap[id] = next;
            renderModalContent();
          });
        });

        modal.querySelectorAll('.addons-qty-inp').forEach(function (inp) {
          inp.addEventListener('change', function () {
            var id = inp.getAttribute('data-id');
            var val = Math.max(0, parseInt(inp.value, 10) || 0);
            if (val === 0) delete selectedMap[id];
            else selectedMap[id] = val;
            renderModalContent();
          });
        });

        var applyBtn = modal.querySelector('#addonsApplyBtn');
        if (applyBtn) {
          applyBtn.addEventListener('click', function () {
            var chosen = [];
            var totalAmt = 0;
            catalog.forEach(function (it) {
              var q = selectedMap[it.id] || 0;
              if (q > 0) {
                var amt = q * (it.rate || 0);
                chosen.push({
                  id: it.id,
                  name: it.name,
                  category: it.category,
                  rate: it.rate,
                  qty: q,
                  amount: amt
                });
                totalAmt += amt;
              }
            });

            self.project.commercialCharges = self.project.commercialCharges || {};
            self.project.commercialCharges.selectedAddons = chosen;
            self.project.commercialCharges.additionalAccessories = totalAmt;
            self.project.commercialCharges.accessoriesEnabled = true;

            modal.style.display = 'none';
            if (typeof onApply === 'function') onApply();
          });
        }
      }

      modal.style.display = 'flex';
      renderModalContent();
    },

    downloadPDF: function () {
      this.sync3DStudioUnits();
      var oldTitle = document.title;
      var qId = (this.project && this.project.meta && this.project.meta.quoteId) || 'ORB-2026-089';
      document.title = 'Residential-Interior-Estimation-' + qId;
      window.print();
      setTimeout(function () {
        document.title = oldTitle;
      }, 1000);
    },

    exportXLSX: async function () {
      var self = this;
      this.sync3DStudioUnits();
      var quote = Core.generateFullQuotation(this.project, this.selectedBOQRooms, this.selectedBOQFloor);
      var currentTier = (this.project.rateCard && (Core.normalizeTierName ? Core.normalizeTierName(this.project.rateCard.selectedTier) : this.project.rateCard.selectedTier)) || 'zappo - el pearl';
      var meta = (this.project && this.project.meta) || {};
      var floorScopeText = (this.selectedBOQFloor && this.selectedBOQFloor !== 'all') ? ('Floor: ' + this.selectedBOQFloor + ' · ') : 'All Floors · ';
      var roomScopeText = quote.isFiltered ? (floorScopeText + 'Filtered: ' + (self.selectedBOQRooms || []).join(', ')) : (floorScopeText + 'All Rooms (Entire Home)');

      // UI Button feedback
      var xlsxBtn = document.getElementById('boqXlsxBtn');
      var oldBtnText = xlsxBtn ? xlsxBtn.innerHTML : '';
      if (xlsxBtn) {
        xlsxBtn.innerHTML = '⏳ Generating Excel (.xlsx)...';
        xlsxBtn.style.opacity = '0.7';
        xlsxBtn.style.pointerEvents = 'none';
      }

      try {
        // 1. Resolve Logo Bytes
        var logoBytes = null;
        if (typeof OrbixUnitIcons !== 'undefined' && OrbixUnitIcons.LOGO_BASE64) {
          try {
            var b64Logo = OrbixUnitIcons.LOGO_BASE64;
            var binLogo = atob(b64Logo);
            logoBytes = new Uint8Array(binLogo.length);
            for (var lb = 0; lb < binLogo.length; lb++) logoBytes[lb] = binLogo.charCodeAt(lb);
          } catch (_) {}
        }
        if (!logoBytes && typeof document !== 'undefined') {
          var logoEl = document.querySelector('img.tool-logo') || document.querySelector('img.auth-logo') || document.querySelector('img[src*="logo"]');
          if (logoEl && logoEl.src && logoEl.src.indexOf('data:image/') === 0) {
            try {
              var spl = logoEl.src.split(',')[1];
              var bstr = atob(spl);
              logoBytes = new Uint8Array(bstr.length);
              for (var li = 0; li < bstr.length; li++) logoBytes[li] = bstr.charCodeAt(li);
            } catch (_) {}
          }
        }
        if (!logoBytes && typeof fetch === 'function') {
          try {
            var res = await fetch('logo.jpeg');
            if (res.ok) {
              var buf = await res.arrayBuffer();
              logoBytes = new Uint8Array(buf);
            }
          } catch (_) {}
        }

        // 2. Helper to rasterize SVG into PNG bytes via Canvas
        var rasterizeCache = {};
        function rasterizeSvgToPng(svgDataUriOrString) {
          return new Promise(function (resolve) {
            if (!svgDataUriOrString) { resolve(null); return; }
            var src = svgDataUriOrString;
            if (typeof src === 'string' && src.indexOf('<img') !== -1) {
              var m = src.match(/src=["']([^"']+)["']/);
              if (m) src = m[1];
            }
            if (typeof src === 'string' && src.indexOf('<svg') !== -1 && src.indexOf('data:image') === -1) {
              src = 'data:image/svg+xml;utf8,' + encodeURIComponent(src);
            }
            if (rasterizeCache[src]) {
              resolve(rasterizeCache[src]);
              return;
            }
            if (typeof document === 'undefined' || typeof Image === 'undefined') {
              resolve(null);
              return;
            }
            try {
              var img = new Image();
              img.crossOrigin = 'anonymous';
              img.onload = function () {
                try {
                  var canvas = document.createElement('canvas');
                  canvas.width = 120;
                  canvas.height = 120;
                  var ctx = canvas.getContext('2d');
                  ctx.clearRect(0, 0, 120, 120);
                  ctx.drawImage(img, 0, 0, 120, 120);
                  var dataUrl = canvas.toDataURL('image/png');
                  var b64 = dataUrl.split(',')[1];
                  var bin = atob(b64);
                  var arr = new Uint8Array(bin.length);
                  for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
                  rasterizeCache[src] = arr;
                  resolve(arr);
                } catch (e) {
                  resolve(null);
                }
              };
              img.onerror = function () {
                resolve(null);
              };
              img.src = src;
            } catch (err) {
              resolve(null);
            }
          });
        }

        // 3. Pre-rasterize unit preview illustrations in parallel
        var unitThumbnails = [];
        for (var fIdx = 0; fIdx < quote.furnitureItems.length; fIdx++) {
          var item = quote.furnitureItems[fIdx];
          var svgThumb = self.getUnitSVG(item);
          unitThumbnails.push(rasterizeSvgToPng(svgThumb));
        }
        var thumbResults = await Promise.all(unitThumbnails);

        // 4. Commercial estimate values
        var comm = self.computeCommercialSummary(quote.subtotalWoodwork, self.project.commercialCharges);
        var commCharges = self.getCommercialCharges();

        // 5. Build OpenXML Workbook structure
        var blob = self.buildExecutivePricingXLSX({
          project: self.project,
          quote: quote,
          currentTier: currentTier,
          roomScopeText: roomScopeText,
          meta: meta,
          comm: comm,
          commCharges: commCharges,
          logoBytes: logoBytes,
          thumbResults: thumbResults
        });

        // 6. Trigger download
        var filename = 'Residential-Interior-Estimation-' + (meta.quoteId || 'ORB-2026-089') + '.xlsx';
        var link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        setTimeout(function () {
          document.body.removeChild(link);
          URL.revokeObjectURL(link.href);
        }, 500);

      } catch (err) {
        console.error('Error generating Excel workbook:', err);
        alert('Could not generate Excel file: ' + (err.message || err));
      } finally {
        if (xlsxBtn) {
          xlsxBtn.innerHTML = oldBtnText || '📊 Download Excel (.xlsx)';
          xlsxBtn.style.opacity = '1';
          xlsxBtn.style.pointerEvents = 'auto';
        }
      }
    },

    buildExecutivePricingXLSX: function (params) {
      var project = params.project;
      var quote = params.quote;
      var currentTier = params.currentTier;
      var roomScopeText = params.roomScopeText;
      var meta = params.meta;
      var comm = params.comm;
      var commCharges = params.commCharges;
      var logoBytes = params.logoBytes;
      var thumbResults = params.thumbResults || [];

      function colLetter(colIdx) {
        var s = '';
        colIdx++;
        while (colIdx > 0) {
          var m = (colIdx - 1) % 26;
          s = String.fromCharCode(65 + m) + s;
          colIdx = Math.floor((colIdx - m) / 26);
        }
        return s;
      }

      function escapeXml(str) {
        return String(str === undefined || str === null ? '' : str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      }

      var cells = [];
      var rowHeights = {};
      var mergeCells = [];
      var drawings = [];
      var mediaFiles = [];
      var drawingRelIndex = 1;

      // Embed Logo Drawing Anchor
      if (logoBytes && logoBytes.length > 0) {
        var logoRId = 'rId' + (drawingRelIndex++);
        mediaFiles.push({ name: 'logo.jpeg', data: logoBytes, rId: logoRId, ext: 'jpeg' });
        drawings.push({
          type: 'logo',
          rId: logoRId,
          fromCol: 0, fromColOff: 80000, fromRow: 0, fromRowOff: 60000,
          toCol: 3, toColOff: 200000, toRow: 3, toRowOff: 120000
        });
      }

      function setCell(r, c, val, styleId, type) {
        cells.push({ r: r, c: c, val: val, s: styleId || 0, t: type });
      }

      function addMerge(fromCol, fromRow, toCol, toRow) {
        mergeCells.push(colLetter(fromCol) + fromRow + ':' + colLetter(toCol) + toRow);
      }

      // Group units by room
      var itemsByRoom = {};
      var roomNamesOrder = [];
      for (var f = 0; f < quote.furnitureItems.length; f++) {
        var it = quote.furnitureItems[f];
        var rmName = it.roomName || 'General';
        if (!itemsByRoom[rmName]) {
          itemsByRoom[rmName] = [];
          roomNamesOrder.push(rmName);
        }
        itemsByRoom[rmName].push(it);
      }

      // Dynamic Hardware Calculation
      var totalHinges = 0;
      var totalDrawers = 0;
      var totalHandles = 0;
      var totalWardrobeRails = 0;
      var totalLocks = 0;
      for (var fi = 0; fi < quote.furnitureItems.length; fi++) {
        var uItem = quote.furnitureItems[fi];
        var uCfg = uItem.unitConfig || {};
        var uDims = uItem.dimensions || {};
        var isWardrobe = (uItem.category === 'wardrobe');
        var isSliding = (uItem.modelType === 'wr_sliding' || (uItem.name && uItem.name.toLowerCase().indexOf('sliding') !== -1));
        var numShutters = (uCfg.shutters !== undefined) ? uCfg.shutters : 1;
        var numDrawers = uCfg.drawers || 0;
        if (!isSliding && numShutters > 0) {
          var hPerShutter = (uDims.H > 2100) ? 4 : (uDims.H > 1500) ? 3 : 2;
          totalHinges += numShutters * hPerShutter;
        }
        totalDrawers += numDrawers;
        totalHandles += (numShutters + numDrawers);
        if (isWardrobe) {
          totalWardrobeRails += Math.max(1, Math.round((uDims.W || 1200) / 900));
          if (numDrawers > 0) totalLocks += 1;
        }
      }

      var hwItems = [];
      if (totalHinges > 0) hwItems.push({ code: 'H-01', name: 'Auto Soft-Close Hinges', spec: 'Stainless Steel 304', qty: totalHinges, unit: 'nos', rate: 0 });
      if (totalDrawers > 0) hwItems.push({ code: 'H-02', name: 'Telescopic Drawer Channels', spec: 'Triple Extension Heavy-Duty', qty: totalDrawers, unit: 'pair', rate: 0 });
      if (totalHandles > 0) hwItems.push({ code: 'H-03', name: 'Designer Edge Profile Handles', spec: 'Matte Charcoal Aluminum', qty: totalHandles, unit: 'nos', rate: 0 });
      if (totalWardrobeRails > 0) hwItems.push({ code: 'H-04', name: 'Wardrobe Hanging Oval Rails', spec: 'Chrome Plated Oval Rail', qty: totalWardrobeRails, unit: 'nos', rate: 0 });
      if (totalLocks > 0) hwItems.push({ code: 'H-05', name: 'Precision Cam Locks', spec: 'Brass Core with Dimple Keys', qty: totalLocks, unit: 'nos', rate: 0 });

      // --- ROW 1-5: TOP BANNER ---
      rowHeights[1] = 26;
      rowHeights[2] = 20;
      rowHeights[3] = 18;
      rowHeights[4] = 18;
      rowHeights[5] = 18;

      setCell(1, 4, 'COOKSCAPE — INTERIORS AND BEYOND', 1);
      addMerge(4, 1, 10, 1);

      setCell(2, 4, 'ORBIX STUDIO — RESIDENTIAL INTERIOR ESTIMATION & QUOTATION', 2);
      addMerge(4, 2, 10, 2);

      // Meta Box Row 3
      setCell(3, 4, 'Quote Ref #:', 3);
      setCell(3, 5, meta.cpCode || meta.quoteId || 'CP-9042', 4);
      setCell(3, 6, 'Date:', 3);
      setCell(3, 7, OrbixUI.formatDisplayDate(meta.dateTime || meta.dateCreated, true) || '05-Nov-2026 23:36', 4);
      setCell(3, 8, 'Status:', 3);
      setCell(3, 9, meta.status || 'Approved Estimate', 4);
      setCell(3, 10, '', 4);
      addMerge(9, 3, 10, 3);

      // Meta Box Row 4
      setCell(4, 4, 'Client Name:', 3);
      setCell(4, 5, meta.clientName || 'Client', 4);
      setCell(4, 6, 'Contact:', 3);
      setCell(4, 7, meta.phone || meta.contactNumber || '—', 4);
      setCell(4, 8, 'Active Tier:', 3);
      setCell(4, 9, currentTier, 4);
      setCell(4, 10, '', 4);
      addMerge(9, 4, 10, 4);

      // Meta Box Row 5
      setCell(5, 4, 'Site Address:', 3);
      setCell(5, 5, meta.siteAddress || meta.siteLocation || meta.location || '—', 4);
      setCell(5, 6, '', 4);
      setCell(5, 7, '', 4);
      addMerge(5, 5, 7, 5);
      setCell(5, 8, 'BH Name:', 3);
      setCell(5, 9, meta.bhName || meta.designerName || 'Designer', 4);
      setCell(5, 10, '', 4);
      addMerge(9, 5, 10, 5);

      var currRow = 6;
      rowHeights[currRow] = 10;
      currRow++;

      // --- SECTION 1: PRODUCTS & MODULAR WOODWORK ---
      setCell(currRow, 0, '1. Products & Modular Woodwork (All Rooms)', 5);
      for (var c1 = 1; c1 <= 10; c1++) setCell(currRow, c1, '', 5);
      addMerge(0, currRow, 10, currRow);
      rowHeights[currRow] = 26;
      currRow++;

      var colHeaders1 = [
        'No', 'Reference', 'Preview', 'Item Description',
        'Dimensions (mm)', 'Category', 'Finishes (Shutter & Carcass)',
        'Accessories', 'Unit Price (INR)', 'Quantity', 'Price (INR)'
      ];
      for (var ch = 0; ch < colHeaders1.length; ch++) {
        setCell(currRow, ch, colHeaders1[ch], 6);
      }
      rowHeights[currRow] = 24;
      currRow++;

      var globalItemIdx = 0;
      for (var rOrd = 0; rOrd < roomNamesOrder.length; rOrd++) {
        var rName = roomNamesOrder[rOrd];
        var rItems = itemsByRoom[rName];
        var rSubtotal = 0;
        for (var ri = 0; ri < rItems.length; ri++) rSubtotal += rItems[ri].totalAmount;

        var rFound = (project.plan && project.plan.rooms ? project.plan.rooms : []).filter(function (rm) {
          return rm.name === rName || rm.id === (rItems[0] && rItems[0].roomId);
        })[0];
        var rActiveTier = (rFound && rFound.variant) || currentTier;

        // Room Header Bar
        var flPrefix = (rItems[0] && rItems[0].floorName) ? ('🏢 ' + rItems[0].floorName + ' · ') : '';
        var roomTitleText = flPrefix + '🏠 Room: ' + rName + ' · ' + rItems.length + ' Units · Variant: ' + rActiveTier;
        setCell(currRow, 0, roomTitleText, 7);
        for (var rc = 1; rc <= 7; rc++) setCell(currRow, rc, '', 7);
        addMerge(0, currRow, 7, currRow);

        setCell(currRow, 8, 'Room Subtotal:', 8);
        setCell(currRow, 9, '', 8);
        addMerge(8, currRow, 9, currRow);
        setCell(currRow, 10, Math.round(rSubtotal), 8, 'n');
        rowHeights[currRow] = 22;
        currRow++;

        for (var fi = 0; fi < rItems.length; fi++) {
          var it = rItems[fi];
          globalItemIdx++;
          var isZebra = (globalItemIdx % 2 === 0);
          var sLeft = isZebra ? 13 : 9;
          var sCenter = isZebra ? 14 : 10;
          var sNum = isZebra ? 15 : 11;
          var sCur = isZebra ? 16 : 12;

          var d = it.dimensions || { W: 1200, H: 2100, D: 600 };
          var refCode = it.refCode || ('C' + (12 + globalItemIdx));
          var smat = (it.materials && it.materials.shutter) ? it.materials.shutter : { material: 'HDHMR_18MM', finish: 'Brazilian Horizontal Walnut' };
          var cmat = (it.materials && it.materials.carcass) ? it.materials.carcass : { material: 'BWP_18MM', finish: 'Absolute White' };

          // Embed Unit Preview Thumbnail
          var thumbPng = thumbResults[globalItemIdx - 1];
          if (thumbPng && thumbPng.length > 0) {
            var imgRId = 'rId' + (drawingRelIndex++);
            var imgFileName = 'unit_' + globalItemIdx + '.png';
            mediaFiles.push({ name: imgFileName, data: thumbPng, rId: imgRId, ext: 'png' });
            drawings.push({
              type: 'preview',
              rId: imgRId,
              fromCol: 2, fromColOff: 120000, fromRow: currRow - 1, fromRowOff: 50000,
              toCol: 2, toColOff: 900000, toRow: currRow, toRowOff: -50000
            });
          }

          setCell(currRow, 0, globalItemIdx, sCenter, 'n');
          setCell(currRow, 1, refCode, sCenter);
          setCell(currRow, 2, '', sCenter);
          setCell(currRow, 3, it.name + (it.floorName ? ('\nFloor: 🏢 ' + it.floorName) : '') + '\nGroup: ' + (it.modelLabel || it.modelType || 'Cabinet') + '\nModel: ' + it.name, sLeft);
          setCell(currRow, 4, 'Width: ' + d.W + '\nDepth: ' + d.D + '\nHeight: ' + d.H, sLeft);
          setCell(currRow, 5, it.categoryName || 'Wardrobe', sCenter);
          setCell(currRow, 6, 'Shutter: ' + smat.material + ' (' + smat.finish + ')\nCarcass: ' + cmat.material + ' (' + cmat.finish + ')', sLeft);
          setCell(currRow, 7, 'Auto Soft-Close Hinges\nCam Connectors', sLeft);
          setCell(currRow, 8, it.baseRate || 0, sNum, 'n');
          setCell(currRow, 9, (it.areaSft != null ? it.areaSft.toFixed(2) : '0.00') + ' sq foot', sNum);
          setCell(currRow, 10, Math.round(it.totalAmount || 0), sCur, 'n');

          rowHeights[currRow] = 58; // High row height for thumbnail
          currRow++;
        }
      }

      // Subtotal Woodwork Row
      setCell(currRow, 0, 'SUBTOTAL PRODUCTS (ALL ROOMS)', 17);
      for (var sc = 1; sc <= 9; sc++) setCell(currRow, sc, '', 17);
      addMerge(0, currRow, 9, currRow);
      setCell(currRow, 10, Math.round(quote.subtotalWoodwork), 18, 'n');
      rowHeights[currRow] = 24;
      currRow++;

      currRow++; // Spacing row

      // --- SECTION 2: HARDWARE & FUNCTIONAL FITTINGS ---
      if (hwItems.length > 0) {
        setCell(currRow, 0, '2. Hardware & Functional Fittings Specifications', 5);
        for (var hwc = 1; hwc <= 10; hwc++) setCell(currRow, hwc, '', 5);
        addMerge(0, currRow, 10, currRow);
        rowHeights[currRow] = 24;
        currRow++;

        var colHeaders2 = [
          'No', 'Reference', 'Preview', 'Specification',
          'Fitment', 'Category', 'Material Spec',
          'Package', 'Unit Rate (INR)', 'Quantity', 'Price (INR)'
        ];
        for (var hc = 0; hc < colHeaders2.length; hc++) {
          setCell(currRow, hc, colHeaders2[hc], 6);
        }
        rowHeights[currRow] = 22;
        currRow++;

        for (var h = 0; h < hwItems.length; h++) {
          var hw = hwItems[h];
          var isHwZebra = (h % 2 === 1);
          var sHwLeft = isHwZebra ? 13 : 9;
          var sHwCenter = isHwZebra ? 14 : 10;
          var sHwNum = isHwZebra ? 15 : 11;
          var sHwCur = isHwZebra ? 16 : 12;

          setCell(currRow, 0, quote.furnitureItems.length + h + 1, sHwCenter, 'n');
          setCell(currRow, 1, hw.code, sHwCenter);
          setCell(currRow, 2, '⚙️', sHwCenter);
          setCell(currRow, 3, hw.name, sHwLeft);
          setCell(currRow, 4, 'Standard Fit', sHwCenter);
          setCell(currRow, 5, 'Hardware', sHwCenter);
          setCell(currRow, 6, hw.spec, sHwLeft);
          setCell(currRow, 7, 'System Pack', sHwCenter);
          setCell(currRow, 8, 0, sHwNum, 'n');
          setCell(currRow, 9, hw.qty + ' ' + hw.unit, sHwNum);
          setCell(currRow, 10, 0, sHwCur, 'n');

          rowHeights[currRow] = 22;
          currRow++;
        }

        setCell(currRow, 0, 'SUBTOTAL HARDWARE & FUNCTIONAL FITTINGS', 17);
        for (var sh = 1; sh <= 9; sh++) setCell(currRow, sh, '', 17);
        addMerge(0, currRow, 9, currRow);
        setCell(currRow, 10, 0, 18, 'n');
        rowHeights[currRow] = 24;
        currRow++;

        currRow++; // Spacing row
      }

      // --- SECTION 2.5: FLOOR-WISE MODULAR WOODWORK BREAKDOWN ---
      if (quote.allFloorsSummary && quote.allFloorsSummary.length > 1) {
        setCell(currRow, 0, '2.5. Floor-Wise Modular Woodwork Breakdown (Pure Cabinetry Only)', 5);
        for (var fwc = 1; fwc <= 10; fwc++) setCell(currRow, fwc, '', 5);
        addMerge(0, currRow, 10, currRow);
        rowHeights[currRow] = 24;
        currRow++;

        setCell(currRow, 0, 'Floor Name', 6);
        for (var fn = 1; fn <= 3; fn++) setCell(currRow, fn, '', 6);
        addMerge(0, currRow, 3, currRow);

        setCell(currRow, 4, 'Level', 6);
        setCell(currRow, 5, 'Modular Units', 6);

        setCell(currRow, 6, 'Share of Total', 6);
        for (var fsh = 7; fsh <= 7; fsh++) setCell(currRow, fsh, '', 6);
        addMerge(6, currRow, 7, currRow);

        setCell(currRow, 8, 'Woodwork Subtotal (INR)', 6);
        for (var fst = 9; fst <= 10; fst++) setCell(currRow, fst, '', 6);
        addMerge(8, currRow, 10, currRow);
        rowHeights[currRow] = 22;
        currRow++;

        for (var flIdx = 0; flIdx < quote.allFloorsSummary.length; flIdx++) {
          var flSummary = quote.allFloorsSummary[flIdx];
          var isFZebra = (flIdx % 2 === 1);
          var sFLCenter = isFZebra ? 13 : 9;
          var sFLLeft = isFZebra ? 14 : 10;
          var sFLNum = isFZebra ? 15 : 11;
          var sFLCur = isFZebra ? 16 : 12;

          setCell(currRow, 0, '🏢 ' + flSummary.name, sFLLeft);
          for (var fls = 1; fls <= 3; fls++) setCell(currRow, fls, '', sFLLeft);
          addMerge(0, currRow, 3, currRow);

          setCell(currRow, 4, 'Level ' + flSummary.level, sFLCenter);
          setCell(currRow, 5, flSummary.itemCount + ' Units', sFLCenter);

          setCell(currRow, 6, flSummary.percentShare + '%', sFLCenter);
          setCell(currRow, 7, '', sFLCenter);
          addMerge(6, currRow, 7, currRow);

          setCell(currRow, 8, Math.round(flSummary.woodworkSubtotal), sFLCur, 'n');
          for (var fla = 9; fla <= 10; fla++) setCell(currRow, fla, '', sFLCur);
          addMerge(8, currRow, 10, currRow);

          rowHeights[currRow] = 22;
          currRow++;
        }

        setCell(currRow, 0, 'TOTAL MODULAR WOODWORK (ALL FLOORS)', 17);
        for (var ft = 1; ft <= 7; ft++) setCell(currRow, ft, '', 17);
        addMerge(0, currRow, 7, currRow);
        setCell(currRow, 8, Math.round(quote.subtotalWoodwork), 18, 'n');
        for (var fta = 9; fta <= 10; fta++) setCell(currRow, fta, '', 18);
        addMerge(8, currRow, 10, currRow);
        rowHeights[currRow] = 24;
        currRow++;

        currRow++; // Spacing row
      }

      // --- SECTION 3: COMMERCIAL ESTIMATE SUMMARY ---
      setCell(currRow, 0, '3. Commercial Estimate Summary (Entire Home)', 5);
      for (var cc = 1; cc <= 10; cc++) setCell(currRow, cc, '', 5);
      addMerge(0, currRow, 10, currRow);
      rowHeights[currRow] = 24;
      currRow++;

      // Subheaders
      setCell(currRow, 0, 'Commercial Parameter & Scope of Work', 6);
      for (var cp = 1; cp <= 4; cp++) setCell(currRow, cp, '', 6);
      addMerge(0, currRow, 4, currRow);

      setCell(currRow, 5, 'Inclusion Status / Parameter', 6);
      for (var cs = 6; cs <= 7; cs++) setCell(currRow, cs, '', 6);
      addMerge(5, currRow, 7, currRow);

      setCell(currRow, 8, 'Amount (INR)', 6);
      for (var ca = 9; ca <= 10; ca++) setCell(currRow, ca, '', 6);
      addMerge(8, currRow, 10, currRow);
      rowHeights[currRow] = 22;
      currRow++;

      var addAccVal = Number(commCharges.additionalAccessories) || 0;
      var appliancesVal = Number(commCharges.appliances) || 0;

      var commRows = [
        { label: 'Modular Woodwork Subtotal', status: 'Active Scope', amt: comm.woodworkSubtotal, style: 12 },
        { label: 'Design Charges', status: comm.designPercent + '%', amt: comm.designAmount, style: 12 }
      ];
      if (comm.freightEnabled !== false) {
        commRows.push({ label: 'Freight Charges', status: comm.freightPercent + '%', amt: comm.freightAmount, style: 12 });
      }
      commRows.push(
        { label: 'Loading and unloading (material)', status: comm.loadingUnloadingStatus || 'Additional', amt: comm.loadingUnloadingStatus === 'Included' ? 0 : 'Additional', style: 10 },
        { label: 'Floor protective mat', status: comm.floorMatStatus || 'Not Included in Quote', amt: comm.floorMatStatus === 'Included' ? 0 : 'Not Included', style: 10 },
        { label: 'Civil works', status: comm.civilWorksStatus || 'As per actuals', amt: comm.civilWorksStatus === 'Included' ? 0 : 'As per actuals', style: 10 },
        { label: 'Electrical & Plumbing Works', status: comm.electricalPlumbingStatus || 'Additional', amt: comm.electricalPlumbingStatus === 'Included' ? 0 : 'Additional', style: 10 },
        { label: 'False ceiling', status: comm.falseCeilingStatus || 'Not Included', amt: comm.falseCeilingStatus === 'Included' ? 0 : 'Not Included', style: 10 },
        { label: 'Wallpaper', status: comm.wallpaperStatus || 'Complementary', amt: comm.wallpaperStatus === 'Complementary' ? 'Complementary' : 'Not Included', style: 10 },
        { label: 'Discount on Wood Work', status: '(-) ' + comm.discountPercent + '%', amt: -comm.discountAmount, style: 19 },
        { label: 'Discount on Design Charge', status: '(-) ' + comm.adpPercent + '%', amt: -comm.adpAmount, style: 19 },
        { label: 'Grand Total (Without GST)', status: 'Net Value', amt: comm.netValue, style: 20, isNet: true }
      );
      if (comm.gstEnabled !== false) {
        commRows.push({ label: 'GST', status: 'Rate: ' + comm.gstPercent + '%', amt: comm.gstAmount, style: 12 });
      }
      commRows.push(
        { label: comm.gstEnabled !== false ? 'Final Total (With GST)' : 'Final Total', status: 'Net Payable', amt: comm.grandTotal, style: 22, isGrand: true },
        { label: 'Your Savings', status: 'Total Discount', amt: comm.totalSavings || (comm.discountAmount + comm.adpAmount), style: 12 },
        { label: 'Add-ons & Accessories Subtotal', status: 'Optional Add-ons', amt: comm.addonsTotal || 0, style: 12 },
        { label: 'TOTAL PROJECT INVESTMENT (PROPOSAL + ADD-ONS)', status: 'Final Investment', amt: comm.totalInvestmentWithAddons || comm.grandTotal, style: 22, isGrand: true }
      );

      for (var cr = 0; cr < commRows.length; cr++) {
        var rowData = commRows[cr];
        var isNet = rowData.isNet;
        var isGrand = rowData.isGrand;

        var lblStyle = isGrand ? 21 : isNet ? 7 : 9;
        var statStyle = isGrand ? 21 : isNet ? 7 : 10;
        var amtStyle = rowData.style;

        setCell(currRow, 0, rowData.label, lblStyle);
        for (var c2 = 1; c2 <= 4; c2++) setCell(currRow, c2, '', lblStyle);
        addMerge(0, currRow, 4, currRow);

        setCell(currRow, 5, rowData.status, statStyle);
        for (var c3 = 6; c3 <= 7; c3++) setCell(currRow, c3, '', statStyle);
        addMerge(5, currRow, 7, currRow);

        if (typeof rowData.amt === 'number') {
          setCell(currRow, 8, rowData.amt, amtStyle, 'n');
        } else {
          setCell(currRow, 8, rowData.amt, amtStyle);
        }
        for (var c4 = 9; c4 <= 10; c4++) setCell(currRow, c4, '', amtStyle);
        addMerge(8, currRow, 10, currRow);

        rowHeights[currRow] = isGrand ? 28 : isNet ? 24 : 20;
        currRow++;
      }

      // Footnote
      currRow++;
      setCell(currRow, 0, 'Generated by Orbix Studio CAD System · https://studio.orbixdesigns.com · All rights reserved.', 23);
      for (var fnc = 1; fnc <= 10; fnc++) setCell(currRow, fnc, '', 23);
      addMerge(0, currRow, 10, currRow);
      rowHeights[currRow] = 18;

      // Group cells by row
      var rowMap = {};
      for (var ci = 0; ci < cells.length; ci++) {
        var cell = cells[ci];
        if (!rowMap[cell.r]) rowMap[cell.r] = [];
        rowMap[cell.r].push(cell);
      }

      var sortedRowKeys = Object.keys(rowMap).map(Number).sort(function (a, b) { return a - b; });
      var sheetDataXml = '';
      for (var rk = 0; rk < sortedRowKeys.length; rk++) {
        var rNum = sortedRowKeys[rk];
        var rCells = rowMap[rNum].sort(function (a, b) { return a.c - b.c; });
        var rHeightAttr = rowHeights[rNum] ? (' ht="' + rowHeights[rNum] + '" customHeight="1"') : '';
        sheetDataXml += '<row r="' + rNum + '"' + rHeightAttr + '>';
        for (var colIdx = 0; colIdx < rCells.length; colIdx++) {
          var cObj = rCells[colIdx];
          var cellRef = colLetter(cObj.c) + cObj.r;
          var styleAttr = cObj.s ? (' s="' + cObj.s + '"') : '';
          if (cObj.t === 'n' && typeof cObj.val === 'number') {
            sheetDataXml += '<c r="' + cellRef + '"' + styleAttr + '><v>' + cObj.val + '</v></c>';
          } else {
            var valStr = escapeXml(cObj.val);
            sheetDataXml += '<c r="' + cellRef + '"' + styleAttr + ' t="inlineStr"><is><t>' + valStr + '</t></is></c>';
          }
        }
        sheetDataXml += '</row>';
      }

      var colWidths = [
        { min: 1, max: 1, width: 7 },
        { min: 2, max: 2, width: 14 },
        { min: 3, max: 3, width: 15 },
        { min: 4, max: 4, width: 34 },
        { min: 5, max: 5, width: 18 },
        { min: 6, max: 6, width: 22 },
        { min: 7, max: 7, width: 30 },
        { min: 8, max: 8, width: 24 },
        { min: 9, max: 9, width: 16 },
        { min: 10, max: 10, width: 16 },
        { min: 11, max: 11, width: 20 }
      ];
      var colsXml = '<cols>';
      for (var cw = 0; cw < colWidths.length; cw++) {
        var cDef = colWidths[cw];
        colsXml += '<col min="' + cDef.min + '" max="' + cDef.max + '" width="' + cDef.width + '" customWidth="1"/>';
      }
      colsXml += '</cols>';

      var mergeXml = '';
      if (mergeCells.length > 0) {
        mergeXml = '<mergeCells count="' + mergeCells.length + '">';
        for (var mi = 0; mi < mergeCells.length; mi++) {
          mergeXml += '<mergeCell ref="' + mergeCells[mi] + '"/>';
        }
        mergeXml += '</mergeCells>';
      }

      var contentTypesXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Default Extension="jpeg" ContentType="image/jpeg"/>' +
        '<Default Extension="jpg" ContentType="image/jpeg"/>' +
        '<Default Extension="png" ContentType="image/png"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>' +
        '</Types>';

      var rootRelsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>';

      var workbookXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<sheets><sheet name="Estimation &amp; Pricing" sheetId="1" r:id="rId1"/></sheets>' +
        '</workbook>';

      var workbookRelsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        '</Relationships>';

      var stylesXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        '<numFmts count="3">' +
        '<numFmt numFmtId="164" formatCode="&quot;₹&quot;\ #,##0.00;[Red](&quot;₹&quot;\ #,##0.00);&quot;₹&quot;\ 0.00"/>' +
        '<numFmt numFmtId="165" formatCode="#,##0.00"/>' +
        '<numFmt numFmtId="166" formatCode="0.00"/>' +
        '</numFmts>' +
        '<fonts count="10">' +
        '<font><sz val="10"/><color rgb="FF000000"/><name val="Calibri"/></font>' +
        '<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' +
        '<font><b/><sz val="15"/><color rgb="FF1B4F72"/><name val="Calibri"/></font>' +
        '<font><b/><sz val="11"/><color rgb="FF334155"/><name val="Calibri"/></font>' +
        '<font><b/><sz val="10"/><color rgb="FF1E3A8A"/><name val="Calibri"/></font>' +
        '<font><b/><sz val="10"/><color rgb="FF1E293B"/><name val="Calibri"/></font>' +
        '<font><sz val="9"/><color rgb="FF475569"/><name val="Calibri"/></font>' +
        '<font><b/><sz val="10"/><color rgb="FFDC2626"/><name val="Calibri"/></font>' +
        '<font><b/><sz val="13"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' +
        '<font><i/><sz val="9"/><color rgb="FF64748B"/><name val="Calibri"/></font>' +
        '</fonts>' +
        '<fills count="9">' +
        '<fill><patternFill patternType="none"/></fill>' +
        '<fill><patternFill patternType="gray125"/></fill>' +
        '<fill><patternFill patternType="solid"><fgColor rgb="FF1B4F72"/></patternFill></fill>' +
        '<fill><patternFill patternType="solid"><fgColor rgb="FFEFF6FF"/></patternFill></fill>' +
        '<fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/></patternFill></fill>' +
        '<fill><patternFill patternType="solid"><fgColor rgb="FFFEF3C7"/></patternFill></fill>' +
        '<fill><patternFill patternType="solid"><fgColor rgb="FFE2E8F0"/></patternFill></fill>' +
        '<fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/></patternFill></fill>' +
        '<fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/></patternFill></fill>' +
        '</fills>' +
        '<borders count="4">' +
        '<border><left/><right/><top/><bottom/><diagonal/></border>' +
        '<border><left style="thin"><color rgb="FFCBD5E1"/></left><right style="thin"><color rgb="FFCBD5E1"/></right><top style="thin"><color rgb="FFCBD5E1"/></top><bottom style="thin"><color rgb="FFCBD5E1"/></bottom></border>' +
        '<border><left style="thin"><color rgb="FFCBD5E1"/></left><right style="thin"><color rgb="FFCBD5E1"/></right><top style="thin"><color rgb="FFCBD5E1"/></top><bottom style="double"><color rgb="FF1E293B"/></bottom></border>' +
        '<border><left style="medium"><color rgb="FF1B4F72"/></left><right style="medium"><color rgb="FF1B4F72"/></right><top style="medium"><color rgb="FF1B4F72"/></top><bottom style="medium"><color rgb="FF1B4F72"/></bottom></border>' +
        '</borders>' +
        '<cellStyleXfs count="1">' +
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>' +
        '</cellStyleXfs>' +
        '<cellXfs count="24">' +
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
        '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0"><alignment vertical="center"/></xf>' +
        '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0"><alignment vertical="center"/></xf>' +
        '<xf numFmtId="0" fontId="5" fillId="7" borderId="1" xfId="0"><alignment vertical="center"/></xf>' +
        '<xf numFmtId="0" fontId="0" fillId="7" borderId="1" xfId="0"><alignment vertical="center"/></xf>' +
        '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0"><alignment vertical="center" indent="1"/></xf>' +
        '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
        '<xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0"><alignment vertical="center" indent="1"/></xf>' +
        '<xf numFmtId="164" fontId="4" fillId="3" borderId="1" xfId="0"><alignment horizontal="right" vertical="center"/></xf>' +
        '<xf numFmtId="0" fontId="0" fillId="8" borderId="1" xfId="0"><alignment vertical="center" wrapText="1"/></xf>' +
        '<xf numFmtId="0" fontId="0" fillId="8" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf>' +
        '<xf numFmtId="165" fontId="0" fillId="8" borderId="1" xfId="0"><alignment horizontal="right" vertical="center"/></xf>' +
        '<xf numFmtId="164" fontId="5" fillId="8" borderId="1" xfId="0"><alignment horizontal="right" vertical="center"/></xf>' +
        '<xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0"><alignment vertical="center" wrapText="1"/></xf>' +
        '<xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf>' +
        '<xf numFmtId="165" fontId="0" fillId="4" borderId="1" xfId="0"><alignment horizontal="right" vertical="center"/></xf>' +
        '<xf numFmtId="164" fontId="5" fillId="4" borderId="1" xfId="0"><alignment horizontal="right" vertical="center"/></xf>' +
        '<xf numFmtId="0" fontId="5" fillId="5" borderId="2" xfId="0"><alignment horizontal="right" vertical="center"/></xf>' +
        '<xf numFmtId="164" fontId="5" fillId="5" borderId="2" xfId="0"><alignment horizontal="right" vertical="center"/></xf>' +
        '<xf numFmtId="164" fontId="7" fillId="8" borderId="1" xfId="0"><alignment horizontal="right" vertical="center"/></xf>' +
        '<xf numFmtId="164" fontId="4" fillId="3" borderId="1" xfId="0"><alignment horizontal="right" vertical="center"/></xf>' +
        '<xf numFmtId="0" fontId="8" fillId="2" borderId="3" xfId="0"><alignment vertical="center" indent="1"/></xf>' +
        '<xf numFmtId="164" fontId="8" fillId="2" borderId="3" xfId="0"><alignment horizontal="right" vertical="center"/></xf>' +
        '<xf numFmtId="0" fontId="9" fillId="0" borderId="0" xfId="0"><alignment vertical="center"/></xf>' +
        '</cellXfs>' +
        '</styleSheet>';

      var sheetRelsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rIdDrawing1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>' +
        '</Relationships>';

      var drawingRelsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
      for (var mr = 0; mr < mediaFiles.length; mr++) {
        var mf = mediaFiles[mr];
        drawingRelsXml += '<Relationship Id="' + mf.rId + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/' + mf.name + '"/>';
      }
      drawingRelsXml += '</Relationships>';

      var drawingXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" ' +
        'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">';

      for (var drIdx = 0; drIdx < drawings.length; drIdx++) {
        var dr = drawings[drIdx];
        drawingXml += '<xdr:twoCellAnchor editAs="oneCell">' +
          '<xdr:from>' +
          '<xdr:col>' + dr.fromCol + '</xdr:col>' +
          '<xdr:colOff>' + dr.fromColOff + '</xdr:colOff>' +
          '<xdr:row>' + dr.fromRow + '</xdr:row>' +
          '<xdr:rowOff>' + dr.fromRowOff + '</xdr:rowOff>' +
          '</xdr:from>' +
          '<xdr:to>' +
          '<xdr:col>' + dr.toCol + '</xdr:col>' +
          '<xdr:colOff>' + dr.toColOff + '</xdr:colOff>' +
          '<xdr:row>' + dr.toRow + '</xdr:row>' +
          '<xdr:rowOff>' + dr.toRowOff + '</xdr:rowOff>' +
          '</xdr:to>' +
          '<xdr:pic>' +
          '<xdr:nvPicPr>' +
          '<xdr:cNvPr id="' + (drIdx + 1) + '" name="Picture ' + (drIdx + 1) + '"/>' +
          '<xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr>' +
          '</xdr:nvPicPr>' +
          '<xdr:blipFill>' +
          '<a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="' + dr.rId + '"/>' +
          '<a:stretch><a:fillRect/></a:stretch>' +
          '</xdr:blipFill>' +
          '<xdr:spPr>' +
          '<a:xfrm><a:off x="0" y="0"/><a:ext cx="100000" cy="100000"/></a:xfrm>' +
          '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>' +
          '</xdr:spPr>' +
          '</xdr:pic>' +
          '<xdr:clientData/>' +
          '</xdr:twoCellAnchor>';
      }
      drawingXml += '</xdr:wsDr>';

      var sheetXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<sheetViews>' +
        '<sheetView tabSelected="1" workbookViewId="0">' +
        '<pane ySplit="7" topLeftCell="A8" activePane="bottomLeft" state="frozen"/>' +
        '</sheetView>' +
        '</sheetViews>' +
        '<sheetFormatPr defaultRowHeight="18"/>' + colsXml +
        '<sheetData>' + sheetDataXml + '</sheetData>' + mergeXml +
        '<drawing r:id="rIdDrawing1"/>' +
        '</worksheet>';

      var zipEntries = [
        { name: '[Content_Types].xml', data: contentTypesXml },
        { name: '_rels/.rels', data: rootRelsXml },
        { name: 'xl/workbook.xml', data: workbookXml },
        { name: 'xl/_rels/workbook.xml.rels', data: workbookRelsXml },
        { name: 'xl/styles.xml', data: stylesXml },
        { name: 'xl/worksheets/sheet1.xml', data: sheetXml },
        { name: 'xl/worksheets/_rels/sheet1.xml.rels', data: sheetRelsXml },
        { name: 'xl/drawings/drawing1.xml', data: drawingXml },
        { name: 'xl/drawings/_rels/drawing1.xml.rels', data: drawingRelsXml }
      ];

      for (var med = 0; med < mediaFiles.length; med++) {
        zipEntries.push({ name: 'xl/media/' + mediaFiles[med].name, data: mediaFiles[med].data });
      }

      return this.buildZipBlob(zipEntries);
    },

    buildZipBlob: function (files) {
      function makeCRC32Table() {
        var c, t = [];
        for (var n = 0; n < 256; n++) {
          c = n;
          for (var k = 0; k < 8; k++) { c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)); }
          t[n] = c >>> 0;
        }
        return t;
      }
      var crcTable = makeCRC32Table();
      function getCrc32(buf) {
        var crc = -1;
        for (var i = 0; i < buf.length; i++) { crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF]; }
        return (crc ^ -1) >>> 0;
      }

      var encoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : {
        encode: function (str) {
          var arr = new Uint8Array(str.length);
          for (var i = 0; i < str.length; i++) arr[i] = str.charCodeAt(i);
          return arr;
        }
      };

      var localChunks = [];
      var centralChunks = [];
      var offset = 0;

      for (var f = 0; f < files.length; f++) {
        var file = files[f];
        var nameBuf = encoder.encode(file.name);
        var dataBuf = (file.data instanceof Uint8Array) ? file.data : encoder.encode(file.data);
        var crc = getCrc32(dataBuf);
        var size = dataBuf.length;

        var localHeader = new Uint8Array(30);
        var v = new DataView(localHeader.buffer);
        v.setUint32(0, 0x04034b50, true);
        v.setUint16(4, 20, true);
        v.setUint32(14, crc, true);
        v.setUint32(18, size, true);
        v.setUint32(22, size, true);
        v.setUint16(26, nameBuf.length, true);

        localChunks.push(localHeader, nameBuf, dataBuf);

        var centralHeader = new Uint8Array(46);
        var cv = new DataView(centralHeader.buffer);
        cv.setUint32(0, 0x02014b50, true);
        cv.setUint16(4, 20, true);
        cv.setUint16(6, 20, true);
        cv.setUint32(16, crc, true);
        cv.setUint32(20, size, true);
        cv.setUint32(24, size, true);
        cv.setUint16(28, nameBuf.length, true);
        cv.setUint32(42, offset, true);

        centralChunks.push(centralHeader, nameBuf);
        offset += localHeader.length + nameBuf.length + dataBuf.length;
      }

      var centralDirOffset = offset;
      var centralDirSize = centralChunks.reduce(function (acc, c) { return acc + c.length; }, 0);

      var endOfCentralDir = new Uint8Array(22);
      var ev = new DataView(endOfCentralDir.buffer);
      ev.setUint32(0, 0x06054b50, true);
      ev.setUint16(8, files.length, true);
      ev.setUint16(10, files.length, true);
      ev.setUint32(12, centralDirSize, true);
      ev.setUint32(16, centralDirOffset, true);

      var allParts = localChunks.concat(centralChunks).concat([endOfCentralDir]);
      return new Blob(allParts, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    },

    buildXLSXBlob: function (rowsOrConfig) {
      if (rowsOrConfig && typeof rowsOrConfig === 'object' && rowsOrConfig.quote !== undefined) {
        return this.buildExecutivePricingXLSX(rowsOrConfig);
      }
      // Backwards compatible basic row exporter
      return this.buildZipBlob([
        { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>' },
        { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
        { name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Quotation" sheetId="1" r:id="rId1"/></sheets></workbook>' },
        { name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>' },
        { name: 'xl/worksheets/sheet1.xml', data: '<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData></sheetData></worksheet>' }
      ]);
    }
  };

  root.OrbixUI = OrbixUI;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = OrbixUI;
  }

  // Auto initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { OrbixUI.init(); });
  } else {
    OrbixUI.init();
  }

})(typeof globalThis !== 'undefined' ? globalThis : this);
