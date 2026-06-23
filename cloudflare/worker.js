/**
 * GearUpToFit RunMatch — Reverse Proxy Worker
 * Routes: gearuptofit.com/shoe-finder, gearuptofit.com/shoe-finder/*
 * Origin: https://runmatch-ai-buddy.lovable.app
 *
 * Serves the Lovable SPA under the /shoe-finder/ path on the WordPress
 * domain so SEO link equity, AI Overview citations, and organic rankings
 * accrue to gearuptofit.com.
 */

const ORIGIN = "https://runmatch-ai-buddy.lovable.app";
const PREFIX = "/shoe-finder";
const ORIGIN_HOST = new URL(ORIGIN).host;

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

class HeadInjector {
  element(el) {
    el.prepend(`<base href="${PREFIX}/">`, { html: true });
  }
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Map public path -> origin path
    let path = url.pathname;
    if (path === PREFIX) path = "/";
    else if (path.startsWith(PREFIX + "/")) path = path.slice(PREFIX.length);
    else path = "/"; // safety fallback

    const originUrl = ORIGIN + path + url.search;

    // Build origin request
    const newHeaders = new Headers(request.headers);
    newHeaders.set("host", ORIGIN_HOST);
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
          if (locUrl.host === ORIGIN_HOST) {
            const rewritten = `https://${url.host}${PREFIX}${locUrl.pathname}${locUrl.search}${locUrl.hash}`;
            const h = new Headers(resp.headers);
            h.set("location", rewritten);
            return new Response(resp.body, { status: resp.status, headers: h });
          }
        } catch {
          /* keep original */
        }
      }
    }

    const ct = resp.headers.get("content-type") || "";

    // HTML: rewrite absolute paths + inject <base>
    if (ct.includes("text/html")) {
      const out = new HTMLRewriter()
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
        .on("head", new HeadInjector())
        .transform(resp);
      return out;
    }

    return resp;
  },
};
