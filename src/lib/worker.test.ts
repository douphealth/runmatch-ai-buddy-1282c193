import { describe, expect, it } from 'vitest';
// Plain JS module deployed to Cloudflare; TypeScript infers its types (allowJs).
import { cachePolicy, classifyPath, isValidResultSlug, robotsFor } from '../../cloudflare/worker.js';
import { CANONICAL_SLUGS } from './canonical-slugs';
import { answersFromSlug } from './quiz-data';
import { allBrandSlugs, allCategorySlugs, allComparisonSlugs, allShoeIds } from './entity-seo';
import { SHOE_ID_ALIASES } from './shoe-database';

const manifest = {
  shoeIds: allShoeIds(),
  shoeAliases: SHOE_ID_ALIASES,
  brandSlugs: allBrandSlugs(),
  categorySlugs: allCategorySlugs(),
  comparisonSlugs: allComparisonSlugs(),
};

describe('worker: result slug validation mirrors the app', () => {
  it('accepts every canonical slug', () => {
    for (const s of CANONICAL_SLUGS) expect(isValidResultSlug(s), s).toBe(true);
  });

  it('agrees with answersFromSlug on a sample of valid and invalid slugs', () => {
    const samples = ['unsure-ultra-track-wide', 'neutral-half-marathon-road-high-arch', 'neutral-10k-road', 'fast-10k-road-neutral', 'neutral-10k-moon-neutral', 'neutral-100k-road-neutral', 'garbage', ''];
    for (const s of samples) expect(isValidResultSlug(s), s).toBe(answersFromSlug(s) !== null);
  });
});

describe('worker: classifyPath answers real 404s for unknown URLs', () => {
  it('passes real pages', () => {
    for (const p of ['/', '/methodology/', '/results/neutral-10k-road-neutral/', '/app/runmatch/neutral-10k-road-neutral', '/shoes/nike-pegasus-41/', '/shoes/nb-fresh-foam-1080-v14/', '/best-running-shoes/trail/', '/best-running-shoes/brand/nike/', '/compare/nike-pegasus-41-vs-brooks-ghost-17/']) {
      expect(classifyPath(p, manifest), p).toBe('page');
    }
  });

  it('allows any two real shoes side by side (the app renders them)', () => {
    expect(classifyPath('/compare/nike-pegasus-41-vs-asics-novablast-6/', manifest)).toBe('page');
  });

  it('returns not-found for URLs that only exist because the SPA host answers everything with 200', () => {
    for (const p of ['/this-page-does-not-exist-xyz/', '/shoes/not-a-shoe/', '/compare/nope-vs-nothing/', '/best-running-shoes/unicorn/', '/best-running-shoes/brand/acme/', '/results/garbage/', '/app/runmatch/garbage', '/results/neutral-10k-road-neutral/extra/segment/']) {
      expect(classifyPath(p, manifest), p).toBe('not-found');
    }
  });

  it('passes static assets through untouched', () => {
    for (const p of ['/assets/index.js', '/assets/chunks/x-abc.js', '/images/shoes/nike-pegasus-41.jpg', '/sw.js', '/manifest.webmanifest', '/sitemap.xml', '/robots.txt', '/route-manifest.json', '/~flock.js', '/some/unknown/file.png']) {
      expect(classifyPath(p, manifest), p).toBe('asset');
    }
  });

  it('fails open when the manifest is unavailable (never turns the site into 404s)', () => {
    expect(classifyPath('/definitely/not/a/page/', null)).toBe('page');
  });
});

describe('worker: robots policy', () => {
  it('noindexes unknown URLs and personalised links, and lets normal pages inherit nothing', () => {
    expect(robotsFor('not-found', new URLSearchParams())).toMatch(/noindex/);
    expect(robotsFor('page', new URLSearchParams('d=abc'))).toBe('noindex, follow');
    expect(robotsFor('page', new URLSearchParams('utm_source=x'))).toBeNull();
    expect(robotsFor('asset', new URLSearchParams())).toBeNull();
  });
});

describe('cachePolicy', () => {
  it('revalidates the HTML and the fixed-name entry files so a publish is never hidden by a stale copy', () => {
    for (const p of ['/assets/index.js', '/assets/index.css', '/sw.js', '/manifest.webmanifest']) expect(cachePolicy(p, 'text/javascript'), p).toBe('public, max-age=0, must-revalidate');
    expect(cachePolicy('/results/neutral-10k-road-neutral', 'text/html; charset=utf-8')).toBe('public, max-age=0, must-revalidate');
    expect(cachePolicy('/', 'text/html')).toBe('public, max-age=0, must-revalidate');
  });

  it('lets hashed chunks and photos be cached', () => {
    expect(cachePolicy('/assets/chunks/RunMatchResult-abc123.js', 'text/javascript')).toContain('immutable');
    expect(cachePolicy('/images/shoes/nike-pegasus-41.jpg', 'image/jpeg')).toContain('max-age=2592000');
  });

  it('leaves everything else to the origin', () => {
    expect(cachePolicy('/route-manifest.json', 'application/json')).toBeNull();
  });
});