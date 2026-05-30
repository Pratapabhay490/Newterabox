import { NextRequest, NextResponse } from "next/server";
import { extractTeraBoxVideo, ExtractionError } from "@/services/terabox";
import { isTeraBoxUrl } from "@/utils/url";
import type { ApiError, ExtractedVideo } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/extract
 * Body: { url: string }
 * Returns: ExtractedVideo | ApiError
 *
 * The route is intentionally thin — all extraction logic lives in
 * services/terabox/extractor.ts so it can be replaced when TeraBox
 * rotates its tokens without touching this file.
 */
export async function POST(req: NextRequest) {
  let body: { url?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonError("Request body must be JSON", "INVALID_URL", 400);
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url) {
    return jsonError("Missing 'url' in request body", "INVALID_URL", 400);
  }
  if (!isTeraBoxUrl(url)) {
    return jsonError(
      "URL is not a recognised TeraBox share link",
      "INVALID_URL",
      400,
    );
  }

  try {
    const video: ExtractedVideo = await extractTeraBoxVideo(url);
    return NextResponse.json(video, {
      headers: { "cache-control": "no-store" },
    });
  } catch (err) {
    if (err instanceof ExtractionError) {
      const status =
        err.code === "INVALID_URL" || err.code === "NOT_PUBLIC"
          ? 400
          : err.code === "RATE_LIMITED"
            ? 429
            : err.code === "UPSTREAM_ERROR"
              ? 502
              : 500;
      return jsonError(err.message, err.code, status);
    }
    console.error("[/api/extract] unexpected error", err);
    return jsonError("Unexpected extraction error", "UNKNOWN", 500);
  }
}

function jsonError(
  error: string,
  code: ApiError["code"],
  status: number,
): NextResponse<ApiError> {
  return NextResponse.json({ error, code }, { status });
}
