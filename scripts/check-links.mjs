#!/usr/bin/env node
/**
 * Link-health check for everything the app sends people to.
 *
 *   node scripts/check-links.mjs                 # check everything, write link-report.json
 *   node scripts/check-links.mjs --only=internal # internal | evidence | sources | amazon
 *
 * Classification (be honest about what a bot can and cannot know):
 *   ok            2xx (after redirects)
 *   redirect      worked, but the final URL differs from the one we link to (update the link)
 *   dead          404 / 410  -> exits with code 1
 *   unverifiable  403, 429, 5xx, 999 or network error. Retailers and brands block bots, so these
 *                 are reported but NEVER fail the run. Amazon product pages fall in this bucket
 *                 unless they return a clean 404.
 *
 * Covers:
 *   internal  every https://gearuptofit.com/... URL in src/ (articles, tools, per-shoe reviews)
 *   evidence  the research links in src/lib/evidence.ts
 *   sources   manufacturer spec pages (shoe.sourceURL)
 *   amazon    https://www.amazon.com/dp/{ASIN} for every ASIN in src/lib/amazon-asin-cache.json
 *
 * The output file is uploaded by .github/workflows/link-health.yml every week.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) ?? '').slice(7);
const UA = 'Mozilla/5.0 (compatible; RunMatchLinkCheck/1.0; +https://gearuptofit.com/shoe-finder/)';
const CONCURRENCY = 6;
const TIMEOUT_MS = 20000;

const walk = (dir, out = []) => {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n)) out.push(p);
  }
  return out;
};

const srcFiles = walk(join(ROOT, 'src'));
const allSource = srcFiles.map((f) => readFileSync(f, 'utf8')).join('\n');
const clean = (u) => u.replace(/[.,;)'"`]+$/, '');

const sets = { internal: new Set(), evidence: new Set(), sources: new Set(), amazon: new Set() };

for (const m of allSource.matchAll(/https:\/\/gearuptofit\.com\/[A-Za-z0-9_./%-]*/g)) {
  const u = clean(m[0]);
  if (!/wp-content\/uploads|\/shoe-finder\//.test(u) && u !== 'https://gearuptofit.com/') sets.internal.add(u);
}
const evidenceSrc = readFileSync(join(ROOT, 'src/lib/evidence.ts'), 'utf8');
for (const m of evidenceSrc.matchAll(/url:\s*'(https:\/\/[^']+)'/g)) sets.evidence.add(m[1]);
for (const m of readFileSync(join(ROOT, 'src/lib/shoe-database.ts'), 'utf8').matchAll(/sourceURL:\s*'(https:\/\/[^']+)'/g)) sets.sources.add(m[1]);
const cache = JSON.parse(readFileSync(join(ROOT, 'src/lib/amazon-asin-cache.json'), 'utf8'));
for (const v of Object.values(cache)) if (v && typeof v.asin === 'string' && /^[A-Z0-9]{10}$/.test(v.asin)) sets.amazon.add(`https://www.amazon.com/dp/${v.asin}`);

async function check(url, kind) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { redirect: 'follow', signal: ctl.signal, headers: { 'user-agent': UA, accept: 'text/html,*/*' } });
    await res.body?.cancel();
    const status = res.status;
    let result;
    if (status === 404 || status === 410) result = 'dead';
    else if (status >= 200 && status < 300) {
      const moved = new URL(res.url).pathname.replace(/\/$/, '') !== new URL(url).pathname.replace(/\/$/, '');
      result = moved && kind !== 'amazon' ? 'redirect' : 'ok';
    } else result = 'unverifiable';
    return { url, kind, status, result, finalUrl: res.url !== url ? res.url : undefined };
  } catch (err) {
    return { url, kind, status: 0, result: 'unverifiable', error: String(err?.name || err) };
  } finally {
    clearTimeout(timer);
  }
}

const jobs = [];
for (const [kind, set] of Object.entries(sets)) {
  if (ONLY && ONLY !== kind) continue;
  for (const url of [...set].sort()) jobs.push({ url, kind });
}

console.log(`[check-links] checking ${jobs.length} URLs (${Object.entries(sets).map(([k, s]) => `${k}: ${s.size}`).join(', ')})`);

const results = [];
let next = 0;
async function worker() {
  while (next < jobs.length) {
    const job = jobs[next++];
    // Be polite to Amazon: one request per worker slot with a pause.
    if (job.kind === 'amazon') await new Promise((r) => setTimeout(r, 400));
    results.push(await check(job.url, job.kind));
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

const by = (r) => results.filter((x) => x.result === r);
const dead = by('dead');
const redirects = by('redirect');
const unverifiable = by('unverifiable');

const report = {
  generatedAt: new Date().toISOString(),
  totals: { checked: results.length, ok: by('ok').length, redirect: redirects.length, dead: dead.length, unverifiable: unverifiable.length },
  dead,
  redirects,
  unverifiable: unverifiable.map(({ url, kind, status, error }) => ({ url, kind, status, error })),
};
writeFileSync(join(ROOT, 'link-report.json'), JSON.stringify(report, null, 2));

console.log(`[check-links] ok ${report.totals.ok} · redirect ${report.totals.redirect} · dead ${report.totals.dead} · unverifiable ${report.totals.unverifiable}`);
for (const d of dead) console.error(`  DEAD (${d.status}) [${d.kind}] ${d.url}`);
for (const r of redirects) console.warn(`  REDIRECT [${r.kind}] ${r.url} -> ${r.finalUrl}`);

if (process.env.GITHUB_STEP_SUMMARY) {
  const lines = [
    '## Link health',
    `Checked **${report.totals.checked}** URLs: ${report.totals.ok} ok, ${report.totals.redirect} redirected, **${report.totals.dead} dead**, ${report.totals.unverifiable} unverifiable (bot-blocked or temporary).`,
    '',
    ...(dead.length ? ['### Dead links', ...dead.map((d) => `- \`${d.status}\` [${d.kind}] ${d.url}`)] : ['No dead links.']),
    ...(redirects.length ? ['', '### Redirected (update the link)', ...redirects.map((r) => `- [${r.kind}] ${r.url} → ${r.finalUrl}`)] : []),
  ];
  writeFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n', { flag: 'a' });
}

process.exit(dead.length > 0 ? 1 : 0);
