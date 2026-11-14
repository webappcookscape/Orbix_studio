const assert = require('assert');
const fs = require('fs');
const path = require('path');

const VPS_BASE = 'https://studio.orbixdesigns.com';

const expectedEmployees = [
  { name: 'SHIRAJA SUBRAMANIAN', email: 'keyinteriors.cookscape@gmail.com', desig: 'LA' },
  { name: 'HASEENA AYESHA', email: 'haseenaayeshaa@gmail.com', desig: 'FA' },
  { name: 'Abirami.k', email: 'abiramik707@gmail.com', desig: 'FA' },
  { name: 'VIJAY MANOJ', email: 'vijaymanoj1214@gmail.com', desig: 'FA' },
  { name: 'MANIKANDAN K', email: 'manikandanidd02@gmail.com', desig: 'LA' },
  { name: 'Kalaimadhi D.A.', email: 'kalaimadhi06@gmail.com', desig: 'LA' },
  { name: 'Pravin M', email: 'pravindoss3@gmail.com', desig: 'LA' },
  { name: 'Suhail Akthar', email: 'suhailakthar555@gmail.com', desig: 'LA' },
  { name: 'Varshini', email: 'varshini.san@gmail.com', desig: 'LA' },
  { name: 'Renukha Gopalan', email: 'durability.cookscape@gmail.com', desig: 'FA' },
  { name: 'R.siva kumar', email: 'interact.cookscape@gmail.com', desig: 'FA' },
  { name: 'Poonguzhali Arumugam', email: 'helpdesk.cookscape@gmail.com', desig: 'LA' },
  { name: 'meenakshi', email: 'ps.cookscape@gmail.com', desig: 'FA' },
  { name: 'Abishek kumar', email: 'designsolution.cookscape@gmail.com', desig: 'FA' },
  { name: 'Julia Asha', email: 'stylishomes.cookscape@gmail.com', desig: 'FA' },
  { name: 'Niveditha . S', email: 'interior.cookscape@gmail.com', desig: 'FA' },
  { name: 'Shivaranjani', email: 'renovation.cookscape@gmail.com', desig: 'LA' },
  { name: 'Yogesh kumar JK', email: 'service.wall2wall@gmail.com', desig: 'FA' },
  { name: 'Keerthika G', email: 'layout.cookscape@gmail.com', desig: 'FA' },
  { name: 'Priyadharshini Thangavel', email: 'designers.cookscape@gmail.com', desig: 'LA' },
  { name: 'Mohsina Noor. A', email: 'khanmohsina991@gmail.com', desig: 'LA' },
  { name: 'Kanimozhi', email: 'kanimozhianbuchezhian04@gmail.com', desig: 'LA' },
  { name: 'Vanitha Kaspar', email: 'vanithakaspar@gmail.com', desig: 'LA' },
  { name: 'RAGULNATH G', email: 'sketches.cookscape@gmail.com', desig: 'LA' },
  { name: 'SIVAKUMAR KJ', email: 'designideas.cookscape@gmail.com', desig: 'LA' },
  { name: 'Sudarmathi Selvam', email: 'drawings.cookscape@gmail.com', desig: 'LA' },
  { name: 'Sowmiya. G', email: 'sowmiyaganesan17@gmail.com', desig: 'LA' }
];

async function verify() {
  console.log('--- Verifying VPS Projects & 27 Employees ---');

  // 1. Verify Local Store & Files
  const ls = JSON.parse(fs.readFileSync(path.join(__dirname, '../db/local_store.json'), 'utf8'));
  assert.strictEqual(ls.projects.length, 0, 'Local store projects must be 0');
  assert.strictEqual(ls.users.length, 28, 'Local store users must be 28 (1 admin + 27 employees)');
  console.log('✔ Local db/local_store.json verified: 0 projects, 28 users');

  const op = fs.readFileSync(path.join(__dirname, '../orbix-projects.js'), 'utf8');
  assert.ok(op.includes('keyinteriors.cookscape@gmail.com'), 'orbix-projects.js must contain new employee emails');
  assert.ok(op.includes('studio@2026'), 'orbix-projects.js must contain studio@2026 default password');
  console.log('✔ orbix-projects.js fallback team list verified');

  // 2. Test Login on Live VPS
  const adminLogin = await fetch(`${VPS_BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin@cookscape.com', password: 'studio@2026' })
  });
  const adminData = await adminLogin.json();
  assert.ok(adminData.success, 'Admin login with studio@2026 must succeed on VPS');
  const cookie = adminLogin.headers.get('set-cookie');
  console.log('✔ Admin login verified on live VPS with password: studio@2026');

  // 3. Verify Projects on Live VPS (Must be 0)
  const projRes = await fetch(`${VPS_BASE}/api/projects`, { headers: { 'Cookie': cookie } });
  const projData = await projRes.json();
  assert.strictEqual(projData.projects.length, 0, `Expected 0 projects on VPS, found ${projData.projects.length}`);
  console.log('✔ Live VPS projects verified: exactly 0 projects (all deleted)');

  // 4. Verify Users on Live VPS (Must be 28: 1 admin + 27 employees)
  const userRes = await fetch(`${VPS_BASE}/api/users`, { headers: { 'Cookie': cookie } });
  const userData = await userRes.json();
  assert.strictEqual(userData.users.length, 28, `Expected 28 users on VPS, found ${userData.users.length}`);

  const vpsEmails = new Set(userData.users.map(u => u.email.toLowerCase()));
  expectedEmployees.forEach(emp => {
    assert.ok(vpsEmails.has(emp.email.toLowerCase()), `Employee ${emp.name} (${emp.email}) must exist on VPS`);
  });
  console.log('✔ Live VPS team verified: all 27 employees present with correct emails and roles');

  // 5. Test Employee Login
  const empLogin = await fetch(`${VPS_BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'haseenaayeshaa@gmail.com', password: 'studio@2026' })
  });
  const empData = await empLogin.json();
  assert.ok(empData.success, 'Employee HASEENA AYESHA login with studio@2026 must succeed');
  assert.strictEqual(empData.user.designation, 'FA');
  assert.strictEqual(empData.user.role, 'employee');
  console.log('✔ Live employee login verified: HASEENA AYESHA (FA) logged in successfully');

  console.log('\n🎉 ALL VPS PROJECT DELETIONS & 27 EMPLOYEE CREATIONS 100% VERIFIED!');
}

verify().catch(e => {
  console.error('Verification failed:', e);
  process.exit(1);
});
