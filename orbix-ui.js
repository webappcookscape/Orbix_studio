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

      // Load saved project from localStorage or create fresh
      var saved = localStorage.getItem('orbix-project');
      if (saved) {
        try {
          this.project = Core.deserializeProject(saved);
        } catch (e) {
          console.warn('Could not load saved Orbix project, starting fresh', e);
          this.project = Core.createProject('My Dream Home');
        }
      } else {
        this.project = Core.createProject('My Dream Home');
      }

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
    },

    createNewProject: function (title, clientName) {
      var fresh = Core.createProject(title || 'New Project');
      if (clientName && fresh.meta) fresh.meta.clientName = clientName;
      this.loadProject(fresh);
      return fresh;
    },

    saveToLocalStorage: function () {
      if (!this.project) return;
      try {
        localStorage.setItem('orbix-project', Core.serializeProject(this.project));
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
        panel.innerHTML =
          '<div class="insp-title">' + (op.type === 'door' ? 'Door' : 'Window') + ' Properties</div>' +
          '<div class="insp-row"><label>Width (mm)</label><input type="number" id="inspOpW" value="' + op.width + '" step="50"></div>' +
          '<div class="insp-row"><label>Height (mm)</label><input type="number" id="inspOpH" value="' + op.height + '" step="50"></div>' +
          '<div class="insp-row"><label>Offset along wall (mm)</label><input type="number" id="inspOpOff" value="' + Math.round(op.offset) + '" step="50"></div>' +
          (op.type === 'door' ?
            '<div class="insp-row"><label>Swing</label><select id="inspOpSwing">' +
            '<option value="in-left"' + (op.swing === 'in-left' ? ' selected' : '') + '>Inward Left</option>' +
            '<option value="in-right"' + (op.swing === 'in-right' ? ' selected' : '') + '>Inward Right</option>' +
            '<option value="out-left"' + (op.swing === 'out-left' ? ' selected' : '') + '>Outward Left</option>' +
            '<option value="out-right"' + (op.swing === 'out-right' ? ' selected' : '') + '>Outward Right</option>' +
            '</select></div>' :
            '<div class="insp-row"><label>Sill Height (mm)</label><input type="number" id="inspOpSill" value="' + (op.sillHeight || 900) + '" step="50"></div>'
          ) +
          '<button class="btn danger full" id="inspDelOp" style="margin-top:12px">Delete ' + (op.type === 'door' ? 'Door' : 'Window') + '</button>';

        document.getElementById('inspOpW').addEventListener('change', function (e) {
          op.width = parseFloat(e.target.value);
          self.editor.pushHistory('Edit Opening Width');
          self.editor.render();
        });
        document.getElementById('inspOpH').addEventListener('change', function (e) {
          op.height = parseFloat(e.target.value);
          self.editor.pushHistory('Edit Opening Height');
          self.editor.render();
        });
        document.getElementById('inspOpOff').addEventListener('change', function (e) {
          op.offset = parseFloat(e.target.value);
          self.editor.pushHistory('Edit Opening Offset');
          self.editor.render();
        });
        if (op.type === 'door') {
          document.getElementById('inspOpSwing').addEventListener('change', function (e) {
            op.swing = e.target.value;
            self.editor.pushHistory('Edit Swing');
            self.editor.render();
          });
        }
        document.getElementById('inspDelOp').addEventListener('click', function () {
          self.editor.deleteSelected();
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

        panel.innerHTML =
          '<div class="insp-title">Modular Unit Properties</div>' +
          '<div class="insp-row"><label>Item Name</label><input type="text" id="inspFurnName" value="' + fn.name + '"></div>' +
          '<div class="insp-row"><label>Room Assignment</label><select id="inspFurnRoom">' + roomOptions + '</select></div>' +
          '<div class="insp-row"><label>Width (mm)</label><input type="number" id="inspFurnW" value="' + fn.dimensions.W + '" step="50"></div>' +
          '<div class="insp-row"><label>Height (mm)</label><input type="number" id="inspFurnH" value="' + fn.dimensions.H + '" step="50"></div>' +
          '<div class="insp-row"><label>Depth (mm)</label><input type="number" id="inspFurnD" value="' + fn.dimensions.D + '" step="50"></div>' +
          '<button class="btn primary full" id="inspOpen3DStudio" style="margin-top:8px">📐 Open &amp; Customize in 3D Studio</button>' +
          '<button class="btn full" id="inspRotateFurn" style="margin-top:8px">Rotate 90° (R)</button>' +
          '<button class="btn danger full" id="inspDelFurn" style="margin-top:8px">Delete Unit</button>';

        document.getElementById('inspFurnName').addEventListener('change', function (e) {
          fn.name = e.target.value;
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
          self.editor.pushHistory('Resize Furniture');
          self.renderBOQ();
          self.editor.render();
        });
        document.getElementById('inspFurnH').addEventListener('change', function (e) {
          fn.dimensions.H = parseFloat(e.target.value);
          self.editor.pushHistory('Resize Furniture');
          self.renderBOQ();
          self.editor.render();
        });
        document.getElementById('inspFurnD').addEventListener('change', function (e) {
          fn.dimensions.D = parseFloat(e.target.value);
          self.editor.pushHistory('Resize Furniture');
          self.renderBOQ();
          self.editor.render();
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
                shutters: (fn.unitConfig && fn.unitConfig.shutters) || (fn.dimensions.W > 1200 ? 3 : fn.dimensions.W > 600 ? 2 : 1),
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
                carcass: 'MDF 1135',
                shutterCol: 'MDF 7701'
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
          self.editor.render();
        });
        document.getElementById('inspDelFurn').addEventListener('click', function () {
          self.editor.deleteSelected();
        });
      }
    },

    sync3DStudioUnits: function () {
      if (!window.S || !window.S.units || !this.project || !this.project.plan) return;
      var furnList = this.project.plan.furniture = this.project.plan.furniture || [];

      for (var uIdx = 0; uIdx < window.S.units.length; uIdx++) {
        var u = window.S.units[uIdx];
        var isFM = (u.label === 'FM 600' || (u.label && u.label.indexOf('FM 600') !== -1));
        var match = null;

        for (var f = 0; f < furnList.length; f++) {
          if ((u._furnId && furnList[f].id === u._furnId) ||
              (u.id && furnList[f].id === u.id) ||
              (furnList[f].name === u.label) ||
              (isFM && (furnList[f].id === 'fm-01' || furnList[f].name === 'FM 600' || furnList[f].name.indexOf('FM 600') !== -1))) {
            match = furnList[f];
            break;
          }
        }

        var cat = (u.ctype === 'kbase') ? 'kitchen_base' :
                  (u.ctype === 'kwall') ? 'kitchen_wall' :
                  (u.ctype === 'ktall') ? 'kitchen_tall' :
                  (u.ctype === 'tv') ? 'tv_unit' : 'wardrobe';

        var modelType = (isFM || cat === 'kitchen_base') ? 'kitchen_fm' :
                        (cat === 'kitchen_wall') ? 'kitchen_wm' :
                        (u.drawers > 0) ? 'wr_drawers' : 'wr_shelves';

        var shutterMat = isFM ? 'HDHMR_18MM' : 'HDHMR_18MM';
        var shutterFin = isFM ? '4x Tuff Gloss' : (u.shutterCol || 'Brazilian Horizontal Walnut');

        if (match) {
          match.dimensions = { W: u.W || match.dimensions.W, H: u.H || match.dimensions.H, D: u.D || match.dimensions.D };
          if (u.shutters) match.unitConfig.shutters = u.shutters;
          if (u.handle) match.unitConfig.handle = u.handle;
          if (u.shutterCol) match.unitConfig.shutterCol = u.shutterCol;
          if (u.carcass) match.unitConfig.carcass = u.carcass;
        } else {
          var newPlacement = Core.createFurniturePlacement({
            id: isFM ? 'fm-01' : ('u3d_' + (uIdx + 1) + '_' + Date.now()),
            name: u.label || ('Unit ' + (uIdx + 1)),
            category: cat,
            modelType: modelType,
            refCode: isFM ? 'FM-01' : ('C' + (12 + furnList.length + 1)),
            pos: { x: 2400 + uIdx * 700, y: 6600 },
            dimensions: { W: u.W || 600, H: u.H || 750, D: u.D || 550 },
            unitConfig: {
              shutterCol: u.shutterCol || 'MDF 7701',
              carcass: u.carcass || 'MDF 1135',
              shutters: u.shutters || 1,
              handle: u.handle || 'gprof'
            },
            materials: {
              shutter: { material: shutterMat, finish: shutterFin },
              carcass: { material: 'BWP_18MM', finish: 'Absolute White' }
            }
          });
          furnList.push(newPlacement);
        }
      }
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
