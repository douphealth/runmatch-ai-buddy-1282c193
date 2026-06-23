/**
 * Build-time pre-renderer.
 *
 * For each canonical slug:
 *   1. Reconstruct QuizAnswers from the slug
 *   2. Build per-page <head> tags + JSON-LD + a visible SEO body block
 *   3. Inject everything into the Vite-built index.html template
 *   4. Write to dist/app/runmatch/{slug}/index.html
 *
 * Also generates dist/sitemap.xml listing every pre-rendered URL plus the home
 * page, and rewrites dist/robots.txt to reference the sitemap.
 *
 * Run as the second step of `npm run build` (see package.json scripts.build).
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CANONICAL_SLUGS } from './canonical-slugs.mjs';
import { answersFromSlug } from '../src/lib/quiz-data';
import { buildPrerenderedPage } from '../src/lib/prerender-seo';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const DIST = resolve(ROOT, 'dist');
const SITE_ORIGIN = 'https://gearuptofit.com/shoe-finder';

async function main() {
  if (!existsSync(DIST)) {
    console.error('[prerender] dist/ not found. Run `vite build` first.');
    process.exit(1);
  }

  const templatePath = resolve(DIST, 'index.html');
  const template = await readFile(templatePath, 'utf-8');

  const buildDate = new Date().toISOString().split('T')[0];
  const generated: string[] = [];

  for (const slug of CANONICAL_SLUGS) {
    const answers = answersFromSlug(slug);
    if (!answers) {
      console.warn(`[prerender] skip invalid slug: ${slug}`);
      continue;
    }

    let page;
    try {
      page = buildPrerenderedPage(slug, answers);
    } catch (err) {
      console.error(`[prerender] failed to build ${slug}:`, err);
      continue;
    }

    const html = injectIntoTemplate(template, page);

    const outDir = resolve(DIST, 'results', slug);
    await mkdir(outDir, { recursive: true });
    await writeFile(resolve(outDir, 'index.html'), html, 'utf-8');
    generated.push(page.url);
    console.log(`[prerender] ✓ ${slug}`);
  }

  // sitemap.xml
  const sitemap = buildSitemap(Array.from(new Set([`${SITE_ORIGIN}/`, ...generated])), buildDate);
  await writeFile(resolve(DIST, 'sitemap.xml'), sitemap, 'utf-8');
  console.log(`[prerender] ✓ sitemap.xml (${generated.length + 1} URLs)`);

  // robots.txt — canonical app sitemap only.
  const robotsPath = resolve(DIST, 'robots.txt');
  const robots = `User-agent: *
Allow: /
Sitemap: ${SITE_ORIGIN}/sitemap.xml
`;
  await writeFile(robotsPath, robots, 'utf-8');
  console.log('[prerender] ✓ robots.txt written with canonical Sitemap directive');

  console.log(`[prerender] done — ${generated.length} pages`);
}

/**
 * Inject per-page head tags + visible SEO body block into the built template.
 *
 * - head tags go right before </head>
 * - bodyHtml goes inside <div id="root">…</div> so React hydrates over it
 * - we also strip the generic <title>, <meta description>, OG, and Twitter
 *   tags from the template so per-page values are not duplicated
 */
function injectIntoTemplate(template: string, page: ReturnType<typeof buildPrerenderedPage>): string {
  let html = template;

  // Strip the generic title/description/OG/Twitter tags so the per-page
  // versions are the only ones present.
  html = html
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<meta\s+name=["']description["'][^>]*>/gi, '')
    .replace(/<meta\s+property=["']og:[^"']+["'][^>]*>/gi, '')
    .replace(/<meta\s+name=["']twitter:[^"']+["'][^>]*>/gi, '')
    .replace(/<link\s+rel=["']canonical["'][^>]*>/gi, '');

  // Insert per-page head tags just before </head>.
  html = html.replace('</head>', `    ${page.headTags}\n  </head>`);

  if (!html.includes('<!--PRERENDER_ROOT-->')) {
    throw new Error('Missing PRERENDER_ROOT marker in index.html');
  }

  // Insert visible SEO body at a dedicated marker. This avoids fragile root
  // regex replacement when the app shell contains visible fallback content.
  html = html.replace('<!--PRERENDER_ROOT-->', page.bodyHtml);

  return html;
}

function buildSitemap(urls: string[], lastmod: string): string {
  const items = urls
    .map(u => `  <url>\n    <loc>${escapeXml(u)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${u.endsWith('/') ? '1.0' : '0.8'}</priority>\n  </url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</urlset>
`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

main().catch(err => {
  console.error('[prerender] fatal:', err);
  process.exit(1);
});
