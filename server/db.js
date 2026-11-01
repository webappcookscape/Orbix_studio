// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — PostgreSQL Data Layer
// ═══════════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const ROOT_DIR = path.join(__dirname, '..');
require('dotenv').config({ path: path.join(ROOT_DIR, '.env') });
require('dotenv').config();
const { Pool } = require('pg');

const DATA_DIR = path.join(ROOT_DIR, 'db');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const LOCAL_STORE_PATH = path.join(DATA_DIR, 'local_store.json');
const SCHEMA_PATH = path.join(DATA_DIR, 'schema.sql');

// Default Seeds
const DEFAULT_USERS = [
  {
    id: 'usr_admin',
    name: 'Cookscape Admin',
    username: 'admin',
    email: 'admin@cookscape.com',
    password: 'admin123',
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
    password: 'admin123',
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
    password: '123456',
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
    password: '123456',
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
    created_by: 'usr_elakkiya',
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
    created_by: 'usr_aravind',
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
    this.pgPool = null;
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
        parsed.users = parsed.users.filter(u =>
          u.id !== 'usr_dev' &&
          u.id !== 'usr_alex' &&
          u.id !== 'usr_priya' &&
          u.email !== 'dev@orbixstudio.io' &&
          u.email !== 'alex@orbixstudio.io' &&
          u.email !== 'priya@orbixstudio.io' &&
          u.email !== 'alex@modularedge.com' &&
          u.email !== 'priya@archform.in'
        );

        // Preserve other users; normalize only the four known accounts.
        parsed.users = parsed.users.map(existing => {
          const defU = DEFAULT_USERS.find(u =>
            u.id === existing.id ||
            (u.email && u.email.toLowerCase() === existing.email?.toLowerCase()) ||
            (u.name && u.name.toLowerCase() === existing.name?.toLowerCase())
          );

          if (!defU) return existing;

          return {
            ...existing,
            ...defU,
            password: existing.password || defU.password
          };
        });

        // Add any default accounts that are missing.
        for (const defU of DEFAULT_USERS) {
          if (!parsed.users.some(u => u.id === defU.id)) {
            parsed.users.push(defU);
          }
        }

        // Correct local project owner IDs using the owner details.
        parsed.projects = (parsed.projects || []).map(p => {
          const owner = DEFAULT_USERS.find(u =>
            (p.owner_email &&
              u.email.toLowerCase() === p.owner_email.toLowerCase()) ||
            (p.owner_name &&
              u.name.toLowerCase() === p.owner_name.toLowerCase())
          );

          return owner
            ? {
                ...p,
                created_by: owner.id,
                owner_name: owner.name,
                owner_email: owner.email
              }
            : p;
        });
      }

      this.saveLocalStore(parsed);
      return parsed;

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

  this.saveLocalStore(initial);
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
  // Prevent overlapping initialization attempts
  if (this.pgInitInProgress) {
    return;
  }

  this.pgInitInProgress = true;

  let client = null;

  const connectionString = process.env.DATABASE_URL ||
    `postgresql://${process.env.PGUSER || 'postgres'}:${process.env.PGPASSWORD || 'postgres'}@${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE || 'cupboard_cad'}`;

  try {
    // Create the pool only once. Reuse it during retries.
    if (!this.pgPool) {
      this.pgPool = new Pool({
        connectionString,
        max: 5,
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 10000
      });
    }

    // Test connection
    client = await this.pgPool.connect();

    console.log('✓ Successfully connected to PostgreSQL server!');

    // Run schema
    if (fs.existsSync(SCHEMA_PATH)) {
      const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf-8');
      await client.query(schemaSql);
      console.log('✓ PostgreSQL schema verified/applied.');
    }

    // Purge obsolete demo accounts
    await client.query(
      "DELETE FROM users WHERE id IN ('usr_dev', 'usr_alex', 'usr_priya') OR email IN ('dev@orbixstudio.io', 'alex@orbixstudio.io', 'priya@orbixstudio.io', 'alex@modularedge.com', 'priya@archform.in')"
    );

    // Ensure all 4 Cookscape team accounts exist
   // Ensure default users exist without overwriting existing accounts.
for (const u of DEFAULT_USERS) {
  await client.query(
    `INSERT INTO users (
      id, name, username, email, password,
      role, designation, company, avatar
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT DO NOTHING`,
    [
      u.id,
      u.name,
      u.username,
      u.email,
      u.password,
      u.role,
      u.designation,
      u.company,
      u.avatar
    ]
  );
}

    // Check whether projects need initial seeding
    const projRes = await client.query(
      'SELECT count(*) FROM projects'
    );

    if (parseInt(projRes.rows[0].count, 10) === 0) {
      console.log('Seeding initial PostgreSQL project records...');

      for (const p of this.localStore.projects || DEFAULT_PROJECTS) {
        await client.query(
          `INSERT INTO projects (
            id, title, client, type, status, created_by,
            owner_name, owner_email, units_count, boards_est,
            data, is_shared, fork_count, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
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
            JSON.stringify(p.data),
            p.is_shared,
            p.fork_count,
            p.created_at,
            p.updated_at
          ]
        );
      }

      console.log('✓ Initial PostgreSQL seed completed.');
    }

    // Mark PostgreSQL live only after initialization succeeds
    this.isPgConnected = true;
    this.pgError = null;

    console.log('✓ PostgreSQL initialization completed successfully.');

  } catch (err) {
    this.isPgConnected = false;
    this.pgError = err.message;

    console.error(
      `ℹ PostgreSQL status: ${err.message}. Local sync store active.`
    );

    // Schedule only one retry
    if (!this.pgRetryTimer) {
      this.pgRetryTimer = setTimeout(() => {
        this.pgRetryTimer = null;
        this.initPostgreSQL();
      }, 15000);
    }

  } finally {
    // Always release the manually acquired client
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
        const res = await this.pgPool.query('SELECT * FROM users ORDER BY name ASC');
        return res.rows;
      } catch (err) {
        console.error('PostgreSQL getUsers error, falling back to local store:', err.message);
      }
    }
    return this.localStore.users || [];
  }

  async createUser(userData) {
    const id = userData.id || ('usr_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6));
    const name = userData.name || 'New Employee';
    const email = userData.email || `${id}@orbixstudio.io`;
    const username = (userData.username || name.toLowerCase().replace(/[^a-z0-9]/g, '') || id).trim();
    const password = userData.password || '123456';
    const role = (userData.role === 'admin') ? 'admin' : 'employee';
    const designation = userData.designation || 'Modular Designer';
    const company = userData.company || 'Orbix Studio';
    const avatar = userData.avatar || name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

    const user = { id, name, username, email, password, role, designation, company, avatar, created_at: new Date().toISOString() };

    // Update local store
    this.localStore.users = this.localStore.users || [];
    const idx = this.localStore.users.findIndex(u => u.id === id || u.email === email || (username && u.username === username));
    if (idx >= 0) {
      this.localStore.users[idx] = { ...this.localStore.users[idx], ...user };
    } else {
      this.localStore.users.push(user);
    }
    this.saveLocalStore();

    if (this.isPgConnected) {
      try {
        await this.pgPool.query(
          `INSERT INTO users (id, name, username, email, password, role, designation, company, avatar)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO UPDATE SET
             name = $2, username = $3, email = $4, password = $5, role = $6, designation = $7, company = $8, avatar = $9`,
          [id, name, username, email, password, role, designation, company, avatar]
        );
      } catch (err) {
        console.error('PostgreSQL createUser error:', err.message);
      }
    }

    return user;
  }

  async updateUser(id, updates) {
    if (!id) throw new Error('User ID is required');

    let user = await this.getUser(id);
    if (!user) throw new Error('User not found');

    const name = (updates.name !== undefined && updates.name !== null) ? updates.name.trim() : user.name;
    const username = (updates.username !== undefined && updates.username !== null) ? updates.username.trim() : (user.username || user.id);
    const email = (updates.email !== undefined && updates.email !== null) ? updates.email.trim() : user.email;
    const designation = (updates.designation !== undefined && updates.designation !== null) ? updates.designation.trim() : (user.designation || 'Modular Designer');
    const company = (updates.company !== undefined && updates.company !== null) ? updates.company.trim() : (user.company || 'Orbix Studio');

    // Only update password if non-empty string is provided
    let password = user.password || '123456';
    if (updates.password && updates.password.trim() !== '') {
      password = updates.password.trim();
    }

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

    const updatedUser = {
      ...user,
      name,
      username,
      email,
      password,
      role,
      designation,
      company,
      avatar,
      updated_at: new Date().toISOString()
    };

    // Update in localStore
    this.localStore.users = this.localStore.users || [];
    const idx = this.localStore.users.findIndex(u => u.id === id);
    if (idx >= 0) {
      this.localStore.users[idx] = updatedUser;
    } else {
      this.localStore.users.push(updatedUser);
    }
    this.saveLocalStore();

    // Update in PostgreSQL
    if (this.isPgConnected) {
      try {
        const query = `
          UPDATE users SET
            name = $2,
            username = $3,
            email = $4,
            password = $5,
            role = $6,
            designation = $7,
            company = $8,
            avatar = $9
          WHERE id = $1
          RETURNING *;
        `;
        const res = await this.pgPool.query(query, [id, name, username, email, password, role, designation, company, avatar]);
        if (res.rows && res.rows.length) {
          return res.rows[0];
        }
      } catch (err) {
        console.error('PostgreSQL updateUser error:', err.message);
      }
    }

    return updatedUser;
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

    // Delete in PostgreSQL
    if (this.isPgConnected) {
      try {
        await this.pgPool.query('DELETE FROM users WHERE id = $1', [id]);
      } catch (err) {
        console.error('PostgreSQL deleteUser error:', err.message);
        throw err;
      }
    }

    // Delete in localStore
    if (this.localStore.users) {
      this.localStore.users = this.localStore.users.filter(u => u.id !== id);
    }
    if (this.localStore.projects) {
      this.localStore.projects.forEach(p => {
        if (p.created_by === id) {
          p.created_by = null;
        }
      });
    }
    this.saveLocalStore();

    return { success: true, id };
  }

  async authenticateUser(identifier, password) {
    if (!identifier || !password) return null;
    const cleanId = identifier.trim().toLowerCase();
    const cleanPw = password.trim();

    let user = null;
    if (this.isPgConnected) {
      try {
        const res = await this.pgPool.query(
          'SELECT * FROM users WHERE LOWER(email) = $1 OR LOWER(username) = $1 OR LOWER(name) = $1 LIMIT 1',
          [cleanId]
        );
        if (res.rows.length) {
          const u = res.rows[0];
          if (u.password === cleanPw || (!u.password && cleanPw === '123456')) {
            user = u;
          }
        }
      } catch (err) {
        console.error('PostgreSQL authenticateUser error:', err.message);
      }
    }

    if (!user && !this.isPgConnected) {
      const users = this.localStore.users || DEFAULT_USERS;
      const found = users.find(u =>
        (u.email && u.email.toLowerCase() === cleanId) ||
        (u.username && u.username.toLowerCase() === cleanId) ||
        (u.name && u.name.toLowerCase() === cleanId)
      );
      if (found && (found.password === cleanPw || (!found.password && cleanPw === '123456'))) {
        user = found;
      }
    }

    return user;
  }

  async getUser(id) {
    if (!id) return null;
    const users = await this.getUsers();
    return users.find(u => u.id === id) || null;
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

        // Each account has their own project!
        // Admin: can see all projects or filter by mine / specific employee
        // Employee: ONLY sees projects created by them (or shared directly to their email)
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
          // Employee: strictly their own projects or shared directly to their email
          if (userId) {
            query += ` AND (created_by = $${pIndex} OR id IN (SELECT project_id FROM project_shares WHERE shared_to_email = (SELECT email FROM users WHERE id = $${pIndex} LIMIT 1)))`;
            params.push(userId);
            pIndex++;
          } else {
            query += ` AND 1=0`; // If no userId provided for employee, return empty
          }
        }

        query += ' ORDER BY updated_at DESC';
        const res = await this.pgPool.query(query, params);
        projects = res.rows;
      } catch (err) {
        console.error('PostgreSQL getProjects error, falling back:', err.message);
        projects = this.localStore.projects || [];
      }
    } else {
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

      // If shared with this user from another creator, ensure shareNotice exists
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
    if (this.isPgConnected) {
      try {
        const res = await this.pgPool.query('SELECT * FROM projects WHERE id = $1', [id]);
        if (res.rows.length) return res.rows[0];
      } catch (err) {
        console.error('PostgreSQL getProject error:', err.message);
      }
    }
    return (this.localStore.projects || []).find(p => p.id === id) || null;
  }

  async createProject(projectData, currentUser) {
    const id = projectData.id || ('proj_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6));
    const now = new Date().toISOString();
    const ownerName = currentUser ? currentUser.name : (projectData.owner_name || 'Design Lead');
    const ownerEmail = currentUser ? currentUser.email : (projectData.owner_email || 'design@orbixstudio.io');
    const createdBy = currentUser ? currentUser.id : (projectData.created_by || 'usr_admin');

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

    // Update local store
    this.localStore.projects = this.localStore.projects || [];
    this.localStore.projects.unshift(project);
    this.saveLocalStore();

    if (this.isPgConnected) {
      try {
        await this.pgPool.query(
          `INSERT INTO projects (id, title, client, type, status, created_by, owner_name, owner_email, units_count, boards_est, data, is_shared, fork_count, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
          [project.id, project.title, project.client, project.type, project.status, project.created_by, project.owner_name, project.owner_email, project.units_count, project.boards_est, JSON.stringify(project.data), project.is_shared, project.fork_count, project.created_at, project.updated_at]
        );
      } catch (err) {
        console.error('PostgreSQL createProject error:', err.message);
      }
    }

    return project;
  }

  async updateProject(id, updates) {
    const now = new Date().toISOString();
    let updatedProject = null;

    // Update local store
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
          updatedProject = res.rows[0];
        } else {
          // If project was not yet in PostgreSQL, upsert it from localStore
          const lp = (this.localStore.projects || []).find(p => p.id === id);
          if (lp) {
            await this.pgPool.query(
              `INSERT INTO projects (id, title, client, type, status, created_by, owner_name, owner_email, units_count, boards_est, data, is_shared, fork_count, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
               ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, units_count = EXCLUDED.units_count, updated_at = EXCLUDED.updated_at`,
              [lp.id, lp.title || 'Untitled', lp.client || '', lp.type || 'residential', lp.status || 'draft', lp.created_by || 'usr_admin', lp.owner_name || 'Design Lead', lp.owner_email || 'admin@cookscape.com', lp.units_count || 0, lp.boards_est || 0, JSON.stringify(lp.data || {}), lp.is_shared || false, lp.fork_count || 0, lp.created_at || now, now]
            );
          }
        }
      } catch (err) {
        console.error('PostgreSQL updateProject error:', err.message);
      }
    }

    return updatedProject;
  }

  async deleteProject(id) {
    this.localStore.projects = (this.localStore.projects || []).filter(p => p.id !== id);
    this.saveLocalStore();

    if (this.isPgConnected) {
      try {
        await this.pgPool.query('DELETE FROM projects WHERE id = $1', [id]);
      } catch (err) {
        console.error('PostgreSQL deleteProject error:', err.message);
      }
    }
    return { success: true, id };
  }

  // ── Project Sharing & Colleague Copy (Fork) ──
  async createShare({ projectId, sharedBy, sharedToEmail = '', permission = 'copy' }) {
    const shareToken = 'sh_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
    const shareId = 'shr_' + Date.now().toString(36);
    const share = {
      id: shareId,
      project_id: projectId,
      shared_by: sharedBy,
      shared_to_email: sharedToEmail,
      permission, // 'copy' guarantees colleagues work in an isolated duplicate
      share_token: shareToken,
      created_at: new Date().toISOString()
    };

    // Mark project as shared
    await this.updateProject(projectId, { is_shared: true });

    this.localStore.shares = this.localStore.shares || [];
    this.localStore.shares.push(share);
    this.saveLocalStore();

    if (this.isPgConnected) {
      try {
        await this.pgPool.query(
          `INSERT INTO project_shares (id, project_id, shared_by, shared_to_email, permission, share_token)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [share.id, share.project_id, share.shared_by, share.shared_to_email, share.permission, share.share_token]
        );
      } catch (err) {
        console.error('PostgreSQL createShare error:', err.message);
      }
    }

    return share;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // "COLLEAGUES WORK IN COPY" — Master Fork Engine
  // Creates an isolated copy for the colleague so the original is untouched.
  // ═══════════════════════════════════════════════════════════════════════════
  async forkProjectForColleague(originalProjectId, colleagueUser, senderUser = null) {
    const original = await this.getProject(originalProjectId);
    if (!original) throw new Error('Original project not found');

    const copyTitle = `${original.title} (Copy - ${colleagueUser.name})`;
    const forkedId = 'proj_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const now = new Date().toISOString();

    // Deep clone data
    const clonedData = JSON.parse(JSON.stringify(original.data || { units: [] }));

    let sharedByName = senderUser ? senderUser.name : null;
    let sharedByDesignation = senderUser ? (senderUser.designation || 'Modular Designer') : null;

    if (!sharedByName && original.created_by) {
      const creator = await this.getUser(original.created_by);
      sharedByName = creator ? creator.name : (original.owner_name || 'A Colleague');
      sharedByDesignation = creator ? (creator.designation || 'Modular Designer') : 'Design Lead';
    }

    // Attach share notice metadata for colleague notification banner
    clonedData.shareNotice = {
      noticeId: 'sn_' + forkedId,
      sharedByName: sharedByName || 'A Colleague',
      sharedByDesignation: sharedByDesignation || 'Modular Designer',
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

    // Track fork relationship
    const forkRecord = {
      id: 'frk_' + Date.now().toString(36),
      original_project_id: original.id,
      forked_project_id: forkedId,
      forked_by: colleagueUser.id,
      forked_by_name: colleagueUser.name,
      created_at: now
    };

    // Increment fork_count on original project
    await this.updateProject(original.id, { fork_count: (original.fork_count || 0) + 1 });

    // Save forked project to local store
    this.localStore.projects = this.localStore.projects || [];
    this.localStore.projects.unshift(forkedProject);
    this.localStore.forks = this.localStore.forks || [];
    this.localStore.forks.push(forkRecord);
    this.saveLocalStore();

    if (this.isPgConnected) {
      try {
        await this.pgPool.query(
          `INSERT INTO projects (id, title, client, type, status, created_by, owner_name, owner_email, units_count, boards_est, data, is_shared, fork_count, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
          [forkedProject.id, forkedProject.title, forkedProject.client, forkedProject.type, forkedProject.status, forkedProject.created_by, forkedProject.owner_name, forkedProject.owner_email, forkedProject.units_count, forkedProject.boards_est, JSON.stringify(forkedProject.data), forkedProject.is_shared, forkedProject.fork_count, forkedProject.created_at, forkedProject.updated_at]
        );
        await this.pgPool.query(
          `INSERT INTO project_forks (id, original_project_id, forked_project_id, forked_by, forked_by_name)
           VALUES ($1, $2, $3, $4, $5)`,
          [forkRecord.id, forkRecord.original_project_id, forkRecord.forked_project_id, forkRecord.forked_by, forkRecord.forked_by_name]
        );
      } catch (err) {
        console.error('PostgreSQL forkProject error:', err.message);
      }
    }

    return {
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
