# Maintenance guide

The app is only as trustworthy as its data. These scripts keep it honest. All run with plain `node` from the repo root.

## Adding or updating a shoe

1. Edit `src/lib/shoe-database.ts`. Copy the newest entry, keep ids kebab-case, use the brand spelling already in use (`Asics`, not `ASICS`).
2. If it replaces an older model, add nothing else: the **previous generation is detected automatically** (same brand + model name, higher version number) and down-ranked with a "newer version available" note.
3. **Photos come from the Amazon listing** the Buy button opens (step 4), so a bundled file is optional and only a fallback for shoes without a listing. If you do add one at `public/images/shoes/{brand}-{model}.jpg` (slug = lower-case, non-alphanumerics → `-`, e.g. `nike-pegasus-42.jpg`), then:
   ```bash
   npm i --no-save sharp && node scripts/optimize-images.mjs   # shrink it (idempotent)
   node scripts/audit-shoe-images.mjs                          # regenerates src/lib/shoe-image-audit.ts
   ```
   The audit finds photos that are **byte-identical to another shoe's** (a wrong-shoe photo) and makes the UI show a branded studio frame instead. After you have looked at a flagged photo and it really shows that model, add the id to `VERIFIED_DUPLICATE_OWNERS` in the script.
4. Find its Amazon listing and photo from Amazon's own catalog (Creators API). Credentials stay in your environment, never in the repo:
   ```bash
   # AMAZON_CREATORS_CLIENT_ID / AMAZON_CREATORS_CLIENT_SECRET, or AMAZON_CREDENTIAL_FILE=<text file with the pair>
   node scripts/amazon-catalog.mjs resolve --write nike-pegasus-42   # strict match: exact model + version, men's/unisex, not kids'/GTX/Mid
   node scripts/amazon-catalog.mjs verify                           # every cached ASIN must still be returned by Amazon with a matching title
   node scripts/amazon-catalog.mjs verify --fix                     # clears ones that are not (the button is then hidden, never wrong)
   node scripts/amazon-catalog.mjs images                           # Amazon photo URLs for shoes without a trustworthy local photo
   node scripts/audit-asin-cache.mjs                                # offline audit of the cached listing titles
   ```
   Also: `status` (stock of every linked listing), `resolve --refresh --write` (moves a shoe to a better-stocked listing), `discover <file>` (vets shoes not in the database yet), `images --all` (a photo URL for every linked listing; run it after any ASIN change). The whole add-a-shoe routine, the rules and the sources are in `docs/CATALOG.md`.
   The API is throttled to about one request per second, so a full `verify` takes about 15 seconds. Shoes Amazon does not list keep `asin: null`: the Amazon button is hidden and the page, results and PDF offer the maker's site and our review instead (`getBrandBuyLink`). Never fall back to an Amazon search URL. As of 2026-10-20: 208 of 218 shoes have a verified men's/unisex listing (206 in stock) and 10 have none because Amazon US does not list that exact model (2026 releases such as Gel-Nimbus 29, Cloudeclipse 2, Fast-R Nitro Elite 3, and a few 2024-25 models).
   Photos: every shoe with a verified listing shows the photo of THAT listing (`src/lib/amazon-image-cache.json`, URLs only, loaded from Amazon's CDN); a bundled photo is used only for shoes with no listing. The cache is used only while its ASIN is still the cached one, and a test fails if a linked shoe has no matching photo. Re-run `images --all` when you change an ASIN.
5. `npm test && npm run build`. `validate-shoe-database` fails the build on duplicate ids/models, inconsistent brand spelling, bad ranges, missing local image files.

## Gear ("Complete your kit") and landing top picks

`src/lib/gear-catalog.ts` lists the gear shown next to the shoes. Add an item with its ASIN and brand, then run `node scripts/amazon-catalog.mjs gear`: it fails if Amazon does not return the ASIN or the listing title does not name the brand, and writes the photos to `src/lib/gear-image-cache.json`. `selectGear` chooses six items from the runner's answers (a watch, socks, fuel for long distances, a headlamp or vest for trail). `src/lib/top-picks.ts` picks one buyable shoe per category for the landing page (needs a photo, a verified men's/unisex listing and no newer version). Neither affects rankings.

