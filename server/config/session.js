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
            // Only load non-expired sessions
            if (sess && (!sess.cookie || !sess.cookie.expires || new Date(sess.cookie.expires).getTime() > now)) {
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
    try {
      const obj = {};
      const now = Date.now();
      for (const [sid, sess] of this.memorySessions.entries()) {
        if (sess && (!sess.cookie || !sess.cookie.expires || new Date(sess.cookie.expires).getTime() > now)) {
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
            const pool = new Pool({ connectionString: urlStr, max: 2 });
            pool.on('error', () => {});
            this.pgStore = new pgSession({
              pool,
              tableName: 'session',
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
      return fn(null, this.memorySessions.get(sid));
    }
    if (this.pgStore) {
      this.pgStore.get(sid, (err, sess) => {
        if (!err && sess) {
          this.memorySessions.set(sid, sess);
          this.saveDiskCache();
          return fn(null, sess);
        }
        fn(null, null);
      });
    } else {
      fn(null, null);
    }
  }

  set(sid, sess, fn) {
    this.memorySessions.set(sid, sess);
    this.saveDiskCache();
    if (this.pgStore) {
      this.pgStore.set(sid, sess, () => {
        if (fn) fn(null);
      });
    } else {
      if (fn) fn(null);
    }
  }

  destroy(sid, fn) {
    this.memorySessions.delete(sid);
    this.saveDiskCache();
    if (this.pgStore) {
      this.pgStore.destroy(sid, () => {
        if (fn) fn(null);
      });
    } else {
      if (fn) fn(null);
    }
  }

  touch(sid, sess, fn) {
    this.memorySessions.set(sid, sess);
    if (this.pgStore && typeof this.pgStore.touch === 'function') {
      this.pgStore.touch(sid, sess, () => {
        if (fn) fn(null);
      });
    } else {
      if (fn) fn(null);
    }
  }
}

module.exports = ResilientSessionStore;
