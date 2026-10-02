import { describe, expect, it } from 'vitest';
import { CANONICAL_SLUGS } from './canonical-slugs';
import { answersFromSlug } from './quiz-data';
import { buildAllEntityPages, buildLandingPage, buildPrerenderedPage, type PrerenderedPage } from './prerender-seo';
import { getRepresentativeSlugs, getResultRepresentative } from './result-groups';
import { resultSeo } from './page-seo';
import { generateMetaTitle, generateResultDescription, generateResultH1 } from './seo';

const resultPages = CANONICAL_SLUGS.map((s) => buildPrerenderedPage(s, answersFromSlug(s)!));
const entityPages = buildAllEntityPages();
const landing = buildLandingPage();
const all: PrerenderedPage[] = [landing, ...resultPages, ...entityPages];

const textOf = (html: string) => html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const jsonLdBlocks = (p: PrerenderedPage) =>
  [...p.headTags.matchAll(/<script data-prerender="1" type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) =>
    JSON.parse(m[1].replace(/\\u003c/g, '<').replace(/\\u003e/g, '>').replace(/\\u0026/g, '&')),
  );

describe('canonical result slugs', () => {
  it('every canonical slug parses into quiz answers', () => {
    for (const slug of CANONICAL_SLUGS) expect(answersFromSlug(slug), slug).not.toBeNull();
  });

  it('every slug has a unique <title>, H1 and description', () => {
    const titles = new Set<string>();
    const h1s = new Set<string>();
    const descs = new Set<string>();
    for (const slug of CANONICAL_SLUGS) {
      const a = answersFromSlug(slug)!;
      const t = generateMetaTitle(a);
      const h = generateResultH1(a);
      const d = generateResultDescription(a, ['A Shoe', 'B Shoe', 'C Shoe']);
      expect(titles.has(t), `duplicate title for ${slug}: ${t}`).toBe(false);
      expect(h1s.has(h), `duplicate H1 for ${slug}: ${h}`).toBe(false);
      expect(descs.has(d), `duplicate description for ${slug}: ${d}`).toBe(false);
      titles.add(t);
      h1s.add(h);
      descs.add(d);
    }
  });

  it('result titles stay within a sensible display length', () => {
    for (const slug of CANONICAL_SLUGS) expect(generateMetaTitle(answersFromSlug(slug)!).length, slug).toBeLessThanOrEqual(75);
  });
});

describe('result page groups (near-duplicate consolidation)', () => {
  it('each representative owns a distinct shortlist', () => {
    const reps = getRepresentativeSlugs();
    expect(reps.length).toBeGreaterThan(10);
    expect(reps.length).toBeLessThan(CANONICAL_SLUGS.length);
    for (const slug of CANONICAL_SLUGS) expect(reps).toContain(getResultRepresentative(slug));
  });

  it('only representatives are indexable and listed; siblings canonicalise to them', () => {
    const reps = new Set(getRepresentativeSlugs());
    for (const slug of CANONICAL_SLUGS) {
      const seo = resultSeo(slug, answersFromSlug(slug)!);
      const rep = getResultRepresentative(slug);
      expect(seo.canonical).toContain(`/results/${rep}/`);
      expect(seo.indexable, slug).toBe(reps.has(slug));
    }
  });

  it('personalised links and long-tail slugs are noindex and never in the sitemap', () => {
    const a = answersFromSlug(CANONICAL_SLUGS[0])!;
    const personalised = resultSeo(CANONICAL_SLUGS[0], a, { personalized: true });
    expect(personalised.robots).toContain('noindex');
    expect(personalised.indexable).toBe(false);
    const longTail = answersFromSlug('unsure-ultra-track-wide')!;
    const seo = resultSeo('unsure-ultra-track-wide', longTail);
    expect(seo.robots).toContain('noindex');
    expect(seo.indexable).toBe(false);
  });
});

describe('prerendered HTML', () => {
  it('has a unique <title> on every page', () => {
    const seen = new Map<string, string>();
    for (const p of all) {
      expect(seen.has(p.title), `${p.path || '/'} duplicates the title of ${seen.get(p.title)}`).toBe(false);
      seen.set(p.title, p.path || '/');
    }
  });

  it('never leaks internal developer notes into public copy', () => {
    for (const p of all) {
      const text = textOf(p.bodyHtml);
      expect(text, p.path).not.toMatch(/rechecked before publishing|indexable product pages|TODO|lorem ipsum/i);
    }
  });

  it('has exactly one H1, one canonical, and every head tag marked data-prerender', () => {
    for (const p of all) {
      expect((p.bodyHtml.match(/<h1[\s>]/g) ?? []).length, `${p.path} h1`).toBe(1);
      expect((p.headTags.match(/rel="canonical"/g) ?? []).length, `${p.path} canonical`).toBe(1);
      expect(p.headTags, p.path).toContain('name="robots"');
      const tags = p.headTags.match(/<(title|meta|link|script)\b[^>]*>/g) ?? [];
      for (const tag of tags) expect(tag, `${p.path}: ${tag}`).toContain('data-prerender="1"');
    }
  });

  it('emits valid JSON-LD: no nested arrays, no SearchAction, no bare Product', () => {
    for (const p of all) {
      const blocks = jsonLdBlocks(p);
      expect(blocks.length, p.path).toBeGreaterThan(0);
      for (const b of blocks) {
        expect(Array.isArray(b), `${p.path} block is an array`).toBe(false);
        expect(b['@context']).toBe('https://schema.org');
        expect(JSON.stringify(b), p.path).not.toContain('SearchAction');
        expect(b['@type'], p.path).not.toBe('Product'); // Product needs offers/review to be valid; we have neither
      }
    }
  });

  it('breadcrumbs only point at pages that exist', () => {
    const known = new Set(all.map((p) => p.url));
    for (const p of all) {
      for (const b of jsonLdBlocks(p).filter((x) => x['@type'] === 'BreadcrumbList')) {
        for (const item of b.itemListElement) {
          const url: string = item.item;
          if (url.startsWith('https://gearuptofit.com/shoe-finder/')) expect(known.has(url), `${p.path} -> ${url}`).toBe(true);
        }
      }
    }
  });

  it('indexable pages carry real content (thin-page guard)', () => {
    for (const p of all.filter((x) => x.indexable)) {
      expect(textOf(p.bodyHtml).split(' ').length, p.path || '/').toBeGreaterThan(220);
    }
  });

  it('non-indexable pages are written as noindex,follow', () => {
    for (const p of entityPages.filter((x) => !x.indexable)) expect(p.robots, p.path).toBe('noindex,follow');
  });

  it('affiliate links in static HTML are marked sponsored and nofollow', () => {
    for (const p of all) {
      const anchors = p.bodyHtml.match(/<a [^>]*amazon\.com[^>]*>/g) ?? [];
      for (const a of anchors) expect(a, p.path).toMatch(/rel="sponsored nofollow noopener"/);
    }
  });

  it('includes an affiliate disclosure wherever it links to Amazon', () => {
    for (const p of all.filter((x) => x.bodyHtml.includes('amazon.com'))) expect(textOf(p.bodyHtml), p.path).toMatch(/Amazon Associate/);
  });

  it('landing page has a proper preview image and links to its entity pages', () => {
    expect(landing.headTags).toContain('og:image');
    expect(landing.headTags).toContain('/images/og-default.jpg');
    expect(landing.bodyHtml).toContain('/shoe-finder/methodology/');
    expect(landing.bodyHtml).toContain('/shoe-finder/best-running-shoes/');
    expect(landing.bodyHtml).toContain('/shoe-finder/compare/');
  });
});
