#!/usr/bin/env node
/**
 * Amazon Creators API helper: re-checks every cached ASIN against Amazon's own
 * catalog, finds the right men's/unisex listing for a shoe, and fetches the product photo.
 *
 *   node scripts/amazon-catalog.mjs verify          # report ASINs Amazon no longer returns or whose title drifted
 *   node scripts/amazon-catalog.mjs verify --fix    # ...and clear them (the Amazon button is then hidden, never wrong)
 *   node scripts/amazon-catalog.mjs status          # stock + category of every linked listing (what a visitor lands on)
 *   node scripts/amazon-catalog.mjs resolve [--write] [shoe-id ...]   # re-resolve missing/women's-only listings (or the given shoes)
 *   node scripts/amazon-catalog.mjs resolve --refresh [--write]       # re-rank EVERY shoe and move to a better-stocked listing
 *   node scripts/amazon-catalog.mjs discover candidates.json [--out found.json]   # vet shoes not in the database yet
 *   node scripts/amazon-catalog.mjs gear            # photos for the gear in src/lib/gear-catalog.ts (title must name the brand)
 *   node scripts/amazon-catalog.mjs images          # photo URLs for shoes without a verified local photo
 *   node scripts/amazon-catalog.mjs images --all    # photo URLs for every shoe that has a verified ASIN
 *   node scripts/amazon-catalog.mjs search "Brooks Ghost 17"   # what Amazon returns for a query
 *
 * Credentials: see scripts/amazon-api.mjs (environment or a local credential file, never written anywhere).
 *
 * Images: the Creators API returns Amazon-hosted image URLs. We store the URLs (not copies of the files)
 * in src/lib/amazon-image-cache.json and the pages/PDF load them from Amazon's CDN. Re-run `images --all`
 * periodically so the URLs and the ASINs behind them stay current.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanModel, isPlausibleMatch } from './asin-match.mjs';
import { PARTNER_TAG, api, getListings, getToken, DETAIL_RESOURCES, flattenListing } from './amazon-api.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DB_PATH = path.join(ROOT, 'src/lib/shoe-database.ts');
const ASIN_CACHE = path.join(ROOT, 'src/lib/amazon-asin-cache.json');
const IMAGE_CACHE = path.join(ROOT, 'src/lib/amazon-image-cache.json');
const AUDIT_PATH = path.join(ROOT, 'src/lib/shoe-image-audit.ts');
const GEAR_PATH = path.join(ROOT, 'src/lib/gear-catalog.ts');
const GEAR_CACHE = path.join(ROOT, 'src/lib/gear-image-cache.json');

const getItems = (token, asins) => getListings(token, asins);

function parseShoes() {
  const src = fs.readFileSync(DB_PATH, 'utf8');
  const shoes = [];
  for (const b of src.split(/(?=\{\s*id:\s*')/g)) {
    const id = b.match(/id:\s*'([^']+)'/)?.[1];
    const brand = b.match(/brand:\s*'([^']+)'/)?.[1];
    const model = b.match(/model:\s*'([^']+)'/)?.[1];
    if (id && brand && model) shoes.push({ id, brand, model });
  }
  return shoes;
}
const slugOf = (s) => `${s.brand}-${s.model}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const loadJson = (p, fallback) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : fallback);
const saveJson = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 2) + '\n');

async function verify(fix) {
  const shoes = parseShoes();
  const cache = loadJson(ASIN_CACHE, {});
  const withAsin = shoes.filter((s) => cache[s.id]?.asin);
  const token = await getToken();
  console.log(`checking ${withAsin.length} ASINs against Amazon's catalog`);
  const found = await getItems(token, withAsin.map((s) => cache[s.id].asin));
  const problems = [];
  for (const s of withAsin) {
    const asin = cache[s.id].asin;
    const it = found.get(asin);
    if (!it) { problems.push({ id: s.id, asin, why: 'Amazon no longer returns this ASIN' }); continue; }
    const m = isPlausibleMatch(it.title, s.brand, s.model);
    if (!m.ok && !/women's listing/.test(m.reason)) problems.push({ id: s.id, asin, why: `${m.reason} <- "${it.title}"` });
  }
  for (const p of problems) console.log(`  PROBLEM ${p.id} ${p.asin}: ${p.why}`);
  console.log(`[amazon-catalog] ${withAsin.length - problems.length} ok, ${problems.length} problems`);
  if (fix && problems.length) {
    for (const p of problems) cache[p.id] = { asin: null, note: `cleared ${new Date().toISOString().slice(0, 10)}: ${p.why}`, resolvedAt: new Date().toISOString() };
    saveJson(ASIN_CACHE, cache);
    console.log(`cleared ${problems.length} entries`);
  }
  if (problems.length && !fix) process.exitCode = 1;
}

const IN_STOCK = new Set(['IN_STOCK', 'IN_STOCK_SCARCE', 'AVAILABLE_DATE', 'LEADTIME', 'AVAILABLE_NOW']);

async function status() {
  const shoes = parseShoes();
  const cache = loadJson(ASIN_CACHE, {});
  const withAsin = shoes.filter((s) => cache[s.id]?.asin);
  const token = await getToken();
  const found = await getListings(token, withAsin.map((s) => cache[s.id].asin));
  const counts = {};
  for (const s of withAsin) {
    const it = found.get(cache[s.id].asin);
    const a = it ? it.availability : 'NOT RETURNED';
    counts[a] = (counts[a] ?? 0) + 1;
    if (!it || !IN_STOCK.has(a)) console.log(`  ${a.padEnd(14)} ${s.id.padEnd(34)} ${cache[s.id].asin} ${it?.title.slice(0, 60) ?? ''}`);
  }
  console.log('[amazon-catalog] availability:', counts);
}

async function images(all) {
  const shoes = parseShoes();
  const cache = loadJson(ASIN_CACHE, {});
  const unverified = new Set([...fs.readFileSync(AUDIT_PATH, 'utf8').matchAll(/'([a-z0-9-]+)',/g)].map((m) => m[1]));
  const wanted = shoes.filter((s) => cache[s.id]?.asin && (all || unverified.has(slugOf(s))));
  const token = await getToken();
  console.log(`fetching photos for ${wanted.length} shoes`);
  const found = await getItems(token, wanted.map((s) => cache[s.id].asin));
  const out = {};
  const missing = [];
  for (const s of wanted) {
    const asin = cache[s.id].asin;
    const it = found.get(asin);
    // The API returns one photo size (500 px); asking the CDN for larger sizes returns the same file.
    if (it?.image) out[slugOf(s)] = { shoeId: s.id, asin, url: it.image, title: it.title, fetchedAt: new Date().toISOString().slice(0, 10) };
    else missing.push(s.id);
  }
  saveJson(IMAGE_CACHE, out);
  console.log(`[amazon-catalog] wrote ${Object.keys(out).length} photo URLs to src/lib/amazon-image-cache.json${missing.length ? `; no photo for: ${missing.join(', ')}` : ''}`);
}

// ---------------------------------------------------------------------------
// resolve / discover: find the right men's/unisex listing for a shoe from Amazon's own search
// ---------------------------------------------------------------------------
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const flat = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
const KIDS = /\b(kids?|boys?|girls?|toddlers?|youth|juniors?|infants?|little kid|big kid)\b/i;
const VARIANT = /\b(gtx|gore-?tex|waterproof|mid|boot|platinum|lite-?show|spikes?)\b/i;

/** Exact model (words in order), right brand, not kids'/women's-only/GTX/Mid, not another version. */
function acceptable(listing, shoe) {
  const { title, brand } = listing;
  if (!isPlausibleMatch(title, shoe.brand, shoe.model).ok) return false;
  if (!` ${norm(title)} `.includes(` ${norm(cleanModel(shoe.model))} `)) return false;
  if (!flat(`${title} ${brand}`).includes(flat(shoe.brand.split(' ')[0]))) return false;
  // A model without a number ("Cloudboom Strike") must not match its next generation ("Cloudboom Strike 2").
  const phrase = norm(cleanModel(shoe.model));
  if (!/^v?\d+$/.test(phrase.split(' ').pop())) {
    const next = ` ${norm(title)} `.split(` ${phrase} `)[1]?.trim().split(' ')[0];
    if (next && /^[2-6]$/.test(next)) return false;
  }
  // A numbered model must not match a newer number glued on ("Ghost 17" vs "Ghost 17 GTX" is handled by VARIANT).
  if (KIDS.test(title)) return false;
  if (VARIANT.test(title) && !VARIANT.test(shoe.model)) return false;
  return true;
}

