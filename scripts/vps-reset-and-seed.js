const VPS_BASE = 'https://studio.orbixdesigns.com';

const employeesData = [
  { name: 'SHIRAJA SUBRAMANIAN', email: 'keyinteriors.cookscape@gmail.com', desig: 'LA', username: 'shiraja' },
  { name: 'HASEENA AYESHA', email: 'haseenaayeshaa@gmail.com', desig: 'FA', username: 'haseena' },
  { name: 'Abirami.k', email: 'abiramik707@gmail.com', desig: 'FA', username: 'abirami' },
  { name: 'VIJAY MANOJ', email: 'vijaymanoj1214@gmail.com', desig: 'FA', username: 'vijaymanoj' },
  { name: 'MANIKANDAN K', email: 'manikandanidd02@gmail.com', desig: 'LA', username: 'manikandan' },
  { name: 'Kalaimadhi D.A.', email: 'kalaimadhi06@gmail.com', desig: 'LA', username: 'kalaimadhi' },
  { name: 'Pravin M', email: 'pravindoss3@gmail.com', desig: 'LA', username: 'pravin' },
  { name: 'Suhail Akthar', email: 'suhailakthar555@gmail.com', desig: 'LA', username: 'suhail' },
  { name: 'Varshini', email: 'varshini.san@gmail.com', desig: 'LA', username: 'varshini' },
  { name: 'Renukha Gopalan', email: 'durability.cookscape@gmail.com', desig: 'FA', username: 'renukha' },
  { name: 'R.siva kumar', email: 'interact.cookscape@gmail.com', desig: 'FA', username: 'sivakumar.r' },
  { name: 'Poonguzhali Arumugam', email: 'helpdesk.cookscape@gmail.com', desig: 'LA', username: 'poonguzhali' },
  { name: 'meenakshi', email: 'ps.cookscape@gmail.com', desig: 'FA', username: 'meenakshi' },
  { name: 'Abishek kumar', email: 'designsolution.cookscape@gmail.com', desig: 'FA', username: 'abishek' },
  { name: 'Julia Asha', email: 'stylishomes.cookscape@gmail.com', desig: 'FA', username: 'julia' },
  { name: 'Niveditha . S', email: 'interior.cookscape@gmail.com', desig: 'FA', username: 'niveditha' },
  { name: 'Shivaranjani', email: 'renovation.cookscape@gmail.com', desig: 'LA', username: 'shivaranjani' },
  { name: 'Yogesh kumar JK', email: 'service.wall2wall@gmail.com', desig: 'FA', username: 'yogesh' },
  { name: 'Keerthika G', email: 'layout.cookscape@gmail.com', desig: 'FA', username: 'keerthika' },
  { name: 'Priyadharshini Thangavel', email: 'designers.cookscape@gmail.com', desig: 'LA', username: 'priyadharshini' },
  { name: 'Mohsina Noor. A', email: 'khanmohsina991@gmail.com', desig: 'LA', username: 'mohsina' },
  { name: 'Kanimozhi', email: 'kanimozhianbuchezhian04@gmail.com', desig: 'LA', username: 'kanimozhi' },
  { name: 'Vanitha Kaspar', email: 'vanithakaspar@gmail.com', desig: 'LA', username: 'vanitha' },
  { name: 'RAGULNATH G', email: 'sketches.cookscape@gmail.com', desig: 'LA', username: 'ragulnath' },
  { name: 'SIVAKUMAR KJ', email: 'designideas.cookscape@gmail.com', desig: 'LA', username: 'sivakumar.kj' },
  { name: 'Sudarmathi Selvam', email: 'drawings.cookscape@gmail.com', desig: 'LA', username: 'sudarmathi' },
  { name: 'Sowmiya. G', email: 'sowmiyaganesan17@gmail.com', desig: 'LA', username: 'sowmiya' }
];

