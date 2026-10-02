#!/usr/bin/env node
/**
 * Amazon Creators API helper: re-checks every cached ASIN against Amazon's own
 * catalog and fetches the product photo for shoes that have no photo of their own.
 *
 *   node scripts/amazon-catalog.mjs verify          # report ASINs Amazon no longer returns or whose title drifted
 *   node scripts/amazon-catalog.mjs verify --fix    # ...and clear them (the Amazon button is then hidden, never wrong)
 *   node scripts/amazon-catalog.mjs resolve [--write] [shoe-id ...]   # re-resolve missing/women's-only listings (or the given shoes) from Amazon's search
 *   node scripts/amazon-catalog.mjs gear            # photos for the gear in src/lib/gear-catalog.ts (title must name the brand)
 *   node scripts/amazon-catalog.mjs images          # photo URLs for shoes without a verified local photo
 *   node scripts/amazon-catalog.mjs images --all    # photo URLs for every shoe that has a verified ASIN
 *   node scripts/amazon-catalog.mjs search "Brooks Ghost 17"   # what Amazon returns for a query (for resolving ASINs)
 *
 * Credentials come from the environment and are never written anywhere:
 *   AMAZON_CREATORS_CLIENT_ID / AMAZON_CREATORS_CLIENT_SECRET
 * or, for a local text file that contains "amzn1.application-oa2-client.…" / "amzn1.oa2-cs.v1.…" pairs:
 *   AMAZON_CREDENTIAL_FILE=path/to/file  [AMAZON_CREATORS_CLIENT_ID=<which pair to use, default: the last one>]
 *
 * Images: the Creators API returns Amazon-hosted image URLs. We store the URLs (not copies of the files)
 * in src/lib/amazon-image-cache.json and the pages/PDF load them from Amazon's CDN. Re-run `images`
 * periodically so the URLs and the ASINs behind them stay current.
 *
 * Node's built-in fetch cannot reach creatorsapi.amazon (TLS reset), so this uses node:https.
 */
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';
import { cleanModel, isPlausibleMatch } from './asin-match.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DB_PATH = path.join(ROOT, 'src/lib/shoe-database.ts');
const ASIN_CACHE = path.join(ROOT, 'src/lib/amazon-asin-cache.json');
const IMAGE_CACHE = path.join(ROOT, 'src/lib/amazon-image-cache.json');
const AUDIT_PATH = path.join(ROOT, 'src/lib/shoe-image-audit.ts');
const GEAR_PATH = path.join(ROOT, 'src/lib/gear-catalog.ts');
const GEAR_CACHE = path.join(ROOT, 'src/lib/gear-image-cache.json');
const PARTNER_TAG = 'papalex-20';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function request({ host, pathname, method = 'POST', headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const req = https.request({ host, path: pathname, method, headers, timeout: 45000 }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        let json;
        try { json = JSON.parse(data); } catch { json = { raw: data.slice(0, 200) }; }
        resolve({ status: res.statusCode, json });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
    if (body) req.write(body);
    req.end();
  });
}

function credentials() {
  let id = process.env.AMAZON_CREATORS_CLIENT_ID;
  let secret = process.env.AMAZON_CREATORS_CLIENT_SECRET;
  const file = process.env.AMAZON_CREDENTIAL_FILE;
  if ((!id || !secret) && file) {
    const txt = fs.readFileSync(file, 'utf8');
    const ids = [...txt.matchAll(/amzn1\.application-oa2-client\.[0-9a-f]+/g)].map((m) => m[0]);
    const secrets = [...txt.matchAll(/amzn1\.oa2-cs\.v1\.[0-9a-f]+/g)].map((m) => m[0]);
    const i = id ? ids.lastIndexOf(id) : ids.length - 1;
    id = ids[i];
    secret = secrets[i];
  }
  if (!id || !secret) {
    console.error('Set AMAZON_CREATORS_CLIENT_ID and AMAZON_CREATORS_CLIENT_SECRET (or AMAZON_CREDENTIAL_FILE).');
    process.exit(1);
  }
  return { id, secret };
}

async function getToken() {
  const { id, secret } = credentials();
  const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret, scope: 'creatorsapi::default' }).toString();
  const { status, json } = await request({
    host: 'api.amazon.com',
    pathname: '/auth/o2/token',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
    body,
  });
  if (!json.access_token) throw new Error(`Amazon token request failed (${status}): ${json.error ?? ''} ${json.error_description ?? ''}`);
  return json.access_token;
}

/** One API call with the throttling Amazon enforces (about 1 request per second to start with). */
async function api(token, endpoint, payload) {
  const body = JSON.stringify({ partnerTag: PARTNER_TAG, ...payload });
  for (let attempt = 0; attempt < 8; attempt++) {
    const { status, json } = await request({
      host: 'creatorsapi.amazon',
      pathname: endpoint,
      headers: { Authorization: `Bearer ${token}`, 'x-marketplace': 'www.amazon.com', 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      body,
    });
    if (status === 429) { await sleep(1500 + attempt * 1500); continue; }
    if (status !== 200) throw new Error(`${endpoint} -> ${status}: ${JSON.stringify(json).slice(0, 200)}`);
    await sleep(1200);
    return json;
  }
  throw new Error(`${endpoint}: still throttled after retries`);
}

const RESOURCES = ['images.primary.large', 'itemInfo.title'];
async function getItems(token, asins) {
  const found = new Map();
  for (let i = 0; i < asins.length; i += 10) {
    const json = await api(token, '/catalog/v1/getItems', { itemIds: asins.slice(i, i + 10), resources: RESOURCES });
    for (const it of json.itemsResult?.items ?? []) {
      found.set(it.asin, {
        title: it.itemInfo?.title?.displayValue ?? '',
        image: it.images?.primary?.large?.url ?? null,
        url: it.detailPageURL,
      });
    }
    process.stdout.write('.');
  }
  process.stdout.write('\n');
  return found;
}

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
    if (it?.image) out[slugOf(s)] = { shoeId: s.id, asin, url: it.image, title: it.title, fetchedAt: new Date().toISOString().slice(0, 10) };
    else missing.push(s.id);
  }
  saveJson(IMAGE_CACHE, out);
  console.log(`[amazon-catalog] wrote ${Object.keys(out).length} photo URLs to src/lib/amazon-image-cache.json${missing.length ? `; no photo for: ${missing.join(', ')}` : ''}`);
}

