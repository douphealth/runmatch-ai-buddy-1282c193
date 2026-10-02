/**
 * GearUpToFit RunMatch — Reverse Proxy Worker
 * Routes: gearuptofit.com/shoe-finder, gearuptofit.com/shoe-finder/*
 * Origin: RUNMATCH_ORIGIN binding (plain-text variable), default below.
 *
 * Serves the RunMatch SPA under the /shoe-finder/ path on the WordPress
 * domain so SEO link equity, AI Overview citations, and organic rankings
 * accrue to gearuptofit.com.
 *
 * What this Worker owns (the origin cannot be trusted with these):
 *  1. Path mapping and link rewriting (/shoe-finder prefix).
 *  2. Real HTTP 404s. A single-page-app host answers EVERY unknown URL with 200
 *     and the landing page (a "soft 404"). The build writes route-manifest.json;
 *     URLs that are not real pages are answered here with status 404, the app
 *     shell (so users still see the friendly 404 screen) and `noindex`.
 *     Fail-open: if the manifest cannot be fetched, everything passes through.
 *  3. Robots policy. Any X-Robots-Tag the origin sends is dropped. Cloudflare
 *     Pages adds `X-Robots-Tag: noindex` to *.pages.dev preview/branch
 *     hostnames, and forwarding it would deindex the public site.
 *     Personalised result links (?d=) get `noindex,follow` (they carry the
 *     runner's answers and duplicate the clean result page).
 */

const DEFAULT_ORIGIN = "https://runmatch-ai-buddy.lovable.app";
const PREFIX = "/shoe-finder";
const MANIFEST_TTL_MS = 10 * 60 * 1000;

// Mirrors answersFromSlug() in src/lib/quiz-data.ts.
const PRONATION = new Set(["neutral", "overpronation", "underpronation", "unsure"]);
const DISTANCE = new Set(["5k", "10k", "half-marathon", "marathon", "ultra", "mixed"]);
const TERRAIN = new Set(["road", "trail", "track", "mixed"]);
const FOOT = new Set(["neutral", "flat", "high-arch", "wide"]);

/** True for slugs shaped like {pronation}-{distance}-{terrain}-{foot}. */
export function isValidResultSlug(slug) {
  const tokens = String(slug).toLowerCase().split("-").filter(Boolean);
  if (tokens.length < 4 || !PRONATION.has(tokens[0])) return false;
  let terrainIdx;
  if (FOOT.has(tokens.slice(-2).join("-"))) terrainIdx = tokens.length - 3;
  else if (FOOT.has(tokens[tokens.length - 1])) terrainIdx = tokens.length - 2;
  else return false;
  if (!TERRAIN.has(tokens[terrainIdx])) return false;
  return DISTANCE.has(tokens.slice(1, terrainIdx).join("-"));
}

const ASSET_PREFIXES = ["/assets/", "/images/", "/~"];
const ASSET_FILES = new Set([
  "/index.html",
  "/sw.js",
  "/manifest.webmanifest",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/route-manifest.json",
  "/placeholder.svg",
]);

/**
 * Classifies an ORIGIN path (prefix already removed).
 * @returns {"asset" | "page" | "not-found"}
 */
export function classifyPath(path, manifest) {
  if (!manifest) return "page"; // fail-open
  const p = path.length > 1 ? path.replace(/\/+$/, "") : path;
  if (p === "/" || p === "") return "page";
  if (ASSET_FILES.has(p) || ASSET_PREFIXES.some((x) => p.startsWith(x))) return "asset";
  if (/\.[a-z0-9]{2,5}$/i.test(p)) return "asset"; // any other file-looking path is passed through

  const seg = p.split("/").filter(Boolean);
  const [root, a, b] = seg;

  if (seg.length === 1 && root === "methodology") return "page";
  if (seg.length === 2 && root === "results") return isValidResultSlug(a) ? "page" : "not-found";
  if (seg.length === 3 && root === "app" && a === "runmatch") return isValidResultSlug(b) ? "page" : "not-found";
  if (seg.length === 2 && root === "shoes") return manifest.shoeIds.includes(a) || a in manifest.shoeAliases ? "page" : "not-found";
  if (seg.length === 2 && root === "compare") {
    if (manifest.comparisonSlugs.includes(a)) return "page";
    const i = a.indexOf("-vs-");
    if (i > 0) {
      const ids = new Set(manifest.shoeIds);
      if (ids.has(a.slice(0, i)) && ids.has(a.slice(i + 4))) return "page";
    }
    return "not-found";
  }
  if (seg.length === 2 && root === "best-running-shoes") return manifest.categorySlugs.includes(a) ? "page" : "not-found";
  if (seg.length === 3 && root === "best-running-shoes" && a === "brand") return manifest.brandSlugs.includes(b) ? "page" : "not-found";
  return "not-found";
}

