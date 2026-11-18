// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — Express Server (Layered Architecture: Router-Controller-Service)
// Powered by Node.js, Express, and Prisma ORM
// ═══════════════════════════════════════════════════════════════════════════════

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
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

// ── CORS Allowlist ──
const extraOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) return true; // Same-origin or non-browser client
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
    if (isAllowedOrigin(origin)) return cb(null, true);
    return cb(null, false);
  },
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ── Session Middleware (3-day session persistence) ──
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

// ── Session User Hydration Middleware (Strictly session-authenticated, 3-day expiry) ──
app.use(async (req, res, next) => {
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

    try {
      const user = await userService.getUserById(req.session.userId);
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

// ── PWA Service Worker & Manifest Handlers ──
app.get('/sw.js', (req, res) => {
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(ROOT_DIR, 'sw.js'));
});

app.get('/manifest.json', (req, res) => {
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.sendFile(path.join(ROOT_DIR, 'manifest.json'));
});

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

// ── Brute-Force Rate Limit on POST /api/login ──
const loginAttempts = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_FAILS = 15;
app.post('/api/login', (req, res, next) => {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (entry && entry.resetAt > now && entry.count >= MAX_LOGIN_FAILS) {
    return res.status(429).json({
      success: false,
      error: 'Too many login attempts. Please wait a few minutes and try again.'
    });
  }
  res.on('finish', () => {
    const t = Date.now();
    if (res.statusCode === 200) {
      loginAttempts.delete(ip);
    } else if (res.statusCode === 401 || res.statusCode === 400) {
      const cur = loginAttempts.get(ip);
      if (!cur || cur.resetAt <= t) {
        loginAttempts.set(ip, { count: 1, resetAt: t + LOGIN_WINDOW_MS });
      } else {
        cur.count += 1;
      }
    }
  });
  next();
});

// ── Serve Static Assets ──
app.use(express.static(ROOT_DIR, { dotfiles: 'deny' }));

// ── Mount Layered REST API Routes ──
app.use('/api', apiRoutes);

// ── Dedicated Tool Pages ──
app.get(['/costcalculation', '/cost-calculation', '/costcalc'], (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'costcalculation.html'));
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
  '/gallery',
  '/kitchen',
  '/sheet',
  '/elev',
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

// ── Server Startup ──
const server = app.listen(PORT, () => {
  console.log(`\n═════════════════════════════════════════════════════════════`);
  console.log(`  ORBIX STUDIO — Express + Prisma Layered CAD Architecture`);
  console.log(`  Local URL: http://localhost:${PORT}`);
  console.log(`  Database: PostgreSQL on port ${process.env.PGPORT || 5432}`);
  console.log(`═════════════════════════════════════════════════════════════\n`);
});

module.exports = { app, server };
