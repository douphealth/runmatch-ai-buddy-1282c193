/**
 * Minimal client for the Amazon Creators API (the PA-API successor), shared by the catalog scripts.
 *
 * Credentials come from the environment and are never written anywhere:
 *   AMAZON_CREATORS_CLIENT_ID / AMAZON_CREATORS_CLIENT_SECRET
 * or, for a local text file that contains "amzn1.application-oa2-client.…" / "amzn1.oa2-cs.v1.…" pairs:
 *   AMAZON_CREDENTIAL_FILE=path/to/file  [AMAZON_CREATORS_CLIENT_ID=<which pair to use, default: the last one>]
 *
 * Node's built-in fetch cannot reach creatorsapi.amazon (TLS reset), so this uses node:https.
 * Amazon throttles to about one request per second.
 */
import fs from 'node:fs';
import https from 'node:https';

export const PARTNER_TAG = 'papalex-20';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function request({ host, pathname, method = 'POST', headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const req = https.request({ host, path: pathname, method, headers, timeout: 45000 }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        let json;
        try { json = JSON.parse(data); } catch { json = { raw: data.slice(0, 200) }; }
        resolve({ status: res.statusCode, json });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
    if (body) req.write(body);
    req.end();
  });
}

export function credentials() {
  let id = process.env.AMAZON_CREATORS_CLIENT_ID;
  let secret = process.env.AMAZON_CREATORS_CLIENT_SECRET;
  const file = process.env.AMAZON_CREDENTIAL_FILE;
  if ((!id || !secret) && file) {
    const txt = fs.readFileSync(file, 'utf8');
    const ids = [...txt.matchAll(/amzn1\.application-oa2-client\.[0-9a-f]+/g)].map((m) => m[0]);
    const secrets = [...txt.matchAll(/amzn1\.oa2-cs\.v1\.[0-9a-f]+/g)].map((m) => m[0]);
    const i = id ? ids.lastIndexOf(id) : ids.length - 1;
    id = ids[i];
    secret = secrets[i];
  }
  if (!id || !secret) {
    console.error('Set AMAZON_CREATORS_CLIENT_ID and AMAZON_CREATORS_CLIENT_SECRET (or AMAZON_CREDENTIAL_FILE).');
    process.exit(1);
  }
  return { id, secret };
}

export async function getToken() {
  const { id, secret } = credentials();
  const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret, scope: 'creatorsapi::default' }).toString();
  const { status, json } = await request({
    host: 'api.amazon.com',
    pathname: '/auth/o2/token',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
    body,
  });
  if (!json.access_token) throw new Error(`Amazon token request failed (${status}): ${json.error ?? ''} ${json.error_description ?? ''}`);
  return json.access_token;
}

/** One API call with the throttling Amazon enforces (about 1 request per second to start with). */
export async function api(token, endpoint, payload) {
  const body = JSON.stringify({ partnerTag: PARTNER_TAG, ...payload });
  for (let attempt = 0; attempt < 8; attempt++) {
    let res;
    try {
      res = await request({
        host: 'creatorsapi.amazon',
        pathname: endpoint,
        headers: { Authorization: `Bearer ${token}`, 'x-marketplace': 'www.amazon.com', 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        body,
      });
    } catch (e) {
      // A dropped connection (ECONNRESET, timeout) is worth another try; the next attempt waits a little longer.
      if (attempt === 7) throw e;
      await sleep(2000 + attempt * 2000);
      continue;
    }
    const { status, json } = res;
    if (status === 429) { await sleep(1500 + attempt * 1500); continue; }
    if (status !== 200) throw new Error(`${endpoint} -> ${status}: ${JSON.stringify(json).slice(0, 200)}`);
    await sleep(1200);
    return json;
  }
  throw new Error(`${endpoint}: still throttled after retries`);
}

/** Everything the catalog scripts read about a listing. */
export const DETAIL_RESOURCES = [
  'images.primary.large',
  'images.primary.highRes',
  'itemInfo.title',
  'itemInfo.byLineInfo',
  'itemInfo.features',
  'itemInfo.productInfo',
  'browseNodeInfo.browseNodes',
  'offersV2.listings.price',
  'offersV2.listings.availability',
  'offersV2.listings.isBuyBoxWinner',
];

/** getItems for any number of ASINs (10 per call) with the detail resources. Returns Map(asin -> flattened listing). */
export async function getListings(token, asins, { quiet = false } = {}) {
  const found = new Map();
  for (let i = 0; i < asins.length; i += 10) {
    const json = await api(token, '/catalog/v1/getItems', { itemIds: asins.slice(i, i + 10), resources: DETAIL_RESOURCES });
    for (const it of json.itemsResult?.items ?? []) found.set(it.asin, flattenListing(it));
    if (!quiet) process.stdout.write('.');
  }
  if (!quiet) process.stdout.write('\n');
  return found;
}

export function flattenListing(it) {
  const listings = it.offersV2?.listings ?? [];
  const buy = listings.find((l) => l.isBuyBoxWinner) ?? listings[0];
  return {
    asin: it.asin,
    title: it.itemInfo?.title?.displayValue ?? '',
    brand: it.itemInfo?.byLineInfo?.brand?.displayValue ?? '',
    features: it.itemInfo?.features?.displayValues ?? [],
    image: it.images?.primary?.large?.url ?? null,
    imageHi: it.images?.primary?.highRes?.url ?? null,
    browse: (it.browseNodeInfo?.browseNodes ?? []).map((n) => n.contextFreeName).filter((n) => n && !/^[0-9a-f-]{20,}/.test(n)),
    availability: buy?.availability?.type ?? 'UNKNOWN',
    price: buy?.price?.money?.amount ?? null,
    url: it.detailPageURL,
  };
}