/** Headers to apply for a response, given the classification and the request URL. */
export function robotsFor(kind, searchParams) {
  if (kind === "not-found") return "noindex, nofollow";
  if (searchParams && searchParams.has("d")) return "noindex, follow";
  return null;
}

/**
 * Cache-Control for ORIGIN paths. The origin's own headers are not trusted: a stale copy of the
 * entry bundle (it has a fixed file name) or of the HTML makes visitors run an old build after a
 * publish, or an old page that points at chunks that no longer exist.
 *  - HTML, the entry bundle/stylesheet, the service-worker retirement script and the web manifest
 *    are revalidated on every load (cheap: the origin answers 304).
 *  - Hashed chunks never change for a given name.
 * Returns null to leave the origin's header alone.
 */
export function cachePolicy(path, contentType) {
  const revalidate = "public, max-age=0, must-revalidate";
  if (path === "/assets/index.js" || path === "/assets/index.css" || path === "/sw.js" || path === "/manifest.webmanifest") return revalidate;
  if (path.startsWith("/assets/chunks/")) return "public, max-age=31536000, immutable";
  if (path.startsWith("/images/")) return "public, max-age=2592000";
  if (String(contentType || "").includes("text/html")) return revalidate;
  return null;
}

class AttrRewriter {
  constructor(attr) {
    this.attr = attr;
  }
  element(el) {
    const v = el.getAttribute(this.attr);
    if (!v) return;
    if (
      v.startsWith("/") &&
      !v.startsWith("//") &&
      !v.startsWith(PREFIX + "/") &&
      v !== PREFIX
    ) {
      el.setAttribute(this.attr, PREFIX + v);
    }
  }
}

class SrcsetRewriter {
  element(el) {
    const v = el.getAttribute("srcset");
    if (!v) return;
    const out = v
      .split(",")
      .map((part) => {
        const t = part.trim();
        if (!t) return t;
        const [url, ...rest] = t.split(/\s+/);
        if (
          url.startsWith("/") &&
          !url.startsWith("//") &&
          !url.startsWith(PREFIX + "/")
        ) {
          return [PREFIX + url, ...rest].join(" ");
        }
        return t;
      })
      .join(", ");
    el.setAttribute("srcset", out);
  }
}

class RemoveElement {
  element(el) {
    el.remove();
  }
}

class HeadInjector {
  element(el) {
    el.prepend(`<base href="${PREFIX}/">`, { html: true });
  }
}

// Per-isolate manifest cache, keyed by origin so a copy fetched from one origin is never
// applied to another (a stale manifest would wrongly 404 real pages).
let manifestCache = { origin: "", at: 0, value: null };
// Why the last manifest lookup ended the way it did; sent as the x-runmatch-manifest header so it can be checked with curl.
let manifestState = "none";

