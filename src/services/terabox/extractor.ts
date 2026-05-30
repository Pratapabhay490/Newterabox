/**
 * TeraBox extraction strategies.
 *
 * IMPORTANT: TeraBox actively rotates its tokens, endpoints, and auth
 * requirements. This file is the ONLY place that needs to change when
 * extraction breaks.
 *
 * Strategies, in priority order:
 *
 *   1. ProxyStrategy   — delegates to a self-hosted extractor service
 *                        (set TERABOX_EXTRACTOR_URL). The ONLY reliable
 *                        option for production, because the public
 *                        endpoints now require authenticated sessions.
 *
 *   2. PublicStrategy  — best-effort: fetches the share page, follows
 *                        the mirror redirect (1024terabox.com →
 *                        terabox.app etc.), scrapes the jsToken, then
 *                        calls /share/list anonymously to harvest
 *                        share_id, uk, fs_id, title, thumbnail, etc.
 *
 *                        It then attempts /api/download for the dlink.
 *                        As of mid-2026 TeraBox requires verify_v2 here
 *                        for anonymous callers, so this step usually
 *                        fails with a clear "auth required" message.
 *                        Set TERABOX_EXTRACTOR_URL to bypass it.
 */

import type { ExtractedVideo, VideoQuality } from "@/types";
import { extractShareId, isTeraBoxUrl, stableIdFromUrl } from "@/utils/url";
import { ExtractionError, type ExtractionStrategy } from "./types";

const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const userAgent = () => process.env.TERABOX_USER_AGENT || DEFAULT_UA;

// ---------------------------------------------------------------------------
// 1) Proxy strategy — recommended for production
// ---------------------------------------------------------------------------

class ProxyStrategy implements ExtractionStrategy {
  readonly name = "proxy";

  canHandle(url: string): boolean {
    return Boolean(process.env.TERABOX_EXTRACTOR_URL) && isTeraBoxUrl(url);
  }

  async extract(url: string): Promise<ExtractedVideo> {
    const endpoint = process.env.TERABOX_EXTRACTOR_URL!;
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "user-agent": userAgent(),
    };
    if (process.env.TERABOX_EXTRACTOR_TOKEN) {
      headers["x-extractor-token"] = process.env.TERABOX_EXTRACTOR_TOKEN;
    }

    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({ url }),
        cache: "no-store",
      });
    } catch (err) {
      throw new ExtractionError(
        `Proxy extractor unreachable: ${(err as Error).message}`,
        "UPSTREAM_ERROR",
      );
    }

    if (res.status === 429) {
      throw new ExtractionError("Rate limited by extractor proxy", "RATE_LIMITED");
    }
    if (!res.ok) {
      throw new ExtractionError(
        `Proxy extractor returned ${res.status}`,
        "UPSTREAM_ERROR",
      );
    }

    const data = (await res.json()) as Partial<ExtractedVideo> & {
      directUrl?: string;
      qualities?: VideoQuality[];
    };

    if (!data.directUrl) {
      throw new ExtractionError(
        "Proxy extractor did not return a direct URL",
        "EXTRACTION_FAILED",
      );
    }

    const qualities: VideoQuality[] =
      data.qualities && data.qualities.length > 0
        ? data.qualities
        : [{ label: "Auto", url: data.directUrl }];

    return {
      id: stableIdFromUrl(url),
      sourceUrl: url,
      title: data.title || "TeraBox Video",
      directUrl: data.directUrl,
      thumbnail: data.thumbnail,
      durationSec: data.durationSec,
      sizeBytes: data.sizeBytes,
      qualities,
      extractedAt: new Date().toISOString(),
    };
  }
}

// ---------------------------------------------------------------------------
// 2) Public strategy — best-effort scrape (metadata only on most mirrors)
// ---------------------------------------------------------------------------

interface ShareListItem {
  fs_id: string | number;
  server_filename?: string;
  filename?: string;
  size?: number | string;
  thumbs?: { url1?: string; url2?: string; url3?: string };
  duration?: number | string;
  category?: number | string; // 1 == video on TeraBox
  play_forbid?: number | string;
}

interface ShareListResponse {
  errno?: number;
  errmsg?: string;
  list?: ShareListItem[];
  title?: string;
  share_id?: number | string;
  uk?: number | string;
}

class PublicStrategy implements ExtractionStrategy {
  readonly name = "public";

