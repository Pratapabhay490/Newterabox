/**
 * Shared types for TeraBooks Player.
 * The frontend never imports from services/terabox directly — it only
 * consumes these types via the /api/extract response.
 */

export interface VideoQuality {
  /** Human label, e.g. "720p", "1080p", "Auto" */
  label: string;
  /** Direct, playable URL for this quality. */
  url: string;
  /** Optional bitrate in bits/sec. */
  bitrate?: number;
}

export interface ExtractedVideo {
  /** A stable id derived from the original URL (used for history dedupe). */
  id: string;
  /** The original public TeraBox URL the user pasted. */
  sourceUrl: string;
  /** Best-guess title of the video (filename or page title). */
  title: string;
  /** Direct playable URL — first quality is the default. */
  directUrl: string;
  /** Optional thumbnail/poster. */
  thumbnail?: string;
  /** Duration in seconds, when known. */
  durationSec?: number;
  /** Size in bytes, when known. */
  sizeBytes?: number;
  /** All available qualities (>=1). */
  qualities: VideoQuality[];
  /** When the metadata was extracted (ISO string). */
  extractedAt: string;
}

export interface HistoryItem extends ExtractedVideo {
  /** Last position the user watched, in seconds. */
  lastPositionSec: number;
  /** ISO timestamp of last play. */
  lastWatchedAt: string;
}

export interface ApiError {
  error: string;
  /** Stable error code for client branching. */
  code:
    | "INVALID_URL"
    | "NOT_PUBLIC"
    | "EXTRACTION_FAILED"
    | "UPSTREAM_ERROR"
    | "RATE_LIMITED"
    | "UNKNOWN";
}

export type ExtractResponse = ExtractedVideo | ApiError;
