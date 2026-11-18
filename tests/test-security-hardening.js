const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function request(port, method, reqPath, body, extraHeaders) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = Object.assign({ Connection: 'close' }, extraHeaders || {});
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request({ host: '127.0.0.1', port, path: reqPath, method, headers }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(raw); } catch (_) {}
        resolve({ status: res.statusCode, headers: res.headers, raw, json });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('=== VERIFYING ROUTE PROTECTION & SECURITY HARDENING ===\n');

  // 1. Source & bundle secret/backdoor absence checks
  const filesToScan = [
    'server/server.js',
    'server/controllers/aiController.js',
    'orbix-projects.js',
    'orbix-ui.js',
    'cupboard-cad.html'
  ];
  for (const rel of filesToScan) {
    const txt = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert(!txt.includes('c2stcHJvai1'), `${rel} must not embed fallback OpenAI API keys`);
    assert(!txt.includes('orbix-studio-super-secret-key-2026'), `${rel} must not contain hardcoded session secret`);
    if (rel !== 'server/controllers/aiController.js' && rel !== 'server/server.js') {
      assert(!txt.includes('"password":"studio@2026"'), `${rel} must not embed plaintext passwords`);
      assert(!txt.includes("'admin123'"), `${rel} must not embed offline password bypass`);
    }
  }
  console.log('✔ [1] No hardcoded API keys, session secrets, or client password lists in source/bundle');

  // 2. MockPrismaClient findFirst does not fall back to Admin on miss
  process.env.USE_JSON_STORE = 'true';
  process.env.PORT = '0';
  const { prisma } = require(path.join(ROOT, 'server', 'config', 'prisma.js'));
  const missUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: 'nonexistent_user_check@example.invalid', mode: 'insensitive' } },
        { username: { equals: 'nonexistent_user_check', mode: 'insensitive' } }
      ]
    }
  });
  assert.strictEqual(missUser, null, 'MockPrismaClient.user.findFirst must return null when no user matches');
  console.log('✔ [2] MockPrismaClient.user.findFirst rejects unknown identifiers cleanly');

  // 3. Start Express server and verify route protection, static blocking, CORS, RBAC & rate limits
  const srvMod = require(path.join(ROOT, 'server', 'server.js'));
  const srv = srvMod.server;
  await new Promise((r) => (srv.listening ? r() : srv.once('listening', r)));
  const port = srv.address().port;

  let tempEmpId = null;
  let adminCookie = '';
  try {
    // Protected endpoints reject unauthenticated requests with 401
    const protectedChecks = [
      ['GET', '/api/me'],
      ['GET', '/api/projects'],
      ['POST', '/api/projects', { title: 'Test' }],
      ['GET', '/api/users'],
      ['POST', '/api/users', { name: 'X' }],
      ['GET', '/api/ai/config'],
      ['GET', '/api/ai/key'],
      ['POST', '/api/ai/render', { prompt: 'kitchen' }],
      ['POST', '/api/share/sh_invalid/copy']
    ];
    for (const [m, p, b] of protectedChecks) {
      const r = await request(port, m, p, b);
      assert.strictEqual(r.status, 401, `Unauthenticated ${m} ${p} must return 401, got ${r.status}`);
    }
    console.log('✔ [3] All protected /api endpoints return 401 without session');

    // Sensitive files blocked over HTTP static server + security headers & CORS check
    const sensitivePaths = [
      '/server/server.js',
      '/server/controllers/aiController.js',
      '/db/local_store.json',
      '/data/users_store.json',
      '/.env',
      '/.sessions_cache.json',
      '/.session_secret',
      '/package.json',
      '/server/db.js.backup2'
    ];
    for (const sp of sensitivePaths) {
      const sr = await request(port, 'GET', sp);
      assert(sr.status === 403 || sr.status === 404, `Sensitive path ${sp} must be blocked (403/404), got ${sr.status}`);
    }

    const homeRes = await request(port, 'GET', '/', null, { Origin: 'https://evil-site.example' });
    assert.strictEqual(homeRes.headers['x-content-type-options'], 'nosniff');
    assert.strictEqual(homeRes.headers['x-frame-options'], 'SAMEORIGIN');
    assert(!homeRes.headers['x-powered-by'], 'x-powered-by header must be disabled');
    assert(!homeRes.headers['access-control-allow-origin'], 'Untrusted CORS Origin must not receive ACAO header');
    console.log('✔ [4] Static sensitive paths blocked (403/404), security headers set & untrusted CORS blocked');

    // Admin login & RBAC checks (also verify /api/ai/key never exposes raw key)
    let adminLogin = await request(port, 'POST', '/api/login', { identifier: 'admin@cookscape.com', password: 'password123' });
    if (adminLogin.status === 401) {
      adminLogin = await request(port, 'POST', '/api/login', { identifier: 'admin@cookscape.com', password: 'studio@2026' });
    }
    assert.strictEqual(adminLogin.status, 200, 'Admin login must succeed');
    adminCookie = (adminLogin.headers['set-cookie'] || [])[0].split(';')[0];

    const aiKeyRes = await request(port, 'GET', '/api/ai/key', null, { Cookie: adminCookie });
    assert.strictEqual(aiKeyRes.status, 200);
    assert.strictEqual(aiKeyRes.json.key, undefined, 'GET /api/ai/key must NEVER return raw API key');

    // Create temporary employee to verify employee RBAC boundaries
    const empEmail = `sec_test_${Date.now()}@example.invalid`;
    const createEmp = await request(port, 'POST', '/api/users', {
      name: 'Sec Test Employee',
      username: `sectest_${Date.now()}`,
      email: empEmail,
      password: 'TestUser#2026',
      role: 'employee',
      designation: 'FA'
    }, { Cookie: adminCookie });
    assert.strictEqual(createEmp.status, 201, 'Admin should be able to create employee');
    tempEmpId = createEmp.json.user.id;

    const empLogin = await request(port, 'POST', '/api/login', { identifier: empEmail, password: 'TestUser#2026' });
    assert.strictEqual(empLogin.status, 200);
    const empCookie = (empLogin.headers['set-cookie'] || [])[0].split(';')[0];

    const empUsersRes = await request(port, 'GET', '/api/users', null, { Cookie: empCookie });
    assert.strictEqual(empUsersRes.status, 200);
    assert(empUsersRes.json.users.every((u) => !u.email && !u.password && !u.username), 'Employee GET /api/users must strip email/username/password');

    const empCreateDeny = await request(port, 'POST', '/api/users', { name: 'Bad', password: 'Password1' }, { Cookie: empCookie });
    assert.strictEqual(empCreateDeny.status, 403, 'Employee POST /api/users must return 403');

    const empOtherUserDeny = await request(port, 'GET', '/api/users/usr_admin', null, { Cookie: empCookie });
    assert.strictEqual(empOtherUserDeny.status, 403, 'Employee GET /api/users/:otherId must return 403');
    console.log('✔ [5] RBAC boundaries & masked AI config verified');

    // Login rate limiting (>15 bad attempts returns 429)
    let got429 = false;
    for (let i = 0; i < 17; i++) {
      const failRes = await request(port, 'POST', '/api/login', { identifier: 'admin@cookscape.com', password: 'wrong_' + i });
      if (failRes.status === 429) {
        got429 = true;
        break;
      }
    }
    assert(got429, 'POST /api/login must enforce brute-force rate limiting (429)');
    console.log('✔ [6] Login brute-force rate limit (429) verified');
  } finally {
    if (tempEmpId && adminCookie) {
      await request(port, 'DELETE', `/api/users/${encodeURIComponent(tempEmpId)}`, null, { Cookie: adminCookie }).catch(() => {});
    }
    if (typeof srv.closeAllConnections === 'function') srv.closeAllConnections();
    await new Promise((r) => srv.close(r));
  }

  // 4. Verify XSS escaping helper in orbix-projects.js
  const noop = () => {};
  global.window = global;
  global.window.location = { pathname: '/login', search: '', hash: '' };
  global.window.history = { replaceState: noop, pushState: noop };
  global.window.addEventListener = noop;
  global.setInterval = () => 0;
  global.localStorage = { length: 0, key: () => null, getItem: () => null, setItem: noop, removeItem: noop };
  global.document = {
    readyState: 'complete',
    body: { classList: { toggle: noop } },
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: noop
  };
  global.fetch = () => Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({}) });

  require(path.join(ROOT, 'orbix-projects.js'));
  const escaped = global.window.OrbixProjects.escHtml('<img src=x onerror="alert(1)">');
  assert(!escaped.includes('<') && !escaped.includes('>'), 'escHtml must encode HTML tags');
  assert(escaped.includes('&lt;img') && escaped.includes('&quot;'), 'escHtml must entity-encode tags and quotes');
  console.log('✔ [7] Frontend HTML escaping verified');

  console.log('\n🎉 ALL SECURITY HARDENING CHECKS PASSED!');
  process.exit(0);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