async function loadManifest(origin) {
  const same = manifestCache.origin === origin;
  if (same && manifestCache.value && Date.now() - manifestCache.at < MANIFEST_TTL_MS) {
    manifestState = "cached";
    return manifestCache.value;
  }
  const lastGood = same ? manifestCache.value : null;
  try {
    // The query string changes every MANIFEST_TTL_MS. Without it a 404 that the origin's CDN cached before the
    // manifest existed (for example from an earlier deployment) would keep being served to this lookup.
    const bucket = Math.floor(Date.now() / MANIFEST_TTL_MS);
    const res = await fetch(`${origin}/route-manifest.json?t=${bucket}`, { headers: { accept: "application/json" } });
    if (!res.ok) {
      manifestState = `http-${res.status}`;
      return lastGood; // keep the last good copy for this origin, else null (fail-open)
    }
    const json = await res.json();
    if (!json || !Array.isArray(json.shoeIds)) {
      manifestState = "invalid";
      return lastGood;
    }
    manifestCache = { origin, at: Date.now(), value: json };
    manifestState = "fresh";
    return json;
  } catch (e) {
    manifestState = `error-${String((e && e.message) || e).slice(0, 40)}`;
    return lastGood;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = ((env && env.RUNMATCH_ORIGIN) || DEFAULT_ORIGIN).replace(/\/$/, "");
    const originHost = new URL(origin).host;

    // Map public path -> origin path
    let path = url.pathname;
    if (path === PREFIX) path = "/";
    else if (path.startsWith(PREFIX + "/")) path = path.slice(PREFIX.length);
    else path = "/"; // safety fallback

    // The Lovable host injects a "Edit with Lovable" overlay script. This public URL is our own
    // product page, so the script is neither requested nor delivered.
    if (path === "/~flock.js") {
      return new Response("/* not used */", {
        status: 200,
        headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "public, max-age=86400" },
      });
    }

    const manifest = request.method === "GET" || request.method === "HEAD" ? await loadManifest(origin) : null;
    const kind = classifyPath(path, manifest);

    // Unknown URL: serve the app shell (friendly 404 screen) with a real 404 status.
    const fetchPath = kind === "not-found" ? "/" : path;
    const originUrl = origin + fetchPath + (kind === "not-found" ? "" : url.search);

    // Build origin request
    const newHeaders = new Headers(request.headers);
    newHeaders.set("host", originHost);
    newHeaders.delete("cf-connecting-ip");
    newHeaders.delete("cf-ipcountry");
    newHeaders.delete("cf-ray");
    newHeaders.delete("cf-visitor");

    const originReq = new Request(originUrl, {
      method: request.method,
      headers: newHeaders,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
      redirect: "manual",
    });

    let resp = await fetch(originReq);

    // Rewrite redirects back to the public host + prefix
    if (resp.status >= 300 && resp.status < 400) {
      const loc = resp.headers.get("location");
      if (loc) {
        try {
          const locUrl = new URL(loc, originUrl);
          if (locUrl.host === originHost) {
            const rewritten = `https://${url.host}${PREFIX}${locUrl.pathname}${locUrl.search}${locUrl.hash}`;
            const h = new Headers(resp.headers);
            h.set("location", rewritten);
            h.delete("x-robots-tag");
            return new Response(resp.body, { status: resp.status, headers: h });
          }
        } catch {
          /* keep original */
        }
      }
    }

    // Robots policy is decided here, never inherited from the origin.
    const headers = new Headers(resp.headers);
    headers.delete("x-robots-tag");
    const robots = robotsFor(kind, url.searchParams);
    if (robots) headers.set("x-robots-tag", robots);
    const status = kind === "not-found" ? 404 : resp.status;
    const ct = resp.headers.get("content-type") || "";
    headers.set("x-runmatch-manifest", manifestState);
    const policy = cachePolicy(path, ct);
    if (policy && resp.status === 200) headers.set("cache-control", policy);
    if (kind === "not-found") headers.set("cache-control", "public, max-age=300");

    // HTML: rewrite absolute paths + inject <base>
    if (ct.includes("text/html")) {
      const rewritten = new HTMLRewriter()
        .on("a", new AttrRewriter("href"))
        .on("link", new AttrRewriter("href"))
        .on("script", new AttrRewriter("src"))
        .on("img", new AttrRewriter("src"))
        .on("img", new SrcsetRewriter())
        .on("source", new AttrRewriter("src"))
        .on("source", new SrcsetRewriter())
        .on("video", new AttrRewriter("src"))
        .on("video", new AttrRewriter("poster"))
        .on("audio", new AttrRewriter("src"))
        .on("iframe", new AttrRewriter("src"))
        .on("form", new AttrRewriter("action"))
        .on("meta[property='og:url']", new AttrRewriter("content"))
        .on("meta[property='og:image']", new AttrRewriter("content"))
        .on("link[rel='canonical']", new AttrRewriter("href"))
        .on("script[src*='~flock']", new RemoveElement())
        .on("head", new HeadInjector())
        .transform(new Response(resp.body, { status, headers }));
      return rewritten;
    }

    return new Response(resp.body, { status, headers });
  },
};
