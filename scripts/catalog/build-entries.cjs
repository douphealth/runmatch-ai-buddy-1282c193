#!/usr/bin/env node
/**
 * Turns vetted candidates into shoe-database entries, with every field derived by a stated rule (see docs/CATALOG.md).
 *
 *   node scripts/catalog/build-entries.cjs review   # print the review table, write .catalog-work/entries.json
 *   node scripts/catalog/build-entries.cjs write    # insert them into src/lib/shoe-database.ts and amazon-asin-cache.json
 *
 * Inputs in .catalog-work/ (override with CATALOG_WORK):
 *   candidates.json  [{ id, brand, model, rr }]   rr = the RunRepeat slug (runrepeat.com/<slug>)
 *   discovered.json  written by `node scripts/amazon-catalog.mjs discover candidates.json --out .catalog-work/discovered.json`
 *   specs/<slug>.json written by scripts/catalog/specs.cjs
 *   overrides.json   optional: { "<id>": { category?, cushioning?, dropMM?, weightGrams?, priceUSD?, year? }, "_exclude": ["<id>"] }
 *
 * A candidate is kept only when ALL of these hold: an acceptable Amazon listing exists (exact model in the title,
 * men's/unisex, in stock, has a photo), the maker-stated drop and weight were read, and it is not already in the database.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const WORK = path.resolve(process.env.CATALOG_WORK || path.join(ROOT, '.catalog-work'));
const DB = path.join(ROOT, 'src/lib/shoe-database.ts');
const ASIN_CACHE = path.join(ROOT, 'src/lib/amazon-asin-cache.json');
const readJson = (f, d) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : d);

const IN_STOCK = new Set(['IN_STOCK', 'IN_STOCK_SCARCE', 'AVAILABLE_DATE', 'LEADTIME', 'AVAILABLE_NOW']);
/** [newer, older]: when both pass, only the newer generation is added. */
const SUPERSEDES = [['hoka-arahi-9', 'hoka-arahi-8'], ['altra-torin-9', 'altra-torin-8'], ['puma-velocity-nitro-5', 'puma-velocity-nitro-4']];
const BRAND_ORDER = ['Nike', 'Brooks', 'Asics', 'Hoka', 'Saucony', 'On', 'Adidas', 'Puma', 'New Balance', 'Salomon', 'Altra', 'Mizuno', 'Merrell', 'Topo Athletic', 'Skechers', 'Under Armour'];

/** Our own 1-10 cushioning scale from the maker's heel stack height (mm). */
const heelCushion = (h) => (h == null ? null : h <= 26 ? 4 : h <= 29 ? 5 : h <= 33 ? 6 : h <= 38 ? 7 : h <= 43 ? 8 : h <= 47 ? 9 : 10);

function classify(rr) {
  const t = rr.terrain.map((x) => x.toLowerCase());
  const trail = t.includes('trail');
  const road = t.includes('road');
  const arch = rr.arch.map((x) => x.toLowerCase());
  const pace = rr.pace.map((x) => x.toLowerCase());
  const plate = /carbon|plate/.test((rr.features || []).join(' ').toLowerCase());
  if (trail && !road) return 'trail';
  if (trail && road) return 'hybrid';
  if (arch.includes('stability')) return 'stability';
  if (pace.includes('competition')) return 'race';
  const tempo = pace.includes('tempo');
  if (rr.heelMM != null && rr.heelMM >= 44) return tempo && rr.weightG <= 260 ? 'speed' : 'max-cushion';
  if (tempo) return rr.weightG <= 255 || plate ? 'speed' : 'daily';
  if (plate) return 'speed';
  return 'daily';
}

