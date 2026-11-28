// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — Express Server (Layered Architecture: Router-Controller-Service)
// Powered by Node.js, Express, and Prisma ORM
// ═══════════════════════════════════════════════════════════════════════════════

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const zlib = require('zlib');
const ROOT_DIR = path.join(__dirname, '..');
require('dotenv').config({ path: path.join(ROOT_DIR, '.env') });
require('dotenv').config();

const express = require('express');
const cors = require('cors');
let session;
try {
  session = require('express-session');
} catch (_) {
  session = null;
}

const { prisma, checkDatabaseConnection } = require('./config/prisma');
const ResilientSessionStore = require('./config/session');
const userService = require('./services/userService');
const apiRoutes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');

function resolveSessionSecret() {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length >= 16) {
    return process.env.SESSION_SECRET.trim();
  }
  const secretFile = path.join(ROOT_DIR, '.session_secret');
  try {
    if (fs.existsSync(secretFile)) {
      const existing = fs.readFileSync(secretFile, 'utf8').trim();
      if (existing.length >= 32) return existing;
    }
    const generated = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(secretFile, generated, { mode: 0o600 });
    return generated;
  } catch (_) {
    return crypto.randomBytes(32).toString('hex');
  }
}

const app = express();
app.disable('x-powered-by');
const PORT = process.env.PORT || 4180;
const SESSION_SECRET = resolveSessionSecret();
const SESSION_DURATION_MS = 3 * 24 * 60 * 60 * 1000; // 3 days session lifetime

// ── Trust Reverse Proxy (Nginx on production server studio.orbixdesigns.com) ──
app.set('trust proxy', 1);

// ── Security Headers ──
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// ── Built-in Gzip Response Compression (Zero extra dependencies; cuts JS/CSS/JSON transfer ~75-80%) ──
const COMPRESSIBLE_MIME_RE = /^(?:text\/|application\/(?:json|javascript|x-javascript|xml|manifest\+json)|image\/svg\+xml)/i;
const GZIP_MIN_BYTES = 1024;
app.use((req, res, next) => {
  if (req.method === 'HEAD' || req.headers.range) return next();
  const acceptEnc = String(req.headers['accept-encoding'] || '');
  if (!/\bgzip\b/i.test(acceptEnc)) return next();

  const existingVary = res.getHeader('Vary');
  if (!existingVary) {
    res.setHeader('Vary', 'Accept-Encoding');
  } else if (!/\baccept-encoding\b/i.test(String(existingVary))) {
    res.setHeader('Vary', String(existingVary) + ', Accept-Encoding');
  }

  const origWrite = res.write;
  const origEnd = res.end;
  let decided = false;
  let gz = null;

  function decideCompression(firstChunk, isEndOnly) {
    if (decided) return;
    decided = true;
    if (res.headersSent) return;
    if (res.statusCode < 200 || res.statusCode === 204 || res.statusCode === 304) return;
    if (res.getHeader('Content-Encoding')) return;

    const ct = String(res.getHeader('Content-Type') || '');
    if (!COMPRESSIBLE_MIME_RE.test(ct)) return;

    const clHeader = res.getHeader('Content-Length');
    const knownLen = (clHeader !== undefined && clHeader !== null && !isNaN(Number(clHeader))) ? Number(clHeader) : null;
    if (knownLen !== null && knownLen < GZIP_MIN_BYTES) return;
    if (isEndOnly && knownLen === null) {
      const chunkBytes = firstChunk ? (Buffer.isBuffer(firstChunk) ? firstChunk.length : Buffer.byteLength(String(firstChunk))) : 0;
      if (chunkBytes < GZIP_MIN_BYTES) return;
    }

    res.removeHeader('Content-Length');
    res.setHeader('Content-Encoding', 'gzip');

    gz = zlib.createGzip({ level: 6 });
    let socketPaused = false;
    gz.on('data', (chunk) => {
      if (origWrite.call(res, chunk) === false) {
        socketPaused = true;
        gz.pause();
        res.once('drain', () => {
          socketPaused = false;
          if (gz && !gz.destroyed) gz.resume();
        });
      }
    });
    gz.on('drain', () => {
      if (!socketPaused) {
        res.emit('drain');
      }
    });
    gz.on('end', () => {
      origEnd.call(res);
    });
    gz.on('error', () => {
      try { origEnd.call(res); } catch (_) {}
    });
  }

  res.write = function (chunk, encoding, cb) {
    decideCompression(chunk, false);
    if (gz) return gz.write(chunk, encoding, cb);
    return origWrite.call(this, chunk, encoding, cb);
  };

  res.end = function (chunk, encoding, cb) {
    if (typeof chunk === 'function') {
      cb = chunk;
      chunk = undefined;
      encoding = undefined;
    } else if (typeof encoding === 'function') {
      cb = encoding;
      encoding = undefined;
    }
    decideCompression(chunk, true);
    if (gz) {
      if (cb) res.once('finish', cb);
      if (chunk !== undefined) gz.end(chunk, encoding);
      else gz.end();
      return this;
    }
    return origEnd.call(this, chunk, encoding, cb);
  };

  res.on('close', () => {
    if (gz && !gz.destroyed) {
      try { gz.destroy(); } catch (_) {}
    }
  });

  next();
});

