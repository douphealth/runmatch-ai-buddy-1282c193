/**
 * Resolve static asset URLs for both deploy shapes:
 * - Cloudflare Pages root preview: /images/...
 * - gearuptofit.com reverse-proxy mount: /shoe-finder/images/...
 *
 * The production WordPress domain serves this app under /shoe-finder/ and
 * does not expose bundled product photos at domain root. Infer that mount from
 * <base>, the current pathname, or the Vite script src so product photos never
 * degrade to placeholders on category/detail/comparison pages.
 */
export function assetPath(path: string): string {
  if (!path.startsWith('/')) return path;
  if (typeof document === 'undefined') return path;

  const candidates = [
    document.querySelector('base')?.getAttribute('href') || '',
    window.location.pathname.startsWith('/shoe-finder') ? '/shoe-finder/' : '',
    document.querySelector('script[src^="/shoe-finder/assets/"]')?.getAttribute('src') ? '/shoe-finder/' : '',
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const prefix = new URL(candidate, window.location.origin).pathname.replace(/\/$/, '');
      if (prefix && path !== prefix && !path.startsWith(`${prefix}/`)) return `${prefix}${path}`;
    } catch {
      // Ignore malformed base/script paths and fall back to the root asset.
    }
  }

  return path;
}