function build(c, rr, listing, dates, overrides) {
  const ov = overrides[c.id] || {};
  const category = ov.category ?? classify(rr);
  const feats = (rr.features || []).join(' ');
  const plate = /carbon|plate/i.test(feats);
  let cush = heelCushion(rr.heelMM);
  const dflt = { daily: 7, 'max-cushion': 9, speed: 6, race: 8, trail: 7, stability: 7, hybrid: 7 };
  if (cush == null) cush = dflt[category];
  if (category === 'max-cushion') cush = Math.max(cush, 9);
  if (category === 'race') cush = Math.max(cush, 7);
  if (category === 'speed') cush = Math.min(cush, 8);
  cush = Math.max(cush, 5);
  if (ov.cushioning) cush = ov.cushioning;
  const price = Math.round(rr.priceTxt ?? rr.priceLd ?? listing.price ?? 0);
  const widths = rr.widths.filter((w) => !/:/.test(w));
  const wide = widths.some((w) => /wide/i.test(w));
  const w = rr.weightG;
  const budget = price <= 100;
  const terrain = category === 'trail' ? ['trail'] : category === 'hybrid' ? ['road', 'trail'] : ['road'];
  const pronation = category === 'stability' ? ['overpronation'] : ['neutral'];
  let dist;
  let bestFor;
  let inj = [];
  switch (category) {
    case 'daily':
      dist = budget ? ['5k', '10k', 'half-marathon'] : w >= 310 ? ['10k', 'half-marathon', 'marathon'] : ['5k', '10k', 'half-marathon', 'marathon'];
      bestFor = budget ? ['beginner', 'daily'] : price <= 150 && rr.dropMM >= 8 ? ['beginner', 'daily', 'long-run'] : ['daily', 'long-run'];
      inj = cush >= 8 ? ['plantar-fasciitis', 'knee-pain', 'shin-splints'] : ['knee-pain', 'shin-splints'];
      break;
    case 'max-cushion':
      dist = ['half-marathon', 'marathon', 'ultra'];
      bestFor = ['long-run', 'daily', 'recovery'];
      inj = ['plantar-fasciitis', 'knee-pain', 'shin-splints'];
      break;
    case 'stability':
      dist = ['10k', 'half-marathon', 'marathon'];
      bestFor = budget ? ['beginner', 'daily'] : ['daily', 'long-run'];
      inj = ['plantar-fasciitis', 'knee-pain', 'shin-splints', 'it-band'];
      break;
    case 'speed':
      dist = ['5k', '10k', 'half-marathon'];
      bestFor = plate ? ['speed-work', 'tempo', 'race-day'] : ['speed-work', 'tempo'];
      break;
    case 'race':
      dist = rr.heelMM >= 36 ? ['5k', '10k', 'half-marathon', 'marathon'] : ['5k', '10k', 'half-marathon'];
      bestFor = plate ? ['race-day', 'speed-work', 'pr-attempt'] : ['race-day', 'speed-work'];
      break;
    case 'trail':
      dist = rr.heelMM >= 36 && w >= 280 ? ['half-marathon', 'marathon', 'ultra'] : ['5k', '10k', 'half-marathon'];
      bestFor = rr.heelMM >= 36 && w >= 280 ? ['trail', 'long-run'] : ['trail'];
      inj = cush >= 7 ? ['knee-pain'] : [];
      break;
    default:
      dist = ['5k', '10k', 'half-marathon'];
      bestFor = ['daily', 'mixed-terrain'];
  }
  if (rr.dropMM >= 10 && cush >= 7 && ['daily', 'stability'].includes(category)) inj = [...inj, 'achilles'];
  if (wide && ['daily', 'stability', 'max-cushion'].includes(category) && widths.length >= 3) bestFor = [...bestFor, 'wide-feet'];
  const hi = [];
  if (rr.heelMM && rr.forefootMM) hi.push(`${rr.heelMM}/${rr.forefootMM} mm stack`);
  else if (rr.heelMM) hi.push(`${rr.heelMM} mm heel stack`);
  if (plate) hi.push('Carbon plate');
  else if (/rocker/i.test(feats)) hi.push('Rocker geometry');
  else if (rr.dropMM === 0) hi.push('Zero drop');
  else if (category === 'stability') hi.push('Stability support');
  else hi.push(`${rr.dropMM} mm drop`);
  if (widths.length >= 3) hi.push('Narrow to X-wide sizes');
  else if (wide) hi.push('Wide sizes available');
  else if (w <= 240) hi.push(`Light at ${w} g`);
  else if (budget) hi.push('Budget-friendly');
  else hi.push(`${w} g`);
  const d = dates[c.rr] || {};
  const relYear = rr.release ? +(rr.release.match(/(20\d\d)/) || [])[1] : null;
  const year = relYear || (rr.published ? +rr.published.slice(0, 4) : d.published ? +d.published.slice(0, 4) : 2026);
  const spec = {};
  for (const k of ['dropMM', 'weightGrams', 'priceUSD', 'year']) if (ov[k] != null) spec[k] = ov[k];
  return {
    id: c.id, brand: c.brand, model: c.model, year, category, cushioning: cush, dropMM: rr.dropMM, weightGrams: w,
    pronation, terrain, bestDistances: dist, bestFor, widthOptions: wide, priceUSD: price, injuryFriendly: inj,
    amazonASIN: listing.asin, imageURL: listing.image, highlights: hi.slice(0, 3), ...spec,
    _title: listing.title, _avail: listing.availability, _amazonPrice: listing.price, _rr: c.rr, _features: listing.features,
  };
}