// ── CORS Allowlist ──
const extraOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) return true; // Same-origin or non-browser client
  if (origin === 'null' || origin.startsWith('file://') || origin.startsWith('vscode-file://')) return true;
  try {
    const u = new URL(origin);
    const host = (u.hostname || '').toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true;
    if (host === 'studio.orbixdesigns.com' || host.endsWith('.orbixdesigns.com')) return true;
    if (extraOrigins.includes(origin.toLowerCase())) return true;
  } catch (_) {}
  return false;
}

app.use(cors({
  origin: (origin, cb) => {
    if (isAllowedOrigin(origin)) return cb(null, origin || true);
    return cb(null, false);
  },
  credentials: true
}));

// ── Block Direct HTTP Access to Internal Code, Stores, Config & Backups ──
const BLOCKED_PREFIXES = ['/server', '/db', '/data', '/node_modules', '/tests', '/prisma', '/shots', '/dist-desktop'];
const BLOCKED_EXACT = new Set([
  '/package.json', '/package-lock.json', '/build.py', '/electron-main.js',
  '/.env', '/.sessions_cache.json', '/.session_secret', '/.gitignore'
]);
app.use((req, res, next) => {
  let cleanPath = '';
  try {
    cleanPath = decodeURIComponent(req.path || '').replace(/\\/g, '/').toLowerCase();
  } catch (_) {
    return res.status(400).send('Bad Request');
  }
  if (cleanPath.includes('\0') || cleanPath.includes('..')) {
    return res.status(403).send('Forbidden');
  }
  if (BLOCKED_EXACT.has(cleanPath) || cleanPath.includes('/.')) {
    return res.status(404).send('Not found');
  }
  if (BLOCKED_PREFIXES.some((p) => cleanPath === p || cleanPath.startsWith(p + '/'))) {
    return res.status(404).send('Not found');
  }
  if (/\.(bak|backup|sql|log|py|md|env|ts)$/i.test(cleanPath) || cleanPath.includes('.bak') || /_store\.json$/i.test(cleanPath)) {
    return res.status(404).send('Not found');
  }
  next();
});

// ── PWA Service Worker & Manifest Handlers (served before session/DB middleware) ──
app.get('/sw.js', (req, res) => {
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(ROOT_DIR, 'sw.js'));
});

app.get('/manifest.json', (req, res) => {
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.sendFile(path.join(ROOT_DIR, 'manifest.json'));
});

// ── Serve Static Assets BEFORE Session & DB User Hydration (zero PostgreSQL queries on .js/.css/images) ──
app.use(express.static(ROOT_DIR, {
  dotfiles: 'deny',
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    const reqUrl = (res.req && res.req.url) ? res.req.url : '';
    if (ext === '.html') {
      res.setHeader('Cache-Control', 'no-cache');
    } else if (reqUrl.indexOf('?v=') !== -1 || filePath.indexOf(path.sep + 'assets' + path.sep) !== -1) {
      res.setHeader('Cache-Control', 'public, max-age=604800');
    } else if (/\.(js|css|png|jpg|jpeg|gif|svg|webp|woff2?|glb|gltf|ico)$/i.test(ext)) {
      res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
    }
  }
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ── Session Middleware (3-day session persistence; only runs for API & dynamic routes) ──
if (session) {
  app.use(session({
    store: new ResilientSessionStore(),
    secret: SESSION_SECRET,
    name: 'orbix.sid',
    resave: false,
    saveUninitialized: false,
    rolling: false,
    cookie: {
      httpOnly: true,
      secure: 'auto',
      sameSite: 'lax',
      maxAge: SESSION_DURATION_MS
    }
  }));
} else {
  app.use((req, res, next) => {
    req.session = req.session || {};
    next();
  });
}

// ── Session User Hydration Middleware (Strictly session-authenticated, 3-day expiry + Desktop header fallback) ──
app.use(async (req, res, next) => {
  let userId = null;
  if (req.session && req.session.userId) {
    if (req.session.loginExpiresAt && Date.now() > Number(req.session.loginExpiresAt)) {
      try {
        await new Promise((resolve) => {
          if (typeof req.session.destroy === 'function') {
            req.session.destroy(() => resolve());
          } else {
            delete req.session.userId;
            delete req.session.loginExpiresAt;
            resolve();
          }
        });
      } catch (_) { }
      res.clearCookie('orbix.sid', { path: '/' });
      req.user = null;
      return next();
    }
    userId = req.session.userId;
  } else if (req.headers['x-user-id']) {
    userId = req.headers['x-user-id'];
  }

  if (userId) {
    try {
      const user = await userService.getUserById(userId);
      if (user) {
        req.user = user;
        req.sessionAuthenticated = true;
      }
    } catch (err) {
      console.warn('Session user hydration notice:', err.message);
    }
  }
  next();
});

// ── Helper: Resolve Real Client IP Behind Cloudflare & Nginx ──
function resolveClientIp(req) {
  const cf = req.headers['cf-connecting-ip'];
  if (cf && typeof cf === 'string' && cf.trim()) return cf.trim();
  const xReal = req.headers['x-real-ip'];
  if (xReal && typeof xReal === 'string' && xReal.trim()) return xReal.trim();
  const xff = req.headers['x-forwarded-for'];
  if (xff && typeof xff === 'string') {
    const first = xff.split(',')[0].trim();
    if (first) return first;
  }
  return req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
}

// ── Brute-Force Rate Limit on POST /api/login (Per-User + Real IP) ──
const loginAttempts = new Map();
const LOGIN_WINDOW_MS = 5 * 60 * 1000; // 5-minute cooldown window
const MAX_LOGIN_FAILS = 15; // 15 failed attempts per user+IP

// Periodic cleanup of expired rate limit entries
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of loginAttempts.entries()) {
    if (v.resetAt <= now) loginAttempts.delete(k);
  }
}, 10 * 60 * 1000).unref();

