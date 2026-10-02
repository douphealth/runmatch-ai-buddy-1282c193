// Fails the build when the output cannot work behind the /shoe-finder/ proxy. Pure file checks, no browser.
//   1. The entry script and stylesheet are referenced by their exact file names. Lazy chunks import the entry
//      bundle by that URL and the browser keys modules by full URL, so "/assets/index.js?v=x" loads it twice
//      (two copies of React, "Invalid hook call" on every lazy route).
//   2. Lazy-chunk preload URLs are relative to the file that asks for them. A root-absolute "/assets/..." would
//      hit the WordPress site when the app is served under a prefix, and the PDF download (a lazy chunk) fails.
//   3. The files the Worker and the sitemap depend on exist.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dist = resolve(process.argv[2] || 'dist');
const problems = [];
const read = (p) => readFileSync(resolve(dist, p), 'utf8');

for (const f of ['index.html', 'assets/index.js', 'assets/index.css', 'route-manifest.json', 'sitemap.xml', 'robots.txt']) {
  if (!existsSync(resolve(dist, f))) problems.push(`missing ${f}`);
}

if (!problems.length) {
  const html = read('index.html');
  const entryRefs = [...html.matchAll(/(?:src|href)=["']([^"']*\/assets\/index\.(?:js|css)[^"']*)["']/g)].map((m) => m[1]);
  if (!entryRefs.some((r) => r.endsWith('/assets/index.js'))) problems.push('index.html does not reference /assets/index.js');
  for (const ref of entryRefs) {
    if (/[?#]/.test(ref)) problems.push(`entry URL has a query string (loads the module twice): ${ref}`);
  }

  const js = read('assets/index.js');
  if (/function\(\w+\)\{return"\/"\+\w+\}/.test(js)) problems.push('preload helper builds root-absolute URLs ("/"+dep); set experimental.renderBuiltUrl relative for js');
  if (!/new URL\(\w+,\w+\)\.href/.test(js)) problems.push('preload helper does not resolve dependencies against import.meta.url');
  const deps = js.match(/m\.f=\[([^\]]*)\]/);
  if (deps && /"\/assets\//.test(deps[1])) problems.push('dependency list contains root-absolute paths');
}

if (problems.length) {
  console.error('[check-dist] FAILED');
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log('[check-dist] ✓ entry URLs are plain, lazy-chunk URLs are relative, required files present');
