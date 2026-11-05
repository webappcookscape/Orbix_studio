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
const { prisma } = require('../config/prisma');

// Helper: Strip sensitive password hashes from user records
function sanitizeUser(user) {
  if (!user) return null;
  const safe = { ...user };
  delete safe.password;
  return safe;
}

class UserService {
  // 1. Get all users
  async getAllUsers() {
    const users = await prisma.user.findMany({
      orderBy: { name: 'asc' }
    });
    return users.map(sanitizeUser);
  }

  // 2. Get user by ID
  async getUserById(id) {
    if (!id) return null;
    const user = await prisma.user.findUnique({
      where: { id }
    });
    return sanitizeUser(user);
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
      isValid = bcrypt.compareSync(password, user.password);
    } else if (user.password === password) {
      isValid = true;
      // Upgrade plaintext password to bcrypt hash in background
      try {
        const hashedPassword = bcrypt.hashSync(password, 10);
        await prisma.user.update({
          where: { id: user.id },
          data: { password: hashedPassword }
        });
        console.log(`✓ Upgraded password for user ${user.id} to bcrypt hash.`);
      } catch (err) {
        console.warn(`Failed to upgrade password for user ${user.id}:`, err.message);
      }
    }

    return isValid ? sanitizeUser(user) : null;
  }

  // 5. Create new user (Admin Only)
  async createUser(userData) {
    const id = userData.id || ('usr_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6));
    const name = (userData.name || 'New Employee').trim();
    const email = (userData.email || `${id}@orbixstudio.io`).trim().toLowerCase();
    const username = (userData.username || name.toLowerCase().replace(/[^a-z0-9]/g, '') || id).trim();

    // Hash password with bcrypt
    const rawPassword = userData.password || '123456';
    const hashedPassword = bcrypt.hashSync(rawPassword, 10);

    const role = (userData.role === 'admin') ? 'admin' : 'employee';
    const designation = (userData.designation || 'Modular Designer').trim();
    const company = (userData.company || 'Cookscape').trim();
    const avatar = (userData.avatar || name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)).trim();

    const created = await prisma.user.create({
      data: {
        id,
        name,
        username,
        email,
        password: hashedPassword,
        role,
        designation,
        company,
        avatar
      }
    });

    return sanitizeUser(created);
  }

  // 6. Update user (Admin Only)
  async updateUser(id, updates) {
    if (!id) throw new Error('User ID is required');

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw new Error('User not found');

    const data = {};
    if (updates.name !== undefined && updates.name !== null) data.name = updates.name.trim();
    if (updates.username !== undefined && updates.username !== null) data.username = updates.username.trim();
    if (updates.email !== undefined && updates.email !== null) data.email = updates.email.trim().toLowerCase();
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

    const updated = await prisma.user.update({
      where: { id },
      data
    });

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
    return { success: true, id };
  }
}

module.exports = new UserService();

