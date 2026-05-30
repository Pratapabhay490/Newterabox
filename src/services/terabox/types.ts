import type { ExtractedVideo } from "@/types";

/**
 * A pluggable extraction strategy.
 *
 * TeraBox changes its API frequently — keep all fragile logic isolated
 * behind this interface so the rest of the app never breaks.
 */
export interface ExtractionStrategy {
  readonly name: string;
  /** True if this strategy thinks it can handle the given URL. */
  canHandle(url: string): boolean;
  /** Extract metadata + direct URL. Throws on failure. */
  extract(url: string): Promise<ExtractedVideo>;
}

export class ExtractionError extends Error {
  code:
    | "INVALID_URL"
    | "NOT_PUBLIC"
    | "EXTRACTION_FAILED"
    | "UPSTREAM_ERROR"
    | "RATE_LIMITED"
    | "UNKNOWN";

  constructor(
    message: string,
    code: ExtractionError["code"] = "EXTRACTION_FAILED",
  ) {
    super(message);
    this.code = code;
    this.name = "ExtractionError";
  }
}
