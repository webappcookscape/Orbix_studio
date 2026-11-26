const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('=== TEST SUITE: CUSTOM VARIANT (ROOM-WISE) & LINK GENERATION ===\n');

// 1. Check UI & Template files for required Custom Variant elements
console.log('--- Test 1: Verify UI & DOM Elements in orbix-client-quote.js ---');
const cqJs = fs.readFileSync(path.join(__dirname, '../orbix-client-quote.js'), 'utf8');
assert(cqJs.includes('id="cqOpenCustomVariantBtn"'), 'orbix-client-quote.js must include cqOpenCustomVariantBtn');
assert(cqJs.includes('id="cqRoomWiseSelectorDrawer"'), 'orbix-client-quote.js must include cqRoomWiseSelectorDrawer');
assert(cqJs.includes('id="cqBulkRoomTierSelect"'), 'orbix-client-quote.js must include cqBulkRoomTierSelect');
assert(cqJs.includes('id="cqApplyCustomBtn"'), 'orbix-client-quote.js must include cqApplyCustomBtn');
assert(cqJs.includes('id="cqCustomVariantCardWrap"'), 'orbix-client-quote.js must include cqCustomVariantCardWrap');
assert(cqJs.includes('CUSTOM VARIANT (Room-Wise)'), 'orbix-client-quote.js must include CUSTOM VARIANT label');
console.log('✓ UI integration verified: Button, Room Selector Drawer, Bulk Selector & Custom Variant Card present!');

// 2. Check quote-review.html for Room-Wise Variant Breakdown & badges
console.log('\n--- Test 2: Verify Room-Wise Breakdown in quote-review.html ---');
const reviewHtml = fs.readFileSync(path.join(__dirname, '../quote-review.html'), 'utf8');
assert(reviewHtml.includes('Room-Wise Breakdown &amp; Finishes'), 'quote-review.html must include Room-Wise Breakdown & Finishes header');
assert(reviewHtml.includes('av.isCustomVariant'), 'quote-review.html must support av.isCustomVariant');
console.log('✓ quote-review.html verified with Room-Wise Breakdown & Finish badges!');

// 3. Check quoteDeckBuilder and clientQuoteService
console.log('\n--- Test 3: Backend Normalization & Deck Builder Support ---');
const quoteDeckBuilder = require('../server/services/quoteDeckBuilder');
const norm = quoteDeckBuilder.normalizeTemplateVariantKey('custom');
assert.strictEqual(norm, 'custom', 'normalizeTemplateVariantKey must return custom for custom tier');
assert.strictEqual(quoteDeckBuilder.normalizeTemplateVariantKey('custom variant'), 'custom');
assert.strictEqual(quoteDeckBuilder.normalizeTemplateVariantKey('custom (room-wise)'), 'custom');
console.log('✓ normalizeTemplateVariantKey correctly handles custom variant keys!');

// 4. Test Deck Builder generation with Custom Variant
console.log('\n--- Test 4: Generate Client Quote Deck with Custom Room-Wise Variant ---');
const dummyQuoteRecord = {
  quoteCode: 'ORB-2026-TEST',
  clientName: 'Suresh Kumar',
  clientPhone: '9876543210',
  siteAddress: 'Chennai, TN',
  quoteSnapshot: {
    meta: { title: 'Prestige Lakeside Villa' },
    designer: { name: 'Cookscape Designer', phone: '9999999999' },
    variantQuotes: [
      {
        tierKey: 'custom',
        tierTitle: 'CUSTOM VARIANT (Room-Wise)',
        isCustomVariant: true,
        grandTotal: 850000,
        roomBreakdown: [
          { name: 'Kitchen', variantLabel: '4X TUFF GLOSS', itemCount: 12, roomSubtotal: 380000 },
          { name: 'Master Bedroom', variantLabel: 'CAPRICOAST MATTE', itemCount: 16, roomSubtotal: 320000 },
          { name: 'Living Room', variantLabel: 'POT & CAFE', itemCount: 8, roomSubtotal: 150000 }
        ],
        items: [
          { refCode: 'C1', room: 'Kitchen', name: 'Base 2-Drawer Unit', finish: 'HDHMR / 4X Tuff Gloss', areaSft: 18, baseRate: 2100, totalAmount: 37800 },
          { refCode: 'C2', room: 'Master Bedroom', name: '3-Door Wardrobe', finish: 'HDHMR / Capricoast Matte', areaSft: 36, baseRate: 1750, totalAmount: 63000 }
        ],
        commercial: {
          woodworkSubtotal: 850000,
          grandTotal: 850000
        }
      }
    ]
  }
};

const deckSlides = quoteDeckBuilder.buildClientQuoteDeck(dummyQuoteRecord, quoteDeckBuilder.loadTemplateData());
assert.ok(Array.isArray(deckSlides), 'Slides must be an array');
assert.ok(deckSlides.length >= 10, 'Deck must contain cover, intro, custom variant sections, policy and closing slides');

