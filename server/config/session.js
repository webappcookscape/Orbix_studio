// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — Resilient Session Store
// ═══════════════════════════════════════════════════════════════════════════════

const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');

class ResilientSessionStore extends session.Store {
  constructor() {
    super();
    this.memorySessions = new Map();
    this.pgStore = null;

    // Try setting up PostgreSQL session store if connection string is configured
    try {
      const connectionString = process.env.DATABASE_URL;
      if (connectionString) {
        const pool = new Pool({ connectionString, max: 2 });
        this.pgStore = new pgSession({
          pool,
          tableName: 'session',
          createTableIfMissing: true
        });
        this.pgStore.on('error', (err) => {
          // Gracefully continue using in-memory store
        });
      }
    } catch (_) {}
  }

  get(sid, fn) {
    if (this.memorySessions.has(sid)) {
      return fn(null, this.memorySessions.get(sid));
    }
    if (this.pgStore) {
      this.pgStore.get(sid, (err, sess) => {
        if (!err && sess) {
          this.memorySessions.set(sid, sess);
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
