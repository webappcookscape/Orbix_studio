// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — Express Server (Layered Architecture: Router-Controller-Service)
// Powered by Node.js, Express, and Prisma ORM
// ═══════════════════════════════════════════════════════════════════════════════

const path = require('path');
const ROOT_DIR = path.join(__dirname, '..');
require('dotenv').config({ path: path.join(ROOT_DIR, '.env') });
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const session = require('express-session');

const { prisma, checkDatabaseConnection } = require('./config/prisma');
const ResilientSessionStore = require('./config/session');
const userService = require('./services/userService');
const apiRoutes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();
const PORT = process.env.PORT || 4180;
const SESSION_SECRET = process.env.SESSION_SECRET || 'orbix-studio-super-secret-key-2026';

// ── Trust Reverse Proxy (Nginx on production server studio.orbixdesigns.com) ──
app.set('trust proxy', 1);

// ── Security & Body Parsers ──
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ── Session Middleware ──
app.use(session({
  store: new ResilientSessionStore(),
  secret: SESSION_SECRET,
  name: 'orbix.sid',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: 'auto',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

// ── Session User Hydration Middleware ──
app.use(async (req, res, next) => {
  if (req.session && req.session.userId) {
    try {
      const user = await userService.getUserById(req.session.userId);
      if (user) {
        req.user = user;
      } else {
        req.session.destroy(() => {});
        req.user = null;
      }
    } catch (err) {
      console.warn('Session user hydration notice:', err.message);
      req.user = null;
    }
  } else {
    req.user = null;
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

// ── Serve Static Assets ──
app.use(express.static(ROOT_DIR));

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
