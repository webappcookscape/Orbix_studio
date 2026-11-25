// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — Set All Users Password & Verify Authentication CLI
// Usage: node scripts/set-all-passwords.js [optional_password]
// Default: studio@2026
// ═══════════════════════════════════════════════════════════════════════════════

const path = require('path');
const ROOT_DIR = path.join(__dirname, '..');
require('dotenv').config({ path: path.join(ROOT_DIR, '.env') });
require('dotenv').config();

const bcrypt = require('bcryptjs');
const { prisma, checkDatabaseConnection } = require('../server/config/prisma');
const userService = require('../server/services/userService');

async function main() {
  const targetPassword = process.argv[2] || 'studio@2026';
  console.log(`\n=== SETTING ALL USER PASSWORDS TO "${targetPassword}" ===`);

  await checkDatabaseConnection();

  const hash = await bcrypt.hash(targetPassword, 10);

  let updatedCount = 0;
  try {
    const res = await prisma.user.updateMany({
      data: { password: hash }
    });
    updatedCount = res.count || 0;
    console.log(`✓ Updated ${updatedCount} users with hashed password in database.`);
  } catch (err) {
    console.error('Update error:', err.message);
  }

  // Also directly update any JSON stores on disk (for zero-loss fallback mode)
  const fs = require('fs');
  const possibleStores = [
    path.join(ROOT_DIR, 'db', 'users_store.json'),
    path.join(ROOT_DIR, 'server', 'db', 'users_store.json'),
    path.join(ROOT_DIR, 'data', 'users_store.json')
  ];
  for (const storePath of possibleStores) {
    if (fs.existsSync(storePath)) {
      try {
        const users = JSON.parse(fs.readFileSync(storePath, 'utf8'));
        if (Array.isArray(users)) {
          for (const u of users) {
            u.password = hash;
          }
          fs.writeFileSync(storePath, JSON.stringify(users, null, 2), 'utf8');
          console.log(`✓ Directly updated JSON store at: ${storePath}`);
        }
      } catch (e) {
        console.warn(`Notice updating ${storePath}:`, e.message);
      }
    }
  }

  // Verify authentication with both username and email
  console.log('\n=== TESTING AUTHENTICATION ===');
  const u1 = await userService.authenticateUser('admin', targetPassword);
  console.log('1. Login with "admin":', u1 ? `✓ SUCCESS (${u1.name} - ${u1.role})` : '✗ FAILED');

  const u2 = await userService.authenticateUser('admin@cookscape.com', targetPassword);
  console.log('2. Login with "admin@cookscape.com":', u2 ? `✓ SUCCESS (${u2.name})` : '✗ FAILED');

  const u3 = await userService.authenticateUser('aravind', targetPassword);
  console.log('3. Login with "aravind":', u3 ? `✓ SUCCESS (${u3.name})` : '✗ FAILED');

  console.log('\nAll done! You can now sign in on the web with username "admin" and password "' + targetPassword + '".\n');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