// ---------------------------------------------------------------------------
// resolve: find the right men's/unisex listing for a shoe from Amazon's own search
// ---------------------------------------------------------------------------
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const flat = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
const KIDS = /\b(kids?|boys?|girls?|toddlers?|youth|juniors?|infants?|little kid|big kid)\b/i;
const VARIANT = /\b(gtx|gore-?tex|waterproof|mid|boot|platinum|lite-?show|spikes?)\b/i;
const SEARCH_RESOURCES = [...RESOURCES, 'itemInfo.byLineInfo'];

/** Exact model (words in order), right brand, not kids'/women's-only/GTX/Mid, not another version. */
function acceptable(item, shoe) {
  const title = item.itemInfo?.title?.displayValue ?? '';
  const brand = item.itemInfo?.byLineInfo?.brand?.displayValue ?? '';
  if (!isPlausibleMatch(title, shoe.brand, shoe.model).ok) return false;
  if (!` ${norm(title)} `.includes(` ${norm(cleanModel(shoe.model))} `)) return false;
  if (!flat(`${title} ${brand}`).includes(flat(shoe.brand.split(' ')[0]))) return false;
  // A model without a number ("Cloudboom Strike") must not match its next generation ("Cloudboom Strike 2").
  const phrase = norm(cleanModel(shoe.model));
  if (!/^v?\d+$/.test(phrase.split(' ').pop())) {
    const next = ` ${norm(title)} `.split(` ${phrase} `)[1]?.trim().split(' ')[0];
    if (next && /^[2-6]$/.test(next)) return false;
  }
  if (KIDS.test(title)) return false;
  if (VARIANT.test(title) && !VARIANT.test(shoe.model)) return false;
  return true;
}

async function resolve(ids, write) {
  const shoes = parseShoes();
  const cache = loadJson(ASIN_CACHE, {});
  const womens = (e) => /\bwomen/i.test(e?.title ?? '');
  const targets = ids.length ? shoes.filter((s) => ids.includes(s.id)) : shoes.filter((s) => !cache[s.id]?.asin || womens(cache[s.id]));
  const token = await getToken();
  const used = new Map(Object.entries(cache).filter(([, e]) => e.asin).map(([id, e]) => [e.asin, id]));
  console.log(`resolving ${targets.length} shoes via Amazon search`);
  let changed = 0;
  for (const shoe of targets) {
    const seen = new Map();
    for (const q of [`${shoe.brand} ${cleanModel(shoe.model)}`, `${shoe.brand} ${cleanModel(shoe.model)} men's running shoes`]) {
      for (const page of [1, 2]) {
        const json = await api(token, '/catalog/v1/searchItems', { keywords: q, itemCount: 10, itemPage: page, resources: SEARCH_RESOURCES });
        for (const it of json.searchResult?.items ?? []) if (it.asin && !seen.has(it.asin)) seen.set(it.asin, it);
      }
    }
    const hits = [...seen.values()].filter((it) => acceptable(it, shoe) && (!used.has(it.asin) || used.get(it.asin) === shoe.id));
    // The API orders by relevance. Prefer standard width over "Wide" variants.
    hits.sort((a, b) => Number(/\bwide\b/i.test(a.itemInfo?.title?.displayValue ?? '')) - Number(/\bwide\b/i.test(b.itemInfo?.title?.displayValue ?? '')));
    const best = hits[0];
    if (!best) {
      console.log(`  --  ${shoe.id}: no listing for this exact model (${seen.size} results checked)`);
      continue;
    }
    const title = best.itemInfo?.title?.displayValue ?? '';
    console.log(`  OK  ${shoe.id}: ${best.asin}  ${title.slice(0, 80)}`);
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
  const json = await api(token, '/catalog/v1/searchItems', { keywords: query, itemCount: 10, resources: RESOURCES });
  for (const it of json.searchResult?.items ?? []) console.log(`${it.asin}  ${it.itemInfo?.title?.displayValue ?? ''}`);
}

const [cmd, ...rest] = process.argv.slice(2);
try {
  if (cmd === 'verify') await verify(rest.includes('--fix'));
  else if (cmd === 'images') await images(rest.includes('--all'));
  else if (cmd === 'gear') await gear();
  else if (cmd === 'resolve') await resolve(rest.filter((a) => !a.startsWith('--')), rest.includes('--write'));
  else if (cmd === 'search' && rest[0]) await search(rest.join(' '));
  else { console.log('usage: node scripts/amazon-catalog.mjs verify [--fix] | resolve [--write] [shoe-id ...] | images [--all] | gear | search "<query>"'); process.exitCode = 1; }
} catch (e) {
  console.error(`[amazon-catalog] ${e.message}`);
  process.exit(1);
}