const customSpecsSlide = deckSlides.find(s => s.id === 'var_0_specs');
assert.ok(customSpecsSlide, 'Must include custom variant specifications slide');
assert.strictEqual(customSpecsSlide.title, 'CUSTOM VARIANT (Room-Wise)');
assert.ok(customSpecsSlide.tables && customSpecsSlide.tables.length > 0, 'Specs slide must include Room-Wise Custom Finishes table');
assert.strictEqual(customSpecsSlide.tables[0].title, 'Room-Wise Custom Finishes');
assert.strictEqual(customSpecsSlide.tables[0].rows.length, 3, 'Must contain 3 room rows');

console.log('✓ Client Quote Deck built successfully with Custom Room-Wise Variant and Room Finishes Table!');

// 5. Test Room-Wise Pricing Engine with orbix-core.js
console.log('\n--- Test 5: Room-Wise Pricing Calculation via OrbixCore ---');
const Core = require('../orbix-core');

const sampleProject = {
  plan: {
    rooms: [
      { id: 'room_kitchen', name: 'Kitchen' },
      { id: 'room_mbr', name: 'Master Bedroom' }
    ],
    furniture: [
      {
        id: 'u1',
        roomId: 'room_kitchen',
        name: 'Sink Base Unit',
        catalogId: 'sink_base',
        category: 'base',
        dimensions: { W: 900, D: 600, H: 860 },
        areaSft: 20
      },
      {
        id: 'u2',
        roomId: 'room_mbr',
        name: 'Master Wardrobe',
        catalogId: 'wardrobe_4d',
        category: 'wardrobe',
        dimensions: { W: 1800, D: 600, H: 2100 },
        areaSft: 40
      }
    ]
  },
  rateCard: Object.assign({}, Core.DEFAULT_RATE_CARD, {
    selectedTier: 'custom',
    roomTiers: {
      'room_kitchen': 'MR+', // 4X Tuff Gloss (Higher Rate)
      'room_mbr': 'CC MATTE' // Capricoast Matte (Standard Rate)
    }
  }),
  commercialCharges: {
    freightEnabled: false,
    gstEnabled: false
  }
};

const quoteCustom = Core.generateFullQuotation(sampleProject, ['all']);
assert.ok(quoteCustom, 'Quotation must be generated');
assert.strictEqual(quoteCustom.furnitureItems.length, 2, 'Must include 2 items');

const kitchenItem = quoteCustom.furnitureItems.find(it => it.roomId === 'room_kitchen');
const mbrItem = quoteCustom.furnitureItems.find(it => it.roomId === 'room_mbr');

// Calculate single-tier quotes to verify room rates are isolated
const projectAllMR = JSON.parse(JSON.stringify(sampleProject));
projectAllMR.rateCard.selectedTier = 'MR+';
delete projectAllMR.rateCard.roomTiers;
const quoteAllMR = Core.generateFullQuotation(projectAllMR, ['all']);
const mrKitchenItem = quoteAllMR.furnitureItems.find(it => it.roomId === 'room_kitchen');

const projectAllMatte = JSON.parse(JSON.stringify(sampleProject));
projectAllMatte.rateCard.selectedTier = 'CC MATTE';
delete projectAllMatte.rateCard.roomTiers;
const quoteAllMatte = Core.generateFullQuotation(projectAllMatte, ['all']);
const matteMbrItem = quoteAllMatte.furnitureItems.find(it => it.roomId === 'room_mbr');

assert.strictEqual(kitchenItem.baseRate, mrKitchenItem.baseRate, 'Kitchen item must be priced with MR+ (4X Tuff Gloss)');
assert.strictEqual(mbrItem.baseRate, matteMbrItem.baseRate, 'Master Bedroom item must be priced with CC MATTE');

console.log(`✓ Kitchen Rate: ₹${kitchenItem.baseRate}/sft (MR+ / 4X TG) | Bedroom Rate: ₹${mbrItem.baseRate}/sft (CC MATTE)`);
console.log('✓ Room-Wise independent tier calculation confirmed 100% accurate!');

// 6. Test that Design Fee Slab is anchored to that specific project's Surabhi Woodwork Value
console.log('\n--- Test 6: Verify Design Charges Anchored to Project Surabhi Value ---');
assert(typeof Core.getSurabhiWoodworkSubtotal === 'function', 'Core.getSurabhiWoodworkSubtotal must be exported');
const surabhiWoodwork = Core.getSurabhiWoodworkSubtotal(sampleProject, ['all']);
assert.ok(surabhiWoodwork > 0, 'Surabhi woodwork must be > 0');
const slab = Core.getSurabhiDesignFeeSlab(surabhiWoodwork, 'auto');
assert.ok(slab && slab.fullDesignCharges > 0, 'Slab must be determined from Surabhi woodwork');
console.log(`✓ Project Surabhi Woodwork: ₹${surabhiWoodwork.toLocaleString('en-IN')} -> Slab: ${slab.label} (Full: ₹${slab.fullDesignCharges.toLocaleString('en-IN')}, Client Pays: ₹${slab.discountedCharges.toLocaleString('en-IN')})`);

console.log('\n🎉 ALL CUSTOM VARIANT (ROOM-WISE) TESTS PASSED PERFECTLY! 🚀');
