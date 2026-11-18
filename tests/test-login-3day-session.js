const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

function request(port, method, reqPath, body, cookie) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = { Connection: 'close' };
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    if (cookie) headers.Cookie = cookie;

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
  console.log('=== VERIFYING START WITH LOGIN & 3-DAY SESSION ===\n');

  // 1. Verify HTML & SW static defaults
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert(html.includes('<div id="authScreen" class="auth-screen" style="display:flex;">'), 'index.html must display #authScreen initially');
  assert(html.includes('<div id="app" style="display:none;">'), 'index.html must hide #app until authenticated');
  assert(html.includes('3 days'), 'Login screen must state 3 days session lifetime');

  const built = fs.readFileSync(path.join(ROOT, 'cupboard-cad.html'), 'utf8');
  assert(built.includes('<div id="authScreen" class="auth-screen" style="display:flex;">'), 'cupboard-cad.html bundle must reflect initial login screen');

  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  assert(sw.includes("url.pathname === '/api/me'"), 'sw.js must never cache /api/me');
  console.log('✔ [1] Initial HTML login gate & Service Worker exclusions verified');

  // 2. Verify Session Store 3-day expiry eviction
  process.env.USE_JSON_STORE = 'true';
  process.env.PORT = '0';
  const ResilientSessionStore = require(path.join(ROOT, 'server', 'config', 'session.js'));
  const store = new ResilientSessionStore();
  await new Promise((r) => store.set('sid_expired', { userId: 'usr_admin', loginExpiresAt: Date.now() - 5000 }, r));
  const expiredSess = await new Promise((r) => store.get('sid_expired', (_e, s) => r(s)));
  assert.strictEqual(expiredSess, null, 'Expired (>3d) session must not be returned by session store');

  await new Promise((r) => store.set('sid_valid', { userId: 'usr_admin', loginExpiresAt: Date.now() + THREE_DAYS_MS }, r));
  const validSess = await new Promise((r) => store.get('sid_valid', (_e, s) => r(s)));
  assert.strictEqual(validSess.userId, 'usr_admin', 'Active (<3d) session must persist in store');
  await new Promise((r) => store.destroy('sid_valid', r));
  console.log('✔ [2] ResilientSessionStore 3-day expiration & eviction verified');

  // 3. Live Express HTTP flow (401 on boot, Login -> 3-day cookie, /api/me -> 200, Logout -> 401)
  const srvMod = require(path.join(ROOT, 'server', 'server.js'));
  const srv = srvMod.server;
  await new Promise((r) => (srv.listening ? r() : srv.once('listening', r)));
  const port = srv.address().port;

  try {
    const meAnon = await request(port, 'GET', '/api/me');
    assert.strictEqual(meAnon.status, 401, 'Unauthenticated GET /api/me must return 401');

    const projAnon = await request(port, 'GET', '/api/projects');
    assert.strictEqual(projAnon.status, 401, 'Unauthenticated GET /api/projects must return 401');

    const badLogin = await request(port, 'POST', '/api/login', { identifier: 'admin@cookscape.com', password: 'wrong' });
    assert.strictEqual(badLogin.status, 401, 'Invalid credentials must return 401');

    const beforeLogin = Date.now();
    let okLogin = await request(port, 'POST', '/api/login', { identifier: 'admin@cookscape.com', password: 'password123' });
    if (okLogin.status === 401) {
      okLogin = await request(port, 'POST', '/api/login', { identifier: 'admin@cookscape.com', password: 'studio@2026' });
    }
    assert.strictEqual(okLogin.status, 200, 'Valid admin login must return 200');
    assert.strictEqual(okLogin.json.success, true);
    assert.strictEqual(okLogin.json.sessionDays, 3);
    const ttlDelta = okLogin.json.sessionExpiresAt - beforeLogin;
    assert(ttlDelta >= THREE_DAYS_MS - 5000 && ttlDelta <= THREE_DAYS_MS + 10000, `Session expiresAt delta must be ~3 days, got ${ttlDelta}ms`);

    const setCookie = (okLogin.headers['set-cookie'] || [])[0] || '';
    assert(setCookie.includes('orbix.sid='), 'Login must set orbix.sid cookie');
    const cookieHeader = setCookie.split(';')[0];
    if (setCookie.includes('Expires=')) {
      const expStr = setCookie.match(/Expires=([^;]+)/i)[1];
      const cookieDelta = new Date(expStr).getTime() - beforeLogin;
      assert(cookieDelta >= THREE_DAYS_MS - 10000 && cookieDelta <= THREE_DAYS_MS + 10000, `Cookie Expires must be ~3 days, got ${cookieDelta}ms`);
    }

    const meAuthed = await request(port, 'GET', '/api/me', null, cookieHeader);
    assert.strictEqual(meAuthed.status, 200, 'Authenticated GET /api/me must return 200');
    assert.strictEqual(meAuthed.json.user.id, 'usr_admin');

    const projAuthed = await request(port, 'GET', '/api/projects', null, cookieHeader);
    assert.strictEqual(projAuthed.status, 200, 'Authenticated GET /api/projects must return 200');

    const logoutRes = await request(port, 'POST', '/api/logout', null, cookieHeader);
    assert.strictEqual(logoutRes.status, 200, 'POST /api/logout must return 200');

    const meAfterLogout = await request(port, 'GET', '/api/me', null, cookieHeader);
    assert.strictEqual(meAfterLogout.status, 401, 'GET /api/me after logout must return 401');
    console.log('✔ [3] Live Express auth lifecycle (401 -> 3-day login cookie -> 200 -> logout 401) verified');
  } finally {
    if (typeof srv.closeAllConnections === 'function') srv.closeAllConnections();
    await new Promise((r) => srv.close(r));
  }

  // 4. Frontend OrbixProjects boot/login/3-day expiry behavior
  const storage = {};
  const authEl = { style: { display: 'flex' } };
  const appEl = { style: { display: 'none' } };
  const errEl = { style: { display: 'none' } };
  const elMap = { authScreen: authEl, app: appEl, authScreenError: errEl };
  const noop = () => {};

  global.window = global;
  global.window.location = { pathname: '/', search: '', hash: '' };
  global.window.history = { replaceState: noop, pushState: noop };
  global.window.addEventListener = noop;
  global.setInterval = () => 0;
  global.localStorage = {
    get length() { return Object.keys(storage).length; },
    key: (i) => Object.keys(storage)[i] || null,
    getItem: (k) => (k in storage ? storage[k] : null),
    setItem: (k, v) => { storage[k] = String(v); },
    removeItem: (k) => { delete storage[k]; }
  };
  global.document = {
    readyState: 'complete',
    body: { classList: { toggle: noop } },
    getElementById: (id) => elMap[id] || null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: noop
  };
  let mockMeStatus = 401;
  let mockMeBody = { success: false };
  global.fetch = (url) => {
    if (String(url).includes('/api/me')) {
      return Promise.resolve({
        ok: mockMeStatus === 200,
        status: mockMeStatus,
        json: () => Promise.resolve(mockMeBody)
      });
    }
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ success: true, users: [], projects: [] }) });
  };

  require(path.join(ROOT, 'orbix-projects.js'));
  const OP = global.window.OrbixProjects;

  // Case A: Fresh start (empty storage, 401 server) -> must show login page
  assert.strictEqual(OP.currentUser, null, 'Fresh boot must NOT auto-login as Admin');
  assert.strictEqual(authEl.style.display, 'flex', 'Fresh boot must display authScreen');
  assert.strictEqual(appEl.style.display, 'none', 'Fresh boot must keep app hidden');

  // Case B: Legacy cached user WITHOUT orbix_session_expires_at -> must force login
  localStorage.setItem('orbix_current_user', JSON.stringify({ id: 'usr_admin', name: 'Cookscape Admin', role: 'admin' }));
  OP.loadCachedUser();
  assert.strictEqual(OP.currentUser, null, 'Legacy cache without 3-day expiry must require login');
  assert.strictEqual(authEl.style.display, 'flex');

  // Case C: Logged-in user with active <3 day session -> stays logged in
  OP.setCurrentUser({ id: 'usr_admin', name: 'Cookscape Admin', role: 'admin' });
  const expStored = Number(localStorage.getItem('orbix_session_expires_at'));
  assert(expStored > Date.now() + THREE_DAYS_MS - 5000, 'setCurrentUser must store 3-day expiration');
  OP.loadCachedUser();
  assert.strictEqual(OP.currentUser.id, 'usr_admin', 'Active session within 3 days must stay signed in');
  assert.strictEqual(appEl.style.display, 'flex', 'App workspace must be visible within 3-day window');

  // Case D: Expired >3 day session -> logs out to login screen
  localStorage.setItem('orbix_session_expires_at', String(Date.now() - 1000));
  OP.loadCachedUser();
  assert.strictEqual(OP.currentUser, null, 'Expired session (>3 days) must log user out');
  assert.strictEqual(authEl.style.display, 'flex', 'Expired session must show login page');
  assert.strictEqual(appEl.style.display, 'none');

  console.log('✔ [4] Frontend startup, 3-day session retention, and >3d expiration verified');
  console.log('\n🎉 ALL LOGIN & 3-DAY SESSION TESTS PASSED!');
  process.exit(0);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
