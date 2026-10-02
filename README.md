# RunMatch AI (GearUpToFit Shoe Finder)

A free running-shoe finder quiz served at **https://gearuptofit.com/shoe-finder/**. A transparent scoring engine ranks 87 shoes against nine quiz answers (plus an optional "a shoe I already know" step), shows *why* each shoe scored as it did and what to watch out for, and suggests a 2–3 shoe rotation. Monetised through marked Amazon affiliate links; lead capture through Brevo.

Stack: Vite + React 18 + TypeScript + Tailwind + shadcn/ui, Supabase (email lead capture edge functions), Cloudflare Worker (reverse proxy under `/shoe-finder/`).

## Commands

```bash
npm ci              # install (npm is what CI uses; bun lockfiles are kept for Lovable)
npm run dev         # local dev server (port 8080)
npm test            # vitest: scoring, SEO/prerender, safety, data integrity, analytics, worker routing
npm run build       # validate shoe data -> vite build -> prerender all static pages
npm run preview     # serve ./dist (try /results/neutral-10k-road-neutral/)
npm run lint
```

`npm run build` writes real HTML for the landing page, ~45 result pages, `/methodology/`, and every brand, category, comparison and shoe page, plus `sitemap.xml` and `route-manifest.json`. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) and [docs/MAINTENANCE.md](docs/MAINTENANCE.md).

## Where things live

| Path | What |
| --- | --- |
| `src/lib/shoe-database.ts` | The shoe records. Edit here, then see MAINTENANCE.md |
| `src/lib/scoring-engine.ts` | Weights, factor scoring, rotation. Weights are published on `/methodology/` straight from this file |
| `src/lib/shoe-insights.ts` | Newer-version detection, "who should think twice" notes, similarity to a current shoe |
| `src/lib/safety.ts` | Pain/injury handling (professional-first notice, cautious shortlist) |
| `src/lib/evidence.ts` | The only place research claims are written. Every entry is verified against PubMed |
| `src/lib/page-seo.ts`, `entity-seo.ts`, `landing-seo.ts` | Head tags + JSON-LD, shared by the React pages and the prerenderer |
| `src/lib/prerender-seo.ts`, `scripts/prerender.mts` | Static HTML generation |
| `src/lib/analytics.ts` | GA4 events (see docs/DEPLOYMENT.md#analytics) |
| `cloudflare/worker.js` | Reverse proxy, real 404s, robots policy |
| `supabase/functions/` | Brevo subscribe / drip edge functions |

## Environment

`.env` holds only the three `VITE_SUPABASE_*` values. They are browser-side values (the anon key ships in every JS bundle) and are protected by row-level security, so they are safe to commit. **Never** put a Supabase service-role key, Brevo key or Stripe secret in this repo; those belong in Supabase Edge Function secrets. See `.env.example`.
