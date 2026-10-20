# Shoe catalog: what is in it, where every number comes from, how to keep it true

As of **20 Oct 2026**: **218 shoes, 18 brands**. 208 have a verified men's/unisex Amazon listing (206 in stock, 2 out of stock when checked: Cielo X1 3.0 and the older Wave Rider 28), and every one of those shows the photo from the listing its Buy button opens. The other 10 have no Amazon US listing for that exact model and offer the maker's site instead.

## What changed on 19 Oct 2026 and why

| Problem found | Fix |
|---|---|
| Only 3 of 87 shoes were stability shoes, so overpronators and flat-footed runners got thin results. | 21 stability shoes added, 3 -> 24 (Gel-Kayano 33, GT-2000 15, GT-1000 15, Hurricane 26, Guide 19, Structure 26, Arahi 9, Gaviota 6, Wave Inspire 22, Cloudrunner 3, 860 v15 and more). |
| **No** shoe under $100, so the "under $100" quiz answer could never be satisfied. | 21 shoes at or under $100 (Revolution 8, Gel-Contend 9, Versablast 4, Runfalcon 5, Charged Assert 10, Revel 9, Trace 3, Arishi v4, 680 v9 and more). |
| 8 Buy links pointed at ASINs Amazon no longer returned; 24 linked listings were out of stock. | 48 shoes moved to a current, in-stock listing; `verify` now reports 0 problems. |
| About 45 of the ~75 existing shoes that could be checked disagreed with the maker's drop (1 mm or more) or weight (12 g or more): Ghost 17 at 12 mm instead of 10, Evo SL at 10 mm instead of 6.5, Hyperion Max 3 at 230 g instead of 281. | 97 drop, weight and MSRP figures corrected across 74 shoes to the maker-stated values (wrong-version matches excluded by hand); `lastVerified` set to 2026-10-19 on those. |
| Photos came from an old scrape that was only checked for byte-duplicates, not for showing the right model or colourway. | The photo is now the one on the **linked Amazon listing**; a bundled photo is only a fallback. Every photo was looked at on contact sheets and loads (HTTP 200, no duplicates). |
| "Long run" rotation slot could be a carbon racer (it only looked at the cushion number). | Race and speed shoes can no longer fill the long-run slot. |
| Budget page listed the cheapest shoes first, against its own advice. | Ranked by value: cushioning, recency, wide sizes, closeness to $100. |

## The rules every added shoe passed

1. **Amazon, from Amazon's own catalog (Creators API):** the exact model words are in the listing title in order; right brand; not kids', women's-only, GTX/Mid/BOA variants; **in stock with a price**; has a photo. Read every title by hand afterwards: kids' sizes ("EL C ... 1 US"), BOA variants and ambiguous titles slip past the code (they were caught this way).
2. **Specs:** drop, weight (men's), stack heights, terrain, arch support, widths and MSRP come from the maker's own figures as listed on RunRepeat's "Specs (brand)" block (`scripts/catalog/specs.cjs`). Where Amazon's own bullet text states a different drop, that conflict is resolved by hand (Arishi v4: Amazon says 6 mm, used) or the shoe is left out (Xodus Ultra 4: 4 mm vs 6 mm, left out). A wrong spec is worse than a missing shoe.
3. **Current models only:** no shoe whose newer generation is already in the database, no 2022-23 leftovers with a successor.
4. **No live prices anywhere** (Amazon Associates rule). Prices are used only as the launch price band; `priceUSD` is the MSRP.

## How each field is derived (so it can be audited)

* `category`: trail terrain -> `trail` (road + trail -> `hybrid`); arch support "stability" -> `stability`; pace "competition" -> `race`; heel stack >= 44 mm -> `max-cushion` (or `speed` if tempo and light); tempo and (<= 255 g or plated) -> `speed`; otherwise `daily`. A short list of overrides in the build step keeps lines consistent with how the existing catalog files them (Glycerin, Triumph, Cloudmonster are `max-cushion`; Rincon is neutral).
* `cushioning` (our own 1-10 scale, **not a lab measurement**): from the maker's heel stack: <= 26 mm 4, 27-29 5, 30-33 6, 34-38 7, 39-43 8, 44-47 9, >= 48 10; max-cushion at least 9, race at least 7, speed at most 8, never below 5.
* `pronation`: stability shoes `['overpronation']`, everything else `['neutral']`.
* `bestDistances`, `bestFor`, `injuryFriendly`: fixed rules per category (the same shapes the existing entries use), adjusted by weight, price and drop (for example budget shoes top out at half marathon; 10 mm and higher drops add `achilles`).
* `widthOptions`: the maker lists a Wide or X-Wide width.
* `highlights`: facts only (stack heights, carbon plate, rocker, drop, widths, weight).
* `year`: release year when RunRepeat gives one, otherwise the year of its first review.
* **Not verified:** `reviewURL` is the generic best-shoes guide and there is no `sourceURL`, so these shoes are recommendation-only (no indexable product page) and are labelled "Specs from manufacturer listings · confirm on the brand site". Add a real GearUpToFit review URL, a working maker `sourceURL` and `lastVerified` together, after checking the specs against that page.

## Adding or refreshing shoes (the whole routine)

```bash
export AMAZON_CREDENTIAL_FILE=<text file with the client id/secret pair>       # never commit it
# 1. candidates: .catalog-work/candidates.json  [{ "id": "brooks-ghost-19", "brand": "Brooks", "model": "Ghost 19", "rr": "brooks-ghost-19" }]
node scripts/catalog/specs.cjs brooks-ghost-19                                  # maker specs (stops on 403/429; never work around it)
node scripts/amazon-catalog.mjs discover .catalog-work/candidates.json --out .catalog-work/discovered.json
node scripts/catalog/build-entries.cjs review                                   # table + every Amazon title: read them all
node scripts/catalog/build-entries.cjs write
node scripts/amazon-catalog.mjs images --all                                    # photo URLs for every linked listing
node scripts/audit-shoe-images.mjs && npm test && npm run build
```

Monthly: `node scripts/amazon-catalog.mjs status` (stock), `resolve --refresh --write` (moves a shoe to a better-stocked listing), `images --all`, `verify --fix` (clears dead ASINs so the button is hidden, never wrong), `node scripts/audit-asin-cache.mjs`.

## Limits worth knowing

* An Amazon ASIN is a **colour and size**, not a model. Stock on that exact variation can change; the listing page still lets the buyer pick another size or colour. `status` shows which ones are out of stock right now.
* Amazon's API returns one photo size (500 px). Larger sizes through the CDN return the same file, so the PDF trims the white margin instead (`trimWhitespace` in `pdf-generator.ts`).
* RunRepeat is a cross-check, not an authority. It can lag a brand's own page by a few weeks, and two of its figures were wrong on inspection (a 5 g and a 10 g "weight" were parse errors and are rejected by the 150-420 g sanity range).
* The build's sitemap is derived from the same data: the richer catalog adds a Budget category page, an Altra brand page and a few comparison and result pages, and drops two result pages whose top picks no longer differ. Nothing is submitted anywhere by the build.