/**
 * Higher is better. What a visitor lands on matters: a listing that is in stock with a price beats one that
 * is "currently unavailable"; a men's or unisex listing in a running category beats anything else.
 */
export function rankListing(l) {
  let s = 0;
  if (IN_STOCK.has(l.availability)) s += 100;
  if (l.price != null) s += 20;
  const t = l.title;
  const womens = /\bwomen/i.test(t) && !/\b(men['’]?s?|unisex)\b/i.test(t.replace(/women['’]?s?/gi, ''));
  if (womens) s -= 1000;
  if (/\bunisex\b/i.test(t) || /\bmen['’]?s?\b/i.test(t.replace(/women['’]?s?/gi, ''))) s += 10;
  if (l.browse.some((n) => /running|trail|track/i.test(n))) s += 10;
  if (l.browse.some((n) => /^women/i.test(n)) && !l.browse.some((n) => /^men|unisex/i.test(n))) s -= 50;
  if (/\bwide\b/i.test(t)) s -= 5;
  if (l.image) s += 5;
  return s;
}

const QUERIES = (shoe) => [`${shoe.brand} ${cleanModel(shoe.model)}`, `${shoe.brand} ${cleanModel(shoe.model)} men's running shoes`];

/** All acceptable search hits for one shoe, best first. */
async function findListings(token, shoe, used) {
  const seen = new Map();
  const usable = () => [...seen.values()].filter((l) => acceptable(l, shoe) && (!used || !used.has(l.asin) || used.get(l.asin) === shoe.id));
  for (const q of QUERIES(shoe)) {
    for (const page of [1, 2]) {
      const json = await api(token, '/catalog/v1/searchItems', { keywords: q, itemCount: 10, itemPage: page, resources: DETAIL_RESOURCES });
      for (const it of json.searchResult?.items ?? []) if (it.asin && !seen.has(it.asin)) seen.set(it.asin, flattenListing(it));
      // An exact, in-stock listing on the first page of the first query is the best we will find: stop spending calls.
      if (page === 1 && usable().some((l) => IN_STOCK.has(l.availability))) break;
    }
    if (usable().some((l) => IN_STOCK.has(l.availability))) break;
  }
  const hits = usable();
  hits.sort((a, b) => rankListing(b) - rankListing(a));
  return { hits, checked: seen.size };
}

