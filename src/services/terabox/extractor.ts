/**
 * TeraBox extraction strategies.
 *
 * IMPORTANT: TeraBox actively rotates its tokens and endpoints. This file
 * is the ONLY place that needs to change when extraction breaks.
 *
 * We define two strategies in priority order:
 *   1. ProxyStrategy   — delegates to a self-hosted extractor service
 *                        (set TERABOX_EXTRACTOR_URL). Most reliable.
 *   2. PublicStrategy  — best-effort: fetches the share page, scrapes
 *                        the embedded JSON, and resolves the dlink.
 *
 * The PublicStrategy is included for local/demo use. For production,
 * point TERABOX_EXTRACTOR_URL at a service you control.
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
        // Don't cache extraction results at the edge.
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
// 2) Public strategy — best-effort scrape of the share page
// ---------------------------------------------------------------------------
//
// TeraBox embeds a JSON blob in the share page that includes shareid, uk,
// and a list of items. We then call /share/list and /share/streaming or
// /share/download to obtain a dlink. The dlink is the playable URL.
//
// This is intentionally minimal and well-commented so you can iterate on
// it as TeraBox rotates parameters.

interface ShareListItem {
  fs_id: string | number;
  server_filename?: string;
  filename?: string;
  size?: number;
  thumbs?: { url1?: string; url2?: string; url3?: string };
  duration?: number;
  category?: number; // 1 == video on TeraBox
}

class PublicStrategy implements ExtractionStrategy {
  readonly name = "public";

  canHandle(url: string): boolean {
    return isTeraBoxUrl(url);
  }

  async extract(url: string): Promise<ExtractedVideo> {
    const surl = extractShareId(url);
    if (!surl) {
      throw new ExtractionError(
        "Could not find a share id in the URL",
        "INVALID_URL",
      );
    }

    // Step 1: load the share page to harvest cookies + jsToken + shareid + uk.
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

    const html = await pageRes.text();
    const cookies = pageRes.headers.get("set-cookie") || "";

    const jsToken = matchFirst(html, /fn%28%22([^%"]+)%22%29/i)
      || matchFirst(html, /window\.jsToken\s*=\s*["']([^"']+)/i);
    const shareid = matchFirst(html, /"shareid":\s*"?(\d+)"?/i);
    const uk = matchFirst(html, /"uk":\s*"?(\d+)"?/i)
      || matchFirst(html, /"share_uk":\s*"?(\d+)"?/i);

    if (!jsToken || !shareid || !uk) {
      throw new ExtractionError(
        "Could not parse share metadata. TeraBox may have changed its page structure — update services/terabox/extractor.ts",
        "EXTRACTION_FAILED",
      );
    }

    // Step 2: list files in the share.
    const listUrl = new URL("https://www.terabox.com/share/list");
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
        referer: url,
      },
      cache: "no-store",
    });
    if (!listRes.ok) {
      throw new ExtractionError(
        `share/list returned ${listRes.status}`,
        "UPSTREAM_ERROR",
      );
    }

    const listData = (await listRes.json()) as {
      errno?: number;
      list?: ShareListItem[];
      title?: string;
    };

    if (listData.errno && listData.errno !== 0) {
      // Common errnos: -130 = private, -9 = deleted
      const privateErrnos = new Set([-130, -9, 105]);
      throw new ExtractionError(
        `share/list errno=${listData.errno}`,
        privateErrnos.has(listData.errno) ? "NOT_PUBLIC" : "EXTRACTION_FAILED",
      );
    }

    const video = (listData.list || []).find(
      (it) => it.category === 1 || /\.(mp4|mkv|mov|webm|avi|flv|m4v)$/i.test(
        String(it.server_filename || it.filename || ""),
      ),
    );

    if (!video) {
      throw new ExtractionError(
        "No video file found in this share",
        "EXTRACTION_FAILED",
      );
    }

    const fsId = String(video.fs_id);
    const title =
      video.server_filename || video.filename || listData.title || "TeraBox Video";

    // Step 3: resolve the direct stream URL via /api/download.
    // (Different TeraBox front-ends use different endpoints; if this breaks
    // try /share/download or /api/streaming. Both are rate-limited.)
    const dlBody = new URLSearchParams({
      app_id: "250528",
      web: "1",
      channel: "dubox",
      clienttype: "0",
      jsToken,
      "encrypt": "0",
      "product": "share",
      "uk": uk,
      "shareid": shareid,
      "primaryid": shareid,
      "fid_list": `[${fsId}]`,
    });

    const dlRes = await fetch("https://www.terabox.com/api/download", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": userAgent(),
        cookie: cookies,
        referer: url,
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
      dlink?: { dlink: string }[];
    };

    if (dlData.errno && dlData.errno !== 0) {
      throw new ExtractionError(
        `api/download errno=${dlData.errno}`,
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

    return {
      id: stableIdFromUrl(url),
      sourceUrl: url,
      title,
      directUrl: dlink,
      thumbnail:
        video.thumbs?.url3 ||
        video.thumbs?.url2 ||
        video.thumbs?.url1,
      durationSec: video.duration,
      sizeBytes: video.size,
      // TeraBox doesn't expose multiple qualities through this path — single track.
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

const STRATEGIES: ExtractionStrategy[] = [new ProxyStrategy(), new PublicStrategy()];

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
      // If a strategy says NOT_PUBLIC or INVALID_URL, don't try the next one.
      if (
        err instanceof ExtractionError &&
        (err.code === "NOT_PUBLIC" || err.code === "INVALID_URL")
      ) {
        throw err;
      }
      // Otherwise fall through to the next strategy.
    }
  }

  if (lastError instanceof ExtractionError) throw lastError;
  throw new ExtractionError(
    lastError instanceof Error ? lastError.message : "Extraction failed",
    "EXTRACTION_FAILED",
  );
}
