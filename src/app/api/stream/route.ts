import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/stream?u=<encoded direct url>
 *
 * Proxies the TeraBox direct/dlink URL through our origin so that:
 *   1. The browser can play it without CORS issues.
 *   2. We can attach the correct Referer + User-Agent headers, which
 *      TeraBox CDN often requires.
 *   3. The user's IP is not exposed to TeraBox CDNs.
 *
 * Range requests are forwarded so the player can seek.
 */
export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get("u");
  if (!target) {
    return new NextResponse("Missing 'u' query param", { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return new NextResponse("Invalid 'u' URL", { status: 400 });
  }

  // Allowlist: only proxy hosts that look like TeraBox/Baidu CDNs to
  // avoid turning this endpoint into an open relay.
  const host = parsed.hostname.toLowerCase();
  const allowed =
    host.endsWith(".terabox.com") ||
    host.endsWith(".1024tera.com") ||
    host.endsWith(".4funbox.com") ||
    host.endsWith(".mirrobox.com") ||
    host.endsWith(".dubox.com") ||
    host.endsWith(".pcs.baidu.com") ||
    host.endsWith(".baidupcs.com") ||
    host.endsWith(".terabox.app");

  if (!allowed) {
    return new NextResponse("Host not allowed", { status: 403 });
  }

  const upstreamHeaders: Record<string, string> = {
    "user-agent":
      process.env.TERABOX_USER_AGENT ||
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    referer: "https://www.terabox.com/",
  };
  // Forward Range header to support seeking.
  const range = req.headers.get("range");
  if (range) upstreamHeaders["range"] = range;

  const upstream = await fetch(target, {
    headers: upstreamHeaders,
    // Do NOT cache — links are short-lived and signed.
    cache: "no-store",
    redirect: "follow",
  });

  // Mirror status (200 / 206) and the headers the player needs.
  const headers = new Headers();
  const passthrough = [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "last-modified",
    "etag",
  ];
  for (const h of passthrough) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  if (!headers.has("accept-ranges")) headers.set("accept-ranges", "bytes");
  headers.set("cache-control", "no-store");

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers,
  });
}
