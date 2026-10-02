/**
 * Single source of truth for origin/brand constants shared by the client app,
 * the build-time prerenderer and the tests. Pure: no browser or Node globals.
 */

export const SITE_ORIGIN = 'https://gearuptofit.com';
export const APP_BASE_PATH = '/shoe-finder';
/** Public, canonical origin of the tool (no trailing slash). */
export const APP_ORIGIN = `${SITE_ORIGIN}${APP_BASE_PATH}`;

export const BRAND_NAME = 'GearUpToFit';
export const TOOL_NAME = 'RunMatch AI';
export const BRAND_LOGO_URL = `${SITE_ORIGIN}/wp-content/uploads/2023/03/cropped-Grey-Black-Illustration-Gym-Fitness-Logo.png`;

/** Social/link-preview image used when a page has no better (e.g. a shoe photo). */
export const DEFAULT_OG_IMAGE = `${APP_ORIGIN}/images/og-default.jpg`;

/**
 * GA4 measurement ID of the gearuptofit.com property. Measurement IDs are
 * public (they ship in every page's HTML); this is the same ID the main site's
 * GTM container already reports to.
 */
export const GA_MEASUREMENT_ID = 'G-8T5PRFG3LE';

/** Hosts on which analytics is allowed to load. Previews / pages.dev never report. */
export const ANALYTICS_HOSTS = ['gearuptofit.com', 'www.gearuptofit.com'];

/**
 * Date (YYYY-MM-DD) of the last material change to page templates or content.
 * Used as sitemap <lastmod>. Bump it when copy, structure or data changes in a
 * way a crawler should re-fetch; do NOT make it "today" on every build, because
 * search engines learn to ignore lastmod values that change without the content.
 */
export const CONTENT_REVISION_DATE = '2026-09-30';

/** Build the absolute public URL for an app path, always with a trailing slash. */
export function appUrl(path = ''): string {
  const clean = path.replace(/^\/+/, '').replace(/\/+$/, '');
  return clean ? `${APP_ORIGIN}/${clean}/` : `${APP_ORIGIN}/`;
}
