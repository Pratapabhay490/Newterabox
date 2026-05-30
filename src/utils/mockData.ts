import type { HistoryItem } from "@/types";

/**
 * Sample mock history. Used only in dev / first-run when localStorage is
 * empty AND the user clicks "Load sample data" on the History page.
 * Never auto-injected.
 */
export const MOCK_HISTORY: HistoryItem[] = [
  {
    id: "surl:demo1",
    sourceUrl: "https://www.terabox.com/s/1demo1",
    title: "Big Buck Bunny — Demo Clip",
    directUrl:
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    thumbnail:
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg",
    durationSec: 596,
    sizeBytes: 158_000_000,
    qualities: [
      {
        label: "720p",
        url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
      },
    ],
    extractedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    lastPositionSec: 142,
    lastWatchedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
  {
    id: "surl:demo2",
    sourceUrl: "https://www.terabox.com/s/1demo2",
    title: "Sintel — Open Movie",
    directUrl:
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
    thumbnail:
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/Sintel.jpg",
    durationSec: 888,
    sizeBytes: 252_000_000,
    qualities: [
      {
        label: "720p",
        url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
      },
    ],
    extractedAt: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString(),
    lastPositionSec: 0,
    lastWatchedAt: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString(),
  },
];
