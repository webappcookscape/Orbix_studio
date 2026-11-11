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
        onProjectChange: function (proj) {
          self.project = proj;
          self.saveToLocalStorage();
          self.updateUI();
          self.renderBOQ();
          if (self.syncProjectUnitsTo3DStudio) self.syncProjectUnitsTo3DStudio();
          if (self.render3DHome) self.render3DHome(true);
          if (window.OrbixProjects && window.OrbixProjects.saveActiveProject) {
            window.OrbixProjects.saveActiveProject({
              plan: proj,
              units: window.S ? window.S.units : []
            });
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
      this.updateUI();
      this.renderBOQ();
    },

    loadProject: function (proj) {
      if (!proj) return;
      this.project = proj;
      if (typeof Core !== 'undefined' && typeof Core.detectRooms === 'function') {
        try { Core.detectRooms(this.project); } catch (e) { console.warn('[Orbix UI] detectRooms on load:', e); }
      }
      this.syncProjectUnitsTo3DStudio(); // Synchronize units FIRST so window.S.units reflects project
      this.saveToLocalStorage();
      if (root.OrbixProjects && typeof root.OrbixProjects.saveActiveProject === 'function') {
        root.OrbixProjects.saveActiveProject({ plan: this.project });
      }         // THEN save clean state to local storage
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
      }
      this.updateUI();
      this.renderBOQ();
      if (typeof window.buildScene === 'function') window.buildScene();
      if (typeof this.render3DHome === 'function') this.render3DHome();
      if (typeof window.fit === 'function') window.fit();
      if (typeof window.camApply === 'function') window.camApply();
    },

    createNewProject: function (title, clientName) {
      var fresh = Core.createProject(title || 'New Project');
      if (clientName && fresh.meta) fresh.meta.clientName = clientName;
      this.loadProject(fresh);
      return fresh;
    },

    resetProject: function (title) {
      var fresh = Core.createProject(title || 'Untitled Project');
      this.loadProject(fresh);
      return fresh;
    },

    saveToLocalStorage: function () {
      if (!this.project) return;
      try {
        var now = Date.now();
        var currentUnits = (window.S && window.S.units) ? window.S.units : [];
        var activeId = (window.OrbixProjects && window.OrbixProjects.activeProjectId) ||
                       localStorage.getItem('orbix_active_project_id') ||
                       (this.project && this.project.meta && this.project.meta.id) ||
                       (this.project && this.project.id) || '';
        var uId = (window.OrbixProjects && window.OrbixProjects.currentUser) ? window.OrbixProjects.currentUser.id : 'anon';

        // 1. Synchronously persist full working draft (guarantees survival across hard refresh & network drop)
        localStorage.setItem('orbix_working_project_draft', JSON.stringify({
          projectId: activeId ? String(activeId) : '',
          userId: uId,
          timestamp: now,
          plan: this.project,
          units: currentUnits
        }));

        // 2. Persist to active project key if ID is known
        if (activeId) {
          var key = 'orbix_project_' + uId + '_' + activeId;
          var serialized = (Core && typeof Core.serializeProject === 'function') ? Core.serializeProject(this.project) : JSON.stringify(this.project);
          localStorage.setItem(key, serialized);
          localStorage.setItem('orbix_active_proj_' + uId, String(activeId));
          localStorage.setItem('orbix_active_project_id', String(activeId));
        }
      } catch (e) {}
    },

    bindToolbar: function () {
      var self = this;

      // Tool buttons
      var toolBtns = document.querySelectorAll('.plan-tool-btn');
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

      var btnZoomFit = document.getElementById('planZoomFit');
      if (btnZoomFit) btnZoomFit.addEventListener('click', function () { self.editor.zoomFit(); });

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
            var img = new Image();
            img.onload = function () {
              self.editor.underlay.img = img;
              self.editor.underlay.width = img.naturalWidth;
              self.editor.underlay.height = img.naturalHeight;
              self.editor.underlay.scale = 10; // Default: 10 mm per pixel (1000px = 10m)
              self.editor.underlay.x = 0;
              self.editor.underlay.y = 0;
              self.editor.underlay.visible = true;
              self.editor.underlay.opacity = 0.45;
              self.editor.underlay.calibPoints = [];

              var controls = document.getElementById('planUnderlayControls');
              if (controls) controls.style.display = 'inline-flex';

              var opSlider = document.getElementById('planUnderlayOpacity');
              if (opSlider) opSlider.value = '0.45';

              self.editor.zoomFit();
              self.editor.render();
            };
            img.src = ev.target.result;
          };
          reader.readAsDataURL(file);
          planImgInput.value = '';
        });
      }

      // ── Underlay Controls (Calibrate, Opacity, Toggle, Remove) ──
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
        shutter: { material: 'HDHMR_18MM', finish: 'Brazilian Horizontal Walnut' },
        carcass: { material: 'BWP_18MM', finish: 'Absolute White' }
      };

      // 1. Master Bedroom Wardrobe (1800 x 2100 x 600 mm)
      p.plan.furniture.push(Core.createFurniturePlacement({
        name: 'Master Bed 3-Door Wardrobe',
        category: 'wardrobe',
        pos: { x: 7000, y: 500 },
        dimensions: { W: 1800, H: 2100, D: 600 },
        unitConfig: { shutterCol: 'MDF 3410', carcass: 'MDF 1135', shutters: 3 },
        materials: defaultMats
      }));

      // 2. Living Room TV Media Wall (2400 x 1800 x 400 mm)
      p.plan.furniture.push(Core.createFurniturePlacement({
        name: 'Living TV Entertainment Unit',
        category: 'tv_unit',
        pos: { x: 2500, y: 3600 },
        dimensions: { W: 2400, H: 1800, D: 400 },
        unitConfig: { shutterCol: 'MDF 2204', carcass: 'MDF 1135' },
        materials: defaultMats
      }));

      // 3. Kitchen Base & Wall Modular Runs
      p.plan.furniture.push(Core.createFurniturePlacement({
        name: 'Kitchen L-Run Base Cabinets',
        category: 'kitchen_base',
        pos: { x: 1800, y: 6600 },
        dimensions: { W: 3000, H: 850, D: 600 },
        unitConfig: { shutterCol: 'MDF 7701', carcass: 'MDF 1135' },
        materials: defaultMats
      }));

      p.plan.furniture.push(Core.createFurniturePlacement({
        name: 'Kitchen Wall Cabinets',
        category: 'kitchen_wall',
        pos: { x: 1800, y: 6600 },
        dimensions: { W: 3000, H: 700, D: 350 },
        unitConfig: { shutterCol: 'MDF 1135', carcass: 'MDF 1135' },
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
        unitConfig: { shutterCol: 'MDF 7701', carcass: 'MDF 1135', shutters: 1, handle: 'gprof' },
        materials: {
          shutter: { material: 'HDHMR_18MM', finish: '4x Tuff Gloss' },
          carcass: { material: 'BWP_18MM', finish: 'Absolute White' }
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
        panel.innerHTML =
          '<div class="insp-title">Wall Properties</div>' +
          '<div class="insp-row"><label>Clear Inner Length ' + (ed.unitSystem === 'imperial' ? '(e.g. 5ft or mm)' : '(mm)') + '</label><input type="text" id="inspWallInnerLen" value="' + (ed.unitSystem === 'imperial' ? innerDisplay : innerMm) + '">' +
          '<span style="font-size:11px;color:#0284c7;font-weight:600;">Clear Inner: ' + innerDisplay + ' (' + innerMm + ' mm)</span></div>' +
          '<div class="insp-row"><label>Centerline Length</label><input type="text" id="inspWallLen" value="' + (ed.unitSystem === 'imperial' ? lenDisplay : lenMm) + '">' +
          '<span style="font-size:11px;color:#64748B;">Centerline: ' + lenDisplay + ' (' + lenMm + ' mm)</span></div>' +
          '<div class="insp-row"><label>Thickness (mm)</label><input type="number" id="inspWallThick" value="' + (w.thickness || 150) + '" step="10"></div>' +
          '<div class="insp-row"><label>Height (mm)</label><input type="number" id="inspWallH" value="' + (w.height || 2800) + '" step="50"></div>' +
          '<button class="btn danger full" id="inspDelWall" style="margin-top:12px">Delete Wall</button>';

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
            }
          });
        }

        var elWallLen = document.getElementById('inspWallLen');
        if (elWallLen) {
          elWallLen.addEventListener('change', function (e) {
            var targetL = ed.parseDimInput(e.target.value);
            if (targetL > 100) {
              var dir = Core.wallDirection(w);
              if (w.startLocked === false && w.endLocked !== false) {
                // Corner B is locked, Corner A released: resize wall anchored from Corner B
                w.start.x = w.end.x - dir.x * targetL;
                w.start.y = w.end.y - dir.y * targetL;
              } else {
                // Corner A is locked (or both locked): resize wall anchored from Corner A
                w.end.x = w.start.x + dir.x * targetL;
                w.end.y = w.start.y + dir.y * targetL;
              }
              Core.detectRooms(ed.project);
              ed.pushHistory('Resize Wall');
              ed.render();
              self.renderInspector(ed.selected);
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
        var elDelWall = document.getElementById('inspDelWall');
        if (elDelWall) {
          elDelWall.addEventListener('click', function () {
            ed.deleteSelected();
          });
        }
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
          '<div style="display:flex;justify-content:space-between;align-items:center;">' +
          '<span><b>Corner A (1):</b> ' + distA + ' mm</span>' +
          '<span><b>Width:</b> ' + Math.round(op.width) + ' mm</span>' +
          '<span><b>(2) Corner B:</b> ' + distB + ' mm</span>' +
          '</div></div>' +
          '<div class="insp-row"><label>Distance from Corner A (1) [mm]</label><input type="number" id="inspOpDistA" value="' + distA + '" min="0" max="' + (wallL - op.width) + '" step="10"></div>' +
          '<div class="insp-row"><label>Opening Width (mm)</label><input type="number" id="inspOpW" value="' + Math.round(op.width) + '" min="400" max="3000" step="50"></div>' +
          '<div class="insp-row"><label>Distance to Corner B (2) [mm]</label><input type="number" id="inspOpDistB" value="' + distB + '" min="0" max="' + (wallL - op.width) + '" step="10"></div>' +
          '<div class="insp-row"><label>Height (mm)</label><input type="number" id="inspOpH" value="' + op.height + '" min="500" max="3500" step="50"></div>' +
          '<div class="insp-row"><label>Offset along wall (mm)</label><input type="number" id="inspOpOff" value="' + Math.round(op.offset) + '" min="' + minOff + '" max="' + maxOff + '" step="50"></div>' +
          '<div style="font-size:10.5px;color:#64748B;margin:-4px 0 10px 0;">Total Wall Length: ' + wallL + ' mm</div>' +
          (op.type === 'door' ?
            '<div class="insp-row"><label>Swing</label><select id="inspOpSwing">' +
            '<option value="in-left"' + ((op.swing || 'in-left') === 'in-left' ? ' selected' : '') + '>Inward Left</option>' +
            '<option value="in-right"' + (op.swing === 'in-right' ? ' selected' : '') + '>Inward Right</option>' +
            '<option value="out-left"' + (op.swing === 'out-left' ? ' selected' : '') + '>Outward Left</option>' +
            '<option value="out-right"' + (op.swing === 'out-right' ? ' selected' : '') + '>Outward Right</option>' +
            '</select></div>' :
            '<div class="insp-row"><label>Sill Height (mm)</label><input type="number" id="inspOpSill" value="' + (op.sillHeight || 900) + '" min="0" max="2500" step="50"></div>'
          ) +
          '<button class="btn danger full" id="inspDelOp" style="margin-top:12px">Delete ' + (op.type === 'door' ? 'Door' : 'Window') + '</button>';

        var updateOp = function () {
          var wVal = parseFloat(document.getElementById('inspOpW').value);
          var hVal = parseFloat(document.getElementById('inspOpH').value);
          var offVal = parseFloat(document.getElementById('inspOpOff').value);

          if (!isNaN(wVal) && wVal >= 200) op.width = wVal;
          if (!isNaN(hVal) && hVal >= 200) op.height = hVal;

          var curWall = self.editor.getWall(op.wallId);
          var curWallL = curWall ? Core.wallLength(curWall) : 5000;
          var curMin = Math.round(op.width / 2);
          var curMax = Math.max(curMin, Math.round(curWallL - op.width / 2));

          if (!isNaN(offVal)) {
            op.offset = Math.max(curMin, Math.min(curMax, offVal));
          }

          var swingEl = document.getElementById('inspOpSwing');
          if (swingEl) {
            op.swing = swingEl.value;
          }

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

        var elDistA = document.getElementById('inspOpDistA');
        if (elDistA) {
          elDistA.addEventListener('change', function (e) {
            var val = parseFloat(e.target.value);
            if (!isNaN(val)) {
              var curW = op.width || 800;
              op.offset = Math.max(curW / 2, Math.min(wallL - curW / 2, Math.round(val + curW / 2)));
              updateOp();
              self.renderInspector(self.editor.selected);
            }
          });
        }
        var elDistB = document.getElementById('inspOpDistB');
        if (elDistB) {
          elDistB.addEventListener('change', function (e) {
            var val = parseFloat(e.target.value);
            if (!isNaN(val)) {
              var curW = op.width || 800;
              op.offset = Math.max(curW / 2, Math.min(wallL - curW / 2, Math.round(wallL - val - curW / 2)));
              updateOp();
              self.renderInspector(self.editor.selected);
            }
          });
        }

        ['input', 'change'].forEach(function (evt) {
          var elW = document.getElementById('inspOpW');
          if (elW) elW.addEventListener(evt, updateOp);
          var elH = document.getElementById('inspOpH');
          if (elH) elH.addEventListener(evt, updateOp);
          var elOff = document.getElementById('inspOpOff');
          if (elOff) elOff.addEventListener(evt, updateOp);
          var elSw = document.getElementById('inspOpSwing');
          if (elSw) elSw.addEventListener(evt, updateOp);
          var elSi = document.getElementById('inspOpSill');
          if (elSi) elSi.addEventListener(evt, updateOp);
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
                            (fn.unitConfig && fn.unitConfig.shutterCol) || 'Brazilian Horizontal Walnut';
        var carcassFinish = (fn.materials && fn.materials.carcass && fn.materials.carcass.finish) ||
                            (fn.unitConfig && fn.unitConfig.carcass) || 'Absolute White';
        var curHandle = (fn.unitConfig && fn.unitConfig.handle) || fn.handleType || 'bar';
        var curHFinish = (fn.unitConfig && (fn.unitConfig.hfinish || fn.unitConfig.handleFinish)) || fn.handleFinish || 'black';
        var shuttersCount = (fn.unitConfig && fn.unitConfig.shutters !== undefined) ? fn.unitConfig.shutters : (fn.dimensions.W > 1200 ? 3 : fn.dimensions.W > 600 ? 2 : 1);
        var drawersCount = (fn.unitConfig && fn.unitConfig.drawers !== undefined) ? fn.unitConfig.drawers : 0;
        var doorStyle = (fn.unitConfig && fn.unitConfig.dstyle) || 'slab';
        var handleType = (fn.unitConfig && fn.unitConfig.handle) || 'gprof';
        var isWall = (window.OrbixCore && window.OrbixCore.isWallUnit) ?
          window.OrbixCore.isWallUnit(fn.category, fn.name, fn.code || fn.catalogItemId, fn.costCategory) :
          ((fn.category && fn.category.toLowerCase().indexOf('wall') !== -1) ||
           (fn.name && fn.name.toLowerCase().indexOf('wall') !== -1) ||
           fn.category === 'kitchen_wall' ||
           /(^|\b|_|-)(wm|wcm)($|\b|_|-|\d+)/i.test(fn.name));

        var isBaseUnit = !isWall && (fn.category === 'kitchen_base' || fn.category === 'crockery' || fn.category === 'vanity' || fn.category === 'tv_unit' || (fn.category && fn.category.indexOf('base') !== -1) || (fn.name && fn.name.toLowerCase().indexOf('base') !== -1));
        var isTvOrVanity = (fn.category === 'tv_unit' || fn.category === 'vanity' || (fn.name && (fn.name.toLowerCase().indexOf('tv') !== -1 || fn.name.toLowerCase().indexOf('vanity') !== -1)));
        var isWardrobeOrTall = (fn.category === 'wardrobe' || fn.category === 'kitchen_tall' || (fn.name && (fn.name.toLowerCase().indexOf('wardrobe') !== -1 || fn.name.toLowerCase().indexOf('tall') !== -1 || fn.name.toLowerCase().indexOf('tbm') !== -1)));
        var counterType = (fn.unitConfig && fn.unitConfig.counter) || (isBaseUnit ? 'black' : 'none');
        if (counterType === 'BLUE') counterType = 'black';

        if (!fn.shutterColors) fn.shutterColors = [];
        if (!fn.shutterMaterials) fn.shutterMaterials = [];
        if (!fn.shutterStates) fn.shutterStates = [];

        var curElev = (fn.elevation !== undefined && fn.elevation !== null && fn.elevation !== '') ?
          fn.elevation :
          ((fn.pos && fn.pos.z !== undefined && fn.pos.z !== null && fn.pos.z !== 0) ? fn.pos.z : (isWall ? 1500 : 0));

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

        panel.innerHTML =
          '<div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e2e8f0;padding-bottom:8px;margin-bottom:12px;">' +
            '<div><div style="font-size:13px;font-weight:700;color:#0f172a;">Unit Properties</div><div style="font-size:11px;color:#64748b;">' + (fn.name || "Modular Cabinet") + '</div></div>' +
            '<span style="font-size:10.5px;font-weight:600;background:' + (isWall ? "#fef3c7;color:#b45309;border:1px solid #fde68a;" : isSliding ? "#f3e8ff;color:#7e22ce;border:1px solid #e9d5ff;" : "#e0f2fe;color:#0369a1;border:1px solid #bae6fd;") + ';padding:2px 8px;border-radius:12px;">' +
              (isWall ? "Wall-Mounted (1500mm)" : isSliding ? "Sliding Wardrobe" : "Floor Unit (0mm)") + '</span>' +
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
              '<button type="button" class="btn small" id="btnPresetWall" style="flex:1;font-size:10px;padding:3px;background:#fef3c7;border:1px solid #fde68a;color:#92400e;">Wall (1500 mm)</button>' +
              '<button type="button" class="btn small" id="btnPresetLoft" style="flex:1;font-size:10px;padding:3px;background:#ede9fe;border:1px solid #ddd6fe;color:#5b21b6;">Loft (2100 mm)</button>' +
            '</div>' +
            '<div style="margin-top:6px;">' +
              '<button type="button" class="btn small full" id="inspFocusUnitBtn3D" style="font-size:11px;padding:4px;background:#059669;color:#ffffff;border:none;border-radius:4px;cursor:pointer;font-weight:600;">🎯 Zoom / Focus Unit in 3D</button>' +
            '</div>' +
          '</div>' +

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
            (isBaseUnit ? ('<div class="insp-row"><label>Countertop</label><select id="inspFurnCounter">' +
              '<option value="black"' + (counterType === "black" ? " selected" : "") + '>Black Galaxy Granite</option>' +
              '<option value="galaxy"' + (counterType === "galaxy" ? " selected" : "") + '>Black Galaxy</option>' +
              '<option value="white"' + (counterType === "white" || counterType === "marble" ? " selected" : "") + '>White Marble</option>' +
              '<option value="quartz"' + (counterType === "quartz" ? " selected" : "") + '>Pure White Quartz</option>' +
              '<option value="greyq"' + (counterType === "greyq" ? " selected" : "") + '>Grey Quartz</option>' +
              '<option value="beige"' + (counterType === "beige" ? " selected" : "") + '>Beige Marble</option>' +
              '<option value="green"' + (counterType === "green" ? " selected" : "") + '>Green Granite</option>' +
              '<option value="none"' + (counterType === "none" ? " selected" : "") + '>None (Carcass Top)</option>' +
            '</select></div>') : "") +
            (!isWall ? ('<div class="insp-row" style="margin-top:6px;"><label>Base & Legs</label><select id="inspFurnLegs">' +
              '<option value="legs"' + (hasLegs ? " selected" : "") + '>Floor Standing (100mm Legs / Plinth)</option>' +
              '<option value="floating"' + (!hasLegs ? " selected" : "") + '>Floating / Wall-Hung (No Legs)</option>' +
            '</select></div>') : "") +
          '</div>' +

          // ── Card 4: Materials & Laminate Finishes ──
          '<div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:10px;margin-bottom:10px;box-shadow:0 1px 2px rgba(0,0,0,0.03);">' +
            '<div style="font-size:11px;font-weight:700;color:#475569;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">🎨 Materials & Finishes</div>' +
            '<div class="insp-row" style="margin-bottom:6px;"><label>Carcass</label><select id="inspFurnCarcass">' +
              '<option value="Absolute White"' + (carcassFinish.indexOf("White") !== -1 || carcassFinish === "MDF 1135" ? " selected" : "") + '>Absolute White (MDF 1135)</option>' +
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
              '<option value="Brazilian Horizontal Walnut"' + (shutterFinish.indexOf("Walnut") !== -1 || shutterFinish === "MDF 3410" ? " selected" : "") + '>Brazilian Walnut (MDF 3410)</option>' +
              '<option value="Absolute White Gloss"' + (shutterFinish.indexOf("Gloss") !== -1 || shutterFinish === "MDF 6601" ? " selected" : "") + '>Absolute White Gloss (MDF 6601)</option>' +
              '<option value="Absolute White Matte"' + (shutterFinish.indexOf("White") !== -1 && shutterFinish.indexOf("Gloss") === -1 || shutterFinish === "MDF 1135" ? " selected" : "") + '>White Matte (MDF 1135)</option>' +
              '<option value="Sonoma Oak"' + (shutterFinish.indexOf("Oak") !== -1 || shutterFinish === "MDF 2204" ? " selected" : "") + '>Sonoma Oak (MDF 2204)</option>' +
              '<option value="Sage Green Matte"' + (shutterFinish.indexOf("Sage") !== -1 || shutterFinish === "MDF 7701" ? " selected" : "") + '>Sage Green Matte (MDF 7701)</option>' +
              '<option value="Dark Wenge"' + (shutterFinish.indexOf("Wenge") !== -1 || shutterFinish === "MDF 3411" ? " selected" : "") + '>Dark Wenge (MDF 3411)</option>' +
              '<option value="Natural Teak"' + (shutterFinish.indexOf("Teak") !== -1 || shutterFinish === "MDF 2210" ? " selected" : "") + '>Natural Teak (MDF 2210)</option>' +
              '<option value="Grey Oak Scandi"' + (shutterFinish.indexOf("Grey Oak") !== -1 || shutterFinish === "MDF 4402" ? " selected" : "") + '>Grey Oak (MDF 4402)</option>' +
              '<option value="Graphite Grey"' + (shutterFinish.indexOf("Graphite") !== -1 || shutterFinish === "MDF 5501" ? " selected" : "") + '>Graphite Grey (MDF 5501)</option>' +
              '<option value="Navy Blue Matte"' + (shutterFinish.indexOf("Navy") !== -1 || shutterFinish === "MDF 7707" ? " selected" : "") + '>Navy Blue Matte (MDF 7707)</option>' +
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
                  if (fn.unitConfig.handle) eu.handle = fn.unitConfig.handle;
                  if (fn.unitConfig.hfinish) eu.hfinish = fn.unitConfig.hfinish;
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
            fn.dimensions.W = parseFloat(e.target.value);
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
            fn.dimensions.D = parseFloat(e.target.value);
            syncInspectorTo3D();
            self.editor.pushHistory('Resize Furniture');
            self.saveToLocalStorage();
            self.renderBOQ();
            self.editor.render();
            if (self.render3DHome) self.render3DHome(true);
          });
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
                  (fn.unitConfig && (fn.unitConfig.geometryType === 'l_shaped_corner' || fn.unitConfig.unitType === 'fbcm' || (fn.unitConfig.corner && fn.unitConfig.corner.enabled))) ||
                  (fn.id && /fbcm/i.test(fn.id)) ||
                  (fn.catalogItemId && /fbcm/i.test(fn.catalogItemId)) ||
                  (fn.name && /l[-_ ]*shaped.*corner/i.test(fn.name)) ||
                  fn.id === 'fbcm' || fn.catalogItemId === 'fbcm' ||
                  fn.id === 'f_fbcm_1' || fn.catalogItemId === 'f_fbcm_1'
                );
                var isFcm = !isFbcm && !!(
                  (fn.unitConfig && fn.unitConfig.fixedPanel && fn.unitConfig.fixedPanel.enabled) ||
                  (fn.unitConfig && (fn.unitConfig.unitType === 'fcm-rt' || fn.unitConfig.unitType === 'fcm-lt')) ||
                  (fn.id && /fcm[-_ ]*(rt|lt)/i.test(fn.id)) ||
                  (fn.catalogItemId && /fcm[-_ ]*(rt|lt)/i.test(fn.catalogItemId)) ||
                  (fn.name && /fcm[-_ ]*(rt|lt)/i.test(fn.name)) ||
                  fn.id === 'fcm-rt' || fn.catalogItemId === 'fcm-rt' ||
                  fn.id === 'fm-rt-01' || fn.catalogItemId === 'fm-rt-01' ||
                  fn.id === 'fcm-lt' || fn.catalogItemId === 'fcm-lt' ||
                  fn.id === 'fm-lt-01' || fn.catalogItemId === 'fm-lt-01'
                );
                var isLt = !!(
                  (fn.unitConfig && (fn.unitConfig.unitType === 'fcm-lt' || (fn.unitConfig.openShutter && fn.unitConfig.openShutter.opening === 'left'))) ||
                  (fn.id && /fcm[-_ ]*lt/i.test(fn.id)) ||
                  (fn.catalogItemId && /fcm[-_ ]*lt/i.test(fn.catalogItemId)) ||
                  (fn.name && /fcm[-_ ]*lt/i.test(fn.name)) ||
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
                  (fn.unitConfig && (fn.unitConfig.unitType === 'fcm-rt' || fn.unitConfig.unitType === 'fcm-lt')) ||
                  (fn.id && /fcm[-_ ]*(rt|lt)/i.test(fn.id)) ||
                  (fn.catalogItemId && /fcm[-_ ]*(rt|lt)/i.test(fn.catalogItemId)) ||
                  (fn.name && /fcm[-_ ]*(rt|lt)/i.test(fn.name)) ||
                  fn.id === 'fcm-rt' || fn.catalogItemId === 'fcm-rt' ||
                  fn.id === 'fm-rt-01' || fn.catalogItemId === 'fm-rt-01' ||
                  fn.id === 'fcm-lt' || fn.catalogItemId === 'fcm-lt' ||
                  fn.id === 'fm-lt-01' || fn.catalogItemId === 'fm-lt-01'
                );
                var isLt = !!(
                  (fn.unitConfig && (fn.unitConfig.unitType === 'fcm-lt' || (fn.unitConfig.openShutter && fn.unitConfig.openShutter.opening === 'left'))) ||
                  (fn.id && /fcm[-_ ]*lt/i.test(fn.id)) ||
                  (fn.catalogItemId && /fcm[-_ ]*lt/i.test(fn.catalogItemId)) ||
                  (fn.name && /fcm[-_ ]*lt/i.test(fn.name)) ||
                  fn.id === 'fcm-lt' || fn.catalogItemId === 'fcm-lt' ||
                  fn.id === 'fm-lt-01' || fn.catalogItemId === 'fm-lt-01'
                );
                var isWall = (window.OrbixCore && window.OrbixCore.isWallUnit) ?
                  window.OrbixCore.isWallUnit(fn.category, fn.name, fn.code || fn.id, fn.costCategory) :
                  (fn.category === 'kitchen_wall' || (fn.name && fn.name.toLowerCase().indexOf('wall') !== -1));
                var isKitchen = (fn.category && fn.category.indexOf('kitchen') !== -1);
                var isBase = !isWall && (isKitchen || fn.category === 'crockery' || fn.category === 'tv_unit' || (fn.name && fn.name.indexOf('BASE') !== -1) || isFcm);
                var sFinish = (fn.unitConfig && fn.unitConfig.shutterCol) || (fn.materials && fn.materials.shutter && fn.materials.shutter.finish) || 'MDF 7701';
                var cFinish = (fn.unitConfig && fn.unitConfig.carcass) || (fn.materials && fn.materials.carcass && fn.materials.carcass.finish) || 'MDF 1135';
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
            fn.rotY = ((fn.rotY || 0) + Math.PI / 2) % (Math.PI * 2);
            self.editor.pushHistory('Rotate Furniture');
            self.saveToLocalStorage();
            self.editor.render();
            if (self.render3DHome) self.render3DHome(true);
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
          '</select></div>' +
          '<div class="insp-row"><label>Ceiling Ht (mm)</label><input type="number" id="inspRoomHeight" value="' + (rm.ceilingHeight || 2800) + '" step="100"></div>' +
          '<div class="insp-row"><label>Area (sq.ft)</label><input type="text" value="' + areaSqFt + ' sq ft (' + areaSqM + ' m²)" readonly style="background:var(--rule-2,#f3f4f6)"></div>' +
          '<div class="insp-row"><label>Perimeter (mm)</label><input type="text" value="' + Math.round(rm.perimeter || 0).toLocaleString() + ' mm" readonly style="background:var(--rule-2,#f3f4f6)"></div>' +
          '<div class="insp-row" style="margin-top:6px;"><label style="font-size:12px;cursor:pointer;display:flex;align-items:center;gap:6px;"><input type="checkbox" id="inspRoomFlooringQuote"' + (rm.includeFlooring ? ' checked' : '') + '> Include Civil Flooring in Quote (₹' + (self.project && self.project.rateCard && self.project.rateCard.categories && self.project.rateCard.categories.flooring ? self.project.rateCard.categories.flooring.baseRatePerSft : 140) + '/SFT)</label></div>' +
          '<button class="btn primary full" id="inspFocusRoom3D" style="margin-top:12px">👁 View Room in 3D Studio</button>';

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

        var focusBtn = document.getElementById('inspFocusRoom3D');
        if (focusBtn) {
          focusBtn.addEventListener('click', function () {
            var vtab = document.querySelector('.vtab[data-view="design"]');
            if (vtab) vtab.click();
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

      // If no furniture is placed on the 2D floor plan, 3D Studio must have 0 units!
      if (!furnList.length) {
        window.S.units = [];
        window.S.active = 0;
        if (typeof window.renderRail === 'function') window.renderRail();
        if (typeof window.renderLegend === 'function') window.renderLegend();
        if (typeof window.renderFoot === 'function') window.renderFoot();
        return;
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
        var unitElev = (fn.elevation !== undefined && fn.elevation !== null && fn.elevation !== '') ?
          parseFloat(fn.elevation) : ((fn.pos && fn.pos.z !== undefined && fn.pos.z !== null && fn.pos.z !== 0) ? parseFloat(fn.pos.z) : (isWall ? 1500 : 0));

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
            (fn.unitConfig && (fn.unitConfig.geometryType === 'l_shaped_corner' || fn.unitConfig.unitType === 'fbcm' || (fn.unitConfig.corner && fn.unitConfig.corner.enabled))) ||
            fn.id === 'fbcm' || fn.catalogItemId === 'fbcm' ||
            fn.id === 'f_fbcm_1' || fn.catalogItemId === 'f_fbcm_1' ||
            (fn.id && /fbcm/i.test(fn.id)) ||
            (fn.name && /l[-_ ]*shaped.*corner/i.test(fn.name))
          );
          var isExistingFcmLt = !isExistingFbcm && !!(
            (fn.unitConfig && (fn.unitConfig.unitType === 'fcm-lt' || (fn.unitConfig.openShutter && fn.unitConfig.openShutter.opening === 'left'))) ||
            (fn.id && /fcm[-_ ]*lt/i.test(fn.id)) ||
            (fn.catalogItemId && /fcm[-_ ]*lt/i.test(fn.catalogItemId)) ||
            (fn.name && /fcm[-_ ]*lt/i.test(fn.name)) ||
            fn.id === 'fcm-lt' || fn.catalogItemId === 'fcm-lt' ||
            fn.id === 'fm-lt-01' || fn.catalogItemId === 'fm-lt-01'
          );
          var isExistingFcm = !isExistingFbcm && !!(
            (fn.unitConfig && fn.unitConfig.fixedPanel && fn.unitConfig.fixedPanel.enabled) ||
            isExistingFcmLt ||
            (fn.unitConfig && (fn.unitConfig.unitType === 'fcm-rt' || fn.unitConfig.unitType === 'fcm-lt')) ||
            (fn.id && /fcm[-_ ]*(rt|lt)/i.test(fn.id)) ||
            (fn.catalogItemId && /fcm[-_ ]*(rt|lt)/i.test(fn.catalogItemId)) ||
            (fn.name && /fcm[-_ ]*(rt|lt)/i.test(fn.name)) ||
            fn.id === 'fcm-rt' || fn.catalogItemId === 'fcm-rt' ||
            fn.id === 'fm-rt-01' || fn.catalogItemId === 'fm-rt-01' ||
            fn.id === 'fcm-lt' || fn.catalogItemId === 'fcm-lt' ||
            fn.id === 'fm-lt-01' || fn.catalogItemId === 'fm-lt-01'
          );
          if (isExistingFbcm) {
            existing.unitType = 'fbcm';
            existing.geometryType = 'l_shaped_corner';
            existing.shutters = 2;
            existing.sections = 1;
            existing.shelves = 2;
            existing.handle = (fn.unitConfig && fn.unitConfig.handle) || 'standard';
            existing.hfinish = (fn.unitConfig && fn.unitConfig.hfinish) || 'black';
            existing.counter = 'black';
          } else if (isExistingFcm) {
            existing.unitType = isExistingFcmLt ? 'fcm-lt' : 'fcm-rt';
            existing.fixedPanel = (fn.unitConfig && fn.unitConfig.fixedPanel) || { enabled: true, width: 600, type: 'fixed' };
            existing.openShutter = (fn.unitConfig && fn.unitConfig.openShutter) || { enabled: true, width: 600, type: 'shutter', count: 1, opening: isExistingFcmLt ? 'left' : 'right' };
            existing.shutters = 1;
            existing.sections = 2;
            existing.shelves = 1;
            existing.handle = (fn.unitConfig && fn.unitConfig.handle) || 'pull';
            existing.hfinish = (fn.unitConfig && fn.unitConfig.hfinish) || 'black';
          }
          if (fn.unitConfig) existing.unitConfig = Object.assign({}, fn.unitConfig);
          if (fn.catalogItemId) existing.catalogItemId = fn.catalogItemId;

          newUnits.push(existing);
        } else {
          var isFbcmNew = !!(
            (fn.unitConfig && (fn.unitConfig.geometryType === 'l_shaped_corner' || fn.unitConfig.unitType === 'fbcm' || (fn.unitConfig.corner && fn.unitConfig.corner.enabled))) ||
            fn.id === 'fbcm' || fn.catalogItemId === 'fbcm' ||
            fn.id === 'f_fbcm_1' || fn.catalogItemId === 'f_fbcm_1' ||
            (fn.id && /fbcm/i.test(fn.id)) ||
            (fn.name && /l[-_ ]*shaped.*corner/i.test(fn.name))
          );
          var isFcmLtNew = !isFbcmNew && !!(
            (fn.unitConfig && (fn.unitConfig.unitType === 'fcm-lt' || (fn.unitConfig.openShutter && fn.unitConfig.openShutter.opening === 'left'))) ||
            (fn.id && /fcm[-_ ]*lt/i.test(fn.id)) ||
            (fn.catalogItemId && /fcm[-_ ]*lt/i.test(fn.catalogItemId)) ||
            (fn.name && /fcm[-_ ]*lt/i.test(fn.name)) ||
            fn.id === 'fcm-lt' || fn.catalogItemId === 'fcm-lt' ||
            fn.id === 'fm-lt-01' || fn.catalogItemId === 'fm-lt-01'
          );
          var isFcmNew = !isFbcmNew && !!(
            (fn.unitConfig && fn.unitConfig.fixedPanel && fn.unitConfig.fixedPanel.enabled) ||
            isFcmLtNew ||
            (fn.unitConfig && (fn.unitConfig.unitType === 'fcm-rt' || fn.unitConfig.unitType === 'fcm-lt')) ||
            (fn.id && /fcm[-_ ]*(rt|lt)/i.test(fn.id)) ||
            (fn.catalogItemId && /fcm[-_ ]*(rt|lt)/i.test(fn.catalogItemId)) ||
            (fn.name && /fcm[-_ ]*(rt|lt)/i.test(fn.name)) ||
            fn.id === 'fcm-rt' || fn.catalogItemId === 'fcm-rt' ||
            fn.id === 'fm-rt-01' || fn.catalogItemId === 'fm-rt-01' ||
            fn.id === 'fcm-lt' || fn.catalogItemId === 'fcm-lt' ||
            fn.id === 'fm-lt-01' || fn.catalogItemId === 'fm-lt-01'
          );
          var defH = (fn.dimensions && fn.dimensions.H) || (isWall ? 600 : isKitchen ? 750 : (fn.category === 'tv_unit' ? 450 : 2100));
          var defW = (fn.dimensions && fn.dimensions.W) || (isKitchen ? 600 : 1200);
          var defD = (fn.dimensions && fn.dimensions.D) || (isWall ? 350 : isKitchen ? 550 : 450);
          var sColNew = (fn.unitConfig && fn.unitConfig.shutterCol) || (fn.materials && fn.materials.shutter && fn.materials.shutter.finish) || 'MDF 7701';
          var cColNew = (fn.unitConfig && fn.unitConfig.carcass) || (fn.materials && fn.materials.carcass && fn.materials.carcass.finish) || 'MDF 1135';
          var u = {
            label: fn.name,
            ctype: isWall ? 'kwall' : (isBase ? 'kbase' : 'wardrobe'),
            _furnId: fn.id,
            unitType: (fn.unitConfig && fn.unitConfig.unitType) || fn.catalogItemId || (isFbcmNew ? 'fbcm' : (isFcmNew ? (isFcmLtNew ? 'fcm-lt' : 'fcm-rt') : undefined)),
            geometryType: (fn.unitConfig && fn.unitConfig.geometryType) || (isFbcmNew ? 'l_shaped_corner' : undefined),
            catalogItemId: fn.catalogItemId || fn.id,
            fixedPanel: (fn.unitConfig && fn.unitConfig.fixedPanel) || (isFcmNew ? { enabled: true, width: 600, type: 'fixed' } : undefined),
            openShutter: (fn.unitConfig && fn.unitConfig.openShutter) || (isFcmNew ? { enabled: true, width: 600, type: 'shutter', count: 1, opening: isFcmLtNew ? 'left' : 'right' } : undefined),
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
      if (typeof window.renderRail === 'function') window.renderRail();
      if (typeof window.renderLegend === 'function') window.renderLegend();
      if (typeof window.renderFoot === 'function') window.renderFoot();
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
      if (typeof this.render3DHome === 'function') this.render3DHome(true);

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

      var isWall = (window.OrbixCore && window.OrbixCore.isWallUnit) ?
        window.OrbixCore.isWallUnit(preset.category, preset.name, preset.code || preset.catalogItemId, preset.costCategory) :
        ((preset.category && preset.category.toLowerCase().indexOf('wall') !== -1) ||
         (preset.name && preset.name.toLowerCase().indexOf('wall') !== -1) ||
         /(^|\b|_|-)(wm|wcm)($|\b|_|-|\d+)/i.test(preset.name));
      var initElev = (preset.elevation !== undefined && preset.elevation !== null) ?
        preset.elevation : (isWall ? 1500 : 0);

      var newFurn = Core.createFurniturePlacement({
        id: fId,
        name: preset.name || 'Modular Unit',
        category: preset.category || 'wardrobe',
        catalogItemId: preset.id || preset.code || null,
        modelType: preset.modelType || null,
        costCategory: preset.costCategory || null,
        roomId: matchedRoomId,
        elevation: initElev,
        pos: { x: cX, y: cY, z: initElev },
        rotY: 0,
        dimensions: Object.assign({ W: 1200, H: isWall ? 600 : 2100, D: isWall ? 350 : 600 }, preset.dimensions || {}),
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
      this.saveToLocalStorage();
      if (root.OrbixProjects && typeof root.OrbixProjects.saveActiveProject === 'function') {
        root.OrbixProjects.saveActiveProject({ plan: this.project });
      }
      if (root.OrbixProjects && root.OrbixProjects.saveActiveProject) {
        root.OrbixProjects.saveActiveProject();
      }
      if (this.editor) {
        this.editor.selected = [{ type: 'furniture', id: fId }];
        this.editor.render();
      }
      this.selectFurnitureIn3DStudio(fId);
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

    openDecorModal: function () {
      var modal = document.getElementById('modalImportDecor');
      if (modal) {
        modal.classList.add('is-open');
        modal.style.display = 'flex';
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

      var dims = Object.assign({ W: 900, H: 1800, D: 700 }, preset.dimensions || {});
      if (preset.w !== undefined) dims.W = parseFloat(preset.w);
      if (preset.h !== undefined) dims.H = parseFloat(preset.h);
      if (preset.d !== undefined) dims.D = parseFloat(preset.d);

      var newDecor = Core.createFurniturePlacement({
        id: fId,
        name: preset.name || 'Decor Item',
        category: 'decor',
        isDecor: true,
        excludeFromPricing: true,
        decorType: preset.decorType || 'general',
        modelUrl: preset.modelUrl || null,
        modelFormat: preset.modelFormat || null,
        elevation: initElev,
        pos: { x: cX, y: cY, z: initElev },
        rotY: 0,
        dimensions: dims,
        unitConfig: { shutters: 0, drawers: 0, dstyle: 'none', handle: 'none' }
      });

      plan.furniture.push(newDecor);
      this.saveToLocalStorage();
      if (root.OrbixProjects && typeof root.OrbixProjects.saveActiveProject === 'function') {
        root.OrbixProjects.saveActiveProject({ plan: this.project });
      }
      if (root.OrbixProjects && root.OrbixProjects.saveActiveProject) {
        root.OrbixProjects.saveActiveProject();
      }
      if (this.editor) {
        this.editor.selected = [{ type: 'furniture', id: fId }];
        this.editor.render();
      }
      if (this.render3DHome) this.render3DHome(true);
      if (typeof window.showToast === 'function') {
        window.showToast('🌿 Placed ' + newDecor.name + ' (Excluded from Woodwork Pricing)');
      }
    },

    initDecorModal: function () {
      var self = this;
      var modal = document.getElementById('modalImportDecor');
      var openBtn = document.getElementById('openDecorModalBtn');
      if (!modal) return;

      if (openBtn) {
        openBtn.addEventListener('click', function () {
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

      // Built-in decor card selection
      modal.querySelectorAll('.decor-preset-card').forEach(function (card) {
        card.addEventListener('click', function () {
          var name = card.getAttribute('data-name');
          var decorType = card.getAttribute('data-type');
          var w = parseFloat(card.getAttribute('data-w')) || 900;
          var h = parseFloat(card.getAttribute('data-h')) || 1800;
          var d = parseFloat(card.getAttribute('data-d')) || 700;
          var elev = parseFloat(card.getAttribute('data-elev')) || 0;

          self.placeDecorItem({
            name: name,
            decorType: decorType,
            dimensions: { W: w, H: h, D: d },
            elevation: elev
          });
          self.closeDecorModal();
        });
      });

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
        var counts = { all: catalog.length, kitchen_base: 0, kitchen_wall: 0, wardrobe: 0, tv_unit: 0, crockery: 0, vanity: 0, bed: 0 };
        catalog.forEach(function (it) {
          var cat = (it.category || '').toLowerCase();
          if (cat === 'kitchen_base') counts.kitchen_base++;
          else if (cat === 'kitchen_wall') counts.kitchen_wall++;
          else if (cat.indexOf('wardrobe') !== -1 || cat.indexOf('loft') !== -1) counts.wardrobe++;
          else if (cat.indexOf('tv') !== -1) counts.tv_unit++;
          else if (cat.indexOf('crockery') !== -1) counts.crockery++;
          else if (cat.indexOf('vanity') !== -1 || cat.indexOf('shoe') !== -1 || cat.indexOf('dresser') !== -1) counts.vanity++;
          else if (cat.indexOf('bed') !== -1) counts.bed++;
        });
        var elAll = document.getElementById('furnCountAll'); if (elAll) elAll.textContent = counts.all;
        var elKb = document.getElementById('furnCountKBase'); if (elKb) elKb.textContent = counts.kitchen_base;
        var elKw = document.getElementById('furnCountKWall'); if (elKw) elKw.textContent = counts.kitchen_wall;
        var elWr = document.getElementById('furnCountWardrobe'); if (elWr) elWr.textContent = counts.wardrobe;
        var elTv = document.getElementById('furnCountTV'); if (elTv) elTv.textContent = counts.tv_unit;
        var elCr = document.getElementById('furnCountCrockery'); if (elCr) elCr.textContent = counts.crockery;
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
          var fcm = catalog.find(function (it) { return it.id === 'fm-rt-01'; }) || catalog[0];
          selectUnitPreset(fcm);
        });
      }

      function renderCatalog() {
        updateCategoryCounts();
        var catalog = Core.FURNITURE_CATALOG || [];
        var activePresetId = (self.editor && self.editor.furniturePreset && self.editor.furniturePreset.id) || 'fm-rt-01';

        var query = currentSearch.trim().toLowerCase();
        var filtered = catalog.filter(function (it) {
          // Category filter
          if (currentCat !== 'all') {
            var c = (it.category || '').toLowerCase();
            if (currentCat === 'kitchen_base' && c !== 'kitchen_base') return false;
            if (currentCat === 'kitchen_wall' && c !== 'kitchen_wall') return false;
            if (currentCat === 'wardrobe' && c.indexOf('wardrobe') === -1 && c.indexOf('loft') === -1) return false;
            if (currentCat === 'tv_unit' && c.indexOf('tv') === -1) return false;
            if (currentCat === 'crockery' && c.indexOf('crockery') === -1) return false;
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
          return nameMatch || codeMatch || catMatch || dimsMatch || matMatch;
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
      var trayTabs = document.getElementById('furnTrayTabs');
      var trayCards = document.getElementById('furnTrayCards');
      var trayMinBtn = document.getElementById('furnTrayMinBtn');
      var trayCloseBtn = document.getElementById('furnTrayCloseBtn');
      var trayFilterBtn = document.getElementById('furnTrayFilterBtn');

      if (!sidePanel || !bottomTray) return;

      var Core = (typeof window !== 'undefined' && window.OrbixCore) ? window.OrbixCore : ((typeof root !== 'undefined' && root.OrbixCore) ? root.OrbixCore : {});
      var currentCat = 'base_unit';
      var currentTab = 'cookscape_fm';
      var isCollapsed = false;
      var isFurnishMenuOpen = false;

      var TABS_DATA = {
        all: [
          { id: 'all_units', label: 'All Units & Cabinets', count: '180+' }
        ],
        base_unit: [
          { id: 'cookscape_fm', label: 'COOKSCAPE (Kitchen- FM)', count: '43' },
          { id: 'cookscape_crockery', label: 'COOKSCAPE (Tv/Study/Crockery)', count: '54' },
          { id: 'cookscape_corner', label: 'COOKSCAPE - CORNER UNITS', count: '25' },
          { id: 'cookscape_drawers', label: 'COOKSCAPE - DRAWERS', count: '28' },
          { id: 'kitchen_drawers', label: 'KITCHEN - DRAWERS', count: '5' },
          { id: 'drawer_units', label: 'Drawer Units', count: '46' },
          { id: 'shutter_drawer', label: 'Shutter + Drawer Units', count: '153+' }
        ],
        crockery: [
          { id: 'crockery_all', label: 'All Crockery Units', count: '15' },
          { id: 'crockery_base', label: 'Crockery Base Units', count: '8' },
          { id: 'crockery_wall', label: 'Crockery Wall Units', count: '7' }
        ],
        tv_unit: [
          { id: 'tv_all', label: 'All TV Units', count: '14' },
          { id: 'tv_base', label: 'TV Base Consoles', count: '8' },
          { id: 'tv_wall', label: 'TV Wall Panels & Units', count: '6' }
        ],
        wardrobe: [
          { id: 'wr_sliding', label: 'Sliding Wardrobes', count: '18' },
          { id: 'wr_hinged', label: 'Hinged 2-Door Wardrobes', count: '26' },
          { id: 'wr_lofts', label: 'Wardrobe Modular Lofts', count: '15' },
          { id: 'wr_panels', label: 'Wall Paneling', count: '10' }
        ],
        wall_unit: [
          { id: 'kitchen_wm', label: 'KITCHEN - WM (Wall Units)', count: '24' },
          { id: 'wall_os', label: 'KITCHEN WALL O/S', count: '8' },
          { id: 'spice_racks', label: 'Spice Racks & Open Box', count: '14' },
          { id: 'pooja_wall', label: 'Pooja & Crockery Wall', count: '12' }
        ]
      };

      function getCardsForTab(cat, tabId) {
        var curCore = (typeof window !== 'undefined' && window.OrbixCore) ? window.OrbixCore : Core;
        var catalog = (curCore && curCore.FURNITURE_CATALOG) || [];
        function findCatItem(id) {
          return catalog.find(function (c) { return c.id === id || c.code === id; });
        }

        if (cat === 'base_unit') {
          if (tabId === 'cookscape_fm') {
            return [
              {
                id: 'fm-550-open',
                code: 'FM OPEN',
                name: 'FM 550 OPEN',
                badge: '7',
                selectedLabel: 'FM 550 OPEN',
                dimensions: { W: 550, H: 750, D: 560 },
                unitConfig: { ctype: 'kbase', shutters: 0, shelves: 1, carcass: 'Absolute White' },
                variants: [300, 450, 500, 550, 600, 900, 1200]
              },
              {
                id: 'bs-50-700',
                code: 'BS',
                name: 'BS - 50 X 700',
                badge: '1',
                selectedLabel: 'BS - 50 X 700',
                dimensions: { W: 50, H: 700, D: 560 },
                unitConfig: { ctype: 'kbase', shutters: 0, carcass: 'Absolute White' },
                variants: [50]
              },
              {
                id: 'fm-300',
                code: 'FM 1 DOOR',
                name: 'FM 300 (1 DOOR)',
                badge: '7',
                selectedLabel: 'FM 300',
                dimensions: { W: 300, H: 750, D: 560 },
                unitConfig: { ctype: 'kbase', shutters: 1, doorType: 'hinged', dstyle: 'slab', shelves: 1, carcass: 'MDF 1135', shutterCol: 'MDF 7701' },
                variants: [300, 350, 400, 450, 500, 550, 600]
              },
              {
                id: 'fm-1000',
                code: 'FM 2 DOOR',
                name: 'FM 1000 (2 DOOR)',
                badge: '12',
                selectedLabel: 'FM 1000',
                dimensions: { W: 1000, H: 750, D: 560 },
                unitConfig: { ctype: 'kbase', shutters: 2, doorType: 'hinged', dstyle: 'slab', shelves: 1, carcass: 'MDF 1135', shutterCol: 'MDF 7701' },
                variants: [700, 750, 800, 900, 1000, 1050, 1100, 1200]
              },
              {
                id: 'fm-300-os',
                code: 'FM 1 DOOR(O/S)',
                name: 'FM 300 SINK BASE (ONLY SHUTTER)',
                badge: '7',
                selectedLabel: 'FM 300 (O/S)',
                dimensions: { W: 300, H: 750, D: 560 },
                unitConfig: { ctype: 'kbase', shutters: 1, doorType: 'hinged', dstyle: 'slab', shelves: 0, carcass: 'MDF 1135' },
                variants: [300, 350, 400, 450, 500, 550, 600]
              },
              {
                id: 'fm-1200-os',
                code: 'FM 2 DOOR (O/S)',
                name: 'FM 1200 SINK BASE (ONLY SHUTTER)',
                badge: '9',
                selectedLabel: 'FM 1200 O/S',
                dimensions: { W: 1200, H: 750, D: 560 },
                unitConfig: { ctype: 'kbase', shutters: 2, doorType: 'hinged', dstyle: 'slab', shelves: 0, carcass: 'MDF 1135' },
                variants: [750, 800, 900, 1000, 1050, 1100, 1200]
              },
              {
                id: 'fcm-rt',
                code: 'FCM-RT',
                name: 'FCM-RT (Cookscape)',
                badge: '2',
                selectedLabel: 'FCM-RT (Cookscape)',
                dimensions: { W: 1200, H: 720, D: 560 },
                unitConfig: (findCatItem('fcm-rt') && findCatItem('fcm-rt').unitConfig) || { ctype: 'kbase', fixedPanel: { enabled: true, width: 600, type: 'fixed' }, openShutter: { enabled: true, width: 600, type: 'shutter', count: 1, opening: 'right' } },
                variants: [1050, 1200]
              },
              {
                id: 'fcm-lt',
                code: 'FCM-LT',
                name: 'FCM-LT (Cookscape)',
                badge: '2',
                selectedLabel: 'FCM-LT (Cookscape)',
                dimensions: { W: 1200, H: 720, D: 560 },
                unitConfig: (findCatItem('fcm-lt') && findCatItem('fcm-lt').unitConfig) || { ctype: 'kbase', fixedPanel: { enabled: true, width: 600, type: 'fixed' }, openShutter: { enabled: true, width: 600, type: 'shutter', count: 1, opening: 'left' } },
                variants: [1050, 1200]
              }
            ];
          }

          if (tabId === 'cookscape_corner') {
            return [
              {
                id: 'fbcm',
                code: 'L-CORNER',
                name: 'L-SHAPED CORNER BASE UNIT (Cookscape)',
                badge: '3',
                selectedLabel: 'L-SHAPED CORNER BASE UNIT',
                dimensions: { W: 900, H: 720, D: 560 },
                unitConfig: (findCatItem('fbcm') && findCatItem('fbcm').unitConfig) || { ctype: 'kbase', geometryType: 'l_shaped_corner' },
                variants: [900, 1050, 1200]
              },
              {
                id: 'fcm-rt',
                code: 'FCM-RT',
                name: 'FCM-RT (Cookscape)',
                badge: '2',
                selectedLabel: 'FCM-RT (Cookscape)',
                dimensions: { W: 1200, H: 720, D: 560 },
                unitConfig: (findCatItem('fcm-rt') && findCatItem('fcm-rt').unitConfig),
                variants: [1050, 1200]
              },
              {
                id: 'fcm-lt',
                code: 'FCM-LT',
                name: 'FCM-LT (Cookscape)',
                badge: '2',
                selectedLabel: 'FCM-LT (Cookscape)',
                dimensions: { W: 1200, H: 720, D: 560 },
                unitConfig: (findCatItem('fcm-lt') && findCatItem('fcm-lt').unitConfig),
                variants: [1050, 1200]
              }
            ];
          }

          if (tabId === 'cookscape_crockery') {
            return [
              {
                id: 'ctvb-1d-1dr',
                code: 'TV-1D-1DR',
                name: 'CROCKERY/TV BASE 1DOOR 1 DRAWER',
                badge: '4',
                selectedLabel: 'ctvb-1d-1dr (450×200)',
                dimensions: { W: 450, H: 200, D: 450 },
                unitConfig: (findCatItem('ctvb-1d-1dr') && findCatItem('ctvb-1d-1dr').unitConfig),
                variants: [450, 600, 750]
              },
              {
                id: 'ctvb-1dr',
                code: 'TV-1DR',
                name: 'CROCKERY/TV BASE 1 DRAWER',
                badge: '3',
                selectedLabel: 'ctvb-1dr (600×200)',
                dimensions: { W: 600, H: 200, D: 350 },
                unitConfig: (findCatItem('ctvb-1dr') && findCatItem('ctvb-1dr').unitConfig),
                variants: [450, 600, 800]
              },
              {
                id: 'ctvb-2d',
                code: 'TV-2D',
                name: 'CROCKERY/TV BASE 2 DOOR',
                badge: '6',
                selectedLabel: 'ctvb-2d (750×750)',
                dimensions: { W: 750, H: 750, D: 450 },
                unitConfig: (findCatItem('ctvb-2d') && findCatItem('ctvb-2d').unitConfig),
                variants: [600, 750, 900, 1050]
              },
              {
                id: 'ctvb-2d-2dr',
                code: 'TV-2D-2DR',
                name: 'CROCKERY/TV BASE 2 DOOR 2 DRAWER',
                badge: '5',
                selectedLabel: 'ctvb-2d-2dr (900×750)',
                dimensions: { W: 900, H: 750, D: 450 },
                unitConfig: (findCatItem('ctvb-2d-2dr') && findCatItem('ctvb-2d-2dr').unitConfig),
                variants: [750, 900, 1050, 1200]
              },
              {
                id: 'ctvb-2dr',
                code: 'TV-2DR',
                name: 'CROCKERY/TV BASE 2 DRAWER',
                badge: '4',
                selectedLabel: 'ctvb-2dr (450×500)',
                dimensions: { W: 450, H: 500, D: 350 },
                unitConfig: (findCatItem('ctvb-2dr') && findCatItem('ctvb-2dr').unitConfig),
                variants: [450, 600, 750]
              }
            ];
          }

          if (tabId === 'cookscape_drawers' || tabId === 'kitchen_drawers' || tabId === 'drawer_units') {
            return [
              {
                id: 'fm-d2-60',
                code: 'FM 2 DRAWER',
                name: 'FM 2 DRAWER BASE (600)',
                badge: '5',
                selectedLabel: 'FM 2 DRAWER (600)',
                dimensions: { W: 600, H: 750, D: 560 },
                unitConfig: { ctype: 'kbase', shutters: 0, drawers: 2, carcass: 'MDF 1135', shutterCol: 'MDF 7701' },
                variants: [450, 500, 600, 800, 900]
              },
              {
                id: 'fm-d3-60',
                code: 'FM 3 DRAWER',
                name: 'FM 3 DRAWER BASE (600)',
                badge: '5',
                selectedLabel: 'FM 3 DRAWER (600)',
                dimensions: { W: 600, H: 750, D: 560 },
                unitConfig: { ctype: 'kbase', shutters: 0, drawers: 3, carcass: 'MDF 1135', shutterCol: 'MDF 7701' },
                variants: [450, 500, 600, 800, 900]
              },
              {
                id: 'fm-d2-90',
                code: 'FM 2 DRAWER (900)',
                name: 'FM 2 DRAWER WIDE BASE',
                badge: '4',
                selectedLabel: 'FM 2 DRAWER (900)',
                dimensions: { W: 900, H: 750, D: 560 },
                unitConfig: { ctype: 'kbase', shutters: 0, drawers: 2, carcass: 'MDF 1135', shutterCol: 'MDF 7701' },
                variants: [750, 900, 1050]
              }
            ];
          }

          if (tabId === 'shutter_drawer') {
            return [
              {
                id: 'fm-1d-1dr',
                code: 'FM 1D 1DR',
                name: 'FM 1 DOOR 1 DRAWER BASE',
                badge: '6',
                selectedLabel: 'FM 1D 1DR (450)',
                dimensions: { W: 450, H: 750, D: 560 },
                unitConfig: { ctype: 'kbase', shutters: 1, drawers: 1, carcass: 'MDF 1135', shutterCol: 'MDF 7701' },
                variants: [400, 450, 500, 600]
              },
              {
                id: 'fm-2d-2dr',
                code: 'FM 2D 2DR',
                name: 'FM 2 DOOR 2 DRAWER BASE',
                badge: '5',
                selectedLabel: 'FM 2D 2DR (900)',
                dimensions: { W: 900, H: 750, D: 560 },
                unitConfig: { ctype: 'kbase', shutters: 2, drawers: 2, carcass: 'MDF 1135', shutterCol: 'MDF 7701' },
                variants: [750, 900, 1050, 1200]
              }
            ];
          }
        }

        if (cat === 'wall_unit') {
          return [
            {
              id: 'wm-60',
              code: 'WM 60',
              name: 'WM 60 (1 DOOR WALL)',
              badge: '6',
              selectedLabel: 'WM 600 (Wall)',
              dimensions: { W: 600, H: 600, D: 320 },
              unitConfig: { ctype: 'kwall', shutters: 1, shelves: 1, carcass: 'MDF 1135' },
              variants: [300, 450, 600, 750, 900]
            },
            {
              id: 'wm-60-dbl',
              code: 'WM 60 DBL',
              name: 'WM 60 DOUBLE KITCHEN WALL',
              badge: '4',
              selectedLabel: 'WM 60 DBL',
              dimensions: { W: 600, H: 600, D: 320 },
              unitConfig: (findCatItem('wm-60-dbl') && findCatItem('wm-60-dbl').unitConfig),
              variants: [600, 750, 900]
            },
            {
              id: 'ctvw-2d',
              code: 'POOJA WALL',
              name: 'CROCKERY/TV WALL 2 DOOR',
              badge: '4',
              selectedLabel: 'ctvw-2d (900×600)',
              dimensions: { W: 900, H: 600, D: 300 },
              unitConfig: (findCatItem('ctvw-2d') && findCatItem('ctvw-2d').unitConfig),
              variants: [600, 750, 900]
            },
            {
              id: 'ctvw-obs-02',
              code: 'SPICE RACK',
              name: 'CROCKERY/TV WALL OPEN BOX STORAGE',
              badge: '3',
              selectedLabel: 'ctvw-obs-02 (1500×300)',
              dimensions: { W: 1500, H: 300, D: 200 },
              unitConfig: (findCatItem('ctvw-obs-02') && findCatItem('ctvw-obs-02').unitConfig),
              variants: [900, 1200, 1500]
            }
          ];
        }

        if (cat === 'wardrobe') {
          return [
            {
              id: 'wr-sliding',
              code: 'SLIDING WR',
              name: 'SLIDING WARDROBE (1800×2100)',
              badge: '6',
              selectedLabel: 'wr-sliding (1800×2100)',
              dimensions: { W: 1800, H: 2100, D: 600 },
              unitConfig: (findCatItem('wr-sliding') && findCatItem('wr-sliding').unitConfig),
              variants: [1500, 1800, 2100, 2400]
            },
            {
              id: 'wr-shelves',
              code: 'WR 2D SHELVES',
              name: 'WR 2 DOOR WITH SHELVES',
              badge: '5',
              selectedLabel: 'wr-shelves (900×2100)',
              dimensions: { W: 900, H: 2100, D: 600 },
              unitConfig: (findCatItem('wr-shelves') && findCatItem('wr-shelves').unitConfig),
              variants: [800, 900, 1000, 1200]
            },
            {
              id: 'wr-drawers',
              code: 'WR 2D DRAWERS',
              name: 'WR 2 DOOR WITH DRAWERS',
              badge: '5',
              selectedLabel: 'wr-drawers (900×2100)',
              dimensions: { W: 900, H: 2100, D: 600 },
              unitConfig: (findCatItem('wr-drawers') && findCatItem('wr-drawers').unitConfig),
              variants: [800, 900, 1000, 1200]
            },
            {
              id: 'loft-2d-mod',
              code: 'LOFT 2D',
              name: 'WARDROBE LOFT 2 DOOR',
              badge: '4',
              selectedLabel: 'loft-2d (900×450)',
              dimensions: { W: 900, H: 450, D: 600 },
              unitConfig: { ctype: 'loft', shutters: 2, carcass: 'MDF 1135' },
              variants: [800, 900, 1000, 1200]
            }
          ];
        }

        if (cat === 'crockery') {
          return [
            {
              id: 'ctvb-1d-1dr',
              code: 'CR-1D-1DR',
              name: 'CROCKERY BASE 1DOOR 1 DRAWER',
              badge: '4',
              selectedLabel: 'ctvb-1d-1dr (450×200)',
              dimensions: { W: 450, H: 200, D: 450 },
              unitConfig: (findCatItem('ctvb-1d-1dr') && findCatItem('ctvb-1d-1dr').unitConfig),
              variants: [450, 600, 750]
            },
            {
              id: 'ctvb-1dr',
              code: 'CR-1DR',
              name: 'CROCKERY BASE 1 DRAWER',
              badge: '3',
              selectedLabel: 'ctvb-1dr (600×200)',
              dimensions: { W: 600, H: 200, D: 350 },
              unitConfig: (findCatItem('ctvb-1dr') && findCatItem('ctvb-1dr').unitConfig),
              variants: [450, 600, 800]
            },
            {
              id: 'ctvb-2d',
              code: 'CR-2D',
              name: 'CROCKERY BASE 2 DOOR',
              badge: '6',
              selectedLabel: 'ctvb-2d (750×750)',
              dimensions: { W: 750, H: 750, D: 450 },
              unitConfig: (findCatItem('ctvb-2d') && findCatItem('ctvb-2d').unitConfig),
              variants: [600, 750, 900, 1050]
            },
            {
              id: 'ctvb-2d-2dr',
              code: 'CR-2D-2DR',
              name: 'CROCKERY BASE 2 DOOR 2 DRAWER',
              badge: '5',
              selectedLabel: 'ctvb-2d-2dr (900×750)',
              dimensions: { W: 900, H: 750, D: 450 },
              unitConfig: (findCatItem('ctvb-2d-2dr') && findCatItem('ctvb-2d-2dr').unitConfig),
              variants: [750, 900, 1050, 1200]
            },
            {
              id: 'ctvw-2d',
              code: 'CR-WALL-2D',
              name: 'CROCKERY WALL 2 DOOR',
              badge: '4',
              selectedLabel: 'ctvw-2d (900×600)',
              dimensions: { W: 900, H: 600, D: 300 },
              unitConfig: (findCatItem('ctvw-2d') && findCatItem('ctvw-2d').unitConfig),
              variants: [600, 750, 900]
            },
            {
              id: 'ctvw-obs-02',
              code: 'CR-OPEN-BOX',
              name: 'CROCKERY OPEN BOX STORAGE',
              badge: '3',
              selectedLabel: 'ctvw-obs-02 (1500×300)',
              dimensions: { W: 1500, H: 300, D: 200 },
              unitConfig: (findCatItem('ctvw-obs-02') && findCatItem('ctvw-obs-02').unitConfig),
              variants: [900, 1200, 1500]
            }
          ];
        }

        if (cat === 'tv_unit') {
          return [
            {
              id: 'ctvb-2d-2dr',
              code: 'TV-2D-2DR',
              name: 'TV BASE 2 DOOR 2 DRAWER',
              badge: '5',
              selectedLabel: 'ctvb-2d-2dr (900×750)',
              dimensions: { W: 900, H: 750, D: 450 },
              unitConfig: (findCatItem('ctvb-2d-2dr') && findCatItem('ctvb-2d-2dr').unitConfig),
              variants: [750, 900, 1050, 1200]
            },
            {
              id: 'ctvb-1d-1dr',
              code: 'TV-1D-1DR',
              name: 'TV BASE 1DOOR 1 DRAWER',
              badge: '4',
              selectedLabel: 'ctvb-1d-1dr (450×200)',
              dimensions: { W: 450, H: 200, D: 450 },
              unitConfig: (findCatItem('ctvb-1d-1dr') && findCatItem('ctvb-1d-1dr').unitConfig),
              variants: [450, 600, 750]
            },
            {
              id: 'ctvb-2dr',
              code: 'TV-2DR',
              name: 'TV BASE 2 DRAWER CONSOLE',
              badge: '4',
              selectedLabel: 'ctvb-2dr (450×500)',
              dimensions: { W: 450, H: 500, D: 350 },
              unitConfig: (findCatItem('ctvb-2dr') && findCatItem('ctvb-2dr').unitConfig),
              variants: [450, 600, 750]
            },
            {
              id: 'ctvb-2d',
              code: 'TV-2D',
              name: 'TV BASE 2 DOOR CABINET',
              badge: '6',
              selectedLabel: 'ctvb-2d (750×750)',
              dimensions: { W: 750, H: 750, D: 450 },
              unitConfig: (findCatItem('ctvb-2d') && findCatItem('ctvb-2d').unitConfig),
              variants: [600, 750, 900, 1050]
            },
            {
              id: 'ctvw-2d',
              code: 'TV-WALL-2D',
              name: 'TV WALL 2 DOOR UNIT',
              badge: '4',
              selectedLabel: 'ctvw-2d (900×600)',
              dimensions: { W: 900, H: 600, D: 300 },
              unitConfig: (findCatItem('ctvw-2d') && findCatItem('ctvw-2d').unitConfig),
              variants: [600, 750, 900]
            },
            {
              id: 'ctvw-obs-02',
              code: 'TV-SHELF',
              name: 'TV FLOATING WALL SHELF',
              badge: '3',
              selectedLabel: 'ctvw-obs-02 (1500×300)',
              dimensions: { W: 1500, H: 300, D: 200 },
              unitConfig: (findCatItem('ctvw-obs-02') && findCatItem('ctvw-obs-02').unitConfig),
              variants: [900, 1200, 1500]
            }
          ];
        }

        if (cat === 'all') {
          return [
            {
              id: 'fbcm',
              code: 'L-CORNER',
              name: 'L-SHAPED CORNER BASE UNIT (Cookscape)',
              badge: '3',
              selectedLabel: 'L-SHAPED CORNER BASE UNIT',
              dimensions: { W: 900, H: 720, D: 560 },
              unitConfig: (findCatItem('fbcm') && findCatItem('fbcm').unitConfig) || { ctype: 'kbase', geometryType: 'l_shaped_corner' },
              variants: [900, 1050, 1200]
            },
            {
              id: 'fcm-rt',
              code: 'FCM-RT',
              name: 'FCM-RT (Cookscape)',
              badge: '2',
              selectedLabel: 'FCM-RT (Cookscape)',
              dimensions: { W: 1200, H: 720, D: 560 },
              unitConfig: (findCatItem('fcm-rt') && findCatItem('fcm-rt').unitConfig),
              variants: [1050, 1200]
            },
            {
              id: 'fcm-lt',
              code: 'FCM-LT',
              name: 'FCM-LT (Cookscape)',
              badge: '2',
              selectedLabel: 'FCM-LT (Cookscape)',
              dimensions: { W: 1200, H: 720, D: 560 },
              unitConfig: (findCatItem('fcm-lt') && findCatItem('fcm-lt').unitConfig),
              variants: [1050, 1200]
            },
            {
              id: 'fm-1000',
              code: 'FM 2 DOOR',
              name: 'FM 1000 (2 DOOR BASE)',
              badge: '12',
              selectedLabel: 'FM 1000',
              dimensions: { W: 1000, H: 750, D: 560 },
              unitConfig: { ctype: 'kbase', shutters: 2, doorType: 'hinged', dstyle: 'slab', shelves: 1, carcass: 'MDF 1135', shutterCol: 'MDF 7701' },
              variants: [700, 750, 800, 900, 1000, 1050, 1100, 1200]
            },
            {
              id: 'wm-60-dbl',
              code: 'WM 60 DBL',
              name: 'WM 60 DOUBLE KITCHEN WALL',
              badge: '4',
              selectedLabel: 'WM 60 DBL',
              dimensions: { W: 600, H: 600, D: 320 },
              unitConfig: (findCatItem('wm-60-dbl') && findCatItem('wm-60-dbl').unitConfig),
              variants: [600, 750, 900]
            },
            {
              id: 'wr-sliding',
              code: 'SLIDING WR',
              name: 'SLIDING WARDROBE (1800×2100)',
              badge: '6',
              selectedLabel: 'wr-sliding (1800×2100)',
              dimensions: { W: 1800, H: 2100, D: 600 },
              unitConfig: (findCatItem('wr-sliding') && findCatItem('wr-sliding').unitConfig),
              variants: [1500, 1800, 2100, 2400]
            },
            {
              id: 'ctvb-2d-2dr',
              code: 'TV-2D-2DR',
              name: 'CROCKERY/TV BASE 2 DOOR 2 DRAWER',
              badge: '5',
              selectedLabel: 'ctvb-2d-2dr (900×750)',
              dimensions: { W: 900, H: 750, D: 450 },
              unitConfig: (findCatItem('ctvb-2d-2dr') && findCatItem('ctvb-2d-2dr').unitConfig),
              variants: [750, 900, 1050, 1200]
            },
            {
              id: 'ctvw-2d',
              code: 'CR-WALL-2D',
              name: 'CROCKERY/TV WALL 2 DOOR',
              badge: '4',
              selectedLabel: 'ctvw-2d (900×600)',
              dimensions: { W: 900, H: 600, D: 300 },
              unitConfig: (findCatItem('ctvw-2d') && findCatItem('ctvw-2d').unitConfig),
              variants: [600, 750, 900]
            }
          ];
        }

        // Generic fallback for any other category
        var filtered = catalog.filter(function (it) {
          var c = (it.category || '').toLowerCase();
          var n = (it.name || '').toLowerCase();
          if (cat === 'crockery') return c.indexOf('crockery') !== -1 || n.indexOf('crockery') !== -1;
          if (cat === 'tv_unit') return c.indexOf('tv') !== -1 || n.indexOf('tv') !== -1;
          if (cat === 'all') return true;
          return c.indexOf(cat) !== -1 || n.indexOf(cat) !== -1;
        });

        if (filtered.length > 0) {
          return filtered.slice(0, 10).map(function (it) {
            return {
              id: it.id,
              code: it.code || it.id.toUpperCase(),
              name: it.name,
              badge: '4',
              selectedLabel: (it.code || it.name),
              dimensions: it.dimensions || { W: 900, H: 750, D: 560 },
              unitConfig: it.unitConfig,
              variants: [it.dimensions ? it.dimensions.W : 900]
            };
          });
        }

        // Fallback default decor items
        return [
          {
            id: cat + '-item-1',
            code: cat.toUpperCase(),
            name: cat.toUpperCase() + ' Standard Unit',
            badge: '2',
            selectedLabel: cat.toUpperCase() + ' 900mm',
            dimensions: { W: 900, H: 800, D: 500 },
            category: 'decor',
            isDecor: true,
            variants: [600, 900, 1200]
          }
        ];
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
            renderCards(cat, currentTab);
          });
          trayTabs.appendChild(btn);
        });
      }

      function renderCards(cat, tabId) {
        trayCards.innerHTML = '';
        var cards = getCardsForTab(cat, tabId);
        var activePresetId = (self.editor && self.editor.furniturePreset && self.editor.furniturePreset.id) || '';

        cards.forEach(function (cardData) {
          var card = document.createElement('div');
          var isSel = (cardData.id === activePresetId);
          card.className = 'furn-card' + (isSel ? ' is-active' : '');
          card.dataset.unitId = cardData.id;

          // Thumbnail
          var curCore = (typeof window !== 'undefined' && window.OrbixCore) ? window.OrbixCore : Core;
          var getIconFn = (curCore && curCore.getUnitIcon) || (typeof OrbixUnitIcons !== 'undefined' && OrbixUnitIcons.getIcon);
          var thumbUrl = getIconFn ? getIconFn({ id: cardData.id }) : 'icon-cookscape-unit.png';

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

            var itemToPlace = {
              id: cardData.id,
              name: cardData.name,
              category: cardData.category || (cat === 'base_unit' ? 'kitchen_base' : (cat === 'wall_unit' ? 'kitchen_wall' : cat)),
              dimensions: Object.assign({}, cardData.dimensions || { W: 900, H: 750, D: 560 }),
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
        catItems.forEach(function (item) {
          item.classList.toggle('is-active', item.dataset.cat === catKey);
        });
        renderTabs(catKey);
        renderCards(catKey, currentTab);
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

      // Wire Top Toolbar "Furnish" button toggle:
      // "when i click furnish side menu should open and on another it should get close"
      window.toggleFurnishMenu = function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
        var sp = document.getElementById('furnishSidePanel');
        var bt = document.getElementById('furnishBottomTray');
        var pBtn = document.getElementById('planFurnitureBtn');
        if (!sp) return;

        var isOpen = sp.style.display !== 'none' && sp.style.display !== '';
        if (!isOpen) {
          // Closed -> OPEN side menu
          sp.style.display = 'flex';
          if (bt) bt.style.display = 'none'; // bottom options tray opens when a menu item is clicked
          document.querySelectorAll('.plan-tool-btn').forEach(function (b) { b.classList.remove('is-active'); });
          if (pBtn) pBtn.classList.add('is-active');
          if (self.editor) self.editor.activeTool = 'furniture';
        } else {
          // Already open -> toggle CLOSE
          sp.style.display = 'none';
          if (bt) bt.style.display = 'none';
          if (pBtn) pBtn.classList.remove('is-active');
          if (self.editor) self.editor.activeTool = 'select';
          var selectBtn = document.querySelector ? document.querySelector('.plan-tool-btn[data-tool="select"]') : null;
          if (selectBtn) selectBtn.classList.add('is-active');
        }
        if (self.editor && self.editor.resize) {
          setTimeout(function () { self.editor.resize(); }, 150);
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
      { key: 'designCharges', label: 'Design charges & Handling Fee', type: 'percent', defaultPercent: 9, isDeduction: false },
      { key: 'freightCharges', label: 'Freight Charges', type: 'percent', defaultPercent: 2.5, isDeduction: false },
      { key: 'loadingUnloading', label: 'Loading and unloading (material)', type: 'select', options: ['Additional', 'Included'], defaultVal: 'Additional' },
      { key: 'floorMat', label: 'Floor protective mat', type: 'select', options: ['Not Included in Quote', 'Included'], defaultVal: 'Not Included in Quote' },
      { key: 'civilWorks', label: 'Civil works', type: 'select', options: ['As per actuals', 'Included'], defaultVal: 'As per actuals' },
      { key: 'electricalPlumbing', label: 'Electrical & Plumbing Works', type: 'select', options: ['Additional', 'Included'], defaultVal: 'Additional' },
      { key: 'falseCeiling', label: 'False ceiling', type: 'select', options: ['Not Included', 'Included'], defaultVal: 'Not Included' },
      { key: 'wallpaper', label: 'Wallpaper', type: 'select', options: ['Complementary', 'Not Included'], defaultVal: 'Complementary' },
      { key: 'discount', label: 'Discount', type: 'percent', isDeduction: true },
      { key: 'adp', label: 'ADP', type: 'percent', isDeduction: true }
    ],

    getCommercialCharges: function () {
      if (!this.project) return {};
      if (!this.project.commercialCharges) {
        this.project.commercialCharges = {
          additionalAccessories: 0,
          appliances: 0,
          designPercent: 9,
          freightPercent: 2.5,
          loadingUnloadingStatus: 'Additional',
          floorMatStatus: 'Not Included in Quote',
          civilWorksStatus: 'As per actuals',
          electricalPlumbingStatus: 'Additional',
          falseCeilingStatus: 'Not Included',
          wallpaperStatus: 'Complementary',
          discountPercent: 0,
          adpPercent: 0,
          gstPercent: 18
        };
      }
      var c = this.project.commercialCharges;
      if (c.accessories && !c.additionalAccessories) c.additionalAccessories = c.accessories;
      if (c.discount && !c.discountPercent) c.discountPercent = c.discount;
      if (c.designPercent === undefined) c.designPercent = 9;
      if (c.freightPercent === undefined) c.freightPercent = 2.5;
      if (!c.loadingUnloadingStatus) c.loadingUnloadingStatus = 'Additional';
      if (!c.floorMatStatus) c.floorMatStatus = 'Not Included in Quote';
      if (!c.civilWorksStatus) c.civilWorksStatus = 'As per actuals';
      if (!c.electricalPlumbingStatus) c.electricalPlumbingStatus = 'Additional';
      if (!c.falseCeilingStatus) c.falseCeilingStatus = 'Not Included';
      if (!c.wallpaperStatus) c.wallpaperStatus = 'Complementary';
      if (c.discountPercent === undefined) c.discountPercent = 0;
      if (c.adpPercent === undefined) c.adpPercent = 0;
      if (c.gstPercent === undefined) c.gstPercent = 18;
      return this.project.commercialCharges;
    },

    computeCommercialSummary: function (woodworkSubtotal, commCharges) {
      var charges = commCharges || this.getCommercialCharges();
      var addAccessories = parseFloat(charges.additionalAccessories || charges.accessories) || 0;
      var appliances = parseFloat(charges.appliances) || 0;

      var designPercent = (charges.designPercent !== undefined && charges.designPercent !== null && charges.designPercent !== '') ? parseFloat(charges.designPercent) : 9;
      if (isNaN(designPercent)) designPercent = 9;
      var designAmount = Math.round(woodworkSubtotal * (designPercent / 100));

      var freightPercent = (charges.freightPercent !== undefined && charges.freightPercent !== null && charges.freightPercent !== '') ? parseFloat(charges.freightPercent) : 2.5;
      if (isNaN(freightPercent)) freightPercent = 2.5;
      var freightAmount = Math.round(woodworkSubtotal * (freightPercent / 100));

      var discountPercent = parseFloat(charges.discountPercent || charges.discount) || 0;
      var discountAmount = Math.round(woodworkSubtotal * (discountPercent / 100));

      var adpPercent = parseFloat(charges.adpPercent || charges.adp) || 0;
      var adpAmount = Math.round(woodworkSubtotal * (adpPercent / 100));

      var totalDeductions = discountAmount + adpAmount;
      var grossAdditions = addAccessories + appliances + designAmount + freightAmount;

      var netValue = Math.max(0, Math.round(woodworkSubtotal + grossAdditions - totalDeductions));
      var gstPercent = (charges.gstPercent !== undefined && charges.gstPercent !== null && charges.gstPercent !== '') ? parseFloat(charges.gstPercent) : 18;
      if (isNaN(gstPercent)) gstPercent = 18;
      var gstAmount = Math.round(netValue * (gstPercent / 100));
      var grandTotal = netValue + gstAmount;

      return {
        woodworkSubtotal: Math.round(woodworkSubtotal),
        additionalAccessories: addAccessories,
        appliances: appliances,
        designPercent: designPercent,
        designAmount: designAmount,
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
        grossAdditions: grossAdditions,
        totalDeductions: totalDeductions,
        netValue: netValue,
        netTaxable: netValue,
        gstPercent: gstPercent,
        gstAmount: gstAmount,
        grandTotal: grandTotal
      };
    },

    renderBOQ: function () {
      var boqEl = document.getElementById('orbixBOQTable');
      if (!boqEl) return;

      this.sync3DStudioUnits();
      if (!this.selectedBOQRooms) {
        this.selectedBOQRooms = ['all'];
      }

      var quote = Core.generateFullQuotation(this.project, this.selectedBOQRooms);
      var sym = quote.currencySymbol;
      var rateCard = this.project.rateCard || Core.DEFAULT_RATE_CARD;
      var self = this;
      var commCharges = this.getCommercialCharges();
      var commSummary = this.computeCommercialSummary(quote.subtotalWoodwork, commCharges);

      if (!rateCard.selectedTier) {
        rateCard.selectedTier = 'PRICE 1';
        this.project.rateCard = rateCard;
      }
      var currentTier = rateCard.selectedTier || 'PRICE 1';
      var tiers = Core.PRICE_TIERS || [];

      var html = '<div class="boq-sheet">' +
        '<div class="boq-actions no-print">' +
        '<button class="btn primary" id="boqPrintBtn">📄 Download PDF</button>' +
        '<button class="btn" id="boqXlsxBtn" style="background:#107C41;color:#fff;border-color:#107C41;font-weight:600">📊 Download Excel (.xlsx)</button>' +
        '<button class="btn" id="boqEditDetailsBtn" style="font-weight:600;border-color:#2563EB;color:#2563EB">✏️ Edit Client Details</button>' +
        '<button class="btn" id="boqLockVersionBtn">Issue Quotation Snapshot</button>' +
        '<button class="btn" id="boqToggleRateCardBtn">Configure Company Rates</button>' +
        '</div>' +

        // ── Room Scope & Filter Bar ──
        '<div class="boq-room-filter-bar no-print">' +
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
                    rObj.name.indexOf('Dining') !== -1 ? '🍽️ ' : '🚪 ';

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
      var clientDisp = meta.clientName || 'Vikram Singhania';
      var contactDisp = meta.phone || meta.contactNumber || '+91 98765 43210';
      var locDisp = meta.siteAddress || meta.siteLocation || meta.location || 'Whitefield, Bengaluru';
      var bhDisp = meta.bhName || meta.designerName || 'Sangathamizh';
      var cpDisp = meta.cpCode || meta.quoteId || 'CP-9042';

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

        // Additional Accessories (enter amount)
        '<tr class="comm-charge-row">' +
        '<td colspan="4"></td>' +
        '<td colspan="4" class="bold">Additional Accessories</td>' +
        '<td colspan="3" style="text-align:right;white-space:nowrap">' +
        '<div style="display:inline-flex;align-items:center;justify-content:flex-end;gap:4px">' +
        '<span style="font-size:11px;color:#64748B;font-weight:600">₹</span>' +
        '<input type="number" min="0" step="any" class="comm-input" data-key="additionalAccessories" value="' + (commCharges.additionalAccessories || '') + '" placeholder="enter amount">' +
        '<span style="font-size:11px;color:#94A3B8">.00</span>' +
        '</div></td></tr>' +

        // Appliances (enter amount)
        '<tr class="comm-charge-row">' +
        '<td colspan="4"></td>' +
        '<td colspan="4" class="bold">Appliances</td>' +
        '<td colspan="3" style="text-align:right;white-space:nowrap">' +
        '<div style="display:inline-flex;align-items:center;justify-content:flex-end;gap:4px">' +
        '<span style="font-size:11px;color:#64748B;font-weight:600">₹</span>' +
        '<input type="number" min="0" step="any" class="comm-input" data-key="appliances" value="' + (commCharges.appliances || '') + '" placeholder="enter amount">' +
        '<span style="font-size:11px;color:#94A3B8">.00</span>' +
        '</div></td></tr>' +

        // Design charges & Handling Fee (9%)
        '<tr class="comm-charge-row">' +
        '<td colspan="4"></td>' +
        '<td colspan="4" class="bold">Design charges &amp; Handling Fee</td>' +
        '<td colspan="3" style="text-align:right;white-space:nowrap">' +
        '<div style="display:inline-flex;align-items:center;justify-content:flex-end;gap:6px">' +
        '<input type="number" min="0" max="100" step="any" class="comm-input" data-key="designPercent" value="' + commSummary.designPercent + '" style="width:55px" placeholder="9">' +
        '<span style="font-size:11px;color:#64748B;font-weight:600">% &nbsp;=&nbsp; ₹</span>' +
        '<span id="commDesignAmount" class="bold" style="font-family:var(--mono);font-size:12px;display:inline-block;min-width:70px">' + commSummary.designAmount.toLocaleString('en-IN') + '.00</span>' +
        '</div></td></tr>' +

        // Freight Charges (2.50%)
        '<tr class="comm-charge-row">' +
        '<td colspan="4"></td>' +
        '<td colspan="4" class="bold">Freight Charges</td>' +
        '<td colspan="3" style="text-align:right;white-space:nowrap">' +
        '<div style="display:inline-flex;align-items:center;justify-content:flex-end;gap:6px">' +
        '<input type="number" min="0" max="100" step="any" class="comm-input" data-key="freightPercent" value="' + commSummary.freightPercent + '" style="width:55px" placeholder="2.5">' +
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

        // Discount (enter %)
        '<tr class="comm-charge-row">' +
        '<td colspan="4"></td>' +
        '<td colspan="4" class="bold text-red">Discount</td>' +
        '<td colspan="3" style="text-align:right;white-space:nowrap">' +
        '<div style="display:inline-flex;align-items:center;justify-content:flex-end;gap:6px">' +
        '<span style="font-size:11px;color:#DC2626;font-weight:600">(-)</span>' +
        '<input type="number" min="0" max="100" step="any" class="comm-input is-discount" data-key="discountPercent" value="' + (commSummary.discountPercent || '') + '" style="width:55px" placeholder="enter %">' +
        '<span style="font-size:11px;color:#DC2626;font-weight:600">% &nbsp;=&nbsp; (-) ₹</span>' +
        '<span id="commDiscountAmount" class="bold text-red" style="font-family:var(--mono);font-size:12px;display:inline-block;min-width:70px">' + commSummary.discountAmount.toLocaleString('en-IN') + '.00</span>' +
        '</div></td></tr>' +

        // ADP (enter %)
        '<tr class="comm-charge-row">' +
        '<td colspan="4"></td>' +
        '<td colspan="4" class="bold text-red">ADP</td>' +
        '<td colspan="3" style="text-align:right;white-space:nowrap">' +
        '<div style="display:inline-flex;align-items:center;justify-content:flex-end;gap:6px">' +
        '<span style="font-size:11px;color:#DC2626;font-weight:600">(-)</span>' +
        '<input type="number" min="0" max="100" step="any" class="comm-input is-discount" data-key="adpPercent" value="' + (commSummary.adpPercent || '') + '" style="width:55px" placeholder="enter %">' +
        '<span style="font-size:11px;color:#DC2626;font-weight:600">% &nbsp;=&nbsp; (-) ₹</span>' +
        '<span id="commAdpAmount" class="bold text-red" style="font-family:var(--mono);font-size:12px;display:inline-block;min-width:70px">' + commSummary.adpAmount.toLocaleString('en-IN') + '.00</span>' +
        '</div></td></tr>' +

        // NET VALUE (renamed from NET TAXABLE VALUE)
        '<tr class="taxable-row">' +
        '<td colspan="4"></td>' +
        '<td colspan="4" class="bold" style="font-size:12px">NET VALUE</td>' +
        '<td colspan="3" class="c-num bold" id="commNetTaxable" style="font-size:13px;color:#1E3A8A">₹ ' + commSummary.netValue.toLocaleString('en-IN') + '.00</td>' +
        '</tr>' +

        // GST (Additional)
        '<tr class="comm-charge-row" style="background:#F8FAFC">' +
        '<td colspan="4"></td>' +
        '<td colspan="4" class="bold">GST <span style="font-size:11px;color:#64748B;font-weight:normal;">(Additional)</span></td>' +
        '<td colspan="3" style="text-align:right;white-space:nowrap">' +
        '<div style="display:inline-flex;align-items:center;justify-content:flex-end;gap:6px">' +
        '<span style="font-size:11px;color:#64748B">Rate:</span>' +
        '<input type="number" min="0" max="100" step="any" class="comm-input" data-key="gstPercent" value="' + commSummary.gstPercent + '" style="width:55px" placeholder="18">' +
        '<span style="font-size:11px;color:#64748B;font-weight:600">% &nbsp;=&nbsp; ₹</span>' +
        '<span id="commGstAmount" class="bold" style="font-family:var(--mono);font-size:12px;display:inline-block;min-width:70px">' + commSummary.gstAmount.toLocaleString('en-IN') + '.00</span>' +
        '</div></td></tr>' +

        // Grand Total (Give total)
        '<tr class="grand-row">' +
        '<td colspan="4"></td>' +
        '<td colspan="4" class="bold grand-lbl" style="font-size:13px">GRAND TOTAL</td>' +
        '<td colspan="3" class="c-num bold grand-val" id="commFinalTotal" style="font-size:14px">INR ' + commSummary.grandTotal.toLocaleString('en-IN') + '.00</td>' +
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

          var summary = self.computeCommercialSummary(quote.subtotalWoodwork, self.project.commercialCharges);

          var designAmtEl = document.getElementById('commDesignAmount');
          if (designAmtEl) designAmtEl.textContent = summary.designAmount.toLocaleString('en-IN') + '.00';

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

          var finalEl = document.getElementById('commFinalTotal');
          if (finalEl) finalEl.textContent = 'INR ' + summary.grandTotal.toLocaleString('en-IN') + '.00';

          var headerTotalEl = document.getElementById('boqHeaderTotalAmount');
          if (headerTotalEl) headerTotalEl.textContent = 'INR ' + summary.grandTotal.toLocaleString('en-IN') + '.00';

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

          if (clientInput) clientInput.value = m.clientName || 'Vikram Singhania';
          if (contactInput) contactInput.value = m.phone || m.contactNumber || '+91 98765 43210';
          if (locInput) locInput.value = m.siteAddress || m.siteLocation || m.location || 'Whitefield, Bengaluru';
          if (bhSelect) bhSelect.value = m.bhName || m.designerName || 'Sangathamizh';
          if (dtInput) dtInput.value = m.dateTime || (m.dateCreated ? self.formatDisplayDate(m.dateCreated, true) : '05-11-2026 23:36');
          if (cpInput) cpInput.value = m.cpCode || m.quoteId || 'CP-9042';

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
          var t = pill.getAttribute('data-tier') || 'PRICE 1';
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

    render3DHome: function (keepCamera, isolatedRoomId) {
      if (typeof THREE === 'undefined' || !window.__cc || !window.__cc.gl) return;
      var gl = window.__cc.gl;
      var scene = gl.getScene ? gl.getScene() : null;
      if (!scene) return;

      // Ensure sky is radiant sky blue and outer ground outside walls is lush grass green
      if (!scene.background || !(scene.background instanceof THREE.Color) || scene.background.getHex() !== 0x82C3EC) {
        scene.background = new THREE.Color(0x82C3EC);
      }
      scene.children.forEach(function (c) {
        if (c.isMesh && c.geometry && c.geometry.type === 'PlaneGeometry' && c.geometry.parameters && c.geometry.parameters.width >= 100000) {
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
        if (isolatedRoomId !== undefined) {
          this.currentIsolatedRoomId = (isolatedRoomId === 'all' || !isolatedRoomId) ? null : isolatedRoomId;
        }
        this.archRenderer.buildHome(proj, this.currentIsolatedRoomId);
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
      }
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
      var quote = Core.generateFullQuotation(this.project, this.selectedBOQRooms);
      var currentTier = (this.project.rateCard && this.project.rateCard.selectedTier) || 'PRICE 1';
      var meta = (this.project && this.project.meta) || {};
      var roomScopeText = quote.isFiltered ? ('Filtered: ' + (self.selectedBOQRooms || []).join(', ')) : 'All Rooms (Entire Home)';

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
      setCell(4, 5, meta.clientName || 'Vikram Singhania', 4);
      setCell(4, 6, 'Contact:', 3);
      setCell(4, 7, meta.phone || meta.contactNumber || '+91 98765 43210', 4);
      setCell(4, 8, 'Active Tier:', 3);
      setCell(4, 9, currentTier, 4);
      setCell(4, 10, '', 4);
      addMerge(9, 4, 10, 4);

      // Meta Box Row 5
      setCell(5, 4, 'Site Address:', 3);
      setCell(5, 5, meta.siteAddress || meta.siteLocation || meta.location || 'Whitefield, Bengaluru', 4);
      setCell(5, 6, '', 4);
      setCell(5, 7, '', 4);
      addMerge(5, 5, 7, 5);
      setCell(5, 8, 'BH Name:', 3);
      setCell(5, 9, meta.bhName || meta.designerName || 'Sangathamizh', 4);
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
        var roomTitleText = '🏠 Room: ' + rName + ' · ' + rItems.length + ' Units · Variant: ' + rActiveTier;
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
          setCell(currRow, 3, it.name + '\nGroup: ' + (it.modelLabel || it.modelType || 'Cabinet') + '\nModel: ' + it.name, sLeft);
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
        { label: 'Hardware & Functional Fittings Subtotal', status: 'Included in Base Package', amt: 0, style: 12 },
        { label: 'Additional Accessories', status: addAccVal > 0 ? 'Specified' : 'Standard', amt: comm.additionalAccessories, style: 12 },
        { label: 'Appliances', status: appliancesVal > 0 ? 'Specified' : 'Standard', amt: comm.appliances, style: 12 },
        { label: 'Design charges & Handling Fee', status: comm.designPercent + '%', amt: comm.designAmount, style: 12 },
        { label: 'Freight Charges', status: comm.freightPercent + '%', amt: comm.freightAmount, style: 12 },
        { label: 'Loading and unloading (material)', status: comm.loadingUnloadingStatus || 'Additional', amt: comm.loadingUnloadingStatus === 'Included' ? 0 : 'Additional', style: 10 },
        { label: 'Floor protective mat', status: comm.floorMatStatus || 'Not Included in Quote', amt: comm.floorMatStatus === 'Included' ? 0 : 'Not Included', style: 10 },
        { label: 'Civil works', status: comm.civilWorksStatus || 'As per actuals', amt: comm.civilWorksStatus === 'Included' ? 0 : 'As per actuals', style: 10 },
        { label: 'Electrical & Plumbing Works', status: comm.electricalPlumbingStatus || 'Additional', amt: comm.electricalPlumbingStatus === 'Included' ? 0 : 'Additional', style: 10 },
        { label: 'False ceiling', status: comm.falseCeilingStatus || 'Not Included', amt: comm.falseCeilingStatus === 'Included' ? 0 : 'Not Included', style: 10 },
        { label: 'Wallpaper', status: comm.wallpaperStatus || 'Complementary', amt: comm.wallpaperStatus === 'Complementary' ? 'Complementary' : 'Not Included', style: 10 },
        { label: 'Discount', status: '(-) ' + comm.discountPercent + '%', amt: -comm.discountAmount, style: 19 },
        { label: 'ADP', status: '(-) ' + comm.adpPercent + '%', amt: -comm.adpAmount, style: 19 },
        { label: 'NET VALUE', status: 'Taxable Amount', amt: comm.netValue, style: 20, isNet: true },
        { label: 'GST (Additional)', status: 'Rate: ' + comm.gstPercent + '%', amt: comm.gstAmount, style: 12 },
        { label: 'GRAND TOTAL', status: 'Net Payable', amt: comm.grandTotal, style: 22, isGrand: true }
      ];

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
