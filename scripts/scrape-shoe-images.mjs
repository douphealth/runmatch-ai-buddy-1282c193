#!/usr/bin/env node
/**
 * Scrapes real product images for every shoe in the database.
 *
 * Strategy:
 *  1. For each shoe, query DuckDuckGo Image Search via the free public token endpoint
 *     (vqd token + i.js JSON endpoint — no API key required).
 *  2. Filter to product/white-background shots from manufacturer or major retailer domains.
 *  3. Download the top image to public/images/shoes/<slug>.jpg.
 *  4. Skip shoes that already have a non-placeholder image cached on disk.
 *
 * Run with: node scripts/scrape-shoe-images.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const SHOES_TS = 'src/lib/shoe-database.ts';
const OUT_DIR = 'public/images/shoes';

// Prefer clean white-background product shots from major retail CDNs first
const PREFERRED_DOMAINS = [
  // Tier 1 — almost always clean transparent / white-bg product photos
  'media-amazon.com', 'images-na.ssl-images-amazon.com', 'm.media-amazon.com',
  'zappos.com', 'zappos1.com', 'zappos2.com',
  'runningwarehouse.com', 'runningwarehouse-staging.com',
  'roadrunnersports.com', 'fleetfeet.com', 'jackrabbit.com',
  // Tier 2 — manufacturer storefronts (often clean shots)
  'nike.com', 'brooksrunning.com', 'asics.com', 'hoka.com', 'sauconyshop.com', 'saucony.com',
  'on-running.com', 'on.com', 'adidas.com', 'puma.com', 'newbalance.com', 'salomon.com',
  'altrarunning.com', 'mizunousa.com', 'mizuno.com',
  'rei.com', 'dickssportinggoods.com',
];

// Extra-clean CDN paths — strongly bonus
const CLEAN_CDN_PATTERNS = [
  'media-amazon.com', 'm.media-amazon.com', 'images-na.ssl-images-amazon.com',
  'zappos', 'runningwarehouse',
];

// Penalize collages, marketing banners, lifestyle shots
const BAD_KEYWORDS = [
  'banner', 'lifestyle', 'collage', 'campaign', 'hero', 'background',
  'feature', 'detail', 'tech', 'guide', 'review', 'comparison',
  'on-foot', 'onfoot', 'wearing', 'runner', 'athlete', 'model',
];

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

function shoeSlug(brand, model) {
  return `${brand}-${model}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function getDuckDuckGoVqd(query) {
  const r = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(query)}&iar=images&iax=images&ia=images`, {
    headers: { 'User-Agent': UA },
  });
  const html = await r.text();
  const m = html.match(/vqd=['"]([\d-]+)['"]/) || html.match(/vqd=([\d-]+)&/);
  if (!m) throw new Error('vqd token not found');
  return m[1];
}

async function searchDuckDuckGoImages(query) {
  const vqd = await getDuckDuckGoVqd(query);
  const url = `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}&f=,,,,,&p=1`;
  const r = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Referer': 'https://duckduckgo.com/',
      'Accept': 'application/json',
    },
  });
  if (!r.ok) throw new Error(`DDG i.js ${r.status}`);
  const data = await r.json();
  return data.results || [];
}

function rankImage(img) {
  const url = (img.image || '').toLowerCase();
  const src = (img.url || img.source || '').toLowerCase();
  let score = 0;
  let tier = 999;
  for (let i = 0; i < PREFERRED_DOMAINS.length; i++) {
    const d = PREFERRED_DOMAINS[i];
    if (src.includes(d) || url.includes(d)) { tier = i; break; }
  }
  // Tiered preference: lower tier index = bigger bonus
  if (tier < 999) score += 200 - tier * 5;
  // Extra clean-CDN bonus
  for (const p of CLEAN_CDN_PATTERNS) {
    if (url.includes(p) || src.includes(p)) { score += 80; break; }
  }
  // Penalize collage/banner/lifestyle keywords in URL
  for (const k of BAD_KEYWORDS) {
    if (url.includes(k) || src.includes(k)) score -= 60;
  }
  // Squarish images = product shot; very wide = collage/banner
  if (img.width && img.height) {
    const ratio = img.width / img.height;
    if (ratio > 0.7 && ratio < 1.5) score += 40;
    else if (ratio > 2 || ratio < 0.4) score -= 80;
    if (img.width >= 800 && img.width <= 2000) score += 25;
    if (img.width > 2400) score -= 30; // huge banners
  }
  if (url.endsWith('.jpg') || url.endsWith('.jpeg') || url.endsWith('.png') || url.endsWith('.webp')) score += 10;
  if (url.includes('logo') || url.includes('icon') || url.includes('thumb')) score -= 50;
  return score;
}

async function downloadImage(url, dest) {
  const r = await fetch(url, {
    headers: { 'User-Agent': UA, 'Referer': new URL(url).origin },
    redirect: 'follow',
  });
  if (!r.ok) throw new Error(`Download ${r.status}`);
  const ct = r.headers.get('content-type') || '';
  if (!ct.startsWith('image/')) throw new Error(`Not an image: ${ct}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 4000) throw new Error(`Too small: ${buf.length}b`);
  await fs.writeFile(dest, buf);
  return buf.length;
}

async function processShoe(brand, model, force = false) {
  const slug = shoeSlug(brand, model);
  const dest = path.join(OUT_DIR, `${slug}.jpg`);
  if (!force) {
    try {
      const stat = await fs.stat(dest);
      if (stat.size > 4000) return { brand, model, slug, skipped: true };
    } catch {}
  }

  const queries = [
    `${brand} ${model} site:amazon.com`,
    `${brand} ${model} running shoe white background product`,
    `${brand} ${model} site:zappos.com`,
    `${brand} ${model} running shoes product photo`,
  ];

  let lastErr;
  for (const q of queries) {
    try {
      const results = await searchDuckDuckGoImages(q);
      if (!results.length) continue;
      const ranked = results.map(r => ({ r, s: rankImage(r) })).sort((a, b) => b.s - a.s);
      for (const { r } of ranked.slice(0, 6)) {
        try {
          const size = await downloadImage(r.image, dest);
          return { brand, model, slug, ok: true, size, src: r.url };
        } catch (e) {
          lastErr = e;
        }
      }
    } catch (e) {
      lastErr = e;
    }
    await new Promise(res => setTimeout(res, 800));
  }
  return { brand, model, slug, ok: false, error: String(lastErr) };
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const force = process.argv.includes('--force');
  const ts = await fs.readFile(SHOES_TS, 'utf8');
  const shoes = [...ts.matchAll(/brand:\s*'([^']+)',\s*model:\s*'([^']+)'/g)].map(m => ({ brand: m[1], model: m[2] }));
  console.log(`Found ${shoes.length} shoes. Output → ${OUT_DIR}${force ? ' (FORCE re-download)' : ''}`);

  const results = [];
  let i = 0;
  for (const s of shoes) {
    i++;
    process.stdout.write(`[${i}/${shoes.length}] ${s.brand} ${s.model}... `);
    const r = await processShoe(s.brand, s.model, force);
    results.push(r);
    if (r.skipped) console.log('cached');
    else if (r.ok) console.log(`✓ ${(r.size / 1024).toFixed(0)}kb`);
    else console.log(`✗ ${r.error?.slice(0, 60)}`);
    // Rate-limit DDG
    await new Promise(res => setTimeout(res, 600));
  }

  const ok = results.filter(r => r.ok || r.skipped).length;
  console.log(`\nDone: ${ok}/${shoes.length} shoes have real images.`);
  await fs.writeFile('scripts/scrape-results.json', JSON.stringify(results, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
