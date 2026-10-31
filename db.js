// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — PostgreSQL Data Layer
// ═══════════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DATA_DIR = path.join(__dirname, 'db');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const LOCAL_STORE_PATH = path.join(DATA_DIR, 'local_store.json');
const SCHEMA_PATH = path.join(DATA_DIR, 'schema.sql');

// Default Seeds
const DEFAULT_USERS = [
  {
    id: 'usr_dev',
    name: 'Dev Kancheti',
    email: 'dev@orbixstudio.io',
    role: 'Lead Modular Designer',
    company: 'Orbix Design Studio',
    avatar: 'DK'
  },
  {
    id: 'usr_alex',
    name: 'Alex Mercer',
    email: 'alex@modularedge.com',
    role: 'Production Estimator',
    company: 'Precision Modular Works',
    avatar: 'AM'
  },
  {
    id: 'usr_priya',
    name: 'Priya Sharma',
    email: 'priya@archform.in',
    role: 'Interior Architect',
    company: 'Archform Interiors',
    avatar: 'PS'
  }
];

const DEFAULT_PROJECTS = [
  {
    id: 'proj_hiranandani',
    title: 'Hiranandani Villa — Master Wardrobe & Loft',
    client: 'Rajesh & Sunita Singhania',
    type: 'Wardrobe',
    status: 'In Review',
    created_by: 'usr_dev',
    owner_name: 'Dev Kancheti',
    owner_email: 'dev@orbixstudio.io',
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
    created_by: 'usr_alex',
    owner_name: 'Alex Mercer',
    owner_email: 'alex@modularedge.com',
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
    created_by: 'usr_priya',
    owner_name: 'Priya Sharma',
    owner_email: 'priya@archform.in',
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
    this.localStore = this.loadLocalStore();
    this.initPostgreSQL();
  }

  loadLocalStore() {
    if (fs.existsSync(LOCAL_STORE_PATH)) {
      try {
        const raw = fs.readFileSync(LOCAL_STORE_PATH, 'utf-8');
        return JSON.parse(raw);
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
    try {
      fs.writeFileSync(LOCAL_STORE_PATH, JSON.stringify(data || this.localStore, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to write local store:', e.message);
    }
  }

  async initPostgreSQL() {
    const connectionString = process.env.DATABASE_URL ||
      `postgresql://${process.env.PGUSER || 'postgres'}:${process.env.PGPASSWORD || 'postgres'}@${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE || 'cupboard_cad'}`;

    try {
      this.pgPool = new Pool({
        connectionString,
        connectionTimeoutMillis: 3500,
        idleTimeoutMillis: 10000
      });

      // Test connection
      const client = await this.pgPool.connect();
      console.log('✓ Successfully connected to PostgreSQL server!');
      this.isPgConnected = true;
      this.pgError = null;

      // Run schema
      if (fs.existsSync(SCHEMA_PATH)) {
        const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf-8');
        await client.query(schemaSql);
        console.log('✓ PostgreSQL schema verified/applied.');
      }

      // Check if we need to seed
      const userRes = await client.query('SELECT count(*) FROM users');
      if (parseInt(userRes.rows[0].count, 10) === 0) {
        console.log('Seeding initial PostgreSQL records...');
        for (const u of this.localStore.users || DEFAULT_USERS) {
          await client.query(
            'INSERT INTO users (id, name, email, role, company, avatar) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING',
            [u.id, u.name, u.email, u.role, u.company, u.avatar]
          );
        }
        for (const p of this.localStore.projects || DEFAULT_PROJECTS) {
          await client.query(
            `INSERT INTO projects (id, title, client, type, status, created_by, owner_name, owner_email, units_count, boards_est, data, is_shared, fork_count, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) ON CONFLICT (id) DO NOTHING`,
            [p.id, p.title, p.client, p.type, p.status, p.created_by, p.owner_name, p.owner_email, p.units_count, p.boards_est, JSON.stringify(p.data), p.is_shared, p.fork_count, p.created_at, p.updated_at]
          );
        }
        console.log('✓ Initial PostgreSQL seed completed.');
      }

      client.release();
    } catch (err) {
      this.isPgConnected = false;
      this.pgError = err.message;
      console.log(`ℹ PostgreSQL status: ${err.message}. Local sync store active.`);
      // Retry in 15 seconds if PG is starting up
      setTimeout(() => this.initPostgreSQL(), 15000);
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
    const name = userData.name || 'New Designer';
    const email = userData.email || `${id}@orbixstudio.io`;
    const role = userData.role || 'Interior Designer';
    const company = userData.company || 'Orbix Studio';
    const avatar = userData.avatar || name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

    const user = { id, name, email, role, company, avatar, created_at: new Date().toISOString() };

    // Update local store
    this.localStore.users = this.localStore.users || [];
    const idx = this.localStore.users.findIndex(u => u.id === id || u.email === email);
    if (idx >= 0) {
      this.localStore.users[idx] = { ...this.localStore.users[idx], ...user };
    } else {
      this.localStore.users.push(user);
    }
    this.saveLocalStore();

    if (this.isPgConnected) {
      try {
        await this.pgPool.query(
          `INSERT INTO users (id, name, email, role, company, avatar)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO UPDATE SET name = $2, email = $3, role = $4, company = $5, avatar = $6`,
          [id, name, email, role, company, avatar]
        );
      } catch (err) {
        console.error('PostgreSQL createUser error:', err.message);
      }
    }

    return user;
  }

  async getUser(id) {
    const users = await this.getUsers();
    return users.find(u => u.id === id) || users[0] || null;
  }

  // ── Project Methods ──
  async getProjects({ search = '', filter = 'all', userId = '' } = {}) {
    let projects = [];
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

        if (filter === 'mine' && userId) {
          query += ` AND created_by = $${pIndex}`;
          params.push(userId);
          pIndex++;
        } else if (filter === 'shared') {
          query += ` AND is_shared = true`;
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
      if (filter === 'mine' && userId) {
        projects = projects.filter(p => p.created_by === userId);
      } else if (filter === 'shared') {
        projects = projects.filter(p => p.is_shared);
      }
      projects.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    }
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
    const createdBy = currentUser ? currentUser.id : (projectData.created_by || 'usr_dev');

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
        if (res.rows.length) updatedProject = res.rows[0];
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
  async forkProjectForColleague(originalProjectId, colleagueUser) {
    const original = await this.getProject(originalProjectId);
    if (!original) throw new Error('Original project not found');

    const copyTitle = `${original.title} (Copy - ${colleagueUser.name})`;
    const forkedId = 'proj_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const now = new Date().toISOString();

    // Deep clone data
    const clonedData = JSON.parse(JSON.stringify(original.data || { units: [] }));

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
      localSync: {
        active: true,
        projectCount: (this.localStore.projects || []).length,
        userCount: (this.localStore.users || []).length
      }
    };
  }
}

module.exports = new DBManager();
