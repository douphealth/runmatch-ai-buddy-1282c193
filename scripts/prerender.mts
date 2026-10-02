/**
 * Build-time pre-renderer.
 *
 * Writes real, unique, crawlable HTML for:
 *   - the landing page              dist/index.html
 *   - ~45 canonical result pages    dist/results/{slug}/index.html
 *   - the methodology page          dist/methodology/index.html
 *   - brand / category / comparison / shoe pages  dist/<path>/index.html
 * and the supporting files:
 *   - dist/sitemap.xml        only indexable URLs, with honest lastmod dates
 *   - dist/robots.txt
 *   - dist/route-manifest.json  lets the edge Worker answer unknown URLs with a real 404
 *
 * Pages that are not substantial enough to index (thin brand/comparison/shoe
 * pages, long-tail result variants) are still written, with `noindex,follow`,
 * so users and crawlers get a proper page and the raw HTML says so.
 *
 * Run as the second step of `npm run build` (see package.json scripts.build).
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CANONICAL_SLUGS } from '../src/lib/canonical-slugs';
import { answersFromSlug } from '../src/lib/quiz-data';
import { buildPrerenderedPage, buildLandingPage, buildAllEntityPages, type PrerenderedPage } from '../src/lib/prerender-seo';
import { SHOE_ID_ALIASES } from '../src/lib/shoe-database';
import { allBrandSlugs, allCategorySlugs, allComparisonSlugs, allShoeIds } from '../src/lib/entity-seo';
import { CONTENT_REVISION_DATE, appUrl } from '../src/lib/site-config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const DIST = resolve(ROOT, 'dist');

/** Strip everything page-specific from the Vite-built template; per-page values are injected instead. */
function injectIntoTemplate(template: string, page: PrerenderedPage): string {
  let html = template;

  html = html
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<meta\s+name=["']description["'][^>]*>/gi, '')
    .replace(/<meta\s+name=["']robots["'][^>]*>/gi, '')
    .replace(/<meta\s+property=["']og:[^"']+["'][^>]*>/gi, '')
    .replace(/<meta\s+name=["']twitter:[^"']+["'][^>]*>/gi, '')
    .replace(/<link\s+rel=["']canonical["'][^>]*>/gi, '')
    // The template's hreflang pointed every page at the landing page.
    .replace(/<link\s+rel=["']alternate["'][^>]*hreflang[^>]*>/gi, '')
    // Template-level JSON-LD (Organization, WebApplication, Breadcrumb) would be duplicated on every page.
    .replace(/<script\s+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<!--\s*Visible FAQ content remains on-page[\s\S]*?-->/i, '');

  html = html.replace('</head>', `    ${page.headTags}\n  </head>`);

  if (!html.includes('<!--PRERENDER_ROOT-->')) {
    throw new Error('Missing PRERENDER_ROOT marker in index.html');
  }
  // Content goes at a dedicated marker; React replaces #root's children on mount.
  html = html.replace('<!--PRERENDER_ROOT-->', page.bodyHtml);
  return html;
}

async function writePage(template: string, page: PrerenderedPage): Promise<void> {
  const html = injectIntoTemplate(template, page);
  if (page.path === '') {
    await writeFile(resolve(DIST, 'index.html'), html, 'utf-8');
    return;
  }
  const outDir = resolve(DIST, page.path);
  await mkdir(outDir, { recursive: true });
  await writeFile(resolve(outDir, 'index.html'), html, 'utf-8');
}

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

function buildSitemap(urls: string[]): string {
  const items = urls
    .map((u) => `  <url>\n    <loc>${escapeXml(u)}</loc>\n    <lastmod>${CONTENT_REVISION_DATE}</lastmod>\n  </url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</urlset>\n`;
}

async function main() {
  if (!existsSync(DIST)) {
    console.error('[prerender] dist/ not found. Run `vite build` first.');
    process.exit(1);
  }

  const templatePath = resolve(DIST, 'index.html');
  const template = await readFile(templatePath, 'utf-8');

  const pages: PrerenderedPage[] = [];

  // Result pages (before the landing page overwrites dist/index.html: they use the pristine template).
  for (const slug of CANONICAL_SLUGS) {
    const answers = answersFromSlug(slug);
    if (!answers) {
      console.error(`[prerender] invalid canonical slug: ${slug}`);
      process.exit(1);
    }
    pages.push(buildPrerenderedPage(slug, answers));
  }
  pages.push(...buildAllEntityPages());
  const landing = buildLandingPage();

  for (const page of pages) await writePage(template, page);
  await writePage(template, landing);

  const indexable = [landing, ...pages].filter((p) => p.indexable);
  const noindexed = pages.filter((p) => !p.indexable);

  await writeFile(resolve(DIST, 'sitemap.xml'), buildSitemap(indexable.map((p) => p.url)), 'utf-8');
  await writeFile(
    resolve(DIST, 'robots.txt'),
    `User-agent: *\nAllow: /\nSitemap: ${appUrl()}sitemap.xml\n`,
    'utf-8',
  );

  // Lets the edge Worker tell real pages from unknown URLs (soft-404 fix).
  const manifest = {
    version: 1,
    shoeIds: allShoeIds(),
    shoeAliases: SHOE_ID_ALIASES,
    brandSlugs: allBrandSlugs(),
    categorySlugs: allCategorySlugs(),
    comparisonSlugs: allComparisonSlugs(),
    canonicalResultSlugs: [...CANONICAL_SLUGS],
  };
  await writeFile(resolve(DIST, 'route-manifest.json'), JSON.stringify(manifest), 'utf-8');

  console.log(`[prerender] ✓ landing + ${pages.length} pages written`);
  console.log(`[prerender] ✓ sitemap.xml: ${indexable.length} indexable URLs`);
  console.log(`[prerender] ✓ ${noindexed.length} pages kept out of the sitemap (noindex,follow, or canonicalised to a sibling)`);
  console.log('[prerender] ✓ route-manifest.json, robots.txt');
}

main().catch((err) => {
  console.error('[prerender] fatal:', err);
  process.exit(1);
});
