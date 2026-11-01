// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — PostgreSQL Data Layer
// ═══════════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const ROOT_DIR = path.join(__dirname, '..');
require('dotenv').config({ path: path.join(ROOT_DIR, '.env') });
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(ROOT_DIR, 'db');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const LOCAL_STORE_PATH = path.join(DATA_DIR, 'local_store.json');
const SCHEMA_PATH = path.join(DATA_DIR, 'schema.sql');

// Helper to remove password hashes from user objects before returning to clients
function sanitizeUser(user) {
  if (!user) return null;
  const safe = { ...user };
  delete safe.password;
  return safe;
}

// Fallback seeds used only for initial dev bootstrap if database has 0 projects
const DEFAULT_USERS = [
  {
    id: 'usr_admin',
    name: 'Cookscape Admin',
    username: 'admin',
    email: 'admin@cookscape.com',
    role: 'admin',
    designation: 'System Administrator',
    company: 'Cookscape',
    avatar: 'CA'
  },
  {
    id: 'usr_mvwe6obve1ks',
    name: 'Sangathamizh',
    username: 'ST',
    email: 'designteam.cookscape@gmail.com',
    role: 'admin',
    designation: 'Business Head',
    company: 'Cookscape',
    avatar: 'S'
  },
  {
    id: 'usr_mvweb77exij0',
    name: 'Elakkiya',
    username: 'elakkiya',
    email: 'elakkiya.sakthivelu3089@gmail.com',
    role: 'employee',
    designation: 'Floor Architect / FA',
    company: 'Cookscape',
    avatar: 'E'
  },
  {
    id: 'usr_mvxh5at49a9d',
    name: 'Aravind',
    username: 'aravind',
    email: 'webapp.cookscape@gmail.com',
    role: 'employee',
    designation: 'Floor Architect / FA',
    company: 'Cookscape',
    avatar: 'A'
  }
];

const DEFAULT_PROJECTS = [
  {
    id: 'proj_hiranandani',
    title: 'Hiranandani Villa — Master Wardrobe & Loft',
    client: 'Rajesh & Sunita Singhania',
    type: 'Wardrobe',
    status: 'In Review',
    created_by: 'usr_admin',
    owner_name: 'Cookscape Admin',
    owner_email: 'admin@cookscape.com',
    units_count: 3,
    boards_est: 12,
    data: {
      units: [
        { label: 'Master 3-Door Hinged Wardrobe', kind: 'wardrobe', w: 1800, h: 2100, d: 600, lam: 'Walnut Plank' },
        { label: 'Overhead Storage Loft Run', kind: 'loft', w: 1800, h: 600, d: 600, lam: 'Off-White Matte' }
      ]
    },
    is_shared: true,
    fork_count: 2,
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 2).toISOString()
  },
  {
    id: 'proj_emerald',
    title: 'Emerald Greens — Parallel Acrylic Kitchen',
    client: 'Vikram Mehta',
    type: 'Kitchen',
    status: 'CNC Ready',
    created_by: 'usr_mvweb77exij0',
    owner_name: 'Elakkiya',
    owner_email: 'elakkiya.sakthivelu3089@gmail.com',
    units_count: 6,
    boards_est: 18,
    data: {
      units: [
        { label: 'Base Unit 2-Drawer Pot & Pan', kind: 'base', w: 900, h: 870, d: 600, lam: 'Sage Green Matte' },
        { label: 'Sink Base Unit 2-Shutter', kind: 'base', w: 900, h: 870, d: 600, lam: 'Sage Green Matte' },
        { label: 'Overhead Wall Glass Lift-Up', kind: 'wall', w: 900, h: 720, d: 350, lam: 'Fluted Glass' }
      ]
    },
    is_shared: false,
    fork_count: 0,
    created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 12).toISOString()
  },
  {
    id: 'proj_palm_tv',
    title: 'Palm Beach Penthouse — Fluted Walnut Media Wall',
    client: 'Ananya Deshmukh',
    type: 'TV Wall',
    status: 'Draft',
    created_by: 'usr_mvxh5at49a9d',
    owner_name: 'Aravind',
    owner_email: 'webapp.cookscape@gmail.com',
    units_count: 2,
    boards_est: 8,
    data: {
      units: [
        { label: 'Floating Media Console with 3 Drawers', kind: 'base', w: 2400, h: 400, d: 450, lam: 'Smoked Walnut' },
        { label: 'Acoustic Fluted Panelling Backdrop', kind: 'wall', w: 2400, h: 2200, d: 50, lam: 'Smoked Walnut' }
      ]
    },
    is_shared: true,
    fork_count: 1,
    created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
    updated_at: new Date().toISOString()
  }
];

