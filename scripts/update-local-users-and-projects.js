const fs = require('fs');

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

const allUsers = [
  {
    id: 'usr_admin',
    name: 'Cookscape Admin',
    username: 'admin',
    email: 'admin@cookscape.com',
    password: 'studio@2026',
    role: 'admin',
    designation: 'System Administrator',
    company: 'Cookscape',
    avatar: 'CA'
  },
  ...employeesData.map(e => ({
    id: 'usr_' + e.username.replace(/[^a-z0-9]/g, '_'),
    name: e.name,
    username: e.username,
    email: e.email,
    password: 'studio@2026',
    role: 'employee',
    designation: e.desig,
    company: 'Cookscape',
    avatar: e.name.split(' ').map(n => n[0]).filter(Boolean).join('').toUpperCase().substring(0, 2) || 'CS'
  }))
];

// Update orbix-projects.js
let op = fs.readFileSync('orbix-projects.js', 'utf8');
const opCRLF = op.includes('\r\n');
if (opCRLF) op = op.replace(/\r\n/g, '\n');

const idxStart = op.indexOf('users: [');
const idxEnd = op.indexOf('],', idxStart);

if (idxStart !== -1 && idxEnd !== -1) {
  const usersCode = `users: [\n      // ── Admin ──\n      ` +
    JSON.stringify(allUsers[0]) + `,\n\n      // ── 27 Employees (LA / FA) ──\n` +
    allUsers.slice(1).map(u => '      ' + JSON.stringify(u)).join(',\n') + '\n    ';
  op = op.slice(0, idxStart) + usersCode + op.slice(idxEnd);
  console.log('✓ Successfully replaced this.users in orbix-projects.js');
}

if (opCRLF) op = op.replace(/\n/g, '\r\n');
fs.writeFileSync('orbix-projects.js', op, 'utf8');
console.log('✓ Wrote orbix-projects.js');
