/**
 * Strict matching between a shoe in our database and an Amazon listing title.
 * Shared by scripts/resolve-amazon-asins.mjs (choosing an ASIN) and
 * scripts/check-links.mjs (auditing the ASINs already cached).
 *
 * Why strict: a wrong ASIN is worse than none. It sends a buyer to a different
 * model or a women's version of the shoe described on the page, and the UI is
 * written to hide the Amazon button when no verified ASIN exists.
 *
 * Rules, all of which must hold:
 *  1. Every model token appears in the title. Numeric tokens match as whole
 *     numbers ("3" must not match inside "13" or "2023").
 *  2. The version number is not contradicted: for "Fast-R Nitro Elite 3" a
 *     title saying "Fast-R Nitro Elite 2" is rejected.
 *  3. Not a women's-only listing (our specs describe the men's/unisex sample).
 */

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const cleanModel = (m) => m.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();

// Amazon titles punctuate model names inconsistently ("Gel.Kayano", "Fast-R", "S/Lab"): compare on words.
const words = (s) => s.toLowerCase().replace(/[.\-_/]+/g, ' ').replace(/\s+/g, ' ').trim();

export const modelTokens = (model) =>
  words(cleanModel(model))
    .split(/\s+/)
    .filter((t) => t.length >= 1 && !/^(the|and)$/.test(t));

// Whole-number match that tolerates zero padding ("Kjerag 02" is version 2).
const hasToken = (title, tok) => (/^v?\d+$/.test(tok) ? new RegExp(`(?<![0-9])0*${escapeRe(tok.replace(/^v/, ''))}(?![0-9])`).test(title) : title.includes(tok));

/** The version number the title attaches to the model family, if any. */
function versionInTitle(title, familyTokens) {
  const family = familyTokens.map(escapeRe).join('[\\s-]+');
  const m = title.match(new RegExp(`${family}[\\s-]+v?0*(\\d{1,3})(?![0-9])`));
  return m ? m[1] : null;
}

export function isPlausibleMatch(title, brand, model) {
  if (!title) return { ok: false, reason: 'no title' };
  const t = words(title);
  const toks = modelTokens(model);
  if (toks.length === 0) return { ok: false, reason: 'no model tokens' };

  const missing = toks.filter((tok) => !hasToken(t, tok));
  if (missing.length) return { ok: false, reason: `missing: ${missing.join(', ')}` };

  const last = toks[toks.length - 1];
  if (/^v?\d{1,3}$/.test(last) && toks.length > 1) {
    const want = last.replace(/^v/, '');
    const got = versionInTitle(t, toks.slice(0, -1));
    if (got && got !== want) return { ok: false, reason: `version mismatch: wanted ${want}, title says ${got}` };
  }

  if (/\bwomen'?s?\b/.test(t) && !/\bmen'?s?\b(?!.*\bwomen)/.test(t.replace(/women/g, ''))) {
    return { ok: false, reason: "women's listing" };
  }
  return { ok: true };
}
