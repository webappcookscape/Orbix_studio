// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — Express Server with PostgreSQL API & Server-Side Sessions
// ═══════════════════════════════════════════════════════════════════════════════

const path = require('path');
const ROOT_DIR = path.join(__dirname, '..');
require('dotenv').config({ path: path.join(ROOT_DIR, '.env') });
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 4180;
const SESSION_SECRET = process.env.SESSION_SECRET || 'orbix-studio-cad-production-session-secret-2026';

// Configure proxy trust behind Nginx reverse proxy
app.set('trust proxy', 1);

// Restrict CORS to exact authorized origins
const allowedOrigins = [
  'https://studio.orbixdesigns.com',
  'http://localhost:4180',
  'http://127.0.0.1:4180'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS access rejected for origin: ' + origin), false);
  },
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Resilient Session Store: PostgreSQL-backed with in-memory fallback
const memoryStore = new session.MemoryStore();
let pgSessionStore = null;
try {
  pgSessionStore = new pgSession({
    pool: db.pgPool,
    tableName: 'user_sessions',
    createTableIfMissing: true
  });
  pgSessionStore.on('error', (err) => {
    if (process.env.NODE_ENV === 'production') {
      console.error('PostgreSQL session store error notice:', err.message);
    }
  });
} catch (e) {
  pgSessionStore = null;
}

class ResilientSessionStore extends session.Store {
  constructor() {
    super();
  }
  get(sid, fn) {
    if (db.isPgConnected && pgSessionStore) {
      pgSessionStore.get(sid, (err, sess) => {
        if (!err && sess) return fn(null, sess);
        memoryStore.get(sid, fn);
      });
    } else {
      memoryStore.get(sid, fn);
    }
  }
  set(sid, sess, fn) {
    memoryStore.set(sid, sess, () => {});
    if (db.isPgConnected && pgSessionStore) {
      pgSessionStore.set(sid, sess, (err) => {
        if (fn) fn(null);
      });
    } else {
      if (fn) fn(null);
    }
  }
  destroy(sid, fn) {
    memoryStore.destroy(sid, () => {});
    if (db.isPgConnected && pgSessionStore) {
      pgSessionStore.destroy(sid, () => {
        if (fn) fn(null);
      });
    } else {
      if (fn) fn(null);
    }
  }
  touch(sid, sess, fn) {
    memoryStore.touch(sid, sess, () => {});
    if (db.isPgConnected && pgSessionStore && typeof pgSessionStore.touch === 'function') {
      pgSessionStore.touch(sid, sess, () => {
        if (fn) fn(null);
      });
    } else {
      if (fn) fn(null);
    }
  }
}

app.use(session({
  store: new ResilientSessionStore(),
  secret: SESSION_SECRET,
  name: 'orbix.sid',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

// Session User Population Middleware
// Validates session and hydrates authenticated user from PostgreSQL
app.use(async (req, res, next) => {
  if (req.session && req.session.userId) {
    try {
      const user = await db.getUser(req.session.userId);
      if (user) {
        req.user = user;
      } else {
        // User account deleted or invalid -> destroy session
        req.session.destroy(() => {});
        req.user = null;
      }
    } catch (err) {
      console.error('Session user hydration notice:', err.message);
      req.user = null;
    }
  } else {
    req.user = null;
  }
  next();
});

// Authentication Guard Middlewares
const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Valid session required. Please sign in.' });
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Forbidden: Administrator privileges required.' });
  }
  next();
};

// PWA Service Worker Route with Service-Worker-Allowed header
app.get('/sw.js', (req, res) => {
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(ROOT_DIR, 'sw.js'));
});

// PWA Manifest Route with correct MIME type
app.get('/manifest.json', (req, res) => {
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.sendFile(path.join(ROOT_DIR, 'manifest.json'));
});

// Serve static assets from project root
app.use(express.static(ROOT_DIR));

// ── API Routes ──

// Health & Database Connection Status
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    db: db.getStatus()
  });
});

// GET /api/me — Returns currently authenticated session user
app.get('/api/me', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  res.json({ success: true, user: req.user });
});

// POST /api/login — Password authentication and session regeneration
app.post('/api/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ success: false, error: 'Username/Email and Password are required.' });
    }

    const user = await db.authenticateUser(identifier, password);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid username/email or password.' });
    }

    // Regenerate session to prevent session fixation attacks
    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regeneration error:', err);
        return res.status(500).json({ success: false, error: 'Session initialization error' });
      }

      req.session.userId = user.id;
      req.session.userRole = user.role;

      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('Session save error:', saveErr);
          return res.status(500).json({ success: false, error: 'Session persistence error' });
        }
        res.json({ success: true, user });
      });
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/logout — Server-side session destruction & cookie clearance
app.post('/api/logout', (req, res) => {
  if (req.session) {
    req.session.destroy((err) => {
      res.clearCookie('orbix.sid');
      if (err) {
        console.error('Session destruction error:', err);
        return res.status(500).json({ success: false, error: 'Logout error' });
      }
      res.json({ success: true, message: 'Logged out successfully' });
    });
  } else {
    res.clearCookie('orbix.sid');
    res.json({ success: true, message: 'Logged out' });
  }
});

