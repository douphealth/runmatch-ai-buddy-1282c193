#!/usr/bin/env node
/**
 * Resolve real Amazon ASINs for every shoe using SerpAPI's amazon engine.
 *
 * Strategy:
 *  - Read shoe database (brand + model).
 *  - Load existing cache (src/lib/amazon-asin-cache.json) so we NEVER re-query.
 *  - For each uncached shoe, call SerpAPI amazon search with a precise query.
 *  - Pick the top organic result whose title contains the brand AND a strong
 *    model-token match. Reject sponsored/irrelevant results.
 *  - Save the cache after EVERY successful call so partial runs are durable.
 *  - Rotate between SERPAPI_KEY_1 and SERPAPI_KEY_2 (250 calls/mo each).
 *  - Hard cap calls per run via MAX_CALLS env var (default 60) to protect quota.
 *
 * Output: src/lib/amazon-asin-cache.json   (id -> { asin, title, url, query })
 */

import fs from 'node:fs';
import path from 'node:path';
import { cleanModel, isPlausibleMatch } from './asin-match.mjs';

const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, 'src/lib/shoe-database.ts');
const CACHE_PATH = path.join(ROOT, 'src/lib/amazon-asin-cache.json');

const KEYS = [process.env.SERPAPI_KEY_1, process.env.SERPAPI_KEY_2].filter(Boolean);
if (KEYS.length === 0) {
  console.error('No SERPAPI_KEY_1 / SERPAPI_KEY_2 env vars set.');
  process.exit(1);
}

const MAX_CALLS = Number(process.env.MAX_CALLS || 60);
const ONLY_ID = process.env.ONLY_ID || null; // optional: resolve a single shoe
const FORCE = process.env.FORCE === '1';

// --- Parse shoe DB (regex is fine — it's a flat array of object literals) ---
function parseShoes() {
  const src = fs.readFileSync(DB_PATH, 'utf8');
  // Split on `{ id: '...'` blocks
  const blocks = src.split(/(?=\{\s*id:\s*')/g);
  const shoes = [];
  for (const b of blocks) {
    const id = b.match(/id:\s*'([^']+)'/)?.[1];
    const brand = b.match(/brand:\s*'([^']+)'/)?.[1];
    const model = b.match(/model:\s*'([^']+)'/)?.[1];
    if (id && brand && model) shoes.push({ id, brand, model });
  }
  return shoes;
}

function loadCache() {
  if (!fs.existsSync(CACHE_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')); }
  catch { return {}; }
}
function saveCache(c) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(c, null, 2) + '\n');
}

// Matching lives in scripts/asin-match.mjs (shared with the offline audit):
// every model token must appear (numbers as whole numbers), the version number
// must not be contradicted, and women's-only listings are rejected.

let keyIdx = 0;
function nextKey() {
  const k = KEYS[keyIdx % KEYS.length];
  keyIdx++;
  return k;
}

async function searchAmazon(query) {
  const params = new URLSearchParams({
    engine: 'amazon',
    amazon_domain: 'amazon.com',
    k: query,
    api_key: nextKey(),
  });
  const url = `https://serpapi.com/search.json?${params}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) throw new Error(`SerpAPI: ${data.error}`);
  return data;
}

async function resolveShoe(shoe) {
  const query = `${shoe.brand} ${cleanModel(shoe.model)} running shoes`;
  const data = await searchAmazon(query);
  const results = data.organic_results || data.product_results || [];
  for (const r of results) {
    const title = r.title || r.name;
    const asin = r.asin;
    if (!asin || asin.length !== 10) continue;
    if (!isPlausibleMatch(title, shoe.brand, shoe.model).ok) continue;
    return {
      asin: asin.toUpperCase(),
      title,
      url: r.link || `https://www.amazon.com/dp/${asin}`,
      query,
      resolvedAt: new Date().toISOString(),
    };
  }
  return { asin: null, query, note: 'no plausible match', resolvedAt: new Date().toISOString() };
}

async function main() {
  const shoes = parseShoes();
  const cache = loadCache();
  const RETRY_MISSES = process.env.RETRY_MISSES === '1';
  const targets = ONLY_ID
    ? shoes.filter(s => s.id === ONLY_ID)
    : shoes.filter(s => {
        if (FORCE) return true;
        const c = cache[s.id];
        if (!c) return true;                      // never tried
        if (c.asin) return false;                 // already resolved
        if (RETRY_MISSES) return true;            // retry misses on demand
        return false;                             // skip permanent misses by default
      });

  console.log(`Total shoes: ${shoes.length}. Cached: ${Object.keys(cache).length}. To resolve: ${targets.length}. Cap: ${MAX_CALLS}.`);

  let calls = 0;
  for (const shoe of targets) {
    if (calls >= MAX_CALLS) {
      console.log(`Reached MAX_CALLS=${MAX_CALLS}. Stopping.`);
      break;
    }
    process.stdout.write(`[${calls + 1}/${Math.min(targets.length, MAX_CALLS)}] ${shoe.brand} ${shoe.model} ... `);
    try {
      const r = await resolveShoe(shoe);
      calls++;
      cache[shoe.id] = r;
      saveCache(cache);
      console.log(r.asin ? `✓ ${r.asin}` : `✗ no match`);
    } catch (e) {
      console.log(`ERROR: ${e.message}`);
      // Stop on auth/quota errors to protect remaining calls.
      if (/api[_ ]?key|quota|limit|invalid/i.test(e.message)) {
        console.error('Aborting to preserve quota.');
        break;
      }
    }
    // Small delay to be polite.
    await new Promise(r => setTimeout(r, 400));
  }

  const resolved = Object.values(cache).filter(v => v.asin).length;
  const missed = Object.values(cache).filter(v => !v.asin).length;
  console.log(`\nDone. Cache: ${resolved} resolved, ${missed} missed, ${shoes.length - resolved - missed} pending. Calls used this run: ${calls}.`);
}

main().catch(e => { console.error(e); process.exit(1); });
