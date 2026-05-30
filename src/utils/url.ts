/**
 * URL validation utilities for TeraBox links.
 *
 * TeraBox runs under dozens of constantly-changing mirror domains, so a
 * strict allowlist quickly goes out of date. We use two signals instead:
 *
 *   1. The URL has a TeraBox-style share path: /s/<id> or ?surl=<id>.
 *   2. The hostname contains a known TeraBox-family token (terabox, dubox,
 *      4funbox, mirrobox, 1024tera, nephobox, momerybox, tibibox, etc.).
 *
 * If either is true we let the request through. The server-side extractor
 * is the source of truth — if a URL slips past these heuristics but isn't
 * actually a TeraBox share, the extractor returns a clean INVALID_URL.
 */

/** Tokens that, if present in the hostname, identify a TeraBox-family domain. */
const TERABOX_HOST_TOKENS = [
  "terabox",
  "dubox",
  "4funbox",
  "mirrobox",
  "nephobox",
  "momerybox",
  "tibibox",
  "1024tera",
  "freeterabox",
  "teraboxapp",
  "teraboxlink",
  "teraboxshare",
  "terashare",
  "terafileshare",
  "tibibox",
];

/** Path patterns that look like a TeraBox share. */
const SHARE_PATH_RE = /\/s\/[A-Za-z0-9_-]+/i;

export function isValidUrl(value: string): boolean {
  try {
    // eslint-disable-next-line no-new
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/** Does the hostname contain any TeraBox-family token? */
export function hasTeraBoxHostToken(host: string): boolean {
  const h = host.toLowerCase();
  return TERABOX_HOST_TOKENS.some((token) => h.includes(token));
}

/**
 * Permissive check — true if the URL plausibly points at a TeraBox share.
 * Errs on the side of accepting unknown mirrors rather than blocking them.
 */
export function isTeraBoxUrl(value: string): boolean {
  if (!isValidUrl(value)) return false;
  try {
    const u = new URL(value);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;

    const hostMatches = hasTeraBoxHostToken(u.hostname);
    const shapeMatches =
      SHARE_PATH_RE.test(u.pathname) || u.searchParams.has("surl");

    // Accept if EITHER signal fires. Most legitimate links match both.
    return hostMatches || shapeMatches;
  } catch {
    return false;
  }
}

/** Extracts a TeraBox share id (surl / shorturl) from common URL shapes. */
export function extractShareId(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl);
    // /s/{shorturl} pattern
    const match = u.pathname.match(/\/s\/([A-Za-z0-9_-]+)/i);
    if (match) return match[1].replace(/^1/, ""); // TeraBox prefixes "1" sometimes
    // ?surl=xxx pattern
    const surl = u.searchParams.get("surl");
    if (surl) return surl.replace(/^1/, "");
    return null;
  } catch {
    return null;
  }
}

/** Stable id for history dedupe (share id or hashed URL). */
export function stableIdFromUrl(rawUrl: string): string {
  const surl = extractShareId(rawUrl);
  if (surl) return `surl:${surl}`;
  // Fallback: simple hash so the same URL always maps to the same id.
  let h = 0;
  for (let i = 0; i < rawUrl.length; i++) {
    h = (h << 5) - h + rawUrl.charCodeAt(i);
    h |= 0;
  }
  return `url:${Math.abs(h).toString(36)}`;
}