class DBManager {
  constructor() {
    this.connectionString = process.env.DATABASE_URL ||
      `postgresql://${process.env.PGUSER || 'postgres'}:${process.env.PGPASSWORD || 'postgres'}@${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE || 'cupboard_cad'}`;

    // Create a singleton PostgreSQL pool immediately with a strict max of 5 connections
    this.pgPool = new Pool({
      connectionString: this.connectionString,
      max: 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 10000,
      allowExitOnIdle: false
    });

    this.pgPool.on('error', (err) => {
      console.error('PostgreSQL unexpected pool error:', err.message);
    });

    this.isPgConnected = false;
    this.pgError = null;
    this.pgInitInProgress = false;
    this.pgRetryTimer = null;

    this.localStore = this.loadLocalStore();
    this.initPostgreSQL();
  }

  loadLocalStore() {
    if (fs.existsSync(LOCAL_STORE_PATH)) {
      try {
        const raw = fs.readFileSync(LOCAL_STORE_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.users)) {
          for (const defU of DEFAULT_USERS) {
            if (!parsed.users.some(u => u.id === defU.id || (u.email && u.email.toLowerCase() === defU.email.toLowerCase()))) {
              parsed.users.push(defU);
            }
          }
        }
        return parsed || { users: DEFAULT_USERS, projects: DEFAULT_PROJECTS, shares: [], forks: [] };
      } catch (e) {
        console.warn('Could not read local store, creating fresh:', e.message);
      }
    }

