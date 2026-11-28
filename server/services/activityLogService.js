// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — Application Activity Logs Service (Read + Delete ONLY, No Edit)
// Persists to PostgreSQL `app_activity_logs` with resilient JSON file fallback.
// ═══════════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const prismaConfig = require('../config/prisma');

const DATA_DIR = path.join(__dirname, '..', 'data');
const STORE_PATH = path.join(DATA_DIR, 'app-activity-logs.json');
const MAX_LOCAL_LOGS = 5000;

let pgTableReady = false;

function toIstDateKey(isoOrDate) {
  const d = isoOrDate ? new Date(isoOrDate) : new Date();
  const safe = Number.isNaN(d.getTime()) ? new Date() : d;
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(safe);
    const y = (parts.find((p) => p.type === 'year') || {}).value;
    const m = (parts.find((p) => p.type === 'month') || {}).value;
    const day = (parts.find((p) => p.type === 'day') || {}).value;
    if (y && m && day) return `${y}-${m}-${day}`;
  } catch (_) {}
  const istMs = safe.getTime() + 5.5 * 60 * 60 * 1000;
  return new Date(istMs).toISOString().slice(0, 10);
}

function readLocalLogs() {
  try {
    if (!fs.existsSync(STORE_PATH)) return [];
    const parsed = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function writeLocalLogs(rows) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const trimmed = Array.isArray(rows) ? rows.slice(0, MAX_LOCAL_LOGS) : [];
    const eol = process.platform === 'win32' ? '\r\n' : '\n';
    const serialized = JSON.stringify(trimmed, null, 2).replace(/\r\n/g, '\n').replace(/\n/g, eol);
    fs.writeFileSync(STORE_PATH, serialized, 'utf8');
  } catch (err) {
    console.warn('[ActivityLogService] Local store write error:', err.message);
  }
}

