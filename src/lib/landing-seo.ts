/**
 * Head metadata + JSON-LD for the landing page. Kept in its own small module
 * (no scoring or recommendation engine imports) because the landing page is
 * part of the eagerly-loaded entry bundle.
 * Shared by <SeoHead> in the browser and by scripts/prerender.mts at build time.
 */
import { BRAND_NAME, DEFAULT_OG_IMAGE, SITE_ORIGIN, TOOL_NAME, BRAND_LOGO_URL, appUrl } from './site-config';
import { LANDING_DESCRIPTION, LANDING_FAQS, LANDING_TITLE } from './landing-content';
import { ROBOTS_INDEX, breadcrumb, faqPage, type PageSeo } from './entity-seo';

const organization = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: BRAND_NAME,
  url: `${SITE_ORIGIN}/`,
  logo: BRAND_LOGO_URL,
  sameAs: [
    'https://www.facebook.com/gearuptofit',
    'https://www.instagram.com/gearuptofit',
    'https://www.youtube.com/@gearuptofit',
    'https://twitter.com/GearUpToFit',
  ],
};

const webApplication = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: `${TOOL_NAME} Running Shoe Finder`,
  url: appUrl(),
  applicationCategory: 'SportsApplication',
  operatingSystem: 'Web',
  inLanguage: 'en',
  isAccessibleForFree: true,
  description: LANDING_DESCRIPTION,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  publisher: { '@type': 'Organization', name: BRAND_NAME, url: `${SITE_ORIGIN}/` },
};

export function landingSeo(): PageSeo {
  return {
    title: LANDING_TITLE,
    description: LANDING_DESCRIPTION,
    canonical: appUrl(),
    robots: ROBOTS_INDEX,
    indexable: true,
    ogType: 'website',
    ogImage: DEFAULT_OG_IMAGE,
    jsonLd: [
      organization,
      webApplication,
      faqPage(LANDING_FAQS),
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: `${TOOL_NAME} Running Shoe Finder`,
        url: appUrl(),
        publisher: { '@type': 'Organization', name: BRAND_NAME, url: `${SITE_ORIGIN}/` },
      },
      breadcrumb([
        { name: 'Home', url: `${SITE_ORIGIN}/` },
        { name: 'Shoe Finder', url: appUrl() },
      ]),
    ],
  };
}

