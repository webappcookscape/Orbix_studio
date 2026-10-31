/* ═══════════════════════════════════════════════════════════════════════════════
   ORBIX STUDIO — Projects, User Management & Colleague Copy-on-Share Engine
   ═══════════════════════════════════════════════════════════════════════════════ */

(function (root) {
  'use strict';

  var API_BASE = ''; // Same host (Express backend)

  var OrbixProjects = {
    currentUser: null,
    activeProjectId: null,
    projects: [],
    users: [],
    filter: 'all',
    searchQuery: '',
    dbStatus: null,

    init: function () {
      var self = this;
      this.loadCachedUser();
      this.initEventListeners();
      this.fetchDBStatus();
      this.fetchUsers(function () {
        self.fetchProjects();
      });
      this.startAutoSaveLoop();
    },

    loadCachedUser: function () {
      try {
        var saved = localStorage.getItem('orbix_current_user');
        if (saved) {
          this.currentUser = JSON.parse(saved);
        } else {
          this.currentUser = {
            id: 'usr_dev',
            name: 'Dev Kancheti',
            email: 'dev@orbixstudio.io',
            role: 'Lead Modular Designer',
            company: 'Orbix Design Studio',
            avatar: 'DK'
          };
          localStorage.setItem('orbix_current_user', JSON.stringify(this.currentUser));
        }
      } catch (e) {
        this.currentUser = { id: 'usr_dev', name: 'Dev Kancheti', email: 'dev@orbixstudio.io', role: 'Designer', avatar: 'DK' };
      }
      this.updateUserUI();
    },

    setCurrentUser: function (user) {
      this.currentUser = user;
      try {
        localStorage.setItem('orbix_current_user', JSON.stringify(user));
      } catch (e) {}
      this.updateUserUI();
      this.fetchProjects();
      if (typeof showToast === 'function') {
        showToast('Switched user to ' + user.name + ' (' + user.role + ')');
      }
    },

    updateUserUI: function () {
      var user = this.currentUser;
      if (!user) return;

      var avatarEl = document.getElementById('userAvatarBtn');
      if (avatarEl) {
        avatarEl.innerHTML = '<span class="u-avatar">' + (user.avatar || 'US') + '</span><span class="u-name">' + user.name + '</span><span class="u-role">' + (user.role || '') + '</span>';
      }

      var modalName = document.getElementById('curUserName');
      if (modalName) modalName.textContent = user.name;
      var modalEmail = document.getElementById('curUserEmail');
      if (modalEmail) modalEmail.textContent = user.email;
      var modalRole = document.getElementById('curUserRole');
      if (modalRole) modalRole.textContent = user.role + ' • ' + (user.company || '');
    },

    fetchDBStatus: function () {
      var self = this;
      fetch('/api/status')
        .then(function (r) { return r.json(); })
        .then(function (data) {
          self.dbStatus = data.db;
          self.renderDBStatusBadge();
        })
        .catch(function () {
          self.dbStatus = { postgres: { connected: false }, localSync: { active: true } };
          self.renderDBStatusBadge();
        });
    },

    renderDBStatusBadge: function () {
      var badge = document.getElementById('dbStatusBadge');
      if (!badge) return;
      var isPg = this.dbStatus && this.dbStatus.postgres && this.dbStatus.postgres.connected;
      if (isPg) {
        badge.className = 'db-badge is-pg';
        badge.innerHTML = '<span class="db-dot"></span> PostgreSQL Active';
        badge.title = 'Connected to PostgreSQL database (' + (this.dbStatus.postgres.database || 'cupboard_cad') + ')';
      } else {
        badge.className = 'db-badge is-local';
        badge.innerHTML = '<span class="db-dot"></span> Local Sync Active';
        badge.title = 'Running with local persistence and background PostgreSQL connector';
      }
    },

    fetchUsers: function (cb) {
      var self = this;
      fetch('/api/users')
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.users && data.users.length) {
            self.users = data.users;
            // Ensure currentUser matches one of the known users
            var matched = self.users.find(function (u) { return u.id === self.currentUser.id; });
            if (matched) self.currentUser = matched;
          }
          if (cb) cb();
        })
        .catch(function () {
          if (cb) cb();
        });
    },

    fetchProjects: function () {
      var self = this;
      var url = '/api/projects?search=' + encodeURIComponent(this.searchQuery) +
        '&filter=' + encodeURIComponent(this.filter) +
        '&userId=' + encodeURIComponent(this.currentUser ? this.currentUser.id : '');

      var listContainer = document.getElementById('projectsGrid');
      if (listContainer && (!self.projects || !self.projects.length)) {
        listContainer.innerHTML = '<div class="proj-loading">Loading projects from PostgreSQL...</div>';
      }

      fetch(url)
        .then(function (r) { return r.json(); })
        .then(function (data) {
          self.projects = data.projects || [];
          self.renderProjectsList();
        })
        .catch(function () {
          self.renderProjectsList();
        });
    },

    renderProjectsList: function () {
      var container = document.getElementById('projectsGrid');
      if (!container) return;

      var countEl = document.getElementById('projectCountLabel');
      if (countEl) {
        countEl.textContent = this.projects.length + (this.projects.length === 1 ? ' project' : ' projects');
      }

      if (!this.projects.length) {
        container.innerHTML = '<div class="proj-empty">' +
          '<div class="proj-empty-icon">' +
            '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>' +
          '</div>' +
          '<h3>No projects found</h3>' +
          '<p>' + (this.searchQuery ? 'No projects matched "' + this.searchQuery + '". Try clearing filters.' : 'Create your first project or launch from a pre-set catalogue design.') + '</p>' +
          '<button class="btn primary big" id="emptyCreateBtn">+ Create New Project</button>' +
        '</div>';

        var emptyBtn = document.getElementById('emptyCreateBtn');
        if (emptyBtn) {
          emptyBtn.addEventListener('click', function () {
            OrbixProjects.openCreateModal();
          });
        }
        return;
      }

      var html = '';
      for (var i = 0; i < this.projects.length; i++) {
        var p = this.projects[i];
        var isOwner = this.currentUser && (p.created_by === this.currentUser.id || p.owner_email === this.currentUser.email);
        var dateStr = 'Recently';
        try {
          var d = new Date(p.updated_at || p.created_at);
          dateStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        } catch (e) {}

        var details = p.data && p.data.details ? p.data.details : {};
        var contactStr = p.contact_number || details.contactNumber || '';
        var locationStr = p.location || details.location || '';
        var bhStr = p.bh_name || details.bhName || '';
        var cpStr = p.cp_code || details.cpCode || '';
        var clientStr = p.client || details.clientName || 'Private Client';
        var statusClass = (p.status === 'Active' || p.status === 'In Progress') ? 'pstatus-active' : (p.status === 'Completed' ? 'pstatus-done' : 'pstatus-draft');
        var typeBadge = p.type || 'Interior CAD';

        html += '<div class="proj-card' + (p.id === this.activeProjectId ? ' is-active-proj' : '') + '" data-id="' + p.id + '">' +
          '<div class="pcard-top">' +
            '<div class="pcard-badges">' +
              (bhStr ? '<span class="ptag bh-badge">BH: ' + bhStr + '</span>' : '<span class="ptag type-wardrobe">' + typeBadge + '</span>') +
              (cpStr ? '<span class="ptag cp-code">CP: ' + cpStr + '</span>' : '') +
              '<span class="pstatus ' + statusClass + '">' + (p.status || 'Draft') + '</span>' +
              (p.is_shared ? '<span class="pshared-pill" title="Shared with colleagues">🔗 Shared</span>' : '') +
              (p.fork_count ? '<span class="pfork-pill" title="' + p.fork_count + ' colleague copies created">⑂ ' + p.fork_count + ' copies</span>' : '') +
            '</div>' +
            '<div class="pcard-actions">' +
              '<button class="pact-icon share-act" title="Share with colleague (they work in copy)" data-id="' + p.id + '">' +
                '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>' +
              '</button>' +
              '<button class="pact-icon fork-act" title="Work in a copy (duplicate for me)" data-id="' + p.id + '">' +
                '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' +
              '</button>' +
              '<button class="pact-icon del-act" title="Delete project" data-id="' + p.id + '">' +
                '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
              '</button>' +
            '</div>' +
          '</div>' +

          '<h3 class="pcard-title" data-open="' + p.id + '">' + (p.title || clientStr) + '</h3>' +

          '<div class="pcard-meta-grid">' +
            '<div class="pmeta-item"><span class="pm-lbl">Client:</span> <strong class="pm-val">' + clientStr + '</strong>' + (contactStr ? ' (' + contactStr + ')' : '') + '</div>' +
            (locationStr ? '<div class="pmeta-item"><span class="pm-lbl">Location:</span> <span class="pm-val">' + locationStr + '</span></div>' : '') +
            (bhStr ? '<div class="pmeta-item"><span class="pm-lbl">BH Name:</span> <span class="pm-val">' + bhStr + '</span></div>' : '') +
          '</div>' +

          '<div class="pcard-foot">' +
            '<div class="pcard-owner">' +
              '<span class="powner-avatar">' + (p.owner_name ? p.owner_name.substring(0, 2).toUpperCase() : 'DK') + '</span>' +
              '<div class="powner-details">' +
                '<span class="powner-name">' + (isOwner ? 'You' : p.owner_name) + '</span>' +
                '<span class="powner-date">' + dateStr + '</span>' +
              '</div>' +
            '</div>' +
            '<div class="pcard-btns">' +
              '<button class="btn open-proj-btn" data-open="' + p.id + '" title="Open project in 2D Floor Plan">' +
                '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>' +
                '<span>Open 2D Plan</span>' +
              '</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      }

      container.innerHTML = html;
      this.bindCardEvents();
    },

    bindCardEvents: function () {
      var self = this;
      var cards = document.querySelectorAll('.proj-card');
      cards.forEach(function (card) {
        var id = card.getAttribute('data-id');

        // Clicking anywhere on the project card (or the Open 2D button) opens it in 2D
        card.style.cursor = 'pointer';
        card.addEventListener('click', function (e) {
          // If clicked specifically on share, fork, or delete action icons, do not open
          if (e.target.closest('.share-act') || e.target.closest('.fork-act') || e.target.closest('.del-act')) {
            return;
          }
          e.preventDefault();
          self.openProject(id);
        });

        // Share action
        var shareBtn = card.querySelector('.share-act');
        if (shareBtn) {
          shareBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            e.preventDefault();
            self.openShareModal(id);
          });
        }

        // Fork / Work in Copy action
        var forkBtn = card.querySelector('.fork-act');
        if (forkBtn) {
          forkBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            e.preventDefault();
            self.forkProjectForCurrentUser(id);
          });
        }

        // Delete action
        var delBtn = card.querySelector('.del-act');
        if (delBtn) {
          delBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            e.preventDefault();
            self.deleteProject(id);
          });
        }
      });
    },

    openProject: function (id) {
      var project = this.projects.find(function (p) { return p.id === id; });
      if (!project) return;

      this.activeProjectId = id;
      try {
        localStorage.setItem('orbix_active_project_id', id);
      } catch (e) {}

      // Reset 3D units to this project's units (empty for fresh new projects)
      if (window.S) {
        window.S.units = (project.data && Array.isArray(project.data.units)) ? project.data.units : [];
        if (typeof renderAll === 'function') renderAll();
        if (typeof fit === 'function') fit();
        if (typeof camApply === 'function') camApply();
      }

      // Load 2D floor plan into OrbixUI (clean slate for new projects, or saved walls)
      if (window.OrbixUI) {
        var planToLoad = null;
        if (project.data && project.data.plan && project.data.plan.plan) {
          planToLoad = project.data.plan;
        } else if (window.OrbixCore && typeof window.OrbixCore.createProject === 'function') {
          // Brand new clean empty project canvas
          planToLoad = window.OrbixCore.createProject(project.title);
          if (planToLoad.meta) planToLoad.meta.clientName = project.client || '';
        }

        if (planToLoad && typeof window.OrbixUI.loadProject === 'function') {
          window.OrbixUI.loadProject(planToLoad);
        }
      }

      // Switch to 2D Floor Plan view
      // 1. Try global window.setView
      if (typeof window.setView === 'function') {
        window.setView('plan');
      } else if (window.__cc && typeof window.__cc.setView === 'function') {
        window.__cc.setView('plan');
      }

      // 2. Trigger click on the 2D Floor Plan topbar tab
      var planTab = document.querySelector('.vtab[data-view="plan"]');
      if (planTab) {
        planTab.click();
      }

      // 3. Guaranteed DOM fallback for view activation
      document.querySelectorAll('.vtab').forEach(function (b) {
        var on = b.getAttribute('data-view') === 'plan';
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-pressed', String(on));
      });
      document.querySelectorAll('.view').forEach(function (s) {
        s.classList.toggle('is-on', s.id === 'view-plan');
      });

      // Ensure 2D plan canvas is resized and drawn to fit
      setTimeout(function () {
        if (window.OrbixUI && window.OrbixUI.editor) {
          window.OrbixUI.editor.resize();
          window.OrbixUI.editor.render();
          if (typeof window.OrbixUI.editor.zoomFit === 'function') {
            window.OrbixUI.editor.zoomFit();
          }
        }
      }, 50);

      if (typeof showToast === 'function') {
        showToast('Opened in 2D Floor Plan: ' + project.title);
      }
    },

    // 15-second interval auto-saver for all working projects
    startAutoSaveLoop: function () {
      var self = this;
      if (this._autoSaveTimer) clearInterval(this._autoSaveTimer);
      // Auto save every 15 seconds (15000ms)
      this._autoSaveTimer = setInterval(function () {
        self.autoSaveWorkingProject();
      }, 15000);
      console.log('[Orbix Studio] Auto-save loop initialized (every 15s)');
    },

    autoSaveWorkingProject: function () {
      // Find active project or latest working project
      var activeId = this.activeProjectId;
      if (!activeId) {
        try {
          activeId = localStorage.getItem('orbix_active_project_id');
        } catch (e) {}
      }
      if (!activeId && this.projects && this.projects.length) {
        activeId = this.projects[0].id;
      }
      if (!activeId) return;

      var self = this;
      var project = this.projects.find(function (p) { return p.id === activeId; });
      if (!project) return;

      var currentPlan = (window.OrbixUI && window.OrbixUI.project) ? window.OrbixUI.project : null;
      var currentUnits = (window.S && Array.isArray(window.S.units)) ? window.S.units : null;

      if (!currentPlan && !currentUnits) return;

      project.data = project.data || {};
      if (currentPlan) project.data.plan = currentPlan;
      if (currentUnits) project.data.units = currentUnits;

      var fCount = (project.data.plan && project.data.plan.plan && project.data.plan.plan.furniture)
        ? project.data.plan.plan.furniture.length : 0;
      project.units_count = fCount || (project.data.units ? project.data.units.length : 0);

      // Save to localStorage immediately
      try {
        if (project.data.plan) {
          localStorage.setItem('orbix-project', JSON.stringify(project.data.plan));
        }
        localStorage.setItem('orbix_active_project_id', activeId);
      } catch (e) {}

      // Update topbar indicator: "Auto-saving..."
      self.setSaveIndicator('saving');

      // Sync to PostgreSQL backend
      fetch('/api/projects/' + activeId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: project.data,
          units_count: project.units_count
        })
      })
      .then(function (r) { return r.json(); })
      .then(function () {
        var now = new Date();
        var timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        self.setSaveIndicator('saved', timeStr);
      })
      .catch(function (err) {
        console.warn('[AutoSave 15s] PostgreSQL save buffered to local sync:', err);
        self.setSaveIndicator('offline');
      });
    },

    setSaveIndicator: function (status, timeStr) {
      var el = document.getElementById('autoSaveIndicator');
      if (!el) return;

      if (status === 'saving') {
        el.className = 'autosave-pill saving';
        el.innerHTML = '<span class="save-dot"></span><span class="save-text">Auto-saving...</span>';
      } else if (status === 'saved') {
        el.className = 'autosave-pill saved';
        el.innerHTML = '<span class="save-dot"></span><span class="save-text">Auto-saved ' + (timeStr || '') + '</span>';
      } else if (status === 'offline') {
        el.className = 'autosave-pill offline';
        el.innerHTML = '<span class="save-dot"></span><span class="save-text">Saved locally</span>';
      }
    },

    saveActiveProject: function (dataUpdates) {
      if (!this.activeProjectId) return;
      var self = this;
      var project = this.projects.find(function (p) { return p.id === self.activeProjectId; });
      if (!project) return;

      project.data = project.data || {};
      if (dataUpdates.plan) project.data.plan = dataUpdates.plan;
      if (dataUpdates.units) project.data.units = dataUpdates.units;

      var fCount = (project.data.plan && project.data.plan.plan && project.data.plan.plan.furniture)
        ? project.data.plan.plan.furniture.length : 0;
      project.units_count = fCount || (project.data.units ? project.data.units.length : 0);

      // Save to localStorage
      try {
        if (project.data.plan) {
          localStorage.setItem('orbix-project', JSON.stringify(project.data.plan));
        }
      } catch (e) {}

      self.setSaveIndicator('saving');

      // Debounced backend save to PostgreSQL
      clearTimeout(this._saveDebounce);
      this._saveDebounce = setTimeout(function () {
        fetch('/api/projects/' + self.activeProjectId, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: project.data,
            units_count: project.units_count
          })
        })
        .then(function () {
          var now = new Date();
          var timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          self.setSaveIndicator('saved', timeStr);
        })
        .catch(function (e) {
          console.warn('Auto-save to backend failed:', e);
          self.setSaveIndicator('offline');
        });
      }, 500);
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // "COLLEAGUES WORK IN COPY" — Fork & Share Handlers
    // ═══════════════════════════════════════════════════════════════════════════
    forkProjectForCurrentUser: function (originalId) {
      var self = this;
      var original = this.projects.find(function (p) { return p.id === originalId; });
      if (!original) return;

      fetch('/api/projects/' + originalId + '/fork', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colleagueUser: self.currentUser })
      })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.success && data.project) {
          self.fetchProjects();
          self.openProject(data.project.id);
          self.showCopyNotification(original.title, data.project.title);
        }
      })
      .catch(function (err) {
        alert('Failed to create copy: ' + err.message);
      });
    },

    forkProjectForColleague: function (originalId, colleagueUser) {
      var self = this;
      fetch('/api/projects/' + originalId + '/fork', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colleagueUser: colleagueUser })
      })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.success && data.project) {
          self.closeModal('shareModal');
          self.fetchProjects();
          if (typeof showToast === 'function') {
            showToast('✓ Created copy for ' + colleagueUser.name + ': "' + data.project.title + '"');
          }
        }
      });
    },

    showCopyNotification: function (originalTitle, copyTitle) {
      var banner = document.getElementById('colleagueCopyBanner');
      if (!banner) return;
      banner.innerHTML = '<div class="cc-banner-inner">' +
        '<div class="cc-banner-left">' +
          '<span class="cc-icon">⑂</span>' +
          '<div>' +
            '<strong>Working in an Isolated Copy</strong>' +
            '<p>Branched from "<em>' + originalTitle + '</em>". Your edits will be saved to "<strong>' + copyTitle + '</strong>" and will never overwrite the original master file.</p>' +
          '</div>' +
        '</div>' +
        '<button class="cc-close" onclick="this.parentElement.parentElement.classList.remove(\'is-shown\')">&times;</button>' +
      '</div>';
      banner.classList.add('is-shown');
      setTimeout(function () {
        banner.classList.remove('is-shown');
      }, 9000);
    },

    openShareModal: function (projectId) {
      var project = this.projects.find(function (p) { return p.id === projectId; });
      if (!project) return;

      var modal = document.getElementById('shareModal');
      if (!modal) return;

      var titleEl = document.getElementById('shareProjTitle');
      if (titleEl) titleEl.textContent = project.title;

      var shareUrl = window.location.origin + '?share=' + project.id + '&mode=copy';
      var linkInput = document.getElementById('shareLinkInput');
      if (linkInput) linkInput.value = shareUrl;

      // Populate colleague list
      var colContainer = document.getElementById('colleaguesList');
      if (colContainer) {
        var self = this;
        var colleagueHtml = '';
        var otherUsers = this.users.filter(function (u) { return u.id !== self.currentUser.id; });
        if (!otherUsers.length) {
          colleagueHtml = '<div class="no-colleagues">No other colleagues found. Add one in User Management.</div>';
        } else {
          otherUsers.forEach(function (u) {
            colleagueHtml += '<div class="colleague-row">' +
              '<div class="col-info">' +
                '<span class="u-avatar small">' + (u.avatar || 'US') + '</span>' +
                '<div><strong>' + u.name + '</strong><span>' + u.email + ' • ' + (u.role || 'Colleague') + '</span></div>' +
              '</div>' +
              '<button class="btn send-copy-btn" data-uid="' + u.id + '">Send Copy ⑂</button>' +
            '</div>';
          });
        }
        colContainer.innerHTML = colleagueHtml;

        // Bind Send Copy buttons
        colContainer.querySelectorAll('.send-copy-btn').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var uid = this.getAttribute('data-uid');
            var colUser = self.users.find(function (u) { return u.id === uid; });
            if (colUser) {
              self.forkProjectForColleague(project.id, colUser);
            }
          });
        });
      }

      modal.setAttribute('data-proj-id', projectId);
      modal.classList.add('is-open');
    },

    deleteProject: function (id) {
      var project = this.projects.find(function (p) { return p.id === id; });
      var title = project ? project.title : 'this project';
      if (!confirm('Are you sure you want to delete "' + title + '"? This will remove it from PostgreSQL.')) return;

      var self = this;
      fetch('/api/projects/' + id, { method: 'DELETE' })
        .then(function (r) { return r.json(); })
        .then(function () {
          self.fetchProjects();
          if (typeof showToast === 'function') {
            showToast('Deleted project: ' + title);
          }
        });
    },

    openCreateModal: function () {
      var modal = document.getElementById('createProjectModal');
      if (modal) {
        var dtInput = document.getElementById('newProjDateTime');
        if (dtInput) {
          var now = new Date();
          var localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
          dtInput.value = localIso;
        }
        modal.classList.add('is-open');
      }
    },

    closeModal: function (modalId) {
      var modal = document.getElementById(modalId);
      if (modal) modal.classList.remove('is-open');
    },

    initEventListeners: function () {
      var self = this;

      // Filter Chips
      var filterButtons = document.querySelectorAll('.pfilter-btn');
      filterButtons.forEach(function (btn) {
        btn.addEventListener('click', function () {
          filterButtons.forEach(function (b) { b.classList.remove('is-active'); });
          btn.classList.add('is-active');
          self.filter = btn.getAttribute('data-filter') || 'all';
          self.fetchProjects();
        });
      });

      // Search input
      var searchInput = document.getElementById('projectSearchInput');
      if (searchInput) {
        var debounce = null;
        searchInput.addEventListener('input', function () {
          clearTimeout(debounce);
          debounce = setTimeout(function () {
            self.searchQuery = searchInput.value.trim();
            self.fetchProjects();
          }, 200);
        });
      }

      // Create Project Button on Home
      var createBtn = document.getElementById('homeCreateProjectBtn');
      if (createBtn) {
        createBtn.addEventListener('click', function () {
          self.openCreateModal();
        });
      }

      // Create Project Form Submit
      var createForm = document.getElementById('createProjectForm');
      if (createForm) {
        createForm.addEventListener('submit', function (e) {
          e.preventDefault();
          var client = document.getElementById('newProjClient').value.trim();
          var contact = document.getElementById('newProjContact').value.trim();
          var location = document.getElementById('newProjLocation').value.trim();
          var bhName = document.getElementById('newProjBhName').value.trim();
          var dateTime = document.getElementById('newProjDateTime').value;
          var cpCode = document.getElementById('newProjCpCode').value.trim();

          if (!client) return;

          var title = client + (bhName ? ' — ' + bhName : '') + (location ? ' (' + location + ')' : '');

          var freshPlan = (window.OrbixCore && typeof window.OrbixCore.createProject === 'function')
            ? window.OrbixCore.createProject(title)
            : {
                schemaVersion: '1.0.0',
                meta: { title: title, clientName: client, designerName: self.currentUser ? self.currentUser.name : '' },
                plan: { gridSize: 100, walls: [], openings: [], rooms: [], furniture: [] }
              };
          if (freshPlan.meta) {
            freshPlan.meta.clientName = client;
            freshPlan.meta.contactNumber = contact;
            freshPlan.meta.siteLocation = location;
            freshPlan.meta.bhName = bhName;
            freshPlan.meta.dateTime = dateTime;
            freshPlan.meta.cpCode = cpCode;
          }

          var payload = {
            title: title,
            client: client,
            contact_number: contact,
            location: location,
            bh_name: bhName,
            date_time: dateTime,
            cp_code: cpCode,
            type: bhName || 'Interior CAD',
            boards_est: 0,
            units_count: 0,
            data: {
              units: [], // Clean slate for new project!
              plan: freshPlan,
              details: {
                clientName: client,
                contactNumber: contact,
                location: location,
                bhName: bhName,
                dateTime: dateTime,
                cpCode: cpCode
              }
            },
            currentUser: self.currentUser
          };

          fetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (data.project) {
              self.closeModal('createProjectModal');
              createForm.reset();
              self.fetchProjects();
              self.openProject(data.project.id);
            }
          });
        });
      }

      // User Profile & Switcher Button in Topbar
      var userBtn = document.getElementById('userAvatarBtn');
      if (userBtn) {
        userBtn.addEventListener('click', function () {
          self.openUserModal();
        });
      }

      // Copy share link button
      var copyLinkBtn = document.getElementById('copyShareLinkBtn');
      if (copyLinkBtn) {
        copyLinkBtn.addEventListener('click', function () {
          var input = document.getElementById('shareLinkInput');
          if (input) {
            input.select();
            document.execCommand('copy');
            copyLinkBtn.textContent = 'Copied!';
            setTimeout(function () {
              copyLinkBtn.textContent = 'Copy Link';
            }, 2000);
          }
        });
      }

      // Modal close triggers
      document.querySelectorAll('.modal-close-btn, .modal-backdrop').forEach(function (el) {
        el.addEventListener('click', function () {
          document.querySelectorAll('.orbix-modal').forEach(function (m) {
            m.classList.remove('is-open');
          });
        });
      });
    },

    openUserModal: function () {
      var self = this;
      var modal = document.getElementById('userModal');
      if (!modal) return;

      var userListEl = document.getElementById('switchUsersList');
      if (userListEl) {
        var html = '';
        this.users.forEach(function (u) {
          var isCurrent = self.currentUser && self.currentUser.id === u.id;
          html += '<div class="u-switch-item' + (isCurrent ? ' is-current' : '') + '" data-uid="' + u.id + '">' +
            '<div class="u-info">' +
              '<span class="u-avatar">' + (u.avatar || 'US') + '</span>' +
              '<div><strong>' + u.name + (isCurrent ? ' (Active)' : '') + '</strong><span>' + u.role + ' • ' + (u.company || '') + '</span></div>' +
            '</div>' +
            (!isCurrent ? '<button class="btn switch-user-btn" data-uid="' + u.id + '">Switch</button>' : '<span class="current-tag">Current</span>') +
          '</div>';
        });
        userListEl.innerHTML = html;

        userListEl.querySelectorAll('.switch-user-btn').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var uid = this.getAttribute('data-uid');
            var u = self.users.find(function (x) { return x.id === uid; });
            if (u) {
              self.setCurrentUser(u);
              self.closeModal('userModal');
            }
          });
        });
      }

      modal.classList.add('is-open');
    }
  };

  root.OrbixProjects = OrbixProjects;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { OrbixProjects.init(); });
  } else {
    OrbixProjects.init();
  }

})(window);
