/**
 * Head metadata + JSON-LD for the landing page and result pages.
 * Shared by <SeoHead> in the browser and by scripts/prerender.mts at build time.
 * Pure: no React, no browser globals.
 */
import { BRAND_LOGO_URL, BRAND_NAME, DEFAULT_OG_IMAGE, SITE_ORIGIN, TOOL_NAME, appUrl } from './site-config';
import { ROBOTS_INDEX, ROBOTS_NOINDEX, breadcrumb, faqPage, shoeItemList, shoeOgImage, type PageSeo } from './entity-seo';
import { isCanonicalSlug } from './canonical-slugs';
import type { QuizAnswers } from './quiz-data';
import { generateRecommendation } from './recommendation-engine';
import { buildRotation, scoreShoes } from './scoring-engine';
import { getDynamicFAQs } from './dynamic-faqs';
import { EDITORIAL } from './editorial';
import { METHODOLOGY_DESCRIPTION, METHODOLOGY_LAST_REVIEWED, METHODOLOGY_TITLE } from './methodology-content';
import { generateMetaTitle, generateResultDescription, generateResultH1 } from './seo';
import { getResultRepresentative } from './result-groups';

export function methodologySeo(): PageSeo {
  const canonical = appUrl('methodology');
  return {
    title: METHODOLOGY_TITLE,
    description: METHODOLOGY_DESCRIPTION,
    canonical,
    robots: ROBOTS_INDEX,
    indexable: true,
    ogType: 'article',
    ogImage: DEFAULT_OG_IMAGE,
    jsonLd: [
      breadcrumb([
        { name: TOOL_NAME, url: appUrl() },
        { name: 'Methodology', url: canonical },
      ]),
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: METHODOLOGY_TITLE,
        description: METHODOLOGY_DESCRIPTION,
        url: canonical,
        dateModified: METHODOLOGY_LAST_REVIEWED,
        author: EDITORIAL.author
          ? { '@type': 'Person', name: EDITORIAL.author.name, ...(EDITORIAL.author.url ? { url: EDITORIAL.author.url } : {}) }
          : { '@type': 'Organization', name: BRAND_NAME, url: `${SITE_ORIGIN}/` },
        publisher: { '@type': 'Organization', name: BRAND_NAME, url: `${SITE_ORIGIN}/`, logo: BRAND_LOGO_URL },
      },
    ],
  };
}

export interface ResultSeoOptions {
  /** True when the URL carries a personalised `?d=` payload. */
  personalized?: boolean;
}

/**
 * Indexing rules for result URLs:
 *  - representative canonical slug, no ?d=   -> indexed, in the sitemap, self-canonical
 *  - sibling canonical slug (same shortlist) -> usable page whose canonical is the representative
 *  - long-tail slug or any ?d= personalised link -> `noindex,follow`, canonical = clean slug / representative
 * so nothing competes with the pages we actually want in search results.
 */
export function resultSeo(slug: string, answers: QuizAnswers, options: ResultSeoOptions = {}): PageSeo {
  const inSet = isCanonicalSlug(slug);
  const representative = getResultRepresentative(slug);
  const canonical = appUrl(`results/${inSet ? representative : slug}`);
  const indexable = inSet && representative === slug && !options.personalized;
  const indexAllowed = inSet && !options.personalized;
  const recommendation = generateRecommendation(answers);
  const scored = scoreShoes(answers);
  const top5 = scored.slice(0, 5).map((s) => s.shoe);
  const rotation = buildRotation(answers);
  const primary = rotation.primary?.shoe;
  const title = generateMetaTitle(answers);
  const description = generateResultDescription(answers, top5.map((s) => `${s.brand} ${s.model}`));
  const ogImage = primary ? shoeOgImage(primary) : DEFAULT_OG_IMAGE;
  return {
    title,
    description,
    canonical,
    robots: indexAllowed ? ROBOTS_INDEX : ROBOTS_NOINDEX,
    indexable,
    ogType: 'website',
    ogImage,
    jsonLd: [
      breadcrumb([
        { name: BRAND_NAME, url: `${SITE_ORIGIN}/` },
        { name: `${TOOL_NAME} Shoe Finder`, url: appUrl() },
        { name: generateResultH1(answers), url: canonical },
      ]),
      faqPage(getDynamicFAQs(answers)),
      shoeItemList(generateResultH1(answers), top5),
    ],
  };
}
