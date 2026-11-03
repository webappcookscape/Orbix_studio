// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — Prisma Client Configuration & Database Health Check
// ═══════════════════════════════════════════════════════════════════════════════

const path = require('path');
const ROOT_DIR = path.join(__dirname, '../..');
require('dotenv').config({ path: path.join(ROOT_DIR, '.env') });
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');

// Singleton Prisma instance across the application lifecycle
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  errorFormat: 'minimal'
});

let isConnected = false;
let lastError = null;

async function checkDatabaseConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    isConnected = true;
    lastError = null;
    return true;
  } catch (err) {
    isConnected = false;
    lastError = err.message || String(err);
    return false;
  }
}

// Initial connection check
checkDatabaseConnection().then(ok => {
  if (ok) {
    console.log('✓ Prisma connected to PostgreSQL live database.');
  } else {
    console.warn('⚠ Prisma PostgreSQL connection warning:', lastError);
  }
});

function getDatabaseStatus() {
  const url = process.env.DATABASE_URL || '';
  let host = 'localhost';
  let port = '5433';
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
  prisma,
  checkDatabaseConnection,
  getDatabaseStatus,
  get isConnected() { return isConnected; },
  get lastError() { return lastError; }
};