async function ensurePgTable() {
  if (!prismaConfig.isConnected || pgTableReady) return prismaConfig.isConnected;
  try {
    await prismaConfig.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS app_activity_logs (
        id VARCHAR(64) PRIMARY KEY,
        date_key VARCHAR(16) NOT NULL,
        category VARCHAR(48) NOT NULL DEFAULT 'System',
        action VARCHAR(80) NOT NULL DEFAULT 'API_ACTION',
        summary TEXT NOT NULL DEFAULT '',
        method VARCHAR(12) NOT NULL DEFAULT 'GET',
        path VARCHAR(260) NOT NULL DEFAULT '',
        status_code INTEGER NOT NULL DEFAULT 200,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        actor_id VARCHAR(64) DEFAULT '',
        actor_name VARCHAR(160) DEFAULT '',
        actor_email VARCHAR(160) DEFAULT '',
        actor_role VARCHAR(48) DEFAULT '',
        target_type VARCHAR(48) DEFAULT '',
        target_id VARCHAR(120) DEFAULT '',
        target_label VARCHAR(260) DEFAULT '',
        ip VARCHAR(80) DEFAULT '',
        user_agent VARCHAR(240) DEFAULT '',
        meta JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await prismaConfig.prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS idx_app_activity_logs_date_created ON app_activity_logs (date_key DESC, created_at DESC)`
    );
    pgTableReady = true;
    return true;
  } catch (err) {
    console.warn('[ActivityLogService] PG init notice, using JSON store:', err.message);
    return false;
  }
}

function normalizeRow(row) {
  if (!row) return null;
  let metaObj = {};
  try {
    metaObj = typeof row.meta === 'string' ? JSON.parse(row.meta) : (row.meta || {});
  } catch (_) {
    metaObj = {};
  }
  const createdAt = row.created_at ?? row.createdAt ?? new Date().toISOString();
  return {
    id: String(row.id || ''),
    dateKey: String(row.date_key ?? row.dateKey ?? toIstDateKey(createdAt)),
    category: String(row.category || 'System'),
    action: String(row.action || 'ACTIVITY'),
    summary: String(row.summary || ''),
    method: String(row.method || 'GET'),
    path: String(row.path || ''),
    statusCode: Number(row.status_code ?? row.statusCode ?? 200),
    durationMs: Number(row.duration_ms ?? row.durationMs ?? 0),
    actorId: String(row.actor_id ?? row.actorId ?? ''),
    actorName: String(row.actor_name ?? row.actorName ?? ''),
    actorEmail: String(row.actor_email ?? row.actorEmail ?? ''),
    actorRole: String(row.actor_role ?? row.actorRole ?? ''),
    targetType: String(row.target_type ?? row.targetType ?? ''),
    targetId: String(row.target_id ?? row.targetId ?? ''),
    targetLabel: String(row.target_label ?? row.targetLabel ?? ''),
    ip: String(row.ip || ''),
    userAgent: String(row.user_agent ?? row.userAgent ?? ''),
    meta: metaObj,
    createdAt: typeof createdAt === 'object' && createdAt && typeof createdAt.toISOString === 'function'
      ? createdAt.toISOString()
      : String(createdAt)
  };
}

class ActivityLogService {
  async recordLog(entry) {
    try {
      const nowIso = entry.createdAt || new Date().toISOString();
      const rec = {
        id: entry.id || ('log_' + Date.now().toString(36) + '_' + crypto.randomBytes(4).toString('hex')),
        dateKey: entry.dateKey || toIstDateKey(nowIso),
        category: String(entry.category || 'System').slice(0, 48),
        action: String(entry.action || 'ACTIVITY').slice(0, 80),
        summary: String(entry.summary || '').slice(0, 600),
        method: String(entry.method || 'GET').toUpperCase().slice(0, 12),
        path: String(entry.path || '').slice(0, 260),
        statusCode: Number(entry.statusCode || 200),
        durationMs: Math.max(0, Math.round(Number(entry.durationMs || 0))),
        actorId: String(entry.actorId || '').slice(0, 64),
        actorName: String(entry.actorName || '').slice(0, 160),
        actorEmail: String(entry.actorEmail || '').slice(0, 160),
        actorRole: String(entry.actorRole || '').slice(0, 48),
        targetType: String(entry.targetType || '').slice(0, 48),
        targetId: String(entry.targetId || '').slice(0, 120),
        targetLabel: String(entry.targetLabel || '').slice(0, 260),
        ip: String(entry.ip || '').slice(0, 80),
        userAgent: String(entry.userAgent || '').slice(0, 240),
        meta: (entry.meta && typeof entry.meta === 'object') ? entry.meta : {},
        createdAt: nowIso
      };

      if (await ensurePgTable()) {
        try {
          await prismaConfig.prisma.$executeRawUnsafe(
            `INSERT INTO app_activity_logs (
              id, date_key, category, action, summary, method, path, status_code, duration_ms,
              actor_id, actor_name, actor_email, actor_role, target_type, target_id, target_label,
              ip, user_agent, meta, created_at
            ) VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb,$20::timestamptz
            )`,
            rec.id, rec.dateKey, rec.category, rec.action, rec.summary, rec.method, rec.path,
            rec.statusCode, rec.durationMs, rec.actorId, rec.actorName, rec.actorEmail, rec.actorRole,
            rec.targetType, rec.targetId, rec.targetLabel, rec.ip, rec.userAgent,
            JSON.stringify(rec.meta), rec.createdAt
          );
          return rec;
        } catch (pgErr) {
          console.warn('[ActivityLogService] PG insert fallback:', pgErr.message);
        }
      }

      const list = readLocalLogs();
      list.unshift(rec);
      writeLocalLogs(list);
      return rec;
    } catch (err) {
      console.warn('[ActivityLogService] recordLog error:', err.message);
      return null;
    }
  }

  async listLogs(opts = {}) {
    const date = String(opts.date || '').trim();
    const from = String(opts.from || '').trim();
    const to = String(opts.to || '').trim();
    const category = String(opts.category || '').trim();
    const search = String(opts.search || '').trim().toLowerCase();
    const limit = Math.min(1000, Math.max(1, parseInt(opts.limit, 10) || 500));
    const todayKey = toIstDateKey(new Date());

    let allLogs = [];
    if (await ensurePgTable()) {
      try {
        const whereParts = [];
        const params = [];
        let idx = 1;
        if (date) {
          whereParts.push(`date_key = $${idx++}`);
          params.push(date);
        } else {
          if (from) {
            whereParts.push(`date_key >= $${idx++}`);
            params.push(from);
          }
          if (to) {
            whereParts.push(`date_key <= $${idx++}`);
            params.push(to);
          }
        }
        if (category && category.toLowerCase() !== 'all') {
          whereParts.push(`LOWER(category) = LOWER($${idx++})`);
          params.push(category);
        }
        const whereSql = whereParts.length ? ('WHERE ' + whereParts.join(' AND ')) : '';
        const [rows, dateRows, statsRows] = await Promise.all([
          prismaConfig.prisma.$queryRawUnsafe(
            `SELECT * FROM app_activity_logs ${whereSql} ORDER BY created_at DESC LIMIT $${idx}`,
            ...params,
            limit
          ),
          prismaConfig.prisma.$queryRawUnsafe(
            `SELECT date_key AS "dateKey", COUNT(*)::int AS count FROM app_activity_logs GROUP BY date_key ORDER BY date_key DESC LIMIT 90`
          ),
          prismaConfig.prisma.$queryRawUnsafe(
            `SELECT
              COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE date_key = $1)::int AS today,
              COUNT(*) FILTER (WHERE category IN ('Auth', 'Client Portal'))::int AS auth_portal,
              COUNT(*) FILTER (WHERE status_code >= 400 OR method = 'DELETE')::int AS alerts
             FROM app_activity_logs`,
            todayKey
          )
        ]);
        let formatted = (rows || []).map(normalizeRow);
        if (search) {
          formatted = formatted.filter((l) => this._matchesSearch(l, search));
        }
        const st = (statsRows && statsRows[0]) || {};
        return {
          logs: formatted,
          total: formatted.length,
          todayKey,
          dates: (dateRows || []).map((d) => ({ dateKey: String(d.dateKey), count: Number(d.count || 0) })),
          summary: {
            totalLogs: Number(st.total || 0),
            todayCount: Number(st.today || 0),
            authPortalCount: Number(st.auth_portal || 0),
            alertDeleteCount: Number(st.alerts || 0)
          }
        };
      } catch (pgErr) {
        console.warn('[ActivityLogService] PG listLogs fallback:', pgErr.message);
      }
    }

    allLogs = readLocalLogs().map(normalizeRow).filter(Boolean);
    allLogs.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const dateCounts = {};
    allLogs.forEach((l) => {
      dateCounts[l.dateKey] = (dateCounts[l.dateKey] || 0) + 1;
    });
    const dates = Object.keys(dateCounts).sort().reverse().slice(0, 90).map((k) => ({ dateKey: k, count: dateCounts[k] }));
    const summary = {
      totalLogs: allLogs.length,
      todayCount: allLogs.filter((l) => l.dateKey === todayKey).length,
      authPortalCount: allLogs.filter((l) => l.category === 'Auth' || l.category === 'Client Portal').length,
      alertDeleteCount: allLogs.filter((l) => l.statusCode >= 400 || l.method === 'DELETE').length
    };

    const filtered = allLogs.filter((l) => {
      if (date && l.dateKey !== date) return false;
      if (!date && from && l.dateKey < from) return false;
      if (!date && to && l.dateKey > to) return false;
      if (category && category.toLowerCase() !== 'all' && l.category.toLowerCase() !== category.toLowerCase()) return false;
      if (search && !this._matchesSearch(l, search)) return false;
      return true;
    }).slice(0, limit);

    return {
      logs: filtered,
      total: filtered.length,
      todayKey,
      dates,
      summary
    };
  }

  _matchesSearch(l, q) {
    const hay = [
      l.dateKey, l.category, l.action, l.summary, l.method, l.path,
      l.actorName, l.actorEmail, l.actorRole, l.targetType, l.targetLabel, l.ip, String(l.statusCode)
    ].filter(Boolean).join(' ').toLowerCase();
    const tokens = q.split(/\s+/).filter(Boolean);
    return tokens.every((t) => hay.indexOf(t) !== -1);
  }

  async deleteLogById(id) {
    const cleanId = String(id || '').trim();
    if (!cleanId) return { deleted: 0 };

    if (await ensurePgTable()) {
      try {
        const count = await prismaConfig.prisma.$executeRawUnsafe(
          'DELETE FROM app_activity_logs WHERE id = $1',
          cleanId
        );
        return { deleted: Number(count || 0) };
      } catch (pgErr) {
        console.warn('[ActivityLogService] PG delete fallback:', pgErr.message);
      }
    }

    const list = readLocalLogs();
    const next = list.filter((l) => String(l.id) !== cleanId);
    writeLocalLogs(next);
    return { deleted: list.length - next.length };
  }

  async deleteLogs(opts = {}) {
    const ids = Array.isArray(opts.ids) ? opts.ids.map((x) => String(x || '').trim()).filter(Boolean) : [];
    const date = String(opts.date || '').trim();
    if (!ids.length && !date) return { deleted: 0 };

    if (await ensurePgTable()) {
      try {
        if (ids.length) {
          const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
          const count = await prismaConfig.prisma.$executeRawUnsafe(
            `DELETE FROM app_activity_logs WHERE id IN (${placeholders})`,
            ...ids
          );
          return { deleted: Number(count || 0) };
        }
        if (date) {
          const count = await prismaConfig.prisma.$executeRawUnsafe(
            'DELETE FROM app_activity_logs WHERE date_key = $1',
            date
          );
          return { deleted: Number(count || 0) };
        }
      } catch (pgErr) {
        console.warn('[ActivityLogService] PG bulk delete fallback:', pgErr.message);
      }
    }

    const list = readLocalLogs();
    const idSet = new Set(ids);
    const next = list.filter((l) => {
      if (ids.length && idSet.has(String(l.id))) return false;
      if (!ids.length && date && String(l.dateKey || '') === date) return false;
      return true;
    });
    writeLocalLogs(next);
    return { deleted: list.length - next.length };
  }
}

module.exports = new ActivityLogService();
module.exports.toIstDateKey = toIstDateKey;
