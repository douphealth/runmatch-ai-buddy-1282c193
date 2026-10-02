/**
 * Head metadata + JSON-LD for the "entity" pages (brand, category, comparison,
 * shoe). One implementation feeds BOTH the React pages (via react-helmet-async)
 * and the build-time prerenderer, so the HTML a crawler receives and what the
 * browser shows can never drift apart.
 *
 * Pure: no React, no browser globals.
 *
 * Indexing policy (why some pages are `noindex,follow`): programmatic pages
 * only earn a place in the index when they carry real, distinct information.
 * A page that would be mostly template text, or that shows a photo that is
 * known not to match its shoe, stays available to users but is kept out of
 * search results and the sitemap until the data behind it improves.
 */
import { BRANDS, getBrandShoes, type BrandDef } from './brands';
import { CATEGORIES, getCategoryShoes, type CategoryDef } from './categories';
import { COMPARISONS, buildComparisonSlug, getAllComparisons, verdictFor, type ResolvedComparison } from './comparisons';
import { shoeDatabase, getShoeQualityState, type Shoe } from './shoe-database';
import { hasVerifiedPhoto, resolveShoeImage } from './shoe-images';
import { getWatchOuts, getNewerVersion } from './shoe-insights';
import { APP_BASE_PATH, APP_ORIGIN, BRAND_LOGO_URL, BRAND_NAME, DEFAULT_OG_IMAGE, SITE_ORIGIN, TOOL_NAME, appUrl } from './site-config';

export const ROBOTS_INDEX = 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1';
export const ROBOTS_NOINDEX = 'noindex,follow';

export interface PageSeo {
  title: string;
  description: string;
  canonical: string;
  robots: string;
  indexable: boolean;
  ogType: 'website' | 'article';
  ogImage: string;
  jsonLd: Record<string, unknown>[];
}

/** Absolute URL for a bundled asset path such as `/images/shoes/x.jpg` or `/shoe-finder/images/...`. */
export function absoluteAssetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const clean = path.startsWith(APP_BASE_PATH) ? path.slice(APP_BASE_PATH.length) : path;
  return `${APP_ORIGIN}${clean.startsWith('/') ? '' : '/'}${clean}`;
}

/** Best social/preview image for a shoe: its verified photo, else the branded default. */
export function shoeOgImage(shoe: Shoe): string {
  return absoluteAssetUrl(resolveShoeImage(shoe).url) ?? DEFAULT_OG_IMAGE;
}

const publisher = { '@type': 'Organization', name: BRAND_NAME, url: `${SITE_ORIGIN}/`, logo: BRAND_LOGO_URL };

export function breadcrumb(items: { name: string; url: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: it.url })),
  };
}

export function faqPage(faqs: { question: string; answer: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })),
  };
}

/** Carousel-style list pointing at our own shoe pages (no affiliate URLs, no fake Product offers). */
export function shoeItemList(name: string, shoes: Shoe[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    itemListElement: shoes.map((s, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: `${s.brand} ${s.model}`,
      url: appUrl(`shoes/${s.id}`),
    })),
  };
}

const article = (headline: string, description: string, url: string, image: string): Record<string, unknown> => ({
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: headline,
  description,
  url,
  image,
  isPartOf: { '@type': 'WebSite', name: TOOL_NAME, url: appUrl() },
  publisher,
});

// ---------------------------------------------------------------------------
// Indexability gates
// ---------------------------------------------------------------------------

/** A brand page needs at least 3 shoes to be more than a stub. */
export const isBrandIndexable = (brand: BrandDef): boolean => getBrandShoes(brand, 50).length >= 3;

/** A category page needs at least 4 picks to justify a ranked list. */
export const isCategoryIndexable = (cat: CategoryDef): boolean => getCategoryShoes(cat, 50).length >= 4;

/** Curated pairs only: the app will render ANY two shoes side by side, but only the curated list is meant to be indexed. */
const curatedComparison = (c: ResolvedComparison) => COMPARISONS.find((p) => (p.a === c.a.id && p.b === c.b.id) || (p.a === c.b.id && p.b === c.a.id));

