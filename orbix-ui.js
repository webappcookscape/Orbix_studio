/* ═══════════════════════════════════════════════════════════════════════════════
   ORBIX STUDIO — UI Integration, Plan Controller & BOQ Quotation Manager
   ═══════════════════════════════════════════════════════════════════════════════ */

(function (root) {
  'use strict';

  var Core = root.OrbixCore;
  var PlanEditor = root.OrbixPlan;

  var OrbixUI = {
    editor: null,
    project: null,

    init: function () {
      var planContainer = document.getElementById('planCanvasContainer');
      if (!planContainer) return;

      // Initialize with clean project; live project is loaded dynamically from PostgreSQL per account
      this.project = Core.createProject('Untitled Project');

      var self = this;
      this.editor = new PlanEditor(planContainer, {
        project: this.project,
        onProjectChange: function (proj) {
          self.project = proj;
          self.saveToLocalStorage();
          self.updateUI();
          self.renderBOQ();
          if (window.OrbixProjects && window.OrbixProjects.saveActiveProject) {
            window.OrbixProjects.saveActiveProject({
              plan: proj,
              units: window.S ? window.S.units : []
            });
          }
        },
        onSelectionChange: function (selected) {
          self.renderInspector(selected);
        }
      });

      this.bindToolbar();
      this.updateUI();
      this.renderBOQ();
    },

    loadProject: function (proj) {
      if (!proj) return;
      this.project = proj;
      this.saveToLocalStorage();
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
      this.syncProjectUnitsTo3DStudio();
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
        if (window.OrbixProjects && window.OrbixProjects.currentUser && window.OrbixProjects.activeProjectId) {
          var key = 'orbix_project_' + window.OrbixProjects.currentUser.id + '_' + window.OrbixProjects.activeProjectId;
          localStorage.setItem(key, Core.serializeProject(this.project));
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
          self.editor.activeTool = tool;
          if (tool !== 'wall') self.editor.wallChainStart = null;
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

        var importedGroup = document.createElement('optgroup');
        importedGroup.label = 'Imported Modular Units (Catalog)';
        var standardGroup = document.createElement('optgroup');
        standardGroup.label = 'Standard Library';

        for (var i = 0; i < Core.FURNITURE_CATALOG.length; i++) {
          var item = Core.FURNITURE_CATALOG[i];
          var opt = document.createElement('option');
          opt.value = item.id;
          var dimsText = item.dimensions ? (' (' + item.dimensions.W + '×' + item.dimensions.H + ')') : '';
          opt.textContent = (item.icon ? item.icon + ' ' : '') + item.name + dimsText;
          if (item.id.indexOf('-') !== -1 || ['W-01', 'W-02', 'W-03', 'CR-01', 'TV-01', 'K-01', 'K-02', 'fm-rt-01', 'wm-01'].indexOf(item.id) !== -1) {
            importedGroup.appendChild(opt);
          } else {
            standardGroup.appendChild(opt);
          }
        }
        if (importedGroup.children.length > 0) furnSel.appendChild(importedGroup);
        if (standardGroup.children.length > 0) furnSel.appendChild(standardGroup);

        if (currentVal && furnSel.querySelector('option[value="' + currentVal + '"]')) {
          furnSel.value = currentVal;
        } else if (furnSel.options.length > 0) {
          furnSel.selectedIndex = 0;
        }
      }

      syncFurnDropdown();

      if (furnSel && Core.FURNITURE_CATALOG) {
        furnSel.addEventListener('change', function () {
          var fId = furnSel.value;
          for (var i = 0; i < Core.FURNITURE_CATALOG.length; i++) {
            if (Core.FURNITURE_CATALOG[i].id === fId) {
              self.editor.furniturePreset = Core.FURNITURE_CATALOG[i];
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

      // 4. Kitchen FM 600 Modular Base Unit
      p.plan.furniture.push(Core.createFurniturePlacement({
        id: 'fm-01',
        name: 'FM 600',
        category: 'kitchen_base',
        modelType: 'kitchen_fm',
        refCode: 'FM-01',
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
    },

    renderInspector: function (selected) {
      var panel = document.getElementById('planInspectorContent');
      if (!panel) return;
      var self = this;

      if (!selected || selected.length === 0) {
        panel.innerHTML = '<div class="insp-empty">Select a wall, door, window, or room to inspect and edit exact dimensions.</div>';
        return;
      }

      var sel = selected[0];
      if (sel.type === 'wall') {
        var w = this.editor.getWall(sel.id);
        if (!w) return;
        var lenMm = Math.round(Core.wallLength(w));
        panel.innerHTML =
          '<div class="insp-title">Wall Properties</div>' +
          '<div class="insp-row"><label>Length (mm)</label><input type="number" id="inspWallLen" value="' + lenMm + '" step="50"></div>' +
          '<div class="insp-row"><label>Thickness (mm)</label><input type="number" id="inspWallThick" value="' + (w.thickness || 150) + '" step="10"></div>' +
          '<div class="insp-row"><label>Height (mm)</label><input type="number" id="inspWallH" value="' + (w.height || 2800) + '" step="50"></div>' +
          '<button class="btn danger full" id="inspDelWall" style="margin-top:12px">Delete Wall</button>';

        document.getElementById('inspWallLen').addEventListener('change', function (e) {
          var targetL = parseFloat(e.target.value);
          if (targetL > 100) {
            var dir = Core.wallDirection(w);
            w.end.x = w.start.x + dir.x * targetL;
            w.end.y = w.start.y + dir.y * targetL;
            self.editor.pushHistory('Resize Wall');
            self.editor.render();
          }
        });
        document.getElementById('inspWallThick').addEventListener('change', function (e) {
          w.thickness = parseFloat(e.target.value);
          self.editor.pushHistory('Change Wall Thickness');
          self.editor.render();
        });
        document.getElementById('inspWallH').addEventListener('change', function (e) {
          w.height = parseFloat(e.target.value);
          self.editor.pushHistory('Change Wall Height');
          self.editor.render();
        });
        document.getElementById('inspDelWall').addEventListener('click', function () {
          self.editor.deleteSelected();
        });
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

        panel.innerHTML =
          '<div class="insp-title">' + (op.type === 'door' ? 'Door' : 'Window') + ' Properties</div>' +
          '<div class="insp-row"><label>Width (mm)</label><input type="number" id="inspOpW" value="' + op.width + '" min="400" max="3000" step="50"></div>' +
          '<div class="insp-row"><label>Height (mm)</label><input type="number" id="inspOpH" value="' + op.height + '" min="500" max="3500" step="50"></div>' +
          '<div class="insp-row"><label>Offset along wall (mm)</label><input type="number" id="inspOpOff" value="' + Math.round(op.offset) + '" min="' + minOff + '" max="' + maxOff + '" step="50"></div>' +
          '<div style="font-size:10.5px;color:#64748B;margin:-4px 0 10px 0;">Allowed: ' + minOff + ' mm – ' + maxOff + ' mm (Wall: ' + wallL + ' mm)</div>' +
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

        document.getElementById('inspDelOp').addEventListener('click', function () {
          self.editor.deleteSelected();
          self.saveToLocalStorage();
          if (window.OrbixProjects && window.OrbixProjects.saveActiveProject) {
            window.OrbixProjects.saveActiveProject({ plan: self.project });
          }
          if (typeof self.render3DHome === 'function') {
            self.render3DHome();
          }
        });
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
        var shuttersCount = (fn.unitConfig && fn.unitConfig.shutters !== undefined) ? fn.unitConfig.shutters : (fn.dimensions.W > 1200 ? 3 : fn.dimensions.W > 600 ? 2 : 1);
        var drawersCount = (fn.unitConfig && fn.unitConfig.drawers !== undefined) ? fn.unitConfig.drawers : 0;

        panel.innerHTML =
          '<div class="insp-title">Modular Unit Properties</div>' +
          '<div class="insp-row"><label>Item Name</label><input type="text" id="inspFurnName" value="' + fn.name + '"></div>' +
          '<div class="insp-row"><label>Room Assignment</label><select id="inspFurnRoom">' + roomOptions + '</select></div>' +
          '<div class="insp-row"><label>Width (mm)</label><input type="number" id="inspFurnW" value="' + fn.dimensions.W + '" step="50"></div>' +
          '<div class="insp-row"><label>Height (mm)</label><input type="number" id="inspFurnH" value="' + fn.dimensions.H + '" step="50"></div>' +
          '<div class="insp-row"><label>Depth (mm)</label><input type="number" id="inspFurnD" value="' + fn.dimensions.D + '" step="50"></div>' +
          '<div class="insp-row"><label>Shutters</label><input type="number" id="inspFurnShutters" value="' + shuttersCount + '" min="0" max="8"></div>' +
          '<div class="insp-row"><label>Drawers</label><input type="number" id="inspFurnDrawers" value="' + drawersCount + '" min="0" max="6"></div>' +
          '<div class="insp-row"><label>Shutter Finish</label><select id="inspFurnShutterCol">' +
            '<option value="Brazilian Horizontal Walnut"' + (shutterFinish.indexOf('Walnut') !== -1 ? ' selected' : '') + '>Brazilian Walnut</option>' +
            '<option value="Absolute White"' + (shutterFinish.indexOf('White') !== -1 || shutterFinish.indexOf('Gloss') !== -1 ? ' selected' : '') + '>Absolute White Gloss</option>' +
            '<option value="Sage Green Matte"' + (shutterFinish.indexOf('Sage') !== -1 ? ' selected' : '') + '>Sage Green Matte</option>' +
            '<option value="Sonoma Oak"' + (shutterFinish.indexOf('Oak') !== -1 ? ' selected' : '') + '>Sonoma Oak</option>' +
            '<option value="Concrete Look"' + (shutterFinish.indexOf('Concrete') !== -1 ? ' selected' : '') + '>Concrete Look</option>' +
          '</select></div>' +
          '<div class="insp-row"><label>Carcass</label><select id="inspFurnCarcass">' +
            '<option value="Absolute White"' + (carcassFinish.indexOf('White') !== -1 ? ' selected' : '') + '>Absolute White (BWP)</option>' +
            '<option value="Brazilian Horizontal Walnut"' + (carcassFinish.indexOf('Walnut') !== -1 ? ' selected' : '') + '>Walnut Woodgrain</option>' +
            '<option value="Sonoma Oak"' + (carcassFinish.indexOf('Oak') !== -1 ? ' selected' : '') + '>Sonoma Oak</option>' +
          '</select></div>' +
          '<button class="btn primary full" id="inspOpen3DStudio" style="margin-top:8px">📐 Open &amp; Customize in 3D Studio</button>' +
          '<button class="btn full" id="inspRotateFurn" style="margin-top:8px">Rotate 90° (R)</button>' +
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
                if (fn.unitConfig) {
                  if (fn.unitConfig.shutters !== undefined) eu.shutters = fn.unitConfig.shutters;
                  if (fn.unitConfig.drawers !== undefined) eu.drawers = fn.unitConfig.drawers;
                  if (fn.unitConfig.shutterCol) eu.shutterCol = fn.unitConfig.shutterCol;
                  if (fn.unitConfig.carcass) eu.carcass = fn.unitConfig.carcass;
                }
                break;
              }
            }
          }
        }

        document.getElementById('inspFurnName').addEventListener('change', function (e) {
          fn.name = e.target.value;
          syncInspectorTo3D();
          self.saveToLocalStorage();
          self.renderBOQ();
          self.editor.render();
        });
        document.getElementById('inspFurnRoom').addEventListener('change', function (e) {
          fn.roomId = e.target.value || null;
          self.saveToLocalStorage();
          self.renderBOQ();
          self.editor.render();
        });
        document.getElementById('inspFurnW').addEventListener('change', function (e) {
          fn.dimensions.W = parseFloat(e.target.value);
          syncInspectorTo3D();
          self.editor.pushHistory('Resize Furniture');
          self.saveToLocalStorage();
          self.renderBOQ();
          self.editor.render();
          if (self.render3DHome) self.render3DHome();
        });
        document.getElementById('inspFurnH').addEventListener('change', function (e) {
          fn.dimensions.H = parseFloat(e.target.value);
          syncInspectorTo3D();
          self.editor.pushHistory('Resize Furniture');
          self.saveToLocalStorage();
          self.renderBOQ();
          self.editor.render();
          if (self.render3DHome) self.render3DHome();
        });
        document.getElementById('inspFurnD').addEventListener('change', function (e) {
          fn.dimensions.D = parseFloat(e.target.value);
          syncInspectorTo3D();
          self.editor.pushHistory('Resize Furniture');
          self.saveToLocalStorage();
          self.renderBOQ();
          self.editor.render();
          if (self.render3DHome) self.render3DHome();
        });
        document.getElementById('inspFurnShutters').addEventListener('change', function (e) {
          if (!fn.unitConfig) fn.unitConfig = {};
          fn.unitConfig.shutters = parseInt(e.target.value) || 0;
          syncInspectorTo3D();
          self.editor.pushHistory('Edit Shutters Count');
          self.saveToLocalStorage();
          self.renderBOQ();
          self.editor.render();
          if (self.render3DHome) self.render3DHome();
        });
        document.getElementById('inspFurnDrawers').addEventListener('change', function (e) {
          if (!fn.unitConfig) fn.unitConfig = {};
          fn.unitConfig.drawers = parseInt(e.target.value) || 0;
          syncInspectorTo3D();
          self.editor.pushHistory('Edit Drawers Count');
          self.saveToLocalStorage();
          self.renderBOQ();
          self.editor.render();
          if (self.render3DHome) self.render3DHome();
        });
        document.getElementById('inspFurnShutterCol').addEventListener('change', function (e) {
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
          if (self.render3DHome) self.render3DHome();
        });
        document.getElementById('inspFurnCarcass').addEventListener('change', function (e) {
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
          if (self.render3DHome) self.render3DHome();
        });
        document.getElementById('inspOpen3DStudio').addEventListener('click', function () {
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
              activeUnit.W = fn.dimensions.W;
              activeUnit.H = fn.dimensions.H;
              activeUnit.D = fn.dimensions.D;
              if (fn.unitConfig && fn.unitConfig.shutters !== undefined) activeUnit.shutters = fn.unitConfig.shutters;
              if (fn.unitConfig && fn.unitConfig.drawers !== undefined) activeUnit.drawers = fn.unitConfig.drawers;
              if (fn.materials && fn.materials.shutter && fn.materials.shutter.finish) activeUnit.shutterCol = fn.materials.shutter.finish;
              if (fn.materials && fn.materials.carcass && fn.materials.carcass.finish) activeUnit.carcass = fn.materials.carcass.finish;
            } else {
              var isKitchen = (fn.category && fn.category.indexOf('kitchen') !== -1);
              var newU = {
                label: fn.name,
                ctype: isKitchen ? 'kbase' : fn.category === 'tv_unit' ? 'tv' : fn.category === 'crockery' ? 'crockery' : 'wardrobe',
                _furnId: fn.id,
                W: fn.dimensions.W,
                H: fn.dimensions.H,
                D: fn.dimensions.D,
                T: 18,
                type: (fn.unitConfig && fn.unitConfig.type) || 'hinged',
                shutters: (fn.unitConfig && fn.unitConfig.shutters !== undefined) ? fn.unitConfig.shutters : (fn.dimensions.W > 1200 ? 3 : fn.dimensions.W > 600 ? 2 : 1),
                sections: (fn.unitConfig && fn.unitConfig.sections) || (fn.dimensions.W > 1200 ? 2 : 1),
                shelves: (fn.unitConfig && fn.unitConfig.shelves) || (isKitchen ? 1 : 3),
                drawers: (fn.unitConfig && fn.unitConfig.drawers) || 0,
                drawerH: 180,
                loft: (fn.unitConfig && fn.unitConfig.loft) || false,
                loftH: 600,
                loftShutters: 2,
                back: 18,
                dstyle: (fn.unitConfig && fn.unitConfig.dstyle) || 'slab',
                handle: (fn.unitConfig && fn.unitConfig.handle) || 'gprof',
                hfinish: (fn.unitConfig && fn.unitConfig.hfinish) || 'black',
                counter: (fn.unitConfig && fn.unitConfig.counter) || (isKitchen ? 'black' : 'none'),
                carcass: (fn.materials && fn.materials.carcass && fn.materials.carcass.finish) || 'Absolute White',
                shutterCol: (fn.materials && fn.materials.shutter && fn.materials.shutter.finish) || 'Brazilian Horizontal Walnut'
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
        document.getElementById('inspRotateFurn').addEventListener('click', function () {
          fn.rotY = ((fn.rotY || 0) + Math.PI / 2) % (Math.PI * 2);
          self.editor.pushHistory('Rotate Furniture');
          self.saveToLocalStorage();
          self.editor.render();
          if (self.render3DHome) self.render3DHome();
        });
        document.getElementById('inspDelFurn').addEventListener('click', function () {
          self.editor.deleteSelected();
          if (window.S && window.S.units) {
            window.S.units = window.S.units.filter(function (u) { return u._furnId !== fn.id; });
            window.S.active = Math.max(0, window.S.units.length - 1);
            if (typeof window.renderRail === 'function') window.renderRail();
          }
          if (self.render3DHome) self.render3DHome();
        });
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
          '<button class="btn primary full" id="inspFocusRoom3D" style="margin-top:12px">👁 View Room in 3D Studio</button>';

        var nameInput = document.getElementById('inspRoomName');
        if (nameInput) {
          nameInput.addEventListener('input', function (e) {
            rm.name = e.target.value;
            self.editor.render();
            self.saveToLocalStorage();
          });
        }

        document.querySelectorAll('.insp-room-chip').forEach(function (btn) {
          btn.addEventListener('click', function () {
            rm.name = btn.dataset.name;
            if (nameInput) nameInput.value = btn.dataset.name;
            self.editor.pushHistory('Rename Room');
            self.editor.render();
            self.saveToLocalStorage();
            if (self.render3DHome) self.render3DHome();
          });
        });

        var floorSel = document.getElementById('inspRoomFloor');
        if (floorSel) {
          floorSel.addEventListener('change', function (e) {
            rm.floorFinish = e.target.value;
            self.editor.pushHistory('Change Floor Finish');
            self.saveToLocalStorage();
            if (self.render3DHome) self.render3DHome();
          });
        }

        var htInput = document.getElementById('inspRoomHeight');
        if (htInput) {
          htInput.addEventListener('change', function (e) {
            rm.ceilingHeight = parseFloat(e.target.value) || 2800;
            self.editor.pushHistory('Change Ceiling Height');
            self.saveToLocalStorage();
            if (self.render3DHome) self.render3DHome();
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

    syncProjectUnitsTo3DStudio: function (selectFurnId) {
      if (!this.project || !this.project.plan) return;
      var furnList = this.project.plan.furniture || [];

      window.S = window.S || {};

      // If no furniture is placed on the 2D floor plan, 3D Studio must have 0 units!
      if (!furnList.length) {
        window.S.units = [];
        window.S.active = 0;
        if (typeof window.renderRail === 'function') window.renderRail();
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
        var isKitchen = (fn.category && fn.category.indexOf('kitchen') !== -1);
        var existing = existingMap[fn.id];

        if (existing) {
          if (fn.name) existing.label = fn.name;
          if (fn.dimensions) {
            if (fn.dimensions.W) existing.W = fn.dimensions.W;
            if (fn.dimensions.H) existing.H = fn.dimensions.H;
            if (fn.dimensions.D) existing.D = fn.dimensions.D;
          }
          if (fn.unitConfig) {
            if (fn.unitConfig.shutters !== undefined) existing.shutters = fn.unitConfig.shutters;
            if (fn.unitConfig.drawers !== undefined) existing.drawers = fn.unitConfig.drawers;
            if (fn.unitConfig.shelves !== undefined) existing.shelves = fn.unitConfig.shelves;
            if (fn.unitConfig.dstyle) existing.dstyle = fn.unitConfig.dstyle;
            if (fn.unitConfig.handle) existing.handle = fn.unitConfig.handle;
            if (fn.unitConfig.hfinish) existing.hfinish = fn.unitConfig.hfinish;
            if (fn.unitConfig.type) existing.type = fn.unitConfig.type;
            if (fn.unitConfig.loft !== undefined) existing.loft = fn.unitConfig.loft;
            if (fn.unitConfig.loftH !== undefined) existing.loftH = fn.unitConfig.loftH;
          }
          if (fn.materials) {
            if (fn.materials.shutter && fn.materials.shutter.finish) existing.shutterCol = fn.materials.shutter.finish;
            if (fn.materials.carcass && fn.materials.carcass.finish) existing.carcass = fn.materials.carcass.finish;
          }
          newUnits.push(existing);
        } else {
          var isWall = (fn.category === 'kitchen_wall');
          var defH = isWall ? 600 : isKitchen ? 750 : (fn.category === 'tv_unit' ? 1800 : (fn.category === 'crockery' ? 2100 : 2100));
          var defW = (fn.dimensions && fn.dimensions.W) || (isKitchen ? 600 : 1200);
          var defD = (fn.dimensions && fn.dimensions.D) || (isWall ? 300 : isKitchen ? 550 : 600);
          var u = {
            label: fn.name,
            ctype: isKitchen ? (isWall ? 'kwall' : 'kbase') : fn.category === 'tv_unit' ? 'tv' : fn.category === 'crockery' ? 'crockery' : 'wardrobe',
            _furnId: fn.id,
            W: (fn.dimensions && fn.dimensions.W) || defW,
            H: (fn.dimensions && fn.dimensions.H) || defH,
            D: (fn.dimensions && fn.dimensions.D) || defD,
            T: 18,
            type: (fn.unitConfig && fn.unitConfig.type) || 'hinged',
            shutters: (fn.unitConfig && fn.unitConfig.shutters !== undefined) ? fn.unitConfig.shutters : (defW > 1200 ? 3 : defW > 600 ? 2 : 1),
            sections: (fn.unitConfig && fn.unitConfig.sections) || (defW > 1200 ? 2 : 1),
            shelves: (fn.unitConfig && fn.unitConfig.shelves) || (isKitchen ? 1 : 3),
            drawers: (fn.unitConfig && fn.unitConfig.drawers) || 0,
            drawerH: 180,
            loft: (fn.unitConfig && fn.unitConfig.loft) || false,
            loftH: 600,
            loftShutters: 2,
            back: 18,
            dstyle: (fn.unitConfig && fn.unitConfig.dstyle) || 'slab',
            handle: (fn.unitConfig && fn.unitConfig.handle) || 'gprof',
            hfinish: (fn.unitConfig && fn.unitConfig.hfinish) || 'black',
            counter: (fn.unitConfig && fn.unitConfig.counter) || (isKitchen ? 'black' : 'none'),
            carcass: (fn.materials && fn.materials.carcass && fn.materials.carcass.finish) || 'MDF 1135',
            shutterCol: (fn.materials && fn.materials.shutter && fn.materials.shutter.finish) || 'MDF 7701'
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
    },

    selectFurnitureIn3DStudio: function (furnId) {
      if (!furnId) return;
      this.syncProjectUnitsTo3DStudio(furnId);
      for (var i = 0; i < window.S.units.length; i++) {
        if (window.S.units[i]._furnId === furnId) {
          window.S.active = i;
          break;
        }
      }
      if (typeof window.renderRail === 'function') window.renderRail();
      if (typeof window.renderLegend === 'function') window.renderLegend();
      if (typeof window.buildScene === 'function') window.buildScene();
      this.highlight3DFurniture(furnId);
      if (typeof this.render3DHome === 'function') this.render3DHome();
    },

    highlight3DFurniture: function (furnId) {
      if (!window.__cc || !window.__cc.gl) return;
      var gl = window.__cc.gl;
      var scene = gl.getScene ? gl.getScene() : null;
      var homeObj = scene ? scene.getObjectByName('OrbixHome3D') : null;
      if (homeObj) {
        homeObj.traverse(function (obj) {
          if (obj.userData && obj.userData.isFurnitureGroup) {
            var isSel = (obj.userData.furnitureId === furnId);
            obj.traverse(function (child) {
              if (child.isMesh && child.material) {
                var mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach(function (m) {
                  if (m.emissive) {
                    if (isSel) {
                      child.userData._origEmissive = (child.userData._origEmissive !== undefined) ? child.userData._origEmissive : m.emissive.getHex();
                      m.emissive.setHex(0x2563eb);
                      m.emissiveIntensity = 0.45;
                    } else if (child.userData._origEmissive !== undefined) {
                      m.emissive.setHex(child.userData._origEmissive);
                      m.emissiveIntensity = 0;
                    }
                  }
                });
              }
            });
          }
        });
      }
      if (gl.settle) gl.settle();
    },

    sync3DStudioUnits: function () {
      if (!window.S || !window.S.units || !this.project || !this.project.plan) return;
      var furnList = this.project.plan.furniture = this.project.plan.furniture || [];

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
          if (u.loft !== undefined) match.unitConfig.loft = u.loft;
          if (u.loftH !== undefined) match.unitConfig.loftH = u.loftH;
          if (u.back !== undefined) match.unitConfig.back = u.back;
          if (u.hfinish) match.unitConfig.hfinish = u.hfinish;
          if (u.shutterCol) {
            match.unitConfig.shutterCol = u.shutterCol;
            match.materials = match.materials || {};
            match.materials.shutter = match.materials.shutter || {};
            match.materials.shutter.finish = u.shutterCol;
          }
          if (u.carcass) {
            match.unitConfig.carcass = u.carcass;
            match.materials = match.materials || {};
            match.materials.carcass = match.materials.carcass || {};
            match.materials.carcass.finish = u.carcass;
          }
        }
      }
      this.project.units_count = furnList.length;
      this.saveToLocalStorage();
      if (this.editor) this.editor.render();
      if (this.render3DHome) this.render3DHome();
      if (window.S && window.S.units && window.S.units[window.S.active]) {
        var curU = window.S.units[window.S.active];
        if (curU && curU._furnId) this.highlight3DFurniture(curU._furnId);
      }
    },

    placeModularUnitIn3D: function (preset) {
      if (!this.project || !this.project.plan) return;
      var plan = this.project.plan;
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

      var newFurn = {
        id: fId,
        name: preset.name || 'Modular Unit',
        category: preset.category || 'wardrobe',
        roomId: matchedRoomId,
        pos: { x: cX, y: cY, z: 0 },
        rotY: 0,
        dimensions: Object.assign({ W: 1200, H: 2100, D: 600 }, preset.dimensions || {}),
        unitConfig: Object.assign({
          shutters: 2,
          handle: 'bar',
          dstyle: 'slab',
          shelves: 3,
          drawers: 0,
          carcass: 'Absolute White',
          shutterCol: 'Brazilian Horizontal Walnut'
        }, preset.unitConfig || {}),
        materials: Object.assign({
          shutter: { material: 'HDHMR_18mm', finish: 'Brazilian Horizontal Walnut' },
          carcass: { material: 'BWP_18mm', finish: 'Absolute White' }
        }, preset.materials || {})
      };

      plan.furniture.push(newFurn);
      this.project.units_count = plan.furniture.length;
      this.saveToLocalStorage();
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
      var modal = document.getElementById('modalPlaceUnit3D');
      var grid = document.getElementById('placeUnitCatalogGrid');
      if (!modal || !grid) return;

      var catalog = [
        { name: '2-Door Wardrobe', cat: 'wardrobe', dims: { W: 900, H: 2100, D: 600 }, shutters: 2, icon: '🚪', desc: 'Compact bedroom wardrobe' },
        { name: '3-Door Wardrobe', cat: 'wardrobe', dims: { W: 1500, H: 2100, D: 600 }, shutters: 3, icon: '🚪', desc: 'Master bedroom with drawers' },
        { name: 'Sliding Wardrobe', cat: 'wardrobe', dims: { W: 1800, H: 2100, D: 650 }, shutters: 2, icon: '🪟', type: 'sliding', desc: 'Smooth sliding shutters' },
        { name: 'Kitchen Base Run', cat: 'kitchen_base', dims: { W: 1200, H: 750, D: 550 }, shutters: 2, icon: '🍳', desc: 'Countertop base storage' },
        { name: 'Kitchen Wall Cabinets', cat: 'kitchen_wall', dims: { W: 1200, H: 600, D: 300 }, shutters: 2, icon: '🎛️', desc: 'Overhead wall mounted' },
        { name: 'TV Entertainment Unit', cat: 'tv_unit', dims: { W: 1800, H: 1800, D: 400 }, shutters: 2, icon: '📺', desc: 'Media console + back panel' },
        { name: 'Crockery Glass Display', cat: 'crockery', dims: { W: 900, H: 2100, D: 450 }, shutters: 2, icon: '🍷', desc: 'Glass frame crockery display' },
        { name: 'Dresser with Mirror', cat: 'dresser', dims: { W: 900, H: 2100, D: 450 }, shutters: 1, icon: '🪞', desc: 'Vanity counter with mirror' },
        { name: 'Shoe Rack Unit', cat: 'shoe_rack', dims: { W: 900, H: 1050, D: 350 }, shutters: 2, icon: '👠', desc: 'Foyer entryway shoe storage' }
      ];

      var self = this;
      grid.innerHTML = '';
      catalog.forEach(function (c) {
        var card = document.createElement('div');
        card.style.cssText = 'padding:14px;border:1px solid var(--rule);border-radius:8px;background:var(--paper);cursor:pointer;transition:all .15s ease;display:flex;flex-direction:column;gap:6px;';
        card.innerHTML =
          '<div style="font-size:24px;">' + c.icon + '</div>' +
          '<div style="font-weight:600;font-size:13px;color:var(--ink);">' + c.name + '</div>' +
          '<div style="font-size:11px;color:var(--ink-2);">' + c.dims.W + ' × ' + c.dims.H + ' × ' + c.dims.D + ' mm</div>' +
          '<div style="font-size:11px;color:var(--ink-2);margin-top:2px;">' + c.desc + '</div>' +
          '<button class="btn primary small" style="margin-top:8px;">+ Place in 3D</button>';
        card.addEventListener('mouseenter', function () { card.style.borderColor = 'var(--blue)'; card.style.transform = 'translateY(-2px)'; });
        card.addEventListener('mouseleave', function () { card.style.borderColor = 'var(--rule)'; card.style.transform = 'none'; });
        card.addEventListener('click', function () {
          self.placeModularUnitIn3D({
            name: c.name,
            category: c.cat,
            dimensions: c.dims,
            unitConfig: { shutters: c.shutters, type: c.type || 'hinged' }
          });
          modal.classList.remove('is-open');
        });
        grid.appendChild(card);
      });

      modal.classList.add('is-open');
      modal.querySelectorAll('.modal-close-btn, .modal-backdrop').forEach(function (b) {
        b.onclick = function () { modal.classList.remove('is-open'); };
      });
    },

    renderBOQ: function () {
      var boqEl = document.getElementById('orbixBOQTable');
      if (!boqEl) return;

      this.sync3DStudioUnits();
      var quote = Core.generateFullQuotation(this.project);
      var sym = quote.currencySymbol;
      var rateCard = this.project.rateCard || Core.DEFAULT_RATE_CARD;
      var self = this;
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
        '<button class="btn" id="boqLockVersionBtn">Issue Quotation Snapshot</button>' +
        '<button class="btn" id="boqToggleRateCardBtn">Configure Company Rates</button>' +
        '</div>' +

        '<div class="boq-tier-bar no-print">' +
        '<div class="boq-tier-label"><span class="tier-icon">🏷️</span> <b>Price Variant & Finish Tier:</b></div>' +
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
        '<div class="insp-row"><label>Installation (₹/SFT)</label><input type="number" id="rc_install" value="' + (rateCard.laborRates.installationPerSft || 85) + '"></div>' +
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

        '<div class="quote-sheet-single">' +
        '<div class="quote-header-split">' +
        '<div class="qh-left">' +
        '<div class="qh-row"><span class="qh-lbl">Project ID</span><span class="qh-val">' + (this.project.meta.quoteId || '5754') + '</span></div>' +
        '<div class="qh-row"><span class="qh-lbl">Customer</span><span class="qh-val">' + (this.project.meta.clientName || 'Dhanesh') + '</span></div>' +
        '<div class="qh-row"><span class="qh-lbl">Design ID</span><span class="qh-val">' + (this.project.meta.designId || 'Design1') + '</span></div>' +
        '<div class="qh-row"><span class="qh-lbl">Designer</span><span class="qh-val">' + (this.project.meta.designerName || 'Abishek Kumar') + '</span></div>' +
        '<div class="qh-row"><span class="qh-lbl">Scope</span><span class="qh-val">' + (this.project.meta.scope || 'Complete design') + '</span></div>' +
        '</div>' +
        '<div class="qh-right">' +
        '<div class="qh-row"><span class="qh-lbl">Quotation Date</span><span class="qh-val">' + (this.project.meta.dateCreated || '28 Oct, 2026') + '</span></div>' +
        '<div class="qh-row"><span class="qh-lbl">Price Expiry Date</span><span class="qh-val">' + (this.project.meta.validUntil || '27 Nov, 2026') + '</span></div>' +
        '<div class="qh-row"><span class="qh-lbl">Total No. of Items</span><span class="qh-val">' + quote.furnitureItems.length + '</span></div>' +
        '<div class="qh-row total"><span class="qh-lbl">Total Amount</span><span class="qh-val">INR ' + quote.grandTotal.toLocaleString('en-IN') + '.00</span></div>' +
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
        '<tr class="sec-bar-row"><td colspan="11"><b>Products</b></td></tr>' +
        '</thead>' +
        '<tbody>';

      for (var f = 0; f < quote.furnitureItems.length; f++) {
        var it = quote.furnitureItems[f];
        var d = it.dimensions || { W: 1200, H: 2100, D: 600 };
        var codePrefix = it.category === 'wardrobe' ? 'W' : it.category.indexOf('kitchen') !== -1 ? 'K' : it.category.indexOf('bed') !== -1 ? 'B' : it.category === 'tv_unit' ? 'TV' : 'U';
        var refCode = it.refCode || ('C' + (12 + f + 1));
        var svgThumb = self.getUnitSVG(it.category);

        var smat = (it.materials && it.materials.shutter) ? it.materials.shutter : { material: 'HDHMR_18MM', finish: 'Brazilian Horizontal Walnut' };
        var cmat = (it.materials && it.materials.carcass) ? it.materials.carcass : { material: 'BWP_18MM', finish: 'Absolute White' };

        html += '<tr>' +
          '<td class="c-center">' + (f + 1) + '</td>' +
          '<td class="c-center bold">' + refCode + '</td>' +
          '<td class="c-center p-0">' + svgThumb + '</td>' +
          '<td>' +
          '<div class="item-name">' + it.name + '</div>' +
          '<div class="item-sub">Group: ' + (it.modelLabel || it.modelType || 'WR 2 DOOR SHELF') + '</div>' +
          '<div class="item-sub">Model: ' + it.name + '</div>' +
          '</td>' +
          '<td class="dim-cell">' +
          '<div>Width: ' + d.W + '</div>' +
          '<div>Depth: ' + d.D + '</div>' +
          '<div>Height: ' + d.H + '</div>' +
          '</td>' +
          '<td class="c-center">' + (it.categoryName || 'Wardrobe') + '</td>' +
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
          '<td class="c-num">' + it.baseRate.toLocaleString('en-IN') + '</td>' +
          '<td class="c-num">' + it.areaSft.toFixed(2) + ' sq foot</td>' +
          '<td class="c-num bold">' + Math.round(it.totalAmount).toLocaleString('en-IN') + '.00</td>' +
          '</tr>';
      }

      html += '<tr class="subtotal-bar"><td colspan="10" style="text-align:right;padding-right:12px;font-weight:700">SUBTOTAL PRODUCTS</td><td class="c-num bold">' + Math.round(quote.subtotalWoodwork).toLocaleString('en-IN') + '.00</td></tr>';

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
        hwItems.push({ code: 'H-01', name: 'Auto Soft-Close Hinges', spec: 'Stainless Steel 304', qty: totalHinges, unit: 'nos', rate: 240, type: 'hinge' });
      }
      if (totalDrawers > 0) {
        hwItems.push({ code: 'H-02', name: 'Telescopic Drawer Channels', spec: 'Triple Extension Heavy-Duty', qty: totalDrawers, unit: 'pair', rate: 700, type: 'runner' });
      }
      if (totalHandles > 0) {
        hwItems.push({ code: 'H-03', name: 'Designer Edge Profile Handles', spec: 'Matte Charcoal Aluminum', qty: totalHandles, unit: 'nos', rate: 350, type: 'handle' });
      }
      if (totalWardrobeRails > 0) {
        hwItems.push({ code: 'H-04', name: 'Wardrobe Hanging Oval Rails', spec: 'Chrome Plated Oval Rail', qty: totalWardrobeRails, unit: 'nos', rate: 450, type: 'rod' });
      }
      if (totalLocks > 0) {
        hwItems.push({ code: 'H-05', name: 'Precision Cam Locks', spec: 'Brass Core with Dimple Keys', qty: totalLocks, unit: 'nos', rate: 280, type: 'lock' });
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
            '<td class="c-num">' + hw.rate.toLocaleString('en-IN') + '</td>' +
            '<td class="c-num">' + hw.qty + ' ' + hw.unit + '</td>' +
            '<td class="c-num bold">' + hwAmt.toLocaleString('en-IN') + '.00</td>' +
            '</tr>';
        }
        html += '<tr class="subtotal-bar"><td colspan="10" style="text-align:right;padding-right:12px;font-weight:700">SUBTOTAL HARDWARE &amp; FITTINGS</td><td class="c-num bold">' + totalHw.toLocaleString('en-IN') + '.00</td></tr>';
      }

      var grandWoodwork = quote.subtotalWoodwork;
      var totalLabor = quote.installCharge;
      // Pro-rate transport for small orders / single units
      var totalTransport = (quote.furnitureItems.length === 1 && quote.furnitureItems[0].areaSft < 15) ? 650 : (quote.furnitureItems.length <= 2 ? 1500 : quote.transportCharge);
      var netTaxable = Math.round(grandWoodwork + totalHw + totalLabor + totalTransport + quote.marginAmount);
      var gst18 = Math.round(netTaxable * 0.18);
      var allInclusiveTotal = netTaxable + gst18;

      html += '<tr class="sec-bar-row"><td colspan="11"><b>Commercial Estimate Summary</b></td></tr>' +
        '<tr><td colspan="4"></td><td colspan="6" class="bold">Modular Woodwork Subtotal</td><td class="c-num">' + Math.round(grandWoodwork).toLocaleString('en-IN') + '.00</td></tr>' +
        (totalHw > 0 ? ('<tr><td colspan="4"></td><td colspan="6" class="bold">Hardware &amp; Functional Fittings Subtotal</td><td class="c-num">' + Math.round(totalHw).toLocaleString('en-IN') + '.00</td></tr>') : '') +
        '<tr><td colspan="4"></td><td colspan="6" class="bold">Installation &amp; Assembly Labor</td><td class="c-num">' + Math.round(totalLabor).toLocaleString('en-IN') + '.00</td></tr>' +
        '<tr><td colspan="4"></td><td colspan="6" class="bold">Logistics &amp; Site Delivery</td><td class="c-num">' + Math.round(totalTransport).toLocaleString('en-IN') + '.00</td></tr>' +
        '<tr><td colspan="4"></td><td colspan="6" class="bold">Company Overhead / Margin (' + quote.marginPercent + '%)</td><td class="c-num">' + Math.round(quote.marginAmount).toLocaleString('en-IN') + '.00</td></tr>' +
        '<tr class="taxable-row"><td colspan="4"></td><td colspan="6" class="bold">NET TAXABLE VALUE</td><td class="c-num bold">' + netTaxable.toLocaleString('en-IN') + '.00</td></tr>' +
        '<tr><td colspan="4"></td><td colspan="6" class="bold">GST @ 18% (CGST 9% + SGST 9%)</td><td class="c-num">' + gst18.toLocaleString('en-IN') + '.00</td></tr>' +
        '<tr class="grand-row"><td colspan="4"></td><td colspan="6" class="bold grand-lbl">FINAL ALL-INCLUSIVE QUOTE</td><td class="c-num bold grand-val">INR ' + allInclusiveTotal.toLocaleString('en-IN') + '.00</td></tr>' +
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

      // Tier selector button clicks
      var pills = boqEl.querySelectorAll('.tier-pill, .matrix-th-btn');
      pills.forEach(function (pill) {
        pill.addEventListener('click', function () {
          var t = pill.getAttribute('data-tier') || 'PRICE 1';
          self.project.rateCard.selectedTier = t;
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
          rc.laborRates.installationPerSft = parseFloat(document.getElementById('rc_install').value) || 85;
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

    render3DHome: function () {
      if (typeof THREE === 'undefined' || !window.__cc || !window.__cc.gl) return;
      var gl = window.__cc.gl;
      var scene = gl.getScene ? gl.getScene() : null;
      if (!scene) return;

      if (!this.archRenderer && root.Orbix3D) {
        this.archRenderer = new root.Orbix3D(scene);
      }
      if (this.archRenderer) {
        this.archRenderer.buildHome(this.project);
        if (gl.frame) gl.frame();
        if (gl.apply) gl.apply();
        if (gl.settle) gl.settle();
      }
    },

    getUnitSVG: function (cat) {
      cat = (cat || '').toLowerCase();
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

    exportXLSX: function () {
      this.sync3DStudioUnits();
      var quote = Core.generateFullQuotation(this.project);
      var currentTier = (this.project.rateCard && this.project.rateCard.selectedTier) || 'PRICE 1';
      var meta = (this.project && this.project.meta) || {};

      var rows = [
        ['ORBIX STUDIO — RESIDENTIAL INTERIOR ESTIMATION & QUOTATION'],
        ['Quote Ref #:', meta.quoteId || 'ORB-2026-089', 'Date:', meta.dateCreated || new Date().toLocaleDateString('en-IN'), 'Status:', 'Approved Estimate', 'Active Tier:', currentTier],
        ['Client Name:', meta.clientName || 'Aravind K.', 'Contact:', meta.phone || '+91 98450 12345', 'Email:', meta.email || 'aravind@example.com'],
        ['Site Address:', meta.siteAddress || 'Flat 402, Skyline Residency, Bangalore', 'Designer:', meta.designerName || 'Orbix Studio Design Team'],
        [],
        ['Sl.No', 'Item Code', 'Item Description', 'Room / Zone', 'Width (mm)', 'Height (mm)', 'Depth (mm)', 'Area (SFT)', 'Shutter Material', 'Shutter Finish', 'Carcass Material', 'Carcass Finish', 'Qty', 'Unit Rate (INR)', 'Total Amount (INR)']
      ];

      for (var f = 0; f < quote.furnitureItems.length; f++) {
        var it = quote.furnitureItems[f];
        var d = it.dimensions || { W: 1200, H: 2100, D: 600 };
        var codePrefix = it.category === 'wardrobe' ? 'W' : it.category.indexOf('kitchen') !== -1 ? 'K' : it.category.indexOf('bed') !== -1 ? 'B' : it.category === 'tv_unit' ? 'TV' : 'U';
        var itemCode = codePrefix + '-0' + (f + 1);

        var smat = (it.materials && it.materials.shutter) ? it.materials.shutter : { material: 'HDHMR_18MM', finish: 'Brazilian Horizontal Walnut' };
        var cmat = (it.materials && it.materials.carcass) ? it.materials.carcass : { material: 'BWP_18MM', finish: 'Absolute White' };

        rows.push([
          f + 1,
          itemCode,
          it.name + ' (' + (it.modelLabel || it.modelType) + ')',
          it.roomName,
          d.W,
          d.H,
          d.D,
          parseFloat(it.areaSft.toFixed(2)),
          smat.material,
          smat.finish,
          cmat.material,
          cmat.finish,
          1,
          it.baseRate,
          Math.round(it.totalAmount)
        ]);
      }

      rows.push(['', '', 'SUBTOTAL WOODWORK & MODULAR UNITS', '', '', '', '', '', '', '', '', '', '', '', Math.round(quote.subtotalWoodwork)]);
      rows.push([]);
      rows.push(['HARDWARE & FUNCTIONAL FITTINGS SPECIFICATIONS']);

      var hwItems = [
        { code: 'H-01', name: 'Auto Soft-Close Hinges (35mm Cup SS)', spec: 'Stainless Steel 304 · Hydraulic Soft-Close', qty: Math.max(8, quote.furnitureItems.length * 4), unit: 'nos', rate: 240 },
        { code: 'H-02', name: 'Telescopic Drawer Runners (Soft-Close)', spec: 'Triple Extension Heavy-Duty Ball Bearing (45kg)', qty: Math.max(2, quote.furnitureItems.length * 1), unit: 'pair', rate: 700 },
        { code: 'H-03', name: 'Designer Edge Profile Pull Handles (200mm)', spec: 'Matte Charcoal Aluminum Edge Profile', qty: Math.max(4, quote.furnitureItems.length * 2), unit: 'nos', rate: 350 },
        { code: 'H-04', name: 'Wardrobe Hanging Oval Rail + Flanges', spec: 'Chrome Plated Oval Rail with Cushioning Gaskets', qty: Math.max(2, quote.furnitureItems.length * 1), unit: 'nos', rate: 450 },
        { code: 'H-05', name: 'Precision Deadbolt Wardrobe Locks', spec: 'Brass Core with Computerized Dimple Keys', qty: 2, unit: 'nos', rate: 280 }
      ];

      var totalHw = 0;
      for (var h = 0; h < hwItems.length; h++) {
        var hw = hwItems[h];
        var hwAmt = hw.qty * hw.rate;
        totalHw += hwAmt;
        rows.push([
          quote.furnitureItems.length + h + 1,
          hw.code,
          hw.name,
          'All Rooms',
          '-',
          '-',
          '-',
          '-',
          hw.spec,
          '-',
          '-',
          '-',
          hw.qty + ' ' + hw.unit,
          hw.rate,
          hwAmt
        ]);
      }

      rows.push(['', '', 'SUBTOTAL HARDWARE & ACCESSORIES', '', '', '', '', '', '', '', '', '', '', '', totalHw]);
      rows.push([]);

      var grandWoodwork = quote.subtotalWoodwork;
      var totalLabor = quote.installCharge;
      var totalTransport = quote.transportCharge;
      var netTaxable = grandWoodwork + totalHw + totalLabor + totalTransport + quote.marginAmount;
      var gst18 = Math.round(netTaxable * 0.18);
      var allInclusiveTotal = netTaxable + gst18;

      rows.push(['COMMERCIAL ESTIMATE SUMMARY']);
      rows.push(['', '', 'Modular Woodwork Subtotal', '', '', '', '', '', '', '', '', '', '', '', Math.round(grandWoodwork)]);
      rows.push(['', '', 'Hardware & Fittings Subtotal', '', '', '', '', '', '', '', '', '', '', '', totalHw]);
      rows.push(['', '', 'Installation & Assembly Labor', '', '', '', '', '', '', '', '', '', '', '', Math.round(totalLabor)]);
      rows.push(['', '', 'Logistics & Site Transport', '', '', '', '', '', '', '', '', '', '', '', Math.round(totalTransport)]);
      rows.push(['', '', 'Company Overhead & Margin (' + quote.marginPercent + '%)', '', '', '', '', '', '', '', '', '', '', '', Math.round(quote.marginAmount)]);
      rows.push(['', '', 'NET TAXABLE AMOUNT BEFORE TAX', '', '', '', '', '', '', '', '', '', '', '', Math.round(netTaxable)]);
      rows.push(['', '', 'GST @ 18% (CGST 9% + SGST 9%)', '', '', '', '', '', '', '', '', '', '', '', gst18]);
      rows.push(['', '', 'FINAL ALL-INCLUSIVE ESTIMATE (INR)', '', '', '', '', '', '', '', '', '', '', '', allInclusiveTotal]);

      var blob = this.buildXLSXBlob(rows);
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
    },

    buildXLSXBlob: function (rows) {
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

      function colName(c) {
        var s = '';
        c++;
        while (c > 0) {
          var m = (c - 1) % 26;
          s = String.fromCharCode(65 + m) + s;
          c = Math.floor((c - m) / 26);
        }
        return s;
      }

      var encoder = new TextEncoder();
      function makeZip(files) {
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
      }

      var contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '</Types>';

      var rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>';

      var wb = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<sheets><sheet name="Quotation" sheetId="1" r:id="rId1"/></sheets>' +
        '</workbook>';

      var wbRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '</Relationships>';

      var sheetData = '';
      for (var r = 0; r < rows.length; r++) {
        sheetData += '<row r="' + (r + 1) + '">';
        for (var c = 0; c < rows[r].length; c++) {
          var cn = colName(c);
          var val = rows[r][c];
          if (val === null || val === undefined) val = '';
          if (typeof val === 'number') {
            sheetData += '<c r="' + cn + (r + 1) + '"><v>' + val + '</v></c>';
          } else {
            var str = String(val).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            sheetData += '<c r="' + cn + (r + 1) + '" t="inlineStr"><is><t>' + str + '</t></is></c>';
          }
        }
        sheetData += '</row>';
      }

      var ws = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        '<sheetData>' + sheetData + '</sheetData>' +
        '</worksheet>';

      return makeZip([
        { name: '[Content_Types].xml', data: contentTypes },
        { name: '_rels/.rels', data: rootRels },
        { name: 'xl/workbook.xml', data: wb },
        { name: 'xl/_rels/workbook.xml.rels', data: wbRels },
        { name: 'xl/worksheets/sheet1.xml', data: ws }
      ]);
    }
  };

  root.OrbixUI = OrbixUI;

  // Auto initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { OrbixUI.init(); });
  } else {
    OrbixUI.init();
  }

})(typeof globalThis !== 'undefined' ? globalThis : this);