    const initial = {
      users: DEFAULT_USERS,
      projects: DEFAULT_PROJECTS,
      shares: [],
      forks: []
    };
    return initial;
  }

  saveLocalStore(data) {
    // If PostgreSQL is connected and operating as live DB, do not write to local_store.json
    if (this.isPgConnected) {
      return;
    }
    try {
      fs.writeFileSync(LOCAL_STORE_PATH, JSON.stringify(data || this.localStore, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to write local store:', e.message);
    }
  }

  async initPostgreSQL() {
    if (this.pgInitInProgress) {
      return;
    }

    this.pgInitInProgress = true;
    let client = null;

    try {
      client = await this.pgPool.connect();
      console.log('✓ Connected to PostgreSQL.');

      // Apply existing schema if file exists
      if (fs.existsSync(SCHEMA_PATH)) {
        const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf-8');
        if (schemaSql.trim()) {
          await client.query(schemaSql);
        }
        console.log('✓ PostgreSQL schema verified/applied.');
      }

      // Seed projects ONLY when the PostgreSQL database has zero projects
      const projRes = await client.query('SELECT COUNT(*) FROM projects');
      if (parseInt(projRes.rows[0].count, 10) === 0) {
        console.log('Seeding initial PostgreSQL projects...');
        for (const p of this.localStore.projects || DEFAULT_PROJECTS) {
          await client.query(
            `INSERT INTO projects
              (id, title, client, type, status, created_by,
               owner_name, owner_email, units_count, boards_est,
               data, is_shared, fork_count, created_at, updated_at)
             VALUES
              ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
               $11, $12, $13, $14, $15)
             ON CONFLICT (id) DO NOTHING`,
            [
              p.id,
              p.title,
              p.client,
              p.type,
              p.status,
              p.created_by,
              p.owner_name,
              p.owner_email,
              p.units_count,
              p.boards_est,
              JSON.stringify(p.data || {}),
              p.is_shared || false,
              p.fork_count || 0,
              p.created_at || new Date().toISOString(),
              p.updated_at || new Date().toISOString()
            ]
          );
        }
        console.log('✓ Initial PostgreSQL project seed completed.');
      }

      this.isPgConnected = true;
      this.pgError = null;
      console.log('✓ PostgreSQL initialization completed.');

    } catch (err) {
      this.isPgConnected = false;
      const errMsg = err.message || String(err);
      this.pgError = errMsg;
      console.error(`PostgreSQL initialization notice: ${errMsg}`);

      // Schedule one retry attempt if not already scheduled
      if (!this.pgRetryTimer) {
        this.pgRetryTimer = setTimeout(() => {
          this.pgRetryTimer = null;
          this.initPostgreSQL();
        }, 15000);

        if (this.pgRetryTimer.unref) {
          this.pgRetryTimer.unref();
        }
      }
    } finally {
      if (client) {
        client.release();
      }
      this.pgInitInProgress = false;
    }
  }

  // ── User Methods ──
  async getUsers() {
    if (this.isPgConnected) {
      try {
        const res = await this.pgPool.query(
          'SELECT id, name, username, email, role, designation, company, avatar, created_at, updated_at FROM users ORDER BY name ASC'
        );
        return res.rows.map(sanitizeUser);
      } catch (err) {
        console.error('PostgreSQL getUsers error:', err.message);
        throw new Error('Database query failed: ' + err.message);
      }
    }
    // Fail closed in production, or fallback to sanitized local store if offline
    if (process.env.NODE_ENV === 'production') {
      throw new Error('PostgreSQL database is currently unavailable.');
    }
    return (this.localStore.users || []).map(sanitizeUser);
  }

  async getUser(id) {
    if (!id) return null;
    if (this.isPgConnected) {
      try {
        const res = await this.pgPool.query(
          'SELECT id, name, username, email, role, designation, company, avatar, created_at, updated_at FROM users WHERE id = $1 LIMIT 1',
          [id]
        );
        if (res.rows.length) {
          return sanitizeUser(res.rows[0]);
        }
        return null;
      } catch (err) {
        console.error('PostgreSQL getUser error:', err.message);
        throw new Error('Database query failed: ' + err.message);
      }
    }
    if (process.env.NODE_ENV === 'production') {
      throw new Error('PostgreSQL database is currently unavailable.');
    }
    const found = (this.localStore.users || []).find(u => u.id === id);
    return sanitizeUser(found);
  }

  async authenticateUser(identifier, password) {
    if (!identifier || !password) return null;
    const cleanId = identifier.trim().toLowerCase();
    // NEVER trim or modify passwords
    const cleanPw = password;

    let user = null;
    if (this.isPgConnected) {
      try {
        const res = await this.pgPool.query(
          'SELECT * FROM users WHERE LOWER(email) = $1 OR LOWER(username) = $1 OR LOWER(name) = $1 LIMIT 1',
          [cleanId]
        );
        if (res.rows.length) {
          const u = res.rows[0];
          let isMatch = false;

          // Check if password in DB is a bcrypt hash ($2a$ or $2b$)
          if (u.password && (u.password.startsWith('$2a$') || u.password.startsWith('$2b$'))) {
            isMatch = bcrypt.compareSync(cleanPw, u.password);
          } else {
            // Legacy plaintext comparison
            isMatch = (u.password === cleanPw || (!u.password && cleanPw === '123456'));
            if (isMatch) {
              // Migrate legacy plaintext password to secure bcrypt hash
              try {
                const newHash = bcrypt.hashSync(cleanPw, 10);
                await this.pgPool.query('UPDATE users SET password = $1 WHERE id = $2', [newHash, u.id]);
                console.log(`✓ Upgraded password for user ${u.id} to bcrypt hash.`);
              } catch (migrationErr) {
                console.error('Password hash migration notice:', migrationErr.message);
              }
            }
          }

          if (isMatch) {
            user = sanitizeUser(u);
          }
        }
      } catch (err) {
        console.error('PostgreSQL authenticateUser error:', err.message);
        throw new Error('Authentication database error: ' + err.message);
      }
    } else {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('PostgreSQL database is currently unavailable.');
      }
      const users = this.localStore.users || DEFAULT_USERS;
      const found = users.find(u =>
        (u.email && u.email.toLowerCase() === cleanId) ||
        (u.username && u.username.toLowerCase() === cleanId) ||
        (u.name && u.name.toLowerCase() === cleanId)
      );
      if (found) {
        let isMatch = false;
        if (found.password && (found.password.startsWith('$2a$') || found.password.startsWith('$2b$'))) {
          isMatch = bcrypt.compareSync(cleanPw, found.password);
        } else {
          isMatch = (found.password === cleanPw || (!found.password && cleanPw === '123456'));
        }
        if (isMatch) {
          user = sanitizeUser(found);
        }
      }
    }

    return user;
  }

  async createUser(userData) {
    const id = userData.id || ('usr_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6));
    const name = (userData.name || 'New Employee').trim();
    const email = (userData.email || `${id}@orbixstudio.io`).trim().toLowerCase();
    const username = (userData.username || name.toLowerCase().replace(/[^a-z0-9]/g, '') || id).trim();
    
    // Hash password using bcrypt
    const rawPassword = userData.password || '123456';
    const hashedPassword = bcrypt.hashSync(rawPassword, 10);

    const role = (userData.role === 'admin') ? 'admin' : 'employee';
    const designation = (userData.designation || 'Modular Designer').trim();
    const company = (userData.company || 'Cookscape').trim();
    const avatar = (userData.avatar || name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)).trim();

    if (this.isPgConnected) {
      try {
        const query = `
          INSERT INTO users (id, name, username, email, password, role, designation, company, avatar)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id, name, username, email, role, designation, company, avatar, created_at;
        `;
        const res = await this.pgPool.query(query, [id, name, username, email, hashedPassword, role, designation, company, avatar]);
        return sanitizeUser(res.rows[0]);
      } catch (err) {
        console.error('PostgreSQL createUser error:', err.message);
        throw new Error('Failed to create user in database: ' + err.message);
      }
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error('PostgreSQL database is currently unavailable.');
    }

    const user = { id, name, username, email, password: hashedPassword, role, designation, company, avatar, created_at: new Date().toISOString() };
    this.localStore.users = this.localStore.users || [];
    this.localStore.users.push(user);
    this.saveLocalStore();
    return sanitizeUser(user);
  }

  async updateUser(id, updates) {
    if (!id) throw new Error('User ID is required');

    let user = await this.getUser(id);
    if (!user) throw new Error('User not found');

    const name = (updates.name !== undefined && updates.name !== null) ? updates.name.trim() : user.name;
    const username = (updates.username !== undefined && updates.username !== null) ? updates.username.trim() : (user.username || user.id);
    const email = (updates.email !== undefined && updates.email !== null) ? updates.email.trim().toLowerCase() : user.email;
    const designation = (updates.designation !== undefined && updates.designation !== null) ? updates.designation.trim() : (user.designation || 'Modular Designer');
    const company = (updates.company !== undefined && updates.company !== null) ? updates.company.trim() : (user.company || 'Cookscape');

    // Protect primary admin from role demotion
    let role = user.role || 'employee';
    if (id === 'usr_admin' || (user.email && user.email.toLowerCase() === 'admin@cookscape.com')) {
      role = 'admin';
    } else if (updates.role !== undefined && updates.role !== null) {
      role = (updates.role === 'admin') ? 'admin' : 'employee';
    }

    let avatar = updates.avatar;
    if (!avatar && name) {
      avatar = name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    }
    if (!avatar) avatar = user.avatar || 'US';

    if (this.isPgConnected) {
      try {
        let query;
        let params;
        if (updates.password && updates.password.trim() !== '') {
          const hashedPassword = bcrypt.hashSync(updates.password, 10);
          query = `
            UPDATE users SET
              name = $2, username = $3, email = $4, password = $5, role = $6, designation = $7, company = $8, avatar = $9, updated_at = NOW()
            WHERE id = $1
            RETURNING id, name, username, email, role, designation, company, avatar, created_at, updated_at;
          `;
          params = [id, name, username, email, hashedPassword, role, designation, company, avatar];
        } else {
          query = `
            UPDATE users SET
              name = $2, username = $3, email = $4, role = $5, designation = $6, company = $7, avatar = $8, updated_at = NOW()
            WHERE id = $1
            RETURNING id, name, username, email, role, designation, company, avatar, created_at, updated_at;
          `;
          params = [id, name, username, email, role, designation, company, avatar];
        }

        const res = await this.pgPool.query(query, params);
        if (res.rows && res.rows.length) {
          return sanitizeUser(res.rows[0]);
        }
        throw new Error('User not found in database');
      } catch (err) {
        console.error('PostgreSQL updateUser error:', err.message);
        throw new Error('Failed to update user in database: ' + err.message);
      }
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error('PostgreSQL database is currently unavailable.');
    }

    const updatedUser = { ...user, name, username, email, role, designation, company, avatar, updated_at: new Date().toISOString() };
    const idx = (this.localStore.users || []).findIndex(u => u.id === id);
    if (idx >= 0) {
      this.localStore.users[idx] = { ...this.localStore.users[idx], ...updatedUser };
      if (updates.password && updates.password.trim() !== '') {
        this.localStore.users[idx].password = bcrypt.hashSync(updates.password, 10);
      }
    }
    this.saveLocalStore();
    return sanitizeUser(updatedUser);
  }

  async deleteUser(id) {
    if (!id) throw new Error('User ID is required');

    // Protect primary admin
    if (id === 'usr_admin') {
      throw new Error('Primary administrator account cannot be deleted');
    }

    const user = await this.getUser(id);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.email && user.email.toLowerCase() === 'admin@cookscape.com') {
      throw new Error('Primary administrator account cannot be deleted');
    }

    if (this.isPgConnected) {
      try {
        await this.pgPool.query('DELETE FROM users WHERE id = $1', [id]);
      } catch (err) {
        console.error('PostgreSQL deleteUser error:', err.message);
        throw new Error('Failed to delete user in database: ' + err.message);
      }
    } else {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('PostgreSQL database is currently unavailable.');
      }
      if (this.localStore.users) {
        this.localStore.users = this.localStore.users.filter(u => u.id !== id);
      }
      this.saveLocalStore();
    }

    return { success: true, id };
  }

  // ── Project Methods ──
  async getProjects({ search = '', filter = 'all', userId = '', userRole = '' } = {}) {
    let projects = [];
    const isAdmin = userRole === 'admin';

    if (this.isPgConnected) {
      try {
        let query = 'SELECT * FROM projects WHERE 1=1';
        const params = [];
        let pIndex = 1;

        if (search) {
          query += ` AND (title ILIKE $${pIndex} OR client ILIKE $${pIndex} OR owner_name ILIKE $${pIndex})`;
          params.push(`%${search}%`);
          pIndex++;
        }

        if (isAdmin) {
          if (filter === 'mine' && userId) {
            query += ` AND created_by = $${pIndex}`;
            params.push(userId);
            pIndex++;
          } else if (filter && filter !== 'all') {
            query += ` AND created_by = $${pIndex}`;
            params.push(filter);
            pIndex++;
          }
        } else {
          // Employee: strictly their own projects OR projects explicitly shared to their email
          if (userId) {
            query += ` AND (created_by = $${pIndex} OR id IN (SELECT project_id FROM project_shares WHERE shared_to_email = (SELECT email FROM users WHERE id = $${pIndex} LIMIT 1)))`;
            params.push(userId);
            pIndex++;
          } else {
            query += ` AND 1=0`;
          }
        }

        query += ' ORDER BY updated_at DESC';
        const res = await this.pgPool.query(query, params);
        projects = res.rows;
      } catch (err) {
        console.error('PostgreSQL getProjects error:', err.message);
        throw new Error('Failed to retrieve projects from database: ' + err.message);
      }
    } else {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('PostgreSQL database is currently unavailable.');
      }
      projects = this.localStore.projects || [];
      if (search) {
        const s = search.toLowerCase();
        projects = projects.filter(p =>
          (p.title && p.title.toLowerCase().includes(s)) ||
          (p.client && p.client.toLowerCase().includes(s)) ||
          (p.owner_name && p.owner_name.toLowerCase().includes(s))
        );
      }
      if (isAdmin) {
        if (filter === 'mine' && userId) {
          projects = projects.filter(p => p.created_by === userId);
        } else if (filter && filter !== 'all') {
          projects = projects.filter(p => p.created_by === filter);
        }
      } else {
        if (userId) {
          projects = projects.filter(p => p.created_by === userId);
        } else {
          projects = [];
        }
      }
      projects.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    }

    projects = projects.map(p => {
      let data = p.data;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch (e) { data = {}; }
      }
      data = data || {};

      if (userId && p.created_by !== userId && !data.shareNotice) {
        data.shareNotice = {
          noticeId: 'sn_share_' + p.id,
          sharedByName: p.owner_name || 'A Colleague',
          sharedByDesignation: 'Modular Designer',
          originalTitle: p.title
        };
      }
      return { ...p, data };
    });

    return projects;
  }

  async getProject(id) {
    if (!id) return null;
    if (this.isPgConnected) {
      try {
        const res = await this.pgPool.query('SELECT * FROM projects WHERE id = $1 LIMIT 1', [id]);
        if (res.rows.length) {
          const p = res.rows[0];
          let data = p.data;
          if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch (e) { data = {}; }
          }
          return { ...p, data: data || {} };
        }
        return null;
      } catch (err) {
        console.error('PostgreSQL getProject error:', err.message);
        throw new Error('Failed to retrieve project: ' + err.message);
      }
    }
    if (process.env.NODE_ENV === 'production') {
      throw new Error('PostgreSQL database is currently unavailable.');
    }
    const found = (this.localStore.projects || []).find(p => p.id === id);
    if (found) {
      let data = found.data;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch (e) { data = {}; }
      }
      return { ...found, data: data || {} };
    }
    return null;
  }

  async createProject(projectData, sessionUser) {
    if (!sessionUser) {
      throw new Error('Authenticated user session required to create project');
    }

    const id = projectData.id || ('proj_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6));
    const now = new Date().toISOString();
    const ownerName = sessionUser.name;
    const ownerEmail = sessionUser.email;
    const createdBy = sessionUser.id;

    const project = {
      id,
      title: projectData.title || 'Untitled Cupboard Project',
      client: projectData.client || '',
      type: projectData.type || 'Wardrobe',
      status: projectData.status || 'Draft',
      created_by: createdBy,
      owner_name: ownerName,
      owner_email: ownerEmail,
      units_count: projectData.units_count || 1,
      boards_est: projectData.boards_est || 4,
      data: projectData.data || { units: [] },
      is_shared: false,
      fork_count: 0,
      created_at: now,
      updated_at: now
    };

    if (this.isPgConnected) {
      try {
        await this.pgPool.query(
          `INSERT INTO projects (id, title, client, type, status, created_by, owner_name, owner_email, units_count, boards_est, data, is_shared, fork_count, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
          [
            project.id, project.title, project.client, project.type, project.status,
            project.created_by, project.owner_name, project.owner_email,
            project.units_count, project.boards_est, JSON.stringify(project.data),
            project.is_shared, project.fork_count, project.created_at, project.updated_at
          ]
        );
        return project;
      } catch (err) {
        console.error('PostgreSQL createProject error:', err.message);
        throw new Error('Failed to create project in database: ' + err.message);
      }
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error('PostgreSQL database is currently unavailable.');
    }

    this.localStore.projects = this.localStore.projects || [];
    this.localStore.projects.unshift(project);
    this.saveLocalStore();
    return project;
  }

  async updateProject(id, updates, sessionUser) {
    const existing = await this.getProject(id);
    if (!existing) throw new Error('Project not found');

    // Authorization check
    if (sessionUser && sessionUser.role !== 'admin') {
      if (existing.created_by !== sessionUser.id) {
        throw new Error('Access denied: You do not have permission to edit this project.');
      }
    }

    const now = new Date().toISOString();
    let updatedProject = null;

    if (this.isPgConnected) {
      try {
        const fields = [];
        const values = [];
        let pIndex = 1;

        for (const [key, val] of Object.entries(updates)) {
          if (['title', 'client', 'type', 'status', 'units_count', 'boards_est', 'is_shared', 'fork_count'].includes(key)) {
            fields.push(`${key} = $${pIndex++}`);
            values.push(val);
          } else if (key === 'data') {
            fields.push(`data = $${pIndex++}`);
            values.push(JSON.stringify(val));
          }
        }
        fields.push(`updated_at = $${pIndex++}`);
        values.push(now);

        values.push(id);
        const q = `UPDATE projects SET ${fields.join(', ')} WHERE id = $${pIndex} RETURNING *`;
        const res = await this.pgPool.query(q, values);
        if (res.rows.length) {
          const row = res.rows[0];
          let data = row.data;
          if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch (e) { data = {}; }
          }
          return { ...row, data };
        }
        throw new Error('Project update failed in database');
      } catch (err) {
        console.error('PostgreSQL updateProject error:', err.message);
        throw new Error('Failed to update project: ' + err.message);
      }
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error('PostgreSQL database is currently unavailable.');
    }

    this.localStore.projects = this.localStore.projects || [];
    const idx = this.localStore.projects.findIndex(p => p.id === id);
    if (idx >= 0) {
      this.localStore.projects[idx] = {
        ...this.localStore.projects[idx],
        ...updates,
        updated_at: now
      };
      updatedProject = this.localStore.projects[idx];
      this.saveLocalStore();
    }
    return updatedProject;
  }

  async deleteProject(id, sessionUser) {
    const existing = await this.getProject(id);
    if (!existing) throw new Error('Project not found');

    // Authorization check
    if (sessionUser && sessionUser.role !== 'admin') {
      if (existing.created_by !== sessionUser.id) {
        throw new Error('Access denied: You do not have permission to delete this project.');
      }
    }

    if (this.isPgConnected) {
      try {
        await this.pgPool.query('DELETE FROM projects WHERE id = $1', [id]);
        return { success: true, id };
      } catch (err) {
        console.error('PostgreSQL deleteProject error:', err.message);
        throw new Error('Failed to delete project: ' + err.message);
      }
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error('PostgreSQL database is currently unavailable.');
    }

    this.localStore.projects = (this.localStore.projects || []).filter(p => p.id !== id);
    this.saveLocalStore();
    return { success: true, id };
  }

  // ── Project Sharing ──
  async createShare({ projectId, sharedToEmail = '', permission = 'copy' }, sessionUser) {
    if (!sessionUser) throw new Error('Authenticated session required to share project');

    const original = await this.getProject(projectId);
    if (!original) throw new Error('Project not found');

    if (sessionUser.role !== 'admin' && original.created_by !== sessionUser.id) {
      throw new Error('Access denied: You can only share projects that you own.');
    }

    const shareToken = 'sh_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
    const shareId = 'shr_' + Date.now().toString(36);
    const share = {
      id: shareId,
      project_id: projectId,
      shared_by: sessionUser.name,
      shared_to_email: (sharedToEmail || '').trim().toLowerCase(),
      permission: permission || 'copy',
      share_token: shareToken,
      created_at: new Date().toISOString()
    };

    if (this.isPgConnected) {
      const client = await this.pgPool.connect();
      try {
        await client.query('BEGIN');
        await client.query('UPDATE projects SET is_shared = true WHERE id = $1', [projectId]);
        await client.query(
          `INSERT INTO project_shares (id, project_id, shared_by, shared_to_email, permission, share_token)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [share.id, share.project_id, share.shared_by, share.shared_to_email, share.permission, share.share_token]
        );
        await client.query('COMMIT');
        return share;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error('PostgreSQL createShare error:', err.message);
        throw new Error('Failed to share project in database: ' + err.message);
      } finally {
        client.release();
      }
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error('PostgreSQL database is currently unavailable.');
    }

    await this.updateProject(projectId, { is_shared: true }, sessionUser);
    this.localStore.shares = this.localStore.shares || [];
    this.localStore.shares.push(share);
    this.saveLocalStore();
    return share;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // "COLLEAGUES WORK IN COPY" — Master Fork Engine
  // Transactional, verified against actual PostgreSQL user
  // ═══════════════════════════════════════════════════════════════════════════
  async forkProjectForColleague(originalProjectId, colleagueIdentifier, sessionUser) {
    if (!sessionUser) throw new Error('Authenticated session required to fork project');

    const original = await this.getProject(originalProjectId);
    if (!original) throw new Error('Original project not found');

    // Look up the colleague in database to guarantee real recipient
    let colleagueUser = null;
    const cleanId = (typeof colleagueIdentifier === 'string')
      ? colleagueIdentifier.trim().toLowerCase()
      : (colleagueIdentifier.id || colleagueIdentifier.email || '').trim().toLowerCase();

    if (this.isPgConnected) {
      try {
        const res = await this.pgPool.query(
          'SELECT id, name, username, email, designation, role FROM users WHERE id = $1 OR LOWER(email) = $1 OR LOWER(username) = $1 LIMIT 1',
          [cleanId]
        );
        if (res.rows.length) {
          colleagueUser = res.rows[0];
        }
      } catch (err) {
        console.error('PostgreSQL lookup colleague error:', err.message);
        throw new Error('Failed to verify colleague in database: ' + err.message);
      }
    } else {
      colleagueUser = (this.localStore.users || []).find(u =>
        u.id === cleanId || (u.email && u.email.toLowerCase() === cleanId) || (u.username && u.username.toLowerCase() === cleanId)
      );
    }

    if (!colleagueUser) {
      throw new Error('Recipient colleague account was not found in the studio database.');
    }

    const copyTitle = `${original.title} (Copy - ${colleagueUser.name})`;
    const forkedId = 'proj_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const now = new Date().toISOString();

    // Deep clone data so changes to fork do not affect original
    const clonedData = JSON.parse(JSON.stringify(original.data || { units: [] }));

    clonedData.shareNotice = {
      noticeId: 'sn_' + forkedId,
      sharedByName: sessionUser.name,
      sharedByDesignation: sessionUser.designation || 'Modular Designer',
      originalTitle: original.title,
      sharedAt: now
    };

    const forkedProject = {
      id: forkedId,
      title: copyTitle,
      client: original.client,
      type: original.type,
      status: 'Draft',
      created_by: colleagueUser.id,
      owner_name: colleagueUser.name,
      owner_email: colleagueUser.email,
      units_count: original.units_count,
      boards_est: original.boards_est,
      data: clonedData,
      is_shared: false,
      fork_count: 0,
      created_at: now,
      updated_at: now
    };

    const forkRecord = {
      id: 'frk_' + Date.now().toString(36),
      original_project_id: original.id,
      forked_project_id: forkedId,
      forked_by: colleagueUser.id,
      forked_by_name: colleagueUser.name,
      created_at: now
    };

    if (this.isPgConnected) {
      const client = await this.pgPool.connect();
      try {
        await client.query('BEGIN');

        // 1. Insert forked project
        await client.query(
          `INSERT INTO projects (id, title, client, type, status, created_by, owner_name, owner_email, units_count, boards_est, data, is_shared, fork_count, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
          [
            forkedProject.id, forkedProject.title, forkedProject.client, forkedProject.type, forkedProject.status,
            forkedProject.created_by, forkedProject.owner_name, forkedProject.owner_email,
            forkedProject.units_count, forkedProject.boards_est, JSON.stringify(forkedProject.data),
            forkedProject.is_shared, forkedProject.fork_count, forkedProject.created_at, forkedProject.updated_at
          ]
        );

        // 2. Track fork relationship
        await client.query(
          `INSERT INTO project_forks (id, original_project_id, forked_project_id, forked_by, forked_by_name)
           VALUES ($1, $2, $3, $4, $5)`,
          [forkRecord.id, forkRecord.original_project_id, forkRecord.forked_project_id, forkRecord.forked_by, forkRecord.forked_by_name]
        );

        // 3. Increment fork count on original
        await client.query(
          `UPDATE projects SET fork_count = COALESCE(fork_count, 0) + 1, updated_at = NOW() WHERE id = $1`,
          [original.id]
        );

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        console.error('PostgreSQL forkProject transaction error:', err.message);
        throw new Error('Failed to create colleague copy in database: ' + err.message);
      } finally {
        client.release();
      }
    } else {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('PostgreSQL database is currently unavailable.');
      }
      this.localStore.projects = this.localStore.projects || [];
      this.localStore.projects.unshift(forkedProject);
      this.localStore.forks = this.localStore.forks || [];
      this.localStore.forks.push(forkRecord);
      this.saveLocalStore();
    }

    return {
      success: true,
      project: forkedProject,
      originalTitle: original.title,
      isCopy: true,
      message: `Created an isolated copy for ${colleagueUser.name}. Edits will not modify the original project.`
    };
  }

  getStatus() {
    return {
      postgres: {
        connected: this.isPgConnected,
        error: this.pgError,
        database: process.env.PGDATABASE || 'cupboard_cad',
        host: process.env.PGHOST || 'localhost',
        port: process.env.PGPORT || 5432
      },
      liveMode: this.isPgConnected,
      mode: this.isPgConnected ? 'PostgreSQL Live Database' : 'Offline Local Store'
    };
  }
}

module.exports = new DBManager();