async function main() {
  console.log('=== STEP 1: AUTHENTICATING AS ADMIN ON VPS ===');
  let cookie = null;

  // Try current admin password
  for (const pw of ['admin123', 'studio@2026']) {
    try {
      const loginRes = await fetch(`${VPS_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: 'admin@cookscape.com', password: pw })
      });
      if (loginRes.ok) {
        cookie = loginRes.headers.get('set-cookie');
        console.log(`✓ Admin login successful with password: ${pw}`);
        break;
      }
    } catch (e) {
      console.warn(`Login attempt error: ${e.message}`);
    }
  }

  if (!cookie) {
    throw new Error('Failed to login as admin on VPS!');
  }

  // Helper fetch with cookie
  async function api(path, options = {}) {
    options.headers = Object.assign({
      'Cookie': cookie,
      'Content-Type': 'application/json'
    }, options.headers || {});
    const res = await fetch(`${VPS_BASE}${path}`, options);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch (_) { data = text; }
    if (!res.ok) {
      throw new Error(`API ${options.method || 'GET'} ${path} returned ${res.status}: ${JSON.stringify(data)}`);
    }
    return data;
  }

  console.log('\n=== STEP 2: DELETING ALL PROJECTS ON VPS ===');
  const projRes = await api('/api/projects');
  const projects = projRes.projects || [];
  console.log(`Found ${projects.length} project(s) to delete on VPS.`);
  for (const p of projects) {
    try {
      await api(`/api/projects/${encodeURIComponent(p.id)}`, { method: 'DELETE' });
      console.log(`✓ Deleted project: [${p.id}] "${p.title}"`);
    } catch (e) {
      console.error(`✗ Error deleting project ${p.id}: ${e.message}`);
    }
  }

  console.log('\n=== STEP 3: DELETING ALL EXISTING NON-ADMIN USERS ON VPS ===');
  const userRes = await api('/api/users');
  const users = userRes.users || [];
  console.log(`Found ${users.length} user(s) on VPS.`);
  for (const u of users) {
    if (u.id === 'usr_admin' || (u.email && u.email.toLowerCase() === 'admin@cookscape.com')) {
      console.log(`- Skipping primary admin account [${u.id}] ${u.email}`);
      continue;
    }
    try {
      await api(`/api/users/${encodeURIComponent(u.id)}`, { method: 'DELETE' });
      console.log(`✓ Deleted user: [${u.id}] ${u.name} (${u.email})`);
    } catch (e) {
      console.error(`✗ Error deleting user ${u.id}: ${e.message}`);
    }
  }

  console.log('\n=== STEP 4: CREATING 27 NEW EMPLOYEES ON VPS ===');
  const DEFAULT_PW = 'studio@2026';
  let createdCount = 0;

  for (const emp of employeesData) {
    try {
      const payload = {
        name: emp.name.trim(),
        email: emp.email.trim().toLowerCase(),
        username: emp.username,
        password: DEFAULT_PW,
        role: 'employee',
        designation: emp.desig.trim(),
        company: 'Cookscape'
      };
      const res = await api('/api/users', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      createdCount++;
      console.log(`✓ [${createdCount}/${employeesData.length}] Created employee: ${emp.name} | ${emp.email} | ${emp.desig} | username: ${emp.username}`);
    } catch (e) {
      console.error(`✗ Error creating employee ${emp.name} (${emp.email}): ${e.message}`);
    }
  }

  console.log('\n=== STEP 5: UPDATING ADMIN PASSWORD TO studio@2026 ===');
  try {
    await api('/api/users/usr_admin', {
      method: 'PUT',
      body: JSON.stringify({ password: DEFAULT_PW })
    });
    console.log('✓ Primary admin usr_admin password set to: studio@2026');
  } catch (e) {
    console.warn(`Notice updating admin password: ${e.message}`);
  }

  console.log('\n=== STEP 6: VERIFYING FINAL VPS STATE ===');
  const finalProj = await api('/api/projects');
  console.log(`Projects remaining on VPS: ${finalProj.projects ? finalProj.projects.length : 0} (Expected: 0)`);

  const finalUsers = await api('/api/users');
  console.log(`Total users on VPS: ${finalUsers.users ? finalUsers.users.length : 0} (Expected: 28 = 1 admin + 27 employees)`);

  console.log('\n=== STEP 7: TESTING EMPLOYEE LOGIN ===');
  const testLogin = await fetch(`${VPS_BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'keyinteriors.cookscape@gmail.com', password: DEFAULT_PW })
  });
  const testData = await testLogin.json();
  console.log('Employee login test response:', testData);
  if (testData.success) {
    console.log('🎉 Employee login test verified successfully!');
  } else {
    throw new Error('Employee login test failed!');
  }

  console.log('\n🎉 ALL VPS OPERATIONS COMPLETED SUCCESSFULLY!');
}

main().catch(err => {
  console.error('Fatal error during VPS operations:', err);
  process.exit(1);
});