/**
 * A comparison is only worth indexing when it is curated, both shoes have a
 * photo that really shows them, and each has a dedicated GearUpToFit review.
 */
export const isComparisonIndexable = (c: ResolvedComparison): boolean =>
  !!curatedComparison(c) && [c.a, c.b].every((s) => hasVerifiedPhoto(s) && !s.reviewURL.endsWith('/review/best-running-shoes/'));

/** Shoe pages stay behind the existing data-quality gate (source, review, affiliate, photo). */
export const isShoeIndexable = (shoe: Shoe): boolean => getShoeQualityState(shoe).isIndexable && hasVerifiedPhoto(shoe);

const robotsFor = (indexable: boolean) => (indexable ? ROBOTS_INDEX : ROBOTS_NOINDEX);

// ---------------------------------------------------------------------------
// Page builders
// ---------------------------------------------------------------------------

export function brandSeo(brand: BrandDef): PageSeo {
  const shoes = getBrandShoes(brand, 8);
  const canonical = appUrl(`best-running-shoes/brand/${brand.slug}`);
  const indexable = isBrandIndexable(brand);
  const ogImage = shoes[0] ? shoeOgImage(shoes[0]) : DEFAULT_OG_IMAGE;
  return {
    title: brand.title,
    description: brand.description,
    canonical,
    robots: robotsFor(indexable),
    indexable,
    ogType: 'article',
    ogImage,
    jsonLd: [
      breadcrumb([
        { name: TOOL_NAME, url: appUrl() },
        { name: brand.h1, url: canonical },
      ]),
      faqPage(brand.faqs),
      shoeItemList(brand.h1, shoes),
      article(brand.h1, brand.description, canonical, ogImage),
    ],
  };
}

export function categorySeo(cat: CategoryDef): PageSeo {
  const shoes = getCategoryShoes(cat, 8);
  const canonical = appUrl(`best-running-shoes/${cat.slug}`);
  const indexable = isCategoryIndexable(cat);
  const ogImage = shoes[0] ? shoeOgImage(shoes[0]) : DEFAULT_OG_IMAGE;
  return {
    title: cat.title,
    description: cat.description,
    canonical,
    robots: robotsFor(indexable),
    indexable,
    ogType: 'article',
    ogImage,
    jsonLd: [
      breadcrumb([
        { name: TOOL_NAME, url: appUrl() },
        { name: cat.h1, url: canonical },
      ]),
      faqPage(cat.faqs),
      shoeItemList(cat.h1, shoes),
      article(cat.h1, cat.description, canonical, ogImage),
    ],
  };
}

export function comparisonFaqs(c: ResolvedComparison): { question: string; answer: string }[] {
  const { a, b } = c;
  return [
    { question: `Which is better: ${a.brand} ${a.model} or ${b.brand} ${b.model}?`, answer: verdictFor(a, b).join(' ') },
    { question: `How do the ${a.brand} ${a.model} and ${b.brand} ${b.model} compare on price?`, answer: `The ${a.brand} ${a.model} has an MSRP of $${a.priceUSD} and the ${b.brand} ${b.model} has an MSRP of $${b.priceUSD}. Retail prices change, so check the current price before you buy.` },
    { question: `What is the weight difference between the ${a.brand} ${a.model} and ${b.brand} ${b.model}?`, answer: `The ${a.brand} ${a.model} is listed at ${a.weightGrams} g and the ${b.brand} ${b.model} at ${b.weightGrams} g (men's US 9 reference).` },
  ];
}

export function comparisonSeo(c: ResolvedComparison): PageSeo {
  // A reversed URL (b-vs-a) of a curated pair canonicalises to the curated order.
  const curated = curatedComparison(c);
  const canonical = appUrl(`compare/${curated ? buildComparisonSlug(curated.a, curated.b) : c.slug}`);
  const indexable = isComparisonIndexable(c);
  const ogImage = hasVerifiedPhoto(c.a) ? shoeOgImage(c.a) : DEFAULT_OG_IMAGE;
  return {
    title: c.title,
    description: c.description,
    canonical,
    robots: robotsFor(indexable),
    indexable,
    ogType: 'article',
    ogImage,
    jsonLd: [
      breadcrumb([
        { name: TOOL_NAME, url: appUrl() },
        { name: c.h1, url: canonical },
      ]),
      faqPage(comparisonFaqs(c)),
      shoeItemList(c.h1, [c.a, c.b]),
      article(c.h1, c.description, canonical, ogImage),
    ],
  };
}