/** Disagreements between our numbers and the numbers in Amazon's own listing text. Look at every flag by hand. */
function featCheck(e) {
  const flags = [];
  const text = (e._features || []).join(' ');
  const dm = text.match(/(\d{1,2}(?:\.\d)?)\s?mm\s+(?:heel[- ]to[- ]toe\s+)?(?:drop|offset)/i) || text.match(/(?:drop|offset)[^.]{0,30}?(\d{1,2}(?:\.\d)?)\s?mm/i);
  if (dm && Math.abs(+dm[1] - e.dropMM) >= 2) flags.push(`AMZ drop ${dm[1]} vs ${e.dropMM}`);
  const wm = text.match(/(\d{1,2}\.\d{1,2})\s?(?:oz|ounces)/i);
  if (wm) {
    const g = Math.round(+wm[1] * 28.35);
    if (Math.abs(g - e.weightGrams) >= 30) flags.push(`AMZ wt ${wm[1]}oz=${g}g vs ${e.weightGrams}`);
  }
  if (e._amazonPrice && e.priceUSD && (e._amazonPrice < e.priceUSD * 0.5 || e._amazonPrice > e.priceUSD * 1.6)) flags.push(`price ${e.priceUSD} vs Amazon ${e._amazonPrice}`);
  return flags;
}

