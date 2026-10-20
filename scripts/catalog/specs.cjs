#!/usr/bin/env node
/**
 * Reads the maker-stated specs of running shoes from RunRepeat's public "Specs (brand)" block:
 * drop, weight (men's), heel/forefoot height, terrain, arch support, widths, price, pace, features.
 * Only facts are recorded; nothing is copied word for word.
 *
 *   node scripts/catalog/specs.cjs brooks-ghost-18 hoka-clifton-11     # one JSON file per slug in .catalog-work/specs/
 *
 * A slug is the last part of runrepeat.com/<slug>. Polite by design: one request per 1.1 s, and it stops at the first 403/429.
 * It is a cross-check, not an authority: when it disagrees with the maker's own page or the Amazon listing text, use those.
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const WORK = path.resolve(process.env.CATALOG_WORK || '.catalog-work');
const CACHE = path.join(WORK, 'specs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = (u) =>
  new Promise((res, rej) =>
    https
      .get(u, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130 Safari/537.36' }, timeout: 30000 }, (r) => {
        const c = [];
        r.on('data', (d) => c.push(d));
        r.on('end', () => res({ s: r.statusCode, loc: r.headers.location, b: Buffer.concat(c).toString('utf8') }));
      })
      .on('error', rej)
      .on('timeout', function () {
        this.destroy(new Error('timeout'));
      }),
  );

const KEYS = ['Update:', 'Terrain:', 'Arch support:', 'Heel height:', 'Forefoot height:', 'Collection:', 'Weight:', 'Drop:', 'Pronation:', 'Arch type:', 'Use:', 'Material:', 'Features:', 'Strike Pattern:', 'Condition:', 'Technology:', 'Season:', 'Release date:', 'BRAND', 'Brand:', 'Type:', 'Widths available:', 'Pace:', 'SKUs:', 'Trail terrain:'];

function parse(html) {
  const t = html.replace(/<script(?![^>]*ld\+json)[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ');
  const text = t.replace(/<[^>]+>/g, '\n').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&rsquo;/g, "'").replace(/\n+/g, '\n').split('\n').map((x) => x.trim()).filter(Boolean);
  const i = text.findIndex((x) => /^Specs \(brand\)/i.test(x));
  if (i < 0) return null;
  const f = {};
  let key = null;
  for (const tok of text.slice(i + 1, i + 140)) {
    if (/^(Lab test|Our recommendation|Compare|Bottom line|Review|Fit|Full review)/i.test(tok) && key) break;
    if (KEYS.includes(tok) || (/^[A-Z][A-Za-z /]+:$/.test(tok) && !/^(Men|Women):$/.test(tok))) {
      key = tok.replace(/:$/, '');
      if (!f[key]) f[key] = [];
      continue;
    }
    if (key && tok !== '|' && tok !== ',') f[key].push(tok);
  }
  const menNum = (arr, re) => {
    if (!arr) return null;
    const idx = arr.indexOf('Men:');
    const seg = idx >= 0 ? arr.slice(idx + 1, arr.indexOf('Women:') > idx ? arr.indexOf('Women:') : undefined) : arr;
    return seg.join(' ').match(re);
  };
  const w = menNum(f['Weight'], /([\d.]+)\s*oz\s*\/\s*(\d+)\s*g/);
  const d = (f['Drop'] || []).join(' ').match(/([\d.]+)\s*mm/);
  const hh = menNum(f['Heel height'], /([\d.]+)\s*mm/);
  const fh = menNum(f['Forefoot height'], /([\d.]+)\s*mm/);
  const offer = html.match(/"offers":\{[^}]*?"price":"?([\d.]+)"?/);
  const pi = text.findIndex((x) => x === 'Price');
  const pm = pi >= 0 ? text.slice(pi + 1, pi + 6).join(' ').match(/\$\s?(\d{2,3}(?:\.\d{2})?)/) : null;
  return {
    weightOz: w ? +w[1] : null,
    weightG: w ? +w[2] : null,
    dropMM: d ? +d[1] : null,
    heelMM: hh ? +hh[1] : null,
    forefootMM: fh ? +fh[1] : null,
    terrain: f['Terrain'] || [],
    arch: f['Arch support'] || [],
    use: f['Use'] || [],
    features: f['Features'] || [],
    widths: f['Widths available'] || [],
    pace: f['Pace'] || [],
    release: (f['Release date'] || [])[0] || null,
    name: (html.match(/"@type":"Product","name":"([^"]+)"/) || [])[1] || null,
    published: (html.match(/"datePublished"\s*:\s*"([^"]+)"/) || [])[1]?.slice(0, 10) ?? null,
    priceLd: offer ? +offer[1] : null,
    priceTxt: pm ? +pm[1] : null,
  };
}

async function load(slug, force = false) {
  fs.mkdirSync(CACHE, { recursive: true });
  const file = path.join(CACHE, `${slug}.json`);
  if (!force && fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const r = await get(`https://runrepeat.com/${slug}`);
  if (r.s === 429 || r.s === 403) throw new Error(`BLOCKED ${r.s}: stop, do not retry or work around it`);
  const p = r.s === 200 ? parse(r.b) : null;
  const rec = r.s !== 200 ? { slug, status: r.s, loc: r.loc || null } : p ? { slug, status: 200, ...p } : { slug, status: 200, noSpecs: true };
  fs.writeFileSync(file, JSON.stringify(rec, null, 1));
  await sleep(1100);
  return rec;
}

module.exports = { load, parse, WORK };

if (require.main === module) {
  (async () => {
    for (const slug of process.argv.slice(2)) {
      const r = await load(slug);
      console.log(slug.padEnd(46), r.status !== 200 ? `status ${r.status}` : r.noSpecs ? 'no specs' : `drop ${r.dropMM} | wt ${r.weightG}g | heel ${r.heelMM} fore ${r.forefootMM} | ${r.terrain.join('/')} | ${r.arch.join('/')} | widths ${r.widths.join('/')} | $${r.priceTxt ?? r.priceLd}`);
    }
  })().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
