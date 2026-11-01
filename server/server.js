// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — Express Server with PostgreSQL API
// ═══════════════════════════════════════════════════════════════════════════════

const path = require('path');
const ROOT_DIR = path.join(__dirname, '..');
require('dotenv').config({ path: path.join(ROOT_DIR, '.env') });
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 4180;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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

// Authentication (Login with username/email and password)
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
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Users
app.get('/api/users', async (req, res) => {
  try {
    const users = await db.getUsers();
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const user = await db.createUser(req.body);
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await db.getUser(req.params.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const updated = await db.updateUser(req.params.id, req.body);
    if (!updated) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, user: updated });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
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

// Projects
app.get('/api/projects', async (req, res) => {
  try {
    const { search, filter, userId, userRole } = req.query;
    const projects = await db.getProjects({ search, filter, userId, userRole });
    res.json({ success: true, count: projects.length, projects });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/projects', async (req, res) => {
  try {
    const currentUser = req.body.currentUser || null;
    const project = await db.createProject(req.body, currentUser);
    res.json({ success: true, project });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/projects/:id', async (req, res) => {
  try {
    const project = await db.getProject(req.params.id);
    if (!project) return res.status(404).json({ success: false, error: 'Project not found' });
    res.json({ success: true, project });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/projects/:id', async (req, res) => {
  try {
    const updated = await db.updateProject(req.params.id, req.body);
    if (!updated) return res.status(404).json({ success: false, error: 'Project not found' });
    res.json({ success: true, project: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/projects/:id', async (req, res) => {
  try {
    const result = await db.deleteProject(req.params.id);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Share with Colleague
app.post('/api/projects/:id/share', async (req, res) => {
  try {
    const { sharedBy, sharedToEmail, permission } = req.body;
    const share = await db.createShare({
      projectId: req.params.id,
      sharedBy,
      sharedToEmail,
      permission: permission || 'copy'
    });
    res.json({ success: true, share });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Fork Project: "Colleague Works in Copy"
// ═══════════════════════════════════════════════════════════════════════════════
app.post('/api/projects/:id/fork', async (req, res) => {
  try {
    const { colleagueUser, senderUser } = req.body;
    if (!colleagueUser || !colleagueUser.name) {
      return res.status(400).json({ success: false, error: 'Colleague user information required' });
    }
    const forkResult = await db.forkProjectForColleague(req.params.id, colleagueUser, senderUser);
    res.json({ success: true, ...forkResult });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
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
