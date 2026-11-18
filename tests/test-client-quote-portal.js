/**
 * Automated End-to-End Integration & Security Verification Suite:
 * Strict Master-Template.pptx Flow:
 * 1. Cover (Slide 1) + Intro (Slides 2-6) + Policy/Payment/T&C/FAQs (Slides 22-28) + Closing (Slide 29) always intact
 * 2. Selected Variants ONLY -> Divider -> Specs -> Auto Unit Snips (with unit icon thumbs) -> Quotation
 * 3. ZERO 2D or 3D slides / image endpoints
 * 4. Client Login Isolation, Watermarking, Protected Asset Streaming, Revocation & PPTX Export
 */

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
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const raw = buf.toString('utf8');
        let json = null;
        try { json = JSON.parse(raw); } catch (_) {}
        resolve({ status: res.statusCode, headers: res.headers, buf, raw, json });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function extractCookie(setCookieHdr) {
  if (!setCookieHdr) return '';
  const arr = Array.isArray(setCookieHdr) ? setCookieHdr : [setCookieHdr];
  return arr.map((c) => c.split(';')[0]).filter(Boolean).join('; ');
}

async function runTests() {
  console.log('=== TEST SUITE: STRICT MASTER-TEMPLATE CLIENT QUOTE PORTAL ===\n');

  process.env.USE_JSON_STORE = 'true';
  process.env.PORT = '0';

  const srvMod = require(path.join(ROOT, 'server', 'server.js'));
  const srv = srvMod.server;
  await new Promise((r) => (srv.listening ? r() : srv.once('listening', r)));
  const port = srv.address().port;

  let createdQuoteId = null;
  let createdProjectId = null;
  let emp1Cookie = '';
  let emp2Cookie = '';

  try {
    // 1. Direct static access to private template assets or quote store MUST be blocked
    for (const privPath of [
      '/server/quote-assets/slide_01_bg.jpg',
      '/server/quote-assets/slide_10.jpg',
      '/server/quote-assets/template-data.json',
      '/data/client_quotes_store.json'
    ]) {
      const r = await request(port, 'GET', privPath);
      assert(r.status === 403 || r.status === 404, `${privPath} must be blocked over HTTP (got ${r.status})`);
    }
    console.log('✓ [1] Private Master-Template artwork and quote stores are blocked from direct HTTP access');

    // 2. Unauthenticated access to designer endpoints must fail with 401
    assert.strictEqual((await request(port, 'POST', '/api/client-quotes', {})).status, 401);
    assert.strictEqual((await request(port, 'GET', '/api/client-quotes/project/proj_any')).status, 401);
    assert.strictEqual((await request(port, 'POST', '/api/client-quotes/export-pptx', {})).status, 401);
    console.log('✓ [2] Unauthenticated requests to /api/client-quotes reject with 401');

    // 3. Log in as two separate designers
    let login1 = await request(port, 'POST', '/api/login', { identifier: 'elakkiya', password: 'password123' });
    if (login1.status !== 200) {
      login1 = await request(port, 'POST', '/api/login', { identifier: 'elakkiya', password: 'studio@2026' });
    }
    assert.strictEqual(login1.status, 200);
    emp1Cookie = extractCookie(login1.headers['set-cookie']);

    let login2 = await request(port, 'POST', '/api/login', { identifier: 'aravind', password: 'password123' });
    if (login2.status !== 200) {
      login2 = await request(port, 'POST', '/api/login', { identifier: 'aravind', password: 'studio@2026' });
    }
    assert.strictEqual(login2.status, 200);
    emp2Cookie = extractCookie(login2.headers['set-cookie']);

    const projCreate = await request(port, 'POST', '/api/projects', {
      title: 'Test Quote Villa',
      client: 'Mr. Karthik Test',
      type: 'Kitchen & Wardrobe',
      data: { plan: { walls: [], rooms: [], furniture: [] } }
    }, { Cookie: emp1Cookie });
    assert.strictEqual(projCreate.status, 201);
    createdProjectId = projCreate.json.project.id;

    // 4. Reject non-Master-Template tier names
    const badTierRes = await request(port, 'POST', '/api/client-quotes', {
      projectId: createdProjectId,
      clientName: 'Bad Tier Client',
      clientUsername: 'badtier1',
      clientPassword: 'Password#1',
      quoteSnapshot: { variantQuotes: [{ tierKey: 'zappo - el pearl', items: [] }] }
    }, { Cookie: emp1Cookie });
    assert.strictEqual(badTierRes.status, 400);

    // 5. Generate Protected Multi-Variant Quote (CC MATTE + MR+) with unitIcons (zero 2D/3D)
    const sampleUnitPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const quotePayload = {
      projectId: createdProjectId,
      title: 'Karthik Villa Modular Proposal',
      quoteCode: 'ORB-TEST-901',
      clientName: 'Mr. Karthik Test',
      clientPhone: '+91 99999 88888',
      siteAddress: 'Adyar, Chennai',
      clientUsername: 'karthik.901',
      clientPassword: 'ClientPass#901',
      expiryDays: 15,
      securitySettings: {
        watermarkEnabled: true,
        blurShieldEnabled: true
      },
      quoteSnapshot: {
        meta: {
          title: 'Karthik Villa Modular Proposal',
          clientName: 'Mr. Karthik Test',
          phone: '+91 99999 88888',
          siteAddress: 'Adyar, Chennai',
          quoteId: 'ORB-TEST-901',
          designerName: 'Elakkiya',
          dateCreated: '18/11/2026'
        },
        designer: { name: 'Elakkiya', phone: '93611 84787', email: 'designs.cookscape@gmail.com' },
        unitIcons: { u0_base_600: sampleUnitPng },
        variantQuotes: [
          {
            tierKey: 'CC MATTE',
            tierTitle: 'CAPRICOAST MATTE',
            roomScopeLabel: 'Kitchen, Master Bedroom',
            currencySymbol: '₹',
            grandTotal: 452000,
            roomsSummary: [
              { name: 'Kitchen', itemCount: 2, roomSubtotal: 240000, percentShare: 65 },
              { name: 'Master Bedroom', itemCount: 1, roomSubtotal: 128000, percentShare: 35 }
            ],
            commercial: {
              woodworkSubtotal: 368000,
              additionalAccessories: 15000,
              appliances: 0,
              designPercent: 9,
              designAmount: 33120,
              freightPercent: 2.5,
              freightAmount: 9200,
              netBeforeTax: 383051,
              gstPercent: 18,
              gstAmount: 68949,
              grandTotal: 452000
            },
            items: [
              { refCode: 'K01', room: 'Kitchen', name: 'Base Unit B600', dimensions: '600 x 600 x 850', finish: 'HDHMR / Matte', qtyText: '8.5 sft', rate: 1650, amount: 14025, iconKey: 'u0_base_600' }
            ],
            notes: 'Soft-close hinges included on all kitchen units.'
          },
          {
            tierKey: 'MR+',
            tierTitle: '4X TUFF GLOSS',
            roomScopeLabel: 'Kitchen, Master Bedroom',
            currencySymbol: '₹',
            grandTotal: 548000,
            roomsSummary: [
              { name: 'Kitchen', itemCount: 2, roomSubtotal: 290000, percentShare: 65 },
              { name: 'Master Bedroom', itemCount: 1, roomSubtotal: 156000, percentShare: 35 }
            ],
            commercial: {
              woodworkSubtotal: 446000,
              additionalAccessories: 15000,
              appliances: 0,
              designPercent: 9,
              designAmount: 40140,
              freightPercent: 2.5,
              freightAmount: 11150,
              netBeforeTax: 464407,
              gstPercent: 18,
              gstAmount: 83593,
              grandTotal: 548000
            },
            items: [
              { refCode: 'K01', room: 'Kitchen', name: 'Base Unit B600', dimensions: '600 x 600 x 850', finish: 'BWP / 4X Gloss', qtyText: '8.5 sft', rate: 1990, amount: 16915, iconKey: 'u0_base_600' }
            ]
          }
        ]
      }
    };

    const createRes = await request(port, 'POST', '/api/client-quotes', quotePayload, { Cookie: emp1Cookie });
    assert.strictEqual(createRes.status, 201, `Create quote failed: ${createRes.raw}`);
    assert(createRes.json.quote && createRes.json.quote.shareToken);
    assert(!('passwordHash' in createRes.json.quote));
    createdQuoteId = createRes.json.quote.id;
    const shareToken = createRes.json.quote.shareToken;
    console.log('✓ [3] Strictly Master-Template client quote link generated cleanly');

    // 6. Ownership isolation
    assert.strictEqual((await request(port, 'GET', `/api/client-quotes/project/${createdProjectId}`, null, { Cookie: emp2Cookie })).status, 403);
    assert.strictEqual((await request(port, 'PATCH', `/api/client-quotes/${createdQuoteId}`, { isRevoked: true }, { Cookie: emp2Cookie })).status, 403);
    console.log('✓ [4] Ownership isolation blocks other designers from viewing/revoking quotes');

    // 7. Pre-auth portal denials
    assert.strictEqual((await request(port, 'GET', `/quote/${shareToken}`)).status, 200);
    assert.strictEqual((await request(port, 'GET', `/api/client-portal/${shareToken}/payload`)).status, 401);
    assert.strictEqual((await request(port, 'GET', `/api/client-portal/${shareToken}/asset/slide_01_bg.jpg`)).status, 401);
    assert.strictEqual((await request(port, 'GET', `/api/client-portal/${shareToken}/asset/unit_icon_u0_base_600`)).status, 401);
    console.log('✓ [5] Client portal denies payload, Cover artwork, and Unit Snip icons (401) before client login');

    // 8. Client Login Isolation
    assert.strictEqual((await request(port, 'POST', `/api/client-portal/${shareToken}/login`, { username: 'karthik.901', password: 'Wrong' })).status, 401);
    const okLogin = await request(port, 'POST', `/api/client-portal/${shareToken}/login`, { username: 'KARTHIK.901', password: 'ClientPass#901' });
    assert.strictEqual(okLogin.status, 200);
    const clientCookie = extractCookie(okLogin.headers['set-cookie']);
    assert.strictEqual((await request(port, 'GET', '/api/projects', null, { Cookie: clientCookie })).status, 401);
    console.log('✓ [6] Client login creates isolated session without CAD API access');

    // 9. Exact Slide Sequence Verification (Cover -> Intro 2-6 -> [Divider, Specs, Unit Snips, Quotation] -> Process/Terms/FAQs -> Closing, ZERO 2D/3D)
    const deckRes = await request(port, 'GET', `/api/client-portal/${shareToken}/payload`, null, { Cookie: clientCookie });
    assert.strictEqual(deckRes.status, 200);
    const slides = deckRes.json.deck.slides;
    const slideIds = slides.map((s) => s.id);
    const slideTypes = slides.map((s) => s.type);

    assert(!slideIds.some((id) => id.includes('preview_2d') || id.includes('preview_3d')), '2D & 3D preview slides MUST NOT exist');
    assert(!slideTypes.includes('project_preview'), 'project_preview type MUST NOT exist');

    // Strict template order checks
    const expectedOrder = [
      'cover',
      'intro_2', 'intro_3', 'intro_4', 'intro_5', 'intro_6',
      'var_0_divider', 'var_0_specs', 'var_0_units_0', 'var_0_quotation',
      'var_1_divider', 'var_1_specs', 'var_1_units_0', 'var_1_quotation',
      'process_design', 'process_execution', 'policy_inclusions', 'policy_payment', 'policy_terms'
    ];
    let lastPos = -1;
    for (const eid of expectedOrder) {
      const pos = slideIds.indexOf(eid);
      assert(pos > lastPos, `Slide ${eid} missing or out of Master Template order (found ${pos}, prev ${lastPos})`);
      lastPos = pos;
    }
    assert.strictEqual(slideIds[slideIds.length - 1], 'closing', 'Last slide must be Slide 29 closing');
    assert(slides[0].coverBgAsset === 'slide_01_bg.jpg' && slides[0].coverLayout && slides[0].coverLayout.dynamicSlots);

    // Fetch protected artwork + unit icon
    const covRes = await request(port, 'GET', `/api/client-portal/${shareToken}/asset/slide_01_bg.jpg`, null, { Cookie: clientCookie });
    assert.strictEqual(covRes.status, 200);
    assert(covRes.buf.length > 20000);

    const iconRes = await request(port, 'GET', `/api/client-portal/${shareToken}/asset/unit_icon_u0_base_600`, null, { Cookie: clientCookie });
    assert.strictEqual(iconRes.status, 200);
    assert.strictEqual(iconRes.headers['content-type'], 'image/png');
    console.log('✓ [7] Master Template flow exact (Cover -> Intro 2-6 -> Divider -> Specs -> Unit Snips -> Quotation -> Process/Terms -> Closing; zero 2D/3D)');

    // 10. Revocation + Password Rotation
    assert.strictEqual((await request(port, 'PATCH', `/api/client-quotes/${createdQuoteId}`, { isRevoked: true }, { Cookie: emp1Cookie })).status, 200);
    assert.strictEqual((await request(port, 'GET', `/api/client-portal/${shareToken}/payload`, null, { Cookie: clientCookie })).status, 403);
    assert.strictEqual((await request(port, 'PATCH', `/api/client-quotes/${createdQuoteId}`, { isRevoked: false, clientPassword: 'RotatedPass#2' }, { Cookie: emp1Cookie })).status, 200);
    assert.strictEqual((await request(port, 'POST', `/api/client-portal/${shareToken}/login`, { username: 'karthik.901', password: 'RotatedPass#2' })).status, 200);
    console.log('✓ [8] Instant revocation (403) and password rotation verified');

    // 11. Master PPTX Export with auto Unit Snips before Quotation Slides
    const pptxRes = await request(port, 'POST', '/api/client-quotes/export-pptx', {
      clientName: quotePayload.clientName,
      clientPhone: quotePayload.clientPhone,
      siteAddress: quotePayload.siteAddress,
      quoteCode: quotePayload.quoteCode,
      meta: quotePayload.quoteSnapshot.meta,
      designer: quotePayload.quoteSnapshot.designer,
      variantQuotes: quotePayload.quoteSnapshot.variantQuotes,
      unitIcons: quotePayload.quoteSnapshot.unitIcons
    }, { Cookie: emp1Cookie });
    assert.strictEqual(pptxRes.status, 200, `PPTX export failed: ${pptxRes.status}`);
    assert.strictEqual(pptxRes.buf.slice(0, 2).toString('utf8'), 'PK');
    assert(pptxRes.buf.includes('orbix_unit_snip_12_1.png'), 'PPTX must embed CAPRICOAST MATTE Unit Snip slide PNG');
    assert(pptxRes.buf.includes('orbix_quote_slide_12.png'), 'PPTX must embed CAPRICOAST MATTE Quotation PNG');
    assert(pptxRes.buf.includes('orbix_unit_snip_21_1.png'), 'PPTX must embed 4X TUFF GLOSS Unit Snip slide PNG');
    assert(pptxRes.buf.includes('orbix_quote_slide_21.png'), 'PPTX must embed 4X TUFF GLOSS Quotation PNG');
    console.log('✓ [9] Master-Template.pptx export embeds Unit Snips + Quotation per selected variant cleanly');

    console.log('\n=== ALL STRICT MASTER-TEMPLATE CLIENT QUOTE TESTS PASSED SUCCESSFULLY ===');
  } finally {
    if (createdQuoteId && emp1Cookie) {
      await request(port, 'DELETE', `/api/client-quotes/${createdQuoteId}`, null, { Cookie: emp1Cookie }).catch(() => {});
    }
    if (createdProjectId && emp1Cookie) {
      await request(port, 'DELETE', `/api/projects/${createdProjectId}`, null, { Cookie: emp1Cookie }).catch(() => {});
    }
    srv.close();
  }
}

runTests().catch((err) => {
  console.error('\nTEST FAILED:', err);
  process.exit(1);
});
