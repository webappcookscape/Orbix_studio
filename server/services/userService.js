// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — User Service (Prisma ORM)
// ═══════════════════════════════════════════════════════════════════════════════

let bcrypt;
try {
  bcrypt = require('bcryptjs');
} catch (_) {
  bcrypt = {
    hash: async (pw) => pw,
    compare: async (pw, hash) => pw === hash
  };
}
const prismaConfig = require('../config/prisma');
const { prisma } = prismaConfig;

// Helper: Strip sensitive password hashes from user records
function sanitizeUser(user) {
  if (!user) return null;
  const safe = { ...user };
  delete safe.password;
  safe.phone = (safe.phone !== undefined && safe.phone !== null) ? String(safe.phone) : '';
  return safe;
}

// Short-lived in-memory user cache (30s TTL) to avoid redundant PostgreSQL hits on concurrent API calls
const USER_CACHE_TTL_MS = 30 * 1000;
const _userCache = new Map();
let _phoneColumnEnsured = false;

function invalidateUserCache(id) {
  if (id) _userCache.delete(String(id));
  else _userCache.clear();
}

async function ensurePhoneColumnSafe() {
  if (!prismaConfig.isConnected) return false;
  if (_phoneColumnEnsured) return true;
  try {
    await prisma.$executeRawUnsafe("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(64) DEFAULT ''");
    _phoneColumnEnsured = true;
    return true;
  } catch (_) {
    return false;
  }
}

async function persistPhoneViaRawSql(id, phone) {
  if (!prismaConfig.isConnected || !id) return;
  try {
    await ensurePhoneColumnSafe();
    await prisma.$executeRawUnsafe('UPDATE users SET phone = $1 WHERE id = $2', String(phone || ''), String(id));
  } catch (err) {
    console.warn('[UserService] Raw phone update notice:', err.message);
  }
}

async function hydratePhonesIfMissing(users) {
  if (!prismaConfig.isConnected || !Array.isArray(users) || !users.length) return users;
  const needsHydrate = users.some((u) => u && u.phone === undefined);
  if (!needsHydrate) return users;
  try {
    await ensurePhoneColumnSafe();
    const rows = await prisma.$queryRawUnsafe('SELECT id, phone FROM users');
    const byId = {};
    for (const r of (rows || [])) {
      if (r && r.id) byId[r.id] = r.phone || '';
    }
    return users.map((u) => (u ? Object.assign({}, u, { phone: byId[u.id] !== undefined ? byId[u.id] : (u.phone || '') }) : u));
  } catch (_) {
    return users;
  }
}

class UserService {
  // 1. Get all users
  async getAllUsers() {
    let users = await prisma.user.findMany({
      orderBy: { name: 'asc' }
    });
    users = await hydratePhonesIfMissing(users);
    return users.map(sanitizeUser);
  }

