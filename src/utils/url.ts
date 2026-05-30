/**
 * URL validation utilities for TeraBox links.
 *
 * TeraBox is served under many mirror domains. We accept the most common ones.
 * If the user pastes a link from a domain we don't know, we still let the
 * server attempt extraction (the extractor will reject it cleanly).
 */

const TERABOX_HOSTS = [
  "terabox.com",
  "www.terabox.com",
  "terabox.app",
  "www.terabox.app",
  "1024tera.com",
  "www.1024tera.com",
  "4funbox.com",
  "www.4funbox.com",
  "mirrobox.com",
  "www.mirrobox.com",
  "nephobox.com",
  "www.nephobox.com",
  "teraboxapp.com",
  "www.teraboxapp.com",
  "freeterabox.com",
  "www.freeterabox.com",
  "momerybox.com",
  "tibibox.com",
];

export function isValidUrl(value: string): boolean {
  try {
    // eslint-disable-next-line no-new
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function isTeraBoxUrl(value: string): boolean {
  if (!isValidUrl(value)) return false;
  try {
    const u = new URL(value);
    const host = u.hostname.toLowerCase();
    return (
      TERABOX_HOSTS.includes(host) ||
      host.endsWith(".terabox.com") ||
      host.endsWith(".1024tera.com") ||
      host.endsWith(".4funbox.com") ||
      host.endsWith(".mirrobox.com")
    );
  } catch {
    return false;
  }
}

/** Extracts a TeraBox share id (surl / shorturl) from common URL shapes. */
export function extractShareId(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl);
    // /s/{shorturl} pattern
    const match = u.pathname.match(/\/s\/([^/?#]+)/i);
    if (match) return match[1].replace(/^1/, ""); // TeraBox prefixes "1" sometimes
    // ?surl=xxx pattern
    const surl = u.searchParams.get("surl");
    if (surl) return surl;
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
