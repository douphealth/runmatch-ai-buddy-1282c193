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

// Prefer manufacturer + premium retailer domains for clean product shots
const PREFERRED_DOMAINS = [
  'nike.com', 'brooksrunning.com', 'asics.com', 'hoka.com', 'sauconyshop.com', 'saucony.com',
  'on-running.com', 'on.com', 'adidas.com', 'puma.com', 'newbalance.com', 'salomon.com',
  'altrarunning.com', 'mizunousa.com', 'mizuno.com', 'roadrunnersports.com', 'fleetfeet.com',
  'runningwarehouse.com', 'rei.com', 'dickssportinggoods.com', 'zappos.com', 'jackrabbit.com',
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
  for (const d of PREFERRED_DOMAINS) {
    if (src.includes(d) || url.includes(d)) { score += 100; break; }
  }
  if (img.width && img.height) {
    if (img.width >= 800 && img.height >= 600) score += 30;
    else if (img.width >= 500) score += 15;
    // Slight bonus for landscape product shots
    if (img.width >= img.height) score += 5;
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

async function processShoe(brand, model) {
  const slug = shoeSlug(brand, model);
  const dest = path.join(OUT_DIR, `${slug}.jpg`);
  try {
    const stat = await fs.stat(dest);
    if (stat.size > 4000) return { brand, model, slug, skipped: true };
  } catch {}

  const queries = [
    `${brand} ${model} running shoe official product`,
    `${brand} ${model} running shoe white background`,
    `${brand} ${model} running shoes`,
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
  const ts = await fs.readFile(SHOES_TS, 'utf8');
  const shoes = [...ts.matchAll(/brand:\s*'([^']+)',\s*model:\s*'([^']+)'/g)].map(m => ({ brand: m[1], model: m[2] }));
  console.log(`Found ${shoes.length} shoes. Output → ${OUT_DIR}`);

  const results = [];
  let i = 0;
  for (const s of shoes) {
    i++;
    process.stdout.write(`[${i}/${shoes.length}] ${s.brand} ${s.model}... `);
    const r = await processShoe(s.brand, s.model);
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