// ── User Management (Protected) ──

// GET /api/users — All authenticated users can retrieve directory
app.get('/api/users', requireAuth, async (req, res) => {
  try {
    const users = await db.getUsers();
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/users/:id — Own account or Admin
app.get('/api/users/:id', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
      return res.status(403).json({ success: false, error: 'Access denied: You may only view your own user profile.' });
    }
    const user = await db.getUser(req.params.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/users — Admin Only
app.post('/api/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = await db.createUser(req.body);
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/users/:id — Admin Only
app.put('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const updated = await db.updateUser(req.params.id, req.body);
    if (!updated) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, user: updated });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// DELETE /api/users/:id — Admin Only (Protected primary admin)
app.delete('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    if (req.params.id === 'usr_admin') {
      return res.status(403).json({ success: false, error: 'Cannot delete primary admin account.' });
    }
    const result = await db.deleteUser(req.params.id);
    res.json({ success: true, result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ── Project Endpoints (Protected by Session) ──

// GET /api/projects — Role-based project isolation
app.get('/api/projects', requireAuth, async (req, res) => {
  try {
    const { search, filter } = req.query;
    // Session identity strictly determines access
    const projects = await db.getProjects({
      search,
      filter,
      userId: req.user.id,
      userRole: req.user.role
    });
    res.json({ success: true, count: projects.length, projects });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/projects — Creator identity bound to session user
app.post('/api/projects', requireAuth, async (req, res) => {
  try {
    const project = await db.createProject(req.body, req.user);
    res.json({ success: true, project });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/projects/:id — Ownership & Sharing Verification
app.get('/api/projects/:id', requireAuth, async (req, res) => {
  try {
    const project = await db.getProject(req.params.id);
    if (!project) return res.status(404).json({ success: false, error: 'Project not found' });

    // Verify employee has permission to view this project
    if (req.user.role !== 'admin' && project.created_by !== req.user.id) {
      // Check if project was explicitly shared with user's email
      const userProjects = await db.getProjects({ userId: req.user.id, userRole: req.user.role });
      const canAccess = userProjects.some(p => p.id === req.params.id);
      if (!canAccess) {
        return res.status(403).json({ success: false, error: 'Access denied: You do not have permission to view this private project.' });
      }
    }

    res.json({ success: true, project });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/projects/:id — Owner or Admin only
app.put('/api/projects/:id', requireAuth, async (req, res) => {
  try {
    const updated = await db.updateProject(req.params.id, req.body, req.user);
    if (!updated) return res.status(404).json({ success: false, error: 'Project not found' });
    res.json({ success: true, project: updated });
  } catch (err) {
    const status = err.message.includes('Access denied') ? 403 : 500;
    res.status(status).json({ success: false, error: err.message });
  }
});

// DELETE /api/projects/:id — Owner or Admin only
app.delete('/api/projects/:id', requireAuth, async (req, res) => {
  try {
    const result = await db.deleteProject(req.params.id, req.user);
    res.json({ success: true, result });
  } catch (err) {
    const status = err.message.includes('Access denied') ? 403 : 500;
    res.status(status).json({ success: false, error: err.message });
  }
});

// POST /api/projects/:id/share — Share with colleague
app.post('/api/projects/:id/share', requireAuth, async (req, res) => {
  try {
    const { sharedToEmail, permission } = req.body;
    const share = await db.createShare({
      projectId: req.params.id,
      sharedToEmail,
      permission: permission || 'copy'
    }, req.user);
    res.json({ success: true, share });
  } catch (err) {
    const status = err.message.includes('Access denied') ? 403 : 500;
    res.status(status).json({ success: false, error: err.message });
  }
});

// POST /api/projects/:id/fork — "Colleague Works in Copy" Master Fork Engine
app.post('/api/projects/:id/fork', requireAuth, async (req, res) => {
  try {
    const { colleagueUser, colleagueUserId } = req.body;
    const targetColleague = colleagueUserId || colleagueUser;
    if (!targetColleague) {
      return res.status(400).json({ success: false, error: 'Colleague user recipient required' });
    }
    const forkResult = await db.forkProjectForColleague(req.params.id, targetColleague, req.user);
    res.json({ success: true, ...forkResult });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Dedicated Cost Calculation Page (studio.orbixdesigns.com/costcalculation)
app.get(['/costcalculation', '/cost-calculation', '/costcalc'], (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'costcalculation.html'));
});

// SPA Routes: Explicit URL paths for all views & navbar links
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

// Fallback to index.html for any other URL
app.get('*', (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n═════════════════════════════════════════════════════════════`);
  console.log(`  ORBIX STUDIO — PostgreSQL CAD Workspace`);
  console.log(`  Local URL: http://localhost:${PORT}`);
  console.log(`═════════════════════════════════════════════════════════════\n`);
});