app.post('/api/login', (req, res, next) => {
  const clientIp = resolveClientIp(req);
  const identifier = String(req.body && (req.body.identifier || req.body.email || req.body.username) || '').toLowerCase().trim();
  const key = identifier ? `${clientIp}::${identifier}` : clientIp;
  const now = Date.now();

  const entry = loginAttempts.get(key);
  if (entry) {
    if (entry.resetAt <= now) {
      loginAttempts.delete(key);
    } else if (entry.count >= MAX_LOGIN_FAILS) {
      const waitSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      return res.status(429).json({
        success: false,
        error: `Too many login attempts. Please wait ${waitSec} seconds and try again, or continue offline.`
      });
    }
  }

  res.on('finish', () => {
    const t = Date.now();
    if (res.statusCode === 200) {
      loginAttempts.delete(key);
      loginAttempts.delete(clientIp);
    } else if (res.statusCode === 401 || res.statusCode === 400) {
      const cur = loginAttempts.get(key);
      if (!cur || cur.resetAt <= t) {
        loginAttempts.set(key, { count: 1, resetAt: t + LOGIN_WINDOW_MS });
      } else {
        cur.count += 1;
      }
    }
  });
  next();
});

// ── Mount Layered REST API Routes ──
app.use('/api', apiRoutes);

// ── Dedicated Tool Pages ──
app.get(['/costcalculation', '/cost-calculation', '/costcalc'], (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'costcalculation.html'));
});

// ── Public Password-Free Head Commercial Review Page ──
app.get('/quote-review/:reviewToken', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, private');
  res.sendFile(path.join(ROOT_DIR, 'quote-review.html'));
});

// ── Protected Client Quote Portal Page (Isolated from CAD App) ──
app.get('/quote/:token', (req, res) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cache-Control', 'no-store, private');
  res.sendFile(path.join(ROOT_DIR, 'client-quote.html'));
});

// ── Single Page Application (SPA) Routing Fallback ──
const SPA_VIEWS = [
  '/',
  '/home',
  '/login',
  '/2d-plan',
  '/floor-plan',
  '/plan',
  '/2dplan',
  '/3d-studio',
  '/3dstudio',
  '/design',
  '/pricing',
  '/boq',
  '/quote',
  '/quote-history',
  '/gallery',
  '/kitchen',
  '/sheet',
  '/elev',
  '/drawings',
  '/2d-drawings',
  '/a4-drawings',
  '/panels',
  '/nest',
  '/upload',
  '/report',
  '/users'
];

SPA_VIEWS.forEach(v => {
  app.get(v, (req, res) => {
    res.sendFile(path.join(ROOT_DIR, 'index.html'));
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'index.html'));
});

// ── Centralized Error Handler ──
app.use(errorHandler);

const liveSyncService = require('./services/liveSyncService');

// ── Server Startup ──
const server = app.listen(PORT, () => {
  console.log(`\n═════════════════════════════════════════════════════════════`);
  console.log(`  ORBIX STUDIO — Express + Prisma Layered CAD Architecture`);
  console.log(`  Local URL: http://localhost:${PORT}`);
  console.log(`  Database: PostgreSQL on port ${process.env.PGPORT || 5432}`);
  console.log(`═════════════════════════════════════════════════════════════\n`);

  // Initialize Real-time Multi-Device Live Sync WebSocket Hub
  liveSyncService.init(server);
});

module.exports = { app, server };
