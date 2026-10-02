import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker, { patchEntryBundle } from '../../cloudflare/worker.js';

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

const rewriterSelectors: string[] = [];
class FakeRewriter {
  on(selector: string) { rewriterSelectors.push(selector); return this; }
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
    if (/\/route-manifest\.json(\?|$)/.test(url)) {
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

  it('looks the manifest up with a changing query string so a stale cached 404 cannot hide it', async () => {
    const env = fresh();
    await get('/shoe-finder/shoes/nike-pegasus-41/', env);
    expect(originCalls.some((u) => /\/route-manifest\.json\?t=\d+$/.test(u))).toBe(true);
  });

  it('reports how the manifest lookup ended in a header', async () => {
    const ok = await get('/shoe-finder/', fresh());
    expect(ok.headers.get('x-runmatch-manifest')).toBe('fresh');
    manifestStatus = 404;
    const down = await get('/shoe-finder/', fresh());
    expect(down.headers.get('x-runmatch-manifest')).toBe('http-404');
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

  it('never delivers the Lovable overlay script', async () => {
    const res = await get('/shoe-finder/~flock.js', fresh());
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('javascript');
    expect(await res.text()).not.toMatch(/lovable-badge|gpteng/i);
    expect(originCalls.some((u) => u.includes('flock'))).toBe(false);
  });

  it('puts the public prefix in front of root-absolute lazy-chunk URLs in an older entry bundle', async () => {
    const old = 'x=1;const $C="modulepreload",HC=function(e){return"/"+e},pg={};y=2';
    expect(patchEntryBundle(old)).toBe('x=1;const $C="modulepreload",HC=function(e){return"/shoe-finder/"+e},pg={};y=2');
  });

  it('leaves a bundle that already uses relative preload URLs alone', () => {
    const fixed = 'HC=function(e,t){return new URL(e,t).href},pg={}';
    expect(patchEntryBundle(fixed)).toBe(fixed);
  });

  it('does nothing when the pattern is ambiguous (two matches) instead of guessing', () => {
    const two = 'a=function(e){return"/"+e};b=function(t){return"/"+t}';
    expect(patchEntryBundle(two)).toBe(two);
  });

  it('serves the patched entry bundle with the origin ETag kept and no stale length or encoding', async () => {
    const js = 'HC=function(e){return"/"+e},pg={}';
    vi.stubGlobal('fetch', async (input: Request | string) => {
      const url = typeof input === 'string' ? input : input.url;
      if (/route-manifest/.test(url)) return new Response(JSON.stringify(manifest), { status: 200 });
      return new Response(js, { status: 200, headers: { 'content-type': 'application/javascript', etag: '"abc"', 'content-encoding': 'br', 'content-length': '999' } });
    });
    const res = await get('/shoe-finder/assets/index.js', fresh());
    expect(await res.text()).toContain('return"/shoe-finder/"+e');
    expect(res.headers.get('x-runmatch-patched')).toBe('preload-prefix');
    expect(res.headers.get('etag')).toBe('"abc"');
    expect(res.headers.get('content-encoding')).toBeNull();
    expect(res.headers.get('content-length')).toBeNull();
  });

  it('removes the Lovable badge the host writes into the HTML, and its script', async () => {
    rewriterSelectors.length = 0;
    await get('/shoe-finder/', fresh());
    expect(rewriterSelectors).toContain('aside#lovable-badge');
    expect(rewriterSelectors.some((s) => s.includes('~flock'))).toBe(true);
  });

  it('revalidates HTML and the entry bundle on every load, whatever the origin says', async () => {
    originHeaders = { 'cache-control': 'public, max-age=31536000' };
    const bundle = await get('/shoe-finder/assets/index.js', fresh());
    expect(bundle.headers.get('cache-control')).toBe('public, max-age=0, must-revalidate');
    const page = await get('/shoe-finder/', fresh());
    expect(page.headers.get('cache-control')).toBe('public, max-age=0, must-revalidate');
  });

  it('maps the public prefix to the origin root and passes assets through', async () => {
    const env = fresh();
    await get('/shoe-finder/assets/index.js', env);
    await get('/shoe-finder', env);
    expect(originCalls.some((u) => new RegExp(`^${env.RUNMATCH_ORIGIN}/assets/index\\.js\\?_rm=\\d+$`).test(u))).toBe(true);
    expect(originCalls.some((u) => new RegExp(`^${env.RUNMATCH_ORIGIN}/\\?_rm=\\d+$`).test(u))).toBe(true);
  });

  it('asks for the entry files and HTML under a key that changes every minute, so a publish shows up without a purge', async () => {
    const env = fresh();
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-10-02T12:00:10Z'));
      await get('/shoe-finder/assets/index.js', env);
      vi.setSystemTime(new Date('2026-10-02T12:01:10Z'));
      await get('/shoe-finder/assets/index.js', env);
    } finally {
      vi.useRealTimers();
    }
    const keys = originCalls.filter((u) => u.includes('/assets/index.js')).map((u) => u.split('_rm=')[1]);
    expect(keys).toHaveLength(2);
    expect(keys[0]).not.toBe(keys[1]);
  });

  it('keeps the runner\'s own query string and appends the key after it', async () => {
    const env = fresh();
    await get('/shoe-finder/results/neutral-10k-road-neutral/?d=abc', env);
    expect(originCalls.some((u) => /\/results\/neutral-10k-road-neutral\/\?d=abc&_rm=\d+$/.test(u))).toBe(true);
  });

  it('leaves hashed chunks and images exactly as requested so they stay cached', async () => {
    const env = fresh();
    await get('/shoe-finder/assets/chunks/KitPicks-abc123.js', env);
    await get('/shoe-finder/images/shoes/nike-pegasus-41.jpg', env);
    expect(originCalls).toContain(`${env.RUNMATCH_ORIGIN}/assets/chunks/KitPicks-abc123.js`);
    expect(originCalls).toContain(`${env.RUNMATCH_ORIGIN}/images/shoes/nike-pegasus-41.jpg`);
  });
});
