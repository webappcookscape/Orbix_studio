// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — Resilient & Persistent Session Store
// Persists sessions across server restarts using both PostgreSQL and disk cache
// ═══════════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
let session;
let pgSession;
try {
  session = require('express-session');
  pgSession = require('connect-pg-simple')(session);
} catch (_) {
  session = null;
  pgSession = null;
}
const { Pool } = require('pg');

const DISK_CACHE_PATH = path.join(__dirname, '..', '..', '.sessions_cache.json');
const THREE_DAYS_SECONDS = 3 * 24 * 60 * 60;

function isSessionActive(sess, nowMs) {
  if (!sess || typeof sess !== 'object') return false;
  if (sess.loginExpiresAt && Number(sess.loginExpiresAt) <= nowMs) return false;
  if (sess.cookie && sess.cookie.expires && new Date(sess.cookie.expires).getTime() <= nowMs) return false;
  return true;
}

const BaseStore = (session && session.Store) ? session.Store : class MockStore {};

class ResilientSessionStore extends BaseStore {
  constructor() {
    super();
    this.memorySessions = new Map();
    this.pgStore = null;

    // 1. Restore sessions from disk cache so server updates never log users out
    this.loadDiskCache();

    // 2. Set up PostgreSQL session store with resilient connection
    if (pgSession) {
      this.initPostgresStore();
    }
  }

  loadDiskCache() {
    try {
      if (fs.existsSync(DISK_CACHE_PATH)) {
        const raw = fs.readFileSync(DISK_CACHE_PATH, 'utf8');
        const data = JSON.parse(raw);
        if (typeof data === 'object' && data !== null) {
          const now = Date.now();
          for (const sid of Object.keys(data)) {
            const sess = data[sid];
            if (isSessionActive(sess, now)) {
              this.memorySessions.set(sid, sess);
            }
          }
          console.log('[ResilientSessionStore] Restored ' + this.memorySessions.size + ' active sessions from disk cache.');
        }
      }
    } catch (err) {
      console.warn('[ResilientSessionStore] Disk cache load notice:', err.message);
    }
  }

  saveDiskCache() {
    if (this._diskSaveDebounce) return;
    this._diskSaveDebounce = setTimeout(() => {
      this._diskSaveDebounce = null;
      try {
        const obj = {};
        const now = Date.now();
        for (const [sid, sess] of this.memorySessions.entries()) {
          if (isSessionActive(sess, now)) {
            obj[sid] = sess;
          }
        }
        fs.writeFile(DISK_CACHE_PATH, JSON.stringify(obj, null, 2), 'utf8', () => {});
      } catch (_) {}
    }, 2000);
  }

  flushDiskCacheSync() {
    if (this._diskSaveDebounce) {
      clearTimeout(this._diskSaveDebounce);
      this._diskSaveDebounce = null;
    }
    try {
      const obj = {};
      const now = Date.now();
      for (const [sid, sess] of this.memorySessions.entries()) {
        if (isSessionActive(sess, now)) {
          obj[sid] = sess;
        }
      }
      fs.writeFileSync(DISK_CACHE_PATH, JSON.stringify(obj, null, 2), 'utf8');
    } catch (_) {}
  }

  initPostgresStore() {
    if (process.env.SKIP_POSTGRES === 'true' || process.env.USE_JSON_STORE === 'true') return;
    const net = require('net');
    const primaryUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/cupboard_cad';
    const candidates = [primaryUrl];
    if (primaryUrl.includes(':5433')) candidates.push(primaryUrl.replace(':5433', ':5432'));
    else if (primaryUrl.includes(':5432')) candidates.push(primaryUrl.replace(':5432', ':5433'));

    const tryProbe = (idx) => {
      if (idx >= candidates.length) return;
      const urlStr = candidates[idx];
      let host = '127.0.0.1';
      let port = 5432;
      try {
        const u = new URL(urlStr);
        host = u.hostname || '127.0.0.1';
        port = Number(u.port) || 5432;
      } catch (_) {}
      const sock = net.createConnection({ host, port });
      let done = false;
      const finish = (ok) => {
        if (done) return;
        done = true;
        try { sock.destroy(); } catch (_) {}
        if (ok) {
          try {
            const pool = new Pool({
              connectionString: urlStr,
              max: 5,
              connectionTimeoutMillis: 2000,
              idleTimeoutMillis: 30000,
              statement_timeout: 3000
            });
            pool.on('error', () => {});
            this.pgStore = new pgSession({
              pool,
              tableName: 'session',
              ttl: THREE_DAYS_SECONDS,
              createTableIfMissing: true
            });
            this.pgStore.on('error', () => {});
          } catch (_) {}
        } else {
          tryProbe(idx + 1);
        }
      };
      sock.setTimeout(250);
      sock.once('connect', () => finish(true));
      sock.once('timeout', () => finish(false));
      sock.once('error', () => finish(false));
    };
    tryProbe(0);
  }

  get(sid, fn) {
    if (this.memorySessions.has(sid)) {
      const cached = this.memorySessions.get(sid);
      if (isSessionActive(cached, Date.now())) {
        return fn(null, cached);
      }
      this.memorySessions.delete(sid);
      this.saveDiskCache();
    }
    if (this.pgStore) {
      let settled = false;
      const done = (err, val) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn(err, val);
      };
      const timer = setTimeout(() => done(null, null), 2000);
      this.pgStore.get(sid, (err, sess) => {
        if (!err && sess && isSessionActive(sess, Date.now())) {
          this.memorySessions.set(sid, sess);
          this.saveDiskCache();
          return done(null, sess);
        }
        if (sess && !isSessionActive(sess, Date.now())) {
          this.destroy(sid, () => done(null, null));
          return;
        }
        done(null, null);
      });
    } else {
      fn(null, null);
    }
  }

  set(sid, sess, fn) {
    this.memorySessions.set(sid, sess);
    this.saveDiskCache();
    // Respond immediately once persisted in memory + disk cache; mirror to PostgreSQL asynchronously so login never hangs on PG pool stalls
    if (fn) fn(null);
    if (this.pgStore) {
      try {
        this.pgStore.set(sid, sess, () => {});
      } catch (_) {}
    }
  }

  destroy(sid, fn) {
    this.memorySessions.delete(sid);
    this.saveDiskCache();
    if (fn) fn(null);
    if (this.pgStore) {
      try {
        this.pgStore.destroy(sid, () => {});
      } catch (_) {}
    }
  }

  touch(sid, sess, fn) {
    this.memorySessions.set(sid, sess);
    if (fn) fn(null);
    if (this.pgStore && typeof this.pgStore.touch === 'function') {
      try {
        this.pgStore.touch(sid, sess, () => {});
      } catch (_) {}
    }
  }
}

module.exports = ResilientSessionStore;
