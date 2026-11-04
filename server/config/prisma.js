// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — Prisma Client Configuration & Database Health Check
// ═══════════════════════════════════════════════════════════════════════════════

const path = require('path');
const ROOT_DIR = path.join(__dirname, '../..');
require('dotenv').config({ path: path.join(ROOT_DIR, '.env') });
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');

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