export function shoeFaqs(shoe: Shoe, useCase: string): { question: string; answer: string }[] {
  const newer = getNewerVersion(shoe);
  const watch = getWatchOuts(shoe, undefined, 3);
  const faqs = [
    { question: `Who is the ${shoe.brand} ${shoe.model} best for?`, answer: `It is a ${useCase}. Its listed strengths are ${shoe.highlights.join(', ').toLowerCase()}.` },
    { question: `How much does the ${shoe.brand} ${shoe.model} weigh?`, answer: `It is listed at about ${shoe.weightGrams} g (~${(shoe.weightGrams * 0.0353).toFixed(1)} oz) in a men's sample size.` },
    { question: `What is the heel-to-toe drop of the ${shoe.brand} ${shoe.model}?`, answer: `${shoe.dropMM} mm.${shoe.dropMM <= 4 ? ' A low drop can feel different if you are used to a higher one, so build up mileage gradually.' : ''}` },
    { question: `Does the ${shoe.brand} ${shoe.model} come in wide sizes?`, answer: shoe.widthOptions ? `Wide widths are listed for the ${shoe.model}.` : `Only a standard width is listed in our data for the ${shoe.model}.` },
    { question: `Who should think twice about the ${shoe.brand} ${shoe.model}?`, answer: watch.length > 0 ? watch.join(' ') : 'Nothing stands out in the specs we track, but fit is personal, so try it on if you can.' },
  ];
  if (newer) faqs.push({ question: `Is there a newer version of the ${shoe.brand} ${shoe.model}?`, answer: `Yes, the ${newer.brand} ${newer.model} is in our database and is the better choice if you want the current generation.` });
  return faqs;
}

export function shoeSeo(shoe: Shoe, useCase: string): PageSeo {
  const canonical = appUrl(`shoes/${shoe.id}`);
  const indexable = isShoeIndexable(shoe);
  const brandDef = BRANDS.find((b) => b.name.toLowerCase() === shoe.brand.toLowerCase());
  const title = `${shoe.brand} ${shoe.model} Specs & Who It Suits (${shoe.year}) | RunMatch AI`;
  const description = `${shoe.brand} ${shoe.model} (${shoe.year}): ${useCase}. ${shoe.weightGrams} g, ${shoe.dropMM} mm drop, ${shoe.cushioning}/10 cushioning, plus who should skip it.`;
  const crumbs = [{ name: TOOL_NAME, url: appUrl() }];
  if (brandDef) crumbs.push({ name: `${brandDef.name} running shoes`, url: appUrl(`best-running-shoes/brand/${brandDef.slug}`) });
  crumbs.push({ name: `${shoe.brand} ${shoe.model}`, url: canonical });
  const ogImage = shoeOgImage(shoe);
  return {
    title: title.length <= 65 ? title : `${shoe.brand} ${shoe.model} Specs (${shoe.year}) | RunMatch AI`,
    description: description.length <= 160 ? description : `${description.slice(0, 157).replace(/\s+\S*$/, '')}…`,
    canonical,
    robots: robotsFor(indexable),
    indexable,
    ogType: 'article',
    ogImage,
    jsonLd: [breadcrumb(crumbs), faqPage(shoeFaqs(shoe, useCase)), article(`${shoe.brand} ${shoe.model}`, description, canonical, ogImage)],
  };
}

// ---------------------------------------------------------------------------
// Enumerations used by the prerenderer and the route guard
// ---------------------------------------------------------------------------

export const allBrandSlugs = (): string[] => BRANDS.map((b) => b.slug);
export const allCategorySlugs = (): string[] => CATEGORIES.map((c) => c.slug);
export const allComparisonSlugs = (): string[] => getAllComparisons().map((c) => c.slug);
export const allShoeIds = (): string[] => shoeDatabase.map((s) => s.id);
