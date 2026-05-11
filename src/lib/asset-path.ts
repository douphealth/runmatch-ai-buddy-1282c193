/**
 * Prefix an absolute asset path with the document <base href> path.
 * Lets the same build work both on lovable.app (root) and behind the
 * Cloudflare reverse-proxy at gearuptofit.com/shoe-match/.
 */
export function assetPath(path: string): string {
  if (typeof document === 'undefined') return path;
  const baseHref = document.querySelector('base')?.getAttribute('href') || '/';
  try {
    const prefix = new URL(baseHref, window.location.origin).pathname.replace(/\/$/, '');
    if (!prefix) return path;
    return path.startsWith('/') ? `${prefix}${path}` : path;
  } catch {
    return path;
  }
}
