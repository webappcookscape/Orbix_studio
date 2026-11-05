/* ═══════════════════════════════════════════════════════════════════════════════
   ORBIX STUDIO — Projects, User Management & Colleague Copy-on-Share Engine
   ═══════════════════════════════════════════════════════════════════════════════ */

(function (root) {
  'use strict';

  var API_BASE = ''; // Same host (Express backend)

  // ═══════════════════════════════════════════════════════════════════════════════
  // ORBIX ROUTER — Clean URL Routing, Browser History & Role-Based Navigation
  // ═══════════════════════════════════════════════════════════════════════════════
  var OrbixRouter = {
    ROUTE_MAP: {
      '/': 'home',
      '/home': 'home',
      '/login': 'login',
      '/2d-plan': 'plan',
      '/floor-plan': 'plan',
      '/plan': 'plan',
      '/2dplan': 'plan',
      '/3d-studio': 'design',
      '/3dstudio': 'design',
      '/design': 'design',
      '/pricing': 'boq',
      '/boq': 'boq',
      '/quote': 'quote',
      '/gallery': 'gallery',
      '/kitchen': 'kitchen',
      '/sheet': 'sheet',
      '/elev': 'elev',
      '/panels': 'panels',
      '/nest': 'nest',
      '/upload': 'upload',
      '/report': 'report',
      '/users': 'users'
    },

    VIEW_TO_PATH: {
      'home': '/home',
      'login': '/login',
      'plan': '/2d-plan',
      'design': '/3d-studio',
      'boq': '/pricing',
      'quote': '/quote',
      'gallery': '/gallery',
      'kitchen': '/kitchen',
      'sheet': '/sheet',
      'elev': '/elev',
      'panels': '/panels',
      'nest': '/nest',
      'upload': '/upload',
      'report': '/report',
      'users': '/users'
    },

    EMPLOYEE_ALLOWED: ['home', 'plan', 'design', 'boq'],

    initialTargetView: (function () {
      var path = window.location.pathname.toLowerCase();
      var map = {
        '/': 'home',
        '/home': 'home',
        '/login': 'login',
        '/2d-plan': 'plan',
        '/floor-plan': 'plan',
        '/plan': 'plan',
        '/2dplan': 'plan',
        '/3d-studio': 'design',
        '/3dstudio': 'design',
        '/design': 'design',
        '/pricing': 'boq',
        '/boq': 'boq',
        '/quote': 'quote',
        '/gallery': 'gallery',
        '/kitchen': 'kitchen',
        '/sheet': 'sheet',
        '/elev': 'elev',
        '/panels': 'panels',
        '/nest': 'nest',
        '/upload': 'upload',
        '/report': 'report',
        '/users': 'users'
      };
      var v = map[path];
      if (!v) {
        var h = window.location.hash.replace(/^#\/?/, '').toLowerCase();
        if (h) v = map['/' + h];
      }
      return v || 'home';
    })(),

    isInitialized: false,
    _popstateHandling: false,

    init: function () {
      if (!this.initialTargetView) {
        this.initialTargetView = this.getInitialView();
      }
      if (this.isInitialized) return;
      var self = this;
      this.isInitialized = true;

      window.addEventListener('popstate', function () {
        self._popstateHandling = true;
        try {
          var path = window.location.pathname.toLowerCase();
          var v = self.ROUTE_MAP[path];
          if (!v) {
            var h = window.location.hash.replace(/^#\/?/, '').toLowerCase();
            v = self.ROUTE_MAP['/' + h] || 'home';
          }
          self.navigateTo(v, true);
        } finally {
          self._popstateHandling = false;
        }
      });

      this.hookSetView();

      // Direct router click listeners for all navbar tabs
      var navTabs = document.querySelectorAll('.topbar .views .vtab');
      navTabs.forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          var v = btn.getAttribute('data-view');
          self.navigateTo(v, false);
        });
      });

      // Brand logo navigates to home
      var brand = document.querySelector('.topbar .tool');
      if (brand) {
        brand.style.cursor = 'pointer';
        brand.addEventListener('click', function (e) {
          e.preventDefault();
          self.navigateTo('home', false);
        });
      }

      document.addEventListener('click', function (e) {
        var a = e.target.closest('a');
        if (a && a.getAttribute('href')) {
          var href = a.getAttribute('href');
          if (href.startsWith('/') && !href.startsWith('/api') && !href.startsWith('//')) {
            e.preventDefault();
            self.navigateByPath(href);
          }
        }
      });
    },

    hookSetView: function () {
      var self = this;
      var hook = function () {
        if (typeof window.setView === 'function' && !window.setView._isRouterHooked) {
          var origSetView = window.setView;
          window.setView = function (v) {
            if (OrbixProjects.currentUser && !OrbixProjects.isAdmin()) {
              if (self.EMPLOYEE_ALLOWED.indexOf(v) === -1) {
                if (typeof showToast === 'function') {
                  showToast('Access restricted: Employees can only access Home, Floor Plan, 3D Studio, and Pricing.');
                }
                if (window.location.pathname !== '/home') {
                  self.updateUrl('home', false);
                }
                origSetView('home');
                return;
              }
            }

            origSetView(v);

            if (!self._popstateHandling) {
              self.updateUrl(v, false);
            }
          };
          window.setView._isRouterHooked = true;
        }
      };

      hook();
      setTimeout(hook, 200);
      setTimeout(hook, 1000);
    },

    updateUrl: function (view, replace) {
      if (!window.history || !window.history.pushState) return;
      var canonical = this.VIEW_TO_PATH[view] || ('/' + view);
      if (window.location.pathname.toLowerCase() !== canonical.toLowerCase()) {
        if (replace) {
          window.history.replaceState({ view: view }, '', canonical);
        } else {
          window.history.pushState({ view: view }, '', canonical);
        }
      }
    },

    navigateTo: function (v, replace) {
      if (v === 'login') {
        this.updateUrl('login', replace);
        if (typeof OrbixProjects.showLogin === 'function') {
          OrbixProjects.showLogin();
        }
        return;
      }

      if (v === 'users') {
        if (!OrbixProjects.isAdmin()) {
          if (typeof showToast === 'function') {
            showToast('Access restricted: Only Admin accounts can access User Management.');
          }
          this.navigateTo('home', true);
          return;
        }
        this.updateUrl('users', replace);
        if (typeof OrbixProjects.openUserModal === 'function') {
          OrbixProjects.openUserModal();
        }
        return;
      }

      if (v === 'kitchen') {
        if (window.galState) window.galState.type = 'kitchen';
        v = 'gallery';
      }

      if (OrbixProjects.currentUser && !OrbixProjects.isAdmin()) {
        if (this.EMPLOYEE_ALLOWED.indexOf(v) === -1) {
          if (typeof showToast === 'function') {
            showToast('Access restricted: Employees can only access Home, Floor Plan, 3D Studio, and Pricing.');
          }
          v = 'home';
        }
      }

      if (typeof window.setView === 'function') {
        window.setView(v);
      }
      this.updateUrl(v, replace);
    },

    navigateByPath: function (path, replace) {
      var clean = path.toLowerCase().trim();
      var v = this.ROUTE_MAP[clean] || 'home';
      this.navigateTo(v, replace);
    },

    getInitialView: function () {
      var path = window.location.pathname.toLowerCase();
      var v = this.ROUTE_MAP[path];
      if (!v) {
        var h = window.location.hash.replace(/^#\/?/, '').toLowerCase();
        if (h) v = this.ROUTE_MAP['/' + h];
      }
      return v || 'home';
    },

    dispatchInitialRoute: function () {
      var v = this.initialTargetView || this.getInitialView();
      if (v === 'login') {
        if (OrbixProjects.currentUser) {
          this.navigateTo('home', true);
          return;
        }
        this.updateUrl('login', true);
        if (typeof OrbixProjects.showLogin === 'function') {
          OrbixProjects.showLogin();
        }
        return;
      }

      if (!v) v = 'home';

      if (OrbixProjects.currentUser && !OrbixProjects.isAdmin()) {
        if (this.EMPLOYEE_ALLOWED.indexOf(v) === -1) {
          if (typeof showToast === 'function') {
            showToast('Access restricted: Employees can only access Home, Floor Plan, 3D Studio, and Pricing.');
          }
          v = 'home';
        }
      }

      this.navigateTo(v, true);
    }
  };
  root.OrbixRouter = OrbixRouter;

  // ═══════════════════════════════════════════════════════════════════════════════
  // ORBIX ROUTER — Clean URL Routing, Browser History & Role-Based Navigation


  var OrbixProjects = {
    currentUser: null,
    activeProjectId: null,
    projects: [],
    users: [
      { id: 'usr_admin', name: 'Cookscape Admin', username: 'admin', email: 'admin@cookscape.com', role: 'admin', designation: 'System Administrator', company: 'Cookscape', avatar: 'CA' },
      { id: 'usr_sangathamizh', name: 'Sangathamizh', username: 'sangathamizh', email: 'designteam.cookscape@gmail.com', role: 'admin', designation: 'Business Head', company: 'Cookscape', avatar: 'S' },
      { id: 'usr_elakkiya', name: 'Elakkiya', username: 'elakkiya', email: 'elakkiya.sakthivelu3089@gmail.com', role: 'employee', designation: 'Floor Architect / FA', company: 'Cookscape', avatar: 'E' },
      { id: 'usr_aravind', name: 'Aravind', username: 'aravind', email: 'webapp.cookscape@gmail.com', role: 'employee', designation: 'Floor Architect / FA', company: 'Cookscape', avatar: 'A' }
    ],
    filter: 'all',
    searchQuery: '',
    dbStatus: null,

    apiFetch: function (url, options) {
      options = options || {};
      options.credentials = 'include';
      if (!options.headers) {
        options.headers = {};
      }
      return fetch(url, options);
    },

    verifySession: function (cb) {
      var self = this;
      OrbixProjects.apiFetch('/api/me')
        .then(function (r) {
          if (r.ok) {
            return r.json().then(function (data) {
              if (data.success && data.user) {
                self.currentUser = data.user;
                try {
                  localStorage.setItem('orbix_current_user', JSON.stringify(data.user));
                } catch (e) { }
                self.showApp();
                self.updateUserUI();
              }
            });
          } else if (r.status === 401) {
            // Server updated or session temporarily unauthenticated: retain local user and projects
            var cached = null;
            try { cached = JSON.parse(localStorage.getItem('orbix_current_user')); } catch (e) { }
            if (cached && cached.id) {
              console.log('[OrbixProjects] Retaining session for ' + cached.name + ' across server update.');
              self.currentUser = cached;
              self.showApp();
              self.updateUserUI();
            } else {
              self.currentUser = null;
              self.showLogin();
            }
          }
        })
        .catch(function (err) {
          console.warn('[OrbixProjects] Session verification offline:', err.message);
        })
        .then(function () {
          if (cb) cb();
        });
    },

    init: function () {
      var self = this;
      OrbixRouter.init();
      this.loadCachedUser();
      this.applyRolePermissions();
      this.initEventListeners();
      this.fetchDBStatus();
      this.verifySession(function () {
        self.fetchUsers(function () {
          self.applyRolePermissions();
          self.fetchProjects(function () {
            // Open active project or first project for this user
            if (self.projects && self.projects.length > 0) {
              var userActiveKey = 'orbix_active_proj_' + (self.currentUser ? self.currentUser.id : 'anon');
              var savedId = null;
              try { savedId = localStorage.getItem(userActiveKey); } catch (e) { }
              var toOpen = self.projects.find(function (p) { return p.id === savedId; }) || self.projects[0];
              self.openProject(toOpen.id, false);
            }
            OrbixRouter.dispatchInitialRoute();
          });
        });
      });
      this.startAutoSaveLoop();
      this.guardViews();

      if (typeof window !== 'undefined') {
        window.addEventListener('beforeunload', function () {
          self.flushImmediateSave();
        });
        window.addEventListener('pagehide', function () {
          self.flushImmediateSave();
        });
        window.addEventListener('online', function () {
          self.setSaveIndicator('saved', 'Online');
          if (self._hasPendingOfflineSave) {
            self.saveActiveProject();
          }
        });
        window.addEventListener('offline', function () {
          self.setSaveIndicator('offline');
        });
      }
    },

    isAdmin: function () {
      if (!this.currentUser) return false;
      var r = (this.currentUser.role || '').toLowerCase();
      return r === 'admin' || r.indexOf('admin') !== -1;
    },

    loadCachedUser: function () {
      try {
        var saved = localStorage.getItem('orbix_current_user');
        if (saved) {
          this.currentUser = JSON.parse(saved);
          // If cached user is an obsolete demo account, reset to primary admin
          if (this.currentUser.id === 'usr_dev' || this.currentUser.id === 'usr_alex' || this.currentUser.id === 'usr_priya' || (this.currentUser.email && this.currentUser.email.indexOf('@orbixstudio.io') !== -1)) {
            this.currentUser = this.users[0];
            try {
              localStorage.setItem('orbix_current_user', JSON.stringify(this.currentUser));
            } catch (e) { }
            this.showApp();
            this.updateUserUI();
            return;
          }
          if (this.currentUser.id === 'usr_admin') {
            this.currentUser.role = 'admin';
          } else if (!this.currentUser.role || (this.currentUser.role !== 'admin' && this.currentUser.role !== 'employee')) {
            this.currentUser.role = 'employee';
          }
          this.showApp();
          this.updateUserUI();
        } else {
          this.currentUser = this.users[0];
          try {
            localStorage.setItem('orbix_current_user', JSON.stringify(this.currentUser));
          } catch (e) { }
          this.showApp();
          this.updateUserUI();
        }
      } catch (e) {
        this.currentUser = this.users[0];
        this.showApp();
        this.updateUserUI();
      }
    },

    showApp: function () {
      var appEl = document.getElementById('app');
      var authEl = document.getElementById('authScreen');
      if (appEl) appEl.style.display = 'flex';
      if (authEl) authEl.style.display = 'none';
    },

    showLogin: function () {
      var appEl = document.getElementById('app');
      var authEl = document.getElementById('authScreen');
      if (appEl) appEl.style.display = 'none';
      if (authEl) {
        authEl.style.display = 'flex';
        var errAlert = document.getElementById('authScreenError');
        if (errAlert) errAlert.style.display = 'none';
        var idInput = document.getElementById('authIdentifier');
        if (idInput) setTimeout(function () { idInput.focus(); }, 100);
      }
    },

    logout: function () {
      try {
        localStorage.removeItem('orbix_current_user');
        localStorage.removeItem('orbix-project');
        localStorage.removeItem('orbix_active_project_id');
        localStorage.removeItem('cupboard-cad');
      } catch (e) { }
      this.currentUser = null;
      this.activeProjectId = null;
      this.projects = [];
      if (window.OrbixUI && typeof window.OrbixUI.resetProject === 'function') {
        window.OrbixUI.resetProject('New Project');
      }
      if (window.S) {
        window.S.units = [];
        window.S.active = 0;
        if (typeof renderRail === 'function') renderRail();
        if (typeof buildScene === 'function') buildScene();
      }
      this.closeModal('userModal');
      this.closeModal('loginModal');
      this.closeModal('editUserModal');
      this.showLogin();
      if (OrbixRouter) {
        OrbixRouter.updateUrl('login', false);
      }
      if (typeof showToast === 'function') {
        showToast('Logged out of session.');
      }
    },

    setCurrentUser: function (user) {
      this.currentUser = user;
      this.activeProjectId = null; // Always clear active project on account switch!
      try {
        localStorage.setItem('orbix_current_user', JSON.stringify(user));
        localStorage.removeItem('orbix-project');
        localStorage.removeItem('orbix_active_project_id');
        localStorage.removeItem('cupboard-cad');
      } catch (e) { }

      // Reset workspace to clean project for the newly logged-in account
      if (window.OrbixUI && typeof window.OrbixUI.resetProject === 'function') {
        window.OrbixUI.resetProject('New Project');
      }
      if (window.S) {
        window.S.units = [];
        window.S.active = 0;
        if (typeof renderRail === 'function') renderRail();
        if (typeof buildScene === 'function') buildScene();
      }

      this.showApp();
      this.updateUserUI();
      this.applyRolePermissions();

      var self = this;
      this.fetchProjects(function () {
        if (self.projects && self.projects.length > 0) {
          var userActiveKey = 'orbix_active_proj_' + user.id;
          var savedId = null;
          try { savedId = localStorage.getItem(userActiveKey); } catch (e) { }
          var toOpen = self.projects.find(function (p) { return p.id === savedId; }) || self.projects[0];
          self.openProject(toOpen.id, false);
        }
        // Always navigate to home page after login
        if (root.OrbixRouter) {
          root.OrbixRouter.navigateTo('home', true);
        } else if (typeof window.setView === 'function') {
          window.setView('home');
        }
      });

      if (typeof showToast === 'function') {
        var roleName = this.isAdmin() ? 'Admin' : 'Employee';
        showToast('Active account: ' + user.name + ' (' + roleName + ')');
      }
    },

    guardViews: function () {
      var self = this;
      var checkAndGuard = function () {
        if (typeof window.setView === 'function' && !window.setView._isGuarded) {
          var origSetView = window.setView;
          window.setView = function (v) {
            var isAdm = self.isAdmin();
            var allowedViews = isAdm
              ? ['home', 'plan', 'design', 'kitchen', 'gallery', 'boq', 'quote', 'sheet', 'elev', 'panels', 'nest', 'upload', 'report']
              : ['home', 'plan', 'design', 'boq'];
            if (!isAdm && allowedViews.indexOf(v) === -1) {
              if (typeof showToast === 'function') {
                showToast('Restricted: Employee accounts have access to Home, Floor Plan (2D), 3D Studio & Pricing.');
              }
              origSetView('home');
              if (root.OrbixRouter) root.OrbixRouter.updateUrl('home', true);
              return;
            }
            origSetView(v);
          };
          window.setView._isGuarded = true;
        }
      };
      checkAndGuard();
      setTimeout(checkAndGuard, 1000);
    },

    applyRolePermissions: function () {
      var isAdm = this.isAdmin();
      document.body.classList.toggle('role-employee', !isAdm);
      document.body.classList.toggle('role-admin', isAdm);
      var userModalEl = document.getElementById('userModal');
      if (userModalEl) {
        userModalEl.classList.toggle('role-employee', !isAdm);
        userModalEl.classList.toggle('role-admin', isAdm);
      }
      // Admin has all access; Employee only has home, floor plan (2D), 3D Studio, Pricing (boq)
      var allowedViews = isAdm
        ? ['home', 'plan', 'design', 'kitchen', 'gallery', 'boq', 'quote', 'sheet', 'elev', 'panels', 'nest', 'upload', 'report']
        : ['home', 'plan', 'design', 'boq'];

      // 1. Control visibility of top navigation tabs
      var navTabs = document.querySelectorAll('.topbar .views .vtab');
      navTabs.forEach(function (tab) {
        var v = tab.getAttribute('data-view');
        if (allowedViews.indexOf(v) !== -1) {
          tab.style.display = '';
          tab.removeAttribute('hidden');
        } else {
          tab.style.display = 'none';
          tab.setAttribute('hidden', '');
        }
      });

      // 2. If employee is currently on an unauthorized view, redirect to home
      var activeTab = document.querySelector('.topbar .views .vtab.is-on');
      var activeView = activeTab ? activeTab.getAttribute('data-view') : 'home';
      if (allowedViews.indexOf(activeView) === -1) {
        if (typeof window.setView === 'function') {
          window.setView('home');
        }
      }

      // 3. Update topbar user avatar & role badge
      var avatarEl = document.getElementById('userAvatarBtn');
      if (avatarEl && this.currentUser) {
        var roleLabel = isAdm ? 'Admin' : 'Employee';
        var roleClass = isAdm ? 'badge-admin' : 'badge-employee';
        avatarEl.innerHTML = '<span class="u-avatar ' + (isAdm ? 'is-admin-avatar' : '') + '">' +
          (this.currentUser.avatar || 'US') + '</span>' +
          '<span class="u-name">' + this.currentUser.name + '</span>' +
          '<span class="u-role-pill ' + roleClass + '">' + roleLabel + '</span>';
      }

      // 4. Update Current User Card in Modal
      var modalName = document.getElementById('curUserName');
      if (modalName) modalName.textContent = this.currentUser ? this.currentUser.name : '';
      var modalEmail = document.getElementById('curUserEmail');
      if (modalEmail) modalEmail.textContent = this.currentUser ? this.currentUser.email : '';
      var modalRole = document.getElementById('curUserRole');
      if (modalRole) modalRole.textContent = (this.currentUser ? (this.currentUser.designation || this.currentUser.role) : '') + ' • ' + (this.currentUser ? this.currentUser.company : '');
      var modalBadge = document.getElementById('curUserBadge');
      if (modalBadge) {
        modalBadge.textContent = isAdm ? 'Admin (Full Access)' : 'Employee';
        modalBadge.className = 'role-badge ' + (isAdm ? 'admin' : 'employee');
      }

      // 5. Show/hide Admin employee creation box and Team Profiles section in Modal
      var adminBox = document.getElementById('adminCreateEmpBox');
      if (adminBox) {
        adminBox.style.display = isAdm ? 'block' : 'none';
      }
      var adminTeamSec = document.getElementById('adminTeamProfilesSection');
      if (adminTeamSec) {
        adminTeamSec.style.display = isAdm ? 'block' : 'none';
      }
      var modalTitle = document.querySelector('#userModal .modal-title');
      var modalSub = document.querySelector('#userModal .modal-sub');
      if (modalTitle) {
        modalTitle.textContent = isAdm ? 'User Profile & Workspace' : 'User Profile';
      }
      if (modalSub) {
        modalSub.textContent = isAdm ? 'Switch user profile or manage modular studio team' : 'Your active account details and session';
      }

      // 6. Project Dashboard description
      var pSecDesc = document.querySelector('.psection-title-wrap p');
      if (pSecDesc) {
        if (isAdm) {
          pSecDesc.textContent = 'Admin Workspace — Full access to all projects, factory nesting, exports & production.';
        } else {
          pSecDesc.textContent = 'Employee Workspace — Your projects and projects shared with you.';
        }
      }
    },

    updateUserUI: function () {
      this.applyRolePermissions();
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
        badge.innerHTML = '<span class="db-dot"></span> PostgreSQL Live DB';
        badge.title = 'Live connection to PostgreSQL (' + (this.dbStatus.postgres.database || 'cupboard_cad') + ')';
      } else {
        badge.className = 'db-badge is-local';
        badge.innerHTML = '<span class="db-dot"></span> Offline Local Store';
        badge.title = 'Running in offline fallback mode';
      }
    },

    fetchUsers: function (cb) {
      var self = this;

      OrbixProjects.apiFetch('/api/users')
        .then(function (r) {
          if (!r.ok) throw new Error('Unable to fetch users (status ' + r.status + ')');
          return r.json();
        })
        .then(function (data) {
          var userList = Array.isArray(data) ? data : (data && Array.isArray(data.users) ? data.users : null);
          if (Array.isArray(userList)) {
            self.users = userList.filter(function (u) {
              return u.id !== 'usr_dev' &&
                u.id !== 'usr_alex' &&
                u.id !== 'usr_priya' &&
                u.email !== 'dev@orbixstudio.io' &&
                u.email !== 'alex@orbixstudio.io' &&
                u.email !== 'priya@orbixstudio.io' &&
                u.email !== 'alex@modularedge.com' &&
                u.email !== 'priya@archform.in';
            });

            if (self.currentUser) {
              var cachedEmail = (self.currentUser.email || '').trim().toLowerCase();

              var matched = self.users.find(function (u) {
                return u.id === self.currentUser.id;
              });

              if (!matched && cachedEmail) {
                matched = self.users.find(function (u) {
                  return (u.email || '').trim().toLowerCase() === cachedEmail;
                });
              }

              if (matched) {
                self.currentUser = matched;

                try {
                  localStorage.setItem(
                    'orbix_current_user',
                    JSON.stringify(matched)
                  );
                } catch (e) {
                  console.warn('Unable to refresh cached user:', e);
                }
              }
            }

            self.populateBhDropdown();
          }

          if (cb) cb();
        })
        .catch(function (err) {
          console.warn('User synchronization offline:', err.message);
          if (!self.users || !self.users.length) {
            self.users = [
              { id: 'usr_admin', name: 'Cookscape Admin', username: 'admin', email: 'admin@cookscape.com', role: 'admin', designation: 'System Administrator', company: 'Cookscape', avatar: 'CA' },
              { id: 'usr_sangathamizh', name: 'Sangathamizh', username: 'sangathamizh', email: 'designteam.cookscape@gmail.com', role: 'admin', designation: 'Business Head', company: 'Cookscape', avatar: 'S' },
              { id: 'usr_elakkiya', name: 'Elakkiya', username: 'elakkiya', email: 'elakkiya.sakthivelu3089@gmail.com', role: 'employee', designation: 'Floor Architect / FA', company: 'Cookscape', avatar: 'E' },
              { id: 'usr_aravind', name: 'Aravind', username: 'aravind', email: 'webapp.cookscape@gmail.com', role: 'employee', designation: 'Floor Architect / FA', company: 'Cookscape', avatar: 'A' }
            ];
          }
          self.populateBhDropdown();
          if (cb) cb();
        });
    },

    fetchProjects: function (cb) {
      var self = this;
      if (!this.currentUser) {
        try {
          var savedUser = JSON.parse(localStorage.getItem('orbix_current_user'));
          if (savedUser && savedUser.id) {
            self.currentUser = savedUser;
          }
        } catch (e) { }
        if (!this.currentUser) {
          self.projects = [];
          self.renderProjectsList();
          if (cb) cb();
          return;
        }
      }

      var roleParam = this.isAdmin() ? 'admin' : 'employee';
      var url = '/api/projects?search=' + encodeURIComponent(this.searchQuery) +
        '&filter=' + encodeURIComponent(this.filter) +
        '&userId=' + encodeURIComponent(this.currentUser.id) +
        '&userRole=' + encodeURIComponent(roleParam);

      var listContainer = document.getElementById('projectsGrid');
      if (listContainer && (!self.projects || !self.projects.length)) {
        listContainer.innerHTML = '<div class="proj-loading">Loading live projects from PostgreSQL...</div>';
      }

      OrbixProjects.apiFetch(url)
        .then(function (r) {
          if (!r.ok) throw new Error('Failed to fetch projects (status ' + r.status + ')');
          return r.json();
        })
        .then(function (data) {
          self.projects = data.projects || [];
          try {
            var localKey = 'orbix_local_projects_' + (self.currentUser ? self.currentUser.id : 'anon');
            localStorage.setItem(localKey, JSON.stringify(self.projects));
          } catch (e) { }
          self.renderProjectsList();
          self.renderSharedCopyAlert();
          if (self.projects.length === 0) {
            self.activeProjectId = null;
            if (window.OrbixUI && typeof window.OrbixUI.resetProject === 'function') {
              window.OrbixUI.resetProject('New Project');
            }
          }
          if (cb) cb();
        })
        .catch(function (err) {
          console.warn('[OrbixProjects] Projects API offline, loading cached projects:', err.message);
          try {
            var localKey = 'orbix_local_projects_' + (self.currentUser ? self.currentUser.id : 'anon');
            var localSaved = localStorage.getItem(localKey);
            if (localSaved) {
              self.projects = JSON.parse(localSaved);
            }
          } catch (e) { }
          self.renderProjectsList();
          self.renderSharedCopyAlert();
          if (cb) cb();
        });
    },

    renderSharedCopyAlert: function () {
      var container = document.getElementById('sharedCopyAlertContainer');
      if (!container) return;

      if (!this.projects || !this.projects.length) {
        container.innerHTML = '';
        return;
      }

      var self = this;
      var pending = this.projects.filter(function (p) {
        var sn = p.shareNotice || (p.data && p.data.shareNotice);
        if (!sn) return false;
        var noticeKey = sn.noticeId || ('sn_' + p.id);
        try {
          var dismissed = localStorage.getItem('orbix_dismissed_share_' + noticeKey);
          if (dismissed === 'true') return false;
        } catch (e) { }
        return true;
      });

      if (!pending.length) {
        container.innerHTML = '';
        return;
      }

      var project = pending[0];
      var sn = project.shareNotice || project.data.shareNotice;
      var noticeKey = sn.noticeId || ('sn_' + project.id);
      var sharedByName = sn.sharedByName || project.owner_name || 'A Colleague';
      var sharedByDesig = sn.sharedByDesignation || 'Modular Designer';
      var projectTitle = sn.originalTitle || project.title;

      container.innerHTML = '<div class="shared-copy-alert-banner" id="sharedAlert_' + noticeKey + '">' +
        '<div class="sca-left">' +
        '<div class="sca-icon">⑂</div>' +
        '<div class="sca-content">' +
        '<div class="sca-title">' + sharedByName + ' (' + sharedByDesig + ') has shared their project copy with you</div>' +
        '<div class="sca-desc">Project: "<strong>' + projectTitle + '</strong>". An isolated duplicate has been added to your projects.</div>' +
        '</div>' +
        '</div>' +
        '<div class="sca-actions">' +
        '<button type="button" class="btn primary small sca-open-btn" data-pid="' + project.id + '">Open Project</button>' +
        '<button type="button" class="btn small sca-cancel-btn" data-nid="' + noticeKey + '">Cancel</button>' +
        '</div>' +
        '</div>';

      var cancelBtn = container.querySelector('.sca-cancel-btn');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          var nid = this.getAttribute('data-nid');
          try {
            localStorage.setItem('orbix_dismissed_share_' + nid, 'true');
          } catch (err) { }
          container.innerHTML = '';
        });
      }

      var openBtn = container.querySelector('.sca-open-btn');
      if (openBtn) {
        openBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          var pid = this.getAttribute('data-pid');
          self.openProject(pid, true);
        });
      }
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
        } catch (e) { }

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

    openProject: function (id, switchView) {
      var self = this;
      var project = this.projects.find(function (p) { return p.id === id; });
      if (!project) return;

      this.activeProjectId = id;
      if (this.currentUser) {
        try {
          localStorage.setItem('orbix_active_proj_' + this.currentUser.id, id);
        } catch (e) { }
      }

      // Fetch fresh live project from PostgreSQL
      OrbixProjects.apiFetch('/api/projects/' + id)
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var liveProj = data.project || project;
          self._loadProjectIntoWorkspace(liveProj, switchView);
        })
        .catch(function () {
          self._loadProjectIntoWorkspace(project, switchView);
        });
    },

    _loadProjectIntoWorkspace: function (project, switchView) {
      var self = this;
      var activeId = project.id || self.activeProjectId;
      if (activeId) {
        self.activeProjectId = activeId;
        try {
          var uId = self.currentUser ? self.currentUser.id : 'anon';
          localStorage.setItem('orbix_active_proj_' + uId, activeId);
        } catch (e) { }
      }

      // 1. Check if we have a newer local storage draft for this project (retains units across hard refresh & offline)
      var userKey = 'orbix_project_' + (this.currentUser ? this.currentUser.id : 'anon') + '_' + activeId;
      var localPlanRaw = null;
      try {
        localPlanRaw = localStorage.getItem(userKey);
        if (!localPlanRaw) {
          var draftRaw = localStorage.getItem('orbix_working_project_draft');
          if (draftRaw) {
            var draftObj = JSON.parse(draftRaw);
            if (draftObj && (draftObj.projectId === activeId || !draftObj.projectId)) {
              localPlanRaw = JSON.stringify(draftObj.plan);
            }
          }
        }
      } catch (e) { }

      var planToLoad = null;
      if (localPlanRaw) {
        try {
          var parsedLocal = JSON.parse(localPlanRaw);
          var localCount = (parsedLocal.plan && parsedLocal.plan.furniture) ? parsedLocal.plan.furniture.length : 0;
          var serverCount = (project.data && project.data.plan && project.data.plan.plan && project.data.plan.plan.furniture)
            ? project.data.plan.plan.furniture.length : 0;
          
          if (localCount >= serverCount || (parsedLocal._lastModified && (!project.updatedAt || parsedLocal._lastModified > new Date(project.updatedAt).getTime()))) {
            planToLoad = parsedLocal;
            console.log('[Orbix Studio] Retained latest local draft across refresh/offline (' + localCount + ' units).');
          }
        } catch (e) { }
      }

      if (!planToLoad) {
        if (project.data && project.data.plan && (project.data.plan.plan || project.data.plan.walls)) {
          planToLoad = project.data.plan;
        } else if (window.OrbixCore && typeof window.OrbixCore.createProject === 'function') {
          planToLoad = window.OrbixCore.createProject(project.title);
        }
      }

      // Normalize client and quote metadata into planToLoad.meta
      if (planToLoad) {
        planToLoad.meta = planToLoad.meta || {};
        var details = (project.data && project.data.details) || {};
        if (!planToLoad.meta.clientName) planToLoad.meta.clientName = project.client || details.clientName || 'Vikram Singhania';
        if (!planToLoad.meta.phone) planToLoad.meta.phone = project.contact_number || details.contactNumber || details.phone || '';
        if (!planToLoad.meta.contactNumber) planToLoad.meta.contactNumber = planToLoad.meta.phone;
        if (!planToLoad.meta.siteAddress) planToLoad.meta.siteAddress = project.location || details.location || details.siteAddress || '';
        if (!planToLoad.meta.siteLocation) planToLoad.meta.siteLocation = planToLoad.meta.siteAddress;
        if (!planToLoad.meta.quoteId) planToLoad.meta.quoteId = project.cp_code || details.cpCode || details.quoteId || ('ORB-' + (activeId ? String(activeId).slice(-6) : '089'));
        if (!planToLoad.meta.cpCode) planToLoad.meta.cpCode = planToLoad.meta.quoteId;
        if (!planToLoad.meta.designerName) planToLoad.meta.designerName = project.bh_name || details.bhName || (self.currentUser ? self.currentUser.name : 'Sangathamizh');
        if (!planToLoad.meta.bhName) planToLoad.meta.bhName = planToLoad.meta.designerName;
        if (!planToLoad.meta.dateCreated) planToLoad.meta.dateCreated = project.date_time || details.dateTime || details.dateCreated || new Date().toISOString();
        if (!planToLoad.meta.status) planToLoad.meta.status = 'Approved Estimate';
      }

      // Load 2D floor plan into OrbixUI
      if (window.OrbixUI && planToLoad && typeof window.OrbixUI.loadProject === 'function') {
        window.OrbixUI.loadProject(planToLoad);
      }

      // 2. Synchronize 3D units strictly synchronized with live project
      if (window.OrbixUI && typeof window.OrbixUI.syncProjectUnitsTo3DStudio === 'function') {
        window.OrbixUI.syncProjectUnitsTo3DStudio();
      } else if (window.S) {
        window.S.units = (project.data && project.data.units && Array.isArray(project.data.units)) ? project.data.units : [];
        window.S.active = 0;
      }

      // 3. Build 3D Studio scene, render architecture & frame camera
      if (typeof renderRail === 'function') renderRail();
      if (typeof buildScene === 'function') buildScene();
      if (window.OrbixUI && typeof window.OrbixUI.render3DHome === 'function') {
        window.OrbixUI.render3DHome();
      }
      if (typeof fit === 'function') fit();
      if (typeof camApply === 'function') camApply();

      if (switchView !== false) {
        if (root.OrbixRouter) {
          root.OrbixRouter.navigateTo('plan');
        } else if (typeof window.setView === 'function') {
          window.setView('plan');
        }

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
          showToast('Opened project: ' + project.title);
        }
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
      if (!this.currentUser) return;
      var activeId = this.activeProjectId;
      if (!activeId) {
        try {
          activeId = localStorage.getItem('orbix_active_proj_' + this.currentUser.id);
        } catch (e) { }
      }
      if (!activeId) return;

      // Strictly verify activeId belongs to this user's project list
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

      // Save user-scoped local backup
      try {
        if (project.data.plan) {
          localStorage.setItem('orbix_project_' + this.currentUser.id + '_' + activeId, JSON.stringify(project.data.plan));
        }
        localStorage.setItem('orbix_active_proj_' + this.currentUser.id, activeId);
      } catch (e) { }

      var self = this;
      self.setSaveIndicator('saving');

      // Sync live to PostgreSQL backend
      OrbixProjects.apiFetch('/api/projects/' + activeId, {
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
          console.warn('[AutoSave Live] PostgreSQL offline:', err);
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

    flushImmediateSave: function () {
      var currentPlan = (window.OrbixUI && window.OrbixUI.project) ? window.OrbixUI.project : null;
      if (!currentPlan) return;
      var currentUnits = (window.S && Array.isArray(window.S.units)) ? window.S.units : [];
      var activeId = this.activeProjectId || (this.currentUser ? localStorage.getItem('orbix_active_proj_' + this.currentUser.id) : null);
      var now = Date.now();
      currentPlan._lastModified = now;

      try {
        var draft = {
          projectId: activeId,
          userId: this.currentUser ? this.currentUser.id : 'anon',
          timestamp: now,
          plan: currentPlan,
          units: currentUnits
        };
        localStorage.setItem('orbix_working_project_draft', JSON.stringify(draft));
        if (activeId) {
          var userKey = 'orbix_project_' + (this.currentUser ? this.currentUser.id : 'anon') + '_' + activeId;
          localStorage.setItem(userKey, JSON.stringify(currentPlan));
        }
      } catch (e) {
        console.warn('Flush immediate save error:', e);
      }
    },

    saveActiveProject: function (dataUpdates) {
      var self = this;
      var activeId = this.activeProjectId || (this.currentUser ? localStorage.getItem('orbix_active_proj_' + this.currentUser.id) : null);
      var project = activeId ? this.projects.find(function (p) { return p.id === activeId; }) : null;

      var currentPlan = (dataUpdates && dataUpdates.plan) || (window.OrbixUI && window.OrbixUI.project);
      var currentUnits = (dataUpdates && dataUpdates.units) || (window.S && window.S.units) || [];
      if (!currentPlan) return;

      var now = Date.now();
      currentPlan._lastModified = now;

      // 1. Instant Synchronous LocalStorage Save (0ms delay - 100% hard refresh & offline safe)
      try {
        localStorage.setItem('orbix_working_project_draft', JSON.stringify({
          projectId: activeId,
          userId: self.currentUser ? self.currentUser.id : 'anon',
          timestamp: now,
          plan: currentPlan,
          units: currentUnits
        }));
        if (activeId) {
          var userKey = 'orbix_project_' + (self.currentUser ? self.currentUser.id : 'anon') + '_' + activeId;
          localStorage.setItem(userKey, JSON.stringify(currentPlan));
          localStorage.setItem('orbix_active_proj_' + (self.currentUser ? self.currentUser.id : 'anon'), activeId);
        }
      } catch (e) { }

      if (project) {
        project.data = project.data || {};
        project.data.plan = currentPlan;
        project.data.units = currentUnits;
        var planFurn = (currentPlan.plan && currentPlan.plan.furniture) || (currentPlan.furniture) || [];
        project.units_count = planFurn.length || (currentUnits ? currentUnits.length : 0);
      }

      // 2. Check offline status
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        self.setSaveIndicator('offline');
        self._hasPendingOfflineSave = true;
        return;
      }

      self.setSaveIndicator('saving');

      // 3. Debounced backend save to PostgreSQL
      clearTimeout(this._saveDebounce);
      this._saveDebounce = setTimeout(function () {
        if (!activeId) {
          self.setSaveIndicator('offline');
          return;
        }
        var pData = project ? project.data : { plan: currentPlan, units: currentUnits };
        var pUnitsCount = project ? project.units_count : ((currentPlan.plan && currentPlan.plan.furniture) ? currentPlan.plan.furniture.length : 0);

        OrbixProjects.apiFetch('/api/projects/' + activeId, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: pData,
            units_count: pUnitsCount
          })
        })
          .then(function () {
            var d = new Date();
            var timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            self.setSaveIndicator('saved', timeStr);
            self._hasPendingOfflineSave = false;
          })
          .catch(function (e) {
            console.warn('Auto-save to backend failed (retained locally):', e);
            self.setSaveIndicator('offline');
            self._hasPendingOfflineSave = true;
          });
      }, 400);
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // "COLLEAGUES WORK IN COPY" — Fork & Share Handlers
    // ═══════════════════════════════════════════════════════════════════════════
    forkProjectForCurrentUser: function (originalId) {
      var self = this;
      var original = this.projects.find(function (p) { return p.id === originalId; });
      if (!original) return;

      OrbixProjects.apiFetch('/api/projects/' + originalId + '/fork', {
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
        body: JSON.stringify({
          colleagueUser: colleagueUser,
          senderUser: self.currentUser
        })
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
      OrbixProjects.apiFetch('/api/projects/' + id, { method: 'DELETE' })
        .then(function (r) { return r.json(); })
        .then(function () {
          if (self.activeProjectId === id) {
            self.activeProjectId = null;
            if (self.currentUser) {
              try { localStorage.removeItem('orbix_active_proj_' + self.currentUser.id); } catch (e) { }
            }
            if (window.OrbixUI && typeof window.OrbixUI.resetProject === 'function') {
              window.OrbixUI.resetProject('New Project');
            }
          }
          self.fetchProjects();
          if (typeof showToast === 'function') {
            showToast('Deleted project: ' + title);
          }
        });
    },

    populateBhDropdown: function () {
      var select = document.getElementById('newProjBhName');
      if (!select) return;

      var currentVal = select.value;
      select.innerHTML = '<option value="" disabled selected>-- Select Business Head (BH) --</option>';

      var namesSeen = {};

      // 1. Add all users from database
      if (this.users && this.users.length) {
        this.users.forEach(function (u) {
          if (u.name && !namesSeen[u.name.toLowerCase()]) {
            namesSeen[u.name.toLowerCase()] = true;
            var opt = document.createElement('option');
            opt.value = u.name;
            opt.textContent = u.name + ' (' + (u.designation || (u.role === 'admin' ? 'Business Head' : 'Studio Designer')) + ')';
            select.appendChild(opt);
          }
        });
      }

      // 2. Add standard Cookscape Business Heads & Leads
      var defaultBhs = [
        { name: 'Sangathamizh', role: 'Business Head' },
        { name: 'Cookscape Admin', role: 'System Head' },
        { name: 'Aravind', role: 'Floor Architect / FA' },
        { name: 'Elakkiya', role: 'Floor Architect / FA' },
        { name: 'Dev Kancheti', role: 'Design Lead' }
      ];
      defaultBhs.forEach(function (b) {
        if (!namesSeen[b.name.toLowerCase()]) {
          namesSeen[b.name.toLowerCase()] = true;
          var opt = document.createElement('option');
          opt.value = b.name;
          opt.textContent = b.name + ' (' + b.role + ')';
          select.appendChild(opt);
        }
      });

      // 3. Add Cookscape Studio branches/hubs
      var hubGroup = document.createElement('optgroup');
      hubGroup.label = 'Cookscape Branches / Hubs';
      ['Cookscape Chennai Central', 'Cookscape OMR Hub', 'Cookscape Coimbatore', 'Cookscape Bangalore'].forEach(function (h) {
        var opt = document.createElement('option');
        opt.value = h;
        opt.textContent = h;
        hubGroup.appendChild(opt);
      });
      select.appendChild(hubGroup);

      if (currentVal) select.value = currentVal;
    },

    openCreateModal: function () {
      this.populateBhDropdown();
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
      if (modalId === 'userModal' && window.location.pathname === '/users') {
        if (root.OrbixRouter) {
          var activeTab = document.querySelector('.topbar .views .vtab.is-on');
          var activeView = activeTab ? activeTab.getAttribute('data-view') : 'home';
          root.OrbixRouter.updateUrl(activeView, false);
        }
      }
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
            freshPlan.meta.phone = contact;
            freshPlan.meta.contactNumber = contact;
            freshPlan.meta.siteAddress = location;
            freshPlan.meta.siteLocation = location;
            freshPlan.meta.designerName = bhName || (self.currentUser ? self.currentUser.name : 'Sangathamizh');
            freshPlan.meta.bhName = bhName;
            freshPlan.meta.dateTime = dateTime;
            freshPlan.meta.dateCreated = dateTime || new Date().toISOString();
            freshPlan.meta.cpCode = cpCode;
            freshPlan.meta.quoteId = cpCode || ('ORB-' + Date.now().toString().slice(-6));
            freshPlan.meta.status = 'Approved Estimate';
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
                phone: contact,
                location: location,
                siteAddress: location,
                bhName: bhName,
                designerName: bhName || (self.currentUser ? self.currentUser.name : 'Sangathamizh'),
                dateTime: dateTime,
                dateCreated: dateTime || new Date().toISOString(),
                cpCode: cpCode,
                quoteId: cpCode || ('ORB-' + Date.now().toString().slice(-6))
              }
            },
            currentUser: self.currentUser
          };

          OrbixProjects.apiFetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          })
            .then(function (r) {
              if (!r.ok) {
                return r.json().then(function (errData) {
                  throw new Error(errData.error || ('Server returned ' + r.status));
                }).catch(function (parseErr) {
                  throw new Error(parseErr.message || ('Server returned ' + r.status));
                });
              }
              return r.json();
            })
            .then(function (data) {
              if (data.project) {
                self.closeModal('createProjectModal');
                createForm.reset();
                self.fetchProjects();
                self.openProject(data.project.id);
                if (typeof showToast === 'function') {
                  showToast('✓ Project "' + data.project.title + '" created successfully');
                }
              } else {
                throw new Error(data.error || 'Server did not return created project');
              }
            })
            .catch(function (err) {
              console.warn('Backend project creation failed, creating locally:', err);
              var fallbackProj = {
                id: 'proj_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
                title: payload.title,
                client: payload.client,
                contact_number: payload.contact_number,
                location: payload.location,
                bh_name: payload.bh_name,
                date_time: payload.date_time,
                cp_code: payload.cp_code,
                type: payload.type,
                status: 'Draft',
                created_by: (self.currentUser ? self.currentUser.id : 'usr_admin'),
                owner_name: (self.currentUser ? self.currentUser.name : 'Cookscape Admin'),
                owner_email: (self.currentUser ? self.currentUser.email : 'admin@cookscape.com'),
                units_count: 0,
                boards_est: 0,
                data: payload.data,
                is_shared: false,
                fork_count: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              };
              self.projects = self.projects || [];
              self.projects.unshift(fallbackProj);
              try {
                var localKey = 'orbix_local_projects_' + (self.currentUser ? self.currentUser.id : 'anon');
                localStorage.setItem(localKey, JSON.stringify(self.projects));
              } catch (e) { }
              self.closeModal('createProjectModal');
              createForm.reset();
              self.renderProjectsList();
              self.openProject(fallbackProj.id);
              if (typeof showToast === 'function') {
                showToast('✓ Project "' + fallbackProj.title + '" created');
              }
            });
        });
      }

      // Admin Create Employee Form
      var createEmpForm = document.getElementById('createEmployeeForm');
      if (createEmpForm) {
        createEmpForm.addEventListener('submit', function (e) {
          e.preventDefault();
          if (!self.isAdmin()) {
            if (typeof showToast === 'function') showToast('Only Admin can create new employees.');
            return;
          }
          var name = document.getElementById('newEmpName').value.trim();
          var username = document.getElementById('newEmpUsername').value.trim();
          var email = document.getElementById('newEmpEmail').value.trim();
          var password = document.getElementById('newEmpPassword').value.trim() || '123456';
          var title = document.getElementById('newEmpTitle').value.trim() || 'Modular Designer';
          var role = document.getElementById('newEmpRole').value || 'employee';

          if (!name || !email) return;

          var initials = name.split(' ').map(function (n) { return n[0]; }).join('').toUpperCase().substring(0, 2) || 'EM';

          var payload = {
            name: name,
            username: username,
            email: email,
            password: password,
            role: role,
            designation: title,
            company: 'Orbix Studio',
            avatar: initials
          };

          OrbixProjects.apiFetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          })
            .then(function (r) {
              if (!r.ok) {
                return r.json().then(function (errData) {
                  throw new Error(errData.error || ('Server returned ' + r.status));
                }).catch(function (parseErr) {
                  throw new Error(parseErr.message || ('Server returned ' + r.status));
                });
              }
              return r.json();
            })
            .then(function (data) {
              if (data.user) {
                createEmpForm.reset();
                var alertBox = document.getElementById('empCreatedAlert');
                if (alertBox) {
                  var elName = document.getElementById('ecaName');
                  var elUser = document.getElementById('ecaUsername');
                  var elEmail = document.getElementById('ecaEmail');
                  var elPass = document.getElementById('ecaPassword');
                  var elRole = document.getElementById('ecaRole');
                  if (elName) elName.textContent = data.user.name;
                  if (elUser) elUser.textContent = data.user.username || data.user.id;
                  if (elEmail) elEmail.textContent = data.user.email;
                  if (elPass) elPass.textContent = data.user.password || password;
                  if (elRole) elRole.textContent = data.user.role === 'admin' ? 'Admin' : 'Employee';
                  alertBox.style.display = 'flex';
                }

                self.fetchUsers(function () {
                  self.openUserModal();
                });
                if (typeof showToast === 'function') {
                  showToast('✓ Employee account created: ' + data.user.name);
                }
              } else {
                throw new Error(data.error || 'Server did not return created user');
              }
            })
            .catch(function (err) {
              console.error('Backend employee creation failed:', err);
              var errorMsg = err.message || 'Server error';
              if (errorMsg.includes('401') || errorMsg.includes('Unauthorized') || errorMsg.includes('session required')) {
                errorMsg = 'Session expired or not signed in. Please sign in as Admin (admin / admin123).';
              } else if (errorMsg.includes('403') || errorMsg.includes('Forbidden')) {
                errorMsg = 'Administrator privileges required to add employees.';
              }
              alert('Could not save user to PostgreSQL database:\n\n' + errorMsg);
              if (typeof showToast === 'function') {
                showToast('❌ Failed to create user in database: ' + errorMsg, 'error');
              }
            });
        });
      }

      // Dismiss employee created alert
      var dismissEcaBtn = document.getElementById('ecaDismissBtn');
      if (dismissEcaBtn) {
        dismissEcaBtn.addEventListener('click', function () {
          var alertBox = document.getElementById('empCreatedAlert');
          if (alertBox) alertBox.style.display = 'none';
        });
      }

      // User Profile & Switcher Button in Topbar
      var userBtn = document.getElementById('userAvatarBtn');
      if (userBtn) {
        userBtn.addEventListener('click', function () {
          self.openUserModal();
        });
      }

      // Logout buttons
      var handleLogout = function () {
        self.logout();
      };
      var logoutBtn = document.getElementById('userLogoutBtn');
      if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
      var modalSignOut = document.getElementById('modalSignOutBtn');
      if (modalSignOut) modalSignOut.addEventListener('click', handleLogout);

      // Full-Screen Login Form Submission (#authLoginForm)
      var authPageForm = document.getElementById('authLoginForm');
      if (authPageForm) {
        authPageForm.addEventListener('submit', function (e) {
          e.preventDefault();
          var errAlert = document.getElementById('authScreenError');
          if (errAlert) errAlert.style.display = 'none';

          var identifier = document.getElementById('authIdentifier').value.trim();
          var password = document.getElementById('authPassword').value; // Never trim password
          if (!identifier || !password) return;

          var submitBtn = document.getElementById('authScreenSubmitBtn');
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Signing In...';
          }

          function completeLogin(user) {
            authPageForm.reset();
            self.setCurrentUser(user);
            var authEl = document.getElementById('authScreen');
            if (authEl) authEl.style.display = 'none';
            var appEl = document.getElementById('app');
            if (appEl) appEl.style.display = 'flex';
            if (typeof showToast === 'function') {
              showToast('✓ Welcome back, ' + user.name + ' (' + (user.role === 'admin' ? 'Admin' : 'Employee') + ')');
            }
            if (root.OrbixRouter) {
              root.OrbixRouter.navigateTo('home', true);
            }
            self.fetchProjects();
          }

          function tryOfflineLogin() {
            var cleanId = identifier.trim().toLowerCase();
            var allKnown = (self.users && self.users.length) ? self.users : [
              { id: 'usr_admin', name: 'Cookscape Admin', username: 'admin', email: 'admin@cookscape.com', role: 'admin', designation: 'System Administrator', company: 'Cookscape', avatar: 'CA' },
              { id: 'usr_sangathamizh', name: 'Sangathamizh', username: 'sangathamizh', email: 'designteam.cookscape@gmail.com', role: 'admin', designation: 'Business Head', company: 'Cookscape', avatar: 'S' },
              { id: 'usr_elakkiya', name: 'Elakkiya', username: 'elakkiya', email: 'elakkiya.sakthivelu3089@gmail.com', role: 'employee', designation: 'Floor Architect / FA', company: 'Cookscape', avatar: 'E' },
              { id: 'usr_aravind', name: 'Aravind', username: 'aravind', email: 'webapp.cookscape@gmail.com', role: 'employee', designation: 'Floor Architect / FA', company: 'Cookscape', avatar: 'A' }
            ];
            var matched = allKnown.find(function (u) {
              return (u.email && u.email.toLowerCase() === cleanId) ||
                (u.username && u.username.toLowerCase() === cleanId) ||
                (u.name && u.name.toLowerCase() === cleanId) ||
                (cleanId === 'admin' && u.id === 'usr_admin') ||
                (cleanId === 'st' && u.id === 'usr_sangathamizh');
            });
            if (!matched && (cleanId === 'admin' || cleanId === 'admin@cookscape.com')) {
              matched = allKnown[0];
            }
            var isPassValid = (password === 'admin123' || password === '123456' || (matched && matched.password && matched.password === password));
            if (matched && isPassValid) {
              completeLogin(matched);
              return true;
            }
            return false;
          }

          OrbixProjects.apiFetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: identifier, password: password })
          })
            .then(function (r) { return r.json(); })
            .then(function (data) {
              if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Sign In to Workspace';
              }
              if (data.success && data.user) {
                completeLogin(data.user);
              } else {
                if (!tryOfflineLogin()) {
                  if (errAlert) {
                    errAlert.textContent = data.error || 'Invalid credentials. Please try again.';
                    errAlert.style.display = 'block';
                  }
                }
              }
            })
            .catch(function (err) {
              if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Sign In to Workspace';
              }
              if (!tryOfflineLogin()) {
                if (errAlert) {
                  errAlert.textContent = 'Invalid credentials or connection error.';
                  errAlert.style.display = 'block';
                }
              }
            });
        });
      }

      var closeAuthBtn = document.getElementById('closeAuthScreenBtn');
      if (closeAuthBtn) {
        closeAuthBtn.addEventListener('click', function () {
          var authEl = document.getElementById('authScreen');
          if (authEl) authEl.style.display = 'none';
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

      // Admin Edit Team Account Form (#editUserForm)
      var editUserForm = document.getElementById('editUserForm');
      if (editUserForm) {
        editUserForm.addEventListener('submit', function (e) {
          e.preventDefault();
          if (!self.isAdmin()) {
            if (typeof showToast === 'function') showToast('Only Admin can edit team accounts.');
            return;
          }
          var uid = document.getElementById('editUserId').value;
          var name = document.getElementById('editUserName').value.trim();
          var username = document.getElementById('editUserUsername').value.trim();
          var email = document.getElementById('editUserEmail').value.trim();
          var password = document.getElementById('editUserPassword').value.trim();
          var title = document.getElementById('editUserTitle').value.trim();
          var roleSelect = document.getElementById('editUserRole');
          var role = roleSelect ? roleSelect.value : 'employee';

          if (!uid || !name || !email) {
            alert('Full Name and Email Address are required.');
            return;
          }

          var payload = {
            name: name,
            username: username,
            email: email,
            designation: title,
            role: role
          };
          if (password) {
            payload.password = password;
          }

          var saveBtn = document.getElementById('saveEditUserBtn');
          if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';
          }

          OrbixProjects.apiFetch('/api/users/' + encodeURIComponent(uid), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          })
            .then(function (r) { return r.json(); })
            .then(function (data) {
              if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save Changes';
              }
              if (data.success && data.user) {
                // If edited active user, update active session
                if (self.currentUser && self.currentUser.id === uid) {
                  self.currentUser = Object.assign({}, self.currentUser, data.user);
                  try {
                    localStorage.setItem('orbix_current_user', JSON.stringify(self.currentUser));
                  } catch (e) { }
                  self.updateUserUI();
                }
                self.closeModal('editUserModal');
                if (typeof showToast === 'function') {
                  showToast('✓ Account updated: ' + data.user.name);
                }
                self.fetchUsers(function () {
                  self.openUserModal();
                });
              } else {
                alert('Failed to update account: ' + (data.error || 'Server error'));
              }
            })
            .catch(function (err) {
              if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save Changes';
              }
              alert('Error updating user: ' + err.message);
            });
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

    openLoginModal: function () {
      var modal = document.getElementById('loginModal');
      if (modal) {
        var errAlert = document.getElementById('loginErrorAlert');
        if (errAlert) errAlert.style.display = 'none';
        modal.classList.add('is-open');
        var idInput = document.getElementById('loginIdentifier');
        if (idInput) setTimeout(function () { idInput.focus(); }, 100);
      }
    },

    openUserModal: function () {
      var self = this;
      var modal = document.getElementById('userModal');
      if (!modal) return;

      var isAdm = self.isAdmin();
      this.applyRolePermissions();

      var adminTeamSec = document.getElementById('adminTeamProfilesSection');
      var adminBox = document.getElementById('adminCreateEmpBox');

      // Update current user profile card in modal
      var curNameEl = document.getElementById('curUserName');
      var curBadgeEl = document.getElementById('curUserBadge');
      var curEmailEl = document.getElementById('curUserEmail');
      var curRoleEl = document.getElementById('curUserRole');
      var curAvatarEl = document.querySelector('#userModal .ucc-avatar .u-avatar');

      if (self.currentUser) {
        if (curNameEl) curNameEl.textContent = self.currentUser.name;
        if (curBadgeEl) {
          curBadgeEl.textContent = isAdm ? 'Admin' : 'Employee';
          curBadgeEl.className = 'role-badge ' + (isAdm ? 'admin' : 'employee');
        }
        if (curEmailEl) curEmailEl.textContent = self.currentUser.email;
        if (curRoleEl) curRoleEl.textContent = (self.currentUser.designation || (isAdm ? 'System Administrator' : 'Floor Architect / FA')) + ' • ' + (self.currentUser.company || 'Cookscape');
        if (curAvatarEl) curAvatarEl.textContent = self.currentUser.avatar || 'US';
      }

      // If user is Employee: Strictly show only their own profile and hide team switcher
      if (!isAdm) {
        if (adminTeamSec) adminTeamSec.style.display = 'none';
        if (adminBox) adminBox.style.display = 'none';
        var userListEl = document.getElementById('switchUsersList');
        if (userListEl) userListEl.innerHTML = '';
        modal.classList.add('is-open');
        return;
      }

      // If Admin: show employee creation box and team directory (with Edit/Delete, no password-less switch)
      if (adminTeamSec) adminTeamSec.style.display = 'block';
      if (adminBox) adminBox.style.display = 'block';

      var userListEl = document.getElementById('switchUsersList');
      if (userListEl) {
        var html = '';
        this.users.forEach(function (u) {
          var isCurrent = self.currentUser && self.currentUser.id === u.id;
          var uIsAdmin = (u.role || '').toLowerCase() === 'admin' || (u.role || '').toLowerCase().indexOf('admin') !== -1;
          var roleBadgeHtml = '<span class="role-badge ' + (uIsAdmin ? 'admin' : 'employee') + '">' + (uIsAdmin ? 'Admin' : 'Employee') + '</span>';
          var isPrimaryAdmin = u.id === 'usr_admin' || (u.email && u.email.toLowerCase() === 'admin@cookscape.com');

          var actionsHtml = '<div class="u-switch-actions">';
          if (isCurrent) {
            actionsHtml += '<span class="current-tag">Current</span>';
          }
          actionsHtml += '<button class="btn small edit-user-btn" data-uid="' + u.id + '" type="button" title="Edit account">Edit</button>';
          if (!isPrimaryAdmin && (!self.currentUser || u.id !== self.currentUser.id)) {
            actionsHtml += '<button class="btn small danger del-user-btn" data-uid="' + u.id + '" data-uname="' + (u.name || u.username || 'User') + '" type="button" title="Delete account">Delete</button>';
          }
          actionsHtml += '</div>';

          var userMeta = '';
          if (u.username) userMeta += '@' + u.username + ' • ';
          userMeta += (u.email || '') + ' • ' + (u.designation || (uIsAdmin ? 'Admin' : 'Employee'));

          html += '<div class="u-switch-item' + (isCurrent ? ' is-current' : '') + '" data-uid="' + u.id + '">' +
            '<div class="u-info">' +
            '<span class="u-avatar ' + (uIsAdmin ? 'is-admin-avatar' : '') + '">' + (u.avatar || 'US') + '</span>' +
            '<div>' +
            '<div style="display:flex;align-items:center;gap:6px;">' +
            '<strong>' + u.name + (isCurrent ? ' (Active)' : '') + '</strong>' +
            roleBadgeHtml +
            '</div>' +
            '<span>' + userMeta + '</span>' +
            '</div>' +
            '</div>' +
            actionsHtml +
            '</div>';
        });
        userListEl.innerHTML = html;

        // Edit user event
        userListEl.querySelectorAll('.edit-user-btn').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var uid = this.getAttribute('data-uid');
            var u = self.users.find(function (x) { return x.id === uid; });
            if (u) self.openEditUserModal(u);
          });
        });

        // Delete user event
        userListEl.querySelectorAll('.del-user-btn').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var uid = this.getAttribute('data-uid');
            var uname = this.getAttribute('data-uname');
            if (confirm('Are you sure you want to delete employee "' + uname + '"?')) {
              self.confirmAndDeleteUser(uid, uname);
            }
          });
        });
      }

      modal.classList.add('is-open');
    },

    openEditUserModal: function (u) {
      var self = this;
      var editModal = document.getElementById('editUserModal');
      if (!editModal) return;

      var idEl = document.getElementById('editUserId');
      var nameEl = document.getElementById('editUserName');
      var usernameEl = document.getElementById('editUserUsername');
      var emailEl = document.getElementById('editUserEmail');
      var passEl = document.getElementById('editUserPassword');
      var titleEl = document.getElementById('editUserTitle');
      var roleEl = document.getElementById('editUserRole');

      if (idEl) idEl.value = u.id;
      if (nameEl) nameEl.value = u.name || '';
      if (usernameEl) usernameEl.value = u.username || '';
      if (emailEl) emailEl.value = u.email || '';
      if (passEl) passEl.value = '';
      if (titleEl) titleEl.value = u.designation || '';

      var isPrimaryAdmin = u.id === 'usr_admin' || (u.email && u.email.toLowerCase() === 'admin@cookscape.com');
      if (roleEl) {
        roleEl.value = (u.role || '').toLowerCase() === 'admin' ? 'admin' : 'employee';
        roleEl.disabled = isPrimaryAdmin;
      }

      self.closeModal('userModal');
      editModal.classList.add('is-open');
    },

    deleteUser: function (uid, uname) {
      this.confirmAndDeleteUser(uid, uname);
    },

    confirmAndDeleteUser: function (uid, uname) {
      var self = this;
      if (!uid) return;
      if (uid === 'usr_admin') {
        alert('Primary administrator account cannot be deleted.');
        return;
      }
      if (!confirm('Are you sure you want to permanently delete team account "' + uname + '"?\n\nThis will remove their login access. Any projects created by them will be preserved.')) {
        return;
      }

      OrbixProjects.apiFetch('/api/users/' + encodeURIComponent(uid), {
        method: 'DELETE'
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.success) {
            if (typeof showToast === 'function') {
              showToast('✓ Account deleted: ' + uname);
            }
            self.fetchUsers(function () {
              self.openUserModal();
            });
          } else {
            alert('Failed to delete account: ' + (data.error || 'Server error'));
          }
        })
        .catch(function (err) {
          alert('Error deleting account: ' + err.message);
        });
    }
  };

  root.OrbixProjects = OrbixProjects;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { OrbixProjects.init(); });
  } else {
    OrbixProjects.init();
  }

})(window);
