/**
 * Automated End-to-End Integration & Security Verification Suite:
 * Strict Master-Template.pptx Flow:
 * 1. Cover (Slide 1) + Intro (Slides 2-6) + Policy/Payment/T&C/FAQs (Slides 22-28) + Closing (Slide 29) always intact
 * 2. Selected Variants ONLY -> Divider -> Specs -> Auto Unit Snips (with unit icon thumbs) -> Quotation
 * 3. ZERO 2D or 3D slides / image endpoints
 * 4. Client Login Isolation, Watermarking, Protected Asset Streaming, Revocation & PPTX Export
 */

const assert = require('assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const http = require('http');
const os = require('os');
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

    // 4. Reject unknown tier names
    const badTierRes = await request(port, 'POST', '/api/client-quotes', {
      projectId: createdProjectId,
      clientName: 'Bad Tier Client',
      clientUsername: 'badtier1',
      clientPassword: 'Password#1',
      quoteSnapshot: { variantQuotes: [{ tierKey: 'unknown_tier_xyz', items: [] }] }
    }, { Cookie: emp1Cookie });
    assert.strictEqual(badTierRes.status, 400);

    // 5. Generate Protected Multi-Variant Quote (4 newly added variants + CC MATTE + MR+) with unitIcons (zero 2D/3D)
    const sampleUnitPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const mkVariant = (tierKey, tierTitle, total) => ({
      tierKey,
      tierTitle,
      roomScopeLabel: 'Kitchen, Master Bedroom',
      currencySymbol: '₹',
      grandTotal: total,
      roomsSummary: [
        { name: 'Kitchen', itemCount: 2, roomSubtotal: Math.round(total * 0.55), percentShare: 65 },
        { name: 'Master Bedroom', itemCount: 1, roomSubtotal: Math.round(total * 0.25), percentShare: 35 }
      ],
      commercial: {
        woodworkSubtotal: Math.round(total * 0.8),
        additionalAccessories: 15000,
        appliances: 0,
        designPercent: 9,
        designAmount: Math.round(total * 0.07),
        freightPercent: 2.5,
        freightAmount: Math.round(total * 0.02),
        netBeforeTax: Math.round(total / 1.18),
        gstPercent: 18,
        gstAmount: total - Math.round(total / 1.18),
        grandTotal: total
      },
      items: [
        { refCode: 'K01', room: 'Kitchen', name: 'Base Unit B600', dimensions: '600 x 600 x 850', finish: tierTitle, qtyText: '8.5 sft', rate: 1650, amount: 14025, iconKey: 'u0_base_600' }
      ],
      notes: 'Soft-close hinges included on all kitchen units.'
    });
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
        watermarkEnabled: false,
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
          mkVariant('zappo - el pearl', 'ZAPPO EL PEARL', 310000),
          mkVariant('pot&cafe', 'POT & CAFE', 345000),
          mkVariant('homespace', 'HOME SPACE', 380000),
          mkVariant('cafehunt', 'CAFÉ HUNT', 415000),
          mkVariant('CC MATTE', 'CAPRICOAST MATTE', 452000),
          mkVariant('MR+', '4X TUFF GLOSS', 548000)
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

    // Strict template order checks (6 variants including 4 newly added + CC MATTE + MR+)
    assert.strictEqual(deckRes.json.deck.watermarkText, '', 'Watermark text must be removed');
    assert.strictEqual(deckRes.json.deck.securitySettings.watermarkEnabled, false, 'Watermark must be disabled');
    const expectedOrder = [
      'cover',
      'intro_2', 'intro_3', 'intro_4', 'intro_5', 'intro_6',
      'var_0_divider', 'var_0_specs', 'var_0_units_0', 'var_0_quotation',
      'var_1_divider', 'var_1_specs', 'var_1_units_0', 'var_1_quotation',
      'var_2_divider', 'var_2_specs', 'var_2_units_0', 'var_2_quotation',
      'var_3_divider', 'var_3_specs', 'var_3_units_0', 'var_3_quotation',
      'var_4_divider', 'var_4_specs', 'var_4_units_0', 'var_4_quotation',
      'var_5_divider', 'var_5_specs', 'var_5_units_0', 'var_5_quotation',
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
    assert.strictEqual(slides[0].coverLayout.coverBakedStatics, true);
    assert.strictEqual(slides[0].coverLayout.dynamicSlots.patron_name.x, 255.4);
    assert.strictEqual(slides[0].coverLayout.dynamicSlots.designer_name.x, 664.8);

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
    await request(port, 'PATCH', `/api/client-quotes/${createdQuoteId}`, { isRevoked: false, clientPassword: 'RotatedPass#2' }, { Cookie: emp1Cookie });
    assert.strictEqual((await request(port, 'POST', `/api/client-portal/${shareToken}/login`, { username: 'karthik.901', password: 'RotatedPass#2' })).status, 200);

    // 1 Day and 1 Year expiry options verified
    const uiSrc = fs.readFileSync(path.join(ROOT, 'orbix-client-quote.js'), 'utf8');
    assert(uiSrc.includes('<option value="1">1 Day</option>'), 'UI must include 1 Day expiry option');
    assert(uiSrc.includes('<option value="365">1 Year</option>'), 'UI must include 1 Year expiry option');

    const exp1Res = await request(port, 'PATCH', `/api/client-quotes/${createdQuoteId}`, { expiryDays: 1 }, { Cookie: emp1Cookie });
    assert.strictEqual(exp1Res.status, 200);
    const diff1Days = (new Date(exp1Res.json.quote.expiresAt).getTime() - Date.now()) / 86400000;
    assert(diff1Days > 0.9 && diff1Days <= 1.05, `Expected ~1 day expiry, got ${diff1Days}`);

    const exp365Res = await request(port, 'PATCH', `/api/client-quotes/${createdQuoteId}`, { expiryDays: 365 }, { Cookie: emp1Cookie });
    assert.strictEqual(exp365Res.status, 200);
    const diff365Days = (new Date(exp365Res.json.quote.expiresAt).getTime() - Date.now()) / 86400000;
    assert(diff365Days > 364.9 && diff365Days <= 365.05, `Expected ~365 days expiry, got ${diff365Days}`);
    console.log('✓ [8] Instant revocation (403), password rotation, and 1 Day / 1 Year expiry verified');

    // 11. Master PPTX Export (Zero PIL dependency, native OOXML tables & unit icons, all 9 variants)
    const exportSrc = fs.readFileSync(path.join(ROOT, 'scripts', 'export_quote_pptx.py'), 'utf8');
    assert(!exportSrc.includes('from PIL') && !exportSrc.includes('import PIL'), 'export_quote_pptx.py must NOT depend on PIL/Pillow');
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
    const tmpPptx = path.join(os.tmpdir(), `orbix_verify_s1_${Date.now()}.pptx`);
    fs.writeFileSync(tmpPptx, pptxRes.buf);
    try {
      const pyCheck = 'import sys,zipfile,json; z=zipfile.ZipFile(sys.argv[1]); names=z.namelist(); print(json.dumps({"names":names,"s1":z.read("ppt/slides/slide1.xml").decode("utf-8"),"s9":z.read("ppt/slides/slide9.xml").decode("utf-8"),"s12":z.read("ppt/slides/slide12.xml").decode("utf-8"),"s15":z.read("ppt/slides/slide15.xml").decode("utf-8"),"s18":z.read("ppt/slides/slide18.xml").decode("utf-8"),"s24":z.read("ppt/slides/slide24.xml").decode("utf-8"),"s33":z.read("ppt/slides/slide33.xml").decode("utf-8"),"u1":z.read("ppt/slides/slide_unit_1.xml").decode("utf-8")}))';
      const parsed = JSON.parse(execFileSync('python', ['-c', pyCheck, tmpPptx], { encoding: 'utf8' }));
      assert(parsed.names.includes('ppt/media/orbix_uicon_u0_base_600.png'), 'PPTX must embed unit icon PNG');
      assert(parsed.names.includes('ppt/slides/slide_unit_1.xml') && parsed.names.includes('ppt/slides/slide_unit_6.xml'), 'PPTX must include Unit Breakdown slides for all 6 selected variants');
      assert(!parsed.names.includes('ppt/slides/slide19.xml'), 'Unselected LL ELITE slides must be excluded');
      assert(parsed.s9.includes('ZAPPO EL PEARL') && parsed.s9.includes('<a:tbl>'), 'Slide 9 must have native Zappo El Pearl quotation table');
      assert(parsed.s12.includes('POT &amp; CAFE') && parsed.s12.includes('<a:tbl>'), 'Slide 12 must have native Pot & Cafe quotation table');
      assert(parsed.s15.includes('HOME SPACE') && parsed.s15.includes('<a:tbl>'), 'Slide 15 must have native Home Space quotation table');
      assert(parsed.s18.includes('CAFÉ HUNT') && parsed.s18.includes('<a:tbl>'), 'Slide 18 must have native Café Hunt quotation table');
      assert(parsed.s24.includes('CAPRICOAST MATTE') && parsed.s24.includes('<a:tbl>'), 'Slide 24 must have native Capricoast Matte quotation table');
      assert(parsed.s33.includes('4X TUFF GLOSS') && parsed.s33.includes('<a:tbl>'), 'Slide 33 must have native 4X Tuff Gloss quotation table');
      assert(parsed.u1.includes('UNIT-WISE BREAKDOWN') && parsed.u1.includes('Base Unit B600'), 'Unit Breakdown slide must include native unit table');
      assert(parsed.s1.includes('Mr. Karthik Test'), 'PPTX Slide 1 must contain client name');
      assert(parsed.s1.includes('Elakkiya'), 'PPTX Slide 1 must contain designer name');
      assert(parsed.s1.includes('x="2420000"') && parsed.s1.includes('cx="3600000"'), 'PPTX Slide 1 must apply quotegenerator client value alignment');
      assert(parsed.s1.includes('x="6300000"') && parsed.s1.includes('cx="2750000"'), 'PPTX Slide 1 must apply quotegenerator designer value alignment');
      assert(!parsed.s1.includes('Mr. Aravindan') && !parsed.s1.includes('7418414780') && !parsed.s1.includes('Individual Villa Adyar') && !parsed.s1.includes('Mr. Abishek'), 'PPTX Slide 1 must not leak sample placeholders');
    } finally {
      try { fs.unlinkSync(tmpPptx); } catch (_) {}
    }
    console.log('✓ [9] Zero-PIL Master-Template.pptx export verified for all new + existing variants with native OOXML tables & Slide 1 alignments');

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
