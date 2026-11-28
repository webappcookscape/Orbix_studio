/* ═══════════════════════════════════════════════════════════════════════════════
   ORBIX STUDIO — Application Activity Logs Dashboard
   Strictly restricted to admin@cookscape.com
   Date-wise list view + Delete ONLY (No Edit)
   ═══════════════════════════════════════════════════════════════════════════════ */

(function (root) {
  'use strict';

  var PRIMARY_ADMIN_EMAIL = 'admin@cookscape.com';
  var CATEGORIES = ['All', 'Auth', 'Projects', 'Quotations', 'Client Portal', 'Users', 'Exports', 'Render', 'AI', 'System'];

  function esc(v) {
    return String(v === undefined || v === null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function isPrimaryLogsAdmin() {
    try {
      if (root.OrbixProjects && typeof root.OrbixProjects.isPrimaryLogsAdmin === 'function') {
        return root.OrbixProjects.isPrimaryLogsAdmin();
      }
      var u = root.OrbixProjects && root.OrbixProjects.currentUser;
      return !!(u && String(u.email || '').trim().toLowerCase() === PRIMARY_ADMIN_EMAIL);
    } catch (_) {
      return false;
    }
  }

  function toIstDateKey(d) {
    var safe = d instanceof Date && !isNaN(d.getTime()) ? d : new Date();
    try {
      var parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).formatToParts(safe);
      var y = '', m = '', day = '';
      for (var i = 0; i < parts.length; i++) {
        if (parts[i].type === 'year') y = parts[i].value;
        if (parts[i].type === 'month') m = parts[i].value;
        if (parts[i].type === 'day') day = parts[i].value;
      }
      if (y && m && day) return y + '-' + m + '-' + day;
    } catch (_) { }
    var ist = new Date(safe.getTime() + 5.5 * 60 * 60 * 1000);
    return ist.toISOString().slice(0, 10);
  }

  function shiftDateKey(dateKey, deltaDays) {
    var parts = String(dateKey || '').split('-');
    if (parts.length !== 3) return dateKey;
    var dt = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]) + Number(deltaDays || 0)));
    return dt.toISOString().slice(0, 10);
  }

  function fmtDateHeading(dateKey, todayKey) {
    if (!dateKey) return 'Unknown Date';
    var parts = String(dateKey).split('-');
    var label = dateKey;
    if (parts.length === 3) {
      var dt = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0));
      if (!isNaN(dt.getTime())) {
        try {
          label = dt.toLocaleDateString('en-IN', {
            weekday: 'long',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            timeZone: 'UTC'
          });
        } catch (_) { }
      }
    }
    var badge = '';
    if (todayKey && dateKey === todayKey) {
      badge = ' <span class="logs-day-badge is-today">Today</span>';
    } else if (todayKey && dateKey === shiftDateKey(todayKey, -1)) {
      badge = ' <span class="logs-day-badge">Yesterday</span>';
    }
    return esc(label) + badge;
  }

  function fmtDateChip(dateKey) {
    var parts = String(dateKey || '').split('-');
    if (parts.length !== 3) return dateKey;
    var dt = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0));
    if (isNaN(dt.getTime())) return dateKey;
    try {
      return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' });
    } catch (_) {
      return dateKey;
    }
  }

  function fmtTimeIST(iso) {
    if (!iso) return '—';
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return String(iso);
      return d.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    } catch (_) {
      return String(iso);
    }
  }

  function simplifyUA(ua) {
    if (!ua) return '';
    var s = String(ua);
    var device = /iPhone|Android.*Mobile|Mobile/i.test(s) ? 'Mobile' : (/iPad|Tablet/i.test(s) ? 'Tablet' : 'Desktop');
    var browser = /Edg\//i.test(s) ? 'Edge'
      : (/Chrome\//i.test(s) ? 'Chrome'
        : (/Safari\//i.test(s) ? 'Safari'
          : (/Firefox\//i.test(s) ? 'Firefox' : 'Browser')));
    return device + ' • ' + browser;
  }

  function catClass(cat) {
    var c = String(cat || 'System').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return 'logs-cat-' + c;
  }

  function methodClass(m) {
    var up = String(m || 'GET').toUpperCase();
    if (up === 'POST') return 'is-post';
    if (up === 'PUT' || up === 'PATCH') return 'is-put';
    if (up === 'DELETE') return 'is-delete';
    return 'is-get';
  }

  function statusClass(code) {
    var n = Number(code || 200);
    if (n >= 500) return 'is-err';
    if (n >= 400) return 'is-warn';
    return 'is-ok';
  }

  function getAuthHeaders() {
    var headers = { 'Content-Type': 'application/json' };
    try {
      var token = localStorage.getItem('orbix_auth_token');
      if (token) headers['Authorization'] = 'Bearer ' + token;
    } catch (_) { }
    return headers;
  }

  var OrbixLogs = {
    logs: [],
    dates: [],
    todayKey: toIstDateKey(new Date()),
    summary: { totalLogs: 0, todayCount: 0, authPortalCount: 0, alertDeleteCount: 0 },
    loading: false,
    loadedOnce: false,
    datePreset: 'all', // 'all' | 'today' | 'yesterday' | '7d' | 'exact'
    selectedDate: '',
    category: 'All',
    searchQuery: '',
    pageSize: 25,
    currentPage: 1,
    selectedIds: {},
    _bound: false,
    _fetchSeq: 0,

    reset: function () {
      this.logs = [];
      this.dates = [];
      this.selectedIds = {};
      this.loadedOnce = false;
      this.currentPage = 1;
    },

    init: function () {
      if (this._bound) return;
      this._bound = true;
      var self = this;

      var refreshBtn = document.getElementById('logsRefreshBtn');
      if (refreshBtn) {
        refreshBtn.addEventListener('click', function () {
          self.fetchLogs(true);
        });
      }

      var exportCsvBtn = document.getElementById('logsExportCsvBtn');
      if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', function () {
          self.exportCsv();
        });
      }

      var deleteSelectedBtn = document.getElementById('logsDeleteSelectedBtn');
      if (deleteSelectedBtn) {
        deleteSelectedBtn.addEventListener('click', function () {
          self.deleteSelected();
        });
      }

      var selectAllChk = document.getElementById('logsSelectAllPage');
      if (selectAllChk) {
        selectAllChk.addEventListener('change', function () {
          self.toggleSelectPage(!!selectAllChk.checked);
        });
      }

      var datePicker = document.getElementById('logsDatePicker');
      if (datePicker) {
        datePicker.addEventListener('change', function () {
          var val = String(datePicker.value || '').trim();
          if (val) {
            self.datePreset = 'exact';
            self.selectedDate = val;
          } else {
            self.datePreset = 'all';
            self.selectedDate = '';
          }
          self.currentPage = 1;
          self.selectedIds = {};
          self._syncPresetButtons();
          self.fetchLogs(true);
        });
      }

      document.querySelectorAll('.logs-preset-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var preset = btn.getAttribute('data-logs-preset') || 'all';
          self.datePreset = preset;
          if (preset === 'today') {
            self.selectedDate = self.todayKey || toIstDateKey(new Date());
          } else if (preset === 'yesterday') {
            self.selectedDate = shiftDateKey(self.todayKey || toIstDateKey(new Date()), -1);
          } else {
            self.selectedDate = '';
          }
          var dp = document.getElementById('logsDatePicker');
          if (dp) dp.value = (preset === 'today' || preset === 'yesterday') ? self.selectedDate : '';
          self.currentPage = 1;
          self.selectedIds = {};
          self._syncPresetButtons();
          self.fetchLogs(true);
        });
      });

      var searchInp = document.getElementById('logsSearchInput');
      var searchClr = document.getElementById('logsSearchClearBtn');
      if (searchInp) {
        var timer = null;
        var applySearch = function () {
          clearTimeout(timer);
          self.searchQuery = searchInp.value.trim();
          self.currentPage = 1;
          self.selectedIds = {};
          if (searchClr) searchClr.hidden = !self.searchQuery;
          self.fetchLogs(true);
        };
        searchInp.addEventListener('input', function () {
          if (searchClr) searchClr.hidden = !searchInp.value;
          clearTimeout(timer);
          timer = setTimeout(applySearch, 240);
        });
        searchInp.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); applySearch(); }
          if (e.key === 'Escape') {
            searchInp.value = '';
            applySearch();
          }
        });
        if (searchClr) {
          searchClr.addEventListener('click', function () {
            searchInp.value = '';
            applySearch();
            searchInp.focus();
          });
        }
      }

      var clearFiltersBtn = document.getElementById('logsClearFiltersBtn');
      if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', function () {
          self.datePreset = 'all';
          self.selectedDate = '';
          self.category = 'All';
          self.searchQuery = '';
          self.currentPage = 1;
          self.selectedIds = {};
          var dp = document.getElementById('logsDatePicker');
          if (dp) dp.value = '';
          if (searchInp) searchInp.value = '';
          if (searchClr) searchClr.hidden = true;
          self._syncPresetButtons();
          self._renderCategoryPills();
          self.fetchLogs(true);
        });
      }

      this._renderCategoryPills();

      // Delegated clicks for date pills, row delete, day delete, checkboxes, pagination
      var viewEl = document.getElementById('view-logs');
      if (viewEl) {
        viewEl.addEventListener('click', function (e) {
          var dateChip = e.target.closest('[data-logs-date-chip]');
          if (dateChip) {
            var dk = dateChip.getAttribute('data-logs-date-chip') || '';
            if (self.selectedDate === dk && self.datePreset === 'exact') {
              self.datePreset = 'all';
              self.selectedDate = '';
            } else {
              self.datePreset = 'exact';
              self.selectedDate = dk;
            }
            var dp = document.getElementById('logsDatePicker');
            if (dp) dp.value = self.selectedDate;
            self.currentPage = 1;
            self.selectedIds = {};
            self._syncPresetButtons();
            self.fetchLogs(true);
            return;
          }

          var catBtn = e.target.closest('[data-logs-cat]');
          if (catBtn) {
            self.category = catBtn.getAttribute('data-logs-cat') || 'All';
            self.currentPage = 1;
            self.selectedIds = {};
            self._renderCategoryPills();
            self.fetchLogs(true);
            return;
          }

          var delRowBtn = e.target.closest('[data-logs-delete-id]');
          if (delRowBtn) {
            var id = delRowBtn.getAttribute('data-logs-delete-id');
            if (id) self.deleteSingle(id);
            return;
          }

          var delDayBtn = e.target.closest('[data-logs-delete-date]');
          if (delDayBtn) {
            var dayKey = delDayBtn.getAttribute('data-logs-delete-date');
            if (dayKey) self.deleteByDate(dayKey);
            return;
          }

          var pageBtn = e.target.closest('[data-logs-page]');
          if (pageBtn && !pageBtn.disabled) {
            var p = parseInt(pageBtn.getAttribute('data-logs-page'), 10);
            if (!isNaN(p) && p >= 1) {
              self.currentPage = p;
              self.render();
              var scroller = document.getElementById('view-logs');
              if (scroller) scroller.scrollTop = 0;
            }
            return;
          }
        });

        viewEl.addEventListener('change', function (e) {
          var rowChk = e.target.closest('[data-logs-select-id]');
          if (rowChk) {
            var id = rowChk.getAttribute('data-logs-select-id');
            if (rowChk.checked) self.selectedIds[id] = true;
            else delete self.selectedIds[id];
            self._syncBulkBar();
          }
        });
      }
    },

    onViewShown: function () {
      this.init();
      if (!isPrimaryLogsAdmin()) {
        if (typeof root.showToast === 'function') {
          root.showToast('Access restricted: Activity Logs are available only for admin@cookscape.com');
        }
        if (root.OrbixRouter && typeof root.OrbixRouter.navigateTo === 'function') {
          root.OrbixRouter.navigateTo('home', true);
        }
        return;
      }
      this.fetchLogs(true);
    },

    _syncPresetButtons: function () {
      var self = this;
      document.querySelectorAll('.logs-preset-btn').forEach(function (btn) {
        var preset = btn.getAttribute('data-logs-preset') || 'all';
        btn.classList.toggle('is-active', self.datePreset === preset);
      });
    },

    _renderCategoryPills: function () {
      var wrap = document.getElementById('logsCategoryPills');
      if (!wrap) return;
      var self = this;
      wrap.innerHTML = CATEGORIES.map(function (c) {
        var active = self.category.toLowerCase() === c.toLowerCase();
        return '<button type="button" class="logs-cat-filter-btn' + (active ? ' is-active' : '') + '" data-logs-cat="' + esc(c) + '">' + esc(c) + '</button>';
      }).join('');
    },

    _buildQueryUrl: function () {
      var params = ['limit=500'];
      var today = this.todayKey || toIstDateKey(new Date());
      if (this.datePreset === 'today') {
        params.push('date=' + encodeURIComponent(today));
      } else if (this.datePreset === 'yesterday') {
        params.push('date=' + encodeURIComponent(shiftDateKey(today, -1)));
      } else if (this.datePreset === '7d') {
        params.push('from=' + encodeURIComponent(shiftDateKey(today, -6)));
        params.push('to=' + encodeURIComponent(today));
      } else if (this.datePreset === 'exact' && this.selectedDate) {
        params.push('date=' + encodeURIComponent(this.selectedDate));
      }
      if (this.category && this.category !== 'All') {
        params.push('category=' + encodeURIComponent(this.category));
      }
      if (this.searchQuery) {
        params.push('search=' + encodeURIComponent(this.searchQuery));
      }
      return '/api/logs?' + params.join('&');
    },

    fetchLogs: function (force) {
      if (!isPrimaryLogsAdmin()) return Promise.resolve();
      if (this.loading && !force) return Promise.resolve();
      var self = this;
      var seq = ++this._fetchSeq;
      this.loading = true;

      var listEl = document.getElementById('logsListContainer');
      if (listEl && !this.loadedOnce) {
        listEl.innerHTML = '<div class="qh-empty-box">Loading activity logs...</div>';
      }

      return fetch(this._buildQueryUrl(), {
        method: 'GET',
        headers: getAuthHeaders(),
        credentials: 'same-origin'
      })
        .then(function (r) {
          if (r.status === 403) {
            throw new Error('Access restricted to admin@cookscape.com');
          }
          if (!r.ok) {
            throw new Error('Failed to load logs (HTTP ' + r.status + ')');
          }
          return r.json();
        })
        .then(function (data) {
          if (seq !== self._fetchSeq) return;
          self.loading = false;
          self.loadedOnce = true;
          self.logs = Array.isArray(data && data.logs) ? data.logs : [];
          self.dates = Array.isArray(data && data.dates) ? data.dates : [];
          if (data && data.todayKey) self.todayKey = data.todayKey;
          if (data && data.summary) self.summary = data.summary;
          // Prune selectedIds to still-existing ids
          var valid = {};
          self.logs.forEach(function (l) {
            if (self.selectedIds[l.id]) valid[l.id] = true;
          });
          self.selectedIds = valid;
          self.render();
        })
        .catch(function (err) {
          if (seq !== self._fetchSeq) return;
          self.loading = false;
          if (listEl) {
            listEl.innerHTML = '<div class="qh-empty-box" style="color:#B91C1C;">' + esc(err && err.message ? err.message : 'Unable to load activity logs.') + '</div>';
          }
        });
    },

    _getCurrentPageSlice: function () {
      var total = this.logs.length;
      var totalPages = Math.max(1, Math.ceil(total / this.pageSize));
      if (this.currentPage > totalPages) this.currentPage = totalPages;
      if (this.currentPage < 1) this.currentPage = 1;
      var start = (this.currentPage - 1) * this.pageSize;
      return {
        items: this.logs.slice(start, start + this.pageSize),
        start: start,
        total: total,
        totalPages: totalPages
      };
    },

    _syncBulkBar: function () {
      var count = Object.keys(this.selectedIds).length;
      var delBtn = document.getElementById('logsDeleteSelectedBtn');
      if (delBtn) {
        delBtn.disabled = count === 0;
        delBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path></svg>' +
          '<span>Delete Selected' + (count > 0 ? ' (' + count + ')' : '') + '</span>';
      }
      var slice = this._getCurrentPageSlice();
      var selectAllChk = document.getElementById('logsSelectAllPage');
      if (selectAllChk) {
        var pageCount = slice.items.length;
        var selectedOnPage = slice.items.filter(function (l) { return !!OrbixLogs.selectedIds[l.id]; }).length;
        selectAllChk.checked = pageCount > 0 && selectedOnPage === pageCount;
        selectAllChk.indeterminate = selectedOnPage > 0 && selectedOnPage < pageCount;
      }
    },

    toggleSelectPage: function (checked) {
      var slice = this._getCurrentPageSlice();
      var self = this;
      slice.items.forEach(function (l) {
        if (checked) self.selectedIds[l.id] = true;
        else delete self.selectedIds[l.id];
      });
      document.querySelectorAll('#logsListContainer [data-logs-select-id]').forEach(function (chk) {
        var id = chk.getAttribute('data-logs-select-id');
        chk.checked = !!self.selectedIds[id];
      });
      this._syncBulkBar();
    },

    deleteSingle: function (id) {
      if (!isPrimaryLogsAdmin() || !id) return;
      if (typeof root.confirm === 'function' && !root.confirm('Delete this activity log permanently?')) return;
      var self = this;
      fetch('/api/logs/' + encodeURIComponent(id), {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'same-origin'
      })
        .then(function (r) {
          if (!r.ok) throw new Error('Delete failed (HTTP ' + r.status + ')');
          return r.json();
        })
        .then(function () {
          delete self.selectedIds[id];
          if (typeof root.showToast === 'function') root.showToast('Log deleted.');
          self.fetchLogs(true);
        })
        .catch(function (err) {
          if (typeof root.showToast === 'function') root.showToast(err.message || 'Could not delete log.');
        });
    },

    deleteSelected: function () {
      if (!isPrimaryLogsAdmin()) return;
      var ids = Object.keys(this.selectedIds);
      if (!ids.length) return;
      if (typeof root.confirm === 'function' && !root.confirm('Permanently delete ' + ids.length + ' selected log' + (ids.length === 1 ? '' : 's') + '?')) return;
      var self = this;
      fetch('/api/logs', {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'same-origin',
        body: JSON.stringify({ ids: ids })
      })
        .then(function (r) {
          if (!r.ok) throw new Error('Bulk delete failed (HTTP ' + r.status + ')');
          return r.json();
        })
        .then(function (res) {
          self.selectedIds = {};
          if (typeof root.showToast === 'function') {
            root.showToast('Deleted ' + (res && res.deleted !== undefined ? res.deleted : ids.length) + ' log(s).');
          }
          self.fetchLogs(true);
        })
        .catch(function (err) {
          if (typeof root.showToast === 'function') root.showToast(err.message || 'Could not delete selected logs.');
        });
    },

    deleteByDate: function (dateKey) {
      if (!isPrimaryLogsAdmin() || !dateKey) return;
      if (typeof root.confirm === 'function' && !root.confirm('Permanently delete ALL activity logs for ' + dateKey + '?')) return;
      var self = this;
      fetch('/api/logs?date=' + encodeURIComponent(dateKey), {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'same-origin'
      })
        .then(function (r) {
          if (!r.ok) throw new Error('Delete day failed (HTTP ' + r.status + ')');
          return r.json();
        })
        .then(function (res) {
          self.selectedIds = {};
          if (typeof root.showToast === 'function') {
            root.showToast('Deleted ' + (res && res.deleted !== undefined ? res.deleted : 0) + ' log(s) for ' + dateKey + '.');
          }
          self.fetchLogs(true);
        })
        .catch(function (err) {
          if (typeof root.showToast === 'function') root.showToast(err.message || 'Could not delete logs for ' + dateKey);
        });
    },

    exportCsv: function () {
      if (!this.logs.length) {
        if (typeof root.showToast === 'function') root.showToast('No logs to export for the current filter.');
        return;
      }
      var headers = ['Date (IST)', 'Time (IST)', 'Category', 'Action', 'Summary', 'Method', 'Path', 'Status', 'Duration (ms)', 'Actor Name', 'Actor Email', 'Actor Role', 'IP', 'Device'];
      var csvEsc = function (v) {
        var s = String(v === undefined || v === null ? '' : v);
        if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
        return s;
      };
      var rows = [headers.join(',')];
      this.logs.forEach(function (l) {
        rows.push([
          l.dateKey,
          fmtTimeIST(l.createdAt),
          l.category,
          l.action,
          l.summary,
          l.method,
          l.path,
          l.statusCode,
          l.durationMs,
          l.actorName || '',
          l.actorEmail || '',
          l.actorRole || '',
          l.ip || '',
          simplifyUA(l.userAgent)
        ].map(csvEsc).join(','));
      });
      var blob = new Blob([rows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'orbix-activity-logs-' + (this.selectedDate || this.todayKey || 'all') + '.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    },

    render: function () {
      var s = this.summary || {};
      var setTxt = function (id, val) {
        var el = document.getElementById(id);
        if (el) el.textContent = String(val);
      };
      setTxt('logsTotalBadge', this.logs.length + (this.logs.length === 1 ? ' log' : ' logs'));
      setTxt('logsKpiTotal', s.totalLogs || 0);
      setTxt('logsKpiToday', s.todayCount || 0);
      setTxt('logsKpiAuth', s.authPortalCount || 0);
      setTxt('logsKpiAlerts', s.alertDeleteCount || 0);

      // Clear filters button visibility
      var hasActiveFilter = (this.datePreset !== 'all') || (this.category !== 'All') || !!this.searchQuery;
      var clearBtn = document.getElementById('logsClearFiltersBtn');
      if (clearBtn) clearBtn.hidden = !hasActiveFilter;

      // Render clickable date-wise pill strip
      var stripEl = document.getElementById('logsDateStrip');
      if (stripEl) {
        if (!this.dates.length) {
          stripEl.innerHTML = '<span class="logs-date-empty">No dates recorded yet</span>';
        } else {
          var self = this;
          stripEl.innerHTML = this.dates.slice(0, 21).map(function (d) {
            var active = (self.datePreset === 'exact' && self.selectedDate === d.dateKey) ||
              (self.datePreset === 'today' && d.dateKey === self.todayKey) ||
              (self.datePreset === 'yesterday' && d.dateKey === shiftDateKey(self.todayKey, -1));
            var dayLabel = d.dateKey === self.todayKey ? ('Today · ' + fmtDateChip(d.dateKey)) : fmtDateChip(d.dateKey);
            return '<button type="button" class="logs-date-pill' + (active ? ' is-active' : '') + '" data-logs-date-chip="' + esc(d.dateKey) + '" title="Show logs for ' + esc(d.dateKey) + '">' +
              '<span>' + esc(dayLabel) + '</span>' +
              '<span class="logs-date-pill-cnt">' + Number(d.count || 0) + '</span>' +
              '</button>';
          }).join('');
        }
      }

      var slice = this._getCurrentPageSlice();
      var rangeEl = document.getElementById('logsRangeSummary');
      if (rangeEl) {
        if (slice.total === 0) {
          rangeEl.textContent = '0 logs matching filter';
        } else {
          var endIdx = Math.min(slice.start + slice.items.length, slice.total);
          rangeEl.textContent = 'Showing ' + (slice.start + 1) + '–' + endIdx + ' of ' + slice.total + ' logs';
        }
      }

      var listEl = document.getElementById('logsListContainer');
      if (listEl) {
        if (!slice.items.length) {
          listEl.innerHTML = '<div class="qh-empty-box">No activity logs found for the selected date or filter.</div>';
        } else {
          // Group current page items date-wise (preserving order)
          var groups = [];
          var groupMap = {};
          var dateTotalLookup = {};
          this.dates.forEach(function (d) { dateTotalLookup[d.dateKey] = Number(d.count || 0); });

          slice.items.forEach(function (log) {
            var dk = log.dateKey || toIstDateKey(log.createdAt);
            if (!groupMap[dk]) {
              groupMap[dk] = { dateKey: dk, items: [] };
              groups.push(groupMap[dk]);
            }
            groupMap[dk].items.push(log);
          });

          var self = this;
          listEl.innerHTML = groups.map(function (g) {
            var dayTotal = dateTotalLookup[g.dateKey] || g.items.length;
            var rowsHtml = g.items.map(function (l) {
              var checked = !!self.selectedIds[l.id];
              var actorName = l.actorName || (l.category === 'Client Portal' ? 'Client Portal Visitor' : 'System / Guest');
              var actorInitials = String(actorName).trim().slice(0, 2).toUpperCase() || 'SY';
              var actorMeta = [l.actorEmail, l.actorRole ? l.actorRole.toUpperCase() : ''].filter(Boolean).join(' • ');
              var deviceStr = simplifyUA(l.userAgent);
              var netMeta = [l.ip, deviceStr].filter(Boolean).join(' • ');

              return '<div class="logs-row' + (l.statusCode >= 400 ? ' is-error-row' : '') + (l.method === 'DELETE' ? ' is-delete-row' : '') + '" data-log-id="' + esc(l.id) + '">' +
                '<div class="logs-col-chk">' +
                  '<input type="checkbox" class="logs-row-chk" data-logs-select-id="' + esc(l.id) + '"' + (checked ? ' checked' : '') + ' aria-label="Select log">' +
                '</div>' +
                '<div class="logs-col-time">' +
                  '<span class="logs-time-val">' + esc(fmtTimeIST(l.createdAt)) + '</span>' +
                  '<span class="logs-cat-badge ' + catClass(l.category) + '">' + esc(l.category) + '</span>' +
                '</div>' +
                '<div class="logs-col-main">' +
                  '<div class="logs-summary-line">' +
                    '<strong class="logs-summary-text">' + esc(l.summary || l.action) + '</strong>' +
                  '</div>' +
                  '<div class="logs-tech-line">' +
                    '<span class="logs-method-pill ' + methodClass(l.method) + '">' + esc(l.method) + '</span>' +
                    '<span class="logs-status-pill ' + statusClass(l.statusCode) + '">' + esc(l.statusCode) + '</span>' +
                    '<code class="logs-path-code">' + esc(l.path) + '</code>' +
                    (l.durationMs ? '<span class="logs-dur">' + esc(l.durationMs) + ' ms</span>' : '') +
                  '</div>' +
                '</div>' +
                '<div class="logs-col-actor">' +
                  '<span class="logs-actor-av">' + esc(actorInitials) + '</span>' +
                  '<div class="logs-actor-info">' +
                    '<div class="logs-actor-name">' + esc(actorName) + '</div>' +
                    (actorMeta ? '<div class="logs-actor-sub">' + esc(actorMeta) + '</div>' : '') +
                    (netMeta ? '<div class="logs-actor-net">' + esc(netMeta) + '</div>' : '') +
                  '</div>' +
                '</div>' +
                '<div class="logs-col-actions">' +
                  '<button type="button" class="logs-del-btn" data-logs-delete-id="' + esc(l.id) + '" title="Delete this log">' +
                    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path></svg>' +
                    '<span>Delete</span>' +
                  '</button>' +
                '</div>' +
              '</div>';
            }).join('');

            return '<div class="logs-group">' +
              '<div class="logs-group-head">' +
                '<div class="logs-group-title">' +
                  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>' +
                  '<span>' + fmtDateHeading(g.dateKey, self.todayKey) + '</span>' +
                  '<span class="logs-group-cnt">' + dayTotal + (dayTotal === 1 ? ' event' : ' events') + '</span>' +
                '</div>' +
                '<button type="button" class="logs-del-day-btn" data-logs-delete-date="' + esc(g.dateKey) + '" title="Delete all logs for ' + esc(g.dateKey) + '">' +
                  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path></svg>' +
                  '<span>Delete Day</span>' +
                '</button>' +
              '</div>' +
              '<div class="logs-group-rows">' + rowsHtml + '</div>' +
            '</div>';
          }).join('');
        }
      }

      // Pagination
      var pagEl = document.getElementById('logsPagination');
      if (pagEl) {
        if (slice.totalPages <= 1) {
          pagEl.hidden = true;
          pagEl.innerHTML = '';
        } else {
          pagEl.hidden = false;
          var btns = [];
          btns.push('<button type="button" class="ppage-btn" data-logs-page="' + (this.currentPage - 1) + '"' + (this.currentPage <= 1 ? ' disabled' : '') + '>&lsaquo; Prev</button>');
          var startP = Math.max(1, this.currentPage - 2);
          var endP = Math.min(slice.totalPages, startP + 4);
          startP = Math.max(1, endP - 4);
          for (var p = startP; p <= endP; p++) {
            btns.push('<button type="button" class="ppage-btn' + (p === this.currentPage ? ' is-active' : '') + '" data-logs-page="' + p + '">' + p + '</button>');
          }
          btns.push('<button type="button" class="ppage-btn" data-logs-page="' + (this.currentPage + 1) + '"' + (this.currentPage >= slice.totalPages ? ' disabled' : '') + '>Next &rsaquo;</button>');
          pagEl.innerHTML = '<div class="ppagination-info">Page ' + this.currentPage + ' of ' + slice.totalPages + '</div><div class="ppagination-btns">' + btns.join('') + '</div>';
        }
      }

      this._syncBulkBar();
    }
  };

  root.OrbixLogs = OrbixLogs;
})(typeof window !== 'undefined' ? window : this);