async function resolve(ids, write, refresh) {
  const shoes = parseShoes();
  const cache = loadJson(ASIN_CACHE, {});
  const womens = (e) => /\bwomen/i.test(e?.title ?? '');
  const targets = ids.length ? shoes.filter((s) => ids.includes(s.id)) : refresh ? shoes : shoes.filter((s) => !cache[s.id]?.asin || womens(cache[s.id]));
  const token = await getToken();
  const used = new Map(Object.entries(cache).filter(([, e]) => e.asin).map(([id, e]) => [e.asin, id]));
  console.log(`resolving ${targets.length} shoes via Amazon search`);
  let changed = 0;
  for (const shoe of targets) {
    const { hits, checked } = await findListings(token, shoe, used);
    const best = hits[0];
    if (!best) {
      console.log(`  --  ${shoe.id}: no listing for this exact model (${checked} results checked)`);
      continue;
    }
    const current = cache[shoe.id]?.asin;
    if (refresh && current === best.asin) { console.log(`  ==  ${shoe.id}: ${best.asin} is already the best (${best.availability})`); continue; }
    if (refresh && current) {
      // Only move when the new listing is clearly better than what is linked now.
      const cur = hits.find((h) => h.asin === current);
      if (cur && rankListing(cur) >= rankListing(best)) { console.log(`  ==  ${shoe.id}: keeps ${current} (${cur.availability})`); continue; }
    }
    const title = best.title;
    console.log(`  OK  ${shoe.id}: ${best.asin} [${best.availability}${best.price ? ' $' + best.price : ''}]  ${title.slice(0, 70)}${current ? `  (was ${current})` : ''}`);
    if (current) used.delete(current);
    used.set(best.asin, shoe.id);
    cache[shoe.id] = {
      asin: best.asin,
      title,
      url: `https://www.amazon.com/dp/${best.asin}?tag=${PARTNER_TAG}`,
      query: `${shoe.brand} ${cleanModel(shoe.model)}`,
      resolvedAt: new Date().toISOString(),
      source: 'Amazon Creators API searchItems',
    };
    changed++;
  }
  if (write && changed) { saveJson(ASIN_CACHE, cache); console.log(`wrote ${changed} entries`); }
  else if (changed) console.log('(dry run: add --write to save)');
}