function select() {
  const cands = readJson(path.join(WORK, 'candidates.json'), []);
  const disc = readJson(path.join(WORK, 'discovered.json'), {});
  const overrides = readJson(path.join(WORK, 'overrides.json'), {});
  const dates = readJson(path.join(WORK, 'dates.json'), {});
  const have = new Set([...fs.readFileSync(DB, 'utf8').matchAll(/id:\s*'([^']+)'/g)].map((m) => m[1]));
  const out = [];
  const skipped = [];
  const supersededInDb = new Set(SUPERSEDES.filter(([newer]) => have.has(newer)).map(([, older]) => older));
  for (const c of cands) {
    if (have.has(c.id)) { skipped.push(`${c.id}: already in database`); continue; }
    if (supersededInDb.has(c.id)) { skipped.push(`${c.id}: a newer generation is already in the database`); continue; }
    if ((overrides._exclude || []).includes(c.id)) { skipped.push(`${c.id}: excluded after review`); continue; }
    const d = disc[c.id];
    if (!d) { skipped.push(`${c.id}: not vetted on Amazon yet`); continue; }
    const l = d.best;
    if (!l) { skipped.push(`${c.id}: no acceptable Amazon listing`); continue; }
    if (!IN_STOCK.has(l.availability)) { skipped.push(`${c.id}: listing not in stock (${l.availability})`); continue; }
    if (!l.image) { skipped.push(`${c.id}: no Amazon photo`); continue; }
    const rr = readJson(path.join(WORK, 'specs', `${c.rr}.json`), null);
    if (!rr || rr.status !== 200 || rr.noSpecs || rr.dropMM == null || rr.weightG == null || rr.weightG < 150 || rr.weightG > 420) { skipped.push(`${c.id}: maker specs unusable`); continue; }
    const e = build(c, rr, l, dates, overrides);
    e._flags = featCheck(e);
    out.push(e);
  }
  for (const [newer, older] of SUPERSEDES) {
    if (out.some((e) => e.id === newer)) {
      const i = out.findIndex((e) => e.id === older);
      if (i >= 0) { skipped.push(`${older}: superseded by ${newer}`); out.splice(i, 1); }
    }
  }
  return { out, skipped };
}

const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const arr = (a) => `[${a.map(q).join(', ')}]`;
const block = (e, today) => `  {
    id: ${q(e.id)},
    brand: ${q(e.brand)},
    model: ${q(e.model)},
    year: ${e.year},
    category: ${q(e.category)},
    cushioning: ${e.cushioning},
    dropMM: ${e.dropMM},
    weightGrams: ${e.weightGrams},
    pronation: ${arr(e.pronation)},
    terrain: ${arr(e.terrain)},
    bestDistances: ${arr(e.bestDistances)},
    bestFor: ${arr(e.bestFor)},
    widthOptions: ${e.widthOptions},
    priceUSD: ${e.priceUSD},
    injuryFriendly: ${arr(e.injuryFriendly)},
    amazonASIN: ${q(e.amazonASIN)},
    reviewURL: 'https://gearuptofit.com/review/best-running-shoes/',
    imageURL: ${q(e.imageURL)},
    highlights: ${arr(e.highlights)},
    lastVerified: ${q(today)},
  },
`;

function write(out) {
  const today = new Date().toISOString().slice(0, 10);
  let src = fs.readFileSync(DB, 'utf8');
  const crlf = src.includes('\r\n');
  src = src.replace(/\r\n/g, '\n');
  const sorted = [...out].sort((a, b) => BRAND_ORDER.indexOf(a.brand) - BRAND_ORDER.indexOf(b.brand) || a.id.localeCompare(b.id));
  let text = `  // === ADDED ${today}: current models. Each has an in-stock men's/unisex Amazon listing (ASIN in amazon-asin-cache.json), its photo\n  // comes from that same listing, and drop, weight and MSRP are the maker's stated figures (see docs/CATALOG.md). ===\n`;
  let last = '';
  for (const e of sorted) {
    if (e.brand !== last) { text += `  // --- ${e.brand} ---\n`; last = e.brand; }
    text += block(e, today);
  }
  const marker = '];\n\n/**\n * Retired ids that still resolve';
  const at = src.indexOf(marker);
  if (at < 0) throw new Error('insertion marker not found in shoe-database.ts');
  src = src.slice(0, at) + text + src.slice(at);
  fs.writeFileSync(DB, crlf ? src.replace(/\n/g, '\r\n') : src);
  const cache = readJson(ASIN_CACHE, {});
  for (const e of sorted) {
    cache[e.id] = { asin: e.amazonASIN, title: e._title, url: `https://www.amazon.com/dp/${e.amazonASIN}?tag=papalex-20`, query: `${e.brand} ${e.model}`, resolvedAt: new Date().toISOString(), source: 'Amazon Creators API searchItems' };
  }
  fs.writeFileSync(ASIN_CACHE, JSON.stringify(cache, null, 2) + '\n');
  console.log(`added ${sorted.length} shoes. Now run: node scripts/amazon-catalog.mjs images --all && node scripts/audit-shoe-images.mjs && npm test`);
}

const mode = process.argv[2];
if (mode !== 'review' && mode !== 'write') {
  console.log('usage: node scripts/catalog/build-entries.cjs review | write');
  process.exit(1);
}
const { out, skipped } = select();
fs.mkdirSync(WORK, { recursive: true });
fs.writeFileSync(path.join(WORK, 'entries.json'), JSON.stringify(out, null, 1));
if (mode === 'review') {
  const pad = (s, n) => String(s).padEnd(n);
  for (const e of out) console.log(pad(e.id, 30), pad(e.year, 5), pad(e.category, 12), 'c' + pad(e.cushioning, 3), 'd' + pad(e.dropMM, 4), pad(e.weightGrams + 'g', 6), '$' + pad(e.priceUSD, 4), pad(e.widthOptions ? 'wide' : '-', 5), pad(e._avail, 16), e._flags.join('; '));
  console.log(`\nSELECTED ${out.length} | SKIPPED ${skipped.length}`);
  skipped.forEach((s) => console.log('  skip', s));
  console.log('\nRead every Amazon title before writing (kids\' sizes, BOA/GTX variants and women\'s listings slip past the code):');
  for (const e of out) console.log('  ', pad(e.id, 30), e._title.slice(0, 100));
} else write(out);
