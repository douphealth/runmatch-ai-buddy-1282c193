/**
 * Editorial identity shown on the methodology page and in byline-style notes.
 *
 * Expertise signals (E-E-A-T) must be real, so no person is invented here.
 * When a named author or a qualified reviewer (for example a physiotherapist or
 * running coach) is available, fill the two fields below and the byline and the
 * page's structured data pick them up automatically.
 */
export interface EditorialPerson {
  name: string;
  /** Link to a bio page on gearuptofit.com. */
  url?: string;
  /** Short, truthful credential line, e.g. "Physiotherapist, 10 years treating runners". */
  credentials?: string;
}

export const EDITORIAL: {
  teamName: string;
  author?: EditorialPerson;
  reviewer?: EditorialPerson;
  links: Record<'about' | 'editorialPolicy' | 'affiliateDisclosure' | 'contact' | 'privacy', string>;
} = {
  teamName: 'GearUpToFit editorial team',
  author: undefined,
  reviewer: undefined,
  links: {
    about: 'https://gearuptofit.com/about-us/',
    editorialPolicy: 'https://gearuptofit.com/editorial-policy/',
    affiliateDisclosure: 'https://gearuptofit.com/affiliate-disclosure/',
    contact: 'https://gearuptofit.com/contact/',
    privacy: 'https://gearuptofit.com/privacy-policy/',
  },
};

export function bylineText(): string {
  const parts = [`By ${EDITORIAL.author?.name ?? EDITORIAL.teamName}`];
  if (EDITORIAL.reviewer) parts.push(`Reviewed by ${EDITORIAL.reviewer.name}${EDITORIAL.reviewer.credentials ? ` (${EDITORIAL.reviewer.credentials})` : ''}`);
  return parts.join(' · ');
}