/** Vets shoes that are not in the database yet. Input: [{ id, brand, model }]. Output: best listing + the other acceptable ones. */
async function discover(file, out) {
  const wanted = JSON.parse(fs.readFileSync(file, 'utf8'));
  const cache = loadJson(ASIN_CACHE, {});
  const used = new Map(Object.entries(cache).filter(([, e]) => e.asin).map(([id, e]) => [e.asin, id]));
  const token = await getToken();
  const results = loadJson(out, {});
  console.log(`discovering ${wanted.length} shoes (${Object.keys(results).length} already in ${path.basename(out)})`);
  for (const shoe of wanted) {
    if (results[shoe.id]) continue;
    const { hits, checked } = await findListings(token, shoe, used);
    results[shoe.id] = { shoe, checked, best: hits[0] ?? null, others: hits.slice(1, 4).map((h) => ({ asin: h.asin, title: h.title, availability: h.availability })) };
    const b = hits[0];
    console.log(`${b ? 'OK ' : '-- '} ${shoe.id.padEnd(34)} ${b ? `${b.asin} [${b.availability}${b.price ? ' $' + b.price : ''}] ${b.title.slice(0, 66)}` : `no acceptable listing (${checked} checked)`}`);
    saveJson(out, results);
  }
}

/** Photo URLs for the gear in src/lib/gear-catalog.ts; the listing title must contain the brand. */
async function gear() {
  const src = fs.readFileSync(GEAR_PATH, 'utf8');
  const items = [...src.matchAll(/asin: '([A-Z0-9]{10})',[^}]*?brand: '([^']+)'/g)].map((m) => ({ asin: m[1], brand: m[2] }));
  const token = await getToken();
  console.log(`checking ${items.length} gear ASINs`);
  const found = await getItems(token, items.map((i) => i.asin));
  const out = {};
  const problems = [];
  for (const { asin, brand } of items) {
    const it = found.get(asin);
    if (!it) problems.push(`: not returned by Amazon`);
    else if (!it.title.toLowerCase().includes(brand.toLowerCase())) problems.push(`: title does not mention ${brand}: ${it.title}`);
    else if (!it.image) problems.push(`: no photo`);
    else out[asin] = { url: it.image, title: it.title, fetchedAt: new Date().toISOString().slice(0, 10) };
  }
  saveJson(GEAR_CACHE, out);
  console.log(`[amazon-catalog] wrote ${Object.keys(out).length} gear photos`);
  for (const p of problems) console.log(`  PROBLEM ${p}`);
  if (problems.length) process.exitCode = 1;
}

async function search(query) {
  const token = await getToken();
  const json = await api(token, '/catalog/v1/searchItems', { keywords: query, itemCount: 10, resources: DETAIL_RESOURCES });
  for (const it of json.searchResult?.items ?? []) {
    const l = flattenListing(it);
    console.log(`${l.asin}  [${l.availability}${l.price ? ' $' + l.price : ''}]  ${l.title}`);
  }
}

const [cmd, ...rest] = process.argv.slice(2);
try {
  if (cmd === 'verify') await verify(rest.includes('--fix'));
  else if (cmd === 'status') await status();
  else if (cmd === 'images') await images(rest.includes('--all'));
  else if (cmd === 'gear') await gear();
  else if (cmd === 'resolve') await resolve(rest.filter((a) => !a.startsWith('--')), rest.includes('--write'), rest.includes('--refresh'));
  else if (cmd === 'discover' && rest[0]) {
    const o = rest.indexOf('--out');
    await discover(rest[0], o >= 0 ? rest[o + 1] : 'discovered.json');
  } else if (cmd === 'search' && rest[0]) await search(rest.join(' '));
  else { console.log('usage: node scripts/amazon-catalog.mjs verify [--fix] | status | resolve [--write] [--refresh] [shoe-id ...] | discover <file.json> [--out f.json] | images [--all] | gear | search "<query>"'); process.exitCode = 1; }
} catch (e) {
  console.error(`[amazon-catalog] ${e.message}`);
  process.exit(1);
}
