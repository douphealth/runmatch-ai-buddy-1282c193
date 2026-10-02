import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../../cloudflare/worker.js';

const manifest = {
  version: 1,
  shoeIds: ['nike-pegasus-41'],
  shoeAliases: {},
  brandSlugs: ['nike'],
  categorySlugs: ['trail'],
  comparisonSlugs: [],
  canonicalResultSlugs: ['neutral-10k-road-neutral'],
};

let originCalls: string[] = [];
let manifestStatus = 200;
let originHeaders: Record<string, string> = {};

class FakeRewriter {
  on() { return this; }
  transform(res: Response) { return res; }
}

beforeEach(() => {
  originCalls = [];
  manifestStatus = 200;
  originHeaders = {};
  vi.stubGlobal('HTMLRewriter', FakeRewriter);
  vi.stubGlobal('fetch', async (input: Request | string) => {
    const url = typeof input === 'string' ? input : input.url;
    originCalls.push(url);
    if (url.endsWith('/route-manifest.json')) {
      return manifestStatus === 200 ? new Response(JSON.stringify(manifest), { status: 200 }) : new Response('nope', { status: manifestStatus });
    }
    return new Response('<html><head></head><body>app</body></html>', {
      status: 200,
      headers: { 'content-type': 'text/html', ...originHeaders },
    });
  });
});
afterEach(() => vi.unstubAllGlobals());

const get = (path: string, env: Record<string, string> = { RUNMATCH_ORIGIN: 'https://origin.test' }) =>
  worker.fetch(new Request(`https://gearuptofit.com${path}`), env);

// Each test uses a distinct origin so the Worker's per-isolate manifest cache cannot leak between tests.
let n = 0;
const fresh = () => ({ RUNMATCH_ORIGIN: `https://origin${++n}.test` });

describe('worker.fetch', () => {
  it('answers an unknown URL with a real 404, the app shell and noindex', async () => {
    const res = await get('/shoe-finder/definitely-not-a-page/', fresh());
    expect(res.status).toBe(404);
    expect(res.headers.get('x-robots-tag')).toMatch(/noindex/);
    expect(await res.text()).toContain('app');
    // it asked the origin for the shell ("/"), not for the made-up path
    expect(originCalls.some((u) => u.endsWith('/definitely-not-a-page/'))).toBe(false);
  });

  it('serves a real page with 200 and no robots header of its own', async () => {
    const res = await get('/shoe-finder/shoes/nike-pegasus-41/', fresh());
    expect(res.status).toBe(200);
    expect(res.headers.get('x-robots-tag')).toBeNull();
  });

  it('drops the origin X-Robots-Tag so a *.pages.dev preview noindex cannot deindex the public site', async () => {
    originHeaders = { 'x-robots-tag': 'noindex' };
    const res = await get('/shoe-finder/results/neutral-10k-road-neutral/', fresh());
    expect(res.status).toBe(200);
    expect(res.headers.get('x-robots-tag')).toBeNull();
  });

  it('marks personalised ?d= links noindex,follow', async () => {
    const res = await get('/shoe-finder/results/neutral-10k-road-neutral/?d=abc', fresh());
    expect(res.headers.get('x-robots-tag')).toBe('noindex, follow');
  });

  it('fails open when the manifest cannot be loaded: unknown URLs pass through instead of 404ing the site', async () => {
    manifestStatus = 500;
    const res = await get('/shoe-finder/anything-at-all/', fresh());
    expect(res.status).toBe(200);
  });

  it('maps the public prefix to the origin root and passes assets through', async () => {
    const env = fresh();
    await get('/shoe-finder/assets/index.js', env);
    await get('/shoe-finder', env);
    expect(originCalls.some((u) => u === `${env.RUNMATCH_ORIGIN}/assets/index.js`)).toBe(true);
    expect(originCalls.some((u) => u === `${env.RUNMATCH_ORIGIN}/`)).toBe(true);
  });
});
