/* ═══════════════════════════════════════════════════════════════════════════════
   ORBIX STUDIO — Quote History Dashboard (User Details, BH Details,
   Generated History & Opened History with Full Audit Timeline)
   ═══════════════════════════════════════════════════════════════════════════════ */

(function (root) {
  'use strict';

  function esc(v) {
    return String(v === undefined || v === null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fmtDateTime(iso) {
    if (!iso) return '—';
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return String(iso);
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (_) {
      return String(iso);
    }
  }

  function fmtINR(v) {
    var n = Math.round(Number(v || 0));
    return '₹ ' + n.toLocaleString('en-IN');
  }

  function formatEventLabel(evName) {
    var map = {
      review_link_created: 'Head Review Link Generated',
      head_approved: 'Approved by Head / BH',
      client_link_activated: 'Client Link Generated / Activated',
      login_success: 'Client Opened & Logged In',
      login_failed: 'Failed Client Login Attempt',
      whatsapp_alert: 'WhatsApp Open Alert Sent',
      portal_view: 'Client Viewed Quotation',
      slide_change: 'Slide Viewed',
      print_attempt: 'Print Attempt Blocked',
      copy_attempt: 'Copy Attempt Blocked',
      blur_shield: 'Tab / Window Switch Detected'
    };
    return map[evName] || String(evName || 'Activity').replace(/_/g, ' ');
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

  var OrbixQuoteHistory = {
    quotes: [],
    summary: null,
    loading: false,
    loadedOnce: false,
    statusFilter: 'all',
    bhFilter: '',
    userFilter: '',
    searchQuery: '',
    pageSize: 10,
    currentPage: 1,
    _bound: false,

    init: function () {
      if (this._bound) return;
      this._bound = true;
      var self = this;

      var refreshBtn = document.getElementById('qhRefreshBtn');
      if (refreshBtn) {
        refreshBtn.addEventListener('click', function () {
          self.fetchHistory(true);
        });
      }

      var exportCsvBtn = document.getElementById('qhExportCsvBtn');
      if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', function () {
          self.exportFilteredCsv();
        });
      }

      // Status scope filter tabs
      document.querySelectorAll('.qh-status-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          document.querySelectorAll('.qh-status-btn').forEach(function (b) { b.classList.remove('is-active'); });
          btn.classList.add('is-active');
          self.statusFilter = btn.getAttribute('data-qh-status') || 'all';
          self.currentPage = 1;
          self.render();
        });
      });

      // Search input + clear
      var searchInp = document.getElementById('qhSearchInput');
      var searchClr = document.getElementById('qhSearchClearBtn');
      if (searchInp) {
        var timer = null;
        var applySearch = function () {
          clearTimeout(timer);
          self.searchQuery = searchInp.value.trim();
          self.currentPage = 1;
          if (searchClr) searchClr.hidden = !self.searchQuery;
          self.render();
        };
        searchInp.addEventListener('input', function () {
          if (searchClr) searchClr.hidden = !searchInp.value.trim();
          clearTimeout(timer);
          timer = setTimeout(applySearch, 70);
        });
        searchInp.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            applySearch();
          } else if (e.key === 'Escape' && searchInp.value) {
            e.stopPropagation();
            searchInp.value = '';
            applySearch();
          }
        });
      }
      if (searchClr && searchInp) {
        searchClr.addEventListener('click', function () {
          searchInp.value = '';
          self.searchQuery = '';
          self.currentPage = 1;
          searchClr.hidden = true;
          self.render();
          searchInp.focus();
        });
      }

      // BH & User Dropdowns
      var bhBtn = document.getElementById('qhBhFilterBtn');
      var bhMenu = document.getElementById('qhBhFilterMenu');
      var bhClear = document.getElementById('qhBhFilterClear');
      var bhSearch = document.getElementById('qhBhFilterSearch');
      var userBtn = document.getElementById('qhUserFilterBtn');
      var userMenu = document.getElementById('qhUserFilterMenu');
      var userClear = document.getElementById('qhUserFilterClear');
      var userSearch = document.getElementById('qhUserFilterSearch');
      var resetBtn = document.getElementById('qhClearFiltersBtn');

      if (bhBtn && bhMenu) {
        bhBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          var open = bhMenu.hidden;
          self._closeMenus();
          if (open) {
            self._updateFilterMenus();
            bhMenu.hidden = false;
            bhBtn.classList.add('is-open');
            bhBtn.setAttribute('aria-expanded', 'true');
            if (bhSearch) {
              bhSearch.value = '';
              setTimeout(function () { bhSearch.focus(); }, 20);
            }
          }
        });
        bhMenu.addEventListener('click', function (e) { e.stopPropagation(); });
      }
      if (bhClear) {
        bhClear.addEventListener('click', function (e) {
          e.stopPropagation();
          self.bhFilter = '';
          self.currentPage = 1;
          self._closeMenus();
          self.render();
        });
      }
      if (bhSearch) {
        bhSearch.addEventListener('input', function () {
          self._renderMenuList(
            document.getElementById('qhBhFilterList'),
            self._bhItems || [],
            self.bhFilter,
            'All BHs',
            self._bhTotal || 0,
            function (val) {
              self.bhFilter = val;
              self.currentPage = 1;
              self._closeMenus();
              self.render();
            },
            bhSearch.value
          );
        });
      }

      if (userBtn && userMenu) {
        userBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          var open = userMenu.hidden;
          self._closeMenus();
          if (open) {
            self._updateFilterMenus();
            userMenu.hidden = false;
            userBtn.classList.add('is-open');
            userBtn.setAttribute('aria-expanded', 'true');
            if (userSearch) {
              userSearch.value = '';
              setTimeout(function () { userSearch.focus(); }, 20);
            }
          }
        });
        userMenu.addEventListener('click', function (e) { e.stopPropagation(); });
      }
      if (userClear) {
        userClear.addEventListener('click', function (e) {
          e.stopPropagation();
          self.userFilter = '';
          self.currentPage = 1;
          self._closeMenus();
          self.render();
        });
      }
      if (userSearch) {
        userSearch.addEventListener('input', function () {
          self._renderMenuList(
            document.getElementById('qhUserFilterList'),
            self._userItems || [],
            self.userFilter,
            'All Users',
            self._userTotal || 0,
            function (val) {
              self.userFilter = val;
              self.currentPage = 1;
              self._closeMenus();
              self.render();
            },
            userSearch.value
          );
        });
      }

      if (resetBtn) {
        resetBtn.addEventListener('click', function () {
          self.clearFilters(true);
        });
      }

      // Close menus & timeline modal
      document.addEventListener('click', function () { self._closeMenus(); });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          self._closeMenus();
          self.closeTimelineModal();
        }
      });

      var modal = document.getElementById('quoteHistoryTimelineModal');
      if (modal) {
        modal.querySelectorAll('.modal-close-btn, .modal-backdrop').forEach(function (el) {
          el.addEventListener('click', function () { self.closeTimelineModal(); });
        });
      }
    },

    onViewShown: function () {
      this.init();
      this.fetchHistory(!this.loadedOnce);
    },

    _closeMenus: function () {
      [['qhBhFilterMenu', 'qhBhFilterBtn'], ['qhUserFilterMenu', 'qhUserFilterBtn']].forEach(function (pair) {
        var m = document.getElementById(pair[0]);
        var b = document.getElementById(pair[1]);
        if (m) m.hidden = true;
        if (b) {
          b.classList.remove('is-open');
          b.setAttribute('aria-expanded', 'false');
        }
      });
    },

    clearFilters: function (resetStatus) {
      this.bhFilter = '';
      this.userFilter = '';
      this.searchQuery = '';
      this.currentPage = 1;
      var sInp = document.getElementById('qhSearchInput');
      if (sInp) sInp.value = '';
      var sClr = document.getElementById('qhSearchClearBtn');
      if (sClr) sClr.hidden = true;
      if (resetStatus) {
        this.statusFilter = 'all';
        document.querySelectorAll('.qh-status-btn').forEach(function (b) {
          b.classList.toggle('is-active', b.getAttribute('data-qh-status') === 'all');
        });
      }
      this._closeMenus();
      this.render();
    },

    fetchHistory: function (showLoader) {
      var self = this;
      this.init();
      this.loading = true;
      var listEl = document.getElementById('qhCardsList');
      var refreshBtn = document.getElementById('qhRefreshBtn');
      if (refreshBtn) {
        refreshBtn.disabled = true;
        refreshBtn.textContent = 'Refreshing...';
      }
      if (showLoader && listEl && !this.quotes.length) {
        listEl.innerHTML = '<div class="qh-empty-box">Loading quote history from database...</div>';
      }

      var apiFn = (root.OrbixProjects && typeof root.OrbixProjects.apiFetch === 'function')
        ? function (u, o) { return root.OrbixProjects.apiFetch(u, o); }
        : function (u, o) { return fetch(u, Object.assign({ credentials: 'include' }, o || {})); };

      apiFn('/api/client-quotes/history', { timeoutMs: 15000 })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        })
        .then(function (data) {
          self.loading = false;
          self.loadedOnce = true;
          self.quotes = (data && Array.isArray(data.quotes)) ? data.quotes : [];
          self.summary = (data && data.summary) ? data.summary : null;
          self.render();
        })
        .catch(function (err) {
          self.loading = false;
          console.warn('[OrbixQuoteHistory] Failed to fetch history:', err && err.message ? err.message : err);
          if (listEl && !self.quotes.length) {
            listEl.innerHTML = '<div class="qh-empty-box">Unable to load quote history (' + esc(err && err.message || 'Network error') + '). Click Refresh to retry.</div>';
          }
        })
        .then(function () {
          if (refreshBtn) {
            refreshBtn.disabled = false;
            refreshBtn.textContent = '↻ Refresh';
          }
        });
    },

    exportFilteredCsv: function () {
      var self = this;
      var rows = (this.quotes || []).filter(function (q) { return self._matches(q); });
      if (!rows.length) {
        if (typeof showToast === 'function') showToast('No quote history rows to export.');
        return;
      }
      var csvEsc = function (v) {
        var s = String(v === undefined || v === null ? '' : v);
        return '"' + s.replace(/"/g, '""') + '"';
      };
      var headers = [
        'Quote Code', 'Client Name', 'Client Phone', 'Location', 'Status', 'Variants',
        'User Name', 'User Role', 'User Phone', 'User Email',
        'BH Name', 'BH Phone', 'BH Email', 'Approved By',
        'Review Created At', 'Approved At', 'Client Link Generated At',
        'Opened Count', 'First Opened At', 'Last Opened At', 'Failed Logins', 'Client Link URL'
      ];
      var lines = [headers.map(csvEsc).join(',')];
      rows.forEach(function (q) {
        var ud = q.userDetails || {};
        var bh = q.bhDetails || {};
        var gh = q.generatedHistory || {};
        var oh = q.openedHistory || {};
        var vars = (q.variantSummaries || []).map(function (v) {
          return (v.tierTitle || v.tierKey) + ' (' + fmtINR(v.grandTotal) + ')';
        }).join(' | ');
        lines.push([
          q.quoteCode || '', q.clientName || '', q.clientPhone || '', q.siteAddress || '', q.statusBadge || '', vars,
          ud.name || '', ud.designation || '', ud.phone || '', ud.email || '',
          bh.name || '', bh.phone || '', bh.email || '', bh.approvedBy || '',
          fmtDateTime(gh.reviewCreatedAt), fmtDateTime(gh.approvedAt), fmtDateTime(gh.clientLinkGeneratedAt),
          oh.viewCount || 0, fmtDateTime(oh.firstOpenedAt), fmtDateTime(oh.lastOpenedAt), oh.failedLoginCount || 0,
          q.shareUrl || q.reviewUrl || ''
        ].map(csvEsc).join(','));
      });
      var blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'Cookscape_Quote_History_' + new Date().toISOString().slice(0, 10) + '.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    },

    downloadApprovedExport: function (quoteId, kind, btnEl) {
      var apiFn = (root.OrbixProjects && typeof root.OrbixProjects.apiFetch === 'function')
        ? function (u, o) { return root.OrbixProjects.apiFetch(u, o); }
        : function (u, o) { return fetch(u, Object.assign({ credentials: 'include' }, o || {})); };
      var origTxt = btnEl ? btnEl.textContent : '';
      if (btnEl) {
        btnEl.disabled = true;
        btnEl.textContent = kind === 'pdf' ? 'PDF...' : 'PPTX...';
      }
      var endpoint = '/api/client-quotes/' + encodeURIComponent(quoteId) + (kind === 'pdf' ? '/export-pdf' : '/export-pptx');
      apiFn(endpoint, { method: 'POST', timeoutMs: 60000 })
        .then(function (r) {
          if (!r.ok) return r.json().catch(function () { return {}; }).then(function (d) { throw new Error(d.error || ('Export failed (' + r.status + ')')); });
          var disp = r.headers.get('Content-Disposition') || '';
          var m = disp.match(/filename="([^"]+)"/i);
          var fname = m ? m[1] : ('Quotation.' + kind);
          return r.blob().then(function (blob) { return { blob: blob, fname: fname }; });
        })
        .then(function (res) {
          var url = URL.createObjectURL(res.blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = res.fname;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
        })
        .catch(function (err) {
          if (typeof showToast === 'function') showToast('Export error: ' + (err && err.message || 'Failed'));
        })
        .then(function () {
          if (btnEl) {
            btnEl.disabled = false;
            btnEl.textContent = origTxt;
          }
        });
    },

    _matches: function (q, opts) {
      opts = opts || {};
      var st = opts.ignoreStatus ? 'all' : (this.statusFilter || 'all');
      var opened = !!(q.openedHistory && q.openedHistory.isOpened);
      if (st === 'opened' && !opened) return false;
      if (st === 'unopened' && opened) return false;
      if (st === 'pending' && q.statusBadge !== 'pending_approval') return false;
      if (st === 'active' && q.statusBadge !== 'active' && q.statusBadge !== 'approved') return false;

      if (!opts.ignoreBh && this.bhFilter) {
        var bhName = String((q.bhDetails && q.bhDetails.name) || 'Unassigned').trim();
        if (bhName.toLowerCase() !== this.bhFilter.toLowerCase()) return false;
      }

      if (!opts.ignoreUser && this.userFilter) {
        var uName = String((q.userDetails && q.userDetails.name) || '').trim();
        if (uName.toLowerCase() !== this.userFilter.toLowerCase()) return false;
      }

      var search = opts.ignoreSearch ? '' : String(this.searchQuery || '').trim().toLowerCase();
      if (search) {
        var ud = q.userDetails || {};
        var bh = q.bhDetails || {};
        var hay = [
          q.quoteCode,
          q.title,
          q.projectTitle,
          q.clientName,
          q.clientPhone,
          q.clientEmail,
          q.siteAddress,
          ud.name,
          ud.email,
          ud.phone,
          ud.designation,
          bh.name,
          bh.phone,
          bh.email,
          bh.approvedBy,
          (q.selectedTiers || []).join(' '),
          q.statusBadge
        ].filter(Boolean).join(' ').toLowerCase();
        var hayCompact = hay.replace(/[^a-z0-9]+/g, '');
        var tokens = search.split(/\s+/).filter(Boolean);
        for (var i = 0; i < tokens.length; i++) {
          var tok = tokens[i];
          var tokClean = tok.replace(/[^a-z0-9]+/g, '');
          if (hay.indexOf(tok) === -1 && (!tokClean || hayCompact.indexOf(tokClean) === -1)) {
            return false;
          }
        }
      }
      return true;
    },

    _renderMenuList: function (listEl, items, selectedVal, allLabel, allCount, onSelect, searchTerm) {
      if (!listEl) return;
      var q = String(searchTerm || '').trim().toLowerCase();
      var html = '';
      if (!q) {
        html += '<button type="button" class="pdropdown-item' + (!selectedVal ? ' is-selected' : '') + '" data-val="">' +
          '<span class="pdropdown-item-name">' + esc(allLabel) + '</span>' +
          '<span class="pdropdown-item-cnt">' + allCount + '</span>' +
          '</button>';
      }
      var shown = 0;
      items.forEach(function (it) {
        if (q && it.label.toLowerCase().indexOf(q) === -1) return;
        shown++;
        var isSel = selectedVal && selectedVal.toLowerCase() === it.value.toLowerCase();
        html += '<button type="button" class="pdropdown-item' + (isSel ? ' is-selected' : '') + '" data-val="' + esc(it.value) + '">' +
          '<span class="pdropdown-item-name">' + esc(it.label) + '</span>' +
          '<span class="pdropdown-item-cnt">' + it.count + '</span>' +
          '</button>';
      });
      if (!shown && q) {
        html = '<div class="pdropdown-empty">No matches for "' + esc(searchTerm) + '"</div>';
      }
      listEl.innerHTML = html;
      listEl.querySelectorAll('.pdropdown-item').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          onSelect(btn.getAttribute('data-val') || '');
        });
      });
    },

    _updateFilterMenus: function () {
      var self = this;
      var all = this.quotes || [];

      // Status counts
      var cntAll = 0, cntOpened = 0, cntUnopened = 0, cntPending = 0, cntActive = 0;
      all.forEach(function (q) {
        if (!self._matches(q, { ignoreStatus: true })) return;
        cntAll++;
        var isOp = !!(q.openedHistory && q.openedHistory.isOpened);
        if (isOp) cntOpened++; else cntUnopened++;
        if (q.statusBadge === 'pending_approval') cntPending++;
        if (q.statusBadge === 'active' || q.statusBadge === 'approved') cntActive++;
      });
      var setC = function (k, v) {
        var el = document.querySelector('[data-qh-count="' + k + '"]');
        if (el) el.textContent = String(v);
      };
      setC('all', cntAll);
      setC('opened', cntOpened);
      setC('unopened', cntUnopened);
      setC('pending', cntPending);
      setC('active', cntActive);

      // BH options
      var bhMap = {}, bhTotal = 0;
      all.forEach(function (q) {
        if (!self._matches(q, { ignoreBh: true })) return;
        bhTotal++;
        var name = String((q.bhDetails && q.bhDetails.name) || 'Unassigned').trim();
        var k = name.toLowerCase();
        if (!bhMap[k]) bhMap[k] = { value: name, label: name, count: 0 };
        bhMap[k].count++;
      });
      var bhItems = Object.keys(bhMap).map(function (k) { return bhMap[k]; }).sort(function (a, b) {
        return b.count !== a.count ? (b.count - a.count) : a.label.localeCompare(b.label);
      });
      this._bhItems = bhItems;
      this._bhTotal = bhTotal;

      // User options
      var uMap = {}, uTotal = 0;
      all.forEach(function (q) {
        if (!self._matches(q, { ignoreUser: true })) return;
        uTotal++;
        var name = String((q.userDetails && q.userDetails.name) || 'Cookscape Designer').trim();
        var k = name.toLowerCase();
        if (!uMap[k]) uMap[k] = { value: name, label: name, count: 0 };
        uMap[k].count++;
      });
      var uItems = Object.keys(uMap).map(function (k) { return uMap[k]; }).sort(function (a, b) {
        return b.count !== a.count ? (b.count - a.count) : a.label.localeCompare(b.label);
      });
      this._userItems = uItems;
      this._userTotal = uTotal;

      // Update button labels
      var bhBtn = document.getElementById('qhBhFilterBtn');
      var bhLbl = document.getElementById('qhBhFilterLabel');
      var bhClr = document.getElementById('qhBhFilterClear');
      if (bhBtn && bhLbl) {
        if (this.bhFilter) {
          bhLbl.textContent = 'BH: ' + this.bhFilter;
          bhBtn.classList.add('is-filtered');
          if (bhClr) bhClr.hidden = false;
        } else {
          bhLbl.textContent = 'Filter by BH';
          bhBtn.classList.remove('is-filtered');
          if (bhClr) bhClr.hidden = true;
        }
      }

      var uBtn = document.getElementById('qhUserFilterBtn');
      var uLbl = document.getElementById('qhUserFilterLabel');
      var uClr = document.getElementById('qhUserFilterClear');
      if (uBtn && uLbl) {
        if (this.userFilter) {
          uLbl.textContent = 'User: ' + this.userFilter;
          uBtn.classList.add('is-filtered');
          if (uClr) uClr.hidden = false;
        } else {
          uLbl.textContent = 'Filter by User';
          uBtn.classList.remove('is-filtered');
          if (uClr) uClr.hidden = true;
        }
      }

      var resetBtn = document.getElementById('qhClearFiltersBtn');
      if (resetBtn) {
        resetBtn.hidden = !(this.bhFilter || this.userFilter || this.searchQuery || this.statusFilter !== 'all');
      }

      this._renderMenuList(
        document.getElementById('qhBhFilterList'),
        bhItems, this.bhFilter, 'All BHs', bhTotal,
        function (val) { self.bhFilter = val; self.currentPage = 1; self._closeMenus(); self.render(); },
        (document.getElementById('qhBhFilterSearch') || {}).value || ''
      );
      this._renderMenuList(
        document.getElementById('qhUserFilterList'),
        uItems, this.userFilter, 'All Users', uTotal,
        function (val) { self.userFilter = val; self.currentPage = 1; self._closeMenus(); self.render(); },
        (document.getElementById('qhUserFilterSearch') || {}).value || ''
      );
    },

    render: function () {
      var self = this;
      this._updateFilterMenus();

      var all = this.quotes || [];
      var filtered = all.filter(function (q) { return self._matches(q); });

      // KPI Strip (computed on full accessible set or filtered set)
      var totalCount = all.length;
      var activeCount = all.filter(function (q) { return q.statusBadge === 'active'; }).length;
      var pendingCount = all.filter(function (q) { return q.statusBadge === 'pending_approval'; }).length;
      var openedQuotes = all.filter(function (q) { return q.openedHistory && q.openedHistory.isOpened; }).length;
      var totalOpens = all.reduce(function (acc, q) { return acc + Number((q.openedHistory && q.openedHistory.viewCount) || 0); }, 0);
      var openRate = totalCount > 0 ? Math.round((openedQuotes / totalCount) * 100) : 0;

      var setText = function (id, txt) {
        var el = document.getElementById(id);
        if (el) el.textContent = String(txt);
      };
      setText('qhTotalBadge', filtered.length === totalCount ? (totalCount + ' quotes') : (filtered.length + ' of ' + totalCount + ' quotes'));
      setText('qhKpiTotal', totalCount);
      setText('qhKpiActive', activeCount);
      setText('qhKpiPendingSub', pendingCount + ' pending approval');
      setText('qhKpiOpened', openedQuotes);
      setText('qhKpiOpenRate', openRate + '%');
      var openBar = document.getElementById('qhOpenRateBar');
      if (openBar) openBar.style.width = openRate + '%';
      setText('qhKpiViews', totalOpens);

      var listEl = document.getElementById('qhCardsList');
      var rangeEl = document.getElementById('qhRangeSummary');
      var pagEl = document.getElementById('qhPagination');
      if (!listEl) return;

      if (!filtered.length) {
        if (rangeEl) rangeEl.textContent = '0 matching quotes';
        if (pagEl) { pagEl.hidden = true; pagEl.innerHTML = ''; }
        listEl.innerHTML = '<div class="qh-empty-box">' +
          (totalCount > 0
            ? 'No quote history matched the active filters. <button type="button" class="btn small" id="qhEmptyResetBtn" style="margin-left:8px;">Clear Filters</button>'
            : 'No quotation links have been generated yet. Open a project\'s Pricing tab and click "Share Client Quote" to create one.') +
          '</div>';
        var emptyReset = document.getElementById('qhEmptyResetBtn');
        if (emptyReset) emptyReset.addEventListener('click', function () { self.clearFilters(true); });
        return;
      }

      var perPage = this.pageSize || 10;
      var totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
      if (this.currentPage > totalPages) this.currentPage = totalPages;
      if (this.currentPage < 1) this.currentPage = 1;
      var startIdx = (this.currentPage - 1) * perPage;
      var pageRows = filtered.slice(startIdx, startIdx + perPage);

      if (rangeEl) {
        rangeEl.textContent = 'Showing ' + (startIdx + 1) + '–' + (startIdx + pageRows.length) + ' of ' + filtered.length;
      }

      var html = '';
      pageRows.forEach(function (q) {
        var ud = q.userDetails || {};
        var bh = q.bhDetails || {};
        var gh = q.generatedHistory || {};
        var oh = q.openedHistory || {};
        var initials = String(ud.name || 'US').trim().substring(0, 2).toUpperCase();

        var stBadgeHtml = '';
        if (q.statusBadge === 'active') stBadgeHtml = '<span class="qh-badge qh-badge-active">Client Link Active</span>';
        else if (q.statusBadge === 'approved') stBadgeHtml = '<span class="qh-badge qh-badge-approved">Head Approved</span>';
        else if (q.statusBadge === 'revoked') stBadgeHtml = '<span class="qh-badge qh-badge-revoked">Revoked</span>';
        else if (q.statusBadge === 'expired') stBadgeHtml = '<span class="qh-badge qh-badge-expired">Expired</span>';
        else stBadgeHtml = '<span class="qh-badge qh-badge-pending">Pending Approval</span>';

        var varChips = (q.variantSummaries || []).slice(0, 4).map(function (vs) {
          return '<span class="qh-var-chip">' + esc(vs.tierTitle || vs.tierKey) + ' <b>' + fmtINR(vs.grandTotal) + '</b></span>';
        }).join('');
        if ((q.variantSummaries || []).length > 4) {
          varChips += '<span class="qh-var-chip">+' + ((q.variantSummaries || []).length - 4) + ' more</span>';
        }

        var openStatusHtml = oh.isOpened
          ? '<span class="qh-badge qh-badge-opened">&#10003; Opened ' + oh.viewCount + '&times;</span>'
          : '<span class="qh-badge qh-badge-unopened">Not Opened</span>';

        var cardAccent = oh.isOpened
          ? 'is-opened'
          : (q.statusBadge === 'active' || q.statusBadge === 'approved' ? 'is-active'
            : (q.statusBadge === 'revoked' ? 'is-revoked'
              : (q.statusBadge === 'expired' ? 'is-expired' : 'is-pending')));

        var isApproved = (q.approvalStatus === 'approved' || q.statusBadge === 'active' || q.statusBadge === 'approved');
        var staffShareUrl = q.shareUrl
          ? (q.shareUrl + (q.staffViewKey ? ((q.shareUrl.indexOf('?') !== -1 ? '&' : '?') + 'staff=' + encodeURIComponent(q.staffViewKey)) : ''))
          : '';
        var openTargetUrl = (q.statusBadge === 'active' && staffShareUrl) ? staffShareUrl : (q.reviewUrl || q.shareUrl || '');
        var copyTargetUrl = (q.statusBadge === 'active' && q.shareUrl) ? q.shareUrl : (q.reviewUrl || q.shareUrl || '');

        html += '<article class="qh-card ' + cardAccent + '" data-qid="' + esc(q.id) + '">' +
          '<div class="qh-card-head">' +
          '  <div class="qh-card-title-block">' +
          '    <div class="qh-card-top-row">' +
          '      <span class="qh-client-name">' + esc(q.clientName || 'Valued Client') + '</span>' +
          (q.quoteCode ? '<span class="qh-code-pill">' + esc(q.quoteCode) + '</span>' : '') +
          stBadgeHtml +
          '    </div>' +
          '    <div class="qh-card-sub-meta">' +
          (q.clientPhone ? '<span>&#128222; ' + esc(q.clientPhone) + '</span>' : '') +
          (q.siteAddress ? '<span>&#128205; ' + esc(q.siteAddress) + '</span>' : '') +
          (q.projectTitle && q.projectTitle !== q.clientName ? '<span>&#128193; ' + esc(q.projectTitle) + '</span>' : '') +
          '    </div>' +
          (varChips ? '<div class="qh-var-list">' + varChips + '</div>' : '') +
          '  </div>' +
          '  <div class="qh-card-actions">' +
          '    <button type="button" class="btn small qh-timeline-btn" data-qid="' + esc(q.id) + '">&#128337; Full Timeline</button>' +
          (openTargetUrl ? '    <a class="btn small qh-open-link" href="' + esc(openTargetUrl) + '" target="_blank" rel="noopener noreferrer">&#8599; Open Link</a>' : '') +
          (copyTargetUrl ? '    <button type="button" class="btn small qh-copy-btn" data-url="' + esc(copyTargetUrl) + '">Copy URL</button>' : '') +
          (isApproved ? '    <button type="button" class="btn small qh-dl-btn" data-qid="' + esc(q.id) + '" data-kind="pdf">PDF</button>' : '') +
          (isApproved ? '    <button type="button" class="btn small qh-dl-btn" data-qid="' + esc(q.id) + '" data-kind="pptx">PPTX</button>' : '') +
          '  </div>' +
          '</div>' +

          '<div class="qh-panels">' +
          // Panel 1: User Details
          '  <div class="qh-panel">' +
          '    <div class="qh-panel-lbl"><span class="qh-panel-lbl-l"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> User Details</span></div>' +
          '    <div class="qh-person-wrap">' +
          '      <span class="qh-avatar">' + esc(initials) + '</span>' +
          '      <div style="min-width:0;">' +
          '        <div class="qh-person-name">' + esc(ud.name || 'Designer') + '</div>' +
          '        <div class="qh-person-role">' + esc(ud.designation || 'Employee') + '</div>' +
          (ud.phone ? '<div class="qh-meta-txt">&#128222; ' + esc(ud.phone) + '</div>' : '') +
          (ud.email ? '<div class="qh-meta-txt">' + esc(ud.email) + '</div>' : '') +
          '      </div>' +
          '    </div>' +
          '  </div>' +

          // Panel 2: BH Details
          '  <div class="qh-panel">' +
          '    <div class="qh-panel-lbl"><span class="qh-panel-lbl-l"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg> BH Details</span></div>' +
          '    <div><span class="ptag bh-badge">BH: ' + esc(bh.name || 'Unassigned') + '</span></div>' +
          (bh.phone ? '<div class="qh-meta-txt">&#128222; ' + esc(bh.phone) + '</div>' : '') +
          (bh.email ? '<div class="qh-meta-txt">' + esc(bh.email) + '</div>' : '') +
          (bh.approvedBy ? '<div class="qh-approved-tag">&#10003; Approved by ' + esc(bh.approvedBy) + '</div>' : '<div class="qh-meta-txt">Approval pending</div>') +
          (bh.approvalRemarks ? '<div class="qh-meta-txt"><em>"' + esc(bh.approvalRemarks) + '"</em></div>' : '') +
          '  </div>' +

          // Panel 3: Generated History
          '  <div class="qh-panel">' +
          '    <div class="qh-panel-lbl"><span class="qh-panel-lbl-l"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> Generated History</span><span>' + (gh.eventCount || 0) + ' events</span></div>' +
          '    <div class="qh-rail">' +
          '      <div class="qh-mini-step"><span class="qh-step-dot is-review"></span><div><span class="qh-hist-lbl">Review Link:</span> ' + esc(fmtDateTime(gh.reviewCreatedAt)) + '</div></div>' +
          (gh.approvedAt
            ? '      <div class="qh-mini-step"><span class="qh-step-dot is-approved"></span><div><span class="qh-hist-lbl">Approved:</span> ' + esc(fmtDateTime(gh.approvedAt)) + '</div></div>'
            : '      <div class="qh-mini-step"><span class="qh-step-dot is-pending"></span><div><span class="qh-hist-lbl">Approved:</span> <span class="qh-hist-muted">Pending</span></div></div>') +
          (gh.clientLinkGeneratedAt
            ? '      <div class="qh-mini-step"><span class="qh-step-dot is-client"></span><div><span class="qh-hist-lbl">Client Link:</span> <span class="qh-hist-accent">' + esc(fmtDateTime(gh.clientLinkGeneratedAt)) + '</span></div></div>'
            : '      <div class="qh-mini-step"><span class="qh-step-dot"></span><div><span class="qh-hist-lbl">Client Link:</span> <span class="qh-hist-muted">Not generated yet</span></div></div>') +
          '    </div>' +
          '  </div>' +

          // Panel 4: Opened History
          '  <div class="qh-panel">' +
          '    <div class="qh-panel-lbl"><span class="qh-panel-lbl-l"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg> Opened History</span>' + openStatusHtml + '</div>' +
          '    <div class="qh-open-box' + (oh.isOpened ? ' is-opened' : '') + '">' +
          (oh.lastOpenedAt
            ? '      <div class="qh-meta-txt"><span class="qh-hist-lbl">Last Opened:</span> ' + esc(fmtDateTime(oh.lastOpenedAt)) + '</div>'
            : '      <div class="qh-meta-txt">Awaiting client to open link.</div>') +
          (oh.firstOpenedAt && oh.firstOpenedAt !== oh.lastOpenedAt
            ? '      <div class="qh-meta-txt"><span class="qh-hist-lbl">First Opened:</span> ' + esc(fmtDateTime(oh.firstOpenedAt)) + '</div>'
            : '') +
          '    </div>' +
          (oh.failedLoginCount ? '<div><span class="qh-badge qh-badge-warn">' + oh.failedLoginCount + ' failed login' + (oh.failedLoginCount > 1 ? 's' : '') + '</span></div>' : '') +
          (oh.lastWhatsappAlert ? '<div class="qh-wa-tag">&#128172; WhatsApp Alert Sent</div>' : '') +
          '  </div>' +
          '</div>' +
          '</article>';
      });

      listEl.innerHTML = html;

      // Bind card action buttons
      listEl.querySelectorAll('.qh-timeline-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var qid = btn.getAttribute('data-qid');
          var rec = (self.quotes || []).find(function (x) { return String(x.id) === String(qid); });
          if (rec) self.openTimelineModal(rec);
        });
      });

      listEl.querySelectorAll('.qh-copy-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var url = btn.getAttribute('data-url') || '';
          if (!url) return;
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(function () {
              if (typeof showToast === 'function') showToast('Quote link copied to clipboard');
            }).catch(function () {});
          }
        });
      });

      listEl.querySelectorAll('.qh-dl-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          self.downloadApprovedExport(btn.getAttribute('data-qid'), btn.getAttribute('data-kind'), btn);
        });
      });

      // Pagination bar
      if (pagEl) {
        if (totalPages <= 1) {
          pagEl.hidden = true;
          pagEl.innerHTML = '';
        } else {
          pagEl.hidden = false;
          var cur = this.currentPage;
          var btns = '<button type="button" class="ppage-btn" data-qpage="' + (cur - 1) + '"' + (cur <= 1 ? ' disabled' : '') + '>&larr; Prev</button>';
          for (var p = 1; p <= totalPages; p++) {
            if (p === 1 || p === totalPages || Math.abs(p - cur) <= 1) {
              btns += '<button type="button" class="ppage-btn' + (p === cur ? ' is-active' : '') + '" data-qpage="' + p + '">' + p + '</button>';
            } else if (Math.abs(p - cur) === 2) {
              btns += '<span class="ppage-ellipsis">&hellip;</span>';
            }
          }
          btns += '<button type="button" class="ppage-btn" data-qpage="' + (cur + 1) + '"' + (cur >= totalPages ? ' disabled' : '') + '>Next &rarr;</button>';
          pagEl.innerHTML = '<div class="ppage-info">Showing <strong>' + (startIdx + 1) + '&ndash;' + (startIdx + pageRows.length) + '</strong> of <strong>' + filtered.length + '</strong> quotes &middot; Page ' + cur + ' of ' + totalPages + '</div>' +
            '<div class="ppage-controls">' + btns + '</div>';
          pagEl.querySelectorAll('.ppage-btn[data-qpage]').forEach(function (b) {
            b.addEventListener('click', function () {
              if (b.disabled) return;
              self.currentPage = parseInt(b.getAttribute('data-qpage'), 10) || 1;
              self.render();
            });
          });
        }
      }
    },

    openTimelineModal: function (q) {
      var modal = document.getElementById('quoteHistoryTimelineModal');
      var titleEl = document.getElementById('qhModalTitle');
      var subEl = document.getElementById('qhModalSub');
      var bodyEl = document.getElementById('qhModalBody');
      if (!modal || !bodyEl) return;

      var ud = q.userDetails || {};
      var bh = q.bhDetails || {};
      var gh = q.generatedHistory || {};
      var oh = q.openedHistory || {};

      if (titleEl) titleEl.textContent = (q.clientName || 'Client') + (q.quoteCode ? (' — ' + q.quoteCode) : '');
      if (subEl) subEl.textContent = (q.projectTitle || q.title || 'Interior Quotation') + (q.siteAddress ? (' • ' + q.siteAddress) : '');

      var genEventsHtml = (gh.events && gh.events.length)
        ? gh.events.map(function (ev) {
            return '<div class="qh-tl-item qh-tl-gen">' +
              '<div class="qh-tl-dot"></div>' +
              '<div class="qh-tl-content">' +
              '  <div class="qh-tl-title">' + esc(formatEventLabel(ev.event)) + '</div>' +
              '  <div class="qh-tl-time">' + esc(fmtDateTime(ev.at)) + '</div>' +
              (ev.detail ? '<div class="qh-tl-detail">' + esc(ev.detail) + '</div>' : '') +
              '</div>' +
              '</div>';
          }).join('')
        : '<div class="qh-tl-empty">No generation events recorded.</div>';

      var openEventsHtml = (oh.events && oh.events.length)
        ? oh.events.map(function (ev) {
            var isFail = ev.event === 'login_failed';
            var metaBits = [];
            if (ev.ip) metaBits.push('IP: ' + ev.ip);
            if (ev.ua) metaBits.push(simplifyUA(ev.ua));
            if (ev.detail) metaBits.push(ev.detail);
            return '<div class="qh-tl-item ' + (isFail ? 'qh-tl-warn' : 'qh-tl-open') + '">' +
              '<div class="qh-tl-dot"></div>' +
              '<div class="qh-tl-content">' +
              '  <div class="qh-tl-title">' + esc(formatEventLabel(ev.event)) + '</div>' +
              '  <div class="qh-tl-time">' + esc(fmtDateTime(ev.at)) + '</div>' +
              (metaBits.length ? '<div class="qh-tl-detail">' + esc(metaBits.join(' • ')) + '</div>' : '') +
              '</div>' +
              '</div>';
          }).join('')
        : '<div class="qh-tl-empty">Client has not opened this quotation link yet.</div>';

      bodyEl.innerHTML =
        '<div class="qh-detail-cards">' +
        '  <div class="qh-detail-card">' +
        '    <div class="qh-detail-hdr">User Details (Created By)</div>' +
        '    <div class="qh-detail-name">' + esc(ud.name || 'Designer') + '</div>' +
        '    <div class="qh-detail-row"><span>Role:</span> <strong>' + esc(ud.designation || ud.role || 'Employee') + '</strong></div>' +
        '    <div class="qh-detail-row"><span>Phone:</span> <strong>' + esc(ud.phone || '—') + '</strong></div>' +
        '    <div class="qh-detail-row"><span>Email:</span> <strong>' + esc(ud.email || '—') + '</strong></div>' +
        '  </div>' +
        '  <div class="qh-detail-card">' +
        '    <div class="qh-detail-hdr">BH Details (Business Head)</div>' +
        '    <div class="qh-detail-name">' + esc(bh.name || 'Unassigned') + '</div>' +
        '    <div class="qh-detail-row"><span>Designation:</span> <strong>' + esc(bh.designation || 'Business Head') + '</strong></div>' +
        '    <div class="qh-detail-row"><span>Phone:</span> <strong>' + esc(bh.phone || '—') + '</strong></div>' +
        '    <div class="qh-detail-row"><span>Email:</span> <strong>' + esc(bh.email || '—') + '</strong></div>' +
        (bh.approvedBy ? '<div class="qh-detail-row"><span>Approved By:</span> <strong>' + esc(bh.approvedBy) + '</strong></div>' : '') +
        (bh.approvalRemarks ? '<div class="qh-detail-row"><span>Remarks:</span> <strong>' + esc(bh.approvalRemarks) + '</strong></div>' : '') +
        '  </div>' +
        '</div>' +
        '<div class="qh-timelines-grid">' +
        '  <div class="qh-tl-col">' +
        '    <div class="qh-tl-col-hdr">Generated History (' + (gh.events ? gh.events.length : 0) + ')</div>' +
        '    <div class="qh-tl-list">' + genEventsHtml + '</div>' +
        '  </div>' +
        '  <div class="qh-tl-col">' +
        '    <div class="qh-tl-col-hdr">Opened History (' + (oh.viewCount || 0) + ' opens)</div>' +
        '    <div class="qh-tl-list">' + openEventsHtml + '</div>' +
        '  </div>' +
        '</div>';

      modal.classList.add('is-open');
    },

    closeTimelineModal: function () {
      var modal = document.getElementById('quoteHistoryTimelineModal');
      if (modal) modal.classList.remove('is-open');
    }
  };

  root.OrbixQuoteHistory = OrbixQuoteHistory;
})(window);