  // 2. Get user by ID (cached 30s in memory for instant session hydration)
  async getUserById(id) {
    if (!id) return null;
    const cacheKey = String(id);
    const cached = _userCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.user;
    }
    let user = await prisma.user.findUnique({
      where: { id }
    });
    if (user && user.phone === undefined && prismaConfig.isConnected) {
      const hydrated = await hydratePhonesIfMissing([user]);
      user = hydrated[0];
    }
    const sanitized = sanitizeUser(user);
    if (sanitized) {
      _userCache.set(cacheKey, { user: sanitized, expiresAt: Date.now() + USER_CACHE_TTL_MS });
    }
    return sanitized;
  }

  // 3. Get user by username or email (for login/auth)
  async getUserByIdentifier(identifier) {
    if (!identifier) return null;
    const clean = identifier.trim().toLowerCase();
    return prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: clean, mode: 'insensitive' } },
          { username: { equals: clean, mode: 'insensitive' } }
        ]
      }
    });
  }

  // 4. Authenticate user credentials
  async authenticateUser(identifier, password) {
    if (!identifier || !password) return null;
    const user = await this.getUserByIdentifier(identifier);
    if (!user) return null;

    let isValid = false;
    if (user.password && user.password.startsWith('$2')) {
      isValid = typeof bcrypt.compare === 'function'
        ? await bcrypt.compare(password, user.password)
        : bcrypt.compareSync(password, user.password);
    } else if (user.password === password) {
      isValid = true;
      // Upgrade plaintext password to bcrypt hash in background without delaying login
      Promise.resolve().then(async () => {
        try {
          const hashedPassword = typeof bcrypt.hash === 'function'
            ? await bcrypt.hash(password, 10)
            : bcrypt.hashSync(password, 10);
          await prisma.user.update({
            where: { id: user.id },
            data: { password: hashedPassword }
          });
          invalidateUserCache(user.id);
          console.log(`✓ Upgraded password for user ${user.id} to bcrypt hash.`);
        } catch (err) {
          console.warn(`Failed to upgrade password for user ${user.id}:`, err.message);
        }
      });
    }

    return isValid ? sanitizeUser(user) : null;
  }

  // 5. Create new user (Admin Only)
  async createUser(userData) {
    const id = userData.id || ('usr_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6));
    const name = (userData.name || 'New Employee').trim();
    const email = (userData.email || `${id}@orbixstudio.io`).trim().toLowerCase();
    const username = (userData.username || name.toLowerCase().replace(/[^a-z0-9]/g, '') || id).trim();

    // Require explicit password (minimum 6 chars) — never fall back to weak defaults
    const rawPassword = typeof userData.password === 'string' ? userData.password : '';
    if (rawPassword.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }
    const hashedPassword = bcrypt.hashSync(rawPassword, 10);

    const role = (userData.role === 'admin') ? 'admin' : 'employee';
    const designation = (userData.designation || 'Modular Designer').trim();
    const company = (userData.company || 'Cookscape').trim();
    const phone = String(userData.phone || '').trim().slice(0, 64);
    const avatar = (userData.avatar || name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)).trim();

    const createData = {
      id,
      name,
      username,
      email,
      phone,
      password: hashedPassword,
      role,
      designation,
      company,
      avatar
    };

    let created;
    try {
      created = await prisma.user.create({ data: createData });
    } catch (err) {
      // Zero-downtime fallback if live Prisma Client wasn't regenerated yet for the new phone column
      if (err && /unknown argument|phone/i.test(String(err.message || ''))) {
        const fallbackData = { ...createData };
        delete fallbackData.phone;
        created = await prisma.user.create({ data: fallbackData });
        await persistPhoneViaRawSql(created.id, phone);
        created = Object.assign({}, created, { phone });
      } else {
        throw err;
      }
    }

    const sanitized = sanitizeUser(created);
    if (sanitized && sanitized.id) invalidateUserCache(sanitized.id);
    return sanitized;
  }

  // 6. Update user (Admin Only)
  async updateUser(id, updates) {
    if (!id) throw new Error('User ID is required');

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw new Error('User not found');

    const data = {};
    let phoneToSync = undefined;
    if (updates.name !== undefined && updates.name !== null) data.name = updates.name.trim();
    if (updates.username !== undefined && updates.username !== null) data.username = updates.username.trim();
    if (updates.email !== undefined && updates.email !== null) data.email = updates.email.trim().toLowerCase();
    if (updates.phone !== undefined && updates.phone !== null) {
      phoneToSync = String(updates.phone).trim().slice(0, 64);
      data.phone = phoneToSync;
    }
    if (updates.designation !== undefined && updates.designation !== null) data.designation = updates.designation.trim();
    if (updates.company !== undefined && updates.company !== null) data.company = updates.company.trim();

    // Protect primary admin from demotion
    if (id === 'usr_admin' || (existing.email && existing.email.toLowerCase() === 'admin@cookscape.com')) {
      data.role = 'admin';
    } else if (updates.role !== undefined && updates.role !== null) {
      data.role = (updates.role === 'admin') ? 'admin' : 'employee';
    }

    if (updates.password && updates.password.trim() !== '') {
      data.password = bcrypt.hashSync(updates.password, 10);
    }

    if (updates.avatar !== undefined && updates.avatar !== null) {
      data.avatar = updates.avatar.trim();
    } else if (data.name) {
      data.avatar = data.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    }

    let updated;
    try {
      updated = await prisma.user.update({
        where: { id },
        data
      });
    } catch (err) {
      if (phoneToSync !== undefined && err && /unknown argument|phone/i.test(String(err.message || ''))) {
        const fallbackData = { ...data };
        delete fallbackData.phone;
        if (Object.keys(fallbackData).length > 0) {
          updated = await prisma.user.update({ where: { id }, data: fallbackData });
        } else {
          updated = existing;
        }
        await persistPhoneViaRawSql(id, phoneToSync);
        updated = Object.assign({}, updated, { phone: phoneToSync });
      } else {
        throw err;
      }
    }

    if (phoneToSync !== undefined && updated.phone === undefined) {
      await persistPhoneViaRawSql(id, phoneToSync);
      updated = Object.assign({}, updated, { phone: phoneToSync });
    }

    invalidateUserCache(id);
    return sanitizeUser(updated);
  }

  // 7. Delete user (Admin Only)
  async deleteUser(id) {
    if (!id) throw new Error('User ID is required');

    // Protect primary administrator
    if (id === 'usr_admin') {
      throw new Error('Primary administrator account cannot be deleted');
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw new Error('User not found');

    if (existing.email && existing.email.toLowerCase() === 'admin@cookscape.com') {
      throw new Error('Primary administrator account cannot be deleted');
    }

    await prisma.user.delete({ where: { id } });
    invalidateUserCache(id);
    return { success: true, id };
  }
}

module.exports = new UserService();