  canHandle(url: string): boolean {
    return isTeraBoxUrl(url);
  }

  async extract(url: string): Promise<ExtractedVideo> {
    const surlFromInput = extractShareId(url);

    // Step 1: load the share page, FOLLOWING redirects. Mirror domains
    // like 1024terabox.com redirect to www.terabox.app where the actual
    // share lives. We must use the final host for subsequent API calls,
    // because cookies + jsToken are scoped to it.
    const pageRes = await fetch(url, {
      headers: { "user-agent": userAgent() },
      redirect: "follow",
      cache: "no-store",
    }).catch((err) => {
      throw new ExtractionError(
        `Failed to load share page: ${(err as Error).message}`,
        "UPSTREAM_ERROR",
      );
    });

    if (!pageRes.ok) {
      if (pageRes.status === 404) {
        throw new ExtractionError(
          "Share not found — the link may be private or deleted",
          "NOT_PUBLIC",
        );
      }
      throw new ExtractionError(
        `Share page returned ${pageRes.status}`,
        "UPSTREAM_ERROR",
      );
    }

    // Use the FINAL URL (after redirects) for everything downstream.
    const finalUrl = new URL(pageRes.url || url);
    const apiHost = `${finalUrl.protocol}//${finalUrl.host}`;
    const referer = pageRes.url || url;
    const cookies = pageRes.headers.get("set-cookie") || "";

    // The shorturl can be on either the original URL (/s/<id>) or the
    // post-redirect URL (?surl=<id>). Prefer whichever is present.
    const surl =
      finalUrl.searchParams.get("surl") ||
      surlFromInput ||
      extractShareId(pageRes.url || "");
    if (!surl) {
      throw new ExtractionError(
        "Could not find a share id in the URL",
        "INVALID_URL",
      );
    }

    const html = await pageRes.text();
    const jsToken =
      matchFirst(html, /fn%28%22([^%"]+)%22%29/i) ||
      matchFirst(html, /window\.jsToken\s*=\s*["']([^"']+)/i);

    if (!jsToken) {
      throw new ExtractionError(
        "Could not parse jsToken from the share page. TeraBox may have changed its page structure — update services/terabox/extractor.ts",
        "EXTRACTION_FAILED",
      );
    }

    // Step 2: list files in the share. This is the canonical way to get
    // share_id, uk, fs_id, title, thumbnail, duration on terabox.app —
    // anonymous calls work here even when other endpoints don't.
    const listUrl = new URL(`${apiHost}/share/list`);
    listUrl.searchParams.set("app_id", "250528");
    listUrl.searchParams.set("web", "1");
    listUrl.searchParams.set("channel", "dubox");
    listUrl.searchParams.set("clienttype", "0");
    listUrl.searchParams.set("jsToken", jsToken);
    listUrl.searchParams.set("shorturl", surl);
    listUrl.searchParams.set("root", "1");

    const listRes = await fetch(listUrl, {
      headers: {
        "user-agent": userAgent(),
        cookie: cookies,
        referer,
      },
      cache: "no-store",
    });
    if (!listRes.ok) {
      throw new ExtractionError(
        `share/list returned ${listRes.status}`,
        "UPSTREAM_ERROR",
      );
    }

    const listData = (await listRes.json()) as ShareListResponse;

    if (listData.errno && listData.errno !== 0) {
      // Common errnos: -130 = private, -9 = deleted, 105 = need pwd
      const privateErrnos = new Set([-130, -9, 105]);
      throw new ExtractionError(
        `share/list errno=${listData.errno}${listData.errmsg ? ` (${listData.errmsg})` : ""}`,
        privateErrnos.has(listData.errno) ? "NOT_PUBLIC" : "EXTRACTION_FAILED",
      );
    }

    const video = (listData.list || []).find((it) => {
      const cat = typeof it.category === "string" ? Number(it.category) : it.category;
      return (
        cat === 1 ||
        /\.(mp4|mkv|mov|webm|avi|flv|m4v|ts)$/i.test(
          String(it.server_filename || it.filename || ""),
        )
      );
    });

    if (!video) {
      throw new ExtractionError(
        "No video file found in this share",
        "EXTRACTION_FAILED",
      );
    }

    const fsId = String(video.fs_id);
    const title =
      video.server_filename ||
      video.filename ||
      listData.title?.replace(/^\//, "") ||
      "TeraBox Video";

    const shareId = listData.share_id;
    const uk = listData.uk;

    // Step 3: try to resolve the direct stream URL. As of mid-2026, public
    // anonymous calls return `need verify_v2` here on most mirrors. We try
    // anyway because (a) some mirrors still allow it and (b) when the
    // user has set up TERABOX_EXTRACTOR_URL, the ProxyStrategy ran first
    // and we never reach this code.
    if (!shareId || !uk) {
      throw new ExtractionError(
        "share_id / uk missing from share/list response",
        "EXTRACTION_FAILED",
      );
    }

    const dlBody = new URLSearchParams({
      app_id: "250528",
      web: "1",
      channel: "dubox",
      clienttype: "0",
      jsToken,
      encrypt: "0",
      product: "share",
      uk: String(uk),
      primaryid: String(shareId),
      fid_list: `[${fsId}]`,
    });

    const dlRes = await fetch(`${apiHost}/api/download`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": userAgent(),
        cookie: cookies,
        referer,
      },
      body: dlBody.toString(),
      cache: "no-store",
    });

    if (!dlRes.ok) {
      throw new ExtractionError(
        `api/download returned ${dlRes.status}`,
        "UPSTREAM_ERROR",
      );
    }

    const dlData = (await dlRes.json()) as {
      errno?: number;
      errmsg?: string;
      dlink?: { dlink: string }[];
    };

    if (dlData.errno && dlData.errno !== 0) {
      // Friendly error for the most common case.
      const needsAuth =
        dlData.errno === -6 ||
        dlData.errno === 400310 ||
        dlData.errno === 400210 ||
        /verify_v2/i.test(dlData.errmsg || "");
      if (needsAuth) {
        throw new ExtractionError(
          "TeraBox requires an authenticated session to hand out the download URL for this share. Configure TERABOX_EXTRACTOR_URL with a self-hosted extractor service to play this link.",
          "EXTRACTION_FAILED",
        );
      }
      throw new ExtractionError(
        `api/download errno=${dlData.errno}${dlData.errmsg ? ` (${dlData.errmsg})` : ""}`,
        "EXTRACTION_FAILED",
      );
    }

    const dlink = dlData.dlink?.[0]?.dlink;
    if (!dlink) {
      throw new ExtractionError(
        "Could not resolve dlink — extractor may need updating",
        "EXTRACTION_FAILED",
      );
    }

    const thumbnail =
      video.thumbs?.url3 || video.thumbs?.url2 || video.thumbs?.url1;
    const durationSec =
      typeof video.duration === "string"
        ? Number(video.duration)
        : video.duration;
    const sizeBytes =
      typeof video.size === "string" ? Number(video.size) : video.size;

    return {
      id: stableIdFromUrl(url),
      sourceUrl: url,
      title,
      directUrl: dlink,
      thumbnail,
      durationSec: Number.isFinite(durationSec) ? durationSec : undefined,
      sizeBytes: Number.isFinite(sizeBytes) ? sizeBytes : undefined,
      // TeraBox doesn't expose multiple qualities through this path.
      qualities: [{ label: "Auto", url: dlink }],
      extractedAt: new Date().toISOString(),
    };
  }
}

function matchFirst(haystack: string, re: RegExp): string | null {
  const m = haystack.match(re);
  return m ? m[1] : null;
}

// ---------------------------------------------------------------------------
// Public façade
// ---------------------------------------------------------------------------

const STRATEGIES: ExtractionStrategy[] = [
  new ProxyStrategy(),
  new PublicStrategy(),
];

export async function extractTeraBoxVideo(url: string): Promise<ExtractedVideo> {
  if (!isTeraBoxUrl(url)) {
    throw new ExtractionError(
      "URL is not a recognised TeraBox link",
      "INVALID_URL",
    );
  }

  let lastError: unknown = null;
  for (const strategy of STRATEGIES) {
    if (!strategy.canHandle(url)) continue;
    try {
      return await strategy.extract(url);
    } catch (err) {
      lastError = err;
      if (
        err instanceof ExtractionError &&
        (err.code === "NOT_PUBLIC" || err.code === "INVALID_URL")
      ) {
        throw err;
      }
    }
  }

  if (lastError instanceof ExtractionError) throw lastError;
  throw new ExtractionError(
    lastError instanceof Error ? lastError.message : "Extraction failed",
    "EXTRACTION_FAILED",
  );
}
