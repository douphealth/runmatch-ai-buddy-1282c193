import { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { BRAND_NAME, TOOL_NAME } from '@/lib/site-config';
import { clearPrerenderedHead } from '@/lib/head-handoff';
import type { PageSeo } from '@/lib/entity-seo';

/**
 * Renders a page's <head> from a PageSeo object. The very same object is used
 * by scripts/prerender.mts to write the static HTML, so crawlers that do not run
 * JavaScript and browsers that do always see identical tags.
 *
 * The pre-rendered tags carry `data-prerender`. Once React takes over, Helmet
 * re-creates the same tags itself, so the static copies are removed here to
 * avoid duplicate canonicals, titles and JSON-LD blocks in the live DOM.
 */
const SeoHead = ({ seo }: { seo: PageSeo }) => {
  useEffect(() => {
    clearPrerenderedHead();
  }, []);

  const imageAlt = `${TOOL_NAME} by ${BRAND_NAME}`;

  return (
    <Helmet>
      <title>{seo.title}</title>
      <meta name="description" content={seo.description} />
      <meta name="robots" content={seo.robots} />
      <link rel="canonical" href={seo.canonical} />

      <meta property="og:site_name" content={BRAND_NAME} />
      <meta property="og:locale" content="en_US" />
      <meta property="og:type" content={seo.ogType} />
      <meta property="og:url" content={seo.canonical} />
      <meta property="og:title" content={seo.title} />
      <meta property="og:description" content={seo.description} />
      <meta property="og:image" content={seo.ogImage} />
      <meta property="og:image:alt" content={imageAlt} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@GearUpToFit" />
      <meta name="twitter:title" content={seo.title} />
      <meta name="twitter:description" content={seo.description} />
      <meta name="twitter:image" content={seo.ogImage} />
      <meta name="twitter:image:alt" content={imageAlt} />

      {seo.jsonLd.map((block, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(block)}
        </script>
      ))}
    </Helmet>
  );
};

export default SeoHead;