## The PDF report

`src/lib/pdf-generator.ts` builds the report with jsPDF (about 7 pages): top 3 at a glance, the #1 match in depth (who it suits and who should look elsewhere), "if one thing matters most" alternatives (softest / lightest / best value / wide sizes, all within 20 points of the top score), the top 3 side by side with the leader marked on each row, the rotation, ranks 4 to 10, try-on guide, a printable shoe log, verified gear with photos, the radar and the scoring method. A **Buy on Amazon** button exists only for shoes with a verified ASIN; a photo is embedded only when `resolveShoePhoto` has one (the Amazon listing photo first, trimmed of its white margin), otherwise a labelled placeholder is drawn. No live price is ever printed. `src/lib/pdf-generator.test.ts` pins these rules. To eyeball the layout, run `PDF_DUMP_DIR=some/dir npx vitest run src/lib/pdf-generator.test.ts` and open the four sample PDFs it writes (the test stands in one local photo for every Amazon photo, so check real photos with a real browser download).

## Email popup

`src/components/conversion/ExitIntent.tsx` opens the email form on exit intent, after 20 s on a result page, or after 55% scroll (touch screens use the timer and the scroll trigger). It shows at most once per session, never to subscribers, and stays quiet for 7 days after a dismissal. Each opening fires `exit_intent_shown` with a `trigger` parameter so you can see which trigger converts.

Shoes with no `sourceURL` are labelled "Specs from manufacturer listings · confirm on the brand site" rather than "verified". Add a working manufacturer `sourceURL` + `lastVerified` only after checking the specs against it.

## Weekly: link health

`docs/workflows/link-health.yml` is a ready-made GitHub Actions workflow (copy it to `.github/workflows/` — pushing workflow files needs a token with the `workflow` scope, so it is not installed yet). It runs `node scripts/check-links.mjs` every Monday (also runnable by hand; add a `npm test` step before the build in `deploy-cloudflare-pages.yml` the same way): your own articles and per-shoe reviews, manufacturer pages, research citations and every Amazon product page. A failed run means a link returned **404/410**. Bot-blocked or temporary responses are reported as "unverifiable" and never fail the run. The report (`link-report.json`) is attached to the run.

## Claims and evidence

Write research claims **only** in `src/lib/evidence.ts`, at the strength the study supports (observational study → "associated with", never "reduces"). `src/lib/content-guard.test.ts` fails the build if fabricated testimonials, fake counters, wrong citations or treatment prescriptions come back.

## Changing the scoring

Weights and penalties are constants at the top of `src/lib/scoring-engine.ts`; the `/methodology/` page and the "How these shoes are ranked" panel read them from there. Tests pin the injury penalties and the weight total. Changing a weight changes which shoes the ~25 canonical result pages show; `src/lib/result-groups.ts` re-groups near-identical pages automatically at the next build.

## Canonical result pages

`src/lib/canonical-slugs.ts` lists the ~45 profiles that get a static page. Pages whose shortlist and rotation are identical to a sibling share one **representative** (indexed, in the sitemap); the others remain reachable but canonicalise to it. Do not add slugs that produce a shortlist identical to an existing one: the test suite and `result-groups.ts` will simply fold them into a group.

## Yearly: the "2026" wording

Brand/category/comparison copy says "2026" (titles, H1s). When you refresh the data for a new year, update those strings together with `SHOE_DATABASE_LAST_UPDATED` (`src/lib/price-tier.ts`) and `CONTENT_REVISION_DATE` (`src/lib/site-config.ts`, used as the sitemap `lastmod`). Do not set `lastmod` to "today" on every build.

## Byline / reviewer

`src/lib/editorial.ts` has empty `author` and `reviewer` fields. No person is invented. When a named author or a qualified reviewer (for example a physiotherapist) is available, fill them in and the methodology page byline and its structured data update themselves.
