# Deployment, topology and analytics

## How the pieces fit

```
Visitor / Googlebot
   │  https://gearuptofit.com/shoe-finder/…
   ▼
Cloudflare (gearuptofit.com zone)
   │  route: gearuptofit.com/shoe-finder*   →  Worker  (cloudflare/worker.js)
   ▼
Origin = the app build            (RUNMATCH_ORIGIN variable on the Worker)
   ├─ today:   https://runmatch-ai-buddy.lovable.app       (Lovable hosting)
   └─ planned: the Cloudflare Pages deployment of this repo (.github/workflows/deploy-cloudflare-pages.yml)
```

WordPress serves everything else on gearuptofit.com. The app is only ever reached through the Worker, so **the Worker decides robots policy and status codes**, not the origin.

### What the Worker does (and why you must deploy this version)

1. **Real 404s.** A single-page-app host answers every unknown URL with `200` and the landing page (a "soft 404"). `npm run build` writes `route-manifest.json`; the Worker uses it to answer unknown URLs with status 404, the app shell and `X-Robots-Tag: noindex`. If the manifest cannot be fetched the Worker **fails open** (everything passes through).
2. **Drops the origin's `X-Robots-Tag`.** Cloudflare Pages adds `X-Robots-Tag: noindex` to every `*.pages.dev` *preview/branch* hostname (for example `runmatch.gearup-flow-master.pages.dev`, which is how that URL showed `noindex` when I checked). If the Worker is pointed at such an origin and forwards that header, **the whole public tool would be deindexed.** The Worker now removes it and sets its own policy.
3. `?d=` (personalised result) links get `noindex, follow`.
4. **Cache policy.** HTML, the fixed-name entry bundle (`assets/index.js`, `assets/index.css`), `sw.js` and the web manifest are always revalidated; hashed chunks and photos are cached. Without this, a publish can be hidden for hours (or a year, for a visitor's browser) behind a stale copy, and visitors see the previous build or a mix of old and new files.
5. **No Lovable overlay.** The Lovable host injects an "Edit with Lovable" badge script (`~flock.js`). The Worker neither requests nor delivers it, and `src/index.css` hides the badge element for visits straight to the Lovable address. (Lovable's own switch for this is in the project's settings.)

**Live Worker:** `gearuptofit-runmatch-repo` (account papalexios@gmail.com), route `gearuptofit.com/shoe-finder*`. Deployed from this file on 2 Oct 2026 through the Cloudflare API (`PUT /accounts/<id>/workers/scripts/gearuptofit-runmatch-repo` with `keep_bindings`). The version it replaced is saved as `cloudflare/archive/gearuptofit-runmatch-repo.before-2026-10-02.js`; to roll back, upload that file the same way (or paste it in the dashboard). Every response carries `x-runmatch-manifest: fresh|cached|http-<status>|…` which says whether the Worker could load `route-manifest.json`; if it says `http-404` the Worker is failing open (everything passes through, no real 404s), which usually means the origin has not finished publishing.

Deploy: Cloudflare dashboard → Workers & Pages → the RunMatch worker → Edit code → paste `cloudflare/worker.js` → Deploy. (Or `wrangler deploy`.) Add a plain-text variable `RUNMATCH_ORIGIN` if the origin is not the default. Then verify:

```bash
curl -sI https://gearuptofit.com/shoe-finder/this-does-not-exist/ | head -5      # expect HTTP 404 + x-robots-tag: noindex
curl -sI https://gearuptofit.com/shoe-finder/results/neutral-10k-road-neutral/ | head -8   # expect 200, NO x-robots-tag
```

### Publishing the app build

The built HTML references `/assets/index.js?v=<build id>` and `/assets/index.css?v=<build id>` (`vite.config.ts`, plugin `version-entry-files`). The files keep their fixed names on the host so an older cached page never 404s, but every build is a new URL, so a browser or CDN that cached an old copy of the entry file can no longer hide a publish.

**After every publish:** in Cloudflare, *Caching → Configuration → Purge Cache → Custom purge* for `gearuptofit.com/shoe-finder/` (prefix), or *Purge Everything* if unsure. Deploy the current `cloudflare/worker.js` first so the cache rules above are in place; after that a purge is rarely needed. The old service worker is retired by `public/sw.js` (it clears its caches and unregisters itself), so returning visitors pick up the new build on their next visit.

- **Lovable hosting:** pushing to `main` updates the Lovable project; the published site only changes when you click **Publish** in Lovable. The pages the crawlers see are the prerendered files from `npm run build` (Lovable runs the `build` script).
- **Cloudflare Pages (GitHub Action):** pushes to `main` build and deploy to the Pages project `runmatch-ai-buddy-1282c193`. It needs the repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. The Action now runs `npm test` before deploying.
- `public/_headers` sets `noindex` for the raw Pages hostnames and sane cache headers. `public/_redirects` maps legacy URLs.

### Search Console / Bing checklist (after the deploy)

1. Submit `https://gearuptofit.com/shoe-finder/sitemap.xml` (only indexable URLs; `lastmod` only changes when content does).
2. Optional but recommended: add `Sitemap: https://gearuptofit.com/shoe-finder/sitemap.xml` to the WordPress `robots.txt` (crawlers only honour `robots.txt` at the domain root; today it lists only the Yoast index).
3. URL-inspect `/shoe-finder/results/overpronation-half-marathon-road-neutral/` and `/shoe-finder/methodology/`; view the rendered HTML and confirm the content and canonical.
4. Expect the `noindex,follow` pages (thin shoe/brand/comparison pages, sibling result pages that canonicalise to a representative) to show as "Excluded" in Search Console. That is intended.

## Analytics

The app loads gtag.js itself (production host `gearuptofit.com` only; never on previews/localhost; respects Global Privacy Control and Do Not Track) and reports to GA4 property `G-8T5PRFG3LE`, the same property your main site's GTM container reports to. Previously events were pushed to a `dataLayer` that nothing read.

| Event | When | Key parameters |
| --- | --- | --- |
| `page_view` | every route change | `page_path`, `page_location` (the `?d=` payload is stripped) |
| `quiz_view` / `quiz_start` | landing seen / quiz started | |
| `quiz_step` | each answered step | `step_id`, `step_number`, `value` (injury answers are reduced to `reported`/`none`) |
| `quiz_complete` | last step | `slug`, `duration_ms`, `used_current_shoe` |
| `result_view` | result shown | `slug`, `primary_shoe`, `match_percent`, `personalized`, `has_injury_notice` |
| `affiliate_click` | any Amazon link | `shoe`, `shoe_id`, `merchant`, `position`, `placement`, `slot`, `result_slug`, `match_percent` |
| `email_capture` | email form submitted | `source` (`quiz_gate`, `inline_results_card`, `exit_popup`), `marketing_consent` |
| `pdf_download` | PDF generated | `slug`, `category` |

**One-time GA4 setup (Admin):**

1. *Events* → mark `affiliate_click` and `email_capture` as **key events** (optionally `pdf_download`).
2. *Custom definitions* → create **event-scoped** dimensions for: `shoe`, `merchant`, `position`, `placement`, `slot`, `step_id`, `step_number`, `source`, `result_slug`. (Parameters only appear in reports once registered.)
3. *Explore → Funnel exploration*, steps: `quiz_view` → `quiz_start` → `quiz_step` (`step_number` = 9) → `quiz_complete` → `result_view` → `affiliate_click`. Turn on "Show elapsed time" and break down by `device category` and `personalized`.
4. A drop between `quiz_start` and `quiz_step` N tells you which question loses people; `step_number` 10 is the optional "current shoe" step.

Health data: injury names are never sent to GA. Do not add them later.

## Merging the open Stripe branch (`fix/stripe-premium-e2e-20260929`)

This work is based on `main` and is deliberately compatible: the `/results/:slug` route and the `_redirects` alias line are identical to the Stripe branch's, so those hunks merge cleanly. Expect small textual conflicts in `src/lib/analytics.ts` (add its three `pro*` events to the `track` object), `src/pages/RunMatchResult.tsx` (keep both the Pro card and the new notices), `src/pages/Index.tsx` and `cloudflare/worker.js` (take this version and keep its `RUNMATCH_ORIGIN` binding; this worker already supports it). **Before** deploying the Stripe worker origin change, make sure this worker's `X-Robots-Tag` handling is live (see above).
