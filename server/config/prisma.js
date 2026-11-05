// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — Prisma Client Configuration & Database Health Check
// ═══════════════════════════════════════════════════════════════════════════════

const path = require('path');
const fs = require('fs');
const ROOT_DIR = path.join(__dirname, '../..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
if (!fs.existsSync(DATA_DIR)) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}
}
require('dotenv').config({ path: path.join(ROOT_DIR, '.env') });
require('dotenv').config();

// Default seed users
const DEFAULT_FALLBACK_USERS = [
  {
    id: 'usr_admin',
    name: 'Cookscape Admin',
    username: 'admin',
    email: 'admin@cookscape.com',
    password: 'password123',
    role: 'admin',
    designation: 'System Head',
    company: 'Cookscape',
    avatar: 'CA',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'usr_sangathamizh',
    name: 'Sangathamizh',
    username: 'sangathamizh',
    email: 'sangathamizh@cookscape.com',
    password: 'password123',
    role: 'admin',
    designation: 'Business Head',
    company: 'Cookscape',
    avatar: 'SG',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'usr_aravind',
    name: 'Aravind',
    username: 'aravind',
    email: 'aravind@cookscape.com',
    password: 'password123',
    role: 'employee',
    designation: 'Floor Architect / FA',
    company: 'Cookscape',
    avatar: 'AK',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'usr_elakkiya',
    name: 'Elakkiya',
    username: 'elakkiya',
    email: 'elakkiya@cookscape.com',
    password: 'password123',
    role: 'employee',
    designation: 'Floor Architect / FA',
    company: 'Cookscape',
    avatar: 'EK',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'usr_dev',
    name: 'Dev Kancheti',
    username: 'dev',
    email: 'dev@cookscape.com',
    password: 'password123',
    role: 'employee',
    designation: 'Design Lead',
    company: 'Cookscape',
    avatar: 'DK',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

class MockPrismaClient {
  constructor() {
    this._usersFile = path.join(DATA_DIR, 'users_store.json');
    this._projectsFile = path.join(DATA_DIR, 'projects_store.json');
    this._sharesFile = path.join(DATA_DIR, 'shares_store.json');
    this._initStore();

    const self = this;

    // Mock User Model
    this.user = {
      async findMany(args) {
        let users = self._read(self._usersFile, DEFAULT_FALLBACK_USERS);
        if (args && args.orderBy && args.orderBy.name) {
          users.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        }
        return users;
      },
      async findUnique(args) {
        const users = self._read(self._usersFile, DEFAULT_FALLBACK_USERS);
        if (args && args.where && args.where.id) {
          return users.find(u => u.id === args.where.id) || null;
        }
        if (args && args.where && args.where.email) {
          return users.find(u => u.email.toLowerCase() === args.where.email.toLowerCase()) || null;
        }
        return null;
      },
      async findFirst(args) {
        const users = self._read(self._usersFile, DEFAULT_FALLBACK_USERS);
        if (args && args.where && args.where.OR) {
          for (const cond of args.where.OR) {
            if (cond.email) {
              const clean = (cond.email.equals || cond.email).toLowerCase();
              const found = users.find(u => u.email && u.email.toLowerCase() === clean);
              if (found) return found;
            }
            if (cond.username) {
              const clean = (cond.username.equals || cond.username).toLowerCase();
              const found = users.find(u => u.username && u.username.toLowerCase() === clean);
              if (found) return found;
            }
          }
        }
        return users[0] || null;
      },
      async create(args) {
        const users = self._read(self._usersFile, DEFAULT_FALLBACK_USERS);
        const newUser = {
          ...args.data,
          id: args.data.id || ('usr_' + Date.now().toString(36)),
          createdAt: new Date(),
          updatedAt: new Date()
        };
        users.push(newUser);
        self._write(self._usersFile, users);
        return newUser;
      },
      async update(args) {
        const users = self._read(self._usersFile, DEFAULT_FALLBACK_USERS);
        const idx = users.findIndex(u => u.id === args.where.id);
        if (idx === -1) throw new Error('User not found');
        users[idx] = { ...users[idx], ...args.data, updatedAt: new Date() };
        self._write(self._usersFile, users);
        return users[idx];
      },
      async delete(args) {
        let users = self._read(self._usersFile, DEFAULT_FALLBACK_USERS);
        users = users.filter(u => u.id !== args.where.id);
        self._write(self._usersFile, users);
        return { id: args.where.id };
      }
    };

    // Mock Project Model
    this.project = {
      async findMany(args) {
        let projs = self._read(self._projectsFile, []);
        if (args && args.where && args.where.OR) {
          const clauses = args.where.OR;
          projs = projs.filter(p => {
            return clauses.some(c => {
              if (c.createdBy && p.createdBy === c.createdBy) return true;
              if (c.isShared !== undefined && p.isShared === c.isShared) return true;
              return false;
            });
          });
        }
        projs.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
        return projs;
      },
      async findUnique(args) {
        const projs = self._read(self._projectsFile, []);
        return projs.find(p => p.id === args.where.id) || null;
      },
      async create(args) {
        const projs = self._read(self._projectsFile, []);
        const newProj = {
          ...args.data,
          id: args.data.id || ('proj_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6)),
          createdAt: new Date(),
          updatedAt: new Date()
        };
        projs.unshift(newProj);
        self._write(self._projectsFile, projs);
        return newProj;
      },
      async update(args) {
        const projs = self._read(self._projectsFile, []);
        const idx = projs.findIndex(p => p.id === args.where.id);
        if (idx === -1) throw new Error('Project not found');
        projs[idx] = { ...projs[idx], ...args.data, updatedAt: new Date() };
        self._write(self._projectsFile, projs);
        return projs[idx];
      },
      async delete(args) {
        let projs = self._read(self._projectsFile, []);
        projs = projs.filter(p => p.id !== args.where.id);
        self._write(self._projectsFile, projs);
        return { id: args.where.id };
      }
    };

    // Mock Shares & Forks Models
    this.projectShare = {
      async findMany() { return self._read(self._sharesFile, []); },
      async create(args) {
        const shares = self._read(self._sharesFile, []);
        const s = { ...args.data, id: 'sh_' + Date.now().toString(36), createdAt: new Date() };
        shares.push(s);
        self._write(self._sharesFile, shares);
        return s;
      }
    };

    this.projectFork = {
      async findMany() { return []; },
      async create(args) { return { ...args.data, id: 'fk_' + Date.now().toString(36) }; }
    };
  }

  _initStore() {
    if (!fs.existsSync(this._usersFile)) {
      this._write(this._usersFile, DEFAULT_FALLBACK_USERS);
    }
    if (!fs.existsSync(this._projectsFile)) {
      this._write(this._projectsFile, []);
    }
    if (!fs.existsSync(this._sharesFile)) {
      this._write(this._sharesFile, []);
    }
  }

  _read(file, def) {
    try {
      if (fs.existsSync(file)) {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
      }
    } catch (_) {}
    return Array.isArray(def) ? [...def] : def;
  }

  _write(file, data) {
    try {
      fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.warn('MockPrismaClient storage notice:', err.message);
    }
  }

  async $queryRaw() { throw new Error('Prisma Client not generated or PostgreSQL not connected'); }
  async $executeRawUnsafe() {}
  async $disconnect() {}
}

let PrismaClient;
try {
  const pc = require('@prisma/client');
  if (pc && pc.PrismaClient) {
    PrismaClient = pc.PrismaClient;
  } else {
    PrismaClient = MockPrismaClient;
  }
} catch (e) {
  PrismaClient = MockPrismaClient;
}

let currentUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/cupboard_cad';

// Active Prisma Client instance
let activePrisma = new PrismaClient({
  datasources: { db: { url: currentUrl } },
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  errorFormat: 'minimal'
});

// Dynamic proxy so existing imports (`const { prisma } = require('./config/prisma')`)
// always route methods to the active connected client even after auto-recovery/fallback
const prismaProxy = new Proxy({}, {
  get(target, prop) {
    const val = activePrisma[prop];
    if (typeof val === 'function') {
      return val.bind(activePrisma);
    }
    return val;
  }
});

let isConnected = false;
let lastError = null;

async function checkDatabaseConnection() {
  try {
    await activePrisma.$queryRaw`SELECT 1`;

    // Auto-migration: ensure required columns exist in PostgreSQL
    try {
      await activePrisma.$executeRawUnsafe(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        ALTER TABLE project_shares ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        ALTER TABLE project_forks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
      `);
    } catch (migErr) {
      console.warn('Auto-migration column check notice:', migErr.message);
    }

    isConnected = true;
    lastError = null;
    return true;
  } catch (err) {
    // Intelligent auto-recovery: if connection failed on 5433 or 5432, try the alternative port!
    const is5433 = currentUrl.includes(':5433');
    const is5432 = currentUrl.includes(':5432');
    if (is5433 || is5432) {
      const altUrl = is5433 ? currentUrl.replace(':5433', ':5432') : currentUrl.replace(':5432', ':5433');
      try {
        const altPrisma = new PrismaClient({
          datasources: { db: { url: altUrl } },
          log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
          errorFormat: 'minimal'
        });
        await altPrisma.$queryRaw`SELECT 1`;
        try {
          await altPrisma.$executeRawUnsafe(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
            ALTER TABLE project_shares ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
            ALTER TABLE project_forks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
          `);
        } catch (_) {}

        try { await activePrisma.$disconnect(); } catch (_) {}
        activePrisma = altPrisma;
        currentUrl = altUrl;
        process.env.DATABASE_URL = altUrl;
        process.env.PGPORT = is5433 ? '5432' : '5433';
        isConnected = true;
        lastError = null;
        console.log(`✓ Prisma auto-recovered and connected to PostgreSQL live database on port ${process.env.PGPORT}.`);
        return true;
      } catch (altErr) {
        // Fallback also failed: retain default port 5432
        currentUrl = currentUrl.replace(':5433', ':5432');
        process.env.DATABASE_URL = currentUrl;
        process.env.PGPORT = '5432';
      }
    }

    isConnected = false;
    lastError = err.message || String(err);
    return false;
  }
}

// Initial connection check on module load
checkDatabaseConnection().then(ok => {
  if (ok) {
    console.log('✓ Prisma connected to PostgreSQL live database.');
  } else {
    console.warn('⚠ Prisma PostgreSQL connection warning:', lastError);
  }
});

function getDatabaseStatus() {
  const url = process.env.DATABASE_URL || currentUrl || '';
  let host = 'localhost';
  let port = '5432';
  let database = 'cupboard_cad';

  try {
    const parsed = new URL(url.replace('postgresql://', 'http://'));
    host = parsed.hostname || host;
    port = parsed.port || port;
    database = parsed.pathname.replace('/', '') || database;
  } catch (_) {}

  return {
    postgres: {
      connected: isConnected,
      error: lastError,
      database,
      host,
      port
    },
    orm: 'Prisma Client v6',
    liveMode: isConnected,
    mode: isConnected ? 'PostgreSQL Live Database (Prisma)' : 'Offline / Degraded'
  };
}

module.exports = {
  prisma: prismaProxy,
  checkDatabaseConnection,
  getDatabaseStatus,
  get isConnected() { return isConnected; },
  get lastError() { return lastError; }
};
