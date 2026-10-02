#!/usr/bin/env node
/**
 * Audits src/lib/amazon-asin-cache.json against the shoe database, offline.
 *
 *   node scripts/audit-asin-cache.mjs          # report only (exit 1 if a wrong-product link is found)
 *   node scripts/audit-asin-cache.mjs --fix    # clear wrong-product ASINs (asin: null + a note)
 *
 * A cached ASIN is judged by the listing title stored next to it:
 *   wrong     another model/version, a kids' shoe, shoelaces ... -> cleared by --fix
 *   womens    a women's-only listing of the right model           -> kept, and the UI says so
 *   ok        matches
 *
 * Cleared entries keep `asin: null`, so the app shows no Amazon button for that
 * shoe (never a wrong one). Re-resolve them with
 *   RETRY_MISSES=1 node scripts/resolve-amazon-asins.mjs
 * which now applies the same strict matching (scripts/asin-match.mjs).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isPlausibleMatch } from './asin-match.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = resolve(ROOT, 'src/lib/amazon-asin-cache.json');
const FIX = process.argv.includes('--fix');

const cache = JSON.parse(readFileSync(CACHE, 'utf8'));
const db = readFileSync(resolve(ROOT, 'src/lib/shoe-database.ts'), 'utf8');
const modelOf = (id) => db.match(new RegExp(`id: '${id}',[\\s\\S]*?model: '([^']+)'`))?.[1];

const summary = { ok: 0, womens: [], wrong: [], orphan: [] };
for (const [id, entry] of Object.entries(cache)) {
  if (!entry.asin) continue;
  const model = modelOf(id);
  if (!model) {
    summary.orphan.push(id);
    continue;
  }
  if (!entry.title) continue;
  const r = isPlausibleMatch(entry.title, '', model);
  if (r.ok) summary.ok++;
  else if (r.reason.startsWith("women")) summary.womens.push(id);
  else summary.wrong.push({ id, asin: entry.asin, title: entry.title, reason: r.reason });
}

console.log(`[audit-asin-cache] ok ${summary.ok} · women's-only ${summary.womens.length} · wrong product ${summary.wrong.length} · orphan ${summary.orphan.length}`);
for (const w of summary.wrong) console.log(`  WRONG  ${w.id}: ${w.reason} <- "${w.title.slice(0, 80)}"`);

if (FIX) {
  const today = new Date().toISOString().slice(0, 10);
  for (const w of summary.wrong) {
    cache[w.id] = { asin: null, note: `cleared ${today}: ${w.reason} (was ${w.asin}: ${w.title.slice(0, 120)})`, resolvedAt: new Date().toISOString() };
  }
  for (const id of summary.orphan) delete cache[id];
  writeFileSync(CACHE, JSON.stringify(cache, null, 2) + '\n');
  console.log(`[audit-asin-cache] cleared ${summary.wrong.length} wrong-product entries, removed ${summary.orphan.length} orphan(s)`);
  process.exit(0);
}
process.exit(summary.wrong.length ? 1 : 0);
